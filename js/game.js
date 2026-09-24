// Crown of Numeria: a WebXR math castle for Meta Quest 3 (also playable with mouse +
// keyboard). Doors and treasure chests are locked by math problems.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/BufferGeometryUtils.js';
import { ProblemSource, isCorrect, speakable } from './problems.js';

// ------------------------------------------------------------ layout
const W = 8, L = 10, H = 5, WALL_T = 0.4, DOOR_W = 2.2, DOOR_H = 3.2;
const ROOMS = [
  { name: 'Entrance Hall', banner: '#2e7d32', floor: 'stone', light: 0xffc27a },
  { name: 'Great Hall', banner: '#c62828', floor: 'wood', light: 0xffb866 },
  { name: 'Royal Library', banner: '#1565c0', floor: 'wood', light: 0xffd08a },
  { name: "Knights' Armory", banner: '#6a1b9a', floor: 'stone', light: 0xffc27a },
  { name: 'Crystal Tower', banner: '#00838f', floor: 'stone', light: 0xb9a0ff },
  { name: 'Throne Room', banner: '#f9a825', floor: 'stone', light: 0xffd27a },
];
const LAST = ROOMS.length - 1;
const zc = (i) => -i * L;
const wallZ = (i) => zc(i) - L / 2; // wall between room i and room i+1
const TREASURES = [
  ['Ruby', 0xe0115f], ['Sapphire', 0x2a6cff], ['Emerald', 0x1fc46b], ['Amethyst', 0x9b4dff], ['Golden Star', 0xffc629],
];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ------------------------------------------------------------ sound
class Sfx {
  constructor() {
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = AC ? new AC() : null;
    if (!this.ctx) return;
    this.out = this.ctx.createGain();
    this.out.gain.value = 0.6;
    this.out.connect(this.ctx.destination);
  }
  resume() { this.ctx?.resume(); }
  tone(f, t0 = 0, dur = 0.2, type = 'sine', vol = 0.25, fEnd = null) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + t0, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (fEnd) o.frequency.exponentialRampToValueAtTime(fEnd, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.out); o.start(t); o.stop(t + dur + 0.05);
  }
  click() { this.tone(880, 0, 0.06, 'triangle', 0.12); }
  correct() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, i * 0.08, 0.3, 'triangle', 0.22)); }
  wrong() { this.tone(260, 0, 0.22, 'sawtooth', 0.08, 190); this.tone(200, 0.14, 0.3, 'sawtooth', 0.07, 140); }
  door() { this.tone(70, 0, 1.4, 'sawtooth', 0.12, 45); this.tone(110, 0.05, 1.1, 'square', 0.04, 60); [784, 988, 1175].forEach((f, i) => this.tone(f, 0.2 + i * 0.1, 0.5, 'sine', 0.12)); }
  chest() { for (let i = 0; i < 10; i++) this.tone(1200 + Math.random() * 1600, i * 0.05, 0.25, 'sine', 0.08); }
  gem() { this.tone(1319, 0, 0.15, 'sine', 0.15); this.tone(1760, 0.08, 0.3, 'sine', 0.15); }
  teleport() { this.tone(500, 0, 0.18, 'sine', 0.1, 1100); }
  fanfare() { [[392, 0], [523, 0.18], [659, 0.36], [784, 0.54], [659, 0.8], [784, 0.95]].forEach(([f, t]) => { this.tone(f, t, 0.5, 'square', 0.07); this.tone(f / 2, t, 0.5, 'triangle', 0.12); }); }
}

function speak(text) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(speakable(text));
  u.rate = 0.9; u.pitch = 1.1;
  speechSynthesis.speak(u);
}

// ------------------------------------------------------------ textures
function canvasTexture(w, h, draw, wrap = false) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const noise = (ctx, w, h, n, alpha) => { for (let i = 0; i < n; i++) { ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * alpha})`; ctx.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 4, 2 + Math.random() * 4); } };
const stoneTex = (base = [128, 118, 104]) => canvasTexture(512, 512, (ctx, w, h) => {
  ctx.fillStyle = '#3a342c'; ctx.fillRect(0, 0, w, h);
  const rows = 8, rh = h / rows;
  for (let r = 0; r < rows; r++) {
    const off = r % 2 ? 64 : 0;
    for (let x = -off; x < w; x += 128) {
      const k = 0.8 + Math.random() * 0.35;
      ctx.fillStyle = `rgb(${base[0] * k | 0},${base[1] * k | 0},${base[2] * k | 0})`;
      ctx.fillRect(x + 3, r * rh + 3, 122, rh - 6);
    }
  }
  noise(ctx, w, h, 3000, 0.12);
}, true);
const woodTex = (base = [120, 78, 44]) => canvasTexture(512, 512, (ctx, w, h) => {
  const n = 6, pw = w / n;
  for (let i = 0; i < n; i++) {
    const k = 0.8 + Math.random() * 0.3;
    ctx.fillStyle = `rgb(${base[0] * k | 0},${base[1] * k | 0},${base[2] * k | 0})`;
    ctx.fillRect(i * pw, 0, pw, h);
    ctx.strokeStyle = 'rgba(40,20,5,0.25)';
    for (let g = 0; g < 10; g++) { ctx.beginPath(); const x = i * pw + Math.random() * pw; ctx.moveTo(x, 0); ctx.bezierCurveTo(x + 8, h / 3, x - 8, 2 * h / 3, x, h); ctx.stroke(); }
    ctx.fillStyle = 'rgba(20,10,0,0.6)'; ctx.fillRect(i * pw, 0, 3, h);
  }
  noise(ctx, w, h, 1500, 0.08);
}, true);

// Scale a geometry's UVs so textures tile at `tile` meters regardless of size.
function tileUV(geo, sizes, tile) {
  const uv = geo.attributes.uv;
  if (geo.type === 'BoxGeometry') {
    const [w, h, d] = sizes, faces = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) { const i = f * 4 + v; uv.setXY(i, uv.getX(i) * faces[f][0] / tile, uv.getY(i) * faces[f][1] / tile); }
  } else {
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sizes[0] / tile, uv.getY(i) * sizes[1] / tile);
  }
  return geo;
}

// Collects static meshes and merges them per material (few draw calls on Quest).
class StaticBatch {
  constructor() { this.parts = new Map(); }
  add(geo, mat, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...scale));
    const g = geo.clone().applyMatrix4(m);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!this.parts.has(mat)) this.parts.set(mat, []);
    this.parts.get(mat).push(g);
  }
  box(w, h, d, mat, pos, rot, tile = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (tile) tileUV(g, [w, h, d], tile);
    this.add(g, mat, pos, rot);
  }
  build(scene, blockers) {
    for (const [mat, list] of this.parts) {
      const merged = mergeGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g)));
      const mesh = new THREE.Mesh(merged, mat);
      mesh.matrixAutoUpdate = false;
      scene.add(mesh);
      if (!mat.userData.noBlock) blockers.push(mesh);
    }
  }
}

// ------------------------------------------------------------ canvas UI helpers
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function wrapLines(ctx, text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW && line) { out.push(line); line = word; } else line = test;
    }
    out.push(line);
  }
  return out;
}
function fitText(ctx, text, maxW, maxH, start, min, weight = 'bold') {
  for (let s = start; s >= min; s -= 4) {
    ctx.font = `${weight} ${s}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
    const lines = wrapLines(ctx, text, maxW);
    if (lines.length * s * 1.22 <= maxH) return { lines, size: s };
  }
  return { lines: wrapLines(ctx, text, maxW), size: min };
}
function drawGem(ctx, x, y, r, color) {
  ctx.fillStyle = color; ctx.beginPath();
  ctx.moveTo(x, y + r); ctx.lineTo(x - r, y - r * 0.2); ctx.lineTo(x - r * 0.5, y - r * 0.8); ctx.lineTo(x + r * 0.5, y - r * 0.8); ctx.lineTo(x + r, y - r * 0.2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.moveTo(x - r * 0.5, y - r * 0.8); ctx.lineTo(x, y - r * 0.2); ctx.lineTo(x - r, y - r * 0.2); ctx.closePath(); ctx.fill();
}
const FONT = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';

// A floating sign (static text) as a textured plane.
function makeSign(text, { w = 2.4, h = 0.5, bg = '#3b2412', fg = '#ffe9a8', size = 90, border = '#d4a93a', px = 1024 } = {}) {
  const ph = Math.round(px * h / w);
  const tex = canvasTexture(px, ph, (ctx, cw, ch) => {
    ctx.fillStyle = bg; roundRect(ctx, 0, 0, cw, ch, 30); ctx.fill();
    ctx.lineWidth = 12; ctx.strokeStyle = border; roundRect(ctx, 8, 8, cw - 16, ch - 16, 26); ctx.stroke();
    const { lines, size: s } = fitText(ctx, text, cw - 80, ch - 60, size, 28);
    ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    lines.forEach((ln, i) => ctx.fillText(ln, cw / 2, ch / 2 + (i - (lines.length - 1) / 2) * s * 1.22));
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
}

// ------------------------------------------------------------ puzzle panel
const PW = 1024, PH = 1280;
class Panel {
  constructor(game, { title, count, onSolved, doneText = 'Unlocked!', width = 0.9 }) {
    Object.assign(this, { game, title, count, onSolved, doneText });
    this.solved = 0; this.input = ''; this.wrong = 0; this.msg = ''; this.msgColor = '#fff';
    this.hoverId = null; this.busyUntil = 0; this.after = null; this.state = 'solving';
    this.canvas = document.createElement('canvas'); this.canvas.width = PW; this.canvas.height = PH;
    this.ctx = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 8;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width * PH / PW), new THREE.MeshBasicMaterial({ map: this.tex, transparent: true }));
    this.mesh.userData.panel = this;
    this.newProblem();
  }
  newProblem() {
    this.problem = this.game.source.next();
    this.input = ''; this.wrong = 0; this.msg = ''; this.firstTry = true;
    this.draw();
  }
  layoutButtons() {
    const b = [], g4 = this.game.opts.grade === 4;
    b.push({ id: 'read', label: 'Read', x: 600, y: 18, w: 190, h: 76, kind: 'tool' });
    b.push({ id: 'hint', label: 'Hint', x: 810, y: 18, w: 190, h: 76, kind: 'tool' });
    if (this.state !== 'solving') return b;
    const p = this.problem;
    if (p.choices) {
      const short = p.choices.every((c) => c.length <= 2), n = p.choices.length;
      if (short) {
        const bw = Math.min(280, (940 - (n - 1) * 30) / n), x0 = (PW - (n * bw + (n - 1) * 30)) / 2;
        p.choices.forEach((c, i) => b.push({ id: `choice:${c}`, label: c, x: x0 + i * (bw + 30), y: 700, w: bw, h: 260, kind: 'choice', big: true }));
      } else {
        const bh = Math.min(120, (560 - (n - 1) * 24) / n);
        p.choices.forEach((c, i) => b.push({ id: `choice:${c}`, label: c, x: 112, y: 640 + i * (bh + 24), w: 800, h: bh, kind: 'choice' }));
      }
      return b;
    }
    const rows = g4
      ? [['1', '2', '3', '⌫'], ['4', '5', '6', '/'], ['7', '8', '9', '.'], ['C', '0', 'OK']]
      : [['1', '2', '3', '⌫'], ['4', '5', '6', 'C'], ['7', '8', '9', '0'], ['OK']];
    const kw = 222, kh = 105, gap = 15, x0 = (PW - (4 * kw + 3 * gap)) / 2, y0 = 790;
    rows.forEach((row, r) => {
      let col = 0;
      row.forEach((k) => {
        const span = k === 'OK' ? 4 - (row.length - 1) : 1;
        b.push({ id: k, label: k === 'OK' ? 'OK  ✓' : k, x: x0 + col * (kw + gap), y: y0 + r * (kh + gap), w: span * kw + (span - 1) * gap, h: kh, kind: k === 'OK' ? 'ok' : /\d/.test(k) ? 'digit' : 'tool' });
        col += span;
      });
    });
    return b;
  }
  draw() {
    const ctx = this.ctx, p = this.problem;
    this.buttons = this.layoutButtons();
    ctx.clearRect(0, 0, PW, PH);
    // parchment board with gold frame
    const grd = ctx.createLinearGradient(0, 0, 0, PH); grd.addColorStop(0, '#2b1a4a'); grd.addColorStop(1, '#1a1030');
    ctx.fillStyle = grd; roundRect(ctx, 0, 0, PW, PH, 48); ctx.fill();
    ctx.lineWidth = 14; ctx.strokeStyle = '#e0b84a'; roundRect(ctx, 7, 7, PW - 14, PH - 14, 44); ctx.stroke();
    // header: title + progress gems
    ctx.fillStyle = '#ffe9a8'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.font = `bold 46px ${FONT}`; ctx.fillText(this.title, 40, 58);
    for (let i = 0; i < this.count; i++) drawGem(ctx, 60 + i * 64, 136, 24, i < this.solved ? '#4dff9a' : '#55506a');
    if (this.state === 'done') {
      ctx.textAlign = 'center'; ctx.fillStyle = '#4dff9a'; ctx.font = `bold 120px ${FONT}`;
      ctx.fillText(this.doneText.split('\n')[0], PW / 2, 560);
      if (this.doneText.includes('\n')) { ctx.font = `bold 64px ${FONT}`; ctx.fillStyle = '#ffe9a8'; ctx.fillText(this.doneText.split('\n')[1], PW / 2, 700); }
      this.tex.needsUpdate = true; return;
    }
    // question
    ctx.fillStyle = '#fff8e6'; roundRect(ctx, 40, 180, PW - 80, 380, 30); ctx.fill();
    const { lines, size } = fitText(ctx, p.text, PW - 160, 340, 104, 34);
    ctx.fillStyle = '#2b1a4a'; ctx.textAlign = 'center';
    const top = 372 - (lines.length - 1) * size * 0.61;
    lines.forEach((ln, i) => ctx.fillText(ln, PW / 2, top + i * size * 1.22));
    if (p.homework) { ctx.font = `bold 30px ${FONT}`; ctx.fillStyle = '#8a5cff'; ctx.fillText('HOMEWORK', PW / 2, 210); }
    // answer box (typed problems)
    if (!p.choices) {
      ctx.fillStyle = '#ffffff'; roundRect(ctx, 212, 578, 600, 100, 24); ctx.fill();
      ctx.lineWidth = 6; ctx.strokeStyle = '#e0b84a'; ctx.stroke();
      ctx.fillStyle = this.input ? '#1a1030' : '#aaa'; ctx.font = `bold 80px ${FONT}`;
      ctx.fillText(this.input || '?', PW / 2, 630);
    }
    // feedback message
    if (this.msg) {
      const choiceBottom = Math.max(0, ...this.buttons.filter((b) => b.kind === 'choice').map((b) => b.y + b.h));
      const [y, hgt] = p.choices ? [choiceBottom + 25, PH - choiceBottom - 50] : [688, 92];
      const f = fitText(ctx, this.msg, PW - 90, hgt, p.choices ? 50 : 40, 24);
      ctx.fillStyle = this.msgColor;
      f.lines.forEach((ln, i) => ctx.fillText(ln, PW / 2, y + f.size * 0.6 + i * f.size * 1.22));
    }
    // buttons
    for (const b of this.buttons) {
      const hover = b.id === this.hoverId;
      const col = { ok: ['#23a55a', '#3fd57f'], digit: ['#3d2f6b', '#6a54b8'], tool: ['#6b3d2f', '#a9644d'], choice: ['#3d2f6b', '#6a54b8'] }[b.kind];
      ctx.fillStyle = hover ? col[1] : col[0]; roundRect(ctx, b.x, b.y, b.w, b.h, 22); ctx.fill();
      ctx.lineWidth = hover ? 8 : 4; ctx.strokeStyle = hover ? '#ffe9a8' : 'rgba(255,233,168,0.5)'; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
      ctx.font = `bold ${b.big ? 150 : b.kind === 'tool' && b.y < 100 ? 42 : 64}px ${FONT}`;
      ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 4);
    }
    this.tex.needsUpdate = true;
  }
  buttonAt(uv) {
    const x = uv.x * PW, y = (1 - uv.y) * PH;
    return this.buttons.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h)?.id ?? null;
  }
  hover(uv) { const id = uv ? this.buttonAt(uv) : null; if (id !== this.hoverId) { this.hoverId = id; this.draw(); } }
  press(uv) { const id = this.buttonAt(uv); if (id) this.pressKey(id); }
  pressKey(k) {
    const now = performance.now();
    if (this.state !== 'solving') return;
    if (k === 'read') { speak(this.problem.text); this.game.sfx.click(); return; }
    if (k === 'hint') { this.msg = `Hint: ${this.problem.hint}`; this.msgColor = '#ffd86b'; this.firstTry = false; this.game.sfx.click(); this.draw(); return; }
    if (now < this.busyUntil) return;
    this.game.sfx.click();
    if (k.startsWith('choice:')) return this.submit(k.slice(7));
    if (this.problem.choices) return;
    if (/^[0-9./]$/.test(k)) { if (this.input.length < 12) this.input += k; }
    else if (k === '⌫') this.input = this.input.slice(0, -1);
    else if (k === 'C') this.input = '';
    else if (k === 'OK') return this.submit(this.input);
    this.draw();
  }
  submit(val) {
    const g = this.game;
    if (!val) { this.msg = 'Type your answer, then press OK.'; this.msgColor = '#ffd86b'; this.draw(); return; }
    g.stats.attempts++;
    if (isCorrect(this.problem, val)) {
      g.sfx.correct(); g.stats.correct++; if (this.firstTry) g.stats.firstTry++;
      this.solved++;
      this.msg = ['Correct! Great job!', 'Yes! You got it!', 'Brilliant!', 'Awesome math!'][Math.floor(Math.random() * 4)];
      this.msgColor = '#4dff9a';
      g.burst(this.mesh.getWorldPosition(new THREE.Vector3()), 25);
      this.busyUntil = performance.now() + 1100;
      this.after = () => {
        if (this.solved >= this.count) { this.state = 'done'; this.draw(); this.onSolved?.(); } else this.newProblem();
      };
    } else {
      g.sfx.wrong(); this.wrong++; this.firstTry = false; this.input = '';
      g.stats.missed.push({ text: this.problem.text, answer: this.problem.answer, given: val });
      if (this.wrong === 1) { this.msg = 'Not quite. Try again!'; this.msgColor = '#ffb36b'; }
      else if (this.wrong === 2) { this.msg = `Hint: ${this.problem.hint}`; this.msgColor = '#ffd86b'; }
      else {
        this.msg = `The answer is ${this.problem.answer}. Let's try a new one!`; this.msgColor = '#ff9a9a';
        this.busyUntil = performance.now() + 3500; this.after = () => this.newProblem();
      }
    }
    this.draw();
  }
  update() {
    if (this.after && performance.now() >= this.busyUntil) { const f = this.after; this.after = null; f(); }
  }
}

// ------------------------------------------------------------ the game
export class Game {
  constructor(opts) {
    this.opts = opts; // { name, grade, moduleIds, perDoor, homework, homeworkOnly, smooth }
    this.source = new ProblemSource(opts);
    this.stats = { attempts: 0, correct: 0, firstTry: 0, missed: [], treasures: [] };
    this.sfx = new Sfx();
    this.reach = 0; // highest room index the player may enter
    this.panels = []; this.chests = []; this.doors = []; this.anims = []; this.particles = [];
    this.blockers = []; this.floors = [];
    this.panelY = 1.2;
    this.clock = new THREE.Clock();
    this.initRenderer();
    this.buildCastle();
    this.initControls();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  // ---------------------------------------------------------- setup
  initRenderer() {
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.setSize(window.innerWidth, window.innerHeight);
    r.xr.enabled = true;
    r.xr.setReferenceSpaceType('local-floor');
    r.xr.setFoveation(1);
    document.body.appendChild(r.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x120c1c);
    this.scene.fog = new THREE.Fog(0x120c1c, 14, 40);
    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 80);
    this.camera.rotation.order = 'YXZ';
    this.rig = new THREE.Group();
    this.rig.add(this.camera);
    this.scene.add(this.rig);
    this.rig.position.set(0, 0, zc(0) + 4.0);
    this.camera.position.y = 1.3; // desktop eye height; XR overrides with real head pose
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight; this.camera.updateProjectionMatrix();
      r.setSize(window.innerWidth, window.innerHeight);
    });
  }

  buildCastle() {
    const S = new StaticBatch(), scene = this.scene;
    const M = (o) => new THREE.MeshLambertMaterial(o);
    const stone = M({ map: stoneTex() }), stoneDark = M({ map: stoneTex([95, 88, 80]) });
    const woodFloor = M({ map: woodTex([110, 72, 40]) }), wood = M({ map: woodTex([92, 56, 30]) }), woodDark = M({ map: woodTex([60, 38, 22]) });
    const iron = M({ color: 0x2c2c33 }), gold = M({ color: 0xd9a627, emissive: 0x2a1c00 }), red = M({ color: 0x9c1b24 });
    const flame = new THREE.MeshBasicMaterial({ color: 0xffa640 }); flame.userData.noBlock = true;
    this.flameMat = flame;
    const glass = new THREE.MeshBasicMaterial({ map: canvasTexture(256, 512, (ctx, w, h) => {
      const cols = ['#e53935', '#1e88e5', '#fdd835', '#43a047', '#8e24aa', '#fb8c00'];
      for (let y = 0; y < h; y += 64) for (let x = 0; x < w; x += 64) { ctx.fillStyle = cols[Math.floor(Math.random() * cols.length)]; ctx.fillRect(x, y, 64, 64); }
      ctx.strokeStyle = '#111'; ctx.lineWidth = 8; for (let x = 0; x <= w; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); } for (let y = 0; y <= h; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      ctx.globalCompositeOperation = 'destination-in'; ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(0, w / 2); ctx.arc(w / 2, w / 2, w / 2, Math.PI, 0); ctx.lineTo(w, h); ctx.fill();
    }), transparent: true });
    const floorMats = { stone: M({ map: stoneTex([110, 104, 98]) }), wood: woodFloor };
    const carpet = M({ color: 0x8e1b2b }); carpet.userData.noBlock = true;
    const plane = (w, h) => tileUV(new THREE.PlaneGeometry(w, h), [w, h], 2);

    this.scene.add(new THREE.HemisphereLight(0xfff2dd, 0x3a2a1a, 1.4));
    this.roomLights = [];

    ROOMS.forEach((room, i) => {
      const z = zc(i);
      // floor (kept separate so teleport rays know where the ground is)
      const floor = new THREE.Mesh(plane(W, L), floorMats[room.floor]);
      floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, z);
      floor.userData.floor = true; scene.add(floor); this.floors.push(floor);
      S.add(plane(1.8, L - 0.6), carpet, [0, 0.006, z], [-Math.PI / 2, 0, 0]);
      // ceiling + beams
      S.add(plane(W, L), woodDark, [0, H, z], [Math.PI / 2, 0, 0]);
      for (let k = -2; k <= 2; k++) S.box(W, 0.3, 0.3, woodDark, [0, H - 0.15, z + k * 2], [0, 0, 0], 2);
      // side walls
      for (const s of [-1, 1]) S.box(WALL_T, H, L + WALL_T, stone, [s * (W / 2 + WALL_T / 2), H / 2, z], [0, 0, 0], 2);
      // corner pillars
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) S.add(new THREE.CylinderGeometry(0.28, 0.32, H, 12), stoneDark, [sx * (W / 2 - 0.3), H / 2, z + sz * (L / 2 - 0.3)]);
      // torches on side walls
      for (const s of [-1, 1]) for (const dz of [-2.6, 2.6]) {
        S.box(0.08, 0.5, 0.08, iron, [s * (W / 2 - 0.12), 2.3, z + dz], [0, 0, s * 0.35]);
        S.add(new THREE.CylinderGeometry(0.1, 0.06, 0.12, 8), iron, [s * (W / 2 - 0.2), 2.55, z + dz]);
        S.add(new THREE.ConeGeometry(0.08, 0.28, 8), flame, [s * (W / 2 - 0.2), 2.74, z + dz]);
      }
      // banners
      const bannerMat = new THREE.MeshLambertMaterial({ map: canvasTexture(256, 512, (ctx, w, h) => {
        ctx.fillStyle = room.banner; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w, 0); ctx.lineTo(w, h); ctx.lineTo(w / 2, h - 80); ctx.lineTo(0, h); ctx.fill();
        ctx.fillStyle = '#ffd54a'; ctx.fillRect(0, 0, w, 24);
        ctx.font = 'bold 150px serif'; ctx.textAlign = 'center'; ctx.fillText(['♔', '♕', '♖', '♘', '✦', '♛'][i], w / 2, 250);
      }), transparent: true, side: THREE.DoubleSide });
      bannerMat.userData.noBlock = true;
      for (const s of [-1, 1]) S.add(new THREE.PlaneGeometry(0.9, 1.8), bannerMat, [s * (W / 2 - 0.03), 3.3, z], [0, -s * Math.PI / 2, 0]);
      // room light
      const light = new THREE.PointLight(room.light, 18, 13, 1.2);
      light.position.set(0, 3.9, z); scene.add(light); this.roomLights.push(light);

      // front wall (between room i and i+1) with a doorway, or solid at the end
      const wz = wallZ(i) - WALL_T / 2;
      if (i < LAST) {
        const sw = (W - DOOR_W) / 2;
        for (const s of [-1, 1]) S.box(sw, H, WALL_T, stone, [s * (DOOR_W / 2 + sw / 2), H / 2, wz], [0, 0, 0], 2);
        S.box(DOOR_W, H - DOOR_H, WALL_T, stone, [0, DOOR_H + (H - DOOR_H) / 2, wz], [0, 0, 0], 2);
        for (const s of [-1, 1]) S.box(0.2, DOOR_H + 0.2, WALL_T + 0.1, stoneDark, [s * (DOOR_W / 2 + 0.1), (DOOR_H + 0.2) / 2, wz], [0, 0, 0], 1);
        S.box(DOOR_W + 0.4, 0.2, WALL_T + 0.1, stoneDark, [0, DOOR_H + 0.1, wz], [0, 0, 0], 1);
      } else {
        S.box(W, H, WALL_T, stone, [0, H / 2, wz], [0, 0, 0], 2);
      }
      if (i === 0) S.box(W, H, WALL_T, stone, [0, H / 2, zc(0) + L / 2 + WALL_T / 2], [0, 0, 0], 2);
      // stained-glass windows on rooms without shelves on that wall
      if (i !== 2) for (const s of [-1, 1]) for (const dz of [-3.8, 3.8]) if (!(i === 3 && s === -1)) S.add(new THREE.PlaneGeometry(0.9, 1.8), glass, [s * (W / 2 - 0.02), 2.9, z + dz], [0, -s * Math.PI / 2, 0]);
    });
    glass.userData.noBlock = true;

    this.decorate(S, { stone, stoneDark, wood, woodDark, iron, gold, red, flame, M });
    S.build(scene, this.blockers);

    for (let i = 0; i < LAST; i++) this.makeDoor(i, { wood, iron, gold });
    for (let i = 0; i < LAST; i++) this.makeChest(i);
    this.makeFinale(gold, red);
    this.makeWelcome();

    // teleport marker + pointer dot
    this.marker = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.3, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x66e0ff, transparent: true, opacity: 0.85 }));
    this.marker.visible = false; scene.add(this.marker);
  }

  decorate(S, m) {
    const { stoneDark, wood, woodDark, iron, gold, red, flame, M } = m;
    // Room 0 - Entrance: bluebonnet planters + knight statues
    const z0 = zc(0);
    const leaf = M({ color: 0x2f7d32 }), blue = M({ color: 0x2a5bd7 }), white = M({ color: 0xf2f2f2 });
    for (const [x, zz] of [[-3.2, 3.5], [3.2, 3.5], [-3.2, -3.4], [3.2, -3.4]]) {
      S.box(1.0, 0.5, 0.6, stoneDark, [x, 0.25, z0 + zz], [0, 0, 0], 1);
      for (let k = 0; k < 9; k++) {
        const px = x - 0.38 + (k % 3) * 0.38, pz = z0 + zz - 0.18 + Math.floor(k / 3) * 0.18, hgt = 0.3 + Math.random() * 0.2;
        S.add(new THREE.CylinderGeometry(0.012, 0.012, hgt, 5), leaf, [px, 0.5 + hgt / 2, pz]);
        S.add(new THREE.ConeGeometry(0.06, 0.22, 7), blue, [px, 0.5 + hgt + 0.08, pz]);
        S.add(new THREE.SphereGeometry(0.025, 6, 4), white, [px, 0.5 + hgt + 0.2, pz]);
      }
    }
    const statue = M({ color: 0x9a9aa8 });
    for (const s of [-1, 1]) {
      const x = s * 1.7, zz = z0 - 4.2;
      S.box(0.7, 0.4, 0.7, stoneDark, [x, 0.2, zz], [0, 0, 0], 1);
      S.add(new THREE.CylinderGeometry(0.22, 0.28, 1.0, 10), statue, [x, 0.9, zz]);
      S.add(new THREE.SphereGeometry(0.17, 12, 8), statue, [x, 1.55, zz]);
      S.box(0.06, 1.6, 0.06, iron, [x + s * 0.35, 1.2, zz]);
      S.add(new THREE.ConeGeometry(0.09, 0.3, 4), iron, [x + s * 0.35, 2.1, zz]);
    }
    // Room 1 - Great Hall: feast table, benches, goblets, chandelier
    const z1 = zc(1);
    S.box(1.1, 0.08, 5.5, wood, [-2.5, 0.76, z1], [0, 0, 0], 1);
    for (const dz of [-2.4, 2.4]) for (const dx of [-0.4, 0.4]) S.box(0.1, 0.72, 0.1, woodDark, [-2.5 + dx, 0.36, z1 + dz]);
    for (const dx of [-0.85, 0.85]) { S.box(0.35, 0.06, 5.2, wood, [-2.5 + dx, 0.45, z1], [0, 0, 0], 1); for (const dz of [-2.3, 2.3]) S.box(0.08, 0.42, 0.25, woodDark, [-2.5 + dx, 0.21, z1 + dz]); }
    for (let k = 0; k < 8; k++) {
      const zz = z1 - 2.4 + k * 0.68, x = -2.5 + (k % 2 ? 0.3 : -0.3);
      S.add(new THREE.CylinderGeometry(0.05, 0.03, 0.14, 8), gold, [x, 0.87, zz]);
      S.add(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 12), M({ color: 0xdddddd }), [x * 0 - 2.5, 0.815, zz]);
    }
    S.add(new THREE.SphereGeometry(0.12, 10, 8), red, [-2.5, 0.9, z1 - 0.4]); S.add(new THREE.SphereGeometry(0.1, 10, 8), M({ color: 0x5fbf3f }), [-2.4, 0.88, z1 + 0.3]);
    S.add(new THREE.TorusGeometry(1.0, 0.05, 8, 32), gold, [0, 3.6, z1], [Math.PI / 2, 0, 0]);
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; S.add(new THREE.CylinderGeometry(0.04, 0.04, 0.2, 6), white, [Math.cos(a), 3.72, z1 + Math.sin(a)]); S.add(new THREE.ConeGeometry(0.035, 0.1, 6), flame, [Math.cos(a), 3.87, z1 + Math.sin(a)]); }
    S.add(new THREE.CylinderGeometry(0.02, 0.02, 1.3, 4), iron, [0, 4.3, z1]);
    // Room 2 - Library: bookshelves, globe
    const z2 = zc(2), bookMats = [0x8e2430, 0x1f4e8c, 0x2e7d32, 0x6a3d9a, 0xb8860b].map((c) => M({ color: c }));
    const shelf = (x, zz, len, face) => {
      S.box(0.45, 3.2, len, woodDark, [x, 1.6, zz], [0, 0, 0], 1);
      for (let r = 0; r < 5; r++) {
        const y = 0.2 + r * 0.62;
        S.box(0.5, 0.05, len, wood, [x - face * 0.02, y, zz], [0, 0, 0], 1);
        let p = zz - len / 2 + 0.06;
        while (p < zz + len / 2 - 0.1) {
          const bw = 0.05 + Math.random() * 0.05, bh = 0.34 + Math.random() * 0.18;
          S.box(0.3, bh, bw, bookMats[Math.floor(Math.random() * bookMats.length)], [x - face * 0.08, y + bh / 2 + 0.025, p + bw / 2]);
          p += bw + 0.008;
        }
      }
    };
    shelf(W / 2 - 0.25, z2 - 2, 4.5, 1); shelf(W / 2 - 0.25, z2 + 3, 2.6, 1);
    shelf(-W / 2 + 0.25, z2 - 3.1, 2.4, -1); shelf(-W / 2 + 0.25, z2 + 3.2, 2.2, -1);
    S.add(new THREE.CylinderGeometry(0.05, 0.25, 0.9, 10), woodDark, [2.4, 0.45, z2 + 0.8]);
    S.add(new THREE.SphereGeometry(0.35, 20, 14), M({ color: 0x3f7fbf }), [2.4, 1.2, z2 + 0.8]);
    S.add(new THREE.TorusGeometry(0.4, 0.02, 6, 32), gold, [2.4, 1.2, z2 + 0.8], [0, Math.PI / 2, 0.4]);
    // Room 3 - Armory: suits of armor, shields, weapon rack
    const z3 = zc(3), steel = M({ color: 0x7f8799, emissive: 0x0a0a10 });
    for (const dz of [-3, 0, 3]) {
      const x = -3.2, zz = z3 + dz;
      S.box(0.6, 0.15, 0.6, stoneDark, [x, 0.075, zz], [0, 0, 0], 1);
      for (const ly of [-0.1, 0.1]) S.add(new THREE.CylinderGeometry(0.07, 0.08, 0.8, 8), steel, [x, 0.55, zz + ly]);
      S.add(new THREE.CylinderGeometry(0.2, 0.16, 0.7, 10), steel, [x, 1.3, zz]);
      for (const ly of [-0.27, 0.27]) S.add(new THREE.CylinderGeometry(0.055, 0.055, 0.65, 8), steel, [x, 1.3, zz + ly]);
      S.add(new THREE.SphereGeometry(0.15, 12, 10), steel, [x, 1.82, zz]);
      S.box(0.02, 0.03, 0.2, iron, [x + 0.15, 1.83, zz]);
      S.add(new THREE.ConeGeometry(0.05, 0.25, 6), red, [x, 2.05, zz]);
    }
    const shieldCols = [0xc62828, 0x1565c0, 0xf9a825];
    [-3.2, 0, 3.2].forEach((dz, k) => {
      S.add(new THREE.CircleGeometry(0.4, 24), M({ color: shieldCols[k] }), [W / 2 - 0.05, 2.6, z3 + dz], [0, -Math.PI / 2, 0]);
      S.add(new THREE.RingGeometry(0.34, 0.4, 24), gold, [W / 2 - 0.06, 2.6, z3 + dz], [0, -Math.PI / 2, 0]);
      for (const s of [-1, 1]) S.box(0.03, 1.3, 0.06, steel, [W / 2 - 0.08, 2.6, z3 + dz], [s * 0.7, 0, 0]);
    });
    // Room 4 - Crystal Tower: glowing crystal clusters (animated ones are added separately)
    const z4 = zc(4), cryA = new THREE.MeshLambertMaterial({ color: 0x8fdcff, emissive: 0x2a6f99 }), cryB = new THREE.MeshLambertMaterial({ color: 0xd49bff, emissive: 0x5c2a8c });
    for (const [x, zz] of [[-3, -3.8], [3, -3.8], [3, 3.6], [-3, 3.6], [3.2, 0]]) {
      for (let k = 0; k < 6; k++) {
        const h = 0.4 + Math.random() * 1.1, ox = (Math.random() - 0.5) * 0.7, oz = (Math.random() - 0.5) * 0.7;
        S.add(new THREE.ConeGeometry(0.12 + Math.random() * 0.08, h, 6), k % 2 ? cryA : cryB, [x + ox, h / 2, z4 + zz + oz], [(Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.5]);
      }
    }
    this.floaters = [];
    for (let k = 0; k < 7; k++) {
      const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.12), k % 2 ? cryA : cryB);
      orb.position.set((Math.random() - 0.5) * 5, 2.2 + Math.random() * 1.8, z4 + (Math.random() - 0.5) * 7);
      orb.userData.base = orb.position.y; orb.userData.phase = Math.random() * 6;
      this.scene.add(orb); this.floaters.push(orb);
    }
    // Room 5 - Throne Room: throne, gold pillars
    const z5 = zc(5), velvet = M({ color: 0x6a0f2a });
    S.box(2.6, 0.3, 2.0, stoneDark, [0, 0.15, z5 - 3.8], [0, 0, 0], 1);
    S.box(1.3, 0.5, 0.9, gold, [0, 0.55, z5 - 3.9]);
    S.box(1.1, 0.12, 0.8, velvet, [0, 0.86, z5 - 3.85]);
    S.box(1.3, 2.2, 0.2, gold, [0, 1.4, z5 - 4.4]);
    S.box(1.0, 1.6, 0.05, velvet, [0, 1.5, z5 - 4.27]);
    for (const s of [-1, 1]) { S.box(0.15, 0.4, 0.9, gold, [s * 0.6, 1.0, z5 - 3.9]); S.add(new THREE.SphereGeometry(0.12, 12, 8), gold, [s * 0.6, 2.6, z5 - 4.4]); }
    for (const s of [-1, 1]) for (const zz of [-1.5, 1.5]) S.add(new THREE.CylinderGeometry(0.22, 0.22, H, 16), gold, [s * 2.6, H / 2, z5 + zz]);
  }

  makeDoor(i, { wood, iron, gold }) {
    const z = wallZ(i) - WALL_T / 2;
    const hinge = new THREE.Group(); hinge.position.set(-DOOR_W / 2, 0, z);
    const leaf = new THREE.Mesh(tileUV(new THREE.BoxGeometry(DOOR_W, DOOR_H, 0.14), [DOOR_W, DOOR_H, 0.14], 1.2), wood);
    leaf.position.set(DOOR_W / 2, DOOR_H / 2, 0); hinge.add(leaf);
    for (const y of [0.5, 1.6, 2.7]) { const band = new THREE.Mesh(new THREE.BoxGeometry(DOOR_W - 0.1, 0.12, 0.18), iron); band.position.set(DOOR_W / 2, y, 0); hinge.add(band); }
    const lock = new THREE.Group(); lock.position.set(DOOR_W - 0.35, 1.25, 0.12);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.26, 0.08), gold); lock.add(body);
    const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.025, 8, 16, Math.PI), gold); shackle.position.y = 0.13; lock.add(shackle);
    hinge.add(lock);
    const lights = [];
    const n = this.opts.perDoor;
    for (let k = 0; k < n; k++) {
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.07), new THREE.MeshLambertMaterial({ color: 0x555566 }));
      gem.position.set(DOOR_W / 2 + (k - (n - 1) / 2) * 0.22, 2.25, 0.12); hinge.add(gem); lights.push(gem);
    }
    this.scene.add(hinge);
    this.blockers.push(leaf);
    const sign = makeSign(`To the ${ROOMS[i + 1].name}`, { w: 2.6, h: 0.5 });
    sign.position.set(0, DOOR_H + 0.55, wallZ(i) + 0.02); this.scene.add(sign);

    const door = { i, hinge, lock, lights, open: false };
    const panel = new Panel(this, { title: `Magic Lock ${i + 1}`, count: n, doneText: 'Unlocked!', onSolved: () => this.openDoor(door) });
    panel.mesh.position.set(0, this.panelY, wallZ(i) + 1.5);
    panel.fixedHeight = true;
    const origUpdate = panel.update.bind(panel);
    panel.update = () => { origUpdate(); lights.forEach((g, k) => { const on = k < panel.solved; g.material.color.setHex(on ? 0x4dff9a : 0x555566); g.material.emissive?.setHex(on ? 0x1f8a4a : 0); }); };
    this.scene.add(panel.mesh); this.panels.push(panel);
    door.panel = panel;
    this.doors.push(door);
  }

  openDoor(door) {
    door.open = true;
    this.sfx.door();
    this.reach = Math.max(this.reach, door.i + 1);
    this.updateHud();
    this.burst(new THREE.Vector3(0, 1.6, wallZ(door.i) + 0.3), 70);
    this.animate(0.8, (t) => { door.lock.position.y = 1.25 - t * 1.2; door.lock.rotation.z = t * 2; }, () => { door.lock.visible = false; });
    this.animate(2.0, (t) => { door.hinge.rotation.y = (1 - (1 - t) ** 3) * 1.65; }, null, 0.4);
    this.retirePanel(door.panel, 1.4);
  }

  retirePanel(panel, delay) {
    this.animate(0.5, (t) => panel.mesh.scale.setScalar(Math.max(0.001, 1 - t)), () => { panel.mesh.visible = false; }, delay);
  }

  makeChest(i, big = false) {
    const s = big ? 1.7 : 1;
    const g = new THREE.Group();
    const woodM = new THREE.MeshLambertMaterial({ color: 0x7a4a22 }), goldM = new THREE.MeshLambertMaterial({ color: 0xe0b23a, emissive: 0x3a2800 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.6), woodM); base.position.y = 0.25; g.add(base);
    for (const x of [-0.35, 0.35]) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.52, 0.62), goldM); t.position.set(x, 0.25, 0); g.add(t); }
    const lidPivot = new THREE.Group(); lidPivot.position.set(0, 0.5, -0.3); g.add(lidPivot);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 16, 1, false, 0, Math.PI).rotateZ(Math.PI / 2), woodM);
    lid.position.set(0, 0, 0.3); lid.scale.set(1, 0.6, 1); lidPivot.add(lid);
    const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.04), goldM); clasp.position.set(0, 0.45, 0.31); g.add(clasp);
    g.scale.setScalar(s);
    const [tName, tColor] = big ? ['Royal Crown', 0xffd700] : TREASURES[i % TREASURES.length];
    const prize = big ? this.makeCrown() : new THREE.Mesh(new THREE.OctahedronGeometry(0.14), new THREE.MeshStandardMaterial({ color: tColor, emissive: tColor, emissiveIntensity: 0.5, metalness: 0.3, roughness: 0.2 }));
    prize.visible = false; this.scene.add(prize);
    const q = makeSign('?', { w: 0.35, h: 0.35, bg: 'rgba(0,0,0,0)', border: 'rgba(0,0,0,0)', fg: '#ffd54a', size: 300, px: 256 });
    q.position.y = 1.15; g.add(q);
    const chest = { i, group: g, lidPivot, prize, tName, q, opened: false, panel: null, big };
    g.traverse((o) => { if (o.isMesh) o.userData.chest = chest; });
    if (!big) {
      const x = i % 2 ? 2.8 : -2.8;
      g.position.set(x, 0, zc(i) + 0.8);
      g.rotation.y = x > 0 ? -Math.PI / 2 : Math.PI / 2;
    }
    this.scene.add(g);
    this.chests.push(chest);
    return chest;
  }

  makeCrown() {
    const crown = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0x6a4a00, metalness: 0.6, roughness: 0.25 });
    crown.add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.14, 24, 1, true), m));
    for (let k = 0; k < 6; k++) {
      const a = k / 6 * Math.PI * 2, spike = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 6), m);
      spike.position.set(Math.cos(a) * 0.19, 0.14, Math.sin(a) * 0.19); crown.add(spike);
      const jewel = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshBasicMaterial({ color: TREASURES[k % 5][1] }));
      jewel.position.set(Math.cos(a) * 0.205, 0.0, Math.sin(a) * 0.205); crown.add(jewel);
    }
    return crown;
  }

  openChestPanel(chest) {
    if (chest.opened || chest.panel) return;
    const head = this.headPos(), pos = chest.group.getWorldPosition(new THREE.Vector3());
    const dir = pos.clone().sub(head).setY(0); const dist = dir.length(); dir.normalize();
    const p = head.clone().addScaledVector(dir, clamp(dist - 0.9, 0.9, 1.4));
    const panel = new Panel(this, { title: 'Treasure Chest', count: 1, doneText: `You found a\n${chest.tName}!`, onSolved: () => this.openChest(chest) });
    panel.mesh.position.set(p.x, this.panelY, p.z);
    panel.mesh.lookAt(head.x, this.panelY, head.z);
    panel.mesh.scale.setScalar(0.01);
    this.animate(0.3, (t) => panel.mesh.scale.setScalar(Math.max(0.01, t)));
    this.scene.add(panel.mesh); this.panels.push(panel);
    chest.panel = panel;
    this.sfx.click();
  }

  openChest(chest) {
    chest.opened = true; chest.q.visible = false;
    this.sfx.chest();
    const wp = chest.group.getWorldPosition(new THREE.Vector3());
    this.animate(0.8, (t) => { chest.lidPivot.rotation.x = -1.9 * (1 - (1 - t) ** 2); });
    this.burst(wp.clone().setY(0.8), 60);
    const prize = chest.prize;
    prize.position.copy(wp).setY(chest.big ? 1.0 : 0.5); prize.visible = true;
    this.stats.treasures.push(chest.tName);
    if (chest.big) return this.victory(chest);
    this.animate(1.4, (t) => { prize.position.y = 0.5 + t * 1.0; prize.rotation.y = t * 8; }, () => {
      const from = prize.position.clone();
      this.animate(0.8, (t) => { prize.position.lerpVectors(from, this.headPos().setY(this.headPos().y - 0.3), t * t); prize.scale.setScalar(1 - t * 0.7); }, () => {
        prize.visible = false; this.sfx.gem(); this.updateHud();
      });
    }, 0.3);
    this.retirePanel(chest.panel, 2.2);
  }

  makeFinale() {
    const z = zc(LAST);
    const chest = this.makeChest(LAST, true);
    chest.group.position.set(0, 0, z - 1.8);
    const panel = new Panel(this, { title: 'The Royal Treasure', count: this.opts.perDoor + 1, doneText: 'VICTORY!', onSolved: () => this.openChest(chest) });
    panel.mesh.position.set(0, this.panelY, z + 0.2);
    panel.fixedHeight = true;
    this.scene.add(panel.mesh); this.panels.push(panel);
    chest.panel = panel; chest.q.visible = false;
    this.finalChest = chest;
  }

  makeWelcome() {
    const n = this.opts.name || 'Explorer';
    const text = `Welcome to Numeria, ${n}!\nSolve the magic locks to open each door.\nClick the treasure chests to win gems.\nReach the Throne Room and claim the Crown!`;
    const sign = makeSign(text, { w: 2.4, h: 1.25, size: 70, px: 1024 });
    sign.position.set(-2.2, 1.95, zc(0) + 2.3); sign.rotation.y = 0.55;
    this.scene.add(sign);
    const help = makeSign('Point + pull trigger (or pinch) to press buttons.\nPoint at the floor + trigger to teleport.\nLeft stick walks, right stick turns.', { w: 2.2, h: 0.8, size: 56, bg: '#1f2a44', border: '#7fb2ff', fg: '#e8f0ff' });
    help.position.set(2.2, 1.75, zc(0) + 2.3); help.rotation.y = -0.55;
    this.scene.add(help);
    const title = makeSign('Crown of Numeria', { w: 3.6, h: 0.6, size: 130, bg: '#2b1a4a', fg: '#ffd54a' });
    title.position.set(0, 4.45, wallZ(0) + 0.03);
    this.scene.add(title);
  }

  victory(chest) {
    this.sfx.fanfare();
    const z = zc(LAST), crown = chest.prize;
    this.animate(2.5, (t) => { crown.position.y = 1.0 + t * 1.2; crown.rotation.y = t * 10; });
    for (let k = 0; k < 6; k++) setTimeout(() => this.burst(new THREE.Vector3((Math.random() - 0.5) * 5, 2.5 + Math.random(), z - Math.random() * 3), 90), k * 350);
    const s = this.stats, pct = s.attempts ? Math.round(100 * s.correct / s.attempts) : 100;
    this.saveProgress();
    const vp = new Panel(this, { title: 'Castle Conquered!', count: 0 });
    vp.state = 'victory';
    vp.draw = () => {
      const ctx = vp.ctx;
      ctx.clearRect(0, 0, PW, PH);
      ctx.fillStyle = '#2b1a4a'; roundRect(ctx, 0, 0, PW, PH, 48); ctx.fill();
      ctx.lineWidth = 14; ctx.strokeStyle = '#e0b84a'; roundRect(ctx, 7, 7, PW - 14, PH - 14, 44); ctx.stroke();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffd54a'; ctx.font = `bold 84px ${FONT}`; ctx.fillText('You did it,', PW / 2, 140);
      ctx.fillText(`${this.opts.name || 'Explorer'}!`, PW / 2, 240);
      ctx.fillStyle = '#fff'; ctx.font = `bold 52px ${FONT}`;
      ctx.fillText('The Crown of Numeria is yours!', PW / 2, 360);
      ctx.font = `44px ${FONT}`;
      ctx.fillText(`Problems solved: ${s.correct}`, PW / 2, 480);
      ctx.fillText(`Right on the first try: ${s.firstTry}`, PW / 2, 550);
      ctx.fillText(`Treasures found: ${s.treasures.length}`, PW / 2, 620);
      const p = this.progress;
      ctx.fillText(`Castles conquered so far: ${p.castles}`, PW / 2, 690);
      s.treasures.filter((t) => t !== 'Royal Crown').forEach((t, k, arr) => drawGem(ctx, PW / 2 + (k - (arr.length - 1) / 2) * 90, 800, 34, '#' + (TREASURES.find((x) => x[0] === t)?.[1] ?? 0xffffff).toString(16).padStart(6, '0')));
      vp.buttons = [{ id: 'again', label: 'Play Again', x: 262, y: 1000, w: 500, h: 150, kind: 'ok' }];
      const b = vp.buttons[0], hov = vp.hoverId === 'again';
      ctx.fillStyle = hov ? '#3fd57f' : '#23a55a'; roundRect(ctx, b.x, b.y, b.w, b.h, 30); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `bold 72px ${FONT}`; ctx.fillText(b.label, PW / 2, b.y + b.h / 2);
      vp.tex.needsUpdate = true;
    };
    vp.pressKey = (k) => { if (k === 'again') { this.sfx.click(); this.onPlayAgain?.(); } };
    vp.draw();
    vp.mesh.position.set(0, this.panelY + 0.1, z + 0.2);
    vp.mesh.scale.setScalar(0.01);
    this.animate(0.5, (t) => vp.mesh.scale.setScalar(Math.max(0.01, t)), null, 1.5);
    this.scene.add(vp.mesh); this.panels.push(vp);
    this.retirePanel(chest.panel, 1.2);
    this.onVictory?.(s, pct);
  }

  saveProgress() {
    const key = `mathcastle.progress.${(this.opts.name || 'Explorer').toLowerCase()}`;
    const p = JSON.parse(localStorage.getItem(key) || '{"castles":0,"gems":0,"solved":0}');
    p.castles++; p.gems += this.stats.treasures.length; p.solved += this.stats.correct;
    localStorage.setItem(key, JSON.stringify(p));
    this.progress = p;
  }

  // ---------------------------------------------------------- effects
  animate(dur, fn, done = null, delay = 0) { this.anims.push({ t: -delay, dur, fn, done }); }
  burst(pos, n = 40) {
    const cols = [0xffd54a, 0xff5c8a, 0x5ce1ff, 0x7dff6b, 0xc58bff, 0xffffff];
    for (let k = 0; k < n; k++) {
      const m = new THREE.Mesh(this._confGeo ??= new THREE.PlaneGeometry(0.035, 0.035), new THREE.MeshBasicMaterial({ color: cols[k % cols.length], side: THREE.DoubleSide }));
      m.position.copy(pos);
      m.userData.v = new THREE.Vector3((Math.random() - 0.5) * 3, 1.5 + Math.random() * 2.5, (Math.random() - 0.5) * 3);
      m.userData.life = 1.6 + Math.random() * 0.8;
      m.userData.spin = new THREE.Vector3(Math.random() * 10, Math.random() * 10, 0);
      this.scene.add(m); this.particles.push(m);
    }
  }

  // ---------------------------------------------------------- HUD
  makeHudTexture() {
    this.hudCanvas = document.createElement('canvas'); this.hudCanvas.width = 256; this.hudCanvas.height = 96;
    this.hudTex = new THREE.CanvasTexture(this.hudCanvas); this.hudTex.colorSpace = THREE.SRGBColorSpace;
    this.hudMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.045), new THREE.MeshBasicMaterial({ map: this.hudTex, transparent: true, depthTest: false }));
    this.hudMesh.renderOrder = 10;
    this.hudMesh.position.set(0, 0.05, 0.02); this.hudMesh.rotation.x = -0.6;
    this.updateHud();
  }
  updateHud() {
    const n = this.stats.treasures.filter((t) => t !== 'Royal Crown').length;
    const el = document.getElementById('hud'); if (el) el.textContent = `Gems: ${n}   Doors: ${this.reach}/${LAST}`;
    if (!this.hudCanvas) return;
    const ctx = this.hudCanvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 96);
    ctx.fillStyle = 'rgba(30,20,60,0.85)'; roundRect(ctx, 0, 0, 256, 96, 24); ctx.fill();
    drawGem(ctx, 50, 50, 28, '#e0115f');
    ctx.fillStyle = '#fff'; ctx.font = `bold 58px ${FONT}`; ctx.textBaseline = 'middle'; ctx.fillText(`× ${n}`, 100, 52);
    this.hudTex.needsUpdate = true;
  }

  // ---------------------------------------------------------- controls
  initControls() {
    this.raycaster = new THREE.Raycaster(); this.raycaster.far = 30;
    this.pointers = [];
    this.makeHudTexture();
    const wandMat = new THREE.MeshLambertMaterial({ color: 0x5a3a8a }), starMat = new THREE.MeshBasicMaterial({ color: 0xffe066 });
    const jointGeo = new THREE.SphereGeometry(1, 8, 6), jointMat = new THREE.MeshLambertMaterial({ color: 0xf1c8a8 });
    for (let i = 0; i < 2; i++) {
      const c = this.renderer.xr.getController(i);
      const rayGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
      const ray = new THREE.Line(rayGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }));
      c.add(ray);
      const wand = new THREE.Group();
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.22, 8).rotateX(Math.PI / 2), wandMat); stick.position.z = -0.05; wand.add(stick);
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.02), starMat); star.position.z = -0.17; wand.add(star);
      c.add(wand);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe066 }));
      dot.visible = false; this.scene.add(dot);
      const ptr = { c, ray, wand, dot, src: null, hit: null, turnArmed: true };
      c.addEventListener('connected', (e) => {
        ptr.src = e.data; wand.visible = !e.data.hand;
        if (e.data.handedness === 'left') c.add(this.hudMesh);
      });
      c.addEventListener('disconnected', () => { ptr.src = null; dot.visible = false; });
      c.addEventListener('selectstart', () => this.select(ptr));
      this.rig.add(c);
      const hand = this.renderer.xr.getHand(i);
      hand.userData.jointGeo = jointGeo; hand.userData.jointMat = jointMat;
      this.rig.add(hand);
      ptr.hand = hand;
      this.pointers.push(ptr);
    }
    // desktop: mouse look + WASD + click
    this.keys = new Set();
    this.desktopPtr = { desktop: true, hit: null };
    const canvas = this.renderer.domElement;
    canvas.addEventListener('click', () => {
      this.sfx.resume();
      if (this.renderer.xr.isPresenting) return;
      if (document.pointerLockElement !== canvas) canvas.requestPointerLock?.();
      else this.select(this.desktopPtr);
    });
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== canvas) return;
      this.camera.rotation.y -= e.movementX * 0.0025;
      this.camera.rotation.x = clamp(this.camera.rotation.x - e.movementY * 0.0025, -1.3, 1.3);
    });
    window.addEventListener('keydown', (e) => {
      const k = e.key;
      if (/^[0-9./]$/.test(k) || k === 'Backspace' || k === 'Enter') {
        const p = this.activePanel();
        if (p) { p.pressKey(k === 'Backspace' ? '⌫' : k === 'Enter' ? 'OK' : k); e.preventDefault(); }
        return;
      }
      if (k === 'h' || k === 'H') this.activePanel()?.pressKey('hint');
      if (k === 'r' || k === 'R') this.activePanel()?.pressKey('read');
      this.keys.add(k.toLowerCase());
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
  }

  // The nearest visible, unsolved panel within reach (used for keyboard typing).
  activePanel() {
    const head = this.headPos();
    let best = null, bd = 4.5;
    for (const p of this.panels) {
      if (!p.mesh.visible || (p.state !== 'solving' && p.state !== 'victory')) continue;
      const d = p.mesh.getWorldPosition(new THREE.Vector3()).distanceTo(head);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  headPos() { return this.camera.getWorldPosition(new THREE.Vector3()); }

  // Can the player's head stand at world (x, z)?
  canStand(x, z) {
    const m = 0.35;
    for (let j = 0; j <= this.reach; j++) if (Math.abs(x) < W / 2 - m && z < zc(j) + L / 2 - m - (j ? WALL_T : 0) && z > zc(j) - L / 2 + m) return true;
    for (let j = 0; j < this.reach; j++) if (Math.abs(x) < DOOR_W / 2 - 0.25 && Math.abs(z - (wallZ(j) - WALL_T / 2)) < WALL_T / 2 + m + 0.05) return true;
    return false;
  }

  castFrom(origin, dir) {
    this.raycaster.set(origin, dir);
    const targets = [...this.blockers, ...this.floors];
    for (const p of this.panels) if (p.mesh.visible) targets.push(p.mesh);
    for (const ch of this.chests) if (!ch.opened && !ch.big) ch.group.traverse((o) => { if (o.isMesh && o !== ch.q) targets.push(o); });
    const hit = this.raycaster.intersectObjects(targets, false)[0];
    if (!hit) return null;
    const o = hit.object;
    if (o.userData.panel) return { type: 'panel', panel: o.userData.panel, uv: hit.uv, point: hit.point, distance: hit.distance };
    if (o.userData.chest) return { type: 'chest', chest: o.userData.chest, point: hit.point, distance: hit.distance };
    if (o.userData.floor) return { type: 'floor', point: hit.point, ok: this.canStand(hit.point.x, hit.point.z), distance: hit.distance };
    return { type: 'block', point: hit.point, distance: hit.distance };
  }

  select(ptr) {
    this.sfx.resume();
    const h = ptr.hit;
    if (!h) return;
    if (h.type === 'panel') h.panel.press(h.uv);
    else if (h.type === 'chest' && h.distance < 7) this.openChestPanel(h.chest);
    else if (h.type === 'floor' && h.ok) this.teleport(h.point);
  }

  teleport(p) {
    const head = this.headPos();
    this.rig.position.x += p.x - head.x;
    this.rig.position.z += p.z - head.z;
    this.sfx.teleport();
  }

  moveBy(dx, dz) {
    const head = this.headPos();
    if (this.canStand(head.x + dx, head.z)) this.rig.position.x += dx;
    if (this.canStand(head.x + (this.canStand(head.x + dx, head.z) ? dx : 0), head.z + dz)) this.rig.position.z += dz;
  }

  snapTurn(angle) {
    const head = this.headPos();
    const v = this.rig.position.clone().sub(head).applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    this.rig.position.copy(head).add(v).setY(this.rig.position.y);
    this.rig.rotation.y += angle;
  }

  updatePointers(dt) {
    const hovered = new Map();
    const xr = this.renderer.xr.isPresenting;
    const tmpM = new THREE.Matrix4(), o = new THREE.Vector3(), d = new THREE.Vector3();
    let markerShown = false;
    const handle = (ptr, origin, dir) => {
      const hit = this.castFrom(origin, dir); ptr.hit = hit;
      if (hit?.type === 'panel') hovered.set(hit.panel, hit.uv);
      if (hit?.type === 'floor' && hit.ok && !markerShown) { this.marker.position.copy(hit.point).setY(0.02); this.marker.visible = true; markerShown = true; }
      return hit;
    };
    if (xr) {
      for (const ptr of this.pointers) {
        const c = ptr.c;
        if (!ptr.src) { ptr.ray.visible = false; continue; }
        tmpM.identity().extractRotation(c.matrixWorld);
        o.setFromMatrixPosition(c.matrixWorld); d.set(0, 0, -1).applyMatrix4(tmpM);
        const hit = handle(ptr, o, d);
        const len = hit ? hit.distance : 5;
        ptr.ray.visible = true; ptr.ray.scale.z = len;
        ptr.ray.material.color.setHex(hit?.type === 'panel' || hit?.type === 'chest' ? 0xffe066 : hit?.type === 'floor' && hit.ok ? 0x66e0ff : 0xffffff);
        ptr.dot.visible = !!hit; if (hit) ptr.dot.position.copy(hit.point);
        // thumbsticks
        const gp = ptr.src.gamepad;
        if (gp && gp.axes.length >= 4) {
          const ax = gp.axes[2], ay = gp.axes[3];
          if (ptr.src.handedness === 'left' && this.opts.smooth && Math.hypot(ax, ay) > 0.2) {
            const fwd = new THREE.Vector3(); this.camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
            const right = new THREE.Vector3(-fwd.z, 0, fwd.x), sp = 1.6 * dt;
            this.moveBy((fwd.x * -ay + right.x * ax) * sp, (fwd.z * -ay + right.z * ax) * sp);
          }
          if (ptr.src.handedness === 'right') {
            if (Math.abs(ax) > 0.7 && ptr.turnArmed) { this.snapTurn(ax > 0 ? -Math.PI / 6 : Math.PI / 6); ptr.turnArmed = false; }
            if (Math.abs(ax) < 0.3) ptr.turnArmed = true;
          }
        }
        // hand joints
        const hand = ptr.hand;
        if (hand?.joints) for (const j of Object.values(hand.joints)) if (!j.userData.mesh) {
          const m = new THREE.Mesh(hand.userData.jointGeo, hand.userData.jointMat); m.scale.setScalar(j.jointRadius || 0.008); j.add(m); j.userData.mesh = m;
        }
      }
    } else {
      this.camera.getWorldPosition(o); this.camera.getWorldDirection(d);
      handle(this.desktopPtr, o, d);
      const h = this.desktopPtr.hit;
      document.getElementById('crosshair')?.classList.toggle('active', !!h && h.type !== 'block' && (h.type !== 'floor' || h.ok));
    }
    if (!markerShown) this.marker.visible = false;
    for (const p of this.panels) p.hover(hovered.get(p) || null);
  }

  // ---------------------------------------------------------- frame loop
  frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05), t = this.clock.elapsedTime;
    const xr = this.renderer.xr.isPresenting;
    // desktop walking
    if (!xr) {
      const f = (this.keys.has('w') || this.keys.has('arrowup') ? 1 : 0) - (this.keys.has('s') || this.keys.has('arrowdown') ? 1 : 0);
      const s = (this.keys.has('d') ? 1 : 0) - (this.keys.has('a') ? 1 : 0);
      if (this.keys.has('arrowleft')) this.camera.rotation.y += 1.8 * dt;
      if (this.keys.has('arrowright')) this.camera.rotation.y -= 1.8 * dt;
      if (f || s) {
        const yaw = this.camera.rotation.y, sp = 2.4 * dt;
        this.moveBy((-Math.sin(yaw) * f + Math.cos(yaw) * s) * sp, (-Math.cos(yaw) * f - Math.sin(yaw) * s) * sp);
      }
    }
    // panels follow the player's eye height
    const head = this.headPos();
    this.panelY += (clamp(head.y - 0.15, 0.85, 1.45) - this.panelY) * Math.min(1, dt * 2);
    for (const p of this.panels) { if (p.fixedHeight) p.mesh.position.y = this.panelY; p.update(); }
    // animations
    for (const a of this.anims) { a.t += dt; if (a.t >= 0) a.fn(Math.min(1, a.t / a.dur)); }
    for (const a of this.anims.filter((a) => a.t >= a.dur)) a.done?.();
    this.anims = this.anims.filter((a) => a.t < a.dur);
    for (const m of this.particles) {
      m.userData.v.y -= 4 * dt; m.position.addScaledVector(m.userData.v, dt);
      m.rotation.x += m.userData.spin.x * dt; m.rotation.y += m.userData.spin.y * dt;
      m.userData.life -= dt; if (m.userData.life <= 0 || m.position.y < 0) { this.scene.remove(m); m.material.dispose(); }
    }
    this.particles = this.particles.filter((m) => m.userData.life > 0 && m.position.y >= 0);
    // ambience
    const fl = 0.85 + 0.15 * Math.sin(t * 13) * Math.sin(t * 7.3);
    this.flameMat.color.setRGB(1, 0.55 + 0.1 * fl, 0.2);
    this.roomLights.forEach((l, i) => { l.intensity = 18 * (0.92 + 0.08 * Math.sin(t * 9 + i * 2)); });
    for (const ch of this.chests) if (!ch.opened) { ch.q.position.y = 1.15 + Math.sin(t * 2 + ch.i) * 0.06; ch.q.lookAt(head); }
    for (const o of this.floaters) { o.position.y = o.userData.base + Math.sin(t + o.userData.phase) * 0.25; o.rotation.y += dt; }
    this.updatePointers(dt);
    this.renderer.render(this.scene, this.camera);
  }

  async enterVR() {
    const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] });
    this.camera.rotation.set(0, 0, 0);
    this.camera.position.set(0, 0, 0);
    await this.renderer.xr.setSession(session);
    this.sfx.resume();
    session.addEventListener('end', () => { this.camera.position.set(0, 1.3, 0); this.onExitVR?.(); });
  }
}
