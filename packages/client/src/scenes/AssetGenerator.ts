import Phaser from "phaser";
import { MAP_WIDTH, MAP_HEIGHT, RIVER_X, RIVER_WIDTH } from "shared";

/**
 * Generate all game assets programmatically with enhanced pixel art style.
 * Uses canvas 2D API for gradients, dithering, and detailed rendering.
 */
export function generateAssets(scene: Phaser.Scene) {
  generateMap(scene);
  // Player sprites are now loaded from Ninja Adventure spritesheets in GameScene.preload()
  generateHookSprites(scene);
  generateParticles(scene);
  generateObstacles(scene);
}

/* =============================================
 * HELPER: get a raw CanvasRenderingContext2D
 * from a Phaser scene for advanced drawing
 * ============================================= */
function createCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false; // pixel art crisp
  return [canvas, ctx];
}

function canvasToTexture(scene: Phaser.Scene, canvas: HTMLCanvasElement, key: string) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, canvas);
}

/* =============================================
 * Simple seeded pseudo-random for deterministic
 * map generation (same map every time)
 * ============================================= */
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* =============================================
 * MAP RENDERING — rich, layered terrain
 * ============================================= */
function generateMap(scene: Phaser.Scene) {
  const [canvas, ctx] = createCanvas(MAP_WIDTH, MAP_HEIGHT);
  const rng = mulberry32(42);

  // --- Base grass with multi-stop gradient ---
  const grassGrad = ctx.createLinearGradient(0, 0, MAP_WIDTH * 0.3, MAP_HEIGHT);
  grassGrad.addColorStop(0, "#93d46e");
  grassGrad.addColorStop(0.2, "#82c45e");
  grassGrad.addColorStop(0.4, "#7abc5a");
  grassGrad.addColorStop(0.6, "#8fce6a");
  grassGrad.addColorStop(0.8, "#74b452");
  grassGrad.addColorStop(1, "#6aaa4a");
  ctx.fillStyle = grassGrad;
  ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

  // Secondary horizontal gradient overlay for depth
  const grassH = ctx.createLinearGradient(0, 0, MAP_WIDTH, 0);
  grassH.addColorStop(0, "rgba(110,190,80,0.15)");
  grassH.addColorStop(0.3, "rgba(0,0,0,0)");
  grassH.addColorStop(0.5, "rgba(0,0,0,0.04)");
  grassH.addColorStop(0.7, "rgba(0,0,0,0)");
  grassH.addColorStop(1, "rgba(110,190,80,0.15)");
  ctx.fillStyle = grassH;
  ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

  // --- Pixel-level dithering for organic grass feel ---
  const imgData = ctx.getImageData(0, 0, MAP_WIDTH, MAP_HEIGHT);
  const d = imgData.data;
  const rng2 = mulberry32(137);
  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      // Skip river area
      if (x >= RIVER_X - 12 && x <= RIVER_X + RIVER_WIDTH + 12) continue;
      const i = (y * MAP_WIDTH + x) * 4;

      // Multi-scale dithering: fine checker + medium noise + large patches
      const fineChecker = ((x + y) % 2 === 0) ? 1 : 0;
      const medNoise = ((x * 7 + y * 13) % 5 === 0) ? 1 : 0;
      const largePatch = ((x * 3 + y * 11) % 37 < 5) ? 1 : 0;

      if (fineChecker && medNoise) {
        d[i] = Math.max(0, d[i] - 10);
        d[i + 1] = Math.max(0, d[i + 1] - 7);
        d[i + 2] = Math.max(0, d[i + 2] - 5);
      }
      if (largePatch) {
        d[i] = Math.max(0, d[i] - 6);
        d[i + 1] = Math.max(0, d[i + 1] - 4);
      }
      // Bright grass blade highlights
      if ((x * 31 + y * 17) % 97 === 0) {
        d[i] = Math.min(255, d[i] + 22);
        d[i + 1] = Math.min(255, d[i + 1] + 28);
        d[i + 2] = Math.min(255, d[i + 2] + 5);
      }
      // Occasional dark speckle for soil
      if ((x * 53 + y * 29) % 211 === 0) {
        d[i] = Math.max(0, d[i] - 20);
        d[i + 1] = Math.max(0, d[i + 1] - 18);
        d[i + 2] = Math.max(0, d[i + 2] - 8);
      }
    }
  }
  ctx.putImageData(imgData, 0, 0);

  // --- Grass texture: subtle cross-hatch blades ---
  ctx.globalAlpha = 0.07;
  ctx.strokeStyle = "#4a8a2a";
  ctx.lineWidth = 1;
  for (let x = 0; x < MAP_WIDTH; x += 14) {
    for (let y = 0; y < MAP_HEIGHT; y += 14) {
      if (x >= RIVER_X - 12 && x <= RIVER_X + RIVER_WIDTH + 12) continue;
      const gx = x + (((x * 3 + y * 7) % 11) - 5);
      const gy = y + (((x * 5 + y * 3) % 9) - 4);
      // Blade 1
      ctx.beginPath();
      ctx.moveTo(gx, gy + 5);
      ctx.quadraticCurveTo(gx + 1, gy + 2, gx + 0.5, gy);
      ctx.stroke();
      // Blade 2
      ctx.beginPath();
      ctx.moveTo(gx + 7, gy + 6);
      ctx.quadraticCurveTo(gx + 6, gy + 3, gx + 8, gy + 1);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;

  // --- Scattered four-petal flowers and clovers ---
  const flowerPalette = [
    "#ffd93d", "#ff9a9a", "#b4a7ff", "#ffffff", "#ff9ecf",
    "#ffa64d", "#88ddff", "#ffeb99",
  ];
  for (let i = 0; i < 100; i++) {
    const fx = rng() * MAP_WIDTH;
    const fy = rng() * MAP_HEIGHT;
    if (fx > RIVER_X - 28 && fx < RIVER_X + RIVER_WIDTH + 28) continue;
    const colorIdx = Math.floor(rng() * flowerPalette.length);

    if (rng() > 0.55) {
      // Clover (3-leaf with stem)
      ctx.strokeStyle = "#4a7a2a";
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(fx, fy + 5);
      ctx.lineTo(fx, fy + 1);
      ctx.stroke();
      ctx.fillStyle = "#5a9a3a";
      ctx.globalAlpha = 0.45;
      ctx.beginPath(); ctx.arc(fx - 2.5, fy - 2, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(fx + 2.5, fy - 2, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(fx, fy + 1, 3, 0, Math.PI * 2); ctx.fill();
      // Highlight on one leaf
      ctx.fillStyle = "#7aca5a";
      ctx.globalAlpha = 0.3;
      ctx.beginPath(); ctx.arc(fx - 2, fy - 3, 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    } else {
      // Four-petal flower with proper petal shapes
      const fc = flowerPalette[colorIdx];
      const petalLen = 3 + rng() * 1.5;
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = fc;
      // Draw 4 petals as ellipses rotated 90deg apart
      for (let p = 0; p < 4; p++) {
        const angle = (p * Math.PI) / 2;
        const px = fx + Math.cos(angle) * petalLen;
        const py = fy + Math.sin(angle) * petalLen;
        ctx.beginPath();
        ctx.ellipse(px, py, 2.5, 1.8, angle, 0, Math.PI * 2);
        ctx.fill();
      }
      // Center pistil
      ctx.fillStyle = "#ffe066";
      ctx.beginPath(); ctx.arc(fx, fy, 1.8, 0, Math.PI * 2); ctx.fill();
      // Highlight on petal
      ctx.fillStyle = "#ffffff";
      ctx.globalAlpha = 0.4;
      ctx.beginPath(); ctx.arc(fx - 1, fy - 1, 0.8, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // --- River bank transitions (soft gradient with rounded edges) ---
  const bankWidth = 16;
  // Left bank
  const leftBankGrad = ctx.createLinearGradient(RIVER_X - bankWidth, 0, RIVER_X + 6, 0);
  leftBankGrad.addColorStop(0, "rgba(106, 170, 74, 0)");
  leftBankGrad.addColorStop(0.25, "rgba(85, 135, 55, 0.6)");
  leftBankGrad.addColorStop(0.5, "rgba(75, 115, 45, 0.9)");
  leftBankGrad.addColorStop(0.75, "rgba(65, 100, 40, 1)");
  leftBankGrad.addColorStop(1, "rgba(80, 130, 55, 0.5)");
  ctx.fillStyle = leftBankGrad;
  ctx.fillRect(RIVER_X - bankWidth, 0, bankWidth + 6, MAP_HEIGHT);

  // Right bank
  const rightBankGrad = ctx.createLinearGradient(RIVER_X + RIVER_WIDTH - 6, 0, RIVER_X + RIVER_WIDTH + bankWidth, 0);
  rightBankGrad.addColorStop(0, "rgba(80, 130, 55, 0.5)");
  rightBankGrad.addColorStop(0.25, "rgba(65, 100, 40, 1)");
  rightBankGrad.addColorStop(0.5, "rgba(75, 115, 45, 0.9)");
  rightBankGrad.addColorStop(0.75, "rgba(85, 135, 55, 0.6)");
  rightBankGrad.addColorStop(1, "rgba(106, 170, 74, 0)");
  ctx.fillStyle = rightBankGrad;
  ctx.fillRect(RIVER_X + RIVER_WIDTH - 6, 0, bankWidth + 6, MAP_HEIGHT);

  // --- River water with layered depth ---
  const riverGrad = ctx.createLinearGradient(RIVER_X, 0, RIVER_X + RIVER_WIDTH, 0);
  riverGrad.addColorStop(0, "#4a98c0");
  riverGrad.addColorStop(0.15, "#5ab4d8");
  riverGrad.addColorStop(0.35, "#6cc4e8");
  riverGrad.addColorStop(0.5, "#78d0f0");
  riverGrad.addColorStop(0.65, "#6cc4e8");
  riverGrad.addColorStop(0.85, "#5ab4d8");
  riverGrad.addColorStop(1, "#4a98c0");
  ctx.fillStyle = riverGrad;
  ctx.fillRect(RIVER_X, 0, RIVER_WIDTH, MAP_HEIGHT);

  // Depth gradient (darker at center)
  const depthGrad = ctx.createRadialGradient(
    RIVER_X + RIVER_WIDTH / 2, MAP_HEIGHT / 2, 20,
    RIVER_X + RIVER_WIDTH / 2, MAP_HEIGHT / 2, RIVER_WIDTH
  );
  depthGrad.addColorStop(0, "rgba(30, 80, 140, 0.2)");
  depthGrad.addColorStop(1, "rgba(30, 80, 140, 0)");
  ctx.fillStyle = depthGrad;
  ctx.fillRect(RIVER_X, 0, RIVER_WIDTH, MAP_HEIGHT);

  // Vertical flow gradient (lighter at top, deeper at bottom)
  const flowGrad = ctx.createLinearGradient(0, 0, 0, MAP_HEIGHT);
  flowGrad.addColorStop(0, "rgba(180,230,255,0.08)");
  flowGrad.addColorStop(0.5, "rgba(0,0,0,0)");
  flowGrad.addColorStop(1, "rgba(20,60,100,0.12)");
  ctx.fillStyle = flowGrad;
  ctx.fillRect(RIVER_X, 0, RIVER_WIDTH, MAP_HEIGHT);

  // Wave patterns (layered, two sets at different amplitudes)
  ctx.lineCap = "round";
  for (let layer = 0; layer < 2; layer++) {
    ctx.globalAlpha = layer === 0 ? 0.12 : 0.08;
    ctx.strokeStyle = layer === 0 ? "#ffffff" : "#b0e0ff";
    ctx.lineWidth = layer === 0 ? 1.5 : 1;
    const spacing = layer === 0 ? 14 : 20;
    const offset = layer * 7;
    for (let y = offset; y < MAP_HEIGHT; y += spacing) {
      const waveOffset = ((y * 7 + layer * 31) % 24) - 12;
      ctx.beginPath();
      ctx.moveTo(RIVER_X + 8, y);
      ctx.bezierCurveTo(
        RIVER_X + RIVER_WIDTH * 0.25 + waveOffset, y + 3 + layer * 2,
        RIVER_X + RIVER_WIDTH * 0.55 - waveOffset, y + 7 + layer,
        RIVER_X + RIVER_WIDTH - 8, y + 5
      );
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;

  // River sparkles (diamond-shaped for shimmer effect)
  for (let i = 0; i < 45; i++) {
    const sx = RIVER_X + 12 + rng() * (RIVER_WIDTH - 24);
    const sy = rng() * MAP_HEIGHT;
    ctx.globalAlpha = 0.15 + rng() * 0.35;
    const sparkSize = 1 + rng() * 2.5;
    ctx.fillStyle = "#ffffff";
    // Diamond sparkle
    ctx.beginPath();
    ctx.moveTo(sx, sy - sparkSize);
    ctx.lineTo(sx + sparkSize * 0.6, sy);
    ctx.lineTo(sx, sy + sparkSize);
    ctx.lineTo(sx - sparkSize * 0.6, sy);
    ctx.closePath();
    ctx.fill();
    // Small cross highlight on bigger sparkles
    if (sparkSize > 2) {
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(sx - sparkSize * 1.2, sy);
      ctx.lineTo(sx + sparkSize * 1.2, sy);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;

  // --- River bank detail: pebbles and grass tufts ---
  for (let y = 0; y < MAP_HEIGHT; y += 18) {
    // Left bank pebbles
    const lbx = RIVER_X - 3 + ((y * 3) % 7) - 3;
    ctx.fillStyle = "#5a8a3a";
    ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.arc(lbx, y + 9, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#6aaa4a";
    ctx.beginPath(); ctx.arc(lbx + 2, y + 7, 4, 0, Math.PI * 2); ctx.fill();
    // Small sand pebble
    ctx.fillStyle = "#b8a878";
    ctx.globalAlpha = 0.3;
    ctx.beginPath(); ctx.arc(lbx + 5, y + 11, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    // Right bank pebbles
    const rbx = RIVER_X + RIVER_WIDTH + 3 - ((y * 5) % 7) + 3;
    ctx.fillStyle = "#5a8a3a";
    ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.arc(rbx, y + 14, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#6aaa4a";
    ctx.beginPath(); ctx.arc(rbx - 2, y + 12, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#b8a878";
    ctx.globalAlpha = 0.3;
    ctx.beginPath(); ctx.arc(rbx - 5, y + 16, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // --- Bushes along river banks ---
  for (let y = 0; y < MAP_HEIGHT; y += 50) {
    drawBush(ctx, RIVER_X - 18, y + 18 + ((y * 3) % 15), rng);
    drawBush(ctx, RIVER_X + RIVER_WIDTH + 12, y + 35 + ((y * 7) % 20), rng);
  }

  // --- Spawn zone indicators ---
  // Left team zone
  ctx.fillStyle = "rgba(126, 207, 176, 0.10)";
  roundRect(ctx, 20, 20, 160, MAP_HEIGHT - 40, 16);
  ctx.fill();
  ctx.strokeStyle = "rgba(126, 207, 176, 0.18)";
  ctx.lineWidth = 2;
  roundRect(ctx, 20, 20, 160, MAP_HEIGHT - 40, 16);
  ctx.stroke();
  // Inner glow
  const spawnLeftGlow = ctx.createRadialGradient(100, MAP_HEIGHT / 2, 10, 100, MAP_HEIGHT / 2, 120);
  spawnLeftGlow.addColorStop(0, "rgba(126, 207, 176, 0.06)");
  spawnLeftGlow.addColorStop(1, "rgba(126, 207, 176, 0)");
  ctx.fillStyle = spawnLeftGlow;
  ctx.fillRect(20, 20, 160, MAP_HEIGHT - 40);

  // Right team zone
  ctx.fillStyle = "rgba(246, 166, 178, 0.10)";
  roundRect(ctx, MAP_WIDTH - 180, 20, 160, MAP_HEIGHT - 40, 16);
  ctx.fill();
  ctx.strokeStyle = "rgba(246, 166, 178, 0.18)";
  ctx.lineWidth = 2;
  roundRect(ctx, MAP_WIDTH - 180, 20, 160, MAP_HEIGHT - 40, 16);
  ctx.stroke();
  const spawnRightGlow = ctx.createRadialGradient(MAP_WIDTH - 100, MAP_HEIGHT / 2, 10, MAP_WIDTH - 100, MAP_HEIGHT / 2, 120);
  spawnRightGlow.addColorStop(0, "rgba(246, 166, 178, 0.06)");
  spawnRightGlow.addColorStop(1, "rgba(246, 166, 178, 0)");
  ctx.fillStyle = spawnRightGlow;
  ctx.fillRect(MAP_WIDTH - 180, 20, 160, MAP_HEIGHT - 40);

  // --- Map border (wooden frame with inset shadow) ---
  // Outer dark border
  ctx.strokeStyle = "#5a4510";
  ctx.lineWidth = 6;
  ctx.strokeRect(1, 1, MAP_WIDTH - 2, MAP_HEIGHT - 2);
  // Mid-tone wood
  ctx.strokeStyle = "#c49a5a";
  ctx.lineWidth = 3;
  ctx.strokeRect(4, 4, MAP_WIDTH - 8, MAP_HEIGHT - 8);
  // Inner light bevel
  ctx.strokeStyle = "#dbb878";
  ctx.lineWidth = 1;
  ctx.strokeRect(6, 6, MAP_WIDTH - 12, MAP_HEIGHT - 12);
  // Inner shadow
  ctx.strokeStyle = "rgba(0,0,0,0.12)";
  ctx.lineWidth = 3;
  ctx.strokeRect(8, 8, MAP_WIDTH - 16, MAP_HEIGHT - 16);

  // --- Vignette (radial gradient overlay for depth) ---
  const vigCx = MAP_WIDTH / 2;
  const vigCy = MAP_HEIGHT / 2;
  const vigRadius = Math.max(MAP_WIDTH, MAP_HEIGHT) * 0.65;
  const vigGrad = ctx.createRadialGradient(vigCx, vigCy, vigRadius * 0.4, vigCx, vigCy, vigRadius);
  vigGrad.addColorStop(0, "rgba(0,0,0,0)");
  vigGrad.addColorStop(0.6, "rgba(0,0,0,0)");
  vigGrad.addColorStop(0.85, "rgba(0,0,0,0.08)");
  vigGrad.addColorStop(1, "rgba(0,0,0,0.18)");
  ctx.fillStyle = vigGrad;
  ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

  canvasToTexture(scene, canvas, "map");
}

/** Draw a small decorative bush with layered depth */
function drawBush(ctx: CanvasRenderingContext2D, x: number, y: number, rng: () => number) {
  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.08)";
  ctx.beginPath(); ctx.ellipse(x + 1, y + 6, 9, 3, 0, 0, Math.PI * 2); ctx.fill();
  // Back layer (darkest)
  ctx.fillStyle = "#3a7a1a";
  ctx.beginPath(); ctx.arc(x + 2, y + 1, 9, 0, Math.PI * 2); ctx.fill();
  // Mid layer
  ctx.fillStyle = "#4a9a2a";
  ctx.beginPath(); ctx.arc(x - 1, y - 1, 7, 0, Math.PI * 2); ctx.fill();
  // Front layer (lightest)
  ctx.fillStyle = "#5abb3a";
  ctx.beginPath(); ctx.arc(x + 1, y - 3, 5, 0, Math.PI * 2); ctx.fill();
  // Highlight
  ctx.fillStyle = "rgba(160,240,120,0.3)";
  ctx.beginPath(); ctx.arc(x - 1, y - 5, 3, 0, Math.PI * 2); ctx.fill();
  // Tiny berry dot
  if (rng() > 0.5) {
    ctx.fillStyle = "#ff6b6b";
    ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.arc(x + 4, y - 2, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
}

/** Canvas roundRect helper */
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function generateHookSprites(scene: Phaser.Scene) {
  // Hook head (golden with detail)
  {
    const [canvas, ctx] = createCanvas(20, 20);
    // Glow
    ctx.fillStyle = "rgba(232, 212, 77, 0.3)";
    ctx.beginPath(); ctx.arc(10, 10, 10, 0, Math.PI * 2); ctx.fill();
    // Main hook
    const grad = ctx.createRadialGradient(8, 7, 1, 10, 10, 8);
    grad.addColorStop(0, "#fff4a0");
    grad.addColorStop(0.5, "#e8d44d");
    grad.addColorStop(1, "#c4a72e");
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(10, 10, 7, 0, Math.PI * 2); ctx.fill();
    // Highlight
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.beginPath(); ctx.arc(8, 7, 3, 0, Math.PI * 2); ctx.fill();
    // Hook point
    ctx.fillStyle = "#c0c0c0";
    ctx.beginPath();
    ctx.moveTo(10, 2);
    ctx.lineTo(6, 9);
    ctx.lineTo(14, 9);
    ctx.closePath();
    ctx.fill();
    canvasToTexture(scene, canvas, "hook-head");
  }

  // Chain link
  {
    const [canvas, ctx] = createCanvas(8, 8);
    const grad = ctx.createRadialGradient(3, 3, 0, 4, 4, 4);
    grad.addColorStop(0, "#e0e0e0");
    grad.addColorStop(1, "#a0a0a0");
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(4, 4, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.beginPath(); ctx.arc(3, 3, 1.2, 0, Math.PI * 2); ctx.fill();
    canvasToTexture(scene, canvas, "chain-link");
  }
}

/* =============================================
 * ENHANCED OBSTACLES — Trees & Rocks
 * ============================================= */
function generateObstacles(scene: Phaser.Scene) {
  generateTreeTexture(scene);
  generateRockTexture(scene);
}

function generateTreeTexture(scene: Phaser.Scene) {
  const size = 60;
  const cx = size / 2;
  const [canvas, ctx] = createCanvas(size, size);

  // Ground shadow (soft ellipse)
  const shadowGrad = ctx.createRadialGradient(cx, 50, 2, cx, 50, 18);
  shadowGrad.addColorStop(0, "rgba(0,0,0,0.18)");
  shadowGrad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = shadowGrad;
  ctx.beginPath();
  ctx.ellipse(cx, 50, 18, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Trunk with bark texture
  const trunkGrad = ctx.createLinearGradient(cx - 5, 30, cx + 5, 30);
  trunkGrad.addColorStop(0, "#6a4a0a");
  trunkGrad.addColorStop(0.3, "#8a6a24");
  trunkGrad.addColorStop(0.6, "#7a5a14");
  trunkGrad.addColorStop(1, "#5a3a04");
  ctx.fillStyle = trunkGrad;
  ctx.fillRect(cx - 5, 28, 10, 22);

  // Bark detail lines
  ctx.strokeStyle = "rgba(50,30,0,0.25)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx - 2, 30); ctx.lineTo(cx - 1, 48); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + 2, 32); ctx.lineTo(cx + 3, 46); ctx.stroke();
  // Bark highlight
  ctx.fillStyle = "rgba(180, 140, 70, 0.3)";
  ctx.fillRect(cx + 2, 29, 2, 20);
  // Trunk base roots
  ctx.fillStyle = "#6a4a0a";
  ctx.beginPath(); ctx.ellipse(cx - 4, 49, 3, 2, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + 4, 49, 3, 2, 0.3, 0, Math.PI * 2); ctx.fill();

  // Canopy layers (back to front, dark to light)
  // Back foliage (darkest, largest)
  ctx.fillStyle = "#2a7a1a";
  ctx.beginPath(); ctx.arc(cx + 3, 25, 19, 0, Math.PI * 2); ctx.fill();

  // Middle foliage
  ctx.fillStyle = "#3a9a2a";
  ctx.beginPath(); ctx.arc(cx - 3, 22, 17, 0, Math.PI * 2); ctx.fill();

  // Front foliage (lightest, smallest)
  ctx.fillStyle = "#4aaa3a";
  ctx.beginPath(); ctx.arc(cx, 18, 15, 0, Math.PI * 2); ctx.fill();

  // Top-left highlight (sun direction)
  const leafGrad = ctx.createRadialGradient(cx - 6, 10, 2, cx, 20, 17);
  leafGrad.addColorStop(0, "rgba(150, 245, 130, 0.5)");
  leafGrad.addColorStop(0.5, "rgba(130, 220, 110, 0.2)");
  leafGrad.addColorStop(1, "rgba(130, 220, 110, 0)");
  ctx.fillStyle = leafGrad;
  ctx.beginPath(); ctx.arc(cx, 18, 15, 0, Math.PI * 2); ctx.fill();

  // Bottom canopy shadow
  ctx.fillStyle = "rgba(20,50,10,0.15)";
  ctx.beginPath();
  ctx.ellipse(cx, 30, 14, 5, 0, 0, Math.PI);
  ctx.fill();

  // Leaf detail dots (scattered)
  const leafColors = ["#2a7a1a", "#3a8a2a", "#5abc4a"];
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const r = 7 + (i % 3) * 3.5;
    ctx.fillStyle = leafColors[i % 3];
    ctx.beginPath();
    ctx.arc(cx + Math.cos(angle) * r, 20 + Math.sin(angle) * r, 2.5 + (i % 2), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Small fruits/flowers
  ctx.fillStyle = "#ff6b6b";
  ctx.beginPath(); ctx.arc(cx + 10, 15, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#ffd93d";
  ctx.beginPath(); ctx.arc(cx - 6, 27, 2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#ff9ecf";
  ctx.beginPath(); ctx.arc(cx + 4, 7, 2, 0, Math.PI * 2); ctx.fill();
  // Fruit highlights
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.beginPath(); ctx.arc(cx + 9, 14, 1, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx - 7, 26, 0.8, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + 3, 6, 0.8, 0, Math.PI * 2); ctx.fill();

  // Canopy outline (subtle)
  ctx.strokeStyle = "rgba(20,50,10,0.25)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, 18, 15.5, 0, Math.PI * 2); ctx.stroke();

  canvasToTexture(scene, canvas, "obstacle-tree");
}

function generateRockTexture(scene: Phaser.Scene) {
  const size = 60;
  const cx = size / 2;
  const cy = size / 2;
  const [canvas, ctx] = createCanvas(size, size);

  // Ground shadow (soft)
  const shadowGrad = ctx.createRadialGradient(cx, cy + 14, 2, cx, cy + 14, 22);
  shadowGrad.addColorStop(0, "rgba(0,0,0,0.18)");
  shadowGrad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = shadowGrad;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 14, 22, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Main rock body (3D lighting with multi-stop gradient)
  const rockGrad = ctx.createLinearGradient(cx - 22, cy - 14, cx + 22, cy + 14);
  rockGrad.addColorStop(0, "#c0c0c0");
  rockGrad.addColorStop(0.25, "#aaaaaa");
  rockGrad.addColorStop(0.5, "#959595");
  rockGrad.addColorStop(0.75, "#7a7a7a");
  rockGrad.addColorStop(1, "#606060");
  ctx.fillStyle = rockGrad;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 2, 22, 16, 0, 0, Math.PI * 2);
  ctx.fill();

  // Top surface (lighter, top-down light)
  const topGrad = ctx.createRadialGradient(cx - 6, cy - 7, 2, cx, cy - 2, 20);
  topGrad.addColorStop(0, "#d5d5d5");
  topGrad.addColorStop(0.4, "#b5b5b5");
  topGrad.addColorStop(1, "rgba(170,170,170,0)");
  ctx.fillStyle = topGrad;
  ctx.beginPath();
  ctx.ellipse(cx, cy - 2, 18, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Bottom shadow (ambient occlusion)
  ctx.fillStyle = "rgba(40,40,40,0.3)";
  ctx.beginPath();
  ctx.ellipse(cx, cy + 12, 18, 5, 0, 0, Math.PI);
  ctx.fill();

  // Specular highlight (main)
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.beginPath();
  ctx.ellipse(cx - 7, cy - 9, 8, 4, -0.3, 0, Math.PI * 2);
  ctx.fill();
  // Bright hot spot
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.beginPath(); ctx.arc(cx - 9, cy - 9, 3, 0, Math.PI * 2); ctx.fill();
  // Tiny sharp highlight
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.beginPath(); ctx.arc(cx - 8, cy - 10, 1.2, 0, Math.PI * 2); ctx.fill();

  // Crack details (multiple cracks for realism)
  ctx.strokeStyle = "rgba(60,60,60,0.4)";
  ctx.lineWidth = 1;
  ctx.lineCap = "round";
  // Main crack
  ctx.beginPath();
  ctx.moveTo(cx - 8, cy - 3);
  ctx.lineTo(cx - 1, cy + 2);
  ctx.lineTo(cx + 4, cy);
  ctx.stroke();
  // Secondary crack
  ctx.beginPath();
  ctx.moveTo(cx + 5, cy - 5);
  ctx.lineTo(cx + 9, cy - 1);
  ctx.stroke();
  // Minor fissure
  ctx.strokeStyle = "rgba(80,80,80,0.25)";
  ctx.beginPath();
  ctx.moveTo(cx - 3, cy + 5);
  ctx.lineTo(cx + 2, cy + 7);
  ctx.stroke();

  // Moss patches on top
  ctx.fillStyle = "#5a9a3a";
  ctx.globalAlpha = 0.7;
  ctx.beginPath(); ctx.arc(cx + 8, cy - 10, 5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + 4, cy - 12, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + 11, cy - 7, 3, 0, Math.PI * 2); ctx.fill();
  // Moss highlight
  ctx.fillStyle = "#8ace6a";
  ctx.beginPath(); ctx.arc(cx + 6, cy - 12, 2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + 9, cy - 8, 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;

  // Subtle outline
  ctx.strokeStyle = "rgba(40,40,40,0.18)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 2, 22.5, 16.5, 0, 0, Math.PI * 2);
  ctx.stroke();

  canvasToTexture(scene, canvas, "obstacle-rock");
}

function generateParticles(scene: Phaser.Scene) {
  // Hit particle (star burst)
  {
    const [canvas, ctx] = createCanvas(16, 16);
    const grad = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    grad.addColorStop(0, "#ffffa0");
    grad.addColorStop(0.5, "#ffd93d");
    grad.addColorStop(1, "rgba(255,217,61,0)");
    ctx.fillStyle = grad;
    // Diamond shape
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(16, 8);
    ctx.lineTo(8, 16);
    ctx.lineTo(0, 8);
    ctx.closePath();
    ctx.fill();
    canvasToTexture(scene, canvas, "particle-star");
  }

  // Water splash
  {
    const [canvas, ctx] = createCanvas(8, 8);
    const grad = ctx.createRadialGradient(4, 4, 0, 4, 4, 4);
    grad.addColorStop(0, "#a0e4ff");
    grad.addColorStop(1, "rgba(108,196,232,0)");
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(4, 4, 4, 0, Math.PI * 2); ctx.fill();
    canvasToTexture(scene, canvas, "particle-water");
  }

  // Death poof
  {
    const [canvas, ctx] = createCanvas(12, 12);
    const grad = ctx.createRadialGradient(6, 6, 0, 6, 6, 6);
    grad.addColorStop(0, "rgba(255,255,255,0.9)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(6, 6, 6, 0, Math.PI * 2); ctx.fill();
    canvasToTexture(scene, canvas, "particle-poof");
  }
}
