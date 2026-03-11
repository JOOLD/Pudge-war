export enum GamePhase {
  WAITING = "waiting",
  PLAYING = "playing",
  FINISHED = "finished",
}

export enum HookState {
  IDLE = "idle",
  FLYING = "flying",
  HIT = "hit",       // hit a player, pulling them
  RETURNING = "returning", // missed, returning to owner
}

export interface Vec2 {
  x: number;
  y: number;
}

// Messages: Client -> Server
export interface InputMessage {
  dx: number;  // -1, 0, or 1 (horizontal)
  dy: number;  // -1, 0, or 1 (vertical)
  aimX: number; // mouse world X
  aimY: number; // mouse world Y
  hook: boolean; // wants to throw hook
}

export interface JoinOptions {
  nickname: string;
  roomCode?: string;
}

// Server -> Client messages
export interface KillFeedEntry {
  killerName: string;
  victimName: string;
  timestamp: number;
}

export interface GameOverData {
  winningTeam: number;
  leftScore: number;
  rightScore: number;
}
