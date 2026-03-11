import { Client, Room } from "colyseus.js";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "ws://localhost:3000";

let client: Client;
let room: Room | null = null;

export function getClient(): Client {
  if (!client) {
    client = new Client(SERVER_URL);
  }
  return client;
}

export function getRoom(): Room | null {
  return room;
}

export function setRoom(r: Room) {
  room = r;
}

export async function createRoom(nickname: string): Promise<Room> {
  const c = getClient();
  const r = await c.create("pudge", { nickname });
  room = r;
  return r;
}

export async function joinRoom(roomCode: string, nickname: string): Promise<Room> {
  const c = getClient();
  const r = await c.joinById(roomCode, { nickname });
  room = r;
  return r;
}

export function sendInput(input: {
  dx: number;
  dy: number;
  aimX: number;
  aimY: number;
  hook: boolean;
}) {
  if (room) {
    room.send("input", input);
  }
}

export function sendStart() {
  if (room) {
    room.send("start");
  }
}

export function sendRestart() {
  if (room) {
    room.send("restart");
  }
}
