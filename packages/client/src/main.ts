import Phaser from "phaser";
import { GameScene } from "./scenes/GameScene";
import { createRoom, joinRoom, getRoom, sendStart, sendRestart } from "./network/client";
import { MAP_WIDTH, MAP_HEIGHT, TEAM_LEFT } from "shared";

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
