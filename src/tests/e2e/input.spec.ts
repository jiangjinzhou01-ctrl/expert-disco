import { expect, test, type CDPSession, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

test.use({ viewport: { width: 900, height: 600 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });

interface TouchPoint { id: number; x: number; y: number }

/** Real Chromium contacts exercise Pointer Events and native pointer capture. */
class TouchDriver {
  private contacts = new Map<number, TouchPoint>();
  constructor(private readonly session: CDPSession) {}
  private async dispatch(type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel') {
    await this.session.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: [...this.contacts.values()].map(point => ({ ...point, radiusX: 3, radiusY: 3, force: 1 })),
    });
    if (type === 'touchMove') {
      // Chromium coalesces multi-contact pointermove until the next animation frame.
      await this.session.send('Runtime.evaluate', { expression: 'new Promise(resolve => requestAnimationFrame(resolve))', awaitPromise: true });
    }
  }
  async start(id: number, x: number, y: number) {
    this.contacts.set(id, { id, x, y });
    await this.dispatch('touchStart');
  }
  async move(id: number, x: number, y: number) {
    if (!this.contacts.has(id)) throw new Error(`Unknown touch contact ${id}`);
    this.contacts.set(id, { id, x, y });
    await this.dispatch('touchMove');
  }
  async end(id: number) {
    this.contacts.delete(id);
    await this.dispatch('touchEnd');
  }
  async cancel() {
    this.contacts.clear();
    await this.dispatch('touchCancel');
  }
}

async function ready(page: Page) {
  await page.goto('/?test=1');
  await page.waitForFunction(() => window.__THRESHOLD__?.snapshot().ready === true);
  await page.evaluate(() => window.__THRESHOLD__!.pause(true));
  await page.addStyleTag({ content: '.diag,.debug-overlay{display:none!important}' });
  return new TouchDriver(await page.context().newCDPSession(page));
}

async function step(page: Page, count: number) {
  return page.evaluate(count => {
    const api = window.__THRESHOLD__!;
    for (let frame = 0; frame < count; frame += 1) api.advance(1 / 60);
    api.render();
    return api.snapshot();
  }, count);
}

test('mobile uses distinct captured pointer IDs for simultaneous movement and look, with cancellation', async ({ page }, testInfo) => {
  const touch = await ready(page);
  await page.evaluate(() => {
    const pointers: { id: number; x: number }[] = [];
    Reflect.set(window, '__inputTestPointers', pointers);
    document.querySelector('canvas')!.addEventListener('pointerdown', event => {
      const pointer = event as PointerEvent;
      pointers.push({ id: pointer.pointerId, x: pointer.clientX });
    });
  });
  const before = await page.evaluate(() => window.__THRESHOLD__!.snapshot());
  await touch.start(11, 150, 450);
  await touch.move(11, 150, 392);
  await touch.start(22, 800, 300);
  await touch.move(22, 740, 320);
  const during = await step(page, 12);
  const pointers = await page.evaluate(() => Reflect.get(window, '__inputTestPointers') as { id: number; x: number }[]);
  expect(during.position[2]).toBeLessThan(before.position[2] - 0.3);
  expect(Math.abs(during.yaw - before.yaw), JSON.stringify({ input: during.input, pointers })).toBeGreaterThan(0.05);
  expect(Math.abs(during.pitch - before.pitch)).toBeGreaterThan(0.01);
  expect(during.rotation).not.toEqual(before.rotation);
  expect(pointers).toHaveLength(2);
  expect(new Set(pointers.map(pointer => pointer.id)).size).toBe(2);
  const rightId = pointers.find(pointer => pointer.x > 450)!.id;
  const leftId = pointers.find(pointer => pointer.x < 450)!.id;
  const captured = await page.locator('canvas').evaluate((canvas, ids) => ids.map(id => canvas.hasPointerCapture(id)), [leftId, rightId]);
  expect(captured).toEqual([true, true]);
  await page.locator('canvas').evaluate((canvas, pointerId) => canvas.dispatchEvent(new PointerEvent('pointercancel', { pointerId, pointerType: 'touch', bubbles: true })), rightId);
  const leftContinues = await step(page, 6);
  expect(leftContinues.position[2]).toBeLessThan(during.position[2] - 0.15);
  expect(leftContinues.yaw).toBe(during.yaw);
  await page.locator('canvas').evaluate((canvas, pointerId) => canvas.dispatchEvent(new PointerEvent('pointercancel', { pointerId, pointerType: 'touch', bubbles: true })), leftId);
  const stopped = await step(page, 12);
  expect(Math.hypot(stopped.position[0] - leftContinues.position[0], stopped.position[2] - leftContinues.position[2])).toBeLessThan(0.002);
  await touch.cancel();
  expect(await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }))).toEqual({ x: 0, y: 0 });
  await writeFile('evidence/mobile-multitouch.json', JSON.stringify({ before, during, leftContinues, stopped, pointers, captured }, null, 2));
  await testInfo.attach('mobile-multitouch', { body: JSON.stringify({ pointers, captured, during, stopped }, null, 2), contentType: 'application/json' });
});

for (const interruption of ['blur', 'orientationchange', 'visibilitychange'] as const) {
  test(`mobile ${interruption} clears held movement and allows a fresh contact`, async ({ page }) => {
    const touch = await ready(page);
    await touch.start(1, 150, 450);
    await touch.move(1, 150, 392);
    const moving = await step(page, 6);
    await page.evaluate(event => {
      if (event === 'visibilitychange') {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        document.dispatchEvent(new Event('visibilitychange'));
        Reflect.deleteProperty(document, 'hidden');
      } else window.dispatchEvent(new Event(event));
    }, interruption);
    const stopped = await step(page, 12);
    expect(Math.hypot(stopped.position[0] - moving.position[0], stopped.position[2] - moving.position[2])).toBeLessThan(0.002);
    await touch.cancel();
    await touch.start(2, 150, 450);
    await touch.move(2, 150, 392);
    const resumed = await step(page, 6);
    expect(resumed.position[2]).toBeLessThan(stopped.position[2] - 0.15);
    await touch.end(2);
  });
}

test('mobile touch controls traverse A → B, turn around, return, and reset the real capsule', async ({ page }) => {
  const touch = await ready(page);
  await page.evaluate(() => window.__THRESHOLD__!.setPose([0, 0.89, -7.3]));
  await touch.start(1, 150, 450);
  await touch.move(1, 150, 392);
  const outbound = await step(page, 40);
  await touch.end(1);
  expect(outbound.worldId).toBe('B');
  expect(outbound.lastEventId).toBe(1);
  expect(outbound.position[0]).toBeGreaterThan(32.4);
  expect(outbound.transferState).toBe('ARMED');
  await page.screenshot({ path: 'evidence/mobile-landscape.png' });
  // Four physical right-zone swipes supply pi radians without setting the camera pose.
  const distances = [400, 400, 400, Math.PI / 0.0025 - 1200];
  for (let index = 0; index < distances.length; index += 1) {
    await touch.start(10 + index, 850, 300);
    await touch.move(10 + index, 850 - distances[index]!, 300);
    await touch.end(10 + index);
  }
  const turned = await page.evaluate(() => window.__THRESHOLD__!.snapshot());
  expect(Math.cos(turned.yaw - Math.PI / 2)).toBeGreaterThan(0.999);
  await touch.start(2, 150, 450);
  await touch.move(2, 150, 392);
  const inbound = await step(page, 40);
  await touch.end(2);
  expect(inbound.worldId).toBe('A');
  expect(inbound.lastEventId).toBe(2);
  expect(inbound.events.map(event => event.id)).toEqual([1, 2]);
  expect(inbound.position.every(Number.isFinite)).toBe(true);
  expect(inbound.position[2]).toBeGreaterThan(-8);
  await page.locator('canvas').screenshot({ path: 'evidence/mobile-returned-A.png' });
  await page.getByRole('button', { name: '重置位置' }).tap();
  const reset = await page.evaluate(() => window.__THRESHOLD__!.snapshot());
  expect(reset.worldId).toBe('A');
  expect(reset.position[2]).toBeCloseTo(-3, 4);
  expect(reset.velocity).toEqual([0, 0, 0]);
  await page.setViewportSize({ width: 600, height: 900 });
  await expect.poll(() => page.evaluate(() => {
    const render = window.__THRESHOLD__!.snapshot().render;
    return render.targetWidth / render.targetHeight;
  })).toBeCloseTo(2 / 3, 2);
  await page.screenshot({ path: 'evidence/mobile-portrait.png' });
  const portrait = await page.evaluate(() => window.__THRESHOLD__!.snapshot());
  expect(portrait.render.context).toBe('active');
  expect(portrait.render.offscreenDrawCalls).toBeGreaterThan(0);
  await writeFile('evidence/mobile-bidirectional.json', JSON.stringify({ environment: 'Chromium CDP touch emulation; no physical mobile device', outbound, turned, inbound, reset, portrait }, null, 2));
});
