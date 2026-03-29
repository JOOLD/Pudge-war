// === Map ===
export const MAP_WIDTH = 1200;
export const MAP_HEIGHT = 800;
export const RIVER_WIDTH = 120;
export const RIVER_X = (MAP_WIDTH - RIVER_WIDTH) / 2; // river left edge

// === Player ===
export const PLAYER_RADIUS = 20;
export const PLAYER_SPEED = 160; // pixels per second
export const PLAYER_MAX_HP = 500;
export const RESPAWN_TIME = 5000; // ms (longer respawn with HP system)

// === Hook ===
export const HOOK_SPEED = 600; // pixels per second
export const HOOK_RADIUS = 8;
export const HOOK_MAX_RANGE = 500; // max distance hook can travel
export const HOOK_COOLDOWN = 6000; // ms (longer CD, more abilities now)
export const HOOK_PULL_SPEED = 400; // pixels per second when pulling target
export const HOOK_DAMAGE = 150; // damage on pull (not instant kill)
export const HOOK_STUN_DURATION = 500; // 0.5 sec stun after pull arrival

// === Healing ===
export const SPAWN_HEAL_RADIUS = 100; // heal zone around spawn
export const SPAWN_HEAL_RATE = 20; // HP per second in spawn zone

// === Rot Skill ===
export const ROT_RADIUS = 80;
export const ROT_DAMAGE = 30; // damage per second to enemies
export const ROT_SELF_DAMAGE = 10; // damage per second to self

// === Phase Shift Skill ===
export const PHASE_DURATION = 1000; // 1 second
export const PHASE_COOLDOWN = 12000; // 12 seconds

// === Dismember Skill ===
export const DISMEMBER_RANGE = 40; // must be within this distance
export const DISMEMBER_DAMAGE = 80; // damage per second
export const DISMEMBER_DURATION = 2000; // 2 seconds
export const DISMEMBER_COOLDOWN = 10000;

// === Gold ===
export const GOLD_PER_KILL = 100;
export const GOLD_PER_ASSIST = 50;
export const GOLD_PASSIVE_RATE = 5; // per second
export const ASSIST_WINDOW = 10000; // 10 seconds

// === Game ===
export const TICK_RATE = 20; // server updates per second
export const KILLS_TO_WIN = 15; // games take longer now
export const MAX_PLAYERS_PER_TEAM = 3;
export const MAX_PLAYERS = MAX_PLAYERS_PER_TEAM * 2;

// === Teams ===
export const TEAM_LEFT = 0;
export const TEAM_RIGHT = 1;

// === Spawn positions (center Y, spread vertically) ===
export const SPAWN_X_LEFT = 100;
export const SPAWN_X_RIGHT = MAP_WIDTH - 100;
export const SPAWN_Y_OFFSETS = [-100, 0, 100]; // for 3 players

// === Obstacles ===
export type ObstacleType = 'tree' | 'rock';

export interface ObstacleDef {
  x: number;
  y: number;
  radius: number;
  type: ObstacleType;
}

// Trees: block hooks, NOT players (players walk through)
// Rocks: block BOTH hooks AND players
// Placed symmetrically on both sides of river
export const OBSTACLES: ObstacleDef[] = [
  // Left side trees (3)
  { x: 180, y: 150, radius: 25, type: 'tree' },
  { x: 250, y: 400, radius: 25, type: 'tree' },
  { x: 150, y: 650, radius: 25, type: 'tree' },
  // Right side trees (3, mirrored)
  { x: 1020, y: 150, radius: 25, type: 'tree' },
  { x: 950, y: 400, radius: 25, type: 'tree' },
  { x: 1050, y: 650, radius: 25, type: 'tree' },
  // Left side rocks (2)
  { x: 350, y: 250, radius: 30, type: 'rock' },
  { x: 300, y: 580, radius: 30, type: 'rock' },
  // Right side rocks (2, mirrored)
  { x: 850, y: 250, radius: 30, type: 'rock' },
  { x: 900, y: 580, radius: 30, type: 'rock' },
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

// === Gold ===
export const GOLD_PER_KILL = 100;
export const GOLD_PER_ASSIST = 50;
export const GOLD_PASSIVE_RATE = 5; // gold per second
export const ASSIST_WINDOW = 10000; // ms

// === Rot ===
export const ROT_DAMAGE = 30; // damage per second
export const ROT_RADIUS = 120;
export const ROT_SELF_DAMAGE = 15; // damage per second to self
export const ROT_COOLDOWN = 0; // toggle, no cooldown

// === Phase ===
export const PHASE_DURATION = 2000; // ms
export const PHASE_COOLDOWN = 12000; // ms
export const PHASE_SPEED_MULT = 1.5;

// === Dismember ===
export const DISMEMBER_DAMAGE = 80; // damage per second
export const DISMEMBER_DURATION = 3000; // ms
export const DISMEMBER_COOLDOWN = 30000; // ms
export const DISMEMBER_RANGE = 150; // must be close

// === Spawn healing ===
export const SPAWN_HEAL_RADIUS = 150;
export const SPAWN_HEAL_RATE = 20; // hp per second

// === Upgrades ===
export interface UpgradeDef {
  id: string;
  name: string;
  description: string;
  baseCost: number;
  maxLevel: number;
  costMultiplier: number; // price increases by this factor per level
}

export const UPGRADES: UpgradeDef[] = [
  // Hook upgrades
  { id: 'hook_range', name: '射程強化', description: '射程 +50', baseCost: 100, maxLevel: 3, costMultiplier: 1.5 },
  { id: 'hook_speed', name: '鉤速強化', description: '速度 +100', baseCost: 100, maxLevel: 3, costMultiplier: 1.5 },
  { id: 'hook_cooldown', name: '冷卻縮減', description: '冷卻 -1秒', baseCost: 150, maxLevel: 3, costMultiplier: 1.5 },
  // Rot upgrades
  { id: 'rot_damage', name: '腐蝕強化', description: '傷害 +10/s', baseCost: 100, maxLevel: 3, costMultiplier: 1.5 },
  { id: 'rot_radius', name: '腐蝕範圍', description: '範圍 +20', baseCost: 120, maxLevel: 3, costMultiplier: 1.5 },
  // Phase upgrades
  { id: 'phase_duration', name: '相位延長', description: '持續 +0.5秒', baseCost: 100, maxLevel: 3, costMultiplier: 1.5 },
  { id: 'phase_cooldown', name: '相位冷卻', description: '冷卻 -2秒', baseCost: 150, maxLevel: 3, costMultiplier: 1.5 },
  // Dismember upgrades
  { id: 'dismember_damage', name: '肢解強化', description: '傷害 +20/s', baseCost: 120, maxLevel: 3, costMultiplier: 1.5 },
  { id: 'dismember_duration', name: '肢解延長', description: '持續 +0.5秒', baseCost: 150, maxLevel: 3, costMultiplier: 1.5 },
  // Defense upgrades
  { id: 'hp_max', name: '生命強化', description: 'HP +100', baseCost: 100, maxLevel: 3, costMultiplier: 1.5 },
  { id: 'hp_regen', name: '恢復強化', description: '恢復 +5/s', baseCost: 120, maxLevel: 3, costMultiplier: 1.5 },
  { id: 'move_speed', name: '速度強化', description: '移動 +20', baseCost: 100, maxLevel: 3, costMultiplier: 1.5 },
];
