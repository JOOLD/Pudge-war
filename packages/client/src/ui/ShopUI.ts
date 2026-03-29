import type { Room } from "colyseus.js";

// Upgrade definitions: id, category, name, description, maxLevel, baseCost
interface UpgradeDef {
  id: string;
  category: string;
  categoryIcon: string;
  name: string;
  desc: string;
  maxLevel: number;
  baseCost: number;
}

const UPGRADES: UpgradeDef[] = [
  // Hook
  { id: "hook_range", category: "Hook", categoryIcon: "🪝", name: "射程 +50", desc: "增加鉤子飛行距離", maxLevel: 3, baseCost: 100 },
  { id: "hook_speed", category: "Hook", categoryIcon: "🪝", name: "飛行速度 +80", desc: "鉤子飛得更快", maxLevel: 3, baseCost: 120 },
  { id: "hook_cd", category: "Hook", categoryIcon: "🪝", name: "冷卻 -0.5s", desc: "縮短鉤子冷卻時間", maxLevel: 3, baseCost: 150 },
  // Player
  { id: "move_speed", category: "Player", categoryIcon: "🏃", name: "移速 +20", desc: "移動更快", maxLevel: 3, baseCost: 100 },
  { id: "max_hp", category: "Player", categoryIcon: "🏃", name: "生命 +30", desc: "增加最大血量", maxLevel: 3, baseCost: 120 },
  // Defense
  { id: "armor", category: "Defense", categoryIcon: "🛡️", name: "護甲 +10%", desc: "減少受到的傷害", maxLevel: 3, baseCost: 130 },
  // Utility
  { id: "gold_bonus", category: "Utility", categoryIcon: "✨", name: "金幣 +20%", desc: "擊殺獲得更多金幣", maxLevel: 2, baseCost: 200 },
];

export class ShopUI {
  private overlay: HTMLDivElement;
  private visible: boolean = false;
  private room: Room;
  private playerId: string;
  private goldAmountEl: HTMLSpanElement | null = null;
  private itemEls: Map<string, { levelEl: HTMLSpanElement; btnEl: HTMLButtonElement }> = new Map();

  constructor(room: Room, playerId: string) {
    this.room = room;
    this.playerId = playerId;
    this.overlay = document.getElementById("shop-overlay") as HTMLDivElement;
    this.buildUI();
  }

  private buildUI(): void {
    // Build the shop grid content
    const grid = this.overlay.querySelector(".shop-grid") as HTMLDivElement;
    if (!grid) return;

    this.goldAmountEl = document.getElementById("shop-gold-amount") as HTMLSpanElement;

    // Group upgrades by category
    const categories = new Map<string, UpgradeDef[]>();
    for (const u of UPGRADES) {
      const key = u.category;
      if (!categories.has(key)) categories.set(key, []);
      categories.get(key)!.push(u);
    }

    grid.innerHTML = "";
    categories.forEach((items, catName) => {
      const catDiv = document.createElement("div");
      catDiv.className = "shop-category";

      const icon = items[0].categoryIcon;
      catDiv.innerHTML = `<h3>${icon} ${catName}</h3>`;

      for (const item of items) {
        const itemDiv = document.createElement("div");
        itemDiv.className = "shop-item";
        itemDiv.dataset.id = item.id;

        const nameSpan = document.createElement("span");
        nameSpan.className = "item-name";
        nameSpan.textContent = item.name;
        nameSpan.title = item.desc;

        const levelSpan = document.createElement("span");
        levelSpan.className = "item-level";
        levelSpan.textContent = `Lv.0/${item.maxLevel}`;

        const buyBtn = document.createElement("button");
        buyBtn.className = "buy-btn";
        buyBtn.textContent = `💰 ${item.baseCost}`;
        buyBtn.addEventListener("click", () => {
          this.room.send("buy", { upgradeId: item.id });
        });

        itemDiv.appendChild(nameSpan);
        itemDiv.appendChild(levelSpan);
        itemDiv.appendChild(buyBtn);
        catDiv.appendChild(itemDiv);

        this.itemEls.set(item.id, { levelEl: levelSpan, btnEl: buyBtn });
      }

      grid.appendChild(catDiv);
    });

    // Close button
    const closeBtn = this.overlay.querySelector(".shop-close") as HTMLButtonElement;
    if (closeBtn) {
      closeBtn.addEventListener("click", () => this.hide());
    }

    // Click backdrop to close
    this.overlay.addEventListener("click", (e) => {
      if (e.target === this.overlay) this.hide();
    });
  }

  toggle(): void {
    if (this.visible) this.hide();
    else this.show();
  }

  show(): void {
    this.visible = true;
    this.overlay.classList.add("visible");
    this.overlay.classList.remove("hidden");
  }

  hide(): void {
    this.visible = false;
    this.overlay.classList.remove("visible");
    this.overlay.classList.add("hidden");
  }

  isVisible(): boolean {
    return this.visible;
  }

  update(gold: number, upgrades: Record<string, number>): void {
    if (this.goldAmountEl) {
      this.goldAmountEl.textContent = String(gold);
    }

    for (const item of UPGRADES) {
      const els = this.itemEls.get(item.id);
      if (!els) continue;

      const level = upgrades[item.id] || 0;
      els.levelEl.textContent = `Lv.${level}/${item.maxLevel}`;

      // Cost increases per level
      const cost = item.baseCost + level * 50;
      const maxed = level >= item.maxLevel;
      const canAfford = gold >= cost;

      if (maxed) {
        els.btnEl.textContent = "已滿";
        els.btnEl.disabled = true;
        els.btnEl.classList.add("maxed");
      } else {
        els.btnEl.textContent = `💰 ${cost}`;
        els.btnEl.disabled = !canAfford;
        els.btnEl.classList.remove("maxed");
        if (!canAfford) {
          els.btnEl.classList.add("cant-afford");
        } else {
          els.btnEl.classList.remove("cant-afford");
        }
      }
    }
  }

  destroy(): void {
    this.hide();
  }
}
