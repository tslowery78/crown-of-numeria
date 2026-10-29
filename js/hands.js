// Hands-first helpers shared by the castle and the kingdom: palm direction, the
// fill ring shown while a pinch is held, button press feedback (hands have no
// haptics), and poke testing for flat sign buttons.
import * as THREE from 'three';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();

// Palm of a tracked hand in world space: { center, normal, along, across }.
// along = wrist -> middle knuckle (towards the fingers), across = pinky knuckle -> index knuckle.
// For a left hand along x across points out of the palm; for a right hand it points out of the back.
export function palmPose(hand, handedness) {
  const j = hand?.joints;
  const w = j?.wrist, m = j?.['middle-finger-metacarpal'], i = j?.['index-finger-metacarpal'], p = j?.['pinky-finger-metacarpal'];
  if (!w || !m || !i || !p || w.visible === false || m.visible === false) return null;
  w.getWorldPosition(_a); m.getWorldPosition(_b); i.getWorldPosition(_c); p.getWorldPosition(_d);
  const along = _b.clone().sub(_a), across = _c.clone().sub(_d);
  if (along.lengthSq() < 1e-6 || across.lengthSq() < 1e-6) return null;
  along.normalize(); across.normalize();
  const normal = new THREE.Vector3().crossVectors(along, across).normalize();
  if (handedness !== 'left') normal.negate();
  return { wrist: _a.clone(), center: _a.clone().lerp(_b, 0.5), normal, along, across };
}

// How squarely the palm faces the head: 1 = straight at it, 0 = edge-on, -1 = away.
export function palmFacing(pose, head) {
  if (!pose) return -1;
  return pose.normal.dot(head.clone().sub(pose.center).normalize());
}

// A ring that fills clockwise as a pinch is held (also used for the teleport target).
export function makeFillRing(r = 0.035, color = 0xffd54a) {
  const g = new THREE.Group();
  const back = new THREE.Mesh(new THREE.RingGeometry(r * 0.72, r, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, depthTest: false, side: THREE.DoubleSide, toneMapped: false }));
  const fill = new THREE.Mesh(new THREE.RingGeometry(r * 0.72, r, 48, 1, Math.PI / 2, -Math.PI * 2), new THREE.MeshBasicMaterial({ color, depthTest: false, side: THREE.DoubleSide, toneMapped: false }));
  back.renderOrder = fill.renderOrder = 20;
  g.add(back, fill); g.visible = false;
  g.userData.fill = fill;
  g.setProgress = (t) => { const n = fill.geometry.index.count; fill.geometry.setDrawRange(0, Math.round(Math.min(1, Math.max(0, t)) * n / 6) * 6); };
  return g;
}

// Visible press feedback for sign buttons: the button sinks 1 cm and lights up briefly.
// Runs on its own list so it still plays while the game is paused.
export class PressFx {
  constructor() { this.list = []; }
  press(mesh) {
    if (!mesh?.material) return;
    const prev = this.list.find((f) => f.mesh === mesh);
    if (prev) { prev.t = 0; return; }
    this.list.push({ mesh, t: 0, z: mesh.position.z, color: mesh.material.color.getHex() });
    mesh.translateZ(-0.01); mesh.material.color.setHex(0xfff2a0);
  }
  update(dt) {
    for (const f of this.list) f.t += dt;
    for (const f of this.list.filter((f) => f.t >= 0.18)) { f.mesh.translateZ(0.01); f.mesh.material.color.setHex(f.color); }
    this.list = this.list.filter((f) => f.t < 0.18);
  }
  active(mesh) { return this.list.some((f) => f.mesh === mesh); }
}

// Is this object actually on screen (it and every parent visible, attached to the scene)?
export function shown(o) {
  for (let x = o; x; x = x.parent) { if (!x.visible) return false; if (!x.parent) return !!x.isScene; }
  return false;
}

// Fingertip poke on a flat button (a PlaneGeometry mesh facing +Z): true when the tip
// pushes through the front face inside the button rectangle. `memo` keeps the last depth.
export function pokeThrough(mesh, tip, memo, margin = 0.012) {
  const p = mesh.geometry?.parameters; if (!p?.width) return false;
  const l = mesh.worldToLocal(tip.clone());
  const s = mesh.getWorldScale(_a), mx = margin / Math.max(1e-6, s.x), my = margin / Math.max(1e-6, s.y);
  const prev = memo.has(mesh) ? memo.get(mesh) : l.z;
  memo.set(mesh, l.z);
  const zs = l.z * s.z, prevs = prev * s.z;
  const inside = Math.abs(l.x) < p.width / 2 + mx && Math.abs(l.y) < p.height / 2 + my;
  return inside && prevs > 0.004 && zs <= 0.004 && zs > -0.07;
}
