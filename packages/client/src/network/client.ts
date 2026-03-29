import { Client, Room } from "colyseus.js";

// In production (same-origin deploy), derive WS URL from current page location
function getServerUrl(): string {
  if (import.meta.env.VITE_SERVER_URL) {
    return import.meta.env.VITE_SERVER_URL;
  }
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}`;
}

const SERVER_URL = getServerUrl();
const RECONNECT_RETRIES = 3;
const RECONNECT_BACKOFF_MS = 2000;
const SESSION_KEY_TOKEN = "pudge_reconnection_token";
const SESSION_KEY_ROOM_ID = "pudge_room_id";

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
  // Store reconnection token for auto-reconnect
  storeReconnectionToken(r);
}

export async function createRoom(nickname: string): Promise<Room> {
  const c = getClient();
  const r = await c.create("pudge", { nickname });
  room = r;
  storeReconnectionToken(r);
  return r;
}

export async function joinRoom(roomCode: string, nickname: string, ref?: string): Promise<Room> {
  const c = getClient();
  const opts: Record<string, string> = { nickname };
  if (ref) opts.ref = ref;
  const r = await c.joinById(roomCode, opts);
  room = r;
  storeReconnectionToken(r);
  return r;
}

/** Store reconnection token and room id in sessionStorage */
function storeReconnectionToken(r: Room) {
  try {
    if (r.reconnectionToken) {
      sessionStorage.setItem(SESSION_KEY_TOKEN, r.reconnectionToken);
      sessionStorage.setItem(SESSION_KEY_ROOM_ID, r.id);
    }
  } catch {
    // sessionStorage may be unavailable in some contexts
  }
}

/** Get saved reconnection token */
export function getReconnectionToken(): string | null {
  try {
    return sessionStorage.getItem(SESSION_KEY_TOKEN);
  } catch {
    return null;
  }
}

/** Clear saved reconnection data */
export function clearReconnectionToken() {
  try {
    sessionStorage.removeItem(SESSION_KEY_TOKEN);
    sessionStorage.removeItem(SESSION_KEY_ROOM_ID);
  } catch {
    // ignore
  }
}

/** Get saved room id for reconnection */
export function getSavedRoomId(): string | null {
  try {
    return sessionStorage.getItem(SESSION_KEY_ROOM_ID);
  } catch {
    return null;
  }
}

/**
 * Attempt to reconnect to the room using saved token.
 * Retries up to RECONNECT_RETRIES times with RECONNECT_BACKOFF_MS delay.
 * Returns the new Room on success, or null on failure.
 */
export async function attemptReconnect(): Promise<Room | null> {
  const token = getReconnectionToken();
  if (!token) return null;

  const c = getClient();

  for (let attempt = 1; attempt <= RECONNECT_RETRIES; attempt++) {
    try {
      const r = await c.reconnect(token);
      room = r;
      storeReconnectionToken(r);
      return r;
    } catch (e) {
      console.warn(`Reconnect attempt ${attempt}/${RECONNECT_RETRIES} failed:`, e);
      if (attempt < RECONNECT_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, RECONNECT_BACKOFF_MS));
      }
    }
  }

  // All retries failed
  clearReconnectionToken();
  return null;
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

export function sendBuy(upgradeId: string) {
  if (room) {
    room.send("buy", { upgradeId });
  }
}
