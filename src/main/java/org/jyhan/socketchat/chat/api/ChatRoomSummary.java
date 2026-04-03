package org.jyhan.socketchat.chat.api;

import java.time.Instant;

public record ChatRoomSummary(
        String id,
        String name,
        Instant createdAt,
        long messageCount,
        long unreadCount,
        String accessType,
        boolean joined
) {
}
