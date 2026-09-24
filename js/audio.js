// Procedural audio for Crown of Numeria: sound effects (optionally 3D-positioned),
// ambience (wind, birds, torches) and a gentle generative music score whose
// mood changes per floor, plus short musical cues for game events.
// Everything is synthesized with WebAudio, so there are no audio files.

const NOTE = (n) => 440 * 2 ** ((n - 69) / 12); // MIDI note -> Hz

// Chord = [root MIDI, intervals]. Progressions loop one chord per bar.
const MOODS = {
  castle: { bpm: 78, prog: [[50, [0, 3, 7]], [48, [0, 4, 7]], [46, [0, 4, 7]], [48, [0, 4, 7]]], scale: [0, 2, 3, 5, 7, 9, 10], pluck: 'harp', pad: 0.5, drum: 0, flute: 0.6 },
  feast: { bpm: 100, prog: [[55, [0, 4, 7]], [60, [0, 4, 7]], [62, [0, 4, 7]], [55, [0, 4, 7]]], scale: [0, 2, 4, 5, 7, 9, 11], pluck: 'lute', pad: 0.3, drum: 0.6, flute: 0.8 },
  library: { bpm: 66, prog: [[53, [0, 4, 7, 11]], [50, [0, 3, 7, 10]], [46, [0, 4, 7, 11]], [48, [0, 4, 7]]], scale: [0, 2, 4, 5, 7, 9, 11], pluck: 'harp', pad: 0.6, drum: 0, flute: 0.3 },
  armory: { bpm: 92, prog: [[50, [0, 3, 7]], [46, [0, 4, 7]], [48, [0, 4, 7]], [45, [0, 4, 7]]], scale: [0, 2, 3, 5, 7, 8, 10], pluck: 'lute', pad: 0.4, drum: 1, flute: 0.5 },
  crystal: { bpm: 70, prog: [[53, [0, 4, 7, 11]], [52, [0, 3, 7, 10]], [50, [0, 3, 7, 10]], [48, [0, 4, 7, 11]]], scale: [0, 2, 4, 7, 9], pluck: 'bell', pad: 0.7, drum: 0, flute: 0.2 },
  top: { bpm: 96, prog: [[60, [0, 4, 7]], [55, [0, 4, 7]], [57, [0, 3, 7]], [53, [0, 4, 7]]], scale: [0, 2, 4, 7, 9], pluck: 'harp', pad: 0.5, drum: 0.7, flute: 0.9 },
};
export const FLOOR_MOODS = ['castle', 'feast', 'library', 'armory', 'crystal', 'top'];

export class AudioEngine {
  constructor({ musicVolume = 0.5 } = {}) {
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = AC ? new AC() : null;
    if (!this.ctx) return;
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = 0.9;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp); comp.connect(c.destination);
    // stone-room reverb send
    this.reverb = c.createConvolver(); this.reverb.buffer = this.impulse(2.2, 2.5);
    this.reverbGain = c.createGain(); this.reverbGain.gain.value = 0.28;
    this.reverb.connect(this.reverbGain); this.reverbGain.connect(this.master);
    this.sfxBus = this.bus(0.8);
    this.ambBus = this.bus(0.5);
    this.musicBus = this.bus(0.0);
    this.musicLevel = 0.32 * musicVolume;
    this.cueBus = this.bus(0.5 * Math.max(0.4, musicVolume));
    this.noiseBuf = this.makeNoise(2);
    this.music = { mood: 'castle', next: null, step: 0, time: 0, running: false, phrase: 0, melodyNote: 0 };
    this.duckUntil = 0;
  }

  bus(level) {
    const g = this.ctx.createGain(); g.gain.value = level;
    g.connect(this.master);
    const send = this.ctx.createGain(); send.gain.value = 0.6; g.connect(send); send.connect(this.reverb);
    return g;
  }
  impulse(sec, decay) {
    const c = this.ctx, len = Math.floor(c.sampleRate * sec), buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** decay; }
    return buf;
  }
  makeNoise(sec) {
    const c = this.ctx, buf = c.createBuffer(1, c.sampleRate * sec, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
  resume() { if (this.ctx && this.ctx.state !== 'running') this.ctx.resume(); }
  get now() { return this.ctx ? this.ctx.currentTime : 0; }

  // Listener follows the player's head.
  setListener(p, fwd, up) {
    const l = this.ctx?.listener; if (!l) return;
    if (l.positionX) {
      const t = this.now;
      l.positionX.setTargetAtTime(p.x, t, 0.02); l.positionY.setTargetAtTime(p.y, t, 0.02); l.positionZ.setTargetAtTime(p.z, t, 0.02);
      l.forwardX.setTargetAtTime(fwd.x, t, 0.02); l.forwardY.setTargetAtTime(fwd.y, t, 0.02); l.forwardZ.setTargetAtTime(fwd.z, t, 0.02);
      l.upX.setTargetAtTime(up.x, t, 0.02); l.upY.setTargetAtTime(up.y, t, 0.02); l.upZ.setTargetAtTime(up.z, t, 0.02);
    } else { l.setPosition(p.x, p.y, p.z); l.setOrientation(fwd.x, fwd.y, fwd.z, up.x, up.y, up.z); }
  }
  // A destination node: positional (3D) when pos is given, else the plain bus.
  dest(pos, bus = this.sfxBus) {
    if (!pos) return bus;
    const pn = this.ctx.createPanner();
    pn.panningModel = 'HRTF'; pn.distanceModel = 'inverse'; pn.refDistance = 0.8; pn.rolloffFactor = 1.1; pn.maxDistance = 200;
    if (pn.positionX) { pn.positionX.value = pos.x; pn.positionY.value = pos.y; pn.positionZ.value = pos.z; } else pn.setPosition(pos.x, pos.y, pos.z);
    pn.connect(bus);
    setTimeout(() => pn.disconnect(), 6000);
    return pn;
  }

  // ------------------------------------------------------------ primitives
  tone(f, t0 = 0, dur = 0.2, { type = 'sine', vol = 0.2, fEnd = null, attack = 0.012, to = this.sfxBus, detune = 0, vibrato = 0 } = {}) {
    if (!this.ctx) return;
    const c = this.ctx, t = this.now + t0, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = detune;
    if (fEnd) o.frequency.exponentialRampToValueAtTime(fEnd, t + dur);
    if (vibrato) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 5.5; lg.gain.value = f * vibrato; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + 0.1); }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(to); o.start(t); o.stop(t + dur + 0.05);
  }
  noise(t0, dur, { type = 'lowpass', freq = 1000, q = 1, vol = 0.2, to = this.sfxBus, fEnd = null, attack = 0.005 } = {}) {
    if (!this.ctx) return;
    const c = this.ctx, t = this.now + t0, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf; s.loop = true;
    f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (fEnd) f.frequency.exponentialRampToValueAtTime(fEnd, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(to); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  // Plucked string / bell voice used by both music and cues.
  pluck(f, t0, { vol = 0.12, timbre = 'harp', to = this.musicBus, dur = 1.6 } = {}) {
    if (!this.ctx) return;
    const c = this.ctx, t = this.now + t0, g = c.createGain(), lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(timbre === 'bell' ? 6000 : 3200, t); lp.frequency.exponentialRampToValueAtTime(timbre === 'lute' ? 700 : 1200, t + dur * 0.6);
    const parts = timbre === 'bell' ? [[1, 'sine', 1], [2.76, 'sine', 0.35], [5.4, 'sine', 0.15]] : timbre === 'lute' ? [[1, 'sawtooth', 0.35], [2, 'triangle', 0.4]] : [[1, 'triangle', 1], [2, 'sine', 0.3], [3, 'sine', 0.1]];
    for (const [m, type, a] of parts) { const o = c.createOscillator(); o.type = type; o.frequency.value = f * m; const og = c.createGain(); og.gain.value = a; o.connect(og); og.connect(lp); o.start(t); o.stop(t + dur + 0.05); }
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    lp.connect(g); g.connect(to);
  }

  // ------------------------------------------------------------ sound effects
  click() { this.tone(1200, 0, 0.05, { type: 'triangle', vol: 0.08 }); this.tone(800, 0.01, 0.05, { type: 'sine', vol: 0.05 }); }
  correct() { [72, 76, 79, 84].forEach((n, i) => this.pluck(NOTE(n), i * 0.07, { vol: 0.2, timbre: 'bell', to: this.cueBus, dur: 0.8 })); }
  wrong() { this.tone(330, 0, 0.18, { type: 'triangle', vol: 0.12, fEnd: 290 }); this.tone(262, 0.16, 0.3, { type: 'triangle', vol: 0.1, fEnd: 240 }); }
  hint() { [76, 79].forEach((n, i) => this.pluck(NOTE(n), i * 0.1, { vol: 0.1, timbre: 'bell', to: this.cueBus, dur: 0.6 })); }
  gem() { this.pluck(NOTE(88), 0, { vol: 0.15, timbre: 'bell', to: this.cueBus, dur: 0.6 }); this.pluck(NOTE(93), 0.08, { vol: 0.15, timbre: 'bell', to: this.cueBus, dur: 0.9 }); }
  pickup(pos) { this.noise(0, 0.12, { type: 'bandpass', freq: 1800, fEnd: 3500, q: 2, vol: 0.12, to: this.dest(pos) }); }
  whoosh(pos, speed) { this.noise(0, 0.35, { type: 'bandpass', freq: 400, fEnd: 1800 + speed * 200, q: 1.5, vol: Math.min(0.25, 0.04 * speed), to: this.dest(pos), attack: 0.05 }); }
  impact(pos, material, speed) {
    const v = Math.min(1, speed / 5), d = this.dest(pos);
    if (v < 0.05) return;
    switch (material) {
      case 'metal': this.tone(720 + Math.random() * 200, 0, 0.5, { type: 'triangle', vol: 0.18 * v, to: d }); this.tone(1650, 0, 0.35, { vol: 0.08 * v, to: d }); this.noise(0, 0.05, { type: 'highpass', freq: 3000, vol: 0.1 * v, to: d }); break;
      case 'glass': this.tone(1800, 0, 0.4, { vol: 0.12 * v, to: d }); this.tone(2600, 0, 0.3, { vol: 0.06 * v, to: d }); break;
      case 'soft': this.noise(0, 0.08, { freq: 500, vol: 0.18 * v, to: d }); break;
      case 'ball': this.tone(180, 0, 0.12, { vol: 0.3 * v, fEnd: 90, to: d }); this.noise(0, 0.03, { freq: 1500, vol: 0.08 * v, to: d }); break;
      case 'duck': this.tone(900, 0, 0.18, { type: 'square', vol: 0.06 * v, fEnd: 1400, to: d }); break;
      case 'wood': this.tone(240, 0, 0.1, { type: 'triangle', vol: 0.25 * v, fEnd: 160, to: d }); this.noise(0, 0.06, { type: 'bandpass', freq: 900, q: 2, vol: 0.18 * v, to: d }); break;
      case 'paper': this.noise(0, 0.1, { type: 'highpass', freq: 2500, vol: 0.08 * v, to: d }); break;
      case 'heavy': this.tone(90, 0, 0.3, { vol: 0.35 * v, fEnd: 50, to: d }); this.noise(0, 0.12, { freq: 400, vol: 0.2 * v, to: d }); break;
      default: this.noise(0, 0.08, { freq: 800, vol: 0.15 * v, to: d });
    }
  }
  chime(pos, n) { this.pluck(NOTE(n), 0, { vol: 0.18, timbre: 'bell', to: this.dest(pos), dur: 2.2 }); }
  pop(pos) { this.tone(600 + Math.random() * 500, 0, 0.06, { vol: 0.2, fEnd: 1400, to: this.dest(pos) }); this.noise(0, 0.03, { type: 'highpass', freq: 3000, vol: 0.08, to: this.dest(pos) }); }
  meow(pos) {
    if (!this.ctx) return;
    const d = this.dest(pos), c = this.ctx, t = this.now, o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(520, t); o.frequency.linearRampToValueAtTime(760, t + 0.15); o.frequency.linearRampToValueAtTime(480, t + 0.55);
    f.type = 'bandpass'; f.Q.value = 5; f.frequency.setValueAtTime(900, t); f.frequency.linearRampToValueAtTime(1800, t + 0.2); f.frequency.linearRampToValueAtTime(700, t + 0.55);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    o.connect(f); f.connect(g); g.connect(d); o.start(t); o.stop(t + 0.65);
  }
  purr(pos, dur = 2) {
    if (!this.ctx) return;
    const d = this.dest(pos), c = this.ctx, t = this.now, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
    s.buffer = this.noiseBuf; s.loop = true; f.type = 'lowpass'; f.frequency.value = 180;
    lfo.frequency.value = 24; lg.gain.value = 0.12; lfo.connect(lg); lg.connect(g.gain);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.14, t + 0.3); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(d); s.start(t); s.stop(t + dur); lfo.start(t); lfo.stop(t + dur);
  }
  hoot(pos) { const d = this.dest(pos); this.tone(390, 0, 0.35, { vol: 0.2, vibrato: 0.01, attack: 0.08, to: d }); this.tone(370, 0.45, 0.5, { vol: 0.2, vibrato: 0.01, attack: 0.08, to: d }); }
  roar(pos) { const d = this.dest(pos, this.ambBus); this.tone(110, 0, 1.2, { type: 'sawtooth', vol: 0.18, fEnd: 70, attack: 0.15, to: d }); this.noise(0, 1.2, { type: 'bandpass', freq: 500, fEnd: 250, q: 1, vol: 0.2, attack: 0.15, to: d }); }
  chirp(pos) { const d = this.dest(pos, this.ambBus), b = 2800 + Math.random() * 1500; for (let k = 0; k < 2 + Math.floor(Math.random() * 3); k++) this.tone(b, k * 0.12, 0.08, { vol: 0.06, fEnd: b * 1.4, to: d }); }
  crackle(pos) { this.noise(0, 0.03 + Math.random() * 0.04, { type: 'highpass', freq: 1500 + Math.random() * 2000, vol: 0.03 + Math.random() * 0.04, to: this.dest(pos, this.ambBus) }); }
  pinHit(pos) { for (let k = 0; k < 3; k++) this.tone(500 + Math.random() * 400, k * 0.04, 0.2, { type: 'triangle', vol: 0.12, to: this.dest(pos) }); this.noise(0, 0.1, { type: 'bandpass', freq: 1200, vol: 0.12, to: this.dest(pos) }); }
  boom(pos) { const d = this.dest(pos, this.ambBus); this.tone(70, 0, 0.8, { vol: 0.35, fEnd: 35, to: d }); this.noise(0, 0.5, { freq: 700, fEnd: 200, vol: 0.25, to: d }); for (let k = 0; k < 8; k++) this.noise(0.2 + Math.random() * 0.8, 0.04, { type: 'highpass', freq: 3000, vol: 0.06, to: d }); }

  // ------------------------------------------------------------ cue music
  duck(sec = 2.5) {
    if (!this.ctx) return;
    const t = this.now, g = this.musicBus.gain;
    g.cancelScheduledValues(t); g.setTargetAtTime(this.musicLevel * 0.25, t, 0.1); g.setTargetAtTime(this.musicLevel, t + sec, 0.8);
    this.duckUntil = t + sec;
  }
  cueUnlock() { this.duck(3); [62, 66, 69, 74, 78, 81].forEach((n, i) => this.pluck(NOTE(n), i * 0.09, { vol: 0.2, timbre: 'harp', to: this.cueBus, dur: 2 })); [74, 78, 81].forEach((n) => this.tone(NOTE(n), 0.6, 1.6, { type: 'triangle', vol: 0.06, attack: 0.2, to: this.cueBus })); this.noise(0, 1.2, { type: 'bandpass', freq: 3000, fEnd: 8000, q: 0.8, vol: 0.05, to: this.cueBus, attack: 0.3 }); }
  cueChest() { this.duck(2); for (let k = 0; k < 8; k++) this.pluck(NOTE(84 + [0, 4, 7, 12, 16, 19, 24, 28][k]), k * 0.06, { vol: 0.12, timbre: 'bell', to: this.cueBus, dur: 1.2 }); }
  cueLift() { this.duck(6); this.tone(110, 0, 5.2, { type: 'sine', vol: 0.1, fEnd: 220, attack: 0.8, to: this.cueBus }); [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => this.pluck(NOTE(62 + s), 0.6 + i * 0.65, { vol: 0.12, timbre: 'harp', to: this.cueBus, dur: 1.4 })); this.noise(0, 5, { type: 'bandpass', freq: 800, fEnd: 3000, q: 0.7, vol: 0.04, attack: 1, to: this.cueBus }); }
  cueArrive(mood) {
    this.duck(3);
    const root = MOODS[mood]?.prog[0][0] ?? 60;
    [0, 4, 7, 12].forEach((s, i) => this.pluck(NOTE(root + 12 + s), i * 0.12, { vol: 0.16, timbre: 'bell', to: this.cueBus, dur: 1.4 }));
  }
  cueScore() { [79, 83, 86, 91].forEach((n, i) => this.pluck(NOTE(n), i * 0.08, { vol: 0.14, timbre: 'bell', to: this.cueBus, dur: 0.8 })); }
  cueStrike() { this.duck(3); this.fanfare(0.6); }
  fanfare(scale = 1) {
    const brass = (n, t, d) => { this.tone(NOTE(n), t, d, { type: 'sawtooth', vol: 0.05 * scale, attack: 0.03, to: this.cueBus }); this.tone(NOTE(n), t, d, { type: 'square', vol: 0.03 * scale, attack: 0.03, detune: 8, to: this.cueBus }); };
    [[67, 0, 0.2], [72, 0.2, 0.2], [76, 0.4, 0.2], [79, 0.6, 0.5], [76, 0.95, 0.18], [79, 1.12, 0.9]].forEach(([n, t, d]) => brass(n, t, d));
    [0, 0.6, 1.12].forEach((t) => this.drum(t, 0.3 * scale));
  }
  cueVictory() {
    this.duck(7); this.fanfare(1);
    [[60, 64, 67], [65, 69, 72], [67, 71, 74], [72, 76, 79]].forEach((ch, k) => ch.forEach((n) => this.pluck(NOTE(n), 2.2 + k * 0.55, { vol: 0.12, timbre: 'harp', to: this.cueBus, dur: 2 })));
    for (let k = 0; k < 8; k++) this.drum(2.2 + k * 0.275, 0.2);
  }
  drum(t0, vol = 0.3, to = this.cueBus) { this.tone(110, t0, 0.25, { vol, fEnd: 55, to }); this.noise(t0, 0.06, { freq: 900, vol: vol * 0.3, to }); }

  // ------------------------------------------------------------ ambience
  startAmbience() {
    if (!this.ctx || this.windGain) return;
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
    s.buffer = this.noiseBuf; s.loop = true; f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = 0.7;
    lfo.frequency.value = 0.13; lg.gain.value = 250; lfo.connect(lg); lg.connect(f.frequency);
    const panner = c.createPanner(); panner.panningModel = 'HRTF'; panner.rolloffFactor = 0; // level is already controlled by window distance
    g.gain.value = 0.0; s.connect(f); f.connect(g); g.connect(panner); panner.connect(this.ambBus); s.start(); lfo.start();
    this.windGain = g;
    this.windPanner = panner;
  }
  setWind(level, position) {
    if (this.windGain) this.windGain.gain.setTargetAtTime(0.02 + level * 0.1, this.now, 0.5);
    if (this.windPanner && position) {
      this.windPanner.positionX.setTargetAtTime(position.x, this.now, 0.1);
      this.windPanner.positionY.setTargetAtTime(position.y, this.now, 0.1);
      this.windPanner.positionZ.setTargetAtTime(position.z, this.now, 0.1);
    }
  }

  // ------------------------------------------------------------ generative music
  startMusic(mood = 'castle') {
    if (!this.ctx || this.music.running) return;
    this.music.mood = mood; this.music.running = true; this.music.time = this.now + 0.2; this.music.step = 0;
    this.musicBus.gain.setTargetAtTime(this.musicLevel, this.now, 1.5);
    this.timer = setInterval(() => this.schedule(), 60);
  }
  setMood(mood) { if (MOODS[mood] && mood !== this.music.mood) this.music.next = mood; }
  stopMusic() { clearInterval(this.timer); this.music.running = false; }
  schedule() {
    const m = this.music, c = this.ctx;
    while (m.time < c.currentTime + 0.25) {
      const mood = MOODS[m.mood], spb = 60 / mood.bpm / 2; // seconds per 8th note
      const bar = Math.floor(m.step / 8), pos = m.step % 8;
      if (pos === 0 && m.next) { m.mood = m.next; m.next = null; m.step = 0; continue; }
      const [root, iv] = mood.prog[bar % mood.prog.length];
      const at = m.time - c.currentTime;
      const chord = iv.map((x) => root + x);
      // arpeggio (harp / lute / bell)
      const arp = [0, 1, 2, 3, 2, 1, 2, 3][pos], note = chord[arp % chord.length] + (arp >= chord.length ? 12 : 0) + 12;
      if (!(mood.bpm > 90 && pos % 2)) this.pluck(NOTE(note), at, { vol: 0.07, timbre: mood.pluck, dur: 1.4 });
      // bass on beats 1 and 3
      if (pos === 0 || pos === 4) this.tone(NOTE(root - 12), at, spb * 3.5, { type: 'sine', vol: 0.09, attack: 0.02, to: this.musicBus });
      // pad each bar
      if (pos === 0 && mood.pad) for (const n of chord.slice(0, 3)) for (const dt of [-6, 6]) this.tone(NOTE(n), at, spb * 8.2, { type: 'sawtooth', vol: 0.006 * mood.pad, attack: 1.2, detune: dt, to: this.padFilter() });
      // soft drum
      if (mood.drum && (pos === 0 || pos === 4 || (pos === 6 && bar % 2))) this.drum(at, 0.08 * mood.drum, this.musicBus);
      if (mood.drum && pos % 2 === 1) this.noise(at, 0.03, { type: 'highpass', freq: 6000, vol: 0.012 * mood.drum, to: this.musicBus });
      // flute melody on alternate 4-bar phrases
      const phrase = Math.floor(bar / 4);
      if (phrase % 2 === 1 && Math.random() < mood.flute * (pos % 2 ? 0.25 : 0.7)) {
        const sc = mood.scale, base = chord[0] + 24;
        m.melodyNote = Math.max(-3, Math.min(7, m.melodyNote + [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)]));
        const deg = ((m.melodyNote % sc.length) + sc.length) % sc.length, oct = Math.floor(m.melodyNote / sc.length);
        const n = (base - (base % 12)) + (root % 12) + sc[deg] + oct * 12;
        this.tone(NOTE(n), at, spb * (pos % 2 ? 1 : 2) * 1.1, { type: 'sine', vol: 0.045, attack: 0.06, vibrato: 0.006, to: this.musicBus });
      }
      m.time += spb; m.step++;
    }
  }
  padFilter() {
    if (!this._pad) { this._pad = this.ctx.createBiquadFilter(); this._pad.type = 'lowpass'; this._pad.frequency.value = 900; this._pad.connect(this.musicBus); }
    return this._pad;
  }
}
