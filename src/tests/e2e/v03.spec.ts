import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { chapterReady, chapterRead } from './v02-helpers';

test.use({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 });
test.setTimeout(180000);

test('V03 keyboard actions drive actual jump and stance; preferences survive reload', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await chapterReady(page);
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('combobox', { name: '体验档案' }).selectOption('experiment');
  for (const [label, value] of [['基础速度','4.3'],['标称跳高','1.8'],['重力倍率','.33']]) {
    await page.getByRole('slider', { name: label }).fill(value!);
  }
  await page.getByRole('button', { name: '关闭设置', exact: true }).click();
  const settings = await chapterRead(page); expect(settings.movement).toMatchObject({ moveSpeed: 4.3, jumpHeight: 1.8, gravityScale: .33 });
  await page.keyboard.down('Space');
  await page.evaluate(() => window.__V02_TEST__!.runtime.advance(1 / 60));
  await page.keyboard.up('Space');
  const launch = await chapterRead(page); expect(launch.locomotion).toBe('AIRBORNE'); expect(launch.velocity[1]).toBeGreaterThan(5.7);
  await page.evaluate(() => { const r = window.__V02_TEST__!.runtime; for (let i = 0; i < 240; i++) r.advance(1 / 60); r.sync(); });
  await page.keyboard.down('ControlLeft'); await page.evaluate(() => window.__V02_TEST__!.runtime.advance(1 / 60));
  expect((await chapterRead(page)).stance).toBe('CROUCH');
  await page.keyboard.press('Escape'); await page.evaluate(() => window.__V02_TEST__!.runtime.advance(1 / 60));
  expect((await chapterRead(page)).input.crouch).toBe(false);
  await page.keyboard.up('ControlLeft');
  await page.reload(); await page.waitForFunction(() => window.__V02_TEST__?.snapshot().ready, {}, { timeout: 90000 });
  await page.evaluate(() => window.__V02_TEST__!.pause(true));
  expect((await chapterRead(page)).movement).toMatchObject({ moveSpeed: 4.3, jumpHeight: 1.8, gravityScale: .33 });
  expect(errors).toEqual([]);
  await mkdir('evidence/v03', { recursive: true });
  await writeFile('evidence/v03/keyboard.json', JSON.stringify({ settings, launch, after: await chapterRead(page), errors }, null, 2));
});

for (const width of [1170,1200]) test.describe(`V03 native three-pointer touch ${width}:540`, () => {
  test.use({ viewport: { width, height: 540 }, hasTouch: true, isMobile: true });
  test('moves, looks and jumps simultaneously; cancellation and menu clear every held action', async ({ page }) => {
    await chapterReady(page);
    const canvas = await page.locator('canvas').first().boundingBox(); expect(canvas).not.toBeNull();
    const jump = await page.getByRole('button', { name: '跳跃', exact: true }).boundingBox(); expect(jump!.width).toBeGreaterThanOrEqual(44); expect(jump!.height).toBeGreaterThanOrEqual(44);
    const session = await page.context().newCDPSession(page);
    const points = [
      { id: 11, x: 120, y: 300 },
      { id: 22, x: width * .62, y: 250 },
      { id: 33, x: jump!.x + jump!.width / 2, y: jump!.y + jump!.height / 2 },
    ];
    const initial = await chapterRead(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points });
    points[0]!.y -= 40; points[1]!.x += 65;
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points });
    await page.evaluate(() => window.__V02_TEST__!.runtime.advance(1 / 60));
    const active = await chapterRead(page);
    expect(active.input.y).toBeGreaterThan(.5); expect(active.input.jump).toBe(true);
    expect(Math.abs(active.yaw - initial.yaw)).toBeGreaterThan(.01); expect(active.locomotion).toBe('AIRBORNE');
    await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    const cancelled = await chapterRead(page); expect(cancelled.input).toMatchObject({ x: 0, y: 0, jump: false, sprint: false, crouch: false });
    await page.getByRole('button', { name: '设置', exact: true }).tap();
    await page.getByRole('button', { name: '关闭设置', exact: true }).tap();
    expect((await chapterRead(page)).input.jump).toBe(false);
    await page.evaluate(() => window.__V02_TEST__!.render());
    await mkdir('evidence/v03', { recursive: true });
    await page.screenshot({ path: `evidence/v03/touch-${width}.png`, timeout: 90000 });
    await writeFile(`evidence/v03/touch-${width}.json`, JSON.stringify({ initial, active, cancelled }, null, 2));
    await session.detach();
  });
});
