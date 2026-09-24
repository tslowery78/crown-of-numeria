// Crown of Numeria: a room-scale WebXR math tower for Meta Quest 3 (also
// playable with mouse + keyboard). Each floor of the tower is one room sized
// to the real play area. Solving a floor's Magic Lock opens the ceiling hatch;
// standing on the magic square lifts the player up to the next floor.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/BufferGeometryUtils.js';
import { ProblemSource, isCorrect, speakable } from './problems.js';

// ------------------------------------------------------------ layout
const FH = 3.6, SLAB = 0.4, CEIL = FH - SLAB, WALL_T = 0.3, HATCH = 1.2;
const FLOORS = [
  { name: 'Entrance Hall', banner: '#2e7d32', floor: 'stone', light: 0xffc27a, emblem: '♔', windows: 'S' },
  { name: 'Great Hall', banner: '#c62828', floor: 'wood', light: 0xffb866, emblem: '♕', windows: 'WS' },
  { name: 'Royal Library', banner: '#1565c0', floor: 'wood', light: 0xffd08a, emblem: '♖', windows: 'S' },
  { name: "Knights' Armory", banner: '#6a1b9a', floor: 'stone', light: 0xffc27a, emblem: '♘', windows: 'WS' },
  { name: 'Crystal Chamber', banner: '#00838f', floor: 'stone', light: 0xb9a0ff, emblem: '✦', windows: 'EWS' },
  { name: 'Tower Top', banner: '#f9a825', floor: 'stone', light: 0xffffff, emblem: '♛', roof: true },
];
const TOP = FLOORS.length - 1;
const fy = (i) => i * FH;
const ROOM_MIN = 1.6, ROOM_MAX = 5, EDGE_MARGIN = 0.15;

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
  lift() { this.tone(180, 0, 5, 'sine', 0.08, 360); for (let k = 0; k < 12; k++) this.tone(900 + k * 90, k * 0.4, 0.4, 'sine', 0.05); }
  arrive() { [659, 784, 988, 1319].forEach((f, i) => this.tone(f, i * 0.1, 0.4, 'triangle', 0.15)); }
  boom() { this.tone(120, 0, 0.5, 'sawtooth', 0.08, 40); [1400, 1800, 2200].forEach((f, i) => this.tone(f, 0.15 + i * 0.05, 0.3, 'sine', 0.04)); }
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
  constructor(game, { title, count, onSolved, doneText = 'Unlocked!', width = 0.8 }) {
    Object.assign(this, { game, title, count, onSolved, doneText });
    this.w = width; this.h = width * PH / PW;
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


// ------------------------------------------------------------ play-area fitting
function insidePoly(x, z, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, zi = pts[i].z, xj = pts[j].x, zj = pts[j].z;
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
// Largest axis-aligned rectangle that fits inside the Guardian polygon.
// Tries a grid of centres; returns { cx, cz, w, d } in metres.
export function fitRoom(pts) {
  const xs = pts.map((p) => p.x), zs = pts.map((p) => p.z);
  const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
  const fits = (cx, cz, a, b) => {
    const n = 16;
    for (let k = 0; k <= n; k++) {
      const t = -1 + (2 * k) / n;
      if (!insidePoly(cx + t * a, cz - b, pts) || !insidePoly(cx + t * a, cz + b, pts) || !insidePoly(cx - a, cz + t * b, pts) || !insidePoly(cx + a, cz + t * b, pts)) return false;
    }
    return !pts.some((p) => Math.abs(p.x - cx) < a - 1e-6 && Math.abs(p.z - cz) < b - 1e-6);
  };
  const centres = [{ x: xs.reduce((s, v) => s + v, 0) / pts.length, z: zs.reduce((s, v) => s + v, 0) / pts.length }];
  const G = 8;
  for (let i = 1; i < G; i++) for (let j = 1; j < G; j++) centres.push({ x: x0 + ((x1 - x0) * i) / G, z: z0 + ((z1 - z0) * j) / G });
  let best = { cx: 0, cz: 0, a: 0, b: 0 };
  for (const c of centres) {
    if (!insidePoly(c.x, c.z, pts)) continue;
    for (let a = 0.3; a <= 4; a += 0.1) {
      if (!fits(c.x, c.z, a, 0.05)) break;
      let lo = 0.05, hi = 4;
      while (hi - lo > 0.02) { const m = (lo + hi) / 2; if (fits(c.x, c.z, a, m)) lo = m; else hi = m; }
      if (a * lo > best.a * best.b) best = { cx: c.x, cz: c.z, a, b: lo };
    }
  }
  return { cx: best.cx, cz: best.cz, w: 2 * best.a, d: 2 * best.b };
}

// ------------------------------------------------------------ the game
export class Game {
  constructor(opts) {
    this.opts = opts; // { name, grade, moduleIds, perDoor, homework, homeworkOnly, roomSize }
    this.sfx = new Sfx();
    this.clock = new THREE.Clock();
    this.anims = []; this.particles = [];
    this.initRenderer();
    this.initControls();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  presetSize() {
    const n = parseFloat(this.opts.roomSize);
    return Number.isFinite(n) ? n : 2.5;
  }

  startDesktop() {
    const s = this.presetSize();
    this.buildWorld(s, s);
  }

  async enterVR() {
    const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] });
    let type = 'local-floor', w = this.presetSize(), d = w, cx = 0, cz = 0;
    if (this.opts.roomSize === 'auto') {
      try {
        const space = await session.requestReferenceSpace('bounded-floor');
        const pts = space.boundsGeometry;
        if (pts && pts.length >= 3) {
          const fit = fitRoom([...pts].map((p) => ({ x: p.x, z: p.z })));
          if (fit.w > 1 && fit.d > 1) { type = 'bounded-floor'; w = fit.w - 2 * EDGE_MARGIN; d = fit.d - 2 * EDGE_MARGIN; cx = fit.cx; cz = fit.cz; }
        }
      } catch { /* no Guardian bounds: use the preset size around the start spot */ }
    }
    this.fitInfo = { type, w, d };
    this.renderer.xr.setReferenceSpaceType(type);
    this.buildWorld(w, d);
    this.rig.position.set(-cx, 0, -cz);
    this.camera.position.set(0, 0, 0); this.camera.rotation.set(0, 0, 0);
    await this.renderer.xr.setSession(session);
    this.sfx.resume();
    session.addEventListener('end', () => { this.camera.position.set(0, 1.3, 0); this.rig.position.x = this.rig.position.z = 0; this.onExitVR?.(); });
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
    this.scene.background = new THREE.Color(0xbfe3ff);
    this.scene.fog = new THREE.Fog(0xcfe6ff, 160, 700);
    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.03, 1000);
    this.camera.rotation.order = 'YXZ';
    this.rig = new THREE.Group();
    this.rig.add(this.camera);
    this.scene.add(this.rig);
    this.camera.position.y = 1.3; // desktop eye height; XR overrides with the real head pose
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight; this.camera.updateProjectionMatrix();
      r.setSize(window.innerWidth, window.innerHeight);
    });
  }

  buildWorld(W, D) {
    W = clamp(W, ROOM_MIN, ROOM_MAX); D = clamp(D, ROOM_MIN, ROOM_MAX);
    this.W = W; this.D = D;
    if (this.world) { this.scene.remove(this.world); this.world.traverse((o) => { o.geometry?.dispose(); }); }
    this.world = new THREE.Group(); this.scene.add(this.world);
    this.source = new ProblemSource(this.opts);
    this.stats = { attempts: 0, correct: 0, firstTry: 0, missed: [], treasures: [] };
    this.level = 0; this.lift = { state: 'locked', dwell: 0, t: 0 };
    this.panels = []; this.chests = []; this.locks = []; this.hatches = []; this.blockers = []; this.floaters = [];
    this.panelH = 1.0;
    this.rig.position.set(0, 0, 0);

    const S = new StaticBatch(), world = this.world, hw = W / 2, hd = D / 2;
    const M = (o) => new THREE.MeshLambertMaterial(o);
    const mats = this.mats = {
      stone: M({ map: stoneTex() }), stoneDark: M({ map: stoneTex([95, 88, 80]) }),
      wood: M({ map: woodTex([92, 56, 30]) }), woodDark: M({ map: woodTex([60, 38, 22]) }),
      iron: M({ color: 0x2c2c33 }), gold: M({ color: 0xd9a627, emissive: 0x2a1c00 }), red: M({ color: 0x9c1b24 }),
      flame: new THREE.MeshBasicMaterial({ color: 0xffa640 }), M,
    };
    mats.flame.userData.noBlock = true;
    const floorMats = { stone: M({ map: stoneTex([110, 104, 98]) }), wood: M({ map: woodTex([110, 72, 40]) }) };
    const plane = (w, h) => tileUV(new THREE.PlaneGeometry(w, h), [w, h], 1.5);
    // four rectangles around a centred square hole
    const ring = (w, d, h) => [
      { x: 0, z: -(h / 2 + (d - h) / 4), w, d: (d - h) / 2 }, { x: 0, z: h / 2 + (d - h) / 4, w, d: (d - h) / 2 },
      { x: -(h / 2 + (w - h) / 4), z: 0, w: (w - h) / 2, d: h }, { x: h / 2 + (w - h) / 4, z: 0, w: (w - h) / 2, d: h },
    ];
    // a wall with an optional centred window hole
    const wall = (y0, h, cx, cz, len, alongX, win) => {
      const piece = (u, yc, l, ph) => S.box(alongX ? l : WALL_T, ph, alongX ? WALL_T : l, mats.stone, [alongX ? cx + u : cx, y0 + yc, alongX ? cz : cz + u], [0, 0, 0], 1.5);
      if (!win) return piece(0, h / 2, len, h);
      const ww = 0.7, sill = 0.95, wh = 1.1, side = (len - ww) / 2;
      piece(-(ww / 2 + side / 2), h / 2, side, h); piece(ww / 2 + side / 2, h / 2, side, h);
      piece(0, sill / 2, ww, sill); piece(0, sill + wh + (h - sill - wh) / 2, ww, h - sill - wh);
      for (const k of [-1, 0, 1]) S.add(new THREE.CylinderGeometry(0.012, 0.012, wh, 6), mats.iron, [alongX ? cx + k * 0.2 : cx, y0 + sill + wh / 2, alongX ? cz : cz + k * 0.2]);
      S.box(alongX ? ww + 0.12 : WALL_T + 0.04, 0.08, alongX ? WALL_T + 0.04 : ww + 0.12, mats.stoneDark, [cx, y0 + sill - 0.04, cz], [0, 0, 0], 1);
    };

    this.buildKingdom(S);

    FLOORS.forEach((fl, i) => {
      const y0 = fy(i), roof = !!fl.roof, wallH = roof ? 1.0 : FH;
      if (i === 0) S.add(plane(W, D), floorMats[fl.floor], [0, 0, 0], [-Math.PI / 2, 0, 0]);
      // walls (outer faces form the tower)
      const win = (side) => !roof && fl.windows.includes(side);
      wall(y0, wallH, 0, -hd - WALL_T / 2, W + 2 * WALL_T, true, false);
      wall(y0, wallH, 0, hd + WALL_T / 2, W + 2 * WALL_T, true, win('S') && W >= 1.4);
      wall(y0, wallH, hw + WALL_T / 2, 0, D, false, win('E') && D >= 1.4);
      wall(y0, wallH, -hw - WALL_T / 2, 0, D, false, win('W') && D >= 1.4);
      if (roof) {
        // battlements
        for (const [cx, cz, len, alongX] of [[0, -hd - WALL_T / 2, W + 2 * WALL_T, true], [0, hd + WALL_T / 2, W + 2 * WALL_T, true], [hw + WALL_T / 2, 0, D, false], [-hw - WALL_T / 2, 0, D, false]]) {
          const n = Math.max(2, Math.floor(len / 0.7));
          for (let k = 0; k < n; k++) {
            const u = -len / 2 + (k + 0.5) * (len / n);
            S.box(alongX ? 0.3 : WALL_T, 0.4, alongX ? WALL_T : 0.3, mats.stone, [alongX ? cx + u : cx, y0 + 1.2, alongX ? cz : cz + u], [0, 0, 0], 1);
          }
        }
        // corner flag poles
        const flagMat = new THREE.MeshLambertMaterial({ color: 0xff4f9a, side: THREE.DoubleSide }); flagMat.userData.noBlock = true;
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
          const x = sx * (hw + WALL_T / 2), z = sz * (hd + WALL_T / 2);
          S.add(new THREE.CylinderGeometry(0.03, 0.03, 2.6, 8), mats.iron, [x, y0 + 1.0 + 1.3, z]);
          S.add(new THREE.PlaneGeometry(0.7, 0.45), flagMat, [x + 0.36, y0 + 3.05, z]);
        }
      } else {
        // slab between this floor and the next, with a hatch hole in the middle
        const nextFloor = floorMats[FLOORS[i + 1].floor];
        for (const r of ring(W, D, HATCH)) {
          S.box(r.w, SLAB, r.d, nextFloor, [r.x, y0 + CEIL + SLAB / 2, r.z], [0, 0, 0], 1.5);
          S.add(plane(r.w, r.d), mats.woodDark, [r.x, y0 + CEIL - 0.004, r.z], [Math.PI / 2, 0, 0]);
        }
        for (const s of [-1, 1]) S.box(0.1, 0.1, HATCH + 0.2, mats.gold, [s * (HATCH / 2 + 0.05), y0 + CEIL - 0.05, 0]), S.box(HATCH + 0.2, 0.1, 0.1, mats.gold, [0, y0 + CEIL - 0.05, s * (HATCH / 2 + 0.05)]);
        const hm = nextFloor.clone(); hm.transparent = true;
        const hatch = new THREE.Mesh(tileUV(new THREE.BoxGeometry(HATCH, SLAB, HATCH), [HATCH, SLAB, HATCH], 1.5), hm);
        hatch.position.set(0, y0 + CEIL + SLAB / 2, 0);
        world.add(hatch); this.hatches.push(hatch); this.blockers.push(hatch);
        // torches near the north corners of the side walls
        for (const s of [-1, 1]) {
          const x = s * (hw - 0.1), z = -hd + 0.45;
          S.box(0.06, 0.4, 0.06, mats.iron, [x, y0 + 1.95, z], [0, 0, s * 0.35]);
          S.add(new THREE.CylinderGeometry(0.08, 0.05, 0.1, 8), mats.iron, [x - s * 0.07, y0 + 2.15, z]);
          S.add(new THREE.ConeGeometry(0.06, 0.22, 8), mats.flame, [x - s * 0.07, y0 + 2.3, z]);
        }
        // banners on the south wall
        const bx = Math.min(hw - 0.3, 0.95);
        if (bx >= 0.65) {
          const bm = this.bannerMat(fl);
          for (const s of [-1, 1]) S.add(new THREE.PlaneGeometry(0.5, 1.0), bm, [s * bx, y0 + 2.45, hd - 0.02], [0, Math.PI, 0]);
        }
        // floor name above the lock
        const sign = makeSign(`Floor ${i + 1}: ${fl.name}`, { w: Math.min(1.8, W - 0.2), h: 0.32, size: 80 });
        sign.position.set(0, y0 + 2.3, -hd + 0.02); world.add(sign);
      }
      this.decorate(S, i, W, D);
    });
    S.build(world, this.blockers);

    // interior lights follow the player's current floor
    this.lights = [0, 1].map(() => { const l = new THREE.PointLight(0xffc27a, 6, 9, 1.3); world.add(l); return l; });
    this.placeLights();

    for (let i = 0; i < TOP; i++) this.makeLock(i);
    for (let i = 0; i < TOP; i++) this.makeChest(i);
    this.makeFinale();
    this.makeLift();
    this.makeWelcome();
    this.updateHud();
  }

  bannerMat(fl) {
    const m = new THREE.MeshLambertMaterial({ map: canvasTexture(256, 512, (ctx, w, h) => {
      ctx.fillStyle = fl.banner; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w, 0); ctx.lineTo(w, h); ctx.lineTo(w / 2, h - 80); ctx.lineTo(0, h); ctx.fill();
      ctx.fillStyle = '#ffd54a'; ctx.fillRect(0, 0, w, 24);
      ctx.font = 'bold 150px serif'; ctx.textAlign = 'center'; ctx.fillText(fl.emblem, w / 2, 250);
    }), transparent: true, side: THREE.DoubleSide });
    m.userData.noBlock = true;
    return m;
  }

  // The kingdom seen through the windows and from the tower top.
  buildKingdom(S) {
    const M = (o) => { const m = this.mats.M(o); m.userData.noBlock = true; return m; };
    const sky = new THREE.SphereGeometry(600, 32, 16), col = [], top = new THREE.Color(0x3d7fd9), hor = new THREE.Color(0xcfe9ff);
    const pos = sky.attributes.position;
    for (let k = 0; k < pos.count; k++) { const t = clamp(pos.getY(k) / 600, 0, 1) ** 0.6; const c = hor.clone().lerp(top, t); col.push(c.r, c.g, c.b); }
    sky.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const skyMesh = new THREE.Mesh(sky, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    skyMesh.renderOrder = -1; this.world.add(skyMesh);
    const sun = new THREE.Mesh(new THREE.CircleGeometry(25, 32), new THREE.MeshBasicMaterial({ color: 0xfff4c2, fog: false }));
    sun.position.set(-250, 330, -380); sun.lookAt(0, 0, 0); this.world.add(sun);
    this.world.add(new THREE.HemisphereLight(0xdfefff, 0x6b8a4a, 1.3));
    const dl = new THREE.DirectionalLight(0xfff1dc, 1.6); dl.position.set(-40, 80, -60); this.world.add(dl);

    const grassTex = canvasTexture(256, 256, (ctx, w, h) => { ctx.fillStyle = '#5f9e3f'; ctx.fillRect(0, 0, w, h); noise(ctx, w, h, 2500, 0.15); }, true);
    const grass = M({ map: grassTex }); grass.userData.noBlock = true;
    S.add(tileUV(new THREE.PlaneGeometry(1400, 1400), [1400, 1400], 12), grass, [0, -0.03, 0], [-Math.PI / 2, 0, 0]);
    const paving = M({ map: stoneTex([150, 140, 125]) }); paving.userData.noBlock = true;
    S.add(tileUV(new THREE.CircleGeometry(15, 48), [30, 30], 2), paving, [0, -0.02, 0], [-Math.PI / 2, 0, 0]);
    const water = M({ color: 0x3f8fd0, emissive: 0x0a2a44 }); water.userData.noBlock = true;
    S.add(new THREE.RingGeometry(18, 21.5, 64), water, [0, -0.015, 0], [-Math.PI / 2, 0, 0]);
    // curtain wall with round towers and colourful roofs
    const wallStone = M({ map: stoneTex([160, 150, 135]) });
    const R = 16.5, segs = 36;
    for (let k = 0; k < segs; k++) {
      const a = (k / segs) * Math.PI * 2, len = (2 * Math.PI * R) / segs + 0.1;
      S.box(len, 5, 1.2, wallStone, [Math.cos(a) * R, 2.5, Math.sin(a) * R], [0, -a + Math.PI / 2, 0], 2);
      S.box(0.8, 0.8, 1.2, wallStone, [Math.cos(a) * R, 5.4, Math.sin(a) * R], [0, -a + Math.PI / 2, 0], 1);
    }
    const roofCols = [0xff6fae, 0x7f6bff, 0x4fc3ff, 0xffb347, 0x9b5cff, 0x3fd28a];
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + 0.3, x = Math.cos(a) * R, z = Math.sin(a) * R;
      S.add(new THREE.CylinderGeometry(2, 2.1, 10, 20), wallStone, [x, 5, z]);
      S.add(new THREE.ConeGeometry(2.5, 4.5, 20), M({ color: roofCols[k] }), [x, 12.25, z]);
    }
    // village, trees, mountains, clouds
    const houseWall = M({ color: 0xf1e2c4 }), houseRoof = M({ color: 0xb8443a }), trunk = M({ color: 0x6b4a2b }), leaves = M({ color: 0x3f8a3a }), leaves2 = M({ color: 0x2f7a4a });
    for (let k = 0; k < 18; k++) {
      const a = Math.random() * Math.PI * 2, r = 30 + Math.random() * 30, x = Math.cos(a) * r, z = Math.sin(a) * r, rot = Math.random() * 3;
      S.box(3, 2.4, 3.6, houseWall, [x, 1.2, z], [0, rot, 0]);
      S.add(new THREE.ConeGeometry(2.8, 2, 4), houseRoof, [x, 3.4, z], [0, rot + Math.PI / 4, 0]);
    }
    for (let k = 0; k < 160; k++) {
      const a = Math.random() * Math.PI * 2, r = 26 + Math.random() * 140, x = Math.cos(a) * r, z = Math.sin(a) * r, s = 0.8 + Math.random() * 0.9;
      S.add(new THREE.CylinderGeometry(0.25 * s, 0.35 * s, 2 * s, 6), trunk, [x, s, z]);
      S.add(new THREE.ConeGeometry(1.6 * s, 3.5 * s, 7), k % 2 ? leaves : leaves2, [x, 3.5 * s, z]);
    }
    const rock = M({ color: 0x7d8aa6 }), snow = M({ color: 0xffffff });
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2 + Math.random() * 0.2, r = 330 + Math.random() * 60, h = 70 + Math.random() * 80, rad = 60 + Math.random() * 40;
      S.add(new THREE.ConeGeometry(rad, h, 9), rock, [Math.cos(a) * r, h / 2 - 2, Math.sin(a) * r]);
      S.add(new THREE.ConeGeometry(rad * 0.3, h * 0.3, 9), snow, [Math.cos(a) * r, h * 0.85 - 2, Math.sin(a) * r]);
    }
    const cloud = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }); cloud.userData.noBlock = true;
    for (let k = 0; k < 14; k++) {
      const a = Math.random() * Math.PI * 2, r = 120 + Math.random() * 200, x = Math.cos(a) * r, z = Math.sin(a) * r, y = 70 + Math.random() * 50;
      for (let j = 0; j < 4; j++) S.add(new THREE.SphereGeometry(10 + Math.random() * 8, 10, 6), cloud, [x + j * 12 - 18, y + Math.random() * 4, z + Math.random() * 8], [0, 0, 0], [1, 0.45, 1]);
    }
  }

  decorate(S, i, W, D) {
    const { stoneDark, wood, woodDark, iron, gold, red, flame, M } = this.mats, y0 = fy(i), hw = W / 2, hd = D / 2;
    if (i === 0) {
      const leaf = M({ color: 0x2f7d32 }), blue = M({ color: 0x2a5bd7 }), white = M({ color: 0xf2f2f2 });
      for (const sx of [-1, 1]) {
        const x = sx * (hw - 0.3), z = -hd + 0.25;
        S.box(0.45, 0.4, 0.35, stoneDark, [x, 0.2, z], [0, 0, 0], 1);
        for (let k = 0; k < 6; k++) {
          const px = x - 0.14 + (k % 3) * 0.14, pz = z - 0.07 + Math.floor(k / 3) * 0.14, h = 0.25 + Math.random() * 0.15;
          S.add(new THREE.CylinderGeometry(0.01, 0.01, h, 5), leaf, [px, 0.4 + h / 2, pz]);
          S.add(new THREE.ConeGeometry(0.05, 0.18, 7), blue, [px, 0.4 + h + 0.07, pz]);
          S.add(new THREE.SphereGeometry(0.02, 6, 4), white, [px, 0.4 + h + 0.17, pz]);
        }
      }
    }
    if (i === 1) { // feast table on the east wall
      const len = clamp(D - 1.4, 0.6, 2), x = hw - 0.3, z = -0.35;
      S.box(0.5, 0.06, len, wood, [x, y0 + 0.74, z], [0, 0, 0], 1);
      for (const dz of [-1, 1]) S.box(0.08, 0.72, 0.08, woodDark, [x, y0 + 0.36, z + dz * (len / 2 - 0.08)]);
      for (let k = 0; k < Math.floor(len / 0.35); k++) {
        const zz = z - len / 2 + 0.2 + k * 0.35;
        S.add(new THREE.CylinderGeometry(0.035, 0.022, 0.12, 8), gold, [x - 0.1, y0 + 0.83, zz]);
        S.add(new THREE.CylinderGeometry(0.08, 0.08, 0.02, 12), M({ color: 0xdddddd }), [x + 0.08, y0 + 0.78, zz]);
        if (k % 2) S.add(new THREE.SphereGeometry(0.05, 8, 6), k % 4 === 1 ? red : M({ color: 0x5fbf3f }), [x + 0.08, y0 + 0.83, zz]);
      }
      for (const dz of [-0.3, 0.3]) { S.add(new THREE.CylinderGeometry(0.02, 0.02, 0.18, 6), M({ color: 0xf5f0e0 }), [x, y0 + 0.86, z + dz]); S.add(new THREE.ConeGeometry(0.02, 0.06, 6), flame, [x, y0 + 0.98, z + dz]); }
    }
    if (i === 2) { // bookshelves on the east and west walls
      const bookMats = [0x8e2430, 0x1f4e8c, 0x2e7d32, 0x6a3d9a, 0xb8860b].map((c) => M({ color: c }));
      const len = clamp(D - 1.2, 0.6, 2.6), z0 = -0.3;
      for (const s of [-1, 1]) {
        const x = s * (hw - 0.15);
        S.box(0.3, 2.4, len, woodDark, [x, y0 + 1.2, z0], [0, 0, 0], 1);
        for (let r = 0; r < 4; r++) {
          const y = y0 + 0.15 + r * 0.58;
          S.box(0.32, 0.04, len, wood, [x - s * 0.01, y, z0], [0, 0, 0], 1);
          let p = z0 - len / 2 + 0.05;
          while (p < z0 + len / 2 - 0.08) {
            const bw = 0.04 + Math.random() * 0.04, bh = 0.3 + Math.random() * 0.15;
            S.box(0.22, bh, bw, bookMats[Math.floor(Math.random() * bookMats.length)], [x - s * 0.05, y + bh / 2 + 0.02, p + bw / 2]);
            p += bw + 0.006;
          }
        }
      }
    }
    if (i === 3) { // suits of armor in the north corners, shields on the east wall
      const steel = M({ color: 0x7f8799, emissive: 0x0a0a10 });
      for (const sx of [-1, 1]) {
        const x = sx * (hw - 0.3), z = -hd + 0.3;
        S.box(0.45, 0.1, 0.45, stoneDark, [x, y0 + 0.05, z], [0, 0, 0], 1);
        for (const d of [-0.08, 0.08]) S.add(new THREE.CylinderGeometry(0.055, 0.065, 0.7, 8), steel, [x + d, y0 + 0.45, z]);
        S.add(new THREE.CylinderGeometry(0.17, 0.13, 0.6, 10), steel, [x, y0 + 1.1, z]);
        for (const d of [-0.23, 0.23]) S.add(new THREE.CylinderGeometry(0.045, 0.045, 0.55, 8), steel, [x + d, y0 + 1.1, z]);
        S.add(new THREE.SphereGeometry(0.13, 12, 10), steel, [x, y0 + 1.55, z]);
        S.box(0.18, 0.025, 0.02, iron, [x, y0 + 1.56, z + 0.12]);
        S.add(new THREE.ConeGeometry(0.045, 0.22, 6), red, [x, y0 + 1.75, z]);
      }
      [0xc62828, 0x1565c0].forEach((c, k) => {
        const z = (k ? 0.45 : -0.35);
        S.add(new THREE.CircleGeometry(0.28, 24), M({ color: c }), [hw - 0.03, y0 + 1.8, z], [0, -Math.PI / 2, 0]);
        S.add(new THREE.RingGeometry(0.24, 0.28, 24), gold, [hw - 0.035, y0 + 1.8, z], [0, -Math.PI / 2, 0]);
      });
    }
    if (i === 4) { // crystals + floating gems
      const cryA = new THREE.MeshLambertMaterial({ color: 0x8fdcff, emissive: 0x2a6f99 }), cryB = new THREE.MeshLambertMaterial({ color: 0xd49bff, emissive: 0x5c2a8c });
      for (const [x, z] of [[-hw + 0.3, -hd + 0.3], [hw - 0.3, -hd + 0.3], [-hw + 0.3, hd - 0.3]]) {
        for (let k = 0; k < 5; k++) {
          const h = 0.3 + Math.random() * 0.8;
          S.add(new THREE.ConeGeometry(0.08 + Math.random() * 0.05, h, 6), k % 2 ? cryA : cryB, [x + (Math.random() - 0.5) * 0.3, y0 + h / 2, z + (Math.random() - 0.5) * 0.3], [(Math.random() - 0.5) * 0.4, 0, (Math.random() - 0.5) * 0.4]);
        }
      }
      for (let k = 0; k < 6; k++) {
        const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.08), k % 2 ? cryA : cryB), a = (k / 6) * Math.PI * 2;
        orb.position.set(Math.cos(a) * (hw - 0.35), y0 + 2.3 + Math.random() * 0.5, Math.sin(a) * (hd - 0.35));
        orb.userData.base = orb.position.y; orb.userData.phase = Math.random() * 6;
        this.world.add(orb); this.floaters.push(orb);
      }
    }
    if (i === TOP) { // lectern for the final lock
      S.box(0.12, 0.9, 0.12, gold, [0, y0 + 0.45, -hd + 0.12]);
    }
  }

  // ---------------------------------------------------------- locks, chests, lift
  makeLock(i) {
    const hd = this.D / 2, y0 = fy(i), n = this.opts.perDoor;
    const pad = new THREE.Group(); pad.position.set(0, y0 + 2.85, -hd + 0.06);
    pad.add(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.22, 0.07), this.mats.gold));
    const sh = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.022, 8, 16, Math.PI), this.mats.gold); sh.position.y = 0.11; pad.add(sh);
    this.world.add(pad);
    const gems = [];
    for (let k = 0; k < n; k++) {
      const g = new THREE.Mesh(new THREE.OctahedronGeometry(0.05), new THREE.MeshLambertMaterial({ color: 0x555566 }));
      g.position.set((k - (n - 1) / 2) * 0.16, y0 + 2.6, -hd + 0.06); this.world.add(g); gems.push(g);
    }
    const lock = { i, pad, gems, open: false };
    const panel = new Panel(this, { title: `Magic Lock ${i + 1}`, count: n, doneText: 'Unlocked!', onSolved: () => this.unlock(lock) });
    panel.mesh.position.set(0, y0 + this.panelH, -hd + 0.03);
    panel.floor = i; panel.wallMounted = true;
    const orig = panel.update.bind(panel);
    panel.update = () => { orig(); gems.forEach((g, k) => { const on = k < panel.solved; g.material.color.setHex(on ? 0x4dff9a : 0x555566); g.material.emissive.setHex(on ? 0x1f8a4a : 0); }); };
    this.world.add(panel.mesh); this.panels.push(panel);
    lock.panel = panel; this.locks.push(lock);
  }

  unlock(lock) {
    lock.open = true;
    const i = lock.i, hatch = this.hatches[i];
    this.sfx.door();
    this.animate(0.8, (t) => { lock.pad.position.y = fy(i) + 2.85 - t * 2.4; lock.pad.rotation.z = t * 2; }, () => { lock.pad.visible = false; });
    this.burst(new THREE.Vector3(0, fy(i) + CEIL - 0.1, 0), 80);
    this.animate(1.4, (t) => { hatch.material.opacity = 1 - t; hatch.scale.set(1 - t * 0.3, 1, 1 - t * 0.3); }, () => { hatch.visible = false; }, 0.3);
    this.retirePanel(lock.panel, 1.4);
    this.lift = { state: 'ready', dwell: 0, t: 0 };
    this.setGuide('Step onto the glowing square!');
  }

  makeLift() {
    const runeTex = canvasTexture(512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#2b1a4a'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#ffd54a'; ctx.lineWidth = 14; ctx.strokeRect(14, 14, w - 28, h - 28);
      ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(w / 2, h / 2, 200, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(w / 2, h / 2, 150, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#ffd54a'; ctx.font = 'bold 44px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const runes = '1234567890+−×÷=★';
      for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; ctx.save(); ctx.translate(w / 2 + Math.cos(a) * 175, h / 2 + Math.sin(a) * 175); ctx.rotate(a + Math.PI / 2); ctx.fillText(runes[k], 0, 0); ctx.restore(); }
      ctx.beginPath(); for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k * 4 * Math.PI) / 5; ctx.lineTo(w / 2 + Math.cos(a) * 130, h / 2 + Math.sin(a) * 130); } ctx.closePath(); ctx.stroke();
    });
    this.runeMat = new THREE.MeshBasicMaterial({ map: runeTex, color: 0x777777 });
    const side = new THREE.MeshLambertMaterial({ color: 0xd9a627 });
    const s = HATCH - 0.02, th = 0.12;
    const plat = new THREE.Mesh(new THREE.BoxGeometry(s, th, s), [side, side, this.runeMat, side, side, side]);
    plat.position.set(0, -th / 2 + 0.006, 0);
    this.platform = plat; this.world.add(plat);
    // glowing beam that appears when the hatch is open
    const beam = new THREE.Mesh(new THREE.BoxGeometry(s, CEIL, s).translate(0, CEIL / 2, 0), new THREE.MeshBasicMaterial({ color: 0xffe89a, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.visible = false; this.beam = beam; this.world.add(beam);
    // corner crystals that ride along
    this.liftPosts = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.05), new THREE.MeshBasicMaterial({ color: 0xffe066 }));
      c.position.set(sx * (s / 2 - 0.04), 0.9, sz * (s / 2 - 0.04)); plat.add(c); this.liftPosts.push(c);
    }
    // floating guide text
    this.guide = null;
  }

  setGuide(text) {
    if (this.guide) { this.world.remove(this.guide); this.guide.material.map.dispose(); this.guide = null; }
    if (!text) return;
    this.guide = makeSign(text, { w: 1.2, h: 0.22, size: 70, bg: '#1f2a44', border: '#7fb2ff', fg: '#e8f0ff' });
    this.world.add(this.guide);
  }

  onSquare(p) { const m = HATCH / 2 - 0.05; return Math.abs(p.x) < m && Math.abs(p.z) < m; }

  updateLift(dt, head) {
    const L = this.lift, y0 = fy(this.level), on = this.onSquare(head);
    const glow = L.state === 'ready' || L.state === 'rising';
    this.runeMat.color.setScalar(glow ? 0.75 + 0.25 * Math.sin(this.clock.elapsedTime * 4) : 0.45);
    this.liftPosts.forEach((c) => { c.visible = glow; c.rotation.y += dt * 2; });
    this.beam.visible = L.state === 'ready';
    this.beam.position.set(0, y0, 0);
    if (this.guide) {
      const dir = new THREE.Vector3(head.x, 0, head.z); const far = dir.length() > 0.2;
      this.guide.position.set(0, y0 + 2.2, 0);
      if (far) this.guide.lookAt(head.x, y0 + 2.2, head.z); else this.guide.lookAt(head.x, y0 + 2.2, head.z - 1);
    }
    if (L.state === 'ready') {
      L.dwell = on ? L.dwell + dt : 0;
      if (L.dwell > 1.5) { L.state = 'rising'; L.t = 0; this.setGuide('Hold on! Going up…'); this.sfx.lift(); }
    } else if (L.state === 'rising') {
      if (on) {
        L.t = Math.min(1, L.t + dt / 5);
        if (this.guideText !== 'up') { this.guideText = 'up'; this.setGuide('Going up…'); }
      } else if (this.guideText !== 'back') { this.guideText = 'back'; this.setGuide('Step back on the square!'); }
      const e = L.t < 0.5 ? 2 * L.t * L.t : 1 - (-2 * L.t + 2) ** 2 / 2;
      const y = y0 + e * FH;
      this.platform.position.y = y - 0.06 + 0.006;
      this.rig.position.y = y;
      if (L.t >= 1) {
        this.level++; this.guideText = null;
        this.lift = { state: this.level >= TOP ? 'done' : 'locked', dwell: 0, t: 0 };
        this.rig.position.y = fy(this.level);
        this.setGuide(null); this.placeLights(); this.updateHud();
        this.sfx.arrive();
        this.burst(new THREE.Vector3(0, fy(this.level) + 0.3, 0), 50);
        if (this.level === TOP) this.showBanner('The Tower Top!');
        else this.showBanner(`Floor ${this.level + 1}: ${FLOORS[this.level].name}`);
      }
    }
  }

  showBanner(text) {
    const s = makeSign(text, { w: 1.4, h: 0.3, size: 80, bg: '#2b1a4a', fg: '#ffd54a' });
    const head = this.headPos(), fwd = new THREE.Vector3(); this.camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
    s.position.copy(head).addScaledVector(fwd, 1.4); s.position.y = head.y + 0.55; s.lookAt(head);
    this.world.add(s);
    this.animate(2.4, (t) => { s.material.opacity = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3; s.position.y += 0.0015; }, () => { this.world.remove(s); s.material.map.dispose(); });
  }

  placeLights() {
    const lv = this.level ?? 0;
    this.lights.forEach((l, k) => {
      const f = Math.min(lv + k, TOP);
      l.color.setHex(FLOORS[f].light);
      l.position.set(this.W * 0.2, fy(f) + CEIL - 0.5, -this.D * 0.2);
      l.intensity = FLOORS[f].roof ? 0 : 6;
    });
  }

  retirePanel(panel, delay) {
    this.animate(0.5, (t) => panel.mesh.scale.setScalar(Math.max(0.001, 1 - t)), () => { panel.mesh.visible = false; }, delay);
  }

  makeChest(i, big = false) {
    const g = new THREE.Group();
    const woodM = new THREE.MeshLambertMaterial({ color: 0x7a4a22 }), goldM = new THREE.MeshLambertMaterial({ color: 0xe0b23a, emissive: 0x3a2800 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.6), woodM); base.position.y = 0.25; g.add(base);
    for (const x of [-0.35, 0.35]) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.52, 0.62), goldM); t.position.set(x, 0.25, 0); g.add(t); }
    const lidPivot = new THREE.Group(); lidPivot.position.set(0, 0.5, -0.3); g.add(lidPivot);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 16, 1, false, 0, Math.PI).rotateZ(Math.PI / 2), woodM);
    lid.position.set(0, 0, 0.3); lid.scale.set(1, 0.6, 1); lidPivot.add(lid);
    const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.04), goldM); clasp.position.set(0, 0.45, 0.31); g.add(clasp);
    const s = big ? 1.1 : 0.7;
    g.scale.setScalar(s);
    const [tName, tColor] = big ? ['Crown of Numeria', 0xffd700] : TREASURES[i % TREASURES.length];
    const prize = big ? this.makeCrown() : new THREE.Mesh(new THREE.OctahedronGeometry(0.1), new THREE.MeshStandardMaterial({ color: tColor, emissive: tColor, emissiveIntensity: 0.5, metalness: 0.3, roughness: 0.2 }));
    prize.visible = false; this.world.add(prize);
    const q = makeSign('?', { w: 0.35, h: 0.35, bg: 'rgba(0,0,0,0)', border: 'rgba(0,0,0,0)', fg: '#ffd54a', size: 300, px: 256 });
    q.position.y = 1.3; g.add(q);
    const chest = { i, group: g, lidPivot, prize, tName, q, opened: false, panel: null, big };
    g.traverse((o) => { if (o.isMesh && o !== q) o.userData.chest = chest; });
    const hw = this.W / 2, hd = this.D / 2;
    if (!big) {
      const x = (i % 2 ? -1 : 1) * (hw - 0.4), z = hd - 0.35;
      g.position.set(x, fy(i), z);
      g.rotation.y = Math.atan2(-x, -z);
    }
    this.world.add(g);
    this.chests.push(chest);
    return chest;
  }

  makeCrown() {
    const crown = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0x6a4a00, metalness: 0.6, roughness: 0.25 });
    crown.add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.12, 24, 1, true), m));
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2, spike = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.13, 6), m);
      spike.position.set(Math.cos(a) * 0.15, 0.12, Math.sin(a) * 0.15); crown.add(spike);
      const jewel = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), new THREE.MeshBasicMaterial({ color: TREASURES[k % 5][1] }));
      jewel.position.set(Math.cos(a) * 0.162, 0, Math.sin(a) * 0.162); crown.add(jewel);
    }
    return crown;
  }

  openChestPanel(chest) {
    if (chest.opened || chest.panel || chest.i > this.level) return;
    const head = this.headPos(), pos = chest.group.getWorldPosition(new THREE.Vector3());
    const toCenter = new THREE.Vector3(-pos.x, 0, -pos.z).normalize();
    const p = pos.clone().addScaledVector(toCenter, 0.55);
    const panel = new Panel(this, { title: 'Treasure Chest', count: 1, width: 0.7, doneText: `You found a\n${chest.tName}!`, onSolved: () => this.openChest(chest) });
    panel.mesh.position.set(p.x, fy(this.level) + this.panelH + 0.1, p.z);
    panel.mesh.lookAt(head.x, panel.mesh.position.y, head.z);
    panel.mesh.scale.setScalar(0.01);
    this.animate(0.3, (t) => panel.mesh.scale.setScalar(Math.max(0.01, t)));
    this.world.add(panel.mesh); this.panels.push(panel);
    chest.panel = panel;
    this.sfx.click();
  }

  openChest(chest) {
    chest.opened = true; chest.q.visible = false;
    this.sfx.chest();
    const wp = chest.group.getWorldPosition(new THREE.Vector3());
    this.animate(0.8, (t) => { chest.lidPivot.rotation.x = -1.9 * (1 - (1 - t) ** 2); });
    this.burst(wp.clone().setY(wp.y + 0.5), 60);
    const prize = chest.prize;
    prize.position.copy(wp).setY(wp.y + 0.4); prize.visible = true;
    this.stats.treasures.push(chest.tName);
    if (chest.big) return this.victory(chest);
    this.animate(1.4, (t) => { prize.position.y = wp.y + 0.4 + t * 0.9; prize.rotation.y = t * 8; }, () => {
      const from = prize.position.clone();
      this.animate(0.8, (t) => { const h = this.headPos(); h.y -= 0.3; prize.position.lerpVectors(from, h, t * t); prize.scale.setScalar(1 - t * 0.7); }, () => {
        prize.visible = false; this.sfx.gem(); this.updateHud();
      });
    }, 0.3);
    this.retirePanel(chest.panel, 2.2);
  }

  makeFinale() {
    const y0 = fy(TOP), hd = this.D / 2;
    const chest = this.makeChest(TOP, true);
    chest.group.position.set(0, y0, hd - 0.45);
    chest.group.rotation.y = Math.PI;
    chest.q.visible = false;
    const panel = new Panel(this, { title: 'The Crown of Numeria', count: this.opts.perDoor + 1, doneText: 'VICTORY!', onSolved: () => this.openChest(chest) });
    panel.mesh.position.set(0, y0 + this.panelH, -hd + 0.2);
    panel.floor = TOP; panel.wallMounted = true;
    this.world.add(panel.mesh); this.panels.push(panel);
    chest.panel = panel;
    this.finalChest = chest;
  }

  makeWelcome() {
    const n = this.opts.name || 'Explorer', hw = this.W / 2, len = Math.min(1.7, this.D - 0.5);
    const welcome = makeSign(`Welcome to Numeria, ${n}!\nSolve each Magic Lock to open the ceiling. Then stand on the glowing square to ride up. Find a treasure chest on every floor!`, { w: len, h: len * 0.55, size: 64 });
    welcome.position.set(-hw + 0.02, 1.55, 0); welcome.rotation.y = Math.PI / 2; this.world.add(welcome);
    const help = makeSign('Walk around the room!\nTouch buttons with your finger, or point and pull the trigger.', { w: len, h: len * 0.45, size: 60, bg: '#1f2a44', border: '#7fb2ff', fg: '#e8f0ff' });
    help.position.set(hw - 0.02, 1.55, 0); help.rotation.y = -Math.PI / 2; this.world.add(help);
  }

  victory(chest) {
    this.sfx.fanfare();
    const y0 = fy(TOP), crown = chest.prize, start = crown.position.clone();
    this.animate(2.5, (t) => { crown.position.set(start.x, start.y + t * 1.1, start.z); crown.rotation.y = t * 10; });
    for (let k = 0; k < 10; k++) setTimeout(() => { const a = Math.random() * Math.PI * 2, r = 12 + Math.random() * 12; this.burst(new THREE.Vector3(Math.cos(a) * r, y0 + 8 + Math.random() * 8, Math.sin(a) * r), 120, 0.25, 9); this.sfx.boom(); }, 600 + k * 450);
    const s = this.stats;
    this.saveProgress();
    const vp = new Panel(this, { title: 'Tower Conquered!', count: 0 });
    vp.state = 'victory';
    vp.draw = () => {
      const ctx = vp.ctx;
      ctx.clearRect(0, 0, PW, PH);
      ctx.fillStyle = '#2b1a4a'; roundRect(ctx, 0, 0, PW, PH, 48); ctx.fill();
      ctx.lineWidth = 14; ctx.strokeStyle = '#e0b84a'; roundRect(ctx, 7, 7, PW - 14, PH - 14, 44); ctx.stroke();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffd54a'; ctx.font = `bold 84px ${FONT}`; ctx.fillText('You did it,', PW / 2, 140);
      ctx.fillText(`${this.opts.name || 'Explorer'}!`, PW / 2, 240);
      ctx.fillStyle = '#fff'; ctx.font = `bold 50px ${FONT}`;
      ctx.fillText('The Crown of Numeria is yours!', PW / 2, 360);
      ctx.font = `44px ${FONT}`;
      ctx.fillText(`Problems solved: ${s.correct}`, PW / 2, 480);
      ctx.fillText(`Right on the first try: ${s.firstTry}`, PW / 2, 550);
      ctx.fillText(`Treasures found: ${s.treasures.length}`, PW / 2, 620);
      ctx.fillText(`Towers conquered so far: ${this.progress.castles}`, PW / 2, 690);
      s.treasures.filter((t) => t !== 'Crown of Numeria').forEach((t, k, arr) => drawGem(ctx, PW / 2 + (k - (arr.length - 1) / 2) * 90, 800, 34, '#' + (TREASURES.find((x) => x[0] === t)?.[1] ?? 0xffffff).toString(16).padStart(6, '0')));
      vp.buttons = [{ id: 'again', label: 'Play Again', x: 262, y: 1000, w: 500, h: 150, kind: 'ok' }];
      const b = vp.buttons[0], hov = vp.hoverId === 'again';
      ctx.fillStyle = hov ? '#3fd57f' : '#23a55a'; roundRect(ctx, b.x, b.y, b.w, b.h, 30); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `bold 72px ${FONT}`; ctx.fillText(b.label, PW / 2, b.y + b.h / 2);
      vp.tex.needsUpdate = true;
    };
    vp.pressKey = (k) => { if (k === 'again') { this.sfx.click(); this.onPlayAgain?.(); } };
    vp.draw();
    vp.mesh.position.set(0, y0 + this.panelH + 0.1, -this.D / 2 + 0.2);
    vp.floor = TOP; vp.wallMounted = true; vp.lift = 0.1;
    vp.mesh.scale.setScalar(0.01);
    this.animate(0.5, (t) => vp.mesh.scale.setScalar(Math.max(0.01, t)), null, 1.5);
    this.world.add(vp.mesh); this.panels.push(vp);
    this.retirePanel(chest.panel, 1.2);
    this.onVictory?.(s);
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
  burst(pos, n = 40, size = 0.035, speed = 3) {
    const cols = [0xffd54a, 0xff5c8a, 0x5ce1ff, 0x7dff6b, 0xc58bff, 0xffffff];
    const geo = new THREE.PlaneGeometry(size, size);
    for (let k = 0; k < n; k++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: cols[k % cols.length], side: THREE.DoubleSide, fog: false }));
      m.position.copy(pos);
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.5 + Math.random() * 0.5));
      if (speed <= 3) v.y = 1.5 + Math.random() * 2.5;
      m.userData = { v, life: 1.6 + Math.random() * 0.8, spin: new THREE.Vector3(Math.random() * 10, Math.random() * 10, 0), floor: pos.y - 2 };
      this.scene.add(m); this.particles.push(m);
    }
  }

  // ---------------------------------------------------------- HUD
  makeHudTexture() {
    this.hudCanvas = document.createElement('canvas'); this.hudCanvas.width = 256; this.hudCanvas.height = 128;
    this.hudTex = new THREE.CanvasTexture(this.hudCanvas); this.hudTex.colorSpace = THREE.SRGBColorSpace;
    this.hudMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.06), new THREE.MeshBasicMaterial({ map: this.hudTex, transparent: true, depthTest: false }));
    this.hudMesh.renderOrder = 10;
    this.hudMesh.position.set(0, 0.05, 0.02); this.hudMesh.rotation.x = -0.6;
  }
  updateHud() {
    if (!this.stats) return;
    const n = this.stats.treasures.filter((t) => t !== 'Crown of Numeria').length;
    const el = document.getElementById('hud'); if (el) el.textContent = `Gems: ${n}   Floor: ${this.level + 1}/${FLOORS.length}`;
    const ctx = this.hudCanvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 128);
    ctx.fillStyle = 'rgba(30,20,60,0.85)'; roundRect(ctx, 0, 0, 256, 128, 24); ctx.fill();
    drawGem(ctx, 44, 42, 24, '#e0115f');
    ctx.fillStyle = '#fff'; ctx.font = `bold 50px ${FONT}`; ctx.textBaseline = 'middle'; ctx.fillText(`× ${n}`, 84, 44);
    ctx.font = `bold 36px ${FONT}`; ctx.fillStyle = '#ffe9a8'; ctx.fillText(`Floor ${this.level + 1}/${FLOORS.length}`, 22, 98);
    this.hudTex.needsUpdate = true;
  }

  // ---------------------------------------------------------- controls
  initControls() {
    this.raycaster = new THREE.Raycaster(); this.raycaster.far = 6;
    this.pointers = [];
    this.makeHudTexture();
    const wandMat = new THREE.MeshLambertMaterial({ color: 0x5a3a8a }), starMat = new THREE.MeshBasicMaterial({ color: 0xffe066 });
    const jointGeo = new THREE.SphereGeometry(1, 8, 6), jointMat = new THREE.MeshLambertMaterial({ color: 0xf1c8a8 }), tipMat = new THREE.MeshBasicMaterial({ color: 0xffe066 });
    for (let i = 0; i < 2; i++) {
      const c = this.renderer.xr.getController(i);
      const ray = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]), new THREE.LineBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.8 }));
      ray.visible = false; c.add(ray);
      const wand = new THREE.Group();
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.2, 8).rotateX(Math.PI / 2), wandMat); stick.position.z = -0.05; wand.add(stick);
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.018), starMat); star.position.z = -0.16; wand.add(star);
      c.add(wand);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe066 }));
      dot.visible = false; this.scene.add(dot);
      const ptr = { c, ray, wand, star, dot, src: null, hit: null, poke: new Map(), cool: 0 };
      c.addEventListener('connected', (e) => {
        ptr.src = e.data; wand.visible = !e.data.hand;
        if (e.data.handedness === 'left' && !e.data.hand) c.add(this.hudMesh);
      });
      c.addEventListener('disconnected', () => { ptr.src = null; dot.visible = false; });
      c.addEventListener('selectstart', () => this.select(ptr));
      this.rig.add(c);
      const hand = this.renderer.xr.getHand(i);
      hand.userData = { jointGeo, jointMat, tipMat };
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
      this.camera.rotation.x = clamp(this.camera.rotation.x - e.movementY * 0.0025, -1.4, 1.4);
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

  activePanel() {
    const head = this.headPos();
    let best = null, bd = 3.5;
    for (const p of this.panels) {
      if (!p.mesh.visible || (p.state !== 'solving' && p.state !== 'victory')) continue;
      const d = p.mesh.getWorldPosition(new THREE.Vector3()).distanceTo(head);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  headPos() { return this.camera.getWorldPosition(new THREE.Vector3()); }

  castFrom(origin, dir) {
    this.raycaster.set(origin, dir);
    const targets = [...this.blockers];
    for (const p of this.panels) if (p.mesh.visible) targets.push(p.mesh);
    for (const ch of this.chests) if (!ch.opened && !ch.big) ch.group.traverse((o) => { if (o.isMesh && o.userData.chest) targets.push(o); });
    const hit = this.raycaster.intersectObjects(targets, false)[0];
    if (!hit) return null;
    const o = hit.object;
    if (o.userData.panel) return { type: 'panel', panel: o.userData.panel, uv: hit.uv, point: hit.point, distance: hit.distance };
    if (o.userData.chest) return { type: 'chest', chest: o.userData.chest, point: hit.point, distance: hit.distance };
    return { type: 'block', point: hit.point, distance: hit.distance };
  }

  select(ptr) {
    this.sfx.resume();
    const h = ptr.hit;
    if (!h) return;
    if (h.type === 'panel') h.panel.press(h.uv);
    else if (h.type === 'chest') this.openChestPanel(h.chest);
  }

  // Finger / wand-tip touch: press a panel button when the tip pushes through
  // the panel's surface from the front. Returns the hovered panel + uv.
  poke(ptr, tip, dt) {
    ptr.cool = Math.max(0, ptr.cool - dt);
    let hover = null;
    for (const p of this.panels) {
      if (!p.mesh.visible || p.mesh.scale.x < 0.9) { ptr.poke.delete(p); continue; }
      const l = p.mesh.worldToLocal(tip.clone());
      const inside = Math.abs(l.x) < p.w / 2 && Math.abs(l.y) < p.h / 2;
      const prev = ptr.poke.has(p) ? ptr.poke.get(p) : l.z;
      ptr.poke.set(p, l.z);
      if (!inside) continue;
      const uv = new THREE.Vector2(l.x / p.w + 0.5, l.y / p.h + 0.5);
      if (l.z < 0.1 && l.z > -0.08) hover = { panel: p, uv };
      if (prev > 0.005 && l.z <= 0.005 && l.z > -0.08 && ptr.cool === 0) {
        const id = p.buttonAt(uv);
        if (id) { p.pressKey(id); ptr.cool = 0.3; this.haptic(ptr); }
      }
    }
    for (const ch of this.chests) {
      if (ch.opened || ch.panel || ch.big) continue;
      ch.box ??= new THREE.Box3();
      ch.box.setFromObject(ch.group.children[0]).expandByScalar(0.08);
      if (ch.box.containsPoint(tip)) { this.openChestPanel(ch); this.haptic(ptr); }
    }
    return hover;
  }

  haptic(ptr) { try { ptr.src?.gamepad?.hapticActuators?.[0]?.pulse?.(0.6, 40); } catch { /* optional */ } }

  updatePointers(dt) {
    const hovered = new Map();
    const tmpM = new THREE.Matrix4(), o = new THREE.Vector3(), d = new THREE.Vector3();
    if (this.renderer.xr.isPresenting) {
      for (const ptr of this.pointers) {
        const c = ptr.c;
        if (!ptr.src) { ptr.ray.visible = false; continue; }
        // touch
        let tip = null;
        const hand = ptr.hand;
        if (ptr.src.hand && hand.joints?.['index-finger-tip']) tip = hand.joints['index-finger-tip'].getWorldPosition(new THREE.Vector3());
        else if (!ptr.src.hand) tip = ptr.star.getWorldPosition(new THREE.Vector3());
        const touch = tip ? this.poke(ptr, tip, dt) : null;
        if (touch) hovered.set(touch.panel, touch.uv);
        // pointing ray (only drawn when it lands on something useful)
        tmpM.identity().extractRotation(c.matrixWorld);
        o.setFromMatrixPosition(c.matrixWorld); d.set(0, 0, -1).applyMatrix4(tmpM);
        const hit = touch ? null : this.castFrom(o, d);
        ptr.hit = hit;
        const useful = hit && (hit.type === 'panel' || hit.type === 'chest');
        if (useful && hit.type === 'panel') hovered.set(hit.panel, hit.uv);
        ptr.ray.visible = !!useful; if (useful) ptr.ray.scale.z = hit.distance;
        ptr.dot.visible = !!useful; if (useful) ptr.dot.position.copy(hit.point);
        // hand joints
        if (hand?.joints) for (const [name, j] of Object.entries(hand.joints)) if (!j.userData.mesh) {
          const m = new THREE.Mesh(hand.userData.jointGeo, name === 'index-finger-tip' ? hand.userData.tipMat : hand.userData.jointMat);
          m.scale.setScalar(j.jointRadius || 0.008); j.add(m); j.userData.mesh = m;
        }
      }
    } else {
      this.camera.getWorldPosition(o); this.camera.getWorldDirection(d);
      this.desktopPtr.hit = this.castFrom(o, d);
      const h = this.desktopPtr.hit;
      if (h?.type === 'panel') hovered.set(h.panel, h.uv);
      document.getElementById('crosshair')?.classList.toggle('active', !!h && h.type !== 'block');
    }
    for (const p of this.panels) p.hover(hovered.get(p) || null);
  }

  // ---------------------------------------------------------- frame loop
  frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05), t = this.clock.elapsedTime;
    if (!this.world) { this.renderer.render(this.scene, this.camera); return; }
    const xr = this.renderer.xr.isPresenting;
    if (!xr) { // desktop walking, kept inside the room
      const f = (this.keys.has('w') || this.keys.has('arrowup') ? 1 : 0) - (this.keys.has('s') || this.keys.has('arrowdown') ? 1 : 0);
      const s = (this.keys.has('d') ? 1 : 0) - (this.keys.has('a') ? 1 : 0);
      if (this.keys.has('arrowleft')) this.camera.rotation.y += 1.8 * dt;
      if (this.keys.has('arrowright')) this.camera.rotation.y -= 1.8 * dt;
      if (f || s) {
        const yaw = this.camera.rotation.y, sp = 1.6 * dt, mx = this.W / 2 - 0.25, mz = this.D / 2 - 0.25;
        this.rig.position.x = clamp(this.rig.position.x + (-Math.sin(yaw) * f + Math.cos(yaw) * s) * sp, -mx, mx);
        this.rig.position.z = clamp(this.rig.position.z + (-Math.cos(yaw) * f - Math.sin(yaw) * s) * sp, -mz, mz);
      }
    }
    const head = this.headPos();
    // panels sit a little below the player's eyes so the keypad is in easy reach
    const eye = head.y - this.rig.position.y;
    this.panelH += (clamp(eye - 0.3, 0.75, 1.3) - this.panelH) * Math.min(1, dt * 2);
    for (const p of this.panels) { if (p.wallMounted) p.mesh.position.y = fy(p.floor) + this.panelH + (p.lift || 0); p.update(); }
    this.updateLift(dt, head);
    for (const a of this.anims) { a.t += dt; if (a.t >= 0) a.fn(Math.min(1, a.t / a.dur)); }
    for (const a of this.anims.filter((a) => a.t >= a.dur)) a.done?.();
    this.anims = this.anims.filter((a) => a.t < a.dur);
    for (const m of this.particles) {
      const u = m.userData;
      u.v.y -= 4 * dt; m.position.addScaledVector(u.v, dt);
      m.rotation.x += u.spin.x * dt; m.rotation.y += u.spin.y * dt;
      u.life -= dt; if (u.life <= 0) { this.scene.remove(m); m.material.dispose(); }
    }
    this.particles = this.particles.filter((m) => m.userData.life > 0);
    const fl = 0.85 + 0.15 * Math.sin(t * 13) * Math.sin(t * 7.3);
    this.mats.flame.color.setRGB(1, 0.55 + 0.1 * fl, 0.2);
    this.lights.forEach((l, i) => { if (l.intensity > 0) l.intensity = 6 * (0.92 + 0.08 * Math.sin(t * 9 + i * 2)); });
    for (const ch of this.chests) if (!ch.opened && ch.q.visible) { ch.q.position.y = 1.3 + Math.sin(t * 2 + ch.i) * 0.06; ch.q.lookAt(head); }
    for (const o of this.floaters) { o.position.y = o.userData.base + Math.sin(t + o.userData.phase) * 0.15; o.rotation.y += dt; }
    this.updatePointers(dt);
    this.renderer.render(this.scene, this.camera);
  }
}
