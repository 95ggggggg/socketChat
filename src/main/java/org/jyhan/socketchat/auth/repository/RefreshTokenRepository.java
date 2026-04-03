package org.jyhan.socketchat.auth.repository;

import java.time.Instant;
import java.util.Optional;
import org.jyhan.socketchat.auth.domain.RefreshToken;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {

    Optional<RefreshToken> findByToken(String token);

    void deleteByToken(String token);

    void deleteByUserUsername(String username);

    void deleteByExpiresAtBefore(Instant instant);
}
