package org.jyhan.socketchat.chat.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import java.time.Instant;
import org.jyhan.socketchat.user.domain.ChatUser;

@Entity
public class RoomReadState {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "room_id")
    private ChatRoom room;

    @ManyToOne(optional = false)
    @JoinColumn(name = "user_id")
    private ChatUser user;

    @Column
    private Long lastReadMessageId;

    @Column(nullable = false)
    private Instant lastReadAt;

    protected RoomReadState() {
    }

    public RoomReadState(ChatRoom room, ChatUser user, Long lastReadMessageId) {
        this.room = room;
        this.user = user;
        this.lastReadMessageId = lastReadMessageId;
        this.lastReadAt = Instant.now();
    }

    @PrePersist
    void prePersist() {
        if (lastReadAt == null) {
            lastReadAt = Instant.now();
        }
    }

    public ChatRoom getRoom() {
        return room;
    }

    public ChatUser getUser() {
        return user;
    }

    public Long getLastReadMessageId() {
        return lastReadMessageId;
    }

    public Instant getLastReadAt() {
        return lastReadAt;
    }

    public void update(Long lastReadMessageId) {
        this.lastReadMessageId = lastReadMessageId;
        this.lastReadAt = Instant.now();
    }
}
