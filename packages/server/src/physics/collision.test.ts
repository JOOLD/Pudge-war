import { describe, it, expect } from "vitest";
import { moveHook, segmentsIntersect, checkHeadshots } from "./collision";
import { MAP_WIDTH, MAP_HEIGHT, HOOK_RADIUS, HOOK_SPEED, PLAYER_RADIUS } from "shared";

describe("moveHook bounce mechanics", () => {
  // Helper: a large dt to force the hook past a wall
  const largeDt = 2; // 2 seconds at HOOK_SPEED = 600 => 1200px movement

  it("bounces off left wall (dirX flips to positive)", () => {
    // Hook near left edge, moving left
    const result = moveHook(
      10, 400, -1, 0, // near left wall, moving left
      600, 400,       // start position (center)
      0.05,           // small dt
      0               // 0 bounces so far
    );
    // Should bounce: x clamped to HOOK_RADIUS, dirX becomes positive
    expect(result.dirX).toBeGreaterThan(0);
    expect(result.x).toBeGreaterThanOrEqual(HOOK_RADIUS);
    expect(result.bounced).toBe(true);
    expect(result.newBounces).toBe(1);
  });

  it("bounces off right wall (dirX flips to negative)", () => {
    const result = moveHook(
      MAP_WIDTH - 5, 400, 1, 0,
      100, 400,
      0.05,
      0
    );
    expect(result.dirX).toBeLessThan(0);
    expect(result.x).toBeLessThanOrEqual(MAP_WIDTH - HOOK_RADIUS);
    expect(result.bounced).toBe(true);
    expect(result.newBounces).toBe(1);
  });

  it("bounces off top wall (dirY flips to positive)", () => {
    const result = moveHook(
      600, 5, 0, -1,
      600, 400,
      0.05,
      0
    );
    expect(result.dirY).toBeGreaterThan(0);
    expect(result.y).toBeGreaterThanOrEqual(HOOK_RADIUS);
    expect(result.bounced).toBe(true);
    expect(result.newBounces).toBe(1);
  });

  it("bounces off bottom wall (dirY flips to negative)", () => {
    const result = moveHook(
      600, MAP_HEIGHT - 5, 0, 1,
      600, 100,
      0.05,
      0
    );
    expect(result.dirY).toBeLessThan(0);
    expect(result.y).toBeLessThanOrEqual(MAP_HEIGHT - HOOK_RADIUS);
    expect(result.bounced).toBe(true);
    expect(result.newBounces).toBe(1);
  });

  it("does NOT bounce when max bounces reached, returns outOfRange", () => {
    // At max bounces (3), hitting a wall should NOT bounce
    const result = moveHook(
      10, 400, -1, 0,
      600, 400,
      1, // large dt to ensure out of range
      3  // already at max bounces
    );
    // Should NOT flip direction
    expect(result.dirX).toBe(-1);
    // outOfRange should be true (distance > HOOK_MAX_RANGE)
    expect(result.outOfRange).toBe(true);
    expect(result.bounced).toBe(false);
    expect(result.newBounces).toBe(3);
  });

  it("counts bounces correctly across multiple calls", () => {
    // First bounce off left wall
    const r1 = moveHook(5, 400, -1, 0, 600, 400, 0.05, 0);
    expect(r1.newBounces).toBe(1);
    expect(r1.bounced).toBe(true);

    // Second bounce off right wall (simulate hook traveling right after first bounce)
    const r2 = moveHook(MAP_WIDTH - 5, 400, 1, 0, 600, 400, 0.05, r1.newBounces);
    expect(r2.newBounces).toBe(2);
    expect(r2.bounced).toBe(true);

    // Third bounce
    const r3 = moveHook(5, 400, -1, 0, 600, 400, 0.05, r2.newBounces);
    expect(r3.newBounces).toBe(3);
    expect(r3.bounced).toBe(true);
  });

  it("normal flight without bouncing keeps direction unchanged", () => {
    const result = moveHook(
      400, 400, 1, 0,
      300, 400,
      0.05,
      0
    );
    expect(result.dirX).toBe(1);
    expect(result.dirY).toBe(0);
    expect(result.bounced).toBe(false);
    expect(result.newBounces).toBe(0);
  });
});

describe("segmentsIntersect", () => {
  it("detects crossing segments", () => {
    // X shape: (0,0)-(10,10) crosses (0,10)-(10,0)
    const result = segmentsIntersect(0, 0, 10, 10, 0, 10, 10, 0);
    expect(result.intersects).toBe(true);
    expect(result.x).toBeCloseTo(5);
    expect(result.y).toBeCloseTo(5);
  });

  it("detects no intersection for parallel segments", () => {
    const result = segmentsIntersect(0, 0, 10, 0, 0, 5, 10, 5);
    expect(result.intersects).toBe(false);
  });

  it("detects no intersection for non-overlapping segments", () => {
    const result = segmentsIntersect(0, 0, 5, 0, 6, 1, 6, -1);
    expect(result.intersects).toBe(false);
  });
});

describe("checkHeadshots", () => {
  it("detects headshot when two crossing hooks from different teams hit near a player", () => {
    const hooks = [
      { ownerId: "a", ownerTeam: 0, prevX: 0, prevY: 0, x: 100, y: 100 },
      { ownerId: "b", ownerTeam: 1, prevX: 100, prevY: 0, x: 0, y: 100 },
    ];
    // Intersection at (50, 50). Place a player near that point.
    const players = [
      { id: "victim", x: 52, y: 52, team: 0, alive: true },
    ];

    const results = checkHeadshots(hooks, players);
    expect(results.length).toBe(1);
    expect(results[0].victimId).toBe("victim");
    expect(results[0].x).toBeCloseTo(50);
    expect(results[0].y).toBeCloseTo(50);
  });

  it("does NOT trigger headshot for same-team hooks", () => {
    const hooks = [
      { ownerId: "a", ownerTeam: 0, prevX: 0, prevY: 0, x: 100, y: 100 },
      { ownerId: "b", ownerTeam: 0, prevX: 100, prevY: 0, x: 0, y: 100 },
    ];
    const players = [
      { id: "victim", x: 50, y: 50, team: 1, alive: true },
    ];

    const results = checkHeadshots(hooks, players);
    expect(results.length).toBe(0);
  });

  it("does NOT trigger headshot when player is too far from intersection", () => {
    const hooks = [
      { ownerId: "a", ownerTeam: 0, prevX: 0, prevY: 0, x: 100, y: 100 },
      { ownerId: "b", ownerTeam: 1, prevX: 100, prevY: 0, x: 0, y: 100 },
    ];
    // Intersection at (50, 50). Place player far away.
    const players = [
      { id: "victim", x: 200, y: 200, team: 0, alive: true },
    ];

    const results = checkHeadshots(hooks, players);
    expect(results.length).toBe(0);
  });

  it("does NOT headshot hook owners themselves", () => {
    const hooks = [
      { ownerId: "a", ownerTeam: 0, prevX: 0, prevY: 0, x: 100, y: 100 },
      { ownerId: "b", ownerTeam: 1, prevX: 100, prevY: 0, x: 0, y: 100 },
    ];
    // The hook owners are AT the intersection
    const players = [
      { id: "a", x: 50, y: 50, team: 0, alive: true },
      { id: "b", x: 50, y: 50, team: 1, alive: true },
    ];

    const results = checkHeadshots(hooks, players);
    expect(results.length).toBe(0);
  });

  it("does NOT headshot dead players", () => {
    const hooks = [
      { ownerId: "a", ownerTeam: 0, prevX: 0, prevY: 0, x: 100, y: 100 },
      { ownerId: "b", ownerTeam: 1, prevX: 100, prevY: 0, x: 0, y: 100 },
    ];
    const players = [
      { id: "victim", x: 50, y: 50, team: 0, alive: false },
    ];

    const results = checkHeadshots(hooks, players);
    expect(results.length).toBe(0);
  });
});
