import type { ExperienceLoop } from '../runtime/ExperienceLoop';
type Snapshot=ReturnType<ExperienceLoop['snapshot']>;
const vec=(v:number[])=>v.map(n=>n.toFixed(3)).join(' / ');
export function DebugOverlay({stats,onExport,onBounds,bounds}:{stats:Snapshot|null;onExport:()=>void;onBounds:()=>void;bounds:boolean}){
 if(!stats)return <aside className="diag">INITIALIZING WASM / WEBGL 2</aside>;
 const p=stats.performance;const r=stats.render;
 return <aside className="diag" data-testid="diagnostics"><div className="diag-title">RUNTIME TELEMETRY <span>60 Hz</span></div>
 <dl><dt>ROOM / PHASE</dt><dd>{stats.worldId} / {stats.transferState}</dd><dt>POSITION m</dt><dd>{vec(stats.position)}</dd><dt>YAW / PITCH rad</dt><dd>{stats.yaw.toFixed(3)} / {stats.pitch.toFixed(3)}</dd><dt>VELOCITY m/s</dt><dd>{vec(stats.velocity)}</dd><dt>STEP / EVENT</dt><dd>{stats.step} / #{stats.lastEventId}</dd><dt>COLLISION REGION</dt><dd>{stats.worldId} · {stats.grounded?'GROUNDED':'AIRBORNE'}</dd><dt>LINK</dt><dd>{stats.portal.source} → {stats.portal.destination}</dd><dt>PLANE DISTANCE m</dt><dd>{stats.portal.signedDistance.toFixed(4)} · cross {String(stats.portal.crossingCondition)}</dd><dt>LAST REJECTION</dt><dd>{stats.lastRejection??'—'}</dd>
 {stats.portal.poses.map(pose=><div className="pose" key={pose.id}><dt>{pose.id} POSITION / QUAT</dt><dd>{vec(pose.position)}<br/>{vec(pose.rotation)}</dd></div>)}
 <dt>FPS / FRAME avg</dt><dd>{p.fps.toFixed(1)} / {p.averageMs.toFixed(2)} ms</dd><dt>P95 / P99</dt><dd>{p.p95Ms.toFixed(2)} / {p.p99Ms.toFixed(2)} ms</dd><dt>PHYSICS / GPU</dt><dd>{p.physicsMs.toFixed(2)} ms / N/A</dd><dt>DRAWS main / portal</dt><dd>{r.mainDrawCalls} / {r.offscreenDrawCalls} · {r.passes} pass</dd><dt>RENDER TARGET</dt><dd>{r.targetWidth} × {r.targetHeight}</dd><dt>GPU geometries / textures / programs</dt><dd>{r.geometries} / {r.textures} / {r.programs}</dd><dt>WEBGL 2</dt><dd>{r.context.toUpperCase()}</dd><dt>DROPPED CATCH-UP</dt><dd>{stats.droppedSeconds.toFixed(3)} s</dd></dl>
 {stats.error&&<p role="alert">{stats.error}</p>}<div className="diag-actions"><button onClick={onExport}>导出 JSON</button>{import.meta.env.DEV&&<button onClick={onBounds}>几何 {bounds?'ON':'OFF'}</button>}</div><p className="fine">GPU 计时 N/A（未采集） · 帧时间为当前浏览器实际采样</p></aside>;
}
