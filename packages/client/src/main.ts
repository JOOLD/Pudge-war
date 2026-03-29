import Phaser from "phaser";
import { GameScene } from "./scenes/GameScene";
import {
  createRoom, joinRoom, getRoom, sendStart, sendRestart,
  attemptReconnect, clearReconnectionToken,
} from "./network/client";
import { MAP_WIDTH, MAP_HEIGHT, TEAM_LEFT, SPAWN_X_LEFT, SPAWN_X_RIGHT } from "shared";
import { HUD } from "./ui/HUD";
import { ShopUI } from "./ui/ShopUI";

// === URL params & module-level state ===
const urlParams = new URLSearchParams(window.location.search);
const urlRoomCode = urlParams.get("room")?.toUpperCase() || "";
const urlRef = urlParams.get("ref") || "";
let currentRoomCode = "";

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
    mouse: {
      preventDefaultRight: true,
    },
    touch: true,
  },
  autoStart: false, // Don't start until connected
};

const game = new Phaser.Game(config);

// === DOM UI Logic ===
const lobby = document.getElementById("lobby")!;
const waiting = document.getElementById("waiting")!;
const gameOverOverlay = document.getElementById("game-over")!;
const shareBar = document.getElementById("share-bar")!;
const btnShare = document.getElementById("btn-share")!;
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

// === Restore saved nickname from localStorage ===
const NICKNAME_KEY = "pudge_nickname";
const savedNickname = localStorage.getItem(NICKNAME_KEY);
if (savedNickname) {
  nicknameInput.value = savedNickname;
}

// === Auto-fill room code from URL ===
if (urlRoomCode) {
  roomCodeInput.value = urlRoomCode;
}

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
  // Save nickname for next visit
  localStorage.setItem(NICKNAME_KEY, name);
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
    const room = await joinRoom(code, nickname, urlRef || undefined);
    enterWaitingRoom(room);
  } catch (e: any) {
    // Friendly error for URL auto-join failures
    if (urlRoomCode && code === urlRoomCode) {
      showError("房間不存在或已結束");
    } else {
      showError("加入失敗：房間不存在或已滿");
    }
    btnJoin.textContent = "加入房間";
  }
}

function enterWaitingRoom(room: any) {
  lobby.classList.add("hidden");
  waiting.classList.add("visible");
  gameOverOverlay.classList.remove("visible");
  shareBar.classList.remove("visible");

  currentRoomCode = room.id;
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
    shareBar.classList.add("visible");
    game.scene.start("GameScene");
    // Initialize HUD and Shop UI
    initGameUI(room);
  });

  // Listen for kill messages — pulse share button when current player gets a kill
  room.onMessage("kill", (data: any) => {
    // Check if this player is the killer (match by nickname since we have sessionId)
    const myPlayer = room.state.players.get(room.sessionId);
    if (myPlayer && data.killerName === myPlayer.nickname) {
      btnShare.classList.add("share-highlight");
      setTimeout(() => { btnShare.classList.remove("share-highlight"); }, 3000);
    }
  });

  // Listen for game over — centralized DOM handling
  room.onMessage("gameOver", (data: any) => {
    const winnerText = document.getElementById("winner-text")!;
    const finalScore = document.getElementById("final-score")!;

    gameOverOverlay.classList.add("visible");
    shareBar.classList.remove("visible");
    winnerText.textContent = data.winningTeam === TEAM_LEFT
      ? "🌿 左隊獲勝！" : "🌸 右隊獲勝！";
    finalScore.textContent = `${data.leftScore} : ${data.rightScore}`;
  });

  // Handle unexpected disconnection — attempt reconnect
  room.onLeave((code: number) => {
    // code 1000 = normal close (consented), anything else = unexpected
    if (code !== 1000) {
      console.warn(`Unexpected disconnect (code ${code}), attempting reconnect...`);
      handleReconnect();
    }
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

/** Handle reconnection after unexpected disconnect */
async function handleReconnect() {
  const newRoom = await attemptReconnect();
  if (newRoom) {
    // Reconnect succeeded — re-enter waiting room / re-attach listeners
    // Restart GameScene so it picks up the new room reference
    if (game.scene.isActive("GameScene")) {
      game.scene.stop("GameScene");
    }
    enterWaitingRoom(newRoom);
    // If the game is already in playing state, start scene immediately
    if (newRoom.state.phase === "playing") {
      waiting.classList.remove("visible");
      shareBar.classList.add("visible");
      game.scene.start("GameScene");
    }
  } else {
    // Reconnect failed — return to lobby
    clearReconnectionToken();
    shareBar.classList.remove("visible");
    gameOverOverlay.classList.remove("visible");
    waiting.classList.remove("visible");
    lobby.classList.remove("hidden");
    showError("連線中斷，請重新加入");
  }
}

// === Share button handler ===
btnShare.addEventListener("click", async () => {
  const room = getRoom();
  if (!room) return;

  const shareUrl = `${window.location.origin}/?room=${currentRoomCode}&ref=${room.sessionId}`;

  try {
    // Try native share API first (mobile)
    if (navigator.canShare && navigator.canShare({ url: shareUrl, text: "來鉤人！" })) {
      await navigator.share({
        title: "勾肥大戰",
        text: "來鉤人！",
        url: shareUrl,
      });
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(shareUrl);
      const originalText = btnShare.textContent;
      btnShare.textContent = "✅ 已複製！";
      setTimeout(() => { btnShare.textContent = originalText; }, 1500);
    }
  } catch {
    // Final fallback
    try {
      await navigator.clipboard.writeText(shareUrl);
      const originalText = btnShare.textContent;
      btnShare.textContent = "✅ 已複製！";
      setTimeout(() => { btnShare.textContent = originalText; }, 1500);
    } catch {
      // ignore clipboard failures
    }
  }

  // Fire-and-forget analytics event
  try {
    fetch("/api/analytics/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "share_click", roomCode: currentRoomCode }),
    });
  } catch {
    // ignore analytics failures
  }
});

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

// === Tutorial overlay ===
const tutorialOverlay = document.getElementById("tutorial-overlay")!;
const btnTutorialClose = document.getElementById("btn-tutorial-close")!;
const btnHelp = document.getElementById("btn-help")!;

// Show tutorial on first visit
const tutorialShown = localStorage.getItem("pudge-tutorial-shown");
if (!tutorialShown) {
  tutorialOverlay.classList.add("visible");
}

btnTutorialClose.addEventListener("click", () => {
  tutorialOverlay.classList.remove("visible");
  localStorage.setItem("pudge-tutorial-shown", "true");
});

// Help button in waiting room re-shows tutorial
btnHelp.addEventListener("click", () => {
  tutorialOverlay.classList.add("visible");
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
