import { useState, useEffect } from "react";
import { socket } from "../socket";
import type { SessionInfo, Role, Participant, VideoState } from "../types";

interface Props {
  onJoined: (session: SessionInfo) => void;
}

export function Lobby({ onJoined }: Props) {
  const [username, setUsername] = useState("");
  const [roomId, setRoomId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rid = params.get("room");
    if (rid) setRoomId(rid.toUpperCase());
  }, []);

  useEffect(() => {
    const onJoinedEvent = (data: { userId: string; role: Role; participants: Participant[]; videoState: VideoState }) => {
      setLoading(false);
      onJoined({
        roomId: roomId.trim().toUpperCase(),
        userId: data.userId,
        username: username.trim(),
        role: data.role,
        participants: data.participants,
        videoState: data.videoState,
      });
    };

    const onConnectError = () => {
      setLoading(false);
      setError("Could not connect to server. Make sure the server is running.");
    };

    socket.on("joined", onJoinedEvent);
    socket.on("connect_error", onConnectError);

    return () => {
      socket.off("joined", onJoinedEvent);
      socket.off("connect_error", onConnectError);
    };
  }, [roomId, username, onJoined]);
  const generateRoomId = () => {
    const id = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomId(id);
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUsername = username.trim();
    const trimmedRoomId = roomId.trim().toUpperCase();

    if (!trimmedUsername) { setError("Please enter your name."); return; }
    if (!trimmedRoomId) { setError("Please enter a room code."); return; }

    setError("");
    setLoading(true);

    if (!socket.connected) {
      socket.connect();
      socket.once("connect", () => {
        socket.emit("join_room", { roomId: trimmedRoomId, username: trimmedUsername });
      });
    } else {
      socket.emit("join_room", { roomId: trimmedRoomId, username: trimmedUsername });
    }
  };

  return (
    <div className="lobby">
      <div className="lobby-card">
        <div className="lobby-logo">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="#ff4444">
            <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
          </svg>
          <h1>Watch Party</h1>
        </div>
        <p className="subtitle">Watch YouTube videos in sync with friends</p>

        <form onSubmit={handleJoin}>
          <div className="field">
            <label htmlFor="username">Your name</label>
            <input
              id="username"
              type="text"
              placeholder="Enter your name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={30}
              autoFocus
            />
          </div>

          <div className="field">
            <label htmlFor="roomId">Room code</label>
            <div className="room-input-row">
              <input
                id="roomId"
                type="text"
                placeholder="e.g. ABC123"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                maxLength={10}
              />
              <button type="button" className="btn-secondary" onClick={generateRoomId}>
                New Room
              </button>
            </div>
            <p className="field-hint">Create a new room or enter an existing code to join.</p>
          </div>

          {error && <p className="error">{error}</p>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Connecting..." : "Join Room"}
          </button>
        </form>
      </div>
    </div>
  );
}
