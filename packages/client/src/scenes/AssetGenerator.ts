import Phaser from "phaser";
import { COLORS, MAP_WIDTH, MAP_HEIGHT, RIVER_X, RIVER_WIDTH, PLAYER_RADIUS } from "shared";

/**
 * Generate all game assets programmatically in Animal Crossing pixel style.
 * No external files needed!
 */
export function generateAssets(scene: Phaser.Scene) {
  generateMap(scene);
  generatePlayerSprites(scene);
  generateHookSprites(scene);
  generateParticles(scene);
}

function generateMap(scene: Phaser.Scene) {
  const g = scene.make.graphics({ x: 0, y: 0 });

  // Grass background with subtle pattern
  g.fillStyle(COLORS.grass);
  g.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

  // Grass pattern (small dots)
  g.fillStyle(COLORS.grassDark, 0.3);
  for (let x = 0; x < MAP_WIDTH; x += 24) {
    for (let y = 0; y < MAP_HEIGHT; y += 24) {
      if ((x + y) % 48 === 0) {
        g.fillCircle(x + 4, y + 4, 2);
        g.fillCircle(x + 12, y + 16, 1.5);
      }
    }
  }

  // Small flowers scattered on grass
  const flowerColors = [0xffd93d, 0xff9a9a, 0xb4a7ff, 0xffffff];
  for (let i = 0; i < 40; i++) {
    let fx = Math.random() * MAP_WIDTH;
    const fy = Math.random() * MAP_HEIGHT;
    // Avoid placing on river
    if (fx > RIVER_X - 20 && fx < RIVER_X + RIVER_WIDTH + 20) continue;
    const color = flowerColors[i % flowerColors.length];
    g.fillStyle(color);
    g.fillCircle(fx, fy, 3);
    g.fillStyle(0xffffff, 0.5);
    g.fillCircle(fx - 1, fy - 1, 1);
  }

  // River
  g.fillStyle(COLORS.river);
  g.fillRect(RIVER_X, 0, RIVER_WIDTH, MAP_HEIGHT);

  // River wave pattern
  g.fillStyle(COLORS.riverDeep, 0.4);
  for (let y = 0; y < MAP_HEIGHT; y += 16) {
    const offset = (y % 32 === 0) ? 8 : 0;
    g.fillEllipse(RIVER_X + RIVER_WIDTH / 2 + offset, y + 8, 40, 6);
  }

  // River sparkles
  g.fillStyle(0xffffff, 0.3);
  for (let y = 20; y < MAP_HEIGHT; y += 60) {
    g.fillCircle(RIVER_X + 20 + (y % 40), y, 2);
    g.fillCircle(RIVER_X + RIVER_WIDTH - 20 - (y % 30), y + 30, 1.5);
  }

  // River banks (rounded edges)
  g.fillStyle(0x6aaa4a);
  g.fillRect(RIVER_X - 6, 0, 6, MAP_HEIGHT);
  g.fillRect(RIVER_X + RIVER_WIDTH, 0, 6, MAP_HEIGHT);

  // Small bushes along river banks
  g.fillStyle(0x5a9a3a);
  for (let y = 0; y < MAP_HEIGHT; y += 80) {
    g.fillCircle(RIVER_X - 12, y + 20, 8);
    g.fillCircle(RIVER_X + RIVER_WIDTH + 12, y + 50, 8);
    g.fillStyle(0x6aaa4a);
    g.fillCircle(RIVER_X - 10, y + 18, 6);
    g.fillCircle(RIVER_X + RIVER_WIDTH + 14, y + 48, 6);
    g.fillStyle(0x5a9a3a);
  }

  // Map border (wooden fence style)
  g.lineStyle(4, 0x8b6914);
  g.strokeRect(2, 2, MAP_WIDTH - 4, MAP_HEIGHT - 4);
  g.lineStyle(2, 0xd4a56a);
  g.strokeRect(4, 4, MAP_WIDTH - 8, MAP_HEIGHT - 8);

  // Spawn zone indicators
  // Left team zone
  g.fillStyle(COLORS.teamLeft, 0.15);
  g.fillRoundedRect(20, 20, 160, MAP_HEIGHT - 40, 16);
  // Right team zone
  g.fillStyle(COLORS.teamRight, 0.15);
  g.fillRoundedRect(MAP_WIDTH - 180, 20, 160, MAP_HEIGHT - 40, 16);

  g.generateTexture("map", MAP_WIDTH, MAP_HEIGHT);
  g.destroy();
}

function generatePlayerSprites(scene: Phaser.Scene) {
  // Generate left team player (mint green, bear-like character)
  createCharacterTexture(scene, "player-left", COLORS.teamLeft, 0x5aaa8a);
  // Generate right team player (pink, bunny-like character)
  createCharacterTexture(scene, "player-right", COLORS.teamRight, 0xd48a9a);
  // Dead player
  createDeadTexture(scene, "player-dead");
}

function createCharacterTexture(
  scene: Phaser.Scene,
  key: string,
  bodyColor: number,
  darkColor: number
) {
  const size = PLAYER_RADIUS * 2 + 8;
  const cx = size / 2;
  const cy = size / 2;
  const g = scene.make.graphics({ x: 0, y: 0 });

  // Shadow
  g.fillStyle(0x000000, 0.15);
  g.fillEllipse(cx, cy + PLAYER_RADIUS - 2, PLAYER_RADIUS * 1.8, PLAYER_RADIUS * 0.6);

  // Body (round, cute)
  g.fillStyle(bodyColor);
  g.fillCircle(cx, cy, PLAYER_RADIUS);

  // Body highlight
  g.fillStyle(0xffffff, 0.25);
  g.fillCircle(cx - 4, cy - 6, PLAYER_RADIUS * 0.5);

  // Ears
  g.fillStyle(bodyColor);
  g.fillCircle(cx - 12, cy - 16, 7);
  g.fillCircle(cx + 12, cy - 16, 7);
  // Inner ears
  g.fillStyle(darkColor);
  g.fillCircle(cx - 12, cy - 16, 4);
  g.fillCircle(cx + 12, cy - 16, 4);

  // Eyes (big, cute)
  g.fillStyle(0x333333);
  g.fillCircle(cx - 7, cy - 3, 4);
  g.fillCircle(cx + 7, cy - 3, 4);
  // Eye highlights
  g.fillStyle(0xffffff);
  g.fillCircle(cx - 8, cy - 5, 2);
  g.fillCircle(cx + 6, cy - 5, 2);

  // Rosy cheeks
  g.fillStyle(0xff9999, 0.4);
  g.fillCircle(cx - 12, cy + 3, 4);
  g.fillCircle(cx + 12, cy + 3, 4);

  // Smile
  g.lineStyle(2, 0x333333);
  g.beginPath();
  g.arc(cx, cy + 2, 5, 0.1 * Math.PI, 0.9 * Math.PI, false);
  g.strokePath();

  // Belly
  g.fillStyle(0xffffff, 0.3);
  g.fillCircle(cx, cy + 6, 8);

  g.generateTexture(key, size, size);
  g.destroy();
}

function createDeadTexture(scene: Phaser.Scene, key: string) {
  const size = PLAYER_RADIUS * 2 + 8;
  const cx = size / 2;
  const cy = size / 2;
  const g = scene.make.graphics({ x: 0, y: 0 });

  // Ghost-like dead state
  g.fillStyle(0xcccccc, 0.5);
  g.fillCircle(cx, cy, PLAYER_RADIUS);

  // X eyes
  g.lineStyle(2, 0x666666);
  g.lineBetween(cx - 10, cy - 6, cx - 4, cy);
  g.lineBetween(cx - 4, cy - 6, cx - 10, cy);
  g.lineBetween(cx + 4, cy - 6, cx + 10, cy);
  g.lineBetween(cx + 10, cy - 6, cx + 4, cy);

  g.generateTexture(key, size, size);
  g.destroy();
}

function generateHookSprites(scene: Phaser.Scene) {
  // Hook head (golden anchor-like)
  const hg = scene.make.graphics({ x: 0, y: 0 });
  hg.fillStyle(COLORS.hookHead);
  hg.fillCircle(10, 10, 8);
  hg.fillStyle(0xffffff, 0.3);
  hg.fillCircle(8, 7, 3);
  // Hook point
  hg.fillStyle(0xc0c0c0);
  hg.fillTriangle(10, 2, 6, 10, 14, 10);
  hg.generateTexture("hook-head", 20, 20);
  hg.destroy();

  // Chain link
  const cg = scene.make.graphics({ x: 0, y: 0 });
  cg.fillStyle(COLORS.hookChain);
  cg.fillCircle(4, 4, 3);
  cg.fillStyle(0xffffff, 0.3);
  cg.fillCircle(3, 3, 1);
  cg.generateTexture("chain-link", 8, 8);
  cg.destroy();
}

function generateParticles(scene: Phaser.Scene) {
  // Hit particle (star burst)
  const pg = scene.make.graphics({ x: 0, y: 0 });
  pg.fillStyle(0xffd93d);
  pg.fillStar(8, 8, 5, 8, 3);
  pg.generateTexture("particle-star", 16, 16);
  pg.destroy();

  // Water splash
  const wg = scene.make.graphics({ x: 0, y: 0 });
  wg.fillStyle(0x6cc4e8);
  wg.fillCircle(4, 4, 4);
  wg.generateTexture("particle-water", 8, 8);
  wg.destroy();

  // Death poof
  const dg = scene.make.graphics({ x: 0, y: 0 });
  dg.fillStyle(0xffffff, 0.8);
  dg.fillCircle(6, 6, 6);
  dg.generateTexture("particle-poof", 12, 12);
  dg.destroy();
}
