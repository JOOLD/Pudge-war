export enum GamePhase {
  WAITING = "waiting",
  PLAYING = "playing",
  FINISHED = "finished",
}

export interface InputMessage {
  dx: number;
  dy: number;
  aimX: number;
  aimY: number;
  hook: boolean;
}
