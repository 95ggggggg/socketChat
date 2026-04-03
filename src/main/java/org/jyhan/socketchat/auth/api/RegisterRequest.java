package org.jyhan.socketchat.auth.api;

public record RegisterRequest(String username, String email, String password) {
}
