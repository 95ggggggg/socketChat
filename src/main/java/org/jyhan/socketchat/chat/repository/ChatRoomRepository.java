package org.jyhan.socketchat.chat.repository;

import java.util.Optional;
import org.jyhan.socketchat.chat.domain.ChatRoom;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChatRoomRepository extends JpaRepository<ChatRoom, String> {

    Optional<ChatRoom> findByName(String name);
}
