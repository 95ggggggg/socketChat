package org.jyhan.socketchat.chat.api;

import java.util.List;

public record AdminRoomDetailResponse(
        ChatRoomSummary room,
        List<RoomMemberResponse> members
) {
}
