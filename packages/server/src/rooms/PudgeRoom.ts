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

      // Move player (only if not being pulled)
      if (player.hook.state !== "hit" || player.hook.targetId !== sessionId) {
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
}
