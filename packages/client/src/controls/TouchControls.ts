import Phaser from "phaser";

/**
 * Virtual joystick + tap-to-hook controls for mobile devices.
 * Provides the same input interface as keyboard (dx, dy, aimX, aimY, hook).
 */
export class TouchControls {
  public dx: number = 0;
  public dy: number = 0;
  public aimX: number = 0;
  public aimY: number = 0;
  public wantHook: boolean = false;

  private scene: Phaser.Scene;
  private joystickBase: Phaser.GameObjects.Graphics;
  private joystickThumb: Phaser.GameObjects.Graphics;
  private joystickActive: boolean = false;
  private joystickCenter: { x: number; y: number } = { x: 0, y: 0 };
  private joystickPointerId: number = -1;
  private skillButtons: HTMLDivElement[] = [];
  private onSkillCallback: ((skillId: string) => void) | null = null;

  private static readonly JOYSTICK_ZONE = 0.3; // left 30% of screen
  private static readonly JOYSTICK_RADIUS = 50; // max thumb offset
  private static readonly DEADZONE = 10; // pixels
  private static readonly BASE_RADIUS = 60;
  private static readonly THUMB_RADIUS = 25;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Create joystick graphics (hidden initially)
    this.joystickBase = scene.add.graphics();
    this.joystickBase.setScrollFactor(0);
    this.joystickBase.setDepth(200);
    this.joystickBase.setVisible(false);

    this.joystickThumb = scene.add.graphics();
    this.joystickThumb.setScrollFactor(0);
    this.joystickThumb.setDepth(201);
    this.joystickThumb.setVisible(false);
  }

  /** Check if the device supports touch input */
  static isMobile(): boolean {
    return "ontouchstart" in window || navigator.maxTouchPoints > 0;
  }

  /** Register callback for mobile skill button presses */
  public onSkill(callback: (skillId: string) => void): void {
    this.onSkillCallback = callback;
  }

  /** Call in scene.create() to wire up input handlers */
  setup(): void {
    // Enable multi-touch (default is 1 pointer)
    this.scene.input.addPointer(1);

    this.scene.input.on("pointerdown", this.onPointerDown, this);
    this.scene.input.on("pointermove", this.onPointerMove, this);
    this.scene.input.on("pointerup", this.onPointerUp, this);

    // Create mobile skill buttons
    this.createSkillButtons();
  }

  /** Call in scene.update() — currently a no-op but available for future use */
  update(): void {
    // Input is event-driven; nothing needed per-frame
  }

  destroy(): void {
    this.scene.input.off("pointerdown", this.onPointerDown, this);
    this.scene.input.off("pointermove", this.onPointerMove, this);
    this.scene.input.off("pointerup", this.onPointerUp, this);

    this.joystickBase.destroy();
    this.joystickThumb.destroy();

    // Clean up mobile skill buttons
    const mobileSkills = document.getElementById('mobile-skills');
    if (mobileSkills) mobileSkills.remove();
  }

  // --- Private event handlers ---

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    const screenWidth = this.scene.scale.width;
    const boundaryX = screenWidth * TouchControls.JOYSTICK_ZONE;

    // Use screen-space position (pointer.x is camera-relative in Phaser)
    if (pointer.x < boundaryX) {
      // Left zone — joystick
      if (!this.joystickActive) {
        this.joystickActive = true;
        this.joystickPointerId = pointer.id;
        this.joystickCenter = { x: pointer.x, y: pointer.y };
        this.drawJoystickBase(pointer.x, pointer.y);
        this.drawJoystickThumb(pointer.x, pointer.y);
        this.joystickBase.setVisible(true);
        this.joystickThumb.setVisible(true);
      }
    } else {
      // Right zone — update aim direction only (hook fires via skill button)
      const cam = this.scene.cameras.main;
      const worldPoint = cam.getWorldPoint(pointer.x, pointer.y);
      this.aimX = worldPoint.x;
      this.aimY = worldPoint.y;
    }
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    // Update aim if this is a right-side (non-joystick) pointer
    if (pointer.id !== this.joystickPointerId) {
      const cam = this.scene.cameras.main;
      const worldPoint = cam.getWorldPoint(pointer.x, pointer.y);
      this.aimX = worldPoint.x;
      this.aimY = worldPoint.y;
      return;
    }

    if (!this.joystickActive) return;

    const offsetX = pointer.x - this.joystickCenter.x;
    const offsetY = pointer.y - this.joystickCenter.y;
    const dist = Math.sqrt(offsetX * offsetX + offsetY * offsetY);

    if (dist < TouchControls.DEADZONE) {
      this.dx = 0;
      this.dy = 0;
      this.drawJoystickThumb(this.joystickCenter.x, this.joystickCenter.y);
      return;
    }

    // Normalize direction
    const nx = offsetX / dist;
    const ny = offsetY / dist;

    this.dx = nx;
    this.dy = ny;

    // Clamp thumb position within max radius
    const clampedDist = Math.min(dist, TouchControls.JOYSTICK_RADIUS);
    const thumbX = this.joystickCenter.x + nx * clampedDist;
    const thumbY = this.joystickCenter.y + ny * clampedDist;
    this.drawJoystickThumb(thumbX, thumbY);
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.id === this.joystickPointerId) {
      this.joystickActive = false;
      this.joystickPointerId = -1;
      this.dx = 0;
      this.dy = 0;
      this.joystickBase.setVisible(false);
      this.joystickThumb.setVisible(false);
    }
  }

  // --- Mobile skill buttons ---

  private createSkillButtons(): void {
    const container = document.createElement('div');
    container.id = 'mobile-skills';
    container.style.cssText = `
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      display: grid;
      grid-template-columns: 48px 48px;
      gap: 8px;
      z-index: 60;
      pointer-events: auto;
    `;

    const skills = [
      { id: 'hook', icon: '\u{1FA9D}', label: '1' },
      { id: 'rot', icon: '\u2620\uFE0F', label: '2' },
      { id: 'phase', icon: '\u2728', label: '3' },
      { id: 'dismember', icon: '\u{1F52A}', label: '4' },
    ];

    skills.forEach(skill => {
      const btn = document.createElement('div');
      btn.className = 'mobile-skill-btn';
      btn.dataset.skillId = skill.id;
      btn.innerHTML = `<span class="skill-icon">${skill.icon}</span>`;
      btn.style.cssText = `
        width: 48px; height: 48px;
        background: rgba(0,0,0,0.5);
        backdrop-filter: blur(4px);
        border: 2px solid rgba(255,217,61,0.3);
        border-radius: 12px;
        display: flex; align-items: center; justify-content: center;
        font-size: 20px;
        touch-action: manipulation;
        user-select: none;
        -webkit-user-select: none;
      `;

      btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        btn.style.transform = 'scale(0.9)';
        btn.style.borderColor = 'rgba(255,217,61,0.8)';
        if (skill.id === 'hook') {
          this.wantHook = true;
        } else if (this.onSkillCallback) {
          this.onSkillCallback(skill.id);
        }
      });

      btn.addEventListener('touchend', (e) => {
        e.preventDefault();
        btn.style.transform = 'scale(1)';
        btn.style.borderColor = 'rgba(255,217,61,0.3)';
      });

      container.appendChild(btn);
      this.skillButtons.push(btn);
    });

    document.getElementById('game-container')!.appendChild(container);
  }

  // --- Drawing helpers ---

  private drawJoystickBase(x: number, y: number): void {
    this.joystickBase.clear();
    this.joystickBase.fillStyle(0x888888, 0.3);
    this.joystickBase.fillCircle(x, y, TouchControls.BASE_RADIUS);
    this.joystickBase.lineStyle(2, 0xaaaaaa, 0.4);
    this.joystickBase.strokeCircle(x, y, TouchControls.BASE_RADIUS);
  }

  private drawJoystickThumb(x: number, y: number): void {
    this.joystickThumb.clear();
    this.joystickThumb.fillStyle(0xffffff, 0.5);
    this.joystickThumb.fillCircle(x, y, TouchControls.THUMB_RADIUS);
  }
}
