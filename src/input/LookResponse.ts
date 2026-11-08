export interface LookSettings {
  /** Touch baseline; desktop uses sensitivity / DEFAULT_LOOK_SETTINGS.sensitivity. */
  sensitivity: number;
  /** Zero is linear; one adds up to 2x gain for a fast flick. */
  acceleration: number;
  invertY: boolean;
}

export const DEFAULT_LOOK_SETTINGS: Readonly<LookSettings> = Object.freeze({
  sensitivity: 1.3,
  acceleration: 1,
  invertY: false,
});

export interface LookDiagnostics {
  active: boolean;
  speedScreensPerSecond: number;
  horizontalGain: number;
  verticalGain: number;
  samples: number;
  rejectedSamples: number;
}

const RESPONSE_SECONDS = 0.024;
const REFERENCE_WIDTH = 768;
const LOW_SPEED = 0.12;
const HIGH_SPEED = 2.2;

/**
 * Event-driven touch response. Only the speed estimate is filtered: every
 * returned angle belongs to the displacement supplied in this call. There is
 * no spring, queued animation, or continued rotation after the finger stops.
 * A viewport-relative displacement keeps the same gesture useful on a phone
 * in either orientation without depending on its hardware pixel ratio.
 */
export class LookResponse {
  private configuration: LookSettings = { ...DEFAULT_LOOK_SETTINGS };
  private lastTimestamp: number | null = null;
  private filteredSpeed = 0;
  private readonly diagnostics: LookDiagnostics = {
    active: false,
    speedScreensPerSecond: 0,
    horizontalGain: 1,
    verticalGain: 1,
    samples: 0,
    rejectedSamples: 0,
  };

  constructor(settings: Partial<LookSettings> = {}) { this.configure(settings); }

  get settings(): Readonly<LookSettings> { return { ...this.configuration }; }
  get snapshot(): Readonly<LookDiagnostics> { return { ...this.diagnostics }; }

  configure(settings: Partial<LookSettings>): void {
    const next: LookSettings = {
      sensitivity: settings.sensitivity === undefined ? this.configuration.sensitivity : settings.sensitivity,
      acceleration: settings.acceleration === undefined ? this.configuration.acceleration : settings.acceleration,
      invertY: settings.invertY === undefined ? this.configuration.invertY : settings.invertY,
    };
    if (!Number.isFinite(next.sensitivity) || next.sensitivity < 0.35 || next.sensitivity > 3
      || !Number.isFinite(next.acceleration) || next.acceleration < 0 || next.acceleration > 1.5
      || typeof next.invertY !== 'boolean') {
      throw new RangeError('Look settings require sensitivity 0.35..3, acceleration 0..1.5, and boolean invertY');
    }
    this.configuration = next;
  }

  begin(timestamp: number): void {
    this.end();
    if (!Number.isFinite(timestamp)) {
      this.diagnostics.rejectedSamples++;
      return;
    }
    this.lastTimestamp = timestamp;
    this.diagnostics.active = true;
  }

  sample(dx: number, dy: number, timestamp: number, viewportWidth: number): { x: number; y: number } {
    if (![dx, dy, timestamp, viewportWidth].every(Number.isFinite) || viewportWidth <= 0
      || !this.diagnostics.active || this.lastTimestamp === null || timestamp < this.lastTimestamp) {
      this.diagnostics.rejectedSamples++;
      return { x: 0, y: 0 };
    }
    const elapsed = (timestamp - this.lastTimestamp) / 1000;
    this.lastTimestamp = timestamp;
    // A stationary gap is not accumulated angular momentum.
    if (elapsed > 0.12) this.filteredSpeed = 0;
    const dt = Math.max(0.001, Math.min(0.08, elapsed));
    const speed = Math.hypot(dx, dy) / viewportWidth / dt;
    const alpha = 1 - Math.exp(-dt / RESPONSE_SECONDS);
    this.filteredSpeed += (Math.min(speed, 8) - this.filteredSpeed) * alpha;
    const t = Math.max(0, Math.min(1, (this.filteredSpeed - LOW_SPEED) / (HIGH_SPEED - LOW_SPEED)));
    const smooth = t * t * (3 - 2 * t);
    const horizontalGain = 1 + this.configuration.acceleration * smooth;
    const verticalGain = 1 + this.configuration.acceleration * smooth * 0.7;
    const baseline = this.configuration.sensitivity * REFERENCE_WIDTH / Math.max(320, viewportWidth);
    const x = dx * baseline * horizontalGain;
    const y = dy * baseline * verticalGain * (this.configuration.invertY ? -1 : 1);
    if (!Number.isFinite(x + y)) {
      this.diagnostics.rejectedSamples++;
      return { x: 0, y: 0 };
    }
    Object.assign(this.diagnostics, {
      speedScreensPerSecond: this.filteredSpeed,
      horizontalGain,
      verticalGain,
      samples: this.diagnostics.samples + 1,
    });
    return { x, y };
  }

  end(): void {
    this.lastTimestamp = null;
    this.filteredSpeed = 0;
    Object.assign(this.diagnostics, {
      active: false,
      speedScreensPerSecond: 0,
      horizontalGain: 1,
      verticalGain: 1,
    });
  }
}
