// ==============================
// Pudge Wars — Phase 1 Constants
// ==============================

// === Map ===
export const MAP_WIDTH = 1200;
export const MAP_HEIGHT = 800;
export const RIVER_WIDTH = 120;
export const RIVER_X = (MAP_WIDTH - RIVER_WIDTH) / 2;

// === Player ===
export const PLAYER_RADIUS = 20;
export const PLAYER_SPEED = 160;
export const PLAYER_MAX_HP = 100; // one hook = one kill (classic Pudge Wars)
export const RESPAWN_TIME = 3000;

// === Hook ===
export const HOOK_SPEED = 600;
export const HOOK_RADIUS = 8;
export const HOOK_MAX_RANGE = 500;
export const HOOK_COOLDOWN = 4000;
export const HOOK_PULL_SPEED = 400;
export const HOOK_DAMAGE = 100; // instant kill
export const HOOK_MAX_BOUNCES = 3;

// === Game ===
export const TICK_RATE = 20;
export const KILLS_TO_WIN = 10;
export const MAX_PLAYERS_PER_TEAM = 3;
export const MAX_PLAYERS = MAX_PLAYERS_PER_TEAM * 2;

// === Teams ===
export const TEAM_LEFT = 0;
export const TEAM_RIGHT = 1;

// === Spawn ===
export const SPAWN_X_LEFT = 100;
export const SPAWN_X_RIGHT = MAP_WIDTH - 100;
export const SPAWN_Y_OFFSETS = [-100, 0, 100];

// === Colors ===
export const COLORS = {
  teamLeft: 0x4488cc,
  teamRight: 0xcc4444,
  grass: 0x3a7a2a,
  grassDark: 0x2d6620,
  river: 0x2277bb,
  riverDeep: 0x1a5588,
  hookChain: 0xc0c0c0,
  hookHead: 0xe8d44d,
  hpBarBg: 0x333333,
};
