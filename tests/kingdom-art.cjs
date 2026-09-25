// Render the populated kingdom and exercise optional-art failure without a socket.
// Usage: node tests/kingdom-art.cjs
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
    const root = path.join(__dirname, '..'), errors = [];
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png' };
    let missing = false;
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('http://castle.test/**', (route) => {
      const pathname = new URL(route.request().url()).pathname, file = path.join(root, pathname);
      if ((missing && pathname.includes('/kingdom/art/')) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
      return route.fulfill({ status: 200, contentType: types[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
    });
    await page.goto('http://castle.test/index.html?player=ArtCheck&grade=2');
    await page.evaluate(() => {
      const spots = [['tree', -3, 1], ['house', 0, -2], ['windmill', 2, -1], ['tower', 1, 1], ['wizard', -1, -3], ['fountain', 0, 1], ['stall', 2, 1], ['flowers', 1, -3], ['camp', 3, 0], ['lantern', -1, 2], ['cart', 2, 2], ['castle', -1, -1], ['cottage', 3, -1]];
      localStorage.setItem('mathcastle.kingdom.artcheck', JSON.stringify({ v: 1, gems: 11, built: spots.map(([id, i, j], k) => ({ id, i, j, rot: 0, seed: k + 7 })), quests: 1, everBuilt: 13 }));
    });
    const start = async () => {
      await page.evaluate(() => document.getElementById('deskBtn').click());
      await page.waitForFunction(() => window.__castle?.shop, null, { timeout: 120000 });
    };
    await start();
    const art = await page.evaluate(() => {
      const g = __castle; g.renderer.setAnimationLoop(null); g.welcome.visible = false;
      const measure = () => { g.renderer.info.autoReset = false; g.renderer.info.reset(); g.renderer.render(g.scene, g.camera); const calls = g.renderer.info.render.calls; g.renderer.info.autoReset = true; return calls; };
      const r = { loaded: Object.values(g.kingdomArt).every(Boolean), buildings: g.buildings.length };
      g.rig.position.set(0, 0, 1.9); g.camera.rotation.set(-.45, 0, 0); r.normalCalls = measure();
      g.questComplete(g.board); g.islandMagic.update(1.5, 1.5); r.questCalls = measure(); r.rainbowVisible = g.islandMagic.rainbow.visible;
      g.dragonVisit(); r.dragons = g.visitors.length;
      g.islandMagic.update(10, 12); r.rainbowExpired = !g.islandMagic.rainbow.visible;
      g.visitors.forEach((v) => g.world.remove(v.d.group)); g.visitors = [];
      g.shrinkDown(); g.camera.rotation.set(.05, -.8, 0); r.visitCalls = measure();
      const lights = []; g.scene.traverse((o) => { if (o.isLight) lights.push(o); });
      r.shadowLights = lights.filter((o) => o.castShadow).length;
      // Contact shadows must follow a lifted and replaced building without duplicates.
      g.growBack(); const first = g.buildings[0]; g.liftBuilding(first); r.liftedShadows = g.blobs.count;
      g.placeBuilding({ id: first.id, i: first.i, j: first.j, rot: first.rot, seed: first.seed }, false); r.placedShadows = g.blobs.count;
      return r;
    });
    assert.equal(art.loaded, true); assert.equal(art.buildings, 13);
    for (const key of ['normalCalls', 'questCalls', 'visitCalls']) assert.ok(art[key] <= 150, `${key}: ${art[key]}`);
    assert.equal(art.rainbowVisible, true); assert.equal(art.rainbowExpired, true); assert.equal(art.dragons, 1); assert.equal(art.shadowLights, 1);
    assert.equal(art.liftedShadows, 12); assert.equal(art.placedShadows, 13);
    missing = true; await page.reload(); await start();
    const fallback = await page.evaluate(() => {
      const g = __castle; g.renderer.setAnimationLoop(null); g.shrinkDown(); g.renderer.render(g.scene, g.camera);
      const r = { allNull: Object.values(g.kingdomArt).every((t) => t === null), canvasGrass: g.islandTop.material.map.isCanvasTexture, gradientSky: g.visitEnv.children[0].material.vertexColors, buildings: g.buildings.length };
      g.growBack(); r.shopBack = g.shop.group.visible; return r;
    });
    assert.deepEqual(fallback, { allNull: true, canvasGrass: true, gradientSky: true, buildings: 13, shopBack: true });
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ art, fallback, errors }, null, 2));
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
