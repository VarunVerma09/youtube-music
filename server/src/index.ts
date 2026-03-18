import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { RoomManager } from "./RoomManager";
import { MessageHandler } from "./MessageHandler";

const app = express();
const httpServer = createServer(app);

const allowedOrigins = process.env.CLIENT_URL
  ? [process.env.CLIENT_URL]
  : ["http://localhost:5173", "http://localhost:4173"];

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
  },
});

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

const roomManager = new RoomManager();
const messageHandler = new MessageHandler(io, roomManager);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/room/:roomId/exists", (req, res) => {
  res.json({ exists: roomManager.roomExists(req.params.roomId) });
});

io.on("connection", (socket) => {
  messageHandler.register(socket);
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
