package org.jyhan.socketchat.chat.service;

import java.util.Comparator;
import java.util.List;
import org.jyhan.socketchat.chat.ChatMessage;
import org.jyhan.socketchat.chat.MessageType;
import org.jyhan.socketchat.chat.api.AdminRoomDetailResponse;
import org.jyhan.socketchat.chat.api.ChatRoomDetailResponse;
import org.jyhan.socketchat.chat.api.ChatRoomSummary;
import org.jyhan.socketchat.chat.api.CreateRoomRequest;
import org.jyhan.socketchat.chat.api.JoinRoomResponse;
import org.jyhan.socketchat.chat.api.MarkReadResponse;
import org.jyhan.socketchat.chat.api.RoomMemberResponse;
import org.jyhan.socketchat.chat.api.UpdateRoomRequest;
import org.jyhan.socketchat.chat.domain.ChatMessageEntity;
import org.jyhan.socketchat.chat.domain.ChatRoom;
import org.jyhan.socketchat.chat.domain.RoomAccessType;
import org.jyhan.socketchat.chat.domain.RoomMember;
import org.jyhan.socketchat.chat.domain.RoomReadState;
import org.jyhan.socketchat.chat.repository.ChatMessageRepository;
import org.jyhan.socketchat.chat.repository.ChatRoomRepository;
import org.jyhan.socketchat.chat.repository.RoomMemberRepository;
import org.jyhan.socketchat.chat.repository.RoomReadStateRepository;
import org.jyhan.socketchat.user.domain.ChatUser;
import org.jyhan.socketchat.user.repository.ChatUserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class ChatService {

    private final ChatRoomRepository chatRoomRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final RoomMemberRepository roomMemberRepository;
    private final RoomReadStateRepository roomReadStateRepository;
    private final ChatUserRepository chatUserRepository;

    public ChatService(
            ChatRoomRepository chatRoomRepository,
            ChatMessageRepository chatMessageRepository,
            RoomMemberRepository roomMemberRepository,
            RoomReadStateRepository roomReadStateRepository,
            ChatUserRepository chatUserRepository
    ) {
        this.chatRoomRepository = chatRoomRepository;
        this.chatMessageRepository = chatMessageRepository;
        this.roomMemberRepository = roomMemberRepository;
        this.roomReadStateRepository = roomReadStateRepository;
        this.chatUserRepository = chatUserRepository;
    }

    public List<ChatRoomSummary> getRooms(String username) {
        return chatRoomRepository.findAll().stream()
                .map(room -> toSummary(room, username))
                .toList();
    }

    @Transactional
    public ChatRoomSummary createRoom(CreateRoomRequest request, String username) {
        String roomName = request.name() == null ? "" : request.name().trim();
        if (roomName.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "채팅방 이름은 비어 있을 수 없습니다.");
        }

        RoomAccessType accessType = parseAccessType(request.accessType());
        ChatRoom room = chatRoomRepository.findByName(roomName)
                .orElseGet(() -> chatRoomRepository.save(new ChatRoom(roomName, accessType)));
        ensureMember(room, getUser(username));

        return toSummary(room, username);
    }

    public AdminRoomDetailResponse getAdminRoomDetail(String roomId) {
        ChatRoom room = getRoomEntity(roomId);
        return new AdminRoomDetailResponse(
                toSummary(room, null),
                roomMemberRepository.findByRoomId(roomId).stream()
                        .map(member -> new RoomMemberResponse(
                                member.getUser().getId(),
                                member.getUser().getUsername(),
                                member.getUser().getEmail(),
                                member.getJoinedAt()
                        ))
                        .toList()
        );
    }

    @Transactional
    public ChatRoomSummary updateRoom(String roomId, UpdateRoomRequest request) {
        ChatRoom room = getRoomEntity(roomId);
        String roomName = request.name() == null ? room.getName() : request.name().trim();
        if (roomName.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "채팅방 이름은 비어 있을 수 없습니다.");
        }

        room.changeName(roomName);
        room.changeAccessType(parseAccessType(request.accessType()));
        return toSummary(room, null);
    }

    @Transactional
    public void deleteRoom(String roomId) {
        getRoomEntity(roomId);
        chatMessageRepository.deleteByRoomId(roomId);
        roomMemberRepository.deleteByRoomId(roomId);
        roomReadStateRepository.deleteByRoomId(roomId);
        chatRoomRepository.deleteById(roomId);
    }

    public ChatRoomDetailResponse getRoomDetail(String roomId, String username) {
        ChatRoom room = getRoomEntity(roomId);
        if (!canAccessRoom(roomId, username)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "채팅방 접근 권한이 없습니다.");
        }
        List<ChatMessage> history = chatMessageRepository.findTop50ByRoomIdOrderBySentAtDesc(roomId).stream()
                .sorted(Comparator.comparing(ChatMessageEntity::getSentAt))
                .map(this::toMessage)
                .toList();

        return new ChatRoomDetailResponse(
                room.getId(),
                room.getName(),
                "/topic/chat/" + room.getId(),
                "/app/chat/" + room.getId() + "/send",
                room.getAccessType().name(),
                isJoined(roomId, username),
                getUnreadCount(roomId, username),
                history
        );
    }

    @Transactional
    public ChatMessage saveMessage(String roomId, ChatMessage message, String username) {
        if (!canAccessRoom(roomId, username)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "채팅방 접근 권한이 없습니다.");
        }
        ChatRoom room = getRoomEntity(roomId);
        MessageType type = message.getType() == null ? MessageType.TALK : message.getType();
        String sender = username;
        String content = sanitize(message.getContent(), "");

        ChatMessageEntity saved = chatMessageRepository.save(
                new ChatMessageEntity(room, sender, content, type)
        );

        return toMessage(saved);
    }

    @Transactional
    public ChatRoom ensureLobbyRoom() {
        return chatRoomRepository.findByName("lobby")
                .orElseGet(() -> chatRoomRepository.save(new ChatRoom("lobby", RoomAccessType.PUBLIC)));
    }

    @Transactional
    public JoinRoomResponse joinRoom(String roomId, String username) {
        ChatRoom room = getRoomEntity(roomId);
        ChatUser user = getUser(username);
        ensureMember(room, user);
        return new JoinRoomResponse(roomId, username, true);
    }

    @Transactional
    public MarkReadResponse markRoomRead(String roomId, String username) {
        if (!canAccessRoom(roomId, username)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "채팅방 접근 권한이 없습니다.");
        }

        ChatRoom room = getRoomEntity(roomId);
        ChatUser user = getUser(username);
        ChatMessageEntity latestMessage = chatMessageRepository.findTopByRoomIdOrderByIdDesc(roomId);

        RoomReadState readState = roomReadStateRepository.findByRoomIdAndUserUsername(roomId, username)
                .orElseGet(() -> new RoomReadState(room, user, null));
        readState.update(latestMessage == null ? null : latestMessage.getId());
        roomReadStateRepository.save(readState);

        return new MarkReadResponse(roomId, 0, readState.getLastReadAt());
    }

    public boolean canAccessRoom(String roomId, String username) {
        ChatRoom room = getRoomEntity(roomId);
        return room.getAccessType() == RoomAccessType.PUBLIC || isJoined(roomId, username);
    }

    public boolean isJoined(String roomId, String username) {
        return roomMemberRepository.existsByRoomIdAndUserUsername(roomId, username);
    }

    public long getUnreadCount(String roomId, String username) {
        RoomReadState readState = roomReadStateRepository.findByRoomIdAndUserUsername(roomId, username).orElse(null);
        if (readState == null || readState.getLastReadMessageId() == null) {
            return chatMessageRepository.countByRoomId(roomId);
        }
        return chatMessageRepository.countByRoomIdAndIdGreaterThan(roomId, readState.getLastReadMessageId());
    }

    private ChatRoom getRoomEntity(String roomId) {
        return chatRoomRepository.findById(roomId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "존재하지 않는 채팅방입니다: " + roomId));
    }

    private ChatUser getUser(String username) {
        return chatUserRepository.findByUsername(username)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "사용자를 찾을 수 없습니다."));
    }

    private void ensureMember(ChatRoom room, ChatUser user) {
        if (!roomMemberRepository.existsByRoomIdAndUserUsername(room.getId(), user.getUsername())) {
            roomMemberRepository.save(new RoomMember(room, user));
        }
    }

    private RoomAccessType parseAccessType(String accessType) {
        if (accessType == null || accessType.isBlank()) {
            return RoomAccessType.MEMBERS_ONLY;
        }
        try {
            return RoomAccessType.valueOf(accessType.trim().toUpperCase());
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "지원하지 않는 채팅방 공개 범위입니다.");
        }
    }

    private ChatMessage toMessage(ChatMessageEntity entity) {
        ChatMessage message = new ChatMessage();
        message.setRoomId(entity.getRoom().getId());
        message.setSender(entity.getSender());
        message.setContent(entity.getContent());
        message.setType(entity.getType());
        message.setSentAt(entity.getSentAt());
        return message;
    }

    private ChatRoomSummary toSummary(ChatRoom room, String username) {
        boolean canAccess = username != null && canAccessRoom(room.getId(), username);
        return new ChatRoomSummary(
                room.getId(),
                room.getName(),
                room.getCreatedAt(),
                chatMessageRepository.countByRoomId(room.getId()),
                canAccess ? getUnreadCount(room.getId(), username) : 0,
                room.getAccessType().name(),
                username != null && isJoined(room.getId(), username)
        );
    }

    private String sanitize(String value, String defaultValue) {
        if (value == null) {
            return defaultValue;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? defaultValue : trimmed;
    }
}
