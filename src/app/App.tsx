import {lazy,Suspense} from 'react';
const Lab=lazy(()=>import('./LabApp').then(m=>({default:m.LabApp})));
const Chapter=lazy(()=>import('../chapter/ui/ChapterView').then(m=>({default:m.ChapterView})));
export function App(){const query=new URLSearchParams(location.search);const lab=query.get('mode')==='lab'||(!query.has('mode')&&query.has('test'));return <Suspense fallback={<div className="chapter-loading">THRESHOLD · 开启空间</div>}>{lab?<Lab/>:<Chapter/>}</Suspense>;}
