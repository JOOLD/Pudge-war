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

  /** Call in scene.create() to wire up input handlers */
  setup(): void {
    // Enable multi-touch (default is 1 pointer)
    this.scene.input.addPointer(1);

    this.scene.input.on("pointerdown", this.onPointerDown, this);
    this.scene.input.on("pointermove", this.onPointerMove, this);
    this.scene.input.on("pointerup", this.onPointerUp, this);
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
      // Right zone — hook trigger
      const cam = this.scene.cameras.main;
      const worldPoint = cam.getWorldPoint(pointer.x, pointer.y);
      this.aimX = worldPoint.x;
      this.aimY = worldPoint.y;
      this.wantHook = true;
    }
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.joystickActive) return;
    if (pointer.id !== this.joystickPointerId) return;

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
