package org.jyhan.socketchat.chat.repository;

import java.util.List;
import java.util.Optional;
import org.jyhan.socketchat.chat.domain.RoomMember;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RoomMemberRepository extends JpaRepository<RoomMember, Long> {

    boolean existsByRoomIdAndUserUsername(String roomId, String username);

    Optional<RoomMember> findByRoomIdAndUserUsername(String roomId, String username);

    List<RoomMember> findByUserUsername(String username);

    List<RoomMember> findByRoomId(String roomId);

    void deleteByRoomId(String roomId);
}
