package org.jyhan.socketchat.chat.security;

import java.security.Principal;

public record StompPrincipal(String value) implements Principal {

    @Override
    public String getName() {
        return value;
    }
}
