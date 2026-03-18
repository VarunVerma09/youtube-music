import { useState, useEffect, useRef } from "react";
import type { RefObject } from "react";
import { socket } from "../socket";
import type { VideoState } from "../types";

interface Props {
  roomId: string;
  videoState: VideoState;
  canControl: boolean;
  playerRef: RefObject<YT.Player | null>;
  isSyncing: RefObject<boolean>;
  showAddVideo: boolean;
  onToggleAddVideo: (open: boolean) => void;
}

function extractVideoId(input: string): string | null {
  try {
    const url = new URL(input);
    if (url.hostname.includes("youtube.com")) return url.searchParams.get("v");
    if (url.hostname === "youtu.be") return url.pathname.slice(1).split("?")[0];
  } catch {
    if (/^[a-zA-Z0-9_-]{11}$/.test(input.trim())) return input.trim();
  }
  return null;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function VideoControls({ roomId, videoState, canControl, playerRef, isSyncing, showAddVideo, onToggleAddVideo }: Props) {
  const [urlInput, setUrlInput] = useState("");
  const [urlError, setUrlError] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragValue, setDragValue] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
  }, [videoState.videoId]);

  useEffect(() => {
    tickRef.current = setInterval(() => {
      if (!playerRef.current || isDragging) return;
      try {
        const t = playerRef.current.getCurrentTime?.() ?? 0;
        const d = playerRef.current.getDuration?.() ?? 0;
        setCurrentTime(t);
        if (d > 0) setDuration(d);
      } catch { /* player not ready */ }
    }, 500);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [playerRef, isDragging]);

  useEffect(() => {
    if (showAddVideo) setTimeout(() => inputRef.current?.focus(), 50);
  }, [showAddVideo]);

  const handlePlay = () => {
    if (!canControl) return;
    const t = playerRef.current?.getCurrentTime?.() ?? currentTime;
    playerRef.current?.playVideo();
    socket.emit("play", { roomId, currentTime: t });
  };

  const handlePause = () => {
    if (!canControl) return;
    const t = playerRef.current?.getCurrentTime?.() ?? currentTime;
    playerRef.current?.pauseVideo();
    socket.emit("pause", { roomId, currentTime: t });
  };
  const handleSeekStartMouse = () => setIsDragging(true);
  const handleSeekStartTouch = () => setIsDragging(true);

  const handleSeekMove = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDragValue(parseFloat(e.target.value));
  };

  const handleSeekEnd = () => {
    if (!canControl || isSyncing.current) { setIsDragging(false); return; }
    const time = dragValue;
    setIsDragging(false);
    setCurrentTime(time);
    socket.emit("seek", { roomId, time });
    playerRef.current?.seekTo(time, true);
  };

  const handleChangeVideo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canControl) return;
    const videoId = extractVideoId(urlInput.trim());
    if (!videoId) { setUrlError("Invalid YouTube URL or video ID."); return; }
    setUrlError("");
    setUrlInput("");
    onToggleAddVideo(false);
    socket.emit("change_video", { roomId, videoId });
  };

  const seekValue = isDragging ? dragValue : currentTime;
  const isPlaying = videoState.playState === "playing";

  return (
    <>
      {showAddVideo && (
        <div className="add-video-overlay" onClick={() => onToggleAddVideo(false)}>
          <div className="add-video-modal" onClick={(e) => e.stopPropagation()}>
            <div className="add-video-header">
              <h2>Add a Video</h2>
              <button className="modal-close" onClick={() => onToggleAddVideo(false)}>✕</button>
            </div>
            {canControl ? (
              <form onSubmit={handleChangeVideo}>
                <p className="add-video-hint">
                  Paste a YouTube URL or video ID — it loads for everyone in the room instantly.
                </p>
                <div className="add-video-input-row">
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="https://youtube.com/watch?v=..."
                    value={urlInput}
                    onChange={(e) => { setUrlInput(e.target.value); setUrlError(""); }}
                  />
                  <button type="submit" className="btn-load-video">Load for Everyone</button>
                </div>
                {urlError && <p className="error">{urlError}</p>}
                <div className="add-video-examples">
                  <span>Accepted formats:</span>
                  <code>https://youtube.com/watch?v=dQw4w9WgXcQ</code>
                  <code>https://youtu.be/dQw4w9WgXcQ</code>
                  <code>dQw4w9WgXcQ</code>
                </div>
              </form>
            ) : (
              <div className="add-video-restricted">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <p>Only the host or moderator can load a video.</p>
                <span>Ask the host to paste a YouTube URL.</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="video-controls">
        <div className="seek-row">
          <span className="time-label">{formatTime(seekValue)}</span>
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.5}
            value={seekValue}
            onChange={canControl ? handleSeekMove : () => {}}
            onMouseDown={canControl ? handleSeekStartMouse : undefined}
            onMouseUp={canControl ? handleSeekEnd : undefined}
            onTouchStart={canControl ? handleSeekStartTouch : undefined}
            onTouchEnd={canControl ? handleSeekEnd : undefined}
            className="seek-bar"
            style={{ opacity: canControl ? 1 : 0.5, cursor: canControl ? "pointer" : "default" }}
          />
          <span className="time-label">{formatTime(duration)}</span>
        </div>

        <div className="playback-controls">
          {canControl && (
            <button onClick={isPlaying ? handlePause : handlePlay} className="btn-play-pause">
              {isPlaying ? "⏸ Pause" : "▶ Play"}
            </button>
          )}
          {canControl && (
            <button className="btn-add-video" onClick={() => onToggleAddVideo(true)}>
              {videoState.videoId ? "⬛ Change Video" : "▶ Add Video"}
            </button>
          )}
          {!canControl && (
            <span className="viewer-notice">Only the host or moderator can control playback.</span>
          )}
        </div>
      </div>
    </>
  );
}
