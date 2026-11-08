import { describe, expect, it } from 'vitest';
import { ChapterAudio, chapterAudioIntent, validAudioFrame, type ChapterAudioFrame } from '../../chapter/experience/ChapterAudio';
const frame = (): ChapterAudioFrame => ({ slot: 'A', foot: [0, 0, 33], eye: [0, 1.55, 33],
  forward: [0, 0, -1], up: [0, 1, 0], speed: 3, grounded: true, mode: 'NORMAL', terminal: false, returned: false, eventId: 0 });
describe('authored sound intent and gesture lifecycle', () => {
  it('does not construct or autoplay audio before an explicit unlock and survives absent browser audio', async () => {
    const audio = new ChapterAudio();
    audio.update(frame(), .1);
    expect(audio.snapshot()).toMatchObject({ state: 'locked', unlocked: false, footsteps: 0, cues: 0 });
    expect(await audio.unlock()).toBe(false);
    expect(audio.snapshot().error).toBe('Web Audio unavailable');
    audio.dispose(); audio.dispose();
    expect(await audio.unlock()).toBe(false);
    expect(audio.snapshot().state).toBe('disposed');
  });
  it('selects surfaces from real committed world coordinates, including inverted support', () => {
    expect(chapterAudioIntent(frame())).toMatchObject({ material: 'metal', roomMix: .8 });
    expect(chapterAudioIntent({ ...frame(), foot: [8, 0, 10] })).toMatchObject({ material: 'stone', roomMix: .15 });
    expect(chapterAudioIntent({ ...frame(), slot: 'B', mode: 'WALL', foot: [4.7, 4, -12] })).toMatchObject({ material: 'arc', stride: .7 });
    expect(chapterAudioIntent({ ...frame(), eye: [0, 2.8, -20] }).portalDistance).toBe(0);
    expect(chapterAudioIntent({ ...frame(), slot: 'B', eye: [0, 2.8, 18.2] }).portalDistance).toBe(0);
  });
  it('rejects nonfinite pose/speed/event input and clamps volume without poisoning the sound graph', () => {
    for (const speed of [NaN, Infinity, -1, 100]) expect(validAudioFrame({ ...frame(), speed })).toBe(false);
    expect(validAudioFrame({ ...frame(), eye: [0, NaN, 0] })).toBe(false);
    expect(validAudioFrame({ ...frame(), eventId: 1.2 })).toBe(false);
    expect(validAudioFrame(frame())).toBe(true);
    const audio = new ChapterAudio(); audio.configure({ volume: Infinity }); expect(audio.snapshot().volume).toBe(.55);
    audio.configure({ volume: 20, muted: true }); expect(audio.snapshot()).toMatchObject({ volume: 1, muted: true });
    audio.configure({ volume: -1 }); expect(audio.snapshot().volume).toBe(0); audio.dispose();
  });
});
