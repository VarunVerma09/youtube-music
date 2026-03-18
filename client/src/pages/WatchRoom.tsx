import { useState, useEffect, useRef, useCallback } from "react";
import { socket } from "../socket";
import type { SessionInfo, Participant, VideoState, ChatMessage, Role } from "../types";
import { YoutubePlayer, playerReadyRef } from "../components/YoutubePlayer";
import { ParticipantList } from "../components/ParticipantList";
import { Chat } from "../components/Chat";
import { VideoControls } from "../components/VideoControls";

interface Props {
  session: SessionInfo;
  onLeave: () => void;
}

export function WatchRoom({ session, onLeave }: Props) {
  const [participants, setParticipants] = useState<Participant[]>(session.participants);
  const [myRole, setMyRole] = useState<Role>(session.role);
  const [videoState, setVideoState] = useState<VideoState>(session.videoState);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);
  const [showAddVideo, setShowAddVideo] = useState(false);
  const [copied, setCopied] = useState(false);
  const [connected, setConnected] = useState(socket.connected);
  const playerRef = useRef<YT.Player | null>(null);
  const isSyncing = useRef(false);
  const toastId = useRef(0);
  const videoStateRef = useRef(session.videoState);
  useEffect(() => { videoStateRef.current = videoState; }, [videoState]);

  const addToast = useCallback((text: string) => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev, { id, text }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  const syncPlayer = useCallback((state: VideoState) => {
    if (!playerRef.current || !playerReadyRef.current) return;
    isSyncing.current = true;
    try {
      playerRef.current.seekTo(state.currentTime, true);
      if (state.playState === "playing") {
        playerRef.current.playVideo();
      } else {
        playerRef.current.pauseVideo();
      }
    } catch (e) {
      console.warn("syncPlayer error:", e);
    }
    setTimeout(() => { isSyncing.current = false; }, 800);
  }, []);
  useEffect(() => {
    const onConnect = () => {
      setConnected(true);
      socket.emit("request_sync", { roomId: session.roomId });
    };
    const onDisconnect = () => setConnected(false);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    socket.on("user_joined", (data: { username: string; participants: Participant[] }) => {
      setParticipants(data.participants);
      addToast(`${data.username} joined the room`);
    });

    socket.on("user_left", (data: { username: string; participants: Participant[] }) => {
      setParticipants(data.participants);
      addToast(`${data.username} left the room`);
    });

    socket.on("role_assigned", (data: { userId: string; role: Role; participants: Participant[] }) => {
      setParticipants(data.participants);
      if (data.userId === session.userId) {
        setMyRole(data.role);
        addToast(`Your role is now: ${data.role}`);
      }
    });

    socket.on("host_transferred", (data: { newHostId: string; oldHostId: string; participants: Participant[] }) => {
      setParticipants(data.participants);
      if (data.newHostId === session.userId) {
        setMyRole("host");
        addToast("You are now the host");
      } else if (data.oldHostId === session.userId) {
        setMyRole("participant");
        addToast("You are no longer the host");
      }
    });

    socket.on("participant_removed", (data: { participants: Participant[] }) => {
      setParticipants(data.participants);
    });

    socket.on("removed_from_room", () => {
      addToast("You were removed from the room");
      setTimeout(() => {
        socket.disconnect();
        onLeave();
      }, 1500);
    });

    socket.on("play", (data: { currentTime: number }) => {
      setVideoState((v) => ({ ...v, playState: "playing", currentTime: data.currentTime }));
      if (!playerRef.current || !playerReadyRef.current) return;
      isSyncing.current = true;
      try {
        playerRef.current.seekTo(data.currentTime, true);
        playerRef.current.playVideo();
      } catch (e) { console.warn("play error:", e); }
      setTimeout(() => { isSyncing.current = false; }, 800);
    });

    socket.on("pause", (data: { currentTime: number }) => {
      setVideoState((v) => ({ ...v, playState: "paused", currentTime: data.currentTime }));
      if (!playerRef.current || !playerReadyRef.current) return;
      isSyncing.current = true;
      try {
        playerRef.current.pauseVideo();
        playerRef.current.seekTo(data.currentTime, true);
      } catch (e) { console.warn("pause error:", e); }
      setTimeout(() => { isSyncing.current = false; }, 800);
    });

    socket.on("seek", (data: { time: number }) => {
      setVideoState((v) => ({ ...v, currentTime: data.time }));
      if (!playerRef.current || !playerReadyRef.current) return;
      isSyncing.current = true;
      try {
        playerRef.current.seekTo(data.time, true);
      } catch (e) { console.warn("seek error:", e); }
      setTimeout(() => { isSyncing.current = false; }, 800);
    });

    socket.on("change_video", (data: { videoId: string }) => {
      setVideoState({ videoId: data.videoId, playState: "paused", currentTime: 0 });
    });

    socket.on("sync_state", (data: VideoState) => {
      setVideoState(data);
      syncPlayer(data);
    });

    socket.on("chat_message", (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on("error", (data: { message: string }) => {
      console.warn("Server error:", data.message);
    });

    const syncInterval = setInterval(() => {
      socket.emit("request_sync", { roomId: session.roomId });
    }, 10000);

    return () => {
      clearInterval(syncInterval);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("user_joined");
      socket.off("user_left");
      socket.off("role_assigned");
      socket.off("host_transferred");
      socket.off("participant_removed");
      socket.off("removed_from_room");
      socket.off("play");
      socket.off("pause");
      socket.off("seek");
      socket.off("change_video");
      socket.off("sync_state");
      socket.off("chat_message");
      socket.off("error");
    };
  }, [session.userId, session.roomId, session.username, onLeave, syncPlayer, addToast]);

  const handleLeave = () => {
    socket.emit("leave_room", { roomId: session.roomId });
    socket.disconnect();
    onLeave();
  };

  const copyLink = () => {
    const url = `${window.location.origin}?room=${session.roomId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const canControl = myRole === "host" || myRole === "moderator";

  return (
    <div className="watch-room">
      <div className="room-header">
        <div className="room-info">
          <span className="room-code">Room: {session.roomId}</span>
          <button className="btn-ghost" onClick={copyLink}>
            {copied ? "✓ Copied!" : "Copy Invite Link"}
          </button>
          {!connected && <span className="conn-badge disconnected">Reconnecting...</span>}
        </div>
        <div className="user-info">
          <span className="username-label">{session.username}</span>
          <span className={`role-badge role-${myRole}`}>{myRole}</span>
          <button className="btn-danger" onClick={handleLeave}>Leave</button>
        </div>
      </div>

      <div className="room-body">
        <div className="main-panel">
          <YoutubePlayer
            videoId={videoState.videoId}
            playerRef={playerRef}
            isSyncing={isSyncing}
            onPlayerReady={() => {
              if (videoStateRef.current.videoId) syncPlayer(videoStateRef.current);
            }}
            onAddVideo={canControl ? () => setShowAddVideo(true) : undefined}
          />
          <VideoControls
            roomId={session.roomId}
            videoState={videoState}
            canControl={canControl}
            playerRef={playerRef}
            isSyncing={isSyncing}
            showAddVideo={showAddVideo}
            onToggleAddVideo={setShowAddVideo}
          />
        </div>

        <div className="side-panel">
          <ParticipantList
            participants={participants}
            myId={session.userId}
            myRole={myRole}
            roomId={session.roomId}
          />
          <Chat
            messages={messages}
            roomId={session.roomId}
            username={session.username}
          />
        </div>
      </div>

      {toasts.length > 0 && (
        <div className="toast-container">
          {toasts.map((t) => (
            <div key={t.id} className="toast">{t.text}</div>
          ))}
        </div>
      )}
    </div>
  );
}
