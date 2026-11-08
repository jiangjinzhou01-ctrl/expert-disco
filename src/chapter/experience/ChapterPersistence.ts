import { ARC_LENGTH, surfacePose } from '../physics/GravitySurface';
import { DEFAULT_MOVEMENT, type MovementSettings, type Stance, type LocomotionMode } from '../physics/Locomotion';

export interface ChapterSettings extends MovementSettings {
  sensitivity: number;
  acceleration: number;
  invertY: boolean;
  quality: 1 | .75 | .4;
  volume: number;
  muted: boolean;
  reducedMotion: boolean;
  fov: number;
  tutorialSeen: boolean;
  touchSize: number;
  touchOpacity: number;
}

/** All devices receive the same highest-quality default. Only an explicit user choice lowers it. */
export const DEFAULT_CHAPTER_SETTINGS: Readonly<ChapterSettings> = Object.freeze({
  ...DEFAULT_MOVEMENT, touchSize: 1, touchOpacity: .8,
  sensitivity: 1.3, acceleration: 1, invertY: false, quality: 1,
  volume: .55, muted: false, reducedMotion: false, fov: 50, tutorialSeen: false,
});
export const SETTINGS_KEY = 'threshold.orbital.settings.v1';
export const CHECKPOINT_KEY = 'threshold.orbital.checkpoint.v1';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
export interface ChapterCheckpoint {
  version: 1;
  slot: 'A' | 'B';
  foot: [number, number, number];
  mode: 'NORMAL' | 'ARC' | 'WALL';
  s: number;
  yaw: number;
  pitch: number;
  terminal: boolean;
  returned: boolean;
  savedAt: number;
}
export interface ChapterCheckpointV2 extends Omit<ChapterCheckpoint, 'version'> {
  version: 2; stance: Stance; locomotion: LocomotionMode; fieldId: string;
  velocity: [number, number, number]; gravity: [number, number, number];
  bodyRotation: [number, number, number, number];
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function range(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}
function bool(value: unknown): value is boolean { return typeof value === 'boolean'; }
function browserStorage(): StorageLike | undefined {
  try { return typeof window === 'undefined' ? undefined : window.localStorage; } catch { return undefined; }
}
function readJSON(key: string, storage: StorageLike | undefined): unknown {
  try { const value = storage?.getItem(key); return value ? JSON.parse(value) : null; } catch { return null; }
}
function putJSON(key: string, value: unknown, storage: StorageLike | undefined): boolean {
  try { if (!storage) return false; storage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

/** Bad or old settings are rejected as a unit; unknown extra keys never reach the runtime. */
export function validateChapterSettings(value: unknown): ChapterSettings | null {
  if (!object(value) || !range(value.sensitivity, .25, 3) || !range(value.acceleration, 0, 1)
    || !bool(value.invertY) || ![1, .75, .4].includes(value.quality as number)
    || !range(value.volume, 0, 1) || !bool(value.muted) || !bool(value.reducedMotion)
    || !range(value.fov, 40, 85) || !bool(value.tutorialSeen)) return null;
  const movement = { ...DEFAULT_MOVEMENT, ...Object.fromEntries(['profile', 'moveSpeed', 'jumpHeight', 'gravityScale', 'autoSprint'].filter(k => value[k] !== undefined).map(k => [k, value[k]])) };
  if (!['explore', 'experiment'].includes(movement.profile) || !range(movement.moveSpeed, 1.5, 7)
    || !range(movement.jumpHeight, .3, 3) || !range(movement.gravityScale, 0, 2) || !bool(movement.autoSprint)
    || (value.touchSize !== undefined && !range(value.touchSize, .8, 1.5))
    || (value.touchOpacity !== undefined && !range(value.touchOpacity, .3, 1))) return null;
  return {
    ...movement, touchSize: (value.touchSize as number | undefined) ?? 1, touchOpacity: (value.touchOpacity as number | undefined) ?? .8,
    sensitivity: value.sensitivity, acceleration: value.acceleration, invertY: value.invertY,
    quality: value.quality as ChapterSettings['quality'], volume: value.volume,
    muted: value.muted, reducedMotion: value.reducedMotion, fov: value.fov, tutorialSeen: value.tutorialSeen,
  };
}
export function readChapterSettings(storage: StorageLike | undefined = browserStorage()): ChapterSettings {
  const data = readJSON(SETTINGS_KEY, storage);
  return object(data) && (data.version === 1 || data.version === 2)
    ? validateChapterSettings(data.settings) ?? { ...DEFAULT_CHAPTER_SETTINGS }
    : { ...DEFAULT_CHAPTER_SETTINGS };
}
export function writeChapterSettings(settings: ChapterSettings, storage: StorageLike | undefined = browserStorage()): boolean {
  const safe = validateChapterSettings(settings);
  return safe !== null && putJSON(SETTINGS_KEY, { version: 2, settings: safe }, storage);
}

/**
 * Only a support-chart-consistent pose in the authored walkable envelope is eligible.
 * This is a first gate, not a physics clearance claim: the caller MUST check support
 * and full-capsule overlap before committing any restored pose.
 */
function validateLegacyCheckpoint(value: unknown): ChapterCheckpoint | null {
  if (!object(value) || value.version !== 1 || !['A', 'B'].includes(value.slot as string)
    || !['NORMAL', 'ARC', 'WALL'].includes(value.mode as string)
    || !Array.isArray(value.foot) || value.foot.length !== 3
    || !value.foot.every(n => range(n, -100, 100))
    || !range(value.s, -30, 30) || !range(value.yaw, -Math.PI * 1000, Math.PI * 1000)
    || !range(value.pitch, -1.4, 1.4) || !bool(value.terminal) || !bool(value.returned)
    || (value.returned && !value.terminal) || !range(value.savedAt, 0, 1e15)) return null;
  const [x, y, z] = value.foot as [number, number, number];
  if (value.slot === 'A') {
    const courtyard = x >= -15.55 && x <= 15.55 && z >= -21.55 && z <= 21.6;
    const corridor = Math.abs(x) <= 1.55 && z >= 21.5 && z <= 35.5;
    const pit = x > -5.35 && x < 5.35 && z > 1.65 && z < 10.35;
    if (value.mode !== 'NORMAL' || Math.abs(y) > .035 || (!courtyard && !corridor) || pit
      || Math.abs(value.s - (x - 1.5)) > .035) return null;
  } else if (value.mode === 'NORMAL') {
    const pit = x > -13.35 && x < -4.65 && z > -17.35 && z < -1.65;
    if (Math.abs(y) > .035 || x < -14.5 || x > 14.5 || z < -17.85 || z > 17.85 || pit
      || Math.abs(value.s - (x - 1.5)) > .035) return null;
    // An upright saved capsule cannot occupy the rising part of the gravity chart.
    if (z > -9 && z < -5 && x > 1.535 && x < 4.72) return null;
  } else {
    if (value.mode === 'ARC' && !(value.s > 0 && value.s < ARC_LENGTH && z > -8.65 && z < -5.35)) return null;
    if (value.mode === 'WALL' && !(value.s >= ARC_LENGTH && value.s <= ARC_LENGTH + 3.65 && z >= -17.85 && z <= -5.35)) return null;
    const expected = surfacePose(value.s, z).foot;
    if (Math.hypot(x - expected.x, y - expected.y) > .035) return null;
  }
  return {
    version: 1, slot: value.slot as 'A' | 'B', foot: [x, y, z], mode: value.mode as ChapterCheckpoint['mode'],
    s: value.s, yaw: value.yaw, pitch: value.pitch, terminal: value.terminal,
    returned: value.returned, savedAt: value.savedAt,
  };
}
export function validateChapterCheckpoint(value: unknown): ChapterCheckpoint | ChapterCheckpointV2 | null {
  if (!object(value) || value.version !== 2) return validateLegacyCheckpoint(value);
  const base = validateLegacyCheckpoint({ ...value, version: 1 });
  const vector = (v: unknown, size: number, limit: number): v is number[] => Array.isArray(v) && v.length === size && v.every(n => range(n, -limit, limit));
  if (!base || !['STAND','CROUCH','PRONE'].includes(value.stance as string)
    || !['GROUND_WALK','REATTACH','RECOVER'].includes(value.locomotion as string)
    || typeof value.fieldId !== 'string' || value.fieldId.length > 80
    || !vector(value.velocity,3,20) || !vector(value.gravity,3,30) || !vector(value.bodyRotation,4,1)
    || Math.abs(Math.hypot(...value.bodyRotation)-1) > .001) return null;
  return { ...base, version: 2, stance: value.stance as Stance, locomotion: value.locomotion as LocomotionMode,
    fieldId: value.fieldId, velocity: [...value.velocity] as [number,number,number],
    gravity: [...value.gravity] as [number,number,number], bodyRotation: [...value.bodyRotation] as [number,number,number,number] };
}
export function readChapterCheckpoint(storage: StorageLike | undefined = browserStorage()): ChapterCheckpoint | ChapterCheckpointV2 | null {
  return validateChapterCheckpoint(readJSON(CHECKPOINT_KEY, storage));
}
export function writeChapterCheckpoint(checkpoint: ChapterCheckpoint | ChapterCheckpointV2, storage: StorageLike | undefined = browserStorage()): boolean {
  const safe = validateChapterCheckpoint(checkpoint);
  return safe !== null && putJSON(CHECKPOINT_KEY, safe, storage);
}
export function clearChapterCheckpoint(storage: StorageLike | undefined = browserStorage()): void {
  try { storage?.removeItem(CHECKPOINT_KEY); } catch { /* Storage denial must never interrupt the simulation. */ }
}

export class ChapterPersistence {
  constructor(private readonly storage: StorageLike | undefined = browserStorage()) {}
  readSettings() { return readChapterSettings(this.storage); }
  writeSettings(settings: ChapterSettings) { return writeChapterSettings(settings, this.storage); }
  readCheckpoint() { return readChapterCheckpoint(this.storage); }
  writeCheckpoint(checkpoint: ChapterCheckpoint | ChapterCheckpointV2) { return writeChapterCheckpoint(checkpoint, this.storage); }
  clearCheckpoint() { clearChapterCheckpoint(this.storage); }
}
