import { Server, matchMaker } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import express from "express";
import cors from "cors";
import http from "http";
import path from "path";
import { PudgeRoom } from "./rooms/PudgeRoom";

const app = express();
app.use(cors());

const server = http.createServer(app);
const port = Number(process.env.PORT) || 3000;

const gameServer = new Server({
  transport: new WebSocketTransport({ server }),
});

gameServer.define("pudge", PudgeRoom);

// --- API routes (MUST be after gameServer is created) ---

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.get("/api/find-room/:code", async (req, res) => {
  const code = req.params.code.toUpperCase();
  try {
    const rooms = await matchMaker.query({ name: "pudge" });
    const found = rooms.find((r: any) => r.metadata?.roomCode === code && !r.locked);
    if (found) {
      res.json({ roomId: found.roomId });
    } else {
      res.status(404).json({ error: "not_found" });
    }
  } catch (e) {
    res.status(500).json({ error: "server_error" });
  }
});

// --- Static files (MUST be last) ---
const clientDist = path.resolve(__dirname, "../../client/dist");
app.use(express.static(clientDist));
app.get("*", (_req, res, next) => {
  if (_req.headers.upgrade) return next();
  res.sendFile(path.join(clientDist, "index.html"));
});

gameServer.listen(port).then(() => {
  console.log(`🎣 Pudge Wars running on port ${port}`);
});
