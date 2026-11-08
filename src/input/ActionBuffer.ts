import type { MotionInput } from '../chapter/physics/Locomotion';

export type Action = 'jump' | 'sprint' | 'crouch' | 'prone' | 'brake';
/** Input edges are consumed by a physics step, never by the UI snapshot reader. */
export class ActionBuffer {
  private readonly held = new Map<Action, Set<string>>();
  private readonly pressed = new Set<Action>();
  set(action: Action, down: boolean, source: string): void {
    let sources = this.held.get(action);
    if (!sources) { sources = new Set(); this.held.set(action, sources); }
    if (down) {
      if (!sources.size) this.pressed.add(action);
      sources.add(source);
    } else sources.delete(source);
  }
  read(consume = false): Omit<MotionInput, 'x' | 'y'> {
    const on = (action: Action) => !!this.held.get(action)?.size;
    const result = { jump: on('jump'), jumpPressed: this.pressed.has('jump'), sprint: on('sprint'),
      crouch: on('crouch'), pronePressed: this.pressed.has('prone'), descend: on('crouch'), brake: on('brake') };
    if (consume) this.pressed.clear();
    return result;
  }
  clear(): void { this.held.clear(); this.pressed.clear(); }
}
