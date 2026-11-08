import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { chapterReady, chapterRead } from './v02-helpers';

test.use({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
test.setTimeout(240000);

test('atelier finishes compile on real WebGL and cover resident architecture without changing the physical frame', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await chapterReady(page);
  const views = [];
  for (const id of ['ARRIVAL', 'C2', 'C3']) {
    await page.evaluate(async id => {
      const a = window.__V02_TEST__!; a.camera(id); a.render();
      await a.runtime.streaming.settle(); a.render();
    }, id);
    const state = await chapterRead(page);
    expect(state.render.context).toBe('active'); expect(state.errors).toEqual([]);
    expect(state.materials.compressedMaps).toBe(9);
    expect(state.materials.fallbacks).toEqual([]);
    if (id === 'C3') { expect(state.mode).toBe('WALL'); expect(state.up[0]).toBeCloseTo(-1, 8); expect(state.up[1]).toBeCloseTo(0, 8); expect(state.up[2]).toBeCloseTo(0, 8); }
    views.push({ id, state });
  }
  const audit = await page.evaluate(() => {
    const a = window.__V02_TEST__!, roles: Record<string, number> = {}, unknown: string[] = [];
    let meshes = 0, mapped = 0;
    for (const bundle of Object.values(a.runtime.scenes)) bundle.scene.traverse(object => {
      const mesh = object as import('three').Mesh;
      if (!mesh.isMesh) return;
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        if (!(m as import('three').MeshStandardMaterial).isMeshStandardMaterial) continue;
        meshes++;
        const role = m.userData.finishRole as string | undefined;
        if (!role) unknown.push(`${object.name}:${m.name}`); else roles[role] = (roles[role] ?? 0) + 1;
        if ((m as import('three').MeshStandardMaterial).normalMap) mapped++;
      }
    });
    return { meshes, mapped, roles, unknown };
  });
  expect(audit.meshes).toBeGreaterThan(40); expect(audit.mapped).toBeGreaterThan(25);
  expect(audit.unknown).toEqual([]); expect(audit.roles.glass).toBeGreaterThan(0);
  expect(audit.roles.mineral).toBeGreaterThan(0); expect(errors).toEqual([]);
  await mkdir('evidence/atelier', { recursive: true });
  await writeFile('evidence/atelier/webgl-finish-audit.json', JSON.stringify({ views, audit, errors }, null, 2));
});

test('atelier interface has local fonts, readable paper panels, keyboard focus and closable diagnostics', async ({ page }) => {
  await chapterReady(page);
  await mkdir('evidence/atelier', { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('14px Manrope'))).toBe(true);
  await page.evaluate(() => window.__V02_TEST__!.pause(false));
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '设置', exact: true })).toBeVisible();
  await page.waitForTimeout(350);
  const frozen = await page.evaluate(() => ({ paused: window.__V02_TEST__!.runtime.paused, step: window.__V02_TEST__!.runtime.controller.state.step }));
  expect(frozen.paused).toBe(true);
  await page.waitForTimeout(180);
  expect(await page.evaluate(() => window.__V02_TEST__!.runtime.controller.state.step)).toBe(frozen.step);
  const panel = page.getByRole('dialog', { name: '设置', exact: true });
  const style = await panel.evaluate(el => {
    const c = getComputedStyle(el); return { color: c.color, background: c.backgroundColor };
  });
  function luminance(color: string) {
    const c = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
    return .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
  }
  const contrast = (luminance(style.background) + .05) / (luminance(style.color) + .05);
  expect(contrast).toBeGreaterThan(7);
  await expect(page.getByRole('combobox', { name: '画面质量' })).toHaveValue('1');
  await page.keyboard.press('Escape'); await expect(panel).toHaveCount(0);
  expect(await page.evaluate(() => window.__V02_TEST__!.runtime.paused)).toBe(false);
  await page.evaluate(() => window.__V02_TEST__!.pause(true));
  await page.keyboard.press('F3'); await expect(page.getByTestId('chapter-diagnostics')).toBeVisible();
  await page.getByRole('button', { name: '关闭诊断' }).click();
  await expect(page.getByTestId('chapter-diagnostics')).toHaveCount(0);
  const controls = await page.locator('.chapter-nav button').evaluateAll(elements => elements.map(el => {
    const r = el.getBoundingClientRect(); return { width: r.width, height: r.height, left: r.left, right: r.right, top: r.top, bottom: r.bottom };
  }));
  for (const r of controls) { expect(r.width).toBeGreaterThanOrEqual(44); expect(r.height).toBeGreaterThanOrEqual(44); expect(r.right).toBeLessThanOrEqual(960); }
  await writeFile('evidence/atelier/interface.json', JSON.stringify({ style, contrast, controls }, null, 2));
});

test.describe('atelier mobile controls', () => {
  test.use({ hasTouch: true, isMobile: true });
  test('largest touch controls fit narrow portrait and landscape viewports without covering the movement stick', async ({ page }) => {
    await chapterReady(page);
    await page.getByRole('button', { name: '设置', exact: true }).click();
    const size = page.getByRole('slider', { name: '触控按钮大小', exact: true });
    await size.focus(); await size.press('End'); await expect(size).toHaveValue('1.5');
    await page.getByRole('button', { name: '关闭设置', exact: true }).click();
    const records = [];
    for (const [width, height] of [[390, 844], [320, 740], [1170, 540], [1200, 540]]) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(200);
      const geometry = await page.evaluate(() => {
        const rect = (el: Element) => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
        return { stick: rect(document.querySelector('.chapter-joystick')!), actions: [...document.querySelectorAll('.chapter-motion-controls button')].map(rect) };
      });
      expect(geometry.actions).toHaveLength(5);
      for (const r of geometry.actions) {
        expect(r.width).toBeGreaterThanOrEqual(43.99); expect(r.height).toBeGreaterThanOrEqual(44);
        expect(r.left).toBeGreaterThanOrEqual(0); expect(r.right).toBeLessThanOrEqual(width);
        expect(r.top).toBeGreaterThanOrEqual(0); expect(r.bottom).toBeLessThanOrEqual(height);
        const overlap = Math.min(r.right, geometry.stick.right) > Math.max(r.left, geometry.stick.left) && Math.min(r.bottom, geometry.stick.bottom) > Math.max(r.top, geometry.stick.top);
        expect(overlap, `${width}x${height} action overlaps joystick`).toBe(false);
      }
      records.push({ width, height, ...geometry });
      if (width === 390 || width === 1170) await page.screenshot({ path: `evidence/atelier/mobile-${width}.png` });
    }
    await writeFile('evidence/atelier/mobile-layout.json', JSON.stringify({ scale: 1.5, records }, null, 2));
  });
});
