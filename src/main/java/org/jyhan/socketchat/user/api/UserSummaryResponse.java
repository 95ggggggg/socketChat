package org.jyhan.socketchat.user.api;

import java.time.Instant;

public record UserSummaryResponse(
        Long id,
        String username,
        String email,
        String role,
        boolean active,
        Instant createdAt
) {
}
