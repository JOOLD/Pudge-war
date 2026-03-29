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

// === Ability Shop ===
export interface AbilityDef {
  id: string;
  name: string;
  description: string;
  cost: number;
  icon: string;
  key: string;
}

export const ABILITY_SHOP: AbilityDef[] = [
  { id: 'rot', name: '腐爛', description: 'AOE 毒霧，傷害周圍敵人和自己', cost: 200, icon: '☠️', key: 'W' },
  { id: 'phase', name: '相位轉移', description: '短暫無敵，躲避鉤子', cost: 300, icon: '✨', key: 'E' },
];

// === Hook Modifiers ===
export type HookModifier = 'none' | 'flame' | 'freeze' | 'lifesteal' | 'rupture';

export interface HookModDef {
  id: HookModifier;
  name: string;
  description: string;
  cost: number;
  icon: string;
}

export const HOOK_MODIFIERS: HookModDef[] = [
  { id: 'flame', name: '火焰鉤', description: '命中後燃燒 20 dmg/s 持續 3s', cost: 400, icon: '🔥' },
  { id: 'freeze', name: '冰凍鉤', description: '命中後減速 50% 持續 3s', cost: 350, icon: '🧊' },
  { id: 'lifesteal', name: '吸血鉤', description: '命中傷害的 30% 回血', cost: 300, icon: '💉' },
  { id: 'rupture', name: '裂傷鉤', description: '拉動距離越遠傷害越高', cost: 350, icon: '💔' },
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
