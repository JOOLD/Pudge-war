interface SkillSlot {
  element: HTMLDivElement;
  keyLabel: HTMLDivElement;
  iconLabel: HTMLDivElement;
  cooldownOverlay: HTMLDivElement;
  originalIcon: string;
  locked: boolean;
}

interface SkillDef {
  id: string;
  key: string;
  icon: string;
  name: string;
  defaultLocked: boolean;
}

const SKILL_DEFS: SkillDef[] = [
  { id: 'hook', key: 'Q', icon: '🪝', name: '鉤子', defaultLocked: false },
  { id: 'rot', key: 'W', icon: '☠️', name: '腐爛', defaultLocked: true },
  { id: 'phase', key: 'E', icon: '✨', name: '相位', defaultLocked: true },
  { id: 'dismember', key: 'R', icon: '🔪', name: '肢解', defaultLocked: false },
];

export class SkillBar {
  private container: HTMLDivElement;
  private skills: Map<string, SkillSlot> = new Map();

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'skill-bar';
    this.container.style.cssText = `
      position: absolute;
      bottom: 12px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 6px;
      z-index: 40;
      pointer-events: none;
    `;

    for (const def of SKILL_DEFS) {
      const slot = this.createSlot(def);
      this.skills.set(def.id, slot);
      this.container.appendChild(slot.element);
    }

    document.getElementById('game-container')!.appendChild(this.container);
  }

  private createSlot(def: SkillDef): SkillSlot {
    const element = document.createElement('div');
    element.style.cssText = `
      width: 48px;
      height: 48px;
      background: rgba(20, 30, 20, 0.85);
      border: 2px solid ${def.defaultLocked ? '#555' : '#ffd93d'};
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: relative;
      opacity: ${def.defaultLocked ? '0.4' : '1'};
      transition: opacity 0.3s, border-color 0.3s;
    `;

    const keyLabel = document.createElement('div');
    keyLabel.textContent = def.key;
    keyLabel.style.cssText = `
      position: absolute;
      top: -8px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0,0,0,0.7);
      color: #ffd93d;
      font-family: 'Nunito', sans-serif;
      font-size: 10px;
      font-weight: bold;
      padding: 0 4px;
      border-radius: 3px;
    `;

    const iconLabel = document.createElement('div');
    iconLabel.textContent = def.defaultLocked ? '🔒' : def.icon;
    iconLabel.style.cssText = 'font-size: 20px; line-height: 1;';

    const cooldownOverlay = document.createElement('div');
    cooldownOverlay.style.cssText = `
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: rgba(0,0,0,0.6);
      height: 0%;
      border-radius: 0 0 6px 6px;
      transition: height 0.1s;
      pointer-events: none;
    `;

    element.appendChild(keyLabel);
    element.appendChild(iconLabel);
    element.appendChild(cooldownOverlay);

    return {
      element,
      keyLabel,
      iconLabel,
      cooldownOverlay,
      originalIcon: def.icon,
      locked: def.defaultLocked,
    };
  }

  setSkillLocked(skillId: string, locked: boolean): void {
    const slot = this.skills.get(skillId);
    if (!slot) return;
    slot.locked = locked;
    if (locked) {
      slot.element.style.opacity = '0.4';
      slot.element.style.borderColor = '#555';
      slot.iconLabel.textContent = '🔒';
    } else {
      slot.element.style.opacity = '1';
      slot.element.style.borderColor = '#ffd93d';
      slot.iconLabel.textContent = slot.originalIcon;
    }
  }

  setCooldown(skillId: string, pct: number): void {
    const slot = this.skills.get(skillId);
    if (!slot || slot.locked) return;
    slot.cooldownOverlay.style.height = `${Math.max(0, Math.min(100, pct * 100))}%`;
  }

  destroy() {
    this.container.remove();
  }
}
