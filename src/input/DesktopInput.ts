import type { Action } from './ActionBuffer';

export interface InputCallbacks {
  look(dx: number, dy: number): void;
  reset(): void;
  toggleDebug(): void;
  action?(action: Action, down: boolean, source: string): void;
}

function isEditing(target: EventTarget | null): boolean {
  return target instanceof HTMLElement
    && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
}

/** Event-driven desktop input; no independent animation or simulation loop. */
export class DesktopInput {
  private readonly keys = new Set<string>();
  private readonly actionKeys = new Set<string>();
  private dragPointer: number | null = null;
  private lastX = 0;
  private lastY = 0;
  private readonly axes = { x: 0, y: 0 };

  constructor(private readonly canvas: HTMLElement, private readonly callbacks: InputCallbacks) {
    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', this.keyUp);
    canvas.addEventListener('pointerdown', this.pointerDown);
    canvas.addEventListener('pointermove', this.pointerMove);
    canvas.addEventListener('pointerup', this.pointerUp);
    canvas.addEventListener('pointercancel', this.pointerUp);
    canvas.addEventListener('lostpointercapture', this.pointerUp);
    canvas.addEventListener('dblclick', this.doubleClick);
    document.addEventListener('pointerlockchange', this.pointerLockChange);
  }

  get movement(): { x: number; y: number } {
    this.axes.x = Number(this.keys.has('KeyD') || this.keys.has('ArrowRight'))
      - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft'));
    this.axes.y = Number(this.keys.has('KeyW') || this.keys.has('ArrowUp'))
      - Number(this.keys.has('KeyS') || this.keys.has('ArrowDown'));
    return this.axes;
  }

  private readonly keyDown = (event: KeyboardEvent): void => {
    if (isEditing(event.target)) return;
    const action = this.actionForKey(event.code);
    if (action && this.callbacks.action) {
      event.preventDefault();
      if (!event.repeat) { this.actionKeys.add(event.code); this.callbacks.action(action, true, event.code); }
    }
    if (/^(Key[WASD]|Arrow(Up|Down|Left|Right))$/.test(event.code)) {
      event.preventDefault();
      this.keys.add(event.code);
    }
    if (event.code === 'KeyR' && !event.repeat) {
      event.preventDefault();
      this.callbacks.reset();
    }
    if (event.code === 'F3' && !event.repeat) {
      event.preventDefault();
      this.callbacks.toggleDebug();
    }
    if (event.code === 'Escape') {
      this.clear();
      if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    }
  };

  private actionForKey(code: string): Action | undefined {
    return ({ Space: 'jump', ShiftLeft: 'sprint', ShiftRight: 'sprint', ControlLeft: 'crouch',
      ControlRight: 'crouch', KeyZ: 'prone', KeyX: 'brake' } as Record<string, Action>)[code];
  }
  private readonly keyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
    const action = this.actionForKey(event.code);
    this.actionKeys.delete(event.code);
    if (action) this.callbacks.action?.(action, false, event.code);
  };

  private readonly pointerDown = (event: PointerEvent): void => {
    if (event.pointerType === 'touch' || event.button !== 0 || this.dragPointer !== null) return;
    this.dragPointer = event.pointerId;
    this.lastX = event.clientX;
    this.lastY = event.clientY;
    try { this.canvas.setPointerCapture(event.pointerId); } catch (error) {
      // Synthetic regression events have no native active pointer to capture.
      if (!(error instanceof DOMException)) throw error;
    }
  };

  private readonly pointerMove = (event: PointerEvent): void => {
    if (event.pointerType === 'touch') return;
    if (document.pointerLockElement === this.canvas) {
      this.callbacks.look(event.movementX, event.movementY);
    } else if (event.pointerId === this.dragPointer) {
      this.callbacks.look(event.clientX - this.lastX, event.clientY - this.lastY);
      this.lastX = event.clientX;
      this.lastY = event.clientY;
    }
  };

  private readonly pointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.dragPointer) return;
    this.dragPointer = null;
    if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
  };

  private readonly doubleClick = (): void => {
    if (!this.canvas.requestPointerLock) return;
    // Dragging remains available when a browser declines pointer lock.
    const request = this.canvas.requestPointerLock();
    if (request) void request.catch(() => undefined);
  };

  private readonly pointerLockChange = (): void => {
    if (document.pointerLockElement !== this.canvas) this.dragPointer = null;
  };

  clear(): void {
    for (const code of this.actionKeys) this.callbacks.action?.(this.actionForKey(code)!, false, code);
    this.actionKeys.clear();
    this.keys.clear();
    const pointer = this.dragPointer;
    this.dragPointer = null;
    if (pointer !== null && this.canvas.hasPointerCapture(pointer)) this.canvas.releasePointerCapture(pointer);
  }

  dispose(): void {
    this.clear();
    window.removeEventListener('keydown', this.keyDown);
    window.removeEventListener('keyup', this.keyUp);
    this.canvas.removeEventListener('pointerdown', this.pointerDown);
    this.canvas.removeEventListener('pointermove', this.pointerMove);
    this.canvas.removeEventListener('pointerup', this.pointerUp);
    this.canvas.removeEventListener('pointercancel', this.pointerUp);
    this.canvas.removeEventListener('lostpointercapture', this.pointerUp);
    this.canvas.removeEventListener('dblclick', this.doubleClick);
    document.removeEventListener('pointerlockchange', this.pointerLockChange);
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }
}
