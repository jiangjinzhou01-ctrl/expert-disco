import { execFileSync } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, basename } from 'node:path';

const dirty = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim();
if (dirty) throw new Error('Commit the delivery source and evidence before packaging. The ZIP must identify a clean, reproducible source revision.');
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const branch = execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim();
const output = resolve(process.argv[2] ?? '../THRESHOLD-V03-stage1-source.zip');
if (!output.endsWith('.zip')) throw new Error('Source package path must end with .zip');
execFileSync('git', ['archive', '--format=zip', '--prefix=threshold-v03/', '--output=' + output, revision]);
const hash = createHash('sha256');
for await (const chunk of createReadStream(output)) hash.update(chunk);
const sha256 = hash.digest('hex');
const bytes = (await stat(output)).size;
await writeFile(output + '.sha256', sha256 + '  ' + basename(output) + '\n');
await writeFile(output + '.json', JSON.stringify({ revision, branch, bytes, sha256,
  includes: 'All committed sources, lockfile, source Blender assets, browser assets, tests, documentation and evidence.',
  excludes: 'node_modules, Git internals and ignored build output; run npm ci && npm run build to reproduce dist.',
}, null, 2) + '\n');
console.log(JSON.stringify({ output, revision, branch, bytes, sha256 }, null, 2));
