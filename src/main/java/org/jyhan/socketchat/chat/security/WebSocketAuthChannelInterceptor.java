package org.jyhan.socketchat.chat.security;

import java.util.List;
import org.jyhan.socketchat.auth.security.JwtTokenProvider;
import org.jyhan.socketchat.chat.service.ChatService;
import org.jyhan.socketchat.user.repository.ChatUserRepository;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

@Component
public class WebSocketAuthChannelInterceptor implements ChannelInterceptor {

    private final JwtTokenProvider jwtTokenProvider;
    private final ChatService chatService;
    private final ChatUserRepository chatUserRepository;

    public WebSocketAuthChannelInterceptor(
            JwtTokenProvider jwtTokenProvider,
            ChatService chatService,
            ChatUserRepository chatUserRepository
    ) {
        this.jwtTokenProvider = jwtTokenProvider;
        this.chatService = chatService;
        this.chatUserRepository = chatUserRepository;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null || accessor.getCommand() == null) {
            return message;
        }

        if (StompCommand.CONNECT.equals(accessor.getCommand())) {
            String token = extractBearerToken(accessor.getNativeHeader("Authorization"));
            if (token == null || !jwtTokenProvider.isValid(token) || !"access".equals(jwtTokenProvider.getType(token))) {
                throw new AccessDeniedException("WebSocket 인증이 필요합니다.");
            }
            String username = jwtTokenProvider.getUsername(token);
            boolean activeUser = chatUserRepository.findByUsername(username)
                    .map(user -> user.isActive())
                    .orElse(false);
            if (!activeUser) {
                throw new AccessDeniedException("비활성화된 사용자입니다.");
            }
            accessor.setUser(new StompPrincipal(username));
            return message;
        }

        if (StompCommand.SEND.equals(accessor.getCommand()) || StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
            String username = accessor.getUser() == null ? null : accessor.getUser().getName();
            String destination = accessor.getDestination();
            String roomId = extractRoomId(destination);
            if (username == null || roomId == null || !chatService.canAccessRoom(roomId, username)) {
                throw new AccessDeniedException("채팅방 권한이 없습니다.");
            }
        }

        return message;
    }

    private String extractBearerToken(List<String> values) {
        if (values == null || values.isEmpty()) {
            return null;
        }
        String value = values.getFirst();
        if (value != null && value.startsWith("Bearer ")) {
            return value.substring(7);
        }
        return null;
    }

    private String extractRoomId(String destination) {
        if (destination == null) {
            return null;
        }
        String[] parts = destination.split("/");
        for (int i = 0; i < parts.length; i++) {
            if ("chat".equals(parts[i]) && i + 1 < parts.length) {
                return parts[i + 1];
            }
        }
        return null;
    }
}
