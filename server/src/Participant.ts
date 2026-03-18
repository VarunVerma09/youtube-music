export type Role = "host" | "moderator" | "participant";

export class Participant {
  id: string;
  username: string;
  role: Role;
  socketId: string;

  constructor(id: string, username: string, role: Role, socketId: string) {
    this.id = id;
    this.username = username;
    this.role = role;
    this.socketId = socketId;
  }

  canControl(): boolean {
    return this.role === "host" || this.role === "moderator";
  }

  isHost(): boolean {
    return this.role === "host";
  }

  toJSON() {
    return {
      id: this.id,
      username: this.username,
      role: this.role,
    };
  }
}
