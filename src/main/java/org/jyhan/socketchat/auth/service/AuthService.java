package org.jyhan.socketchat.auth.service;

import org.jyhan.socketchat.auth.api.AuthResponse;
import org.jyhan.socketchat.auth.api.LoginRequest;
import org.jyhan.socketchat.auth.api.LogoutRequest;
import org.jyhan.socketchat.auth.api.RefreshTokenRequest;
import org.jyhan.socketchat.auth.api.RegisterRequest;
import org.jyhan.socketchat.auth.domain.RefreshToken;
import org.jyhan.socketchat.auth.repository.RefreshTokenRepository;
import org.jyhan.socketchat.auth.security.JwtTokenProvider;
import org.jyhan.socketchat.user.domain.ChatUser;
import org.jyhan.socketchat.user.domain.UserRole;
import org.jyhan.socketchat.user.api.UpdateUserRequest;
import org.jyhan.socketchat.user.api.UserSummaryResponse;
import org.jyhan.socketchat.user.repository.ChatUserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class AuthService {

    private final ChatUserRepository chatUserRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;

    public AuthService(
            ChatUserRepository chatUserRepository,
            RefreshTokenRepository refreshTokenRepository,
            PasswordEncoder passwordEncoder,
            JwtTokenProvider jwtTokenProvider
    ) {
        this.chatUserRepository = chatUserRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenProvider = jwtTokenProvider;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        return register(request, UserRole.ROLE_USER);
    }

    @Transactional
    public AuthResponse registerAdmin(RegisterRequest request) {
        return register(request, UserRole.ROLE_ADMIN);
    }

    @Transactional
    public AuthResponse register(RegisterRequest request, UserRole role) {
        String username = normalize(request.username());
        String email = normalize(request.email());
        String password = request.password() == null ? "" : request.password().trim();

        if (username.isEmpty() || email.isEmpty() || password.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "회원가입 정보가 올바르지 않습니다.");
        }
        if (chatUserRepository.existsByUsername(username)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "이미 사용 중인 사용자명입니다.");
        }
        if (chatUserRepository.existsByEmail(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "이미 사용 중인 이메일입니다.");
        }

        ChatUser user = chatUserRepository.save(
                new ChatUser(username, email, passwordEncoder.encode(password), role)
        );
        return createAuthResponse(user);
    }

    public AuthResponse login(LoginRequest request) {
        ChatUser user = chatUserRepository.findByUsername(normalize(request.username()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인 정보가 올바르지 않습니다."));

        if (!user.isActive()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "비활성화된 사용자입니다.");
        }

        String password = request.password() == null ? "" : request.password();
        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인 정보가 올바르지 않습니다.");
        }

        return createAuthResponse(user);
    }

    @Transactional
    public AuthResponse refresh(RefreshTokenRequest request) {
        String refreshTokenValue = normalize(request.refreshToken());
        RefreshToken refreshToken = refreshTokenRepository.findByToken(refreshTokenValue)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "리프레시 토큰이 유효하지 않습니다."));

        if (!jwtTokenProvider.isValid(refreshTokenValue) || !"refresh".equals(jwtTokenProvider.getType(refreshTokenValue))) {
            refreshTokenRepository.delete(refreshToken);
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "리프레시 토큰이 만료되었습니다.");
        }

        ChatUser user = refreshToken.getUser();
        if (!user.isActive()) {
            refreshTokenRepository.delete(refreshToken);
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "비활성화된 사용자입니다.");
        }
        refreshTokenRepository.delete(refreshToken);
        return createAuthResponse(user);
    }

    @Transactional
    public void logout(LogoutRequest request, String username) {
        String refreshTokenValue = normalize(request.refreshToken());
        if (!refreshTokenValue.isEmpty()) {
            refreshTokenRepository.deleteByToken(refreshTokenValue);
        }
        refreshTokenRepository.deleteByUserUsername(username);
    }

    public AuthResponse.UserProfileResponse getCurrentUser(String username) {
        ChatUser user = chatUserRepository.findByUsername(username)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "사용자를 찾을 수 없습니다."));
        return toProfile(user);
    }

    public ChatUser getUser(String username) {
        return chatUserRepository.findByUsername(username)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "사용자를 찾을 수 없습니다."));
    }

    public List<UserSummaryResponse> getUsers() {
        return chatUserRepository.findAll().stream()
                .map(this::toSummary)
                .toList();
    }

    @Transactional
    public UserSummaryResponse updateUser(Long userId, UpdateUserRequest request, String adminUsername) {
        ChatUser user = chatUserRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "사용자를 찾을 수 없습니다."));

        if (request.role() != null && !request.role().isBlank()) {
            user.changeRole(parseRole(request.role()));
        }
        if (request.active() != null) {
            if (user.getUsername().equals(adminUsername) && !request.active()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "현재 관리자 계정은 비활성화할 수 없습니다.");
            }
            user.changeActive(request.active());
            if (!request.active()) {
                refreshTokenRepository.deleteByUserUsername(user.getUsername());
            }
        }

        return toSummary(user);
    }

    public boolean isAdmin(String username) {
        return getUser(username).getRole() == UserRole.ROLE_ADMIN;
    }

    public void requireAdmin(String username) {
        if (!isAdmin(username)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "관리자 권한이 필요합니다.");
        }
    }

    private AuthResponse createAuthResponse(ChatUser user) {
        refreshTokenRepository.deleteByExpiresAtBefore(java.time.Instant.now());
        String accessToken = jwtTokenProvider.createAccessToken(user);
        String refreshTokenValue = jwtTokenProvider.createRefreshToken(user);
        refreshTokenRepository.save(new RefreshToken(user, refreshTokenValue, jwtTokenProvider.getRefreshTokenExpiryInstant()));
        return new AuthResponse(
                accessToken,
                refreshTokenValue,
                "Bearer",
                jwtTokenProvider.getAccessExpirationSeconds(),
                jwtTokenProvider.getRefreshExpirationSeconds(),
                toProfile(user)
        );
    }

    private AuthResponse.UserProfileResponse toProfile(ChatUser user) {
        return new AuthResponse.UserProfileResponse(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getRole().name(),
                user.isActive(),
                user.getCreatedAt()
        );
    }

    private UserSummaryResponse toSummary(ChatUser user) {
        return new UserSummaryResponse(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getRole().name(),
                user.isActive(),
                user.getCreatedAt()
        );
    }

    private UserRole parseRole(String role) {
        try {
            return UserRole.valueOf(role.trim().toUpperCase());
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "지원하지 않는 사용자 권한입니다.");
        }
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim();
    }
}
