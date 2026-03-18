import { Participant, Role } from "./Participant";

export interface VideoState {
  videoId: string;
  playState: "playing" | "paused";
  currentTime: number;
  updatedAt: number;
}

export class Room {
  id: string;
  participants: Map<string, Participant>;
  videoState: VideoState;

  constructor(id: string) {
    this.id = id;
    this.participants = new Map();
    this.videoState = {
      videoId: "",
      playState: "paused",
      currentTime: 0,
      updatedAt: Date.now(),
    };
  }

  addParticipant(participant: Participant): void {
    this.participants.set(participant.id, participant);
  }

  removeParticipant(userId: string): boolean {
    return this.participants.delete(userId);
  }

  getParticipant(userId: string): Participant | undefined {
    return this.participants.get(userId);
  }

  getParticipantBySocketId(socketId: string): Participant | undefined {
    for (const p of this.participants.values()) {
      if (p.socketId === socketId) return p;
    }
    return undefined;
  }

  assignRole(userId: string, role: Role): boolean {
    const participant = this.participants.get(userId);
    if (!participant) return false;
    participant.role = role;
    return true;
  }

  getParticipantList() {
    return Array.from(this.participants.values()).map((p) => p.toJSON());
  }

  updateVideoState(partial: Partial<VideoState>): void {
    this.videoState = { ...this.videoState, ...partial, updatedAt: Date.now() };
  }

  getCurrentTime(): number {
    if (this.videoState.playState === "paused") return this.videoState.currentTime;
    const elapsed = (Date.now() - this.videoState.updatedAt) / 1000;
    return this.videoState.currentTime + elapsed;
  }

  isEmpty(): boolean {
    return this.participants.size === 0;
  }

  transferHost(newHostId: string): boolean {
    const currentHost = Array.from(this.participants.values()).find(
      (p) => p.role === "host"
    );
    const newHost = this.participants.get(newHostId);
    if (!newHost) return false;
    if (currentHost) currentHost.role = "participant";
    newHost.role = "host";
    return true;
  }
}
