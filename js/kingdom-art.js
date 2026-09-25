// Optional storybook surfaces. Like assets.js, every failure settles to null.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { canvasTexture } from './game.js';

const FILES = ['island-meadow', 'island-earth', 'storybook-sky', 'meadow-tile', 'carved-wood', 'parchment'];
let pending;
export function loadKingdomArt() {
  return pending ??= Promise.all(FILES.map(async (name) => {
    let timer;
    const load = new THREE.TextureLoader().loadAsync(new URL(`../assets/kingdom/art/${name}.webp`, import.meta.url).href)
      .then((t) => {
        t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
        if (name === 'island-earth' || name === 'meadow-tile') {
          t.wrapS = t.wrapT = THREE.RepeatWrapping;
          t.repeat.set(...(name === 'island-earth' ? [3, 1] : [28, 28]));
        }
        return t;
      });
    const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${name}: timeout`)), 10000); });
    const texture = await Promise.race([load, timeout]).then((t) => t, (e) => {
      console.warn('kingdom art failed', name, e?.message || e); return null;
    }).finally(() => clearTimeout(timer));
    // A slow image must not leak a GPU texture or swap the scene after startup.
    if (!texture) load.then((t) => t.dispose(), () => {});
    return [name, texture];
  })).then(Object.fromEntries);
}

// Generated brushwork can differ slightly at the panorama's two edges. Blend
// only that narrow boundary in the existing dome pass, without another texture.
export function softenSkySeam(material) {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      #ifdef USE_MAP
        vec4 paintedSky = texture2D(map, vMapUv);
        float edge = min(vMapUv.x, 1.0 - vMapUv.x);
        float feather = 0.5 * (1.0 - smoothstep(0.0, 0.025, edge));
        if (feather > 0.0) {
          paintedSky = mix(paintedSky, texture2D(map, vec2(1.0 - vMapUv.x, vMapUv.y)), feather);
        }
        diffuseColor *= paintedSky;
      #endif
    `);
  };
  material.customProgramCacheKey = () => 'kingdom-painted-sky-seam-v1';
}

// The kingdom dragon only animates its wing pivots. Bake the static colored
// pieces into one mesh, retaining both original wing pivots for the flap.
export function batchKingdomDragon(dragon) {
  for (const wing of dragon.wings) dragon.group.remove(wing);
  dragon.group.updateMatrixWorld(true);
  const pieces = [], geometries = new Set(), materials = new Set();
  dragon.group.traverse((o) => {
    if (!o.isMesh) return;
    let geo = o.geometry.clone().applyMatrix4(o.matrixWorld);
    if (geo.index) { const indexed = geo; geo = geo.toNonIndexed(); indexed.dispose(); }
    geo.deleteAttribute('uv');
    const colors = new Float32Array(geo.attributes.position.count * 3);
    for (let k = 0; k < colors.length; k += 3) o.material.color.toArray(colors, k);
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3)); pieces.push(geo);
    geometries.add(o.geometry); materials.add(o.material);
  });
  const body = new THREE.Mesh(mergeGeometries(pieces), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .6 }));
  for (const geo of [...pieces, ...geometries]) geo.dispose();
  for (const mat of materials) mat.dispose();
  dragon.group.clear(); dragon.group.add(body, ...dragon.wings);
  return dragon;
}

// Five submissions, including the temporary rainbow; no lights or shadow casters.
export function makeIslandMagic(island, radius) {
  const soft = canvasTexture(64, 64, (c, w) => {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, '#fff'); g.addColorStop(0.15, 'rgba(255,255,255,.9)');
    g.addColorStop(0.45, 'rgba(255,255,255,.2)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, w);
  });
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft, color: 0x91e8ed, transparent: true, opacity: 0.24, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  glow.position.set(0, -0.49, 0); glow.scale.set(.9, .3, 1); island.add(glow);

  const crystalGeo = new THREE.LatheGeometry([new THREE.Vector2(0, 0), new THREE.Vector2(.014, .008), new THREE.Vector2(.014, .052), new THREE.Vector2(0, .08)], 5);
  const crystals = new THREE.InstancedMesh(crystalGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x478f99, emissiveIntensity: 0.65, roughness: 0.3, flatShading: true }), 15);
  const dummy = new THREE.Object3D(), color = new THREE.Color();
  for (let k = 0; k < 15; k++) {
    const cluster = Math.floor(k / 5), a = [0.35, 2.45, 4.05][cluster] + (k % 5 - 2) * .038;
    const r = radius - .055 + (k % 2) * .016;
    dummy.position.set(Math.cos(a) * r, -.012, Math.sin(a) * r);
    dummy.rotation.set(Math.cos(a) * .22, a, -Math.sin(a) * .22);
    dummy.scale.setScalar([.65, 1.05, 1.55, .9, .6][k % 5]); dummy.updateMatrix();
    crystals.setMatrixAt(k, dummy.matrix); crystals.setColorAt(k, color.setHex([0x90e8dc, 0xb9a0f3, 0x78cfe6][k % 3]));
  }
  island.add(crystals);

  const count = 36, positions = new Float32Array(count * 3), hues = new Float32Array(count * 3);
  for (let k = 0; k < count; k++) { color.setHex(k % 4 ? 0xffe8a0 : 0xb6fff0); color.toArray(hues, k * 3); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(hues, 3));
  const motes = new THREE.Points(geo, new THREE.PointsMaterial({ map: soft, size: .025, vertexColors: true, transparent: true, opacity: .8, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  motes.frustumCulled = false; island.add(motes);

  // Each butterfly is two leaf-shaped wings, all instanced in one mesh.
  const wing = new THREE.Shape(); wing.moveTo(0, 0); wing.bezierCurveTo(.024, .035, .034, .015, .025, .001); wing.bezierCurveTo(.033, -.02, .009, -.023, 0, 0);
  const wingGeo = new THREE.ShapeGeometry(wing, 6), wingColors = [];
  for (let k = 0; k < wingGeo.attributes.position.count; k++) {
    const x = wingGeo.attributes.position.getX(k), shade = x < .003 ? .12 : 1;
    wingColors.push(shade, shade, shade);
  }
  wingGeo.setAttribute('color', new THREE.Float32BufferAttribute(wingColors, 3));
  const butterflies = new THREE.InstancedMesh(wingGeo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, vertexColors: true, color: 0xffffff }), 12);
  butterflies.instanceMatrix.setUsage(THREE.DynamicDrawUsage); butterflies.frustumCulled = false;
  for (let k = 0; k < 12; k++) butterflies.setColorAt(k, color.setHex([0xffcb7a, 0xc4a2ee, 0xf3a5ba][Math.floor(k / 2) % 3]));
  island.add(butterflies);

  const arc = new THREE.RingGeometry(.86, 1.02, 64, 7, 0, Math.PI), colors = [];
  const p = arc.attributes.position, palette = [0xc9a0f3, 0x9fb6ed, 0x8adcca, 0xd9e998, 0xffdc8f, 0xffb291, 0xf493b0];
  for (let k = 0; k < p.count; k++) {
    const band = Math.min(6, Math.floor((Math.hypot(p.getX(k), p.getY(k)) - .86 + .0001) / .16 * 7));
    color.setHex(palette[Math.max(0, band)]); colors.push(color.r, color.g, color.b);
  }
  arc.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const rainbow = new THREE.Mesh(arc, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, forceSinglePass: true }));
  rainbow.position.set(0, .12, -.18); rainbow.visible = false; island.add(rainbow);
  let rainbowLeft = 0;
  const update = (dt, t) => {
    glow.position.y = -.49 + Math.sin(t * 1.3) * .018; glow.material.opacity = .22 + Math.sin(t * 1.1) * .035;
    for (let k = 0; k < count; k++) {
      const a = k * 2.39996 + t * .07, r = radius * (.35 + .55 * ((k * 13 % 37) / 37));
      positions[k * 3] = Math.cos(a) * r; positions[k * 3 + 1] = .05 + (k % 7) * .025 + Math.sin(t * .7 + k) * .035; positions[k * 3 + 2] = Math.sin(a) * r;
    }
    geo.attributes.position.needsUpdate = true;
    for (let k = 0; k < 6; k++) {
      const a = k * Math.PI / 3 + Math.sin(t * .3 + k) * .15;
      for (let side = 0; side < 2; side++) {
        dummy.position.set(Math.cos(a) * .70, .09 + Math.sin(t * 1.6 + k) * .025, Math.sin(a) * .70);
        dummy.rotation.set(-Math.PI / 2, (side ? Math.PI : 0) + (side ? -1 : 1) * (.35 + Math.sin(t * 12 + k) * .65), a);
        dummy.scale.setScalar(1); dummy.updateMatrix(); butterflies.setMatrixAt(k * 2 + side, dummy.matrix);
      }
    }
    butterflies.instanceMatrix.needsUpdate = true;
    rainbowLeft = Math.max(0, rainbowLeft - dt); rainbow.visible = rainbowLeft > 0;
    rainbow.material.opacity = .52 * Math.min(1, (9 - rainbowLeft) / 1.2, rainbowLeft / 2);
  };
  update(0, 0);
  return { soft, update, celebrate: () => { rainbowLeft = 9; }, rainbow };
}
