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
   await new Promise(res=>setTimeout(res,2500));r.afterSolve=g.gems;
   const put=(id,i,j)=>{const e=g.shop.slots.find(s=>s.item.id===id);if(!g.pickFromShop(ptr,e))return false;const c=g.cellCentre(i,j,e.item.foot||1);ptr.holding.obj.parent.remove(ptr.holding.obj);g.island.add(ptr.holding.obj);ptr.holding.obj.position.copy(c).setY(0.1);g.drop(ptr);return g.buildings.some(b=>b.id===id&&b.i===i&&b.j===j);};
   r.cottage=put('cottage',1,0);r.gemsAfterBuy=g.gems;r.onTaken=put('tree',1,0);r.onPond=put('tree',-2,-2);
   r.visibleMeshes=0;g.buildings[0].model.traverse(o=>{if(o.isMesh&&o.geometry.attributes.position.count)r.visibleMeshes++;});
   return r;});
  assert.ok(kingdom.pieces>=50,'kit pieces '+kingdom.pieces);assert.equal(kingdom.afterSolve,kingdom.start+3);
  assert.equal(kingdom.cottage,true);assert.equal(kingdom.gemsAfterBuy,kingdom.afterSolve-3);assert.equal(kingdom.onTaken,false);assert.equal(kingdom.onPond,false);assert.ok(kingdom.visibleMeshes>0);
  await page.reload();await page.locator('#deskBtn').click();await page.waitForFunction(()=>window.__castle?.shop&&window.__castle.buildings);
  kingdom.restored=await page.evaluate(()=>__castle.buildings.map(b=>b.id).join());assert.equal(kingdom.restored,'cottage');assert.deepEqual(errors,[]);
  const result={url,game,grade4,kingdom,xr,errors,hiddenPreviewDraws:0};
  if(process.env.TEST_OUTPUT)fs.writeFileSync(process.env.TEST_OUTPUT+'/browser-result.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
