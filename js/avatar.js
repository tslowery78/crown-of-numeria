// Stylized player avatars. The avatar follows the player's head and hands and
// is drawn on a mirror-only layer, so the player sees herself in mirrors but
// her own head never blocks her view.
//
// An avatar config has an `identity` (a family preset or 'custom') that decides
// the face, hair, glasses and beard, plus a hero `style` and `outfit` colour
// that any identity can change. Identity never decides the maths grade.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const MIRROR_LAYER = 3;

export const AVATAR_OPTIONS = {
  style: [['adventurer', 'Adventurer'], ['princess', 'Princess'], ['knight', 'Knight'], ['wizard', 'Wizard'], ['fairy', 'Fairy'], ['explorer', 'Explorer']],
  outfit: ['#3f5f9e', '#6f55b0', '#1f5a55', '#e84a8a', '#8a5cff', '#2f80ed', '#1fb57a', '#f2994a', '#e0b84a', '#d63b3b', '#f1ead8', '#2b2b3a'],
  hair: ['#2b1b12', '#5a3a22', '#9a5b2e', '#d9a441', '#f3d98b', '#c0392b', '#6c3483', '#1e8bc3'],
  hairStyle: [['long', 'Long'], ['ponytail', 'Ponytail'], ['buns', 'Space buns'], ['curly', 'Curly'], ['short', 'Short'], ['braids', 'Braids']],
  skin: ['#ffe0c7', '#f5c9a3', '#e0a878', '#c68657', '#9c6440', '#6e4428'],
};

// Family looks, modelled from reference sheets that stay out of the public repo.
// Keys are roles, not names: the family's real names live only on the device
// (bookmark links or Grown-up settings). `outfit`/`style` are only the starting costume.
export const FAMILY = {
  older: { label: 'Big sister', grade: 4, adult: false, skin: '#f4d0b8', hair: '#8a6343', eye: '#4f86c6', hairKey: 'braids2', outfit: '#3f5f9e', cape: '#4a6bb0', boots: '#3f5f9e', legs: '#34374a', clasp: 'crown' },
  younger: { label: 'Little sister', grade: 2, adult: false, skin: '#f4d0b8', hair: '#6a4428', eye: '#6b4526', hairKey: 'loose', outfit: '#6f55b0', cape: '#7a5cc0', boots: '#6f55b0', legs: '#34343c', clasp: 'star' },
  mom: { label: 'Mom', grade: null, adult: true, skin: '#f2cbb0', hair: '#7a5436', eye: '#4a3322', hairKey: 'lowbun', glasses: 'round', outfit: '#f1ead8', cape: '#4a6fb8', boots: '#2f3a66', legs: '#2f3348', clasp: 'book', floral: true },
  dad: { label: 'Dad', grade: null, adult: true, skin: '#eab99a', hair: '#4e3524', grey: '#9a938b', eye: '#4a3322', hairKey: 'swept', glasses: 'rect', beard: true, outfit: '#1f5a55', cape: '#253a66', boots: '#5a3a22', legs: '#34343a', clasp: 'compass', pouch: true, broad: true },
};
export const DEFAULT_AVATAR = { identity: 'custom', style: 'princess', outfit: '#e84a8a', hair: '#5a3a22', hairStyle: 'long', skin: '#f5c9a3' };
// The costume a family member starts with (applied once, when a profile is new).
export function familyDefaults(id) {
  const f = FAMILY[id];
  return f ? { identity: id, style: 'adventurer', outfit: f.outfit, skin: f.skin, hair: f.hair, hairStyle: 'long' } : { ...DEFAULT_AVATAR };
}
// names: { older: 'name', ... } saved on this device
export function identityForName(name, names = {}) {
  const k = String(name || '').trim().toLowerCase();
  if (!k) return null;
  return Object.keys(FAMILY).find((id) => (names[id] || '').trim().toLowerCase() === k) || null;
}

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...o });

// Equirectangular head texture: skin all around with the face centred on -Z
// (u = 0.75 on three's SphereGeometry).
function headTexture(skin, { eye = '#4a2f1a', brow = '#2b1b12', adult = false } = {}) {
  const W = 512, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = skin; g.fillRect(0, 0, W, H);
  const cx = 384, cy = 128, er = adult ? 0.85 : 1;
  for (const s of [-1, 1]) {
    const x = cx + s * 26, y = cy - 4;
    g.fillStyle = '#fff'; g.beginPath(); g.ellipse(x, y, 11 * er, 12.5 * er, 0, 0, 7); g.fill();
    g.fillStyle = eye; g.beginPath(); g.ellipse(x, y + 1, 8 * er, 9.5 * er, 0, 0, 7); g.fill();
    g.fillStyle = '#111'; g.beginPath(); g.arc(x, y + 2, 4.2 * er, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(x + 3, y - 2.5, 2.8 * er, 0, 7); g.fill();
    g.strokeStyle = brow; g.lineWidth = 3.2; g.lineCap = 'round'; g.beginPath(); g.arc(x, y + 2, 17, 1.28 * Math.PI, 1.72 * Math.PI); g.stroke();
    g.fillStyle = 'rgba(255,110,130,0.28)'; g.beginPath(); g.ellipse(cx + s * 40, cy + 15, 10, 6, 0, 0, 7); g.fill();
  }
  // nose + big open smile
  g.fillStyle = 'rgba(150,80,60,0.25)'; g.beginPath(); g.ellipse(cx, cy + 8, 4, 3, 0, 0, 7); g.fill();
  g.fillStyle = '#7a2a2a'; g.beginPath(); g.moveTo(cx - 14, cy + 17); g.quadraticCurveTo(cx, cy + 36, cx + 14, cy + 17); g.closePath(); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.moveTo(cx - 12, cy + 18); g.quadraticCurveTo(cx, cy + 24, cx + 12, cy + 18); g.closePath(); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function beardTexture(dark, grey) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, dark); gr.addColorStop(0.55, dark); gr.addColorStop(1, grey);
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  for (let k = 0; k < 900; k++) { g.fillStyle = Math.random() < 0.5 ? grey : dark; g.globalAlpha = 0.35; g.fillRect(Math.random() * 128, Math.random() * 128, 1.5, 4); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function floralTexture(base, ink) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d'); g.fillStyle = base; g.fillRect(0, 0, 512, 128);
  g.fillStyle = ink;
  for (let k = 0; k < 6; k++) {
    const x = 42 + k * 85, y = 70;
    for (let p = 0; p < 6; p++) { const a = (p / 6) * Math.PI * 2; g.beginPath(); g.ellipse(x + Math.cos(a) * 10, y + Math.sin(a) * 10, 7, 4, a, 0, 7); g.fill(); }
    g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill();
    g.fillRect(x - 1.5, y + 12, 3, 34);
    for (const s of [-1, 1]) { g.beginPath(); g.ellipse(x + s * 10, y + 30, 9, 3.5, s * 0.6, 0, 7); g.fill(); }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// Builds the avatar at "eye height 1.17 m" scale; forward is -Z (like the camera).
export function buildAvatar(cfg = DEFAULT_AVATAR) {
  cfg = { ...DEFAULT_AVATAR, ...cfg };
  const fam = FAMILY[cfg.identity] || null;
  const root = new THREE.Group(), body = new THREE.Group(), head = new THREE.Group();
  root.add(body); root.add(head);
  const hairCol = fam ? fam.hair : cfg.hair;
  const skin = std(cfg.skin, { roughness: 0.6 }), outfit = std(cfg.outfit), hair = std(hairCol, { roughness: 0.55 });
  const gold = std('#e8b83a', { metalness: 0.8, roughness: 0.3 }), dark = std('#3a2a22'), leather = std('#6b4428', { roughness: 0.8 });
  const accent = std(new THREE.Color(cfg.outfit).offsetHSL(0, 0, 0.18));
  const add = (parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = [1, 1, 1]) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.scale.set(...s); parent.add(m); return m; };

  // ---- head (origin = between the eyes)
  const R = fam ? (fam.adult ? 0.132 : 0.152) : 0.13, k = R / 0.115;
  const skull = add(head, new THREE.SphereGeometry(R, 32, 24), new THREE.MeshStandardMaterial({ map: headTexture(cfg.skin, { eye: fam?.eye, brow: fam ? new THREE.Color(hairCol).offsetHSL(0, 0, -0.1).getStyle() : '#2b1b12', adult: fam?.adult }), roughness: 0.6 }), 0, -0.01, 0.01);
  if (fam?.adult) skull.scale.y = 1.06;
  for (const s of [-1, 1]) add(head, new THREE.SphereGeometry(0.026 * k, 12, 8), skin, s * R * 0.98, -0.02 * k, 0.01);
  const cap = (scaleY = 1, tilt = 0.38) => { const m = add(head, new THREE.SphereGeometry(R * 1.07, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), hair, 0, 0, 0.012, tilt, 0, 0); m.scale.set(1, scaleY, 1.02); return m; };
  const sides = () => add(head, new THREE.SphereGeometry(R * 1.05, 24, 16, -Math.PI * 0.1, Math.PI * 1.2, Math.PI * 0.3, Math.PI * 0.42), hair, 0, -0.02, 0.02); // back & sides
  const hk = fam ? fam.hairKey : null;
  if (hk === 'braids2') {
    cap(); sides();
    for (const s of [-1, 1]) for (let j = 0; j < 9; j++) {
      const r = (0.03 - j * 0.0016) * k;
      add(head, new THREE.SphereGeometry(r, 12, 10), hair, s * (0.078 - j * 0.003) * k, (-0.05 - j * 0.042) * k, (0.085 + j * 0.012) * k, 0, 0, 0, [1, 1.3, 1]);
      if (j === 7) add(head, new THREE.TorusGeometry(r * 0.95, 0.006 * k, 6, 12), std('#9ab8e8'), s * (0.078 - j * 0.003) * k, (-0.05 - j * 0.042 + 0.022) * k, (0.085 + j * 0.012) * k, Math.PI / 2, 0, 0);
    }
  } else if (hk === 'loose') {
    cap(); sides();
    add(head, new THREE.CapsuleGeometry(0.12 * k, 0.26 * k, 6, 16), hair, 0, -0.2 * k, 0.07 * k, 0.12, 0, 0, [1.12, 1, 0.45]);
    for (const s of [-1, 1]) add(head, new THREE.CapsuleGeometry(0.022 * k, 0.17 * k, 4, 8), hair, s * 0.108 * k, -0.07 * k, -0.035 * k, 0.1, 0, s * 0.12);
  } else if (hk === 'lowbun') {
    cap(1, 0.5);
    add(head, new THREE.SphereGeometry(0.058 * k, 16, 12), hair, 0, -0.045 * k, 0.13 * k);
    add(head, new THREE.TorusGeometry(0.042 * k, 0.01 * k, 8, 16), hair, 0, -0.045 * k, 0.16 * k);
    for (const s of [-1, 1]) add(head, new THREE.CapsuleGeometry(0.01 * k, 0.07 * k, 4, 6), hair, s * 0.103 * k, -0.035 * k, -0.05 * k, 0, 0, s * 0.15);
  } else if (hk === 'swept') {
    cap(1.08, 0.3);
    add(head, new THREE.SphereGeometry(0.085 * k, 16, 12), hair, 0.01 * k, 0.07 * k, -0.02 * k, -0.2, 0, -0.12, [1.25, 0.55, 1.15]); // swept top
    const greyM = std(fam.grey, { roughness: 0.6 });
    for (const s of [-1, 1]) add(head, new THREE.SphereGeometry(0.06 * k, 12, 10), greyM, s * 0.085 * k, 0.005 * k, 0.015 * k, 0, 0, 0, [0.45, 0.7, 1.0]);
  } else {
    // custom look (legacy hairstyles, modelled for a 0.115 m head and scaled to fit)
    cap();
    const hg = new THREE.Group(); hg.scale.setScalar(k); head.add(hg);
    add(head, new THREE.SphereGeometry(R * 1.02, 24, 12, Math.PI * 0.15, Math.PI * 0.7, 0, Math.PI * 0.35), hair, 0, 0.012, -0.005, -0.1, Math.PI, 0); // bangs
    const hs = cfg.hairStyle;
    if (hs === 'long' || hs === 'braids' || hs === 'curly') add(head, new THREE.SphereGeometry(R * 1.05, 24, 16, 0, Math.PI * 2, Math.PI * 0.3, Math.PI * 0.45), hair, 0, -0.03, 0.03, 0, 0, 0, [1, 1.1, 1]);
    if (hs === 'long') add(hg, new THREE.CapsuleGeometry(0.1, 0.22, 6, 16), hair, 0, -0.2, 0.07, 0.1, 0, 0, [1.05, 1, 0.45]);
    if (hs === 'ponytail') { add(hg, new THREE.SphereGeometry(0.035, 12, 8), hair, 0, 0.05, 0.12); add(hg, new THREE.CapsuleGeometry(0.045, 0.2, 6, 12), hair, 0, -0.08, 0.16, 0.35, 0, 0); }
    if (hs === 'buns') for (const s of [-1, 1]) add(hg, new THREE.SphereGeometry(0.055, 16, 12), hair, s * 0.08, 0.09, 0.02);
    if (hs === 'braids') for (const s of [-1, 1]) for (let j = 0; j < 4; j++) add(hg, new THREE.SphereGeometry(0.03 - j * 0.003, 10, 8), hair, s * 0.1, -0.08 - j * 0.055, 0.02);
    if (hs === 'curly') for (let j = 0; j < 22; j++) { const a = (j / 22) * Math.PI * 2, y = -0.02 + Math.sin(j * 1.7) * 0.05; if (Math.sin(a) < -0.3) continue; add(head, new THREE.SphereGeometry(0.04, 10, 8), hair, Math.cos(a) * R * 1.05, y, Math.sin(a) * R * 1.05 + 0.02); }
  }
  // glasses: sturdy frames in front of the eyes, with temples back to the ears
  if (fam?.glasses) {
    const frame = std(fam.glasses === 'round' ? '#2b2b33' : '#161616', { roughness: 0.4 }), y = -0.004 * k, z = -(R + 0.006);
    for (const s of [-1, 1]) {
      const ring = add(head, new THREE.TorusGeometry(0.031 * k, 0.0055 * k, 8, 24), frame, s * 0.043 * k, y, z);
      if (fam.glasses === 'rect') ring.scale.set(1.25, 0.8, 1);
      // temple arm: from the outer edge of the lens back to the ear
      const a = new THREE.Vector3(s * 0.08 * k, y, z + 0.004), b = new THREE.Vector3(s * R * 0.99, y + 0.004 * k, 0.005);
      const arm = add(head, new THREE.BoxGeometry(0.006 * k, 0.006 * k, a.distanceTo(b)), frame, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
      arm.lookAt(head.localToWorld(b.clone()));
    }
    add(head, new THREE.CylinderGeometry(0.004 * k, 0.004 * k, 0.028 * k, 6), frame, 0, y + 0.006 * k, z, 0, 0, Math.PI / 2);
  }
  // beard, moustache and sideburns
  if (fam?.beard) {
    const bm = new THREE.MeshStandardMaterial({ map: beardTexture(fam.hair, fam.grey), roughness: 0.9 });
    add(head, new THREE.SphereGeometry(R * 1.04, 28, 14, Math.PI * 0.85, Math.PI * 1.3, Math.PI * 0.62, Math.PI * 0.32), bm, 0, -0.01, 0.01);
    add(head, new THREE.CapsuleGeometry(0.011 * k, 0.055 * k, 4, 8), bm, 0, -0.027 * k, -(R - 0.004), 0, 0, Math.PI / 2, [1, 1, 0.8]);
    for (const s of [-1, 1]) add(head, new THREE.BoxGeometry(0.018 * k, 0.06 * k, 0.04 * k), bm, s * (R * 0.95), -0.035 * k, 0.0);
  }
  // headwear for hero classes (scaled to the head)
  const hat = new THREE.Group(); hat.scale.setScalar(k); head.add(hat);
  const st = cfg.style;
  if (st === 'princess') { add(hat, new THREE.TorusGeometry(0.075, 0.01, 8, 24), gold, 0, 0.105, 0, Math.PI / 2 - 0.2, 0, 0); for (let j = -2; j <= 2; j++) add(hat, new THREE.ConeGeometry(0.012, 0.045, 6), gold, j * 0.028, 0.14, -0.06 + Math.abs(j) * 0.012); add(hat, new THREE.SphereGeometry(0.012, 8, 6), std('#ff4f9a', { roughness: 0.2 }), 0, 0.125, -0.075); }
  if (st === 'wizard') { add(hat, new THREE.CylinderGeometry(0.2, 0.2, 0.012, 32), accent, 0, 0.09, 0.01, -0.12, 0, 0); add(hat, new THREE.ConeGeometry(0.12, 0.32, 24), outfit, 0, 0.24, 0.03, -0.25, 0, 0); for (let j = 0; j < 3; j++) add(hat, new THREE.OctahedronGeometry(0.014), gold, -0.05 + j * 0.05, 0.16 + j * 0.05, -0.07 + j * 0.02); }
  if (st === 'fairy') for (let j = 0; j < 9; j++) { const a = (j / 9) * Math.PI * 2; add(hat, new THREE.SphereGeometry(0.018, 8, 6), std(['#ff7eb6', '#ffd54a', '#7fd4ff'][j % 3]), Math.cos(a) * 0.1, 0.085, Math.sin(a) * 0.1 + 0.01); }
  if (st === 'explorer') { add(hat, new THREE.CylinderGeometry(0.19, 0.19, 0.012, 32), std('#c8a26a'), 0, 0.085, 0.01, -0.1, 0, 0); add(hat, new THREE.CylinderGeometry(0.1, 0.115, 0.1, 24), std('#c8a26a'), 0, 0.13, 0.012, -0.1, 0, 0); add(hat, new THREE.CylinderGeometry(0.116, 0.116, 0.025, 24), std('#6b3f1f'), 0, 0.1, 0.01, -0.1, 0, 0); }
  if (st === 'knight') { add(hat, new THREE.TorusGeometry(0.1, 0.014, 8, 24), std('#b8bcc8', { metalness: 0.8, roughness: 0.35 }), 0, 0.075, 0.01, Math.PI / 2 - 0.2, 0, 0); add(hat, new THREE.ConeGeometry(0.03, 0.12, 8), outfit, 0, 0.16, 0.03, 0.4, 0, 0); }

  // ---- body (origin = floor under the head). Short neck, substantial limbs.
  const headBottom = 1.16 - R * (fam?.adult ? 1.06 : 1);
  const shoulderY = headBottom - 0.07, broad = fam?.broad ? 1.15 : 1;
  add(body, new THREE.CylinderGeometry(0.048, 0.055, 0.1, 14), skin, 0, headBottom - 0.02, 0.02);
  const legs = std(fam?.legs || '#34343c'), boots = std(fam?.boots || cfg.outfit, { roughness: 0.6 }), sole = std('#5a3a22');
  const legPair = (mat, top = 0.5) => { for (const s of [-1, 1]) { add(body, new THREE.CylinderGeometry(0.055, 0.05, top - 0.1, 14), mat, s * 0.062, 0.1 + (top - 0.1) / 2, 0.02); add(body, new THREE.CapsuleGeometry(0.056, 0.07, 6, 12), boots, s * 0.062, 0.1, 0.0, Math.PI / 2 - 0.2, 0, 0, [1, 1, 1]); add(body, new THREE.BoxGeometry(0.1, 0.022, 0.16), sole, s * 0.062, 0.02, -0.01); } };
  if (st === 'adventurer') {
    const floral = fam?.floral;
    const tunicMat = floral ? new THREE.MeshStandardMaterial({ map: floralTexture(cfg.outfit, fam.cape), roughness: 0.8 }) : outfit;
    const hem = floral ? 0.42 : 0.5, top = shoulderY + 0.02;
    add(body, new THREE.CylinderGeometry(0.12 * broad, 0.16 * broad, top - hem, 24), tunicMat, 0, (top + hem) / 2, 0.02);
    add(body, new THREE.TorusGeometry(0.16 * broad, 0.008, 6, 28), gold, 0, hem, 0.02, Math.PI / 2, 0, 0);
    const slope = Math.atan2(0.04 * broad, top - hem);
    for (const s of [-1, 1]) add(body, new THREE.BoxGeometry(0.012, top - hem - 0.04, 0.008), gold, s * 0.035, (top + hem) / 2 - 0.03, 0.02 - 0.142 * broad, -slope, 0, 0);
    if (floral) for (const s of [-1, 1]) add(body, new THREE.BoxGeometry(0.03, top - hem - 0.02, 0.01), std(fam.cape), s * 0.1, (top + hem) / 2, 0.02 - 0.12);
    const beltY = hem + (top - hem) * 0.52;
    add(body, new THREE.TorusGeometry(0.128 * broad, 0.016, 8, 28), leather, 0, beltY, 0.02, Math.PI / 2, 0, 0);
    add(body, new THREE.TorusGeometry(0.02, 0.006, 8, 16), gold, 0, beltY, 0.02 - 0.135 * broad);
    // short capelet with gold edge and a clasp
    const capeMat = std(fam?.cape || new THREE.Color(cfg.outfit).offsetHSL(0, 0, -0.08).getStyle(), { side: THREE.DoubleSide });
    add(body, new THREE.CylinderGeometry(0.06, 0.2 * broad, 0.17, 24, 1, true), capeMat, 0, shoulderY - 0.02, 0.02);
    add(body, new THREE.TorusGeometry(0.2 * broad, 0.007, 6, 28), gold, 0, shoulderY - 0.105, 0.02, Math.PI / 2, 0, 0);
    const cy = shoulderY + 0.02, cz = 0.02 - 0.085;
    if (fam?.clasp === 'crown') { add(body, new THREE.BoxGeometry(0.05, 0.02, 0.01), gold, 0, cy - 0.01, cz); for (let j = -1; j <= 1; j++) add(body, new THREE.ConeGeometry(0.008, 0.022, 4), gold, j * 0.018, cy + 0.01, cz); }
    else if (fam?.clasp === 'star') add(body, new THREE.OctahedronGeometry(0.024), gold, 0, cy, cz, 0, 0, 0, [1, 1, 0.35]);
    else if (fam?.clasp === 'book') add(body, new THREE.BoxGeometry(0.045, 0.03, 0.012), gold, 0, cy, cz);
    else add(body, new THREE.TorusGeometry(0.018, 0.006, 6, 16), gold, 0, cy, cz);
    if (fam?.pouch) { add(body, new THREE.BoxGeometry(0.06, 0.06, 0.04), leather, 0.12 * broad, beltY - 0.04, -0.03); add(body, new THREE.CylinderGeometry(0.014, 0.014, 0.1, 10), std('#efe3c4'), -0.13 * broad, beltY - 0.03, -0.01, 0.2, 0, 0.1); }
    legPair(legs, hem + 0.02);
  } else if (st === 'princess' || st === 'fairy') {
    add(body, new THREE.CylinderGeometry(0.11, 0.09, 0.24, 20), outfit, 0, shoulderY - 0.1, 0.02);
    add(body, new THREE.SphereGeometry(0.11, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), accent, 0, shoulderY, 0.02, 0, 0, 0, [1.25, 0.35, 0.9]);
    const len = st === 'fairy' ? 0.4 : 0.72, waist = shoulderY - 0.22;
    add(body, new THREE.CylinderGeometry(0.092, st === 'fairy' ? 0.22 : 0.3, len, 28, 1, true), outfit, 0, waist - len / 2, 0.02).material.side = THREE.DoubleSide;
    add(body, new THREE.TorusGeometry(0.093, 0.012, 8, 24), accent, 0, waist, 0.02, Math.PI / 2, 0, 0);
    if (st === 'fairy') { for (const s of [-1, 1]) add(body, new THREE.CylinderGeometry(0.045, 0.04, 0.36, 12), legs, s * 0.06, 0.2, 0.02); for (const s of [-1, 1]) add(body, new THREE.CapsuleGeometry(0.05, 0.06, 6, 10), boots, s * 0.06, 0.05, 0.0, Math.PI / 2 - 0.2, 0, 0); }
  } else if (st === 'wizard') {
    add(body, new THREE.CylinderGeometry(0.12, 0.26, shoulderY - 0.02, 24), outfit, 0, (shoulderY + 0.02) / 2, 0.02);
    add(body, new THREE.TorusGeometry(0.13, 0.018, 8, 24), gold, 0, shoulderY * 0.7, 0.02, Math.PI / 2, 0, 0);
    for (let j = 0; j < 6; j++) add(body, new THREE.OctahedronGeometry(0.016), gold, Math.sin(j * 2.1) * 0.15, 0.2 + j * 0.1, -0.16 + j * 0.012);
  } else {
    const knight = st === 'knight';
    const topM = knight ? std('#b8bcc8', { metalness: 0.75, roughness: 0.35 }) : outfit;
    add(body, new THREE.CylinderGeometry(0.12 * broad, 0.11, 0.34, 20), topM, 0, shoulderY - 0.15, 0.02);
    if (knight) { add(body, new THREE.BoxGeometry(0.1, 0.12, 0.01), outfit, 0, shoulderY - 0.13, -0.095); add(body, new THREE.PlaneGeometry(0.34, 0.8), std(cfg.outfit, { side: THREE.DoubleSide }), 0, shoulderY - 0.4, 0.13, 0.08, 0, 0); }
    else { add(body, new THREE.BoxGeometry(0.2, 0.26, 0.1), std('#8a5a2b'), 0, shoulderY - 0.15, 0.14); for (const s of [-1, 1]) add(body, new THREE.BoxGeometry(0.02, 0.3, 0.02), std('#6b3f1f'), s * 0.07, shoulderY - 0.11, -0.1); }
    add(body, new THREE.CylinderGeometry(0.115, 0.12, 0.14, 20), knight ? std('#6b6f7a', { metalness: 0.6, roughness: 0.4 }) : std('#6b4a2b'), 0, shoulderY - 0.37, 0.02);
    legPair(knight ? std('#9aa0ad', { metalness: 0.7, roughness: 0.4 }) : legs, shoulderY - 0.4);
  }
  if (st === 'fairy') {
    const wingMat = new THREE.MeshStandardMaterial({ color: '#bff3ff', transparent: true, opacity: 0.55, side: THREE.DoubleSide, emissive: '#6fd8ff', emissiveIntensity: 0.4, roughness: 0.2 });
    const wings = new THREE.Group(); wings.position.set(0, shoulderY - 0.07, 0.12); body.add(wings);
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.CircleGeometry(0.16, 24), wingMat); w.scale.set(1, 1.5, 1); w.position.set(s * 0.14, 0.06, 0); w.rotation.set(0, s * 0.5, s * -0.5); wings.add(w);
      const w2 = new THREE.Mesh(new THREE.CircleGeometry(0.1, 20), wingMat); w2.scale.set(1, 1.4, 1); w2.position.set(s * 0.1, -0.12, 0); w2.rotation.set(0, s * 0.5, s * 0.6); wings.add(w2);
    }
    root.userData.wings = wings;
  }
  if (st === 'wizard' || st === 'knight') {
    const cape = add(body, new THREE.CylinderGeometry(0.12, 0.3, shoulderY - 0.08, 20, 1, true, Math.PI * 0.6, Math.PI * 0.8), std(new THREE.Color(cfg.outfit).offsetHSL(0.05, 0, -0.15), { side: THREE.DoubleSide }), 0, (shoulderY - 0.08) / 2 + 0.06, 0.03);
    cape.rotation.y = Math.PI;
  }

  // arms: unit capsules re-aimed every frame from shoulder to hand
  const armR = 0.045;
  const sleeve = st === 'knight' ? std('#b8bcc8', { metalness: 0.75, roughness: 0.35 }) : st === 'princess' || st === 'fairy' ? skin : outfit;
  const arms = [-1, 1].map((s) => {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(armR, 1, 4, 10), sleeve); root.add(arm);
    const puff = st === 'princess' || st === 'fairy' ? add(body, new THREE.SphereGeometry(0.05, 12, 10), accent, s * 0.14 * broad, shoulderY - 0.01, 0.02) : null;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.047, 14, 10), skin); root.add(hand);
    return { side: s, arm, hand, puff };
  });
  if (st === 'wizard' || st === 'fairy') {
    const wand = new THREE.Group(); add(wand, new THREE.CylinderGeometry(0.006, 0.008, 0.25, 8), dark, 0, 0, -0.1, Math.PI / 2, 0, 0); add(wand, new THREE.OctahedronGeometry(0.022), new THREE.MeshStandardMaterial({ color: '#ffe066', emissive: '#ffcc00', emissiveIntensity: 0.8 }), 0, 0, -0.23);
    arms[1].hand.add(wand);
  }

  // merge each group's static parts per material: far fewer draw calls in mirrors
  for (const g of [head, body, hat]) mergeByMaterial(g);
  root.traverse((o) => { o.layers.set(MIRROR_LAYER); o.frustumCulled = false; });
  // worn items (helmet, crown) are positioned for a 0.115 m head; scale to fit
  const worn = new THREE.Group(); worn.scale.setScalar(k);
  return { root, body, head, hat, arms, cfg, shoulderY, shoulderX: 0.15 * broad, armR, worn, headR: R, adult: !!fam?.adult };
}

function mergeByMaterial(group) {
  const byMat = new Map();
  for (const m of [...group.children]) if (m.isMesh && !m.children.length) { if (!byMat.has(m.material)) byMat.set(m.material, []); byMat.get(m.material).push(m); }
  for (const [mat, list] of byMat) {
    if (list.length < 2) continue;
    const geos = list.map((m) => { m.updateMatrix(); const g = m.geometry.clone().applyMatrix4(m.matrix); for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); return g.index ? g.toNonIndexed() : g; });
    const merged = mergeGeometries(geos); if (!merged) continue;
    for (const m of list) { group.remove(m); m.geometry.dispose(); }
    group.add(new THREE.Mesh(merged, mat));
  }
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
    const s = this.scale, sy = a.body.scale.y, up = new THREE.Vector3(0, 1, 0);
    for (let k = 0; k < 2; k++) {
      const arm = a.arms[k], sh = new THREE.Vector3(arm.side * a.shoulderX * s, (a.shoulderY - 0.03) * sy, 0.02 * s).applyAxisAngle(up, this.yaw).add(a.body.position);
      let hand = hands[k];
      if (!hand) hand = new THREE.Vector3(arm.side * 0.21 * s, a.shoulderY * sy - 0.48 * s, 0).applyAxisAngle(up, this.yaw).add(a.body.position);
      const dir = hand.clone().sub(sh), len = Math.min(dir.length(), 0.72 * s);
      dir.normalize();
      const end = sh.clone().addScaledVector(dir, len);
      arm.arm.position.copy(sh).add(end).multiplyScalar(0.5);
      arm.arm.quaternion.setFromUnitVectors(up, dir);
      arm.arm.scale.set(s, Math.max(0.05, len - 2 * a.armR * s), s);
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
  cam.layers.enable(MIRROR_LAYER);
  scene.add(new THREE.HemisphereLight('#ffffff', '#886666', 2.2)); const dl = new THREE.DirectionalLight('#fff', 2); dl.position.set(1, 2, -2); scene.add(dl);
  let av = null, rig = null, angle = 0, t = 0;
  const headPos = new THREE.Vector3(0, 1.17, 0);
  const disposeAvatar = () => {
    if (!av) return;
    const resources = new Set();
    av.root.traverse((o) => {
      if (o.geometry) resources.add(o.geometry);
      for (const m of o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []) {
        resources.add(m); for (const v of Object.values(m)) if (v?.isTexture) resources.add(v);
      }
    });
    scene.remove(av.root); resources.forEach((resource) => resource.dispose()); av = null; rig = null;
  };
  const set = (cfg) => {
    disposeAvatar(); av = buildAvatar(cfg); rig = new AvatarRig(av); scene.add(av.root);
    // grown-ups stand taller in the preview
    headPos.y = av.adult ? 1.55 : 1.17;
    const f = headPos.y / 1.17; cam.position.set(0, 0.8 * f, -2.9 * f); cam.lookAt(0, 0.7 * f, 0);
  };
  const q = new THREE.Quaternion();
  r.setAnimationLoop(() => {
    t += 0.016; angle = Math.sin(t * 0.6) * 0.8;
    q.setFromEuler(new THREE.Euler(0, angle, 0));
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(q), right = new THREE.Vector3(1, 0, 0).applyQuaternion(q), f = headPos.y / 1.17;
    const wave = Math.sin(t * 3) * 0.12;
    rig?.update(headPos, q, 0, [headPos.clone().addScaledVector(right, -0.25 * f).add(new THREE.Vector3(0, -0.55 * f, 0)).addScaledVector(fwd, 0.1), headPos.clone().addScaledVector(right, 0.3 * f).add(new THREE.Vector3(0, (0.05 + wave) * f, 0)).addScaledVector(fwd, 0.1)], 1, t);
    r.render(scene, cam);
  });
  return { set, dispose() { r.setAnimationLoop(null); disposeAvatar(); r.dispose(); } };
}
