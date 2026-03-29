// === Map ===
export const MAP_WIDTH = 1200;
export const MAP_HEIGHT = 800;
export const RIVER_WIDTH = 120;
export const RIVER_X = (MAP_WIDTH - RIVER_WIDTH) / 2; // river left edge

// === Player ===
export const PLAYER_RADIUS = 20;
export const PLAYER_SPEED = 160; // pixels per second
export const PLAYER_MAX_HP = 100;
export const RESPAWN_TIME = 3000; // ms

// === Hook ===
export const HOOK_SPEED = 600; // pixels per second
export const HOOK_RADIUS = 8;
export const HOOK_MAX_RANGE = 500; // max distance hook can travel
export const HOOK_COOLDOWN = 4000; // ms
export const HOOK_PULL_SPEED = 400; // pixels per second when pulling target
export const HOOK_DAMAGE = 100; // instant kill on pull

// === Game ===
export const TICK_RATE = 20; // server updates per second
export const KILLS_TO_WIN = 10;
export const MAX_PLAYERS_PER_TEAM = 3;
export const MAX_PLAYERS = MAX_PLAYERS_PER_TEAM * 2;

// === Teams ===
export const TEAM_LEFT = 0;
export const TEAM_RIGHT = 1;

// === Spawn positions (center Y, spread vertically) ===
export const SPAWN_X_LEFT = 100;
export const SPAWN_X_RIGHT = MAP_WIDTH - 100;
export const SPAWN_Y_OFFSETS = [-100, 0, 100]; // for 3 players

// === Runes ===
export const RUNE_SPAWN_INTERVAL = 60000;  // 60 seconds
export const RUNE_FIRST_SPAWN = 120000;    // first 2 minutes no runes
export const RUNE_PICKUP_RADIUS = 30;
export type RuneType = 'haste' | 'dd' | 'regen' | 'invis';
export const RUNE_TYPES: RuneType[] = ['haste', 'dd', 'regen', 'invis'];
export const RUNE_POSITIONS = [
  { x: MAP_WIDTH / 2, y: 80 },
  { x: MAP_WIDTH / 2, y: MAP_HEIGHT - 80 },
];
export const RUNE_EFFECTS: Record<RuneType, { duration: number; description: string }> = {
  haste: { duration: 10000, description: '移動速度 +50%' },
  dd: { duration: 15000, description: 'Hook 傷害 x2' },
  regen: { duration: 8000, description: '持續回血 50 HP/s' },
  invis: { duration: 10000, description: '隱身' },
};

// === Leveling ===
export const EXP_PER_KILL = 100;
export const EXP_PER_ASSIST = 40;
export const MAX_LEVEL = 20;
export const EXP_PER_LEVEL = 100; // needed = EXP_PER_LEVEL * currentLevel
export const HP_PER_LEVEL = 10;
export const SPEED_PER_LEVEL = 2;
export const HOOK_DAMAGE_PER_LEVEL = 5;
export const HOOK_RANGE_LEVEL_BONUSES = [5, 10, 15, 20]; // +50 range at these levels

// === Consumables ===
export interface ConsumableDef {
  id: string;
  name: string;
  description: string;
  cost: number;
  icon: string;
}

export const CONSUMABLES: ConsumableDef[] = [
  { id: 'salve', name: '治療藥膏', description: '恢復 200 HP (10秒)', cost: 50, icon: '💊' },
  { id: 'potion', name: '大補藥', description: '即時恢復 300 HP', cost: 100, icon: '🧪' },
  { id: 'tome_exp', name: '智慧之書', description: '立即升 1 級', cost: 200, icon: '📗' },
  { id: 'tome_damage', name: '力量之書', description: '永久 +25 傷害', cost: 150, icon: '📕' },
  { id: 'tome_hp', name: '體質之書', description: '永久 +100 HP', cost: 150, icon: '📘' },
];

// === Colors (Animal Crossing pastel palette) ===
export const COLORS = {
  // Team colors
  teamLeft: 0x7ecfb0,   // mint green
  teamRight: 0xf6a6b2,  // soft pink
  // Map
  grass: 0x8fce6a,      // bright grass green
  grassDark: 0x7abc5a,  // darker grass for pattern
  river: 0x6cc4e8,      // cheerful blue
  riverDeep: 0x52b0d8,  // deeper blue
  bridge: 0xd4a56a,     // wood brown
  // UI
  hpBar: 0xff6b6b,      // health red
  hpBarBg: 0x3a3a3a,    // health bg
  cooldownReady: 0xffd93d, // golden yellow
  cooldownNotReady: 0x888888,
  // Hook
  hookChain: 0xc0c0c0,  // silver chain
  hookHead: 0xe8d44d,   // golden hook tip
};
