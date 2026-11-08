import { describe, expect, it } from 'vitest';
import { ChapterPersistence, DEFAULT_CHAPTER_SETTINGS, SETTINGS_KEY, type StorageLike } from '../../chapter/experience/ChapterPersistence';

describe('V03 storage migration', () => {
  it('migrates v1 preferences without losing existing choices and writes version 2', () => {
    const map = new Map<string,string>();
    const storage: StorageLike = { getItem: k => map.get(k) ?? null, setItem: (k,v) => { map.set(k,v); }, removeItem: k => { map.delete(k); } };
    const old = { sensitivity: 2.2, acceleration: 0, invertY: true, quality: .75, volume: .4,
      muted: true, reducedMotion: true, fov: 60, tutorialSeen: true };
    map.set(SETTINGS_KEY, JSON.stringify({ version: 1, settings: old }));
    const p = new ChapterPersistence(storage), settings = p.readSettings();
    expect(settings).toMatchObject(old); expect(settings.moveSpeed).toBe(3);
    p.writeSettings({ ...settings, profile: 'experiment', gravityScale: .33, moveSpeed: 6, jumpHeight: 2 });
    expect(JSON.parse(map.get(SETTINGS_KEY)!).version).toBe(2);
    expect(p.readSettings()).toMatchObject({ gravityScale: .33, moveSpeed: 6, jumpHeight: 2, ...old });
    expect(DEFAULT_CHAPTER_SETTINGS.quality).toBe(1);
  });
  it('preserves a v2 crouched checkpoint and its physical frame, refusing malformed replacement records', () => {
    const map = new Map<string,string>();
    const p = new ChapterPersistence({ getItem: k => map.get(k) ?? null, setItem: (k,v) => { map.set(k,v); }, removeItem: k => { map.delete(k); } });
    const c = { version: 2 as const, slot: 'A' as const, foot: [0,0,33] as [number,number,number], mode: 'NORMAL' as const,
      s: -1.5, yaw: 0, pitch: 0, terminal: false, returned: false, savedAt: 1,
      stance: 'CROUCH' as const, locomotion: 'GROUND_WALK' as const, fieldId: 'architectural-support',
      velocity: [0,0,0] as [number,number,number], gravity: [0,-9.81,0] as [number,number,number], bodyRotation: [0,0,0,1] as [number,number,number,number] };
    expect(p.writeCheckpoint(c)).toBe(true); expect(p.readCheckpoint()).toEqual(c);
    expect(p.writeCheckpoint({ ...c, bodyRotation: [0,0,0,0] })).toBe(false);
    expect(p.readCheckpoint()).toEqual(c);
  });
});
