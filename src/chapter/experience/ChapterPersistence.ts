import { ARC_LENGTH, surfacePose } from '../physics/GravitySurface';

export interface ChapterSettings {
  sensitivity: number;
  acceleration: number;
  invertY: boolean;
  quality: 1 | .75 | .4;
  volume: number;
  muted: boolean;
  reducedMotion: boolean;
  fov: number;
  tutorialSeen: boolean;
}

/** All devices receive the same highest-quality default. Only an explicit user choice lowers it. */
export const DEFAULT_CHAPTER_SETTINGS: Readonly<ChapterSettings> = Object.freeze({
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
  return {
    sensitivity: value.sensitivity, acceleration: value.acceleration, invertY: value.invertY,
    quality: value.quality as ChapterSettings['quality'], volume: value.volume,
    muted: value.muted, reducedMotion: value.reducedMotion, fov: value.fov, tutorialSeen: value.tutorialSeen,
  };
}
export function readChapterSettings(storage: StorageLike | undefined = browserStorage()): ChapterSettings {
  const data = readJSON(SETTINGS_KEY, storage);
  return object(data) && data.version === 1
    ? validateChapterSettings(data.settings) ?? { ...DEFAULT_CHAPTER_SETTINGS }
    : { ...DEFAULT_CHAPTER_SETTINGS };
}
export function writeChapterSettings(settings: ChapterSettings, storage: StorageLike | undefined = browserStorage()): boolean {
  const safe = validateChapterSettings(settings);
  return safe !== null && putJSON(SETTINGS_KEY, { version: 1, settings: safe }, storage);
}

/**
 * Only a support-chart-consistent pose in the authored walkable envelope is eligible.
 * This is a first gate, not a physics clearance claim: the caller MUST check support
 * and full-capsule overlap before committing any restored pose.
 */
export function validateChapterCheckpoint(value: unknown): ChapterCheckpoint | null {
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
export function readChapterCheckpoint(storage: StorageLike | undefined = browserStorage()): ChapterCheckpoint | null {
  return validateChapterCheckpoint(readJSON(CHECKPOINT_KEY, storage));
}
export function writeChapterCheckpoint(checkpoint: ChapterCheckpoint, storage: StorageLike | undefined = browserStorage()): boolean {
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
  writeCheckpoint(checkpoint: ChapterCheckpoint) { return writeChapterCheckpoint(checkpoint, this.storage); }
  clearCheckpoint() { clearChapterCheckpoint(this.storage); }
}
