import { useCallback, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ACESFilmicToneMapping, PerspectiveCamera, Vector3 } from 'three';
import { InputManager } from '../../input/InputManager';
import type { Action } from '../../input/ActionBuffer';
import { ChapterRuntime } from '../runtime/ChapterRuntime';
import { DEFAULT_CHAPTER_SETTINGS, readChapterSettings, writeChapterSettings, type ChapterSettings } from '../experience/ChapterPersistence';
import './chapter.css';

type Snapshot = ReturnType<ChapterRuntime['snapshot']>;
type ReadySnapshot = Extract<Snapshot, { ready: true }>;
type Panel = 'settings' | 'help' | 'about' | 'observatory' | null;
type PresentationSnapshot = ReadySnapshot & {
  canObserve?: boolean; canReleaseSample?: boolean; observed?: boolean; sampleReleased?: number;
  streaming?: unknown; audio?: unknown;
};
type LoadingSnapshot = { loading?: { stage?: string; progress?: number } };

declare global {
  interface Window {
    __THRESHOLD_V02__?: () => Snapshot;
    __V02_TEST__?: {
      runtime: ChapterRuntime; snapshot: () => Snapshot; pause: (v: boolean) => void;
      step: (n: number, x: number, y: number) => void; place: (foot: number[], slot: 'A' | 'B', s?: number) => void;
      camera: (id: string) => void; look: (x: number, y: number) => void; render: () => void;
      interact: () => boolean; restart: () => void; visibility: (id: string) => unknown;
      frameVisibility: () => ReturnType<ChapterRuntime['frameVisibility']>;
    };
  }
}

function Icon({ name }: { name: 'reset' | 'settings' | 'camera' | 'sound' | 'muted' | 'help' | 'close' | 'download' }) {
  const paths = {
    reset: <><path d="M4 8a8 8 0 1 1-1 7"/><path d="M4 3v5h5"/></>,
    settings: <><path d="M4 7h16M4 17h16"/><path d="M9 4v6M15 14v6"/></>,
    camera: <><path d="M3 7h5l2-3h4l2 3h5v13H3Z"/><circle cx="12" cy="13" r="3.5"/></>,
    sound: <><path d="m11 4-5 4H2v8h4l5 4Z"/><path d="M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/></>,
    muted: <><path d="m11 4-5 4H2v8h4l5 4Z"/><path d="m16 9 6 6m0-6-6 6"/></>,
    help: <><circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 4 3c-1 .5-1 1-1 2M12 17h.01"/></>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
    download: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/></>,
  };
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function Engine({ ready, progress }: { ready: (r: ChapterRuntime | null) => void; progress: (s: Snapshot) => void }) {
  const { gl, camera, size, viewport } = useThree();
  const ref = useRef<ChapterRuntime | null>(null);
  useEffect(() => {
    gl.toneMapping = ACESFilmicToneMapping;
    gl.toneMappingExposure = 1;
    const r = new ChapterRuntime(gl, camera as PerspectiveCamera);
    ref.current = r;
    ready(r);
    const timer = setInterval(() => progress(r.snapshot()), 180);
    void r.initialize().then(() => {
      r.resize(gl.domElement.clientWidth, gl.domElement.clientHeight, gl.getPixelRatio());
      progress(r.snapshot());
    }).catch(e => { console.error(e); progress(r.snapshot()); });
    return () => { clearInterval(timer); ready(null); ref.current = null; r.dispose(); };
  }, [gl, camera, ready, progress]);
  useEffect(() => { ref.current?.resize(size.width, size.height, viewport.dpr); }, [size.width, size.height, viewport.dpr]);
  useFrame((_, dt) => ref.current?.tick(dt), 1);
  return null;
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function MotionButton({ action, label, input, active }: { action: Action; label: string; input: InputManager | null; active?: boolean }) {
  const end = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault(); event.stopPropagation(); input?.setAction(action, false, event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return <button aria-label={label} aria-pressed={active} data-action={action} onPointerDown={event => {
    event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId);
    input?.setAction(action, true, event.pointerId);
  }} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}>{label}</button>;
}

export function ChapterView() {
  const [runtime, setRuntime] = useState<ChapterRuntime | null>(null);
  const [stats, setStats] = useState<Snapshot | null>(null);
  const [preferences, setPreferences] = useState<ChapterSettings>(() => readChapterSettings());
  const preferencesRef = useRef(preferences); preferencesRef.current = preferences;
  const [debug, setDebug] = useState(new URLSearchParams(location.search).get('debug') === '1');
  const [panel, setPanel] = useState<Panel>(null);
  const [photo, setPhoto] = useState(false);
  const [toast, setToast] = useState('');
  const inputRef = useRef<InputManager | null>(null);
  const joystickRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const busyRef = useRef(false); busyRef.current = panel !== null || photo;
  const priorPause = useRef(false);
  const photoWasActive = useRef(false);
  const touch = navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches;
  const onReady = useCallback((r: ChapterRuntime | null) => setRuntime(r), []);
  const onProgress = useCallback((s: Snapshot) => setStats(s), []);
  const isReady = !!stats?.ready;
  const s = stats?.ready ? stats as PresentationSnapshot : null;
  const loading = (stats as LoadingSnapshot | null)?.loading;
  const changePreference = useCallback(<K extends keyof ChapterSettings>(key: K, value: ChapterSettings[K]) => {
    setPreferences(previous => ({ ...previous, [key]: value }));
  }, []);
  const dismissTutorial = useCallback(() => {
    if (!preferencesRef.current.tutorialSeen) changePreference('tutorialSeen', true);
  }, [changePreference]);

  useEffect(() => { writeChapterSettings(preferences); }, [preferences]);
  useEffect(() => {
    if (!runtime || !isReady) return;
    runtime.setQuality(preferences.quality);
    runtime.setSound(preferences.volume, preferences.muted);
    runtime.reducedMotion = preferences.reducedMotion;
    runtime.controller.configure(preferences);
    runtime.camera.fov = preferences.fov;
    runtime.camera.updateProjectionMatrix();
    inputRef.current?.setLookSettings(preferences);
    if (runtime.paused) runtime.tick(0);
  }, [runtime, isReady, preferences]);

  useEffect(() => {
    if (!runtime || !isReady) return;
    const input = new InputManager(runtime.gl.domElement, {
      look: (x, y) => { if (!busyRef.current) { dismissTutorial(); runtime.controller.look(x, y); } },
      reset: () => { if (!busyRef.current) runtime.controller.reset(); },
      toggleDebug: () => { setPanel(null); setDebug(v => !v); },
    }, { enhancedTouchLook: true, actions: true });
    inputRef.current = input;
    input.setLookSettings(preferencesRef.current);
    const idle = { x: 0, y: 0 };
    runtime.input = () => busyRef.current ? idle : input.frame();
    runtime.inputState = () => busyRef.current ? idle : ({ ...input.movement, ...input.actions.read() });
    window.__THRESHOLD_V02__ = () => runtime.snapshot();
    const key = (event: KeyboardEvent) => {
      const editing = event.target instanceof HTMLElement && (/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(event.target.tagName) || event.target.isContentEditable);
      if (event.code === 'Escape') {
        setPanel(null); setDebug(false); setPhoto(false); input.clear();
      }
      if (editing || event.repeat) return;
      if (/^Key[WASDEP]$/.test(event.code)) void runtime.unlockAudio().catch(() => undefined);
      if (event.code === 'KeyE' && !busyRef.current) runtime.controller.interact();
      if (event.code === 'KeyP') { event.preventDefault(); setPanel(null); setPhoto(v => !v); }
      if (event.code === 'KeyH') { event.preventDefault(); setPanel(v => v === 'help' ? null : 'help'); }
      if (/^Key[WASD]$/.test(event.code)) dismissTutorial();
    };
    const gesture = () => { void runtime.unlockAudio().catch(() => { /* User can retry from the sound control. */ }); };
    const visibility = () => { if (document.hidden) input.clear(); };
    window.addEventListener('keydown', key);
    runtime.gl.domElement.addEventListener('pointerdown', gesture);
    document.addEventListener('visibilitychange', visibility);
    const touchTimer = setInterval(() => {
      const element = joystickRef.current;
      if (element) {
        const t = input.touchState;
        element.style.setProperty('--stick-x', `${t.moveX * .48}px`);
        element.style.setProperty('--stick-y', `${t.moveY * .48}px`);
        element.dataset.active = String(t.moveActive);
      }
    }, 60);
    const q = new URLSearchParams(location.search);
    if ((import.meta.env.DEV || import.meta.env.MODE === 'e2e') && q.has('test')) {
      window.__V02_TEST__ = {
        runtime, snapshot: () => runtime.snapshot(), pause: v => { runtime.paused = v; },
        step: (n, x, y) => runtime.step(n, x, y), place: (f, slot, arc) => runtime.controller.place(new Vector3().fromArray(f), slot, arc),
        camera: id => runtime.cameraPose(id), look: (x, y) => runtime.controller.look(x, y), render: () => runtime.tick(0),
        interact: () => runtime.controller.interact(), restart: () => runtime.controller.restart(),
        visibility: id => runtime.visibility(id), frameVisibility: () => runtime.frameVisibility(),
      };
    }
    return () => {
      input.dispose(); inputRef.current = null; runtime.input = () => idle; runtime.inputState = () => idle; clearInterval(touchTimer);
      window.removeEventListener('keydown', key); document.removeEventListener('visibilitychange', visibility);
      runtime.gl.domElement.removeEventListener('pointerdown', gesture);
      delete window.__THRESHOLD_V02__; delete window.__V02_TEST__;
    };
  }, [runtime, isReady, dismissTutorial]);

  useEffect(() => {
    inputRef.current?.clear();runtime?.controller?.clearBufferedActions();
    if ((panel || photo) && document.pointerLockElement) document.exitPointerLock();
    if (!runtime) return;
    if (photo && !photoWasActive.current) {
      priorPause.current = runtime.paused; runtime.paused = true; runtime.tick(0);
    } else if (!photo && photoWasActive.current) runtime.paused = priorPause.current;
    photoWasActive.current = photo;
  }, [panel, photo, runtime]);
  useEffect(() => {
    if (!panel) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    queueMicrotask(() => panelRef.current?.querySelector<HTMLButtonElement>('button')?.focus());
    return () => { if (previous?.isConnected) previous.focus(); };
  }, [panel]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 3200); return () => clearTimeout(timer); }, [toast]);

  function downloadDiagnostics() {
    if (!runtime) return;
    saveBlob(new Blob([JSON.stringify({ version: 'THRESHOLD-ORBITAL', capturedAt: new Date().toISOString(), userAgent: navigator.userAgent, viewport: [innerWidth, innerHeight], settings: preferences, input: inputRef.current?.lookDiagnostics, snapshot: runtime.snapshot() }, null, 2)], { type: 'application/json' }), 'threshold-diagnostics.json');
  }
  function capturePhoto() {
    if (!runtime) return;
    runtime.tick(0);
    runtime.gl.domElement.toBlob(blob => {
      if (!blob) { setToast('照片暂时无法导出，请再试一次。'); return; }
      saveBlob(blob, `threshold-${new Date().toISOString().replace(/[:.]/g, '-')}.png`);
      setToast('照片已导出 · PHOTOGRAPH SAVED');
    }, 'image/png');
  }
  const panelCopy={settings:{label:'设置',eyebrow:'YOUR EXPERIENCE',title:'体验设置'},help:{label:'操作帮助',eyebrow:'FIND YOUR WAY',title:'探索，由你掌握。'},about:{label:'关于本作',eyebrow:'ABOUT THRESHOLD',title:'世界之间，一道门界。'},observatory:{label:'轨道观测台',eyebrow:'ORBITAL OBSERVATORY',title:'Aureole / 环冠'}};
  const hint = s?.returned ? '空间已回应。留步，或再次出发。' : s?.terminal ? '沿原路返回。前厅正在等待。' : s?.mode === 'WALL' ? '墙，成为了地面。沿墙前往终端。' : s?.mode === 'ARC' ? '重力正在转向。你可以停下，也可以退回。' : s?.world === 'INVERT' ? '循着弧面，寻找另一种向上。' : (s?.foot[2] ?? 33) > 22 ? '走出舱门，抵达世界的边缘。' : '绕过下沉庭院，走向门界。';
  const updateRange = (key: 'sensitivity' | 'acceleration' | 'fov' | 'volume' | 'moveSpeed' | 'jumpHeight' | 'gravityScale' | 'touchSize' | 'touchOpacity', value: string) => changePreference(key, Number(value));

  return <main className={`chapter${photo ? ' is-photo' : ''}`} onPointerDownCapture={() => { if (runtime?.ready) void runtime.unlockAudio().catch(() => undefined); }}>
    <Canvas dpr={[1, preferences.quality === 1 ? 2 : preferences.quality === .75 ? 1.5 : 1]} camera={{ fov: DEFAULT_CHAPTER_SETTINGS.fov, near: .015, far: 1500 }} gl={{ antialias: true, preserveDrawingBuffer: false, powerPreference: 'high-performance' }}>
      <Engine ready={onReady} progress={onProgress}/>
    </Canvas>
    {!photo && <>
      <header className="chapter-header"><a href="?" aria-label="THRESHOLD 门界"><span className="chapter-mark" aria-hidden="true"/>THRESHOLD <span className="chapter-chinese">门界</span></a><div className="chapter-edition">THE FIRST THRESHOLD<span>V0.3 / MOVEMENT PREVIEW</span></div></header>
      <nav className="chapter-nav" aria-label="体验控制">
        <button aria-label="声音" title={preferences.muted ? '开启声音' : '静音'} aria-pressed={!preferences.muted} onClick={() => changePreference('muted', !preferences.muted)}><Icon name={preferences.muted ? 'muted' : 'sound'}/></button>
        <button aria-label="摄影模式" title="摄影模式 / P" onClick={() => { setPanel(null); setPhoto(true); }}><Icon name="camera"/></button>
        <button aria-label="安全复位" title="安全复位 / R" onClick={() => { runtime?.controller.reset(); setToast('已返回安全位置。'); }}><Icon name="reset"/></button>
        <button aria-label="设置" title="设置" aria-expanded={panel === 'settings'} onClick={() => { setDebug(false); setPanel(v => v === 'settings' ? null : 'settings'); }}><Icon name="settings"/></button>
      </nav>
      <div className="chapter-reticle" aria-hidden="true"/>
      <footer className="chapter-footer"><div className="chapter-coordinate"><span className="chapter-dot"/>{s?.world === 'INVERT' ? '02 / INVERT' : '01 / VESTIBULE'}<i>{s?.returned ? 'RESONANCE ESTABLISHED' : 'ORBITAL STATION'}</i></div><p>{hint}</p><small>{touch ? '左侧移动 · 右侧观察' : 'WASD 移动 · 拖动观察 · 双击锁定鼠标'}<button aria-label="操作帮助" onClick={() => setPanel('help')}>操作指南 <span>↗</span></button></small></footer>
      {!preferences.tutorialSeen && isReady && !panel && <div className="chapter-first-hint" role="status"><span>{touch ? '用左手移动，用右手探索。' : '按 W 向前，按住鼠标拖动观察。'}</span><button onClick={dismissTutorial} aria-label="关闭操作提示">知道了</button></div>}
      {touch && !panel && <div className="chapter-touch" aria-hidden="true"><div className="chapter-joystick" ref={joystickRef}><span className="chapter-joystick-cross"/><i/><small>MOVE</small></div><div className="chapter-look"><span>＋</span><small>LOOK</small></div><small className="chapter-landscape">横屏体验更佳</small></div>}
      {touch && !panel && <div className="chapter-motion-controls" aria-label="移动动作" style={{ '--motion-scale': preferences.touchSize, opacity: preferences.touchOpacity } as React.CSSProperties}>
        <MotionButton action="sprint" label="冲刺" input={inputRef.current}/>
        <MotionButton action="prone" label="趴下" active={s?.stance === 'PRONE'} input={inputRef.current}/>
        <MotionButton action="brake" label="制动" input={inputRef.current}/>
        <MotionButton action="crouch" label={s?.locomotion === 'ZERO_G' ? '下降' : '蹲下'} active={s?.stance === 'CROUCH'} input={inputRef.current}/>
        <MotionButton action="jump" label={s?.locomotion === 'ZERO_G' ? '上升' : '跳跃'} input={inputRef.current}/>
      </div>}
      {s?.stanceBlocked && !panel && <div className="chapter-stance-message" role="status">{s.stanceBlocked}</div>}
      {s && !panel && <div className="chapter-actions">
        {s.interactable && <button className="chapter-interact" aria-label="激活终端" onClick={() => runtime?.controller.interact()}><span className="chapter-action-key">{touch ? '◎' : 'E'}</span>{s.terminal ? '终端已激活' : '激活终端'}</button>}
        {s.canObserve && <button className="chapter-interact secondary" aria-label="轨道观测" onClick={() => { if (runtime?.observe()) setPanel('observatory'); }}>轨道观测 <span>↗</span></button>}
        {s.canReleaseSample && <button className="chapter-interact secondary" aria-label="释放重力样本" onClick={() => { if (runtime?.releaseSample()) setToast('样本已释放。观察它的下落方向。'); }}>释放重力样本 <span>↗</span></button>}
      </div>}
    </>}

    {(!runtime?.ready || !isReady) && <div className="chapter-loading" role="status" aria-live="polite"><div className="chapter-loading-mark"/><span className="chapter-eyebrow">THE FIRST THRESHOLD</span><h1>Between worlds.</h1><p>{runtime?.error ?? loading?.stage ?? '正在准备轨道空间'}</p><div className="chapter-progress" role="progressbar" aria-label="场景加载" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((loading?.progress ?? 0) * 100)}><i style={{ width: `${Math.round((loading?.progress ?? 0) * 100)}%` }}/></div><small>{runtime?.error ? '资源未能完成加载' : '建筑 · 光线 · 物理空间'}</small>{runtime?.error && <button onClick={() => location.reload()}>重新载入</button>}</div>}

    {panel && <div className="chapter-panel-shade" onPointerDown={event => { if (event.target === event.currentTarget) setPanel(null); }}><aside ref={panelRef} className="chapter-panel" onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button,input,select,a[href]')).filter(element => !element.hasAttribute('disabled'));
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }} role="dialog" aria-modal="true" aria-label={panelCopy[panel].label} onPointerDown={event => event.stopPropagation()}>
      <div className="chapter-panel-head"><div><span className="chapter-eyebrow">{panelCopy[panel].eyebrow}</span><h2>{panelCopy[panel].title}</h2></div><button className="chapter-close" aria-label={'关闭'+panelCopy[panel].label} onClick={() => setPanel(null)}><Icon name="close"/></button></div>
      <div className="chapter-panel-body">
        {panel === 'settings' && <>
          <section className="chapter-setting-section"><h3>移动与重力 / GRAVITY FREEDOM</h3>
            <label className="chapter-select">体验档案<select aria-label="体验档案" value={preferences.profile} onChange={e => changePreference('profile', e.target.value as ChapterSettings['profile'])}><option value="explore">建筑探索</option><option value="experiment">自由实验</option></select></label>
            <label className="chapter-range"><span>基础速度 <output>{preferences.moveSpeed.toFixed(1)} m/s</output></span><input aria-label="基础速度" type="range" min="1.5" max="7" step=".1" value={preferences.moveSpeed} onChange={e => updateRange('moveSpeed', e.target.value)}/></label>
            <label className="chapter-range"><span>1g 标称跳高 <output>{preferences.jumpHeight.toFixed(1)} m</output></span><input aria-label="标称跳高" type="range" min=".3" max="3" step=".1" disabled={preferences.profile !== 'experiment'} value={preferences.jumpHeight} onChange={e => updateRange('jumpHeight', e.target.value)}/></label>
            <label className="chapter-range"><span>重力倍率 <output>{preferences.gravityScale.toFixed(2)} g</output></span><input aria-label="重力倍率" type="range" min="0" max="2" step=".01" disabled={preferences.profile !== 'experiment'} value={preferences.gravityScale} onChange={e => updateRange('gravityScale', e.target.value)}/></label>
            <p className="chapter-setting-note">建筑探索跟随空间重力。自由实验可调整跳高与重力；0g 时使用上升、下降和制动。</p>
            <label className="chapter-toggle">自动冲刺 <input aria-label="自动冲刺" type="checkbox" checked={preferences.autoSprint} onChange={e => changePreference('autoSprint', e.target.checked)}/></label>
            <label className="chapter-range"><span>触控按钮大小 <output>{preferences.touchSize.toFixed(1)}×</output></span><input aria-label="触控按钮大小" type="range" min=".8" max="1.5" step=".1" value={preferences.touchSize} onChange={e => updateRange('touchSize', e.target.value)}/></label>
            <label className="chapter-range"><span>触控按钮透明度 <output>{Math.round(preferences.touchOpacity * 100)}%</output></span><input aria-label="触控按钮透明度" type="range" min=".3" max="1" step=".1" value={preferences.touchOpacity} onChange={e => updateRange('touchOpacity', e.target.value)}/></label>
          </section>
          <section className="chapter-setting-section"><h3>观察 / LOOK</h3>
            <label className="chapter-range"><span>视角灵敏度 <output>{preferences.sensitivity.toFixed(1)}×</output></span><input aria-label="视角灵敏度" type="range" min=".5" max="3" step=".1" value={preferences.sensitivity} onChange={e => updateRange('sensitivity', e.target.value)}/></label>
            <label className="chapter-range"><span>转向加速 <output>{preferences.acceleration === 0 ? '关闭' : `${preferences.acceleration.toFixed(1)}×`}</output></span><input aria-label="转向加速" type="range" min="0" max="1" step=".1" value={preferences.acceleration} onChange={e => updateRange('acceleration', e.target.value)}/></label>
            <p className="chapter-setting-note">慢滑精准，快滑转身。加速作用于触屏视角。</p>
            <label className="chapter-toggle">反转纵轴 <input aria-label="反转纵轴" type="checkbox" checked={preferences.invertY} onChange={e => changePreference('invertY', e.target.checked)}/></label>
            <label className="chapter-range"><span>视野 <output>{Math.round(preferences.fov)}°</output></span><input aria-label="视野" type="range" min="45" max="85" step="1" value={preferences.fov} onChange={e => updateRange('fov', e.target.value)}/></label>
          </section>
          <section className="chapter-setting-section"><h3>画面与声音 / ATMOSPHERE</h3>
            <label className="chapter-select">画面质量<select aria-label="画面质量" value={preferences.quality} onChange={e => changePreference('quality', Number(e.target.value) as ChapterSettings['quality'])}><option value="1">最高</option><option value={.75}>平衡</option><option value={.4}>节能</option></select></label>
            <label className="chapter-toggle">减少镜头运动 <input aria-label="减少镜头运动" type="checkbox" checked={preferences.reducedMotion} onChange={e => changePreference('reducedMotion', e.target.checked)}/></label>
            <label className="chapter-range"><span>音量 <output>{Math.round(preferences.volume * 100)}%</output></span><input aria-label="音量" type="range" min="0" max="1" step=".05" value={preferences.volume} onChange={e => updateRange('volume', e.target.value)}/></label>
            <label className="chapter-toggle">静音 <input aria-label="静音" type="checkbox" checked={preferences.muted} onChange={e => changePreference('muted', e.target.checked)}/></label>
          </section>
          <div className="chapter-panel-links"><button aria-label="操作帮助" onClick={() => setPanel('help')}>操作帮助 <span>↗</span></button><button aria-label="关于本作" onClick={() => setPanel('about')}>关于本作 <span>↗</span></button><button onClick={() => { setPanel(null); setDebug(true); }}>诊断 <span>↗</span></button><button onClick={() => { runtime?.controller.restart(); setPanel(null); }}>返回章节起点 <span>↗</span></button>{(import.meta.env.DEV || import.meta.env.MODE === 'e2e') && <button aria-label="碰撞几何" onClick={() => { if (runtime?.debugGeometry) runtime.debugGeometry.enabled = !runtime.debugGeometry.enabled; }}>碰撞几何 <span>↗</span></button>}</div>
        </>}
        {panel === 'observatory' && <><p className="chapter-panel-intro">环冠的日夜分界缓缓移动。站在舷窗前，沿轨道设施望向远处的星环。</p><div className="chapter-help-card"><span>AUREOLE · PELAGIC · SELENE</span><p>巨行星与星环位于前厅左上方；深蓝色的 Pelagic 在右侧远空，静月 Selene 悬在舱体后方。你所处的是一座悬浮的轨道观测站。</p></div><dl className="chapter-controls"><div><dt>天体</dt><dd>11 个三维天体</dd></div><div><dt>观测</dt><dd>行星自转、日夜分界、星环阴影</dd></div><div><dt>位置</dt><dd>艺术化轨道构图，非真实太阳系比例</dd></div></dl><button className="chapter-primary" onClick={()=>setPanel(null)}>返回舷窗 <span>→</span></button></>}
        {panel === 'help' && <><p className="chapter-panel-intro">慢慢走，抬头看。这个空间允许你随时停下、回头，再次穿过门界。</p><dl className="chapter-controls"><div><dt>移动</dt><dd>{touch ? '屏幕左侧摇杆' : 'W A S D / 方向键'}</dd></div><div><dt>观察</dt><dd>{touch ? '屏幕右侧滑动，快滑可加速' : '按住鼠标拖动 / 双击锁定'}</dd></div><div><dt>互动</dt><dd>{touch ? '点按出现的操作按钮' : 'E / 点击操作按钮'}</dd></div><div><dt>安全复位</dt><dd>{touch ? '右上角 ↺' : 'R / 右上角 ↺'}</dd></div><div><dt>动作</dt><dd>{touch ? '右下方跳跃 / 蹲下 / 趴下 / 冲刺' : 'Space 跳跃 · Shift 冲刺 · Ctrl 蹲 · Z 趴'}</dd></div><div><dt>失重</dt><dd>{touch ? '上升 / 下降 / 制动按钮' : 'Space 上升 · Ctrl 下降 · X 制动'}</dd></div><div><dt>摄影</dt><dd>{touch ? '右上角相机' : 'P / 右上角相机'}</dd></div><div><dt>关闭面板</dt><dd>{touch ? '面板右上角 ×' : 'Esc / 面板右上角 ×'}</dd></div></dl><div className="chapter-help-card"><span>01 → 02 → 01</span><p>走出轨道舱，绕过庭院，穿越门界。循弧面站上墙壁，激活终端，再沿原路返回。</p></div><button className="chapter-primary" onClick={() => { dismissTutorial(); setPanel(null); }}>继续探索 <span>→</span></button></>}
        {panel === 'about' && <><p className="chapter-panel-intro">THRESHOLD / 门界是一件实时空间作品。在悬浮的建筑中，观察另一侧的世界，跨过门，重新认识「向上」。</p><div className="chapter-about-title">A quiet encounter<br/>with impossible space.</div><p className="chapter-setting-note">门内画面实时渲染。穿越保留真实位置与方向；弧面上的身体、碰撞与重力同步转向。</p><section className="chapter-credits"><h3>制作与资源 / CREDITS</h3><p>定制建筑、轨道装置、实时传送与局部重力系统。</p><p>行星贴图：<a href="https://www.solarsystemscope.com/textures/" target="_blank" rel="noreferrer">Solar System Scope</a> · CC BY 4.0。材质及其他第三方资源的具体使用记录见工程资产清单。</p><a href="https://github.com/jiangjinzhou01-ctrl/expert-disco/tree/threshold-v02" target="_blank" rel="noreferrer">查看工程与制作记录 ↗</a></section><button className="chapter-primary" onClick={() => setPanel(null)}>返回空间 <span>→</span></button></>}
      </div>
    </aside></div>}

    {debug && s && !photo && <aside className="chapter-debug" data-testid="chapter-diagnostics" aria-label="运行诊断" onPointerDown={event => event.stopPropagation()}><div className="chapter-debug-head"><div><span className="chapter-eyebrow">LIVE TELEMETRY</span><b>{s.world}</b></div><button className="chapter-close" aria-label="关闭诊断" onClick={() => setDebug(false)}><Icon name="close"/></button></div><div className="chapter-debug-summary"><span>FPS<b>{s.performance.fps.toFixed(1)}</b></span><span>P95<b>{s.performance.p95Ms.toFixed(1)}<small>ms</small></b></span><span>EVENT<b>{s.events.at(-1)?.id ?? 0}</b></span></div><details><summary>详细运行数据</summary><pre>{JSON.stringify({ position: s.foot, up: s.up, gravity: s.gravity, mode: s.mode, stance: s.stance, locomotion: s.locomotion, field: s.fieldId, stanceBlocked: s.stanceBlocked, movement: s.movement, theta: s.thetaDegrees, step: s.step, portal: s.transferState, blocked: s.blocked, rejection: s.rejection, draws: [s.render.mainDrawCalls, s.render.offscreenDrawCalls], target: [s.render.targetWidth, s.render.targetHeight], resources: [s.render.geometries, s.render.textures, s.render.programs], streaming: s.streaming, audio: s.audio, context: s.render.context, GPU: 'N/A', errors: s.errors }, null, 2)}</pre></details><button className="chapter-debug-export" onClick={downloadDiagnostics}><Icon name="download"/>导出诊断</button></aside>}

    {photo && <div className="chapter-photo"><div className="chapter-photo-label">THRESHOLD <span>PHOTOGRAPH MODE</span></div><div className="chapter-photo-frame" aria-hidden="true"/><div className="chapter-photo-toolbar"><label>视野 <input aria-label="摄影视野" type="range" min="45" max="85" value={preferences.fov} onChange={e => updateRange('fov', e.target.value)}/><output>{Math.round(preferences.fov)}°</output></label><button aria-label="导出照片" onClick={capturePhoto}><Icon name="download"/>导出照片</button><button aria-label="退出摄影模式" onClick={() => setPhoto(false)}><Icon name="close"/>返回探索</button></div></div>}
    {toast && <div className="chapter-toast" role="status">{toast}</div>}
  </main>;
}
