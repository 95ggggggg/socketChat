package org.jyhan.socketchat.chat.repository;

import java.util.Optional;
import org.jyhan.socketchat.chat.domain.RoomReadState;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RoomReadStateRepository extends JpaRepository<RoomReadState, Long> {

    Optional<RoomReadState> findByRoomIdAndUserUsername(String roomId, String username);

    void deleteByRoomId(String roomId);
}
