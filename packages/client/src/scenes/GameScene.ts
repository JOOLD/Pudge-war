import Phaser from "phaser";
import { Room } from "colyseus.js";
import { getRoom, sendInput } from "../network/client";
import { COLORS, MAP_WIDTH, MAP_HEIGHT, PLAYER_RADIUS, TEAM_LEFT, RIVER_X, RIVER_WIDTH } from "shared";

interface PlayerSprite {
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Sprite;
  nameText: Phaser.GameObjects.Text;
  hpBarBg: Phaser.GameObjects.Rectangle;
  hpBarFill: Phaser.GameObjects.Rectangle;
  hookChainGfx: Phaser.GameObjects.Graphics;
  aimLine: Phaser.GameObjects.Graphics;
  targetX: number;
  targetY: number;
  serverAlive: boolean;
  serverTeam: number;
}

export class GameScene extends Phaser.Scene {
  private room!: Room;
  private players: Map<string, PlayerSprite> = new Map();
  private myId = "";
  private mouseWorldX = 0;
  private mouseWorldY = 0;
  private wantHook = false;
  private moveTargetX = -1;
  private moveTargetY = -1;
  private hasMoveTarget = false;
  private scoreText!: Phaser.GameObjects.Text;
  private moveIndicator!: Phaser.GameObjects.Graphics;
  private inputAccum = 0;

  constructor() { super({ key: "GameScene" }); }

  preload() {
    // LPC sprites: 576x256 = 9 cols x 4 rows, 64x64 per frame
    this.load.spritesheet("char-left", "/game-assets/char-left.png", { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet("char-right", "/game-assets/char-right.png", { frameWidth: 64, frameHeight: 64 });
  }

  create() {
    const room = getRoom();
    if (!room) return;
    this.room = room;
    this.myId = room.sessionId;
    this.players.clear();

    this.drawMap();
    this.cameras.main.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);

    this.scoreText = this.add.text(MAP_WIDTH / 2, 16, "0 : 0", {
      fontFamily: "sans-serif", fontSize: "28px", fontStyle: "bold",
      color: "#fff", stroke: "#000", strokeThickness: 4,
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(100);

    this.moveIndicator = this.add.graphics().setDepth(1);

    // LPC animations: row0=up(0-8), row1=left(9-17), row2=down(18-26), row3=right(27-35)
    for (const team of ["left", "right"]) {
      const k = `char-${team}`;
      this.anims.create({ key: `${team}-walk-up`, frames: this.anims.generateFrameNumbers(k, { start: 1, end: 8 }), frameRate: 10, repeat: -1 });
      this.anims.create({ key: `${team}-walk-left`, frames: this.anims.generateFrameNumbers(k, { start: 10, end: 17 }), frameRate: 10, repeat: -1 });
      this.anims.create({ key: `${team}-walk-down`, frames: this.anims.generateFrameNumbers(k, { start: 19, end: 26 }), frameRate: 10, repeat: -1 });
      this.anims.create({ key: `${team}-walk-right`, frames: this.anims.generateFrameNumbers(k, { start: 28, end: 35 }), frameRate: 10, repeat: -1 });
      this.anims.create({ key: `${team}-idle`, frames: [{ key: k, frame: 18 }], frameRate: 1 });
    }

    // Desktop input: right-click = move, left-click = hook
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      this.mouseWorldX = p.worldX;
      this.mouseWorldY = p.worldY;
    });
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (p.rightButtonDown()) {
        this.moveTargetX = p.worldX;
        this.moveTargetY = p.worldY;
        this.hasMoveTarget = true;
      }
      if (p.leftButtonDown()) this.wantHook = true;
    });
    this.game.canvas.addEventListener("contextmenu", e => e.preventDefault());

    // State listeners
    this.room.state.players.onAdd((player: any, key: string) => this.addPlayer(key, player));
    this.room.state.players.onRemove((_: any, key: string) => this.removePlayer(key));
    this.room.onMessage("kill", (d: any) => this.showKillFeed(d.killerName, d.victimName, d.killerTeam));
    this.room.onMessage("hookHit", () => this.cameras.main.shake(100, 0.005));
    this.room.onMessage("hookBounce", (d: any) => {
      const s = this.add.circle(d.x, d.y, 4, 0xffd93d).setDepth(20);
      this.tweens.add({ targets: s, alpha: 0, scale: 2, duration: 300, onComplete: () => s.destroy() });
    });
    this.room.onMessage("gameOver", (d: any) => {
      document.getElementById("game-over")!.classList.add("visible");
      document.getElementById("winner-text")!.textContent = d.winningTeam === TEAM_LEFT ? "藍隊獲勝！" : "紅隊獲勝！";
      document.getElementById("final-score")!.textContent = `${d.leftScore} : ${d.rightScore}`;
    });
  }

  update(_time: number, delta: number) {
    if (!this.room) return;

    let dx = 0, dy = 0, hook = false;

    if (this.hasMoveTarget) {
      const my = this.players.get(this.myId);
      if (my) {
        const pdx = this.moveTargetX - my.container.x;
        const pdy = this.moveTargetY - my.container.y;
        const dist = Math.sqrt(pdx * pdx + pdy * pdy);
        if (dist > 8) { dx = pdx / dist; dy = pdy / dist; }
        else this.hasMoveTarget = false;
      }
    }

    hook = this.wantHook;
    this.wantHook = false;

    this.inputAccum += delta;
    if (this.inputAccum >= 50 || hook) {
      this.inputAccum = 0;
      sendInput({ dx, dy, aimX: this.mouseWorldX, aimY: this.mouseWorldY, hook });
    }

    this.scoreText.setText(`${this.room.state.leftScore} : ${this.room.state.rightScore}`);

    // Interpolate + animate
    this.players.forEach((sp) => {
      const f = Math.min(1, delta / 50);
      const px = sp.container.x, py = sp.container.y;
      sp.container.x += (sp.targetX - px) * f;
      sp.container.y += (sp.targetY - py) * f;
      const mdx = sp.container.x - px, mdy = sp.container.y - py;
      const pre = sp.serverTeam === TEAM_LEFT ? "left" : "right";

      if (!sp.serverAlive) {
        sp.body.setTint(0x666666).setAlpha(0.4);
        sp.body.stop();
      } else {
        sp.body.clearTint();
        sp.body.setAlpha(1);
        if (Math.abs(mdx) > 0.3 || Math.abs(mdy) > 0.3) {
          const anim = Math.abs(mdx) > Math.abs(mdy)
            ? (mdx > 0 ? `${pre}-walk-right` : `${pre}-walk-left`)
            : (mdy > 0 ? `${pre}-walk-down` : `${pre}-walk-up`);
          if (!sp.body.anims.isPlaying || sp.body.anims.currentAnim?.key !== anim) sp.body.play(anim, true);
        } else {
          if (sp.body.anims.isPlaying && sp.body.anims.currentAnim?.key !== `${pre}-idle`) sp.body.play(`${pre}-idle`, true);
        }
      }
    });

    // Move indicator
    this.moveIndicator.clear();
    if (this.hasMoveTarget) {
      this.moveIndicator.lineStyle(1.5, 0xffd93d, 0.3);
      this.moveIndicator.strokeCircle(this.moveTargetX, this.moveTargetY, 6);
    }

    const my = this.players.get(this.myId);
    if (my) this.cameras.main.centerOn(my.container.x, my.container.y);
  }

  private drawMap() {
    const g = this.add.graphics();
    g.fillStyle(COLORS.grass); g.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
    g.fillStyle(COLORS.grassDark, 0.3);
    for (let x = 0; x < MAP_WIDTH; x += 32)
      for (let y = 0; y < MAP_HEIGHT; y += 32)
        if ((x + y) % 64 === 0) g.fillRect(x, y, 16, 16);
    g.fillStyle(COLORS.river); g.fillRect(RIVER_X, 0, RIVER_WIDTH, MAP_HEIGHT);
    g.fillStyle(COLORS.riverDeep, 0.5);
    for (let y = 0; y < MAP_HEIGHT; y += 20) g.fillEllipse(RIVER_X + RIVER_WIDTH / 2 + (y % 40 === 0 ? 10 : -10), y, 40, 8);
    g.lineStyle(3, 0x553311); g.strokeRect(1, 1, MAP_WIDTH - 2, MAP_HEIGHT - 2);
    g.setDepth(0);
  }

  private addPlayer(sessionId: string, player: any) {
    const isLeft = player.team === TEAM_LEFT;
    const body = this.add.sprite(0, 0, isLeft ? "char-left" : "char-right", 18).setScale(0.8);
    const nameText = this.add.text(0, -30, player.nickname, {
      fontFamily: "sans-serif", fontSize: "11px", fontStyle: "bold", color: "#fff", stroke: "#000", strokeThickness: 2,
    }).setOrigin(0.5);
    const hpBarBg = this.add.rectangle(0, 22, 40, 4, COLORS.hpBarBg);
    const hpBarFill = this.add.rectangle(0, 22, 40, 4, isLeft ? 0x4488cc : 0xcc4444);
    const hookChainGfx = this.add.graphics();
    const aimLine = this.add.graphics();
    const container = this.add.container(player.x, player.y, [hookChainGfx, aimLine, body, nameText, hpBarBg, hpBarFill]).setDepth(10);

    const sp: PlayerSprite = { container, body, nameText, hpBarBg, hpBarFill, hookChainGfx, aimLine,
      targetX: player.x, targetY: player.y, serverAlive: player.alive, serverTeam: player.team };
    this.players.set(sessionId, sp);

    player.listen("x", (v: number) => { sp.targetX = v; });
    player.listen("y", (v: number) => { sp.targetY = v; });
    player.listen("alive", (v: boolean) => { sp.serverAlive = v; });
    player.listen("hp", (v: number) => {
      const pct = v / 100;
      sp.hpBarFill.setScale(pct, 1);
      sp.hpBarFill.setX(-20 * (1 - pct));
    });

    // Hook chain
    const h = player.hook;
    const draw = () => {
      sp.hookChainGfx.clear();
      if (h.state === "idle") return;
      const hx = h.x - sp.container.x, hy = h.y - sp.container.y;
      sp.hookChainGfx.lineStyle(3, COLORS.hookChain, 0.8);
      sp.hookChainGfx.beginPath(); sp.hookChainGfx.moveTo(0, 0); sp.hookChainGfx.lineTo(hx, hy); sp.hookChainGfx.strokePath();
      sp.hookChainGfx.fillStyle(COLORS.hookHead); sp.hookChainGfx.fillCircle(hx, hy, 6);
    };
    h.listen("x", draw); h.listen("y", draw); h.listen("state", draw);

    // Aim line (local player only)
    if (sessionId === this.myId) {
      this.events.on("update", () => {
        sp.aimLine.clear();
        if (!sp.serverAlive || h.state !== "idle") return;
        const adx = this.mouseWorldX - sp.container.x, ady = this.mouseWorldY - sp.container.y;
        const len = Math.sqrt(adx * adx + ady * ady);
        if (len === 0) return;
        const nx = adx / len, ny = ady / len;
        sp.aimLine.lineStyle(1, 0xffffff, 0.2);
        for (let i = 0; i < 6; i++) {
          const s = 30 + i * 16;
          sp.aimLine.beginPath(); sp.aimLine.moveTo(nx * s, ny * s); sp.aimLine.lineTo(nx * (s + 8), ny * (s + 8)); sp.aimLine.strokePath();
        }
      });
    }
  }

  private removePlayer(id: string) {
    const s = this.players.get(id);
    if (s) { s.container.destroy(); this.players.delete(id); }
  }

  private showKillFeed(killer: string, victim: string, team: number) {
    const feed = document.getElementById("kill-feed")!;
    const e = document.createElement("div");
    e.className = "kill-entry";
    e.innerHTML = `<span style="color:${team === TEAM_LEFT ? '#4488cc' : '#cc4444'}">${killer}</span> 🎣 ${victim}`;
    feed.appendChild(e);
    setTimeout(() => { e.style.opacity = "0"; setTimeout(() => e.remove(), 500); }, 4000);
    while (feed.children.length > 5) feed.removeChild(feed.children[0]);
  }
}
