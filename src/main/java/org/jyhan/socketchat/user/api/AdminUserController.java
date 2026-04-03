package org.jyhan.socketchat.user.api;

import java.security.Principal;
import java.util.List;
import org.jyhan.socketchat.auth.service.AuthService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/users")
public class AdminUserController {

    private final AuthService authService;

    public AdminUserController(AuthService authService) {
        this.authService = authService;
    }

    @GetMapping
    public List<UserSummaryResponse> getUsers(Principal principal) {
        authService.requireAdmin(principal.getName());
        return authService.getUsers();
    }

    @PatchMapping("/{userId}")
    public UserSummaryResponse updateUser(
            @PathVariable Long userId,
            @RequestBody UpdateUserRequest request,
            Principal principal
    ) {
        authService.requireAdmin(principal.getName());
        return authService.updateUser(userId, request, principal.getName());
    }
}
