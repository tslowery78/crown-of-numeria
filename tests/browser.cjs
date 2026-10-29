const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const url=process.argv[2]||'http://127.0.0.1:8765/';
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1280,height:900}}), errors=[];
  // Optional: serve the project straight from disk (for machines where a local HTTP server
  // can't be reached). Usage: node tests/browser.cjs http://castle.test/ --files
  if(process.argv.includes('--files')){
   const path=require('node:path'),root=path.join(__dirname,'..'),types={'.html':'text/html','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.txt':'text/plain','.jpg':'image/jpeg','.png':'image/png'};
   await page.route(new URL(url).origin+'/**',route=>{const f=path.join(root,decodeURIComponent(new URL(route.request().url()).pathname));if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){const idx=path.join(f,'index.html');if(fs.existsSync(idx))return route.fulfill({status:200,contentType:'text/html',body:fs.readFileSync(idx)});return route.fulfill({status:404,body:''});}route.fulfill({status:200,contentType:types[path.extname(f)]||'application/octet-stream',body:fs.readFileSync(f)});});
  }
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url+'?player=Regression&grade=2');await page.locator('#quickEdit').click();
  for (const style of ['Princess','Knight','Fairy','Explorer','Wizard']) await page.getByRole('button',{name:style,exact:true}).click();
  await page.getByRole('button',{name:'Braids',exact:true}).click();
  const dialogs=[];page.on('dialog',async d=>{dialogs.push(d.message());await d.accept();});
  await page.locator('#hwOnly').check();await page.locator('#homework').fill('bad line');await page.locator('#deskBtn').click();
  assert.match(dialogs.pop(),/fix the homework/);assert.equal(await page.evaluate(()=>!!window.__castle),false);
  await page.locator('#homework').fill('');await page.locator('#deskBtn').click();assert.match(dialogs.pop(),/at least one valid/);
  await page.locator('#hwOnly').uncheck();
  await page.locator('#homework').fill('First | 1/2\nSecond | -1 1/2\n'+Array.from({length:6},(_,i)=>`Homework ${i+3} | ${i+3}`).join('\n'));
  await page.evaluate(()=>document.querySelector('.modeChips .chip[data-mode=castle]').click());await page.locator('#deskBtn').click();await page.waitForFunction(()=>window.__castle?.props);
  // Count real GPU submissions from the hidden preview, not just visibility.
  await page.evaluate(()=>{window.previewCalls=0;for(const key of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']){const old=WebGL2RenderingContext.prototype[key];WebGL2RenderingContext.prototype[key]=function(...args){if(this.canvas.id==='avPreview')previewCalls++;return old.apply(this,args);};}});
  await page.waitForTimeout(500);assert.equal(await page.evaluate(()=>previewCalls),0);
  const game=await page.evaluate(async()=>{
   const g=__castle,T=await import('three');g.renderer.setAnimationLoop(null);const p=g.props,r={};
   r.initialHomeworkIndex=g.source.hwIndex;r.deferred=g.panels.slice(1).every(p=>!p.problem);
   r.fractionKeys=g.locks[0].panel.buttons.map(b=>b.id);
   const entered=[],floors=[];
   for(let floor=0;floor<6;floor++){
    const panel=floor===5?g.finalChest.panel:g.locks[floor].panel;
    while(panel.state==='solving'){
     entered.push(panel.problem.text);panel.busyUntil=0;panel.input='';
     if(panel.problem.choices)panel.pressKey('choice:'+panel.problem.answer);
     else{for(const k of panel.problem.answer)panel.pressKey(k);panel.pressKey('OK');}
     // Abort rather than hanging if the displayed answer cannot be entered.
     if(!panel.after)throw Error('Answer not accepted: '+panel.problem.text+' / '+panel.input);
     panel.busyUntil=0;panel.update();
    }
    floors.push(g.level+1);
    if(floor<5)for(let i=0;i<140;i++)g.updateLift(.05,g.headPos());
    g.frame();
   }
   r.entered=entered;r.floors=floors;r.correct=g.stats.correct;r.dragon=p.dragon.state.perch;
   g.level=3;
   r.bowling=[];for(let round=0;round<2;round++){p.knock(p.pins[0],new T.Vector3(1,0,0));r.bowling.push(p.pins[0].down);for(let i=0;i<140;i++)p.updatePins(.05,[]);}
   g.level=1;const a=p.apples[0];a.mesh.position.copy(p.basket.position).add(new T.Vector3(0,.1,0));a.vel.set(0,0,0);p.updateBasket();
   r.basket=[p.basketCount];p.grab(a,g.deskHolder);r.basket.push(p.basketCount);p.release(a);a.mesh.position.copy(p.basket.position).add(new T.Vector3(0,.1,0));a.vel.set(0,0,0);p.updateBasket();r.basket.push(p.basketCount);
   g.level=0;const ball=p.bodies.find(x=>x.kind==='ball');ball.mesh.position.set(g.W/2-ball.r-.01,.5,0);ball.vel.set(3,0,0);p.step(ball,.02);r.bounce=ball.vel.x<0;
   ball.mesh.position.set(0,1.4,g.D/2-.1);ball.vel.set(0,1,4);for(let i=0;i<20;i++)p.step(ball,.01);r.outside=ball.outside;for(let i=0;i<600;i++)p.step(ball,.01);r.respawn=!ball.outside&&ball.mesh.position.distanceTo(ball.home)<1;
   const helmet=p.bodies.find(x=>x.kind==='helmet');p.wear(helmet);r.helmet=helmet.worn&&helmet.mesh.parent===g.avatar.worn;p.unwear(helmet);p.respawn(helmet);
   p.cat.state.cool=0;p.updateCreatures(.01,0,g.headPos(),[{pos:p.cat.group.position.clone().add(new T.Vector3(0,.15,0)),vel:new T.Vector3()}]);r.cat=p.cat.state.purr>0;
   g.level=4;for(const bubble of p.bubbles)g.world.remove(bubble.m);p.bubbles=[];p.bubbleT=0;p.updateBubbles(.01,0,[]);const before=p.bubbles.length;p.updateBubbles(.01,0,[{pos:p.bubbles[0].m.position.clone(),vel:new T.Vector3()}]);r.bubble=before===1&&p.bubbles.length===0;
   const crystal=p.bodies.find(x=>x.crystal);p.touchCrystals([{pos:crystal.mesh.position.clone(),vel:new T.Vector3()}]);r.crystal=crystal.cool===.5;
   g.level=2;const old=p.owl.head.rotation.y;p.updateCreatures(.1,0,new T.Vector3(-.8,8.5,0),[]);r.owl=p.owl.head.rotation.y!==old;
   const plane=p.bodies.find(x=>x.kind==='plane');plane.mesh.position.set(0,8.5,0);plane.vel.set(0,0,3);for(let i=0;i<60;i++)p.step(plane,1/60);r.planeDistance=Math.abs(plane.mesh.position.z);
   g.level=0;g.rig.position.set(0,0,0);g.camera.rotation.set(0,0,0);g.scene.updateMatrixWorld(true);g.desktopPtr.hit={type:'grab',body:ball,distance:1};g.desktopClick();r.grab=g.desktopPtr.holding===ball;p.update(.02,1,g.headPos(),[]);g.desktopClick();r.throw=!ball.held&&ball.vel.length()>1;
   r.wind=g.audio.windPanner?.panningModel;
   g.level=5;g.rig.position.set(0,18,0);g.camera.rotation.set(0,Math.PI/2,0);g.renderer.setAnimationLoop(()=>g.frame());return r;
  });
  assert.equal(game.initialHomeworkIndex,1);assert.ok(game.deferred);assert.ok(game.fractionKeys.includes('/')&&game.fractionKeys.includes('.')&&game.fractionKeys.includes('±'));
  assert.deepEqual(game.entered.slice(0,8),['First','Second',...Array.from({length:6},(_,i)=>`Homework ${i+3}`)]);
  assert.deepEqual(game.floors,[1,2,3,4,5,6]);assert.equal(game.correct,13);assert.ok(game.dragon);
  assert.deepEqual(game.bowling,[true,true]);assert.deepEqual(game.basket,[1,0,1]);
  for(const key of ['bounce','outside','respawn','helmet','cat','bubble','crystal','owl','grab','throw'])assert.equal(game[key],true,key);
  assert.ok(game.planeDistance>2);assert.equal(game.wind,'HRTF');
  // the crown lands after its fly-up animation; wait for it rather than a fixed time (software GL is slow)
  await page.waitForFunction(()=>__castle.avatar.worn.children.length>0,null,{timeout:60000});
  assert.equal(await page.evaluate(()=>__castle.avatar.worn.children[0]?.layers.mask),8);
  if(process.env.TEST_OUTPUT){fs.mkdirSync(process.env.TEST_OUTPUT,{recursive:true});await page.screenshot({path:process.env.TEST_OUTPUT+'/crown-fixed.png'});}
  await page.reload();await page.locator('#quickEdit').click();
  assert.equal(await page.locator('#avStyle .on').innerText(),'Wizard');assert.equal(await page.locator('#avHairStyle .on').innerText(),'Braids');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mathcastle.progress.regression')).castles),1);
  await page.evaluate(()=>document.querySelector('.modeChips .chip[data-mode=castle]').click());await page.locator('#deskBtn').click();await page.waitForFunction(()=>window.__castle?.props);
  const xr=await page.evaluate(async()=>{
   const g=__castle,T=await import('three');g.renderer.setAnimationLoop(null);const original=navigator.xr;
   const methods={setSession:g.renderer.xr.setSession,getReferenceSpace:g.renderer.xr.getReferenceSpace,setReferenceSpace:g.renderer.xr.setReferenceSpace};
   const r={};let bounds,session,ref;
   Object.defineProperty(navigator,'xr',{configurable:true,value:{requestSession:async()=>{ref=new EventTarget();ref.boundsGeometry=bounds;session=new EventTarget();session.ended=false;session.requestReferenceSpace=async()=>ref;session.end=async()=>{session.ended=true;session.dispatchEvent(new Event('end'));};return session;}}});
   g.renderer.xr.setSession=async()=>{};g.renderer.xr.getReferenceSpace=()=>ref;g.renderer.xr.setReferenceSpace=space=>{r.exactSpace=space===ref;};
   for(const size of [1.4,0,3]){
    bounds=size?[{x:-size/2,z:-size/2},{x:size/2,z:-size/2},{x:size/2,z:size/2},{x:-size/2,z:size/2}]:[];
    g.opts.roomSize='auto';try{await g.enterVR();r['bounds'+size]={built:[g.W,g.D],ended:session.ended};}catch(e){r['bounds'+size]={error:e.message,ended:session.ended};}
   }
   // Guardian-fit mode: a reset may change the bounds, so the session restarts.
   {let called=false;g.onResetVR=()=>{called=true;};ref.dispatchEvent(new Event('reset'));await Promise.resolve();r.autoReset={called,ended:session.ended};}
   if(!session.ended)await session.end();g.opts.roomSize='2.5';await g.enterVR();
   const q=new T.Quaternion().setFromEuler(new T.Euler(0,.7,0));
   g.calibrateXR({transform:{position:{x:.6,y:1.2,z:-.4},orientation:q}});
   g.camera.position.set(.6,1.2,-.4);g.camera.quaternion.copy(q);g.scene.updateMatrixWorld(true);
   r.head=g.headPos().toArray();r.forward=g.camera.getWorldDirection(new T.Vector3()).toArray();
   g.rig.position.y=7.2;g.scene.updateMatrixWorld(true);r.liftedHead=g.headPos().toArray();
   // Measured mode, reset WITH a transform (off-centre, rotated, mid-lift): the castle must stay on
   // the same physical spot. A physical point p has old coords p_old and new coords T^-1 p_old.
   const resets=[];
   for(const [px,pz,yaw,lift] of [[0,0,0,0],[1.1,-0.7,0.4,7.2],[-0.9,0.8,-1.2,3.6]]){
    g.rig.position.y=lift;g.rig.updateMatrixWorld(true);
    const pOld=new T.Vector3(px,1.3,pz),before=pOld.clone().applyMatrix4(g.rig.matrixWorld);
    const tq=new T.Quaternion().setFromEuler(new T.Euler(0,yaw,0)),tp=new T.Vector3(0.5+px,0,-0.3+pz);
    const ev=new Event('reset');ev.transform={position:{x:tp.x,y:tp.y,z:tp.z},orientation:{x:tq.x,y:tq.y,z:tq.z,w:tq.w}};
    let called=false;g.onResetVR=()=>{called=true;};ref.dispatchEvent(ev);await Promise.resolve();
    g.rig.updateMatrixWorld(true);
    const pNew=pOld.clone().applyMatrix4(new T.Matrix4().compose(tp,tq,new T.Vector3(1,1,1)).invert());
    resets.push({drift:before.distanceTo(pNew.applyMatrix4(g.rig.matrixWorld)),y:g.rig.position.y,lift,called,ended:session.ended,prompt:!!g.centerPrompt});
   }
   r.transformResets=resets;
   // Measured mode, reset WITHOUT a transform: keep playing, ask her to walk back to the middle.
   {let called=false;g.onResetVR=()=>{called=true;};ref.dispatchEvent(new Event('reset'));await Promise.resolve();
    r.noTransformReset={prompt:g.centerPrompt,called,ended:session.ended,calibratingBefore:!!g.xrCalibrating};g.confirmCenter();r.noTransformReset.calibratingAfter=g.xrCalibrating;r.noTransformReset.promptAfter=g.centerPrompt;}
   Object.assign(g.renderer.xr,methods);Object.defineProperty(navigator,'xr',{configurable:true,value:original});return r;
  });
  for(const key of ['bounds1.4','bounds0']){assert.ok(xr[key].error,key);assert.ok(xr[key].ended,key);}
  assert.ok(xr.bounds3.built.every(n=>n>=1.6&&n<=2.7));assert.ok(xr.exactSpace);
  assert.ok(Math.abs(xr.head[0])<1e-9&&Math.abs(xr.head[2])<1e-9);assert.ok(Math.abs(xr.head[1]-1.2)<1e-9);
  assert.ok(Math.abs(xr.forward[0])<1e-9&&Math.abs(xr.forward[2]+1)<1e-9);assert.ok(Math.abs(xr.liftedHead[1]-8.4)<1e-9);
  assert.deepEqual(xr.autoReset,{called:true,ended:true});
  for(const t of xr.transformResets){assert.ok(t.drift<1e-9,'drift '+t.drift);assert.equal(t.y,t.lift);assert.equal(t.called,false);assert.equal(t.ended,false);assert.equal(t.prompt,false);}
  assert.deepEqual(xr.noTransformReset,{prompt:true,called:false,ended:false,calibratingBefore:false,calibratingAfter:true,promptAfter:false});
  // Trigger (ray) writing on the Magic Scroll must make one continuous line: the fingertip check that
  // runs every frame for the same controller must not lift the ray stroke (it used to leave dots).
  const ink=await page.evaluate(async()=>{const g=__castle,T=await import("three"),s=g.scroll,ptr={};s.floor=g.level;s.clear();
   for(let k=0;k<20;k++){s.touch(ptr.touchKey??={},new T.Vector3(0,1.3,0));s.rayDraw(ptr,{x:0.2+k*0.02,y:0.5});}
   s.lift(ptr);return {paths:s.paths.length,points:s.paths[0].p.length/2,w:s.w};});
  assert.deepEqual({paths:ink.paths,points:ink.points},{paths:1,points:20});
  await page.goto(url+'?player=Grade4Regression&grade=4');await page.locator('#quickEdit').click();
  await page.locator('#homework').fill('Fraction | 7/8\nNegative decimal | -4.5\nWhich symbol? | < | <; >; =');await page.locator('#hwOnly').check();await page.evaluate(()=>document.querySelector('.modeChips .chip[data-mode=castle]').click());await page.locator('#deskBtn').click();await page.waitForFunction(()=>window.__castle?.props);
  const grade4=await page.evaluate(()=>{
   const g=__castle;g.renderer.setAnimationLoop(null);
   const first=g.locks[0].panel;first.input='123';first.pressKey('OK');
   for(let floor=0;floor<6;floor++){
    const p=floor===5?g.finalChest.panel:g.locks[floor].panel;
    while(p.state==='solving'){
     p.busyUntil=0;p.input='';if(p.problem.choices)p.pressKey('choice:'+p.problem.answer);else{for(const k of p.problem.answer)p.pressKey(k);p.pressKey('OK');}
     if(!p.after)throw Error('Grade 4 answer not accepted');p.busyUntil=0;p.update();
    }
    if(floor<5)for(let i=0;i<140;i++)g.updateLift(.05,g.headPos());
   }
   return {level:g.level+1,correct:g.stats.correct,missed:g.stats.missed.length,homeworkOnly:g.source.homeworkOnly};
  });
  assert.deepEqual(grade4,{level:6,correct:13,missed:1,homeworkOnly:true});assert.deepEqual(errors,[]);
  // My Kingdom (mixed-reality mode, played here on the desktop): a solved problem pays gems, a building
  // bought with them lands on the free cell she chose, pond cells are refused, and the kingdom survives a reload.
  await page.goto(url+'?player=KingdomRegression&grade=2');await page.locator('#quickEdit').click();
  await page.evaluate(()=>document.querySelector('.modeChips .chip[data-mode=kingdom]').click());
  await page.locator('#deskBtn').click();await page.waitForFunction(()=>window.__castle?.shop&&window.__castle.buildings);
  const kingdom=await page.evaluate(async()=>{
   const g=__castle,p=g.board,ptr=g.desktopPtr,r={start:g.gems,pieces:Object.keys(g.kit).length};
   p.busyUntil=0;p.input='';if(p.problem.choices)p.pressKey('choice:'+p.problem.answer);else{for(const k of p.problem.answer)p.pressKey(k);p.pressKey('OK');}
   // the 3 gems fly in one after another; frame() caps dt at 50 ms, so on slow software GL the flight
   // takes longer than its 1.3 s of game time. Wait for the award to land instead of a fixed sleep.
   await new Promise(res=>setTimeout(res,2500));for(let i=0;i<300&&g.gems<r.start+3;i++)await new Promise(res=>setTimeout(res,100));
   await new Promise(res=>setTimeout(res,500));r.afterSolve=g.gems;
   const put=(id,i,j)=>{const e=g.shop.slots.find(s=>s.item.id===id);if(!g.pickFromShop(ptr,e))return false;const c=g.cellCentre(i,j,e.item.foot||1);ptr.holding.obj.parent.remove(ptr.holding.obj);g.island.add(ptr.holding.obj);ptr.holding.obj.position.copy(c).setY(0.1);g.drop(ptr);return g.buildings.some(b=>b.id===id&&b.i===i&&b.j===j);};
   r.cottage=put('cottage',1,0);r.gemsAfterBuy=g.gems;r.onTaken=put('tree',1,0);r.onPond=put('tree',-2,-2);
   r.visibleMeshes=0;g.buildings[0].model.traverse(o=>{if(o.isMesh&&o.geometry.attributes.position.count)r.visibleMeshes++;});
   return r;});
  assert.ok(kingdom.pieces>=50,'kit pieces '+kingdom.pieces);assert.equal(kingdom.afterSolve,kingdom.start+3);
  assert.equal(kingdom.cottage,true);assert.equal(kingdom.gemsAfterBuy,kingdom.afterSolve-3);assert.equal(kingdom.onTaken,false);assert.equal(kingdom.onPond,false);assert.ok(kingdom.visibleMeshes>0);
  // "Shrink down": the kingdom grows 8x with its island top on her floor, the station hides, and growing back restores it all.
  Object.assign(kingdom,await page.evaluate(async()=>{const g=__castle,T=await import('three'),before=g.world.position.clone();g.shrinkDown();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
   const top=g.islandTop.getWorldPosition(new T.Vector3()),r={shrunkScale:g.world.scale.x,islandTopY:+top.y.toFixed(3),scrollHidden:!g.scroll.group.visible,shopHidden:!g.shop.group.visible,villagers:g.villagers.length};
   g.growBack();r.back=g.world.scale.x===1&&g.world.position.distanceTo(before)<1e-9&&g.shop.group.visible;return r;}));
  assert.equal(kingdom.shrunkScale,8);assert.equal(kingdom.islandTopY,0);assert.ok(kingdom.scrollHidden&&kingdom.shopHidden);assert.ok(kingdom.villagers>=2);assert.equal(kingdom.back,true);
  await page.reload();await page.locator('#deskBtn').click();await page.waitForFunction(()=>window.__castle?.shop&&window.__castle.buildings);
  kingdom.restored=await page.evaluate(()=>__castle.buildings.map(b=>b.id).join());assert.equal(kingdom.restored,'cottage');assert.deepEqual(errors,[]);
  // ---- Hands-first: stub hand input sources (joint poses + 'connected' events) drive the real input code.
  const installHands=()=>page.evaluate(async()=>{
   const T=await import('three'),g=__castle;g.renderer.setAnimationLoop(null);const v=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
   const H=window.__H={T,g,v,sleep:ms=>new Promise(r=>setTimeout(r,ms))};
   H.xrOn=()=>{H.render??=g.renderer.render;g.renderer.render=()=>{};g.renderer.xr.isPresenting=true;};
   H.xrOff=()=>{g.renderer.xr.isPresenting=false;if(H.render)g.renderer.render=H.render;};
   // a tracked hand from its wrist position, finger direction and palm normal (world space)
   H.hand=(ptr,side,wrist,along,normal)=>{
    along=along.clone().normalize();normal=normal.clone().normalize();
    const across=side==='left'?v().crossVectors(normal,along):v().crossVectors(along,normal);
    const at=(a,c)=>wrist.clone().addScaledVector(along,a).addScaledVector(across,c);
    const pts={wrist,'middle-finger-metacarpal':at(.07,0),'index-finger-metacarpal':at(.065,.025),'pinky-finger-metacarpal':at(.06,-.03),'index-finger-tip':at(.17,.02),'thumb-tip':at(.1,.06)};
    if(!ptr.src||ptr.src.handedness!==side||!ptr.src.hand)ptr.c.dispatchEvent({type:'connected',data:{handedness:side,hand:new Map(),gamepad:null,profiles:[]}});
    g.scene.updateMatrixWorld(true);ptr.hand.joints??={};
    for(const [n,p] of Object.entries(pts)){let j=ptr.hand.joints[n];if(!j){j=new T.Group();j.jointRadius=.008;ptr.hand.add(j);ptr.hand.joints[n]=j;}j.visible=true;j.position.copy(ptr.hand.worldToLocal(p.clone()));}
    ptr.hand.updateMatrixWorld(true);
   };
   H.controller=(ptr,side,buttons=[])=>ptr.c.dispatchEvent({type:'connected',data:{handedness:side,gamepad:{buttons,axes:[0,0,0,0]},profiles:[]}});
   // point a hand / controller ray from `from` at `at` (the ray is the -Z axis)
   // (XR controller spaces have matrixAutoUpdate off: the headset writes their matrices, so the stub does too)
   H.aim=(ptr,from,at)=>{g.scene.updateMatrixWorld(true);ptr.c.position.copy(g.rig.worldToLocal(from.clone()));ptr.c.updateMatrix();ptr.c.updateMatrixWorld(true);ptr.c.lookAt(from.clone().multiplyScalar(2).sub(at));ptr.c.updateMatrix();ptr.c.updateMatrixWorld(true);};
   // push a fingertip through a flat button, front to back
   H.pokeThrough=(ptr,mesh)=>{g.scene.updateMatrixWorld(true);const p=mesh.getWorldPosition(v()),n=v(0,0,1).transformDirection(mesh.matrixWorld);ptr.cool=0;g.poke(ptr,p.clone().addScaledVector(n,.03),.016);g.poke(ptr,p.clone().addScaledVector(n,-.01),.016);};
  });
  await page.goto(url+'?player=HandsCastle&grade=2');await page.locator('#quickEdit').click();
  await page.evaluate(()=>document.querySelector('.modeChips .chip[data-mode=castle]').click());await page.locator('#deskBtn').click();await page.waitForFunction(()=>window.__castle?.props);
  await installHands();
  const hands=await page.evaluate(async()=>{
   const {g,v,sleep}=__H,H=__H,r={},[L,R]=g.pointers;H.xrOn();
   g.camera.position.set(0,1.3,0);g.camera.rotation.set(0,0,0);g.scene.updateMatrixWorld(true);
   const head=g.headPos(),wrist=v(-.12,head.y-.25,head.z-.35),palmToHead=head.clone().sub(wrist);
   // wrist HUD: left palm towards her eyes shows the gem counter at the wrist; turned away hides it
   H.hand(L,'left',wrist,v(0,1,0),palmToHead);g.handMenu.update(.016);
   r.hudShown=g.handMenu.group.visible&&g.handMenu.group.parent===g.scene&&g.hudMesh.parent===g.handMenu.group;
   r.hudNearWrist=+g.handMenu.group.position.distanceTo(wrist).toFixed(3);
   H.hand(L,'left',wrist,v(0,1,0),v(0,0,-1));g.handMenu.update(.5);r.hudHiddenAway=!g.handMenu.group.visible;
   // controllers: the counter rides the left controller, leaves it on disconnect, and never follows a right hand into that slot
   H.controller(L,'left');g.handMenu.update(.016);r.hudOnController=g.handMenu.group.parent===L.c&&g.handMenu.group.visible;
   L.c.dispatchEvent({type:'disconnected',data:L.src});r.hudOffOnDisconnect=g.handMenu.group.parent===null;
   H.hand(L,'right',v(.2,1,-.3),v(0,1,0),v(-1,0,0));g.handMenu.update(.016);r.hudNotOnRightHand=g.handMenu.group.parent!==L.c&&!g.handMenu.group.visible;
   L.c.dispatchEvent({type:'disconnected',data:L.src});
   // hand menu: the left hand can't press its own menu; the right index finger pokes Pause
   H.hand(L,'left',wrist,v(0,1,0),palmToHead);g.handMenu.update(.016);
   r.menuButtons=g.uiButtons().map(b=>b.userData.button.id).filter(Boolean).sort().join();
   H.pokeThrough(L,g.handMenu.byId.pause);r.leftOwnMenuIgnored=!g.paused;
   H.hand(R,'right',v(.15,head.y-.3,head.z-.3),v(0,1,0),v(-1,0,0));
   const panel=g.locks[0].panel;panel.busyUntil=performance.now()+1000;const busy0=panel.busyUntil;
   H.pokeThrough(R,g.handMenu.byId.pause);r.pausedByPoke=!!g.paused;r.menuShowsResume=g.handMenu.byId.resume.visible&&!g.handMenu.byId.pause.visible;
   let prog=0;g.animate(1,t=>{prog=t;});const lift0=g.rig.position.y;
   H.xrOff();for(let k=0;k<4;k++){await sleep(60);g.frame();}
   r.audioSuspended=g.audio.ctx?g.audio.ctx.state==='suspended':'no audio';r.frozen=prog===0&&g.rig.position.y===lift0;
   // resume with a ray + pinch on the Resume button in front of her
   H.xrOn();g.updatePauseUi();const rb=g.pauseUi.userData.resume;g.scene.updateMatrixWorld(true);
   r.resumeInReach=+rb.getWorldPosition(v()).distanceTo(head).toFixed(3);
   H.aim(R,v(.12,head.y-.2,head.z-.05),rb.getWorldPosition(v()));g.pausedFrame(.016);r.rayOnResume=R.hit?.type==='button';
   R.c.dispatchEvent({type:'selectstart'});R.c.dispatchEvent({type:'selectend'});
   r.resumed=!g.paused;r.busyShifted=panel.busyUntil-busy0>=200;
   H.xrOff();for(let k=0;k<3;k++){await sleep(60);g.frame();}r.runsAgain=prog>0;await sleep(100);
   r.audioRunning=g.audio.ctx?g.audio.ctx.state==='running':'no audio';
   // pinch-hold room corners: a stray pinch does nothing, a 0.5 s hold marks, the controller trigger is instant
   H.xrOn();g.beginMeasure('local-floor',false);const pts=()=>g.roomMeasure.points.length;
   H.hand(L,'left',v(1,1,-1),v(0,0,-1),v(0,-1,0));
   L.c.dispatchEvent({type:'selectstart'});r.cornerNotInstant=pts()===0&&!!L.pinchHold;
   g.updatePinchHolds(.2);const dr=g.holdRing.userData.fill.geometry.drawRange.count;r.fillRing=g.holdRing.visible&&dr>0&&dr<g.holdRing.userData.fill.geometry.index.count;
   L.c.dispatchEvent({type:'selectend'});g.updatePinchHolds(.6);r.strayPinchIgnored=pts()===0&&!g.holdRing.visible;
   L.c.dispatchEvent({type:'selectstart'});g.updatePinchHolds(.3);g.updatePinchHolds(.3);r.heldPinchMarks=pts()===1;
   H.controller(L,'left');L.c.dispatchEvent({type:'selectstart'});L.c.dispatchEvent({type:'selectend'});r.triggerInstant=pts()===2;
   H.xrOff();return r;});
  assert.deepEqual(hands,{...hands,hudShown:true,hudHiddenAway:true,hudOnController:true,hudOffOnDisconnect:true,hudNotOnRightHand:true,menuButtons:'leave,pause,recenter',leftOwnMenuIgnored:true,pausedByPoke:true,menuShowsResume:true,frozen:true,rayOnResume:true,resumed:true,busyShifted:true,runsAgain:true,cornerNotInstant:true,fillRing:true,strayPinchIgnored:true,heldPinchMarks:true,triggerInstant:true});
  assert.ok(hands.hudNearWrist<.15,'hud distance '+hands.hudNearWrist);assert.ok(hands.resumeInReach<.6,'resume '+hands.resumeInReach);
  if(hands.audioSuspended!=='no audio'){assert.equal(hands.audioSuspended,true);assert.equal(hands.audioRunning,true);}
  // My Kingdom with hands: poke "Shrink down", turn with the arrow buttons, pinch-aim-release to teleport (kept on the island)
  await page.goto(url+'?player=HandsKingdom&grade=2');await page.locator('#quickEdit').click();
  await page.evaluate(()=>document.querySelector('.modeChips .chip[data-mode=kingdom]').click());
  await page.locator('#deskBtn').click();await page.waitForFunction(()=>window.__castle?.shop&&window.__castle.buildings);
  await installHands();
  const kingdomHands=await page.evaluate(async()=>{
   const {g,v}=__H,H=__H,r={},[L,R]=g.pointers;H.xrOn();
   g.camera.position.set(0,1.3,0);g.camera.rotation.set(0,0,0);g.scene.updateMatrixWorld(true);
   H.hand(R,'right',g.headPos().add(v(.2,-.4,-.3)),v(0,1,0),v(-1,0,0));
   H.pokeThrough(R,g.shrinkBtn);r.pokedShrink=g.visiting;
   let head=g.headPos();g.updateGrowButton(head);g.scene.updateMatrixWorld(true);
   const yaw0=g.rig.rotation.y;H.pokeThrough(R,g.turnBtns[1]);
   r.turnedRight=+(g.rig.rotation.y-yaw0).toFixed(6)===+(-Math.PI/6).toFixed(6);r.turnKeepsHead=g.headPos().distanceTo(head)<1e-9;
   H.pokeThrough(R,g.turnBtns[0]);r.turnedBack=Math.abs(g.rig.rotation.y-yaw0)<1e-9;
   // teleport: pinch (selectstart), aim at the meadow 3 m ahead, let go
   head=g.headPos();const fwd=g.camera.getWorldDirection(v()).setY(0).normalize(),at=head.clone().setY(0).addScaledVector(fwd,3);
   H.aim(R,head.clone().add(v(.1,-.35,0)),at);R.hit=null;R.c.dispatchEvent({type:'selectstart'});
   g.updateTeleport();r.ring=g.teleRing.visible&&g.teleRing.position.clone().setY(0).distanceTo(at)<1e-6;
   R.c.dispatchEvent({type:'selectend'});r.teleported=g.headPos().setY(0).distanceTo(at)<1e-6&&!g.teleRing.visible;
   // long hops stay on the island
   const centre=()=>g.islandTop.getWorldPosition(v()).setY(0),maxR=.86*8-.6;let worst=0;
   for(let k=0;k<4;k++){head=g.headPos();const f=g.camera.getWorldDirection(v()).setY(0).normalize();H.aim(R,head.clone().add(v(.1,-.35,0)),head.clone().setY(.3).addScaledVector(f,40));R.hit=null;R.c.dispatchEvent({type:'selectstart'});g.updateTeleport();R.c.dispatchEvent({type:'selectend'});worst=Math.max(worst,g.headPos().setY(0).distanceTo(centre()));}
   r.keptOnIsland=worst<=maxR+1e-6;r.worst=+worst.toFixed(3);
   // pause works here too
   g.setPaused(true);H.xrOff();g.frame();r.kingdomPaused=!!g.paused;g.setPaused(false);
   g.growBack();return r;});
  assert.deepEqual(kingdomHands,{...kingdomHands,pokedShrink:true,turnedRight:true,turnKeepsHead:true,turnedBack:true,ring:true,teleported:true,keptOnIsland:true,kingdomPaused:true});
  // ---- Seated play (?seated=1): no measuring or walking; every interactable within ~0.6 m of her shoulder.
  // Reach is measured from a seated shoulder point (eye height - 0.25 m, 5 cm behind the eyes); "behind" counts points behind her.
  const seatHelpers=()=>page.evaluate(()=>{const {g,v}=__H;
   __H.reach=(pts)=>{const head=g.headPos(),S=head.clone().add(v(0,-.25,.05));let max=0,behind=0;for(const p of pts){max=Math.max(max,p.distanceTo(S));if(p.z>head.z+.05)behind++;}return {max:+max.toFixed(3),behind,n:pts.length};};
   __H.panelPts=(p)=>{p.mesh.updateMatrixWorld(true);return p.buttons.map(b=>p.mesh.localToWorld(v(((b.x+b.w/2)/1024-.5)*p.w,(.5-(b.y+b.h/2)/1280)*p.h,0)));};
   __H.corners=(m)=>{m.updateMatrixWorld(true);return [[-.5,-.5],[.5,-.5],[-.5,.5],[.5,.5]].map(([x,y])=>m.localToWorld(v(x,y,0)));};});
  await page.goto(url+'?player=HandsCastle&grade=2');
  const standingDefault=await page.locator('#quickSeated').isChecked();
  await page.goto(url+'?player=SeatedCastle&grade=2&seated=1');
  const seatedBoxes=[await page.locator('#quickSeated').isChecked(),await page.locator('#seated').isChecked()];
  await page.locator('#quickEdit').click();await page.evaluate(()=>document.querySelector('.modeChips .chip[data-mode=castle]').click());await page.locator('#deskBtn').click();await page.waitForFunction(()=>window.__castle?.props);
  await installHands();await seatHelpers();
  const seated=await page.evaluate(async()=>{
   const {g,v}=__H,H=__H,r={opts:!!g.opts.seated,size:[g.W,g.D]},[L,R]=g.pointers,TOP=5;
   const sit=()=>{g.camera.position.set(0,1.15,0);g.camera.rotation.set(0,0,0);g.seatEye=1.15;g.scene.updateMatrixWorld(true);g.layoutSeated(0);g.scene.updateMatrixWorld(true);};
   sit();const panel=g.locks[0].panel;
   panel.problem={text:'12 + 7 = ?',answer:'19',hint:'count on',homework:true};panel.draw();r.keypad=H.reach(H.panelPts(panel));
   panel.problem={text:'Even or odd?',answer:'odd',hint:'',choices:['even','odd']};panel.draw();r.choices=H.reach(H.panelPts(panel));panel.newProblem();
   r.scroll=H.reach(H.corners(g.scroll.mesh));
   g.tray.bind(panel,{manip:{layout:'ten',start:3,value:'total'}});sit();r.tray=H.reach([...g.tray.slots.map(s=>g.tray.slotWorld(s)),g.tray.bowlWorld()]);
   const ch=g.chests[0],box=new H.T.Box3().setFromObject(ch.group.children[0]),S=g.headPos().add(v(0,-.25,.05));
   r.chestTouch=+box.distanceToPoint(S).toFixed(3);r.chestCentre=H.reach([box.getCenter(v())]);
   // touching the chest opens its question in the middle; the lock panel waits behind it
   g.openChestPanel(ch);const cp=ch.panel;cp.mesh.scale.setScalar(1);sit();r.chestPanel=H.reach(H.panelPts(cp));r.lockHiddenForChest=!panel.mesh.visible;
   cp.state='done';cp.mesh.visible=false;sit();r.lockBack=panel.mesh.visible;
   // solve the lock, then the Ride up button (poked by a finger) lifts her even with her head off the square
   while(panel.state==='solving'){panel.busyUntil=0;panel.input='';if(panel.problem.choices)panel.pressKey('choice:'+panel.problem.answer);else{for(const k of panel.problem.answer)panel.pressKey(k);panel.pressKey('OK');}panel.busyUntil=0;panel.update();}
   sit();r.rideShown=g.rideBtn.visible&&g.lift.state==='ready';r.ride=H.reach([g.rideBtn.getWorldPosition(v())]);
   H.hand(R,'right',v(.15,.85,-.2),v(0,1,0),v(-1,0,0));H.pokeThrough(R,g.rideBtn);r.rising=g.lift.state==='rising';
   const off=v(.9,1.15,.9);for(let i=0;i<140;i++)g.updateLift(.05,off);r.level=g.level;
   sit();r.floor2=H.reach(H.panelPts(g.locks[1].panel));r.chest2=H.reach([new H.T.Box3().setFromObject(g.chests[1].group.children[0]).getCenter(v())]);
   g.level=TOP;g.rig.position.y=18;const fin=g.finalChest.panel;fin.problem={text:'6 x 7 = ?',answer:'42',hint:'',homework:true};fin.draw();sit();r.finale=H.reach(H.panelPts(fin));
   r.welcome=g.world.children.some(o=>o.isMesh&&o.position.x===-.75);
   // in the headset: "My whole room" + seated skips corner measuring and centres on her seat; recentring re-centres
   const original=navigator.xr,methods={setSession:g.renderer.xr.setSession,getReferenceSpace:g.renderer.xr.getReferenceSpace,setReferenceSpace:g.renderer.xr.setReferenceSpace};let ref,session;
   Object.defineProperty(navigator,'xr',{configurable:true,value:{requestSession:async()=>{ref=new EventTarget();session=new EventTarget();session.requestReferenceSpace=async()=>ref;session.end=async()=>{session.dispatchEvent(new Event('end'));};return session;}}});
   g.renderer.xr.setSession=async()=>{};g.renderer.xr.getReferenceSpace=()=>ref;g.renderer.xr.setReferenceSpace=()=>{};
   g.opts.roomSize='room';await g.enterVR();r.vr={measuring:!!g.roomMeasure,calibrating:!!g.xrCalibrating,size:[g.W,g.D],type:g.fitInfo.type};
   g.xrCalibrating=false;ref.dispatchEvent(new Event('reset'));r.vr.resetRecentres=!!g.xrCalibrating&&!g.centerPrompt;
   session.dispatchEvent(new Event('visibilitychange'));r.vr.hiddenPauses=!!g.paused;await session.end();r.vr.endUnpauses=!g.paused;
   Object.assign(g.renderer.xr,methods);Object.defineProperty(navigator,'xr',{configurable:true,value:original});
   return r;});
  if(process.env.TEST_OUTPUT){await page.evaluate(()=>{const g=__castle;g.camera.position.set(0,1.15,0);g.camera.rotation.set(-.35,0,0);g.renderer.render(g.scene,g.camera);});await page.screenshot({path:process.env.TEST_OUTPUT+'/seated-castle.png'});}
  await page.goto(url+'?player=SeatedCastle&grade=2');const seatedNotSticky=!(await page.locator('#quickSeated').isChecked());
  assert.equal(standingDefault,false);assert.deepEqual(seatedBoxes,[true,true]);assert.equal(seatedNotSticky,true);
  assert.deepEqual({...seated,keypad:0,choices:0,scroll:0,tray:0,chestCentre:0,chestTouch:0,chestPanel:0,ride:0,floor2:0,chest2:0,finale:0},{opts:true,size:[3,3],keypad:0,choices:0,scroll:0,tray:0,chestCentre:0,chestTouch:0,chestPanel:0,ride:0,floor2:0,chest2:0,finale:0,lockHiddenForChest:true,lockBack:true,rideShown:true,rising:true,level:1,welcome:true,vr:{measuring:false,calibrating:true,size:[3,3],type:'local-floor',resetRecentres:true,hiddenPauses:true,endUnpauses:true}});
  for(const k of ['keypad','choices','scroll','tray','chestCentre','chestPanel','ride','floor2','chest2','finale']){assert.ok(seated[k].max<=.62,`seated ${k} reach ${seated[k].max} m`);assert.equal(seated[k].behind,0,`seated ${k} behind her`);}
  assert.ok(seated.chestTouch<=.5,'chest touch '+seated.chestTouch);
  // seated My Kingdom: island top at table height just in front of her knees; board, tray, scroll and shop within reach
  await page.goto(url+'?player=SeatedKingdom&grade=2&seated=1');await page.locator('#quickEdit').click();
  await page.evaluate(()=>document.querySelector('.modeChips .chip[data-mode=kingdom]').click());
  await page.locator('#deskBtn').click();await page.waitForFunction(()=>window.__castle?.shop&&window.__castle.buildings);
  await installHands();await seatHelpers();
  const seatedKingdom=await page.evaluate(async()=>{
   const {g,v}=__H,H=__H,r={},[L,R]=g.pointers;
   g.camera.position.set(0,1.15,0);g.camera.rotation.set(0,0,0);g.scene.updateMatrixWorld(true);
   const eye=g.world.worldToLocal(g.headPos()).y;g.panelH=Math.min(1.3,Math.max(.6,eye-.3));g.layoutStation();g.scene.updateMatrixWorld(true);
   const head=g.headPos(),top=g.islandTop.getWorldPosition(v());r.tableTop=+top.y.toFixed(3);r.nearEdge=+(Math.hypot(top.x-head.x,top.z-head.z)-.86).toFixed(3);
   const b=g.board;if(b.problem&&!b.problem.choices){}else{b.problem={text:'3 + 4 = ?',answer:'7',hint:''};}b.draw();r.board=H.reach(H.panelPts(b));
   r.shop=H.reach([...g.shop.slots.map(s=>s.hit.getWorldPosition(v())),g.shrinkBtn.getWorldPosition(v()),g.moveBtn.getWorldPosition(v())]);
   r.scroll=H.reach(H.corners(g.scroll.mesh));
   g.tray.bind(b,{manip:{layout:'ten',start:3,value:'total'}});g.layoutStation();g.scene.updateMatrixWorld(true);r.tray=H.reach([...g.tray.slots.map(s=>g.tray.slotWorld(s)),g.tray.bowlWorld()]);
   // shrink with a finger poke, then hop with pinch-to-teleport
   H.xrOn();H.hand(R,'right',head.clone().add(v(.15,-.4,-.2)),v(0,1,0),v(-1,0,0));H.pokeThrough(R,g.shrinkBtn);r.shrunk=g.visiting;
   const h2=g.headPos(),at=h2.clone().setY(0).addScaledVector(g.camera.getWorldDirection(v()).setY(0).normalize(),2.5);
   H.aim(R,h2.clone().add(v(.1,-.3,0)),at);R.hit=null;R.c.dispatchEvent({type:'selectstart'});g.updateTeleport();R.c.dispatchEvent({type:'selectend'});
   r.teleported=g.headPos().setY(0).distanceTo(at)<1e-6;g.growBack();r.backAtTable=+g.islandTop.getWorldPosition(v()).y.toFixed(3);H.xrOff();
   return r;});
  if(process.env.TEST_OUTPUT){await page.evaluate(()=>{const g=__castle;g.camera.position.set(0,1.15,0);g.camera.rotation.set(-.45,0,0);g.renderer.render(g.scene,g.camera);});await page.screenshot({path:process.env.TEST_OUTPUT+'/seated-kingdom.png'});}
  assert.equal(seatedKingdom.tableTop,.72);assert.equal(seatedKingdom.backAtTable,.72);assert.ok(seatedKingdom.nearEdge>.1&&seatedKingdom.nearEdge<=.35,'near edge '+seatedKingdom.nearEdge);
  assert.equal(seatedKingdom.shrunk,true);assert.equal(seatedKingdom.teleported,true);
  for(const k of ['board','shop','scroll','tray']){assert.ok(seatedKingdom[k].max<=.62,`seated kingdom ${k} reach ${seatedKingdom[k].max} m`);assert.equal(seatedKingdom[k].behind,0,`seated kingdom ${k} behind her`);}
  assert.deepEqual(errors,[]);
  const result={url,game,grade4,kingdom,xr,hands,kingdomHands,seated,seatedKingdom,errors,hiddenPreviewDraws:0};
  if(process.env.TEST_OUTPUT)fs.writeFileSync(process.env.TEST_OUTPUT+'/browser-result.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
