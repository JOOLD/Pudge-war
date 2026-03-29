import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";

export class RuneSchema extends Schema {
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("string") runeType: string = "";
  @type("boolean") active: boolean = false;
}

export class HookSchema extends Schema {
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") dirX: number = 0;
  @type("number") dirY: number = 0;
  @type("string") state: string = "idle"; // idle | flying | hit | returning
  @type("string") targetId: string = ""; // sessionId of hooked player
  @type("number") startX: number = 0;
  @type("number") startY: number = 0;
}

export class PlayerSchema extends Schema {
  @type("string") id: string = "";
  @type("string") nickname: string = "";
  @type("number") team: number = 0; // 0=left, 1=right
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") hp: number = 100;
  @type("boolean") alive: boolean = true;
  @type("number") kills: number = 0;
  @type("number") deaths: number = 0;
  @type("number") aimX: number = 0;
  @type("number") aimY: number = 0;
  @type(HookSchema) hook: HookSchema = new HookSchema();
  @type("number") hookCooldown: number = 0; // ms remaining
  @type("number") respawnTimer: number = 0; // ms remaining
  @type("number") spawnIndex: number = 0;

  // Rune system
  @type("string") activeRune: string = "";
  @type("number") runeTimer: number = 0;
  @type("boolean") invisible: boolean = false;

  // Level system
  @type("number") level: number = 1;
  @type("number") exp: number = 0;
  @type("number") expToNext: number = 100; // EXP_PER_LEVEL * level

  // Consumables
  @type("number") gold: number = 0;
  @type("number") healOverTime: number = 0;   // remaining heal from salve
  @type("number") bonusDamage: number = 0;     // permanent from tomes
  @type("number") bonusMaxHp: number = 0;      // permanent from tomes
}

export class GameState extends Schema {
  @type({ map: PlayerSchema }) players = new MapSchema<PlayerSchema>();
  @type([RuneSchema]) runes = new ArraySchema<RuneSchema>();
  @type("string") phase: string = "waiting"; // waiting | playing | finished
  @type("number") leftScore: number = 0;
  @type("number") rightScore: number = 0;
  @type("number") winningTeam: number = -1;
  @type("string") roomCode: string = "";
  @type("number") gameTime: number = 0; // ms elapsed since game start
}
