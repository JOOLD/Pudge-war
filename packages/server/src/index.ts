import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import express from "express";
import cors from "cors";
import http from "http";
import { PudgeRoom } from "./rooms/PudgeRoom";

const app = express();
app.use(cors());
app.use(express.json());

// Health check for Zeabur
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

const server = http.createServer(app);
const port = Number(process.env.PORT) || 3000;

const gameServer = new Server({
  transport: new WebSocketTransport({ server }),
});

// Register game room
gameServer.define("pudge", PudgeRoom);

gameServer.listen(port).then(() => {
  console.log(`🎣 Pudge Wars server running on port ${port}`);
});
