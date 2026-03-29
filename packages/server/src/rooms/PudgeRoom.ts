import { Room, Client } from "@colyseus/core";
import { GameState, PlayerSchema, HookSchema, RuneSchema } from "./schema";
import {
  TICK_RATE, KILLS_TO_WIN, MAX_PLAYERS, MAX_PLAYERS_PER_TEAM,
  TEAM_LEFT, TEAM_RIGHT, PLAYER_MAX_HP, PLAYER_SPEED, HOOK_COOLDOWN,
  RESPAWN_TIME, HOOK_RADIUS, PLAYER_RADIUS, HOOK_DAMAGE, HOOK_MAX_RANGE,
  SPAWN_X_LEFT, SPAWN_X_RIGHT, SPAWN_Y_OFFSETS,
  MAP_HEIGHT,
  // Rune constants
  RUNE_SPAWN_INTERVAL, RUNE_FIRST_SPAWN, RUNE_PICKUP_RADIUS,
  RUNE_TYPES, RUNE_POSITIONS, RUNE_EFFECTS,
  // Level constants
  EXP_PER_KILL, EXP_PER_ASSIST, MAX_LEVEL, EXP_PER_LEVEL,
  HP_PER_LEVEL, SPEED_PER_LEVEL, HOOK_DAMAGE_PER_LEVEL, HOOK_RANGE_LEVEL_BONUSES,
  // Consumable constants
  CONSUMABLES,
  // Hook modifier constants (Lane C)
  HOOK_MODIFIERS,
  // Skill constants
  PHASE_DURATION, PHASE_COOLDOWN,
  DISMEMBER_RANGE, DISMEMBER_DAMAGE, DISMEMBER_DURATION, DISMEMBER_COOLDOWN,
  ROT_DAMAGE, ROT_SELF_DAMAGE, ROT_RADIUS,
} from "shared";
import type { HookModifier } from "shared";
import { InputMessage, HookState, GamePhase } from "shared";
import {
  movePlayer, moveHook, pullTarget, returnHook,
  circleCollision, normalize, distance, clampPlayerPosition,
} from "../physics/collision";

export class PudgeRoom extends Room<GameState> {
  private tickInterval!: ReturnType<typeof setInterval>;
  private playerInputs: Map<string, InputMessage> = new Map();
  private leftCount = 0;
  private rightCount = 0;
  private runeSpawnTimer = 0;
  private gameTime = 0;

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

    // Handle skill activation (rot toggle, phase shift, dismember)
    this.onMessage("skill", (client, msg: { skill: string }) => {
      if (this.state.phase !== GamePhase.PLAYING) return;
      const player = this.state.players.get(client.sessionId);
      if (!player || !player.alive) return;

      switch (msg.skill) {
        case 'rot':
          if (!player.hasRot) return;
          // Toggle rot on/off
          player.rotActive = !player.rotActive;
          break;

        case 'phase':
          if (!player.hasPhase) return;
          if (player.phaseCooldown > 0) return;
          player.phaseActive = true;
          player.phaseTimer = PHASE_DURATION;
          player.phaseCooldown = PHASE_COOLDOWN;
          this.broadcast("phaseShift", { sessionId: client.sessionId });
          break;

        case 'dismember': {
          if (player.dismemberCooldown > 0) return;
          // Find nearest enemy in range
          let closestId = "";
          let closestDist = DISMEMBER_RANGE + 1;
          this.state.players.forEach((other, otherId) => {
            if (otherId === client.sessionId) return;
            if (other.team === player.team) return;
            if (!other.alive) return;
            const dist = distance(
              { x: player.x, y: player.y },
              { x: other.x, y: other.y }
            );
            if (dist < closestDist) {
              closestDist = dist;
              closestId = otherId;
            }
          });
          if (!closestId) return;
          player.dismemberActive = true;
          player.dismemberTimer = DISMEMBER_DURATION;
          player.dismemberCooldown = DISMEMBER_COOLDOWN;
          player.dismemberTargetId = closestId;
          this.broadcast("dismember", { sessionId: client.sessionId, targetId: closestId });
          break;
        }
      }
    });

    // Handle buy (consumables + abilities + hook modifiers)
    this.onMessage("buy", (client, msg: { itemId?: string; upgradeId?: string }) => {
      if (this.state.phase !== GamePhase.PLAYING) return;
      const player = this.state.players.get(client.sessionId);
      if (!player || !player.alive) return;

      const id = msg.itemId || msg.upgradeId;
      if (!id) return;

      // === Ability purchases (Lane C) ===
      if (id === 'rot') {
        if (player.hasRot || player.gold < 200) return;
        player.gold -= 200;
        player.hasRot = true;
        this.broadcast("abilityPurchased", { nickname: player.nickname, ability: 'rot', sessionId: client.sessionId });
        return;
      }
      if (id === 'phase') {
        if (player.hasPhase || player.gold < 300) return;
        player.gold -= 300;
        player.hasPhase = true;
        this.broadcast("abilityPurchased", { nickname: player.nickname, ability: 'phase', sessionId: client.sessionId });
        return;
      }

      // === Hook modifier purchases (Lane C) ===
      const hookMod = HOOK_MODIFIERS.find(m => m.id === id);
      if (hookMod) {
        if (player.gold < hookMod.cost) return;
        player.gold -= hookMod.cost;
        player.hookModifier = hookMod.id;
        this.broadcast("hookModPurchased", { nickname: player.nickname, modifier: hookMod.id, sessionId: client.sessionId });
        return;
      }

      // === Consumable purchases (Lane B) ===
      const def = CONSUMABLES.find(c => c.id === id);
      if (!def) return;
      if (player.gold < def.cost) return;

      switch (def.id) {
        case 'salve':
          player.gold -= def.cost;
          player.healOverTime += 200; // will heal 20/s for 10s
          break;
        case 'potion':
          player.gold -= def.cost;
          player.hp = Math.min(player.hp + 300, this.getEffectiveMaxHp(player));
          break;
        case 'tome_exp':
          player.gold -= def.cost;
          this.grantExp(player, player.expToNext - player.exp); // instant level up
          break;
        case 'tome_damage':
          player.gold -= def.cost;
          player.bonusDamage += 25;
          break;
        case 'tome_hp':
          player.gold -= def.cost;
          player.bonusMaxHp += 100;
          player.hp = Math.min(player.hp + 100, this.getEffectiveMaxHp(player));
          break;
      }

      this.broadcast("itemPurchased", {
        nickname: player.nickname,
        itemId: def.id,
        itemName: def.name,
      });
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

    player.hp = this.getEffectiveMaxHp(player);
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
    this.gameTime = 0;
    this.state.gameTime = 0;
    this.runeSpawnTimer = RUNE_SPAWN_INTERVAL;

    // Clear runes
    this.state.runes.splice(0, this.state.runes.length);

    // Reset all players
    this.state.players.forEach((player) => {
      player.hp = PLAYER_MAX_HP;
      player.alive = true;
      player.kills = 0;
      player.deaths = 0;
      player.hookCooldown = 0;
      player.respawnTimer = 0;
      player.hook.state = "idle";

      // Reset rune state
      player.activeRune = "";
      player.runeTimer = 0;
      player.invisible = false;

      // Reset level state
      player.level = 1;
      player.exp = 0;
      player.expToNext = EXP_PER_LEVEL;

      // Reset consumable state
      player.gold = 0;
      player.healOverTime = 0;
      player.bonusDamage = 0;
      player.bonusMaxHp = 0;

      // Reset skill purchase state (Lane C)
      player.hasRot = false;
      player.hasPhase = false;
      player.hookModifier = "none";

      // Reset hook modifier effect timers (Lane C)
      player.burnTimer = 0;
      player.burnDamage = 0;
      player.slowTimer = 0;
      player.slowPercent = 0;

      // Reset skill active state
      player.rotActive = false;
      player.rotCooldown = 0;
      player.phaseActive = false;
      player.phaseTimer = 0;
      player.phaseCooldown = 0;
      player.dismemberActive = false;
      player.dismemberTimer = 0;
      player.dismemberCooldown = 0;
      player.dismemberTargetId = "";

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

    // Clear rune effects on respawn
    player.activeRune = "";
    player.runeTimer = 0;
    player.invisible = false;

    // Clear active skills on respawn
    player.rotActive = false;
    player.dismemberActive = false;
    player.dismemberTimer = 0;
    player.dismemberTargetId = "";
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
    const dtMs = 1000 / TICK_RATE;

    // Update game time
    this.gameTime += dtMs;
    this.state.gameTime = this.gameTime;

    // === Rune spawn logic ===
    this.updateRunes(dtMs);

    this.state.players.forEach((player, sessionId) => {
      // Handle respawn timer
      if (!player.alive) {
        player.respawnTimer -= dtMs;
        if (player.respawnTimer <= 0) {
          this.respawnPlayer(player);
        }
        return;
      }

      // Handle cooldown
      if (player.hookCooldown > 0) {
        player.hookCooldown -= dtMs;
        if (player.hookCooldown < 0) player.hookCooldown = 0;
      }

      // === Skill cooldowns ===
      if (player.phaseCooldown > 0) {
        player.phaseCooldown -= dtMs;
        if (player.phaseCooldown < 0) player.phaseCooldown = 0;
      }
      if (player.dismemberCooldown > 0) {
        player.dismemberCooldown -= dtMs;
        if (player.dismemberCooldown < 0) player.dismemberCooldown = 0;
      }

      // === Phase shift timer ===
      if (player.phaseTimer > 0) {
        player.phaseTimer -= dtMs;
        if (player.phaseTimer <= 0) {
          player.phaseTimer = 0;
          player.phaseActive = false;
        }
      }

      // === Rot AOE damage ===
      if (player.rotActive && player.hasRot) {
        // Self-damage
        player.hp -= ROT_SELF_DAMAGE * dt;
        // Damage nearby enemies
        this.state.players.forEach((other, otherId) => {
          if (otherId === sessionId) return;
          if (other.team === player.team) return;
          if (!other.alive) return;
          // Skip phased players
          if (other.phaseActive) return;
          const dist = distance(
            { x: player.x, y: player.y },
            { x: other.x, y: other.y }
          );
          if (dist < ROT_RADIUS) {
            other.hp -= ROT_DAMAGE * dt;
            // Check enemy death from rot
            if (other.hp <= 0) {
              other.alive = false;
              other.hp = 0;
              other.deaths++;
              other.respawnTimer = RESPAWN_TIME;
              player.kills++;
              this.grantExp(player, EXP_PER_KILL);
              player.gold += 100;
              if (player.team === TEAM_LEFT) this.state.leftScore++;
              else this.state.rightScore++;
              this.broadcast("kill", {
                killerName: player.nickname,
                victimName: other.nickname,
                killerTeam: player.team,
              });
            }
          }
        });
        // Check self-death from rot
        if (player.hp <= 0) {
          player.alive = false;
          player.hp = 0;
          player.deaths++;
          player.rotActive = false;
          player.respawnTimer = RESPAWN_TIME;
          this.broadcast("kill", {
            killerName: player.nickname,
            victimName: player.nickname,
            killerTeam: player.team,
            suicide: true,
          });
          return;
        }
      }

      // === Dismember channel ===
      if (player.dismemberActive && player.dismemberTimer > 0) {
        player.dismemberTimer -= dtMs;
        const target = this.state.players.get(player.dismemberTargetId);
        if (target && target.alive) {
          // Lock both players in place (handled by skipping movement when dismembering)
          target.hp -= DISMEMBER_DAMAGE * dt;
          if (target.hp <= 0) {
            target.alive = false;
            target.hp = 0;
            target.deaths++;
            target.respawnTimer = RESPAWN_TIME;
            player.kills++;
            this.grantExp(player, EXP_PER_KILL);
            player.gold += 100;
            if (player.team === TEAM_LEFT) this.state.leftScore++;
            else this.state.rightScore++;
            this.broadcast("kill", {
              killerName: player.nickname,
              victimName: target.nickname,
              killerTeam: player.team,
            });
            // End dismember
            player.dismemberActive = false;
            player.dismemberTimer = 0;
            player.dismemberTargetId = "";
          }
        } else {
          // Target died or disconnected, end dismember
          player.dismemberActive = false;
          player.dismemberTimer = 0;
          player.dismemberTargetId = "";
        }
        if (player.dismemberTimer <= 0) {
          player.dismemberActive = false;
          player.dismemberTimer = 0;
          player.dismemberTargetId = "";
        }
      }

      // === Process rune effects ===
      this.processRuneEffects(player, dt, dtMs);

      // === Process heal over time (salve) ===
      if (player.healOverTime > 0) {
        const healRate = 20; // 20 HP/s (200 total over 10s)
        const healAmount = healRate * dt;
        player.hp = Math.min(player.hp + healAmount, this.getEffectiveMaxHp(player));
        player.healOverTime -= healAmount;
        if (player.healOverTime <= 0) player.healOverTime = 0;
      }

      // === Rune pickup check ===
      this.checkRunePickup(player);

      // === Process burn damage over time (Lane C) ===
      if (player.burnTimer > 0) {
        player.hp -= player.burnDamage * dt;
        player.burnTimer -= dtMs;
        if (player.burnTimer <= 0) {
          player.burnTimer = 0;
          player.burnDamage = 0;
        }
        // Check death from burn
        if (player.hp <= 0) {
          player.alive = false;
          player.hp = 0;
          player.deaths++;
          player.respawnTimer = RESPAWN_TIME;
          this.broadcast("kill", {
            killerName: "burn",
            victimName: player.nickname,
            killerTeam: -1,
          });
          return;
        }
      }

      // === Process slow timer (Lane C) ===
      if (player.slowTimer > 0) {
        player.slowTimer -= dtMs;
        if (player.slowTimer <= 0) {
          player.slowTimer = 0;
          player.slowPercent = 0;
        }
      }

      const input = this.playerInputs.get(sessionId);
      if (!input) return;

      // Update aim direction
      player.aimX = input.aimX;
      player.aimY = input.aimY;

      // Move player (only if not being pulled or channeling dismember)
      if ((player.hook.state !== "hit" || player.hook.targetId !== sessionId) && !player.dismemberActive) {
        let speed = this.getEffectiveMoveSpeed(player);
        // Apply slow effect from hook modifier (Lane C)
        if (player.slowTimer > 0 && player.slowPercent > 0) {
          speed *= (1 - player.slowPercent);
        }
        const pos = this.movePlayerWithSpeed(player.x, player.y, input.dx, input.dy, player.team, dt, speed);
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

          // Break invisibility on ability use
          if (player.activeRune === 'invis') {
            player.activeRune = "";
            player.runeTimer = 0;
            player.invisible = false;
          }
        }
        break;

      case "flying": {
        // Move hook forward
        const result = moveHook(hook.x, hook.y, hook.dirX, hook.dirY, hook.startX, hook.startY, dt, hook.bounces);
        hook.x = result.x;
        hook.y = result.y;
        hook.dirX = result.dirX;
        hook.dirY = result.dirY;
        hook.bounces = result.newBounces;

        // Check out of range (with level bonus range extending base HOOK_MAX_RANGE)
        const bonusRange = this.getEffectiveHookRange(player);
        if (bonusRange > 0) {
          // Override base range check with extended range
          const hookDist = distance(
            { x: hook.x, y: hook.y },
            { x: hook.startX, y: hook.startY }
          );
          if (hookDist >= (HOOK_MAX_RANGE + bonusRange)) {
            hook.state = "returning";
            break;
          }
        } else if (result.outOfRange) {
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
          if (other.phaseActive) return; // Phased players can't be hooked

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
          // Apply hook damage (Lane B: level-scaled)
          const hookDamage = this.getEffectiveHookDamage(player);
          target.hp -= hookDamage;

          // Apply hook modifier effects (Lane C)
          switch (player.hookModifier as HookModifier) {
            case 'flame':
              target.burnTimer = 3000;
              target.burnDamage = 20;
              break;
            case 'freeze':
              target.slowTimer = 3000;
              target.slowPercent = 0.5;
              break;
            case 'lifesteal': {
              const healAmount = hookDamage * 0.3;
              player.hp = Math.min(player.hp + healAmount, this.getEffectiveMaxHp(player));
              break;
            }
            case 'rupture': {
              // Extra damage based on pull distance
              const pullDist = distance(
                { x: hook.startX, y: hook.startY },
                { x: target.x, y: target.y }
              );
              const extraDmg = Math.floor(pullDist / 10);
              target.hp -= extraDmg;
              break;
            }
          }

          if (target.hp <= 0) {
            target.alive = false;
            target.hp = 0;
            target.deaths++;
            target.respawnTimer = RESPAWN_TIME;
            player.kills++;

            // Grant exp and gold to killer
            this.grantExp(player, EXP_PER_KILL);
            player.gold += 100;

            // Break invisibility on attack
            if (player.activeRune === 'invis') {
              player.activeRune = "";
              player.runeTimer = 0;
              player.invisible = false;
            }

            // Update score
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

          hook.state = "idle";
          hook.targetId = "";
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

  // === Rune System ===

  private updateRunes(dtMs: number) {
    // Don't spawn runes before RUNE_FIRST_SPAWN
    if (this.gameTime < RUNE_FIRST_SPAWN) return;

    this.runeSpawnTimer -= dtMs;
    if (this.runeSpawnTimer <= 0) {
      this.runeSpawnTimer = RUNE_SPAWN_INTERVAL;
      this.spawnRunes();
    }
  }

  private spawnRunes() {
    // Remove old inactive runes
    for (let i = this.state.runes.length - 1; i >= 0; i--) {
      const r = this.state.runes.at(i);
      if (r && !r.active) {
        this.state.runes.splice(i, 1);
      }
    }

    // Spawn rune at each position
    for (const pos of RUNE_POSITIONS) {
      const rune = new RuneSchema();
      rune.x = pos.x;
      rune.y = pos.y;
      rune.runeType = RUNE_TYPES[Math.floor(Math.random() * RUNE_TYPES.length)];
      rune.active = true;
      this.state.runes.push(rune);
    }

    this.broadcast("runesSpawned", {});
  }

  private checkRunePickup(player: PlayerSchema) {
    for (let i = 0; i < this.state.runes.length; i++) {
      const rune = this.state.runes.at(i);
      if (!rune || !rune.active) continue;

      const dist = distance({ x: player.x, y: player.y }, { x: rune.x, y: rune.y });
      if (dist < RUNE_PICKUP_RADIUS) {
        rune.active = false;

        // Apply rune effect
        const runeType = rune.runeType as keyof typeof RUNE_EFFECTS;
        player.activeRune = rune.runeType;
        player.runeTimer = RUNE_EFFECTS[runeType].duration;

        if (rune.runeType === 'invis') {
          player.invisible = true;
        }

        this.broadcast("runePicked", {
          nickname: player.nickname,
          runeType: rune.runeType,
        });
        break; // only pick up one rune per tick
      }
    }
  }

  private processRuneEffects(player: PlayerSchema, dt: number, dtMs: number) {
    if (!player.activeRune || player.runeTimer <= 0) return;

    // Regen rune: heal 50 HP/s
    if (player.activeRune === 'regen') {
      const healAmount = 50 * dt;
      player.hp = Math.min(player.hp + healAmount, this.getEffectiveMaxHp(player));
    }

    // Decrement timer
    player.runeTimer -= dtMs;
    if (player.runeTimer <= 0) {
      player.runeTimer = 0;
      if (player.activeRune === 'invis') {
        player.invisible = false;
      }
      player.activeRune = "";
    }
  }

  // === Level System ===

  private grantExp(player: PlayerSchema, amount: number) {
    if (player.level >= MAX_LEVEL) return;
    player.exp += amount;
    while (player.exp >= player.expToNext && player.level < MAX_LEVEL) {
      player.exp -= player.expToNext;
      player.level++;
      player.expToNext = EXP_PER_LEVEL * player.level;

      // Heal to new max HP on level up
      player.hp = this.getEffectiveMaxHp(player);

      this.broadcast("levelUp", { nickname: player.nickname, level: player.level });
    }
  }

  // === Effective Stat Getters ===

  private getEffectiveMaxHp(player: PlayerSchema): number {
    return PLAYER_MAX_HP + player.level * HP_PER_LEVEL + player.bonusMaxHp;
  }

  private getEffectiveMoveSpeed(player: PlayerSchema): number {
    let speed = PLAYER_SPEED + player.level * SPEED_PER_LEVEL;
    if (player.activeRune === 'haste') {
      speed *= 1.5;
    }
    return speed;
  }

  private getEffectiveHookDamage(player: PlayerSchema): number {
    let damage = HOOK_DAMAGE + player.level * HOOK_DAMAGE_PER_LEVEL + player.bonusDamage;
    if (player.activeRune === 'dd') {
      damage *= 2;
    }
    return damage;
  }

  private movePlayerWithSpeed(
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

  private getEffectiveHookRange(player: PlayerSchema): number {
    let range = 0; // base range from HOOK_MAX_RANGE is used in collision.ts
    let bonusCount = 0;
    for (const milestone of HOOK_RANGE_LEVEL_BONUSES) {
      if (player.level >= milestone) {
        bonusCount++;
      }
    }
    range += bonusCount * 50;
    return range;
  }
}
