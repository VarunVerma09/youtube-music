import { useEffect, useRef } from "react";
import type { RefObject } from "react";

interface Props {
  videoId: string;
  playerRef: RefObject<YT.Player | null>;
  isSyncing: RefObject<boolean>;
  onPlayerReady?: () => void;
  onStateChange?: (state: number) => void;
  onAddVideo?: () => void;
}

declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void;
    YT: typeof YT;
  }
}

export function YoutubePlayer({ videoId, playerRef, isSyncing, onPlayerReady, onStateChange, onAddVideo }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerReady = useRef(false);
  const pendingVideoId = useRef<string | null>(null);

  useEffect(() => {
    const initPlayer = () => {
      if (!containerRef.current) return;

      playerRef.current = new window.YT.Player(containerRef.current, {
        width: "100%",
        height: "100%",
        videoId: "",
     playerVars: {
  controls: 1,       
  disablekb: 1,      
  rel: 0,
  modestbranding: 1,
  iv_load_policy: 3,
  fs: 1,            
  autoplay: 0,
},
        events: {
          onReady: () => {
            playerReady.current = true;
            if (pendingVideoId.current) {
              playerRef.current?.loadVideoById(pendingVideoId.current);
              playerRef.current?.pauseVideo();
              pendingVideoId.current = null;
            }
            onPlayerReady?.();
          },
          onStateChange: (event: YT.OnStateChangeEvent) => onStateChange?.(event.data),
          onError: () => console.warn("YouTube player error — video may be unavailable or restricted."),
        },
      });
    };

    if (window.YT?.Player) {
      initPlayer();
    } else {
      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(tag);
      }
      window.onYouTubeIframeAPIReady = initPlayer;
    }

    return () => {
      playerRef.current?.destroy();
      playerRef.current = null;
      playerReady.current = false;
    };
  }, []);

  useEffect(() => {
    if (!videoId) return;
    if (!playerReady.current || !playerRef.current) {
      pendingVideoId.current = videoId;
      return;
    }
    isSyncing.current = true;
    playerRef.current.loadVideoById(videoId);
    playerRef.current.pauseVideo();
    setTimeout(() => { isSyncing.current = false; }, 500);
  }, [videoId]);

  return (
    <div className="youtube-wrapper">
      {!videoId && (
        <div className="player-placeholder">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
            <circle cx="12" cy="12" r="10" />
            <polygon points="10,8 16,12 10,16" fill="currentColor" stroke="none" />
          </svg>
          <p>No video loaded</p>
          <span>The host can paste a YouTube URL to start watching together</span>
          {onAddVideo && (
            <button className="btn-placeholder-add" onClick={onAddVideo}>
              + Add a Video
            </button>
          )}
        </div>
      )}
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
    </div>
  );
}
