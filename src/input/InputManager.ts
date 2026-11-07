import { DesktopInput } from './DesktopInput';
import type { InputCallbacks } from './DesktopInput';
import { TouchInput } from './TouchInput';

/** One event-input adapter read by the fixed-step ExperienceLoop. */
export class InputManager {
  private readonly desktop: DesktopInput;
  private readonly touchscreen: TouchInput;
  private readonly combined = { x: 0, y: 0 };
  private readonly initialTouch: boolean;
  private readonly previousTouchAction: string;

  constructor(private readonly canvas: HTMLElement, callbacks: InputCallbacks) {
    this.previousTouchAction = canvas.style.touchAction;
    canvas.style.touchAction = 'none';
    this.initialTouch = navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches;
    this.desktop = new DesktopInput(canvas, callbacks);
    this.touchscreen = new TouchInput(canvas, callbacks);
    window.addEventListener('blur', this.clear);
    document.addEventListener('visibilitychange', this.visibilityChange);
    window.addEventListener('orientationchange', this.clear);
    screen.orientation?.addEventListener('change', this.clear);
  }

  get movement(): { x: number; y: number } {
    const keyboard = this.desktop.movement;
    const touchscreen = this.touchscreen.movement;
    this.combined.x = keyboard.x + touchscreen.x;
    this.combined.y = keyboard.y + touchscreen.y;
    const magnitude = Math.hypot(this.combined.x, this.combined.y);
    if (magnitude > 1) {
      this.combined.x /= magnitude;
      this.combined.y /= magnitude;
    }
    return this.combined;
  }

  get touch(): boolean { return this.initialTouch || this.touchscreen.used; }
  get touchState() { return this.touchscreen.state; }

  readonly clear = (): void => {
    this.desktop.clear();
    this.touchscreen.clear();
    this.combined.x = 0;
    this.combined.y = 0;
  };

  private readonly visibilityChange = (): void => { if (document.hidden) this.clear(); };

  dispose(): void {
    this.clear();
    this.desktop.dispose();
    this.touchscreen.dispose();
    window.removeEventListener('blur', this.clear);
    document.removeEventListener('visibilitychange', this.visibilityChange);
    window.removeEventListener('orientationchange', this.clear);
    screen.orientation?.removeEventListener('change', this.clear);
    this.canvas.style.touchAction = this.previousTouchAction;
  }
}
