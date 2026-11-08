import { test, expect } from '@playwright/test';
import type { ChapterAudio, ChapterAudioFrame } from '../../chapter/experience/ChapterAudio';

declare global { interface Window { __CHAPTER_AUDIO_HARNESS__?: ChapterAudio } }

test('orbital sound stays gesture-locked, emits bounded spatial cues, and releases its audio context', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  // The audio module is exercised independently of the heavy scene, using the real browser's Web Audio graph.
  await page.route('**/audio-harness', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body><button>Enable audio</button></body></html>' }));
  await page.goto('/audio-harness');
  await page.evaluate(async () => {
    const modulePath = '/src/chapter/experience/ChapterAudio.ts';
    const module = await import(/* @vite-ignore */ modulePath);
    const audio: ChapterAudio = new module.ChapterAudio();
    window.__CHAPTER_AUDIO_HARNESS__ = audio;
    document.querySelector('button')!.addEventListener('click', () => { void audio.unlock(); });
  });
  expect(await page.evaluate(() => window.__CHAPTER_AUDIO_HARNESS__!.snapshot())).toMatchObject({ state: 'locked', unlocked: false, footsteps: 0, cues: 0 });
  await page.getByRole('button', { name: 'Enable audio' }).click();
  await expect.poll(() => page.evaluate(() => window.__CHAPTER_AUDIO_HARNESS__!.snapshot().state)).toBe('running');
  const played = await page.evaluate(() => {
    const audio = window.__CHAPTER_AUDIO_HARNESS__!;
    const frame: ChapterAudioFrame = { slot: 'A', foot: [0, 0, 33], eye: [0, 1.55, 33], forward: [0, 0, -1], up: [0, 1, 0], speed: 3, grounded: true, mode: 'NORMAL', terminal: false, returned: false, eventId: 0 };
    audio.update(frame, 0);
    for (let i = 0; i < 10; i++) audio.update(frame, .1);
    frame.slot = 'B'; frame.eventId = 1; audio.update(frame, .01);
    frame.terminal = true; audio.update(frame, .01);
    frame.returned = true; frame.slot = 'A'; audio.update(frame, .01);
    for (let i = 0; i < 10; i++) audio.update({ ...frame, speed: 0 }, .1);
    return audio.snapshot();
  });
  expect(played.footsteps).toBeGreaterThanOrEqual(3);
  expect(played.cues).toBe(3);
  expect(played.activeVoices).toBeLessThan(45);
  expect(played.error).toBeNull();
  const muted = await page.evaluate(() => {
    const audio = window.__CHAPTER_AUDIO_HARNESS__!;
    audio.configure({ muted: true });
    audio.update({ slot: 'A', foot: [0, 0, 33], eye: [0, 1.55, 33], forward: [0, 0, -1], up: [0, 1, 0], speed: 3, grounded: true, mode: 'NORMAL', terminal: true, returned: true, eventId: 2 }, .1);
    return audio.snapshot();
  });
  expect(muted.muted).toBe(true); expect(muted.cues).toBe(3);
  await page.evaluate(() => window.__CHAPTER_AUDIO_HARNESS__!.suspend());
  expect(await page.evaluate(() => window.__CHAPTER_AUDIO_HARNESS__!.snapshot().state)).toBe('suspended');
  await page.evaluate(() => window.__CHAPTER_AUDIO_HARNESS__!.resume());
  expect(await page.evaluate(() => window.__CHAPTER_AUDIO_HARNESS__!.snapshot().state)).toBe('running');
  await expect.poll(() => page.evaluate(() => window.__CHAPTER_AUDIO_HARNESS__!.snapshot().activeVoices), { timeout: 6000 }).toBe(0);
  await page.evaluate(() => window.__CHAPTER_AUDIO_HARNESS__!.dispose());
  expect(await page.evaluate(() => window.__CHAPTER_AUDIO_HARNESS__!.snapshot())).toMatchObject({ state: 'disposed', activeVoices: 0 });
  expect(errors).toEqual([]);
});
