import express, { Request, Response } from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { RoomManager } from "./RoomManager";
import { MessageHandler } from "./MessageHandler";

const app = express();
const httpServer = createServer(app);

// ✅ Allowed origins
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:4173",
  "https://youtube-music-18.onrender.com",
];

// ✅ Socket.io setup
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// ✅ Express CORS
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.use(express.json());

const roomManager = new RoomManager();
const messageHandler = new MessageHandler(io, roomManager);

// ✅ Routes
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.get("/room/:roomId/exists", (req: Request, res: Response) => {
  res.json({ exists: roomManager.roomExists(req.params.roomId) });
});

// ✅ Socket connection
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);
  messageHandler.register(socket);
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});