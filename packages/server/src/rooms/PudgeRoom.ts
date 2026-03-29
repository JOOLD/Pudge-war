import { Room, Client } from "@colyseus/core";
import { GameState, PlayerSchema, HookSchema } from "./schema";
import {
  TICK_RATE, KILLS_TO_WIN, MAX_PLAYERS, MAX_PLAYERS_PER_TEAM,
  TEAM_LEFT, TEAM_RIGHT, PLAYER_MAX_HP, HOOK_COOLDOWN,
  RESPAWN_TIME, HOOK_RADIUS, PLAYER_RADIUS,
  SPAWN_X_LEFT, SPAWN_X_RIGHT, SPAWN_Y_OFFSETS,
  MAP_HEIGHT, HOOK_SPEED, HOOK_MAX_RANGE,
  GOLD_PER_KILL, GOLD_PER_ASSIST, GOLD_PASSIVE_RATE, ASSIST_WINDOW,
  ROT_DAMAGE, ROT_RADIUS, ROT_SELF_DAMAGE,
  PHASE_DURATION, PHASE_COOLDOWN, PHASE_SPEED_MULT,
  DISMEMBER_DAMAGE, DISMEMBER_DURATION, DISMEMBER_COOLDOWN, DISMEMBER_RANGE,
  SPAWN_HEAL_RADIUS, SPAWN_HEAL_RATE, PLAYER_SPEED,
  UPGRADES,
} from "shared";
import { InputMessage, HookState, GamePhase } from "shared";
import {
  movePlayer, moveHook, pullTarget, returnHook,
<<<<<<< HEAD
  circleCollision, normalize, distance, clampPlayerPosition,
=======
  circleCollision, normalize, checkHeadshots,
  FlyingHook,
>>>>>>> worktree-agent-aecd704e
} from "../physics/collision";

export class PudgeRoom extends Room<GameState> {
  private tickInterval!: ReturnType<typeof setInterval>;
  private playerInputs: Map<string, InputMessage> = new Map();
  private leftCount = 0;
  private rightCount = 0;
  private damageTracker: Map<string, Map<string, number>> = new Map(); // targetId -> Map<attackerId, timestamp>

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

    // Handle buy (shop)
    this.onMessage("buy", (client, msg: { upgradeId: string }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || !player.alive) return;

      // Must be near spawn to buy
      const spawnX = player.team === TEAM_LEFT ? SPAWN_X_LEFT : SPAWN_X_RIGHT;
      const dist = Math.sqrt((player.x - spawnX) ** 2 + (player.y - MAP_HEIGHT / 2) ** 2);
      if (dist > SPAWN_HEAL_RADIUS * 1.5) return;

      this.handleBuy(player, msg.upgradeId);
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

  // ============================================
  // Game lifecycle
  // ============================================

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
    this.damageTracker.clear();

    // Reset all players
    this.state.players.forEach((player) => {
      player.hp = PLAYER_MAX_HP;
      player.alive = true;
      player.kills = 0;
      player.deaths = 0;
      player.assists = 0;
      player.gold = 0;
      player.hookCooldown = 0;
      player.respawnTimer = 0;
      player.hook.state = "idle";
<<<<<<< HEAD

      // Reset ability states
      player.rotActive = false;
      player.rotCooldown = 0;
      player.phaseActive = false;
      player.phaseTimer = 0;
      player.phaseCooldown = 0;
      player.dismemberActive = false;
      player.dismemberTimer = 0;
      player.dismemberCooldown = 0;
      player.dismemberTargetId = "";

      // Reset upgrades
      player.upgradeHookRange = 0;
      player.upgradeHookSpeed = 0;
      player.upgradeHookCooldown = 0;
      player.upgradeRotDamage = 0;
      player.upgradeRotRadius = 0;
      player.upgradePhaseDuration = 0;
      player.upgradePhaseCooldown = 0;
      player.upgradeDismemberDamage = 0;
      player.upgradeDismemberDuration = 0;
      player.upgradeHpMax = 0;
      player.upgradeHpRegen = 0;
      player.upgradeMoveSpeed = 0;

=======
      player.hook.bounces = 0;
>>>>>>> worktree-agent-aecd704e
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
    player.hp = this.getEffectiveMaxHp(player);
    player.alive = true;
    player.hook.state = "idle";
<<<<<<< HEAD

    // Reset ability states on respawn
    player.rotActive = false;
    player.phaseActive = false;
    player.dismemberActive = false;
    player.dismemberTargetId = "";
=======
    player.hook.bounces = 0;
>>>>>>> worktree-agent-aecd704e
  }

  private releaseHookedTarget(owner: PlayerSchema) {
    if (owner.hook.state === "hit" && owner.hook.targetId) {
      const target = this.state.players.get(owner.hook.targetId);
      if (target) {
        // Just release, don't teleport
      }
      owner.hook.state = "idle";
      owner.hook.targetId = "";
      owner.hook.bounces = 0;
    }
  }

  // ============================================
  // Shop / Upgrades
  // ============================================

  private handleBuy(player: PlayerSchema, upgradeId: string) {
    const upgradeDef = UPGRADES.find(u => u.id === upgradeId);
    if (!upgradeDef) return;

    // Get current level
    const currentLevel = this.getUpgradeLevel(player, upgradeId);
    if (currentLevel >= upgradeDef.maxLevel) return;

    // Calculate cost
    const cost = Math.floor(upgradeDef.baseCost * Math.pow(upgradeDef.costMultiplier, currentLevel));
    if (player.gold < cost) return;

    // Deduct gold and apply upgrade
    player.gold -= cost;
    this.setUpgradeLevel(player, upgradeId, currentLevel + 1);

    // If hp_max upgrade, also increase current HP
    if (upgradeId === 'hp_max') {
      player.hp = Math.min(player.hp + 100, this.getEffectiveMaxHp(player));
    }

    this.broadcast("upgrade", {
      nickname: player.nickname,
      upgradeId,
      level: currentLevel + 1,
    });
  }

  private getUpgradeLevel(player: PlayerSchema, upgradeId: string): number {
    switch (upgradeId) {
      case 'hook_range': return player.upgradeHookRange;
      case 'hook_speed': return player.upgradeHookSpeed;
      case 'hook_cooldown': return player.upgradeHookCooldown;
      case 'rot_damage': return player.upgradeRotDamage;
      case 'rot_radius': return player.upgradeRotRadius;
      case 'phase_duration': return player.upgradePhaseDuration;
      case 'phase_cooldown': return player.upgradePhaseCooldown;
      case 'dismember_damage': return player.upgradeDismemberDamage;
      case 'dismember_duration': return player.upgradeDismemberDuration;
      case 'hp_max': return player.upgradeHpMax;
      case 'hp_regen': return player.upgradeHpRegen;
      case 'move_speed': return player.upgradeMoveSpeed;
      default: return 0;
    }
  }

  private setUpgradeLevel(player: PlayerSchema, upgradeId: string, level: number) {
    switch (upgradeId) {
      case 'hook_range': player.upgradeHookRange = level; break;
      case 'hook_speed': player.upgradeHookSpeed = level; break;
      case 'hook_cooldown': player.upgradeHookCooldown = level; break;
      case 'rot_damage': player.upgradeRotDamage = level; break;
      case 'rot_radius': player.upgradeRotRadius = level; break;
      case 'phase_duration': player.upgradePhaseDuration = level; break;
      case 'phase_cooldown': player.upgradePhaseCooldown = level; break;
      case 'dismember_damage': player.upgradeDismemberDamage = level; break;
      case 'dismember_duration': player.upgradeDismemberDuration = level; break;
      case 'hp_max': player.upgradeHpMax = level; break;
      case 'hp_regen': player.upgradeHpRegen = level; break;
      case 'move_speed': player.upgradeMoveSpeed = level; break;
    }
  }

  // ============================================
  // Effective value getters (base + upgrades)
  // ============================================

  private getEffectiveMaxHp(player: PlayerSchema): number {
    return PLAYER_MAX_HP + player.upgradeHpMax * 100;
  }
  private getEffectiveHookRange(player: PlayerSchema): number {
    return HOOK_MAX_RANGE + player.upgradeHookRange * 50;
  }
  private getEffectiveHookSpeed(player: PlayerSchema): number {
    return HOOK_SPEED + player.upgradeHookSpeed * 100;
  }
  private getEffectiveHookCooldown(player: PlayerSchema): number {
    return HOOK_COOLDOWN - player.upgradeHookCooldown * 1000;
  }
  private getEffectiveMoveSpeed(player: PlayerSchema): number {
    return PLAYER_SPEED + player.upgradeMoveSpeed * 20;
  }
  private getEffectiveRotDamage(player: PlayerSchema): number {
    return ROT_DAMAGE + player.upgradeRotDamage * 10;
  }
  private getEffectiveRotRadius(player: PlayerSchema): number {
    return ROT_RADIUS + player.upgradeRotRadius * 20;
  }
  private getEffectivePhaseDuration(player: PlayerSchema): number {
    return PHASE_DURATION + player.upgradePhaseDuration * 500;
  }
  private getEffectivePhaseCooldown(player: PlayerSchema): number {
    return PHASE_COOLDOWN - player.upgradePhaseCooldown * 2000;
  }
  private getEffectiveDismemberDamage(player: PlayerSchema): number {
    return DISMEMBER_DAMAGE + player.upgradeDismemberDamage * 20;
  }
  private getEffectiveDismemberDuration(player: PlayerSchema): number {
    return DISMEMBER_DURATION + player.upgradeDismemberDuration * 500;
  }
  private getEffectiveHpRegen(player: PlayerSchema): number {
    return SPAWN_HEAL_RATE + player.upgradeHpRegen * 5;
  }

  // ============================================
  // Assist tracking
  // ============================================

  private trackDamage(attackerId: string, targetId: string) {
    if (!this.damageTracker.has(targetId)) {
      this.damageTracker.set(targetId, new Map());
    }
    this.damageTracker.get(targetId)!.set(attackerId, Date.now());
  }

  private grantAssists(killerId: string, victimId: string) {
    const attackers = this.damageTracker.get(victimId);
    if (!attackers) return;

    const now = Date.now();
    attackers.forEach((timestamp, attackerId) => {
      if (attackerId !== killerId && now - timestamp < ASSIST_WINDOW) {
        const assister = this.state.players.get(attackerId);
        if (assister) {
          assister.gold += GOLD_PER_ASSIST;
          assister.assists++;
        }
      }
    });

    // Clear tracker for this victim
    this.damageTracker.delete(victimId);
  }

  // ============================================
  // Kill handling
  // ============================================

  private handleKill(killer: PlayerSchema, killerId: string, target: PlayerSchema, targetId: string) {
    target.alive = false;
    target.hp = 0;
    target.deaths++;
    target.respawnTimer = RESPAWN_TIME;

    // Cancel target's active abilities
    target.rotActive = false;
    target.dismemberActive = false;
    target.dismemberTargetId = "";

    killer.kills++;
    killer.gold += GOLD_PER_KILL;

    // Update score
    if (killer.team === TEAM_LEFT) {
      this.state.leftScore++;
    } else {
      this.state.rightScore++;
    }

    // Grant assists
    this.grantAssists(killerId, targetId);

    this.broadcast("kill", {
      killerName: killer.nickname,
      victimName: target.nickname,
      killerTeam: killer.team,
    });
  }

  // ============================================
  // Damage application
  // ============================================

  private applyDamage(attackerId: string, target: PlayerSchema, targetId: string, damage: number): boolean {
    // Phase makes player invulnerable
    if (target.phaseActive) return false;

    target.hp -= damage;
    this.trackDamage(attackerId, targetId);

    if (target.hp <= 0) {
      const attacker = this.state.players.get(attackerId);
      if (attacker) {
        this.handleKill(attacker, attackerId, target, targetId);
      }
      return true; // target died
    }
    return false;
  }

  // ============================================
  // Main game loop
  // ============================================

  private gameLoop() {
    if (this.state.phase !== GamePhase.PLAYING) return;

    const dt = 1 / TICK_RATE;
    const dtMs = 1000 / TICK_RATE;

    // Store previous hook positions for headshot detection
    const flyingHooks: FlyingHook[] = [];

    this.state.players.forEach((player, sessionId) => {
      // Capture previous hook position BEFORE movement
      if (player.hook.state === "flying") {
        player.hook.prevX = player.hook.x;
        player.hook.prevY = player.hook.y;
      }

      // Handle respawn timer
      if (!player.alive) {
        player.respawnTimer -= dtMs;
        if (player.respawnTimer <= 0) {
          this.respawnPlayer(player);
        }
        return;
      }

      // Passive gold income
      player.gold += GOLD_PASSIVE_RATE * dt;

      // Handle cooldowns
      if (player.hookCooldown > 0) {
        player.hookCooldown -= dtMs;
        if (player.hookCooldown < 0) player.hookCooldown = 0;
      }
      if (player.phaseCooldown > 0) {
        player.phaseCooldown -= dtMs;
        if (player.phaseCooldown < 0) player.phaseCooldown = 0;
      }
      if (player.dismemberCooldown > 0) {
        player.dismemberCooldown -= dtMs;
        if (player.dismemberCooldown < 0) player.dismemberCooldown = 0;
      }

      // Process phase timer
      if (player.phaseActive) {
        player.phaseTimer -= dtMs;
        if (player.phaseTimer <= 0) {
          player.phaseActive = false;
          player.phaseTimer = 0;
        }
      }

      // Process dismember
      if (player.dismemberActive) {
        this.processDismember(player, sessionId, dt);
      }

      const input = this.playerInputs.get(sessionId);
      if (!input) return;

      // Update aim direction
      player.aimX = input.aimX;
      player.aimY = input.aimY;

      // Move player (only if not being pulled and not dismembering)
      const isBeingPulled = player.hook.state === "hit" && player.hook.targetId === sessionId;
      const isDismembering = player.dismemberActive;
      if (!isBeingPulled && !isDismembering) {
        const speed = this.getEffectiveMoveSpeed(player) * (player.phaseActive ? PHASE_SPEED_MULT : 1);
        const pos = movePlayerWithSpeed(player.x, player.y, input.dx, input.dy, player.team, dt, speed);
        player.x = pos.x;
        player.y = pos.y;
      }

      // Handle hook
      this.updateHook(player, sessionId, input, dt);

      // Process rot damage
      if (player.rotActive) {
        this.processRot(player, sessionId, dt);
      }

      // Spawn healing
      this.processSpawnHeal(player, dt);
    });

    // Collect flying hooks AFTER movement for headshot detection
    this.state.players.forEach((player, sessionId) => {
      if (player.hook.state === "flying") {
        flyingHooks.push({
          ownerId: sessionId,
          ownerTeam: player.team,
          x: player.hook.x,
          y: player.hook.y,
          prevX: player.hook.prevX,
          prevY: player.hook.prevY,
        });
      }
    });

    // Check for headshots (crossing hooks from different teams)
    if (flyingHooks.length >= 2) {
      const playerList: Array<{ id: string; x: number; y: number; team: number; alive: boolean }> = [];
      this.state.players.forEach((p, id) => {
        playerList.push({ id, x: p.x, y: p.y, team: p.team, alive: p.alive });
      });

      const headshots = checkHeadshots(flyingHooks, playerList);
      for (const hs of headshots) {
        const victim = this.state.players.get(hs.victimId);
        if (!victim || !victim.alive) continue;

        // Instant kill
        victim.alive = false;
        victim.hp = 0;
        victim.deaths++;
        victim.respawnTimer = RESPAWN_TIME;

        // Find killer (hook owner from opposite team closest to intersection)
        // Credit kill to both hook owners
        for (const fh of flyingHooks) {
          if (fh.ownerTeam !== victim.team) {
            const killer = this.state.players.get(fh.ownerId);
            if (killer) {
              killer.kills++;
              if (killer.team === TEAM_LEFT) {
                this.state.leftScore++;
              } else {
                this.state.rightScore++;
              }
              break; // Only credit one killer per victim
            }
          }
        }

        this.broadcast("headshot", {
          victimName: victim.nickname,
          x: hs.x,
          y: hs.y,
        });
      }
    }

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

  // ============================================
  // Rot
  // ============================================

  private processRot(player: PlayerSchema, playerId: string, dt: number) {
    if (!player.alive) return;

    const rotRadius = this.getEffectiveRotRadius(player);
    const rotDamage = this.getEffectiveRotDamage(player) * dt;

    // Self damage
    player.hp -= ROT_SELF_DAMAGE * dt;
    if (player.hp <= 0) {
      // Rot suicide - no killer credit
      player.alive = false;
      player.hp = 0;
      player.deaths++;
      player.respawnTimer = RESPAWN_TIME;
      player.rotActive = false;
      this.broadcast("kill", {
        killerName: player.nickname,
        victimName: player.nickname,
        killerTeam: player.team,
      });
      return;
    }

    // Damage nearby enemies
    this.state.players.forEach((other, otherId) => {
      if (otherId === playerId) return;
      if (other.team === player.team) return;
      if (!other.alive) return;

      const dist = distance({ x: player.x, y: player.y }, { x: other.x, y: other.y });
      if (dist < rotRadius) {
        this.applyDamage(playerId, other, otherId, rotDamage);
      }
    });
  }

  // ============================================
  // Dismember
  // ============================================

  private processDismember(player: PlayerSchema, playerId: string, dt: number) {
    const target = this.state.players.get(player.dismemberTargetId);
    if (!target || !target.alive) {
      player.dismemberActive = false;
      player.dismemberTargetId = "";
      player.dismemberTimer = 0;
      return;
    }

    player.dismemberTimer -= (1000 / TICK_RATE);
    const dmg = this.getEffectiveDismemberDamage(player) * dt;
    const died = this.applyDamage(playerId, target, player.dismemberTargetId, dmg);

    if (player.dismemberTimer <= 0 || died) {
      player.dismemberActive = false;
      player.dismemberTargetId = "";
      player.dismemberTimer = 0;
    }
  }

  // ============================================
  // Spawn healing
  // ============================================

  private processSpawnHeal(player: PlayerSchema, dt: number) {
    const spawnX = player.team === TEAM_LEFT ? SPAWN_X_LEFT : SPAWN_X_RIGHT;
    const spawnY = MAP_HEIGHT / 2;
    const dist = distance({ x: player.x, y: player.y }, { x: spawnX, y: spawnY });

    if (dist <= SPAWN_HEAL_RADIUS) {
      const maxHp = this.getEffectiveMaxHp(player);
      const healRate = this.getEffectiveHpRegen(player);
      player.hp = Math.min(player.hp + healRate * dt, maxHp);
    }
  }

  // ============================================
  // Hook
  // ============================================

  private updateHook(player: PlayerSchema, playerId: string, input: InputMessage, dt: number) {
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
<<<<<<< HEAD
          player.hookCooldown = this.getEffectiveHookCooldown(player);
=======
          hook.bounces = 0;
          hook.prevX = player.x;
          hook.prevY = player.y;
          player.hookCooldown = HOOK_COOLDOWN;
>>>>>>> worktree-agent-aecd704e
        }
        break;

      case "flying": {
<<<<<<< HEAD
        // Move hook forward using effective speed
        const hookSpeed = this.getEffectiveHookSpeed(player);
        const newX = hook.x + hook.dirX * hookSpeed * dt;
        const newY = hook.y + hook.dirY * hookSpeed * dt;
        hook.x = newX;
        hook.y = newY;
=======
        // Move hook forward with bounce support
        const result = moveHook(
          hook.x, hook.y, hook.dirX, hook.dirY,
          hook.startX, hook.startY, dt,
          hook.bounces
        );
        hook.x = result.x;
        hook.y = result.y;
        hook.dirX = result.dirX;
        hook.dirY = result.dirY;
        hook.bounces = result.newBounces;

        // Broadcast bounce effect to clients
        if (result.bounced) {
          this.broadcast("hookBounce", {
            x: result.x,
            y: result.y,
            ownerId: player.id,
          });
        }
>>>>>>> worktree-agent-aecd704e

        // Check out of range using effective range
        const hookRange = this.getEffectiveHookRange(player);
        const distFromStart = distance(
          { x: newX, y: newY },
          { x: hook.startX, y: hook.startY }
        );
        if (distFromStart >= hookRange) {
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
          if (other.phaseActive) return; // can't hook phased players

          if (circleCollision(
            { x: hook.x, y: hook.y }, HOOK_RADIUS,
            { x: other.x, y: other.y }, PLAYER_RADIUS
          )) {
            hook.state = "hit";
            hook.targetId = otherId;
            hitPlayer = true;

            // Track damage for assists
            this.trackDamage(playerId, otherId);

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
          this.handleKill(player, playerId, target, hook.targetId);

          hook.state = "idle";
          hook.targetId = "";
<<<<<<< HEAD
=======
          hook.bounces = 0;

          this.broadcast("kill", {
            killerName: player.nickname,
            victimName: target.nickname,
            killerTeam: player.team,
          });
>>>>>>> worktree-agent-aecd704e
        }
        break;
      }

      case "returning": {
        const ret = returnHook(hook.x, hook.y, player.x, player.y, dt);
        hook.x = ret.x;
        hook.y = ret.y;

        if (ret.arrived) {
          hook.state = "idle";
          hook.bounces = 0;
        }
        break;
      }
    }
  }
}

// Helper: movePlayer with custom speed (supports upgrades + phase speed boost)
function movePlayerWithSpeed(
  x: number, y: number, dx: number, dy: number,
  team: number, dt: number, speed: number
): { x: number; y: number } {
  let len = Math.sqrt(dx * dx + dy * dy);
  if (len > 0) {
    dx /= len;
    dy /= len;
  }

  const newX = x + dx * speed * dt;
  const newY = y + dy * speed * dt;

  return clampPlayerPosition(newX, newY, team);
}
