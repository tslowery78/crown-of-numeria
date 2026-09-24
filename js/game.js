// Crown of Numeria: a room-scale WebXR math tower for Meta Quest 3 (also
// playable with mouse + keyboard). Each floor of the tower is one room sized
// to the real play area. Solving a floor's Magic Lock opens the ceiling hatch;
// standing on the magic square lifts the player up to the next floor.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/BufferGeometryUtils.js';
import { Reflector } from 'three/addons/Reflector.js';
import { RoomEnvironment } from 'three/addons/RoomEnvironment.js';
import { ProblemSource, isCorrect, speakable } from './problems.js';
import { AudioEngine, FLOOR_MOODS } from './audio.js';
import { buildAvatar, AvatarRig, MIRROR_LAYER } from './avatar.js';
import { Props } from './props.js';
import { GemTray } from './tray.js';
import { MagicScroll } from './scroll.js';

// ------------------------------------------------------------ layout
const FH = 3.6, SLAB = 0.4, CEIL = FH - SLAB, WALL_T = 0.3, HATCH = 1.2;
const WIN = { w: 0.9, sill: 0.8, h: 1.1 }; // arched window: straight part + semicircle on top
const FLOORS = [
  { name: 'Entrance Hall', banner: '#2e7d32', floor: 'stone', light: 0xffc27a, emblem: '♔', windows: 'S' },
  { name: 'Great Hall', banner: '#c62828', floor: 'wood', light: 0xffb866, emblem: '♕', windows: 'WS' },
  { name: 'Royal Library', banner: '#1565c0', floor: 'wood', light: 0xffd08a, emblem: '♖', windows: 'S' },
  { name: "Knights' Armory", banner: '#6a1b9a', floor: 'stone', light: 0xffc27a, emblem: '♘', windows: 'WS' },
  { name: 'Crystal Chamber', banner: '#00838f', floor: 'stone', light: 0xb9a0ff, emblem: '✦', windows: 'EWS' },
  { name: 'Tower Top', banner: '#f9a825', floor: 'stone', light: 0xffffff, emblem: '♛', roof: true, windows: '' },
];
const TOP = FLOORS.length - 1;
const fy = (i) => i * FH;
const ROOM_MIN = 1.6, ROOM_MAX = 5, EDGE_MARGIN = 0.15;
const TREASURES = [
  ['Ruby', 0xe0115f], ['Sapphire', 0x2a6cff], ['Emerald', 0x1fc46b], ['Amethyst', 0x9b4dff], ['Golden Star', 0xffc629],
];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

let duckMusic = null;
function speak(text) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(speakable(text));
  u.rate = 0.9; u.pitch = 1.1;
  duckMusic?.(Math.min(10, 1 + text.length / 12));
  speechSynthesis.speak(u);
}

// ------------------------------------------------------------ textures
function canvasTexture(w, h, draw, wrap = false, color = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const noise = (ctx, w, h, n, alpha) => { for (let i = 0; i < n; i++) { ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * alpha})`; ctx.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 4, 2 + Math.random() * 4); } };

// Tangent-space normal map from a grayscale height canvas (Sobel filter).
function normalFromHeight(hc, strength = 2.5) {
  const w = hc.width, h = hc.height, src = hc.getContext('2d').getImageData(0, 0, w, h).data;
  const out = document.createElement('canvas'); out.width = w; out.height = h;
  const octx = out.getContext('2d'), img = octx.createImageData(w, h), d = img.data;
  const H = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength;
    const nz = 1 / Math.hypot(dx, dy, 1), i = (y * w + x) * 4;
    d[i] = (-dx * nz * 0.5 + 0.5) * 255; d[i + 1] = (dy * nz * 0.5 + 0.5) * 255; d[i + 2] = (nz * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  octx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(out); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}
// Brick / tile / plank generator that draws matching color + height canvases.
function surfaceMaps(kind, base) {
  const S = 512, col = document.createElement('canvas'), hgt = document.createElement('canvas');
  col.width = col.height = hgt.width = hgt.height = S;
  const c = col.getContext('2d'), h = hgt.getContext('2d');
  h.fillStyle = '#000'; h.fillRect(0, 0, S, S);
  const shade = (k) => `rgb(${base[0] * k | 0},${base[1] * k | 0},${base[2] * k | 0})`;
  if (kind === 'wood') {
    const n = 6, pw = S / n;
    for (let i = 0; i < n; i++) {
      const k = 0.78 + Math.random() * 0.3;
      c.fillStyle = shade(k); c.fillRect(i * pw, 0, pw, S);
      c.strokeStyle = 'rgba(40,20,5,0.25)';
      for (let g = 0; g < 12; g++) { c.beginPath(); const x = i * pw + Math.random() * pw; c.moveTo(x, 0); c.bezierCurveTo(x + 10, S / 3, x - 10, (2 * S) / 3, x, S); c.stroke(); }
      const joint = Math.random() * S; c.fillStyle = 'rgba(20,10,0,0.5)'; c.fillRect(i * pw, joint, pw, 3);
      h.fillStyle = '#ddd'; h.fillRect(i * pw + 3, 0, pw - 6, S); h.fillStyle = '#000'; h.fillRect(i * pw, joint, pw, 3);
      c.fillStyle = 'rgba(20,10,0,0.7)'; c.fillRect(i * pw, 0, 3, S);
    }
    noise(c, S, S, 1800, 0.07);
  } else {
    // broad, quiet sandstone blocks with shallow joints (tile = floor slabs)
    const rows = kind === 'tile' ? 3 : 5, rh = S / rows, bw = kind === 'tile' ? S / 3 : S / 3;
    c.fillStyle = shade(0.8); c.fillRect(0, 0, S, S);
    h.fillStyle = '#555'; h.fillRect(0, 0, S, S);
    for (let r = 0; r < rows; r++) {
      const off = kind === 'tile' ? 0 : r % 2 ? bw / 2 : 0;
      for (let x = -off; x < S; x += bw) {
        const k = 0.93 + Math.random() * 0.12, gap = 2, x0 = x + gap, y0 = r * rh + gap, ww = bw - 2 * gap, hh = rh - 2 * gap;
        c.fillStyle = shade(k); c.fillRect(x0, y0, ww, hh);
        const g = c.createLinearGradient(0, y0, 0, y0 + hh); g.addColorStop(0, 'rgba(255,255,255,0.06)'); g.addColorStop(0.25, 'rgba(255,255,255,0)'); g.addColorStop(0.85, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.08)');
        c.fillStyle = g; c.fillRect(x0, y0, ww, hh);
        for (let b = 0; b < 4; b++) { const v = 150 + b * 25; h.fillStyle = `rgb(${v},${v},${v})`; h.fillRect(x0 + b, y0 + b, ww - 2 * b, hh - 2 * b); }
      }
    }
    noise(c, S, S, 1200, 0.035); noise(h, S, S, 800, 0.04);
  }
  const map = new THREE.CanvasTexture(col); map.colorSpace = THREE.SRGBColorSpace; map.wrapS = map.wrapT = THREE.RepeatWrapping; map.anisotropy = 4;
  return { map, normalMap: normalFromHeight(hgt, kind === 'wood' ? 1.2 : 1.1) };
}

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
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }));
}

// ------------------------------------------------------------ puzzle panel
const PW = 1024, PH = 1280;
class Panel {
  constructor(game, { title, count, onSolved, doneText = 'Unlocked!', width = 0.8, defer = false }) {
    Object.assign(this, { game, title, count, onSolved, doneText });
    this.w = width; this.h = width * PH / PW;
    this.solved = 0; this.input = ''; this.wrong = 0; this.msg = ''; this.msgColor = '#fff';
    this.hoverId = null; this.busyUntil = 0; this.after = null; this.state = 'solving';
    this.canvas = document.createElement('canvas'); this.canvas.width = PW; this.canvas.height = PH;
    this.ctx = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 8;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width * PH / PW), new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, toneMapped: false }));
    this.mesh.userData.panel = this;
    if (defer) this.draw(); else this.newProblem();
  }
  activate() { if (!this.problem && this.state === 'solving') this.newProblem(); }
  newProblem() {
    this.problem = this.game.source.next();
    this.input = ''; this.wrong = 0; this.msg = ''; this.firstTry = true; this.tries = []; this.shownAt = performance.now();
    this.onProblem?.(this.problem);
    this.draw();
  }
  layoutButtons() {
    const b = [], g4 = this.game.opts.grade === 4;
    b.push({ id: 'read', label: 'Read', x: 600, y: 18, w: 190, h: 76, kind: 'tool' });
    b.push({ id: 'hint', label: 'Hint', x: 810, y: 18, w: 190, h: 76, kind: 'tool' });
    if (this.state !== 'solving' || !this.problem) return b;
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
    const rows = g4 || p.homework
      ? [['1', '2', '3', '⌫'], ['4', '5', '6', '/'], ['7', '8', '9', '.'], ['±', '0', 'OK']]
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
    const ctx = this.ctx, p = this.problem || { text: 'Reach this floor to begin.' };
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
    if (this.state !== 'solving' || !this.problem) return;
    if (k === 'read') { speak(this.problem.text); this.game.sfx.click(); return; }
    if (k === 'hint') { this.msg = `Hint: ${this.problem.hint}`; this.msgColor = '#ffd86b'; this.firstTry = false; this.game.sfx.click(); this.draw(); return; }
    if (now < this.busyUntil) return;
    this.game.sfx.click();
    if (k.startsWith('choice:')) return this.submit(k.slice(7));
    if (this.problem.choices) return;
    if (/^[0-9./]$/.test(k)) { if (this.input.length < 20) this.input += k; }
    else if (k === '±' || k === '-') { this.input = this.input.startsWith('-') ? this.input.slice(1) : this.input.length < 20 ? '-' + this.input : this.input; }
    else if (k === '⌫') this.input = this.input.slice(0, -1);
    else if (k === 'C') this.input = '';
    else if (k === 'OK') return this.submit(this.input);
    this.draw();
  }
  submit(val) {
    const g = this.game;
    if (!val) { this.msg = 'Type your answer, then press OK.'; this.msgColor = '#ffd86b'; this.draw(); return; }
    g.stats.attempts++;
    this.tries?.push(val);
    if (isCorrect(this.problem, val)) {
      g.sfx.correct(); g.stats.correct++; if (this.firstTry) g.stats.firstTry++;
      this.solved++;
      g.logProblem?.(this, true);
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
        g.logProblem?.(this, false);
        // hands-on problems replay the operation on the gem tray before moving on
        const tray = this.game.tray, demo = this.problem.manip && tray?.panel === this ? tray.demo(this.problem.answer) : 0;
        this.busyUntil = performance.now() + Math.max(3500, demo * 1000 + 1500); this.after = () => this.newProblem();
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
  if (!Array.isArray(pts) || pts.length < 3 || pts.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.z))) throw new Error('No usable Guardian boundary was returned. Choose a measured play-area size.');
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
  makeSign(text, o) { return makeSign(text, o); }
  constructor(opts) {
    this.opts = opts; // { name, grade, moduleIds, perDoor, homework, homeworkOnly, roomSize, avatar, music }
    this.audio = this.sfx = new AudioEngine({ musicVolume: opts.music ?? 0.5 });
    duckMusic = (s) => this.audio.duck(s);
    this.clock = new THREE.Clock();
    this.anims = []; this.particles = []; this.extraTips = [];
    this.initRenderer();
    this.initControls();
    this.renderer.setAnimationLoop((time, frame) => this.frame(frame));
  }

  presetSize() { const n = parseFloat(this.opts.roomSize); return Number.isFinite(n) ? n : 2.5; }

  startDesktop() {
    const s = this.presetSize();
    this.buildWorld(s, s);
    this.startAudio();
  }
  startAudio() { this.audio.resume(); this.audio.startMusic(FLOOR_MOODS[this.level ?? 0]); this.audio.startAmbience(); }

  async enterVR() {
    const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] });
    this.xrBoundsSpace = null; this.xrReset = false;
    try {
      let type = 'local-floor', w = this.presetSize(), d = w, cx = 0, cz = 0;
      if (this.opts.roomSize === 'auto') {
        let space;
        try { space = await session.requestReferenceSpace('bounded-floor'); }
        catch { throw new Error('Guardian bounds are unavailable. Choose a measured play-area size.'); }
        const pts = space.boundsGeometry;
        const fit = fitRoom(Array.from(pts || [], (p) => ({ x: p.x, z: p.z })));
        w = fit.w - 2 * EDGE_MARGIN; d = fit.d - 2 * EDGE_MARGIN;
        if (w < ROOM_MIN || d < ROOM_MIN) throw new Error('The reported Guardian area is too small for the castle. Choose a measured play-area size or enlarge the clear space.');
        type = 'bounded-floor'; cx = fit.cx; cz = fit.cz;
        this.xrBoundsSpace = space;
      }
      this.fitInfo = { type, w, d };
      this.renderer.xr.setReferenceSpaceType(type);
      this.buildWorld(w, d);
      this.rig.rotation.set(0, 0, 0); this.rig.position.set(-cx, fy(this.level), -cz);
      this.xrCalibrating = type === 'local-floor';
      this.camera.position.set(0, 0, 0); this.camera.rotation.set(0, 0, 0);
      await this.renderer.xr.setSession(session);
      // Use the exact bounded space whose geometry was fitted.
      if (this.xrBoundsSpace) this.renderer.xr.setReferenceSpace(this.xrBoundsSpace);
      const reference = this.renderer.xr.getReferenceSpace();
      // Recentering (long-press of the Meta button) resets the space. In measured-size mode just
      // re-centre the room on where she now stands and keep her progress; Guardian-fit mode restarts.
      // Recentering (long-press of the Meta button) resets the space. In measured-size mode keep
      // her progress and keep the castle on the same physical spot: apply the reset transform, or,
      // if the headset gives none, ask her to walk back to the middle. Guardian-fit mode restarts.
      const reset = (ev) => {
        if (type !== 'local-floor') { this.xrReset = true; session.end().catch(() => {}); return; }
        if (ev?.transform) this.applyResetTransform(ev.transform);
        else this.askForCenter();
      };
      reference.addEventListener('reset', reset);
      session.addEventListener('end', () => {
        reference.removeEventListener('reset', reset);
        this.xrCalibrating = false; this.xrBoundsSpace = null;
        this.camera.position.set(0, 1.3, 0); this.rig.position.x = this.rig.position.z = 0; this.rig.rotation.set(0, 0, 0);
        if (this.xrReset) this.onResetVR?.(); else this.onExitVR?.();
      });
      this.startAudio();
    } catch (e) {
      this.xrCalibrating = false; this.xrBoundsSpace = null;
      await session.end().catch(() => {});
      throw e;
    }
  }

  // A reference-space reset moves the origin; `t` is the new origin expressed in the old
  // coordinates (p_old = T·p_new). Keeping physical points fixed in the world needs
  // rig_new = rig_old·T. Height stays with the current floor.
  applyResetTransform(t) {
    const T = new THREE.Matrix4().compose(new THREE.Vector3(t.position.x, t.position.y, t.position.z), new THREE.Quaternion(t.orientation.x, t.orientation.y, t.orientation.z, t.orientation.w), new THREE.Vector3(1, 1, 1));
    this.rig.updateMatrix();
    const M = this.rig.matrix.clone().multiply(T), p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    M.decompose(p, q, sc);
    const yaw = new THREE.Euler().setFromQuaternion(q, 'YXZ').y;
    this.rig.position.set(p.x, this.rig.position.y, p.z); this.rig.rotation.set(0, yaw, 0);
    this.rig.updateMatrixWorld(true);
  }
  // No reset transform: pause re-centring until she stands in the middle and pinches.
  askForCenter() {
    this.centerPrompt = true;
    this.centerSign ??= makeSign('Walk to the middle of your play space, face the Magic Lock wall, then pinch or pull the trigger.', { w: 1.1, h: 0.36, size: 64, bg: '#1f2a44', border: '#7fb2ff', fg: '#e8f0ff' });
    this.scene.add(this.centerSign);
  }
  confirmCenter() {
    this.centerPrompt = false; this.xrCalibrating = true;
    if (this.centerSign) this.scene.remove(this.centerSign);
  }

  calibrateXR(pose) {
    const { position, orientation } = pose.transform;
    const q = new THREE.Quaternion(orientation.x, orientation.y, orientation.z, orientation.w);
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
    if (Math.hypot(forward.x, forward.z) < 0.1) return false; // wait until looking roughly forward
    const yaw = Math.atan2(-forward.x, -forward.z);
    this.rig.rotation.y = -yaw;
    const start = new THREE.Vector3(position.x, 0, position.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), -yaw);
    this.rig.position.x = -start.x; this.rig.position.z = -start.z;
    this.rig.updateMatrixWorld(true); this.xrCalibrating = false;
    return true;
  }

  // ---------------------------------------------------------- setup
  initRenderer() {
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.setSize(window.innerWidth, window.innerHeight);
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    r.xr.enabled = true;
    r.xr.setReferenceSpaceType('local-floor');
    r.xr.setFoveation(1);
    document.body.appendChild(r.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xbfe3ff);
    this.scene.fog = new THREE.Fog(0xcfe6ff, 180, 800);
    const pm = new THREE.PMREMGenerator(r);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.35;
    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.03, 1200);
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
    if (!Number.isFinite(W) || !Number.isFinite(D) || W < ROOM_MIN || D < ROOM_MIN) throw new Error('The play area is too small for the castle.');
    W = Math.min(W, ROOM_MAX); D = Math.min(D, ROOM_MAX);
    this.W = W; this.D = D;
    if (this.world) { this.scene.remove(this.world); this.world.traverse((o) => { o.geometry?.dispose(); }); }
    this.world = new THREE.Group(); this.scene.add(this.world);
    this.source = new ProblemSource({ ...this.opts, homeworkDone: this.opts.resume?.hwDone || [] });
    this.session = this.opts.resume?.session ? { ...this.opts.resume.session, problems: this.loadSessionProblems(this.opts.resume.session.id) } : { id: Date.now(), start: Date.now(), problems: [], hwDone: [] };
    this.session.hwDone ??= [];
    this.stats = { attempts: 0, correct: 0, firstTry: 0, missed: [], treasures: [] };
    this.level = 0; this.lift = { state: 'locked', dwell: 0, t: 0 };
    this.panels = []; this.chests = []; this.locks = []; this.hatches = []; this.blockers = []; this.floaters = [];
    this.mirrors = []; this.windows = []; this.torches = []; this.spinners = [];
    this.panelH = 1.0;
    this.rig.position.set(0, 0, 0);

    const S = new StaticBatch(), world = this.world, hw = W / 2, hd = D / 2;
    const Std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, ...o });
    const stoneMaps = surfaceMaps('brick', [206, 180, 140]), darkMaps = surfaceMaps('brick', [168, 146, 116]), tileMaps = surfaceMaps('tile', [222, 206, 178]);
    const woodMaps = surfaceMaps('wood', [150, 98, 56]), plankMaps = surfaceMaps('wood', [96, 60, 34]);
    const mats = this.mats = {
      stone: Std({ ...stoneMaps, roughness: 0.92 }), stoneDark: Std({ ...darkMaps, roughness: 0.92 }),
      wood: Std({ ...woodMaps, roughness: 0.7 }), woodDark: Std({ ...plankMaps, roughness: 0.75 }),
      iron: Std({ color: 0x2c2c33, metalness: 0.6, roughness: 0.45 }), gold: Std({ color: 0xd9a627, metalness: 0.85, roughness: 0.3 }), red: Std({ color: 0x9c1b24 }),
      flame: new THREE.MeshBasicMaterial({ color: 0xffa640, toneMapped: false }), Std,
    };
    mats.flame.userData.noBlock = true;
    const floorMats = { stone: Std({ ...tileMaps, roughness: 0.9 }), wood: Std({ ...surfaceMaps('wood', [165, 110, 64]), roughness: 0.65 }) };
    const plane = (w, h) => tileUV(new THREE.PlaneGeometry(w, h), [w, h], 1.5);
    const ring = (w, d, h) => [
      { x: 0, z: -(h / 2 + (d - h) / 4), w, d: (d - h) / 2 }, { x: 0, z: h / 2 + (d - h) / 4, w, d: (d - h) / 2 },
      { x: -(h / 2 + (w - h) / 4), z: 0, w: (w - h) / 2, d: h }, { x: h / 2 + (w - h) / 4, z: 0, w: (w - h) / 2, d: h },
    ];
    // light shafts and flower boxes for windows
    const shaftMat = new THREE.MeshBasicMaterial({ map: canvasTexture(128, 128, (c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,236,190,1)'); g.addColorStop(1, 'rgba(255,236,190,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); }), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    shaftMat.userData.noBlock = true;
    const flowerCols = [0xff6fae, 0xffd54a, 0xffffff, 0x9b7bff].map((c) => Std({ color: c, roughness: 0.6 }));
    const leafMat = Std({ color: 0x3f8f3a });
    // a wall with an optional centred arched window
    const wall = (y0, h, cx, cz, len, alongX, win, inward) => {
      const place = (geo, u, yc) => { const g2 = geo.clone(); if (!alongX) g2.rotateY(Math.PI / 2); S.add(g2, mats.stone, [alongX ? cx + u : cx, y0 + yc, alongX ? cz : cz + u]); };
      const box = (u, yc, l, ph) => place(tileUV(new THREE.BoxGeometry(l, ph, WALL_T), [l, ph, WALL_T], 1.5), u, yc);
      if (!win) return box(0, h / 2, len, h);
      const ww = WIN.w, side = (len - ww) / 2, archY = WIN.sill + WIN.h;
      box(-(ww / 2 + side / 2), h / 2, side, h); box(ww / 2 + side / 2, h / 2, side, h);
      box(0, WIN.sill / 2, ww, WIN.sill);
      const sh = new THREE.Shape(); sh.moveTo(-ww / 2, h); sh.lineTo(ww / 2, h); sh.lineTo(ww / 2, archY); sh.absarc(0, archY, ww / 2, 0, Math.PI, false); sh.lineTo(-ww / 2, h);
      const arch = new THREE.ExtrudeGeometry(sh, { depth: WALL_T, bevelEnabled: false, curveSegments: 16 }).translate(0, 0, -WALL_T / 2);
      const uv = arch.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 1.5, uv.getY(i) / 1.5);
      place(arch, 0, 0);
      // sill, flower box outside, light shaft inside
      const sill = new THREE.BoxGeometry(ww + 0.12, 0.06, WALL_T + 0.16); if (!alongX) sill.rotateY(Math.PI / 2);
      S.add(sill, mats.stoneDark, [cx, y0 + WIN.sill - 0.03, cz]);
      const out = inward.clone().multiplyScalar(-1), ox = cx + out.x * (WALL_T / 2 + 0.12), oz = cz + out.z * (WALL_T / 2 + 0.12);
      const fb = new THREE.BoxGeometry(alongX ? ww : 0.16, 0.14, alongX ? 0.16 : ww); S.add(fb, mats.wood, [ox, y0 + WIN.sill - 0.13, oz]);
      for (let k = 0; k < 7; k++) { const u = -ww / 2 + 0.08 + k * ((ww - 0.16) / 6), fx = alongX ? ox + u : ox, fz = alongX ? oz : oz + u; S.add(new THREE.SphereGeometry(0.035, 8, 6), leafMat, [fx, y0 + WIN.sill - 0.04, fz]); S.add(new THREE.SphereGeometry(0.03, 8, 6), flowerCols[k % 4], [fx, y0 + WIN.sill + 0.01, fz]); }
      // warm patch of sunlight on the floor below the window
      const sp = new THREE.Vector3(cx, y0 + 0.006, cz).addScaledVector(inward, WALL_T / 2 + 0.55);
      S.add(new THREE.PlaneGeometry(alongX ? ww * 1.1 : 0.9, alongX ? 0.9 : ww * 1.1), shaftMat, [sp.x, sp.y, sp.z], [-Math.PI / 2, 0, 0]);
      this.windows.push({ pos: new THREE.Vector3(cx, y0 + archY - 0.3, cz), out, y0 });
    };

    this.buildKingdom(S);

    FLOORS.forEach((fl, i) => {
      const y0 = fy(i), roof = !!fl.roof, wallH = roof ? 1.0 : FH;
      if (i === 0) S.add(plane(W, D), floorMats[fl.floor], [0, 0, 0], [-Math.PI / 2, 0, 0]);
      const win = (side) => !roof && fl.windows.includes(side);
      wall(y0, wallH, 0, -hd - WALL_T / 2, W + 2 * WALL_T, true, false);
      wall(y0, wallH, 0, hd + WALL_T / 2, W + 2 * WALL_T, true, win('S') && W >= 1.5, new THREE.Vector3(0, 0, -1));
      wall(y0, wallH, hw + WALL_T / 2, 0, D, false, win('E') && D >= 1.5, new THREE.Vector3(-1, 0, 0));
      wall(y0, wallH, -hw - WALL_T / 2, 0, D, false, win('W') && D >= 1.5, new THREE.Vector3(1, 0, 0));
      if (roof) {
        for (const [cx, cz, len, alongX] of [[0, -hd - WALL_T / 2, W + 2 * WALL_T, true], [0, hd + WALL_T / 2, W + 2 * WALL_T, true], [hw + WALL_T / 2, 0, D, false], [-hw - WALL_T / 2, 0, D, false]]) {
          const n = Math.max(2, Math.floor(len / 0.7));
          for (let k = 0; k < n; k++) { const u = -len / 2 + (k + 0.5) * (len / n); S.box(alongX ? 0.3 : WALL_T, 0.4, alongX ? WALL_T : 0.3, mats.stone, [alongX ? cx + u : cx, y0 + 1.2, alongX ? cz : cz + u], [0, 0, 0], 1); }
        }
        const flagMat = Std({ color: 0xff4f9a, side: THREE.DoubleSide }); flagMat.userData.noBlock = true;
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
          const x = sx * (hw + WALL_T / 2), z = sz * (hd + WALL_T / 2);
          S.add(new THREE.CylinderGeometry(0.03, 0.03, 2.6, 8), mats.iron, [x, y0 + 2.3, z]);
          S.add(new THREE.SphereGeometry(0.06, 10, 8), mats.gold, [x, y0 + 3.62, z]);
          const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.45, 8, 1), flagMat); flag.position.set(x + 0.36, y0 + 3.3, z); world.add(flag); this.spinners.push({ o: flag, kind: 'flag', base: flag.geometry.attributes.position.array.slice() });
        }
      } else {
        const nextFloor = floorMats[FLOORS[i + 1].floor];
        for (const r of ring(W, D, HATCH)) {
          S.box(r.w, SLAB, r.d, nextFloor, [r.x, y0 + CEIL + SLAB / 2, r.z], [0, 0, 0], 1.5);
          S.add(plane(r.w, r.d), mats.woodDark, [r.x, y0 + CEIL - 0.004, r.z], [Math.PI / 2, 0, 0]);
        }
        for (const s of [-1, 1]) { S.box(0.1, 0.1, HATCH + 0.2, mats.gold, [s * (HATCH / 2 + 0.05), y0 + CEIL - 0.05, 0]); S.box(HATCH + 0.2, 0.1, 0.1, mats.gold, [0, y0 + CEIL - 0.05, s * (HATCH / 2 + 0.05)]); }
        // ceiling beams and baseboards give the room depth
        for (const s of [-1, 1]) S.box(W, 0.18, 0.16, mats.woodDark, [0, y0 + CEIL - 0.09, s * (HATCH / 2 + (hd - HATCH / 2) / 2)], [0, 0, 0], 1);
        for (const [x, z, l, ax] of [[0, -hd + 0.02, W, true], [0, hd - 0.02, W, true], [hw - 0.02, 0, D, false], [-hw + 0.02, 0, D, false]]) S.box(ax ? l : 0.04, 0.12, ax ? 0.04 : l, mats.woodDark, [x, y0 + 0.06, z], [0, 0, 0], 1);
        const hm = nextFloor.clone(); hm.transparent = true;
        const hatch = new THREE.Mesh(tileUV(new THREE.BoxGeometry(HATCH, SLAB, HATCH), [HATCH, SLAB, HATCH], 1.5), hm);
        hatch.position.set(0, y0 + CEIL + SLAB / 2, 0);
        world.add(hatch); this.hatches.push(hatch); this.blockers.push(hatch);
        // torches with glowing flame sprites
        for (const s of [-1, 1]) {
          const x = s * (hw - 0.1), z = -hd + 0.45;
          S.box(0.05, 0.36, 0.05, mats.iron, [x, y0 + 1.95, z], [0, 0, s * 0.35]);
          S.add(new THREE.CylinderGeometry(0.075, 0.045, 0.1, 10), mats.iron, [x - s * 0.07, y0 + 2.15, z]);
          const fl2 = new THREE.Sprite(this.flameSprite ??= new THREE.SpriteMaterial({ map: canvasTexture(64, 128, (c, w, h) => { const g = c.createRadialGradient(w / 2, h * 0.7, 2, w / 2, h * 0.6, w / 2); g.addColorStop(0, 'rgba(255,255,220,1)'); g.addColorStop(0.35, 'rgba(255,190,60,0.9)'); g.addColorStop(1, 'rgba(255,90,0,0)'); c.fillStyle = g; c.beginPath(); c.ellipse(w / 2, h * 0.62, w / 2, h * 0.38, 0, 0, 7); c.fill(); }), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
          fl2.scale.set(0.14, 0.26, 1); fl2.position.set(x - s * 0.07, y0 + 2.3, z); world.add(fl2);
          this.torches.push({ sprite: fl2, pos: fl2.position.clone(), floor: i, ph: Math.random() * 6 });
        }
        const bx = Math.min(hw - 0.3, 0.95);
        if (bx >= 0.7) { const bm = this.bannerMat(fl); for (const s of [-1, 1]) S.add(new THREE.PlaneGeometry(0.5, 1.0), bm, [s * bx, y0 + 2.5, hd - 0.02], [0, Math.PI, 0]); }
        const sign = makeSign(`Floor ${i + 1}: ${fl.name}`, { w: Math.min(1.8, W - 0.2), h: 0.32, size: 80 });
        sign.position.set(0, y0 + 2.3, -hd + 0.02); world.add(sign);
        // rug in front of the Magic Lock
        const rugMat = Std({ map: this.rugTexture(fl.banner), roughness: 1 }); rugMat.userData.noBlock = true;
        S.add(new THREE.CircleGeometry(Math.min(0.55, hd - HATCH / 2 - 0.05), 40), rugMat, [0, y0 + 0.004, -hd + Math.min(0.55, hd - HATCH / 2 - 0.05) + 0.02], [-Math.PI / 2, 0, 0]);
      }
      this.decorate(S, i, W, D);
    });
    S.build(world, this.blockers);

    this.lights = [0, 1].map(() => { const l = new THREE.PointLight(0xffc27a, 4, 9, 1.4); world.add(l); return l; });
    this.placeLights();

    this.tray = new GemTray(this); world.add(this.tray.group);
    this.scroll = new MagicScroll(this); world.add(this.scroll.group);
    this.tray.place(0, 0, W, D, this.panelH);
    for (let i = 0; i < TOP; i++) this.makeLock(i);
    for (let i = 0; i < TOP; i++) this.makeChest(i);
    this.makeFinale();
    this.makeLift();
    this.makeWelcome();
    this.makeMirror(0, new THREE.Vector3(hw - 0.02, 0, 0), -Math.PI / 2);
    this.makeMirror(3, new THREE.Vector3(hw - 0.02, fy(3), 0), -Math.PI / 2);
    this.makeMirror(TOP, new THREE.Vector3(-hw + 0.35, fy(TOP), 0), Math.PI / 2, true);
    this.makeDust();

    // avatar
    if (this.avatar) this.scene.remove(this.avatar.root);
    this.avatar = buildAvatar(this.opts.avatar);
    this.avatarRig = new AvatarRig(this.avatar);
    this.scene.add(this.avatar.root);
    // props & creatures
    this.props = new Props(this);
    this.props.build({ W, D, fy, FH, CEIL, FLOORS, TOP });
    if (this.opts.resume) this.applyResume(this.opts.resume);
    (this.level >= TOP ? this.finalChest.panel : this.locks[this.level].panel).activate();
    this.updateHud();
  }

  rugTexture(color) {
    return canvasTexture(512, 512, (c, w, h) => {
      c.fillStyle = color; c.beginPath(); c.arc(w / 2, h / 2, w / 2, 0, 7); c.fill();
      c.strokeStyle = '#ffd54a'; c.lineWidth = 14; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 20, 0, 7); c.stroke();
      c.lineWidth = 6; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 50, 0, 7); c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.18)'; for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; c.beginPath(); c.arc(w / 2 + Math.cos(a) * 150, h / 2 + Math.sin(a) * 150, 22, 0, 7); c.fill(); }
      c.fillStyle = '#ffd54a'; c.font = 'bold 150px serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('★', w / 2, h / 2);
      noise(c, w, h, 3000, 0.08);
    });
  }

  bannerMat(fl) {
    const m = new THREE.MeshStandardMaterial({ roughness: 0.95, map: canvasTexture(256, 512, (ctx, w, h) => {
      ctx.fillStyle = fl.banner; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w, 0); ctx.lineTo(w, h); ctx.lineTo(w / 2, h - 80); ctx.lineTo(0, h); ctx.fill();
      ctx.fillStyle = '#ffd54a'; ctx.fillRect(0, 0, w, 24);
      ctx.strokeStyle = '#ffd54a'; ctx.lineWidth = 6; ctx.strokeRect(18, 40, w - 36, h - 150);
      ctx.font = 'bold 150px serif'; ctx.textAlign = 'center'; ctx.fillText(fl.emblem, w / 2, 250);
    }), transparent: true, side: THREE.DoubleSide });
    m.userData.noBlock = true;
    return m;
  }

  makeMirror(floor, pos, rotY, standing = false) {
    const w = Math.min(0.75, this.D - 1.0), h = 1.45, y = pos.y + 0.28 + h / 2;
    const m = new Reflector(new THREE.PlaneGeometry(w, h), { textureWidth: 512, textureHeight: Math.round((512 * h) / w), color: 0x8a9294, clipBias: 0.003, multisample: 0 });
    const orig = m.getReflectionCamera.bind(m);
    m.getReflectionCamera = (cam) => { const rc = orig(cam); rc.layers.enable(MIRROR_LAYER); return rc; };
    m.position.set(pos.x, y, pos.z); m.rotation.y = rotY;
    this.world.add(m);
    const frame = new THREE.Group(); frame.position.copy(m.position); frame.rotation.y = rotY; this.world.add(frame);
    const gold = this.mats.gold, t = 0.07;
    for (const [x, yy, fw, fh] of [[0, h / 2 + t / 2, w + 2 * t, t], [0, -h / 2 - t / 2, w + 2 * t, t], [-w / 2 - t / 2, 0, t, h], [w / 2 + t / 2, 0, t, h]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(fw, fh, 0.05), gold); b.position.set(x, yy, -0.02); frame.add(b); }
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), gold); s.position.set(sx * (w / 2 + t / 2), sy * (h / 2 + t / 2), 0); frame.add(s); }
    const crest = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.16, 5), gold); crest.position.set(0, h / 2 + 0.14, -0.01); frame.add(crest);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.04), new THREE.MeshStandardMaterial({ color: 0xff4f9a, emissive: 0x88204a, roughness: 0.2 })); gem.position.set(0, h / 2 + 0.05, 0.02); frame.add(gem);
    if (standing) { for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.4, 8), gold); leg.position.set(s * (w / 2), -h / 2 - 0.2, 0.08); leg.rotation.x = 0.3; frame.add(leg); } }
    const label = makeSign(floor === TOP ? 'Royal Mirror' : 'Magic Mirror', { w: 0.6, h: 0.13, size: 60 });
    label.position.set(0, -h / 2 - 0.12, 0.01); frame.add(label);
    this.mirrors.push({ m, floor, pos: m.position.clone(), normal: new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY) });
  }

  makeDust() {
    const n = 120, geo = new THREE.BufferGeometry(), p = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) { p[k * 3] = (Math.random() - 0.5) * this.W; p[k * 3 + 1] = 0.3 + Math.random() * 2.6; p[k * 3 + 2] = (Math.random() - 0.5) * this.D; }
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    this.dust = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.01, map: canvasTexture(32, 32, (c) => { const g = c.createRadialGradient(16, 16, 1, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 32, 32); }), color: 0xfff0c8, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    this.world.add(this.dust);
  }

  // The kingdom seen through the windows and from the tower top.
  terrainHeight(x, z) {
    const r = Math.hypot(x, z);
    let h = (Math.sin(x * 0.021) + Math.cos(z * 0.017) + Math.sin((x + z) * 0.011) * 1.5 + Math.sin(x * 0.05 + 1) * 0.4) * 5 + 4;
    h *= smooth(26, 70, r);
    const rz = 70 + Math.sin(x * 0.012) * 35; // river valley
    const dr = Math.abs(z - rz);
    if (dr < 14) h = Math.min(h, -1.2 + (dr / 14) ** 2 * (h + 1.2) + 0.0001);
    if (r > 17.5 && r < 22.5) h = -1.2; // moat
    return h;
  }
  buildKingdom(S) {
    const Std = (o) => { const m = new THREE.MeshStandardMaterial({ roughness: 0.9, ...o }); m.userData.noBlock = true; return m; };
    const world = this.world;
    const sky = new THREE.SphereGeometry(900, 32, 16), col = [], top = new THREE.Color(0x3a7bd5), hor = new THREE.Color(0xdcefff);
    const pos = sky.attributes.position;
    for (let k = 0; k < pos.count; k++) { const t = clamp(pos.getY(k) / 900, 0, 1) ** 0.55; const c = hor.clone().lerp(top, t); col.push(c.r, c.g, c.b); }
    sky.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const skyMesh = new THREE.Mesh(sky, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false }));
    skyMesh.renderOrder = -1; world.add(skyMesh);
    const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTexture(128, 128, (c, w) => { const g = c.createRadialGradient(64, 64, 4, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,240,1)'); g.addColorStop(0.25, 'rgba(255,245,200,0.9)'); g.addColorStop(1, 'rgba(255,230,160,0)'); c.fillStyle = g; c.fillRect(0, 0, w, w); }), fog: false, depthWrite: false, toneMapped: false }));
    sun.position.set(-300, 380, -450); sun.scale.setScalar(160); world.add(sun);
    world.add(new THREE.HemisphereLight(0xdfefff, 0x6b8a4a, 1.1));
    const dl = new THREE.DirectionalLight(0xfff1dc, 2.4); dl.position.set(-40, 60, -60); world.add(dl);

    // terrain with painted vertex colours (grass, fields, river banks, road)
    const N = 110, size = 900, tg = new THREE.PlaneGeometry(size, size, N, N).rotateX(-Math.PI / 2), tp = tg.attributes.position, tc = [];
    const grassA = new THREE.Color(0x5f9e3f), grassB = new THREE.Color(0x7cb342), sand = new THREE.Color(0xd8c48a), road = new THREE.Color(0xb89c6a), wheat = new THREE.Color(0xe8c95a), soil = new THREE.Color(0x8d6e4a), flowerField = new THREE.Color(0x8a7bd8);
    for (let k = 0; k < tp.count; k++) {
      const x = tp.getX(k), z = tp.getZ(k), h = this.terrainHeight(x, z); tp.setY(k, h);
      const r = Math.hypot(x, z);
      let c = grassA.clone().lerp(grassB, (Math.sin(x * 0.08) * Math.cos(z * 0.07) + 1) / 2);
      if (h < -0.4) c = sand;
      if (Math.abs(x) < 3 && z > 22) c = road;
      const fx = Math.floor(x / 22), fz = Math.floor(z / 22);
      if (r > 40 && r < 150 && x < 0 && z < 40 && (fx + fz) % 3 === 0) c = [wheat, soil, flowerField][(fx * 7 + fz * 3 + 99) % 3];
      tc.push(c.r, c.g, c.b);
    }
    tg.setAttribute('color', new THREE.Float32BufferAttribute(tc, 3)); tg.computeVertexNormals();
    const terrain = new THREE.Mesh(tg, Std({ vertexColors: true, roughness: 1 })); terrain.position.y = -0.03; world.add(terrain);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3f8fd0, roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.9 }));
    water.position.y = -0.5; world.add(water); this.water = water;
    const paving = Std({ ...surfaceMaps('tile', [170, 160, 140]) });
    S.add(tileUV(new THREE.CircleGeometry(17.6, 48), [35, 35], 2), paving, [0, -0.02, 0], [-Math.PI / 2, 0, 0]);
    // curtain wall with round towers and colourful roofs
    const wallStone = Std({ ...surfaceMaps('brick', [170, 160, 145]) }), wood = Std({ color: 0x7a5230 });
    const R = 16.5, segs = 36;
    for (let k = 0; k < segs; k++) {
      const a = (k / segs) * Math.PI * 2, len = (2 * Math.PI * R) / segs + 0.1;
      if (Math.abs(a - Math.PI / 2) < 0.12) continue; // gate gap facing south
      S.box(len, 5, 1.2, wallStone, [Math.cos(a) * R, 2.5, Math.sin(a) * R], [0, -a + Math.PI / 2, 0], 2);
      S.box(0.8, 0.8, 1.2, wallStone, [Math.cos(a) * R, 5.4, Math.sin(a) * R], [0, -a + Math.PI / 2, 0], 1);
    }
    S.box(3.2, 6.5, 2, wallStone, [-2.6, 3.25, R], [0, 0, 0], 2); S.box(3.2, 6.5, 2, wallStone, [2.6, 3.25, R], [0, 0, 0], 2);
    S.box(2.2, 0.2, 7, wood, [0, -0.05, R + 3.5]); // drawbridge
    const roofCols = [0xff6fae, 0x7f6bff, 0x4fc3ff, 0xffb347, 0x9b5cff, 0x3fd28a];
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + 0.3, x = Math.cos(a) * R, z = Math.sin(a) * R;
      S.add(tileUV(new THREE.CylinderGeometry(2, 2.1, 10, 20), [12.6, 10, 12.6], 2), wallStone, [x, 5, z]);
      S.add(new THREE.ConeGeometry(2.5, 4.5, 20), Std({ color: roofCols[k], roughness: 0.6 }), [x, 12.25, z]);
      S.add(new THREE.CylinderGeometry(0.05, 0.05, 1.5, 6), Std({ color: 0x333333 }), [x, 15.2, z]);
    }
    // village houses
    const houseWall = Std({ color: 0xf1e2c4 }), roofs = [0xb8443a, 0x4a6fb8, 0x6f8a3a].map((c) => Std({ color: c, roughness: 0.7 })), trim = Std({ color: 0x6b4a2b });
    for (let k = 0; k < 22; k++) {
      const a = 0.4 + Math.random() * 2.2, r = 32 + Math.random() * 28, x = Math.cos(a) * r, z = Math.sin(a) * r, y = this.terrainHeight(x, z), rot = Math.random() * 3;
      if (y < 0) continue;
      S.box(3, 2.6, 3.8, houseWall, [x, y + 1.3, z], [0, rot, 0]);
      S.box(3.1, 0.2, 3.9, trim, [x, y + 2.6, z], [0, rot, 0]);
      S.add(new THREE.ConeGeometry(2.9, 2.2, 4), roofs[k % 3], [x, y + 3.75, z], [0, rot + Math.PI / 4, 0]);
    }
    // windmill with spinning sails
    const wmx = -45, wmz = 25, wmy = this.terrainHeight(wmx, wmz);
    S.add(new THREE.CylinderGeometry(1.4, 2.2, 8, 12), houseWall, [wmx, wmy + 4, wmz]);
    S.add(new THREE.ConeGeometry(1.8, 2.2, 12), roofs[0], [wmx, wmy + 9.1, wmz]);
    const sails = new THREE.Group(); sails.position.set(wmx + 1.9, wmy + 7.5, wmz);
    for (let k = 0; k < 4; k++) { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 5, 0.08), trim); arm.position.y = 2.5; const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 4), Std({ color: 0xf5eedd, side: THREE.DoubleSide })); cloth.position.set(0.6, 2.8, 0); const g2 = new THREE.Group(); g2.add(arm); g2.add(cloth); g2.rotation.x = (k * Math.PI) / 2; sails.add(g2); }
    sails.rotation.y = Math.PI / 2; world.add(sails); this.spinners.push({ o: sails, kind: 'sails' });
    // bridge over the river where the road crosses
    const bz = 70, by = 0.4; S.box(4, 0.4, 30, Std({ ...surfaceMaps('brick', [160, 150, 135]) }), [0, by, bz], [0, 0, 0], 2);
    for (const s of [-1, 1]) S.box(0.3, 0.8, 30, wallStone, [s * 2, by + 0.6, bz], [0, 0, 0], 1);
    // trees (instanced)
    const treePos = [];
    while (treePos.length < 420) {
      const a = Math.random() * Math.PI * 2, r = 25 + Math.random() * 230, x = Math.cos(a) * r, z = Math.sin(a) * r, h = this.terrainHeight(x, z);
      if (h < 0.2 || (Math.abs(x) < 5 && z > 20)) continue;
      if (r > 30 && r < 62 && a > 0.3 && a < 2.7) continue; // village clearing
      treePos.push([x, h, z, 0.7 + Math.random() * 0.9, Math.random() < 0.35]);
    }
    const trunkGeo = new THREE.CylinderGeometry(0.25, 0.35, 2, 6).translate(0, 1, 0), pineGeo = new THREE.ConeGeometry(1.6, 4, 8).translate(0, 4, 0), roundGeo = new THREE.IcosahedronGeometry(1.8, 1).translate(0, 3.6, 0);
    const trunks = new THREE.InstancedMesh(trunkGeo, Std({ color: 0x6b4a2b }), treePos.length);
    const pines = new THREE.InstancedMesh(pineGeo, Std({ color: 0x2f7a4a, flatShading: true }), treePos.length);
    const rounds = new THREE.InstancedMesh(roundGeo, Std({ color: 0x4f9a3a, flatShading: true }), treePos.length);
    let np = 0, nr = 0; const m4 = new THREE.Matrix4();
    treePos.forEach(([x, y, z, s, round], k) => {
      m4.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 6), new THREE.Vector3(s, s * (0.9 + Math.random() * 0.3), s));
      trunks.setMatrixAt(k, m4);
      if (round) rounds.setMatrixAt(nr++, m4); else pines.setMatrixAt(np++, m4);
    });
    pines.count = np; rounds.count = nr;
    for (const im of [trunks, pines, rounds]) { im.frustumCulled = false; world.add(im); }
    // mountains
    const rock = Std({ color: 0x7d8aa6, flatShading: true }), snow = Std({ color: 0xffffff, flatShading: true });
    for (let k = 0; k < 18; k++) {
      const a = (k / 18) * Math.PI * 2 + Math.random() * 0.2, r = 420 + Math.random() * 80, h = 90 + Math.random() * 110, rad = 70 + Math.random() * 50;
      S.add(new THREE.ConeGeometry(rad, h, 7), rock, [Math.cos(a) * r, h / 2 - 2, Math.sin(a) * r], [0, Math.random(), 0]);
      S.add(new THREE.ConeGeometry(rad * 0.32, h * 0.32, 7), snow, [Math.cos(a) * r, h * 0.84 - 2, Math.sin(a) * r], [0, Math.random(), 0]);
    }
    // drifting clouds and a hot-air balloon
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, fog: false, emissive: 0x8899aa, emissiveIntensity: 0.35, flatShading: true });
    const cg = [];
    for (let k = 0; k < 16; k++) {
      const a = Math.random() * Math.PI * 2, r = 140 + Math.random() * 260, y = 80 + Math.random() * 60;
      for (let j = 0; j < 5; j++) { const g2 = new THREE.IcosahedronGeometry(12 + Math.random() * 10, 1); g2.scale(1, 0.5, 1); g2.translate(Math.cos(a) * r + j * 13 - 26, y + Math.random() * 5, Math.sin(a) * r + Math.random() * 10); cg.push(g2.toNonIndexed()); }
    }
    const clouds = new THREE.Mesh(mergeGeometries(cg), cloudMat); world.add(clouds); this.spinners.push({ o: clouds, kind: 'clouds' });
    const balloon = new THREE.Group();
    const envTex = canvasTexture(256, 128, (c, w, h) => { const cols = ['#ff5c8a', '#ffd54a', '#5ce1ff', '#9b7bff', '#7dff6b']; for (let k = 0; k < 10; k++) { c.fillStyle = cols[k % 5]; c.fillRect((k * w) / 10, 0, w / 10 + 1, h); } });
    const env = new THREE.Mesh(new THREE.SphereGeometry(4, 20, 16), new THREE.MeshStandardMaterial({ map: envTex, roughness: 0.6 })); env.scale.y = 1.2; balloon.add(env);
    const bask = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1, 1.4), Std({ color: 0x8a5a2a })); bask.position.y = -6.2; balloon.add(bask);
    for (const [x, z] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) { const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.4, 4), Std({ color: 0x333333 })); rope.position.set(x, -4.6, z); balloon.add(rope); }
    world.add(balloon); this.balloon = balloon;
  }

  decorate(S, i, W, D) {
    const { stoneDark, wood, woodDark, iron, gold, red, flame, Std } = this.mats, y0 = fy(i), hw = W / 2, hd = D / 2;
    if (i === 0) {
      const leaf = Std({ color: 0x2f7d32 }), blue = Std({ color: 0x2a5bd7 }), white = Std({ color: 0xf2f2f2 }), pot = Std({ color: 0xb5653a, roughness: 0.8 });
      for (const sx of [-1]) { // corners by the lock hold the tray and scroll; flowers go south-west
        const x = sx * (hw - 0.3), z = hd - 0.3;
        S.add(new THREE.CylinderGeometry(0.2, 0.15, 0.35, 16), pot, [x, 0.175, z]);
        for (let k = 0; k < 9; k++) {
          const a = k * 2.4, rr = 0.03 + (k % 3) * 0.05, px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr, h = 0.25 + Math.random() * 0.2;
          S.add(new THREE.CylinderGeometry(0.008, 0.008, h, 5), leaf, [px, 0.35 + h / 2, pz]);
          S.add(new THREE.ConeGeometry(0.045, 0.17, 7), blue, [px, 0.35 + h + 0.06, pz]);
          S.add(new THREE.SphereGeometry(0.018, 6, 4), white, [px, 0.35 + h + 0.16, pz]);
        }
      }
    }
    if (i === 1) {
      const len = clamp(D - 1.4, 0.6, 2), x = hw - 0.3, z = -0.35;
      S.box(0.5, 0.06, len, wood, [x, y0 + 0.74, z], [0, 0, 0], 1);
      for (const dz of [-1, 1]) S.box(0.08, 0.72, 0.08, woodDark, [x, y0 + 0.36, z + dz * (len / 2 - 0.08)]);
      S.box(0.52, 0.01, len * 0.9, Std({ color: 0xf2ead8 }), [x, y0 + 0.775, z]);
      for (const dz of [-0.3, 0.3]) { S.add(new THREE.CylinderGeometry(0.02, 0.02, 0.18, 6), Std({ color: 0xf5f0e0 }), [x + 0.15, y0 + 0.86, z + dz]); S.add(new THREE.ConeGeometry(0.02, 0.06, 6), flame, [x + 0.15, y0 + 0.98, z + dz]); }
      // painting above the feast table
      const art = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.6), new THREE.MeshStandardMaterial({ map: this.paintingTexture(), roughness: 0.8 }));
      art.position.set(hw - 0.045, y0 + 1.75, z); art.rotation.y = -Math.PI / 2; this.world.add(art);
      S.box(0.02, 0.68, 0.98, gold, [hw - 0.02, y0 + 1.75, z]);
    }
    if (i === 2) {
      const bookMats = [0x8e2430, 0x1f4e8c, 0x2e7d32, 0x6a3d9a, 0xb8860b].map((c) => Std({ color: c, roughness: 0.7 }));
      const len = clamp(D - 1.2, 0.6, 2.6), z0 = -0.3;
      for (const s of [-1, 1]) {
        const x = s * (hw - 0.15);
        S.box(0.3, 2.4, len, woodDark, [x, y0 + 1.2, z0], [0, 0, 0], 1);
        for (let r = 0; r < 4; r++) {
          const y = y0 + 0.15 + r * 0.58;
          S.box(0.32, 0.04, len, wood, [x - s * 0.01, y, z0], [0, 0, 0], 1);
          let p = z0 - len / 2 + 0.05;
          while (p < z0 + len / 2 - 0.08) {
            const bw = 0.04 + Math.random() * 0.04, bh = 0.3 + Math.random() * 0.15, tilt = Math.random() < 0.08 ? 0.25 : 0;
            S.box(0.22, bh, bw, bookMats[Math.floor(Math.random() * bookMats.length)], [x - s * 0.05, y + bh / 2 + 0.02, p + bw / 2], [tilt, 0, 0]);
            p += bw + 0.006;
          }
        }
        S.add(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 8), Std({ color: 0xf5f0e0 }), [x, y0 + 2.46, z0 + len / 2 - 0.1]);
        S.add(new THREE.ConeGeometry(0.025, 0.07, 6), flame, [x, y0 + 2.56, z0 + len / 2 - 0.1]);
      }
    }
    if (i === 3) {
      const steel = Std({ color: 0x9aa0ad, metalness: 0.85, roughness: 0.35 });
      for (const sx of []) { // both corners by the lock are kept clear for the tray and scroll
        const x = sx * (hw - 0.3), z = -hd + 0.3;
        S.box(0.45, 0.1, 0.45, stoneDark, [x, y0 + 0.05, z], [0, 0, 0], 1);
        for (const d of [-0.08, 0.08]) S.add(new THREE.CylinderGeometry(0.055, 0.065, 0.7, 10), steel, [x + d, y0 + 0.45, z]);
        S.add(new THREE.CylinderGeometry(0.17, 0.13, 0.6, 14), steel, [x, y0 + 1.1, z]);
        for (const d of [-0.23, 0.23]) S.add(new THREE.CylinderGeometry(0.045, 0.045, 0.55, 8), steel, [x + d, y0 + 1.1, z]);
        S.add(new THREE.SphereGeometry(0.13, 16, 12), steel, [x, y0 + 1.55, z]);
        S.box(0.18, 0.025, 0.02, iron, [x, y0 + 1.56, z + 0.12]);
        S.add(new THREE.ConeGeometry(0.045, 0.22, 8), red, [x, y0 + 1.75, z]);
      }
      [0xc62828, 0x1565c0].forEach((c, k) => {
        const x = (k ? 1 : -1) * (hw - 0.3);
        S.add(new THREE.CircleGeometry(0.2, 24), Std({ color: c, metalness: 0.3 }), [x, y0 + 2.2, -hd + 0.03]);
        S.add(new THREE.RingGeometry(0.17, 0.2, 24), gold, [x, y0 + 2.2, -hd + 0.035]);
      });
    }
    if (i === 4) {
      const cryA = new THREE.MeshStandardMaterial({ color: 0x8fdcff, emissive: 0x2a6f99, roughness: 0.15, metalness: 0.1 }), cryB = new THREE.MeshStandardMaterial({ color: 0xd49bff, emissive: 0x5c2a8c, roughness: 0.15, metalness: 0.1 });
      for (const [x, z] of [[-hw + 0.3, 0.2]]) {
        for (let k = 0; k < 6; k++) {
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
    if (i === TOP) {
      S.box(0.12, 0.9, 0.12, gold, [0, y0 + 0.45, -hd + 0.12]);
      // a telescope pointing at the mountains
      S.add(new THREE.CylinderGeometry(0.02, 0.03, 1.0, 8), woodDark, [hw - 0.35, y0 + 0.5, -hd + 0.4]);
      S.add(new THREE.CylinderGeometry(0.04, 0.06, 0.6, 12), gold, [hw - 0.35, y0 + 1.05, -hd + 0.3], [1.2, 0, 0.3]);
    }
  }

  paintingTexture() {
    return canvasTexture(384, 256, (c, w, h) => {
      const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#8fc6ff'); g.addColorStop(1, '#ffe7b0'); c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.fillStyle = '#6fa04a'; c.beginPath(); c.moveTo(0, h * 0.7); c.quadraticCurveTo(w * 0.3, h * 0.5, w * 0.6, h * 0.7); c.quadraticCurveTo(w * 0.8, h * 0.8, w, h * 0.65); c.lineTo(w, h); c.lineTo(0, h); c.fill();
      c.fillStyle = '#b8b0a0'; c.fillRect(w * 0.55, h * 0.35, 60, 80); c.fillRect(w * 0.52, h * 0.3, 20, 40); c.fillRect(w * 0.7, h * 0.3, 20, 40);
      c.fillStyle = '#ff6fae'; for (const x of [w * 0.52, w * 0.7]) { c.beginPath(); c.moveTo(x - 4, h * 0.3); c.lineTo(x + 10, h * 0.18); c.lineTo(x + 24, h * 0.3); c.fill(); }
      c.fillStyle = '#7b4fd6'; c.beginPath(); c.ellipse(w * 0.25, h * 0.25, 30, 12, -0.3, 0, 7); c.fill();
      noise(c, w, h, 1500, 0.08);
    });
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
      const g = new THREE.Mesh(new THREE.OctahedronGeometry(0.05), new THREE.MeshStandardMaterial({ color: 0x555566, roughness: 0.3 }));
      g.position.set((k - (n - 1) / 2) * 0.16, y0 + 2.6, -hd + 0.06); this.world.add(g); gems.push(g);
    }
    const lock = { i, pad, gems, open: false };
    const panel = new Panel(this, { title: `Magic Lock ${i + 1}`, count: n, defer: true, doneText: 'Unlocked!', onSolved: () => this.unlock(lock) });
    panel.mesh.position.set(0, y0 + this.panelH, -hd + 0.03);
    panel.floor = i; panel.wallMounted = true;
    const orig = panel.update.bind(panel);
    panel.update = () => { orig(); gems.forEach((g, k) => { const on = k < panel.solved; g.material.color.setHex(on ? 0x4dff9a : 0x555566); g.material.emissive.setHex(on ? 0x1f8a4a : 0); }); };
    panel.onProblem = (p) => { this.tray.bind(panel, p); this.scroll.setProblem(p.text); if (this.level === i) this.readAloud(p, 1.2); };
    this.world.add(panel.mesh); this.panels.push(panel);
    lock.panel = panel; this.locks.push(lock);
  }

  unlock(lock) {
    lock.open = true;
    const i = lock.i, hatch = this.hatches[i];
    this.audio.cueUnlock();
    this.animate(0.8, (t) => { lock.pad.position.y = fy(i) + 2.85 - t * 2.4; lock.pad.rotation.z = t * 2; }, () => { lock.pad.visible = false; });
    this.burst(new THREE.Vector3(0, fy(i) + CEIL - 0.1, 0), 80);
    this.animate(1.4, (t) => { hatch.material.opacity = 1 - t; hatch.scale.set(1 - t * 0.3, 1, 1 - t * 0.3); }, () => { hatch.visible = false; }, 0.3);
    this.retirePanel(lock.panel, 1.4);
    this.tray.hide();
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
    this.runeMat = new THREE.MeshBasicMaterial({ map: runeTex, color: 0x777777, toneMapped: false });
    const side = new THREE.MeshStandardMaterial({ color: 0xd9a627, metalness: 0.8, roughness: 0.3 });
    const s = HATCH - 0.02, th = 0.12;
    const plat = new THREE.Mesh(new THREE.BoxGeometry(s, th, s), [side, side, this.runeMat, side, side, side]);
    plat.position.set(0, -th / 2 + 0.006, 0);
    this.platform = plat; this.world.add(plat);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(s, CEIL, s).translate(0, CEIL / 2, 0), new THREE.MeshBasicMaterial({ color: 0xffe89a, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    beam.visible = false; this.beam = beam; this.world.add(beam);
    this.liftPosts = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.05), new THREE.MeshBasicMaterial({ color: 0xffe066, toneMapped: false }));
      c.position.set(sx * (s / 2 - 0.04), 0.9, sz * (s / 2 - 0.04)); plat.add(c); this.liftPosts.push(c);
    }
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
      this.guide.position.set(0, y0 + 2.2, 0);
      if (Math.hypot(head.x, head.z) > 0.2) this.guide.lookAt(head.x, y0 + 2.2, head.z); else this.guide.lookAt(head.x, y0 + 2.2, head.z - 1);
    }
    if (L.state === 'ready') {
      L.dwell = on ? L.dwell + dt : 0;
      if (L.dwell > 1.5) { L.state = 'rising'; L.t = 0; this.setGuide('Hold on! Going up…'); this.audio.cueLift(); }
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
        (this.level === TOP ? this.finalChest.panel : this.locks[this.level].panel).activate();
        this.lift = { state: this.level >= TOP ? 'done' : 'locked', dwell: 0, t: 0 };
        this.rig.position.y = fy(this.level);
        this.setGuide(null); this.placeLights(); this.updateHud(); this.saveCheckpoint(); this.saveSession();
        this.audio.cueArrive(FLOOR_MOODS[this.level]); this.audio.setMood(FLOOR_MOODS[this.level]);
        this.burst(new THREE.Vector3(0, fy(this.level) + 0.3, 0), 50);
        if (this.level === TOP) this.showBanner('The Tower Top!');
        else this.showBanner(`Floor ${this.level + 1}: ${FLOORS[this.level].name}`);
      }
    }
  }

  // Safety backup for the Quest's own boundary: the castle room sits inside the
  // real clear space, so walking through a castle wall means she is heading for
  // the real edge. Dim the view, show a sign and buzz the controllers.
  updateEdgeWarning(dt) {
    if (!this.world) return;
    if (!this.edgeVeil) {
      this.edgeVeil = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 12), new THREE.MeshBasicMaterial({ color: 0x0b0716, transparent: true, opacity: 0, side: THREE.BackSide, depthTest: false, depthWrite: false, fog: false, toneMapped: false }));
      this.edgeVeil.renderOrder = 998; this.edgeVeil.visible = false; this.camera.add(this.edgeVeil);
      this.edgeSign = makeSign('Too close to the edge! Step back into the castle.', { w: 0.34, h: 0.1, size: 70, bg: '#3a0f1a', border: '#ff8a8a', fg: '#ffffff' });
      this.edgeSign.material.depthTest = false; this.edgeSign.renderOrder = 999; this.edgeSign.position.set(0, -0.02, -0.22); this.edgeSign.visible = false; this.camera.add(this.edgeSign);
      this.edgeBuzz = 0;
    }
    const head = this.headPos(), m = 0.12;
    const out = Math.max(Math.abs(head.x) - (this.W / 2 - m), Math.abs(head.z) - (this.D / 2 - m), 0);
    const a = clamp(out / 0.3, 0, 0.88);
    this.edgeLevel = a;
    this.edgeVeil.visible = a > 0.01; this.edgeVeil.material.opacity = a;
    const warn = a > 0.3;
    if (warn && !this.edgeSign.visible) this.audio.tone(196, 0, 0.5, { type: 'triangle', vol: 0.12 });
    this.edgeSign.visible = warn;
    this.edgeBuzz -= dt;
    if (warn && this.edgeBuzz <= 0) { this.edgeBuzz = 0.6; for (const ptr of this.pointers) this.haptic(ptr, 0.5, 80); }
  }

  // Optional automatic read-aloud (default on for 2nd grade), after arrival cues settle.
  readAloud(p, delay = 0.3) {
    if (!p || !this.opts.autoRead) return;
    clearTimeout(this.readTimer);
    this.readTimer = setTimeout(() => speak(p.text), delay * 1000);
  }

  showBanner(text) {
    const s = makeSign(text, { w: 1.4, h: 0.3, size: 80, bg: '#2b1a4a', fg: '#ffd54a' });
    const head = this.headPos(), fwd = new THREE.Vector3(); this.camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
    s.position.copy(head).addScaledVector(fwd, 1.4); s.position.y = head.y + 0.55; s.lookAt(head);
    this.world.add(s);
    this.animate(2.4, (t) => { s.material.opacity = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3; s.position.y += 0.0015; }, () => { this.world.remove(s); s.material.map.dispose(); });
  }

  // Floating text that rises and fades (used by props and mini-games).
  floatText(text, pos, color = '#ffffff', life = 2.5) {
    const s = makeSign(text, { w: 1.1, h: 0.2, size: 70, bg: 'rgba(30,20,60,0.85)', border: '#ffd54a', fg: color });
    s.position.copy(pos); s.lookAt(this.headPos()); this.world.add(s);
    this.props?.floatSigns.push({ mesh: s, t: 0, life });
  }

  placeLights() {
    const lv = this.level ?? 0;
    this.lights.forEach((l, k) => {
      const f = Math.min(lv + k, TOP);
      l.color.setHex(FLOORS[f].light);
      l.position.set(this.W * 0.2, fy(f) + CEIL - 0.5, -this.D * 0.2);
      l.intensity = FLOORS[f].roof ? 0 : 4;
    });
  }

  retirePanel(panel, delay) {
    this.animate(0.5, (t) => panel.mesh.scale.setScalar(Math.max(0.001, 1 - t)), () => { panel.mesh.visible = false; }, delay);
  }

  makeChest(i, big = false) {
    const g = new THREE.Group();
    const woodM = new THREE.MeshStandardMaterial({ color: 0x7a4a22, roughness: 0.7 }), goldM = new THREE.MeshStandardMaterial({ color: 0xe0b23a, metalness: 0.85, roughness: 0.3 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.6), woodM); base.position.y = 0.25; g.add(base);
    for (const x of [-0.35, 0.35]) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.52, 0.62), goldM); t.position.set(x, 0.25, 0); g.add(t); }
    const lidPivot = new THREE.Group(); lidPivot.position.set(0, 0.5, -0.3); g.add(lidPivot);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 20, 1, false, 0, Math.PI).rotateZ(Math.PI / 2), woodM);
    lid.position.set(0, 0, 0.3); lid.scale.set(1, 0.6, 1); lidPivot.add(lid);
    const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.04), goldM); clasp.position.set(0, 0.45, 0.31); g.add(clasp);
    const glow = new THREE.PointLight(0xffd27a, 0, 1.5); glow.position.set(0, 0.7, 0); g.add(glow);
    const s = big ? 1.1 : 0.7;
    g.scale.setScalar(s);
    const [tName, tColor] = big ? ['Crown of Numeria', 0xffd700] : TREASURES[i % TREASURES.length];
    const prize = big ? this.makeCrown() : new THREE.Mesh(new THREE.OctahedronGeometry(0.1), new THREE.MeshStandardMaterial({ color: tColor, emissive: tColor, emissiveIntensity: 0.5, metalness: 0.3, roughness: 0.15 }));
    prize.visible = false; this.world.add(prize);
    const q = makeSign('?', { w: 0.35, h: 0.35, bg: 'rgba(0,0,0,0)', border: 'rgba(0,0,0,0)', fg: '#ffd54a', size: 300, px: 256 });
    q.position.y = 1.3; g.add(q);
    const chest = { i, group: g, lidPivot, prize, tName, q, opened: false, panel: null, big, glow };
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
    const crown = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0x4a3200, metalness: 0.9, roughness: 0.2 });
    crown.add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.12, 24, 1, true), m));
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2, spike = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.13, 6), m);
      spike.position.set(Math.cos(a) * 0.15, 0.12, Math.sin(a) * 0.15); crown.add(spike);
      const jewel = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), new THREE.MeshStandardMaterial({ color: TREASURES[k % 5][1], roughness: 0.1, emissive: TREASURES[k % 5][1], emissiveIntensity: 0.3 }));
      jewel.position.set(Math.cos(a) * 0.162, 0, Math.sin(a) * 0.162); crown.add(jewel);
    }
    crown.material = m;
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
    this.audio.click();
    this.readAloud(panel.problem);
  }

  openChest(chest) {
    chest.opened = true; chest.q.visible = false;
    this.audio.cueChest();
    const wp = chest.group.getWorldPosition(new THREE.Vector3());
    this.animate(0.8, (t) => { chest.lidPivot.rotation.x = -1.9 * (1 - (1 - t) ** 2); chest.glow.intensity = t * 3; });
    this.animate(2.5, (t) => { chest.glow.intensity = 3 * (1 - t); }, null, 1.5);
    this.burst(wp.clone().setY(wp.y + 0.5), 60);
    const prize = chest.prize;
    prize.position.copy(wp).setY(wp.y + 0.4); prize.visible = true;
    this.stats.treasures.push(chest.tName);
    if (!chest.big) this.saveCheckpoint();
    if (chest.big) return this.victory(chest);
    this.animate(1.4, (t) => { prize.position.y = wp.y + 0.4 + t * 0.9; prize.rotation.y = t * 8; }, () => {
      const from = prize.position.clone();
      this.animate(0.8, (t) => { const h = this.headPos(); h.y -= 0.3; prize.position.lerpVectors(from, h, t * t); prize.scale.setScalar(1 - t * 0.7); }, () => {
        prize.visible = false; this.audio.gem(); this.updateHud();
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
    const panel = new Panel(this, { title: 'The Crown of Numeria', count: this.opts.perDoor + 1, defer: true, doneText: 'VICTORY!', onSolved: () => this.openChest(chest) });
    panel.mesh.position.set(0, y0 + this.panelH, -hd + 0.2);
    panel.floor = TOP; panel.wallMounted = true;
    this.world.add(panel.mesh); this.panels.push(panel);
    chest.panel = panel;
    panel.onProblem = (p) => { this.scroll.setProblem(p.text); this.readAloud(p, 1.2); };
    this.finalChest = chest;
  }

  makeWelcome() {
    const n = this.opts.name || 'Explorer', hw = this.W / 2, len = Math.min(1.8, this.D - 0.4);
    const welcome = makeSign(`Welcome to Numeria, ${n}!\nSolve the Magic Lock, then stand on the glowing square to ride up. Touch buttons with your finger. Grab things with a pinch or the grip button, and throw them!`, { w: len, h: len * 0.62, size: 60 });
    welcome.position.set(-hw + 0.02, 1.6, 0); welcome.rotation.y = Math.PI / 2; this.world.add(welcome);
  }

  victory(chest) {
    this.audio.cueVictory();
    const y0 = fy(TOP), crown = chest.prize, start = crown.position.clone();
    this.animate(2.5, (t) => { crown.position.set(start.x, start.y + t * 1.1, start.z); crown.rotation.y = t * 10; }, () => {
      // the crown flies onto the player's head (visible in the Royal Mirror)
      const from = crown.position.clone();
      this.animate(1.2, (t) => { const h = this.headPos(); h.y += 0.15; crown.position.lerpVectors(from, h, t * t); }, () => {
        this.avatar.hat.visible = false;
        this.avatar.worn.clear();
        this.avatar.worn.add(crown); crown.position.set(0, 0.125, 0.01); crown.rotation.set(0, 0, 0); crown.scale.setScalar(0.85);
        crown.traverse((o) => o.layers.set(MIRROR_LAYER));
        this.audio.cueScore();
        this.floatText('Look in the Royal Mirror!', new THREE.Vector3(-this.W / 2 + 0.5, y0 + 1.9, 0), '#ffd54a', 4);
      });
    });
    this.props.perchDragon(new THREE.Vector3(this.W / 2 + 1.2, y0 + 1.1, -this.D / 2 - 1.2));
    for (let k = 0; k < 10; k++) setTimeout(() => { const a = Math.random() * Math.PI * 2, r = 12 + Math.random() * 12, p = new THREE.Vector3(Math.cos(a) * r, y0 + 8 + Math.random() * 8, Math.sin(a) * r); this.burst(p, 120, 0.25, 9); this.audio.boom(p); }, 600 + k * 450);
    const s = this.stats;
    this.saveProgress(); this.saveSession();
    const vp = new Panel(this, { title: 'Tower Conquered!', count: 0, defer: true });
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
    vp.pressKey = (k) => { if (k === 'again') { this.audio.click(); this.onPlayAgain?.(); } };
    vp.draw();
    vp.mesh.position.set(0, y0 + this.panelH + 0.1, -this.D / 2 + 0.2);
    vp.floor = TOP; vp.wallMounted = true; vp.lift = 0.1;
    vp.mesh.scale.setScalar(0.01);
    this.animate(0.5, (t) => vp.mesh.scale.setScalar(Math.max(0.01, t)), null, 1.5);
    this.world.add(vp.mesh); this.panels.push(vp);
    this.retirePanel(chest.panel, 1.2);
    this.onVictory?.(s);
  }

  // ---------------------------------------------------------- checkpoint & report
  get playerKey() { return (this.opts.name || 'Explorer').toLowerCase(); }
  // Everything needed to continue this climb after a reload or taking the headset off.
  saveCheckpoint() {
    const cp = {
      v: 1, at: Date.now(), level: this.level, hwKey: this.opts.hwKey || '',
      chests: this.chests.filter((c) => c.opened && !c.big).map((c) => c.i),
      treasures: this.stats.treasures.slice(),
      stats: { attempts: this.stats.attempts, correct: this.stats.correct, firstTry: this.stats.firstTry, missed: this.stats.missed.slice(-40) },
      hwDone: this.session.hwDone.slice(), session: { id: this.session.id, start: this.session.start, hwDone: this.session.hwDone.slice() },
    };
    try { localStorage.setItem(`mathcastle.checkpoint.${this.playerKey}`, JSON.stringify(cp)); } catch { /* storage full: keep playing */ }
  }
  applyResume(cp) {
    const L = Math.max(0, Math.min(cp.level | 0, TOP));
    for (let i = 0; i < L; i++) {
      const lock = this.locks[i];
      lock.open = true; lock.pad.visible = false; lock.panel.state = 'done'; lock.panel.mesh.visible = false;
      lock.gems.forEach((g) => g.material.color.setHex(0x4dff9a));
      this.hatches[i].visible = false;
    }
    for (const i of cp.chests || []) {
      const ch = this.chests.find((c) => c.i === i && !c.big);
      if (ch) { ch.opened = true; ch.q.visible = false; ch.lidPivot.rotation.x = -1.9; }
    }
    this.level = L; this.rig.position.y = fy(L);
    this.platform.position.y = fy(L) - 0.06 + 0.006;
    this.lift = { state: L >= TOP ? 'done' : 'locked', dwell: 0, t: 0 };
    Object.assign(this.stats, cp.stats || {}); this.stats.treasures = (cp.treasures || []).slice();
    this.placeLights(); this.updateHud();
    this.resumed = true; this.welcomeBack = true;
  }
  // Session report: each finished problem with her tries, time and scroll work.
  logProblem(panel, ok) {
    const p = panel.problem; if (!p) return;
    const onScroll = panel.wallMounted && this.scroll?.problemText === String(p.text).replace(/\n/g, ' ');
    this.session.problems.push({
      t: p.text, a: p.answer, choices: p.choices || null, tries: (panel.tries || []).slice(), ok, first: ok && panel.firstTry,
      secs: Math.round((performance.now() - (panel.shownAt || performance.now())) / 1000), hw: !!p.homework, floor: this.level + 1,
      work: onScroll && this.scroll.used ? this.scroll.snapshot() : null,
    });
    // her scroll working goes into the answer booklet automatically
    if (onScroll && this.scroll.used) this.saveBookletPage({ answer: panel.tries?.[panel.tries.length - 1] ?? '', ok, final: true });
    if (p.hwi !== undefined && !this.session.hwDone.includes(p.hwi)) this.session.hwDone.push(p.hwi);
    this.saveSession(); this.saveCheckpoint();
  }
  // Answer-booklet pages: vector ink + problem, printed as small inserts from Grown-up settings.
  keepPage() {
    if (!this.scroll?.used) return false;
    this.saveBookletPage({});
    this.audio.cueScore();
    this.floatText('Kept for your answer booklet!', this.scroll.group.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.45, 0.1)), '#9dffbe', 2.2);
    return true;
  }
  saveBookletPage({ answer = '', ok = null, final = false }) {
    const key = `mathcastle.booklet.${this.playerKey}`, problem = this.scroll.problemText;
    let all; try { all = JSON.parse(localStorage.getItem(key)) || []; } catch { all = []; }
    // one page per problem per climb: a finished problem updates the page she kept earlier
    const prev = all.find((pg) => pg.session === this.session.id && pg.problem === problem);
    const page = { id: prev?.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, at: Date.now(), session: this.session.id, name: this.opts.name || 'Explorer', grade: this.opts.grade, problem, ink: this.scroll.inkData(), answer: final ? answer : prev?.answer || '', ok: final ? ok : prev?.ok ?? null };
    all = [page, ...all.filter((pg) => pg.id !== page.id)].slice(0, 60);
    for (let k = 0; k < 3; k++) { try { localStorage.setItem(key, JSON.stringify(all)); return; } catch { all = all.slice(0, Math.floor(all.length / 2)); } }
  }
  loadSessionProblems(id) {
    try { return (JSON.parse(localStorage.getItem(`mathcastle.sessions.${this.playerKey}`)) || []).find((s) => s.id === id)?.problems || []; } catch { return []; }
  }
  saveSession() {
    const key = `mathcastle.sessions.${this.playerKey}`;
    let all; try { all = JSON.parse(localStorage.getItem(key)) || []; } catch { all = []; }
    const me = { id: this.session.id, start: this.session.start, end: Date.now(), grade: this.opts.grade, floor: this.level + 1, done: this.level >= TOP && !!this.progress, problems: this.session.problems };
    all = [me, ...all.filter((x) => x.id !== me.id)].slice(0, 4);
    for (let attempt = 0; attempt < 4; attempt++) {
      try { localStorage.setItem(key, JSON.stringify(all)); return; } catch {
        // over the storage quota: drop the oldest session, then pictures of old work
        if (all.length > 1) all.pop(); else all[0].problems.forEach((q, k) => { if (k < all[0].problems.length - 5) q.work = null; });
      }
    }
  }

  saveProgress() {
    try { localStorage.removeItem(`mathcastle.checkpoint.${this.playerKey}`); } catch { /* ignore */ }
    const key = `mathcastle.progress.${(this.opts.name || 'Explorer').toLowerCase()}`;
    const p = JSON.parse(localStorage.getItem(key) || '{"castles":0,"gems":0,"solved":0}');
    p.castles++; p.gems += this.stats.treasures.length; p.solved += this.stats.correct;
    localStorage.setItem(key, JSON.stringify(p));
    this.progress = p;
  }

  // ---------------------------------------------------------- effects
  animate(dur, fn, done = null, delay = 0) { this.anims.push({ t: -delay, dur, fn, done }); }
  // Confetti: one instanced mesh (a single draw call) with a fixed pool.
  burst(pos, n = 40, size = 0.035, speed = 3, colors = null) {
    if (!this.confetti) {
      const MAX = 1500, im = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, fog: false, toneMapped: false }), MAX);
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.count = 0; im.frustumCulled = false;
      im.setColorAt(0, new THREE.Color()); this.scene.add(im);
      this.confetti = im; this.particles = [];
    }
    const cols = colors || [0xffd54a, 0xff5c8a, 0x5ce1ff, 0x7dff6b, 0xc58bff, 0xffffff];
    for (let k = 0; k < n && this.particles.length < 1500; k++) {
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.5 + Math.random() * 0.5));
      if (speed === 3) v.y = 1.5 + Math.random() * 2.5;
      this.particles.push({ p: pos.clone(), v, life: 1.6 + Math.random() * 0.8, size, color: new THREE.Color(cols[k % cols.length]), rot: new THREE.Euler(Math.random() * 6, Math.random() * 6, 0), spin: new THREE.Vector3(Math.random() * 10, Math.random() * 10, 0) });
    }
  }
  updateParticles(dt) {
    const im = this.confetti; if (!im) return;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    this.particles = this.particles.filter((pt) => (pt.life -= dt) > 0);
    this.particles.forEach((pt, k) => {
      pt.v.y -= 4 * dt; pt.p.addScaledVector(pt.v, dt);
      pt.rot.x += pt.spin.x * dt; pt.rot.y += pt.spin.y * dt;
      m.compose(pt.p, q.setFromEuler(pt.rot), sc.setScalar(pt.size * Math.min(1, pt.life * 2)));
      im.setMatrixAt(k, m); im.setColorAt(k, pt.color);
    });
    im.count = this.particles.length;
    im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
  }

  // ---------------------------------------------------------- HUD
  makeHudTexture() {
    this.hudCanvas = document.createElement('canvas'); this.hudCanvas.width = 256; this.hudCanvas.height = 128;
    this.hudTex = new THREE.CanvasTexture(this.hudCanvas); this.hudTex.colorSpace = THREE.SRGBColorSpace;
    this.hudMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.06), new THREE.MeshBasicMaterial({ map: this.hudTex, transparent: true, depthTest: false, toneMapped: false }));
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
    const wandMat = new THREE.MeshStandardMaterial({ color: 0x5a3a8a, roughness: 0.5 }), starMat = new THREE.MeshBasicMaterial({ color: 0xffe066, toneMapped: false });
    const jointGeo = new THREE.SphereGeometry(1, 8, 6), tipMat = new THREE.MeshBasicMaterial({ color: 0xffe066, toneMapped: false });
    for (let i = 0; i < 2; i++) {
      const c = this.renderer.xr.getController(i), grip = this.renderer.xr.getControllerGrip(i);
      const ray = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]), new THREE.LineBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.8, toneMapped: false }));
      ray.visible = false; c.add(ray);
      const wand = new THREE.Group();
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.2, 8).rotateX(Math.PI / 2), wandMat); stick.position.z = -0.05; wand.add(stick);
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.018), starMat); star.position.z = -0.16; wand.add(star);
      c.add(wand);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe066, toneMapped: false }));
      dot.visible = false; this.scene.add(dot);
      const pinch = new THREE.Object3D(); this.scene.add(pinch);
      const ptr = { c, grip, ray, wand, star, dot, pinch, src: null, hit: null, poke: new Map(), cool: 0, holding: null, lastTip: null };
      c.addEventListener('connected', (e) => {
        ptr.src = e.data; wand.visible = !e.data.hand;
        if (e.data.handedness === 'left' && !e.data.hand) c.add(this.hudMesh);
      });
      c.addEventListener('disconnected', () => { ptr.src = null; dot.visible = false; if (ptr.holding) this.drop(ptr); });
      c.addEventListener('selectstart', () => { if (this.centerPrompt) return this.confirmCenter(); if (!this.tryGrab(ptr)) this.select(ptr); else ptr.grabBy = 'select'; });
      c.addEventListener('selectend', () => { if (ptr.rayDrawing) { ptr.rayDrawing = false; this.scroll?.lift(ptr); } if ((ptr.holding || ptr.holdingTray) && ptr.grabBy === 'select') this.drop(ptr); });
      c.addEventListener('squeezestart', () => { if (this.tryGrab(ptr)) ptr.grabBy = 'squeeze'; });
      c.addEventListener('squeezeend', () => { if ((ptr.holding || ptr.holdingTray) && ptr.grabBy === 'squeeze') this.drop(ptr); });
      this.rig.add(c); this.rig.add(grip);
      const hand = this.renderer.xr.getHand(i);
      hand.userData = { jointGeo, tipMat };
      this.rig.add(hand);
      ptr.hand = hand;
      this.pointers.push(ptr);
    }
    // desktop: mouse look + WASD + click
    this.keys = new Set();
    this.deskHolder = new THREE.Object3D(); this.deskHolder.position.set(0.16, -0.2, -0.45); this.camera.add(this.deskHolder);
    this.desktopPtr = { desktop: true, hit: null, holding: null };
    const canvas = this.renderer.domElement;
    canvas.addEventListener('mousedown', (e) => {
      if (this.renderer.xr.isPresenting || document.pointerLockElement !== canvas || e.button !== 0) return;
      const h = this.desktopPtr.hit;
      if (h?.type === 'scroll') { this.desktopPtr.rayDrawing = true; this.skipClick = true; this.scroll.rayDraw(this.desktopPtr, h.uv); }
    });
    document.addEventListener('mouseup', () => { if (this.desktopPtr.rayDrawing) { this.desktopPtr.rayDrawing = false; this.scroll?.lift(this.desktopPtr); } });
    canvas.addEventListener('click', () => {
      this.audio.resume();
      if (this.renderer.xr.isPresenting) return;
      if (this.skipClick) { this.skipClick = false; return; }
      if (document.pointerLockElement !== canvas) canvas.requestPointerLock?.();
      else this.desktopClick();
    });
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== canvas) return;
      this.camera.rotation.y -= e.movementX * 0.0025;
      this.camera.rotation.x = clamp(this.camera.rotation.x - e.movementY * 0.0025, -1.4, 1.4);
    });
    window.addEventListener('keydown', (e) => {
      const k = e.key;
      if (/^[0-9./-]$/.test(k) || k === 'Backspace' || k === 'Enter') {
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

  // Where a hand/controller grabs from (world space) and the object that holds things.
  holdPoint(ptr) {
    if (ptr.desktop) return this.deskHolder.getWorldPosition(new THREE.Vector3());
    if (ptr.src?.hand) {
      const j = ptr.hand.joints;
      if (j?.['thumb-tip'] && j?.['index-finger-tip']) {
        const a = j['thumb-tip'].getWorldPosition(new THREE.Vector3()), b = j['index-finger-tip'].getWorldPosition(new THREE.Vector3());
        ptr.pinch.position.copy(a).add(b).multiplyScalar(0.5);
        if (j.wrist) ptr.pinch.quaternion.copy(j.wrist.getWorldQuaternion(new THREE.Quaternion()));
        return ptr.pinch.position.clone();
      }
    }
    return ptr.grip.getWorldPosition(new THREE.Vector3());
  }
  holder(ptr) { return ptr.desktop ? this.deskHolder : ptr.src?.hand ? ptr.pinch : ptr.grip; }

  tryGrab(ptr) {
    if (!this.props || ptr.holding || ptr.holdingTray) return false;
    this.audio.resume();
    const p = this.holdPoint(ptr);
    // gems on the maths tray come first when a hand is right at the tray
    if (this.tray?.grabAt(p, this.holder(ptr))) { ptr.holdingTray = true; this.haptic(ptr, 0.3, 20); return true; }
    let b = this.props.nearest(p, ptr.src?.hand ? 0.08 : 0.11);
    // "magic grab": pointing at a prop within 3 m pulls it into the hand
    if (!b && ptr.hit?.type === 'grab' && ptr.hit.distance < 3.2) { b = ptr.hit.body; if (b.worn) this.props.unwear(b); b.mesh.position.copy(p); this.burst(p, 10, 0.02, 1); }
    if (!b) return false;
    this.props.grab(b, this.holder(ptr));
    ptr.holding = b; this.haptic(ptr, 0.4, 30);
    return true;
  }
  drop(ptr) {
    if (ptr.holdingTray) { ptr.holdingTray = false; this.tray.release(this.holder(ptr)); return; }
    const b = ptr.holding; ptr.holding = null; if (b) this.props.release(b);
  }

  desktopClick() {
    const ptr = this.desktopPtr;
    if (ptr.holding) { // throw forward
      const b = ptr.holding; ptr.holding = null;
      const fwd = new THREE.Vector3(); this.camera.getWorldDirection(fwd);
      b.hist = [{ p: b.mesh.position.clone(), t: 0 }, { p: b.mesh.position.clone().addScaledVector(fwd, 0.1).add(new THREE.Vector3(0, 0.03, 0)), t: 0.025 }];
      this.props.release(b); return;
    }
    const h = ptr.hit;
    if (h?.type === 'grab' && h.distance < 3.5) { if (h.body.worn) this.props.unwear(h.body); h.body.mesh.position.copy(this.deskHolder.getWorldPosition(new THREE.Vector3())); this.props.grab(h.body, this.deskHolder); ptr.holding = h.body; return; }
    if (h?.type === 'touch') { this.extraTips.push({ pos: h.point.clone(), vel: new THREE.Vector3(0, 0, -1) }); return; }
    this.select(ptr);
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
    if (this.tray) targets.push(...this.tray.pickables());
    if (this.scroll?.active()) targets.push(this.scroll.mesh);
    if (this.props) {
      for (const b of this.props.bodies) if (!b.held && !b.worn) b.mesh.traverse((o) => { if (o.isMesh) targets.push(o); });
      for (const c of [this.props.cat?.group, this.props.owl?.group]) c?.traverse((o) => { if (o.isMesh) { o.userData.touchable = true; targets.push(o); } });
    }
    const hit = this.raycaster.intersectObjects(targets, false)[0];
    if (!hit) return null;
    const o = hit.object;
    if (o.userData.panel) return { type: 'panel', panel: o.userData.panel, uv: hit.uv, point: hit.point, distance: hit.distance };
    if (o.userData.chest) return { type: 'chest', chest: o.userData.chest, point: hit.point, distance: hit.distance };
    if (o.userData.scroll) return { type: 'scroll', uv: hit.uv, point: hit.point, distance: hit.distance };
    if (o.userData.traySlot !== undefined) return { type: 'tray', slot: o.userData.traySlot, point: hit.point, distance: hit.distance };
    if (o.userData.grabBody) return { type: 'grab', body: o.userData.grabBody, point: hit.point, distance: hit.distance };
    if (o.userData.touchable) return { type: 'touch', point: hit.point, distance: hit.distance };
    return { type: 'block', point: hit.point, distance: hit.distance };
  }

  select(ptr) {
    this.audio.resume();
    const h = ptr.hit;
    if (!h) return;
    if (h.type === 'panel') h.panel.press(h.uv);
    else if (h.type === 'chest') this.openChestPanel(h.chest);
    else if (h.type === 'tray') this.tray.clickSlot(h.slot);
    else if (h.type === 'scroll') { ptr.rayDrawing = true; this.scroll.rayDraw(ptr, h.uv); }
    else if (h.type === 'touch') this.extraTips.push({ pos: h.point.clone(), vel: new THREE.Vector3(0, 0, -1) });
  }

  // Finger / wand-tip touch: press a panel button when the tip pushes through
  // the panel's surface from the front.
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

  haptic(ptr, v = 0.6, ms = 40) { try { ptr.src?.gamepad?.hapticActuators?.[0]?.pulse?.(v, ms); } catch { /* optional */ } }

  updatePointers(dt, tips) {
    const hovered = new Map();
    const tmpM = new THREE.Matrix4(), o = new THREE.Vector3(), d = new THREE.Vector3();
    if (this.renderer.xr.isPresenting) {
      for (const ptr of this.pointers) {
        const c = ptr.c;
        if (!ptr.src) { ptr.ray.visible = false; continue; }
        this.holdPoint(ptr); // keeps the pinch holder current
        let tip = null;
        const hand = ptr.hand;
        if (ptr.src.hand && hand.joints?.['index-finger-tip']) tip = hand.joints['index-finger-tip'].getWorldPosition(new THREE.Vector3());
        else if (!ptr.src.hand) tip = ptr.star.getWorldPosition(new THREE.Vector3());
        if (tip) {
          const vel = ptr.lastTip ? tip.clone().sub(ptr.lastTip).divideScalar(Math.max(dt, 0.005)) : new THREE.Vector3();
          ptr.lastTip = tip.clone();
          if (!ptr.holding) tips.push({ pos: tip, vel });
        }
        const touch = tip && !ptr.holding && !ptr.holdingTray ? this.poke(ptr, tip, dt) : null;
        if (tip && !ptr.holding && !ptr.holdingTray) { this.tray?.poke(ptr, tip); this.scroll?.touch(ptr, tip); }
        if (touch) hovered.set(touch.panel, touch.uv);
        tmpM.identity().extractRotation(c.matrixWorld);
        o.setFromMatrixPosition(c.matrixWorld); d.set(0, 0, -1).applyMatrix4(tmpM);
        const hit = touch || ptr.holding ? null : this.castFrom(o, d);
        ptr.hit = hit;
        if (ptr.rayDrawing) { if (hit?.type === 'scroll') this.scroll.rayDraw(ptr, hit.uv); else this.scroll.lift(ptr); }
        const useful = hit && ['panel', 'chest', 'grab', 'touch', 'tray', 'scroll'].includes(hit.type) && (hit.type !== 'grab' || hit.distance < 3.2);
        if (useful && hit.type === 'panel') hovered.set(hit.panel, hit.uv);
        ptr.ray.visible = !!useful; if (useful) ptr.ray.scale.z = hit.distance;
        ptr.dot.visible = !!useful; if (useful) ptr.dot.position.copy(hit.point);
        if (hand?.joints) for (const [name, j] of Object.entries(hand.joints)) if (!j.userData.mesh) {
          const m = new THREE.Mesh(hand.userData.jointGeo, name === 'index-finger-tip' ? hand.userData.tipMat : this.skinMat());
          m.scale.setScalar(j.jointRadius || 0.008); j.add(m); j.userData.mesh = m;
        }
      }
    } else {
      this.camera.getWorldPosition(o); this.camera.getWorldDirection(d);
      this.desktopPtr.hit = this.desktopPtr.holding ? null : this.castFrom(o, d);
      const h = this.desktopPtr.hit;
      if (this.desktopPtr.rayDrawing) { if (h?.type === 'scroll') this.scroll.rayDraw(this.desktopPtr, h.uv); else this.scroll.lift(this.desktopPtr); }
      if (h?.type === 'panel') hovered.set(h.panel, h.uv);
      document.getElementById('crosshair')?.classList.toggle('active', !!h && h.type !== 'block');
    }
    for (const p of this.panels) p.hover(hovered.get(p) || null);
  }
  skinMat() { return (this._skin ??= new THREE.MeshStandardMaterial({ color: this.opts.avatar?.skin || '#f1c8a8', roughness: 0.6 })); }

  handPositions() {
    const out = [null, null];
    for (const ptr of this.pointers) {
      if (!ptr.src) continue;
      const k = ptr.src.handedness === 'left' ? 0 : 1;
      if (ptr.src.hand) { const w = ptr.hand.joints?.['middle-finger-metacarpal'] || ptr.hand.joints?.wrist; if (w) out[k] = w.getWorldPosition(new THREE.Vector3()); }
      else out[k] = ptr.grip.getWorldPosition(new THREE.Vector3());
    }
    if (!this.renderer.xr.isPresenting && this.desktopPtr.holding) out[1] = this.deskHolder.getWorldPosition(new THREE.Vector3());
    return out;
  }

  // ---------------------------------------------------------- frame loop
  frame(xrFrame) {
    const dt = Math.min(this.clock.getDelta(), 0.05), t = this.clock.elapsedTime;
    if (!this.world) { this.renderer.render(this.scene, this.camera); return; }
    const xr = this.renderer.xr.isPresenting;
    if (xr && this.xrReset) return;
    if (xr && this.xrCalibrating) {
      const pose = xrFrame?.getViewerPose(this.renderer.xr.getReferenceSpace());
      if (!pose || !this.calibrateXR(pose)) return;
    }
    if (xr) { this.rig.updateMatrixWorld(true); this.renderer.xr.updateCamera(this.camera); }
    this.updateEdgeWarning(dt);
    if (this.centerPrompt && this.centerSign) {
      const hp = this.headPos(), fwd = new THREE.Vector3(); this.camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
      this.centerSign.position.copy(hp).addScaledVector(fwd, 0.9); this.centerSign.lookAt(hp);
    }
    if (!xr) {
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
    const head = this.headPos(), headQ = this.camera.getWorldQuaternion(new THREE.Quaternion());
    if (this.welcomeBack && t > 1) { this.welcomeBack = false; this.showBanner(this.level >= TOP ? 'Welcome back to the Tower Top!' : `Welcome back! Floor ${this.level + 1}`); }
    const eye = head.y - this.rig.position.y;
    this.panelH += (clamp(eye - 0.3, 0.75, 1.3) - this.panelH) * Math.min(1, dt * 2);
    for (const p of this.panels) { if (p.wallMounted) p.mesh.position.y = fy(p.floor) + this.panelH + (p.lift || 0); p.update(); }
    this.updateLift(dt, head);
    for (const a of this.anims) { a.t += dt; if (a.t >= 0) a.fn(Math.min(1, a.t / a.dur)); }
    for (const a of this.anims.filter((a) => a.t >= a.dur)) a.done?.();
    this.anims = this.anims.filter((a) => a.t < a.dur);
    this.updateParticles(dt);
    // ambience: torches, crystals, windmill, clouds, flags, balloon, dust
    for (const tc of this.torches) { const f = 0.85 + 0.15 * Math.sin(t * 13 + tc.ph) * Math.sin(t * 7.3 + tc.ph); tc.sprite.scale.set(0.14 * f, 0.26 * (0.9 + 0.2 * f), 1); }
    this.lights.forEach((l, i) => { if (l.intensity > 0) l.intensity = 4 * (0.92 + 0.08 * Math.sin(t * 9 + i * 2)); });
    for (const ch of this.chests) if (!ch.opened && ch.q.visible) { ch.q.position.y = 1.3 + Math.sin(t * 2 + ch.i) * 0.06; ch.q.lookAt(head); }
    for (const o of this.floaters) { o.position.y = o.userData.base + Math.sin(t + o.userData.phase) * 0.15; o.rotation.y += dt; }
    for (const sp of this.spinners) {
      if (sp.kind === 'sails') sp.o.rotation.x += dt * 0.6;
      if (sp.kind === 'clouds') sp.o.rotation.y += dt * 0.004;
      if (sp.kind === 'flag') { const p = sp.o.geometry.attributes.position; for (let k = 0; k < p.count; k++) { const x = sp.base[k * 3]; p.setZ(k, Math.sin(t * 5 + x * 8) * 0.05 * (x + 0.35)); } p.needsUpdate = true; }
    }
    if (this.balloon) { const a = t * 0.02; this.balloon.position.set(Math.cos(a) * 90, 32 + Math.sin(t * 0.2) * 3, Math.sin(a) * 90 - 20); }
    if (this.dust) { this.dust.position.y = fy(this.level); this.dust.rotation.y = t * 0.01; }
    // mirrors only render when the player is near and in front of them
    for (const mr of this.mirrors) {
      const v = head.clone().sub(mr.pos);
      mr.m.visible = mr.floor === this.level && v.length() < 4.5 && v.dot(mr.normal) > 0;
    }
    // avatar
    const hands = this.handPositions();
    this.avatarRig.update(head, headQ, this.rig.position.y, hands, dt, t);
    // props, touches, audio listener
    const tips = this.extraTips.splice(0);
    this.updatePointers(dt, tips);
    this.props.update(dt, t, head, tips);
    if (this.tray) { this.tray.place(this.level, fy(this.level), this.W, this.D, this.panelH); this.tray.updateHeld(); }
    if (this.scroll) { this.scroll.place(this.level, fy(this.level), this.W, this.D, this.panelH); this.scroll.update(dt); }
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(headQ), up = new THREE.Vector3(0, 1, 0).applyQuaternion(headQ);
    this.audio.setListener(head, fwd, up);
    this.ambience(dt, t, head);
    this.renderer.render(this.scene, this.camera);
  }

  ambience(dt, t, head) {
    this.ambT = (this.ambT ?? 0) - dt;
    if (this.ambT > 0) return;
    this.ambT = 0.25;
    let nearWin = 9, win = null;
    for (const w of this.windows) { if (Math.abs(w.y0 - fy(this.level)) > 0.1) continue; const d = w.pos.distanceTo(head); if (d < nearWin) { nearWin = d; win = w; } }
    const roof = this.level === TOP;
    this.audio.setWind(roof ? 0.8 : clamp(1 - nearWin / 2.5, 0, 1) * 0.6 + (this.level / TOP) * 0.2, win?.pos || head.clone().add(new THREE.Vector3(0, 2, 0)));
    if (win && Math.random() < 0.06) this.audio.chirp(win.pos.clone().addScaledVector(win.out, 6).add(new THREE.Vector3((Math.random() - 0.5) * 6, 2, 0)));
    if (roof && Math.random() < 0.05) this.audio.chirp(head.clone().add(new THREE.Vector3((Math.random() - 0.5) * 20, 5, (Math.random() - 0.5) * 20)));
    const torches = this.torches.filter((tc) => tc.floor === this.level);
    if (torches.length && Math.random() < 0.35) this.audio.crackle(torches[Math.floor(Math.random() * torches.length)].pos);
  }
}
