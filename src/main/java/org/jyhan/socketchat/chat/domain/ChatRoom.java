package org.jyhan.socketchat.chat.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.PrePersist;
import java.time.Instant;
import java.util.UUID;

@Entity
public class ChatRoom {

    @Id
    private String id;

    @Column(nullable = false, unique = true, length = 100)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private RoomAccessType accessType;

    @Column(nullable = false)
    private Instant createdAt;

    protected ChatRoom() {
    }

    public ChatRoom(String name, RoomAccessType accessType) {
        this.name = name;
        this.accessType = accessType;
    }

    @PrePersist
    void prePersist() {
        if (id == null) {
            id = UUID.randomUUID().toString();
        }
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public String getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public void changeName(String name) {
        this.name = name;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public RoomAccessType getAccessType() {
        return accessType;
    }

    public void changeAccessType(RoomAccessType accessType) {
        this.accessType = accessType;
    }
}
