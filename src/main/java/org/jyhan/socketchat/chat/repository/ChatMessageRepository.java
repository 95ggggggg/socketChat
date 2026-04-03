package org.jyhan.socketchat.chat.repository;

import java.util.List;
import org.jyhan.socketchat.chat.domain.ChatMessageEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChatMessageRepository extends JpaRepository<ChatMessageEntity, Long> {

    List<ChatMessageEntity> findTop50ByRoomIdOrderBySentAtDesc(String roomId);

    long countByRoomId(String roomId);

    long countByRoomIdAndIdGreaterThan(String roomId, Long id);

    ChatMessageEntity findTopByRoomIdOrderByIdDesc(String roomId);

    void deleteByRoomId(String roomId);
}
