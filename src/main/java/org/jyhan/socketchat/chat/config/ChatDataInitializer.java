package org.jyhan.socketchat.chat.config;

import org.jyhan.socketchat.auth.api.RegisterRequest;
import org.jyhan.socketchat.auth.service.AuthService;
import org.jyhan.socketchat.chat.service.ChatService;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ChatDataInitializer {

    @Bean
    ApplicationRunner initializeChatData(ChatService chatService, AuthService authService) {
        return args -> {
            chatService.ensureLobbyRoom();
            try {
                authService.registerAdmin(new RegisterRequest("admin", "admin@socketchat.local", "admin1234"));
            } catch (RuntimeException ignored) {
            }
        };
    }
}
