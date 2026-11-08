import { describe, expect, it } from 'vitest';
import { ARC_LENGTH, surfacePose } from '../../chapter/physics/GravitySurface';
import {
  ChapterPersistence, DEFAULT_CHAPTER_SETTINGS, SETTINGS_KEY, CHECKPOINT_KEY,
  validateChapterSettings, validateChapterCheckpoint, type ChapterCheckpoint, type StorageLike,
} from '../../chapter/experience/ChapterPersistence';

function memoryStorage(): StorageLike {
  const values = new Map<string, string>();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: key => { values.delete(key); } };
}
function spawn(): ChapterCheckpoint {
  return { version: 1, slot: 'A', foot: [0, 0, 33], mode: 'NORMAL', s: -1.5,
    yaw: 0, pitch: 0, terminal: false, returned: false, savedAt: 1794060000000 };
}
describe('bounded chapter persistence', () => {
  it('defaults to highest quality and returns independent defaults when storage is absent or denied', () => {
    const storage: StorageLike = { getItem() { throw Error('denied'); }, setItem() { throw Error('quota'); }, removeItem() { throw Error('denied'); } };
    const persistence = new ChapterPersistence(storage);
    const first = persistence.readSettings(); first.quality = .4;
    expect(persistence.readSettings()).toEqual(DEFAULT_CHAPTER_SETTINGS);
    expect(persistence.readSettings().quality).toBe(1);
    expect(persistence.readCheckpoint()).toBeNull();
    expect(persistence.writeSettings({ ...DEFAULT_CHAPTER_SETTINGS })).toBe(false);
    expect(persistence.writeCheckpoint(spawn())).toBe(false);
    expect(() => persistence.clearCheckpoint()).not.toThrow();
  });
  it('round-trips explicit preferences and a safe checkpoint without accepting unknown settings', () => {
    const storage = memoryStorage(), persistence = new ChapterPersistence(storage);
    const settings = { ...DEFAULT_CHAPTER_SETTINGS, muted: true, sensitivity: 2, quality: .75 as const, tutorialSeen: true };
    expect(persistence.writeSettings(settings)).toBe(true);
    expect(persistence.readSettings()).toEqual(settings);
    const expanded = { ...settings, execute: 'malicious', __proto__: { privileged: true } };
    expect(validateChapterSettings(expanded)).toEqual(settings);
    expect(persistence.writeCheckpoint(spawn())).toBe(true);
    const first = persistence.readCheckpoint()!; first.foot[0] = 20;
    expect(persistence.readCheckpoint()).toEqual(spawn());
    persistence.clearCheckpoint(); expect(persistence.readCheckpoint()).toBeNull();
  });
  it('rejects malformed JSON, unsupported versions, nonfinite values and out-of-range controls', () => {
    const storage = memoryStorage(), persistence = new ChapterPersistence(storage);
    for (const raw of ['{broken', JSON.stringify({ version: 2, settings: DEFAULT_CHAPTER_SETTINGS }), 'null']) {
      storage.setItem(SETTINGS_KEY, raw); expect(persistence.readSettings()).toEqual(DEFAULT_CHAPTER_SETTINGS);
    }
    for (const field of ['sensitivity', 'acceleration', 'fov', 'volume']) {
      for (const bad of [NaN, Infinity, -Infinity, -1, 1000, '1', null]) {
        expect(validateChapterSettings({ ...DEFAULT_CHAPTER_SETTINGS, [field]: bad }), `${field}:${bad}`).toBeNull();
      }
    }
    for (const quality of [0, 2, '1', NaN]) expect(validateChapterSettings({ ...DEFAULT_CHAPTER_SETTINGS, quality })).toBeNull();
    for (const key of ['muted', 'invertY', 'reducedMotion', 'tutorialSeen']) expect(validateChapterSettings({ ...DEFAULT_CHAPTER_SETTINGS, [key]: 1 })).toBeNull();
    storage.setItem(CHECKPOINT_KEY, '{broken'); expect(persistence.readCheckpoint()).toBeNull();
  });
  it('accepts authored normal, arc and wall support poses and preserves meaningful progress', () => {
    const a = spawn(); a.foot = [8, 0, -14]; a.s = 6.5; a.terminal = true; a.returned = true;
    expect(validateChapterCheckpoint(a)).toEqual(a);
    for (const s of [.1, ARC_LENGTH / 2, ARC_LENGTH - .1, ARC_LENGTH, ARC_LENGTH + .8, ARC_LENGTH + 3]) {
      const pose = surfacePose(s, -7);
      const checkpoint = { ...spawn(), slot: 'B' as const, foot: pose.foot.toArray() as [number, number, number], s, mode: pose.mode };
      expect(validateChapterCheckpoint(checkpoint), `s=${s}`).toEqual(checkpoint);
    }
    const b = { ...spawn(), slot: 'B', foot: [0, 0, 15], s: -1.5 };
    expect(validateChapterCheckpoint(b)).not.toBeNull();
  });
  it('rejects source spoofing, unsafe voids, out-of-bounds poses and chart-inconsistent rotations', () => {
    for (const corrupt of [
      { version: 2 }, { slot: 'C' }, { foot: [NaN, 0, 33] }, { foot: [0, Infinity, 33] },
      { foot: [0, 0, 6] }, { foot: [6, 0, 33], s: 4.5 }, { foot: [0, 8, 33] },
      { foot: [0, 0, 100] }, { foot: [0, 0, 33, 9] }, { mode: 'WALL' },
      { yaw: Infinity }, { pitch: 2 }, { terminal: false, returned: true }, { savedAt: -2 },
      { slot: 'B', foot: [-8, 0, -7], s: -9.5 },
      { slot: 'B', foot: [3, 0, -7], s: 1.5 },
      { slot: 'B', foot: [4.7, 4, -7], s: ARC_LENGTH + .8, mode: 'ARC' },
      { slot: 'B', foot: [4.7, 9, -7], s: ARC_LENGTH + 5.8, mode: 'WALL' },
      { slot: 'B', foot: [4.7, 4, -2], s: ARC_LENGTH + .8, mode: 'WALL' },
    ]) expect(validateChapterCheckpoint({ ...spawn(), ...corrupt }), JSON.stringify(corrupt)).toBeNull();
  });
});
