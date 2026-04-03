package org.jyhan.socketchat.chat.api;

public record JoinRoomResponse(String roomId, String username, boolean joined) {
}
