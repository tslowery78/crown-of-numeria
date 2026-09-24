// Hands-on maths: a slanted gem tray beside each Magic Lock. For problems that
// carry a `manip` description (see problems.js) the tray shows the starting
// quantity; the player moves gems in and out (pinch/grab, poke, or click), and
// the lock panel's answer follows the tray. Numeric input stays as a fallback.
//
// manip = { layout: 'ten' | 'groups' | 'frac', start, groups?, denom?, value: 'total' | 'added' | 'frac' | 'fracAdded' }
import * as THREE from 'three';

const PITCH = 0.06; // slot spacing (m)

export class GemTray {
  constructor(game) {
    this.g = game;
    this.group = new THREE.Group(); this.group.visible = false;
    this.board = new THREE.Group(); this.group.add(this.board);
    this.slots = []; this.held = new Map(); this.touch = new Map(); this.manip = null; this.panel = null;
    const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a32, roughness: 0.75 });
    this.mats = {
      wood, well: new THREE.MeshStandardMaterial({ color: 0x3b2716, roughness: 0.9 }),
      gemA: new THREE.MeshStandardMaterial({ color: 0x3f8cff, emissive: 0x0f2f66, roughness: 0.2, metalness: 0.1 }),
      gemB: new THREE.MeshStandardMaterial({ color: 0xff5c9a, emissive: 0x661a3a, roughness: 0.2, metalness: 0.1 }),
      frame: new THREE.MeshStandardMaterial({ color: 0xe0b84a, metalness: 0.8, roughness: 0.3 }),
      bar: new THREE.MeshStandardMaterial({ color: 0xf3e6c8, roughness: 0.8 }),
    };
    this.gemGeo = new THREE.OctahedronGeometry(0.022);
    this.backing = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.02), wood); this.board.add(this.backing);
    this.backing.userData.trayPart = true;
    // bowl of spare gems under the board
    this.bowl = new THREE.Group();
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.07, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xc9a25a, metalness: 0.5, roughness: 0.4, side: THREE.DoubleSide }));
    this.bowl.add(bowl); bowl.userData.trayBowl = true;
    for (let k = 0; k < 5; k++) { const gm = new THREE.Mesh(this.gemGeo, this.mats.gemB); gm.position.set(Math.cos(k * 1.3) * 0.03, -0.02, Math.sin(k * 1.3) * 0.03); gm.userData.trayBowl = true; this.bowl.add(gm); }
    this.group.add(this.bowl);
    this.label = null;
  }

  // Position the tray on the Magic Lock wall of `floor`, beside the panel.
  place(floor, y0, W, D, panelH) {
    const hw = W / 2, hd = D / 2;
    this.floor = floor;
    this.group.position.set(Math.max(0.6, Math.min(hw - 0.25, 0.85)), y0 + panelH - 0.12, -hd + 0.14);
  }

  bind(panel, problem) {
    this.panel = panel; this.manip = problem?.manip || null;
    this.cancelDemo();
    for (const [, gem] of this.held) this.board.remove(gem.mesh);
    this.held.clear();
    if (!this.manip) { this.group.visible = false; return; }
    this.build(this.manip);
    this.group.visible = true;
  }
  hide() { this.bind(null, null); }

  // ---------------------------------------------------------------- layout
  build(m) {
    for (const s of this.slots) { this.board.remove(s.well); if (s.gem) this.board.remove(s.gem); }
    for (const o of this.extra || []) this.board.remove(o);
    this.slots = []; this.extra = [];
    let rows, cols, rowGap = [];
    if (m.layout === 'groups') { rows = m.groups; cols = 5; }
    else if (m.layout === 'frac') { cols = m.denom <= 6 ? m.denom : Math.ceil(m.denom / 2); rows = m.denom <= 6 ? 1 : 2; }
    else { rows = 4; cols = 5; rowGap = [2]; } // two ten-frames
    const gapH = rowGap.length ? 0.03 : 0;
    const w = cols * PITCH + 0.05, h = rows * PITCH + gapH + 0.05;
    this.backing.scale.set(w, h, 1);
    let n = 0;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (m.layout === 'frac' && n >= m.denom) break;
      const x = (c - (cols - 1) / 2) * PITCH, y = ((rows - 1) / 2 - r) * PITCH + (rowGap.length ? (r < 2 ? gapH / 2 : -gapH / 2) : 0);
      const well = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.006, 16).rotateX(Math.PI / 2), this.mats.well);
      well.position.set(x, y, 0.012); well.userData.traySlot = n; this.board.add(well);
      this.slots.push({ i: n, well, gem: null, pos: new THREE.Vector3(x, y, 0.03), group: m.layout === 'groups' ? r : 0 });
      n++;
    }
    if (m.layout === 'frac') { // show the whole as one bar
      const bar = new THREE.Mesh(new THREE.BoxGeometry(w - 0.02, 0.008, 0.004), this.mats.frame); bar.position.set(0, h / 2 - 0.012, 0.012); this.board.add(bar); this.extra.push(bar);
    }
    if (m.layout === 'groups') for (let r = 1; r < rows; r++) { const line = new THREE.Mesh(new THREE.BoxGeometry(w - 0.02, 0.004, 0.004), this.mats.frame); line.position.set(0, ((rows - 1) / 2 - r + 0.5) * PITCH, 0.012); this.board.add(line); this.extra.push(line); }
    if (m.layout === 'ten') { const line = new THREE.Mesh(new THREE.BoxGeometry(w - 0.02, 0.005, 0.004), this.mats.frame); line.position.set(0, 0, 0.012); this.board.add(line); this.extra.push(line); }
    // tilt the board back so it faces the player, bowl underneath
    this.board.rotation.x = -0.55;
    this.bowl.position.set(0, -h / 2 - 0.08, 0.06);
    this.reset();
  }

  reset() {
    for (const s of this.slots) this.setSlot(s, false);
    for (let k = 0; k < Math.min(this.manip.start, this.slots.length); k++) this.setSlot(this.slots[k], true, 'A');
    this.changed(false);
  }

  setSlot(s, on, kind = 'B') {
    if (on && !s.gem) {
      s.gem = new THREE.Mesh(this.gemGeo, kind === 'A' ? this.mats.gemA : this.mats.gemB);
      s.gem.position.copy(s.pos); s.gem.userData.traySlot = s.i; s.kind = kind;
      this.board.add(s.gem);
    } else if (!on && s.gem) { this.board.remove(s.gem); s.gem = null; }
  }

  count() { return this.slots.filter((s) => s.gem).length; }
  value() {
    const m = this.manip, n = this.count();
    if (m.value === 'added') return String(Math.max(0, n - m.start));
    if (m.value === 'frac') return `${n}/${m.denom}`;
    if (m.value === 'fracAdded') return `${Math.max(0, n - m.start)}/${m.denom}`;
    return String(n);
  }
  labelText() {
    const m = this.manip, n = this.count();
    if (m.value === 'added') return `Added: ${Math.max(0, n - m.start)}`;
    if (m.value === 'frac') return `${n}/${m.denom} of the bar`;
    if (m.value === 'fracAdded') return `Added: ${Math.max(0, n - m.start)}/${m.denom}`;
    return m.layout === 'groups' ? `${n} gems` : `Gems: ${n}`;
  }
  // Tray changed: refresh its label and (when the player did it) the panel's answer.
  changed(byPlayer = true, sound = 0) {
    if (this.label) { this.group.remove(this.label); this.label.material.map.dispose(); }
    this.label = this.g.makeSign(this.labelText(), { w: 0.4, h: 0.1, size: 110, bg: '#2b1a4a', fg: '#ffe9a8' });
    this.label.position.set(0, (this.backing.scale.y / 2) * Math.cos(0.55) + 0.06, 0.0);
    this.group.add(this.label);
    if (byPlayer && this.panel?.state === 'solving' && this.panel.problem?.manip === this.manip) {
      this.panel.input = this.value(); this.panel.msg = 'The tray is your answer. Press OK when it looks right!'; this.panel.msgColor = '#bfe3ff'; this.panel.draw();
    }
    if (sound > 0) this.g.audio?.chime(this.group.getWorldPosition(new THREE.Vector3()), 72 + Math.min(this.count(), 20));
    if (sound < 0) this.g.audio?.pop(this.group.getWorldPosition(new THREE.Vector3()));
  }

  // ---------------------------------------------------------------- input
  active() { return this.group.visible && this.floor === this.g.level && !this.demoTimer; }
  slotWorld(s) { return this.board.localToWorld(s.pos.clone()); }
  bowlWorld() { return this.bowl.getWorldPosition(new THREE.Vector3()); }

  // Pinch / grip near the tray: take a gem from a slot or from the bowl.
  grabAt(point, holder) {
    if (!this.active()) return null;
    let best = null, bd = 0.045;
    for (const s of this.slots) if (s.gem) { const d = this.slotWorld(s).distanceTo(point); if (d < bd) { bd = d; best = s; } }
    let kind = 'B';
    if (best) { kind = best.kind; this.setSlot(best, false); this.changed(true, -1); }
    else if (this.bowlWorld().distanceTo(point) > 0.1) return null;
    const mesh = new THREE.Mesh(this.gemGeo, kind === 'A' ? this.mats.gemA : this.mats.gemB);
    this.g.world.add(mesh);
    const gem = { mesh, kind };
    this.held.set(holder, gem);
    return gem;
  }
  // Let go: drop into the nearest empty slot, or the gem returns to the bowl.
  release(holder) {
    const gem = this.held.get(holder); if (!gem) return;
    this.held.delete(holder); this.g.world.remove(gem.mesh);
    const p = gem.mesh.position;
    let best = null, bd = 0.07;
    for (const s of this.slots) if (!s.gem) { const d = this.slotWorld(s).distanceTo(p); if (d < bd) { bd = d; best = s; } }
    if (best && this.active()) { this.setSlot(best, true, gem.kind); this.changed(true, 1); }
    else this.g.burst(p.clone(), 6, 0.015, 1);
  }
  updateHeld() {
    for (const [holder, gem] of this.held) { holder.getWorldPosition(gem.mesh.position); gem.mesh.rotation.y += 0.05; }
  }
  // Finger/wand poke: tapping an empty slot fills it, tapping a gem removes it.
  poke(ptrKey, tip) {
    if (!this.active()) return;
    let near = null, bd = 0.032;
    for (const s of this.slots) { const d = this.slotWorld(s).distanceTo(tip); if (d < bd) { bd = d; near = s; } }
    const prev = this.touch.get(ptrKey);
    this.touch.set(ptrKey, near);
    if (near && near !== prev) this.toggle(near);
  }
  toggle(s) {
    if (s.gem) { this.setSlot(s, false); this.changed(true, -1); }
    else { this.setSlot(s, true, 'B'); this.changed(true, 1); }
  }
  // Pointing ray / desktop click on a slot mesh or gem.
  clickSlot(i) { const s = this.slots[i]; if (s && this.active()) this.toggle(s); }
  pickables() { const out = []; if (this.group.visible && this.floor === this.g.level) this.board.traverse((o) => { if (o.isMesh && o.userData.traySlot !== undefined) out.push(o); }); return out; }

  // ---------------------------------------------------------------- worked example
  // Replays the operation from the starting arrangement to the correct one,
  // one gem at a time, counting aloud on the label. Returns its duration (s).
  demo(answer) {
    const m = this.manip; if (!m) return 0;
    this.reset();
    let target;
    const v = String(answer);
    if (m.value === 'added') target = m.start + Number(v);
    else if (m.value === 'frac') target = Number(v.split('/')[0]);
    else if (m.value === 'fracAdded') target = m.start + Number(v.split('/')[0]);
    else target = Number(v);
    target = Math.max(0, Math.min(this.slots.length, target));
    const steps = [];
    const cur = this.count();
    if (target > cur) for (let k = cur; k < target; k++) steps.push(() => { this.setSlot(this.nextEmpty(), true, 'B'); this.changed(false, 1); });
    else for (let k = cur; k > target; k--) steps.push(() => { const s = [...this.slots].reverse().find((x) => x.gem); this.setSlot(s, false); this.changed(false, -1); });
    let i = 0;
    const tick = () => { if (i < steps.length) { steps[i++](); this.demoTimer = setTimeout(tick, 420); } else this.demoTimer = null; };
    this.demoTimer = setTimeout(tick, 400);
    return 0.4 + steps.length * 0.42;
  }
  nextEmpty() {
    const m = this.manip;
    if (m.layout === 'groups' && m.per) { // fill each group up to `per`
      for (let r = 0; r < m.groups; r++) { const row = this.slots.filter((s) => s.group === r); if (row.filter((s) => s.gem).length < m.per) return row.find((s) => !s.gem); }
    }
    return this.slots.find((s) => !s.gem);
  }
  cancelDemo() { clearTimeout(this.demoTimer); this.demoTimer = null; }
}
