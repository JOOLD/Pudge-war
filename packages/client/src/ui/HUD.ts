// Kill streak thresholds and display text
const STREAK_TEXT: Record<number, string> = {
  2: "🔥 雙殺！",
  3: "🔥🔥 三連殺！",
  4: "🔥🔥🔥 暴走！",
};
// 5+ uses a special display
const GODLIKE_TEXT = "💀 超神！";

export class HUD {
  private hudRoot: HTMLDivElement;
  private goldDisplay: HTMLDivElement;
  private goldDelta: HTMLDivElement;
  private timerDisplay: HTMLDivElement;
  private killStreakDisplay: HTMLDivElement;
  private deathOverlay: HTMLDivElement;
  private deathText: HTMLDivElement;
  private shopButton: HTMLDivElement;

  // Kill streak tracking: playerId -> consecutive kills without dying
  private killStreaks: Map<string, number> = new Map();
  private streakTimeout: ReturnType<typeof setTimeout> | null = null;
  private deathCountdown: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.hudRoot = document.getElementById("hud") as HTMLDivElement;
    this.goldDisplay = document.getElementById("hud-gold") as HTMLDivElement;
    this.goldDelta = document.getElementById("hud-gold-delta") as HTMLDivElement;
    this.timerDisplay = document.getElementById("hud-timer") as HTMLDivElement;
    this.killStreakDisplay = document.getElementById("hud-kill-streak") as HTMLDivElement;
    this.deathOverlay = document.getElementById("death-overlay") as HTMLDivElement;
    this.deathText = document.getElementById("death-text") as HTMLDivElement;
    this.shopButton = document.getElementById("hud-shop-btn") as HTMLDivElement;
  }

  updateGold(amount: number, delta?: number): void {
    this.goldDisplay.textContent = `💰 ${amount}`;

    if (delta && delta !== 0) {
      const sign = delta > 0 ? "+" : "";
      this.goldDelta.textContent = `${sign}${delta}`;
      this.goldDelta.classList.remove("animate");
      // Force reflow to restart animation
      void this.goldDelta.offsetWidth;
      this.goldDelta.classList.add("animate");
    }
  }

  updateTimer(gameTimeMs: number): void {
    const totalSec = Math.max(0, Math.floor(gameTimeMs / 1000));
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    this.timerDisplay.textContent = `⏱ ${min}:${sec.toString().padStart(2, "0")}`;
  }

  /**
   * Record a kill for a player and show streak if applicable.
   * Returns the new streak count.
   */
  recordKill(playerId: string): number {
    const current = this.killStreaks.get(playerId) || 0;
    const newStreak = current + 1;
    this.killStreaks.set(playerId, newStreak);
    return newStreak;
  }

  /** Reset streak on death */
  recordDeath(playerId: string): void {
    this.killStreaks.set(playerId, 0);
  }

  showKillStreak(streak: number): void {
    if (streak < 2) return;

    let text: string;
    if (streak >= 5) {
      text = GODLIKE_TEXT;
    } else {
      text = STREAK_TEXT[streak] || "";
    }
    if (!text) return;

    this.killStreakDisplay.textContent = text;
    this.killStreakDisplay.classList.remove("animate");
    void this.killStreakDisplay.offsetWidth;
    this.killStreakDisplay.classList.add("animate");

    // Clear previous timeout
    if (this.streakTimeout) clearTimeout(this.streakTimeout);
    this.streakTimeout = setTimeout(() => {
      this.killStreakDisplay.classList.remove("animate");
      this.killStreakDisplay.textContent = "";
    }, 2500);
  }

  showDeathScreen(respawnMs: number): void {
    this.deathOverlay.classList.add("visible");

    // Apply grayscale to game canvas
    const container = document.getElementById("game-container");
    if (container) {
      const canvas = container.querySelector("canvas");
      if (canvas) canvas.classList.add("death-grayscale");
    }

    // Countdown
    let remaining = Math.ceil(respawnMs / 1000);
    this.deathText.textContent = `復活中... ${remaining}`;

    if (this.deathCountdown) clearInterval(this.deathCountdown);
    this.deathCountdown = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        this.hideDeathScreen();
      } else {
        this.deathText.textContent = `復活中... ${remaining}`;
      }
    }, 1000);
  }

  hideDeathScreen(): void {
    this.deathOverlay.classList.remove("visible");
    if (this.deathCountdown) {
      clearInterval(this.deathCountdown);
      this.deathCountdown = null;
    }

    // Remove grayscale
    const container = document.getElementById("game-container");
    if (container) {
      const canvas = container.querySelector("canvas");
      if (canvas) canvas.classList.remove("death-grayscale");
    }
  }

  setShopEnabled(enabled: boolean): void {
    if (enabled) {
      this.shopButton.classList.add("enabled");
      this.shopButton.classList.remove("disabled");
    } else {
      this.shopButton.classList.remove("enabled");
      this.shopButton.classList.add("disabled");
    }
  }

  show(): void {
    this.hudRoot.style.display = "block";
  }

  hide(): void {
    this.hudRoot.style.display = "none";
  }

  destroy(): void {
    this.hide();
    this.hideDeathScreen();
    this.killStreaks.clear();
    if (this.streakTimeout) clearTimeout(this.streakTimeout);
    if (this.deathCountdown) clearInterval(this.deathCountdown);
  }
}
