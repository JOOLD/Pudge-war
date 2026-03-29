import Phaser from "phaser";
import { Room } from "colyseus.js";
import { getRoom, sendInput, sendBuy } from "../network/client";
import { generateAssets } from "./AssetGenerator";
import { SoundManager } from "../audio/SoundManager";
import { TouchControls } from "../controls/TouchControls";
import { SkillBar } from "../ui/SkillBar";
import { playRotToggle, playPhaseShift, playDismember } from "../audio/SoundManager";
import {
  COLORS, MAP_WIDTH, MAP_HEIGHT, PLAYER_RADIUS,
  HOOK_COOLDOWN, TEAM_LEFT, TEAM_RIGHT, PLAYER_MAX_HP, OBSTACLES,
  SPAWN_X_LEFT, SPAWN_X_RIGHT,
} from "shared";
import type { HookModifier } from "shared";
import { ShopUI } from "../ui/ShopUI";

// Map hook modifier to chain color
function getHookModColor(modifier: string): number {
  switch (modifier as HookModifier) {
    case 'flame': return 0xff6600;
    case 'freeze': return 0x66ccff;
    case 'lifesteal': return 0xff3333;
    case 'rupture': return 0x9933ff;
    default: return COLORS.hookChain;
  }
}

// Skill constants (matching server)
const PHASE_COOLDOWN = 12000;
const DISMEMBER_COOLDOWN = 10000;
const ROT_RADIUS = 80;

interface PlayerSprite {
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Sprite;
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
  hookRangeGfx: Phaser.GameObjects.Graphics;
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
  // Hook modifier color (Lane C)
  hookModColor: number;
}

export class GameScene extends Phaser.Scene {
  private room!: Room;
  private players: Map<string, PlayerSprite> = new Map();
  private freeCamKeys!: {
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
  private moveTargetX: number = -1;
  private moveTargetY: number = -1;
  private hasMovetarget: boolean = false;
  private scoreText!: Phaser.GameObjects.Text;
  private soundManager!: SoundManager;
  private touchControls: TouchControls | null = null;
  private skillBar!: SkillBar;
  private localPlayerDead: boolean = false;
  private freeCamX: number = 0;
  private freeCamY: number = 0;
  private moveIndicator!: Phaser.GameObjects.Graphics;
  private shopUI!: ShopUI;
  private goldText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: "GameScene" });
  }

  private inputAccum: number = 0;

  preload() {
    // LPC characters: 576x256 = 9 cols x 4 rows, 64x64 per frame
    // Row 0=up, 1=left, 2=down, 3=right
    this.load.spritesheet('char-left', '/game-assets/char-left.png', {
      frameWidth: 64, frameHeight: 64,
    });
    this.load.spritesheet('char-right', '/game-assets/char-right.png', {
      frameWidth: 64, frameHeight: 64,
    });

    // Shadow for characters
    this.load.image('shadow', '/game-assets/shadow.png');

    // UI
    this.load.image('heart', '/game-assets/heart.png');
  }

  create() {
    const room = getRoom();
    if (!room) return;
    this.room = room;
    this.myId = room.sessionId;

    // Generate map + hook textures (procedural)
    generateAssets(this);

    // Create LPC character walk animations
    // LPC layout: 9 cols x 4 rows, 64x64 per frame
    // Row 0 (frames 0-8): facing up, Row 1 (9-17): facing left
    // Row 2 (18-26): facing down, Row 3 (27-35): facing right
    // Frame 0 in each row = idle/standing, frames 1-8 = walk cycle
    ['left', 'right'].forEach(team => {
      const key = `char-${team}`;
      if (!this.anims.exists(`${team}-walk-up`)) {
        this.anims.create({ key: `${team}-walk-up`, frames: this.anims.generateFrameNumbers(key, { start: 1, end: 8 }), frameRate: 10, repeat: -1 });
        this.anims.create({ key: `${team}-walk-left`, frames: this.anims.generateFrameNumbers(key, { start: 10, end: 17 }), frameRate: 10, repeat: -1 });
        this.anims.create({ key: `${team}-walk-down`, frames: this.anims.generateFrameNumbers(key, { start: 19, end: 26 }), frameRate: 10, repeat: -1 });
        this.anims.create({ key: `${team}-walk-right`, frames: this.anims.generateFrameNumbers(key, { start: 28, end: 35 }), frameRate: 10, repeat: -1 });
        // Idle: facing down standing frame
        this.anims.create({ key: `${team}-idle`, frames: [{ key, frame: 18 }], frameRate: 1 });
      }
    });

    // Initialize sound manager
    this.soundManager = new SoundManager();

    // Draw map
    this.add.image(MAP_WIDTH / 2, MAP_HEIGHT / 2, "map");

    // Render obstacles
    OBSTACLES.forEach((obs) => {
      const textureKey = obs.type === 'tree' ? 'obstacle-tree' : 'obstacle-rock';
      const sprite = this.add.image(obs.x, obs.y, textureKey);
      sprite.setDepth(obs.type === 'tree' ? 5 : 3); // Trees above players, rocks below
    });

    // Setup camera
    this.cameras.main.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);

    // Move indicator for right-click movement (desktop only)
    this.moveIndicator = this.add.graphics();
    this.moveIndicator.setDepth(1);

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
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);
    this.add.text(MAP_WIDTH / 2 + 60, 18, "🌸", {
      fontSize: "20px",
    }).setOrigin(0, 0).setScrollFactor(0).setDepth(100);

    // Shop UI (Lane C)
    this.shopUI = new ShopUI((upgradeId: string) => {
      sendBuy(upgradeId);
    });

    // Gold display (in-game HUD, Lane C)
    this.goldText = this.add.text(MAP_WIDTH / 2, 48, '💰 0', {
      fontFamily: 'Nunito, sans-serif',
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#ffd93d',
      stroke: '#333333',
      strokeThickness: 3,
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(100);

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
      this.touchControls.onSkill((skillId) => {
        this.room.send("skill", { skill: skillId });
      });
    } else {
      // Desktop: Dota-style right-click to move + QWER abilities
      // NO WASD movement — WASD is only used for free camera when dead

      // Track mouse position
      this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
        this.mouseWorldX = pointer.worldX;
        this.mouseWorldY = pointer.worldY;
      });

      // Right click = set move destination (Dota-style click-to-move)
      // Left click = fire hook toward mouse
      this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        this.soundManager.tryResume();
        if (pointer.rightButtonDown()) {
          this.moveTargetX = pointer.worldX;
          this.moveTargetY = pointer.worldY;
          this.hasMovetarget = true;
        }
        if (pointer.leftButtonDown()) {
          this.wantHook = true;
        }
      });

      // Disable right-click context menu on game canvas
      this.game.canvas.addEventListener("contextmenu", (e) => e.preventDefault());

      // QWER skill keys + WASD for dead free-cam
      if (this.input.keyboard) {
        this.skillKeys = {
          Q: this.input.keyboard.addKey("Q"),
          W: this.input.keyboard.addKey("W"),
          E: this.input.keyboard.addKey("E"),
          R: this.input.keyboard.addKey("R"),
        };
        this.freeCamKeys = {
          W: this.input.keyboard.addKey("W"),
          A: this.input.keyboard.addKey("A"),
          S: this.input.keyboard.addKey("S"),
          D: this.input.keyboard.addKey("D"),
        };

        // B key to toggle shop (only near spawn, Lane C)
        this.input.keyboard.addKey("B").on("down", () => {
          const myPlayer = this.room.state.players.get(this.myId) as any;
          if (!myPlayer || !myPlayer.alive) return;
          const spawnX = myPlayer.team === TEAM_LEFT ? SPAWN_X_LEFT : SPAWN_X_RIGHT;
          const dist = Math.abs(myPlayer.x - spawnX);
          if (dist < 150) {
            this.shopUI.toggle();
          }
        });
      }
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

    // Hook blocked by obstacle
    this.room.onMessage("hookBlocked", (data: { x: number; y: number; obstacleType: string }) => {
      const count = data.obstacleType === 'tree' ? 6 : 8;
      const color = data.obstacleType === 'tree' ? 0x6acc5a : 0xa8a8a8;
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count;
        const speed = 40 + Math.random() * 30;
        const px = data.x + Math.cos(angle) * 4;
        const py = data.y + Math.sin(angle) * 4;
        const particle = this.add.circle(px, py, data.obstacleType === 'tree' ? 3 : 2, color);
        particle.setDepth(20);
        this.tweens.add({
          targets: particle,
          x: px + Math.cos(angle) * speed,
          y: py + Math.sin(angle) * speed - 10,
          alpha: 0,
          scale: 0.3,
          duration: 400,
          ease: 'Power2',
          onComplete: () => particle.destroy(),
        });
      }
    });

    // Hook bounce effect
    this.room.onMessage("hookBounce", (data: any) => {
      this.showBounceEffect(data.x, data.y);
    });

    // Headshot effect
    this.room.onMessage("headshot", (data: any) => {
      this.showHeadshotEffect(data.x, data.y, data.victimName);
    });

    // Ability purchased notification (Lane C)
    this.room.onMessage("abilityPurchased", (data: any) => {
      if (data.sessionId === this.myId) {
        if (data.ability === 'rot') this.skillBar.setSkillLocked('rot', false);
        if (data.ability === 'phase') this.skillBar.setSkillLocked('phase', false);
      }
    });

    // Hook modifier purchased notification (Lane C)
    this.room.onMessage("hookModPurchased", (_data: any) => {
      // Visual feedback handled by schema listener
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
    // Skip movement input when dead — WASD controls free cam instead
    let dx = 0, dy = 0;
    let aimX = this.mouseWorldX;
    let aimY = this.mouseWorldY;
    let hook = false;

    if (this.touchControls) {
      this.touchControls.update();
      if (!this.localPlayerDead) {
        dx = this.touchControls.dx;
        dy = this.touchControls.dy;
      }
      aimX = this.touchControls.aimX;
      aimY = this.touchControls.aimY;
      hook = this.localPlayerDead ? false : this.touchControls.wantHook;
      // One-shot: reset after reading
      if (this.touchControls.wantHook) this.touchControls.wantHook = false;
    } else {
      // Desktop: click-to-move (Dota style)
      if (this.hasMovetarget && !this.localPlayerDead) {
        const mySprite = this.players.get(this.myId);
        if (mySprite) {
          const pdx = this.moveTargetX - mySprite.container.x;
          const pdy = this.moveTargetY - mySprite.container.y;
          const dist = Math.sqrt(pdx * pdx + pdy * pdy);

          if (dist > 8) {
            // Walk toward destination
            dx = pdx / dist;
            dy = pdy / dist;
          } else {
            // Arrived at destination
            this.hasMovetarget = false;
          }
        }
      }

      hook = this.localPlayerDead ? false : this.wantHook;
      this.wantHook = false;
    }

    // Skill key presses (desktop QWER, not when dead)
    if (this.skillKeys && !this.localPlayerDead) {
      if (Phaser.Input.Keyboard.JustDown(this.skillKeys.Q)) {
        this.wantHook = true;
      }
      if (Phaser.Input.Keyboard.JustDown(this.skillKeys.W)) {
        this.room.send("skill", { skill: "rot" });
      }
      if (Phaser.Input.Keyboard.JustDown(this.skillKeys.E)) {
        this.room.send("skill", { skill: "phase" });
      }
      if (Phaser.Input.Keyboard.JustDown(this.skillKeys.R)) {
        this.room.send("skill", { skill: "dismember" });
      }
    }

    // Throttle input sends to ~30fps (matching server tick rate)
    this.inputAccum += delta;
    if (this.inputAccum >= 33 || hook) {
      this.inputAccum = 0;
      sendInput({ dx, dy, aimX, aimY, hook });
    }

    // Update skill bar cooldowns for local player
    const myPlayer = this.players.get(this.myId);
    if (myPlayer) {
      // Hook cooldown
      const myState = this.room.state.players.get(this.myId) as any;
      if (myState) {
        this.skillBar.updateCooldown("hook", myState.hookCooldown / HOOK_COOLDOWN, myState.hookCooldown);
        this.skillBar.updateCooldown("phase", myState.phaseCooldown / PHASE_COOLDOWN, myState.phaseCooldown);
        this.skillBar.updateCooldown("dismember", myState.dismemberCooldown / DISMEMBER_COOLDOWN, myState.dismemberCooldown);
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

    // Draw range indicators for local player
    const mySprite = this.players.get(this.myId);
    if (mySprite && mySprite.serverAlive) {
      mySprite.hookRangeGfx.clear();
      const myState = this.room.state.players.get(this.myId) as any;
      if (myState && myState.hookCooldown <= 0) {
        // Hook range circle (subtle)
        mySprite.hookRangeGfx.lineStyle(1, 0xffffff, 0.08);
        mySprite.hookRangeGfx.strokeCircle(0, 0, 500);
      }
    } else if (mySprite) {
      mySprite.hookRangeGfx.clear();
    }

    // Update gold display and shop state (Lane C)
    {
      const myState2 = this.room.state.players.get(this.myId) as any;
      if (myState2) {
        this.goldText.setText(`💰 ${myState2.gold}`);
        this.shopUI.updatePlayerState(
          myState2.gold,
          myState2.hasRot,
          myState2.hasPhase,
          myState2.hookModifier
        );
      }
    }

    // Update all player sprites with interpolation
    this.players.forEach((sprite, id) => {
      const lerpFactor = Math.min(1, delta / 33); // smooth over ~33ms (30fps server tick)

      // Record previous position for direction detection
      const prevX = sprite.container.x;
      const prevY = sprite.container.y;

      // Interpolate position
      sprite.container.x = prevX + (sprite.targetX - prevX) * lerpFactor;
      sprite.container.y = prevY + (sprite.targetY - prevY) * lerpFactor;

      const moveDx = sprite.container.x - prevX;
      const moveDy = sprite.container.y - prevY;
      const prefix = sprite.serverTeam === TEAM_LEFT ? 'left' : 'right';
      const isMoving = Math.abs(moveDx) > 0.5 || Math.abs(moveDy) > 0.5;
      const body = sprite.body;

      // Update alive state
      if (!sprite.serverAlive) {
        body.setTint(0x666666);
        body.setAlpha(0.4);
        body.stop(); // Stop animation when dead
        sprite.rotGfx.clear();
      } else {
        const expectedSheet = sprite.serverTeam === TEAM_LEFT ? "char-left" : "char-right";
        if (body.texture.key !== expectedSheet) {
          body.setTexture(expectedSheet, 18);
        }
        // Only restore alpha if not phased
        if (sprite.phaseTimer <= 0 && body.alpha < 1) {
          body.setAlpha(1);
          body.clearTint();
        }

        // Animate based on movement direction (performance: only switch anim when needed)
        if (isMoving) {
          let targetAnim: string;
          if (Math.abs(moveDx) > Math.abs(moveDy)) {
            targetAnim = moveDx > 0 ? `${prefix}-walk-right` : `${prefix}-walk-left`;
          } else {
            targetAnim = moveDy > 0 ? `${prefix}-walk-down` : `${prefix}-walk-up`;
          }
          // Only change animation if different from current
          if (!body.anims.isPlaying || body.anims.currentAnim?.key !== targetAnim) {
            body.play(targetAnim, true);
          }
        } else {
          // Idle: only switch if not already idle
          if (body.anims.currentAnim?.key !== `${prefix}-idle`) {
            body.play(`${prefix}-idle`, true);
          }
        }
      }
    });

    // Move indicator: show destination marker
    this.moveIndicator.clear();
    if (this.hasMovetarget && !this.localPlayerDead && !this.touchControls) {
      this.moveIndicator.lineStyle(1.5, 0xffd93d, 0.3);
      this.moveIndicator.strokeCircle(this.moveTargetX, this.moveTargetY, 6);
      this.moveIndicator.fillStyle(0xffd93d, 0.15);
      this.moveIndicator.fillCircle(this.moveTargetX, this.moveTargetY, 6);
    }

    // Camera: follow player, or free cam when dead
    if (this.localPlayerDead) {
      // Free camera movement with WASD while dead (desktop)
      const camSpeed = 300 * (delta / 1000);
      if (this.freeCamKeys) {
        if (this.freeCamKeys.A.isDown) this.freeCamX -= camSpeed;
        if (this.freeCamKeys.D.isDown) this.freeCamX += camSpeed;
        if (this.freeCamKeys.W.isDown) this.freeCamY -= camSpeed;
        if (this.freeCamKeys.S.isDown) this.freeCamY += camSpeed;
      }
      // Clamp to map bounds
      this.freeCamX = Math.max(0, Math.min(MAP_WIDTH, this.freeCamX));
      this.freeCamY = Math.max(0, Math.min(MAP_HEIGHT, this.freeCamY));
      this.cameras.main.centerOn(this.freeCamX, this.freeCamY);
    } else {
      const mySprite = this.players.get(this.myId);
      if (mySprite) {
        this.cameras.main.centerOn(mySprite.container.x, mySprite.container.y);
      }
    }
  }

  private addPlayer(sessionId: string, player: any) {
    const isLeft = player.team === TEAM_LEFT;
    const sheetKey = isLeft ? "char-left" : "char-right";

    // Player body — LPC spritesheet, frame 18 = facing down idle
    const body = this.add.sprite(0, 0, sheetKey, 18);
    body.setScale(0.8); // 64x64 * 0.8 = ~51px, slightly larger than hitbox for visibility

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
    const hookRangeGfx = this.add.graphics();

    // Container
    const container = this.add.container(player.x, player.y, [
      hookRangeGfx, rotGfx, hookChainGfx, aimLine, body, nameText, hpBarBg, hpBarFill, hpText, cooldownArc, phaseGfx, dismemberGfx,
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
      hookRangeGfx,
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
      hookModColor: COLORS.hookChain,
    };

    this.players.set(sessionId, spriteData);

    // Listen for changes
    player.listen("x", (value: number) => { spriteData.targetX = value; });
    player.listen("y", (value: number) => { spriteData.targetY = value; });
    player.listen("alive", (value: boolean) => {
      const wasAlive = spriteData.serverAlive;
      spriteData.serverAlive = value;

      // Track local player death/respawn for camera, grayscale, and sound
      if (sessionId === this.myId) {
        if (!value && !this.localPlayerDead) {
          // Player just died — enable free cam from current position
          this.localPlayerDead = true;
          this.freeCamX = spriteData.container.x;
          this.freeCamY = spriteData.container.y;
        } else if (value && this.localPlayerDead) {
          // Player respawned — re-lock camera
          this.localPlayerDead = false;
        }

        // Respawn sound: dead -> alive
        if (!wasAlive && value) {
          this.soundManager.playRespawn();
        }
      }
    });

    // Listen for hook modifier changes
    player.listen("hookModifier", (value: string) => {
      spriteData.hookModColor = getHookModColor(value);
    });

    // Listen for skill purchase state (for local player skill bar)
    if (sessionId === this.myId) {
      player.listen("hasRot", (value: boolean) => {
        this.skillBar.setSkillLocked('rot', !value);
      });
      player.listen("hasPhase", (value: boolean) => {
        this.skillBar.setSkillLocked('phase', !value);
      });
    }

    player.listen("hp", (value: number) => {
      const maxHp = player.maxHp || PLAYER_MAX_HP;
      const pct = value / maxHp;
      spriteData.hpBarFill.setScale(Math.max(0, pct), 1);
      spriteData.hpBarFill.setX(-25 * (1 - Math.max(0, pct))); // half of 50px width
      // Color: green -> yellow -> red
      if (pct > 0.6) {
        spriteData.hpBarFill.setFillStyle(0x7ecf7e); // green
      } else if (pct > 0.3) {
        spriteData.hpBarFill.setFillStyle(0xe8d44d); // yellow
      } else {
        spriteData.hpBarFill.setFillStyle(0xff6b6b); // red
      }
      // Update HP text
      spriteData.hpText.setText(`${Math.ceil(value)}/${Math.ceil(maxHp)}`);
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
    player.listen("dismemberTargetId", (value: string) => {
      spriteData.dismemberTarget = value;
    });

    // Slow visual: blue tint when slowed (Lane C)
    player.listen("slowTimer", (value: number) => {
      if (value > 0) {
        spriteData.body.setTint(0x6699ff);
      } else if (spriteData.phaseTimer <= 0) {
        // Only clear tint if not phased and not burning
        if (player.burnTimer <= 0) {
          spriteData.body.clearTint();
        }
      }
    });

    // Burn visual: orange tint when burning (Lane C)
    player.listen("burnTimer", (value: number) => {
      if (value > 0) {
        spriteData.body.setTint(0xff6600);
      } else if (spriteData.phaseTimer <= 0) {
        // Only clear tint if not phased and not slowed
        if (player.slowTimer <= 0) {
          spriteData.body.clearTint();
        }
      }
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

      // Draw chain (color based on hook modifier)
      const chainColor = spriteData.hookModColor;
      spriteData.hookChainGfx.lineStyle(3, chainColor, 0.8);
      spriteData.hookChainGfx.beginPath();
      spriteData.hookChainGfx.moveTo(0, 0);
      spriteData.hookChainGfx.lineTo(hx, hy);
      spriteData.hookChainGfx.strokePath();

      // Draw chain links along the line
      const dist = Math.sqrt(hx * hx + hy * hy);
      const steps = Math.floor(dist / 12);
      spriteData.hookChainGfx.fillStyle(chainColor, 1);
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

  private showBounceEffect(x: number, y: number) {
    // Spark particle burst at bounce point
    const sparkCount = 6;
    for (let i = 0; i < sparkCount; i++) {
      const angle = (Math.PI * 2 * i) / sparkCount;
      const spark = this.add.circle(x, y, 3, 0xffd700, 1).setDepth(20);
      const dist = 20 + Math.random() * 10;
      this.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0,
        scale: 0.2,
        duration: 300,
        ease: "Power2",
        onComplete: () => spark.destroy(),
      });
    }

    // Central flash
    const flash = this.add.circle(x, y, 8, 0xffffff, 0.8).setDepth(20);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 2,
      duration: 200,
      onComplete: () => flash.destroy(),
    });
  }

  private showHeadshotEffect(x: number, y: number, victimName: string) {
    // Large explosion at headshot location
    const ringCount = 3;
    for (let i = 0; i < ringCount; i++) {
      const ring = this.add.circle(x, y, 10, 0xff0000, 0).setDepth(25);
      ring.setStrokeStyle(3 - i, 0xff4444);
      this.tweens.add({
        targets: ring,
        scale: 3 + i * 1.5,
        alpha: 0,
        duration: 400 + i * 150,
        delay: i * 80,
        onComplete: () => ring.destroy(),
      });
    }

    // Spark explosion
    const sparkCount = 12;
    for (let i = 0; i < sparkCount; i++) {
      const angle = (Math.PI * 2 * i) / sparkCount;
      const spark = this.add.circle(x, y, 4, 0xff3333, 1).setDepth(25);
      const dist = 40 + Math.random() * 20;
      this.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0,
        scale: 0.1,
        duration: 500,
        ease: "Power3",
        onComplete: () => spark.destroy(),
      });
    }

    // "HEADSHOT!" text in center of screen
    const cam = this.cameras.main;
    const headshotText = this.add.text(
      cam.scrollX + cam.width / 2,
      cam.scrollY + cam.height / 2 - 60,
      "HEADSHOT!",
      {
        fontFamily: "Nunito, sans-serif",
        fontSize: "48px",
        fontStyle: "bold",
        color: "#ff2222",
        stroke: "#000000",
        strokeThickness: 6,
      }
    ).setOrigin(0.5).setDepth(200).setScrollFactor(0);

    // Position relative to camera
    headshotText.setPosition(cam.width / 2, cam.height / 2 - 60);

    this.tweens.add({
      targets: headshotText,
      alpha: 0,
      y: headshotText.y - 30,
      scale: 1.3,
      duration: 2000,
      ease: "Power2",
      onComplete: () => headshotText.destroy(),
    });

    // Camera shake for dramatic impact
    this.cameras.main.shake(300, 0.015);
  }

  private showKillFeed(killer: string, victim: string, killerTeam: number, suicide?: boolean) {
    const feed = document.getElementById("kill-feed")!;
    const entry = document.createElement("div");
    entry.className = "kill-entry";
    const teamClass = killerTeam === TEAM_LEFT ? "killer-left" : "killer-right";
    const teamEmoji = killerTeam === TEAM_LEFT ? "🌿" : "🌸";
    if (suicide) {
      entry.innerHTML = `${teamEmoji} <span class="${teamClass}">${killer}</span> ☠️ 自爆了`;
    } else {
      entry.innerHTML = `${teamEmoji} <span class="${teamClass}">${killer}</span> ⚔️ <span class="victim">${victim}</span>`;
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
