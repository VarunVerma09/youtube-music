import { Server, Socket } from "socket.io";
import { RoomManager } from "./RoomManager";
import { Participant } from "./Participant";
import { v4 as uuidv4 } from "uuid";

const VALID_VIDEO_ID = /^[a-zA-Z0-9_-]{11}$/;

export class MessageHandler {
  private io: Server;
  private roomManager: RoomManager;

  constructor(io: Server, roomManager: RoomManager) {
    this.io = io;
    this.roomManager = roomManager;
  }

  register(socket: Socket): void {
    socket.on("join_room", (data) => this.handleJoinRoom(socket, data));
    socket.on("leave_room", (data) => this.handleLeaveRoom(socket, data));
    socket.on("play", (data) => this.handlePlay(socket, data));
    socket.on("pause", (data) => this.handlePause(socket, data));
    socket.on("seek", (data) => this.handleSeek(socket, data));
    socket.on("change_video", (data) => this.handleChangeVideo(socket, data));
    socket.on("assign_role", (data) => this.handleAssignRole(socket, data));
    socket.on("remove_participant", (data) => this.handleRemoveParticipant(socket, data));
    socket.on("transfer_host", (data) => this.handleTransferHost(socket, data));
    socket.on("chat_message", (data) => this.handleChatMessage(socket, data));
    socket.on("request_sync", (data) => this.handleRequestSync(socket, data));
    socket.on("disconnect", () => this.handleDisconnect(socket));
  }

  private handleJoinRoom(socket: Socket, data: { roomId: string; username: string }) {
    if (!data?.roomId || !data?.username) return;

    const roomId = String(data.roomId).trim().toUpperCase().slice(0, 20);
    const username = String(data.username).trim().slice(0, 30);
    if (!roomId || !username) return;

    const { room, isNew } = this.roomManager.getOrCreate(roomId);
    const role = isNew || room.isEmpty() ? "host" : "participant";
    const userId = uuidv4();

    const participant = new Participant(userId, username, role, socket.id);
    room.addParticipant(participant);
    socket.join(roomId);

    socket.emit("joined", {
      userId,
      role,
      videoState: {
        videoId: room.videoState.videoId,
        playState: room.videoState.playState,
        currentTime: room.getCurrentTime(),
      },
      participants: room.getParticipantList(),
    });

    socket.to(roomId).emit("user_joined", {
      username,
      userId,
      role,
      participants: room.getParticipantList(),
    });
  }

  private handleLeaveRoom(socket: Socket, data: { roomId: string }) {
    this.doLeave(socket, data?.roomId);
  }

  private handleDisconnect(socket: Socket) {
    for (const [roomId, room] of this.roomManager.getAllRooms().entries()) {
      const participant = room.getParticipantBySocketId(socket.id);
      if (participant) {
        this.doLeave(socket, roomId);
        break;
      }
    }
  }

  private doLeave(socket: Socket, roomId: string) {
    if (!roomId) return;
    const room = this.roomManager.getRoom(roomId);
    if (!room) return;

    const participant = room.getParticipantBySocketId(socket.id);
    if (!participant) return;

    const wasHost = participant.role === "host";
    room.removeParticipant(participant.id);
    socket.leave(roomId);

    if (room.isEmpty()) {
      this.roomManager.deleteRoom(roomId);
      return;
    }

    if (wasHost) {
      const next = Array.from(room.participants.values())[0];
      if (next) {
        next.role = "host";
        this.io.to(roomId).emit("role_assigned", {
          userId: next.id,
          username: next.username,
          role: "host",
          participants: room.getParticipantList(),
        });
      }
    }

    this.io.to(roomId).emit("user_left", {
      username: participant.username,
      userId: participant.id,
      participants: room.getParticipantList(),
    });
  }

  private handlePlay(socket: Socket, data: { roomId: string; currentTime: number }) {
    const { room } = this.getAuthorized(socket, data?.roomId);
    if (!room) return;

    const currentTime = typeof data.currentTime === "number" ? data.currentTime : room.videoState.currentTime;
    room.updateVideoState({ playState: "playing", currentTime });
    socket.to(data.roomId).emit("play", { currentTime });
  }

  private handlePause(socket: Socket, data: { roomId: string; currentTime: number }) {
    const { room } = this.getAuthorized(socket, data?.roomId);
    if (!room) return;

    const currentTime = typeof data.currentTime === "number" ? data.currentTime : room.videoState.currentTime;
    room.updateVideoState({ playState: "paused", currentTime });
    socket.to(data.roomId).emit("pause", { currentTime });
  }

  private handleSeek(socket: Socket, data: { roomId: string; time: number }) {
    const { room } = this.getAuthorized(socket, data?.roomId);
    if (!room) return;

    if (typeof data.time !== "number" || data.time < 0) return;
    room.updateVideoState({ currentTime: data.time });
    socket.to(data.roomId).emit("seek", { time: data.time });
  }

  private handleChangeVideo(socket: Socket, data: { roomId: string; videoId: string }) {
    const { room } = this.getAuthorized(socket, data?.roomId);
    if (!room) return;

    if (!data.videoId || !VALID_VIDEO_ID.test(data.videoId)) return;
    room.updateVideoState({ videoId: data.videoId, currentTime: 0, playState: "paused" });
    this.io.to(data.roomId).emit("change_video", { videoId: data.videoId });
  }

  private handleAssignRole(socket: Socket, data: { roomId: string; userId: string; role: string }) {
    const room = this.roomManager.getRoom(data?.roomId);
    if (!room) return;

    const requester = room.getParticipantBySocketId(socket.id);
    if (!requester || !requester.isHost()) return;

    const validRoles = ["moderator", "participant"];
    if (!validRoles.includes(data.role) || !data.userId) return;

    const success = room.assignRole(data.userId, data.role as "moderator" | "participant");
    if (!success) return;

    const target = room.getParticipant(data.userId);
    this.io.to(data.roomId).emit("role_assigned", {
      userId: data.userId,
      username: target?.username,
      role: data.role,
      participants: room.getParticipantList(),
    });
  }

  private handleRemoveParticipant(socket: Socket, data: { roomId: string; userId: string }) {
    const room = this.roomManager.getRoom(data?.roomId);
    if (!room) return;

    const requester = room.getParticipantBySocketId(socket.id);
    if (!requester || !requester.isHost()) return;
    if (!data.userId || data.userId === requester.id) return;

    const target = room.getParticipant(data.userId);
    if (!target) return;

    room.removeParticipant(data.userId);

    const targetSocket = this.io.sockets.sockets.get(target.socketId);
    if (targetSocket) {
      targetSocket.emit("removed_from_room", { roomId: data.roomId });
      targetSocket.leave(data.roomId);
    }

    this.io.to(data.roomId).emit("participant_removed", {
      userId: data.userId,
      participants: room.getParticipantList(),
    });
  }

  private handleTransferHost(socket: Socket, data: { roomId: string; userId: string }) {
    const room = this.roomManager.getRoom(data?.roomId);
    if (!room) return;

    const requester = room.getParticipantBySocketId(socket.id);
    if (!requester || !requester.isHost()) return;
    if (!data.userId || data.userId === requester.id) return;

    const success = room.transferHost(data.userId);
    if (!success) return;

    this.io.to(data.roomId).emit("host_transferred", {
      newHostId: data.userId,
      oldHostId: requester.id,
      participants: room.getParticipantList(),
    });
  }

  private handleChatMessage(socket: Socket, data: { roomId: string; message: string }) {
    const room = this.roomManager.getRoom(data?.roomId);
    if (!room) return;

    const sender = room.getParticipantBySocketId(socket.id);
    if (!sender) return;

    const message = String(data.message ?? "").trim().slice(0, 300);
    if (!message) return;

    this.io.to(data.roomId).emit("chat_message", {
      userId: sender.id,
      username: sender.username,
      message,
      timestamp: Date.now(),
    });
  }

  private handleRequestSync(socket: Socket, data: { roomId: string }) {
    const room = this.roomManager.getRoom(data?.roomId);
    if (!room) return;

    const participant = room.getParticipantBySocketId(socket.id);
    if (!participant) return;

    socket.emit("sync_state", {
      videoId: room.videoState.videoId,
      playState: room.videoState.playState,
      currentTime: room.getCurrentTime(),
    });
  }

  private getAuthorized(socket: Socket, roomId: string) {
    const room = this.roomManager.getRoom(roomId);
    if (!room) return { room: null, participant: null };

    const participant = room.getParticipantBySocketId(socket.id);
    if (!participant || !participant.canControl()) {
      socket.emit("error", { message: "Permission denied" });
      return { room: null, participant: null };
    }

    return { room, participant };
  }
}
