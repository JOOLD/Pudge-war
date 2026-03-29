/**
 * SkillBar — DOM-based skill bar UI at bottom center of screen.
 * 4 skill slots: Q (Hook), W (Rot), E (Phase), R (Dismember)
 */

interface SkillSlot {
  element: HTMLDivElement;
  cooldownOverlay: HTMLDivElement;
  keyLabel: HTMLDivElement;
  iconLabel: HTMLDivElement;
}

const SKILL_DEFS = [
  { key: "Q", id: "hook", icon: "🪝", label: "鉤" },
  { key: "W", id: "rot", icon: "☠️", label: "腐" },
  { key: "E", id: "phase", icon: "✨", label: "虛" },
  { key: "R", id: "dismember", icon: "🔪", label: "肢" },
];

export class SkillBar {
  private container: HTMLDivElement;
  private skills: Map<string, SkillSlot> = new Map();

  constructor() {
    // Create container
    this.container = document.createElement("div");
    this.container.id = "skill-bar";
    Object.assign(this.container.style, {
      position: "absolute",
      bottom: "12px",
      left: "50%",
      transform: "translateX(-50%)",
      display: "flex",
      gap: "8px",
      zIndex: "50",
      pointerEvents: "none",
    });

    for (const def of SKILL_DEFS) {
      const slot = this.createSlot(def.key, def.icon);
      this.skills.set(def.id, slot);
      this.container.appendChild(slot.element);
    }

    document.getElementById("game-container")!.appendChild(this.container);
  }

  private createSlot(key: string, icon: string): SkillSlot {
    const element = document.createElement("div");
    Object.assign(element.style, {
      width: "48px",
      height: "48px",
      borderRadius: "10px",
      border: "3px solid #e6c235",
      background: "rgba(60, 40, 10, 0.75)",
      position: "relative",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      pointerEvents: "auto",
      cursor: "pointer",
      boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
      transition: "border-color 0.2s, box-shadow 0.2s",
    });

    // Icon
    const iconLabel = document.createElement("div");
    Object.assign(iconLabel.style, {
      fontSize: "22px",
      lineHeight: "1",
      userSelect: "none",
    });
    iconLabel.textContent = icon;
    element.appendChild(iconLabel);

    // Key label (top-left corner)
    const keyLabel = document.createElement("div");
    Object.assign(keyLabel.style, {
      position: "absolute",
      top: "1px",
      left: "3px",
      fontSize: "10px",
      fontWeight: "900",
      color: "#ffd93d",
      fontFamily: "Nunito, sans-serif",
      textShadow: "1px 1px 0 #333",
      userSelect: "none",
    });
    keyLabel.textContent = key;
    element.appendChild(keyLabel);

    // Cooldown overlay (sweeping clock-like from top)
    const cooldownOverlay = document.createElement("div");
    Object.assign(cooldownOverlay.style, {
      position: "absolute",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      background: "rgba(0, 0, 0, 0.6)",
      clipPath: "inset(0 0 0 0)", // will be updated
      pointerEvents: "none",
      transition: "clip-path 0.05s linear",
    });
    cooldownOverlay.style.display = "none";
    element.appendChild(cooldownOverlay);

    return { element, cooldownOverlay, keyLabel, iconLabel };
  }

  /**
   * Update cooldown display.
   * @param skill - skill id: "hook" | "rot" | "phase" | "dismember"
   * @param progress - 0 = ready, 1 = full cooldown
   */
  updateCooldown(skill: string, progress: number): void {
    const slot = this.skills.get(skill);
    if (!slot) return;

    if (progress <= 0) {
      slot.cooldownOverlay.style.display = "none";
      slot.element.style.opacity = "1";
    } else {
      slot.cooldownOverlay.style.display = "block";
      // Sweep from top down: inset(0 0 X% 0) where X is (1-progress)*100
      const visiblePct = Math.max(0, Math.min(100, (1 - progress) * 100));
      slot.cooldownOverlay.style.clipPath = `inset(${visiblePct}% 0 0 0)`;
      slot.element.style.opacity = "0.85";
    }
  }

  /**
   * Highlight active state (for Rot toggle).
   */
  setActive(skill: string, active: boolean): void {
    const slot = this.skills.get(skill);
    if (!slot) return;

    if (active) {
      slot.element.style.borderColor = "#4eff4e";
      slot.element.style.boxShadow = "0 0 12px rgba(78, 255, 78, 0.6), 0 2px 8px rgba(0,0,0,0.3)";
      slot.element.style.background = "rgba(30, 80, 20, 0.85)";
    } else {
      slot.element.style.borderColor = "#e6c235";
      slot.element.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";
      slot.element.style.background = "rgba(60, 40, 10, 0.75)";
    }
  }

  show(): void {
    this.container.style.display = "flex";
  }

  hide(): void {
    this.container.style.display = "none";
  }

  /**
   * Register click handlers for mobile touch support.
   * @param onSkill callback receiving skill id
   */
  onSkillClick(onSkill: (skillId: string) => void): void {
    for (const [id, slot] of this.skills.entries()) {
      slot.element.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        onSkill(id);
      });
    }
  }

  destroy(): void {
    this.container.remove();
  }
}
