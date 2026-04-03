# Socket Chat

Spring Boot와 TypeScript 기반의 소켓 채팅 예제 프로젝트입니다.

현재 포함된 기능:

- Spring WebSocket + STOMP 기반 실시간 채팅
- JWT 액세스 토큰 + 리프레시 토큰 인증
- 회원가입 / 로그인 / 로그아웃 / 토큰 재발급
- 공개 방 / 멤버 전용 방
- 채팅방 생성, 가입, 메시지 히스토리 조회
- 메시지 읽음 처리 및 읽지 않은 메시지 수 표시
- 관리자 전용 방 관리
- 관리자 전용 사용자 권한 / 활성 상태 관리

## 기술 스택

- Backend: Java 22, Spring Boot 3.3, Spring WebSocket, Spring Security, Spring Data JPA
- Frontend: TypeScript, HTML, CSS
- Database: H2 in-memory database
- Auth: JWT

## 실행 방법

프로젝트 루트에서 아래 명령을 실행합니다.

```bash
./gradlew bootRun
```

브라우저 접속:

```text
http://localhost:8080
```

프론트 TypeScript 컴파일:

```bash
npm install
npm run build:frontend
```

백엔드 빌드:

```bash
./gradlew build
```

## 기본 계정

애플리케이션 시작 시 아래 관리자 계정이 시드됩니다.

- username: `admin`
- password: `admin1234`

## 인증 구조

로그인 또는 회원가입 성공 시 아래 값이 발급됩니다.

- `accessToken`
- `refreshToken`

클라이언트는 액세스 토큰으로 API와 WebSocket에 접근하고, 만료 시 리프레시 토큰으로 재발급을 수행합니다.

## 주요 기능 설명

### 1. 사용자 기능

- 회원가입 / 로그인
- 채팅방 목록 조회
- 채팅방 생성
- 채팅방 가입
- 채팅방 메시지 조회
- 실시간 메시지 송수신
- 읽지 않은 메시지 수 확인

### 2. 관리자 기능

- 사용자 목록 조회
- 사용자 권한 변경 (`ROLE_USER`, `ROLE_ADMIN`)
- 사용자 활성 / 비활성 변경
- 채팅방 상세 멤버 조회
- 채팅방 이름 수정
- 채팅방 공개 범위 수정
- 채팅방 삭제

## 공개 범위 정책

- `PUBLIC`: 로그인한 사용자는 바로 접근 가능
- `MEMBERS_ONLY`: 가입한 사용자만 접근 가능

## 읽음 처리 방식

읽음 상태는 사용자-채팅방 단위로 마지막 읽은 메시지 ID를 저장하는 방식입니다.

- 방 상세 조회 시 unread 수 확인 가능
- 방 진입 시 읽음 처리
- 현재 보고 있는 방에서 새 메시지 수신 시 읽음 처리 갱신

## 주요 엔드포인트

### 인증

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### 채팅

- `GET /api/chat/rooms`
- `POST /api/chat/rooms`
- `GET /api/chat/rooms/{roomId}`
- `POST /api/chat/rooms/{roomId}/join`
- `POST /api/chat/rooms/{roomId}/read`
- WebSocket endpoint: `/ws-chat`

### 관리자

- `GET /api/admin/rooms/{roomId}`
- `PATCH /api/admin/rooms/{roomId}`
- `DELETE /api/admin/rooms/{roomId}`
- `GET /api/admin/users`
- `PATCH /api/admin/users/{userId}`

## 개발 환경 참고

H2 콘솔:

```text
http://localhost:8080/h2-console
```

기본 설정:

- JDBC URL: `jdbc:h2:mem:socketchat`
- Username: `sa`
- Password: 빈 값

## 프로젝트 구조

```text
src/main/java
  org/jyhan/socketchat
    auth
    chat
    user
    config

src/main/resources
  application.yml
  static/

src/main/frontend
  chat.ts
```

## 현재 한계

- 테스트 코드 미작성
- refresh token 저장소가 H2 메모리 DB 기반
- 메시지 검색, 파일 전송, 알림 기능 없음
- 다중 서버 환경용 메시지 브로커 미적용

## 다음 확장 후보

- Redis 기반 pub/sub 및 세션 공유
- 메시지 검색 / 페이징
- 파일 업로드
- 알림
- OAuth 로그인
- 테스트 코드 추가
