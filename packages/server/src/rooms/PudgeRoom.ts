import { Room, Client } from "@colyseus/core";
import { GameState, PlayerSchema, HookSchema } from "./schema";
import {
  TICK_RATE, KILLS_TO_WIN, MAX_PLAYERS, MAX_PLAYERS_PER_TEAM,
  TEAM_LEFT, TEAM_RIGHT, PLAYER_MAX_HP, HOOK_COOLDOWN,
  RESPAWN_TIME, HOOK_RADIUS, PLAYER_RADIUS, HOOK_DAMAGE,
  SPAWN_X_LEFT, SPAWN_X_RIGHT, SPAWN_Y_OFFSETS, MAP_HEIGHT,
} from "shared";
import { InputMessage, GamePhase } from "shared";
import { movePlayer, moveHook, pullTarget, returnHook, circleCollision, normalize } from "../physics/collision";

export class PudgeRoom extends Room<GameState> {
  private tickInterval!: ReturnType<typeof setInterval>;
  private playerInputs: Map<string, InputMessage> = new Map();
  private leftCount = 0;
  private rightCount = 0;

  onCreate() {
    const state = new GameState();
    state.roomCode = this.generateRoomCode();
    this.setState(state);
    this.maxClients = MAX_PLAYERS;

    this.onMessage("input", (client, msg: InputMessage) => {
      this.playerInputs.set(client.sessionId, msg);
    });

    this.onMessage("start", () => {
      if (this.state.phase === GamePhase.WAITING && this.clients.length >= 2) {
        this.startGame();
      }
    });

    this.onMessage("restart", () => {
      if (this.state.phase === GamePhase.FINISHED) {
        this.startGame();
      }
    });

    this.tickInterval = setInterval(() => this.gameLoop(), 1000 / TICK_RATE);
  }

  onJoin(client: Client, options: any) {
    const player = new PlayerSchema();
    player.id = client.sessionId;
    player.nickname = options.nickname || `Player${this.clients.length}`;

    if (this.leftCount <= this.rightCount) {
      player.team = TEAM_LEFT;
      player.spawnIndex = this.leftCount;
      this.leftCount++;
    } else {
      player.team = TEAM_RIGHT;
      player.spawnIndex = this.rightCount;
      this.rightCount++;
    }

    this.respawnPlayer(player);
    player.hp = PLAYER_MAX_HP;
    player.alive = true;
    player.hook = new HookSchema();
    this.state.players.set(client.sessionId, player);
    this.broadcast("playerJoined", { nickname: player.nickname, team: player.team });
  }

  onLeave(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (player) {
      if (player.team === TEAM_LEFT) this.leftCount--;
      else this.rightCount--;
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
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }

  private startGame() {
    this.state.phase = GamePhase.PLAYING;
    this.state.leftScore = 0;
    this.state.rightScore = 0;
    this.state.winningTeam = -1;
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

  private respawnPlayer(player: PlayerSchema) {
    const yCenter = MAP_HEIGHT / 2;
    const yOffset = SPAWN_Y_OFFSETS[player.spawnIndex] || 0;
    player.x = player.team === TEAM_LEFT ? SPAWN_X_LEFT : SPAWN_X_RIGHT;
    player.y = yCenter + yOffset;
    player.hp = PLAYER_MAX_HP;
    player.alive = true;
    player.hook.state = "idle";
  }

  private gameLoop() {
    if (this.state.phase !== GamePhase.PLAYING) return;
    const dt = 1 / TICK_RATE;

    this.state.players.forEach((player, sessionId) => {
      // Respawn timer
      if (!player.alive) {
        player.respawnTimer -= 1000 / TICK_RATE;
        if (player.respawnTimer <= 0) this.respawnPlayer(player);
        return;
      }

      // Cooldown
      if (player.hookCooldown > 0) {
        player.hookCooldown -= 1000 / TICK_RATE;
        if (player.hookCooldown < 0) player.hookCooldown = 0;
      }

      const input = this.playerInputs.get(sessionId);
      if (!input) return;

      player.aimX = input.aimX;
      player.aimY = input.aimY;

      // Check if being pulled by someone's hook
      let isBeingPulled = false;
      this.state.players.forEach((other) => {
        if (other.hook.state === "hit" && other.hook.targetId === sessionId) {
          isBeingPulled = true;
        }
      });

      // Move player (skip if being pulled)
      if (!isBeingPulled) {
        const pos = movePlayer(player.x, player.y, input.dx, input.dy, player.team, dt);
        player.x = pos.x;
        player.y = pos.y;
      }

      this.updateHook(player, input, dt);
    });

    // Win condition
    if (this.state.leftScore >= KILLS_TO_WIN) {
      this.state.phase = GamePhase.FINISHED;
      this.state.winningTeam = TEAM_LEFT;
      this.broadcast("gameOver", { winningTeam: TEAM_LEFT, leftScore: this.state.leftScore, rightScore: this.state.rightScore });
    } else if (this.state.rightScore >= KILLS_TO_WIN) {
      this.state.phase = GamePhase.FINISHED;
      this.state.winningTeam = TEAM_RIGHT;
      this.broadcast("gameOver", { winningTeam: TEAM_RIGHT, leftScore: this.state.leftScore, rightScore: this.state.rightScore });
    }
  }

  private updateHook(player: PlayerSchema, input: InputMessage, dt: number) {
    const hook = player.hook;

    switch (hook.state) {
      case "idle":
        if (input.hook && player.hookCooldown <= 0) {
          const rawDir = { x: input.aimX - player.x, y: input.aimY - player.y };
          if (rawDir.x === 0 && rawDir.y === 0) rawDir.x = 1;
          const dir = normalize(rawDir);
          hook.x = player.x;
          hook.y = player.y;
          hook.startX = player.x;
          hook.startY = player.y;
          hook.dirX = dir.x;
          hook.dirY = dir.y;
          hook.state = "flying";
          hook.targetId = "";
          hook.bounces = 0;
          player.hookCooldown = HOOK_COOLDOWN;
        }
        break;

      case "flying": {
        const result = moveHook(hook.x, hook.y, hook.dirX, hook.dirY, hook.startX, hook.startY, dt, hook.bounces);
        hook.x = result.x;
        hook.y = result.y;
        hook.dirX = result.dirX;
        hook.dirY = result.dirY;
        hook.bounces = result.newBounces;

        if (result.bounced) {
          this.broadcast("hookBounce", { x: hook.x, y: hook.y });
        }

        if (result.outOfRange) {
          hook.state = "returning";
          break;
        }

        // Check collision with enemies
        let hitPlayer = false;
        this.state.players.forEach((other, otherId) => {
          if (hitPlayer || otherId === player.id || other.team === player.team || !other.alive) return;
          if (circleCollision({ x: hook.x, y: hook.y }, HOOK_RADIUS, { x: other.x, y: other.y }, PLAYER_RADIUS)) {
            hook.state = "hit";
            hook.targetId = otherId;
            hitPlayer = true;
            this.broadcast("hookHit", { hookOwner: player.nickname, target: other.nickname });
          }
        });
        break;
      }

      case "hit": {
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
          // Kill target
          target.alive = false;
          target.hp = 0;
          target.deaths++;
          target.respawnTimer = RESPAWN_TIME;
          player.kills++;

          if (player.team === TEAM_LEFT) this.state.leftScore++;
          else this.state.rightScore++;

          hook.state = "idle";
          hook.targetId = "";

          this.broadcast("kill", { killerName: player.nickname, victimName: target.nickname, killerTeam: player.team });
        }
        break;
      }

      case "returning": {
        const ret = returnHook(hook.x, hook.y, player.x, player.y, dt);
        hook.x = ret.x;
        hook.y = ret.y;
        if (ret.arrived) hook.state = "idle";
        break;
      }
    }
  }
}
