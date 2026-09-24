// The Magic Scroll: scratch paper on the wall beside each Magic Lock, so the
// player can write out steps. Write with a fingertip or wand tip touching the
// parchment, or point and hold the trigger (hold the mouse button on desktop).
// The header shows the current problem; a new problem brings a fresh page.
import * as THREE from 'three';

const CW = 768, CH = 720, HEAD = 78, FOOT = 72;
const INKS = ['#1d2a6b', '#c0262f', '#1f7a3a'];

export class MagicScroll {
  constructor(game) {
    this.g = game;
    this.canvas = document.createElement('canvas'); this.canvas.width = CW; this.canvas.height = CH;
    this.ctx = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 8;
    this.group = new THREE.Group();
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.tex, toneMapped: false }));
    this.mesh.userData.scroll = this;
    this.group.add(this.mesh);
    const wood = new THREE.MeshStandardMaterial({ color: 0x7a4a26, roughness: 0.7 }), gold = new THREE.MeshStandardMaterial({ color: 0xe0b84a, metalness: 0.8, roughness: 0.3 });
    this.rollers = [0, 1].map(() => {
      const r = new THREE.Group();
      r.add(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1, 16).rotateZ(Math.PI / 2), wood));
      for (const s of [-1, 1]) { const k = new THREE.Mesh(new THREE.SphereGeometry(0.024, 12, 8), gold); k.position.x = s * 0.5; k.userData.knob = s; r.add(k); }
      this.group.add(r); return r;
    });
    this.strokes = new Map(); // pointer -> last canvas point while touching
    this.ink = 0; this.problemText = ''; this.dirty = true; this.btnCool = 0;
    this.w = 0.55;
    this.clear();
  }

  // On the Magic Lock wall, to the left of the panel; sized to fit small rooms.
  place(floor, y0, W, D, panelH, roofZ = null) {
    const hw = W / 2, hd = D / 2, w = Math.max(0.3, Math.min(0.56, hw - 0.45)), h = w * (CH / CW);
    if (Math.abs(w - this.w) > 1e-6 || !this.sized) {
      this.w = w; this.sized = true;
      this.mesh.scale.set(w, h, 1);
      this.rollers.forEach((r, k) => { r.position.set(0, (k ? -1 : 1) * (h / 2 + 0.012), 0.012); r.children[0].scale.set(w + 0.04, 1, 1); r.children.slice(1).forEach((kn) => { kn.position.x = kn.userData.knob * (w / 2 + 0.03); }); });
    }
    this.floor = floor;
    this.group.position.set(-(0.43 + w / 2), y0 + panelH, roofZ ?? -hd + 0.03);
  }

  setProblem(text) { this.problemText = String(text || '').replace(/\n/g, ' '); this.clear(); }

  // ---------------------------------------------------------------- drawing
  clear() {
    const c = this.ctx;
    const g = c.createLinearGradient(0, 0, CW, 0); g.addColorStop(0, '#e9d7a8'); g.addColorStop(0.08, '#f7ecd0'); g.addColorStop(0.92, '#f7ecd0'); g.addColorStop(1, '#e9d7a8');
    c.fillStyle = g; c.fillRect(0, 0, CW, CH);
    c.fillStyle = 'rgba(120,80,30,0.05)'; for (let k = 0; k < 400; k++) c.fillRect(Math.random() * CW, Math.random() * CH, 2 + Math.random() * 3, 2 + Math.random() * 3);
    // faint writing lines
    c.strokeStyle = 'rgba(90,110,170,0.18)'; c.lineWidth = 2;
    for (let y = HEAD + 50; y < CH - FOOT; y += 56) { c.beginPath(); c.moveTo(24, y); c.lineTo(CW - 24, y); c.stroke(); }
    // header: the problem being worked on
    c.fillStyle = '#8a5a2a'; c.font = 'bold 22px system-ui, sans-serif'; c.textBaseline = 'middle'; c.textAlign = 'left';
    c.fillText('Magic Scroll: show your steps', 22, 22);
    c.font = 'bold 40px system-ui, sans-serif'; c.fillStyle = '#2b1a4a';
    let t = this.problemText; while (t && c.measureText(t).width > CW - 44) t = t.slice(0, -2);
    c.fillText(t === this.problemText ? t : `${t}…`, 22, 58);
    c.strokeStyle = 'rgba(107,63,31,0.35)'; c.beginPath(); c.moveTo(16, HEAD + 10); c.lineTo(CW - 16, HEAD + 10); c.stroke();
    this.drawFooter();
    this.strokes.clear(); this.used = false; this.paths = []; this.kept = false;
    this.dirty = true;
  }
  // Her pen strokes as compact vectors (canvas pixels), for printing booklet inserts.
  inkData() { return { w: CW, h: CH, top: HEAD + 14, bottom: CH - FOOT, inks: INKS, paths: this.paths.map((q) => ({ c: q.c, p: q.p.slice() })) }; }
  // Small JPEG of her work for the grown-up report.
  snapshot() {
    const c = document.createElement('canvas'); c.width = 256; c.height = Math.round(256 * CH / CW);
    c.getContext('2d').drawImage(this.canvas, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.6);
  }
  drawFooter() {
    const c = this.ctx, y = CH - FOOT;
    c.fillStyle = '#e3cf9c'; c.fillRect(0, y, CW, FOOT);
    c.fillStyle = '#8a4b2a'; this.roundRect(20, y + 12, 150, FOOT - 24, 16); c.fill();
    c.fillStyle = '#fff'; c.font = 'bold 30px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('Wipe', 95, y + FOOT / 2 + 1);
    c.fillStyle = this.kept ? '#2f8a4a' : '#6a3fa0'; this.roundRect(186, y + 12, 250, FOOT - 24, 16); c.fill();
    c.fillStyle = '#fff'; c.fillText(this.kept ? 'Kept ✓' : 'Keep page', 311, y + FOOT / 2 + 1);
    INKS.forEach((col, k) => {
      const x = CW - 60 - k * 70;
      c.beginPath(); c.arc(x, y + FOOT / 2, 22, 0, 7); c.fillStyle = col; c.fill();
      c.lineWidth = this.ink === k ? 6 : 2; c.strokeStyle = this.ink === k ? '#ffd54a' : 'rgba(0,0,0,0.3)'; c.stroke();
    });
    c.textAlign = 'left';
  }
  roundRect(x, y, w, h, r) { this.ctx.beginPath(); this.ctx.roundRect(x, y, w, h, r); }
  button(px, py) {
    if (py < CH - FOOT) return null;
    if (px >= 20 && px <= 170) return 'wipe';
    if (px >= 186 && px <= 436) return 'keep';
    for (let k = 0; k < INKS.length; k++) if (Math.hypot(px - (CW - 60 - k * 70), py - (CH - FOOT / 2)) < 30) return `ink${k}`;
    return 'none';
  }
  press(b) {
    if (this.btnCool > 0 || !b || b === 'none') return;
    this.btnCool = 0.4;
    if (b === 'wipe') { this.clear(); this.g.audio?.pop(this.group.getWorldPosition(new THREE.Vector3())); }
    else if (b === 'keep') { if (this.used && this.g.keepPage?.()) { this.kept = true; this.drawFooter(); this.dirty = true; } }
    else { this.ink = Number(b.slice(3)); this.drawFooter(); this.dirty = true; this.g.audio?.click(); }
  }
  // Continue (or start) a stroke for `key` at canvas pixel (px, py).
  stroke(key, px, py) {
    const b = this.button(px, py);
    if (b) { this.strokes.delete(key); this.press(b); return; }
    if (py < HEAD + 14) { this.strokes.delete(key); return; }
    const last = this.strokes.get(key), c = this.ctx;
    c.strokeStyle = INKS[this.ink]; c.fillStyle = INKS[this.ink]; c.lineWidth = 6; c.lineCap = 'round'; c.lineJoin = 'round';
    this.used = true;
    if (this.kept) { this.kept = false; this.drawFooter(); } // changed since it was kept
    if (!last) { c.beginPath(); c.arc(px, py, 3, 0, 7); c.fill(); const path = { c: this.ink, p: [Math.round(px), Math.round(py)] }; this.paths.push(path); this.strokes.set(key, { x: px, y: py, path }); this.dirty = true; return; }
    if (Math.hypot(px - last.x, py - last.y) < 1.5) return; // ignore hand-tracking jitter
    c.beginPath(); c.moveTo(last.x, last.y); c.lineTo(px, py); c.stroke();
    last.path.p.push(Math.round(px), Math.round(py));
    this.strokes.set(key, { x: px, y: py, path: last.path }); this.dirty = true;
  }
  lift(key) { this.strokes.delete(key); }
  uvToPx(uv) { return [uv.x * CW, (1 - uv.y) * CH]; }

  // ---------------------------------------------------------------- input
  active() { return this.floor === this.g.level; }
  // Fingertip / wand tip: writes while touching the parchment (within ~2 cm).
  touch(key, tip) {
    if (!this.active()) return false;
    const l = this.mesh.worldToLocal(tip.clone()); // plane is 1x1, scaled to w x h
    const zWorld = l.z * 1; // mesh is not scaled in z
    if (Math.abs(l.x) <= 0.5 && Math.abs(l.y) <= 0.5 && zWorld < 0.02 && zWorld > -0.05) {
      const [px, py] = this.uvToPx({ x: l.x + 0.5, y: l.y + 0.5 });
      this.stroke(key, px, py);
      return true;
    }
    this.lift(key);
    return false;
  }
  // Pointing ray with the trigger held (or mouse button on desktop).
  rayDraw(key, uv) { if (this.active()) { const [px, py] = this.uvToPx(uv); this.stroke(key, px, py); } }

  update(dt) {
    this.btnCool = Math.max(0, this.btnCool - dt);
    this.group.visible = true;
    if (this.dirty) { this.tex.needsUpdate = true; this.dirty = false; }
  }
}
