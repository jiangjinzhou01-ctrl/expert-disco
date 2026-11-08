import assert from 'node:assert/strict';
import console from 'node:console';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import { chromium } from '@playwright/test';

// A small independent harness: no Chapter scene, physics, or competing game loop.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const threeRoot = resolve(dirname(fileURLToPath(import.meta.resolve('three'))), '..');
const port = Number(process.env.KTX_VERIFY_PORT || 5140);
const output = resolve(root, 'evidence/orbital');
const html = `<!doctype html><html><head><meta charset="utf-8"><title>KTX2 GPU decode verification</title>
<script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script></head><body style="margin:0;background:#171b22">
<script type="module">
import * as THREE from 'three';
import {KTX2Loader} from 'three/addons/loaders/KTX2Loader.js';
const renderer=new THREE.WebGLRenderer({antialias:false,preserveDrawingBuffer:true});renderer.setSize(192,192);renderer.setPixelRatio(1);document.body.append(renderer.domElement);
const loader=new KTX2Loader().setTranscoderPath('/assets/basis/').setWorkerLimit(2).detectSupport(renderer);
const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1.5,1.5,1.5,-1.5,.1,10);camera.position.z=2;
const geometry=new THREE.PlaneGeometry(.94,.94),textures=[],materials=[],records=[];
try{
const manifest=await fetch('/assets/orbital/materials/compression-manifest.json').then(r=>r.json());
for(let index=0;index<manifest.textures.length;index++){
 const source=manifest.textures[index],texture=await loader.loadAsync('/assets/orbital/materials/'+source.file);textures.push(texture);
 const formatName=Object.entries(THREE).find(([key,value])=>key.endsWith('Format')&&value===texture.format)?.[0]||String(texture.format);
 const material=new THREE.MeshBasicMaterial({map:texture,toneMapped:false});materials.push(material);const plane=new THREE.Mesh(geometry,material);plane.position.set(index%3-1,1-Math.floor(index/3),0);scene.add(plane);
 const payloadBytes=texture.mipmaps.reduce((sum,mip)=>sum+mip.data.byteLength,0);
 records.push({file:source.file,semantic:source.semantic,width:texture.image.width,height:texture.image.height,mipLevels:texture.mipmaps.length,colorSpace:texture.colorSpace,format:texture.format,formatName,compressed:texture.format!==THREE.RGBAFormat&&texture.format!==THREE.RGBFormat,payloadBytes,generateMipmaps:texture.generateMipmaps});
}
renderer.render(scene,camera);
const gl=renderer.getContext(),samples=[];
for(let index=0;index<records.length;index++){const rgba=new Uint8Array(4),x=(index%3)*64+32,y=(2-Math.floor(index/3))*64+32;gl.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,rgba);samples.push({file:records[index].file,rgba:[...rgba]});}
window.__ktxResult={pass:true,webgl2:gl instanceof WebGL2RenderingContext,extensions:gl.getSupportedExtensions(),records,samples,totalTranscodedPayloadBytes:records.reduce((sum,record)=>sum+record.payloadBytes,0),note:'Measured decoder mip payloads; driver GPU allocation and frame rate are not inferred.'};
}catch(error){window.__ktxResult={pass:false,error:String(error)};}
window.__disposeKTX=()=>{for(const texture of textures)texture.dispose();for(const material of materials)material.dispose();geometry.dispose();loader.dispose();renderer.dispose();};
</script></body></html>`;

const mime = { '.js': 'text/javascript', '.wasm': 'application/wasm', '.json': 'application/json', '.ktx2': 'image/ktx2' };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname === '/') { response.writeHead(200, { 'Content-Type': 'text/html' }).end(html); return; }
    const directory = pathname.startsWith('/three/') ? threeRoot : pathname.startsWith('/assets/') ? resolve(root, 'public') : null;
    const relative = pathname.startsWith('/three/') ? pathname.slice(7) : pathname.slice(1);
    const file = directory && resolve(directory, relative);
    if (!file || !file.startsWith(directory + sep)) { response.writeHead(404).end(); return; }
    response.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' }).end(await readFile(file));
  } catch { response.writeHead(404).end(); }
});
let browser;
try {
  await mkdir(output, { recursive: true });
  await new Promise((resolveListen, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolveListen); });
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 260, height: 230 }, deviceScaleFactor: 1 });
  const errors = [];page.on('pageerror', error => errors.push(String(error)));
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.waitForFunction(() => window.__ktxResult, null, { timeout: 60000 });
  const result = await page.evaluate(() => window.__ktxResult);
  assert.equal(result.pass, true, result.error);
  assert.equal(result.webgl2, true);
  assert.equal(result.records.length, 9);
  for (const texture of result.records) {
    assert.deepEqual([texture.width, texture.height, texture.mipLevels], [1024, 1024, 11]);
    assert.equal(texture.colorSpace, texture.semantic === 'albedo' ? 'srgb' : '');
    assert.equal(texture.generateMipmaps, false);
    assert(texture.payloadBytes > 0);
  }
  for (const sample of result.samples.filter(sample => sample.file.includes('-normal.'))) {
    assert(sample.rgba[2] > sample.rgba[0] + 15 && sample.rgba[2] > sample.rgba[1] + 15,
      `${sample.file} should preserve XYZ normal data rather than repack XY into RGB/A: ${sample.rgba}`);
  }
  assert.deepEqual(errors, []);
  await page.screenshot({ path: resolve(output, 'ktx2-browser.png') });
  await writeFile(resolve(output, 'ktx2-browser.json'), JSON.stringify({ ...result, browser: browser.version(), errors }, null, 2));
  await page.evaluate(() => window.__disposeKTX());
  console.log(JSON.stringify({ pass: true, maps: result.records.length, browser: browser.version(), formats: [...new Set(result.records.map(texture => texture.formatName))], allGPUCompressed: result.records.every(texture => texture.compressed), measuredMipPayloadBytes: result.totalTranscodedPayloadBytes }));
} finally {
  await browser?.close();
  await new Promise(resolveClose => server.close(resolveClose));
}
