import { Room } from "./Room";

export class RoomManager {
  private rooms: Map<string, Room>;

  constructor() {
    this.rooms = new Map();
  }

  createRoom(roomId: string): Room {
    const room = new Room(roomId);
    this.rooms.set(roomId, room);
    return room;
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  getOrCreate(roomId: string): { room: Room; isNew: boolean } {
    const existing = this.rooms.get(roomId);
    if (existing) return { room: existing, isNew: false };
    return { room: this.createRoom(roomId), isNew: true };
  }

  deleteRoom(roomId: string): void {
    this.rooms.delete(roomId);
  }

  roomExists(roomId: string): boolean {
    return this.rooms.has(roomId);
  }

  getAllRooms(): Map<string, Room> {
    return this.rooms;
  }
}
