import { Vector3 } from 'three';
import { useCallback,useEffect,useState } from 'react';
import { Experience } from './Experience';
import { DebugOverlay } from '../engine/diagnostics/DebugOverlay';
import { InputManager } from '../input/InputManager';
import type { ExperienceLoop } from '../engine/runtime/ExperienceLoop';
import './app.css';
declare global { interface Window {
 __THRESHOLD_DIAGNOSTICS__?:()=>ReturnType<ExperienceLoop['snapshot']>;
 __THRESHOLD__?:{runtime:ExperienceLoop;step:(frames:number,velocity?:number[])=>void;advance:(delta:number,velocity?:number[])=>number;setExitBlocked:(blocked:boolean)=>void;reset:()=>void;snapshot:()=>ReturnType<ExperienceLoop['snapshot']>;setPose:(p:number[],yaw?:number,pitch?:number,world?:'A'|'B')=>void;pause:(value:boolean)=>void;projectMarkers:()=>unknown;render:()=>void;look:(x:number,y:number)=>void};
} }
export function LabApp(){
 const [runtime,setRuntime]=useState<ExperienceLoop|null>(null);const [stats,setStats]=useState<ReturnType<ExperienceLoop['snapshot']>|null>(null);
 const [debug,setDebug]=useState(new URLSearchParams(location.search).get('debug')==='1');const [bounds,setBounds]=useState(false);const [quality,setQuality]=useState(.85);
 const [touch]=useState(navigator.maxTouchPoints>0||matchMedia('(pointer:coarse)').matches);
 const onReady=useCallback((r:ExperienceLoop|null)=>setRuntime(r),[]);
 useEffect(()=>{if(!runtime)return;
  const input=new InputManager(runtime.gl.domElement,{look:(x,y)=>runtime.look(x,y),reset:()=>runtime.reset(),toggleDebug:()=>setDebug(v=>!v)});runtime.input=()=>input.movement;runtime.inputDiagnostics=()=>({movement:{...input.movement},touchState:{...input.touchState},touch:input.touch});
  const id=setInterval(()=>setStats(runtime.snapshot()),250);
  if((import.meta.env.DEV||import.meta.env.MODE==='e2e')&&new URLSearchParams(location.search).has('test'))window.__THRESHOLD__={runtime,step:(frames,velocity)=>runtime.stepFrames(frames,velocity),advance:(delta,velocity)=>runtime.advance(delta,velocity?new Vector3().fromArray(velocity):undefined),setExitBlocked:blocked=>runtime.physics?.setExitBlocked(blocked),reset:()=>runtime.reset(),snapshot:()=>runtime.snapshot(),setPose:(...args)=>runtime.setPose(...args),pause:v=>{runtime.paused=v;},projectMarkers:()=>runtime.portalRenderer.projectMarkers(runtime.state.worldId),render:()=>runtime.tick(0),look:(x,y)=>runtime.look(x,y)};
  return()=>{input.dispose();clearInterval(id);delete window.__THRESHOLD__;};
 },[runtime]);
 useEffect(()=>{if(debug&&runtime)window.__THRESHOLD_DIAGNOSTICS__=()=>runtime.snapshot();else delete window.__THRESHOLD_DIAGNOSTICS__;return()=>{delete window.__THRESHOLD_DIAGNOSTICS__;};},[debug,runtime]);
 function exportDiagnostics(){if(!runtime)return;const report={schema:'threshold-g0-diagnostics-v1',capturedAt:new Date().toISOString(),environment:{userAgent:navigator.userAgent,viewport:[innerWidth,innerHeight],dpr:devicePixelRatio},snapshot:runtime.snapshot()};const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`threshold-g0-${Date.now()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function updateQuality(value:number){setQuality(value);runtime?.resize(runtime.gl.domElement.clientWidth,runtime.gl.domElement.clientHeight,runtime.gl.getPixelRatio(),value);}
 return <main data-room={stats?.worldId??'loading'}><Experience onReady={onReady}/>
 <header><span className="brand">THRESHOLD <b>/ G0</b></span><span className="status">{stats?.worldId==='B'?'02 · WARM CHAMBER':'01 · COLD CHAMBER'}</span></header>
 <nav className="toolbar"><button aria-label="重置位置" onClick={()=>runtime?.reset()}>↺ <span>RESET</span></button><button aria-label="切换诊断" aria-pressed={debug} onClick={()=>setDebug(v=>!v)}>F3 <span>DATA</span></button><label>RT <select aria-label="渲染质量" value={quality} onChange={e=>updateQuality(Number(e.target.value))}><option value={1}>100%</option><option value={.85}>85%</option><option value={.5}>50%</option><option value={.25}>25%</option></select></label></nav>
 <div className="crosshair"/>
 <section className="help"><h1>门界 <em>Spatial continuity lab</em></h1><p>{touch?'左侧摇杆移动 · 右侧滑动观察 · 转身可返回':'WASD 移动 · 拖动观察 / 双击锁定 · Esc 释放 · R 重置'}</p><span className="connection">LIVE LINK <i/> A ⇄ B · {stats?.ready?'SIMULATION ONLINE':'INITIALIZING WASM'}</span></section>
 {touch&&<div className="touch-controls" aria-hidden="true"><div className="stick"><div/>MOVE</div><div className="look-zone">＋<br/>LOOK</div><span className="landscape-hint">建议横屏操作</span></div>}
 {debug&&<DebugOverlay stats={stats} onExport={exportDiagnostics} bounds={bounds} onBounds={()=>{setBounds(v=>!v);runtime?.setDebugGeometry(!bounds);}}/>}
 {stats?.error&&<div className="fatal" role="alert">{stats.error}</div>}
 </main>;
}
