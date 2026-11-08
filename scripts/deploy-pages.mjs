/** Explicit deployment command for this repository's branch-based Pages setting.
 * Source stays on threshold-v02; main receives only an actual verified dist tree.
 * Normal fast-forward push rejects concurrent remote changes. No force push.
 */
import {execFileSync} from 'node:child_process';
import {mkdtempSync,cpSync,writeFileSync,existsSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import console from 'node:console';
const source=resolve(fileURLToPath(new URL('..',import.meta.url)));
const git=(args,cwd=source)=>execFileSync('git',args,{cwd,encoding:'utf8'}).trim();
if(git(['status','--porcelain']))throw Error('Commit the reviewed source and evidence before publishing.');
const remote=git(['remote','get-url','origin']);
if(!/^https:\/\/github\.com\/jiangjinzhou01-ctrl\/expert-disco(?:\.git)?$/.test(remote))throw Error('This command is scoped to the explicitly authorized expert-disco repository.');
execFileSync('npm',['run','build'],{cwd:source,stdio:'inherit'});
if(!existsSync(join(source,'dist/index.html')))throw Error('Production build missing');
const revision=git(['rev-parse','HEAD']);
git(['fetch','origin','main']);
const temporary=mkdtempSync(join(tmpdir(),'threshold-pages-'));
git(['worktree','add','--detach',temporary,'origin/main']);
try{
 git(['rm','-r','--ignore-unmatch','.'],temporary);
 cpSync(join(source,'dist'),temporary,{recursive:true});
 if(!existsSync(join(temporary,'index.html'))||readFileSync(join(temporary,'index.html'),'utf8').includes('/src/main.tsx'))throw Error('Only a compiled production entry may be published');
 writeFileSync(join(temporary,'.nojekyll'),'');
 writeFileSync(join(temporary,'DEPLOYMENT.json'),JSON.stringify({project:'THRESHOLD Orbital',sourceRevision:revision,sourceBranch:'threshold-v02',builtAt:new Date().toISOString()},null,2)+'\n');
 git(['add','--all'],temporary);
 if(!git(['diff','--cached','--stat'],temporary))throw Error('No production changes');
 git(['commit','-m',`Publish THRESHOLD Orbital ${revision.slice(0,8)}`],temporary);
 git(['push','origin','HEAD:main'],temporary);
 console.log('Published compiled production tree. Check Pages deployment and verify the live browser.');
 console.log('https://jiangjinzhou01-ctrl.github.io/expert-disco/');
}finally{git(['worktree','remove',temporary]);}
