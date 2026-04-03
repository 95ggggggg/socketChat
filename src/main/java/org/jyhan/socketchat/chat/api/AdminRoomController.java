package org.jyhan.socketchat.chat.api;

import java.security.Principal;
import org.jyhan.socketchat.auth.service.AuthService;
import org.jyhan.socketchat.chat.service.ChatService;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/rooms")
public class AdminRoomController {

    private final AuthService authService;
    private final ChatService chatService;

    public AdminRoomController(AuthService authService, ChatService chatService) {
        this.authService = authService;
        this.chatService = chatService;
    }

    @GetMapping("/{roomId}")
    public AdminRoomDetailResponse getRoom(@PathVariable String roomId, Principal principal) {
        authService.requireAdmin(principal.getName());
        return chatService.getAdminRoomDetail(roomId);
    }

    @PatchMapping("/{roomId}")
    public ChatRoomSummary updateRoom(
            @PathVariable String roomId,
            @RequestBody UpdateRoomRequest request,
            Principal principal
    ) {
        authService.requireAdmin(principal.getName());
        return chatService.updateRoom(roomId, request);
    }

    @DeleteMapping("/{roomId}")
    public void deleteRoom(@PathVariable String roomId, Principal principal) {
        authService.requireAdmin(principal.getName());
        chatService.deleteRoom(roomId);
    }
}
