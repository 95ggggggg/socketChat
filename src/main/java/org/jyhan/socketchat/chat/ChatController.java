package org.jyhan.socketchat.chat;

import java.security.Principal;
import java.util.List;
import org.jyhan.socketchat.chat.api.ChatRoomDetailResponse;
import org.jyhan.socketchat.chat.api.ChatRoomSummary;
import org.jyhan.socketchat.chat.api.CreateRoomRequest;
import org.jyhan.socketchat.chat.api.JoinRoomResponse;
import org.jyhan.socketchat.chat.api.MarkReadResponse;
import org.jyhan.socketchat.chat.service.ChatService;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/chat")
public class ChatController {

    private final SimpMessagingTemplate messagingTemplate;
    private final ChatService chatService;

    public ChatController(SimpMessagingTemplate messagingTemplate, ChatService chatService) {
        this.messagingTemplate = messagingTemplate;
        this.chatService = chatService;
    }

    @GetMapping("/rooms")
    public List<ChatRoomSummary> getRooms(Principal principal) {
        return chatService.getRooms(principal.getName());
    }

    @PostMapping("/rooms")
    public ChatRoomSummary createRoom(@RequestBody CreateRoomRequest request, Principal principal) {
        return chatService.createRoom(request, principal.getName());
    }

    @GetMapping("/rooms/{roomId}")
    public ChatRoomDetailResponse getRoom(@PathVariable String roomId, Principal principal) {
        return chatService.getRoomDetail(roomId, principal.getName());
    }

    @PostMapping("/rooms/{roomId}/join")
    public JoinRoomResponse joinRoom(@PathVariable String roomId, Principal principal) {
        return chatService.joinRoom(roomId, principal.getName());
    }

    @PostMapping("/rooms/{roomId}/read")
    public MarkReadResponse markRead(@PathVariable String roomId, Principal principal) {
        return chatService.markRoomRead(roomId, principal.getName());
    }

    @MessageMapping("/chat/{roomId}/send")
    public void sendMessage(@DestinationVariable String roomId, ChatMessage message, Principal principal) {
        ChatMessage savedMessage = chatService.saveMessage(roomId, message, principal.getName());
        messagingTemplate.convertAndSend("/topic/chat/" + roomId, savedMessage);
    }
}
