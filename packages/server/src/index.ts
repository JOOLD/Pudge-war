import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import express from "express";
import cors from "cors";
import http from "http";
import path from "path";
import { PudgeRoom } from "./rooms/PudgeRoom";

const app = express();
app.use(cors());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

const clientDist = path.resolve(__dirname, "../../client/dist");
app.use(express.static(clientDist));
app.get("*", (_req, res, next) => {
  if (_req.headers.upgrade) return next();
  res.sendFile(path.join(clientDist, "index.html"));
});

const server = http.createServer(app);
const port = Number(process.env.PORT) || 3000;

const gameServer = new Server({
  transport: new WebSocketTransport({ server }),
});

gameServer.define("pudge", PudgeRoom).filterBy(["roomCode"]);

gameServer.listen(port).then(() => {
  console.log(`🎣 Pudge Wars running on port ${port}`);
});
