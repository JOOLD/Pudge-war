import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import express from "express";
import cors from "cors";
import http from "http";
import path from "path";
import { PudgeRoom } from "./rooms/PudgeRoom";
import { initAnalytics, logEvent, getPool } from "./analytics";

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Analytics event endpoint (client reports share clicks)
app.post('/api/analytics/event', express.json(), (req, res) => {
  const { type, sessionId, ref, payload } = req.body;
  if (!type || !sessionId) {
    return res.status(400).json({ error: 'type and sessionId required' });
  }
  logEvent({ type, sessionId, ref, payload });
  res.json({ ok: true });
});

// Analytics dashboard
app.get('/api/analytics/dashboard', async (_req, res) => {
  const pool = getPool();
  if (!pool) {
    return res.send('<h1>Analytics disabled</h1><p>No DATABASE_URL configured.</p>');
  }

  try {
    // Query stats
    const totalJoins = await pool.query("SELECT COUNT(*) FROM events WHERE type = 'join'");
    const refJoins = await pool.query("SELECT COUNT(*) FROM events WHERE type = 'join' AND ref IS NOT NULL AND ref != ''");
    const totalShares = await pool.query("SELECT COUNT(*) FROM events WHERE type = 'share_click'");
    const totalKills = await pool.query("SELECT COUNT(*) FROM events WHERE type = 'kill'");
    const totalGames = await pool.query("SELECT COUNT(*) FROM events WHERE type = 'game_start'");
    const sessions = await pool.query("SELECT COUNT(DISTINCT session_id) FROM events WHERE type = 'join'");

    const joins = parseInt(totalJoins.rows[0].count);
    const referred = parseInt(refJoins.rows[0].count);
    const shares = parseInt(totalShares.rows[0].count);
    const kills = parseInt(totalKills.rows[0].count);
    const games = parseInt(totalGames.rows[0].count);
    const uniqueSessions = parseInt(sessions.rows[0].count);

    // K-factor = (shares per session) x (referred joins / total link clicks)
    const sharesPerSession = uniqueSessions > 0 ? (shares / uniqueSessions).toFixed(2) : '0';
    const conversionRate = shares > 0 ? (referred / shares).toFixed(2) : '0';
    const kFactor = uniqueSessions > 0 && shares > 0
      ? ((shares / uniqueSessions) * (referred / shares)).toFixed(3)
      : '0';

    res.send(`<!DOCTYPE html>
<html><head><title>Pudge Wars Analytics</title>
<style>
  body { font-family: system-ui; max-width: 800px; margin: 40px auto; padding: 0 20px; background: #1a1a2e; color: #eee; }
  h1 { color: #ffd93d; }
  .stat { display: inline-block; background: #16213e; padding: 16px 24px; margin: 8px; border-radius: 12px; min-width: 150px; }
  .stat .value { font-size: 36px; font-weight: bold; color: #ffd93d; }
  .stat .label { font-size: 14px; color: #aaa; }
  .kfactor { font-size: 48px; color: #7ecfb0; font-weight: bold; }
</style></head>
<body>
  <h1>\u{1F3A3} \u52FE\u80A5\u5927\u6230 Analytics</h1>
  <div class="kfactor">K-factor: ${kFactor}</div>
  <p>Shares/session: ${sharesPerSession} \u00D7 Conversion: ${conversionRate}</p>
  <hr>
  <div class="stat"><div class="value">${joins}</div><div class="label">Total Joins</div></div>
  <div class="stat"><div class="value">${referred}</div><div class="label">Referred Joins</div></div>
  <div class="stat"><div class="value">${shares}</div><div class="label">Share Clicks</div></div>
  <div class="stat"><div class="value">${kills}</div><div class="label">Total Kills</div></div>
  <div class="stat"><div class="value">${games}</div><div class="label">Games Started</div></div>
  <div class="stat"><div class="value">${uniqueSessions}</div><div class="label">Unique Sessions</div></div>
  <hr><p>Updated: ${new Date().toISOString()}</p>
</body></html>`);
  } catch (err) {
    res.status(500).send('<h1>Dashboard error</h1><pre>' + (err as Error).message + '</pre>');
  }
});

// Serve client static files in production
const clientDist = path.resolve(__dirname, "../../client/dist");
app.use(express.static(clientDist));
app.get("*", (_req, res, next) => {
  // Let Colyseus handle WebSocket upgrade paths
  if (_req.headers.upgrade) return next();
  res.sendFile(path.join(clientDist, "index.html"));
});

const server = http.createServer(app);
const port = Number(process.env.PORT) || 3000;

const gameServer = new Server({
  transport: new WebSocketTransport({ server }),
});

// Register game room
gameServer.define("pudge", PudgeRoom);

initAnalytics().then(() => {
  gameServer.listen(port).then(() => {
    console.log(`🎣 Pudge Wars server running on port ${port}`);
  });
});
