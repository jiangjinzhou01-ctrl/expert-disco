import type { InputCallbacks } from './DesktopInput';

const JOYSTICK_RADIUS = 58;
export interface TouchState { moveActive: boolean; lookActive: boolean; moveX: number; moveY: number }

/** Two independent Pointer IDs: left movement joystick and right camera drag. */
export class TouchInput {
  readonly movement = { x: 0, y: 0 };
  readonly state: TouchState = { moveActive: false, lookActive: false, moveX: 0, moveY: 0 };
  used = false;
  private movePointer: number | null = null;
  private lookPointer: number | null = null;
  private originX = 0;
  private originY = 0;
  private lookX = 0;
  private lookY = 0;

  constructor(private readonly canvas: HTMLElement, private readonly callbacks: InputCallbacks) {
    canvas.addEventListener('pointerdown', this.pointerDown, { passive: false });
    canvas.addEventListener('pointermove', this.pointerMove, { passive: false });
    canvas.addEventListener('pointerup', this.pointerEnd);
    canvas.addEventListener('pointercancel', this.pointerEnd);
    canvas.addEventListener('lostpointercapture', this.pointerEnd);
  }

  private readonly pointerDown = (event: PointerEvent): void => {
    if (event.pointerType !== 'touch') return;
    this.used = true;
    const bounds = this.canvas.getBoundingClientRect();
    if (event.clientX - bounds.left < bounds.width * 0.45) {
      if (this.movePointer !== null) return;
      this.movePointer = event.pointerId;
      this.originX = event.clientX;
      this.originY = event.clientY;
      this.state.moveActive = true;
    } else {
      if (this.lookPointer !== null) return;
      this.lookPointer = event.pointerId;
      this.lookX = event.clientX;
      this.lookY = event.clientY;
      this.state.lookActive = true;
    }
    event.preventDefault();
    try { this.canvas.setPointerCapture(event.pointerId); } catch (error) {
      if (!(error instanceof DOMException)) throw error;
    }
  };

  private readonly pointerMove = (event: PointerEvent): void => {
    if (event.pointerType !== 'touch') return;
    if (event.pointerId === this.movePointer) {
      event.preventDefault();
      const dx = event.clientX - this.originX;
      const dy = event.clientY - this.originY;
      const divisor = Math.max(JOYSTICK_RADIUS, Math.hypot(dx, dy));
      this.movement.x = dx / divisor;
      this.movement.y = -dy / divisor;
      this.state.moveX = this.movement.x * JOYSTICK_RADIUS;
      this.state.moveY = -this.movement.y * JOYSTICK_RADIUS;
    } else if (event.pointerId === this.lookPointer) {
      event.preventDefault();
      this.callbacks.look(event.clientX - this.lookX, event.clientY - this.lookY);
      this.lookX = event.clientX;
      this.lookY = event.clientY;
    }
  };

  private readonly pointerEnd = (event: PointerEvent): void => {
    if (event.pointerId === this.movePointer) {
      this.movePointer = null;
      this.movement.x = 0;
      this.movement.y = 0;
      this.state.moveActive = false;
      this.state.moveX = 0;
      this.state.moveY = 0;
    }
    if (event.pointerId === this.lookPointer) {
      this.lookPointer = null;
      this.state.lookActive = false;
    }
    if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
  };

  clear(): void {
    const movePointer = this.movePointer;
    const lookPointer = this.lookPointer;
    this.movePointer = null;
    this.lookPointer = null;
    this.movement.x = 0;
    this.movement.y = 0;
    Object.assign(this.state, { moveActive: false, lookActive: false, moveX: 0, moveY: 0 });
    for (const pointer of [movePointer, lookPointer]) {
      if (pointer !== null && this.canvas.hasPointerCapture(pointer)) this.canvas.releasePointerCapture(pointer);
    }
  }

  dispose(): void {
    this.clear();
    this.canvas.removeEventListener('pointerdown', this.pointerDown);
    this.canvas.removeEventListener('pointermove', this.pointerMove);
    this.canvas.removeEventListener('pointerup', this.pointerEnd);
    this.canvas.removeEventListener('pointercancel', this.pointerEnd);
    this.canvas.removeEventListener('lostpointercapture', this.pointerEnd);
  }
}
