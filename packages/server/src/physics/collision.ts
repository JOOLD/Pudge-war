import {
  MAP_WIDTH, MAP_HEIGHT, PLAYER_RADIUS, RIVER_X, RIVER_WIDTH,
  HOOK_RADIUS, HOOK_MAX_RANGE, HOOK_SPEED, HOOK_PULL_SPEED,
  PLAYER_SPEED, TEAM_LEFT, TEAM_RIGHT, HOOK_MAX_BOUNCES,
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

// ─── Hook Movement with Wall Bounce ───────────────────────────────────────────

export interface MoveHookResult {
  x: number;
  y: number;
  dirX: number;
  dirY: number;
  outOfRange: boolean;
  bounced: boolean;
  newBounces: number;
}

// Update hook position (flying state) with wall bouncing
export function moveHook(
  hx: number, hy: number, dirX: number, dirY: number,
  startX: number, startY: number, dt: number,
  bounces: number
): MoveHookResult {
  let newX = hx + dirX * HOOK_SPEED * dt;
  let newY = hy + dirY * HOOK_SPEED * dt;
  let newDirX = dirX;
  let newDirY = dirY;
  let bounced = false;
  let newBounces = bounces;

  // Check map boundary bouncing
  if (newBounces < HOOK_MAX_BOUNCES) {
    // Left/right walls
    if (newX - HOOK_RADIUS <= 0) {
      newX = HOOK_RADIUS;
      newDirX = Math.abs(newDirX); // Reflect X
      bounced = true;
      newBounces++;
    } else if (newX + HOOK_RADIUS >= MAP_WIDTH) {
      newX = MAP_WIDTH - HOOK_RADIUS;
      newDirX = -Math.abs(newDirX);
      bounced = true;
      newBounces++;
    }

    // Top/bottom walls
    if (newY - HOOK_RADIUS <= 0) {
      newY = HOOK_RADIUS;
      newDirY = Math.abs(newDirY);
      bounced = true;
      newBounces++;
    } else if (newY + HOOK_RADIUS >= MAP_HEIGHT) {
      newY = MAP_HEIGHT - HOOK_RADIUS;
      newDirY = -Math.abs(newDirY);
      bounced = true;
      newBounces++;
    }
  }

  const dist = distance({ x: newX, y: newY }, { x: startX, y: startY });

  return {
    x: newX, y: newY,
    dirX: newDirX, dirY: newDirY,
    outOfRange: dist >= HOOK_MAX_RANGE && !bounced,
    bounced,
    newBounces,
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

// ─── Headshot Detection ───────────────────────────────────────────────────────

export interface FlyingHook {
  ownerId: string;
  ownerTeam: number;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
}

// Check if two line segments intersect, return intersection point
export function segmentsIntersect(
  ax1: number, ay1: number, ax2: number, ay2: number,
  bx1: number, by1: number, bx2: number, by2: number
): { intersects: boolean; x: number; y: number } {
  const d = (ax2 - ax1) * (by2 - by1) - (ay2 - ay1) * (bx2 - bx1);
  if (Math.abs(d) < 0.001) return { intersects: false, x: 0, y: 0 };

  const t = ((bx1 - ax1) * (by2 - by1) - (by1 - ay1) * (bx2 - bx1)) / d;
  const u = -((ax2 - ax1) * (by1 - ay1) - (ay2 - ay1) * (bx1 - ax1)) / d;

  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
      intersects: true,
      x: ax1 + t * (ax2 - ax1),
      y: ay1 + t * (ay2 - ay1),
    };
  }
  return { intersects: false, x: 0, y: 0 };
}

export function checkHeadshots(
  hooks: FlyingHook[],
  players: Array<{ id: string; x: number; y: number; team: number; alive: boolean }>
): Array<{ victimId: string; x: number; y: number }> {
  const results: Array<{ victimId: string; x: number; y: number }> = [];

  // Check each pair of flying hooks from different teams
  for (let i = 0; i < hooks.length; i++) {
    for (let j = i + 1; j < hooks.length; j++) {
      if (hooks[i].ownerTeam === hooks[j].ownerTeam) continue;

      // Check if the two hook paths (line segments from prev to current position) intersect
      const intersection = segmentsIntersect(
        hooks[i].prevX, hooks[i].prevY, hooks[i].x, hooks[i].y,
        hooks[j].prevX, hooks[j].prevY, hooks[j].x, hooks[j].y
      );

      if (intersection.intersects) {
        // Check if any player is near the intersection point
        for (const player of players) {
          if (!player.alive) continue;
          if (player.id === hooks[i].ownerId || player.id === hooks[j].ownerId) continue;

          const dist = distance(
            { x: player.x, y: player.y },
            { x: intersection.x, y: intersection.y }
          );

          if (dist < PLAYER_RADIUS * 3) { // generous hitbox for headshot
            results.push({ victimId: player.id, x: intersection.x, y: intersection.y });
          }
        }
      }
    }
  }

  return results;
}
