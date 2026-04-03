const { Client } = window.StompJs;

const connectForm = document.querySelector("#connect-form");
const messageForm = document.querySelector("#message-form");
const roomForm = document.querySelector("#room-form");
const senderInput = document.querySelector("#sender");
const roomIdInput = document.querySelector("#roomId");
const newRoomNameInput = document.querySelector("#new-room-name");
const messageInput = document.querySelector("#message");
const messageButton = messageForm.querySelector("button");
const messages = document.querySelector("#messages");
const roomList = document.querySelector("#room-list");
const refreshRoomsButton = document.querySelector("#refresh-rooms");
const statusElement = document.querySelector("#connection-status");
const topicElement = document.querySelector("#room-topic");
const activeRoomNameElement = document.querySelector("#active-room-name");

let stompClient = null;
let currentRoomId = "";
let currentSender = "";
let selectedRoomId = "";
let rooms = [];

function setConnected(connected) {
    statusElement.textContent = connected ? "연결됨" : "연결 대기";
    statusElement.classList.toggle("connected", connected);
    statusElement.classList.toggle("disconnected", !connected);
    messageInput.disabled = !connected;
    messageButton.disabled = !connected;
}

function escapeHtml(value) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

function appendMessage(message) {
    const item = document.createElement("li");
    item.className = "message-item";

    const bubble = document.createElement("article");
    bubble.className = "message-bubble";

    const meta = document.createElement("div");
    meta.className = "message-meta";

    const sender = document.createElement("strong");
    sender.textContent = message.sender || "system";

    const time = document.createElement("span");
    const sentAt = message.sentAt ? new Date(message.sentAt) : new Date();
    time.textContent = sentAt.toLocaleTimeString();

    const content = document.createElement("p");
    content.className = "message-content";
    content.textContent = message.content;

    meta.append(sender, time);
    bubble.append(meta, content);
    item.append(bubble);
    messages.append(item);
    messages.scrollTop = messages.scrollHeight;
}

function renderRooms() {
    roomList.innerHTML = "";

    rooms.forEach((room) => {
        const item = document.createElement("li");
        item.className = "room-list-item";

        const button = document.createElement("button");
        button.type = "button";
        button.className = `room-card${room.id === selectedRoomId ? " active" : ""}`;
        button.dataset.roomId = room.id;
        button.innerHTML = `
            <div class="room-card-title">
                <strong>${escapeHtml(room.name)}</strong>
                <span>${room.messageCount} msgs</span>
            </div>
            <div class="room-card-meta">${new Date(room.createdAt).toLocaleString()}</div>
        `;
        button.addEventListener("click", () => selectRoom(room.id));

        item.append(button);
        roomList.append(item);
    });
}

async function fetchRooms() {
    const response = await fetch("/api/chat/rooms");
    if (!response.ok) {
        throw new Error("채팅방 목록을 가져오지 못했습니다.");
    }
    rooms = await response.json();
    renderRooms();
}

async function fetchRoom(roomId) {
    const response = await fetch(`/api/chat/rooms/${encodeURIComponent(roomId)}`);
    if (!response.ok) {
        throw new Error("채팅방 정보를 가져오지 못했습니다.");
    }
    return response.json();
}

async function createRoom(name) {
    const response = await fetch("/api/chat/rooms", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ name })
    });
    if (!response.ok) {
        throw new Error("채팅방 생성에 실패했습니다.");
    }
    return response.json();
}

async function selectRoom(roomId) {
    selectedRoomId = roomId;
    roomIdInput.value = roomId;

    const room = rooms.find((candidate) => candidate.id === roomId);
    activeRoomNameElement.textContent = room ? room.name : "선택되지 않음";
    renderRooms();

    const detail = await fetchRoom(roomId);
    topicElement.textContent = `topic: ${detail.topicPath}`;
    messages.innerHTML = "";
    detail.history.forEach(appendMessage);
}

async function connect(roomId, sender) {
    const room = await fetchRoom(roomId);
    currentRoomId = roomId;
    currentSender = sender;

    if (stompClient?.active) {
        await stompClient.deactivate();
    }

    stompClient = new Client({
        webSocketFactory: () => new SockJS("/ws-chat"),
        reconnectDelay: 5000,
        onConnect: () => {
            setConnected(true);
            activeRoomNameElement.textContent = room.roomName;
            topicElement.textContent = `topic: ${room.topicPath}`;
            stompClient.subscribe(room.topicPath, (frame) => {
                appendMessage(JSON.parse(frame.body));
            });

            stompClient.publish({
                destination: room.publishPath,
                body: JSON.stringify({
                    roomId,
                    sender,
                    content: `${sender} 님이 입장했습니다.`,
                    type: "ENTER"
                })
            });
        },
        onStompError: (frame) => {
            console.error(frame.headers.message, frame.body);
            setConnected(false);
        },
        onWebSocketClose: () => {
            setConnected(false);
        }
    });

    stompClient.activate();
}

connectForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const roomId = roomIdInput.value.trim();
    const sender = senderInput.value.trim();

    if (!roomId || !sender) {
        return;
    }

    try {
        await connect(roomId, sender);
    } catch (error) {
        console.error(error);
        setConnected(false);
    }
});

roomForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = newRoomNameInput.value.trim();

    if (!name) {
        return;
    }

    try {
        const room = await createRoom(name);
        newRoomNameInput.value = "";
        await fetchRooms();
        await selectRoom(room.id);
    } catch (error) {
        console.error(error);
    }
});

refreshRoomsButton.addEventListener("click", async () => {
    try {
        await fetchRooms();
    } catch (error) {
        console.error(error);
    }
});

messageForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const content = messageInput.value.trim();

    if (!stompClient || !stompClient.active || !content) {
        return;
    }

    stompClient.publish({
        destination: `/app/chat/${currentRoomId}/send`,
        body: JSON.stringify({
            roomId: currentRoomId,
            sender: currentSender,
            content,
            type: "TALK"
        })
    });

    messageInput.value = "";
    messageInput.focus();
});

setConnected(false);
fetchRooms()
    .then(() => {
        const lobby = rooms.find((room) => room.name === "lobby");
        if (lobby) {
            return selectRoom(lobby.id);
        }
        if (rooms[0]) {
            return selectRoom(rooms[0].id);
        }
        return null;
    })
    .catch((error) => console.error(error));
