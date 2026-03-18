# YouTube Watch Party

Watch YouTube videos in sync with friends. Create a room, share the code, and everyone stays in sync — play, pause, seek, and video changes broadcast to all participants in real time.

## Live Demo

> **[https://your-app.onrender.com](https://your-app.onrender.com)** — replace with your deployed URL after deployment

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + Express + TypeScript
- **Real-time**: Socket.IO (WebSockets)
- **Video**: YouTube IFrame Player API
- **In-memory store**: No database required for MVP

## Features

- Create or join rooms with a unique room code
- YouTube video sync — play, pause, seek, change video
- Role-based access: Host, Moderator, Participant
- Host can promote/demote participants, remove users, transfer host
- Moderators can control playback (play/pause/seek/change video)
- Real-time participant list with roles
- In-room text chat (bonus)
- Toast notifications for join/leave/role changes

## Architecture

The server uses an OOP structure:

- `Participant` — holds user identity, role, and socket ID
- `Room` — manages participants map and video state; exposes `addParticipant`, `removeParticipant`, `assignRole`, `transferHost`, `updateVideoState`
- `RoomManager` — in-memory `Map<roomId, Room>` for all active rooms
- `MessageHandler` — registers and handles all Socket.IO events per connection

**WebSocket flow:**
1. Client connects and emits `join_room` with `{ roomId, username }`
2. Server creates or finds the room, assigns a role (host if first, participant otherwise), and emits `joined` back with current video state and participant list
3. When a host/moderator emits `play`, `pause`, `seek`, or `change_video`, the server validates the sender's role, updates the room's video state, and broadcasts to all other clients in the room
4. When a participant joins late, they receive the current `videoState` in the `joined` event and sync immediately
5. Role changes (`assign_role`, `transfer_host`, `remove_participant`) are host-only and broadcast to the whole room so every client updates its UI


## Local Setup

### Prerequisites

- Node.js 18+
- npm

### 1. Start the server

```bash
cd server
npm install
npm run dev
```

Runs on `http://localhost:3001`

### 2. Start the client

```bash
cd client
npm install
npm run dev
```

Runs on `http://localhost:5173`

Copy `client/.env.example` to `client/.env` if you need to change the server URL.

## Deployment (Render — recommended)

Render supports WebSocket servers natively.

### Backend

1. Create a new **Web Service** on [Render](https://render.com) pointing to the `server` folder
2. Build command: `npm install && npm run build`
3. Start command: `npm start`
4. Add environment variable: `CLIENT_URL=https://your-frontend.onrender.com`

### Frontend

1. Create a new **Static Site** on Render pointing to the `client` folder
2. Build command: `npm install && npm run build`
3. Publish directory: `dist`
4. Add environment variable: `VITE_SERVER_URL=https://your-backend.onrender.com`

### Environment Variables

| Variable | Where | Description |
|---|---|---|
| `PORT` | Server | Port to listen on (default: 3001) |
| `CLIENT_URL` | Server | Frontend origin for CORS |
| `VITE_SERVER_URL` | Client | Backend WebSocket/API URL |

## WebSocket Events

| Event | Direction | Description |
|---|---|---|
| `join_room` | Client → Server | Join or create a room |
| `leave_room` | Client → Server | Leave the room |
| `play` | Client → Server | Play video (host/moderator only) |
| `pause` | Client → Server | Pause video (host/moderator only) |
| `seek` | Client → Server | Seek to time (host/moderator only) |
| `change_video` | Client → Server | Load new video (host/moderator only) |
| `assign_role` | Client → Server | Assign role to participant (host only) |
| `remove_participant` | Client → Server | Remove user from room (host only) |
| `transfer_host` | Client → Server | Transfer host role (host only) |
| `chat_message` | Client → Server | Send a chat message |
| `joined` | Server → Client | Confirmed join with video state + participants |
| `user_joined` | Server → Clients | New participant joined |
| `user_left` | Server → Clients | Participant left |
| `sync_state` | Server → Client | Sync current video state to a client |
| `role_assigned` | Server → Clients | Role was updated |
| `host_transferred` | Server → Clients | Host role was transferred |
| `participant_removed` | Server → Clients | Participant was removed by host |
| `removed_from_room` | Server → Client | You were removed |
| `chat_message` | Server → Clients | Broadcast chat message |
