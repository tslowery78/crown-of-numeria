import {MODULES} from '../js/problems.js';
// Independent answer oracles use the displayed question, never its answer or hint.
const nums=t=>(t.replace(/(\d),(?=\d{3})/g,'$1').match(/\d+(?:\.\d+)?/g)||[]).map(Number);
const sum=a=>a.reduce((x,y)=>x+y,0), add=a=>a[0]+a[1], sub=a=>a[0]-a[1], mul=a=>a[0]*a[1], div=a=>a[0]/a[1];
const compare=(a,b)=>a<b?'<':a>b?'>':'=';
const shape=(t,map)=>Object.entries(map).find(([word])=>t.includes(word))?.[1];
const solvers={
 g2m1:[add,sub,a=>a[1]-a[0],add],
 g2m2:[add,sub,sub,(_,t)=>/pencil|crayon|bug/.test(t)?'centimeters':'meters'],
 g2m3:[a=>100*a[0]+10*a[1]+a[2],(a,t)=>Math.floor(a[0]/(t.includes('hundreds')?100:t.includes('tens')?10:1))%10,(a,t)=>a[1]+(t.includes('more')?1:-1)*a[0],sum,a=>compare(...a),a=>a.at(-1)+a[0]],
 g2m4:[add,sub,sub,add,sub],g2m5:[add,sub,add,sub],
 g2m6:[mul,mul,sum,a=>a[0]%2?'odd':'even',a=>2*a[0]],
 g2m7:[(_,t)=>sum([...t.matchAll(/(\d+) (quarter|dime|nickel|penn)/g)].map(m=>Number(m[1])*({quarter:25,dime:10,nickel:5,penn:1}[m[2]]))),sub,a=>a[1]-a[0],sum,sub],
 g2m8:[(_,t)=>shape(t,{triangle:3,square:4,rectangle:4,pentagon:5,hexagon:6,octagon:8}),(_,t)=>shape(t,{halves:2,fourths:4,eighths:8}),sub,a=>({2:'half',4:'fourth',8:'eighth'}[a[0]]),(_,t)=>shape(t,{'cube':6,'rectangular prism':6,'triangular prism':5,'square pyramid':5})],
 g4m1:[a=>{const s=String(a[1]);return a[0]*10**(s.length-s.indexOf(String(a[0]))-1);},(a,t)=>{const p=shape(t,{'hundred thousand':100000,'ten thousand':10000,'thousand':1000,'hundred':100});return Math.floor((a[0]+p/2)/p)*p;},a=>compare(...a),sum,add,sub],
 g4m2:[(a,t)=>a[0]*(t.includes(' m =')?100:1000),a=>1000*a[0]+a[1],a=>1000*a[0]+a[1],a=>1000*a[0]-a[1]],
 g4m3:[mul,mul,div,a=>a[0]%a[1],mul,mul,div],
 g4m4:[sub,sub,add,a=>a[0]<90?'acute':a[0]===90?'right':'obtuse',(_,t)=>shape(t,{'rectangle':2,'square':4,'equilateral triangle':3,'regular hexagon':6}),(_,t)=>shape(t,{'three-quarter turn':270,'quarter turn':90,'half turn':180,'full turn':360})],
 g4m5:[a=>a[0]/a[1]+a[2]/a[3],a=>a[0]/a[1]-a[2]/a[3],a=>a[0]*a[2]/a[1],a=>compare(a[0]/a[1],a[2]/a[3]),a=>a[0]/a[1]-a[2]/a[3],a=>a[0]/a[1]+a[2]/a[3]],
 g4m6:[div,add,sub,a=>compare(...a),add,(a,t)=>Number(a[0].toFixed(2).split('.')[1][t.includes('hundredths')?1:0])],
 g4m7:[(a,t)=>a[0]*shape(t,{'feet =':12,'yards =':3,'gallons =':4,'pounds =':16,'hours =':60,'minutes =':60}),mul,a=>2*sum(a),a=>a[0]/2-a[1],div]
};
const value=s=>{const a=s.split('/').map(Number);return a.length===2?a[0]/a[1]:a[0];};
let seed=12345;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const result={samples:0,generators:0,mismatches:[]};
for(const modules of Object.values(MODULES))for(const m of modules){
 if(solvers[m.id].length!==m.gens.length)throw Error('Missing oracle '+m.id);
 for(const [i,gen] of m.gens.entries()){
  result.generators++;
  for(let k=0;k<200;k++){
   const p=gen(),expected=solvers[m.id][i](nums(p.text),p.text),actual=p.choices?p.answer:value(p.answer);
   result.samples++;
   if(typeof expected==='number'?Math.abs(expected-actual)>1e-8||!Number.isFinite(expected):expected!==actual){if(result.mismatches.length<20)result.mismatches.push({module:m.id,generator:i,text:p.text,expected,actual});}
  }
 }
}
console.log(JSON.stringify(result,null,2));
if(result.mismatches.length)process.exitCode=1;
