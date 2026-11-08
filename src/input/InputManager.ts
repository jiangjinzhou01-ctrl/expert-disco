import { DesktopInput } from './DesktopInput';
import type { InputCallbacks } from './DesktopInput';
import { TouchInput } from './TouchInput';
import { DEFAULT_LOOK_SETTINGS, type LookSettings } from './LookResponse';
import { ActionBuffer, type Action } from './ActionBuffer';
import type { MotionInput } from '../chapter/physics/Locomotion';

export interface InputOptions {
  /** Chapter enables this; G0-LAB retains its original linear regression profile. */
  enhancedTouchLook?: boolean;
  actions?: boolean;
}

/** One event-input adapter read by the fixed-step ExperienceLoop. */
export class InputManager {
  readonly actions = new ActionBuffer();
  private readonly desktop: DesktopInput;
  private readonly touchscreen: TouchInput;
  private readonly combined = { x: 0, y: 0 };
  private readonly initialTouch: boolean;
  private readonly previousTouchAction: string;

  constructor(private readonly canvas: HTMLElement, callbacks: InputCallbacks, options: InputOptions = {}) {
    this.previousTouchAction = canvas.style.touchAction;
    canvas.style.touchAction = 'none';
    this.initialTouch = navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches;
    this.touchscreen = new TouchInput(canvas, callbacks, options.enhancedTouchLook ?? false);
    this.desktop = new DesktopInput(canvas, {
      ...callbacks,
      action: options.actions ? (action, down, source) => this.actions.set(action, down, source) : undefined,
      look: (x, y) => {
        const settings = this.touchscreen.lookResponse.settings;
        const gain = settings.sensitivity / DEFAULT_LOOK_SETTINGS.sensitivity;
        callbacks.look(x * gain, y * gain * (settings.invertY ? -1 : 1));
      },
    });
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
  frame(): MotionInput { return { ...this.movement, ...this.actions.read(true) }; }
  setAction(action: Action, down: boolean, pointerId: number): void {
    this.actions.set(action, down, `touch:${pointerId}`);
  }
  get touchState() { return this.touchscreen.state; }
  get lookSettings() { return this.touchscreen.lookResponse.settings; }
  get lookDiagnostics() { return this.touchscreen.lookResponse.snapshot; }
  setLookSettings(settings: Partial<LookSettings>): void { this.touchscreen.setLookSettings(settings); }

  readonly clear = (): void => {
    this.desktop.clear();
    this.touchscreen.clear();
    this.actions.clear();
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
