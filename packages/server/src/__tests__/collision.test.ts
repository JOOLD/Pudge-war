import { describe, it, expect } from 'vitest';
import {
  distance,
  normalize,
  circleCollision,
  isInRiver,
  clampPlayerPosition,
  movePlayer,
  moveHook,
  pullTarget,
  returnHook,
  Vec2,
} from '../physics/collision';
import {
  MAP_WIDTH, MAP_HEIGHT, PLAYER_RADIUS, RIVER_X, RIVER_WIDTH,
  HOOK_MAX_RANGE, HOOK_SPEED, HOOK_PULL_SPEED,
  PLAYER_SPEED, TEAM_LEFT, TEAM_RIGHT,
} from 'shared';

describe('distance', () => {
  it('should compute distance between two known points', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBeCloseTo(5);
  });

  it('should return 0 for the same point', () => {
    expect(distance({ x: 7, y: 13 }, { x: 7, y: 13 })).toBe(0);
  });

  it('should handle negative coordinates', () => {
    expect(distance({ x: -3, y: -4 }, { x: 0, y: 0 })).toBeCloseTo(5);
  });
});

describe('normalize', () => {
  it('should keep a unit vector as unit', () => {
    const v = normalize({ x: 1, y: 0 });
    expect(v.x).toBeCloseTo(1);
    expect(v.y).toBeCloseTo(0);
  });

  it('should normalize a known vector', () => {
    const v = normalize({ x: 3, y: 4 });
    expect(v.x).toBeCloseTo(3 / 5);
    expect(v.y).toBeCloseTo(4 / 5);
    // Length should be 1
    const len = Math.sqrt(v.x * v.x + v.y * v.y);
    expect(len).toBeCloseTo(1);
  });

  it('should return {0,0} for zero vector', () => {
    const v = normalize({ x: 0, y: 0 });
    expect(v.x).toBe(0);
    expect(v.y).toBe(0);
  });
});

describe('circleCollision', () => {
  it('should return true for overlapping circles', () => {
    expect(circleCollision({ x: 0, y: 0 }, 10, { x: 5, y: 0 }, 10)).toBe(true);
  });

  it('should return false for non-overlapping circles', () => {
    expect(circleCollision({ x: 0, y: 0 }, 5, { x: 100, y: 0 }, 5)).toBe(false);
  });

  it('should return false when circles are exactly touching (distance == r1+r2)', () => {
    // distance = 20, r1+r2 = 20 => not strictly less than => false
    expect(circleCollision({ x: 0, y: 0 }, 10, { x: 20, y: 0 }, 10)).toBe(false);
  });

  it('should return true when circles barely overlap', () => {
    // distance = 19.9, r1+r2 = 20
    expect(circleCollision({ x: 0, y: 0 }, 10, { x: 19.9, y: 0 }, 10)).toBe(true);
  });
});

describe('isInRiver', () => {
  it('should return true for a point inside the river', () => {
    const riverCenter = RIVER_X + RIVER_WIDTH / 2;
    expect(isInRiver(riverCenter)).toBe(true);
  });

  it('should return false for a point outside the river (left side)', () => {
    expect(isInRiver(100)).toBe(false);
  });

  it('should return false for a point outside the river (right side)', () => {
    expect(isInRiver(MAP_WIDTH - 100)).toBe(false);
  });

  it('should return false for exactly the left edge (exclusive boundary)', () => {
    // isInRiver uses x > RIVER_X, so exactly RIVER_X is false
    expect(isInRiver(RIVER_X)).toBe(false);
  });

  it('should return false for exactly the right edge (exclusive boundary)', () => {
    // isInRiver uses x < RIVER_X + RIVER_WIDTH, so exactly that value is false
    expect(isInRiver(RIVER_X + RIVER_WIDTH)).toBe(false);
  });
});

describe('clampPlayerPosition', () => {
  it('should clamp left team to the left side of the river', () => {
    // Place a left-team player past the river
    const result = clampPlayerPosition(RIVER_X + 50, MAP_HEIGHT / 2, TEAM_LEFT);
    expect(result.x).toBeLessThanOrEqual(RIVER_X - PLAYER_RADIUS);
  });

  it('should clamp right team to the right side of the river', () => {
    // Place a right-team player before the river
    const result = clampPlayerPosition(RIVER_X - 50, MAP_HEIGHT / 2, TEAM_RIGHT);
    expect(result.x).toBeGreaterThanOrEqual(RIVER_X + RIVER_WIDTH + PLAYER_RADIUS);
  });

  it('should clamp to top map boundary', () => {
    const result = clampPlayerPosition(100, -100, TEAM_LEFT);
    expect(result.y).toBeGreaterThanOrEqual(PLAYER_RADIUS);
  });

  it('should clamp to bottom map boundary', () => {
    const result = clampPlayerPosition(100, MAP_HEIGHT + 100, TEAM_LEFT);
    expect(result.y).toBeLessThanOrEqual(MAP_HEIGHT - PLAYER_RADIUS);
  });

  it('should clamp to left map boundary', () => {
    const result = clampPlayerPosition(-100, MAP_HEIGHT / 2, TEAM_LEFT);
    expect(result.x).toBeGreaterThanOrEqual(PLAYER_RADIUS);
  });

  it('should clamp to right map boundary', () => {
    const result = clampPlayerPosition(MAP_WIDTH + 100, MAP_HEIGHT / 2, TEAM_RIGHT);
    expect(result.x).toBeLessThanOrEqual(MAP_WIDTH - PLAYER_RADIUS);
  });

  it('should not modify a valid position for left team', () => {
    const x = 100;
    const y = MAP_HEIGHT / 2;
    const result = clampPlayerPosition(x, y, TEAM_LEFT);
    expect(result.x).toBeCloseTo(x);
    expect(result.y).toBeCloseTo(y);
  });
});

describe('movePlayer', () => {
  const dt = 1 / 20; // 20 tick rate

  it('should not move with zero input', () => {
    const pos = movePlayer(100, 400, 0, 0, TEAM_LEFT, dt);
    expect(pos.x).toBeCloseTo(100);
    expect(pos.y).toBeCloseTo(400);
  });

  it('should move right by PLAYER_SPEED * dt for dx=1, dy=0', () => {
    const startX = 100;
    const pos = movePlayer(startX, 400, 1, 0, TEAM_LEFT, dt);
    const expected = startX + PLAYER_SPEED * dt;
    // May be clamped, but at x=100 left team should have room
    expect(pos.x).toBeCloseTo(expected);
    expect(pos.y).toBeCloseTo(400);
  });

  it('should move down by PLAYER_SPEED * dt for dx=0, dy=1', () => {
    const startY = 400;
    const pos = movePlayer(100, startY, 0, 1, TEAM_LEFT, dt);
    expect(pos.x).toBeCloseTo(100);
    expect(pos.y).toBeCloseTo(startY + PLAYER_SPEED * dt);
  });

  it('should normalize diagonal movement so magnitude ~= PLAYER_SPEED * dt', () => {
    const startX = 100;
    const startY = 400;
    const pos = movePlayer(startX, startY, 1, 1, TEAM_LEFT, dt);

    const movedX = pos.x - startX;
    const movedY = pos.y - startY;
    const movedDist = Math.sqrt(movedX * movedX + movedY * movedY);

    // Should be approximately PLAYER_SPEED * dt, NOT PLAYER_SPEED * sqrt(2) * dt
    expect(movedDist).toBeCloseTo(PLAYER_SPEED * dt, 0);
  });

  it('should move left with negative dx', () => {
    const startX = 200;
    const pos = movePlayer(startX, 400, -1, 0, TEAM_LEFT, dt);
    expect(pos.x).toBeLessThan(startX);
  });
});

describe('moveHook', () => {
  const dt = 1 / 20;

  it('should return outOfRange false when within range', () => {
    // Hook just launched from origin, moving right
    const result = moveHook(0, 0, 1, 0, 0, 0, dt);
    expect(result.outOfRange).toBe(false);
    expect(result.x).toBeCloseTo(HOOK_SPEED * dt);
    expect(result.y).toBeCloseTo(0);
  });

  it('should return outOfRange true when at/past max range', () => {
    // Hook already near max range
    const nearMax = HOOK_MAX_RANGE - 1;
    const result = moveHook(nearMax, 0, 1, 0, 0, 0, dt);
    // After move: nearMax + HOOK_SPEED * dt should exceed HOOK_MAX_RANGE
    expect(result.outOfRange).toBe(true);
  });

  it('should advance position correctly each tick', () => {
    const result = moveHook(100, 200, 0, 1, 100, 200, dt);
    expect(result.x).toBeCloseTo(100);
    expect(result.y).toBeCloseTo(200 + HOOK_SPEED * dt);
  });

  it('should handle diagonal direction', () => {
    const dir = normalize({ x: 1, y: 1 });
    const result = moveHook(0, 0, dir.x, dir.y, 0, 0, dt);
    expect(result.x).toBeCloseTo(dir.x * HOOK_SPEED * dt);
    expect(result.y).toBeCloseTo(dir.y * HOOK_SPEED * dt);
  });
});

describe('pullTarget', () => {
  const dt = 1 / 20;

  it('should move target toward owner when far away', () => {
    const result = pullTarget(0, 0, 500, 0, dt);
    expect(result.arrived).toBe(false);
    expect(result.x).toBeCloseTo(HOOK_PULL_SPEED * dt);
    expect(result.y).toBeCloseTo(0);
  });

  it('should report arrived when target is close enough (within PLAYER_RADIUS * 2)', () => {
    // Place target very close to owner
    const result = pullTarget(100, 100, 100 + PLAYER_RADIUS, 100, dt);
    expect(result.arrived).toBe(true);
  });

  it('should not overshoot when target is far', () => {
    const result = pullTarget(0, 0, 1000, 0, dt);
    expect(result.x).toBeCloseTo(HOOK_PULL_SPEED * dt);
    expect(result.arrived).toBe(false);
  });

  it('should handle vertical pull', () => {
    const result = pullTarget(100, 0, 100, 500, dt);
    expect(result.arrived).toBe(false);
    expect(result.x).toBeCloseTo(100);
    expect(result.y).toBeCloseTo(HOOK_PULL_SPEED * dt);
  });
});

describe('returnHook', () => {
  const dt = 1 / 20;

  it('should move hook toward owner when far away', () => {
    const result = returnHook(0, 0, 500, 0, dt);
    expect(result.arrived).toBe(false);
    expect(result.x).toBeCloseTo(HOOK_SPEED * dt);
    expect(result.y).toBeCloseTo(0);
  });

  it('should report arrived and snap to owner when close enough (within PLAYER_RADIUS)', () => {
    // Place hook very close to owner
    const result = returnHook(100, 100, 100 + PLAYER_RADIUS * 0.5, 100, dt);
    expect(result.arrived).toBe(true);
    expect(result.x).toBeCloseTo(100 + PLAYER_RADIUS * 0.5);
    expect(result.y).toBeCloseTo(100);
  });

  it('should handle diagonal return', () => {
    const result = returnHook(0, 0, 500, 500, dt);
    expect(result.arrived).toBe(false);
    // Should move in the direction of (500, 500) normalized
    const dir = normalize({ x: 500, y: 500 });
    expect(result.x).toBeCloseTo(dir.x * HOOK_SPEED * dt);
    expect(result.y).toBeCloseTo(dir.y * HOOK_SPEED * dt);
  });
});
