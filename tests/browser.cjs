const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const url=process.argv[2]||'http://127.0.0.1:8765/';
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1280,height:900}}), errors=[];
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
  await page.locator('#deskBtn').click();await page.waitForFunction(()=>window.__castle?.props);
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
  await page.waitForTimeout(5500);
  assert.equal(await page.evaluate(()=>__castle.avatar.worn.children[0]?.layers.mask),8);
  if(process.env.TEST_OUTPUT){fs.mkdirSync(process.env.TEST_OUTPUT,{recursive:true});await page.screenshot({path:process.env.TEST_OUTPUT+'/crown-fixed.png'});}
  await page.reload();await page.locator('#quickEdit').click();
  assert.equal(await page.locator('#avStyle .on').innerText(),'Wizard');assert.equal(await page.locator('#avHairStyle .on').innerText(),'Braids');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mathcastle.progress.regression')).castles),1);
  await page.locator('#deskBtn').click();await page.waitForFunction(()=>window.__castle?.props);
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
   await session.end();g.opts.roomSize='2.5';await g.enterVR();
   const q=new T.Quaternion().setFromEuler(new T.Euler(0,.7,0));
   g.calibrateXR({transform:{position:{x:.6,y:1.2,z:-.4},orientation:q}});
   g.camera.position.set(.6,1.2,-.4);g.camera.quaternion.copy(q);g.scene.updateMatrixWorld(true);
   r.head=g.headPos().toArray();r.forward=g.camera.getWorldDirection(new T.Vector3()).toArray();
   g.rig.position.y=7.2;g.scene.updateMatrixWorld(true);r.liftedHead=g.headPos().toArray();
   let reset=false;g.onResetVR=()=>{reset=true;};ref.dispatchEvent(new Event('reset'));await Promise.resolve();r.reset={called:reset,ended:session.ended};
   Object.assign(g.renderer.xr,methods);Object.defineProperty(navigator,'xr',{configurable:true,value:original});return r;
  });
  for(const key of ['bounds1.4','bounds0']){assert.ok(xr[key].error,key);assert.ok(xr[key].ended,key);}
  assert.ok(xr.bounds3.built.every(n=>n>=1.6&&n<=2.7));assert.ok(xr.exactSpace);
  assert.ok(Math.abs(xr.head[0])<1e-9&&Math.abs(xr.head[2])<1e-9);assert.ok(Math.abs(xr.head[1]-1.2)<1e-9);
  assert.ok(Math.abs(xr.forward[0])<1e-9&&Math.abs(xr.forward[2]+1)<1e-9);assert.ok(Math.abs(xr.liftedHead[1]-8.4)<1e-9);
  assert.deepEqual(xr.reset,{called:true,ended:true});
  await page.goto(url+'?player=Grade4Regression&grade=4');await page.locator('#quickEdit').click();
  await page.locator('#homework').fill('Fraction | 7/8\nNegative decimal | -4.5\nWhich symbol? | < | <; >; =');await page.locator('#hwOnly').check();await page.locator('#deskBtn').click();await page.waitForFunction(()=>window.__castle?.props);
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
  const result={url,game,grade4,xr,errors,hiddenPreviewDraws:0};
  if(process.env.TEST_OUTPUT)fs.writeFileSync(process.env.TEST_OUTPUT+'/browser-result.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
