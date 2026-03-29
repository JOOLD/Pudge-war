import { Client, Room } from "colyseus.js";

function getServerUrl(): string {
  if (import.meta.env.VITE_SERVER_URL) return import.meta.env.VITE_SERVER_URL;
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}`;
}

let client: Client;
let room: Room | null = null;

function getClient(): Client {
  if (!client) client = new Client(getServerUrl());
  return client;
}

export function getRoom(): Room | null { return room; }

export async function createRoom(nickname: string): Promise<Room> {
  const r = await getClient().create("pudge", { nickname });
  room = r;
  return r;
}

export async function joinRoom(roomCode: string, nickname: string): Promise<Room> {
  const r = await getClient().join("pudge", { roomCode, nickname });
  room = r;
  return r;
}

function isConnected(): boolean {
  if (!room) return false;
  try {
    const ws = (room as any).connection?.ws;
    return !ws || ws.readyState === WebSocket.OPEN;
  } catch { return false; }
}

export function sendInput(input: { dx: number; dy: number; aimX: number; aimY: number; hook: boolean }) {
  if (room && isConnected()) room.send("input", input);
}

export function sendStart() { if (room && isConnected()) room.send("start"); }
export function sendRestart() { if (room && isConnected()) room.send("restart"); }
