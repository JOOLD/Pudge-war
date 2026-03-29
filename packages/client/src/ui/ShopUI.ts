import { ABILITY_SHOP, HOOK_MODIFIERS } from "shared";
import type { AbilityDef, HookModDef } from "shared";

type TabId = 'consumables' | 'hook' | 'survival' | 'skills';

interface ShopTab {
  id: TabId;
  label: string;
  icon: string;
}

const TABS: ShopTab[] = [
  { id: 'consumables', label: '消耗品', icon: '📦' },
  { id: 'hook', label: 'Hook', icon: '🪝' },
  { id: 'survival', label: '生存', icon: '🛡️' },
  { id: 'skills', label: '技能', icon: '📜' },
];

// Hook upgrade items (stat upgrades for hook)
const HOOK_UPGRADES = [
  { id: 'hook_range', name: '鉤子射程', description: '增加鉤子最大距離 +50', cost: 200, icon: '📏' },
  { id: 'hook_speed', name: '鉤子速度', description: '增加鉤子飛行速度 +100', cost: 250, icon: '⚡' },
  { id: 'hook_cd', name: '冷卻縮減', description: '減少鉤子冷卻時間 -0.5s', cost: 300, icon: '⏱️' },
];

// Survival upgrade items
const SURVIVAL_UPGRADES = [
  { id: 'max_hp', name: '生命上限', description: '增加最大生命值 +25', cost: 200, icon: '❤️' },
  { id: 'regen', name: '生命恢復', description: '每秒恢復 2 HP', cost: 250, icon: '💚' },
  { id: 'move_speed', name: '移動速度', description: '增加移動速度 +20', cost: 200, icon: '🏃' },
];

// Consumable items
const CONSUMABLES = [
  { id: 'salve', name: '治療藥膏', description: '立即恢復 50 HP', cost: 100, icon: '🩹' },
  { id: 'potion', name: '魔力藥水', description: '立即重置鉤子冷卻', cost: 150, icon: '🧪' },
  { id: 'tome_str', name: '力量秘典', description: '永久增加鉤子傷害 +10', cost: 300, icon: '📕' },
  { id: 'tome_agi', name: '敏捷秘典', description: '永久增加移動速度 +10', cost: 300, icon: '📗' },
  { id: 'tome_int', name: '智力秘典', description: '永久減少冷卻 -0.3s', cost: 300, icon: '📘' },
];

export class ShopUI {
  private container: HTMLDivElement;
  private tabContainer: HTMLDivElement;
  private contentContainer: HTMLDivElement;
  private activeTab: TabId = 'consumables';
  private visible: boolean = false;
  private onBuy: (upgradeId: string) => void;

  // Player state references (updated externally)
  private playerGold: number = 0;
  private playerHasRot: boolean = false;
  private playerHasPhase: boolean = false;
  private playerHookModifier: string = 'none';

  constructor(onBuy: (upgradeId: string) => void) {
    this.onBuy = onBuy;

    // Create main container
    this.container = document.createElement('div');
    this.container.id = 'shop-ui';
    this.container.style.cssText = `
      position: absolute;
      bottom: 60px;
      left: 50%;
      transform: translateX(-50%);
      width: 520px;
      max-height: 380px;
      background: rgba(20, 30, 20, 0.95);
      border: 2px solid #ffd93d;
      border-radius: 12px;
      z-index: 50;
      display: none;
      flex-direction: column;
      font-family: 'Nunito', sans-serif;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      overflow: hidden;
    `;

    // Header with gold display
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 16px;
      background: rgba(0,0,0,0.3);
      border-bottom: 1px solid rgba(255,217,61,0.3);
    `;
    const title = document.createElement('span');
    title.textContent = '🏪 商店';
    title.style.cssText = 'color: #ffd93d; font-size: 16px; font-weight: bold;';
    this.goldDisplay = document.createElement('span');
    this.goldDisplay.style.cssText = 'color: #ffd93d; font-size: 14px; font-weight: bold;';
    this.goldDisplay.textContent = '💰 0';
    header.appendChild(title);
    header.appendChild(this.goldDisplay);
    this.container.appendChild(header);

    // Tab bar
    this.tabContainer = document.createElement('div');
    this.tabContainer.style.cssText = `
      display: flex;
      gap: 0;
      border-bottom: 1px solid rgba(255,217,61,0.2);
    `;
    this.container.appendChild(this.tabContainer);

    // Content area
    this.contentContainer = document.createElement('div');
    this.contentContainer.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 8px;
      max-height: 280px;
    `;
    this.container.appendChild(this.contentContainer);

    // Create tabs
    this.createTabs();

    document.getElementById('game-container')!.appendChild(this.container);

    // Render initial tab
    this.renderTab(this.activeTab);
  }

  private goldDisplay: HTMLSpanElement = document.createElement('span');

  private createTabs() {
    this.tabContainer.innerHTML = '';
    for (const tab of TABS) {
      const btn = document.createElement('button');
      btn.textContent = `${tab.icon} ${tab.label}`;
      btn.dataset.tabId = tab.id;
      btn.style.cssText = `
        flex: 1;
        padding: 8px 4px;
        border: none;
        background: ${tab.id === this.activeTab ? 'rgba(255,217,61,0.2)' : 'transparent'};
        color: ${tab.id === this.activeTab ? '#ffd93d' : '#999'};
        font-family: 'Nunito', sans-serif;
        font-size: 12px;
        font-weight: bold;
        cursor: pointer;
        border-bottom: 2px solid ${tab.id === this.activeTab ? '#ffd93d' : 'transparent'};
        transition: all 0.15s;
      `;
      btn.addEventListener('mouseenter', () => {
        if (tab.id !== this.activeTab) {
          btn.style.background = 'rgba(255,217,61,0.1)';
          btn.style.color = '#ccc';
        }
      });
      btn.addEventListener('mouseleave', () => {
        if (tab.id !== this.activeTab) {
          btn.style.background = 'transparent';
          btn.style.color = '#999';
        }
      });
      btn.addEventListener('click', () => {
        this.activeTab = tab.id;
        this.createTabs();
        this.renderTab(tab.id);
      });
      this.tabContainer.appendChild(btn);
    }
  }

  private renderTab(tabId: TabId) {
    this.contentContainer.innerHTML = '';
    switch (tabId) {
      case 'consumables':
        this.renderItemList(CONSUMABLES);
        break;
      case 'hook':
        this.renderHookTab();
        break;
      case 'survival':
        this.renderItemList(SURVIVAL_UPGRADES);
        break;
      case 'skills':
        this.renderSkillsTab();
        break;
    }
  }

  private renderItemList(items: Array<{ id: string; name: string; description: string; cost: number; icon: string }>) {
    for (const item of items) {
      const canAfford = this.playerGold >= item.cost;
      const row = this.createItemRow(item.icon, item.name, item.description, item.cost, canAfford, () => {
        this.onBuy(item.id);
      });
      this.contentContainer.appendChild(row);
    }
  }

  private renderHookTab() {
    // Hook stat upgrades section
    const upgradeHeader = document.createElement('div');
    upgradeHeader.textContent = '📊 數值強化';
    upgradeHeader.style.cssText = 'color: #aaa; font-size: 12px; padding: 4px 8px; margin-bottom: 4px;';
    this.contentContainer.appendChild(upgradeHeader);

    for (const item of HOOK_UPGRADES) {
      const canAfford = this.playerGold >= item.cost;
      const row = this.createItemRow(item.icon, item.name, item.description, item.cost, canAfford, () => {
        this.onBuy(item.id);
      });
      this.contentContainer.appendChild(row);
    }

    // Hook modifier section
    const modHeader = document.createElement('div');
    modHeader.textContent = '🔮 鉤子附魔';
    modHeader.style.cssText = 'color: #aaa; font-size: 12px; padding: 4px 8px; margin-top: 8px; margin-bottom: 4px;';
    this.contentContainer.appendChild(modHeader);

    for (const mod of HOOK_MODIFIERS) {
      const isEquipped = this.playerHookModifier === mod.id;
      const canAfford = this.playerGold >= mod.cost;
      const card = this.createModCard(mod, isEquipped, canAfford);
      this.contentContainer.appendChild(card);
    }
  }

  private renderSkillsTab() {
    for (const ability of ABILITY_SHOP) {
      const isOwned = (ability.id === 'rot' && this.playerHasRot) ||
                      (ability.id === 'phase' && this.playerHasPhase);
      const canAfford = this.playerGold >= ability.cost;
      const row = this.createSkillRow(ability, isOwned, canAfford);
      this.contentContainer.appendChild(row);
    }
  }

  private createItemRow(
    icon: string, name: string, desc: string, cost: number,
    canAfford: boolean, onClick: () => void
  ): HTMLDivElement {
    const row = document.createElement('div');
    row.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 8px;
      background: rgba(255,255,255,0.05);
      border-radius: 8px;
      margin-bottom: 4px;
      transition: background 0.15s;
    `;
    row.addEventListener('mouseenter', () => { row.style.background = 'rgba(255,255,255,0.1)'; });
    row.addEventListener('mouseleave', () => { row.style.background = 'rgba(255,255,255,0.05)'; });

    const iconEl = document.createElement('span');
    iconEl.textContent = icon;
    iconEl.style.cssText = 'font-size: 20px; width: 28px; text-align: center;';

    const info = document.createElement('div');
    info.style.cssText = 'flex: 1;';
    const nameEl = document.createElement('div');
    nameEl.textContent = name;
    nameEl.style.cssText = 'color: #fff; font-size: 13px; font-weight: bold;';
    const descEl = document.createElement('div');
    descEl.textContent = desc;
    descEl.style.cssText = 'color: #888; font-size: 11px;';
    info.appendChild(nameEl);
    info.appendChild(descEl);

    const buyBtn = document.createElement('button');
    buyBtn.textContent = `💰 ${cost}`;
    buyBtn.style.cssText = `
      padding: 4px 12px;
      border: 1px solid ${canAfford ? '#ffd93d' : '#666'};
      border-radius: 6px;
      background: ${canAfford ? 'rgba(255,217,61,0.2)' : 'rgba(100,100,100,0.2)'};
      color: ${canAfford ? '#ffd93d' : '#ff4444'};
      font-family: 'Nunito', sans-serif;
      font-size: 12px;
      font-weight: bold;
      cursor: ${canAfford ? 'pointer' : 'not-allowed'};
      transition: all 0.15s;
    `;
    if (canAfford) {
      buyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        onClick();
      });
      buyBtn.addEventListener('mouseenter', () => {
        buyBtn.style.background = 'rgba(255,217,61,0.4)';
      });
      buyBtn.addEventListener('mouseleave', () => {
        buyBtn.style.background = 'rgba(255,217,61,0.2)';
      });
    }

    row.appendChild(iconEl);
    row.appendChild(info);
    row.appendChild(buyBtn);
    return row;
  }

  private createModCard(mod: HookModDef, isEquipped: boolean, canAfford: boolean): HTMLDivElement {
    const card = document.createElement('div');
    card.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px;
      background: rgba(255,255,255,0.05);
      border: 2px solid ${isEquipped ? '#ffd93d' : 'transparent'};
      border-radius: 8px;
      margin-bottom: 4px;
      transition: all 0.15s;
    `;
    card.addEventListener('mouseenter', () => {
      if (!isEquipped) card.style.background = 'rgba(255,255,255,0.1)';
    });
    card.addEventListener('mouseleave', () => {
      if (!isEquipped) card.style.background = 'rgba(255,255,255,0.05)';
    });

    const iconEl = document.createElement('span');
    iconEl.textContent = mod.icon;
    iconEl.style.cssText = 'font-size: 24px; width: 32px; text-align: center;';

    const info = document.createElement('div');
    info.style.cssText = 'flex: 1;';
    const nameEl = document.createElement('div');
    nameEl.textContent = mod.name;
    nameEl.style.cssText = `color: ${isEquipped ? '#ffd93d' : '#fff'}; font-size: 13px; font-weight: bold;`;
    const descEl = document.createElement('div');
    descEl.textContent = mod.description;
    descEl.style.cssText = 'color: #888; font-size: 11px;';
    info.appendChild(nameEl);
    info.appendChild(descEl);

    if (isEquipped) {
      const badge = document.createElement('span');
      badge.textContent = '已裝備';
      badge.style.cssText = `
        padding: 3px 10px;
        border-radius: 6px;
        background: rgba(255,217,61,0.3);
        color: #ffd93d;
        font-size: 11px;
        font-weight: bold;
      `;
      card.appendChild(iconEl);
      card.appendChild(info);
      card.appendChild(badge);
    } else {
      const buyBtn = document.createElement('button');
      buyBtn.textContent = `💰 ${mod.cost}`;
      buyBtn.style.cssText = `
        padding: 4px 12px;
        border: 1px solid ${canAfford ? '#ffd93d' : '#666'};
        border-radius: 6px;
        background: ${canAfford ? 'rgba(255,217,61,0.2)' : 'rgba(100,100,100,0.2)'};
        color: ${canAfford ? '#ffd93d' : '#ff4444'};
        font-family: 'Nunito', sans-serif;
        font-size: 12px;
        font-weight: bold;
        cursor: ${canAfford ? 'pointer' : 'not-allowed'};
      `;
      if (canAfford) {
        buyBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.onBuy(mod.id);
        });
      }
      card.appendChild(iconEl);
      card.appendChild(info);
      card.appendChild(buyBtn);
    }

    return card;
  }

  private createSkillRow(ability: AbilityDef, isOwned: boolean, canAfford: boolean): HTMLDivElement {
    const row = document.createElement('div');
    row.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 8px;
      background: rgba(255,255,255,0.05);
      border: 2px solid ${isOwned ? '#4CAF50' : 'transparent'};
      border-radius: 8px;
      margin-bottom: 6px;
    `;

    const iconEl = document.createElement('span');
    iconEl.textContent = ability.icon;
    iconEl.style.cssText = 'font-size: 28px; width: 36px; text-align: center;';

    const info = document.createElement('div');
    info.style.cssText = 'flex: 1;';
    const nameEl = document.createElement('div');
    nameEl.style.cssText = 'color: #fff; font-size: 14px; font-weight: bold;';
    nameEl.textContent = `[${ability.key}] ${ability.name}`;
    const descEl = document.createElement('div');
    descEl.textContent = ability.description;
    descEl.style.cssText = 'color: #888; font-size: 12px; margin-top: 2px;';
    info.appendChild(nameEl);
    info.appendChild(descEl);

    row.appendChild(iconEl);
    row.appendChild(info);

    if (isOwned) {
      const badge = document.createElement('span');
      badge.textContent = '已擁有';
      badge.style.cssText = `
        padding: 4px 12px;
        border-radius: 6px;
        background: rgba(76,175,80,0.3);
        color: #4CAF50;
        font-size: 12px;
        font-weight: bold;
      `;
      row.appendChild(badge);
    } else {
      const buyBtn = document.createElement('button');
      buyBtn.textContent = `💰 ${ability.cost}`;
      buyBtn.style.cssText = `
        padding: 4px 14px;
        border: 1px solid ${canAfford ? '#ffd93d' : '#666'};
        border-radius: 6px;
        background: ${canAfford ? 'rgba(255,217,61,0.2)' : 'rgba(100,100,100,0.2)'};
        color: ${canAfford ? '#ffd93d' : '#ff4444'};
        font-family: 'Nunito', sans-serif;
        font-size: 13px;
        font-weight: bold;
        cursor: ${canAfford ? 'pointer' : 'not-allowed'};
      `;
      if (canAfford) {
        buyBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.onBuy(ability.id);
        });
      }
      row.appendChild(buyBtn);
    }

    return row;
  }

  // Update player state and re-render
  updatePlayerState(gold: number, hasRot: boolean, hasPhase: boolean, hookModifier: string) {
    this.playerGold = gold;
    this.playerHasRot = hasRot;
    this.playerHasPhase = hasPhase;
    this.playerHookModifier = hookModifier;
    this.goldDisplay.textContent = `💰 ${gold}`;
    if (this.visible) {
      this.renderTab(this.activeTab);
    }
  }

  toggle() {
    this.visible = !this.visible;
    this.container.style.display = this.visible ? 'flex' : 'none';
    if (this.visible) {
      this.renderTab(this.activeTab);
    }
  }

  show() {
    this.visible = true;
    this.container.style.display = 'flex';
    this.renderTab(this.activeTab);
  }

  hide() {
    this.visible = false;
    this.container.style.display = 'none';
  }

  isVisible(): boolean {
    return this.visible;
  }

  destroy() {
    this.container.remove();
  }
}
