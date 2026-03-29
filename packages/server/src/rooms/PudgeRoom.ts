import { Room, Client } from "@colyseus/core";
import { GameState, PlayerSchema, HookSchema } from "./schema";
import {
  TICK_RATE, KILLS_TO_WIN, MAX_PLAYERS, MAX_PLAYERS_PER_TEAM,
  TEAM_LEFT, TEAM_RIGHT, PLAYER_MAX_HP, HOOK_COOLDOWN,
  RESPAWN_TIME, HOOK_RADIUS, PLAYER_RADIUS,
  SPAWN_X_LEFT, SPAWN_X_RIGHT, SPAWN_Y_OFFSETS,
  MAP_HEIGHT,
} from "shared";
import { InputMessage, HookState, GamePhase } from "shared";
import {
  movePlayer, moveHook, pullTarget, returnHook,
  circleCollision, normalize,
} from "../physics/collision";

export class PudgeRoom extends Room<GameState> {
  private tickInterval!: ReturnType<typeof setInterval>;
  private playerInputs: Map<string, InputMessage> = new Map();
  private leftCount = 0;
  private rightCount = 0;

  onCreate(options: any) {
    const state = new GameState();
    // Generate a 4-char room code
    state.roomCode = options.roomCode || this.generateRoomCode();
    this.roomId = state.roomCode;
    this.setState(state);

    this.maxClients = MAX_PLAYERS;

    // Handle input messages
    this.onMessage("input", (client, msg: InputMessage) => {
      this.playerInputs.set(client.sessionId, msg);
    });

    // Handle start game message
    this.onMessage("start", () => {
      if (this.state.phase === GamePhase.WAITING && this.clients.length >= 2) {
        this.startGame();
      }
    });

    // Handle restart
    this.onMessage("restart", () => {
      if (this.state.phase === GamePhase.FINISHED) {
        this.restartGame();
      }
    });

    // Handle skill messages
    this.onMessage("skill", (client, msg: { skill: string }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || !player.alive) return;

      switch (msg.skill) {
        case "rot": this.toggleRot(player); break;
        case "phase": this.activatePhase(player); break;
        case "dismember": this.activateDismember(player); break;
      }
    });

    // Start game loop
    this.tickInterval = setInterval(() => this.gameLoop(), 1000 / TICK_RATE);
  }

  onJoin(client: Client, options: any) {
    const player = new PlayerSchema();
    player.id = client.sessionId;
    player.nickname = options.nickname || `Player${this.clients.length}`;

    // Assign team (balance teams)
    if (this.leftCount <= this.rightCount) {
      player.team = TEAM_LEFT;
      player.spawnIndex = this.leftCount;
      this.leftCount++;
    } else {
      player.team = TEAM_RIGHT;
      player.spawnIndex = this.rightCount;
      this.rightCount++;
    }

    // Set spawn position
    this.respawnPlayer(player);

    player.hp = PLAYER_MAX_HP;
    player.alive = true;
    player.hook = new HookSchema();

    this.state.players.set(client.sessionId, player);

    // Broadcast join
    this.broadcast("playerJoined", {
      nickname: player.nickname,
      team: player.team,
    });
  }

  onLeave(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (player) {
      if (player.team === TEAM_LEFT) this.leftCount--;
      else this.rightCount--;

      // Release any hooked players
      this.releaseHookedTarget(player);

      this.state.players.delete(client.sessionId);
      this.broadcast("playerLeft", { nickname: player.nickname });
    }
  }

  onDispose() {
    clearInterval(this.tickInterval);
  }

  private generateRoomCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  private startGame() {
    this.state.phase = GamePhase.PLAYING;
    this.state.leftScore = 0;
    this.state.rightScore = 0;
    this.state.winningTeam = -1;

    // Reset all players
    this.state.players.forEach((player) => {
      player.hp = PLAYER_MAX_HP;
      player.alive = true;
      player.kills = 0;
      player.deaths = 0;
      player.hookCooldown = 0;
      player.respawnTimer = 0;
      player.hook.state = "idle";
      player.rotActive = false;
      player.phaseTimer = 0;
      player.phaseCooldown = 0;
      player.dismemberTimer = 0;
      player.dismemberTarget = "";
      player.dismemberCooldown = 0;
      this.respawnPlayer(player);
    });

    this.broadcast("gameStarted", {});
  }

  private restartGame() {
    this.startGame();
  }

  private respawnPlayer(player: PlayerSchema) {
    const yCenter = MAP_HEIGHT / 2;
    const yOffset = SPAWN_Y_OFFSETS[player.spawnIndex] || 0;

    if (player.team === TEAM_LEFT) {
      player.x = SPAWN_X_LEFT;
    } else {
      player.x = SPAWN_X_RIGHT;
    }
    player.y = yCenter + yOffset;
    player.hp = PLAYER_MAX_HP;
    player.alive = true;
    player.hook.state = "idle";
    player.rotActive = false;
    player.phaseTimer = 0;
    player.dismemberTimer = 0;
    player.dismemberTarget = "";
  }

  private releaseHookedTarget(owner: PlayerSchema) {
    if (owner.hook.state === "hit" && owner.hook.targetId) {
      const target = this.state.players.get(owner.hook.targetId);
      if (target) {
        // Just release, don't teleport
      }
      owner.hook.state = "idle";
      owner.hook.targetId = "";
    }
  }

  private gameLoop() {
    if (this.state.phase !== GamePhase.PLAYING) return;

    const dt = 1 / TICK_RATE;

    this.state.players.forEach((player, sessionId) => {
      // Handle respawn timer
      if (!player.alive) {
        player.respawnTimer -= (1000 / TICK_RATE);
        if (player.respawnTimer <= 0) {
          this.respawnPlayer(player);
        }
        return;
      }

      // Handle cooldown
      if (player.hookCooldown > 0) {
        player.hookCooldown -= (1000 / TICK_RATE);
        if (player.hookCooldown < 0) player.hookCooldown = 0;
      }

      const input = this.playerInputs.get(sessionId);
      if (!input) return;

      // Update aim direction
      player.aimX = input.aimX;
      player.aimY = input.aimY;

      // Process skill timers
      this.processRot(player, dt);
      this.processPhase(player, dt);
      this.processDismember(player, sessionId, dt);

      // Check if this player is a dismember target (frozen in place)
      let isDismemberTarget = false;
      this.state.players.forEach((other) => {
        if (other.dismemberTimer > 0 && other.dismemberTarget === sessionId) {
          isDismemberTarget = true;
        }
      });

      // Move player (only if not being pulled, not phased, not dismembering/dismembered)
      if (
        (player.hook.state !== "hit" || player.hook.targetId !== sessionId) &&
        player.phaseTimer <= 0 &&
        player.dismemberTimer <= 0 &&
        !isDismemberTarget
      ) {
        const pos = movePlayer(player.x, player.y, input.dx, input.dy, player.team, dt);
        player.x = pos.x;
        player.y = pos.y;
      }

      // Handle hook
      this.updateHook(player, input, dt);
    });

    // Check win condition
    if (this.state.leftScore >= KILLS_TO_WIN) {
      this.state.phase = GamePhase.FINISHED;
      this.state.winningTeam = TEAM_LEFT;
      this.broadcast("gameOver", {
        winningTeam: TEAM_LEFT,
        leftScore: this.state.leftScore,
        rightScore: this.state.rightScore,
      });
    } else if (this.state.rightScore >= KILLS_TO_WIN) {
      this.state.phase = GamePhase.FINISHED;
      this.state.winningTeam = TEAM_RIGHT;
      this.broadcast("gameOver", {
        winningTeam: TEAM_RIGHT,
        leftScore: this.state.leftScore,
        rightScore: this.state.rightScore,
      });
    }
  }

  private updateHook(player: PlayerSchema, input: InputMessage, dt: number) {
    const hook = player.hook;

    switch (hook.state) {
      case "idle":
        // Launch hook if requested and cooldown is ready
        if (input.hook && player.hookCooldown <= 0) {
          const dir = normalize({
            x: input.aimX - player.x,
            y: input.aimY - player.y,
          });
          hook.x = player.x;
          hook.y = player.y;
          hook.startX = player.x;
          hook.startY = player.y;
          hook.dirX = dir.x;
          hook.dirY = dir.y;
          hook.state = "flying";
          hook.targetId = "";
          player.hookCooldown = HOOK_COOLDOWN;
        }
        break;

      case "flying": {
        // Move hook forward
        const result = moveHook(hook.x, hook.y, hook.dirX, hook.dirY, hook.startX, hook.startY, dt);
        hook.x = result.x;
        hook.y = result.y;

        // Check out of range
        if (result.outOfRange) {
          hook.state = "returning";
          break;
        }

        // Check collision with enemy players
        let hitPlayer = false;
        this.state.players.forEach((other, otherId) => {
          if (hitPlayer) return;
          if (otherId === player.id) return;
          if (other.team === player.team) return;
          if (!other.alive) return;
          if (other.phaseTimer > 0) return; // Phase shift = immune to hooks

          if (circleCollision(
            { x: hook.x, y: hook.y }, HOOK_RADIUS,
            { x: other.x, y: other.y }, PLAYER_RADIUS
          )) {
            hook.state = "hit";
            hook.targetId = otherId;
            hitPlayer = true;

            this.broadcast("hookHit", {
              hookOwner: player.nickname,
              target: other.nickname,
            });
          }
        });
        break;
      }

      case "hit": {
        // Pull target toward hook owner
        const target = this.state.players.get(hook.targetId);
        if (!target || !target.alive) {
          hook.state = "returning";
          break;
        }

        const pullResult = pullTarget(target.x, target.y, player.x, player.y, dt);
        target.x = pullResult.x;
        target.y = pullResult.y;
        hook.x = target.x;
        hook.y = target.y;

        if (pullResult.arrived) {
          // Kill the target
          target.alive = false;
          target.hp = 0;
          target.deaths++;
          target.respawnTimer = RESPAWN_TIME;
          player.kills++;

          // Update score
          if (player.team === TEAM_LEFT) {
            this.state.leftScore++;
          } else {
            this.state.rightScore++;
          }

          hook.state = "idle";
          hook.targetId = "";

          this.broadcast("kill", {
            killerName: player.nickname,
            victimName: target.nickname,
            killerTeam: player.team,
          });
        }
        break;
      }

      case "returning": {
        const ret = returnHook(hook.x, hook.y, player.x, player.y, dt);
        hook.x = ret.x;
        hook.y = ret.y;

        if (ret.arrived) {
          hook.state = "idle";
        }
        break;
      }
    }
  }

  // ============================================================
  // Skill: Rot (W) — Toggle AOE damage around self
  // ============================================================
  private toggleRot(player: PlayerSchema) {
    player.rotActive = !player.rotActive;
  }

  private processRot(player: PlayerSchema, dt: number) {
    if (!player.rotActive || !player.alive) return;

    // Self damage: 10 HP/sec
    player.hp -= 10 * dt;
    if (player.hp <= 0) {
      player.alive = false;
      player.hp = 0;
      player.deaths++;
      player.respawnTimer = RESPAWN_TIME;
      player.rotActive = false;
      this.broadcast("kill", {
        killerName: player.nickname,
        victimName: player.nickname,
        killerTeam: player.team,
        suicide: true,
      });
      return;
    }

    // Damage nearby enemies: 30 HP/sec in 80px radius
    this.state.players.forEach((other, otherId) => {
      if (otherId === player.id) return;
      if (other.team === player.team) return;
      if (!other.alive) return;
      if (other.phaseTimer > 0) return; // Phase shift = immune

      const dx = other.x - player.x;
      const dy = other.y - player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 80) {
        other.hp -= 30 * dt;
        if (other.hp <= 0) {
          other.alive = false;
          other.hp = 0;
          other.deaths++;
          other.respawnTimer = RESPAWN_TIME;
          player.kills++;

          if (player.team === TEAM_LEFT) {
            this.state.leftScore++;
          } else {
            this.state.rightScore++;
          }

          this.broadcast("kill", {
            killerName: player.nickname,
            victimName: other.nickname,
            killerTeam: player.team,
          });
        }
      }
    });
  }

  // ============================================================
  // Skill: Phase Shift (E) — Invulnerability, cannot move
  // ============================================================
  private activatePhase(player: PlayerSchema) {
    if (player.phaseCooldown > 0) return;
    if (player.dismemberTimer > 0) return; // Can't phase during dismember

    player.phaseTimer = 1000;      // PHASE_DURATION: 1s
    player.phaseCooldown = 12000;  // PHASE_COOLDOWN: 12s
    player.rotActive = false;      // Cancel rot during phase

    // Release any hook targeting this player
    this.state.players.forEach((other) => {
      if (other.hook.targetId === player.id && other.hook.state === "hit") {
        other.hook.state = "returning";
        other.hook.targetId = "";
      }
    });

    this.broadcast("phaseShift", { nickname: player.nickname });
  }

  private processPhase(player: PlayerSchema, dt: number) {
    if (player.phaseTimer > 0) {
      player.phaseTimer -= 1000 / TICK_RATE;
      if (player.phaseTimer <= 0) player.phaseTimer = 0;
    }
    if (player.phaseCooldown > 0) {
      player.phaseCooldown -= 1000 / TICK_RATE;
      if (player.phaseCooldown < 0) player.phaseCooldown = 0;
    }
  }

  // ============================================================
  // Skill: Dismember (R) — Channel damage on nearby enemy
  // ============================================================
  private activateDismember(player: PlayerSchema) {
    if (player.dismemberCooldown > 0) return;
    if (player.phaseTimer > 0) return; // Can't dismember during phase

    // Find closest enemy within 40px
    let closest: PlayerSchema | null = null;
    let closestDist = 40;

    this.state.players.forEach((other) => {
      if (other.id === player.id) return;
      if (other.team === player.team) return;
      if (!other.alive) return;
      if (other.phaseTimer > 0) return;

      const dx = other.x - player.x;
      const dy = other.y - player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < closestDist) {
        closest = other;
        closestDist = dist;
      }
    });

    if (!closest) return; // No target in range

    player.dismemberTimer = 2000;           // DISMEMBER_DURATION: 2s
    player.dismemberTarget = (closest as PlayerSchema).id;
    player.dismemberCooldown = 10000;       // DISMEMBER_COOLDOWN: 10s

    this.broadcast("dismember", {
      attacker: player.nickname,
      victim: (closest as PlayerSchema).nickname,
    });
  }

  private processDismember(player: PlayerSchema, sessionId: string, dt: number) {
    // Process dismember cooldown regardless
    if (player.dismemberCooldown > 0) {
      player.dismemberCooldown -= 1000 / TICK_RATE;
      if (player.dismemberCooldown < 0) player.dismemberCooldown = 0;
    }

    if (player.dismemberTimer <= 0) return;

    const target = this.state.players.get(player.dismemberTarget);
    if (!target || !target.alive) {
      // Target died or left, cancel dismember
      player.dismemberTimer = 0;
      player.dismemberTarget = "";
      return;
    }

    // Damage target: 80 HP/sec
    target.hp -= 80 * dt;

    player.dismemberTimer -= 1000 / TICK_RATE;
    if (player.dismemberTimer <= 0) {
      player.dismemberTimer = 0;
      player.dismemberTarget = "";
    }

    // Check if target died from dismember
    if (target.hp <= 0) {
      target.alive = false;
      target.hp = 0;
      target.deaths++;
      target.respawnTimer = RESPAWN_TIME;
      player.kills++;
      player.dismemberTimer = 0;
      player.dismemberTarget = "";

      if (player.team === TEAM_LEFT) {
        this.state.leftScore++;
      } else {
        this.state.rightScore++;
      }

      this.broadcast("kill", {
        killerName: player.nickname,
        victimName: target.nickname,
        killerTeam: player.team,
      });
    }
  }
}
