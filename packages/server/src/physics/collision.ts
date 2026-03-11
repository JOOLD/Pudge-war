import {
  MAP_WIDTH, MAP_HEIGHT, PLAYER_RADIUS, RIVER_X, RIVER_WIDTH,
  HOOK_RADIUS, HOOK_MAX_RANGE, HOOK_SPEED, HOOK_PULL_SPEED,
  PLAYER_SPEED, TEAM_LEFT, TEAM_RIGHT,
} from "shared";

export interface Vec2 {
  x: number;
  y: number;
}

export function distance(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function normalize(v: Vec2): Vec2 {
  const len = Math.sqrt(v.x * v.x + v.y * v.y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

export function circleCollision(a: Vec2, aR: number, b: Vec2, bR: number): boolean {
  return distance(a, b) < aR + bR;
}

// Check if a point is in the river (impassable for players)
export function isInRiver(x: number): boolean {
  return x > RIVER_X && x < RIVER_X + RIVER_WIDTH;
}

// Clamp player position to their side of the river
export function clampPlayerPosition(x: number, y: number, team: number): Vec2 {
  const r = PLAYER_RADIUS;
  let cx = x;
  let cy = y;

  // Clamp to map bounds
  cy = Math.max(r, Math.min(MAP_HEIGHT - r, cy));
  cx = Math.max(r, Math.min(MAP_WIDTH - r, cx));

  // Clamp to own side of river
  if (team === TEAM_LEFT) {
    cx = Math.min(cx, RIVER_X - r);
  } else {
    cx = Math.max(cx, RIVER_X + RIVER_WIDTH + r);
  }

  return { x: cx, y: cy };
}

// Move player with delta time
export function movePlayer(
  x: number, y: number, dx: number, dy: number,
  team: number, dt: number
): Vec2 {
  // Normalize diagonal movement
  let len = Math.sqrt(dx * dx + dy * dy);
  if (len > 0) {
    dx /= len;
    dy /= len;
  }

  const newX = x + dx * PLAYER_SPEED * dt;
  const newY = y + dy * PLAYER_SPEED * dt;

  return clampPlayerPosition(newX, newY, team);
}

// Update hook position (flying state)
export function moveHook(
  hx: number, hy: number, dirX: number, dirY: number,
  startX: number, startY: number, dt: number
): { x: number; y: number; outOfRange: boolean } {
  const newX = hx + dirX * HOOK_SPEED * dt;
  const newY = hy + dirY * HOOK_SPEED * dt;
  const dist = distance({ x: newX, y: newY }, { x: startX, y: startY });

  return {
    x: newX,
    y: newY,
    outOfRange: dist >= HOOK_MAX_RANGE,
  };
}

// Pull hooked target toward hook owner
export function pullTarget(
  targetX: number, targetY: number,
  ownerX: number, ownerY: number,
  dt: number
): { x: number; y: number; arrived: boolean } {
  const dx = ownerX - targetX;
  const dy = ownerY - targetY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < PLAYER_RADIUS * 2) {
    return { x: targetX, y: targetY, arrived: true };
  }

  const dir = normalize({ x: dx, y: dy });
  return {
    x: targetX + dir.x * HOOK_PULL_SPEED * dt,
    y: targetY + dir.y * HOOK_PULL_SPEED * dt,
    arrived: false,
  };
}

// Return hook to owner
export function returnHook(
  hx: number, hy: number,
  ownerX: number, ownerY: number,
  dt: number
): { x: number; y: number; arrived: boolean } {
  const dx = ownerX - hx;
  const dy = ownerY - hy;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < PLAYER_RADIUS) {
    return { x: ownerX, y: ownerY, arrived: true };
  }

  const dir = normalize({ x: dx, y: dy });
  return {
    x: hx + dir.x * HOOK_SPEED * dt,
    y: hy + dir.y * HOOK_SPEED * dt,
    arrived: false,
  };
}
