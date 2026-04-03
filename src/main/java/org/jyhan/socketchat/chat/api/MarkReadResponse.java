package org.jyhan.socketchat.chat.api;

import java.time.Instant;

public record MarkReadResponse(
        String roomId,
        long unreadCount,
        Instant lastReadAt
) {
}
