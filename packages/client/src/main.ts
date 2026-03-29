import Phaser from "phaser";
import { GameScene } from "./scenes/GameScene";
import { createRoom, joinRoom, getRoom, sendStart, sendRestart } from "./network/client";
import { MAP_WIDTH, MAP_HEIGHT, TEAM_LEFT, SPAWN_X_LEFT, SPAWN_X_RIGHT } from "shared";
import { HUD } from "./ui/HUD";
import { ShopUI } from "./ui/ShopUI";

// Initialize Phaser (hidden until game starts)
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: MAP_WIDTH,
  height: MAP_HEIGHT,
  parent: "game-container",
  backgroundColor: "#2d5a27",
  pixelArt: true,
  antialias: false,
  scene: [GameScene],
  physics: { default: "arcade" }, // just for convenience, not used for game logic
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: {
    keyboard: true,
    mouse: true,
  },
  autoStart: false, // Don't start until connected
};

const game = new Phaser.Game(config);

// === DOM UI Logic ===
const lobby = document.getElementById("lobby")!;
const waiting = document.getElementById("waiting")!;
const gameOverOverlay = document.getElementById("game-over")!;
const nicknameInput = document.getElementById("nickname") as HTMLInputElement;
const roomCodeInput = document.getElementById("room-code-input") as HTMLInputElement;
const btnCreate = document.getElementById("btn-create")!;
const btnJoin = document.getElementById("btn-join")!;
const btnStart = document.getElementById("btn-start")!;
const btnRestart = document.getElementById("btn-restart")!;
const errorMsg = document.getElementById("error-msg")!;
const displayRoomCode = document.getElementById("display-room-code")!;
const teamLeftPlayers = document.getElementById("team-left-players")!;
const teamRightPlayers = document.getElementById("team-right-players")!;
const waitingInfo = document.getElementById("waiting-info")!;

function showError(msg: string) {
  errorMsg.textContent = msg;
  setTimeout(() => { errorMsg.textContent = ""; }, 3000);
}

function getNickname(): string {
  const name = nicknameInput.value.trim();
  if (!name) {
    showError("請輸入暱稱！");
    return "";
  }
  return name;
}

async function onCreateRoom() {
  const nickname = getNickname();
  if (!nickname) return;

  try {
    btnCreate.textContent = "建立中...";
    const room = await createRoom(nickname);
    enterWaitingRoom(room);
  } catch (e: any) {
    showError("建立房間失敗：" + e.message);
    btnCreate.textContent = "建立房間";
  }
}

async function onJoinRoom() {
  const nickname = getNickname();
  if (!nickname) return;

  const code = roomCodeInput.value.trim().toUpperCase();
  if (!code || code.length < 4) {
    showError("請輸入 4 位房間代碼！");
    return;
  }

  try {
    btnJoin.textContent = "加入中...";
    const room = await joinRoom(code, nickname);
    enterWaitingRoom(room);
  } catch (e: any) {
    showError("加入失敗：房間不存在或已滿");
    btnJoin.textContent = "加入房間";
  }
}

function enterWaitingRoom(room: any) {
  lobby.classList.add("hidden");
  waiting.classList.add("visible");

  displayRoomCode.textContent = room.id;

  // Update player list
  const updatePlayerList = () => {
    teamLeftPlayers.innerHTML = "";
    teamRightPlayers.innerHTML = "";
    let count = 0;

    room.state.players.forEach((player: any) => {
      const div = document.createElement("div");
      div.className = "player-name";
      div.textContent = player.nickname;
      if (player.id === room.sessionId) {
        div.textContent += " (你)";
        div.style.fontWeight = "bold";
      }

      if (player.team === TEAM_LEFT) {
        teamLeftPlayers.appendChild(div);
      } else {
        teamRightPlayers.appendChild(div);
      }
      count++;
    });

    waitingInfo.textContent = count < 2
      ? `還需要 ${2 - count} 位玩家才能開始`
      : `${count} 位玩家已就緒！`;
    (btnStart as HTMLButtonElement).disabled = count < 2;
  };

  room.state.players.onAdd(updatePlayerList);
  room.state.players.onRemove(updatePlayerList);

  // Listen for game start
  room.onMessage("gameStarted", () => {
    waiting.classList.remove("visible");
    gameOverOverlay.classList.remove("visible");
    game.scene.start("GameScene");
    // Initialize HUD and Shop UI
    initGameUI(room);
  });

  // Copy room code on click
  displayRoomCode.style.cursor = "pointer";
  displayRoomCode.title = "點擊複製";
  displayRoomCode.addEventListener("click", () => {
    navigator.clipboard.writeText(room.id).then(() => {
      displayRoomCode.style.color = "#a8d98a";
      setTimeout(() => { displayRoomCode.style.color = "#ffd93d"; }, 500);
    });
  });
}

// Start game button
btnStart.addEventListener("click", () => {
  sendStart();
});

// Restart button
btnRestart.addEventListener("click", () => {
  gameOverOverlay.classList.remove("visible");
  sendRestart();
});

// Create / Join buttons
btnCreate.addEventListener("click", onCreateRoom);
btnJoin.addEventListener("click", onJoinRoom);

// Enter key to join
roomCodeInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") onJoinRoom();
});
nicknameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") btnCreate.click();
});

// Auto-uppercase room code
roomCodeInput.addEventListener("input", () => {
  roomCodeInput.value = roomCodeInput.value.toUpperCase();
});

// === HUD & Shop wiring ===
let hud: HUD | null = null;
let shopUI: ShopUI | null = null;
let lastGold = 0;
// Track per-player alive state for detecting death/respawn transitions
const playerAliveState: Map<string, boolean> = new Map();

// Distance threshold to consider "near spawn" for shop
const SHOP_SPAWN_DISTANCE = 150;

function isNearSpawn(room: any): boolean {
  const player = room.state.players.get(room.sessionId);
  if (!player || !player.alive) return false;
  const spawnX = player.team === TEAM_LEFT ? SPAWN_X_LEFT : SPAWN_X_RIGHT;
  const dx = player.x - spawnX;
  const dy = player.y - MAP_HEIGHT / 2;
  return Math.sqrt(dx * dx + dy * dy) < SHOP_SPAWN_DISTANCE;
}

function initGameUI(room: any) {
  // Create HUD
  hud = new HUD();
  hud.show();
  lastGold = 0;
  playerAliveState.clear();

  // Create Shop UI
  shopUI = new ShopUI(room, room.sessionId);

  // Shop button click
  const shopBtn = document.getElementById("hud-shop-btn")!;
  shopBtn.addEventListener("click", () => {
    if (!shopUI) return;
    if (isNearSpawn(room)) {
      shopUI.toggle();
    }
  });

  // Keyboard 'B' to toggle shop
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "b" || e.key === "B") {
      if (!shopUI) return;
      // Don't toggle if typing in an input
      if (document.activeElement?.tagName === "INPUT") return;
      if (isNearSpawn(room)) {
        shopUI.toggle();
      }
    }
    // Escape to close shop
    if (e.key === "Escape" && shopUI?.isVisible()) {
      shopUI.hide();
    }
  };
  window.addEventListener("keydown", onKeyDown);

  // Listen for kill messages to track streaks
  room.onMessage("kill", (data: any) => {
    if (!hud) return;

    // Record kill for the killer
    const streak = hud.recordKill(data.killerId || data.killerName);

    // Show streak to the local player if they are the killer
    const myPlayer = room.state.players.get(room.sessionId);
    if (myPlayer && (data.killerName === myPlayer.nickname)) {
      hud.showKillStreak(streak);
    }

    // Record death for the victim to reset their streak
    hud.recordDeath(data.victimId || data.victimName);
  });

  // Track player state changes for death/respawn, gold, timer
  const updateLoop = setInterval(() => {
    if (!hud) { clearInterval(updateLoop); return; }
    const r = getRoom();
    if (!r) { clearInterval(updateLoop); return; }

    // Update timer from gameTime if available, otherwise estimate from state
    const gameTime = (r.state as any).gameTime;
    if (gameTime !== undefined) {
      hud.updateTimer(gameTime);
    }

    // Get local player
    const me = r.state.players.get(r.sessionId);
    if (!me) return;

    // Update gold
    const gold = (me as any).gold ?? 0;
    if (gold !== lastGold) {
      const delta = gold - lastGold;
      hud.updateGold(gold, delta);
      lastGold = gold;

      // Bounce animation on gold display
      const goldEl = document.getElementById("hud-gold");
      if (goldEl) {
        goldEl.classList.add("bounce");
        setTimeout(() => goldEl.classList.remove("bounce"), 200);
      }
    }

    // Update shop button state (near spawn or not)
    hud.setShopEnabled(isNearSpawn(r));

    // Update shop if visible
    if (shopUI?.isVisible()) {
      const upgrades: Record<string, number> = {};
      // Read upgrades from player state if available
      const playerUpgrades = (me as any).upgrades;
      if (playerUpgrades) {
        if (typeof playerUpgrades.forEach === "function") {
          playerUpgrades.forEach((val: number, key: string) => {
            upgrades[key] = val;
          });
        } else if (typeof playerUpgrades === "object") {
          Object.assign(upgrades, playerUpgrades);
        }
      }
      shopUI.update(gold, upgrades);
    }

    // Detect death/respawn transitions
    r.state.players.forEach((player: any, id: string) => {
      const wasAlive = playerAliveState.get(id);
      const isAlive = player.alive;

      if (wasAlive !== undefined && wasAlive !== isAlive) {
        if (!isAlive && id === r.sessionId) {
          // Local player died
          const respawnMs = player.respawnTimer || 3000;
          hud!.showDeathScreen(respawnMs);
          hud!.recordDeath(id);
        } else if (isAlive && id === r.sessionId) {
          // Local player respawned
          hud!.hideDeathScreen();
        }
      }

      playerAliveState.set(id, isAlive);
    });
  }, 100);

  // Listen for upgrade purchased confirmation
  room.onMessage("upgrade", (data: any) => {
    // Show brief notification
    const notif = document.createElement("div");
    notif.className = "kill-entry";
    notif.textContent = `✅ ${data.name || data.upgradeId} 升級！`;
    const feed = document.getElementById("kill-feed")!;
    feed.appendChild(notif);
    setTimeout(() => {
      notif.style.opacity = "0";
      notif.style.transition = "opacity 0.5s";
      setTimeout(() => notif.remove(), 500);
    }, 2000);
  });

  // Handle game over with scoreboard
  room.onMessage("gameOver", (data: any) => {
    // Populate scoreboard
    const rows = document.getElementById("scoreboard-rows")!;
    rows.innerHTML = "";

    const mvpDisplay = document.getElementById("mvp-display")!;
    let mvpName = "";
    let mvpKills = -1;

    // Collect all players
    const playersList: any[] = [];
    room.state.players.forEach((player: any) => {
      playersList.push({
        nickname: player.nickname,
        team: player.team,
        kills: player.kills || 0,
        deaths: player.deaths || 0,
        assists: (player as any).assists || 0,
        gold: (player as any).gold || 0,
      });
    });

    // Sort by kills desc
    playersList.sort((a: any, b: any) => b.kills - a.kills);

    // Find MVP (highest kills)
    if (playersList.length > 0) {
      mvpName = playersList[0].nickname;
      mvpKills = playersList[0].kills;
    }

    for (const p of playersList) {
      const row = document.createElement("div");
      row.className = "scoreboard-row";
      if (p.team === TEAM_LEFT) row.classList.add("team-left");
      else row.classList.add("team-right");
      if (p.nickname === mvpName) row.classList.add("mvp-row");

      row.innerHTML = `
        <span>${p.team === TEAM_LEFT ? "🌿" : "🌸"} ${p.nickname}</span>
        <span>${p.kills}</span>
        <span>${p.deaths}</span>
        <span>${p.assists}</span>
        <span>${p.gold}</span>
      `;
      rows.appendChild(row);
    }

    if (mvpName) {
      mvpDisplay.textContent = `🏆 MVP: ${mvpName} (${mvpKills} kills)`;
    } else {
      mvpDisplay.textContent = "";
    }

    // Clean up HUD
    if (hud) {
      hud.hide();
    }
    if (shopUI) {
      shopUI.hide();
    }
  });

  // Cleanup when game restarts — re-show HUD
  room.onMessage("gameStarted", () => {
    if (hud) {
      hud.show();
      lastGold = 0;
      playerAliveState.clear();
    }
  });
}
