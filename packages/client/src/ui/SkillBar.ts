/**
 * SkillBar — DOM-based skill bar UI at bottom center of screen.
 * 4 skill slots: Q (Hook), W (Rot), E (Phase), R (Dismember)
 * Glass design with golden accents.
 */

interface SkillSlot {
  element: HTMLDivElement;
  cooldownOverlay: HTMLDivElement;
  cooldownTimer: HTMLDivElement;
  keyLabel: HTMLDivElement;
  iconLabel: HTMLDivElement;
}

const SKILL_DEFS = [
  { key: "1", id: "hook", icon: "\u{1FA9D}", label: "\u9264" },
  { key: "2", id: "rot", icon: "\u2620\uFE0F", label: "\u8150" },
  { key: "3", id: "phase", icon: "\u2728", label: "\u865B" },
  { key: "4", id: "dismember", icon: "\u{1F52A}", label: "\u80A2" },
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
      bottom: "14px",
      left: "50%",
      transform: "translateX(-50%)",
      display: "flex",
      gap: "6px",
      zIndex: "50",
      pointerEvents: "auto",
    });

    // Glass background behind skill slots
    Object.assign(this.container.style, {
      background: "rgba(0, 0, 0, 0.35)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      borderRadius: "16px",
      padding: "7px 12px",
      border: "1px solid rgba(255, 217, 61, 0.15)",
      boxShadow: "0 4px 20px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.05)",
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
      width: "52px",
      height: "52px",
      borderRadius: "12px",
      border: "1.5px solid rgba(255, 217, 61, 0.35)",
      background: "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)",
      position: "relative",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      pointerEvents: "auto",
      cursor: "pointer",
      boxShadow: "0 2px 8px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.08)",
      transition: "border-color 0.2s, box-shadow 0.2s, background 0.2s, transform 0.15s",
    });

    // Hover effect via event listeners
    element.addEventListener("mouseenter", () => {
      if (element.style.borderColor !== "#4eff4e") {
        element.style.transform = "translateY(-1px)";
        element.style.boxShadow = "0 4px 14px rgba(255,217,61,0.2), inset 0 1px 0 rgba(255,255,255,0.1)";
      }
    });
    element.addEventListener("mouseleave", () => {
      if (element.style.borderColor !== "#4eff4e") {
        element.style.transform = "translateY(0)";
        element.style.boxShadow = "0 2px 8px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.08)";
      }
    });

    // Icon
    const iconLabel = document.createElement("div");
    Object.assign(iconLabel.style, {
      fontSize: "22px",
      lineHeight: "1",
      userSelect: "none",
      filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))",
    });
    iconLabel.textContent = icon;
    element.appendChild(iconLabel);

    // Key label (top-left corner)
    const keyLabel = document.createElement("div");
    Object.assign(keyLabel.style, {
      position: "absolute",
      top: "2px",
      left: "4px",
      fontSize: "10px",
      fontWeight: "900",
      color: "#ffd93d",
      fontFamily: "Nunito, sans-serif",
      textShadow: "0 1px 3px rgba(0,0,0,0.6)",
      userSelect: "none",
      letterSpacing: "0.5px",
    });
    keyLabel.textContent = key;
    element.appendChild(keyLabel);

    // Cooldown overlay (sweeping wipe from top)
    const cooldownOverlay = document.createElement("div");
    Object.assign(cooldownOverlay.style, {
      position: "absolute",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      background: "rgba(0, 0, 0, 0.6)",
      clipPath: "inset(0 0 0 0)",
      pointerEvents: "none",
      transition: "clip-path 0.05s linear",
      borderRadius: "12px",
    });
    cooldownOverlay.style.display = "none";
    element.appendChild(cooldownOverlay);

    // Cooldown timer text (centered)
    const cooldownTimer = document.createElement("div");
    Object.assign(cooldownTimer.style, {
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      fontSize: "14px",
      fontWeight: "900",
      color: "rgba(255,255,255,0.8)",
      fontFamily: "Nunito, sans-serif",
      textShadow: "0 1px 4px rgba(0,0,0,0.8)",
      pointerEvents: "none",
      userSelect: "none",
      display: "none",
    });
    element.appendChild(cooldownTimer);

    return { element, cooldownOverlay, cooldownTimer, keyLabel, iconLabel };
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
      slot.cooldownTimer.style.display = "none";
      slot.element.style.opacity = "1";
    } else {
      slot.cooldownOverlay.style.display = "block";
      // Sweep from top down
      const visiblePct = Math.max(0, Math.min(100, (1 - progress) * 100));
      slot.cooldownOverlay.style.clipPath = `inset(${visiblePct}% 0 0 0)`;
      slot.element.style.opacity = "0.8";
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
      slot.element.style.boxShadow = "0 0 16px rgba(78, 255, 78, 0.45), 0 2px 8px rgba(0,0,0,0.2), inset 0 0 10px rgba(78, 255, 78, 0.1)";
      slot.element.style.background = "linear-gradient(180deg, rgba(30,100,20,0.4) 0%, rgba(20,60,15,0.3) 100%)";
    } else {
      slot.element.style.borderColor = "rgba(255, 217, 61, 0.35)";
      slot.element.style.boxShadow = "0 2px 8px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.08)";
      slot.element.style.background = "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)";
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
