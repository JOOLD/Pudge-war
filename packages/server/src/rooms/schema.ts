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
  @type("number") bounces: number = 0;
  @type("number") prevX: number = 0;
  @type("number") prevY: number = 0;
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

  // Gold & assists
  @type("number") gold: number = 0;
  @type("number") assists: number = 0;

  // Stun state (from hook)
  @type("number") stunTimer: number = 0;

  // Rot state
  @type("boolean") rotActive: boolean = false;
  @type("number") rotCooldown: number = 0;

  // Phase state
  @type("boolean") phaseActive: boolean = false;
  @type("number") phaseTimer: number = 0;
  @type("number") phaseCooldown: number = 0;

  // Dismember state
  @type("boolean") dismemberActive: boolean = false;
  @type("number") dismemberTimer: number = 0;
  @type("number") dismemberCooldown: number = 0;
  @type("string") dismemberTargetId: string = "";

  // Upgrade levels
  @type("number") upgradeHookRange: number = 0;
  @type("number") upgradeHookSpeed: number = 0;
  @type("number") upgradeHookCooldown: number = 0;
  @type("number") upgradeRotDamage: number = 0;
  @type("number") upgradeRotRadius: number = 0;
  @type("number") upgradePhaseDuration: number = 0;
  @type("number") upgradePhaseCooldown: number = 0;
  @type("number") upgradeDismemberDamage: number = 0;
  @type("number") upgradeDismemberDuration: number = 0;
  @type("number") upgradeHpMax: number = 0;
  @type("number") upgradeHpRegen: number = 0;
  @type("number") upgradeMoveSpeed: number = 0;

  // Rune system
  @type("string") activeRune: string = "";
  @type("number") runeTimer: number = 0;
  @type("boolean") invisible: boolean = false;

  // Level system
  @type("number") level: number = 1;
  @type("number") exp: number = 0;
  @type("number") expToNext: number = 100; // EXP_PER_LEVEL * level

  // Consumables (Lane B additions)
  @type("number") healOverTime: number = 0;   // remaining heal from salve
  @type("number") bonusDamage: number = 0;     // permanent from tomes
  @type("number") bonusMaxHp: number = 0;      // permanent from tomes
  @type("number") maxHp: number = 500;         // effective max HP (synced to client)

  // Skill purchase state (Lane C)
  @type("boolean") hasRot: boolean = false;
  @type("boolean") hasPhase: boolean = false;
  @type("string") hookModifier: string = "none";

  // Hook modifier effect timers (Lane C)
  @type("number") burnTimer: number = 0;
  @type("number") burnDamage: number = 0;
  @type("number") slowTimer: number = 0;
  @type("number") slowPercent: number = 0;
}

export class GameState extends Schema {
  @type({ map: PlayerSchema }) players = new MapSchema<PlayerSchema>();
  @type([RuneSchema]) runes = new ArraySchema<RuneSchema>();
  @type("string") phase: string = "waiting"; // waiting | playing | finished
  @type("number") leftScore: number = 0;
  @type("number") rightScore: number = 0;
  @type("number") winningTeam: number = -1;
  @type("string") roomCode: string = "";
  @type("number") gameTime: number = 0; // elapsed time in ms
}
