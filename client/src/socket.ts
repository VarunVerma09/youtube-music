import { io } from "socket.io-client";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "https://youtube-music-14.onrender.com";

export const socket = io(SERVER_URL, { autoConnect: false });
