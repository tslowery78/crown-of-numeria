// Loads the scanned art: Poly Haven (CC0) furniture models, stone and wood PBR
// texture sets, and the sky panorama. Nothing here is required: anything that
// fails to load comes back null and the game falls back to its drawn textures
// and simple shapes.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const BASE = new URL('../assets/', import.meta.url);
export const MODELS = [
  'treasure_chest', 'Chandelier_01', 'GothicCabinet_01', 'GothicCommode_01', 'kite_shield', 'antique_estoc',
  'ornate_medieval_mace', 'wooden_bookshelf_worn', 'WoodenTable_01', 'wine_barrel_01', 'wooden_crate_01', 'Lantern_01',
  'fancy_picture_frame_01', 'horse_statue_01', 'potted_plant_02', 'vintage_grandfather_clock_01',
  'carved_wooden_plate',
];
// texture set -> size of one texture tile in metres (from the scans' real-world size)
export const SURFACES = { castle_wall_varriation: 2.4, medieval_blocks_02: 2, monastery_stone_floor: 2.5, old_wooden_floor_02: 2.2, dark_wooden_planks: 2 };
export const ART_FLOORS = ['entrance', 'hall', 'library', 'armory', 'crystal', 'tower'];
export const ART = [
  ...['kingdom', 'dragon', 'sunset', 'unicorn'].map((n) => `painting-${n}`),
  ...ART_FLOORS.map((n) => `banner-${n}`),
  // rug-<floor> and tapestry-garden/journey are wired in but not painted yet; add them here when they exist
];

const settle = (p) => p.then((v) => v, (e) => { console.warn('asset failed', e?.message || e); return null; });

// Started once (the setup page kicks it off early so the castle is ready when she taps Enter).
let pending = null;
export function loadAssets(opts) { return (pending ??= load(opts)); }

function load({ timeout = 30000 } = {}) {
  const tl = new THREE.TextureLoader(), gl = new GLTFLoader(), aniso = 8;
  const tex = (file, srgb) => tl.loadAsync(new URL(`tex/${file}`, BASE).href).then((t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
  // map + normal + packed AO/roughness/metal ("arm"), repeat chosen so a 1.5 m UV tile matches the scan size
  const surface = async (name, size) => {
    const [map, normalMap, arm] = await Promise.all([tex(`${name}_diff.jpg`, true), tex(`${name}_nor.jpg`), tex(`${name}_arm.jpg`)]);
    for (const t of [map, normalMap, arm]) t.repeat.setScalar(1.5 / size);
    return { map, normalMap, aoMap: arm, roughnessMap: arm, metalnessMap: arm, roughness: 1, metalness: 1 };
  };
  const model = async (name) => {
    const gltf = await gl.loadAsync(new URL(`models/${name}.glb`, BASE).href);
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      o.matrixAutoUpdate = true;
      for (const m of [].concat(o.material)) {
        // transmission needs an extra render pass per eye: too costly on Quest, so fake the glass
        if (m.transmission > 0) { m.transmission = 0; m.transparent = true; m.opacity = 0.35; m.roughness = 0.05; }
        if (m.map) m.map.anisotropy = aniso;
      }
    });
    return gltf.scene;
  };
  const sky = tl.loadAsync(new URL('sky/sky_4k.jpg', BASE).href).then((t) => { t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace; return t; });
  const art = (name) => tl.loadAsync(new URL(`art/${name}.webp`, BASE).href).then((t) => {
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t; // clamp edges; the painted art must not repeat like stone tiles
  });
  const all = Promise.all([
    Promise.all(Object.entries(SURFACES).map(([n, s]) => settle(surface(n, s)).then((v) => [n, v]))),
    Promise.all(MODELS.map((n) => settle(model(n)).then((v) => [n, v]))),
    settle(sky),
    Promise.all(ART.map((n) => settle(art(n)).then((v) => [n, v]))),
  ]).then(([surf, mods, skyTex, artTex]) => ({ surfaces: Object.fromEntries(surf), models: Object.fromEntries(mods), sky: skyTex, art: Object.fromEntries(artTex) }));
  const empty = { surfaces: {}, models: {}, sky: null, art: {} };
  return Promise.race([all, new Promise((res) => setTimeout(() => res(empty), timeout))]);
}
