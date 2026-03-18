export type Role = "host" | "moderator" | "participant";

export interface Participant {
  id: string;
  username: string;
  role: Role;
}

export interface VideoState {
  videoId: string;
  playState: "playing" | "paused";
  currentTime: number;
}

export interface ChatMessage {
  userId: string;
  username: string;
  message: string;
  timestamp: number;
}

export interface SessionInfo {
  roomId: string;
  userId: string;
  username: string;
  role: Role;
  participants: Participant[];
  videoState: VideoState;
}
