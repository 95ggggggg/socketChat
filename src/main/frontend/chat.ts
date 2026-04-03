declare const SockJS: new (url: string) => WebSocket;
declare const StompJs: {
    Client: new (config: {
        webSocketFactory: () => WebSocket;
        connectHeaders?: Record<string, string>;
        reconnectDelay: number;
        onConnect: () => void;
        onStompError: (frame: { headers: Record<string, string>; body: string }) => void;
        onWebSocketClose: () => void;
    }) => {
        active: boolean;
        activate: () => void;
        deactivate: () => Promise<void>;
        publish: (options: { destination: string; body: string }) => void;
        subscribe: (destination: string, callback: (frame: { body: string }) => void) => void;
    };
};

type MessageType = "ENTER" | "TALK" | "LEAVE";
type AccessType = "PUBLIC" | "MEMBERS_ONLY";
type UserRole = "ROLE_USER" | "ROLE_ADMIN";

interface ChatMessage {
    roomId: string;
    sender: string;
    content: string;
    type: MessageType;
    sentAt?: string;
}

interface UserProfile {
    id: number;
    username: string;
    email: string;
    role: UserRole;
    active: boolean;
    createdAt: string;
}

interface AuthResponse {
    accessToken: string;
    refreshToken: string;
    tokenType: string;
    accessTokenExpiresInSeconds: number;
    refreshTokenExpiresInSeconds: number;
    user: UserProfile;
}

interface RoomSummary {
    id: string;
    name: string;
    createdAt: string;
    messageCount: number;
    unreadCount: number;
    accessType: AccessType;
    joined: boolean;
}

interface RoomResponse {
    roomId: string;
    roomName: string;
    topicPath: string;
    publishPath: string;
    accessType: AccessType;
    joined: boolean;
    unreadCount: number;
    history: ChatMessage[];
}

interface MarkReadResponse {
    roomId: string;
    unreadCount: number;
    lastReadAt: string;
}

interface RoomMemberResponse {
    userId: number;
    username: string;
    email: string;
    joinedAt: string;
}

interface AdminRoomDetailResponse {
    room: RoomSummary;
    members: RoomMemberResponse[];
}

interface UserSummaryResponse {
    id: number;
    username: string;
    email: string;
    role: UserRole;
    active: boolean;
    createdAt: string;
}

const { Client } = StompJs;

const connectForm = document.querySelector<HTMLFormElement>("#connect-form")!;
const messageForm = document.querySelector<HTMLFormElement>("#message-form")!;
const roomForm = document.querySelector<HTMLFormElement>("#room-form")!;
const registerForm = document.querySelector<HTMLFormElement>("#register-form")!;
const loginForm = document.querySelector<HTMLFormElement>("#login-form")!;
const adminRoomForm = document.querySelector<HTMLFormElement>("#admin-room-form")!;
const adminUserForm = document.querySelector<HTMLFormElement>("#admin-user-form")!;
const senderInput = document.querySelector<HTMLInputElement>("#sender")!;
const roomIdInput = document.querySelector<HTMLInputElement>("#roomId")!;
const newRoomNameInput = document.querySelector<HTMLInputElement>("#new-room-name")!;
const newRoomAccessInput = document.querySelector<HTMLSelectElement>("#new-room-access")!;
const registerUsernameInput = document.querySelector<HTMLInputElement>("#register-username")!;
const registerEmailInput = document.querySelector<HTMLInputElement>("#register-email")!;
const registerPasswordInput = document.querySelector<HTMLInputElement>("#register-password")!;
const loginUsernameInput = document.querySelector<HTMLInputElement>("#login-username")!;
const loginPasswordInput = document.querySelector<HTMLInputElement>("#login-password")!;
const adminRoomNameInput = document.querySelector<HTMLInputElement>("#admin-room-name")!;
const adminRoomAccessInput = document.querySelector<HTMLSelectElement>("#admin-room-access")!;
const adminUserSelect = document.querySelector<HTMLSelectElement>("#admin-user-select")!;
const adminUserRole = document.querySelector<HTMLSelectElement>("#admin-user-role")!;
const adminUserActive = document.querySelector<HTMLSelectElement>("#admin-user-active")!;
const messageInput = document.querySelector<HTMLInputElement>("#message")!;
const messageButton = messageForm.querySelector<HTMLButtonElement>("button")!;
const messages = document.querySelector<HTMLUListElement>("#messages")!;
const roomList = document.querySelector<HTMLUListElement>("#room-list")!;
const refreshRoomsButton = document.querySelector<HTMLButtonElement>("#refresh-rooms")!;
const refreshUsersButton = document.querySelector<HTMLButtonElement>("#refresh-users")!;
const statusElement = document.querySelector<HTMLSpanElement>("#connection-status")!;
const authStatusElement = document.querySelector<HTMLSpanElement>("#auth-status")!;
const topicElement = document.querySelector<HTMLSpanElement>("#room-topic")!;
const activeRoomNameElement = document.querySelector<HTMLHeadingElement>("#active-room-name")!;
const roomUnreadStatusElement = document.querySelector<HTMLParagraphElement>("#room-unread-status")!;
const currentUserLabel = document.querySelector<HTMLParagraphElement>("#current-user-label")!;
const logoutButton = document.querySelector<HTMLButtonElement>("#logout-button")!;
const joinRoomButton = document.querySelector<HTMLButtonElement>("#join-room-button")!;
const adminRoomPanel = document.querySelector<HTMLElement>("#admin-room-panel")!;
const adminUserPanel = document.querySelector<HTMLElement>("#admin-user-panel")!;
const adminRoomStatus = document.querySelector<HTMLSpanElement>("#admin-room-status")!;
const adminRoomMembers = document.querySelector<HTMLUListElement>("#admin-room-members")!;
const adminUserList = document.querySelector<HTMLUListElement>("#admin-user-list")!;
const deleteRoomButton = document.querySelector<HTMLButtonElement>("#delete-room-button")!;

let stompClient: InstanceType<typeof Client> | null = null;
let currentRoomId = "";
let selectedRoomId = "";
let rooms: RoomSummary[] = [];
let users: UserSummaryResponse[] = [];
let authState: AuthResponse | null = null;
let refreshInFlight: Promise<void> | null = null;
let readMarkTimer: number | null = null;

function getAccessToken(): string | null {
    return localStorage.getItem("socketchat.accessToken");
}

function getRefreshToken(): string | null {
    return localStorage.getItem("socketchat.refreshToken");
}

function saveTokens(auth: AuthResponse): void {
    localStorage.setItem("socketchat.accessToken", auth.accessToken);
    localStorage.setItem("socketchat.refreshToken", auth.refreshToken);
}

function clearTokens(): void {
    localStorage.removeItem("socketchat.accessToken");
    localStorage.removeItem("socketchat.refreshToken");
}

function isAdmin(): boolean {
    return authState?.user.role === "ROLE_ADMIN";
}

function setConnected(connected: boolean): void {
    statusElement.textContent = connected ? "연결됨" : "연결 대기";
    statusElement.classList.toggle("connected", connected);
    statusElement.classList.toggle("disconnected", !connected);
    messageInput.disabled = !connected;
    messageButton.disabled = !connected;
}

function setAuthenticated(authenticated: boolean): void {
    authStatusElement.textContent = authenticated ? "로그인됨" : "로그아웃";
    authStatusElement.classList.toggle("connected", authenticated);
    authStatusElement.classList.toggle("disconnected", !authenticated);

    roomForm.querySelectorAll("input, select, button").forEach((element) => {
        (element as HTMLInputElement | HTMLSelectElement | HTMLButtonElement).disabled = !authenticated;
    });
    refreshRoomsButton.disabled = !authenticated;
    refreshUsersButton.disabled = !authenticated || !isAdmin();
    joinRoomButton.disabled = !authenticated || !selectedRoomId;
    connectForm.querySelectorAll("button").forEach((element) => {
        (element as HTMLButtonElement).disabled = !authenticated;
    });

    senderInput.value = authenticated && authState ? authState.user.username : "";
    currentUserLabel.textContent = authenticated && authState
        ? `현재 사용자: ${authState.user.username} (${authState.user.role}, ${authState.user.active ? "활성" : "비활성"})`
        : "현재 사용자: 없음";

    adminRoomPanel.classList.toggle("hidden", !authenticated || !isAdmin());
    adminUserPanel.classList.toggle("hidden", !authenticated || !isAdmin());
}

function escapeHtml(value: string): string {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

function appendMessage(message: ChatMessage): void {
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

async function refreshAccessToken(): Promise<void> {
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
        const auth = await response.json() as AuthResponse;
        authState = auth;
        saveTokens(auth);
    })();

    try {
        await refreshInFlight;
    } finally {
        refreshInFlight = null;
    }
}

async function apiFetch(url: string, init: RequestInit = {}, allowRetry = true): Promise<Response> {
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

async function parseError(response: Response, fallback: string): Promise<never> {
    const text = await response.text();
    throw new Error(text || fallback);
}

async function handleAuthResponse(response: Response): Promise<void> {
    if (!response.ok) {
        await parseError(response, "인증 요청에 실패했습니다.");
    }
    const auth = await response.json() as AuthResponse;
    authState = auth;
    saveTokens(auth);
    await refreshSession();
}

async function register(username: string, email: string, password: string): Promise<void> {
    const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password })
    });
    await handleAuthResponse(response);
}

async function login(username: string, password: string): Promise<void> {
    const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    });
    await handleAuthResponse(response);
}

async function refreshSession(): Promise<void> {
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

    const user = await response.json() as UserProfile;
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

function logout(callApi = true): void {
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

function updateRoomUnread(roomId: string, unreadCount: number): void {
    rooms = rooms.map((room) => room.id === roomId ? { ...room, unreadCount } : room);
    renderRooms();
    const current = rooms.find((room) => room.id === roomId);
    if (current && roomId === selectedRoomId) {
        roomUnreadStatusElement.textContent = `읽지 않은 메시지: ${current.unreadCount}`;
    }
}

function renderRooms(): void {
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

function renderUsers(): void {
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

function syncSelectedUserForm(): void {
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

async function fetchRooms(): Promise<void> {
    const response = await apiFetch("/api/chat/rooms");
    if (!response.ok) {
        await parseError(response, "채팅방 목록을 가져오지 못했습니다.");
    }
    rooms = await response.json() as RoomSummary[];
    renderRooms();
}

async function fetchUsers(): Promise<void> {
    const response = await apiFetch("/api/admin/users");
    if (!response.ok) {
        await parseError(response, "사용자 목록을 가져오지 못했습니다.");
    }
    users = await response.json() as UserSummaryResponse[];
    renderUsers();
}

async function fetchRoom(roomId: string): Promise<RoomResponse> {
    const response = await apiFetch(`/api/chat/rooms/${encodeURIComponent(roomId)}`);
    if (!response.ok) {
        await parseError(response, "채팅방 정보를 가져오지 못했습니다.");
    }
    return response.json() as Promise<RoomResponse>;
}

async function createRoom(name: string, accessType: AccessType): Promise<RoomSummary> {
    const response = await apiFetch("/api/chat/rooms", {
        method: "POST",
        body: JSON.stringify({ name, accessType })
    });
    if (!response.ok) {
        await parseError(response, "채팅방 생성에 실패했습니다.");
    }
    return response.json() as Promise<RoomSummary>;
}

async function joinRoom(roomId: string): Promise<void> {
    const response = await apiFetch(`/api/chat/rooms/${encodeURIComponent(roomId)}/join`, {
        method: "POST"
    });
    if (!response.ok) {
        await parseError(response, "채팅방 가입에 실패했습니다.");
    }
}

async function markRoomRead(roomId: string): Promise<void> {
    const response = await apiFetch(`/api/chat/rooms/${encodeURIComponent(roomId)}/read`, {
        method: "POST"
    });
    if (!response.ok) {
        await parseError(response, "읽음 처리에 실패했습니다.");
    }
    const result = await response.json() as MarkReadResponse;
    updateRoomUnread(result.roomId, result.unreadCount);
}

function scheduleReadMark(roomId: string): void {
    if (readMarkTimer !== null) {
        window.clearTimeout(readMarkTimer);
    }
    readMarkTimer = window.setTimeout(() => {
        void markRoomRead(roomId).catch((error) => console.error(error));
    }, 200);
}

async function fetchAdminRoom(roomId: string): Promise<AdminRoomDetailResponse> {
    const response = await apiFetch(`/api/admin/rooms/${encodeURIComponent(roomId)}`);
    if (!response.ok) {
        await parseError(response, "관리자 방 정보를 가져오지 못했습니다.");
    }
    return response.json() as Promise<AdminRoomDetailResponse>;
}

async function updateAdminRoom(roomId: string, name: string, accessType: AccessType): Promise<void> {
    const response = await apiFetch(`/api/admin/rooms/${encodeURIComponent(roomId)}`, {
        method: "PATCH",
        body: JSON.stringify({ name, accessType })
    });
    if (!response.ok) {
        await parseError(response, "방 수정에 실패했습니다.");
    }
}

async function deleteAdminRoom(roomId: string): Promise<void> {
    const response = await apiFetch(`/api/admin/rooms/${encodeURIComponent(roomId)}`, {
        method: "DELETE"
    });
    if (!response.ok) {
        await parseError(response, "방 삭제에 실패했습니다.");
    }
}

async function updateAdminUser(userId: number, role: UserRole, active: boolean): Promise<void> {
    const response = await apiFetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ role, active })
    });
    if (!response.ok) {
        await parseError(response, "사용자 수정에 실패했습니다.");
    }
}

function renderAdminMembers(members: RoomMemberResponse[]): void {
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

async function loadAdminPanel(roomId: string): Promise<void> {
    if (!isAdmin()) {
        return;
    }

    try {
        const adminDetail = await fetchAdminRoom(roomId);
        adminRoomStatus.textContent = `${adminDetail.room.name} 관리 중`;
        adminRoomNameInput.value = adminDetail.room.name;
        adminRoomAccessInput.value = adminDetail.room.accessType;
        renderAdminMembers(adminDetail.members);
    } catch (error) {
        adminRoomStatus.textContent = "관리자 정보 조회 실패";
        adminRoomMembers.innerHTML = "";
        console.error(error);
    }
}

async function selectRoom(roomId: string): Promise<void> {
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
    } catch (error) {
        messages.innerHTML = "";
        topicElement.textContent = "topic: 접근 권한 없음";
        roomUnreadStatusElement.textContent = "읽지 않은 메시지: -";
        joinRoomButton.textContent = "채팅방 가입";
        joinRoomButton.disabled = !authState;
        console.error(error);
    }

    await loadAdminPanel(roomId);
}

async function connect(roomId: string): Promise<void> {
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
                const message = JSON.parse(frame.body) as ChatMessage;
                appendMessage(message);
                if (message.roomId === selectedRoomId) {
                    scheduleReadMark(message.roomId);
                } else {
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
                } satisfies ChatMessage)
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
        await register(
            registerUsernameInput.value.trim(),
            registerEmailInput.value.trim(),
            registerPasswordInput.value
        );
        registerForm.reset();
    } catch (error) {
        console.error(error);
    }
});

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
        await login(loginUsernameInput.value.trim(), loginPasswordInput.value);
        loginForm.reset();
    } catch (error) {
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
    } catch (error) {
        console.error(error);
        setConnected(false);
    }
});

roomForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = newRoomNameInput.value.trim();
    const accessType = newRoomAccessInput.value as AccessType;
    if (!name) {
        return;
    }
    try {
        const room = await createRoom(name, accessType);
        roomForm.reset();
        newRoomAccessInput.value = "MEMBERS_ONLY";
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

refreshUsersButton.addEventListener("click", async () => {
    try {
        await fetchUsers();
    } catch (error) {
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
    } catch (error) {
        console.error(error);
    }
});

adminRoomForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!selectedRoomId || !isAdmin()) {
        return;
    }
    try {
        await updateAdminRoom(selectedRoomId, adminRoomNameInput.value.trim(), adminRoomAccessInput.value as AccessType);
        await fetchRooms();
        await selectRoom(selectedRoomId);
    } catch (error) {
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
        await updateAdminUser(
            userId,
            adminUserRole.value as UserRole,
            adminUserActive.value === "true"
        );
        await fetchUsers();
        await refreshSession();
    } catch (error) {
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
        } else {
            await refreshSession();
        }
    } catch (error) {
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
        } satisfies ChatMessage)
    });
    messageInput.value = "";
    messageInput.focus();
});

setConnected(false);
setAuthenticated(false);
void refreshSession().catch((error) => console.error(error));
