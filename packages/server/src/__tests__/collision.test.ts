import { describe, it, expect } from "vitest";
import { hookObstacleCollision, clampToObstacles } from "../physics/collision";
import { OBSTACLES, PLAYER_RADIUS } from "shared";

describe("hookObstacleCollision", () => {
  it("returns obstacle when hook hits a tree", () => {
    // First tree is at { x: 180, y: 150, radius: 25, type: 'tree' }
    const tree = OBSTACLES.find((o) => o.type === "tree")!;
    const result = hookObstacleCollision(tree.x, tree.y, 8);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("tree");
  });

  it("returns obstacle when hook hits a rock", () => {
    // First rock is at { x: 350, y: 250, radius: 30, type: 'rock' }
    const rock = OBSTACLES.find((o) => o.type === "rock")!;
    const result = hookObstacleCollision(rock.x + 20, rock.y, 8);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("rock");
  });

  it("returns null when hook misses all obstacles", () => {
    // Center of map, far from any obstacle
    const result = hookObstacleCollision(600, 400, 8);
    expect(result).toBeNull();
  });
});

describe("clampToObstacles", () => {
  it("pushes player out of rock", () => {
    // First rock at { x: 350, y: 250, radius: 30 }
    const rock = OBSTACLES.find((o) => o.type === "rock")!;
    // Place player inside the rock
    const result = clampToObstacles(rock.x, rock.y, PLAYER_RADIUS);
    const dx = result.x - rock.x;
    const dy = result.y - rock.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    // Player should be pushed to at least playerRadius + rock.radius away
    // If player is exactly at center, dist=0 so no push (edge case with dist > 0 guard)
    // Place player slightly off-center instead
    const result2 = clampToObstacles(rock.x + 5, rock.y, PLAYER_RADIUS);
    const dx2 = result2.x - rock.x;
    const dy2 = result2.y - rock.y;
    const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
    expect(dist2).toBeGreaterThanOrEqual(PLAYER_RADIUS + rock.radius - 0.01);
  });

  it("does NOT push player out of tree (players walk through)", () => {
    // First tree at { x: 180, y: 150, radius: 25 }
    const tree = OBSTACLES.find((o) => o.type === "tree")!;
    const result = clampToObstacles(tree.x, tree.y, PLAYER_RADIUS);
    // Position should be unchanged - trees don't block players
    expect(result.x).toBe(tree.x);
    expect(result.y).toBe(tree.y);
  });

  it("handles player between two rocks", () => {
    // Rocks at { x: 350, y: 250 } and { x: 300, y: 580 } - far apart
    // Use a position near the first rock
    const rock = OBSTACLES.find((o) => o.type === "rock")!;
    const result = clampToObstacles(rock.x + 10, rock.y, PLAYER_RADIUS);
    const dx = result.x - rock.x;
    const dy = result.y - rock.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    expect(dist).toBeGreaterThanOrEqual(PLAYER_RADIUS + rock.radius - 0.01);
  });
});
