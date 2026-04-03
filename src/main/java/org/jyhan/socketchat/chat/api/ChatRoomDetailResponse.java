package org.jyhan.socketchat.chat.api;

import java.util.List;
import org.jyhan.socketchat.chat.ChatMessage;

public record ChatRoomDetailResponse(
        String roomId,
        String roomName,
        String topicPath,
        String publishPath,
        String accessType,
        boolean joined,
        long unreadCount,
        List<ChatMessage> history
) {
}
