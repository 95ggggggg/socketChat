package org.jyhan.socketchat.auth.api;

import java.time.Instant;

public record AuthResponse(
        String accessToken,
        String refreshToken,
        String tokenType,
        long accessTokenExpiresInSeconds,
        long refreshTokenExpiresInSeconds,
        UserProfileResponse user
) {
    public record UserProfileResponse(
            Long id,
            String username,
            String email,
            String role,
            boolean active,
            Instant createdAt
    ) {
    }
}
