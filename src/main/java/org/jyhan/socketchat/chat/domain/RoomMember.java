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
public class RoomMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "room_id")
    private ChatRoom room;

    @ManyToOne(optional = false)
    @JoinColumn(name = "user_id")
    private ChatUser user;

    @Column(nullable = false)
    private Instant joinedAt;

    protected RoomMember() {
    }

    public RoomMember(ChatRoom room, ChatUser user) {
        this.room = room;
        this.user = user;
    }

    @PrePersist
    void prePersist() {
        if (joinedAt == null) {
            joinedAt = Instant.now();
        }
    }

    public ChatRoom getRoom() {
        return room;
    }

    public ChatUser getUser() {
        return user;
    }

    public Instant getJoinedAt() {
        return joinedAt;
    }
}
