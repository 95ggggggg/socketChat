package org.jyhan.socketchat.chat.api;

import java.time.Instant;

public record RoomMemberResponse(
        Long userId,
        String username,
        String email,
        Instant joinedAt
) {
}
