import {
  MAP_WIDTH, MAP_HEIGHT, PLAYER_RADIUS,
  RIVER_X, RIVER_WIDTH, HOOK_RADIUS,
  HOOK_MAX_RANGE, HOOK_SPEED, HOOK_PULL_SPEED,
  PLAYER_SPEED, TEAM_LEFT, HOOK_MAX_BOUNCES,
} from "shared";

export interface Vec2 { x: number; y: number; }

export function distance(a: Vec2, b: Vec2): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

export function normalize(v: Vec2): Vec2 {
  const len = Math.sqrt(v.x * v.x + v.y * v.y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

export function circleCollision(a: Vec2, aR: number, b: Vec2, bR: number): boolean {
  return distance(a, b) < aR + bR;
}

export function clampPlayerPosition(x: number, y: number, team: number): Vec2 {
  const r = PLAYER_RADIUS;
  let cx = Math.max(r, Math.min(MAP_WIDTH - r, x));
  let cy = Math.max(r, Math.min(MAP_HEIGHT - r, y));
  if (team === TEAM_LEFT) {
    cx = Math.min(cx, RIVER_X - r);
  } else {
    cx = Math.max(cx, RIVER_X + RIVER_WIDTH + r);
  }
  return { x: cx, y: cy };
}

export function movePlayer(x: number, y: number, dx: number, dy: number, team: number, dt: number): Vec2 {
  let len = Math.sqrt(dx * dx + dy * dy);
  if (len > 0) { dx /= len; dy /= len; }
  return clampPlayerPosition(x + dx * PLAYER_SPEED * dt, y + dy * PLAYER_SPEED * dt, team);
}

// Hook movement with wall bouncing
export function moveHook(
  hx: number, hy: number, dirX: number, dirY: number,
  startX: number, startY: number, dt: number, bounces: number
): { x: number; y: number; dirX: number; dirY: number; outOfRange: boolean; bounced: boolean; newBounces: number } {
  let nx = hx + dirX * HOOK_SPEED * dt;
  let ny = hy + dirY * HOOK_SPEED * dt;
  let ndx = dirX, ndy = dirY;
  let bounced = false;
  let nb = bounces;

  if (nb < HOOK_MAX_BOUNCES) {
    if (nx - HOOK_RADIUS <= 0) { nx = HOOK_RADIUS; ndx = Math.abs(ndx); bounced = true; nb++; }
    else if (nx + HOOK_RADIUS >= MAP_WIDTH) { nx = MAP_WIDTH - HOOK_RADIUS; ndx = -Math.abs(ndx); bounced = true; nb++; }
    if (ny - HOOK_RADIUS <= 0) { ny = HOOK_RADIUS; ndy = Math.abs(ndy); bounced = true; nb++; }
    else if (ny + HOOK_RADIUS >= MAP_HEIGHT) { ny = MAP_HEIGHT - HOOK_RADIUS; ndy = -Math.abs(ndy); bounced = true; nb++; }
  }

  const dist = distance({ x: nx, y: ny }, { x: startX, y: startY });
  return { x: nx, y: ny, dirX: ndx, dirY: ndy, outOfRange: dist >= HOOK_MAX_RANGE && !bounced, bounced, newBounces: nb };
}

export function pullTarget(targetX: number, targetY: number, ownerX: number, ownerY: number, dt: number): { x: number; y: number; arrived: boolean } {
  const dist = distance({ x: targetX, y: targetY }, { x: ownerX, y: ownerY });
  if (dist < PLAYER_RADIUS * 2) return { x: targetX, y: targetY, arrived: true };
  const dir = normalize({ x: ownerX - targetX, y: ownerY - targetY });
  return { x: targetX + dir.x * HOOK_PULL_SPEED * dt, y: targetY + dir.y * HOOK_PULL_SPEED * dt, arrived: false };
}

export function returnHook(hx: number, hy: number, ownerX: number, ownerY: number, dt: number): { x: number; y: number; arrived: boolean } {
  const dist = distance({ x: hx, y: hy }, { x: ownerX, y: ownerY });
  if (dist < PLAYER_RADIUS) return { x: ownerX, y: ownerY, arrived: true };
  const dir = normalize({ x: ownerX - hx, y: ownerY - hy });
  return { x: hx + dir.x * HOOK_SPEED * dt, y: hy + dir.y * HOOK_SPEED * dt, arrived: false };
}
