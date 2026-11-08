/** Locally authored procedural sound; no remote media requests, autoplay, or separate frame loop. */
export type AudioVector = readonly [number, number, number];
export interface ChapterAudioFrame {
  slot: 'A' | 'B';
  foot: AudioVector;
  eye: AudioVector;
  forward: AudioVector;
  up: AudioVector;
  speed: number;
  grounded: boolean;
  mode: 'NORMAL' | 'ARC' | 'WALL';
  terminal: boolean;
  returned: boolean;
  eventId: number;
}
export interface ChapterAudioSettings { muted: boolean; volume: number }
export interface ChapterAudioIntent {
  material: 'metal' | 'stone' | 'arc';
  portalDistance: number;
  stride: number;
  roomMix: number;
}

/** Explicit local coordinates keep the 100m physics offset out of audible distances. */
export function chapterAudioIntent(frame: ChapterAudioFrame): ChapterAudioIntent {
  const metal = frame.slot === 'A' && frame.foot[2] > 21;
  return {
    material: frame.mode !== 'NORMAL' ? 'arc' : metal ? 'metal' : 'stone',
    portalDistance: Math.hypot(frame.eye[0], frame.eye[1] - 2.8, frame.eye[2] - (frame.slot === 'A' ? -20 : 18.2)),
    stride: frame.mode === 'NORMAL' ? .82 : .7,
    roomMix: metal ? .8 : frame.slot === 'A' ? .15 : .45,
  };
}
export function validAudioFrame(frame: ChapterAudioFrame): boolean {
  return ['A', 'B'].includes(frame.slot) && ['NORMAL', 'ARC', 'WALL'].includes(frame.mode)
    && [frame.foot, frame.eye, frame.forward, frame.up].every(v => v.length === 3 && v.every(Number.isFinite))
    && typeof frame.grounded === 'boolean' && typeof frame.terminal === 'boolean' && typeof frame.returned === 'boolean'
    && Number.isFinite(frame.speed) && frame.speed >= 0 && frame.speed < 100
    && Number.isSafeInteger(frame.eventId) && frame.eventId >= 0;
}

function seededNoise(context: BaseAudioContext, seconds: number, seed: number): AudioBuffer {
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * seconds), context.sampleRate);
  const data = buffer.getChannelData(0);
  let previous = 0;
  for (let i = 0; i < data.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const white = seed / 0x80000000 - 1;
    previous = (previous + .025 * white) / 1.025;
    data[i] = (previous * 3 + white * .12) * .65;
  }
  return buffer;
}
function impulse(context: BaseAudioContext): AudioBuffer {
  const duration = 1.35;
  const buffer = context.createBuffer(2, Math.ceil(context.sampleRate * duration), context.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    let seed = 0x51f039 + channel;
    for (let i = 0; i < data.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const envelope = Math.pow(1 - i / data.length, 3.5);
      data[i] = (seed / 0x80000000 - 1) * envelope * .3;
    }
    // Short asymmetric early reflections give authored stone/metal spaces a body.
    for (const [delay, gain] of [[.027, .18], [.049, .11], [.083, .07]]) {
      data[Math.min(data.length - 1, Math.floor((delay + channel * .003) * context.sampleRate))] += gain;
    }
  }
  return buffer;
}

/** WebAudio scheduling is driven only by ChapterRuntime's committed state. */
export class ChapterAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private reverb: ConvolverNode | null = null;
  private wet: GainNode | null = null;
  private ambience: GainNode | null = null;
  private roomFilter: BiquadFilterNode | null = null;
  private portal: GainNode | null = null;
  private portalPanner: PannerNode | null = null;
  private noise: AudioBuffer | null = null;
  private continuous: AudioScheduledSourceNode[] = [];
  private voices = new Set<AudioScheduledSourceNode>();
  private settings: ChapterAudioSettings = { muted: false, volume: .55 };
  private distance = 0;
  private previous: { terminal: boolean; returned: boolean; eventId: number } | null = null;
  private disposed = false;
  private unlocked = false;
  private unlockTask: Promise<boolean> | null = null;
  private background = false;
  private footsteps = 0;
  private cues = 0;
  private lastError: string | null = null;
  private readonly visibilityChanged = () => {
    if (typeof document === 'undefined') return;
    if (document.hidden) void this.suspend(); else void this.resume();
  };

  constructor() {
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.visibilityChanged);
  }
  configure(settings: Partial<ChapterAudioSettings>): void {
    if (typeof settings.muted === 'boolean') this.settings.muted = settings.muted;
    if (typeof settings.volume === 'number' && Number.isFinite(settings.volume)) this.settings.volume = Math.max(0, Math.min(1, settings.volume));
    this.applyVolume();
  }
  private applyVolume(): void {
    if (!this.master || !this.context) return;
    const level = this.settings.muted ? 0 : this.settings.volume * .58;
    this.master.gain.setTargetAtTime(level, this.context.currentTime, .025);
  }

  /** Call only from the application's pointer/keyboard user gesture handler. */
  unlock(): Promise<boolean> {
    if (this.disposed) return Promise.resolve(false);
    if (this.unlockTask) return this.unlockTask;
    this.unlockTask = this.unlockInternal().finally(() => { this.unlockTask = null; });
    return this.unlockTask;
  }
  private async unlockInternal(): Promise<boolean> {
    try {
      if (!this.context) {
        const Host = typeof window === 'undefined' ? undefined : window as Window & { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
        const Constructor = Host?.AudioContext ?? Host?.webkitAudioContext;
        if (!Constructor) { this.lastError = 'Web Audio unavailable'; return false; }
        const context = new Constructor({ latencyHint: 'interactive' });
        this.context = context;
        this.build(context);
      }
      const context = this.context;
      if (!context) return false;
      if (context.state === 'suspended') await context.resume();
      this.unlocked = context.state === 'running';
      this.lastError = null;
      return this.unlocked;
    } catch (error) { this.lastError = String(error); return false; }
  }
  private build(context: AudioContext): void {
    this.master = context.createGain();
    this.master.gain.value = 0;
    this.compressor = context.createDynamicsCompressor();
    this.compressor.threshold.value = -19;
    this.compressor.knee.value = 18;
    this.compressor.ratio.value = 3;
    this.compressor.attack.value = .005;
    this.compressor.release.value = .2;
    this.master.connect(this.compressor).connect(context.destination);
    this.reverb = context.createConvolver();
    this.reverb.buffer = impulse(context);
    this.wet = context.createGain();
    this.wet.gain.value = .13;
    this.reverb.connect(this.wet).connect(this.master);
    this.noise = seededNoise(context, 3.7, 0x54485245);
    this.ambience = context.createGain();
    this.ambience.gain.value = .08;
    this.roomFilter = context.createBiquadFilter();
    this.roomFilter.type = 'lowpass';
    this.roomFilter.frequency.value = 320;
    const ambientNoise = context.createBufferSource();
    ambientNoise.buffer = this.noise;
    ambientNoise.loop = true;
    ambientNoise.connect(this.roomFilter).connect(this.ambience).connect(this.master);
    ambientNoise.start();
    this.continuous.push(ambientNoise);
    for (const [frequency, amplitude] of [[47.5, .012], [71.25, .007], [142.5, .002]]) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine'; oscillator.frequency.value = frequency; gain.gain.value = amplitude;
      oscillator.connect(gain).connect(this.master); oscillator.start(); this.continuous.push(oscillator);
    }
    this.portal = context.createGain(); this.portal.gain.value = 0;
    this.portalPanner = context.createPanner(); this.portalPanner.panningModel = 'HRTF';
    this.portalPanner.distanceModel = 'inverse'; this.portalPanner.refDistance = 2; this.portalPanner.maxDistance = 45;
    this.portalPanner.rolloffFactor = .6;
    this.portal.connect(this.portalPanner).connect(this.master);
    for (const frequency of [108, 162.3]) {
      const oscillator = context.createOscillator(); oscillator.type = 'sine'; oscillator.frequency.value = frequency;
      oscillator.connect(this.portal); oscillator.start(); this.continuous.push(oscillator);
    }
    this.applyVolume();
  }

  update(frame: ChapterAudioFrame, dt: number): void {
    if (this.disposed || !validAudioFrame(frame) || !Number.isFinite(dt) || dt < 0) return;
    const previous = this.previous;
    this.previous = { terminal: frame.terminal, returned: frame.returned, eventId: frame.eventId };
    const context = this.context;
    if (!context || context.state !== 'running' || this.background) { this.distance = 0; return; }
    const intent = chapterAudioIntent(frame);
    const time = context.currentTime;
    this.listenerPose(context.listener, frame, time);
    this.ambience?.gain.setTargetAtTime(.025 + .065 * intent.roomMix, time, .6);
    this.roomFilter?.frequency.setTargetAtTime(frame.slot === 'B' ? 190 : 260 + 220 * intent.roomMix, time, .5);
    this.wet?.gain.setTargetAtTime(.08 + intent.roomMix * .09, time, .4);
    this.portal?.gain.setTargetAtTime(Math.max(0, 1 - intent.portalDistance / 26) * .016, time, .1);
    if (this.portalPanner) {
      this.portalPanner.positionX.setValueAtTime(0, time);
      this.portalPanner.positionY.setValueAtTime(2.8, time);
      this.portalPanner.positionZ.setValueAtTime(frame.slot === 'A' ? -20 : 18.2, time);
    }
    if (frame.grounded && frame.speed > .15) {
      this.distance += Math.min(frame.speed, 6) * Math.min(dt, .1);
      if (this.distance >= intent.stride) {
        this.distance %= intent.stride;
        this.footstep(intent.material, frame);
      }
    } else this.distance = 0;
    if (previous && !this.settings.muted) {
      if (frame.eventId > previous.eventId) this.portalCue();
      if (frame.terminal && !previous.terminal) this.chime(false);
      if (frame.returned && !previous.returned) this.chime(true);
    }
  }
  private listenerPose(listener: AudioListener, frame: ChapterAudioFrame, time: number): void {
    if (listener.positionX) {
      const parameters = [listener.positionX, listener.positionY, listener.positionZ,
        listener.forwardX, listener.forwardY, listener.forwardZ, listener.upX, listener.upY, listener.upZ];
      const values = [...frame.eye, ...frame.forward, ...frame.up];
      parameters.forEach((parameter, index) => parameter.setValueAtTime(values[index], time));
    } else {
      listener.setPosition(...frame.eye);
      listener.setOrientation(...frame.forward, ...frame.up);
    }
  }
  private track(source: AudioScheduledSourceNode, nodes: AudioNode[], end: number): void {
    this.voices.add(source);
    source.onended = () => { this.voices.delete(source); source.disconnect(); nodes.forEach(node => node.disconnect()); };
    source.stop(end);
  }
  private tone(frequency: number, offset: number, duration: number, amplitude: number, to = frequency): void {
    if (!this.context || !this.master) return;
    const context = this.context, time = context.currentTime + offset;
    const source = context.createOscillator(); const gain = context.createGain();
    source.type = 'sine'; source.frequency.setValueAtTime(frequency, time);
    source.frequency.exponentialRampToValueAtTime(Math.max(1, to), time + duration);
    gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(amplitude, time + .012);
    gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
    source.connect(gain).connect(this.master);
    if (this.reverb) gain.connect(this.reverb);
    source.start(time); this.track(source, [gain], time + duration + .03);
  }
  private footstep(material: ChapterAudioIntent['material'], frame: ChapterAudioFrame): void {
    if (!this.context || !this.master || !this.noise || this.settings.muted) return;
    this.footsteps++;
    const context = this.context, time = context.currentTime;
    const source = context.createBufferSource(); source.buffer = this.noise;
    const filter = context.createBiquadFilter(); filter.type = 'bandpass';
    filter.frequency.value = material === 'metal' ? 1150 : material === 'arc' ? 520 : 720;
    filter.Q.value = material === 'metal' ? .8 : .45;
    const gain = context.createGain();
    gain.gain.setValueAtTime(.0001, time);
    gain.gain.linearRampToValueAtTime(material === 'metal' ? .11 : .16, time + .008);
    gain.gain.exponentialRampToValueAtTime(.0001, time + .14);
    const panner = context.createPanner(); panner.panningModel = 'HRTF'; panner.refDistance = 2;
    panner.positionX.value = frame.foot[0] + (this.footsteps % 2 ? -.12 : .12);
    panner.positionY.value = frame.foot[1]; panner.positionZ.value = frame.foot[2];
    source.connect(filter).connect(gain).connect(panner).connect(this.master);
    if (this.reverb) panner.connect(this.reverb);
    source.start(time, (this.footsteps * .371) % 2.5);
    this.track(source, [filter, gain, panner], time + .17);
    this.tone(material === 'metal' ? 115 : 68, 0, material === 'metal' ? .19 : .1, .035, 42);
    if (material === 'metal') this.tone(460, .008, .22, .004, 447);
  }
  private portalCue(): void {
    this.cues++; this.tone(81, 0, .7, .028, 162); this.tone(243, .07, .6, .008, 121.5);
  }
  private chime(returned: boolean): void {
    this.cues++;
    const notes = returned ? [110, 165, 220, 330, 440] : [146.83, 220, 293.66];
    notes.forEach((note, i) => this.tone(note, i * .12, returned ? 2.1 : 1.2, .014 / (1 + i * .23)));
  }
  async suspend(): Promise<void> {
    this.background = true; this.distance = 0;
    if (this.context?.state === 'running') { try { await this.context.suspend(); } catch (error) { this.lastError = String(error); } }
  }
  async resume(): Promise<void> {
    this.background = false;
    if (!this.unlocked || !this.context || this.disposed || (typeof document !== 'undefined' && document.hidden)) return;
    try { if (this.context.state === 'suspended') await this.context.resume(); } catch (error) { this.lastError = String(error); }
  }
  snapshot() {
    return { state: this.disposed ? 'disposed' : this.context?.state ?? 'locked', unlocked: this.unlocked,
      muted: this.settings.muted, volume: this.settings.volume, activeVoices: this.voices.size,
      footsteps: this.footsteps, cues: this.cues, error: this.lastError, source: 'original procedural Web Audio' };
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.visibilityChanged);
    for (const source of [...this.continuous, ...this.voices]) { try { source.stop(); } catch { /* Already completed. */ } source.disconnect(); }
    this.continuous = []; this.voices.clear();
    [this.master, this.compressor, this.reverb, this.wet, this.ambience, this.roomFilter, this.portal, this.portalPanner].forEach(node => node?.disconnect());
    if (this.context && this.context.state !== 'closed') void this.context.close();
    this.noise = null;
  }
}
