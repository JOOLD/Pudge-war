import { Schema, type, MapSchema } from "@colyseus/schema";

export class HookSchema extends Schema {
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") dirX: number = 0;
  @type("number") dirY: number = 0;
  @type("string") state: string = "idle";
  @type("string") targetId: string = "";
  @type("number") startX: number = 0;
  @type("number") startY: number = 0;
  @type("number") bounces: number = 0;
}

export class PlayerSchema extends Schema {
  @type("string") id: string = "";
  @type("string") nickname: string = "";
  @type("number") team: number = 0;
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") hp: number = 100;
  @type("boolean") alive: boolean = true;
  @type("number") kills: number = 0;
  @type("number") deaths: number = 0;
  @type("number") aimX: number = 0;
  @type("number") aimY: number = 0;
  @type(HookSchema) hook: HookSchema = new HookSchema();
  @type("number") hookCooldown: number = 0;
  @type("number") respawnTimer: number = 0;
  @type("number") spawnIndex: number = 0;
}

export class GameState extends Schema {
  @type({ map: PlayerSchema }) players = new MapSchema<PlayerSchema>();
  @type("string") phase: string = "waiting";
  @type("number") leftScore: number = 0;
  @type("number") rightScore: number = 0;
  @type("number") winningTeam: number = -1;
  @type("string") roomCode: string = "";
}
