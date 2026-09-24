// Stylized player avatars. The avatar follows the player's head and hands and
// is drawn on a mirror-only layer, so the player sees herself in mirrors but
// her own head never blocks her view.
import * as THREE from 'three';

export const MIRROR_LAYER = 3;

export const AVATAR_OPTIONS = {
  style: [['princess', 'Princess'], ['knight', 'Knight'], ['wizard', 'Wizard'], ['fairy', 'Fairy'], ['explorer', 'Explorer']],
  outfit: ['#e84a8a', '#8a5cff', '#2f80ed', '#1fb57a', '#f2994a', '#e0b84a', '#d63b3b', '#2b2b3a'],
  hair: ['#2b1b12', '#5a3a22', '#9a5b2e', '#d9a441', '#f3d98b', '#c0392b', '#6c3483', '#1e8bc3'],
  hairStyle: [['long', 'Long'], ['ponytail', 'Ponytail'], ['buns', 'Space buns'], ['curly', 'Curly'], ['short', 'Short'], ['braids', 'Braids']],
  skin: ['#ffe0c7', '#f5c9a3', '#e0a878', '#c68657', '#9c6440', '#6e4428'],
};
export const DEFAULT_AVATAR = { style: 'princess', outfit: '#e84a8a', hair: '#5a3a22', hairStyle: 'long', skin: '#f5c9a3' };

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...o });

// Equirectangular head texture: skin all around with the face centred on -Z
// (u = 0.75 on three's SphereGeometry).
function headTexture(skin) {
  const W = 512, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = skin; g.fillRect(0, 0, W, H);
  const cx = 384, cy = 128;
  for (const s of [-1, 1]) {
    const x = cx + s * 27, y = cy - 4;
    g.fillStyle = '#fff'; g.beginPath(); g.ellipse(x, y, 11, 13, 0, 0, 7); g.fill();
    g.fillStyle = '#4a2f1a'; g.beginPath(); g.ellipse(x, y + 2, 8, 10, 0, 0, 7); g.fill();
    g.fillStyle = '#111'; g.beginPath(); g.arc(x, y + 3, 4.5, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(x + 3, y - 2, 3, 0, 7); g.fill();
    g.strokeStyle = '#2b1b12'; g.lineWidth = 2.5; g.beginPath(); g.arc(x, y - 1, 14, 1.2 * Math.PI, 1.8 * Math.PI); g.stroke();
    g.fillStyle = 'rgba(255,110,130,0.35)'; g.beginPath(); g.ellipse(cx + s * 40, cy + 16, 10, 6, 0, 0, 7); g.fill();
  }
  g.strokeStyle = '#8a3a3a'; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.arc(cx, cy + 16, 10, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
  g.fillStyle = 'rgba(0,0,0,0.08)'; g.beginPath(); g.ellipse(cx, cy + 6, 3, 2, 0, 0, 7); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// Builds the avatar at "eye height 1.17 m" scale; forward is -Z (like the camera).
export function buildAvatar(cfg = DEFAULT_AVATAR) {
  cfg = { ...DEFAULT_AVATAR, ...cfg };
  const root = new THREE.Group(), body = new THREE.Group(), head = new THREE.Group();
  root.add(body); root.add(head);
  const skin = std(cfg.skin, { roughness: 0.6 }), outfit = std(cfg.outfit), hair = std(cfg.hair, { roughness: 0.55 });
  const gold = std('#e8b83a', { metalness: 0.8, roughness: 0.3 }), white = std('#ffffff'), dark = std('#3a2a22');
  const accent = std(new THREE.Color(cfg.outfit).offsetHSL(0, 0, 0.18));
  const add = (parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = [1, 1, 1]) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.scale.set(...s); parent.add(m); return m; };

  // head (origin = between the eyes)
  const R = 0.115;
  add(head, new THREE.SphereGeometry(R, 32, 24), new THREE.MeshStandardMaterial({ map: headTexture(cfg.skin), roughness: 0.6 }), 0, -0.01, 0.01);
  for (const s of [-1, 1]) add(head, new THREE.SphereGeometry(0.025, 12, 8), skin, s * R * 0.98, -0.02, 0.01);
  // hair
  const cap = add(head, new THREE.SphereGeometry(R * 1.07, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), hair, 0, 0, 0.012, 0.38, 0, 0);
  cap.scale.set(1, 1, 1.02);
  add(head, new THREE.SphereGeometry(R * 1.02, 24, 12, Math.PI * 0.15, Math.PI * 0.7, 0, Math.PI * 0.35), hair, 0, 0.012, -0.005, -0.1, Math.PI, 0); // bangs
  const hs = cfg.hairStyle;
  if (hs === 'long' || hs === 'braids' || hs === 'curly') add(head, new THREE.SphereGeometry(R * 1.05, 24, 16, 0, Math.PI * 2, Math.PI * 0.3, Math.PI * 0.45), hair, 0, -0.03, 0.03, 0, 0, 0, [1, 1.1, 1]);
  if (hs === 'long') add(head, new THREE.CapsuleGeometry(0.1, 0.22, 6, 16), hair, 0, -0.2, 0.07, 0.1, 0, 0, [1.05, 1, 0.45]);
  if (hs === 'ponytail') { add(head, new THREE.SphereGeometry(0.035, 12, 8), hair, 0, 0.05, 0.12); add(head, new THREE.CapsuleGeometry(0.045, 0.2, 6, 12), hair, 0, -0.08, 0.16, 0.35, 0, 0); }
  if (hs === 'buns') for (const s of [-1, 1]) add(head, new THREE.SphereGeometry(0.055, 16, 12), hair, s * 0.08, 0.09, 0.02);
  if (hs === 'braids') for (const s of [-1, 1]) for (let k = 0; k < 4; k++) add(head, new THREE.SphereGeometry(0.03 - k * 0.003, 10, 8), hair, s * 0.1, -0.08 - k * 0.055, 0.02);
  if (hs === 'curly') for (let k = 0; k < 22; k++) { const a = (k / 22) * Math.PI * 2, y = -0.02 + Math.sin(k * 1.7) * 0.05; if (Math.sin(a) < -0.3) continue; add(head, new THREE.SphereGeometry(0.04, 10, 8), hair, Math.cos(a) * R * 1.05, y, Math.sin(a) * R * 1.05 + 0.02); }
  // headwear
  const hat = new THREE.Group(); head.add(hat);
  if (cfg.style === 'princess') { add(hat, new THREE.TorusGeometry(0.075, 0.01, 8, 24), gold, 0, 0.105, 0, Math.PI / 2 - 0.2, 0, 0); for (let k = -2; k <= 2; k++) add(hat, new THREE.ConeGeometry(0.012, 0.045, 6), gold, k * 0.028, 0.14, -0.06 + Math.abs(k) * 0.012); add(hat, new THREE.SphereGeometry(0.012, 8, 6), std('#ff4f9a', { roughness: 0.2 }), 0, 0.125, -0.075); }
  if (cfg.style === 'wizard') { add(hat, new THREE.CylinderGeometry(0.2, 0.2, 0.012, 32), accent, 0, 0.09, 0.01, -0.12, 0, 0); add(hat, new THREE.ConeGeometry(0.12, 0.32, 24), outfit, 0, 0.24, 0.03, -0.25, 0, 0); for (let k = 0; k < 3; k++) add(hat, new THREE.OctahedronGeometry(0.014), gold, -0.05 + k * 0.05, 0.16 + k * 0.05, -0.07 + k * 0.02); }
  if (cfg.style === 'fairy') for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2; add(hat, new THREE.SphereGeometry(0.018, 8, 6), std(['#ff7eb6', '#ffd54a', '#7fd4ff'][k % 3]), Math.cos(a) * 0.1, 0.085, Math.sin(a) * 0.1 + 0.01); }
  if (cfg.style === 'explorer') { add(hat, new THREE.CylinderGeometry(0.19, 0.19, 0.012, 32), std('#c8a26a'), 0, 0.085, 0.01, -0.1, 0, 0); add(hat, new THREE.CylinderGeometry(0.1, 0.115, 0.1, 24), std('#c8a26a'), 0, 0.13, 0.012, -0.1, 0, 0); add(hat, new THREE.CylinderGeometry(0.116, 0.116, 0.025, 24), std('#6b3f1f'), 0, 0.1, 0.01, -0.1, 0, 0); }
  if (cfg.style === 'knight') { add(hat, new THREE.TorusGeometry(0.1, 0.014, 8, 24), std('#b8bcc8', { metalness: 0.8, roughness: 0.35 }), 0, 0.075, 0.01, Math.PI / 2 - 0.2, 0, 0); add(hat, new THREE.ConeGeometry(0.03, 0.12, 8), outfit, 0, 0.16, 0.03, 0.4, 0, 0); }

  // body (origin = floor under the head)
  add(body, new THREE.CylinderGeometry(0.035, 0.04, 0.08, 12), skin, 0, 1.0, 0.02);
  const shoulderY = 0.93;
  if (cfg.style === 'princess' || cfg.style === 'fairy') {
    add(body, new THREE.CylinderGeometry(0.1, 0.085, 0.24, 20), outfit, 0, 0.83, 0.02);
    add(body, new THREE.SphereGeometry(0.1, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), accent, 0, 0.93, 0.02, 0, 0, 0, [1.25, 0.35, 0.9]);
    const len = cfg.style === 'fairy' ? 0.4 : 0.72;
    add(body, new THREE.ConeGeometry(cfg.style === 'fairy' ? 0.22 : 0.3, len, 28, 1, true), outfit, 0, 0.72 - len / 2, 0.02).material.side = THREE.DoubleSide;
    add(body, new THREE.TorusGeometry(0.088, 0.012, 8, 24), accent, 0, 0.72, 0.02, Math.PI / 2, 0, 0);
    if (cfg.style === 'fairy') { for (const s of [-1, 1]) add(body, new THREE.CylinderGeometry(0.03, 0.025, 0.36, 10), skin, s * 0.06, 0.18, 0.02); }
  } else if (cfg.style === 'wizard') {
    add(body, new THREE.CylinderGeometry(0.11, 0.26, 0.92, 24), outfit, 0, 0.5, 0.02);
    add(body, new THREE.TorusGeometry(0.12, 0.018, 8, 24), gold, 0, 0.68, 0.02, Math.PI / 2, 0, 0);
    for (let k = 0; k < 6; k++) add(body, new THREE.OctahedronGeometry(0.016), gold, Math.sin(k * 2.1) * 0.15, 0.2 + k * 0.1, -0.16 + k * 0.012);
  } else {
    const knight = cfg.style === 'knight';
    const top = knight ? std('#b8bcc8', { metalness: 0.75, roughness: 0.35 }) : outfit;
    add(body, new THREE.CylinderGeometry(0.11, 0.1, 0.34, 20), top, 0, 0.78, 0.02);
    if (knight) { add(body, new THREE.BoxGeometry(0.1, 0.12, 0.01), outfit, 0, 0.8, -0.085); add(body, new THREE.PlaneGeometry(0.34, 0.8), std(cfg.outfit, { side: THREE.DoubleSide }), 0, 0.55, 0.13, 0.08, 0, 0); }
    else { add(body, new THREE.BoxGeometry(0.2, 0.26, 0.1), std('#8a5a2b'), 0, 0.78, 0.13); for (const s of [-1, 1]) add(body, new THREE.BoxGeometry(0.02, 0.3, 0.02), std('#6b3f1f'), s * 0.07, 0.82, -0.09); }
    add(body, new THREE.CylinderGeometry(0.105, 0.11, 0.14, 20), knight ? std('#6b6f7a', { metalness: 0.6, roughness: 0.4 }) : std('#6b4a2b'), 0, 0.56, 0.02);
    for (const s of [-1, 1]) {
      add(body, new THREE.CylinderGeometry(0.042, 0.038, 0.44, 12), knight ? std('#9aa0ad', { metalness: 0.7, roughness: 0.4 }) : skin, s * 0.055, 0.27, 0.02);
      add(body, new THREE.BoxGeometry(0.075, 0.06, 0.13), dark, s * 0.055, 0.03, -0.01);
    }
  }
  if (cfg.style === 'fairy') {
    const wingMat = new THREE.MeshStandardMaterial({ color: '#bff3ff', transparent: true, opacity: 0.55, side: THREE.DoubleSide, emissive: '#6fd8ff', emissiveIntensity: 0.4, roughness: 0.2 });
    const wings = new THREE.Group(); wings.position.set(0, 0.86, 0.12); body.add(wings);
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.CircleGeometry(0.16, 24), wingMat); w.scale.set(1, 1.5, 1); w.position.set(s * 0.14, 0.06, 0); w.rotation.set(0, s * 0.5, s * -0.5); wings.add(w);
      const w2 = new THREE.Mesh(new THREE.CircleGeometry(0.1, 20), wingMat); w2.scale.set(1, 1.4, 1); w2.position.set(s * 0.1, -0.12, 0); w2.rotation.set(0, s * 0.5, s * 0.6); wings.add(w2);
    }
    root.userData.wings = wings;
  }
  if (cfg.style === 'princess' || cfg.style === 'wizard' || cfg.style === 'knight') {
    const cape = add(body, new THREE.CylinderGeometry(0.12, 0.3, 0.85, 20, 1, true, Math.PI * 0.6, Math.PI * 0.8), std(new THREE.Color(cfg.outfit).offsetHSL(0.05, 0, -0.15), { side: THREE.DoubleSide }), 0, 0.52, 0.03);
    cape.rotation.y = Math.PI;
    if (cfg.style !== 'knight') cape.visible = cfg.style === 'princess' ? false : true;
  }

  // arms: unit capsules re-aimed every frame from shoulder to hand
  const sleeve = cfg.style === 'knight' ? std('#b8bcc8', { metalness: 0.75, roughness: 0.35 }) : cfg.style === 'wizard' ? outfit : skin;
  const arms = [-1, 1].map((s) => {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.032, 1, 4, 10), sleeve); root.add(arm);
    const puff = cfg.style === 'princess' || cfg.style === 'fairy' ? add(body, new THREE.SphereGeometry(0.045, 12, 10), accent, s * 0.13, shoulderY - 0.02, 0.02) : null;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.04, 14, 10), skin); root.add(hand);
    return { side: s, arm, hand, puff };
  });
  // wand for wizard & fairy
  if (cfg.style === 'wizard' || cfg.style === 'fairy') {
    const wand = new THREE.Group(); add(wand, new THREE.CylinderGeometry(0.006, 0.008, 0.25, 8), dark, 0, 0, -0.1, Math.PI / 2, 0, 0); add(wand, new THREE.OctahedronGeometry(0.022), new THREE.MeshStandardMaterial({ color: '#ffe066', emissive: '#ffcc00', emissiveIntensity: 0.8 }), 0, 0, -0.23);
    arms[1].hand.add(wand);
  }

  root.traverse((o) => { o.layers.set(MIRROR_LAYER); o.frustumCulled = false; });
  return { root, body, head, hat, arms, cfg, shoulderY, worn: new THREE.Group() };
}

// Drives an avatar from head/hand poses (world space).
export class AvatarRig {
  constructor(avatar) {
    this.a = avatar; this.yaw = 0; this.scale = 1;
    avatar.head.add(avatar.worn);
    this.tmp = { v: new THREE.Vector3(), q: new THREE.Quaternion(), e: new THREE.Euler(0, 0, 0, 'YXZ') };
  }
  // head: {pos, quat}; floorY: floor under the player; hands: [left, right] Vector3|null
  update(headPos, headQuat, floorY, hands, dt, t) {
    const a = this.a, { e } = this.tmp;
    const eye = Math.max(0.6, headPos.y - floorY);
    this.scale += (eye / 1.17 - this.scale) * Math.min(1, dt * 2);
    e.setFromQuaternion(headQuat, 'YXZ');
    let d = e.y - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
    this.yaw += d * Math.min(1, dt * 4);
    a.head.position.copy(headPos); a.head.quaternion.copy(headQuat); a.head.scale.setScalar(this.scale);
    a.body.position.set(headPos.x + Math.sin(this.yaw) * 0.06 * this.scale, floorY, headPos.z + Math.cos(this.yaw) * 0.06 * this.scale);
    a.body.rotation.set(0, this.yaw, 0); a.body.scale.setScalar(this.scale);
    // the body hangs under the head, so squash if the player crouches
    a.body.scale.y = Math.min(this.scale, (headPos.y - floorY - 0.17 * this.scale) / 1.0);
    if (a.root.userData.wings) a.root.userData.wings.children.forEach((w, k) => { w.rotation.y = (k % 2 ? -1 : 1) * (0.5 + Math.sin(t * 8) * 0.25); });
    const s = this.scale, sy = a.body.scale.y;
    for (let k = 0; k < 2; k++) {
      const arm = a.arms[k], sh = new THREE.Vector3(arm.side * 0.14 * s, a.shoulderY * sy, 0.02 * s).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw).add(a.body.position);
      let hand = hands[k];
      if (!hand) hand = new THREE.Vector3(arm.side * 0.2 * s, a.shoulderY * sy - 0.5 * s, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw).add(a.body.position);
      const dir = hand.clone().sub(sh), len = Math.min(dir.length(), 0.75 * s);
      dir.normalize();
      const end = sh.clone().addScaledVector(dir, len);
      arm.arm.position.copy(sh).add(end).multiplyScalar(0.5);
      arm.arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      arm.arm.scale.set(s, Math.max(0.05, len - 0.064 * s), s);
      arm.hand.position.copy(end); arm.hand.scale.setScalar(s);
      arm.hand.quaternion.copy(headQuat);
    }
  }
}

// Small turntable preview for the setup screen.
export function avatarPreview(canvas) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  r.setPixelRatio(Math.min(2, window.devicePixelRatio)); r.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, canvas.width / canvas.height, 0.1, 10);
  cam.position.set(0, 0.8, -2.9); cam.lookAt(0, 0.7, 0); cam.layers.enable(MIRROR_LAYER);
  scene.add(new THREE.HemisphereLight('#ffffff', '#886666', 2.2)); const dl = new THREE.DirectionalLight('#fff', 2); dl.position.set(1, 2, -2); scene.add(dl);
  let av = null, rig = null, angle = 0, t = 0;
  const set = (cfg) => { if (av) scene.remove(av.root); av = buildAvatar(cfg); rig = new AvatarRig(av); scene.add(av.root); };
  const q = new THREE.Quaternion(), headPos = new THREE.Vector3(0, 1.17, 0);
  r.setAnimationLoop(() => {
    t += 0.016; angle = Math.sin(t * 0.6) * 0.8;
    q.setFromEuler(new THREE.Euler(0, angle, 0));
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(q), right = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    const wave = Math.sin(t * 3) * 0.12;
    rig?.update(headPos, q, 0, [headPos.clone().addScaledVector(right, -0.25).add(new THREE.Vector3(0, -0.55, 0)).addScaledVector(fwd, 0.1), headPos.clone().addScaledVector(right, 0.3).add(new THREE.Vector3(0, 0.05 + wave, 0)).addScaledVector(fwd, 0.1)], 1, t);
    r.render(scene, cam);
  });
  return { set };
}
