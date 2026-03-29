import Phaser from "phaser";
import { Room } from "colyseus.js";
import { getRoom, sendInput } from "../network/client";
import { generateAssets } from "./AssetGenerator";
import { SoundManager } from "../audio/SoundManager";
import { TouchControls } from "../controls/TouchControls";
import { SkillBar } from "../ui/SkillBar";
import { playRotToggle, playPhaseShift, playDismember } from "../audio/SoundManager";
import {
  COLORS, MAP_WIDTH, MAP_HEIGHT, PLAYER_RADIUS,
  HOOK_COOLDOWN, TEAM_LEFT, TEAM_RIGHT, PLAYER_MAX_HP,
} from "shared";

// Skill constants (matching server)
const PHASE_COOLDOWN = 12000;
const DISMEMBER_COOLDOWN = 10000;
const ROT_RADIUS = 80;

interface PlayerSprite {
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Image;
  nameText: Phaser.GameObjects.Text;
  hpBarBg: Phaser.GameObjects.Rectangle;
  hpBarFill: Phaser.GameObjects.Rectangle;
  hpText: Phaser.GameObjects.Text;
  cooldownArc: Phaser.GameObjects.Graphics;
  hookChainGfx: Phaser.GameObjects.Graphics;
  hookHead: Phaser.GameObjects.Image | null;
  aimLine: Phaser.GameObjects.Graphics;
  // Skill visuals
  rotGfx: Phaser.GameObjects.Graphics;
  phaseGfx: Phaser.GameObjects.Graphics;
  dismemberGfx: Phaser.GameObjects.Graphics;
  // For interpolation
  targetX: number;
  targetY: number;
  serverAlive: boolean;
  serverTeam: number;
  // For sound triggers
  prevHookState: string;
  prevAlive: boolean;
  // Skill state cache
  rotActive: boolean;
  phaseTimer: number;
  dismemberTimer: number;
  dismemberTarget: string;
}

export class GameScene extends Phaser.Scene {
  private room!: Room;
  private players: Map<string, PlayerSprite> = new Map();
  private keys!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
  private skillKeys!: {
    Q: Phaser.Input.Keyboard.Key;
    W: Phaser.Input.Keyboard.Key;
    E: Phaser.Input.Keyboard.Key;
    R: Phaser.Input.Keyboard.Key;
  };
  private myId: string = "";
  private mouseWorldX: number = 0;
  private mouseWorldY: number = 0;
  private wantHook: boolean = false;
  private scoreText!: Phaser.GameObjects.Text;
  private soundManager!: SoundManager;
  private touchControls: TouchControls | null = null;
  private skillBar!: SkillBar;

  constructor() {
    super({ key: "GameScene" });
  }

  create() {
    const room = getRoom();
    if (!room) return;
    this.room = room;
    this.myId = room.sessionId;

    // Generate all assets
    generateAssets(this);

    // Initialize sound manager
    this.soundManager = new SoundManager();

    // Draw map
    this.add.image(MAP_WIDTH / 2, MAP_HEIGHT / 2, "map");

    // Setup camera
    this.cameras.main.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);

    // Score display
    this.scoreText = this.add.text(MAP_WIDTH / 2, 16, "0 : 0", {
      fontFamily: "Nunito, sans-serif",
      fontSize: "28px",
      fontStyle: "bold",
      color: "#ffffff",
      stroke: "#333333",
      strokeThickness: 4,
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(100);

    // Team labels
    this.add.text(MAP_WIDTH / 2 - 60, 18, "🌿", {
      fontSize: "20px",
    }).setOrigin(1, 0).setDepth(100);
    this.add.text(MAP_WIDTH / 2 + 60, 18, "🌸", {
      fontSize: "20px",
    }).setOrigin(0, 0).setDepth(100);

    // Skill bar UI
    this.skillBar = new SkillBar();
    this.skillBar.onSkillClick((skillId) => {
      if (skillId === "hook") {
        this.wantHook = true;
      } else {
        this.room.send("skill", { skill: skillId });
      }
    });

    // --- Input setup: touch or keyboard ---
    if (TouchControls.isMobile()) {
      this.touchControls = new TouchControls(this);
      this.touchControls.setup();
    } else {
      // Keyboard input (desktop)
      if (this.input.keyboard) {
        this.keys = {
          W: this.input.keyboard.addKey("W"),
          A: this.input.keyboard.addKey("A"),
          S: this.input.keyboard.addKey("S"),
          D: this.input.keyboard.addKey("D"),
        };
        this.skillKeys = {
          Q: this.input.keyboard.addKey("Q"),
          W: this.input.keyboard.addKey("W"), // shared with movement W
          E: this.input.keyboard.addKey("E"),
          R: this.input.keyboard.addKey("R"),
        };
      }

      // Mouse
      this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
        this.mouseWorldX = pointer.worldX;
        this.mouseWorldY = pointer.worldY;
      });

      this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        // Resume audio on first user interaction
        this.soundManager.tryResume();
        if (pointer.leftButtonDown()) {
          this.wantHook = true;
        }
      });
    }

    // Resume audio on any touch (for mobile)
    if (this.touchControls) {
      this.input.on("pointerdown", () => {
        this.soundManager.tryResume();
      });
    }

    // Listen for state changes
    this.room.state.players.onAdd((player: any, key: string) => {
      this.addPlayer(key, player);
    });

    this.room.state.players.onRemove((_player: any, key: string) => {
      this.removePlayer(key);
    });

    // Kill feed + effects
    this.room.onMessage("kill", (data: any) => {
      this.showKillFeed(data.killerName, data.victimName, data.killerTeam, data.suicide);
      this.soundManager.playKill();

      // Find victim position for celebration effect
      this.players.forEach((sprite) => {
        // Match by nickname — victimName is what the server sends
        if (sprite.nameText.text === data.victimName) {
          this.spawnKillEffect(sprite.container.x, sprite.container.y);
        }
      });

      // Subtle screen flash on kill
      this.showKillFlash();
    });

    // Hook hit notification
    this.room.onMessage("hookHit", (data: any) => {
      this.cameras.main.shake(100, 0.005);
      this.soundManager.playHookHit();
    });

    // Phase shift notification
    this.room.onMessage("phaseShift", (_data: any) => {
      playPhaseShift();
    });

    // Dismember notification
    this.room.onMessage("dismember", (_data: any) => {
      playDismember();
    });

    // Game over is handled by main.ts DOM centralization
  }

  update(_time: number, delta: number) {
    if (!this.room) return;

    // Read input from touch controls or keyboard
    let dx = 0, dy = 0;
    let aimX = this.mouseWorldX;
    let aimY = this.mouseWorldY;
    let hook = false;

    if (this.touchControls) {
      this.touchControls.update();
      dx = this.touchControls.dx;
      dy = this.touchControls.dy;
      aimX = this.touchControls.aimX;
      aimY = this.touchControls.aimY;
      hook = this.touchControls.wantHook;
      // One-shot: reset after reading
      if (hook) this.touchControls.wantHook = false;
    } else {
      if (this.keys) {
        if (this.keys.A.isDown) dx -= 1;
        if (this.keys.D.isDown) dx += 1;
        if (this.keys.W.isDown) dy -= 1;
        if (this.keys.S.isDown) dy += 1;
      }
      hook = this.wantHook;
      this.wantHook = false;
    }

    // Skill key presses (desktop only)
    if (this.skillKeys) {
      if (Phaser.Input.Keyboard.JustDown(this.skillKeys.Q)) {
        this.wantHook = true;
      }
      if (Phaser.Input.Keyboard.JustDown(this.skillKeys.E)) {
        this.room.send("skill", { skill: "phase" });
      }
      if (Phaser.Input.Keyboard.JustDown(this.skillKeys.R)) {
        this.room.send("skill", { skill: "dismember" });
      }
      // W is shared with movement — JustDown toggles rot AND moves up.
      // This is intentional: pressing W toggles rot + moves up simultaneously.
      if (Phaser.Input.Keyboard.JustDown(this.skillKeys.W)) {
        this.room.send("skill", { skill: "rot" });
      }
    }

    sendInput({ dx, dy, aimX, aimY, hook });

    // Update skill bar cooldowns for local player
    const myPlayer = this.players.get(this.myId);
    if (myPlayer) {
      // Hook cooldown
      const myState = this.room.state.players.get(this.myId) as any;
      if (myState) {
        this.skillBar.updateCooldown("hook", myState.hookCooldown / HOOK_COOLDOWN);
        this.skillBar.updateCooldown("phase", myState.phaseCooldown / PHASE_COOLDOWN);
        this.skillBar.updateCooldown("dismember", myState.dismemberCooldown / DISMEMBER_COOLDOWN);
        this.skillBar.setActive("rot", myState.rotActive);
      }
    }

    // Update score
    this.scoreText.setText(
      `${this.room.state.leftScore} : ${this.room.state.rightScore}`
    );

    // Update dismember visuals (draw connection lines between attacker and target)
    this.players.forEach((sprite) => {
      sprite.dismemberGfx.clear();
      if (sprite.dismemberTimer > 0 && sprite.dismemberTarget) {
        const targetSprite = this.players.get(sprite.dismemberTarget);
        if (targetSprite) {
          const dx = targetSprite.container.x - sprite.container.x;
          const dy = targetSprite.container.y - sprite.container.y;

          // Red pulsing connection line
          const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.01);
          sprite.dismemberGfx.lineStyle(3, 0xff4444, 0.4 + pulse * 0.4);
          sprite.dismemberGfx.beginPath();
          sprite.dismemberGfx.moveTo(0, 0);
          sprite.dismemberGfx.lineTo(dx, dy);
          sprite.dismemberGfx.strokePath();

          // Shake effect on target (small random offset)
          const shakeX = (Math.random() - 0.5) * 4;
          const shakeY = (Math.random() - 0.5) * 4;
          targetSprite.container.x += shakeX;
          targetSprite.container.y += shakeY;
        }
      }
    });

    // Update all player sprites with interpolation
    this.players.forEach((sprite, id) => {
      const lerpFactor = Math.min(1, delta / 50); // smooth 50ms

      // Interpolate position
      const curX = sprite.container.x;
      const curY = sprite.container.y;
      sprite.container.x = curX + (sprite.targetX - curX) * lerpFactor;
      sprite.container.y = curY + (sprite.targetY - curY) * lerpFactor;

      // Update alive state
      if (!sprite.serverAlive) {
        sprite.body.setTexture("player-dead");
        sprite.body.setAlpha(0.5);
        sprite.body.clearTint();
        sprite.rotGfx.clear();
      } else {
        const tex = sprite.serverTeam === TEAM_LEFT ? "player-left" : "player-right";
        if (sprite.body.texture.key !== tex) {
          sprite.body.setTexture(tex);
        }
        // Only restore alpha if not phased
        if (sprite.phaseTimer <= 0 && sprite.body.alpha < 1) {
          sprite.body.setAlpha(1);
          sprite.body.clearTint();
        }
      }
    });

    // Camera follow my player
    const mySprite = this.players.get(this.myId);
    if (mySprite) {
      this.cameras.main.centerOn(mySprite.container.x, mySprite.container.y);
    }
  }

  private addPlayer(sessionId: string, player: any) {
    const isLeft = player.team === TEAM_LEFT;
    const texKey = isLeft ? "player-left" : "player-right";

    // Player body
    const body = this.add.image(0, 0, texKey);

    // Nickname
    const nameText = this.add.text(0, -PLAYER_RADIUS - 16, player.nickname, {
      fontFamily: "Nunito, sans-serif",
      fontSize: "12px",
      fontStyle: "bold",
      color: "#ffffff",
      stroke: "#333333",
      strokeThickness: 3,
    }).setOrigin(0.5);

    // HP bar
    const hpBarBg = this.add.rectangle(0, PLAYER_RADIUS + 8, 50, 5, COLORS.hpBarBg);
    const hpBarFill = this.add.rectangle(0, PLAYER_RADIUS + 8, 50, 5, 0x7ecf7e); // start green

    // HP text below the bar
    const hpText = this.add.text(0, PLAYER_RADIUS + 16, `${PLAYER_MAX_HP}/${PLAYER_MAX_HP}`, {
      fontFamily: "Nunito, sans-serif",
      fontSize: "9px",
      color: "#ffffff",
      stroke: "#333333",
      strokeThickness: 2,
    }).setOrigin(0.5, 0);

    // Cooldown indicator
    const cooldownArc = this.add.graphics();

    // Hook chain graphics
    const hookChainGfx = this.add.graphics();

    // Aim line (only for local player)
    const aimLine = this.add.graphics();

    // Skill visual graphics
    const rotGfx = this.add.graphics();
    const phaseGfx = this.add.graphics();
    const dismemberGfx = this.add.graphics();

    // Container
    const container = this.add.container(player.x, player.y, [
      rotGfx, hookChainGfx, aimLine, body, nameText, hpBarBg, hpBarFill, hpText, cooldownArc, phaseGfx, dismemberGfx,
    ]);
    container.setDepth(10);

    const spriteData: PlayerSprite = {
      container,
      body,
      nameText,
      hpBarBg,
      hpBarFill,
      hpText,
      cooldownArc,
      hookChainGfx,
      hookHead: null,
      aimLine,
      rotGfx,
      phaseGfx,
      dismemberGfx,
      targetX: player.x,
      targetY: player.y,
      serverAlive: player.alive,
      serverTeam: player.team,
      prevHookState: "idle",
      prevAlive: player.alive,
      rotActive: false,
      phaseTimer: 0,
      dismemberTimer: 0,
      dismemberTarget: "",
    };

    this.players.set(sessionId, spriteData);

    // Listen for changes
    player.listen("x", (value: number) => { spriteData.targetX = value; });
    player.listen("y", (value: number) => { spriteData.targetY = value; });
    player.listen("alive", (value: boolean) => {
      const wasAlive = spriteData.serverAlive;
      spriteData.serverAlive = value;

      // Respawn sound: dead -> alive, only for local player
      if (!wasAlive && value && sessionId === this.myId) {
        this.soundManager.playRespawn();
      }
    });

    player.listen("hp", (value: number) => {
      const pct = value / PLAYER_MAX_HP;
      spriteData.hpBarFill.setScale(pct, 1);
      spriteData.hpBarFill.setX(-25 * (1 - pct)); // half of 50px width
      // Color: green -> yellow -> red
      if (pct > 0.6) {
        spriteData.hpBarFill.setFillStyle(0x7ecf7e); // green
      } else if (pct > 0.3) {
        spriteData.hpBarFill.setFillStyle(0xe8d44d); // yellow
      } else {
        spriteData.hpBarFill.setFillStyle(0xff6b6b); // red
      }
      // Update HP text
      spriteData.hpText.setText(`${Math.ceil(value)}/${PLAYER_MAX_HP}`);
    });

    // === Skill state listeners ===

    // Rot visual: green AOE circle
    player.listen("rotActive", (value: boolean) => {
      spriteData.rotActive = value;
      spriteData.rotGfx.clear();
      if (value) {
        // Semi-transparent green circle
        spriteData.rotGfx.fillStyle(0x44ff44, 0.15);
        spriteData.rotGfx.fillCircle(0, 0, ROT_RADIUS);
        spriteData.rotGfx.lineStyle(2, 0x44ff44, 0.4);
        spriteData.rotGfx.strokeCircle(0, 0, ROT_RADIUS);

        // Small "stink cloud" dots
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2;
          const r = ROT_RADIUS * 0.6;
          spriteData.rotGfx.fillStyle(0x88ff88, 0.3);
          spriteData.rotGfx.fillCircle(Math.cos(angle) * r, Math.sin(angle) * r, 4);
        }

        // Play sound for local player
        if (sessionId === this.myId) {
          playRotToggle(true);
        }
      } else {
        if (sessionId === this.myId) {
          playRotToggle(false);
        }
      }
    });

    // Phase Shift visual: translucent + sparkle
    player.listen("phaseTimer", (value: number) => {
      spriteData.phaseTimer = value;
      if (value > 0) {
        spriteData.body.setAlpha(0.3);
        spriteData.body.setTint(0x88ccff);

        // Sparkle effect
        spriteData.phaseGfx.clear();
        spriteData.phaseGfx.fillStyle(0xffffff, 0.6);
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2 + (value * 0.01);
          const r = PLAYER_RADIUS + 8;
          spriteData.phaseGfx.fillCircle(
            Math.cos(angle) * r,
            Math.sin(angle) * r,
            2
          );
        }
      } else {
        spriteData.phaseGfx.clear();
        // Restore alpha only if alive
        if (spriteData.serverAlive) {
          spriteData.body.setAlpha(1);
          spriteData.body.clearTint();
        }
      }
    });

    // Dismember visual: connection line + shake on target
    player.listen("dismemberTimer", (value: number) => {
      spriteData.dismemberTimer = value;
    });
    player.listen("dismemberTarget", (value: string) => {
      spriteData.dismemberTarget = value;
    });

    player.listen("hookCooldown", (value: number) => {
      spriteData.cooldownArc.clear();
      if (value > 0) {
        const pct = value / HOOK_COOLDOWN;
        spriteData.cooldownArc.lineStyle(2, COLORS.cooldownNotReady, 0.6);
        spriteData.cooldownArc.beginPath();
        spriteData.cooldownArc.arc(0, 0, PLAYER_RADIUS + 4,
          -Math.PI / 2, -Math.PI / 2 + (1 - pct) * Math.PI * 2, false);
        spriteData.cooldownArc.strokePath();
      }
    });

    // Hook state rendering + sound trigger
    const hookSchema = player.hook;
    const updateHook = () => {
      spriteData.hookChainGfx.clear();
      const state = hookSchema.state;

      // Hook throw sound: idle -> flying, only for local player
      if (sessionId === this.myId &&
          spriteData.prevHookState === "idle" && state === "flying") {
        this.soundManager.playHookThrow();
      }
      spriteData.prevHookState = state;

      if (state === "idle") return;

      const hx = hookSchema.x - spriteData.container.x;
      const hy = hookSchema.y - spriteData.container.y;

      // Draw chain
      spriteData.hookChainGfx.lineStyle(3, COLORS.hookChain, 0.8);
      spriteData.hookChainGfx.beginPath();
      spriteData.hookChainGfx.moveTo(0, 0);
      spriteData.hookChainGfx.lineTo(hx, hy);
      spriteData.hookChainGfx.strokePath();

      // Draw chain links along the line
      const dist = Math.sqrt(hx * hx + hy * hy);
      const steps = Math.floor(dist / 12);
      spriteData.hookChainGfx.fillStyle(COLORS.hookChain, 1);
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        spriteData.hookChainGfx.fillCircle(hx * t, hy * t, 2);
      }

      // Draw hook head
      spriteData.hookChainGfx.fillStyle(COLORS.hookHead);
      spriteData.hookChainGfx.fillCircle(hx, hy, 6);
      spriteData.hookChainGfx.fillStyle(0xffffff, 0.3);
      spriteData.hookChainGfx.fillCircle(hx - 2, hy - 2, 2);
    };

    hookSchema.listen("x", updateHook);
    hookSchema.listen("y", updateHook);
    hookSchema.listen("state", updateHook);

    // Aim line for local player
    if (sessionId === this.myId) {
      this.events.on("update", () => {
        spriteData.aimLine.clear();
        if (!spriteData.serverAlive) return;
        if (hookSchema.state !== "idle") return;

        // For touch controls, use aimX/aimY; for desktop, use mouseWorldX/Y
        const targetX = this.touchControls ? this.touchControls.aimX : this.mouseWorldX;
        const targetY = this.touchControls ? this.touchControls.aimY : this.mouseWorldY;

        const dx = targetX - spriteData.container.x;
        const dy = targetY - spriteData.container.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len === 0) return;

        const nx = dx / len;
        const ny = dy / len;

        // Dotted aim line
        spriteData.aimLine.lineStyle(1.5, 0xffffff, 0.3);
        for (let i = 0; i < 8; i++) {
          const s = 30 + i * 16;
          const e = s + 8;
          spriteData.aimLine.beginPath();
          spriteData.aimLine.moveTo(nx * s, ny * s);
          spriteData.aimLine.lineTo(nx * e, ny * e);
          spriteData.aimLine.strokePath();
        }
      });
    }
  }

  private removePlayer(sessionId: string) {
    const sprite = this.players.get(sessionId);
    if (sprite) {
      sprite.container.destroy();
      this.players.delete(sessionId);
    }
  }

  private showKillFeed(killer: string, victim: string, killerTeam: number, suicide?: boolean) {
    const feed = document.getElementById("kill-feed")!;
    const entry = document.createElement("div");
    entry.className = "kill-entry";
    const teamEmoji = killerTeam === TEAM_LEFT ? "🌿" : "🌸";
    if (suicide) {
      entry.innerHTML = `${teamEmoji} <b>${killer}</b> ☠️ 自爆了`;
    } else {
      entry.innerHTML = `${teamEmoji} <b>${killer}</b> 🎣 ${victim}`;
    }
    feed.appendChild(entry);

    // Remove after 4 seconds
    setTimeout(() => {
      entry.style.opacity = "0";
      entry.style.transition = "opacity 0.5s";
      setTimeout(() => entry.remove(), 500);
    }, 4000);

    // Keep max 5 entries
    while (feed.children.length > 5) {
      feed.removeChild(feed.children[0]);
    }
  }

  /** Particle burst at kill location using existing textures */
  private spawnKillEffect(worldX: number, worldY: number) {
    // Star burst particles
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 / 8) * i;
      const speed = 80 + Math.random() * 60;
      const star = this.add.image(worldX, worldY, "particle-star")
        .setDepth(50)
        .setScale(0.5 + Math.random() * 0.5)
        .setAlpha(1);

      this.tweens.add({
        targets: star,
        x: worldX + Math.cos(angle) * speed,
        y: worldY + Math.sin(angle) * speed,
        alpha: 0,
        scale: 0,
        duration: 400 + Math.random() * 200,
        ease: "Power2",
        onComplete: () => star.destroy(),
      });
    }

    // Poof cloud particles
    for (let i = 0; i < 5; i++) {
      const ox = (Math.random() - 0.5) * 30;
      const oy = (Math.random() - 0.5) * 30;
      const poof = this.add.image(worldX + ox, worldY + oy, "particle-poof")
        .setDepth(49)
        .setScale(0.8 + Math.random() * 0.8)
        .setAlpha(0.7);

      this.tweens.add({
        targets: poof,
        y: worldY + oy - 20 - Math.random() * 20,
        alpha: 0,
        scale: 2,
        duration: 500 + Math.random() * 200,
        ease: "Power1",
        onComplete: () => poof.destroy(),
      });
    }
  }

  /** Brief white flash overlay on kill (50ms, very subtle) */
  private showKillFlash() {
    const cam = this.cameras.main;
    const flash = this.add.rectangle(
      cam.scrollX + cam.width / 2,
      cam.scrollY + cam.height / 2,
      cam.width, cam.height,
      0xffffff, 0.1,
    ).setScrollFactor(0).setDepth(150);

    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 50,
      onComplete: () => flash.destroy(),
    });
  }
}
