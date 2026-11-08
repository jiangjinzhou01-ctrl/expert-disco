import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const label = process.argv[2] ?? 'after';
if (!/^[a-z0-9-]+$/.test(label)) throw Error('Use a simple capture label');
const directory = `evidence/atelier/${label}`;
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
const width = Number(process.env.ATELIER_WIDTH ?? 1600);
const height = Math.round(width * 9 / 16);
const evidence = { browser: browser.version(), viewport: [width, height], dpr: 1, label, views: [], errors };
try {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  page.on('pageerror', error => { errors.push(String(error)); process.stderr.write(String(error).slice(0,600)+'\n'); });
  page.on('console', message => { if (message.type() === 'error') { errors.push(message.text()); process.stderr.write(message.text().slice(0,600)+'\n'); } });
  await page.goto('http://127.0.0.1:5180/?mode=chapter&test=1');
  await page.waitForFunction(() => window.__V02_TEST__?.snapshot().ready, null, { timeout: 120000 });
  await page.evaluate(() => { window.__V02_TEST__.pause(true); window.__V02_TEST__.runtime.elapsed = 18; });
  const hint = page.getByRole('button', { name: '关闭操作提示' });
  if (await hint.isVisible()) await hint.click();
  const views = process.env.ATELIER_VIEWS?.split(',') ?? ['CAPSULE', 'ARRIVAL', 'CROSSING', 'C1', 'C2', 'C3'];
  for (const id of views) {
    await page.evaluate(async id => {
      const a = window.__V02_TEST__;
      if (id === 'CAPSULE') { a.restart(); a.look(-440, -50); }
      else if (id === 'DETAILS' || id === 'PORTAL-NEAR') {
        a.place(id === 'DETAILS' ? [8.6, 0, 13] : [1.4, 0, -18.8], 'A');
        a.runtime.controller.state.yaw = id === 'DETAILS' ? -Math.PI / 2 : Math.atan2(1.4, 1.2);
        a.runtime.controller.state.pitch = id === 'DETAILS' ? -.42 : .26;
        a.runtime.controller.updateView();
      } else a.camera(id);
      a.render(); await a.runtime.streaming.settle(); a.render();
    }, id);
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${directory}/${id}.png`, timeout: 90000 });
    if (['ARRIVAL','C2','DETAILS','PORTAL-NEAR'].includes(id)) await page.locator('canvas').screenshot({ path: `${directory}/${id}-scene.png` });
    const state = await page.evaluate(() => window.__V02_TEST__.snapshot());
    evidence.views.push({ id, state });
    process.stdout.write(`${label} ${id}: draws ${state.render.mainDrawCalls}/${state.render.offscreenDrawCalls}\n`);
  }
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${directory}/settings.png` });
  await page.getByRole('button', { name: '关于本作', exact: true }).click();
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${directory}/about.png` });
  if (errors.length) throw Error(JSON.stringify(errors));
  await writeFile(`${directory}/capture.json`, JSON.stringify(evidence, null, 2));
} finally { await writeFile(`${directory}/capture.json`, JSON.stringify(evidence, null, 2)); await browser.close(); }
