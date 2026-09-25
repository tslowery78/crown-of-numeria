// Interactive props for Crown of Numeria: things to pick up and throw (with
// simple physics), mini-games (knight bowling, apple basket, bubbles, chiming
// crystals, a wearable helmet) and friendly creatures (cat, owl, dragon, birds).
import * as THREE from 'three';

const V = () => new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });
const canvasTex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };

// ------------------------------------------------------------ prop models
const MODELS = {
  ball() {
    const tex = canvasTex(256, 128, (g, w, h) => { const cols = ['#ff4f6d', '#ffd54a', '#4fc3ff', '#7dff6b']; for (let k = 0; k < 8; k++) { g.fillStyle = cols[k % 4]; g.fillRect((k * w) / 8, 0, w / 8 + 1, h); } g.fillStyle = '#fff'; g.beginPath(); g.arc(w / 4, h / 2, 16, 0, 7); g.fill(); });
    return { mesh: new THREE.Mesh(new THREE.SphereGeometry(0.08, 24, 16), std('#fff', { map: tex, roughness: 0.35 })), r: 0.08, bounce: 0.78, mat: 'ball', roll: true };
  },
  bowling() { return { mesh: new THREE.Mesh(new THREE.SphereGeometry(0.075, 24, 16), std('#3a2a6a', { roughness: 0.15, metalness: 0.2 })), r: 0.075, bounce: 0.2, mat: 'heavy', roll: true, mass: 4 }; },
  duck() {
    const g = new THREE.Group(), y = std('#ffd21f', { roughness: 0.3 });
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.06, 20, 14), y); b.scale.set(1, 0.8, 1.25); g.add(b);
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 12), y); h.position.set(0, 0.055, -0.04); g.add(h);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.04, 10), std('#ff8a1f')); beak.rotation.x = -Math.PI / 2; beak.position.set(0, 0.05, -0.085); g.add(beak);
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), std('#111')); e.position.set(s * 0.022, 0.068, -0.07); g.add(e); }
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.04, 8), y); tail.rotation.x = -0.9; tail.position.set(0, 0.03, 0.075); g.add(tail);
    return { mesh: g, r: 0.065, h: 0.045, bounce: 0.5, mat: 'duck' };
  },
  apple() {
    const g = new THREE.Group(); const a = new THREE.Mesh(new THREE.SphereGeometry(0.045, 18, 14), std('#d8262f', { roughness: 0.35 })); a.scale.y = 0.9; g.add(a);
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.004, 0.025, 6), std('#5a3a1a')); st.position.y = 0.045; g.add(st);
    const lf = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), std('#3fa34a')); lf.scale.set(1.6, 0.3, 0.8); lf.position.set(0.013, 0.05, 0); g.add(lf);
    return { mesh: g, r: 0.045, bounce: 0.35, mat: 'soft', roll: true };
  },
  goblet() {
    const g = new THREE.Group(), m = std('#e0b23a', { metalness: 0.85, roughness: 0.25 });
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.02, 0.06, 16, 1, true), m); cup.material.side = THREE.DoubleSide; cup.position.y = 0.03; g.add(cup);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.05, 8), m); stem.position.y = -0.025; g.add(stem);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.006, 16), m); base.position.y = -0.05; g.add(base);
    return { mesh: g, r: 0.05, h: 0.053, bounce: 0.3, mat: 'metal' };
  },
  book(color = '#8e2430') {
    const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.035, 0.2), std(color)));
    const pages = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.028, 0.19), std('#f4ecd8')); pages.position.x = 0.006; g.add(pages);
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.02), std('#ffd54a', { metalness: 0.6, roughness: 0.3 })); star.scale.y = 0.2; star.position.y = 0.018; g.add(star);
    return { mesh: g, r: 0.07, h: 0.018, bounce: 0.15, mat: 'wood' };
  },
  plane() {
    const geo = new THREE.BufferGeometry(); const p = [0, 0, -0.14, -0.1, 0, 0.1, 0, -0.005, 0.1, 0, 0, -0.14, 0, -0.005, 0.1, 0.1, 0, 0.1, 0, 0, -0.14, 0, -0.04, 0.1, 0, -0.005, 0.1];
    geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); geo.computeVertexNormals();
    return { mesh: new THREE.Mesh(geo, std('#fdfbf3', { side: THREE.DoubleSide })), r: 0.06, h: 0.01, bounce: 0.1, mat: 'paper', glide: true, gs: 0.9 };
  },
  helmet() {
    const g = new THREE.Group(), m = std('#b8bcc8', { metalness: 0.85, roughness: 0.3 });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), m); dome.material.side = THREE.DoubleSide; g.add(dome);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.012, 8, 32), m); rim.rotation.x = Math.PI / 2; g.add(rim);
    const plume = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.16, 10), std('#e84a8a')); plume.position.set(0, 0.17, 0.03); plume.rotation.x = 0.4; g.add(plume);
    return { mesh: g, r: 0.12, h: 0.012, bounce: 0.3, mat: 'metal', wearable: { y: 0.07 } };
  },
  crystal(color = '#8fdcff') {
    const m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.9 });
    const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.06), m); mesh.scale.y = 1.6;
    return { mesh, r: 0.06, h: 0.09, bounce: 0.4, mat: 'glass', crystal: true };
  },
  teddy() {
    const g = new THREE.Group(), fur = std('#a86b3c', { roughness: 0.95 }), light = std('#e6b98a', { roughness: 0.95 });
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), fur); b.scale.y = 1.15; g.add(b);
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), fur); h.position.y = 0.09; g.add(h);
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), fur); e.position.set(s * 0.035, 0.13, 0); g.add(e); const eye = new THREE.Mesh(new THREE.SphereGeometry(0.007, 8, 6), std('#111')); eye.position.set(s * 0.018, 0.1, -0.045); g.add(eye); const arm = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), fur); arm.position.set(s * 0.06, 0.02, -0.01); g.add(arm); const leg = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 8), fur); leg.position.set(s * 0.035, -0.06, -0.02); g.add(leg); }
    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), light); snout.position.set(0, 0.08, -0.045); g.add(snout);
    return { mesh: g, r: 0.08, h: 0.085, bounce: 0.2, mat: 'soft' };
  },
};

// ------------------------------------------------------------ creatures
function makeCat() {
  const g = new THREE.Group(), fur = std('#e8903a', { roughness: 0.9 }), cream = std('#fbe3c4', { roughness: 0.9 });
  const cushion = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.07, 24), std('#7b3fa0', { roughness: 0.9 })); cushion.position.y = 0.035; g.add(cushion);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 14), fur); body.scale.set(1, 0.7, 1.4); body.position.y = 0.13; g.add(body);
  const head = new THREE.Group(); head.position.set(0, 0.17, -0.13); g.add(head);
  head.add(new THREE.Mesh(new THREE.SphereGeometry(0.065, 20, 14), fur));
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), cream); muzzle.position.set(0, -0.02, -0.05); muzzle.scale.set(1.3, 0.8, 0.8); head.add(muzzle);
  for (const s of [-1, 1]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.045, 4), fur); ear.position.set(s * 0.035, 0.06, 0); ear.rotation.z = -s * 0.25; head.add(ear); }
  const eyes = [-1, 1].map((s) => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), std('#2a8a3a', { roughness: 0.2 })); e.position.set(s * 0.025, 0.012, -0.056); head.add(e); return e; });
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.007, 8, 6), std('#e87a8a')); nose.position.set(0, -0.005, -0.068); head.add(nose);
  const tail = new THREE.Group(); tail.position.set(0, 0.1, 0.13); g.add(tail);
  for (let k = 0; k < 6; k++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), fur); s.position.set(Math.sin(k * 0.5) * 0.06, 0, k * 0.03); tail.add(s); }
  return { group: g, head, eyes, tail, body };
}
function makeOwl() {
  const g = new THREE.Group(), feather = std('#8a6a4a', { roughness: 0.95 }), belly = std('#e6d3b3', { roughness: 0.95 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.09, 18, 14), feather); body.scale.set(1, 1.25, 0.9); body.position.y = 0.11; g.add(body);
  const b2 = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), belly); b2.scale.set(1, 1.2, 0.6); b2.position.set(0, 0.1, -0.04); g.add(b2);
  const head = new THREE.Group(); head.position.y = 0.25; g.add(head);
  head.add(new THREE.Mesh(new THREE.SphereGeometry(0.08, 18, 14), feather));
  const lids = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.SphereGeometry(0.032, 14, 10), std('#fff8e0')); w.position.set(s * 0.036, 0.005, -0.06); head.add(w);
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), std('#111', { roughness: 0.1 })); p.position.set(s * 0.036, 0.005, -0.087); head.add(p);
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.034, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), feather); lid.position.copy(w.position); lid.rotation.x = -Math.PI / 2; lid.scale.y = 0.05; head.add(lid); lids.push(lid);
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.05, 6), feather); tuft.position.set(s * 0.05, 0.075, 0); tuft.rotation.z = -s * 0.4; head.add(tuft);
  }
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.03, 6), std('#e8a63a')); beak.rotation.x = Math.PI / 2 + 0.3; beak.position.set(0, -0.02, -0.08); head.add(beak);
  return { group: g, head, lids };
}
function makeDragon() {
  const g = new THREE.Group(), scale = std('#7b4fd6', { roughness: 0.55 }), belly = std('#ffd27a', { roughness: 0.6 }), horn = std('#fff4d6');
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.9, 8, 16), scale); body.rotation.x = Math.PI / 2; g.add(body);
  const bel = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.7, 6, 12), belly); bel.rotation.x = Math.PI / 2; bel.position.y = -0.12; g.add(bel);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 0.6, 12), scale); neck.position.set(0, 0.25, -0.7); neck.rotation.x = -0.9; g.add(neck);
  const head = new THREE.Group(); head.position.set(0, 0.5, -0.95); g.add(head);
  head.add(new THREE.Mesh(new THREE.SphereGeometry(0.22, 18, 14), scale));
  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), scale); snout.scale.set(0.9, 0.7, 1.3); snout.position.set(0, -0.05, -0.2); head.add(snout);
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), std('#fff')); e.position.set(s * 0.1, 0.07, -0.14); head.add(e);
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), std('#1a1a2a')); p.position.set(s * 0.11, 0.07, -0.19); head.add(p);
    const h = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.2, 8), horn); h.position.set(s * 0.1, 0.22, 0.05); h.rotation.x = 0.5; head.add(h);
  }
  const wings = [-1, 1].map((s) => {
    const pivot = new THREE.Group(); pivot.position.set(s * 0.25, 0.2, -0.1); g.add(pivot);
    const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.lineTo(1.3, 0.3); shape.lineTo(1.1, -0.2); shape.lineTo(0.8, -0.1); shape.lineTo(0.6, -0.5); shape.lineTo(0.3, -0.3); shape.lineTo(0, -0.6); shape.closePath();
    const w = new THREE.Mesh(new THREE.ShapeGeometry(shape), std('#a98cff', { side: THREE.DoubleSide, roughness: 0.7 })); w.rotation.x = -Math.PI / 2; w.scale.x = s; pivot.add(w);
    return pivot;
  });
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.2, 1.4, 12), scale); tail.rotation.x = Math.PI / 2 + 0.15; tail.position.set(0, -0.05, 1.2); g.add(tail);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.25, 4), belly); tip.position.set(0, -0.15, 1.95); tip.rotation.x = Math.PI / 2; g.add(tip);
  for (let k = 0; k < 5; k++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.15, 6), horn); sp.position.set(0, 0.35, -0.4 + k * 0.25); g.add(sp); }
  return { group: g, wings, head };
}
function makeBird() {
  const g = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color: '#333', side: THREE.DoubleSide });
  const wings = [-1, 1].map((s) => { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.1, s * 0.45, 0, 0.05, 0, 0, 0.15], 3)); const w = new THREE.Mesh(geo, m); g.add(w); return w; });
  return { group: g, wings };
}

// ------------------------------------------------------------ Props system
export class Props {
  constructor(game) {
    this.g = game; this.bodies = []; this.pins = []; this.bubbles = []; this.surfaces = [];
    this.floatSigns = [];
  }

  add(kind, floor, pos, arg) {
    const d = MODELS[kind](arg), g = this.g;
    d.mesh.traverse((o) => { if (o.isMesh) o.userData.grabBody = d; });
    const b = Object.assign(d, { kind, floor, home: pos.clone(), homeQ: new THREE.Quaternion(), vel: V(), ang: V(), held: null, outside: false, rest: 0, gs: d.gs ?? 1, mass: d.mass ?? 1, cool: 0 });
    b.mesh.position.copy(pos);
    if (kind === 'plane') b.mesh.rotation.y = Math.random() * 6;
    b.homeQ.copy(b.mesh.quaternion);
    g.world.add(b.mesh); this.bodies.push(b);
    return b;
  }
  surface(floor, x0, x1, z0, z1, y) { this.surfaces.push({ floor, x0, x1, z0, z1, y }); }

  // Called from Game.buildWorld once rooms exist.
  build(ctx) {
    const { W, D, fy, TOP } = ctx, hw = W / 2, hd = D / 2, g = this.g;
    const at = (x, y, z) => new THREE.Vector3(x, y, z);
    this.ctx = ctx;
    // Floor 1: Entrance Hall — ball, rubber duck, teddy, sleepy cat
    this.add('ball', 0, at(-0.45, 0.08, 0.55));
    this.add('duck', 0, at(0.35, 0.05, -0.5));
    this.add('teddy', 0, at(-0.3, 0.07, -0.55));
    this.cat = makeCat(); this.cat.group.position.set(-hw + 0.3, 0, 0.45); this.cat.group.rotation.y = -Math.PI / 2 + 0.4; g.world.add(this.cat.group);
    this.cat.state = { purr: 0, cool: 0 };
    // Floor 2: Great Hall — apples on the table, basket in the NW corner, goblets
    const y1 = fy(1), tx = hw - 0.3, tlen = Math.max(0.6, Math.min(2, D - 1.4));
    this.surface(1, tx - 0.25, tx + 0.25, -0.35 - tlen / 2, -0.35 + tlen / 2, y1 + 0.77);
    this.apples = [0, 1, 2].map((k) => this.add('apple', 1, at(tx - 0.05, y1 + 0.82, -0.35 - tlen / 2 + 0.15 + k * 0.15)));
    this.add('goblet', 1, at(tx + 0.1, y1 + 0.83, -0.35 + tlen / 2 - 0.15));
    this.basket = this.makeBasket(); this.basket.position.set(-hw + 0.3, y1, -hd + 0.32); g.world.add(this.basket);
    this.basketCount = 0; this.basketSign = null;
    // Floor 3: Royal Library — books and paper airplanes; the owl on a shelf
    const y2 = fy(2);
    ['#8e2430', '#1f4e8c', '#2e7d32'].forEach((c, k) => this.add('book', 2, at(-hw + 0.5, y2 + 0.02 + k * 0.036, -hd + 0.35), c));
    this.add('plane', 2, at(hw - 0.5, y2 + 0.02, -hd + 0.35)); this.add('plane', 2, at(hw - 0.5, y2 + 0.02, -hd + 0.55));
    this.owl = makeOwl(); this.owl.group.position.set(hw - 0.15, y2 + 2.42, -0.3); g.world.add(this.owl.group);
    this.owl.state = { cool: 3, blink: 2 };
    // Floor 4: Knights' Armory — knight bowling + a helmet to try on
    const y3 = fy(3);
    this.add('helmet', 3, at(-hw + 0.35, y3 + 0.015, 0.15));
    this.add('bowling', 3, at(-0.35, y3 + 0.075, 0.25));
    this.add('ball', 3, at(0.1, y3 + 0.08, -0.45));
    this.makePins(3, hw - 0.5, hd - 0.8);
    // Floor 5: Crystal Chamber — chiming crystals + bubble cauldron
    const y4 = fy(4);
    [['#8fdcff', 72], ['#d49bff', 76], ['#ff9ad1', 79]].forEach(([c, n], k) => { const b = this.add('crystal', 4, at(-0.45 + k * 0.45, y4 + 0.09, -0.55), c); b.note = n; });
    this.cauldron = this.makeCauldron(); this.cauldron.position.set(-hw + 0.35, y4, hd - 0.35); g.world.add(this.cauldron);
    this.bubbleT = 0;
    // Tower Top — balls to throw off the tower
    this.add('ball', TOP, at(0.5, fy(TOP) + 0.08, 0.4));
    this.add('duck', TOP, at(-0.5, fy(TOP) + 0.05, 0.4));
    // outside: the dragon and bird flocks
    this.dragon = makeDragon(); g.world.add(this.dragon.group); this.dragon.state = { a: 0, cool: 10, perch: false };
    this.birds = [];
    for (let f = 0; f < 2; f++) for (let k = 0; k < 5; k++) { const b = makeBird(); b.flock = f; b.k = k; g.world.add(b.group); this.birds.push(b); }
  }

  makeBasket() {
    const grp = new THREE.Group();
    const weave = canvasTex(256, 64, (c, w, h) => { c.fillStyle = '#b07a3a'; c.fillRect(0, 0, w, h); c.strokeStyle = '#7a4f22'; c.lineWidth = 3; for (let x = 0; x < w; x += 16) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); } for (let y = 0; y < h; y += 10) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); } });
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.2, 24, 1, true), std('#fff', { map: weave, side: THREE.DoubleSide, roughness: 0.9 })); wall.position.y = 0.1; grp.add(wall);
    const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.13, 24), std('#8a5a2a')); bottom.rotation.x = -Math.PI / 2; bottom.position.y = 0.01; grp.add(bottom);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.012, 8, 32), std('#7a4f22')); rim.rotation.x = Math.PI / 2; rim.position.y = 0.2; grp.add(rim);
    return grp;
  }
  makeCauldron() {
    const grp = new THREE.Group(), iron = std('#2a2a33', { metalness: 0.6, roughness: 0.4 });
    const pot = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 16, 0, Math.PI * 2, Math.PI * 0.3, Math.PI * 0.7), iron); pot.material.side = THREE.DoubleSide; pot.position.y = 0.2; grp.add(pot);
    const brew = new THREE.Mesh(new THREE.CircleGeometry(0.16, 24), new THREE.MeshStandardMaterial({ color: '#2f9a4a', emissive: '#1f7a3a', emissiveIntensity: 0.9, roughness: 0.2 })); brew.rotation.x = -Math.PI / 2; brew.position.y = 0.3; grp.add(brew);
    for (let k = 0; k < 3; k++) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.1, 6), iron); const a = (k / 3) * Math.PI * 2; leg.position.set(Math.cos(a) * 0.12, 0.04, Math.sin(a) * 0.12); grp.add(leg); }
    return grp;
  }
  makePins(floor, cx, cz) {
    const y0 = this.ctx.fy(floor);
    const pinMat = std('#fbf7ee', { roughness: 0.35 }), stripe = std('#d63b3b', { roughness: 0.35 });
    const pts = [new THREE.Vector2(0, 0), new THREE.Vector2(0.025, 0.005), new THREE.Vector2(0.034, 0.06), new THREE.Vector2(0.02, 0.13), new THREE.Vector2(0.016, 0.15), new THREE.Vector2(0.022, 0.185), new THREE.Vector2(0.012, 0.215), new THREE.Vector2(0, 0.22)];
    const geo = new THREE.LatheGeometry(pts, 16);
    let n = 0;
    for (let row = 0; row < 4; row++) for (let j = 0; j <= row; j++) {
      const grp = new THREE.Group(); grp.add(new THREE.Mesh(geo, pinMat));
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.0165, 0.0165, 0.012, 16), stripe); s.position.y = 0.15; grp.add(s);
      const home = new THREE.Vector3(cx + (j - row / 2) * 0.11, y0, cz + row * 0.095);
      grp.position.copy(home); this.g.world.add(grp);
      this.pins.push({ grp, home, down: false, t: 0, axis: V(), slide: V(), floor, id: n++ });
    }
    this.pinRound = { active: false, t: 0 };
  }

  // ------------------------------------------------------------ grabbing
  nearest(point, reach) {
    let best = null, bd = reach;
    for (const b of this.bodies) {
      if (b.held) continue;
      const wp = b.worn ? b.mesh.getWorldPosition(V()) : b.mesh.position;
      const d = wp.distanceTo(point) - b.r;
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }
  grab(b, holder) {
    if (b.worn) this.unwear(b);
    if (b.inBasket) this.basketCount = Math.max(0, this.basketCount - 1);
    b.held = holder; b.outside = false; b.inBasket = false;
    holder.updateWorldMatrix(true, false);
    b.rel = holder.worldToLocal(b.mesh.position.clone());
    if (b.rel.length() > 0.12) b.rel.setLength(0.06);
    b.relQ = holder.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(b.mesh.quaternion);
    b.hist = [];
    this.g.audio?.pickup(b.mesh.position);
  }
  release(b) {
    const h = b.hist || [];
    b.held = null;
    if (h.length >= 2) {
      const a = h[0], z = h[h.length - 1], dt = Math.max(0.016, z.t - a.t);
      b.vel.copy(z.p).sub(a.p).divideScalar(dt).multiplyScalar(1.25);
      if (b.vel.length() > 12) b.vel.setLength(12);
    } else b.vel.set(0, 0, 0);
    const sp = b.vel.length();
    b.ang.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(sp * 3);
    b.floor = this.g.level; b.rest = 0;
    if (sp > 2) this.g.audio?.whoosh(b.mesh.position, sp);
    // put a wearable on if released at the head
    if (b.wearable && sp < 2.5 && b.mesh.position.distanceTo(this.g.headPos()) < 0.28) this.wear(b);
  }
  wear(b) {
    const av = this.g.avatar; if (!av) return;
    b.worn = true; b.vel.set(0, 0, 0);
    av.hat.visible = false;
    av.worn.add(b.mesh); b.mesh.position.set(0, b.wearable.y / 1, 0.01); b.mesh.quaternion.identity(); b.mesh.scale.setScalar(1 / 1);
    b.mesh.traverse((o) => o.layers.set(3));
    this.g.floatText('Look in the mirror!', this.g.headPos().add(new THREE.Vector3(0, 0.3, 0)));
    this.g.audio?.cueScore();
  }
  unwear(b) {
    const av = this.g.avatar;
    const wp = b.mesh.getWorldPosition(V());
    av.worn.remove(b.mesh); this.g.world.add(b.mesh); b.mesh.position.copy(wp); b.mesh.scale.setScalar(1);
    b.mesh.traverse((o) => o.layers.set(0));
    b.worn = false; if (!av.worn.children.length) av.hat.visible = true;
  }
  respawn(b) {
    b.mesh.position.copy(b.home); b.mesh.quaternion.copy(b.homeQ);
    b.vel.set(0, 0, 0); b.ang.set(0, 0, 0); b.outside = false; b.rest = 0; b.inBasket = false;
    b.floor = this.floorOfHome(b);
    this.g.burst(b.home.clone().add(new THREE.Vector3(0, 0.1, 0)), 16);
  }
  floorOfHome(b) { return Math.round((b.home.y - 0.05) / this.ctx.FH); }

  // ------------------------------------------------------------ simulation
  update(dt, t, head, tips) {
    const ctx = this.ctx; if (!ctx) return;
    const g = this.g;
    for (const b of this.bodies) {
      b.cool = Math.max(0, b.cool - dt);
      if (b.worn) continue;
      if (b.held) {
        const q = b.held.getWorldQuaternion(new THREE.Quaternion());
        b.mesh.position.copy(b.held.localToWorld(b.rel.clone()));
        b.mesh.quaternion.copy(q).multiply(b.relQ);
        b.hist.push({ p: b.mesh.position.clone(), t }); while (b.hist.length > 6) b.hist.shift();
        if (b.hist.length >= 2) { const a = b.hist[b.hist.length - 2]; b.vel.copy(b.mesh.position).sub(a.p).divideScalar(Math.max(0.008, t - a.t)); }
        continue;
      }
      if (b.inBasket) continue;
      const active = b.floor === g.level || b.outside || b.vel.lengthSq() > 0.01;
      if (!active) continue;
      for (let s = 0; s < 2; s++) this.step(b, dt / 2);
    }
    this.collidePairs(g.level);
    this.updatePins(dt, tips);
    this.updateBasket(dt);
    this.updateBubbles(dt, t, tips);
    this.updateCreatures(dt, t, head, tips);
    this.touchCrystals(tips);
    for (const s of this.floatSigns) { s.t += dt; s.mesh.position.y += dt * 0.12; s.mesh.material.opacity = s.t < s.life - 0.6 ? 1 : Math.max(0, (s.life - s.t) / 0.6); if (s.t > s.life) { g.world.remove(s.mesh); s.mesh.material.map?.dispose(); } }
    this.floatSigns = this.floatSigns.filter((s) => s.t <= s.life);
  }

  // One integration step with collisions against the room box of the body's floor.
  step(b, dt) {
    const { W, D, fy, CEIL, FLOORS, TOP } = this.ctx, hw = W / 2, hd = D / 2, p = b.mesh.position, v = b.vel, r = b.r;
    const y0 = fy(b.floor), roof = b.floor === TOP, fl = FLOORS[b.floor];
    const prevY = p.y;
    v.y -= 9.8 * b.gs * dt;
    if (b.glide) { // paper airplane: lift from forward speed, nose follows velocity
      const sp = Math.hypot(v.x, v.z);
      v.y += Math.min(0.95 * 9.8 * b.gs, 1.3 * sp * sp) * dt;
      v.multiplyScalar(1 - 0.35 * dt);
      if (v.lengthSq() > 0.05) { const tgt = p.clone().add(v); const m = new THREE.Matrix4().lookAt(p, tgt, UP); b.mesh.quaternion.slerp(new THREE.Quaternion().setFromRotationMatrix(m), Math.min(1, dt * 8)); }
    } else v.multiplyScalar(1 - 0.08 * dt);
    p.addScaledVector(v, dt);
    if (!b.glide && b.ang.lengthSq() > 1e-4) { const w = b.ang.length(); b.mesh.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(b.ang.clone().divideScalar(w), w * dt)); }
    const hit = (speed) => { if (speed > 0.35 && b.cool === 0) { this.g.audio?.impact(p, b.mat, speed); b.cool = 0.08; if (b.crystal) this.chime(b); } };
    if (b.outside) {
      if (p.y < (b.h ?? r)) { const s = -v.y; p.y = b.h ?? r; v.y = s * 0.3; v.x *= 0.6; v.z *= 0.6; b.ang.multiplyScalar(0.6); hit(s); }
      b.rest += dt;
      if (b.rest > 5 || p.y < -2) this.respawn(b);
      return;
    }
    // walls, with openings at windows (and above the parapet on the roof)
    const open = (side, u) => roof ? p.y > y0 + 1.0 + r : (fl.windows || '').includes(side) && (this.ctx.winSpots?.[side] || [0]).some((c) => Math.abs(u - c) < 0.45 - r * 0.5) && p.y > y0 + 0.8 + r && p.y < y0 + 2.3 - r;
    const wall = (axis, sign, side) => {
      const lim = (axis === 'x' ? hw : hd) - r;
      if (sign * p[axis] > lim) {
        const u = axis === 'x' ? p.z : p.x;
        if (open(side, u)) { if (sign * p[axis] > lim + 0.45) { b.outside = true; b.rest = 0; } return; }
        p[axis] = sign * lim; const s = Math.abs(v[axis]); v[axis] = -v[axis] * b.bounce; hit(s);
      }
    };
    wall('x', 1, 'E'); wall('x', -1, 'W'); wall('z', 1, 'S'); wall('z', -1, 'N');
    // ceiling
    if (!roof && p.y > y0 + CEIL - r) { p.y = y0 + CEIL - r; const s = v.y; v.y = -Math.abs(v.y) * b.bounce; hit(s); }
    // floor and surfaces (tables, lids)
    const hh = b.h ?? r;
    let ground = y0;
    for (const s of this.surfaces) if (s.floor === b.floor && p.x > s.x0 && p.x < s.x1 && p.z > s.z0 && p.z < s.z1 && prevY - hh >= s.y - 0.03) ground = Math.max(ground, s.y);
    if (p.y < ground + hh) {
      p.y = ground + hh;
      const s = -v.y;
      if (s > 0.25) { v.y = s * b.bounce; hit(s); } else v.y = 0;
      const k = Math.exp(-(b.roll ? 0.7 : b.glide ? 10 : 7) * dt);
      v.x *= k; v.z *= k;
      if (b.roll) { const h = new THREE.Vector3(v.x, 0, v.z); b.ang.crossVectors(UP, h).divideScalar(r); } else b.ang.multiplyScalar(0.9);
      if (v.lengthSq() < 0.0004) { v.set(0, 0, 0); b.ang.set(0, 0, 0); }
    }
  }

  collidePairs(level) {
    const list = this.bodies.filter((b) => !b.worn && !b.inBasket && (b.floor === level || b.held));
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      if (a.held && b.held) continue;
      const d = b.mesh.position.clone().sub(a.mesh.position), dist = d.length(), min = a.r + b.r;
      if (dist >= min || dist < 1e-5) continue;
      const n = d.divideScalar(dist), ma = a.held ? Infinity : a.mass, mb = b.held ? Infinity : b.mass;
      const pen = min - dist;
      if (!a.held) a.mesh.position.addScaledVector(n, -pen * (b.held ? 1 : mb / (ma + mb)));
      if (!b.held) b.mesh.position.addScaledVector(n, pen * (a.held ? 1 : ma / (ma + mb)));
      const rel = b.vel.clone().sub(a.vel).dot(n);
      if (rel >= 0) continue;
      const e = Math.min(a.bounce, b.bounce) + 0.2;
      const inv = (a.held ? 0 : 1 / ma) + (b.held ? 0 : 1 / mb);
      const jimp = (-(1 + e) * rel) / inv;
      if (!a.held) a.vel.addScaledVector(n, -jimp / ma);
      if (!b.held) b.vel.addScaledVector(n, jimp / mb);
      if (-rel > 0.4) this.g.audio?.impact(a.mesh.position, a.mass > b.mass ? a.mat : b.mat, -rel);
    }
  }

  // ------------------------------------------------------------ knight bowling
  updatePins(dt, tips) {
    if (!this.pins.length) return;
    const level = this.g.level;
    for (const pin of this.pins) {
      if (pin.floor !== level) continue;
      const c = pin.grp.position.clone().add(new THREE.Vector3(0, 0.1, 0));
      if (!pin.down) {
        for (const b of this.bodies) {
          if (b.worn || b.floor !== pin.floor) continue;
          const d = b.mesh.position.clone().sub(c); d.y *= 0.5;
          if (d.length() < b.r + 0.04 && (b.vel.length() > 0.5 || b.held)) { this.knock(pin, b.vel.clone().setY(0)); b.vel.multiplyScalar(0.85); }
        }
        for (const tp of tips) if (tp.pos.distanceTo(c) < 0.09 && tp.vel.length() > 0.8) this.knock(pin, tp.vel.clone().setY(0));
      } else if (pin.t < 1) {
        pin.t = Math.min(1, pin.t + dt / 0.35);
        const e = pin.t * pin.t;
        pin.grp.quaternion.setFromAxisAngle(pin.axis, e * Math.PI / 2);
        pin.grp.position.copy(pin.home).addScaledVector(pin.slide, e);
        if (pin.t >= 1) {
          const dir = pin.slide.clone().normalize(), mid = pin.home.clone().addScaledVector(dir, 0.1), tip = pin.home.clone().addScaledVector(dir, 0.2);
          for (const o of this.pins) if (!o.down && (o.home.distanceTo(mid) < 0.08 || o.home.distanceTo(tip) < 0.09) && Math.random() < 0.85) this.knock(o, dir.clone());
        }
      }
    }
    const R = this.pinRound;
    if (R.active) {
      R.t += dt;
      if (R.t > 2.5 && !R.announced) {
        R.announced = true;
        const n = this.pins.filter((p) => p.down).length, pos = this.pins[0].home.clone().add(new THREE.Vector3(0, 0.6, 0));
        if (n === 10) { this.g.floatText('STRIKE! All 10 pins!', pos, '#ffd54a', 3); this.g.audio?.cueStrike(); this.g.burst(pos, 80); }
        else { this.g.floatText(`${n} down! 10 − ${n} = ${10 - n} standing`, pos, '#ffffff', 3.5); this.g.audio?.cueScore(); }
      }
      if (R.t > 6.5) { for (const p of this.pins) { p.down = false; p.t = 0; p.grp.position.copy(p.home); p.grp.quaternion.identity(); } R.active = false; R.t = 0; R.announced = false; this.g.burst(this.pins[4].home.clone().add(new THREE.Vector3(0, 0.2, 0)), 30); }
    }
  }
  knock(pin, dir) {
    if (pin.down || this.pinRound.t > 2.5) return;
    if (dir.lengthSq() < 1e-4) dir.set(Math.random() - 0.5, 0, Math.random() - 0.5);
    dir.normalize().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 0, (Math.random() - 0.5) * 0.6)).normalize();
    pin.down = true; pin.t = 0; pin.axis.crossVectors(UP, dir).normalize(); pin.slide.copy(dir).multiplyScalar(0.06);
    this.g.audio?.pinHit(pin.grp.position);
    if (!this.pinRound.active) { this.pinRound.active = true; this.pinRound.t = 0; this.pinRound.announced = false; }
  }

  // ------------------------------------------------------------ apple basket
  updateBasket() {
    if (!this.basket) return;
    const c = this.basket.position;
    for (const a of this.apples) {
      if (a.held || a.inBasket) continue;
      const dx = a.mesh.position.x - c.x, dz = a.mesh.position.z - c.z, y = a.mesh.position.y - c.y;
      if (Math.hypot(dx, dz) < 0.15 && y < 0.24 && y > 0 && a.vel.y < 0.5) {
        a.inBasket = true; a.vel.set(0, 0, 0);
        a.mesh.position.set(c.x + (Math.random() - 0.5) * 0.12, c.y + 0.06 + this.basketCount * 0.02, c.z + (Math.random() - 0.5) * 0.12);
        this.basketCount++;
        const pos = c.clone().add(new THREE.Vector3(0, 0.55, 0));
        this.g.audio?.cueScore(); this.g.burst(c.clone().add(new THREE.Vector3(0, 0.25, 0)), 25);
        if (this.basketCount >= this.apples.length) {
          this.g.floatText(`All ${this.apples.length} apples in the basket!`, pos, '#ffd54a', 3);
          clearTimeout(this.basketReset);
          this.basketReset = setTimeout(() => { for (const x of this.apples) if (!x.held) this.respawn(x); this.basketCount = this.apples.filter((x) => x.inBasket).length; }, 3500);
        } else this.g.floatText(`Apples in the basket: ${this.basketCount}`, pos, '#ffffff', 2.2);
      }
    }
  }

  // ------------------------------------------------------------ bubbles & crystals
  updateBubbles(dt, t, tips) {
    if (!this.cauldron) return;
    const y4 = this.ctx.fy(4), top = y4 + this.ctx.CEIL - 0.1;
    if (this.g.level === 4) {
      this.bubbleT -= dt;
      if (this.bubbleT <= 0 && this.bubbles.length < 9) {
        this.bubbleT = 1.2 + Math.random();
        const r = 0.04 + Math.random() * 0.05;
        const m = new THREE.Mesh(this.bubbleGeo ??= new THREE.SphereGeometry(1, 16, 12), this.bubbleMat ??= new THREE.MeshStandardMaterial({ color: '#dff6ff', transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.4, emissive: '#6fb8ff', emissiveIntensity: 0.15, depthWrite: false }));
        m.scale.setScalar(r); m.position.copy(this.cauldron.position).add(new THREE.Vector3((Math.random() - 0.5) * 0.15, 0.35, (Math.random() - 0.5) * 0.15));
        this.g.world.add(m); this.bubbles.push({ m, r, v: new THREE.Vector3((Math.random() - 0.3) * 0.12, 0.18 + Math.random() * 0.12, -(Math.random()) * 0.12), ph: Math.random() * 6, life: 0 });
      }
    }
    for (const b of this.bubbles) {
      b.life += dt; b.m.position.addScaledVector(b.v, dt); b.m.position.x += Math.sin(t * 2 + b.ph) * 0.002;
      let pop = b.m.position.y > top || b.life > 14;
      for (const tp of tips) if (tp.pos.distanceTo(b.m.position) < b.r + 0.02) pop = true;
      for (const o of this.bodies) if (o.held && o.mesh.position.distanceTo(b.m.position) < b.r + o.r) pop = true;
      if (pop) { b.dead = true; this.g.world.remove(b.m); this.g.audio?.pop(b.m.position); this.g.burst(b.m.position, 8, 0.02, 1); }
    }
    this.bubbles = this.bubbles.filter((b) => !b.dead);
  }
  touchCrystals(tips) {
    for (const b of this.bodies) {
      if (!b.crystal || b.held) continue;
      for (const tp of tips) if (tp.pos.distanceTo(b.mesh.position) < b.r + 0.02 && b.cool === 0) { this.chime(b); b.cool = 0.5; }
    }
  }
  chime(b) {
    this.g.audio?.chime(b.mesh.position, b.note ?? 76);
    const m = b.mesh.material; m.emissiveIntensity = 1.5;
    this.g.animate(0.8, (t) => { m.emissiveIntensity = 1.5 - t * 1.15; });
  }

  // ------------------------------------------------------------ creatures
  updateCreatures(dt, t, head, tips) {
    const g = this.g, fy = this.ctx.fy;
    // cat
    const cat = this.cat;
    if (cat) {
      const cp = cat.group.position, near = g.level === 0 && head.distanceTo(cp) < 1.1;
      cat.body.scale.y = 0.7 + Math.sin(t * (cat.state.purr > 0 ? 6 : 2)) * 0.025;
      cat.eyes.forEach((e) => { e.scale.y += ((near ? 1 : 0.12) - e.scale.y) * Math.min(1, dt * 5); });
      cat.tail.rotation.y = Math.sin(t * (cat.state.purr > 0 ? 4 : 1)) * 0.4;
      if (near) { const local = cat.group.worldToLocal(head.clone()); const yaw = Math.atan2(-local.x, -local.z); cat.head.rotation.y += (Math.max(-0.8, Math.min(0.8, yaw)) - cat.head.rotation.y) * Math.min(1, dt * 3); }
      cat.state.cool -= dt; cat.state.purr -= dt;
      for (const tp of tips) if (g.level === 0 && tp.pos.distanceTo(cp.clone().add(new THREE.Vector3(0, 0.15, 0))) < 0.2 && cat.state.cool <= 0) {
        cat.state.cool = 3; cat.state.purr = 2.5;
        g.audio?.purr(cp, 2.5); setTimeout(() => g.audio?.meow(cp), 700);
        g.burst(cp.clone().add(new THREE.Vector3(0, 0.35, 0)), 12, 0.03, 1, [0xff6fae, 0xff9ad1]);
      }
    }
    // owl
    const owl = this.owl;
    if (owl) {
      const op = owl.group.getWorldPosition(V()).add(new THREE.Vector3(0, 0.25, 0));
      if (g.level === 2) {
        const local = owl.group.worldToLocal(head.clone()); const yaw = Math.atan2(-local.x, -local.z);
        owl.head.rotation.y += (Math.max(-2, Math.min(2, yaw)) - owl.head.rotation.y) * Math.min(1, dt * 2.5);
      }
      owl.state.blink -= dt;
      const lid = owl.state.blink < 0.15 ? 1 : 0.05; owl.lids.forEach((l) => { l.scale.y = lid; });
      if (owl.state.blink < 0) owl.state.blink = 2 + Math.random() * 3;
      owl.state.cool -= dt;
      const touched = tips.some((tp) => tp.pos.distanceTo(op) < 0.15);
      if (g.level === 2 && owl.state.cool < 0 && (touched || head.distanceTo(op) < 1.4)) { owl.state.cool = touched ? 2 : 12; g.audio?.hoot(op); }
    }
    // dragon: circles the tower, dipping past the current floor's windows
    const dr = this.dragon;
    if (dr) {
      const s = dr.state;
      dr.wings.forEach((w, k) => { w.rotation.z = (k ? -1 : 1) * Math.sin(t * (s.perch ? 3 : 4)) * 0.6; });
      if (s.perch) {
        const tgt = s.perchPos;
        dr.group.position.lerp(tgt, Math.min(1, dt * 1.2));
        dr.group.lookAt(0, tgt.y, 0); dr.group.rotateY(Math.PI);
      } else {
        s.a += dt * 0.11;
        const swoop = (Math.sin(s.a * 0.9) + 1) / 2, R = 9 + (1 - swoop) * 10;
        const y = fy(g.level) + 2 + Math.sin(s.a * 1.3) * 2.5 + (1 - swoop) * 6;
        const pos = new THREE.Vector3(Math.cos(s.a) * R, y, Math.sin(s.a) * R);
        const ahead = new THREE.Vector3(Math.cos(s.a + 0.05) * R, y, Math.sin(s.a + 0.05) * R);
        dr.group.position.copy(pos); dr.group.lookAt(ahead); dr.group.rotateY(Math.PI);
        dr.group.rotation.z = 0.25;
        s.cool -= dt;
        if (s.cool < 0 && pos.distanceTo(head) < 11) { s.cool = 25; g.audio?.roar(pos); }
      }
    }
    for (const b of this.birds || []) {
      const a = t * (0.08 + b.flock * 0.03) + b.flock * 2, R = 38 + b.flock * 20;
      const off = new THREE.Vector3(-b.k * 1.2, Math.sin(b.k) * 0.4, (b.k % 2 ? 1 : -1) * b.k * 0.8);
      const pos = new THREE.Vector3(Math.cos(a) * R, 26 + b.flock * 8, Math.sin(a) * R).add(off);
      b.group.position.copy(pos); b.group.lookAt(new THREE.Vector3(Math.cos(a + 0.02) * R, pos.y, Math.sin(a + 0.02) * R).add(off)); b.group.rotateY(Math.PI);
      b.wings.forEach((w, k) => { w.rotation.z = (k ? -1 : 1) * Math.sin(t * 10 + b.k) * 0.5; });
    }
  }
  perchDragon(pos) { this.dragon.state.perch = true; this.dragon.state.perchPos = pos; }
}
