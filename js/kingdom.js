// My Kingdom: mixed-reality mode for Meta Quest 3. A floating grass island
// appears in the real room (passthrough); solving homework earns gems, which buy
// cottages, towers, windmills and a castle from the Builder's Shop. She grabs a
// building and drops it on the island; the kingdom is saved on the headset and
// grows every time she plays. Reuses the tower game's maths panel, Magic Scroll,
// gem tray, homework report and answer-booklet saving.
//
// Buildings are assembled from Kenney's Fantasy Town, Castle and Nature kits
// (CC0), packed into assets/kingdom/kingdom.glb (one scene per piece).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Game, Panel, makeSign, canvasTexture, roundRect, drawGem, FONT, clamp } from './game.js';
import { ProblemSource } from './problems.js';
import { GemTray } from './tray.js';
import { MagicScroll } from './scroll.js';
import { makeDragon } from './props.js';

const CELL = 0.2, R = 0.86, TOPY = 0.55, QUEST = 5; // metres: grid cell, island radius, island top height
const PLAYER_Z = 1.45; // where she stands, in kingdom coordinates (the island centre is the origin)
const KEY = (player) => `mathcastle.kingdom.${player}`;

// ------------------------------------------------------------------ kit
let kitPromise = null;
export function loadKit() {
  return (kitPromise ??= new GLTFLoader().loadAsync(new URL('../assets/kingdom/kingdom.glb', import.meta.url).href)
    .then((g) => Object.fromEntries(g.scenes.map((s) => [s.name, s])))
    .catch((e) => { console.warn('kingdom kit failed', e?.message || e); return {}; }));
}

// Seeded random so a saved building rebuilds identically.
const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

// ------------------------------------------------------------------ building recipes (1 unit = 1 grid cell)
const TAU = Math.PI * 2, Q = Math.PI / 2;
function add(g, kit, name, x = 0, y = 0, z = 0, ry = 0, s = 1) {
  const src = kit[name]; if (!src) return null;
  const o = src.clone(true); o.position.set(x, y, z); o.rotation.y = ry;
  if (Array.isArray(s)) o.scale.set(...s); else o.scale.setScalar(s);
  g.add(o); return o;
}
// four walls of a 1x1 house at height y; the door faces +z (towards her)
function walls(g, kit, y, front, side, back = side) {
  add(g, kit, front, 0, y, 0, -Q); add(g, kit, back, 0, y, 0, Q); add(g, kit, side, 0, y, 0, 0); add(g, kit, side, 0, y, 0, Math.PI);
}
const pickOne = (r, list) => list[Math.floor(r() * list.length)];

export const CATALOG = [
  { id: 'tree', name: 'Tree', cost: 1, build: (g, k, r) => add(g, k, pickOne(r, ['t-tree', 't-tree-high-round', 't-tree-crooked', 'c-tree-large', 'c-tree-small']), 0, 0, 0, r() * TAU, 0.75) },
  { id: 'flowers', name: 'Flowers', cost: 1, build: (g, k, r) => { add(g, k, 'n-grass_large', 0, 0, 0, r() * TAU, 1.2); for (let n = 0; n < 6; n++) add(g, k, pickOne(r, ['n-flower_redA', 'n-flower_purpleA', 'n-flower_yellowA']), (r() - 0.5) * 0.7, 0, (r() - 0.5) * 0.7, r() * TAU, 1.6); } },
  { id: 'lantern', name: 'Lamp post', cost: 1, build: (g, k) => add(g, k, 't-lantern', 0, 0, 0, 0, 0.8) },
  { id: 'garden', name: 'Pumpkins', cost: 2, build: (g, k, r) => { for (const [x, z] of [[-0.25, -0.2], [0.25, -0.15], [0, 0.25]]) add(g, k, 'n-crop_pumpkin', x, 0, z, r() * TAU, 1.1); add(g, k, 'n-crops_cornStageD', -0.3, 0, 0.3, 0, 0.7); add(g, k, 'n-crops_cornStageD', 0.3, 0, 0.3, 1, 0.7); } },
  { id: 'stall', name: 'Market stall', cost: 2, build: (g, k, r) => add(g, k, pickOne(r, ['t-stall-red', 't-stall-green']), 0, 0, 0, Math.PI, 0.9) },
  { id: 'camp', name: 'Tent', cost: 2, build: (g, k) => { add(g, k, 'n-tent_detailedOpen', 0, 0, -0.15, 0, 0.85); add(g, k, 'n-campfire_stones', 0.2, 0, 0.35, 0, 0.9); } },
  { id: 'cart', name: 'Cart', cost: 2, build: (g, k) => add(g, k, 't-cart', 0, 0, 0, Q, 0.8) },
  { id: 'cottage', name: 'Cottage', cost: 3, build: (g, k) => { walls(g, k, 0, 't-wall-wood-door', 't-wall-wood-window-shutters', 't-wall-wood'); add(g, k, 't-roof-gable', 0, 1, 0, 0); add(g, k, 't-chimney', 0, 1, -0.2, 0); } },
  { id: 'house', name: 'Big house', cost: 4, build: (g, k) => { walls(g, k, 0, 't-wall-door', 't-wall-window-shutters', 't-wall'); walls(g, k, 1, 't-wall-wood-window-small', 't-wall-wood-window-small'); add(g, k, 't-roof-high-gable', 0, 2, 0, Q); add(g, k, 't-banner-red', 0, 0.9, 0, -Q); } },
  { id: 'fountain', name: 'Fountain', cost: 4, build: (g, k) => add(g, k, 't-fountain-round', 0, 0, 0, 0, 0.48) },
  { id: 'tower', name: 'Tower', cost: 5, build: (g, k) => { const s = 0.78; add(g, k, 'c-tower-square-base', 0, 0, 0, 0, s); add(g, k, 'c-tower-square-mid-windows', 0, 1.01 * s, 0, 0, s); add(g, k, 'c-tower-square-top-roof-high', 0, 2.02 * s, 0, 0, s); } },
  { id: 'windmill', name: 'Windmill', cost: 6, build: (g, k) => { walls(g, k, 0, 't-wall-door', 't-wall', 't-wall'); walls(g, k, 1, 't-wall-wood-window-small', 't-wall-wood'); add(g, k, 't-roof-high-point', 0, 2, 0, 0); const b = add(g, k, 't-blade', 0.58, 1.75, 0, 0, 0.75); if (b) b.userData.spin = true; } },
  { id: 'wizard', name: 'Wizard tower', cost: 6, build: (g, k) => { const s = 0.9; add(g, k, 'c-tower-hexagon-base', 0, 0, 0, 0, s); add(g, k, 'c-tower-hexagon-mid', 0, 1.31 * s, 0, 0, s); add(g, k, 'c-tower-hexagon-mid', 0, 1.77 * s, 0, 0, s); add(g, k, 'c-tower-hexagon-roof', 0, 2.23 * s, 0, 0, s); add(g, k, 'c-flag-pennant', 0, 3.0 * s, 0, 0, s); } },
  { id: 'castle', name: 'Castle', cost: 12, foot: 2, build: (g, k) => {
    // a 2x2 castle: corner towers, curtain walls with a gate, and a keep with a flag
    for (const [x, z] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) { add(g, k, 'c-tower-hexagon-base', x, 0, z, 0, 0.55); add(g, k, 'c-tower-hexagon-roof', x, 1.31 * 0.55, z, 0, 0.55); }
    for (const [x, z, ry] of [[0, -0.8, 0], [-0.8, 0, Q], [0.8, 0, Q]]) add(g, k, 'c-wall', x, 0, z, ry, [1.2, 0.5, 0.25]);
    for (const x of [-0.45, 0.45]) add(g, k, 'c-wall', x, 0, 0.8, 0, [0.5, 0.5, 0.25]);
    add(g, k, 'c-gate', 0, 0, 0.8, Q, 0.62);
    const s = 0.62; add(g, k, 'c-tower-square-base', 0, 0, -0.1, 0, s); add(g, k, 'c-tower-square-mid-windows', 0, 1.01 * s, -0.1, 0, s); add(g, k, 'c-tower-square-top-roof-high', 0, 2.02 * s, -0.1, 0, s);
    add(g, k, 'c-flag', 0, 3.35 * s, -0.1, 0, s);
  } },
];
const ITEM = Object.fromEntries(CATALOG.map((c) => [c.id, c]));

// Merge a building's pieces per material so each building costs a draw call or two.
function flatten(root) {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert(), groups = new Map(), out = new THREE.Group(), keep = [];
  root.traverse((o) => { if (o.userData.spin) keep.push(o); });
  root.traverse((o) => {
    if (!o.isMesh || keep.some((k) => k === o || o.parent === k || k.getObjectById(o.id))) return;
    let g = o.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    if (g.index) g = g.toNonIndexed();
    for (const n of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', ...(o.material.vertexColors ? ['color'] : [])].includes(n)) g.deleteAttribute(n);
    const key = o.material.uuid + (g.attributes.uv ? 'u' : '');
    if (!groups.has(key)) groups.set(key, { mat: o.material, list: [] });
    groups.get(key).list.push(g);
  });
  for (const { mat, list } of groups.values()) { const m = new THREE.Mesh(mergeGeometries(list), mat); out.add(m); }
  for (const k of keep) { const w = new THREE.Group(); k.updateMatrixWorld(true); new THREE.Matrix4().multiplyMatrices(inv, k.matrixWorld).decompose(w.position, w.quaternion, w.scale); const c = k.clone(true); c.position.set(0, 0, 0); c.rotation.set(0, 0, 0); c.scale.set(1, 1, 1); w.add(c); w.userData.spin = true; out.add(w); }
  return out;
}

// ------------------------------------------------------------------ the game
export class Kingdom extends Game {
  constructor(opts) {
    super({ ...opts, mode: 'kingdom' });
    this.kitReady = loadKit().then((k) => (this.kit = k));
  }

  async startDesktop() {
    await this.kitReady;
    this.buildWorld();
    this.scene.background = new THREE.Color(0xcfe3f5);
    this.desktopRoom();
    this.rig.position.set(0.1, 0, PLAYER_Z + 0.5); this.camera.rotation.set(-0.5, 0, 0);
    this.startAudio();
  }

  async enterVR() {
    const mode = this.opts.xrMode || 'immersive-ar';
    const session = await navigator.xr.requestSession(mode, { requiredFeatures: ['local-floor'], optionalFeatures: ['hand-tracking', 'bounded-floor'] });
    try {
      await this.kitReady;
      this.isAR = mode === 'immersive-ar';
      this.buildWorld();
      this.scene.background = this.isAR ? null : new THREE.Color(0xcfe3f5);
      if (!this.isAR) this.desktopRoom();
      this.renderer.xr.setReferenceSpaceType('local-floor');
      this.camera.position.set(0, 0, 0); this.camera.rotation.set(0, 0, 0);
      this.rig.position.set(0, 0, 0); this.rig.rotation.set(0, 0, 0);
      this.placePending = true; // the island appears in front of her on the first tracked frame
      await this.renderer.xr.setSession(session);
      const ref = this.renderer.xr.getReferenceSpace();
      const reset = () => { this.placePending = true; };
      ref.addEventListener('reset', reset); // recentering puts the kingdom in front of her again
      session.addEventListener('end', () => { ref.removeEventListener('reset', reset); this.camera.position.set(0, 1.3, 0); this.onExitVR?.(); });
      this.startAudio();
    } catch (e) { await session.end().catch(() => {}); throw e; }
  }
  startAudio() { this.audio.resume(); this.audio.startMusic('feast'); }

  // A plain floor and a soft light when there's no passthrough (desktop or VR-only).
  desktopRoom() {
    if (this.roomFloor) return;
    const m = new THREE.MeshStandardMaterial({ map: canvasTexture(512, 512, (c, w, h) => { c.fillStyle = '#b89b78'; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(80,50,20,0.25)'; for (let y = 0; y < h; y += 64) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); } }, true), roughness: 0.9 });
    m.map.repeat.set(6, 6);
    this.roomFloor = new THREE.Mesh(new THREE.CircleGeometry(8, 48).rotateX(-Math.PI / 2), m);
    this.scene.add(this.roomFloor);
  }

  buildWorld() {
    const save = this.loadSave();
    this.W = this.D = 3.2;
    if (this.world) this.scene.remove(this.world);
    this.world = new THREE.Group(); this.scene.add(this.world);
    const hwDone = save.hw?.key === (this.opts.hwKey || '') ? save.hw.done : [];
    this.source = new ProblemSource({ ...this.opts, homeworkDone: hwDone });
    this.session = { id: Date.now(), start: Date.now(), problems: [], hwDone: hwDone.slice() };
    this.stats = { attempts: 0, correct: 0, firstTry: 0, missed: [], treasures: [] };
    this.level = 0; this.panels = []; this.chests = []; this.locks = []; this.blockers = []; this.mirrors = []; this.windows = []; this.torches = []; this.spinners = []; this.decor = []; this.floaters = [];
    this.buildings = []; this.occupied = new Map(); this.reserved = new Set(); this.visitors = [];
    this.gems = save.gems; this.quests = save.quests || 0; this.everBuilt = save.everBuilt || 0;
    this.panelH = 1.0;

    this.world.add(new THREE.HemisphereLight(0xfff6e6, 0x6f7f5a, 1.3));
    const sun = new THREE.DirectionalLight(0xffffff, 1.7); sun.position.set(1.5, 3, 2); this.world.add(sun);
    this.buildIsland();
    this.buildShop();
    // the Magic Lock panel becomes the Wizard's quest board, to her front-left
    const panel = new Panel(this, { title: 'Royal Quest', count: QUEST, width: 0.62, doneText: 'Quest complete!\n+5 bonus gems', defer: true });
    panel.wallMounted = true; // her scroll work goes into the answer booklet
    panel.onProblem = (p) => { this.tray.bind(panel, p); this.scroll.setProblem(p.text); this.readAloud(p, 1.0); };
    panel.onSolved = () => this.questComplete(panel);
    this.board = panel; this.panels.push(panel); this.world.add(panel.mesh);
    this.tray = new GemTray(this); this.world.add(this.tray.group); this.tray.place(0, 0, this.W, this.D, this.panelH);
    this.scroll = new MagicScroll(this); this.world.add(this.scroll.group); this.scroll.place(0, 0, 2.6, this.D, this.panelH);
    this.layoutStation();
    for (const b of save.built || []) this.placeBuilding(b, false);
    this.makeWelcomeSign(save);
    panel.activate();
    this.updateHud();
  }

  // Quest board, scroll and gem tray on her left; the shop on her right; the island ahead.
  layoutStation() {
    const face = (o, x, y, z) => { o.position.set(x, y, z); o.lookAt(0, y, PLAYER_Z + 0.3); };
    const y = this.panelH;
    face(this.board.mesh, -0.62, y + 0.05, PLAYER_Z - 0.42);
    face(this.scroll.group, -1.3, y, PLAYER_Z - 0.9);
    face(this.tray.group, -0.3, y - 0.34, PLAYER_Z - 0.3); this.tray.group.rotateX(-0.5);
    face(this.shop.group, 0.98, y - 0.05, PLAYER_Z - 0.6);
  }

  // ------------------------------------------------------------ island
  buildIsland() {
    const island = this.island = new THREE.Group(); island.position.y = TOPY; this.world.add(island);
    const grass = canvasTexture(1024, 1024, (c, w, h) => {
      const g = c.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, w / 2); g.addColorStop(0, '#7cc55a'); g.addColorStop(0.85, '#63ad47'); g.addColorStop(1, '#4f8f3a');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      for (let k = 0; k < 9000; k++) { const x = Math.random() * w, y = Math.random() * h, l = 4 + Math.random() * 8; c.strokeStyle = `rgba(${Math.random() < 0.5 ? '40,90,30' : '170,220,120'},${0.15 + Math.random() * 0.2})`; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (Math.random() - 0.5) * 3, y - l); c.stroke(); }
      for (let k = 0; k < 60; k++) { c.fillStyle = ['#fff6a8', '#ffd1e8', '#ffffff'][k % 3]; c.beginPath(); c.arc(Math.random() * w, Math.random() * h, 3, 0, 7); c.fill(); }
    });
    this.islandTop = new THREE.Mesh(new THREE.CircleGeometry(R, 72).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: grass, roughness: 0.95 }));
    island.add(this.islandTop);
    // earth rim and a rocky underside that tapers to a point, like a floating sky island
    island.add(new THREE.Mesh(new THREE.CylinderGeometry(R, R * 0.96, 0.07, 72, 1, true).translate(0, -0.035, 0), new THREE.MeshStandardMaterial({ color: 0x7a5534, roughness: 1, side: THREE.DoubleSide })));
    const rock = new THREE.ConeGeometry(R * 0.96, TOPY - 0.12, 28, 6).rotateX(Math.PI).translate(0, -0.07 - (TOPY - 0.12) / 2, 0), p = rock.attributes.position, cols = [];
    for (let k = 0; k < p.count; k++) {
      const x = p.getX(k), y = p.getY(k), z = p.getZ(k), a = Math.atan2(z, x), j = 1 + 0.12 * Math.sin(a * 5 + y * 20) + 0.08 * Math.sin(a * 11);
      if (y < -0.08) p.setXYZ(k, x * j, y, z * j);
      const c = new THREE.Color(y > -0.12 ? 0x6b4a2e : 0x8a8478).multiplyScalar(0.85 + 0.15 * Math.sin(a * 7 + y * 30)); cols.push(c.r, c.g, c.b);
    }
    rock.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); rock.computeVertexNormals();
    island.add(new THREE.Mesh(rock, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true })));
    // a little pond with lilies (its cells can't be built on)
    const pond = new THREE.Vector2(-0.46, -0.32);
    const water = new THREE.Mesh(new THREE.CircleGeometry(0.15, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x4fa8e0, roughness: 0.1, metalness: 0.1 }));
    water.position.set(pond.x, 0.004, pond.y); island.add(water);
    if (this.kit['n-lily_large']) { const lily = this.kit['n-lily_large'].clone(true); lily.scale.setScalar(CELL * 0.6); lily.position.set(pond.x + 0.04, 0.006, pond.y); island.add(lily); }
    for (const [i, j] of this.cells()) if (Math.hypot(i * CELL - pond.x, j * CELL - pond.y) < 0.2) this.reserved.add(`${i},${j}`);
    // grid shown while she holds a building
    const dots = []; for (const [i, j] of this.cells()) if (!this.reserved.has(`${i},${j}`)) dots.push(i * CELL, 0.006, j * CELL);
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.Float32BufferAttribute(dots, 3));
    this.gridDots = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.018, transparent: true, opacity: 0.7 })); this.gridDots.visible = false; island.add(this.gridDots);
    this.ghost = new THREE.Mesh(new THREE.RingGeometry(CELL * 0.36, CELL * 0.48, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x4dff9a, transparent: true, opacity: 0.85, toneMapped: false, depthWrite: false }));
    this.ghost.position.y = 0.008; this.ghost.visible = false; island.add(this.ghost);
    this.blobMat = new THREE.MeshBasicMaterial({ map: canvasTexture(64, 64, (c, w) => { const g = c.createRadialGradient(w / 2, w / 2, 2, w / 2, w / 2, w / 2); g.addColorStop(0, 'rgba(20,40,10,0.45)'); g.addColorStop(1, 'rgba(20,40,10,0)'); c.fillStyle = g; c.fillRect(0, 0, w, w); }), transparent: true, depthWrite: false });
    // magic sparkles drifting under the island
    const n = 60, sp = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) { const a = Math.random() * TAU, r = Math.random() * R; sp[k * 3] = Math.cos(a) * r; sp[k * 3 + 1] = -Math.random() * TOPY; sp[k * 3 + 2] = Math.sin(a) * r; }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.sparkles = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xfff0a0, size: 0.02, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    island.add(this.sparkles);
  }
  *cells() { const n = Math.floor(R / CELL); for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) if (Math.hypot(i * CELL, j * CELL) <= R - CELL * 0.55) yield [i, j]; }
  footCells(i, j, foot) { const out = []; for (let a = 0; a < foot; a++) for (let b = 0; b < foot; b++) out.push([i + a, j + b]); return out; }
  cellOK(i, j, foot, ignore = null) {
    return this.footCells(i, j, foot).every(([a, b]) => Math.hypot(a * CELL, b * CELL) <= R - CELL * 0.55 && !this.reserved.has(`${a},${b}`) && (!this.occupied.has(`${a},${b}`) || this.occupied.get(`${a},${b}`) === ignore));
  }
  cellCentre(i, j, foot) { const o = (foot - 1) / 2; return new THREE.Vector3((i + o) * CELL, 0, (j + o) * CELL); }
  // nearest valid cell under an island-space point
  snap(local, foot, ignore) {
    const o = (foot - 1) / 2, i = Math.round(local.x / CELL - o), j = Math.round(local.z / CELL - o);
    return { i, j, ok: Math.hypot(local.x, local.z) < R + 0.05 && this.cellOK(i, j, foot, ignore) };
  }

  makeModel(id, seed) {
    const item = ITEM[id], g = new THREE.Group(), r = rng(seed || 1);
    item.build(g, this.kit, r);
    const flat = flatten(g); flat.scale.setScalar(CELL);
    return flat;
  }

  placeBuilding({ id, i, j, rot = 0, seed = 1 }, fresh = true) {
    const item = ITEM[id]; if (!item) return null;
    const foot = item.foot || 1;
    if (!this.cellOK(i, j, foot)) return null;
    const root = new THREE.Group(), model = this.makeModel(id, seed);
    root.add(model);
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(CELL * foot * 1.05, CELL * foot * 1.05).rotateX(-Math.PI / 2), this.blobMat); blob.position.y = 0.003; root.add(blob);
    // an invisible box to point at or grab it
    const box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3());
    const hit = new THREE.Mesh(new THREE.BoxGeometry(Math.max(size.x, 0.1), Math.max(size.y, 0.08), Math.max(size.z, 0.1)), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = size.y / 2; root.add(hit);
    root.position.copy(this.cellCentre(i, j, foot)); root.rotation.y = rot * Q;
    this.island.add(root);
    const b = { id, i, j, rot, seed, foot, root, model, hit, spin: [] };
    model.traverse((o) => { if (o.userData.spin) b.spin.push(o); });
    hit.userData.building = b;
    for (const [a, c] of this.footCells(i, j, foot)) this.occupied.set(`${a},${c}`, b);
    this.buildings.push(b);
    if (fresh) {
      model.scale.setScalar(0.001);
      this.animate(0.5, (t) => { const s = t < 0.7 ? t / 0.7 * 1.15 : 1.15 - (t - 0.7) / 0.3 * 0.15; model.scale.setScalar(CELL * Math.max(0.001, s)); });
      const wp = root.getWorldPosition(new THREE.Vector3()); this.burst(wp.add(new THREE.Vector3(0, 0.1, 0)), 30, 0.018, 1.2);
      this.audio.pop(wp); this.audio.chime(wp, 76 + Math.floor(Math.random() * 8));
    }
    return b;
  }
  liftBuilding(b) {
    for (const [a, c] of this.footCells(b.i, b.j, b.foot)) this.occupied.delete(`${a},${c}`);
    this.buildings = this.buildings.filter((x) => x !== b);
    this.island.remove(b.root);
  }

  // ------------------------------------------------------------ shop
  buildShop() {
    const shop = this.shop = { group: new THREE.Group(), slots: [] }, cols = 5, sw = 0.2, sh = 0.2;
    const rows = Math.ceil(CATALOG.length / cols), W = cols * sw + 0.08, H = rows * sh + 0.2;
    this.shopHead = document.createElement('canvas'); this.shopHead.width = 1024; this.shopHead.height = 160;
    this.shopHeadTex = new THREE.CanvasTexture(this.shopHead); this.shopHeadTex.colorSpace = THREE.SRGBColorSpace;
    const head = new THREE.Mesh(new THREE.PlaneGeometry(W, W * 160 / 1024), new THREE.MeshBasicMaterial({ map: this.shopHeadTex, transparent: true, toneMapped: false }));
    head.position.y = H / 2 + 0.06; shop.group.add(head); this.shopHeadMesh = head;
    const back = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ color: 0x6b4526, roughness: 0.8 }));
    back.position.z = -0.08; shop.group.add(back);
    const shelfMat = new THREE.MeshStandardMaterial({ color: 0x8a5a30, roughness: 0.7 });
    for (let r = 0; r < rows; r++) { const s = new THREE.Mesh(new THREE.BoxGeometry(W, 0.014, 0.16), shelfMat); s.position.set(0, H / 2 - 0.1 - (r + 1) * sh + 0.045, 0); shop.group.add(s); }
    CATALOG.forEach((item, k) => {
      const r = Math.floor(k / cols), c = k % cols, x = -W / 2 + 0.04 + sw * (c + 0.5), y = H / 2 - 0.1 - (r + 1) * sh + 0.052;
      const slot = new THREE.Group(); slot.position.set(x, y, 0); shop.group.add(slot);
      const model = this.makeModel(item.id, 7 + k), box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3());
      const s = 0.11 / Math.max(size.x, size.y * 0.8, size.z); model.scale.multiplyScalar(s); model.rotation.y = -0.5; slot.add(model);
      const label = document.createElement('canvas'); label.width = 256; label.height = 88;
      const tex = new THREE.CanvasTexture(label); tex.colorSpace = THREE.SRGBColorSpace;
      const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.058), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }));
      tag.position.set(0, -0.03, 0.075); slot.add(tag);
      const hit = new THREE.Mesh(new THREE.BoxGeometry(sw * 0.95, sh * 0.95, 0.15), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.y = 0.06; slot.add(hit);
      const entry = { item, slot, model, label, tex, hit, baseScale: model.scale.x };
      hit.userData.shopItem = entry; shop.slots.push(entry);
    });
    // "Move kingdom here" (headset only): the island jumps to in front of her
    const move = makeSign('Move my kingdom here', { w: 0.42, h: 0.08, size: 60, bg: '#2b1a4a', fg: '#ffe9a8' });
    move.position.set(0, -H / 2 - 0.07, 0); shop.group.add(move);
    move.userData.button = { action: () => { this.placePending = true; this.audio.click(); } };
    this.moveBtn = move; this.buttons = [move];
    this.world.add(shop.group);
    this.drawShop();
  }
  drawShop() {
    const c = this.shopHead.getContext('2d'), w = 1024, h = 160;
    c.clearRect(0, 0, w, h);
    c.fillStyle = '#2b1a4a'; roundRect(c, 0, 0, w, h, 34); c.fill(); c.lineWidth = 8; c.strokeStyle = '#e0b84a'; roundRect(c, 4, 4, w - 8, h - 8, 30); c.stroke();
    c.fillStyle = '#ffe9a8'; c.font = `bold 62px ${FONT}`; c.textBaseline = 'middle'; c.textAlign = 'left'; c.fillText("Builder's Shop", 40, h / 2);
    drawGem(c, 700, h / 2, 40, '#e0115f'); c.fillStyle = '#fff'; c.font = `bold 86px ${FONT}`; c.fillText(`${this.gems}`, 760, h / 2 + 4);
    this.shopHeadTex.needsUpdate = true;
    for (const s of this.shop.slots) {
      const x = s.label.getContext('2d'), can = this.gems >= s.item.cost;
      x.clearRect(0, 0, 256, 88);
      x.fillStyle = can ? 'rgba(255,248,230,0.95)' : 'rgba(120,110,130,0.85)'; roundRect(x, 0, 0, 256, 88, 18); x.fill();
      // name on top, price underneath: "Cottage" / gem 3
      x.fillStyle = can ? '#2b1a4a' : '#e8e2f0'; x.textBaseline = 'middle'; x.textAlign = 'center'; x.font = `bold 30px ${FONT}`;
      x.fillText(s.item.name, 128, 26, 236);
      drawGem(x, 104, 62, 17, can ? '#e0115f' : '#8a7f95'); x.font = `bold 38px ${FONT}`; x.textAlign = 'left'; x.fillText(`${s.item.cost}`, 128, 64);
      s.tex.needsUpdate = true;
    }
  }

  // ------------------------------------------------------------ gems and quests
  addGems(n, from) {
    const target = this.shopHeadMesh.getWorldPosition(new THREE.Vector3());
    for (let k = 0; k < n; k++) {
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.025), new THREE.MeshStandardMaterial({ color: 0xe0115f, emissive: 0x800830, roughness: 0.2, metalness: 0.3 }));
      const start = from.clone(); gem.position.copy(start); this.scene.add(gem);
      const mid = start.clone().lerp(target, 0.5).add(new THREE.Vector3(0, 0.35, 0));
      this.animate(0.9, (t) => { const a = start.clone().lerp(mid, t), b = mid.clone().lerp(target, t); gem.position.copy(a.lerp(b, t)); gem.rotation.y += 0.2; }, () => {
        this.scene.remove(gem); this.gems++; this.drawShop(); this.updateHud(); this.audio.gem();
        if (k === n - 1) this.saveKingdom();
      }, k * 0.18);
    }
  }
  logProblem(panel, ok) {
    super.logProblem(panel, ok);
    if (ok) this.addGems(panel.firstTry ? 3 : 2, panel.mesh.getWorldPosition(new THREE.Vector3()));
  }
  questComplete(panel) {
    this.quests++;
    this.audio.cueChest();
    const at = panel.mesh.getWorldPosition(new THREE.Vector3());
    this.burst(at, 60);
    this.addGems(5, at);
    this.dragonVisit();
    setTimeout(() => { panel.solved = 0; panel.state = 'solving'; panel.newProblem(); }, 3000);
  }
  saveCheckpoint() { this.saveKingdom(); }
  loadSave() {
    try { const s = JSON.parse(localStorage.getItem(KEY(this.playerKey))); if (s?.v === 1) return s; } catch { /* new kingdom */ }
    return { v: 1, gems: 3, built: [], quests: 0, everBuilt: 0 };
  }
  saveKingdom() {
    const s = { v: 1, gems: this.gems, quests: this.quests, everBuilt: this.everBuilt, built: this.buildings.map(({ id, i, j, rot, seed }) => ({ id, i, j, rot, seed })), hw: { key: this.opts.hwKey || '', done: this.session.hwDone.slice() }, at: Date.now() };
    try { localStorage.setItem(KEY(this.playerKey), JSON.stringify(s)); } catch { /* storage full */ }
  }

  makeWelcomeSign(save) {
    const text = save.built?.length ? `Welcome back to your kingdom, ${this.opts.name || 'Explorer'}!` : 'Solve quests to earn gems. Spend them in the shop and build your kingdom!';
    const s = makeSign(text, { w: 1.3, h: 0.3, size: 70, bg: '#2b1a4a', fg: '#ffe9a8' });
    s.position.set(0, 1.6, -0.95); s.lookAt(0, 1.6, PLAYER_Z); this.world.add(s); this.welcome = s;
  }

  // ------------------------------------------------------------ holding and placing
  pickFromShop(ptr, entry, byRay = false) {
    if (ptr.holding || ptr.holdingTray) return false;
    if (this.gems < entry.item.cost) {
      const need = entry.item.cost - this.gems;
      this.floatText(`${need} more gem${need > 1 ? 's' : ''} needed. Solve a quest problem!`, entry.slot.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.2, 0.05)), '#ffd86b');
      this.audio.wrong(); this.animate(0.4, (t) => { entry.slot.position.x += Math.sin(t * 40) * 0.002; });
      return false;
    }
    return this.hold(ptr, { item: entry.item, seed: 1 + Math.floor(Math.random() * 1e6), from: entry }, byRay);
  }
  pickBuilding(ptr, b, byRay = false) {
    if (ptr.holding || ptr.holdingTray) return false;
    this.liftBuilding(b);
    return this.hold(ptr, { item: ITEM[b.id], seed: b.seed, moving: b }, byRay);
  }
  hold(ptr, h, byRay) {
    h.obj = this.makeModel(h.item.id, h.seed); h.obj.scale.multiplyScalar(0.85);
    const holder = this.holder(ptr); holder.add(h.obj);
    if (ptr.desktop) h.obj.position.set(-0.12, 0.02, -0.25); else h.obj.position.set(0, -0.03, 0);
    ptr.holding = h; ptr.byRay = byRay; if (byRay) ptr.grabBy = 'select';
    this.gridDots.visible = true; this.audio.pickup(holder.getWorldPosition(new THREE.Vector3())); this.haptic(ptr, 0.4, 30);
    return true;
  }
  // Where the held building would land: under the building itself, or where she points on the island.
  target(ptr) {
    const h = ptr.holding, foot = h.item.foot || 1, ignore = null;
    const wp = h.obj.getWorldPosition(new THREE.Vector3()), local = this.island.worldToLocal(wp.clone());
    if (local.y > -0.05 && local.y < 0.45 && Math.hypot(local.x, local.z) < R + 0.05) return { ...this.snap(local, foot, ignore), local };
    // otherwise follow the pointing ray (controller) or the view (desktop)
    const o = new THREE.Vector3(), d = new THREE.Vector3();
    if (ptr.desktop) { this.camera.getWorldPosition(o); this.camera.getWorldDirection(d); }
    else { const m = new THREE.Matrix4().extractRotation(ptr.c.matrixWorld); o.setFromMatrixPosition(ptr.c.matrixWorld); d.set(0, 0, -1).applyMatrix4(m); }
    this.raycaster.set(o, d);
    const hit = this.raycaster.intersectObject(this.islandTop, false)[0];
    if (!hit) return null;
    const l2 = this.island.worldToLocal(hit.point.clone());
    return { ...this.snap(l2, foot, ignore), local: l2 };
  }
  tryGrab(ptr) {
    if (ptr.holding || ptr.holdingTray) return false;
    this.audio.resume();
    const p = this.holdPoint(ptr), v = new THREE.Vector3();
    if (this.tray?.grabAt(p, this.holder(ptr))) { ptr.holdingTray = true; this.haptic(ptr, 0.3, 20); return true; }
    let best = null, bd = 0.1;
    for (const s of this.shop.slots) { const d = s.hit.getWorldPosition(v).distanceTo(p); if (d < bd) { bd = d; best = s; } }
    if (best) return this.pickFromShop(ptr, best);
    let bb = null; bd = 0.1;
    for (const b of this.buildings) { const d = b.hit.getWorldPosition(v).distanceTo(p); if (d < bd) { bd = d; bb = b; } }
    return bb ? this.pickBuilding(ptr, bb) : false;
  }
  drop(ptr) {
    if (ptr.holdingTray) return super.drop(ptr);
    const h = ptr.holding; if (!h) return;
    const tg = this.target(ptr);
    h.obj.parent?.remove(h.obj); ptr.holding = null; this.ghost.visible = false; this.gridDots.visible = false;
    const head = this.island.worldToLocal(this.headPos());
    const place = (i, j) => { const c = this.cellCentre(i, j, h.item.foot || 1); return { id: h.item.id, i, j, seed: h.seed, rot: ((Math.round(Math.atan2(head.x - c.x, head.z - c.z) / Q) % 4) + 4) % 4 }; };
    if (tg?.ok) {
      const b = this.placeBuilding(place(tg.i, tg.j));
      if (b && !h.moving) { this.gems -= h.item.cost; this.everBuilt++; this.drawShop(); this.updateHud(); this.milestone(); }
      if (b && this.welcome) { this.world.remove(this.welcome); this.welcome = null; }
    } else if (h.moving) this.placeBuilding({ ...h.moving, root: undefined }, false); // put it back where it was
    else this.audio.pop(this.headPos());
    this.saveKingdom();
  }
  milestone() {
    const n = this.buildings.length;
    if ([5, 10, 15, 20, 30, 40].includes(n)) { this.audio.cueUnlock(); this.showBanner(`${n} buildings! Your kingdom is growing!`); this.dragonVisit(); }
  }
  dragonVisit() {
    const d = makeDragon(); d.group.scale.setScalar(0.18); this.world.add(d.group);
    const v = { d, t: 0, life: 14 }; this.visitors.push(v);
    this.audio.roar(this.island.getWorldPosition(new THREE.Vector3()));
  }

  // ------------------------------------------------------------ pointing
  castFrom(origin, dir) {
    this.raycaster.set(origin, dir);
    const t = [];
    for (const p of this.panels) if (p.mesh.visible) t.push(p.mesh);
    if (this.tray) t.push(...this.tray.pickables());
    if (this.scroll) t.push(this.scroll.mesh);
    for (const s of this.shop.slots) t.push(s.hit);
    if (this.renderer.xr.isPresenting) t.push(this.moveBtn);
    for (const b of this.buildings) t.push(b.hit);
    t.push(this.islandTop);
    const hit = this.raycaster.intersectObjects(t, false)[0];
    if (!hit) return null;
    const o = hit.object, base = { point: hit.point, distance: hit.distance, uv: hit.uv };
    if (o.userData.panel) return { ...base, type: 'panel', panel: o.userData.panel };
    if (o.userData.scroll) return { ...base, type: 'scroll' };
    if (o.userData.traySlot !== undefined) return { ...base, type: 'tray', slot: o.userData.traySlot };
    if (o.userData.shopItem) return { ...base, type: 'shop', item: o.userData.shopItem };
    if (o.userData.button) return { ...base, type: 'button', button: o.userData.button };
    if (o.userData.building) return { ...base, type: 'building', b: o.userData.building };
    return { ...base, type: 'island' };
  }
  select(ptr) {
    this.audio.resume();
    const h = ptr.hit;
    if (!h || ptr.holding) return;
    if (h.type === 'shop') return this.pickFromShop(ptr, h.item, true);
    if (h.type === 'building') return this.pickBuilding(ptr, h.b, true);
    if (h.type === 'button') return h.button.action();
    if (h.type !== 'island') super.select(ptr);
  }
  desktopClick() {
    const ptr = this.desktopPtr;
    if (ptr.holding) return this.drop(ptr);
    const h = ptr.hit;
    if (h?.type === 'shop') return this.pickFromShop(ptr, h.item);
    if (h?.type === 'building') return this.pickBuilding(ptr, h.b);
    this.select(ptr);
  }
  showBanner(text) {
    const s = makeSign(text, { w: 1.3, h: 0.28, size: 80, bg: '#2b1a4a', fg: '#ffd54a' });
    const head = this.headPos(), fwd = new THREE.Vector3(); this.camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
    s.position.copy(head).addScaledVector(fwd, 1.2); s.position.y = head.y + 0.35; s.lookAt(head); this.scene.add(s);
    this.animate(3, (t) => { s.material.opacity = t < 0.75 ? 1 : 1 - (t - 0.75) / 0.25; s.position.y += 0.001; }, () => { this.scene.remove(s); s.material.map.dispose(); });
  }
  floatText(text, pos, color = '#ffffff', life = 2.5) {
    const s = makeSign(text, { w: 0.9, h: 0.14, size: 64, bg: 'rgba(30,20,60,0.9)', border: '#ffd54a', fg: color });
    s.position.copy(pos); s.lookAt(this.headPos()); this.scene.add(s);
    this.animate(life, (t) => { s.position.y += 0.0008; s.material.opacity = t < 0.75 ? 1 : 1 - (t - 0.75) / 0.25; }, () => { this.scene.remove(s); s.material.map.dispose(); });
  }
  updateHud() {
    if (this.gems === undefined) return;
    const el = document.getElementById('hud'); if (el) el.textContent = `Gems: ${this.gems}   Buildings: ${this.buildings?.length || 0}`;
    const ctx = this.hudCanvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 128);
    ctx.fillStyle = 'rgba(30,20,60,0.85)'; roundRect(ctx, 0, 0, 256, 128, 24); ctx.fill();
    drawGem(ctx, 44, 42, 24, '#e0115f');
    ctx.fillStyle = '#fff'; ctx.font = `bold 50px ${FONT}`; ctx.textBaseline = 'middle'; ctx.fillText(`× ${this.gems}`, 84, 44);
    ctx.font = `bold 32px ${FONT}`; ctx.fillStyle = '#ffe9a8'; ctx.fillText(`${this.buildings?.length || 0} buildings`, 22, 98);
    this.hudTex.needsUpdate = true;
  }

  // ------------------------------------------------------------ frame loop
  anchorInFront(head) {
    const fwd = new THREE.Vector3(); this.camera.getWorldDirection(fwd); fwd.y = 0;
    if (fwd.lengthSq() < 1e-4) return;
    fwd.normalize();
    // she stands at PLAYER_Z in kingdom coordinates, facing the island
    this.world.rotation.y = Math.atan2(-fwd.x, -fwd.z);
    this.world.position.set(head.x + fwd.x * PLAYER_Z, 0, head.z + fwd.z * PLAYER_Z);
    this.placePending = false;
    this.audio.cueArrive?.('castle');
  }
  frame(xrFrame) {
    const dt = Math.min(this.clock.getDelta(), 0.05), t = this.clock.elapsedTime;
    if (!this.world || !this.shop) { this.renderer.render(this.scene, this.camera); return; }
    const xr = this.renderer.xr.isPresenting;
    if (xr) { this.rig.updateMatrixWorld(true); this.renderer.xr.updateCamera(this.camera); }
    let head = this.headPos();
    if (xr && this.placePending && head.y > 0.5) this.anchorInFront(head);
    if (!xr) {
      const f = (this.keys.has('w') || this.keys.has('arrowup') ? 1 : 0) - (this.keys.has('s') || this.keys.has('arrowdown') ? 1 : 0);
      const s = (this.keys.has('d') ? 1 : 0) - (this.keys.has('a') ? 1 : 0);
      if (this.keys.has('arrowleft')) this.camera.rotation.y += 1.8 * dt;
      if (this.keys.has('arrowright')) this.camera.rotation.y -= 1.8 * dt;
      if (f || s) { const yaw = this.camera.rotation.y, sp = 1.2 * dt; this.rig.position.x = clamp(this.rig.position.x + (-Math.sin(yaw) * f + Math.cos(yaw) * s) * sp, -3, 3); this.rig.position.z = clamp(this.rig.position.z + (-Math.cos(yaw) * f - Math.sin(yaw) * s) * sp, -3, 3); }
      head = this.headPos();
    }
    // quest board, scroll, tray and shop follow her eye height (taller grown-ups, shorter girls)
    const eye = this.world.worldToLocal(head.clone()).y;
    const want = clamp(eye - 0.35, 0.75, 1.3);
    if (Math.abs(want - this.panelH) > 0.005) { this.panelH += (want - this.panelH) * Math.min(1, dt * 2); this.layoutStation(); }
    for (const p of this.panels) p.update();
    for (const a of this.anims) { a.t += dt; if (a.t >= 0) a.fn(Math.min(1, a.t / a.dur)); }
    for (const a of this.anims.filter((a) => a.t >= a.dur)) a.done?.();
    this.anims = this.anims.filter((a) => a.t < a.dur);
    this.updateParticles(dt);
    this.updatePointers(dt, []);
    // ghost ring under a held building
    this.ghost.visible = false;
    for (const ptr of [...this.pointers, this.desktopPtr]) {
      if (!ptr.holding) continue;
      const tg = this.target(ptr); if (!tg) continue;
      const foot = ptr.holding.item.foot || 1;
      this.ghost.visible = true; this.ghost.position.copy(this.cellCentre(tg.i, tg.j, foot)).setY(0.008); this.ghost.scale.setScalar(foot);
      this.ghost.material.color.setHex(tg.ok ? 0x4dff9a : 0xff5c5c);
    }
    this.tray?.updateHeld(); this.scroll?.update(dt);
    // life: spinning windmills, drifting sparkles, the shop's affordable items bob, visiting dragons
    for (const b of this.buildings) for (const s of b.spin) s.rotation.x += dt * 1.2;
    const sp = this.sparkles.geometry.attributes.position;
    for (let k = 0; k < sp.count; k++) { let y = sp.getY(k) + dt * 0.04; if (y > -0.02) y = -TOPY; sp.setY(k, y); }
    sp.needsUpdate = true;
    for (const s of this.shop.slots) { const can = this.gems >= s.item.cost; s.model.position.y = can ? 0.01 + Math.sin(t * 2 + s.slot.position.x * 9) * 0.006 : 0; s.model.rotation.y = -0.5 + (can ? Math.sin(t * 0.8) * 0.3 : 0); }
    for (const v of this.visitors) {
      v.t += dt; const a = v.t * 0.6, r = R + 0.1;
      v.d.group.position.set(Math.cos(a) * r, TOPY + 1.25 + Math.sin(v.t * 1.3) * 0.08, Math.sin(a) * r); // above her head height, clear of the quest board
      v.d.group.rotation.y = -a; // flies along the circle, head first
      v.d.wings.forEach((w, k) => (w.rotation.z = (k ? -1 : 1) * Math.sin(v.t * 8) * 0.5));
      if (v.t > v.life) this.world.remove(v.d.group);
    }
    this.visitors = this.visitors.filter((v) => v.t <= v.life);
    if (this.welcome) this.welcome.position.y = 1.6 + Math.sin(t * 1.5) * 0.02;
    const headQ = this.camera.getWorldQuaternion(new THREE.Quaternion());
    this.audio.setListener(head, new THREE.Vector3(0, 0, -1).applyQuaternion(headQ), new THREE.Vector3(0, 1, 0).applyQuaternion(headQ));
    this.renderer.render(this.scene, this.camera);
  }
}
