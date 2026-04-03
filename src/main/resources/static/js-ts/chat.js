"use strict";
const { Client } = StompJs;
const connectForm = document.querySelector("#connect-form");
const messageForm = document.querySelector("#message-form");
const roomForm = document.querySelector("#room-form");
const registerForm = document.querySelector("#register-form");
const loginForm = document.querySelector("#login-form");
const adminRoomForm = document.querySelector("#admin-room-form");
const adminUserForm = document.querySelector("#admin-user-form");
const senderInput = document.querySelector("#sender");
const roomIdInput = document.querySelector("#roomId");
const newRoomNameInput = document.querySelector("#new-room-name");
const newRoomAccessInput = document.querySelector("#new-room-access");
const registerUsernameInput = document.querySelector("#register-username");
const registerEmailInput = document.querySelector("#register-email");
const registerPasswordInput = document.querySelector("#register-password");
const loginUsernameInput = document.querySelector("#login-username");
const loginPasswordInput = document.querySelector("#login-password");
const adminRoomNameInput = document.querySelector("#admin-room-name");
const adminRoomAccessInput = document.querySelector("#admin-room-access");
const adminUserSelect = document.querySelector("#admin-user-select");
const adminUserRole = document.querySelector("#admin-user-role");
const adminUserActive = document.querySelector("#admin-user-active");
const messageInput = document.querySelector("#message");
const messageButton = messageForm.querySelector("button");
const messages = document.querySelector("#messages");
const roomList = document.querySelector("#room-list");
const refreshRoomsButton = document.querySelector("#refresh-rooms");
const refreshUsersButton = document.querySelector("#refresh-users");
const statusElement = document.querySelector("#connection-status");
const authStatusElement = document.querySelector("#auth-status");
const topicElement = document.querySelector("#room-topic");
const activeRoomNameElement = document.querySelector("#active-room-name");
const roomUnreadStatusElement = document.querySelector("#room-unread-status");
const currentUserLabel = document.querySelector("#current-user-label");
const logoutButton = document.querySelector("#logout-button");
const joinRoomButton = document.querySelector("#join-room-button");
const adminRoomPanel = document.querySelector("#admin-room-panel");
const adminUserPanel = document.querySelector("#admin-user-panel");
const adminRoomStatus = document.querySelector("#admin-room-status");
const adminRoomMembers = document.querySelector("#admin-room-members");
const adminUserList = document.querySelector("#admin-user-list");
const deleteRoomButton = document.querySelector("#delete-room-button");
let stompClient = null;
let currentRoomId = "";
let selectedRoomId = "";
let rooms = [];
let users = [];
let authState = null;
let refreshInFlight = null;
let readMarkTimer = null;
function getAccessToken() {
    return localStorage.getItem("socketchat.accessToken");
}
function getRefreshToken() {
    return localStorage.getItem("socketchat.refreshToken");
}
function saveTokens(auth) {
    localStorage.setItem("socketchat.accessToken", auth.accessToken);
    localStorage.setItem("socketchat.refreshToken", auth.refreshToken);
}
function clearTokens() {
    localStorage.removeItem("socketchat.accessToken");
    localStorage.removeItem("socketchat.refreshToken");
}
function isAdmin() {
    return authState?.user.role === "ROLE_ADMIN";
}
function setConnected(connected) {
    statusElement.textContent = connected ? "연결됨" : "연결 대기";
    statusElement.classList.toggle("connected", connected);
    statusElement.classList.toggle("disconnected", !connected);
    messageInput.disabled = !connected;
    messageButton.disabled = !connected;
}
function setAuthenticated(authenticated) {
    authStatusElement.textContent = authenticated ? "로그인됨" : "로그아웃";
    authStatusElement.classList.toggle("connected", authenticated);
    authStatusElement.classList.toggle("disconnected", !authenticated);
    roomForm.querySelectorAll("input, select, button").forEach((element) => {
        element.disabled = !authenticated;
    });
    refreshRoomsButton.disabled = !authenticated;
    refreshUsersButton.disabled = !authenticated || !isAdmin();
    joinRoomButton.disabled = !authenticated || !selectedRoomId;
    connectForm.querySelectorAll("button").forEach((element) => {
        element.disabled = !authenticated;
    });
    senderInput.value = authenticated && authState ? authState.user.username : "";
    currentUserLabel.textContent = authenticated && authState
        ? `현재 사용자: ${authState.user.username} (${authState.user.role}, ${authState.user.active ? "활성" : "비활성"})`
        : "현재 사용자: 없음";
    adminRoomPanel.classList.toggle("hidden", !authenticated || !isAdmin());
    adminUserPanel.classList.toggle("hidden", !authenticated || !isAdmin());
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
async function refreshAccessToken() {
    if (refreshInFlight) {
        return refreshInFlight;
    }
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
        logout(false);
        throw new Error("리프레시 토큰이 없습니다.");
    }
    refreshInFlight = (async () => {
        const response = await fetch("/api/auth/refresh", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken })
        });
        if (!response.ok) {
            logout(false);
            throw new Error("토큰 재발급에 실패했습니다.");
        }
        const auth = await response.json();
        authState = auth;
        saveTokens(auth);
    })();
    try {
        await refreshInFlight;
    }
    finally {
        refreshInFlight = null;
    }
}
async function apiFetch(url, init = {}, allowRetry = true) {
    const token = getAccessToken();
    const headers = new Headers(init.headers ?? {});
    if (token) {
        headers.set("Authorization", `Bearer ${token}`);
    }
    if (!headers.has("Content-Type") && init.body) {
        headers.set("Content-Type", "application/json");
    }
    const response = await fetch(url, { ...init, headers });
    if (response.status === 401 && allowRetry && getRefreshToken()) {
        await refreshAccessToken();
        return apiFetch(url, init, false);
    }
    if (response.status === 401) {
        logout(false);
    }
    return response;
}
async function parseError(response, fallback) {
    const text = await response.text();
    throw new Error(text || fallback);
}
async function handleAuthResponse(response) {
    if (!response.ok) {
        await parseError(response, "인증 요청에 실패했습니다.");
    }
    const auth = await response.json();
    authState = auth;
    saveTokens(auth);
    await refreshSession();
}
async function register(username, email, password) {
    const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password })
    });
    await handleAuthResponse(response);
}
async function login(username, password) {
    const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    });
    await handleAuthResponse(response);
}
async function refreshSession() {
    const token = getAccessToken();
    if (!token) {
        authState = null;
        rooms = [];
        users = [];
        roomList.innerHTML = "";
        adminUserList.innerHTML = "";
        adminUserSelect.innerHTML = "";
        selectedRoomId = "";
        roomIdInput.value = "";
        activeRoomNameElement.textContent = "선택되지 않음";
        roomUnreadStatusElement.textContent = "읽지 않은 메시지: 0";
        topicElement.textContent = "topic: -";
        messages.innerHTML = "";
        adminRoomStatus.textContent = "선택된 방 없음";
        adminRoomMembers.innerHTML = "";
        setAuthenticated(false);
        setConnected(false);
        return;
    }
    const response = await apiFetch("/api/auth/me");
    if (!response.ok) {
        await parseError(response, "세션 정보를 불러오지 못했습니다.");
    }
    const user = await response.json();
    authState = {
        accessToken: getAccessToken() ?? "",
        refreshToken: getRefreshToken() ?? "",
        tokenType: "Bearer",
        accessTokenExpiresInSeconds: 0,
        refreshTokenExpiresInSeconds: 0,
        user
    };
    setAuthenticated(true);
    await fetchRooms();
    if (isAdmin()) {
        await fetchUsers();
    }
    const preferredRoom = rooms.find((room) => room.id === selectedRoomId)
        ?? rooms.find((room) => room.name === "lobby")
        ?? rooms[0];
    if (preferredRoom) {
        await selectRoom(preferredRoom.id);
    }
}
function logout(callApi = true) {
    const refreshToken = getRefreshToken();
    if (callApi && refreshToken && getAccessToken()) {
        void fetch("/api/auth/logout", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${getAccessToken() ?? ""}`
            },
            body: JSON.stringify({ refreshToken })
        }).catch(() => undefined);
    }
    clearTokens();
    authState = null;
    if (stompClient?.active) {
        void stompClient.deactivate();
    }
    void refreshSession();
}
function updateRoomUnread(roomId, unreadCount) {
    rooms = rooms.map((room) => room.id === roomId ? { ...room, unreadCount } : room);
    renderRooms();
    const current = rooms.find((room) => room.id === roomId);
    if (current && roomId === selectedRoomId) {
        roomUnreadStatusElement.textContent = `읽지 않은 메시지: ${current.unreadCount}`;
    }
}
function renderRooms() {
    roomList.innerHTML = "";
    rooms.forEach((room) => {
        const item = document.createElement("li");
        item.className = "room-list-item";
        const button = document.createElement("button");
        button.type = "button";
        button.className = `room-card${room.id === selectedRoomId ? " active" : ""}`;
        button.innerHTML = `
            <div class="room-card-title">
                <strong>${escapeHtml(room.name)}</strong>
                <span>${room.messageCount} msgs</span>
            </div>
            <div class="room-card-badges">
                <span>${room.accessType === "PUBLIC" ? "공개" : "멤버 전용"}</span>
                <span>${room.joined ? "가입됨" : "미가입"}</span>
                <span><strong>unread ${room.unreadCount}</strong></span>
            </div>
            <div class="room-card-meta">${new Date(room.createdAt).toLocaleString()}</div>
        `;
        button.addEventListener("click", () => {
            void selectRoom(room.id);
        });
        item.append(button);
        roomList.append(item);
    });
}
function renderUsers() {
    adminUserList.innerHTML = "";
    adminUserSelect.innerHTML = "";
    users.forEach((user) => {
        const option = document.createElement("option");
        option.value = String(user.id);
        option.textContent = `${user.username} (${user.role})`;
        adminUserSelect.append(option);
        const item = document.createElement("li");
        item.textContent = `${user.username} / ${user.email} / ${user.role} / ${user.active ? "활성" : "비활성"} / ${new Date(user.createdAt).toLocaleString()}`;
        adminUserList.append(item);
    });
    syncSelectedUserForm();
}
function syncSelectedUserForm() {
    const selectedUser = users.find((user) => String(user.id) === adminUserSelect.value) ?? users[0];
    if (!selectedUser) {
        adminUserRole.value = "ROLE_USER";
        adminUserActive.value = "true";
        return;
    }
    adminUserSelect.value = String(selectedUser.id);
    adminUserRole.value = selectedUser.role;
    adminUserActive.value = String(selectedUser.active);
}
async function fetchRooms() {
    const response = await apiFetch("/api/chat/rooms");
    if (!response.ok) {
        await parseError(response, "채팅방 목록을 가져오지 못했습니다.");
    }
    rooms = await response.json();
    renderRooms();
}
async function fetchUsers() {
    const response = await apiFetch("/api/admin/users");
    if (!response.ok) {
        await parseError(response, "사용자 목록을 가져오지 못했습니다.");
    }
    users = await response.json();
    renderUsers();
}
async function fetchRoom(roomId) {
    const response = await apiFetch(`/api/chat/rooms/${encodeURIComponent(roomId)}`);
    if (!response.ok) {
        await parseError(response, "채팅방 정보를 가져오지 못했습니다.");
    }
    return response.json();
}
async function createRoom(name, accessType) {
    const response = await apiFetch("/api/chat/rooms", {
        method: "POST",
        body: JSON.stringify({ name, accessType })
    });
    if (!response.ok) {
        await parseError(response, "채팅방 생성에 실패했습니다.");
    }
    return response.json();
}
async function joinRoom(roomId) {
    const response = await apiFetch(`/api/chat/rooms/${encodeURIComponent(roomId)}/join`, {
        method: "POST"
    });
    if (!response.ok) {
        await parseError(response, "채팅방 가입에 실패했습니다.");
    }
}
async function markRoomRead(roomId) {
    const response = await apiFetch(`/api/chat/rooms/${encodeURIComponent(roomId)}/read`, {
        method: "POST"
    });
    if (!response.ok) {
        await parseError(response, "읽음 처리에 실패했습니다.");
    }
    const result = await response.json();
    updateRoomUnread(result.roomId, result.unreadCount);
}
function scheduleReadMark(roomId) {
    if (readMarkTimer !== null) {
        window.clearTimeout(readMarkTimer);
    }
    readMarkTimer = window.setTimeout(() => {
        void markRoomRead(roomId).catch((error) => console.error(error));
    }, 200);
}
async function fetchAdminRoom(roomId) {
    const response = await apiFetch(`/api/admin/rooms/${encodeURIComponent(roomId)}`);
    if (!response.ok) {
        await parseError(response, "관리자 방 정보를 가져오지 못했습니다.");
    }
    return response.json();
}
async function updateAdminRoom(roomId, name, accessType) {
    const response = await apiFetch(`/api/admin/rooms/${encodeURIComponent(roomId)}`, {
        method: "PATCH",
        body: JSON.stringify({ name, accessType })
    });
    if (!response.ok) {
        await parseError(response, "방 수정에 실패했습니다.");
    }
}
async function deleteAdminRoom(roomId) {
    const response = await apiFetch(`/api/admin/rooms/${encodeURIComponent(roomId)}`, {
        method: "DELETE"
    });
    if (!response.ok) {
        await parseError(response, "방 삭제에 실패했습니다.");
    }
}
async function updateAdminUser(userId, role, active) {
    const response = await apiFetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ role, active })
    });
    if (!response.ok) {
        await parseError(response, "사용자 수정에 실패했습니다.");
    }
}
function renderAdminMembers(members) {
    adminRoomMembers.innerHTML = "";
    if (members.length === 0) {
        const empty = document.createElement("li");
        empty.textContent = "가입한 사용자가 없습니다.";
        adminRoomMembers.append(empty);
        return;
    }
    members.forEach((member) => {
        const item = document.createElement("li");
        item.textContent = `${member.username} (${member.email}) - ${new Date(member.joinedAt).toLocaleString()}`;
        adminRoomMembers.append(item);
    });
}
async function loadAdminPanel(roomId) {
    if (!isAdmin()) {
        return;
    }
    try {
        const adminDetail = await fetchAdminRoom(roomId);
        adminRoomStatus.textContent = `${adminDetail.room.name} 관리 중`;
        adminRoomNameInput.value = adminDetail.room.name;
        adminRoomAccessInput.value = adminDetail.room.accessType;
        renderAdminMembers(adminDetail.members);
    }
    catch (error) {
        adminRoomStatus.textContent = "관리자 정보 조회 실패";
        adminRoomMembers.innerHTML = "";
        console.error(error);
    }
}
async function selectRoom(roomId) {
    selectedRoomId = roomId;
    roomIdInput.value = roomId;
    const room = rooms.find((candidate) => candidate.id === roomId);
    activeRoomNameElement.textContent = room ? room.name : "선택되지 않음";
    renderRooms();
    try {
        const detail = await fetchRoom(roomId);
        topicElement.textContent = `topic: ${detail.topicPath}`;
        roomUnreadStatusElement.textContent = `읽지 않은 메시지: ${detail.unreadCount}`;
        messages.innerHTML = "";
        detail.history.forEach(appendMessage);
        joinRoomButton.textContent = detail.joined ? "이미 가입됨" : "채팅방 가입";
        joinRoomButton.disabled = !authState || detail.joined;
        await markRoomRead(roomId);
    }
    catch (error) {
        messages.innerHTML = "";
        topicElement.textContent = "topic: 접근 권한 없음";
        roomUnreadStatusElement.textContent = "읽지 않은 메시지: -";
        joinRoomButton.textContent = "채팅방 가입";
        joinRoomButton.disabled = !authState;
        console.error(error);
    }
    await loadAdminPanel(roomId);
}
async function connect(roomId) {
    const token = getAccessToken();
    if (!token || !authState) {
        throw new Error("로그인이 필요합니다.");
    }
    const room = await fetchRoom(roomId);
    currentRoomId = roomId;
    if (stompClient?.active) {
        await stompClient.deactivate();
    }
    stompClient = new Client({
        webSocketFactory: () => new SockJS("/ws-chat"),
        connectHeaders: {
            Authorization: `Bearer ${token}`
        },
        reconnectDelay: 5000,
        onConnect: () => {
            setConnected(true);
            activeRoomNameElement.textContent = room.roomName;
            topicElement.textContent = `topic: ${room.topicPath}`;
            stompClient?.subscribe(room.topicPath, (frame) => {
                const message = JSON.parse(frame.body);
                appendMessage(message);
                if (message.roomId === selectedRoomId) {
                    scheduleReadMark(message.roomId);
                }
                else {
                    const target = rooms.find((candidate) => candidate.id === message.roomId);
                    updateRoomUnread(message.roomId, (target?.unreadCount ?? 0) + 1);
                }
            });
            stompClient?.publish({
                destination: room.publishPath,
                body: JSON.stringify({
                    roomId,
                    sender: authState?.user.username ?? "",
                    content: `${authState?.user.username ?? "user"} 님이 입장했습니다.`,
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
registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
        await register(registerUsernameInput.value.trim(), registerEmailInput.value.trim(), registerPasswordInput.value);
        registerForm.reset();
    }
    catch (error) {
        console.error(error);
    }
});
loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
        await login(loginUsernameInput.value.trim(), loginPasswordInput.value);
        loginForm.reset();
    }
    catch (error) {
        console.error(error);
    }
});
logoutButton.addEventListener("click", () => {
    logout();
});
connectForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!roomIdInput.value.trim()) {
        return;
    }
    try {
        await connect(roomIdInput.value.trim());
    }
    catch (error) {
        console.error(error);
        setConnected(false);
    }
});
roomForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = newRoomNameInput.value.trim();
    const accessType = newRoomAccessInput.value;
    if (!name) {
        return;
    }
    try {
        const room = await createRoom(name, accessType);
        roomForm.reset();
        newRoomAccessInput.value = "MEMBERS_ONLY";
        await fetchRooms();
        await selectRoom(room.id);
    }
    catch (error) {
        console.error(error);
    }
});
refreshRoomsButton.addEventListener("click", async () => {
    try {
        await fetchRooms();
    }
    catch (error) {
        console.error(error);
    }
});
refreshUsersButton.addEventListener("click", async () => {
    try {
        await fetchUsers();
    }
    catch (error) {
        console.error(error);
    }
});
joinRoomButton.addEventListener("click", async () => {
    if (!selectedRoomId) {
        return;
    }
    try {
        await joinRoom(selectedRoomId);
        await fetchRooms();
        await selectRoom(selectedRoomId);
    }
    catch (error) {
        console.error(error);
    }
});
adminRoomForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!selectedRoomId || !isAdmin()) {
        return;
    }
    try {
        await updateAdminRoom(selectedRoomId, adminRoomNameInput.value.trim(), adminRoomAccessInput.value);
        await fetchRooms();
        await selectRoom(selectedRoomId);
    }
    catch (error) {
        console.error(error);
    }
});
adminUserSelect.addEventListener("change", () => {
    syncSelectedUserForm();
});
adminUserForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const userId = Number(adminUserSelect.value);
    if (!userId || !isAdmin()) {
        return;
    }
    try {
        await updateAdminUser(userId, adminUserRole.value, adminUserActive.value === "true");
        await fetchUsers();
        await refreshSession();
    }
    catch (error) {
        console.error(error);
    }
});
deleteRoomButton.addEventListener("click", async () => {
    if (!selectedRoomId || !isAdmin()) {
        return;
    }
    try {
        await deleteAdminRoom(selectedRoomId);
        selectedRoomId = "";
        currentRoomId = "";
        await fetchRooms();
        const fallback = rooms.find((room) => room.name === "lobby") ?? rooms[0];
        if (fallback) {
            await selectRoom(fallback.id);
        }
        else {
            await refreshSession();
        }
    }
    catch (error) {
        console.error(error);
    }
});
messageForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const content = messageInput.value.trim();
    if (!stompClient?.active || !content || !authState) {
        return;
    }
    stompClient.publish({
        destination: `/app/chat/${currentRoomId}/send`,
        body: JSON.stringify({
            roomId: currentRoomId,
            sender: authState.user.username,
            content,
            type: "TALK"
        })
    });
    messageInput.value = "";
    messageInput.focus();
});
setConnected(false);
setAuthenticated(false);
void refreshSession().catch((error) => console.error(error));
