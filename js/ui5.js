/* =========================================================
   群雄割拠　画面
   ========================================================= */
const SVGNS='http://www.w3.org/2000/svg';
let UI={v3:(()=>{try{return localStorage.getItem('kunitori_view')!=='2d';}catch(e){return true;}})(),mapMode:'dip',cards:new Set(),sel:null,area:null,mode:null,reach:null,vb:null,phase:'plan'};
function el(tag,attrs,parent){const e=document.createElementNS(SVGNS,tag);for(const k in attrs)e.setAttribute(k,attrs[k]);if(parent)parent.appendChild(e);return e;}
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
const fmt=n=>Math.round(n);
const nStr=n=>TORDER.filter(t=>n[t]>=0.5).map(t=>TYPES[t].n+fmt(n[t])).join(' ')||'0';
const men=n=>fmt(sum(n)*100).toLocaleString()+'人';
function genChar(b,h){const nm=b.n;const hn0=H[h]?H[h].n.replace(/（.*）/,''):'';let g=nm.startsWith(hn0)?nm.slice(hn0.length):nm.slice(2);return g[0]||nm[0];}
// 当主の顔（img/face/家.jpg）。顔のない武将は名前の一字
const FACE={oda:1,imagawa:1,matsudaira:1,takeda:1,uesugi:1,hojo:1,mori:1,shimazu:1,miyoshi:1,otomo:1,chosokabe:1,date:1,azai:1,asakura:1,saito:1,rokkaku:1,amago:1,ryuzoji:1,satake:1,ashina:1,mogami:1,nanbu:1,satomi:1,kitabatake:1,matsunaga:1,hatakeyama:1,uragami:1,yamana:1,akamatsu:1,kono:1,ito:1,jinbo:1,anegakoji:1};
const faceUrl=(h,name)=>{if(!FACE[h])return null;const L=S&&S.busho&&S.busho[h]?S.busho[h][0]:null;const lord=L?L.n:(H[h]&&H[h].bu?H[h].bu[0][0]:null);if(!name||name===lord)return `img/face/${h}.jpg`;const f=typeof BUSHO_FACE!=='undefined'&&BUSHO_FACE[name];return f?`img/face/${f}`:null;};
const faceSpan=(h,b)=>{const u=faceUrl(h,b&&b.n);return u?`<img class="face" src="${u}" alt="">`:`<span>${esc(genChar(b,h))}</span>`;};
function genIcon(ar,big){const b=cmdOf(ar);return `<span class="gen${big?' big':''}${faceUrl(ar.h,b.n)?' hasf':''}" style="--hc:${H[ar.h].col}" data-tip="${esc(hn(ar.h)+'　'+b.n+'（統率'+b.t+'）')}">${faceSpan(ar.h,b)}<i class="hb">${kamonHTML(ar.h)}</i></span>`;}
/* 家紋 */
const kamonIdx=h=>KAMON.order.indexOf(h);
function kamonPos(h){const i=kamonIdx(h),N=KAMON.n,c=i%N,r=Math.floor(i/N),p=100/(N-1);return `${(c*p).toFixed(3)}% ${(r*p).toFixed(3)}%`;}
function kamonHTML(h){if(!H[h])return '';if(kamonIdx(h)<0)return esc(H[h].k);return `<i class="km" style="-webkit-mask-position:${kamonPos(h)};mask-position:${kamonPos(h)}" title="${esc(H[h].n+'家の家紋：'+(KAMON.name[h]||''))}"></i>`;}
function kamonSVG(g,h,x,y,s){const i=kamonIdx(h);if(i<0){const t=el('text',{x:x+s/2,y:y+s*0.78,class:'pgen'},g);t.textContent=H[h].k;return;}
  const N=KAMON.n,C=KAMON.cell,sv=el('svg',{x,y,width:s,height:s,viewBox:`${(i%N)*C} ${Math.floor(i/N)*C} ${C} ${C}`},g);el('image',{href:KAMON.src,width:C*N,height:C*N},sv);}
const stars=xp=>'★'.repeat(xpLv(xp))+'☆'.repeat(5-xpLv(xp));

/* ---------- 街道の道すじ（地形にそった曲線） ---------- */
function chaikin(P,n=2){for(let k=0;k<n;k++){const Q=[P[0]];for(let i=0;i<P.length-1;i++){const a=P[i],b=P[i+1];Q.push([a[0]*.75+b[0]*.25,a[1]*.75+b[1]*.25],[a[0]*.25+b[0]*.75,a[1]*.25+b[1]*.75]);}Q.push(P[P.length-1]);P=Q;}return P;}
const ROAD_CACHE={};
function roadPts(a,b){const key=a+'>'+b;if(ROAD_CACHE[key])return ROAD_CACHE[key];
  let P=(typeof ROAD_PATH!=='undefined')&&(ROAD_PATH[a+'|'+b]||(ROAD_PATH[b+'|'+a]&&ROAD_PATH[b+'|'+a].slice().reverse()));
  P=P&&P.length>2?chaikin(P,2):[A[a].c,A[b].c];P=P.map(q=>q.slice());P[0]=A[a].c.slice();P[P.length-1]=A[b].c.slice();
  return ROAD_CACHE[key]=P;}
function routePts(path){if(path.length<2)return path.map(a=>A[a].c.slice());let out=[A[path[0]].c.slice()];for(let i=0;i<path.length-1;i++)out=out.concat(roadPts(path[i],path[i+1]).slice(1).map(q=>q.slice()));return out;}
/* ---------- 軍勢の待機位置：城のすぐそば、街道の上に立つ ---------- */
const STAND_SP=10;                                             // 同じ街道に並ぶときの間かく
const standD0=a=>A[a].k==='京'?13:A[a].k==='堺'?11:8;         // 城（建物）のまん中からのきょり
function ptAlong(P,d){for(let i=1;i<P.length;i++){const a=P[i-1],b=P[i];const L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(d<=L){const f=L?d/L:0;return [a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f];}d-=L;}return P[P.length-1].slice();}
function standPt(a,b,k){const P=roadPts(a,b);return ptAlong(P,Math.min(standD0(a)+k*STAND_SP,plen(P)*0.3));}
const landRoads=a=>nbr(a).filter(b=>EDGE[a][b].r!=='海路').sort((x,y)=>EDGE[a][x].c-EDGE[a][y].c);
// どの街道に立つか：これから進む道 → 通ってきた道 → 敵や他家のほうへ向かう道
function standRoad(ar){const a=ar.a,R=landRoads(a);if(!R.length)return null;
  const o=S.orders&&S.orders[ar.id];if(o&&o.length&&R.includes(o[0]))return o[0];
  const lo=S.lastOrders&&S.lastOrders[ar.id],st=S.lastStart&&S.lastStart[ar.id];
  if(lo&&st&&st!==a){const p=[st].concat(lo);const i=p.indexOf(a);if(i>0&&R.includes(p[i-1]))return p[i-1];}
  const sc=b=>{const w=S.own[b];return (w&&!sameCamp(w,ar.h)?2:!w?1:0)+(w&&rel(ar.h,w)==='teki'?3:0)+(EDGE[a][b].c===1?0.5:0);};
  return R.slice().sort((x,y)=>sc(y)-sc(x))[0];}
function standPos(ar){const a=ar.a,c=A[a].c;const list=armiesAt(a).slice().sort((x,y)=>x.id-y.id);const used={};
  for(let j=0;j<list.length;j++){const x=list[j];const b=standRoad(x);
    if(!b){if(x===ar)return [c[0]+(j-(list.length-1)/2)*14,c[1]+13];continue;}
    const k=used[b]=(used[b]||0)+1;if(x===ar)return standPt(a,b,k-1);}
  return c.slice();}
// 動き始め・着いた所の待機位置（アニメーション用）
const standToward=(a,b)=>b&&EDGE[a]&&EDGE[a][b]&&EDGE[a][b].r!=='海路'?standPt(a,b,0):A[a].c.slice();
const plen=P=>{let s=0;for(let i=1;i<P.length;i++)s+=Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]);return s;};
function trimEnd(P,d){P=P.map(q=>q.slice());while(P.length>1&&d>0){const a=P[P.length-2],b=P[P.length-1];const L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L<=d){P.pop();d-=L;}else{const f=(L-d)/L;P[P.length-1]=[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f];d=0;}}return P;}
// 矢印の形：道にそった胴と、先の矢じり
function arrowShape(P,tipOff,hl){const T=trimEnd(P,tipOff);const body=trimEnd(T,hl);const tip=T[T.length-1],base=body[body.length-1];
  let ux=tip[0]-base[0],uy=tip[1]-base[1];const L=Math.hypot(ux,uy)||1;ux/=L;uy/=L;return {body,tip,base,ux,uy};}
function buildMap(){
  const svg=$('#map');svg.innerHTML='';
  const defs=el('defs',{},svg);
  const mk=(id,c)=>{const m=el('marker',{id,viewBox:'0 0 10 10',refX:'7',refY:'5',markerWidth:'4',markerHeight:'4',orient:'auto-start-reverse'},defs);el('path',{d:'M0,0 L10,5 L0,10 z',fill:c},m);};
  mk('ar','#c0392b');mk('arb','#2c5aa0');
  const ft=el('filter',{id:'polit',x:'0',y:'0',width:'1',height:'1','color-interpolation-filters':'sRGB'},defs);
  el('feColorMatrix',{type:'saturate',values:'0.12'},ft);
  const ct=el('feComponentTransfer',{},ft);for(const c of ['R','G','B'])el('feFunc'+c,{type:'linear',slope:'0.55',intercept:'0.38'},ct);
  {const pt=el('pattern',{id:'zocp',width:5,height:5,patternUnits:'userSpaceOnUse',patternTransform:'rotate(45)'},defs);el('rect',{width:5,height:5,fill:'#d0473f','fill-opacity':0.35},pt);el('line',{x1:0,y1:0,x2:0,y2:5,stroke:'#ff6a55','stroke-width':2,'stroke-opacity':0.95},pt);}
  {const f=el('filter',{id:'sglow',x:'-20%',y:'-20%',width:'140%',height:'140%'},defs);el('feGaussianBlur',{stdDeviation:'2.2'},f);}
  for(const k in ICONS){const s=el('symbol',{id:'ic-'+k,viewBox:'0 0 512 512'},defs);el('path',{d:ICONS[k]},s);}
  el('rect',{x:-1000,y:-1000,width:4000,height:4000,fill:'#172842'},svg);
  el('image',{href:MAP_BG.src,x:MAP_BG.x,y:MAP_BG.y,width:MAP_BG.w,height:MAP_BG.h,preserveAspectRatio:'none',id:'mapbg'},svg);
  const gA=el('g',{id:'gA'},svg);
  for(const a of AREAS){const p=el('path',{d:a.d,'data-a':a.id,class:'area'+(a.ter==='山'?' mt':'')},gA);
    p.addEventListener('click',()=>clickArea(a.id));p.addEventListener('contextmenu',e=>{e.preventDefault();rightClickArea(a.id);});p.addEventListener('mousemove',e=>tip(e,areaTip(a.id)));p.addEventListener('mouseleave',()=>tip(null));}
  el('g',{id:'gF','pointer-events':'none'},svg);el('g',{id:'gZ','pointer-events':'none'},svg);el('g',{id:'gHN','pointer-events':'none'},svg);
  // 国の境
  const gR=el('g',{id:'gR'},svg);
  const drawn=new Set();
  for(const x in EDGE)for(const y in EDGE[x]){const k=[x,y].sort().join('|');if(drawn.has(k))continue;drawn.add(k);const e=EDGE[x][y];const a=A[x].c,b=A[y].c;
    const cls=e.r==='海路'?'sea':e.c===1?'main':'mtn';const pts=(cls==='sea'?[a,b]:roadPts(x,y)).map(q=>q[0].toFixed(1)+','+q[1].toFixed(1)).join(' ');
    if(cls!=='sea')el('polyline',{points:pts,class:'rd cas '+cls,fill:'none'},gR);
    el('polyline',{points:pts,class:'rd '+cls,fill:'none'},gR);}
  el('g',{id:'gB'},svg);el('g',{id:'gSel','pointer-events':'none'},svg);el('g',{id:'gK'},svg);el('g',{id:'gL'},svg);el('g',{id:'gU'},svg);el('g',{id:'gO'},svg);
  const bb=gA.getBBox();UI.full=[bb.x-10,bb.y-10,bb.width+20,bb.height+20];
  // ズームと移動
  svg.addEventListener('contextmenu',e=>e.preventDefault());
  svg.addEventListener('wheel',e=>{e.preventDefault();zoom(e.deltaY<0?0.85:1.18,e);},{passive:false});
  let drag=null;
  svg.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,vb:UI.vb.slice(),moved:false};});
  svg.addEventListener('pointermove',e=>{if(!drag)return;const r=svg.getBoundingClientRect();const k=UI.vb[2]/r.width;const dx=(e.clientX-drag.x)*k,dy=(e.clientY-drag.y)*k;if(Math.abs(dx)+Math.abs(dy)>4)drag.moved=true;if(drag.moved){UI.vb[0]=drag.vb[0]-dx;UI.vb[1]=drag.vb[1]-dy;setVB();}});
  window.addEventListener('pointerup',()=>{if(drag&&drag.moved){UI.justDragged=true;setTimeout(()=>UI.justDragged=false,30);}drag=null;});
}
function lodK(){const z=UI.full[2]/UI.vb[2];return Math.max(0.32,Math.min(1.15,Math.pow(z,-0.62)));}
function setVB(){const svg=$('#map');svg.setAttribute('viewBox',UI.vb.join(' '));const z=UI.full[2]/UI.vb[2];
  // 平面の地図：いちばん引いたあたりで、軍勢の駒・矢印・にらみの範囲をうすくし、全国を見わたすときは消す
  {const af=Math.max(0,Math.min(1,(z-1.12)/(1.7-1.12)));for(const id of ['gU','gO','gZ']){const e=document.getElementById(id);if(e){e.style.opacity=af.toFixed(2);e.style.visibility=af<0.02?'hidden':'';}}}
  svg.classList.toggle('far',z<1.9);svg.classList.toggle('mid',z>=1.9&&z<3.4);svg.classList.toggle('near',z>=3.4);
  const k=lodK();if(UI._k!==k){UI._k=k;if(S&&$('#gO'))drawOrders();if(S&&$('#gZ'))drawZoc();for(const e of svg.querySelectorAll('.sc'))e.setAttribute('transform',`translate(${e.dataset.x},${e.dataset.y}) scale(${k})`);}}
function scG(parent,x,y,cls){const g=el('g',{class:'sc '+(cls||''),'data-x':x,'data-y':y,transform:`translate(${x},${y}) scale(${lodK()})`},parent);return g;}
function zoom(f,e){const svg=$('#map');const r=svg.getBoundingClientRect();const px=e?(e.clientX-r.left)/r.width:0.5,py=e?(e.clientY-r.top)/r.height:0.5;
  const nw=Math.min(UI.full[2]*1.3,Math.max(90,UI.vb[2]*f)),nh=nw*UI.vb[3]/UI.vb[2];UI.vb[0]+=(UI.vb[2]-nw)*px;UI.vb[1]+=(UI.vb[3]-nh)*py;UI.vb[2]=nw;UI.vb[3]=nh;setVB();if(on3D()&&!e)T3D.zoom(f);}
function fitMap(){const r=$('#map').getBoundingClientRect();const f=UI.full;const ar=r.width/r.height;let w=f[2],h=f[3];if(w/h>ar)h=w/ar;else w=h*ar;UI.vb=[f[0]-(w-f[2])/2,f[1]-(h-f[3])/2,w,h];setVB();if(on3D())T3D.fit();}
function focusOn(list,pad=160){if(!list.length)return fitMap();let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(const a of list){const c=A[a].c;x0=Math.min(x0,c[0]);y0=Math.min(y0,c[1]);x1=Math.max(x1,c[0]);y1=Math.max(y1,c[1]);}
  const r=$('#map').getBoundingClientRect();const ar=r.width/r.height;let w=Math.max(220,x1-x0+pad),h=Math.max(220,y1-y0+pad);if(w/h>ar)h=w/ar;else w=h*ar;UI.vb=[(x0+x1)/2-w/2,(y0+y1)/2-h/2,w,h];setVB();if(on3D())T3D.focus(list,pad);}
const focusMe=()=>focusOn(areasOf(S.me).concat(armiesOf(S.me).map(x=>x.a)));

const DIPCOL={self:'#3d6fd6',kashin:'#8a63d2',domei:'#2e9e44',fusen:'#a8c94a',none:'#e6c229',teki:'#d0473f',neutral:'#b9b0a0'};
function dipKey(o){if(!o||!H[o])return 'neutral';return rel(S.me,o);}
function dipFill(o,a){const k=dipKey(o);return `color-mix(in srgb, ${DIPCOL[k]} ${k==='self'?70:k==='neutral'?(NEUTRAL_POW[a]?55:30):55}%, var(--land))`;}
function setMode(m){UI.mapMode=m;const bg=$('#mapbg');if(bg)bg.setAttribute('href',m==='ter'?MAP_BG.src:MAP_BG.pol);$('#map').classList.toggle('ter',m==='ter');refresh();}
function modeUI(){const d=$('#mDip'),p=$('#mPow'),t=$('#mTer');if(!d)return;d.classList.toggle('pri',UI.mapMode==='dip');p.classList.toggle('pri',UI.mapMode==='pow');t.classList.toggle('pri',UI.mapMode==='ter');$('#dipLeg').innerHTML=UI.mapMode==='dip'?['self','kashin','domei','fusen','none','teki','neutral'].map(k=>`<span><i style="background:${DIPCOL[k]}"></i>${{self:'自分',kashin:'主従',domei:'同盟',fusen:'不可侵',none:'中立',teki:'敵対',neutral:'国人衆など'}[k]}</span>`).join(''):'';}
function relName(r){return {domei:'同盟',fusen:'不可侵',teki:'敵対',none:'とくになし',self:'自分',kashin:'主従'}[r];}
// 主従のくわしい呼び方（主君・家臣・同じ陣営）
function kashinName(o){const me=S.me;return S.lord&&S.lord[me]===o?'主君':S.lord&&S.lord[o]===me?'家臣':'同じ陣営';}
/* ---------- マウスを重ねたときの札（大河ドラマの字幕のような黒漆と金の札） ---------- */
const TI={
  rice:'<svg viewBox="0 0 24 24" class="ti"><path d="M11 23c0-6 .5-11 4-17" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'+[[15.6,4,-30],[13.6,6.3,-40],[16.9,7.3,20],[12.6,9.4,-45],[16,10.6,25],[11.9,12.8,-50],[15.1,14,30],[11.4,16.3,-55]].map(([x,y,r])=>`<ellipse cx="${x}" cy="${y}" rx="1.35" ry="2.3" transform="rotate(${r} ${x} ${y})" fill="currentColor"/>`).join('')+'</svg>',
  bale:'<svg viewBox="0 0 24 16" class="tb"><rect x="1.5" y="1.5" width="21" height="13" rx="6.5" fill="currentColor"/><path d="M7 2v12M12 1.5v13M17 2v12" stroke="#00000055" stroke-width="1.3"/><path d="M2 8h20" stroke="#ffffff40" stroke-width="1"/></svg>',
  mtn:'<svg viewBox="0 0 24 24" class="ti"><path d="M1 20 8.5 7l3.6 6 2.9-4.2L23 20Z" fill="currentColor"/><path d="m8.5 7 1.8 3.1-1.8-.6-1.6 1Z" fill="#fff8"/></svg>',
  plain:'<svg viewBox="0 0 24 24" class="ti"><path d="M2 15c3-2 6-2 10 0s7 2 10 0M2 19.5c3-2 6-2 10 0s7 2 10 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M6 11V6M6 8l-2-2M6 8l2-2M16 11V7M16 9l-2-2M16 9l2-2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  road:'<svg viewBox="0 0 24 24" class="ti"><path d="M7 23 10.5 1M17 23 13.5 1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M12 3v3M12 10v3M12 17v3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  gar:k=>`<svg viewBox="0 0 512 512" class="ti"><path d="${ICONS.helm}" fill="currentColor"/></svg>`,
  koban:'<svg viewBox="0 0 24 24" class="ti"><ellipse cx="12" cy="12" rx="7.2" ry="10.5" fill="currentColor"/><ellipse cx="12" cy="12" rx="5.4" ry="8.6" fill="none" stroke="#00000045" stroke-width="1"/><path d="M8.6 7.2h6.8M8.6 16.8h6.8" stroke="#00000045" stroke-width="1.1"/><path d="M9.5 10h5v4h-5z" fill="none" stroke="#00000055" stroke-width="1.1"/></svg>',
  kind:k=>`<svg viewBox="0 0 512 512" class="ti"><path d="${ICONS[k]}" fill="currentColor"/></svg>`
};
const UCOL={ashi:'#b98b4e',kiba:'#c4483c',yumi:'#5f9a4a',teppo:'#4f6ea8'};
function compBar(n,gar){const tot=sum(n)||1;return `<div class="tcb">${TORDER.filter(t=>n[t]>=0.05).map(t=>`<i style="flex:${n[t]};background:${UCOL[t]}" title="${TYPES[t].full}"><span>${n[t]/tot>0.14?TYPES[t].n:''}</span></i>`).join('')}</div>`;}
function areaTip(a){
  const ar=A[a],o=S.own[a]||null;const k=koku(a);const main=isMain(a),hon=isHonjo(a,o);
  const ownName=o?hn(o):(NEUTRAL_NAME[a]||'国人衆');const relk=o?(o===S.me?'self':rel(S.me,o)):'neutral';
  const relTxt=relk==='kashin'?kashinName(o)+(S.lord&&S.lord[o]&&S.lord[o]!==S.me?`（${H[S.lord[o]].n}家の家臣）`:''):{self:'わが家',domei:'同盟',fusen:'不可侵',none:'中立',teki:'敵対',neutral:'どの家にも属さない'}[relk]+(o&&S.lord&&S.lord[o]?`・${H[S.lord[o]].n}家の家臣`:'');
  const relCol=DIPCOL[relk]||DIPCOL.neutral;
  // 石高：1俵＝5万石。ぱっと見でわかるように俵の数で
  const full=Math.floor(k/5),part=(k%5)/5;const bales=Math.min(9,full+(part>0.15?1:0));
  const baleH=Array.from({length:bales},(_,i)=>`<span class="tbw${i===full&&part>0.15?' part':''}" ${i===full&&part>0.15?`style="--p:${Math.round(part*100)}%"`:''}>${TI.bale}</span>`).join('')+(full+(part>0.15?1:0)>9?'<span class="tmore">…</span>':'');
  const g=S.gar[a];const gs=sum(g);
  const rd=[...new Set(Object.values(EDGE[a]).filter(e=>e.c===1&&e.r!=='海路').map(e=>e.r))];
  const sea=Object.values(EDGE[a]).some(e=>e.r==='海路');
  let h=`<div class="tc">
   <div class="tch"><span class="tck">${TI.kind(ar.k)}</span><div class="tcn"><b>${esc(ar.n)}</b><small>${esc(ar.pv)}国・${KIND[ar.k].n}${hon?'・本城':''}</small></div>
    ${main?'<span class="tcmain" title="国の拠点の城">拠点</span>':''}</div>
   <div class="tco" style="--rc:${relCol}">${o&&H[o]?`<span class="tckm" style="background:${H[o].col}">${kamonHTML(o)}</span>`:'<span class="tckm nk">国</span>'}<span class="tcon">${esc(ownName)}</span>${o&&H[o]&&playerOf(o)&&o!==S.me?`<span class="who hu sm">${HU_SVG}${esc(playerOf(o))}</span>`:''}<span class="tcrel">${relTxt}</span></div>
   <div class="tcr"><div class="tcrice"><span class="tcri">${TI.rice}</span><div><span class="tcrv">${k.toFixed(1)}</span><span class="tcru">万石</span></div></div><div class="tcbales" title="俵1つ＝5万石">${baleH}</div></div>
   <div class="tcs">
    <span class="tst">${ar.ter==='山'?TI.mtn:TI.plain}${ar.ter==='山'?'山地<small>守りに強い・騎馬は不利</small>':'平地<small>騎馬が力を出せる</small>'}</span>
    <span class="tst">${TI.gar()}城兵<b>${Math.round(gs*100).toLocaleString()}</b>人</span>
   </div>
   ${gs>=0.05?compBar(g):''}`;
  const arms=armiesAt(a);
  if(arms.length){h+=`<div class="tcsec">この地域の軍勢</div>`;
    for(const x of arms){const n=nOf(x);const rk=x.h===S.me?'self':rel(S.me,x.h);
      h+=`<div class="tca" style="--rc:${DIPCOL[rk]}">${faceUrl(x.h,cmdOf(x).n)?`<span class="tcface" style="--hc:${H[x.h].col}"><img src="${faceUrl(x.h,cmdOf(x).n)}" alt=""><i>${kamonHTML(x.h)}</i></span>`:`<span class="tckm s" style="background:${H[x.h].col}">${kamonHTML(x.h)}</span>`}<div class="tcai"><div class="tcat"><b>${esc(cmdOf(x).n)}の軍勢</b><span class="tcan">${(sum(n)*100).toLocaleString()}<small>人</small></span></div>
        <div class="tcam">${esc(hn(x.h))}・統率${cmdOf(x).t}・${x.u.length}部隊${needsRefill(x)?'<span class="tcref">✚補充中</span>':''}</div>${compBar(n)}</div></div>`;}}
  const notes=[];
  if(main)notes.push(`<div class="tcnote gold">★ ${esc(ar.pv)}国の拠点の城：落とすと、同じ持ち主の${esc(ar.pv)}国の地域もいっしょに手に入る</div>`);
  if(S.siege&&S.siege[a]){const sg=S.siege[a];notes.push(`<div class="tcnote red">🏯 籠城中：${esc(hn(sg.by))}が包囲している。あと<b>${sg.left}</b>ターンで兵糧が尽きて落城する。軍勢を送って包囲の軍勢を破れば、包囲はとける</div>`);}
  else if(o&&holdTurns(a,o))notes.push(`<div class="tcnote">🏯 ${isHonjo(a,o)?'本拠':'国の拠点'}の城：攻めに負けても、すぐには落ちず、${holdTurns(a,o)}ターン籠城できる</div>`);
  if(zocOf(S.me).has(a))notes.push(`<div class="tcnote red">⚠ 敵の軍勢がいる地域（にらみの範囲）：ここに入った軍勢は、その先へ進めず、その敵の軍勢と戦いになる</div>`);
  if(rd.length||sea)h+=`<div class="tcroad">${TI.road}${rd.map(esc).join('・')}${sea?(rd.length?'・':'')+'海路あり':''}</div>`;
  return h+notes.join('')+'</div>';
}
function tip(e,html){const t=$('#tip');if(!e){t.style.display='none';return;}
  const rich=html.startsWith('<div class="tc">');t.classList.toggle('rich',rich);t.innerHTML=html;t.style.display='block';
  const z=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui'))||1;const w=t.offsetWidth*(rich?z:1),hh=t.offsetHeight*(rich?z:1);
  let x=e.clientX+18,y=e.clientY+18;if(x+w>innerWidth-6)x=e.clientX-w-14;if(y+hh>innerHeight-6)y=Math.max(6,innerHeight-hh-6);
  t.style.left=(rich?x/z:x)+'px';t.style.top=(rich?y/z:y)+'px';}

function drawMap(){
  document.querySelectorAll('#gA .area').forEach(p=>{
    const a=p.dataset.a;const o=S.own[a];const c=o&&H[o]?H[o].col:null;
    if(UI.mapMode==='dip'){const k=dipKey(o);p.style.fill=DIPCOL[k];p.style.fillOpacity=k==='self'?REALM_IN2.self:k==='neutral'?(NEUTRAL_POW[a]?0.3:0):REALM_IN2.other;}
    else if(UI.mapMode==='pow'){p.style.fill=c||'#888';p.style.fillOpacity=c?(o===S.me?REALM_IN2.self:REALM_IN2.other):(NEUTRAL_POW[a]?0.26:0);}
    else{p.style.fill=c||'#000';p.style.fillOpacity=0;}
    p.classList.toggle('mine',o===S.me);
    p.classList.toggle('hl',!!(UI.reach&&UI.reach[a]));
    p.classList.toggle('selA',UI.area===a);
  });
  drawRealmFill();drawRealms();drawZoc();drawSel();drawHouseNames();
  const gL=$('#gL');gL.innerHTML='';
  for(const a of AREAS){
    const main=isMain(a.id),sp=a.k!=='城';
    const g=scG(gL,a.c[0],a.c[1],'kicon'+(main?' main':'')+(sp?' sp':''));
    const r=main?8:6.5;
    el('circle',{r,class:'kbg'+(main?' main':'')},g);
    el('use',{href:'#ic-'+a.k,x:-r*0.72,y:-r*0.72,width:r*1.44,height:r*1.44,class:'kuse k'+a.k},g);
    const t=el('text',{y:r+9,class:'lab'+(main?' mainlab':'')},g);t.textContent=a.n;
    if(S.siege&&S.siege[a.id]){const sg=S.siege[a.id];el('circle',{r:r*1.25,class:'sgring'},g);const st=el('text',{y:-r-5,class:'sglab'},g);st.textContent=`籠城 あと${sg.left}`;}
  }
  const gU=$('#gU');gU.innerHTML='';
  const byA={};for(const x of S.armies)(byA[x.a]=byA[x.a]||[]).push(x);
  for(const a in byA){
    const c=A[a].c;const list=byA[a];
    const G=scG(gU,c[0],c[1],'');
    list.forEach((ar,j)=>{
      const ox=(j-(list.length-1)/2)*30,oy=-27;
      const g=el('g',{class:'unit'+(ar.h===S.me?' me':'')+(ar.id===UI.sel?' sel':'')},G);
      drawPiece(g,ar,ox,oy,faceOf(ar));
      g.addEventListener('click',ev=>{ev.stopPropagation();clickArea(a,ar.h,ar.id);});g.addEventListener('contextmenu',ev=>{ev.preventDefault();ev.stopPropagation();rightClickArea(a);});
      g.addEventListener('mousemove',e=>tip(e,areaTip(a)));g.addEventListener('mouseleave',()=>tip(null));
    });
    el('line',{x1:0,y1:-14,x2:0,y2:-8,stroke:'#2a2622','stroke-width':1.2},G);
  }
  drawOrders();
  if(on3D())T3D.update();
}
// 選んだ地域・行ける地域を、ふちから内側へふんわり光らせる
/* ---------- 家の名前を領地の上に大きく（CK3・EU4のように） ---------- */
// 文字はまっすぐ立てたまま、領地の長い向きにそって並べる
let AREA_BB=null;
function areaBB(a){if(!AREA_BB){AREA_BB={};for(const x of AREAS){const n=x.d.match(/-?\d+(\.\d+)?/g).map(Number);let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(let i=0;i+1<n.length;i+=2){const X=n[i],Y=n[i+1];if(X<x0)x0=X;if(X>x1)x1=X;if(Y<y0)y0=Y;if(Y>y1)y1=Y;}AREA_BB[x.id]=[x0,y0,x1,y1];}}return AREA_BB[a];}
function houseLabels(){const out=[];
  for(const h in H){if(!alive(h))continue;const mine=areasOf(h);if(!mine.length)continue;const set=new Set(mine),seen=new Set();const comps=[];
    for(const a of mine){if(seen.has(a))continue;const c=[];const q=[a];seen.add(a);while(q.length){const x=q.pop();c.push(x);for(const y of nbr(x))if(set.has(y)&&!seen.has(y)&&EDGE[x][y].r!=='海路'){seen.add(y);q.push(y);}}comps.push(c);}
    comps.sort((p,q)=>q.length-p.length);
    comps.forEach((c,i)=>{if(i>0&&c.length<3)return;
      const P=c.map(a=>{const b=areaBB(a);return {x:A[a].c[0],y:A[a].c[1],w:Math.max(1,(b[2]-b[0])*(b[3]-b[1])),bw:b[2]-b[0],bh:b[3]-b[1]};});
      const W=P.reduce((s,p)=>s+p.w,0);const cx=P.reduce((s,p)=>s+p.x*p.w,0)/W,cy=P.reduce((s,p)=>s+p.y*p.w,0)/W;
      let ux=1,uy=0,len,thick;
      if(P.length===1){const p=P[0];if(p.bh>p.bw*1.25){ux=0;uy=1;}len=Math.max(p.bw,p.bh)*0.8;thick=Math.min(p.bw,p.bh);}
      else{let sxx=0,syy=0,sxy=0;for(const p of P){const dx=p.x-cx,dy=p.y-cy;sxx+=p.w*dx*dx;syy+=p.w*dy*dy;sxy+=p.w*dx*dy;}
        const th=0.5*Math.atan2(2*sxy,sxx-syy);ux=Math.cos(th);uy=Math.sin(th);
        let lo=1e9,hi=-1e9,plo=1e9,phi=-1e9;for(const p of P){const t=(p.x-cx)*ux+(p.y-cy)*uy,n=-(p.x-cx)*uy+(p.y-cy)*ux;const r=Math.sqrt(p.w)*0.35;lo=Math.min(lo,t-r);hi=Math.max(hi,t+r);plo=Math.min(plo,n-r);phi=Math.max(phi,n+r);}
        len=(hi-lo)*0.82;thick=phi-plo;}
      // 横に近ければ左から右、縦に近ければ上から下へ
      if(Math.abs(ux)>=Math.abs(uy)){if(ux<0){ux=-ux;uy=-uy;}}else{if(uy<0){ux=-ux;uy=-uy;}}
      const t=H[h].n.replace(/（.*）/,'')+'家';const n=[...t].length;
      let fs=Math.min(len/n*0.8,thick*0.5,28);if(fs<6)fs=Math.min(6,len/n);if(fs<4)return;
      const step=Math.min(len/n,fs*1.5);
      const chars=[...t].map((ch,i)=>({ch,x:cx+ux*step*(i-(n-1)/2),y:cy+uy*step*(i-(n-1)/2)}));
      out.push({h,chars,fs,cx,cy});});}
  return out;}
function drawHouseNames(){const g=$('#gHN');if(!g)return;g.innerHTML='';if(UI.mapMode==='ter'||UI.hideNames)return;
  for(const L of houseLabels()){const me=L.h===S.me;
    for(const c of L.chars){const t=el('text',{x:c.x.toFixed(1),y:c.y.toFixed(1),'font-size':L.fs.toFixed(1),class:'hname'+(me?' me':''),'text-anchor':'middle','dominant-baseline':'central','stroke-width':(L.fs*0.09).toFixed(2)},g);t.textContent=c.ch;}}}
function drawSel(){const g=$('#gSel');if(!g)return;g.innerHTML='';
  const glow=(a,col,w,fo,cls)=>{const cp=el('clipPath',{id:'sc-'+a},g);el('path',{d:A[a].d},cp);
    const gg=el('g',{class:cls},g);el('path',{d:A[a].d,fill:col,'fill-opacity':fo,stroke:'none'},gg);
    const gi=el('g',{'clip-path':`url(#sc-${a})`},gg);el('path',{d:A[a].d,fill:'none',stroke:col,'stroke-width':w,'stroke-opacity':0.75,filter:'url(#sglow)','stroke-linejoin':'round'},gi);
    el('path',{d:A[a].d,fill:'none',stroke:col,'stroke-width':w*0.45,'stroke-opacity':0.35,filter:'url(#sglow)','stroke-linejoin':'round'},gg);};
  if(UI.reach)for(const a in UI.reach)glow(a,'#ffe28a',7,0.1,'sg reach');
  if(UI.area&&A[UI.area])glow(UI.area,'#fff1b8',10,0.16,'sg sel');
  if(UI.warnH)for(const a of areasOf(UI.warnH))glow(a,'#ff8a3a',10,0.28,'sg warn');}
// ZOC（敵の軍勢のとなり）を斜線で示す
// ZOCの形：敵の軍勢のまわりの円と、そこから出る街道（となりの城まで）。この帯に入ると、そこで止まる
function zocShapes(){if(S.dead[S.me])return [];const out=[];const seen=new Set();
  for(const x of S.armies){if(x.h===S.me||rel(S.me,x.h)!=='teki'||seen.has(x.a))continue;seen.add(x.a);
    const lines=nbr(x.a).map(b=>EDGE[x.a][b].r==='海路'?[A[x.a].c,A[b].c]:roadPts(x.a,b));out.push({c:A[x.a].c,lines,h:x.h});}
  return out;}
const ZOC_W=11,ZOC_R=40;
function drawZoc(){const g=$('#gZ');if(!g)return;g.innerHTML='';if(S.dead[S.me])return;
  // にらみの範囲：敵の軍勢がいる地域を、赤い斜線でぬる
  const Z=[...zocOf(S.me)];if(!Z.length)return;
  const d=Z.map(a=>A[a].d).join('');
  el('path',{d,fill:'#7a1208','fill-opacity':0.28,stroke:'#b0281a','stroke-width':2.2,'stroke-opacity':0.9,'stroke-linejoin':'round'},g);
  el('path',{d,fill:'url(#zocp)',stroke:'none'},g);
}

// 持ち主のちがう地域の境目を、家の色の太い線で描く
let BORDER_SEG=null;
function borderSegs(){
  if(BORDER_SEG)return BORDER_SEG;
  // 地域の輪郭を点の列に分け、となりの地域と共有する辺を探す
  const key=(x,y)=>Math.round(x*2)+','+Math.round(y*2);
  const edges={};
  for(const a of AREAS){
    for(const ring of a.d.split('M').filter(Boolean)){
      const pts=ring.replace(/Z/g,'').split('L').map(s=>s.split(',').map(Number)).filter(p=>p.length===2&&!isNaN(p[0]));
      for(let i=0;i<pts.length;i++){const p=pts[i],q=pts[(i+1)%pts.length];const k=[key(p[0],p[1]),key(q[0],q[1])].sort().join('|');(edges[k]=edges[k]||{p,q,ids:[]}).ids.push(a.id);}
    }
  }
  ALL_SEG=Object.values(edges);
  BORDER_SEG=ALL_SEG.filter(e=>e.ids.length===2&&e.ids[0]!==e.ids[1]);
  return BORDER_SEG;
}
let ALL_SEG=null,REALM_E=null;
/* HOI4のような塗り：境目の近くは濃く、内側ほど薄くする */
const REALM_IN={self:0.3,other:0.24};                        // 立体の地図（Victoria 3風：地形が見えるようにうすく）
const REALM_BANDS3=[[18,0.1],[9,0.16],[3.5,0.3]];             // 立体の地図：境目からの帯
const REALM_COAST3=[[6,0.06]];
const REALM_IN2={self:0.2,other:0.14};                       // 平面の地図                        // 内側の塗りの濃さ
const REALM_BANDS=[[28,0.10],[17,0.13],[9,0.17],[4,0.24]];   // 境目からの帯（幅・濃さ）。重なるほど濃くなる
const REALM_COAST=[[10,0.08],[4,0.12]];                      // 海岸ぞいの帯（うすめ）
function realmCol(h){return UI.mapMode==='dip'?(h===S.me?DIPCOL.self:DIPCOL[dipKey(h)]):H[h].col;}
function realmEdges(){
  borderSegs();const key=AREAS.map(a=>S.own[a.id]||'').join(',');
  if(REALM_E&&REALM_E.key===key)return REALM_E;
  const by={};const get=h=>by[h]||(by[h]={land:[],coast:[]});
  for(const e of ALL_SEG){
    if(e.ids.length===1){const o=S.own[e.ids[0]];if(o&&H[o])get(o).coast.push(e);continue;}
    const [a,b]=e.ids;if(a===b)continue;const oa=S.own[a]||null,ob=S.own[b]||null;if(oa===ob)continue;
    for(const o of [oa,ob])if(o&&H[o])get(o).land.push(e);}
  REALM_E={key,by};return REALM_E;
}
const segD=list=>list.map(e=>`M${e.p[0]},${e.p[1]}L${e.q[0]},${e.q[1]}`).join('');
function drawRealmFill(){
  const g=$('#gF');if(!g)return;
  const key=UI.mapMode+'|'+S.me+'|'+AREAS.map(a=>S.own[a.id]||'').join(',')+'|'+Object.keys(H).map(h=>dipKey(h)).join(',');
  if(g.dataset.key===key)return;g.dataset.key=key;g.innerHTML='';
  if(UI.mapMode==='ter')return;
  const E=realmEdges();
  for(const h in E.by){const col=realmCol(h);
    const cp=el('clipPath',{id:'rc-'+h},g);el('path',{d:areasOf(h).map(a=>A[a].d).join('')},cp);
    const gg=el('g',{'clip-path':`url(#rc-${h})`},g);
    const land=segD(E.by[h].land),coast=segD(E.by[h].coast);
    if(land)for(const [w,o] of REALM_BANDS)el('path',{d:land,fill:'none',stroke:col,'stroke-width':w,'stroke-opacity':o,'stroke-linecap':'round','stroke-linejoin':'round'},gg);
    if(coast)for(const [w,o] of REALM_COAST)el('path',{d:coast,fill:'none',stroke:col,'stroke-width':w,'stroke-opacity':o,'stroke-linecap':'round','stroke-linejoin':'round'},gg);
  }
}
function drawBorders(){
  const gb=$('#gB');if(!gb)return;gb.innerHTML='';
  const by={};
  for(const e of borderSegs()){const [a,b]=e.ids;const oa=S.own[a]||null,ob=S.own[b]||null;if(oa===ob)continue;
    for(const o of [oa,ob]){if(!o||!H[o])continue;(by[o]=by[o]||[]).push(`M${e.p[0]},${e.p[1]}L${e.q[0]},${e.q[1]}`);}}
  for(const h in by){const col=UI.mapMode==='dip'?(h===S.me?DIPCOL.self:DIPCOL[dipKey(h)]):H[h].col;
    el('path',{d:by[h].join(''),class:'rb'+(h===S.me?' me':''),stroke:col},gb);}
}
// 駒の向き：命令の行き先、なければ右向き
function faceOf(ar){const o=S.orders[ar.id];if(!o||!o.length)return ar.face||'r';const d=A[o[o.length-1]].c,c=A[ar.a].c;return d[0]<c[0]-1?'l':'r';}
function drawPiece(g,ar,ox,oy,face){
  const col=ar.h===S.me?'#3d6fd6':DIPCOL[dipKey(ar.h)];
  if(UNIT_SPRITE&&UNIT_SPRITE.r){
    const W=UNIT_SPRITE.w,Hh=UNIT_SPRITE.h;
    el('ellipse',{cx:ox,cy:oy+10,rx:15,ry:5.5,fill:col,stroke:H[ar.h].col,'stroke-width':1.6,class:'pbase'},g);
    el('image',{href:face==='l'?UNIT_SPRITE.l:UNIT_SPRITE.r,x:ox-W/2,y:oy+12-Hh,width:W,height:Hh,class:'psprite'},g);
    // 大将の字（小さな札）
    el('rect',{x:ox-18.5,y:oy-19.5,width:14,height:14,rx:3,fill:'#fffaf0',stroke:H[ar.h].col,'stroke-width':1.6},g);
    kamonSVG(g,ar.h,ox-17.5,oy-18.5,12);
    const bx=ox+13,by=oy+7;el('circle',{cx:bx,cy:by,r:5.6,class:'ubadge'},g);const bn=el('text',{x:bx,y:by+2.5,class:'ubn'},g);bn.textContent=ar.u.length;
    {const t=el('text',{x:ox,y:oy+19.5,class:'aname'+(ar.h===S.me?' me':'')},g);t.textContent=cmdOf(ar).n+'の軍勢';
     const n=el('text',{x:ox,y:oy+19.5,class:'anum'+(ar.h===S.me?' me':'')},g);n.textContent=(totU(ar)*100).toLocaleString();}
    if(needsRefill(ar)){const cx=ox+13,cy=oy-14;el('circle',{cx,cy,r:4.2,fill:'#2e9e44',stroke:'#fff','stroke-width':1},g);el('path',{d:`M${cx-2.2},${cy}h4.4M${cx},${cy-2.2}v4.4`,stroke:'#fff','stroke-width':1.3},g);}
    return;
  }
  el('rect',{x:ox-12.5,y:oy-12.5,width:25,height:25,rx:8,fill:col,class:'ring'},g);
  el('rect',{x:ox-9.5,y:oy-9.5,width:19,height:19,rx:6,class:'gbox',fill:'#fffaf0',stroke:H[ar.h].col},g);
  kamonSVG(g,ar.h,ox-7.5,oy-7.5,15);
  const bx=ox+11,by=oy+10;el('circle',{cx:bx,cy:by,r:6,class:'ubadge'},g);const bn=el('text',{x:bx,y:by+2.6,class:'ubn'},g);bn.textContent=ar.u.length;
}
/* ターンの結果：駒が道にそって動く */
function animateMoves(done){
  const svg=$('#map');const gU=$('#gU');if(!svg||!S.lastOrders){done();return;}
  let ga=$('#gAnim');if(!ga){ga=el('g',{id:'gAnim'},svg);}ga.innerHTML='';
  const k=lodK();const tracks=[];
  for(const id in S.lastOrders){
    const st=S.lastStart[id],h=S.lastH&&S.lastH[id];if(!st||!h||!H[h])continue;
    const path=[st].concat(S.lastOrders[id]);const ar=S.armies.find(x=>x.id==id);
    let end=path.length-1;if(ar){const ix=path.indexOf(ar.a);if(ix>=0)end=ix;else if(ar.a===st)end=0;}
    const pts=routePts(path.slice(0,end+1));
    if(pts.length<2)continue;
    if(on3D()){tracks.push({id:+id,h,pts,path:path.slice(0,end+1),lost:!ar});continue;}
    const G=el('g',{},ga);const inner=el('g',{},G);
    const fake={id:+id,h,u:ar?ar.u:[{}],a:st,cmd:ar?ar.cmd:null};
    drawPiece(inner,fake,0,-27,pts[pts.length-1][0]<pts[0][0]?'l':'r');
    const L=[];let tot=0;for(let i=1;i<pts.length;i++){const d=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);L.push(d);tot+=d;}
    tracks.push({G,pts,L,tot,lost:!ar});
  }
  if(!tracks.length){done();return;}
  if(on3D()){T3D.animate(tracks,done);return;}
  // 動く駒の元の位置の駒は隠す
  gU.style.opacity='0.25';
  const T=1700;const t0=performance.now();
  const step=now=>{
    const t=Math.min(1,(now-t0)/T);const e=t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
    for(const tr of tracks){let s=e*tr.tot,i=0;while(i<tr.L.length-1&&s>tr.L[i]){s-=tr.L[i];i++;}
      const a=tr.pts[i],b=tr.pts[i+1],f=tr.L[i]?Math.min(1,s/tr.L[i]):1;const x=a[0]+(b[0]-a[0])*f,y=a[1]+(b[1]-a[1])*f;
      const hop=Math.abs(Math.sin(e*Math.PI*6))*3*k;
      tr.G.setAttribute('transform',`translate(${x},${y-hop}) scale(${k})`);if(tr.lost&&t>0.8)tr.G.style.opacity=String((1-t)*5);}
    if(t<1)requestAnimationFrame(step);else{ga.innerHTML='';gU.style.opacity='';done();}
  };
  requestAnimationFrame(step);
}
function realmParts(h){
  const own=new Set(areasOf(h));const seen=new Set();const parts=[];
  for(const a of own){if(seen.has(a))continue;const comp=[];const q=[a];seen.add(a);
    while(q.length){const x=q.shift();comp.push(x);for(const y of A[x].adj.concat(nbr(x))){if(own.has(y)&&!seen.has(y)){seen.add(y);q.push(y);}}}
    parts.push(comp);}
  return parts;
}
const SHOW_REALM_LABEL=false; // 大名の名前ラベル（CK3風）。true にすると表示する
function drawRealms(){
  const g=$('#gK');g.innerHTML='';
  drawBorders();
  if(!SHOW_REALM_LABEL)return;
  for(const h in H){if(!alive(h))continue;
    const parts=realmParts(h).sort((p,q)=>q.reduce((s,a)=>s+koku(a),0)-p.reduce((s,a)=>s+koku(a),0));
    parts.forEach((comp,i)=>{
      if(i>0&&comp.length<3)return;
      let x=0,y=0,w=0;for(const a of comp){const k=koku(a);x+=A[a].gc[0]*k;y+=A[a].gc[1]*k;w+=k;}
      x/=w;y/=w;
      const n=comp.length;const fs=Math.min(46,10+7*Math.sqrt(n));
      const t=el('text',{x,y:y+fs*0.35,class:'realm'+(h===S.me?' me':''),'font-size':fs,'letter-spacing':fs*0.25,fill:H[h].col},g);
      t.textContent=H[h].n.replace(/（.*）/,'');
    });
  }
}
function drawOrders(){
  const g=$('#gO');g.innerHTML='';
  const k=typeof lodK==='function'?lodK():1;
  const draw=(ord,col,planned)=>{for(const id in ord){
    const ar=S.armies.find(x=>x.id==id);const st=UI.replay?S.lastStart[id]:ar&&ar.a;if(!st)continue;
    const p=[st].concat(ord[id]);if(p.length<2)continue;
    const R0=routePts(p);R0[0]=[R0[0][0],R0[0][1]-27*k];
    // 道にそって進み、終点は少し手前で止めて矢じりをつける
    const hl=15*k,hw=10*k;const {body,tip,base,ux,uy}=arrowShape(R0,6*k,hl);const e=R0[R0.length-1];
    const pts=body.map(q=>q[0].toFixed(1)+','+q[1].toFixed(1)).join(' ');
    const grp=el('g',{class:'mv'+(planned?' plan':'')},g);
    el('polyline',{points:pts,class:'mvbg','stroke-width':8*k},grp);
    el('polyline',{points:pts,class:'mvln',stroke:col,'stroke-width':4.6*k,'stroke-dasharray':`${10*k} ${6*k}`},grp);
    el('polygon',{points:`${tip[0]},${tip[1]} ${base[0]-uy*hw},${base[1]+ux*hw} ${base[0]+uy*hw},${base[1]-ux*hw}`,class:'mvhd',fill:col},grp);
    if(planned)el('circle',{cx:e[0],cy:e[1],r:13*k,class:'mvdst',stroke:col},grp);
  }};
  if(UI.replay){const mine={},oth={};for(const id in S.lastOrders){const h=(S.armies.find(x=>x.id==id)||{}).h;(h===S.me?mine:oth)[id]=S.lastOrders[id];}draw(oth,'#c0392b',false);draw(mine,'#2c5aa0',false);}
  else draw(S.orders,'#1f5fd0',true);
}
/* ---------- 操作 ---------- */
function clickArea(a,h,aid){
  if(UI.justDragged)return;
  if(S.ended||S.dead[S.me])return;
  if(UI.mode==='move'){
    const ar=S.armies.find(x=>x.id===UI.sel);
    if(ar&&UI.reach[a]){const path=UI.reach[a].path;UI.mode=null;UI.reach=null;guardOrder(ar,path,()=>{S.orders[ar.id]=path;refresh();});refresh();return;}
    UI.mode=null;UI.reach=null;refresh();return;
  }
  UI.area=a;UI.mode=null;UI.reach=null;UI.tab=null;
  const mine=armiesAt(a).filter(x=>x.h===S.me);
  UI.cards=new Set();UI.sub=null;
  if(aid&&mine.some(x=>x.id===aid))UI.sel=aid;
  else if(mine.length){if(!mine.some(x=>x.id===UI.sel))UI.sel=mine[0].id;}
  else UI.sel=null;
  refresh();
}
function selArmy(id){UI.tab=null;if(UI.sel!==id){UI.cards=new Set();UI.sub=null;}UI.sel=id;UI.mode=null;UI.reach=null;refresh();}
function togCard(id,ev){ev&&ev.stopPropagation();UI.cards.has(id)?UI.cards.delete(id):UI.cards.add(id);renderPanel();}
/* 右クリック：選んでいる自分の軍勢を、その地域へ進ませる（移動・攻める） */
function rightClickArea(a){
  if(UI.justDragged||S.ended||S.dead[S.me])return;
  const ar=S.armies.find(x=>x.id===UI.sel&&x.h===S.me);
  if(!ar){toast('先に自分の軍勢をクリックして選んでから、行き先を右クリックする');return;}
  if(a===ar.a){delete S.orders[ar.id];UI.mode=null;UI.reach=null;refresh();toast(`${cmdOf(ar).n}の軍勢は${A[a].n}にとどまる`);return;}
  const r=reach(ar);
  if(!r[a]){toast(`${A[a].n}へは、このターンには行けない（遠すぎるか、敵の地域や敵の「にらみの範囲」で止まるため。にらみの範囲に入ると、その敵と戦いになる）`,true);return;}
  const path=r[a].path;UI.mode=null;UI.reach=null;UI.sub=null;refresh();
  guardOrder(ar,path,()=>{S.orders[ar.id]=path;refresh();orderToast(ar,a);});}
function orderToast(ar,a){
  const o=S.own[a];const z=zocOf(S.me);
  toast(`${cmdOf(ar).n}の軍勢：${A[a].n}へ${o&&o!==S.me&&!allied(S.me,o)||!o?'攻める':'進む'}${z.has(ar.a)?'（ただし今は敵のにらみの範囲の中。動く前に戦いになる）':z.has(a)?'（敵のにらみの範囲なので、着いたらその敵と戦う）':''}`,z.has(ar.a)||z.has(a),3200);
}
// 中立の家の領地に入る・約束した家を攻める命令は、出す前にたしかめる
function orderRisk(path){if(!path||!path.length)return null;
  for(const d of path){const o=S.own[d];if(!o||!H[o]||o===S.me)continue;if(rel(S.me,o)==='none'&&!(S.okWar&&S.okWar[o]===S.turn))return {h:o,a:d,kind:'none'};}
  const d=path[path.length-1],o=S.own[d];if(o&&H[o]&&o!==S.me&&friendly(S.me,o))return {h:o,a:d,kind:rel(S.me,o)};
  return null;}
function guardOrder(ar,path,go){const r=orderRisk(path);if(!r){go();return;}
  const n=areasOf(r.h).length;const kn=r.kind==='none'?'中立':r.kind==='domei'?'同盟':r.kind==='kashin'?kashinName(r.h):'不可侵';
  const msg=r.kind==='none'?`${esc(A[r.a].n)}は<b>${esc(hn(r.h))}（${kn}）</b>の領地です。攻めこむと、${esc(hn(r.h))}とは<b class="dn">敵対</b>になり、その軍勢がこちらを攻めてくるようになる。`
    :r.kind==='kashin'?`${esc(hn(r.h))}は<b>${kn}</b>（同じ陣営）である。攻めると<b class="dn">そむいた</b>ことになり、${S.lord&&S.lord[S.me]?'あなたは独立して':'その家は独立して'}敵対になる。`
    :`${esc(hn(r.h))}とは<b>${kn}</b>の約束をしている。攻めると<b class="dn">約束やぶり</b>になり、敵対になる。ほかの家からの信用も落ちる。`;
  UI.warnH=r.h;UI.warnGo=go;
  openDlg(`<div class="wrn"><div class="wrnh"><span class="wrnf" style="--hc:${H[r.h].col}">${kamonHTML(r.h)}</span><div><div class="wrnt">${esc(hn(r.h))}の領地に攻めこむ</div><div class="wrns">${kn}・${n}地域（地図でオレンジに光っている所）</div></div></div>
    <p>${msg}</p><div class="row"><button class="btn" type="button" onclick="closeDlg()">やめる</button><button class="btn pri" type="button" onclick="warnYes()">それでも攻める</button></div></div>`,'wrnbox',true);
  $('#dlg').classList.add('low');refresh();}
function warnYes(){const go=UI.warnGo;const h=UI.warnH;if(h&&rel(S.me,h)==='none'){S.okWar=S.okWar||{};S.okWar[h]=S.turn;}UI.warnGo=null;closeDlg();if(go)go();}
function toast(t,bad,ms){let d=document.getElementById('toast');if(!d){d=document.createElement('div');d.id='toast';document.body.appendChild(d);}
  d.textContent=t;d.className=bad?'bad on':'on';clearTimeout(d._t);d._t=setTimeout(()=>d.className=bad?'bad':'',ms||2200);}
function startMove(){const ar=S.armies.find(x=>x.id===UI.sel);UI.mode='move';UI.sub=null;UI.reach=reach(ar);refresh();}
function stay(){delete S.orders[UI.sel];UI.sub=null;UI.mode=null;UI.reach=null;refresh();}
function doRecruit(t){const ar=S.armies.find(x=>x.id===UI.sel);if(recruit(S.me,ar,t))S.log.push({y:yearNow(),t:`${A[ar.a].n}で${TYPES[t].full}を1000人集める`});refresh();}
function doDisband(){const ar=S.armies.find(x=>x.id===UI.sel);if(!ar||!UI.cards.size)return;const n=UI.cards.size;disband(ar,[...UI.cards]);S.log.push({y:yearNow(),t:`${A[ar.a].n}で${n}部隊を解散する`});UI.cards=new Set();if(!S.armies.includes(ar)){UI.sel=null;delete S.orders[ar.id];}refresh();}
function splitArmy(){const ar=S.armies.find(x=>x.id===UI.sel);const fb=freeBusho(S.me);if(!fb.length){alertMsg('軍勢を分けるには、軍勢を率いていない武将が必要。');return;}
  let move=ar.u.filter(u=>UI.cards.has(u.id));if(!move.length)move=ar.u.slice(Math.ceil(ar.u.length/2));if(move.length===ar.u.length)return;
  ar.u=ar.u.filter(u=>!move.includes(u));const b=newArmy(S.me,ar.a,fb[0].i);b.u=move;UI.cards=new Set();UI.sel=b.id;refresh();}
function mergeHere(){const ar=S.armies.find(x=>x.id===UI.sel);for(const x of armiesAt(ar.a).filter(x=>x.h===S.me&&x!==ar)){while(x.u.length&&ar.u.length<ARMY_MAX)ar.u.push(x.u.shift());if(!x.u.length){delete S.orders[x.id];S.armies=S.armies.filter(y=>y!==x);}}refresh();}
function alertMsg(t){openDlg(`<p>${esc(t)}</p><div class="row"><button class="btn pri" type="button" onclick="closeDlg()">とじる</button></div>`,'',true);}
function newArmyDlg(pre){
  const fb=freeBusho(S.me);const areas=areasOf(S.me);
  if(!areas.length){alertMsg('領地がないので、新しい軍勢はつくれない。');return;}
  if(!fb.length){alertMsg('軍勢を率いていない武将がいないため、新しい軍勢はつくれない。今の軍勢に募兵して部隊を増やすか、軍勢を解散すると、その武将があく。');return;}
  if(UI.naB==null||!fb.some(o=>o.i===UI.naB))UI.naB=fb[0].i;if(pre)UI.naA=pre;if(!UI.naA||!areas.includes(UI.naA))UI.naA=areas[0];
  if(!UI.naQ||pre!==undefined&&UI.naQ._a!==UI.naA)UI.naQ={ashi:1,kiba:0,yumi:0,teppo:0,_a:UI.naA};
  const Q=UI.naQ;const n=TORDER.reduce((s_,t)=>s_+Q[t],0);const cost=TORDER.reduce((s_,t)=>s_+Q[t]*unitCost(t),0);const left=S.gold[S.me]-cost;
  const why=t=>t==='teppo'&&!canTeppo(S.me)?'鉄砲の産地か南蛮貿易が必要':n>=ARMY_MAX?'1つの軍勢は12部隊まで':left<unitCost(t)?'金が足りない':'';
  const over=troopsOf(S.me)+n*UNIT_MAX>capOf(S.me);
  const card=t=>{const w=why(t);return `<div class="ucard rcard ${t} ${w?'dis':''}" ${w?'':`onclick="UI.naQ.${t}++;newArmyDlg()"`} data-tip="${esc(TYPES[t].full+'：'+TYPES[t].d+(w?'　（'+w+'）':''))}">
     <div class="upic" style="background-image:url(img/unit/${t}.png)"><span class="uk2">${TYPES[t].n}</span>${Q[t]?`<b class="naq">×${Q[t]}</b>`:''}</div><div class="un">${uName(t)}</div><div class="ucost">金${unitCost(t)}</div>
     <div class="napm">${Q[t]?`<button type="button" class="btn small" onclick="event.stopPropagation();UI.naQ.${t}--;newArmyDlg()">－</button>`:''}<span class="uplus">${w?'✕':'＋'}</span></div></div>`;};
  openDlg(`<h3>新しい軍勢をつくる</h3>
   <p class="hint">自分の領内の城で、あいている武将を大将にして軍勢をつくる。金がある限り、はじめから部隊（1部隊＝1000人）をいくつでも加えられる（12部隊まで）。</p>
   <label>つくる場所　<select id="naA" onchange="UI.naA=this.value">${areas.map(a=>`<option value="${a}" ${a===UI.naA?'selected':''}>${A[a].n}（${A[a].pv}国）</option>`).join('')}</select></label>
   <div class="sech">大将</div><div class="ucards">${fb.map(o=>bushoCard(o.b,o.i,S.me,o.i===UI.naB,`UI.naB=${o.i};newArmyDlg()`)).join('')}</div>
   <div class="sech">はじめの部隊　<span class="hint">クリックで1部隊ふやす・「－」でへらす</span></div><div class="ucards">${TORDER.map(card).join('')}</div>
   <div class="nasum"><span>部隊 <b>${n}</b>（${(n*UNIT_MAX*100).toLocaleString()}人）</span><span>かかる金 <b>${cost}</b></span><span>のこる金 <b class="${left<0?'dn':''}">${left}</b></span>${over?'<span class="dn">兵が上限をこえる（戦う力が少し落ちる）</span>':''}</div>
   <div class="row"><button class="btn pri" type="button" onclick="doNewArmy()" ${n&&left>=0?'':'disabled'}>この${n}部隊で軍勢をつくる</button><button class="btn" type="button" onclick="closeDlg()">やめる</button></div><div id="naR" class="dn"></div>`,'',true);
}
function doNewArmy(){const a=UI.naA,bi=UI.naB;const Q=UI.naQ||{ashi:1};
  const n=TORDER.reduce((s_,t)=>s_+(Q[t]||0),0);const cost=TORDER.reduce((s_,t)=>s_+(Q[t]||0)*unitCost(t),0);
  if(!n){$('#naR').textContent='部隊を1つ以上えらぶ。';return;}if(cost>S.gold[S.me]){$('#naR').textContent='金が足りない。';return;}
  const ar=newArmy(S.me,a,bi);for(const t of TORDER)for(let k=0;k<(Q[t]||0);k++)recruit(S.me,ar,t);
  S.log.push({y:yearNow(),t:`${A[a].n}で${S.busho[S.me][bi].n}を大将に新しい軍勢（${n}部隊）をつくる`});
  UI.naQ=null;closeDlg();UI.area=a;UI.sel=ar.id;focusOn([a],300);refresh();}
function makeArmy(bi){const a=UI.area;const ar=newArmy(S.me,a,bi);UI.sel=ar.id;refresh();}
function changeCmd(bi){const ar=S.armies.find(x=>x.id===UI.sel);ar.cmd=bi;ar.g=guardMax(ar);refresh();}

/* ---------- 右の欄 ---------- */
function refresh(){drawMap();renderPanel();renderTicker();modeUI();endBtnUI();}
/* ---------- 1ターンの制限時間 ---------- */
const TT={end:0,id:0,warned:false};
function startTurnTimer(){stopTurnTimer();if(!TURN_SEC||!S||S.ended||S.dead[S.me])return;TT.end=performance.now()+TURN_SEC*1000;TT.warned=false;TT.id=setInterval(tickTurnTimer,250);tickTurnTimer();}
function stopTurnTimer(){if(TT.id)clearInterval(TT.id);TT.id=0;TT.end=0;const t=$('#eTimer');if(t)t.style.display='none';}
function tickTurnTimer(){if(!TT.end)return;const left=Math.max(0,(TT.end-performance.now())/1000);const t=$('#eTimer');
  if(t){t.style.display='';const m=Math.floor(left/60),sec=Math.floor(left%60);t.querySelector('b').textContent=`${m}:${String(sec).padStart(2,'0')}`;
    t.querySelector('i').style.width=(left/TURN_SEC*100).toFixed(1)+'%';t.classList.toggle('low',left<=20);}
  if(left<=20&&!TT.warned){TT.warned=true;toast('のこり20秒。命令を急ごう',true);}
  if(left<=0){stopTurnTimer();closeDlg();toast('時間切れ。命令を出していない軍勢は、その場にとどまる',true);UI.mode=null;UI.reach=null;doResolve();}}
function endBtnUI(){
  // Civilizationのように、地図の右下に「次のターンへ」の大きな札を置く
  let b=document.getElementById('endBtn');const mw=document.querySelector('.mapw');
  const show=S&&!S.ended&&!S.dead[S.me]&&$('#map')&&mw;
  if(!show){if(b)b.remove();return;}
  if(!b){b=document.createElement('div');b.id='endBtn';}
  if(b.parentNode!==mw)mw.appendChild(b);
  const mine=armiesOf(S.me);const left=mine.filter(x=>!S.orders[x.id]);
  const next=left[0];
  b.innerHTML=`<div class="ebox"><div class="ehd"><span class="eyr">${wareki(yearNow())}</span><span class="etn">ターン ${S.turn+1}／${YEARS.length}</span></div>
    <div class="etimer" id="eTimer" style="display:none"><span>のこり</span><b>2:00</b><span class="etb"><i></i></span></div>
    <div class="est">${left.length?`<span class="ewarn">命令を出していない軍勢 <b>${left.length}</b></span>`:'<span class="eok">すべての軍勢に命令を出した</span>'}</div>
    ${next?`<button type="button" class="enext" title="命令を出していない軍勢へ">→ ${esc(cmdOf(next).n)}の軍勢へ</button>`:''}</div>
    <button type="button" class="ego${left.length?'':' ready'}" title="${left.length?`命令を出していない軍勢が${left.length}つある（その場にとどまる）`:'命令を確定してターンを終える'}"><span class="eic">▶</span><span class="etx">次の<br>ターンへ</span></button>`;
  b.querySelector('.ego').onclick=()=>confirmOrders();
  tickTurnTimer();
  const nb=b.querySelector('.enext');if(nb)nb.onclick=()=>{UI.area=next.a;selArmy(next.id);focusOn([next.a],300);};
}
function recWhy(t,h,ar){if(t==='teppo'&&!canTeppo(h))return '鉄砲の産地（堺・雑賀・国友）か南蛮貿易が必要';if(ar&&ar.u.length>=ARMY_MAX)return '1つの軍勢は12部隊まで';if(S.gold[h]<unitCost(t))return '金が足りない';return '';}
function recCard(t,h,ar,onclick){const why=recWhy(t,h,ar);
  return `<div class="ucard rcard ${t} ${why?'dis':''} ${onclick&&UI.naT===t?'sel':''}" ${why?'':`onclick="${onclick||`doRecruit('${t}')`}"`} data-tip="${esc(TYPES[t].full+'：'+TYPES[t].d+(why?'　（'+why+'）':''))}">
   <div class="upic" style="background-image:url(img/unit/${t}.png)"><span class="uk2">${TYPES[t].n}</span></div><div class="un">${TYPES[t].full.replace(/（.*）/,'')}</div><div class="ucost">金${unitCost(t)}</div><div class="uplus">${why?'✕':'＋募兵'}</div></div>`;}
function bushoCard(b,i,h,cur,onclick){return `<div class="ucard bcard ${cur?'sel':''}" ${onclick?`onclick="${onclick}"`:''} data-tip="${esc(b.n+'　統率'+b.t)}">
   <span class="gen${faceUrl(h,b.n)?' hasf':''}" style="--hc:${H[h].col}">${faceSpan(h,b)}</span><div class="un bn2">${esc(b.n)}</div><div class="ubar"><i style="width:${b.t}%;background:#8a5a2b"></i></div><div class="unum">統率${b.t}</div>${cur?'<div class="uplus">大将</div>':''}</div>`;}
function cmdCards(ar){const cur=cmdOf(ar);return bushoCard(cur,ar.cmd,ar.h,true)+freeBusho(ar.h).map(o=>bushoCard(o.b,o.i,ar.h,false,`changeCmd(${o.i})`)).join('');}
function unitCard(ar,u){
  const ref=needsRefill(ar)&&u.n<UNIT_MAX-0.05;const sel=UI.cards.has(u.id);
  return `<div class="ucard ${u.t} ${sel?'sel':''}" onclick="${UI.sub==='org'?`togCard(${u.id},event)`:''}" data-tip="${esc(TYPES[u.t].full+'　'+XPL[xpLv(u.xp)]+'（経験'+Math.round(u.xp)+'）：'+TYPES[u.t].d)}">
   ${ref?'<span class="cross">✚</span>':''}<div class="upic" style="background-image:url(img/unit/${u.t}.png)"><span class="uk2">${TYPES[u.t].n}</span></div><div class="un">${TYPES[u.t].full.replace(/（.*）/,'')}</div>
   <div class="ubar"><i style="width:${u.n/UNIT_MAX*100}%"></i></div><div class="unum">${fmt(u.n*100)}人</div><div class="ust">${stars(u.xp)}</div></div>`;
}
function armyMini(ar){const c=cmdOf(ar);const o=S.orders[ar.id];
  return `<div class="army" onclick="selArmy(${ar.id})"><div class="ahead">${genIcon(ar)}<div><b>${esc(c.n)}</b>　<span class="hint">${men(nOf(ar))}・${ar.u.length}部隊　${o?A[o[o.length-1]].n+'へ進む':'とどまる'}</span></div></div></div>`;}
/* 軍勢を選んだときの大きなメニュー */
const SUBS={rec:'募兵',cmd:'大将を替える',org:'編成（分ける・合わせる・解散）'};
function setSub(s){UI.sub=UI.sub===s?null:s;if(s!=='org')UI.cards=new Set();UI.mode=null;UI.reach=null;refresh();}
function nextStep(ar){
  const o=S.orders[ar.id];
  if(UI.mode==='move')return {t:'地図の光っている地域をクリックして、行き先を決める',d:'主な街道は1、山道・海路は2を使い、1ターンに3まで進める。敵の地域に入ると、そこで戦いになる。'};
  if(o)return {t:`命令ずみ：${A[o[o.length-1]].n}へ進む`,d:`通る道：${o.map(x=>A[x].n).join('→')}。ほかの軍勢にも命令を出すか、「命令を確定してターンを終える」を押す。`,done:true};
  if(S.own[ar.a]!==ar.h)return {t:'次にすること：行き先を決めるか、ここにとどまる',d:'ここは自分の領内ではないので、募兵や補充はできない。'};
  return {t:'次にすること：行き先を決めるか、ここにとどまる',d:'部隊が足りないときは「募兵」で兵を加える。'};
}
// 命令ボタンの印（金で描く）
const AIC={
 move:'<svg viewBox="0 0 24 24"><path d="M4 3l9 9-2 2-9-9V3zm16 0v2l-9 9-2-2 9-9h2zM6.5 14.5l3 3-2 2-1-1-2 2-1.5-1.5 2-2-1-1 2.5-1.5zm11 0l2.5 1.5-1 1 2 2-1.5 1.5-2-2-1 1-2-2 3-3z" fill="currentColor"/></svg>',
 stay:'<svg viewBox="0 0 24 24"><path d="M12 2l1 2v1l8 15H3l8-15V4l1-2zm0 6l-4.5 10H11v-5h2v5h3.5L12 8z" fill="currentColor"/><path d="M13 2h5l-1.5 1.5L18 5h-5z" fill="currentColor"/></svg>',
 rec:'<svg viewBox="0 0 24 24"><path d="M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z" fill="currentColor"/></svg>',
 cmd:'<svg viewBox="0 0 24 24"><path d="M5 2h2v20H5zM7 3h11l-3 4 3 4H7z" fill="currentColor"/></svg>',
 org:'<svg viewBox="0 0 24 24"><circle cx="6" cy="6" r="3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="6" cy="18" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8.5 7.5L21 19M8.5 16.5L21 5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>'};
function actionMenu(ar,mine){
  const ns=nextStep(ar);const own=S.own[ar.a]===S.me;const o=S.orders[ar.id];
  const B=(id,ic,label,sub,on,dis,why)=>`<button type="button" class="abtn a-${id} ${on?'on':''}" ${dis?'disabled':''} onclick="${id==='move'?(UI.mode==='move'?'cancelMove()':'startMove()'):id==='stay'?'stay()':`setSub('${id}')`}"><span class="aic">${AIC[id]||ic}</span><b>${label}</b><small>${dis?why:sub}</small></button>`;
  let s=`<div class="next ${ns.done?'done':''} ${UI.mode==='move'?'mv':''}"><b>${ns.t}</b><div>${ns.d}</div>${UI.mode==='move'?'<button type="button" class="btn small" onclick="cancelMove()">やめる</button>':''}</div>
  <div class="amenu">
   ${B('move','⚔',UI.mode==='move'?'行き先を選んでいる…':'移動・攻める','地図で行き先を選ぶ',UI.mode==='move')}
   ${B('stay','⛺','とどまる',o?'命令を取り消す':'この場所を守る',!o&&UI.mode!=='move')}
   ${B('rec','✚','募兵','兵の部隊を加える',UI.sub==='rec',!own,'自分の領内でのみ')}
   ${B('cmd','⚑','大将を替える','あいている武将 '+freeBusho(S.me).length+'人',UI.sub==='cmd',!freeBusho(S.me).length,'あいている武将がいない')}
   ${B('org','✂','編成','分ける・合わせる・解散',UI.sub==='org')}
  </div>`;
  if(UI.sub==='rec'&&own)s+=`<div class="subp"><div class="sech">募兵<span class="hint">　カードを押すと1部隊（1000人）を加える。新兵なので経験は低い。金 ${S.gold[S.me]}</span></div>${ar.u.length>=ARMY_MAX?'<div class="warnb">この軍勢は12部隊でいっぱい。新しい軍勢をつくるか、「編成」で部隊を解散してから募兵する。</div>':''}<div class="ucards">${TORDER.map(t=>recCard(t,S.me,ar)).join('')}</div></div>`;
  if(UI.sub==='cmd')s+=`<div class="subp"><div class="sech">大将を替える<span class="hint">　カードを押すと大将が替わる</span></div><div class="ucards">${cmdCards(ar)}</div></div>`;
  if(UI.sub==='org')s+=`<div class="subp"><div class="sech">編成<span class="hint">　上の部隊カードをクリックして選んでから、ボタンを押す</span></div>
    <div class="row"><button class="btn small" type="button" onclick="splitArmy()">${UI.cards.size?`選んだ${UI.cards.size}部隊で`:'半分で'}新しい軍勢に分ける</button>
    ${mine.length>1?'<button class="btn small" type="button" onclick="mergeHere()">ここにいる軍勢を合わせる</button>':''}
    <button class="btn small danger" type="button" onclick="doDisband()" ${UI.cards.size?'':'disabled'}>選んだ部隊を解散する（${UI.cards.size}）</button></div></div>`;
  return s;
}
function cancelMove(){UI.mode=null;UI.reach=null;refresh();}
function armyCard(ar,mid){
  const c=cmdOf(ar);const o=S.orders[ar.id];const mine=ar.h===S.me;
  return `<div class="army ${ar.id===UI.sel?'on':''}"><div class="ahead">${genIcon(ar,true)}<div><b>${esc(c.n)}</b>（統率${c.t}）<br><span class="hint">${men(nOf(ar))}・${ar.u.length}部隊${needsRefill(ar)?'　<span class="refl">✚補充中</span>':''}</span>${guardMax(ar)?`<br><span class="hgrd" data-tip="${esc('大将を守る重い甲冑の武者。1人で兵'+GP()+'人分の力がある。全滅すると大将は討ち死にする。毎年そろいなおす')}">旗本 ${Math.round(guardOf(ar)*100)}人${ar.cmd===lordIdx(ar.h)?'（当主の馬廻衆）':''}</span>`:''}</div></div>
   ${mid||''}
   <div class="sech">部隊<span class="hint">　${UI.sub==='org'?'クリックして選ぶ':'マウスを重ねるとくわしく出る'}</span></div>
   <div class="ucards">${ar.u.map(u=>unitCard(ar,u)).join('')}</div></div>`;
}
function renderPanel(){
  const me=S.me,h=H[me];
  const cap=capOf(me),tr=troopsOf(me),of=overFac(me);
  const goalN=h.goal.filter(a=>S.own[a]===me).length;
  const rels=neighborsOf(me).filter(alive).map(o=>`<span class="rl ${rel(me,o)}">${H[o].n}：${relName(rel(me,o))}</span>`).join('');
  let sel='';
  const a=UI.area;
  if(a){
    const mine=armiesAt(a).filter(x=>x.h===me);
    const ar=S.armies.find(x=>x.id===UI.sel);
    sel=`<div class="card"><h3>${A[a].n}（${A[a].pv}国）</h3><div class="hint">石高 ${koku(a).toFixed(1)}万石・${A[a].ter==='山'?'山地':'平地'}・${KIND[A[a].k].n}　支配：${S.own[a]?hn(S.own[a]):(NEUTRAL_NAME[a]||'国人衆')}　城兵 ${nStr(S.gar[a])}</div>
     ${mine.map(x=>x.id===UI.sel?armyCard(x,actionMenu(x,mine)):armyMini(x)).join('')}
     ${S.own[a]===me?`<div class="row"><button class="btn small" type="button" onclick="newArmyDlg('${a}')">＋ ここで新しい軍勢をつくる</button></div>`:''}
     ${dipBox(S.own[a])}
    </div>`;
  }
  const head=`<div class="card"><div class="hh">${faceUrl(me)?`<span class="pface" style="--hc:${h.col}"><img src="${faceUrl(me)}" alt=""><i>${kamonHTML(me)}</i></span>`:`<span class="dot big" style="background:${h.col}">${kamonHTML(me)}</span>`}<div><b>${h.n}家</b>${S.landless&&S.landless[me]?'<span class="hkas land">領地なし（軍勢だけ）</span>':''}${playerOf(me)?`<span class="who hu">${HU_SVG}${esc(playerOf(me))}</span>`:''}${S.lord&&S.lord[me]?`<span class="hkas">${esc(H[S.lord[me]].n)}家の家臣</span>`:Object.keys(S.lord||{}).some(v=>S.lord[v]===me&&alive(v))?`<span class="hkas lord">家臣 ${Object.keys(S.lord).filter(v=>S.lord[v]===me&&alive(v)).length}家</span>`:''}<div class="hint">${wareki(yearNow())}（${yearNow()}年）　ターン${S.turn+1}／${YEARS.length}</div>${(()=>{const L=[];for(const k in (S.wabo||{}))if(S.wabo[k]===me)L.push(`<span class="jrst">停戦命令中：${esc(H[k].n)}家（このターン）</span>`);for(const k in (S.siege||{}))if(S.own[k]===me)L.push(`<span class="jrst sg">籠城中：${esc(A[k].n)}（あと${S.siege[k].left}ターン）</span>`);for(const k in (S.waboNext||{}))if(S.waboNext[k]===me)L.push(`<span class="jrst">停戦命令：${esc(H[k].n)}家（次のターン）</span>`);return L.join('');})()}</div></div>
   <div class="stat"><span>石高 <b>${kokuOf(me)}</b>万石</span><span>地域 <b>${areasOf(me).length}</b></span><span>金 <b>${S.gold[me]}</b>（収入+${income(me)}・維持-${upkeep(me)}${nenguOut(me)?`・年貢-${nenguOut(me)}`:''}${nenguIn(me)?`・年貢+${nenguIn(me)}`:''}）</span></div>
   <div class="stat"><span>兵 <b class="${tr>cap&&cap?'dn':''}">${(tr*100).toLocaleString()}人</b>${cap?`／上限 ${(cap*100).toLocaleString()}人`:'（領地がないので補充・募兵はできない）'}</span>${tr>cap&&cap?`<span class="dn">上限をこえている：戦いの力 -${Math.round((1-of)*100)}%</span>`:''}</div>
   <div class="goal ${goalN>=h.need?'done':''}">家の目標：${h.gt}<br><span class="hint">（${h.goal.map(x=>A[x].n+(S.own[x]===me?'✓':'')).join('・')} のうち${h.need}つ）</span></div></div>`;
  const tabs={
   army:()=>`<div class="card"><h3>軍勢の一覧</h3>${armiesOf(me).map(ar=>`<div class="mini" onclick="UI.area='${ar.a}';selArmy(${ar.id});focusOn(['${ar.a}'],300)">${genIcon(ar)} ${A[ar.a].n}：${esc(cmdOf(ar).n)} ${nStr(nOf(ar))}${needsRefill(ar)?' <span class="refl">✚</span>':''}${S.orders[ar.id]?` → ${A[S.orders[ar.id].slice(-1)[0]].n}`:'　<span class="warnb">命令なし</span>'}</div>`).join('')||'<span class="hint">軍勢がない</span>'}
     <button class="btn small wide2" type="button" onclick="newArmyDlg()">＋ 新しい軍勢をつくる（あいている武将 ${freeBusho(me).length}人）</button></div>`,
   pol:()=>`<div class="card"><h3>政策</h3><div class="pols">${POLICIES.filter(p=>p.y<=yearNow()).map(p=>{const ok=policyOk(me,p.id);const done=S.pol[me][p.id];return `<button type="button" class="btn small pol ${done?'done':''} ${p.img?'hasimg':''}" ${ok.ok?'':'disabled'} onclick="doPolicy('${p.id}')" data-tip="${esc(p.d)}">${p.img?`<span class="polimg" style="background-image:url('${p.img}')">${done?'<i class="polst">施行済</i>':''}</span>`:''}<span class="poln">${p.n}${p.cost?`<em>金${p.cost}</em>`:''}${done&&!p.img?' ✓':''}</span>${!ok.ok&&!done?`<small>${ok.why}</small>`:''}<span class="pold">${esc(p.d)}</span></button>`;}).join('')}</div>
     ${POLICIES.some(p=>p.y>yearNow())?`<div class="hint" style="margin-top:6px">これから使えるようになる政策：${POLICIES.filter(p=>p.y>yearNow()).map(p=>`${p.n}（${p.y}年〜）`).join('・')}</div>`:''}</div>`,
   dip:()=>`<div class="card"><h3>書状と外交</h3>${(S.inbox||[]).map((m,i)=>`<div class="inbox">${esc(m.t)}<div class="row"><button class="btn small" type="button" onclick="answerInbox(${i},true)">受ける</button><button class="btn small" type="button" onclick="answerInbox(${i},false)">断る</button></div></div>`).join('')}
     <button class="btn pri wide" type="button" onclick="letterDlg()">書状を書く</button><div class="dipl" style="margin-top:8px">${dipList()}</div></div>`,
   log:()=>`<div class="card"><h3>この家の記録</h3><div class="logs" style="max-height:none">${S.log.slice().reverse().map(l=>`<div>${l.y}年　${esc(l.t)}</div>`).join('')||'<span class="hint">まだない</span>'}</div></div>`};
  const body=S.dead[me]?'<div class="card warn">あなたの家は滅んだ。</div>':(UI.tab&&tabs[UI.tab]?tabs[UI.tab]():(sel||'<div class="card hint">地図の地域をクリックすると、その地域の軍勢や城のようすが出る。自分の軍勢をクリックして命令を出す。上の「軍勢・政策・書状と外交・記録」を押すと、ここにそのメニューが出る。</div>'));
  $('#panel').innerHTML=head+body;
  topTabsUI();
}
/* 画面上の帯のタブ */
const TABS=[['army','軍勢','<svg viewBox="0 0 24 24"><path d="M4 3l9 9-2 2-9-9V3zm16 0v2l-9 9-2-2 9-9h2z" fill="currentColor"/></svg>'],['pol','政策','<svg viewBox="0 0 24 24"><path d="M5 3h11l3 3v15H5zm3 5h8M8 12h8M8 16h5" fill="none" stroke="currentColor" stroke-width="2"/></svg>'],['dip','書状と外交','<svg viewBox="0 0 24 24"><path d="M3 6h18v12H3zm0 0l9 7 9-7" fill="none" stroke="currentColor" stroke-width="2"/></svg>'],['log','記録','<svg viewBox="0 0 24 24"><path d="M6 2h9l4 4v16H6zM9 9h7M9 13h7M9 17h4" fill="none" stroke="currentColor" stroke-width="2"/></svg>']];
function setTab(t){UI.tab=UI.tab===t?null:t;renderPanel();}
function topTabsUI(){const bar=$('#topTabs');if(!bar||!S)return;const me=S.me;
  const badge={army:armiesOf(me).filter(x=>!S.orders[x.id]).length,pol:POLICIES.filter(p=>p.y<=yearNow()&&!S.pol[me][p.id]&&policyOk(me,p.id).ok).length,dip:(S.inbox||[]).length,log:0};
  bar.innerHTML=TABS.map(([k,n,ic])=>`<button type="button" class="ttab ${UI.tab===k?'on':''}" onclick="setTab('${k}')"><span class="tti">${ic}</span>${n}${badge[k]?`<i class="ttb">${badge[k]}</i>`:''}</button>`).join('')
   +`<span class="tsum"><span class="tsk" title="石高">${TI.rice}<b>${kokuOf(me)}</b>万石</span><span class="tsg" title="金">${TI.koban}<b>${S.gold[me]}</b></span><span class="tsh" title="兵の数">${TI.gar()}<b>${(troopsOf(me)*100).toLocaleString()}</b>人</span></span>`
   +((S.inbox||[]).length?`<button type="button" class="tmail" onclick="UI.tab='dip';renderPanel()" title="ほかの家から書状が届いている"><span class="tmi"><svg viewBox="0 0 24 24"><path d="M2 5h20v14H2z" fill="#f6edd2" stroke="#8a5a30" stroke-width="1.2"/><path d="M2 5l10 8 10-8" fill="none" stroke="#8a5a30" stroke-width="1.6"/><circle cx="12" cy="13.5" r="2.6" fill="#a8382a"/></svg><i>${S.inbox.length}</i></span><span>書状が<b>${S.inbox.length}</b>通 届いている</span></button>`:'')
   ;}
// 地域をクリックしたとき：その地域の持ち主の家との外交
function dipBox(o){const me=S.me;if(!o||!H[o]||o===me||!alive(o)||S.dead[me])return '';
  const r=rel(me,o);const L=k=>LETTER_TYPES.find(t=>t.id===k);const myLord=S.lord&&S.lord[me],oLord=S.lord&&S.lord[o];
  const ic={domei:'🤝',fusen:'🕊',support:'⚑',gift:'🎁',break:'✂',threat:'⚔',kudaru:'🙇',kosan:'🏳',dokuritsu:'🗡',wabo:'☮'};
  let want,note='',sub=[];
  if(r==='kashin'){want=letterTypesFor(o);note=myLord===o?`${hn(o)}はあなたの主君。あなたはこの陣営の一員として戦う。`:oLord===me?`${hn(o)}はあなたの家臣。あなたの陣営の一員として戦う。`:`${hn(o)}は同じ陣営（${hn(topOf(o))}の家臣）。`;}
  else if(myLord){want=['gift'];note=`あなたは${hn(myLord)}の家臣なので、ほかの家との外交は主君が行う（贈り物だけはできる）。`;}
  else if(oLord){want=[];note=`${hn(o)}は${hn(oLord)}の家臣。外交は主君の${hn(oLord)}と行う。`;}
  else{want=r==='teki'?['wabo','fusen','gift','threat']:r==='none'?['domei','fusen','gift']:['support','gift','break'];sub=['kudaru','kosan'];}
  const btn=k=>`<button type="button" class="btn small ${k==='kudaru'||k==='kosan'||k==='dokuritsu'?'bkas':''}" onclick="letterDlg('${o}','${k}')">${ic[k]} ${esc(L(k).n)}</button>`;
  const rn=r==='kashin'?kashinName(o):relName(r)==='とくになし'?'中立':relName(r);
  return `<div class="dbox" style="--rc:${DIPCOL[r]||DIPCOL.none}"><div class="dbh">${faceUrl(o)?`<span class="tcface" style="--hc:${H[o].col}"><img src="${faceUrl(o)}" alt=""><i>${kamonHTML(o)}</i></span>`:`<span class="tckm s" style="background:${H[o].col}">${kamonHTML(o)}</span>`}
    <div><b>${esc(hn(o))}との外交</b>${whoTag(o)}<div class="hint">当主 ${esc(lordIdx(o)>=0?S.busho[o][lordIdx(o)].n:'')}・${Math.round(kokuOf(o))}万石・兵${(troopsOf(o)*100).toLocaleString()}人</div></div><span class="tcrel">${rn}</span></div>
    ${note?`<p class="dnote">${esc(note)}</p>`:''}
    ${want.length?`<div class="dbbtns">${want.map(btn).join('')}</div>`:''}
    ${sub.length?`<div class="dbsub"><span>主従</span>${sub.map(btn).join('')}</div>`:''}
    ${oLord&&!myLord&&r!=='kashin'?`<button type="button" class="btn small wide2" onclick="openDip('${oLord}')">${esc(hn(oLord))}（主君）と外交する</button>`:''}
    ${want.length||sub.length?`<button type="button" class="btn small wide2" onclick="letterDlg('${o}')">✉ ${esc(H[o].n)}家に書状を書く（ほかの内容）</button>`:''}</div>`;}
function openDip(o){const a=S.own[H[o].home[0]]===o?H[o].home[0]:areasOf(o)[0];if(!a)return;UI.mode=null;UI.reach=null;clickArea(a);if(typeof focusOn==='function')focusOn([a],200);}
function dipList(){
  const nb=new Set(neighborsOf(S.me));
  const order={kashin:-1,domei:0,fusen:1,teki:2,none:3};
  const hs=Object.keys(H).filter(h=>h!==S.me&&alive(h)).sort((a,b)=>(nb.has(b)-nb.has(a))||(order[rel(S.me,a)]-order[rel(S.me,b)]));
  return `<div class="dleg">${['kashin','domei','fusen','none','teki'].map(k=>`<span><i style="background:${DIPCOL[k]}"></i>${relName(k)==='とくになし'?'中立':relName(k)}</span>`).join('')}</div>`+
   hs.map(h=>`<div class="drow ${nb.has(h)?'nb':''}" onclick="focusOn(areasOf('${h}'),200)"><i style="background:${DIPCOL[rel(S.me,h)]}"></i><span class="dh" style="background:${H[h].col}">${kamonHTML(h)}</span>${playerOf(h)?`<span class="who hu sm">${HU_SVG}${esc(playerOf(h))}</span>`:''}${H[h].n}<span class="hint">${rel(S.me,h)==='kashin'?kashinName(h):relName(rel(S.me,h))==='とくになし'?'中立':relName(rel(S.me,h))}${S.lord&&S.lord[h]&&rel(S.me,h)!=='kashin'?'・'+H[S.lord[h]].n+'家の家臣':''}${nb.has(h)?'・となり':''}・${Math.round(kokuOf(h))}万石</span></div>`).join('');
}
function renderTicker(){
  const rank=Object.keys(H).filter(alive).sort((a,b)=>kokuOf(b)-kokuOf(a)).slice(0,5).map((h,i)=>`${i+1}位 ${H[h].n}（${Math.round(kokuOf(h))}万石）`).join('　');
  $('#tickrun').innerHTML=`<span>石高：${rank}</span>`+S.news.slice(-12).reverse().map(t=>`<span>${esc(t)}</span>`).join('');
}
function doPolicy(id){
  if(id==='joraku'){jorakuDlg();return;}
  applyPolicy(S.me,id);refresh();polDlg(id);
}
// 上洛：将軍の名で「停戦命令」を出す家を1つえらぶ。えらんだ家は、次のターンあなたの領地に攻めこめない
function jorakuDlg(){const me=S.me;const ny=YEARS[S.turn+1];
  const cand=neighborsOf(me).filter(o=>alive(o)&&!sameCamp(me,o));
  const thr=o=>{let n=0;for(const x of armiesOf(o))for(const b of nbr(x.a))if(S.own[b]===me){n+=totU(x);break;}return n;};
  const ord={teki:0,none:1,fusen:2,domei:3};cand.sort((a,b)=>(ord[rel(me,a)]-ord[rel(me,b)])||thr(b)-thr(a));
  const card=o=>{const r=rel(me,o);const t=thr(o);const f=faceUrl(o);
    return `<button type="button" class="jrc ${r}" onclick="jorakuGo('${o}')" style="--hc:${H[o].col};--rc:${DIPCOL[r]}">
      <span class="jrf">${f?`<img src="${f}" alt="">`:''}<i>${kamonHTML(o)}</i></span>
      <span class="jrt"><b>${esc(hn(o))}</b><em>${r==='none'?'中立':relName(r)}</em><small>兵 ${(troopsOf(o)*100).toLocaleString()}人${t?`・<span class="dn">となりに ${(t*100).toLocaleString()}人の軍勢</span>`:''}</small></span>
      <span class="jrgo">停戦を命じる ▶</span></button>`;};
  openDlg(`<div class="jrtop">${polHead(POLICIES.find(x=>x.id==='joraku'))}</div><div class="polbd">
    <div class="jrh">将軍を京都にむかえ、将軍の名で<b>停戦命令</b>を出す</div>
    <div class="jrbox"><div><span class="jrn">1</span>停戦を命じる家を、下から<b>1つ</b>えらぶ。</div>
      <div><span class="jrn">2</span>えらんだ家は、<b>次のターン（${ny?ny+'年':'次の年'}）のあいだ、あなたの領地に攻めこめない</b>。</div>
      <div><span class="jrn">3</span>そのあいだに、ほかの敵と戦ったり、守りを固めたりできる。上洛は1度しか行えない。</div></div>
    <div class="sech">停戦を命じる家（となりの家・攻めてきそうな順）</div>
    <div class="jrl">${cand.length?cand.map(card).join(''):'<p class="hint">となりに家がない。</p>'}</div>
    <div class="row"><button class="btn" type="button" onclick="closeDlg()">やめる（上洛はまだ行わない）</button></div></div>`,'polbox');}
function jorakuGo(o){applyPolicy(S.me,'joraku');S.waboNext[o]=S.me;const ny=YEARS[S.turn+1];
  news(`将軍の名で、${H[o].n}家に停戦命令が出された`);S.log.push({y:yearNow(),t:`上洛し、将軍の名で${hn(o)}に停戦を命じる（${ny||''}年のあいだ攻めてこない）`});
  closeDlg();refresh();
  openDlg(`${polHead(POLICIES.find(x=>x.id==='joraku'))}<div class="polbd"><p class="polbdd">将軍の名で、<b>${esc(hn(o))}</b>に停戦を命じた。<br>${esc(hn(o))}は、<b>${ny?ny+'年':'次のターン'}のあいだ、あなたの領地に攻めこめない</b>。</p><div class="row"><button class="btn pri" type="button" onclick="closeDlg()">とじる</button></div></div>`,'polbox',true);}
// 政策を行ったとき：挿絵と説明を大きく出す
function polHead(p){return p&&p.img?`<div class="polbig" style="background-image:url('${p.img}')"><div class="polbt">${esc(p.n)}</div></div>`:`<h3>${esc(p?p.n:'')}</h3>`;}
function polDlg(id){const p=POLICIES.find(x=>x.id===id);if(!p)return;
  openDlg(`${polHead(p)}<div class="polbd"><p>${esc(hn(S.me))}は「${esc(p.n)}」を行った。</p><p class="polbdd">${esc(p.d)}</p><div class="row"><button class="btn pri" type="button" onclick="closeDlg()">とじる</button></div></div>`,'polbox',true);}
function answerInbox(i,yes){const m=S.inbox[i];S.inbox.splice(i,1);
  if(yes&&m.type==='kashin'){makeVassal(m.from,S.me);S.log.push({y:yearNow(),t:`${hn(m.from)}が軍門に下り、家臣となる`});news(`${hn(m.from)}が${hn(S.me)}の軍門に下り、家臣となった`);}
  else if(yes){setRel(S.me,m.from,m.type);S.log.push({y:yearNow(),t:`${hn(m.from)}と${m.type==='domei'?'同盟':'不可侵の約束'}を結ぶ`});}
  S.letters.push({y:yearNow(),from:m.from,to:S.me,type:m.type,text:m.t,reply:yes?'受けた':'断った',ok:yes});refresh();}
function letterDlg(preTo,preType){
  const nb=neighborsOf(S.me).filter(alive);const others=Object.keys(H).filter(h=>alive(h)&&h!==S.me&&!nb.includes(h));
  const tg=[...new Set(armiesOf(S.me).flatMap(x=>Object.keys(reach(x))))].filter(a=>S.own[a]!==S.me);
  openDlg(`<h3>書状を書く</h3>
   <label>宛先　<select id="lTo">${nb.map(h=>`<option value="${h}">${H[h].n}（となり・${relName(rel(S.me,h))}）${esc(whoTxt(h))}</option>`).join('')}${others.map(h=>`<option value="${h}">${H[h].n}${esc(whoTxt(h))}（${relName(rel(S.me,h))}）</option>`).join('')}</select></label>
   <div id="lTypes">${LETTER_TYPES.map((t,i)=>`<label class="lt" data-k="${t.id}"><input type="radio" name="lt" value="${t.id}" ${(preType?t.id===preType:i===0)?'checked':''}> <b>${t.n}</b> <span class="hint">${t.d}</span></label>`).join('')}</div><p class="hint" id="lNote"></p>
   <label>援軍をたのむ地域　<select id="lTg">${tg.map(a=>`<option value="${a}">${A[a].n}（${A[a].pv}）</option>`).join('')}</select></label>
   <label>ひとこと（記録に残る）<input type="text" id="lTx" maxlength="60" placeholder="例：ともに今川を討とう"></label>
   <div class="row"><button class="btn pri" type="button" onclick="doLetter()">送る</button><button class="btn" type="button" onclick="closeDlg()">やめる</button></div><div id="lRes"></div>`,'',true);
  if(preTo){const sl=$('#lTo');if(sl)sl.value=preTo;}
  // 宛先によって、送れる書状だけを出す
  const upd=()=>{const to=$('#lTo').value;const ok=letterTypesFor(to);let first=null;
    document.querySelectorAll('#lTypes .lt').forEach(l=>{const on=ok.includes(l.dataset.k);l.style.display=on?'':'none';if(on&&!first)first=l;});
    const c=document.querySelector('input[name=lt]:checked');if(!c||!ok.includes(c.value)){if(first)first.querySelector('input').checked=true;}
    const n=$('#lNote');if(n)n.textContent=S.lord&&S.lord[S.me]&&!sameCamp(S.me,to)?`家臣なので、${hn(to)}との外交は主君の${hn(S.lord[S.me])}が行う（送れるのは贈り物だけ）。`:S.lord&&S.lord[to]&&!sameCamp(S.me,to)?`${hn(to)}は${hn(S.lord[to])}の家臣。話は主君にすることになる。`:'';};
  if($('#lTo')){$('#lTo').onchange=upd;upd();}
}
function doLetter(){const to=$('#lTo').value;const type=document.querySelector('input[name=lt]:checked').value;const tg=$('#lTg').value;const tx=$('#lTx').value.trim();
  if(type==='support'&&!tg){$('#lRes').innerHTML='援軍をたのむ地域がない。';return;}
  const L=sendLetter(to,type,type==='support'?tg:null,tx?(LETTER_TYPES.find(x=>x.id===type).n+'：'+tx):null);
  // 送ったら書状の画面を閉じ、返事を画面の真ん中に大きく出す
  closeDlg();refresh();replyDlg(to,type,L);}
// 外交の返事：承知でも断りでも、画面の真ん中に大きく出す
function replyDlg(to,type,L){
  const lt=LETTER_TYPES.find(x=>x.id===type);const ok=!!L.ok;
  const lord=(S.busho[to]||[]).find(b=>!b.dead)||(S.busho[to]||[])[0];const fu=faceUrl(to,lord&&lord.n);
  const stamp=ok?(type==='wabo'?'和睦':type==='gift'?'受納':type==='break'?'了承':type==='kudaru'?'臣従':type==='kosan'?'降伏':type==='dokuritsu'?'独立':'承諾'):'拒絶';
  const html=`<div class="rpw ${ok?'ok':'ng'}">
    <div class="rpt">${esc(hn(to))}からの返事${playerOf(to)?`<span class="who hu lg">${HU_SVG}${esc(playerOf(to))}</span>`:''}</div>
    <div class="rpm">
      <span class="rpf" style="--hc:${H[to].col}">${fu?`<img src="${fu}" alt="">`:`<b>${esc(H[to].k||'')}</b>`}<i>${kamonHTML(to)}</i></span>
      <div class="rpq"><div class="rpq0">「${esc(lt?lt.n:'')}」への返事</div><div class="rpq1">${esc(L.reply)}</div><div class="rpq2">── ${esc(lord?lord.n:hn(to))}</div></div>
      <div class="rps">${stamp}</div>
    </div>
    <div class="row"><button class="btn pri" type="button" onclick="closeDlg()">とじる</button></div></div>`;
  openDlg(html,'rpbox',true);}
// light：外側をクリックするか Esc キーで閉じられる画面（書状・新しい軍勢など）
function openDlg(html,cls,light){const b=$('#dlgBox');b.className=cls||'';b.innerHTML=html;const d=$('#dlg');d.classList.add('on');d.classList.toggle('light',!!light);
  if(!d._hooked){d._hooked=1;d.addEventListener('mousedown',e=>{if(e.target===d&&d.classList.contains('light'))closeDlg();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&d.classList.contains('on')&&d.classList.contains('light'))closeDlg();});}}
function closeDlg(){const d=$('#dlg');d.classList.remove('on');d.classList.remove('low');if(UI.warnH){UI.warnH=null;UI.warnGo=null;refresh();}}

/* ---------- ターンの区切り ---------- */
function confirmOrders(){
  const n=armiesOf(S.me).filter(x=>!S.orders[x.id]).length;
  openDlg(`<h3>命令を確定する</h3><p>${n?`命令を出していない軍勢が${n}つある（その場にとどまる）。`:''}ほかの家の命令と同時に解決される。</p><div class="row"><button class="btn pri" type="button" onclick="closeDlg();doResolve()">確定する</button><button class="btn" type="button" onclick="closeDlg()">もどる</button></div>`,'',true);
}
function battleHTML(b){
  const r=b.r;const meAtt=b.attHs.includes(S.me),meDef=b.def===S.me||b.defHs.includes(S.me);
  const won=(meAtt&&r.win==='att')||(meDef&&r.win==='def');
  const sideN=(hs,own)=>hs.length?hs.map(hn).join('・'):(own?hn(own):(NEUTRAL_NAME[b.a]||'国人衆'));
  return `<div class="bt ${meAtt||meDef?(won?'win':'lose'):''}"><div class="bth">${scrollBand(esc(b.name),'sm')}<span>（${wareki(b.y)}・${A[b.a].pv}国）</span>　<b class="${won?'up':meAtt||meDef?'dn':''}">${r.win==='att'?'攻めた側の勝ち':'守った側の勝ち'}</b></div>
   <table class="btt"><tr><th></th><th>攻める側：${esc(sideN(b.attHs))}</th><th>守る側：${esc(sideN(b.defHs,b.def))}${b.def?'（城兵ふくむ）':''}</th></tr>
   <tr><td>大将</td><td>${esc(r.cmdA.n)}（統率${r.cmdA.t}）</td><td>${esc(r.cmdD.n)}（統率${r.cmdD.t}）</td></tr>
   ${r.formA?`<tr><td>陣形</td><td>${esc(FORMS[r.formA]?FORMS[r.formA].n:'')}</td><td>${esc((b.field?FORMS:SIEGE_CMD)[r.formD]?(b.field?FORMS:SIEGE_CMD)[r.formD].n:'')}</td></tr>`:''}
   <tr><td>はじめ</td><td>${nStr(r.A0)}</td><td>${nStr(r.D0)}</td></tr>
   ${r.log.map(l=>`<tr><td>${l.ph}</td><td>🎲${l.rA}　-${l.lA.toLocaleString()}人</td><td>🎲${l.rD}　-${l.lD.toLocaleString()}人</td></tr>`).join('')}
   <tr><td>のこり</td><td>${nStr(r.A1)}</td><td>${nStr(r.D1)}</td></tr>${r.moA!=null?`<tr><td>士気</td><td>${r.moA}</td><td>${r.moD}</td></tr>`:''}</table>${r.rout==='morale'?`<div class="hint">${esc(r.win==='att'?sideN(b.defHs,b.def):sideN(b.attHs))}は士気がくずれて敗走した</div>`:''}
   ${r.mods.length?`<div class="hint">${r.mods.join('／')}</div>`:''}${r.retreat?`<div class="hint">${esc(r.retreat.side==='A'?sideN(b.attHs):sideN(b.defHs,b.def))}が退却した${r.retreat.idx>=0?`（しんがり：${esc(uName(r.retreat.t))}隊${r.retreat.n1>=0.5?'が食い止めた':'は全滅'}）`:''}</div>`:''}${b.dead?`<div class="dn">討ち死に：${b.dead.join('、')}</div>`:''}${b.ev?`<div class="row"><button class="btn small" type="button" onclick="replayBattle(${S.lastBattles.indexOf(b)})">⚔ 戦いの場面をもう一度見る</button></div>`:''}</div>`;
}
/* ---------- 戦いの場面 ----------
   あなたの軍勢がかかわる戦いは、その場で陣形をえらび、段階ごとに退却を命じられる（エンジンの yield とやりとりする）
   記録からの見なおし（replayBattle）も、同じ画面で自動で進む */
const BV={speed:1,skip:false,run:0,retreatReq:false};
const BT={gen:null};
function doResolve(){stopTurnTimer();
  UI.sel=null;UI.mode=null;UI.reach=null;
  BT.gen=endTurnG();stepTurn();
}
function stepTurn(input){let r;
  try{r=BT.gen.next(input);}catch(e){console.error(e);BT.gen=null;afterResolve();return;}
  if(r.done){BT.gen=null;afterResolve();return;}
  const ev=r.value;
  if(ev.k==='start')LB.open(ev,false,ch=>stepTurn(ch));
  else if(ev.k==='round')LB.round(ev,c=>stepTurn(c));
  else if(ev.k==='retreat')LB.retreat(ev,()=>stepTurn());
  else if(ev.k==='end')LB.end(ev.rec,()=>stepTurn());
  else stepTurn();
}
function afterResolve(){UI.replay=true;refresh();animateMoves(()=>showResultDlg());}
const myBattlesOf=list=>(list||[]).filter(b=>b.attHs.includes(S.me)||b.def===S.me||b.defHs.includes(S.me));
function showResultDlg(){
  const mine=myBattlesOf(S.lastBattles);
  const ev=(S.events||[]).filter(e=>e.h===S.me).map(e=>`<li>${esc(e.t)}</li>`).join('');
  const ik=(S.ikki||[]).filter(i=>i.h===S.me).map(i=>`<li class="dn">${A[i.a].n}で一揆が起きた</li>`).join('');
  openDlg(`<div class="rsh"><div class="yr sm">${wareki(yearNow())}</div><div class="rsht">この年の結果<small>西暦${yearNow()}年</small></div></div>${mine.length?mine.map(battleHTML).join(''):'<p>あなたの軍勢は戦わなかった。</p>'}
   ${ev||ik?`<ul>${ev}${ik}</ul>`:''}
   <p class="hint">全国のうごき：${S.news.slice(-8).map(esc).join('／')}</p>
   <p>収入 +${income(S.me)}　維持費 -${upkeep(S.me)}${nenguOut(S.me)?`　年貢 -${nenguOut(S.me)}`:''}${nenguIn(S.me)?`　年貢 +${nenguIn(S.me)}`:''}　→　金 ${S.gold[S.me]}</p>
   <div class="row"><button class="btn pri" type="button" onclick="closeDlg();goNext()">次のターンへ</button><button class="btn" type="button" onclick="closeDlg()">地図で動きを見る</button></div>`);
}
function replayBattle(i){const b=S.lastBattles[i];if(b)playBattle(b,()=>showResultDlg());}
// 記録から見なおす
function playBattle(b,done){if(!b.ev||!b.ev.length){done();return;}const E=b.ev;let i=0;
  const next=()=>{const ev=E[i++];if(!ev||ev.k==='end'){LB.end(b,done);return;}
    if(ev.k==='start')LB.open(ev,true,next);else if(ev.k==='round')LB.round(ev,next);else if(ev.k==='retreat')LB.retreat(ev,next);else next();};
  next();}
const BV_VERB=[{ashi:'石を投げる',kiba:'弓を射る',yumi:'矢の雨をふらせる',teppo:'鉄砲を撃ちかける'},{ashi:'長柄の鑓をそろえてたたきつける',kiba:'槍を構えて機をうかがう',yumi:'矢を射かける',teppo:'鉄砲を撃つ'},{ashi:'鑓で押しこむ',kiba:'突撃する',yumi:'矢を射かける',teppo:'鉄砲を撃つ'},{ashi:'槍で突きかかる',kiba:'斬りこむ',yumi:'刀をぬいて戦う',teppo:'刀をぬいて戦う'}];
const uName=t=>TYPES[t].full.replace(/（.*）/,'');
function bvCard(c,i,side){return `<div class="bvc ${c.t}${c.gar?' gar':''}" id="bvc${side}${i}"><div class="upic" style="background-image:url(img/unit/${c.t}.png)"><span class="bk">${c.gar?'城':TYPES[c.t].n}</span></div><div class="bn">${c.gar?'城兵':uName(c.t)}</div><div class="bb"><i style="width:100%"></i></div><div class="bm">${Math.round(c.cur*100)}人</div></div>`;}
function bvGuardCard(g,i,side){const f=faceUrl(g.h,g.name);return `<div class="bvc hata${g.main?' main':''}" id="bvg${side}${i}" data-tip="${esc(g.name+'の旗本（重い甲冑の武者）：1人で兵'+GP()+'人分の力。全滅すると大将は討ち死にする')}"><div class="upic" style="${f?`background-image:url(${f});background-size:cover;background-position:center 20%`:''}"><span class="bk">旗</span></div><div class="bn">${esc(g.name)}の旗本</div><div class="bb"><i style="width:100%"></i></div><div class="bm">${Math.round(g.cur*100)}人</div></div>`;}
/* ---------- プレイヤーのニックネーム ----------
   S.players[家]＝ニックネーム。人が動かす家は人のアイコンとニックネーム、コンピューターの家は「コンピューター」と出す */
const HU_SVG='<svg viewBox="0 0 24 24" class="hui"><circle cx="12" cy="7.5" r="4.2" fill="currentColor"/><path d="M3.5 21c.6-4.6 4-7.4 8.5-7.4s7.9 2.8 8.5 7.4z" fill="currentColor"/></svg>';
const playerOf=h=>S&&S.players&&S.players[h]||null;
function whoTag(h){if(!h||!H[h])return '';const n=playerOf(h);return n?`<span class="who hu" title="この家を動かしている人">${HU_SVG}${esc(n)}</span>`:`<span class="who cpu" title="コンピューターが動かしている家">コンピューター</span>`;}
const whoTxt=h=>{const n=playerOf(h);return n?`・👤${n}`:'';};
const LB={};
LB.open=function(ev,auto,cb){
  const run=++BV.run;BV.skip=false;BV.retreatReq=false;
  LB.ev=ev;LB.auto=auto;LB.run=run;LB.ended=false;
  const info=sid=>{const sd=ev[sid];const h=sd.hs[0]||(sid==='D'?ev.def:null)||null;
    return {h,name:h?hn(h)+(sd.hs.length>1?'（ほか'+(sd.hs.length-1)+'家）':''):(NEUTRAL_NAME[ev.a]||'国人衆'),cmd:sd.cmd,col:h&&H[h]?H[h].col:'#8a8580'};};
  const iA=info('A'),iD=info('D');LB.iA=iA;LB.iD=iD;
  const meA=ev.meA,meD=ev.meD;LB.myS=auto?null:(meA?'A':meD?'D':null);LB.meA=meA;LB.meD=meD;
  const CA=ev.A.cards.map(c=>({...c,cur:c.n,n0:c.n})),CD=ev.D.cards.map(c=>({...c,cur:c.n,n0:c.n}));
  const GA=ev.A.guards.map(g=>({...g,cur:g.n,n0:g.max||g.n})),GD=ev.D.guards.map(g=>({...g,cur:g.n,n0:g.max||g.n}));
  Object.assign(LB,{CA,CD,GA,GD});
  const tot=(C,G)=>C.reduce((s,c)=>s+c.cur,0)+G.reduce((s,g)=>s+g.cur,0);LB.tot=tot;
  LB.sA=tot(CA,GA)||1;LB.sD=tot(CD,GD)||1;
  const fm=(sid,k)=>{const F=ev.siege&&sid==='D'?SIEGE_CMD:FORMS;return F[k]?F[k].n:'';};LB.fm=fm;
  const cmdBox=(info,G,sid,mine)=>{const g=G.find(x=>x.main)||G[0];const f=info.h?faceUrl(info.h,info.cmd.n):null;
    return `<div class="bvs ${sid}${mine?' mine':''}" style="--hc:${info.col}"><div class="bvsh">${f?`<span class="bvface" style="--hc:${info.col}"><img src="${f}" alt=""><i>${kamonHTML(info.h)}</i></span>`:info.h?`<span class="bvkm" style="background:${info.col}">${kamonHTML(info.h)}</span>`:''}
      <div><b>${esc(info.name)}</b>${mine?'<span class="bvme">あなた</span>':''}<div class="hint">総大将 ${esc(info.cmd.n)}（統率${info.cmd.t}）</div>
      <div class="bvgd" id="bvgd${sid}">${g?`旗本 <b>${Math.round(g.cur*100)}</b>人`:'旗本なし'}</div><div class="bvfm" id="bvfm${sid}">陣形：―</div>${ev['mo'+sid]!=null?`<div class="bvmo" data-tip="士気：損害や鉄砲の音と煙で下がる。${(typeof MORALE==='object'?MORALE.rout:20)}以下になると軍勢はくずれて敗走する"><span>士気</span><i><b id="bvmo${sid}" style="width:${ev['mo'+sid]}%"></b></i><em id="bvmon${sid}">${ev['mo'+sid]}</em></div>`:''}${ev['sonae'+sid]?'<div class="bvsn">備を立てている</div>':''}</div><div class="bvn" id="bvn${sid}">${Math.round(tot(sid==='A'?CA:CD,G)*100).toLocaleString()}人</div></div>
      <div class="bvcs">${G.map((x,i)=>bvGuardCard(x,i,sid)).join('')}${(sid==='A'?CA:CD).map((c,i)=>bvCard(c,i,sid)).join('')}</div></div>`;};
  openDlg(`<div class="bv"><div class="bvhd">${scrollBand(esc(ev.name||A[ev.a].n+'の戦い'))}<span class="bvsub">${ev.y}年・${A[ev.a].pv}国・${ev.ter==='山'?'山地':'平地'}　<span class="bvkind">${ev.field?'野戦':'城攻め'}</span>${auto?'<span class="hint">　（記録を見なおしている）</span>':''}</span></div>
    <div class="bvmid"><div class="bvlbl">${ev.field?'ぶつかった側':'攻める側'}</div><div class="bvg"><div class="bvga" id="bvga"></div><div class="bvgm" id="bvgm"></div></div><div class="bvlbl r">${ev.field?'迎え撃つ側':'守る側'}</div></div>
    <div class="bvdice"><span class="bvd" id="bvdA">－</span><span id="bvpn" class="bvpn">両軍が陣をしく</span><span class="bvd" id="bvdD">－</span></div>
    <div class="bvfw"><canvas id="bvf" width="920" height="290"></canvas><div class="bvch" id="bvch" style="display:none"></div></div>
    <div class="row bvbtn">${LB.myS?`<button class="btn small bvret" type="button" id="bvRet" disabled>🏳 退却する</button>`:''}<button class="btn small" type="button" id="bvFast">⏩ 早送り</button><button class="btn small" type="button" id="bvSkip">${LB.myS?'この戦いを自動で進める':'結果までとばす'}</button><button class="btn pri" type="button" id="bvNext" style="display:none">つづける</button>
    <div class="bvph" id="bvmods">${(ev.mods||[]).map(m=>`<span class="bvmod">${esc(m)}</span>`).join('')}</div>
    <div class="bvsides">${cmdBox(iA,GA,'A',meA)}${cmdBox(iD,GD,'D',meD)}</div>
    <div class="bvlog" id="bvlog"></div>
</div></div>`,'bvw');
  $('#bvFast').classList.toggle('pri',BV.speed>1);
  $('#bvFast').onclick=function(){BV.speed=BV.speed>1?1:3;this.classList.toggle('pri',BV.speed>1);};
  $('#bvSkip').onclick=()=>{BV.skip=true;};
  if($('#bvRet'))$('#bvRet').onclick=()=>{if(BV.retreatReq)return;BV.retreatReq=true;const b=$('#bvRet');b.textContent='🏳 退却を命じた（この段階のあとに退く）';b.classList.add('on');LB.log(`<b>${esc(LB.my().cmd.n)}が退却を命じた！</b>`,'rout');};
  {const blue='linear-gradient(#5a8be8,#2c5aa0)',red='linear-gradient(#e26b5f,#a8322a)';$('#bvga').style.background=meA?blue:meD?red:iA.col;$('.bvg').style.background=meD?blue:meA?red:iD.col;}
  LB.F=bvField(ev,CA,CD,GA,GD,iA,iD);LB.F.start();
  LB.gauge();
  const reveal=()=>{LB.moA=ev.moA;LB.moD=ev.moD;LB.mo('A',ev.moA);LB.mo('D',ev.moD);$('#bvfmA').textContent='陣形：'+fm('A',ev.formA);$('#bvfmD').textContent='陣形：'+fm('D',ev.formD);LB.F.setForms(ev.formA,ev.formD);
    const mm=[];const fa=FORMS[ev.formA],fd=ev.siege?SIEGE_CMD[ev.formD]:FORMS[ev.formD];
    mm.push(`${esc(iA.name)}：${fa?fa.n:''}`,`${esc(iD.name)}：${fd?fd.n:''}`);
    if(!ev.siege){if(fa&&fa.beats===ev.formD)mm.push(`${fa.n}は${fd.n}に強い`);if(fd&&fd.beats===ev.formA)mm.push(`${fd.n}は${fa.n}に強い`);}
    $('#bvmods').insertAdjacentHTML('beforeend',mm.map(m=>`<span class="bvmod fm">${m}</span>`).join(''));
    LB.log(`<b>${esc(iA.name)}は${fa?fa.n:''}、${esc(iD.name)}は${fd?fd.n:''}をしいた。</b>`,'ph');};
  const go=ch=>{reveal();LB.wait(900).then(()=>{if(LB.alive())cb(ch);});};
  if(LB.myS){
    const sid=LB.myS;const F=ev.siege&&sid==='D'?SIEGE_CMD:FORMS;const keys=Object.keys(F);
    const ic={atk:'▲',bal:'◀▶',def:'●',front:'⚔',honmaru:'🏯'};
    const en=sid==='A'?iD:iA;
    $('#bvch').innerHTML=`<div class="bvcht">${ev.siege&&sid==='D'?'大将はどこで指揮をとるか':'どの陣形で戦うか'}<small>${esc(en.name)}（総大将 ${esc(en.cmd.n)}）と戦う。${ev.siege&&sid==='D'?'城を守る。':''}</small></div>
      <div class="bvchs">${keys.map(k=>`<button type="button" class="bvcb ${k}" data-k="${k}"><span class="bvci">${ic[k]||''}</span><b>${F[k].n}</b><em>${F[k].k}</em><small>${esc(F[k].d)}</small></button>`).join('')}</div>
      ${ev.siege&&sid==='D'?'':'<div class="hint bvchh">陣形の相性：魚鱗の陣は鶴翼の陣に強く、鶴翼の陣は方円の陣に強く、方円の陣は魚鱗の陣に強い。</div>'}`;
    $('#bvch').style.display='';
    document.querySelectorAll('.bvcb').forEach(b=>b.onclick=()=>{const k=b.dataset.k;if(sid==='A')ev.formA=k;else ev.formD=k;$('#bvch').style.display='none';go({form:k});});
  }else LB.wait(600).then(()=>{if(LB.alive())go();});
};
LB.my=function(){return LB.myS==='A'?LB.iA:LB.iD;};
LB.alive=function(){return BV.run===LB.run&&!!$('#bvlog');};
LB.wait=function(ms){return new Promise(ok=>setTimeout(ok,BV.skip?0:ms/BV.speed));};
LB.log=function(t,cls){const g=$('#bvlog');if(!g)return;const d=document.createElement('div');d.className=cls||'';d.innerHTML=t;g.prepend(d);while(g.children.length>6)g.lastChild.remove();};
LB.gauge=function(){const {CA,CD,GA,GD}=LB;const fA=LB.tot(CA,GA)/LB.sA,fD=LB.tot(CD,GD)/LB.sD;const v=fA+fD>0?fA/(fA+fD):0.5;const g=$('#bvga');if(!g)return;g.style.width=(v*100).toFixed(1)+'%';$('#bvgm').style.left=(v*100).toFixed(1)+'%';
  $('#bvnA').textContent=Math.round(LB.tot(CA,GA)*100).toLocaleString()+'人';$('#bvnD').textContent=Math.round(LB.tot(CD,GD)*100).toLocaleString()+'人';
  for(const [G,sid] of [[GA,'A'],[GD,'D']]){const m=G.find(x=>x.main)||G[0];const e=$('#bvgd'+sid);if(e)e.innerHTML=m?(m.cur>0?`旗本 <b>${Math.round(m.cur*100)}</b>人`:'<b class="dn">総大将 討ち死に</b>'):'旗本なし';}};
LB.draw=function(){const {CA,CD,GA,GD}=LB;
  const dc=(L,sid)=>L.forEach((c,i)=>{const e=$('#bvc'+sid+i);if(!e)return;e.querySelector('.bb i').style.width=Math.max(0,c.cur/Math.max(c.n0,0.01)*100)+'%';e.querySelector('.bm').textContent=Math.round(c.cur*100)+'人';e.classList.toggle('dead',c.cur<0.5);});
  const dg=(L,sid)=>L.forEach((g,i)=>{const e=$('#bvg'+sid+i);if(!e)return;e.querySelector('.bb i').style.width=Math.max(0,g.cur/Math.max(g.n0,0.01)*100)+'%';e.querySelector('.bm').textContent=g.cur>0?Math.round(g.cur*100)+'人':'討ち死に';e.classList.toggle('dead',g.cur<=0);});
  dc(CA,'A');dc(CD,'D');dg(GA,'A');dg(GD,'D');};
LB.mo=function(sid,v){const b=$('#bvmo'+sid),n=$('#bvmon'+sid);if(!b||v==null)return;b.style.width=Math.max(0,Math.min(100,v))+'%';b.classList.toggle('low',v<=40);n.textContent=Math.round(v);};
LB.roll=async function(el,v){const e=$(el);if(!e)return;for(let k=0;k<6&&!BV.skip;k++){e.textContent='🎲'+(1+Math.floor(Math.random()*6));await LB.wait(70);}e.textContent='🎲'+v;};
LB.round=async function(ev,cb){if(!LB.alive()){cb&&cb();return;}
  const L=ev.log;const {CA,CD,GA,GD,iA,iD,meA,meD}=LB;const ph=L.pi;
  const rb=$('#bvRet');if(rb&&!BV.retreatReq&&!BV.skip)rb.disabled=false;
  $('#bvpn').innerHTML=`<b>${esc(L.ph)}</b><small>${PHASES[ph].d}</small>`;
  LB.log(`<b>― ${esc(L.ph)} ―</b> ${PHASES[ph].d}`,'ph');
  await Promise.all([LB.roll('#bvdA',L.rA),LB.roll('#bvdD',L.rD)]);
  const fromA=CA.map(c=>c.cur),fromD=CD.map(c=>c.cur),gfA=GA.map(g=>g.cur),gfD=GD.map(g=>g.cur);
  const moA0=LB.moA!=null?LB.moA:LB.ev.moA,moD0=LB.moD!=null?LB.moD:LB.ev.moD;
  const tA=L.nA||fromA,tD=L.nD||fromD,gtA=L.gA||gfA,gtD=L.gD||gfD;
  const dur=3000;LB.F.phase(ph,fromA,tA,fromD,tD,gfA,gtA,gfD,gtD,dur/BV.speed);
  const t0=performance.now();
  while(LB.alive()&&!BV.skip){const k=Math.min(1,(performance.now()-t0)/(dur/BV.speed));const e=Math.max(0,(k-0.25)/0.75);
    CA.forEach((c,i)=>c.cur=fromA[i]+(tA[i]-fromA[i])*e);CD.forEach((c,i)=>c.cur=fromD[i]+(tD[i]-fromD[i])*e);GA.forEach((g,i)=>g.cur=gfA[i]+(gtA[i]-gfA[i])*e);GD.forEach((g,i)=>g.cur=gfD[i]+(gtD[i]-gfD[i])*e);
    if(L.moA!=null){LB.mo('A',moA0+(L.moA-moA0)*e);LB.mo('D',moD0+(L.moD-moD0)*e);}
    LB.draw();LB.gauge();if(k>=1)break;await new Promise(r=>setTimeout(r,90));}
  if(!LB.alive())return;
  if(L.moA!=null){LB.moA=L.moA;LB.moD=L.moD;LB.mo('A',L.moA);LB.mo('D',L.moD);}
  CA.forEach((c,i)=>c.cur=tA[i]);CD.forEach((c,i)=>c.cur=tD[i]);GA.forEach((g,i)=>g.cur=gtA[i]);GD.forEach((g,i)=>g.cur=gtD[i]);LB.draw();LB.gauge();
  const pw=(c,n)=>n*(c.t==='teppo'&&ph===0&&LB.ev.y>=1574?2.4:PHASES[ph].p[c.t]);
  for(const [Cs,from,info,mine] of [[CA,fromA,iA,meA],[CD,fromD,iD,meD]]){
    const best=Cs.map((c,i)=>({c,i,w:pw(c,from[i])})).filter(x=>x.w>0).sort((p,q)=>q.w-p.w)[0];
    const hurt=Cs.map((c,i)=>({c,i,l:from[i]-c.cur})).sort((p,q)=>q.l-p.l)[0];
    const who=mine?'<span class="bvmine">味方</span>':'<span class="bvfoe">敵</span>';
    if(best)LB.log(`${who} ${esc(info.name)}の${best.c.gar?'城兵の':''}${uName(best.c.t)}が${BV_VERB[ph][best.c.t]}！`);
    if(hurt&&hurt.l>0.3)LB.log(`${who} ${esc(info.name)}の${hurt.c.gar?'城兵の':''}${uName(hurt.c.t)}が大きな損害を受けた　<span class="dn">−${Math.round(hurt.l*100).toLocaleString()}人</span>`);
  }
  // 射撃戦：鉄砲の音と煙で士気が下がる／鑓合わせ：敵の足を止めたか／打撃：突撃の深さ
  const nmOf=sid=>(sid==='A'?iA:iD).name,whoS=sid=>((sid==='A'&&meA)||(sid==='D'&&meD))?'<span class="bvmine">味方</span>':'<span class="bvfoe">敵</span>';
  if(ph===0){for(const [v,sid,by] of [[L.supA,'A','D'],[L.supD,'D','A']])if(v>=4)LB.log(`${whoS(sid)} ${esc(nmOf(by))}の鉄砲の音と煙に、${esc(nmOf(sid))}の兵がひるんだ　<span class="dn">士気−${v}</span>`);}
  if(ph===1&&L.pinA!=null){const pa=L.pinA,pd=L.pinD;const hi=pa>=pd?'A':'D',p_=Math.max(pa,pd);
    if(p_>=0.6){LB.log(`${whoS(hi)} ${esc(nmOf(hi))}の長柄足軽が鑓をたたきつけ、${esc(nmOf(hi==='A'?'D':'A'))}の足を止めた！`);LB.F.banner2&&LB.F.banner2(hi);}
    else LB.log('両軍の長柄が押し合い、どちらも足を止めきれない');}
  if(ph===2&&L.strA!=null){for(const [v,sid] of [[L.strA,'A'],[L.strD,'D']]){if(v>=8)LB.log(`${whoS(sid)} 足の止まった敵に、${esc(nmOf(sid))}の騎馬武者と旗本の突撃が深く入った　<span class="up">+${v}%</span>`);else if(v<=-8)LB.log(`${whoS(sid)} 敵の足が止まっておらず、${esc(nmOf(sid))}の突撃ははね返された　<span class="dn">${v}%</span>`);}}
  // 旗本が全滅した大将は討ち死に
  for(const [names,sid] of [[L.deadA||[],'A'],[L.deadD||[],'D']])for(const n of names){LB.F.banner(`${n}、討ち死に！`,1800/BV.speed);LB.log(`<b class="dn">${esc(n)}の旗本が全滅し、${esc(n)}が討ち死にした！</b>`,'rout');await LB.wait(1200);}
  if(L.cmdFall){const lose=L.cmdFall==='A'?iA:L.cmdFall==='D'?iD:null;if(lose)LB.log(`<b>総大将を討ち取られ、${esc(lose.name)}の軍勢は戦えなくなった！</b>`,'rout');}
  else if(L.moraleRout){const lose=L.moraleRout==='A'?iA:iD;LB.F.banner(`${lose.name}、総くずれ！`,1600/BV.speed);LB.log(`<b>士気がくずれ、${esc(lose.name)}の兵が逃げ出した！</b>`,'rout');await LB.wait(1000);}
  await LB.wait(500);
  if(!LB.alive())return;
  if(rb)rb.disabled=true;
  if(LB.auto||!LB.myS){cb&&cb();return;}
  // 退却のたのみは、段階の区切りでエンジンにわたす
  if(!ev.last&&!BV.retreatReq&&!BV.skip&&rb){rb.disabled=false;await LB.wait(700);rb.disabled=true;}
  const want=BV.retreatReq&&!ev.last;cb&&cb({retreat:want});
};
LB.retreat=async function(ev,cb){if(!LB.alive()){cb&&cb();return;}
  const sid=ev.side;const info=sid==='A'?LB.iA:LB.iD;const mine=(sid==='A'&&LB.meA)||(sid==='D'&&LB.meD);
  const C=sid==='A'?LB.CA:LB.CD;
  $('#bvpn').innerHTML=`<b class="${mine?'dn':'up'}">退却</b><small>${esc(info.name)}が退く</small>`;
  if(ev.idx>=0){const nm=uName(ev.t);const lv=xpLv(ev.xp||0);
    LB.F.bubble(sid,'cmd',`${nm}隊、しんがりを命ずる！`,2200/BV.speed);LB.log(`${esc(ev.cmd)}「${nm}隊、しんがりを命ずる！」`,'ph');await LB.wait(1500);
    const reply=lv>=3?'心得た！ここは我らが命にかえても食い止めまする！':lv>=1?'承知！しんがりは我らにおまかせを！':'は、はっ！やってみせまする！';
    LB.F.bubble(sid,ev.idx,reply,2400/BV.speed);LB.log(`しんがりの${nm}隊「${reply}」`);await LB.wait(1700);}
  LB.F.retreat(sid,ev.idx,2600/BV.speed,ev.idx>=0?ev.n1:null);
  const from=C.map(c=>c.cur);const to=sid==='A'?ev.nA:ev.nD;const t0=performance.now(),dur=2600/BV.speed;
  while(LB.alive()&&!BV.skip){const k=Math.min(1,(performance.now()-t0)/dur);C.forEach((c,i)=>c.cur=from[i]+((to?to[i]:c.cur)-from[i])*k);LB.draw();LB.gauge();if(k>=1)break;await new Promise(r=>setTimeout(r,90));}
  if(to)C.forEach((c,i)=>c.cur=to[i]);LB.draw();LB.gauge();
  if(ev.idx>=0){const nm=uName(ev.t);LB.log(ev.n1>=0.5?`<b>しんがりの${nm}隊が敵を食い止め、そのあいだに軍勢は退いた。</b>`:`<b class="dn">しんがりの${nm}隊は全滅した。そのあいだに軍勢は退いた。</b>`,'end');}
  else LB.log(`<b>${esc(info.name)}の軍勢が退いた。</b>`,'end');
  await LB.wait(900);cb&&cb();
};
LB.end=async function(b,cb){
  const fin=()=>{BV.run++;if(LB.F)LB.F.stop();closeDlg();cb&&cb();};
  if(!LB.alive()){fin();return;}
  const r=b.r;const win=r.win;const {iA,iD,meA,meD}=LB;
  if(!r.retreat&&!LB.ended){const lsid=win==='att'?'D':'A';const loseL=lsid==='A'?LB.CA:LB.CD;const fl=lsid==='A'?r.nA1:r.nD1;
    LB.F.rout(lsid,1600/BV.speed);if(fl)loseL.forEach((c,i)=>c.cur=fl[i]);LB.draw();LB.gauge();
    LB.log(`${esc(lsid==='A'?iA.name:iD.name)}の軍勢が${r.rout==='morale'?'士気をなくし、':'くずれ、'}敗走する！`,'rout');}
  LB.ended=true;
  const linfo=win==='att'?iD:iA,winfo=win==='att'?iA:iD;
  const won=(meA&&win==='att')||(meD&&win==='def');const involved=meA||meD;
  $('#bvpn').innerHTML=`<b class="${involved?(won?'up':'dn'):''}">${involved?(won?'勝利！':(r.retreat?'退却':'敗北…')):esc(winfo.name)+'の勝ち'}</b><small>${r.retreat?`${esc(linfo.name)}が退いた`:`${esc(winfo.name)}が${esc(linfo.name)}を破った`}</small>`;
  const out=b.field?(won?'勝ったので、そのまま目的地へ進む。':involved?'もとの領地へ退く。':''):(win==='att'?`${esc(winfo.name)}が${A[b.a].n}を手に入れた。`:`${esc(winfo.name)}が${A[b.a].n}を守りぬいた。`);
  LB.log(`<b>${out}</b>${b.dead?`　<span class="dn">討ち死に：${b.dead.join('、')}</span>`:''}`,'end');
  ['bvFast','bvSkip','bvRet'].forEach(id=>{const e=$('#'+id);if(e)e.style.display='none';});
  const nb=$('#bvNext');nb.style.display='';nb.textContent=LB.auto?'もどる':'つづける';nb.onclick=fin;
  // 結果を戦場の上に大きく出す
  await LB.wait(1300);if(!LB.alive())return;
  const kind=involved?(won?'win':(r.retreat?'ret':'lose')):'other';
  const ttl=involved?(won?'勝利':(r.retreat?'退却':'敗北')):`${winfo.name}の勝ち`;
  const lossA=Math.round(((r.A0?sum(r.A0):0)-(r.A1?sum(r.A1):0))*100),lossD=Math.round(((r.D0?sum(r.D0):0)-(r.D1?sum(r.D1):0))*100);
  const mineA=meA,myLoss=mineA?lossA:lossD,enLoss=mineA?lossD:lossA;
  const why=r.retreat?`${esc(r.retreat.side==='A'?iA.name:iD.name)}が退却した`:(()=>{const L=r.log[r.log.length-1]||{};return L.cmdFall?`総大将を討ち取った`:r.rout==='morale'?`${esc(linfo.name)}の士気がくずれた`:`${esc(linfo.name)}の兵を大きく減らした`;})();
  const box=document.createElement('div');box.className='bvres '+kind;
  box.innerHTML=`<div class="bvrt">${esc(ttl)}</div><div class="bvrs">${why}　─　${out}</div>
    <div class="bvrn">${involved?`<span>味方の損害 <b>${myLoss.toLocaleString()}</b>人</span><span>敵の損害 <b>${enLoss.toLocaleString()}</b>人</span>`:`<span>${esc(iA.name)}の損害 <b>${lossA.toLocaleString()}</b>人</span><span>${esc(iD.name)}の損害 <b>${lossD.toLocaleString()}</b>人</span>`}</div>
    ${b.dead?`<div class="bvrd">討ち死に：${esc(b.dead.join('、'))}</div>`:''}
    <button type="button" class="btn pri bvrb">${LB.auto?'もどる':'つづける ▶'}</button>`;
  const fw=document.querySelector('.bvfw');if(fw){fw.appendChild(box);box.querySelector('.bvrb').onclick=fin;box.querySelector('.bvrb').focus();fw.scrollIntoView({block:'center',behavior:'smooth'});}
};
/* 部隊の絵（斜め上から見た右向きのドット絵。守る側は左右を反転して使う） */
const USPR={};function uSpr(k){if(!USPR[k]){const im=new Image();im.crossOrigin='anonymous';im.src=`img/unit2/${k}.png`;USPR[k]=im;}const im=USPR[k];return im.complete&&im.naturalWidth?im:null;}
['ashi','kiba','yumi','teppo','hata'].forEach(uSpr);
// 戦場の背景：地形（平地・山地）と城攻めで分け、場所ごとに決まった1枚をえらぶ
const BGIMG={};function bgImg(src){if(!BGIMG[src]){const im=new Image();im.crossOrigin='anonymous';im.src=src;BGIMG[src]=im;}return BGIMG[src];}
function pickBg(ev){if(typeof BATTLE_BG!=='object')return null;const k=ev.field?(ev.ter==='山'?'mountain':'plain'):'siege';const L=BATTLE_BG[k];if(!L||!L.length)return null;
  let h=0;for(const ch of String(ev.a))h=(h*31+ch.charCodeAt(0))%9973;return L[h%L.length];}
if(typeof BATTLE_BG==='object')for(const k in BATTLE_BG)for(const b of BATTLE_BG[k])bgImg(b.src);
/* 戦場の図：部隊のかたまりと、大将（旗本）。陣形で並び方が変わる。しんがりの吹き出しも出す */
function bvField(ev,CA,CD,GA,GD,iA,iD){
  const cv=$('#bvf');const g=cv.getContext('2d');const W=cv.width,Hh=cv.height,cx=W/2;const siege=!ev.field;const xw=W*0.5;   // 城攻め：左半分は城の外、右半分は城の中（曲輪）
  const BGL=pickBg(ev);
  const LY=BGL&&BGL.y?BGL.y:[0.06,0.94];                                       // 野戦で並べる上下の範囲
  const SG=BGL&&BGL.inn?BGL:{front:0.46,inn:[0.53,0.84,0.10,0.90],keep:[0.95,0.5]}; // 城攻めの範囲（絵がないときは手で描く城）
  const bg=document.createElement('canvas');bg.width=W;bg.height=Hh;{const x=bg.getContext('2d');let sd=ev.a.length*97+ev.y;const r=()=>(sd=(sd*16807)%2147483647)/2147483647;
    x.fillStyle=ev.ter==='山'?'#8d9f6c':'#b7c27f';x.fillRect(0,0,W,Hh);
    for(let i=0;i<700;i++){x.fillStyle=`rgba(${60+r()*40|0},${90+r()*50|0},${40+r()*30|0},${0.15+r()*0.2})`;x.fillRect(r()*W,r()*Hh,1.5,4);}
    if(ev.ter==='山'){for(let k=0;k<5;k++){const hx=r()*W,hy=k%2?Hh-10:10;for(let c=5;c>0;c--){x.strokeStyle='rgba(70,60,40,0.25)';x.lineWidth=1.2;x.beginPath();x.ellipse(hx,hy,c*28,c*12,0,0,Math.PI*2);x.stroke();}x.fillStyle='rgba(60,80,40,0.25)';x.beginPath();x.ellipse(hx,hy,70,30,0,0,Math.PI*2);x.fill();}}
    if(ev.field){x.fillStyle='rgba(225,210,170,0.8)';x.beginPath();x.moveTo(0,Hh*0.52);x.bezierCurveTo(W*0.3,Hh*0.42,W*0.7,Hh*0.62,W,Hh*0.5);x.lineTo(W,Hh*0.5+14);x.bezierCurveTo(W*0.7,Hh*0.62+14,W*0.3,Hh*0.42+14,0,Hh*0.52+14);x.fill();}
    if(siege){// 城の中：踏み固めた土の曲輪。奥に本丸の塀と天守
      x.fillStyle='#c9b88e';x.fillRect(xw,0,W-xw,Hh);for(let i=0;i<500;i++){x.fillStyle=`rgba(${120+r()*40|0},${100+r()*30|0},${70+r()*20|0},${0.15+r()*0.2})`;x.fillRect(xw+r()*(W-xw),r()*Hh,2,2);}
      const bx=W-150;x.fillStyle='#8a8478';x.fillRect(bx-6,0,10,Hh);x.fillStyle='#e8e2d2';x.fillRect(bx+4,0,4,Hh);x.fillStyle='#3b3a3a';x.fillRect(bx-6,Hh/2-12,14,24);
      for(const [yy,ww] of [[40,60],[Hh-50,70]]){x.fillStyle='#ece6d6';x.fillRect(xw+60,yy-12,ww,22);x.fillStyle='#4a4d55';x.beginPath();x.moveTo(xw+54,yy-10);x.lineTo(xw+60+ww/2,yy-24);x.lineTo(xw+66+ww,yy-10);x.fill();}
      x.fillStyle='#4f6f86';x.fillRect(xw-26,0,12,Hh);
      x.fillStyle='#8a8478';x.fillRect(xw-12,0,16,Hh);x.fillStyle='#6d685e';for(let y=0;y<Hh;y+=10)x.fillRect(xw-12,y,16,1);
      x.fillStyle='#e8e2d2';x.fillRect(xw+4,0,4,Hh);
      x.fillStyle='#3b3a3a';x.fillRect(xw-12,Hh/2-16,20,32);
      const kx=W-46,ky=Hh/2;x.fillStyle='#8a8478';x.fillRect(kx-22,ky+6,44,22);x.fillStyle='#ece6d6';x.fillRect(kx-16,ky-14,32,20);x.fillRect(kx-10,ky-30,20,14);
      x.fillStyle='#3d4048';for(const [w,yy] of [[40,ky-14],[30,ky-30],[20,ky-42]]){x.beginPath();x.moveTo(kx-w/2-4,yy+2);x.lineTo(kx,yy-8);x.lineTo(kx+w/2+4,yy+2);x.fill();}}
  }
  if(BGL){const im=bgImg(BGL.src);const put=()=>{const x=bg.getContext('2d');x.imageSmoothingEnabled=false;x.drawImage(im,0,0,W,Hh);x.fillStyle='rgba(0,0,0,0.08)';x.fillRect(0,0,W,Hh);};
    if(im.complete&&im.naturalWidth)put();else im.addEventListener('load',put,{once:true});}
  const role=c=>c.gar?'gar':c.t==='kiba'?'cav':(c.t==='yumi'||c.t==='teppo')?'rng':'inf';
  const faces={};const faceImg=gd=>{const u=faceUrl(gd.h,gd.name);if(!u)return null;if(!faces[u]){const im=new Image();im.crossOrigin='anonymous';im.src=u;faces[u]=im;}return faces[u];};
  const mk=(C,G,sid,info)=>{const L=C.map((c,i)=>({c,i,sid,role:role(c),col:info.col,x:0,y:0,px:0,py:0,tx:0,ty:0,n:c.cur,nf:c.cur,nt:c.cur,alpha:1,hit:0}));
    const by={};for(const u of L)(by[u.role]=by[u.role]||[]).push(u);
    const col=(list,yc,sp)=>{const per=7;list.forEach((u,k)=>{const c=Math.floor(k/per),rr=k%per,n=Math.min(per,list.length-c*per);u.row=rr-(n-1)/2;u.colk=c;u.yy=yc+u.row*sp;});};
    col(by.inf||[],Hh/2,32);col(by.rng||[],Hh/2,32);col(by.gar||[],Hh/2,32);
    (by.cav||[]).forEach((u,k)=>{const top=k%2===0;const j=Math.floor(k/2);u.yy=top?30+j*26:Hh-30-j*26;u.colk=0;u.row=top?-3:3;});
    G.forEach((gd,k)=>{L.push({g:gd,gi:k,i:-1-k,sid,role:'cmd',col:info.col,x:0,y:0,px:0,py:0,tx:0,ty:0,n:gd.cur,nf:gd.cur,nt:gd.cur,alpha:1,hit:0,row:(k-(G.length-1)/2)*1.6,colk:0,yy:Hh/2+(k-(G.length-1)/2)*44,img:faceImg(gd)});});
    return L;};
  const UA=mk(CA,GA,'A',iA),UD=mk(CD,GD,'D',iD);const ALL=UA.concat(UD);
  let forms={A:ev.formA,D:ev.formD};
  // 陣形による並び方（たて方向のひろがり・前後のずれ）
  const fy=(u)=>{const f=forms[u.sid];const m=u.yy-Hh/2;if(u.role==='cmd')return u.yy;const k=f==='atk'?0.62:f==='bal'?1.22:f==='def'?0.8:1;return Math.max(18,Math.min(Hh-18,Hh/2+m*k));};
  const fx=(u)=>{const f=forms[u.sid];const r=Math.abs(u.row||0);if(u.role==='cmd'||u.role==='gar')return 0;return f==='atk'?-r*13:f==='bal'?r*11:f==='def'?-r*4:0;};
  const X=(u,ph)=>{const m=u.sid==='D';const back=(u.colk||0)*30;let x;const f=forms[u.sid];
    if(u.role==='cmd'){
      if(siege&&m){const X0=SG.inn[0]*W,sp=(SG.inn[1]-SG.inn[0])*W;return f==='front'?X0+sp*0.3:Math.min(SG.keep[0]*W-20,W-40);}
      const base={atk:[150,200,cx-90,cx-70,cx-60],bal:[95,120,150,180,190],def:[70,90,110,125,130]}[f||'bal'][Math.max(0,Math.min(4,ph+1))];
      const v=siege?Math.max(40,Math.min(base*0.75,SG.front*W-110)):base;return m?W-v:v;}
    if(siege&&m){const X0=SG.inn[0]*W,sp=(SG.inn[1]-SG.inn[0])*W,b=back*0.9;
      x={inf:X0+sp*0.16,rng:X0+sp*0.04,cav:X0+sp*0.82,gar:X0+sp*0.58}[u.role]+b;if(u.role==='rng'&&ph>=1)x=X0+sp*0.42+b;if(u.role==='inf'&&ph>=2)x=X0+sp*0.06+b;return Math.min(x,SG.inn[1]*W-10);}
    // ①射撃戦：弓・鉄砲が前　②鑓合わせ：長柄足軽が前に出て敵とぶつかる（弓・鉄砲は後ろへ）　③打撃：騎馬が左右から突撃　④乱戦
    const P={inf:[150,190,cx-52,cx-46,cx-40],rng:[170,250,150,140,150],cav:[110,130,140,cx+70,cx+25],gar:[cx+180,cx+180,cx+180,cx+180,cx+180]}[u.role];
    const pi=Math.max(0,Math.min(4,ph+1));
    let v=P[pi]-back+fx(u);
    if(siege&&!m){const F=SG.front*W;if(u.role==='inf')v=[0.11*W,0.15*W,F-0.09*W,F-0.045*W,F-0.02*W][pi]-back;if(u.role==='cav')v=[0.07*W,0.09*W,0.10*W,F-0.08*W,F-0.055*W][pi]-back;if(u.role==='rng')v=[0.13*W,Math.min(0.2*W,F-0.05*W),0.11*W,0.10*W,0.11*W][pi]-back;v=Math.max(20,v);}
    return m?W-v:v;};
  // 上下の位置：背景ごとの並べる範囲に入れる（城攻めの守る側は城の中、本丸で指揮する大将は天守の前）
  const band=(y,b)=>b[0]*Hh+(y/Hh)*(b[1]-b[0])*Hh;
  const Y=(u,ph)=>{let y=fy(u);if(u.role==='cav'&&ph>=2)y=y+(Hh/2-y)*(ph===2?0.45:0.6);
    if(siege&&u.sid==='D'){if(u.role==='cmd'&&forms.D!=='front')return SG.keep[1]*Hh+18;return band(y,[SG.inn[2],SG.inn[3]]);}
    return band(y,siege?[0.06,0.94]:LY);};
  let cur=-1;for(const u of ALL){u.x=u.px=u.tx=X(u,-1);u.y=u.py=u.ty=Y(u,-1);}
  let fxs=[],t0=0,dur=1,raf=0,stopped=false,rout=null,ret=null;const bubbles=[];let banner=null;
  const blockW=n=>8+Math.max(0,n)*3.4;
  const drawU=u=>{
    if(u.role==='cmd'){const alive=u.n>0.004;const x=u.x,y=u.y;g.save();g.globalAlpha=u.alpha;g.translate(x,y);
      // 旗本：黒い甲冑の武者のかたまりと、大将の顔
      const w=30,h=22;const sp=uSpr('hata');
      g.fillStyle=u.col;g.globalAlpha=u.alpha*0.55;g.beginPath();g.ellipse(0,h/2+4,26,8,0,0,Math.PI*2);g.fill();g.globalAlpha=u.alpha;
      if(sp){const hs=66,ws=hs*sp.naturalWidth/sp.naturalHeight;g.save();if(u.sid==='D')g.scale(-1,1);if(!alive)g.filter='grayscale(1) brightness(.6)';g.imageSmoothingEnabled=false;g.drawImage(sp,-ws/2,h/2+8-hs,ws,hs);g.restore();}
      else{g.fillStyle=alive?'#1d1712':'#55504a';g.strokeStyle='#e2c27a';g.lineWidth=2;g.beginPath();g.rect(-w/2,-h/2+6,w,h);g.fill();g.stroke();
        const fr=Math.max(0,Math.min(1,u.n/Math.max(0.01,u.g.n0||u.g.max||1)));g.fillStyle='#e2c27a';for(let k=0;k<Math.round(fr*8);k++)g.fillRect(-w/2+3+(k%4)*7,-h/2+10+Math.floor(k/4)*8,4,5);
        g.fillStyle=u.col;g.fillRect(u.sid==='A'?-w/2-6:w/2+2,-h/2-14,4,30);g.fillRect(u.sid==='A'?-w/2-6:w/2-10,-h/2-14,12,12);}
      // 総大将の馬印（金の扇）
      if(u.g.main&&alive&&!sp){const px=u.sid==='A'?w/2+4:-w/2-4;g.strokeStyle='#5a4020';g.lineWidth=2;g.beginPath();g.moveTo(px,h/2+4);g.lineTo(px,-h/2-34);g.stroke();
        g.fillStyle='#f0c437';g.strokeStyle='#7a5a10';g.lineWidth=1;g.beginPath();g.moveTo(px,-h/2-30);g.arc(px,-h/2-30,11,-Math.PI*0.95,-Math.PI*0.05);g.closePath();g.fill();g.stroke();
        g.fillStyle='#c0392b';g.beginPath();g.arc(px,-h/2-36,2.6,0,Math.PI*2);g.fill();}
      // 顔
      const r=14;const fy0=sp?-h/2-36:-h/2-10;g.translate(0,fy0+h/2+10);g.save();g.beginPath();g.arc(0,-h/2-10,r,0,Math.PI*2);g.closePath();g.fillStyle=u.col;g.fill();g.clip();
      if(u.img&&u.img.complete&&u.img.naturalWidth){g.imageSmoothingEnabled=false;g.drawImage(u.img,-r,-h/2-10-r,r*2,r*2);}else{g.fillStyle='#fff';g.font='bold 14px "BIZ UDPMincho",serif';g.textAlign='center';g.textBaseline='middle';g.fillText((u.g.name||'将')[0],0,-h/2-10);}
      g.restore();g.lineWidth=2.5;g.strokeStyle=u.g.main?'#f0d68a':'#c9b48a';g.beginPath();g.arc(0,-h/2-10,r,0,Math.PI*2);g.stroke();
      if(!alive){g.strokeStyle='#ff5a4a';g.lineWidth=4;g.beginPath();g.moveTo(-r,-h/2-10-r);g.lineTo(r,-h/2-10+r);g.moveTo(r,-h/2-10-r);g.lineTo(-r,-h/2-10+r);g.stroke();}
      g.translate(0,-(fy0+h/2+10));
      if(u.hit>0){g.fillStyle=`rgba(255,60,40,${u.hit*0.45})`;g.beginPath();g.ellipse(0,h/2+4,26,9,0,0,Math.PI*2);g.fill();}
      g.font='bold 11px "BIZ UDPGothic",sans-serif';g.textAlign='center';g.textBaseline='top';g.lineWidth=3;g.strokeStyle='rgba(0,0,0,0.65)';const lb=alive?(u.g.name||''):'討ち死に';g.strokeText(lb,0,h/2+10);g.fillStyle=alive?'#fff6d8':'#ffb0a4';g.fillText(lb,0,h/2+10);
      g.restore();return;}
    if(u.n<0.3&&!rout&&!(ret&&ret.idx===u.i&&ret.sid===u.sid))return;const w=blockW(u.n),h=20;const x=u.x,y=u.y;g.save();g.globalAlpha=u.alpha;g.translate(x,y);
    const dir=u.sid==='A'?1:-1;const sp=uSpr(u.c.t);const shin=ret&&ret.idx===u.i&&ret.sid===u.sid;
    if(sp){const hs=(u.c.t==='kiba'?38:u.c.t==='yumi'?42:34)+Math.min(10,Math.max(0,u.n))*1.6,ws=hs*sp.naturalWidth/sp.naturalHeight;
      // 家の色の足もと
      g.fillStyle=u.col;g.globalAlpha=u.alpha*0.55;g.beginPath();g.ellipse(0,6,ws*0.42,7,0,0,Math.PI*2);g.fill();g.globalAlpha=u.alpha;
      if(shin){g.strokeStyle='#f0d68a';g.lineWidth=3;g.beginPath();g.ellipse(0,6,ws*0.46,9,0,0,Math.PI*2);g.stroke();}
      if(u.hit>0){g.fillStyle=`rgba(255,60,40,${u.hit*0.5})`;g.beginPath();g.ellipse(0,4,ws*0.45,10,0,0,Math.PI*2);g.fill();}
      g.save();if(dir<0)g.scale(-1,1);g.imageSmoothingEnabled=false;g.drawImage(sp,-ws/2,10-hs,ws,hs);g.restore();
      // 兵科の札
      const lb=u.c.gar?'城':TYPES[u.c.t].n;g.font='bold 11px "BIZ UDPGothic",sans-serif';g.textAlign='center';g.textBaseline='middle';
      const bx=-dir*(ws*0.42),by=10-hs*0.55;g.fillStyle=u.col;g.strokeStyle='#1d1a16';g.lineWidth=1.2;g.beginPath();g.rect(bx-8,by-8,16,16);g.fill();g.stroke();g.fillStyle='#fff';g.fillText(lb,bx,by+1);
      g.restore();return;}
    g.fillStyle=u.col;g.strokeStyle=shin?'#f0d68a':'#1d1a16';g.lineWidth=ret&&ret.idx===u.i&&ret.sid===u.sid?3:1.5;g.beginPath();g.rect(-w/2,-h/2,w,h);g.fill();g.stroke();
    const dots=Math.round(u.n*2);g.fillStyle='rgba(255,255,255,0.55)';for(let k=0;k<dots;k++){const cx_=-w/2+4+Math.floor(k/3)*3.4,cy_=-h/2+5+(k%3)*5;if(cx_<w/2-2)g.fillRect(cx_,cy_,1.6,1.6);}
    g.fillStyle='#1d1a16';g.beginPath();g.moveTo(dir*(w/2),-5);g.lineTo(dir*(w/2+6),0);g.lineTo(dir*(w/2),5);g.fill();
    if(u.hit>0){g.fillStyle=`rgba(255,60,40,${u.hit*0.5})`;g.fillRect(-w/2,-h/2,w,h);}
    g.font='bold 13px "BIZ UDPGothic",sans-serif';g.textAlign='center';g.textBaseline='middle';g.lineWidth=3;g.strokeStyle='rgba(0,0,0,0.6)';const lb=u.c.gar?'城':TYPES[u.c.t].n;g.strokeText(lb,0,1);g.fillStyle='#fff';g.fillText(lb,0,1);
    g.restore();};
  const wrapText=(t,max)=>{g.font='bold 13px "BIZ UDPGothic",sans-serif';const out=[];let line='';for(const ch of [...t]){if(g.measureText(line+ch).width>max){out.push(line);line=ch;}else line+=ch;}if(line)out.push(line);return out;};
  const drawBubble=(b,now)=>{const u=b.u;if(!u)return;const q=(now-b.t0)/b.ms;if(q>1)return;const lines=wrapText(b.text,190);const lw=Math.max(...lines.map(l=>g.measureText(l).width))+18,lh=lines.length*17+12;
    let bx=Math.max(6,Math.min(W-lw-6,u.x-lw/2)),by=Math.max(4,u.y-46-lh);g.save();g.globalAlpha=Math.min(1,q*6,(1-q)*6);
    g.fillStyle='#fffaf0';g.strokeStyle='#2a1f15';g.lineWidth=2;g.beginPath();const r=8;g.moveTo(bx+r,by);g.lineTo(bx+lw-r,by);g.quadraticCurveTo(bx+lw,by,bx+lw,by+r);g.lineTo(bx+lw,by+lh-r);g.quadraticCurveTo(bx+lw,by+lh,bx+lw-r,by+lh);
    g.lineTo(Math.min(bx+lw-14,Math.max(bx+14,u.x+8)),by+lh);g.lineTo(u.x,u.y-22);g.lineTo(Math.min(bx+lw-22,Math.max(bx+6,u.x-6)),by+lh);g.lineTo(bx+r,by+lh);g.quadraticCurveTo(bx,by+lh,bx,by+lh-r);g.lineTo(bx,by+r);g.quadraticCurveTo(bx,by,bx+r,by);g.closePath();g.fill();g.stroke();
    g.fillStyle='#2a1f15';g.textAlign='left';g.textBaseline='top';lines.forEach((l,i)=>g.fillText(l,bx+9,by+7+i*17));g.restore();};
  const frame=now=>{if(stopped||!cv.isConnected)return;raf=requestAnimationFrame(frame);
    const k=Math.min(1,(now-t0)/dur);const mv=Math.min(1,k/0.4);const em=mv<.5?2*mv*mv:1-Math.pow(-2*mv+2,2)/2;const e2=Math.max(0,(k-0.25)/0.75);
    g.drawImage(bg,0,0);
    for(const u of ALL){const mvk=ret?Math.min(1,k/0.85):em;u.x=u.px+(u.tx-u.px)*mvk;u.y=u.py+(u.ty-u.py)*mvk;if(cur>=1&&k>0.35&&k<0.98&&!rout&&!ret){u.x+=Math.sin(now/90+u.i*1.7)*1.6;u.y+=Math.cos(now/110+u.i)*1.2;if(cur===1&&u.role==='inf')u.y+=Math.abs(Math.sin(now/140+u.i))*-4;}
      u.n=u.nf+(u.nt-u.nf)*e2;u.hit=Math.max(0,u.hit-0.04);if(u.nt<u.nf-0.005&&k>0.25&&k<0.95&&Math.random()<0.08)u.hit=1;
      if(rout&&u.sid===rout){u.alpha=Math.max(0.25,1-k*0.7);}
      if(ret&&u.sid===ret.sid&&!(u.i===ret.idx)){u.alpha=Math.max(0,1-Math.max(0,k-0.5)*2);}}
    // 弓・鉄砲は戦いのあいだずっと撃ちつづける（射撃戦がいちばん多い）。ねらいは敵の弓・鉄砲、大将、敵の前線からランダムに
    if(cur>=0&&k>0.15&&k<0.97&&!rout){const rate=cur===0?1.2:0.8;
      for(const u of ALL){if(u.role!=='rng'&&!(u.role==='gar'&&u.c.t!=='ashi'))continue;if(u.n<0.5)continue;if(ret&&u.sid===ret.sid)continue;
        if(Math.random()>(u.c.t==='teppo'?0.10:0.18)*rate)continue;
        const foes=ALL.filter(v=>v.sid!==u.sid&&v.n>0.3&&(!ret||v.sid!==ret.sid||v.i===ret.idx));if(!foes.length)continue;
        const q=Math.random();let pool;
        if(q<0.3)pool=foes.filter(v=>v.role==='rng'||(v.role==='gar'&&v.c.t!=='ashi'));
        else if(q<0.45)pool=foes.filter(v=>v.role==='cmd');
        else{const dir=u.sid==='A'?1:-1;const front=foes.slice().sort((p_,q_)=>dir*(p_.x-q_.x));pool=front.slice(0,Math.max(1,Math.ceil(front.length/3)));}
        if(!pool||!pool.length)pool=foes;const T=pool[Math.floor(Math.random()*pool.length)];
        fxs.push({k:u.c.t==='teppo'?'gun':'arrow',x0:u.x,y0:u.y-8,x1:T.x+(Math.random()-.5)*16,y1:T.y+(Math.random()-.5)*12,t:now,d:u.c.t==='teppo'?180:620+Math.random()*120});}}
    if((cur>=1&&k>0.3&&k<0.95&&!rout)||(ret&&k>0.2&&k<0.95)){const LA=ret?ALL.filter(u=>u.sid!==ret.sid):UA,LD=ret?ALL.filter(u=>u.sid===ret.sid&&u.i===ret.idx):UD;
      for(const u of LA){if(u.n<0.3)continue;let best=null,bd=1e9;for(const v of LD){if(v.n<0.3)continue;const d=Math.hypot(v.x-u.x,v.y-u.y);if(d<bd){bd=d;best=v;}}
        if(best&&bd<blockW(u.n)/2+blockW(best.n)/2+26&&Math.random()<0.25)fxs.push({k:'spark',x0:(u.x+best.x)/2+(Math.random()-.5)*10,y0:(u.y+best.y)/2+(Math.random()-.5)*14,t:now,d:260});}}
    fxs=fxs.filter(f=>now-f.t<f.d+400);
    for(const f of fxs){const q=(now-f.t)/f.d;
      if(f.k==='arrow'&&q<=1){const x=f.x0+(f.x1-f.x0)*q,y=f.y0+(f.y1-f.y0)*q-Math.sin(q*Math.PI)*40;const x2=f.x0+(f.x1-f.x0)*(q-0.05),y2=f.y0+(f.y1-f.y0)*(q-0.05)-Math.sin((q-0.05)*Math.PI)*40;g.strokeStyle='#2a1a0e';g.lineWidth=1.8;g.beginPath();g.moveTo(x2,y2);g.lineTo(x,y);g.stroke();}
      if(f.k==='gun'){if(q<=1){g.strokeStyle='rgba(255,230,150,0.9)';g.lineWidth=1.2;g.beginPath();g.moveTo(f.x0+(f.x1-f.x0)*Math.max(0,q-0.3),f.y0+(f.y1-f.y0)*Math.max(0,q-0.3));g.lineTo(f.x0+(f.x1-f.x0)*q,f.y0+(f.y1-f.y0)*q);g.stroke();}
        const sq=(now-f.t)/(f.d+400);g.fillStyle=`rgba(240,240,235,${0.6*(1-sq)})`;g.beginPath();g.arc(f.x0+(f.x1>f.x0?14:-14)+sq*8,f.y0-sq*10,5+sq*9,0,Math.PI*2);g.fill();}
      if(f.k==='spark'&&q<=1){g.strokeStyle=`rgba(255,${200+Math.random()*55|0},80,${1-q})`;g.lineWidth=1.6;for(let a=0;a<5;a++){const an=a*1.26+f.t%3;g.beginPath();g.moveTo(f.x0,f.y0);g.lineTo(f.x0+Math.cos(an)*(4+q*9),f.y0+Math.sin(an)*(4+q*9));g.stroke();}}}
    {const L=ALL.slice().sort((p,q)=>p.y-q.y);for(const u of L)drawU(u);}
    g.font='bold 13px "BIZ UDPGothic",sans-serif';g.textBaseline='top';g.fillStyle='rgba(255,253,246,0.92)';
    for(const [txt,al,xx] of [[iA.name,'left',8],[iD.name,'right',W-8]]){g.textAlign=al;g.lineWidth=3;g.strokeStyle='rgba(0,0,0,0.55)';g.strokeText(txt,xx,6);g.fillText(txt,xx,6);}
    for(const b of bubbles)drawBubble(b,now);
    if(banner){const q=(now-banner.t0)/banner.ms;if(q<=1){g.save();g.globalAlpha=Math.min(1,q*5,(1-q)*4);g.fillStyle='rgba(20,12,8,0.78)';g.fillRect(0,Hh/2-26,W,52);g.font='bold 30px "Yuji Syuku","BIZ UDPMincho",serif';g.textAlign='center';g.textBaseline='middle';g.fillStyle='#ffb0a4';g.fillText(banner.text,cx,Hh/2+1);g.restore();}}
  };
  const setPhase=(ph,d)=>{cur=ph;t0=performance.now();dur=Math.max(200,d);for(const u of ALL){u.px=u.x;u.py=u.y;u.tx=X(u,ph);u.ty=Y(u,ph);}};
  const find=(sid,idx)=>idx==='cmd'?(ALL.find(u=>u.sid===sid&&u.role==='cmd'&&u.g.main)||ALL.find(u=>u.sid===sid&&u.role==='cmd')||ALL.find(u=>u.sid===sid)):ALL.find(u=>u.sid===sid&&u.i===idx);
  return {start(){t0=performance.now();dur=1000;raf=requestAnimationFrame(frame);},
    setForms(a,d){forms={A:a,D:d};t0=performance.now();dur=900;for(const u of ALL){u.px=u.x;u.py=u.y;u.tx=X(u,-1);u.ty=Y(u,-1);}},
    phase(ph,fA,tA,fD,tD,gfA,gtA,gfD,gtD,d){setPhase(ph,d);
      UA.forEach(u=>{if(u.role==='cmd'){u.nf=gfA[u.gi];u.nt=gtA[u.gi];}else{u.nf=fA[u.i];u.nt=tA[u.i];}});
      UD.forEach(u=>{if(u.role==='cmd'){u.nf=gfD[u.gi];u.nt=gtD[u.gi];}else{u.nf=fD[u.i];u.nt=tD[u.i];}});},
    rout(sid,d){rout=sid;t0=performance.now();dur=d;const L=sid==='A'?UA:UD;for(const u of ALL){u.px=u.x;u.py=u.y;u.nf=u.n;u.nt=u.n;}
      for(const u of L){u.tx=sid==='A'?-40:W+40;u.ty=u.y+(Math.random()-.5)*30;if(u.role!=='cmd')u.nt=u.n*0.85;}
      for(const u of (sid==='A'?UD:UA)){if(u.role==='gar')continue;u.tx=u.x+(sid==='A'?-30:30);u.ty=u.y;}},
    // 退却：しんがりの部隊だけが残り、ほかはマップの外へ。敵はしんがりにせまる
    retreat(sid,idx,d,nTo){ret={sid,idx};t0=performance.now();dur=d;const sh=find(sid,idx);
      for(const u of ALL){u.px=u.x;u.py=u.y;u.nf=u.n;u.nt=u.n;}
      for(const u of ALL){if(u.sid===sid){if(sh&&u===sh){u.tx=u.x+(sid==='A'?20:-20);u.ty=Hh/2;}else{u.tx=sid==='A'?-60:W+60;u.ty=u.y;}}
        else if(sh&&u.role!=='gar'&&u.role!=='cmd'){u.tx=sh.tx+(sid==='A'?blockW(u.n)/2+26:-blockW(u.n)/2-26)+(Math.random()-.5)*20;u.ty=Hh/2+(u.y-Hh/2)*0.45;}}
      if(sh&&nTo!=null)sh.nt=nTo;},
    bubble(sid,idx,text,ms){const u=find(sid,idx);if(u)bubbles.push({u,text,t0:performance.now(),ms:Math.max(600,ms)});},
    banner(text,ms){banner={text,t0:performance.now(),ms:Math.max(600,ms)};},
    stop(){stopped=true;cancelAnimationFrame(raf);}};
}
function goNext(){UI.replay=false;if(!nextTurn()){showEnd();return;}UI.area=null;showEvent();}
/* 和暦（漢数字） */
function kanjiNum(n){const d='〇一二三四五六七八九';if(n===1)return '元';if(n<10)return d[n];if(n<20)return '十'+(n%10?d[n%10]:'');return d[Math.floor(n/10)]+'十'+(n%10?d[n%10]:'');}
function wareki(y){const E=[[1573,'天正'],[1570,'元亀'],[1558,'永禄']];for(const [s0,n] of E)if(y>=s0)return n+kanjiNum(y-s0+1)+'年';return '';}
const scrollBand=(t,cls)=>`<div class="scr${cls?' '+cls:''}"><span>${t}</span></div>`;
function showEvent(){
  const y=yearNow();const ev=EVENTS[y];refresh();
  openDlg(`<div class="evx">${SCENE_IMG[y]?`<div class="evimg" style="background-image:url(${SCENE_IMG[y]})"></div>`:'<div class="evimg none"></div>'}
   <div class="evyr"><div class="yr">${wareki(y)}</div><div class="yrw">西暦${y}年　ターン${S.turn+1}／${YEARS.length}</div></div></div>
   <h3 class="evt">${ev?ev.t:''}</h3><p class="evd">${ev?ev.d:''}</p>
   ${S.honno&&y===1582?`<p class="dn">${hn(S.honno.h)}の家臣がそむき、${A[S.honno.a].n}の軍勢を失った。</p>`:''}
   <div class="steps"><b>このターンにすること</b><ol><li>書状やとなりの人との話し合いで、同盟・不可侵・援軍の約束をする</li><li>兵を集め、政策を選ぶ</li><li>軍勢ごとに行き先を決める</li><li>「命令を確定してターンを終える」を押す</li></ol></div>
   <div class="row"><button class="btn pri" type="button" onclick="closeDlg();startTurnTimer()">はじめる${TURN_SEC?`（命令の時間 ${Math.round(TURN_SEC/60*10)/10}分）`:''}</button></div>`);
}
/* ---------- 終わり ---------- */
function showEnd(){const eb=document.getElementById('endBtn');if(eb)eb.remove();
  const me=S.me;
  const ranks=Object.keys(H).map(h=>({h,s:score(h),k:kokuOf(h)})).sort((a,b)=>b.s-a.s);
  const myRank=ranks.findIndex(r=>r.h===me)+1;
  const hist=S.hist[me];const maxK=Math.max(...hist);const maxT=hist.indexOf(maxK);
  const top=ranks.slice(0,5).map(r=>r.h);if(!top.includes(me))top.push(me);
  const W=520,Hh=210,maxY=Math.max(20,...top.flatMap(h=>S.hist[h]));
  const xs=i=>34+i*(W-60)/YEARS.length,ys=v=>Hh-20-v*(Hh-40)/maxY;
  let g=`<svg viewBox="0 0 ${W} ${Hh}" class="chart"><line x1="34" y1="${Hh-20}" x2="${W-10}" y2="${Hh-20}" stroke="currentColor" stroke-opacity=".3"/>`;
  YEARS.concat([END_YEAR]).forEach((y,i)=>{g+=`<text x="${xs(i)}" y="${Hh-5}" font-size="10" text-anchor="middle" fill="currentColor">${y}</text>`;});
  g+=`<text x="4" y="14" font-size="10" fill="currentColor">万石</text>`;
  for(const h of top){const pts=S.hist[h].map((v,i)=>`${xs(i)},${ys(v)}`).join(' ');g+=`<polyline points="${pts}" fill="none" stroke="${H[h].col}" stroke-width="${h===me?4:2}"/><text x="${xs(S.hist[h].length-1)+4}" y="${ys(S.hist[h].slice(-1)[0])}" font-size="11" fill="${H[h].col}">${H[h].n}</text>`;}
  g+='</svg>';
  const prom=S.promises.filter(p=>p.a===me||p.b===me);const lets=S.letters.filter(l=>l.ok&&(l.type==='domei'||l.type==='fusen'));
  $('#app').innerHTML=`<div class="result">${SCENE_IMG.end?`<div class="rimg" style="background-image:url(${SCENE_IMG.end})"></div>`:''}<div class="hint">わが家の盛衰</div>
   <h2>${H[me].n}家　${S.unifier?(S.unifier===me?'天下統一を果たす':sameCamp(me,S.unifier)?`主君の${H[S.unifier].n}家が天下を統一した（家臣として天下統一を助ける）`:`${H[S.unifier].n}家が天下を統一した`):S.dead[me]?`${S.dead[me]}年に滅ぶ`:`${END_YEAR}年まで生き残る`}</h2>
   <p>最後の石高：<b>${kokuOf(me)}万石</b>（はじめ ${S.start[me]}・最も多かったのは${YEARS[maxT]||END_YEAR}年の${maxK}）　｜　家の目標：<b>${goalDone(me)?'達成':'未達成'}</b>（${H[me].gt}）　｜　順位：<b>${myRank}位</b>／${ranks.length}家</p>
   <div class="cols"><div><h3>石高の移り変わり</h3>${g}</div><div><h3>約束と裏切りの記録</h3><ul class="small">${lets.map(l=>`<li>${l.y}年　${hn(l.from)}→${hn(l.to)}：${esc(l.text)}（${esc(l.reply)}）</li>`).join('')}${prom.map(p=>`<li class="dn">${p.y}年　${esc(p.t)}</li>`).join('')}${!lets.length&&!prom.length?'<li>記録はない</li>':''}</ul></div></div>
   <h3>わが家の合戦</h3><div class="rank">${(S.myBattles||[]).map(b=>`<span class="${b.won?'up':'dn'}">${b.y}年 ${b.name}（${b.pv}）${b.won?'勝ち':'負け'}・相手 ${b.vs}</span>`).join('')||'合戦はなかった'}</div>
   <h3>わが家の歩みと、実際の歴史</h3><div class="tl"><div class="h">わが家の歩み</div><div class="h">${H[me].n}家の実際の歴史</div><div>${S.log.map(l=>`${l.y}年　${esc(l.t)}`).join('<br>')||'―'}</div><div>${H[me].hist}</div></div>
   <h3>信長・秀吉による全国統一の歩み</h3><div class="hist">${HIST.map(h=>`<div><b>${h[0]}</b>　${h[1]}</div>`).join('')}</div>
   <h3>全国の順位</h3><div class="rank">${ranks.map((r,i)=>`<span class="${r.h===me?'me':''}">${i+1}. ${H[r.h].n}（${Math.round(r.k)}万石）${S.dead[r.h]?'・滅亡':''}</span>`).join('')}</div>
   <h3>班で話し合うこと</h3><ol><li>天下統一に近づいた家と、滅んだ家の分かれ目は何だったか。</li><li>信長・秀吉が実際に行ったこと（鉄砲、堺の支配、楽市・楽座、上洛、検地・刀狩、惣無事令）は、ゲームの中のどの行動にあたるか。</li></ol>
   <p class="q">単元を貫く問い：戦国大名は、どのようにして全国統一を進めたのだろうか。</p>
   <div class="row"><button class="btn" type="button" onclick="try{localStorage.removeItem(SAVE_KEY)}catch(e){};titleScreen()">はじめからやり直す</button></div></div>`;
}
/* ---------- タイトル ---------- */
function titleScreen(){const eb=document.getElementById('endBtn');if(eb)eb.remove();
  const sv=load();
  $('#tickrun').innerHTML='<span>1560年、各地の戦国大名が天下をうかがっている</span>';
  let selH=HOUSE_DEF[0][0];
  document.title=GAME_TITLE.n;
  $('#app').innerHTML=`<div class="title">${SCENE_IMG.title?`<div class="timg" style="background-image:url(${SCENE_IMG.title})"></div>`:''}<div class="ttop"><div class="tyomi">${esc(GAME_TITLE.yomi)}</div><h2>${esc(GAME_TITLE.n)}</h2><div class="tsub">${esc(GAME_TITLE.sub)}</div></div>
   <p class="q">単元の問い：戦国大名は、どのようにして全国統一を進めたのだろうか。</p>
   <p>あなたは戦国大名の当主である。兵を集め、街道を通って軍勢を進め、城を取って領地を広げよう。となりの家と同盟を結び、ときには裏切りながら、天下統一をめざす。</p>
   <div class="hpick"><button type="button" id="hprev" title="クリックして家を選ぶ"></button></div>
   <div class="tnick"><label>ニックネーム <input type="text" id="nick" maxlength="12" placeholder="例：たろう" autocomplete="off"></label><span class="hint">外交の画面で、だれが動かしている家かがわかるように出る</span></div>
   <div class="tmode"><button class="btn pri tmb" type="button" id="go"><b>一人で遊ぶ</b><small>ほかの家はコンピューターが動かす</small></button><button class="btn tmb" type="button" id="goMulti"><b>みんなで遊ぶ</b><small>クラスのみんなが家を1つずつ動かす</small></button></div>
   <div class="row">${sv&&sv.S&&!sv.S.ended?`<button class="btn" type="button" id="cont">つづきから（${YEARS[sv.S.turn]}年・${H[sv.S.me].n}家）</button>`:''}</div>
   <details><summary>ルールのまとめ</summary><ul>
    <li>1ターンは2年。1560年から1588年までの15ターンで終わる。1ターンに命令を出せる時間は2分。時間になると、命令を出していない軍勢はその場にとどまる。</li>
    <li>兵は4種類：歩（足軽）・騎（騎馬）・弓・鉄（鉄砲）。歩は騎に強く、騎は弓・鉄に強く、弓・鉄は歩に強い。</li>
    <li>戦いは「射撃戦→鑓合わせ→打撃→乱戦」の段階で進む（決着がつかなければ乱戦がつづく）。射撃戦では弓・鉄砲が撃ち合い、鉄砲の音と煙は敵の士気を下げる。鑓合わせでは長柄足軽が敵の足を止め、足を止めた敵には打撃（騎馬武者と旗本の突撃）が深く入る。</li>
    <li>士気が20以下になった軍勢は、くずれて敗走する。城を守る兵は士気が下がりにくく、城攻めでは攻める側の騎馬は馬を下りて戦い、城の弓・鉄砲は横矢をかける。政策「備を立てる」を行うと、打撃の力が上がり、士気もくずれにくくなる。</li>
    <li>大将には旗本（重い甲冑の武者）がつく。当主は200人、ほかの大将は100人で、1人で兵5人分の力がある。旗本が全滅すると大将は討ち死にする。野戦では、相手の総大将を討ち取るか、相手の兵を大きく減らせば勝ち。</li>
    <li>あなたの軍勢の戦いでは、はじめに陣形をえらぶ。魚鱗の陣（攻め）は鶴翼の陣に強く、鶴翼の陣（つり合い）は方円の陣に強く、方円の陣（守り）は魚鱗の陣に強い。城を守るときは、大将が前線で指揮するか、本丸で指揮するかをえらぶ。</li>
    <li>本拠の城と国の拠点の城は、攻めに負けてもすぐには落ちない。城兵が本丸にこもって籠城し、本拠は3ターン、拠点は2ターン持ちこたえる。そのあいだに軍勢を送り、包囲している敵を破れば城を守れる。包囲の軍勢がいなくなっても、包囲はとける。</li>
    <li>後詰め：命令を出していない軍勢は、となりの自分の城が攻められると、自動で助けに入っていっしょに守る（本拠のまわりに敵がいるときは動かない）。</li>
    <li>旗色が悪いときは「退却する」で退ける。いちばん経験のある部隊がしんがりになって敵を食い止め、そのあいだにほかの部隊が退く。</li>
    <li>軍勢は街道を通って動く。主な街道は1、山道・海路は2を使い、1ターンに3まで進める。敵や国人衆の地域に入るとそこで止まり、戦いになる。</li>
    <li>敵の軍勢がいる地域は、赤い斜線でぬられる（にらみの範囲）。そこに入った軍勢は止まり、その敵の軍勢と戦いになる。</li>
    <li>持てる兵の数は石高で決まる（1万石につき250人）。上限をこえると戦いの力が少し落ちる。兵には維持費がかかる。</li>
    <li>すべての領地を失っても、軍勢が残っていれば家は滅ばない。最後の城を取った大名の家臣になり、領地のない軍勢だけで主君のために戦う（領地がないあいだは維持費がかからない）。「独立する」の書状で下剋上すれば、領地のない軍勢だけで、ふたたび城を取りにいける。自分から軍門に下ったときは、領地をもったまま家臣になる。</li>
    <li>書状で「軍門に下る」と、その家の家臣になる。家臣は主君の陣営の一員になり、主君と同じ相手と同盟・敵対し、主君の軍勢といっしょに戦う。ほかの家との外交は主君が行い、毎ターン収入の2割を年貢として主君に納める。「独立する」の書状で家臣をやめると、主君とは敵対になる。弱い家に「家臣になるよう勧める」こともできる。</li>
    <li>京都を持ち、家臣の家と合わせて全国の石高の${Math.round(UNIFY_SHARE*10)}割以上を持った陣営が出たら、天下統一でゲームが終わる。</li></ul></details>
   <p class="hint">家紋：発光大王堂（hakko-daiodo.com）の家紋素材／アイコン：game-icons.net（Delapouite・Lorc）CC BY 3.0／地図の境界：jpn-atlas（国土地理院「地球地図日本」をもとに作成）／立体の地図の標高：国土地理院（標高タイル）</p></div>`;
  const lordOf=k=>H[k]&&H[k].bu?H[k].bu[0][0]:'';
  const faceH=(k,cls)=>{const d=HOUSE_DEF.find(x=>x[0]===k);return FACE[k]?`<img class="${cls}" src="img/face/${k}.jpg" alt="">`:`<span class="${cls} none">${esc((lordOf(k)||d[1])[0])}</span>`;};
  const prev=()=>{const k=selH;const d=HOUSE_DEF.find(x=>x[0]===k);const hm=A[d[3][0]];
    $('#hprev').innerHTML=`${faceH(k,'hpface')}<div class="hpt"><b>${esc(d[1])}家</b><div>当主　${esc(lordOf(k))}</div><div class="hint">${esc(hm.n)}（${esc(hm.pv)}）　${esc(H[k]?H[k].gt:'')}</div></div><span class="hpchg">家を変える ▾</span>`;};
  // 家の一覧：クリックで選ぶ
  const pick=()=>{openDlg(`<h3>家を選ぶ</h3><p class="hint">☆はおすすめの家。クリックすると、その家に決まる。</p><div class="hgrid">${HOUSE_DEF.map(d=>{const k=d[0],hm=A[d[3][0]];
      return `<button type="button" class="hgc ${k===selH?'on':''}" data-k="${k}" style="--hc:${H[k].col}">${faceH(k,'hgf')}<span class="hgk">${kamonHTML(k)}</span><b>${d[4]?'<i class="hgs">☆</i>':''}${esc(d[1])}家</b><small>${esc(hm.n)}（${esc(hm.pv)}）</small></button>`;}).join('')}</div>`,'hpbox',true);
    document.querySelectorAll('.hgc').forEach(b=>b.onclick=()=>{selH=b.dataset.k;closeDlg();prev();});};
  $('#hprev').onclick=pick;prev();
  const nk=$('#nick');try{nk.value=localStorage.getItem('gunyu_nick')||'';}catch(e){}
  const getNick=()=>{const v=(nk.value||'').trim();if(!v){nk.classList.add('need');nk.focus();toast('ニックネームを入れてください',true);return null;}try{localStorage.setItem('gunyu_nick',v);}catch(e){}return v;};
  nk.oninput=()=>nk.classList.remove('need');
  $('#go').onclick=()=>{const n=getNick();if(!n)return;newGame(selH);S.mode='solo';S.players={[selH]:n};startUI();showEvent();};
  $('#goMulti').onclick=()=>{const n=getNick();if(!n)return;
    openDlg(`<h3>みんなで遊ぶ</h3><p>クラスのみんなが、それぞれ1つの家を動かして同時に遊ぶ形である。先生が「部屋」を作り、みんなは部屋番号を入れて参加する。</p>
      <label>部屋番号 <input type="text" id="room" maxlength="8" placeholder="先生から聞いた番号" disabled></label>
      <p class="hint">みんなで遊ぶ形は、いま準備中である（先生用の画面とあわせて作る）。いまは「一人で遊ぶ」で遊べる。</p>
      <div class="row"><button class="btn pri" type="button" onclick="closeDlg()">もどる</button></div>`,'',true);};
  if($('#cont'))$('#cont').onclick=()=>{S=sv.S;uid=sv.uid;startUI();refresh();startTurnTimer();};
}
function startUI(){
  $('#app').innerHTML=`<div class="topbar" id="topTabs"></div><div class="game"><div class="mapw"><svg id="map"></svg>
   <div class="zm"><button type="button" class="zb" onclick="zoom(0.75)" title="ズームイン">＋</button><button type="button" class="zb" onclick="zoom(1.33)" title="ズームアウト">－</button><button type="button" class="zb t" onclick="fitMap()">全国</button><button type="button" class="zb t" onclick="focusMe()">わが家</button><button type="button" class="zb t v3b" id="b3d" onclick="set3D(!UI.v3)"></button><button type="button" class="zb t" id="bUi" onclick="cycleUi()" title="画面の文字やボタンの大きさ"></button></div>
   <div class="mmode"><button type="button" class="btn small" id="mDip" onclick="setMode('dip')">外交の色</button><button type="button" class="btn small" id="mPow" onclick="setMode('pow')">家ごとの色</button><button type="button" class="btn small" id="mTer" onclick="setMode('ter')">地形</button><span id="dipLeg"></span></div>
   <div class="legend" onclick="this.classList.toggle('open')"><span class="lgt">凡例を見る ▸</span><span class="lgc">${Object.keys(KIND).map(k=>`<svg class="lgi" viewBox="0 0 512 512"><use href="#ic-${k}"/></svg>${KIND[k].n}`).join(' ')}　<span class="lg2d"><span class="lr main"></span>主な街道 <span class="lr mtn"></span>山道 </span><span class="v3only">街道は地図に描きこみ（軍勢は街道にそって動く） </span><span class="lr sea"></span>海路　右下の数字は部隊の数（1部隊＝最大1000人）　大きな印は国の拠点の城　<span class="zocl"></span>赤い斜線＝敵の軍勢がいる地域（にらみの範囲）：入るとそこで止まり、その敵と戦う<span class="v3only"><br>右クリック：選んだ軍勢をその地域へ進める　立体の地図：ドラッグで動かす・右ドラッグで回す・ホイールで拡大　標高：国土地理院（高さは8倍に強調）</span></span></div></div><div id="panel"></div></div>`;
  UI.vb=null;applyUi();buildMap();setTimeout(()=>setMode(UI.mapMode),0);UI.vb=UI.full.slice();focusMe();refresh();set3D(UI.v3,true);
}
/* ---------- 立体の地図 ---------- */
const on3D=()=>!!(UI.v3&&window.T3D&&T3D.ready&&document.querySelector('.mapw.v3'));
function with3D(fn){if(window.T3D)fn();else window.onT3D=fn;}
function set3D(on,first){
  UI.v3=on;if(!first){try{localStorage.setItem('kunitori_view',on?'3d':'2d');}catch(e){}}
  const mw=document.querySelector('.mapw');const b=$('#b3d');
  if(b){b.textContent=on?'平面':'立体';b.title=on?'平面の地図にする':'立体の地図にする';}
  if(!mw)return;
  if(!on){mw.classList.remove('v3');if(window.T3D)T3D.unmount();tip(null);return;}
  with3D(async()=>{if(!UI.v3||!mw.isConnected)return;
    mw.classList.add('v3');
    const ok=await T3D.mount(mw);
    if(!ok){if(T3D.failed){mw.classList.remove('v3');UI.v3=false;if(b){b.textContent='立体';}alertMsg('この端末では立体の地図を表示できないため、平面の地図で表示する。');}return;}
    if(!UI.v3){T3D.unmount();mw.classList.remove('v3');return;}
    focusMe();});
}
/* ---------- 画面の大きさに合わせた表示（レスポンシブ） ---------- */
// 画面の幅と高さから表示の大きさを決める。xs：スマホ・縦長　s：小さい画面　m：Chromebook（1366×768）　l：大きい画面　xl：プロジェクター・大型モニター
const UI_LV={xs:{z:0.92,n:'小'},s:{z:0.88,n:'小'},m:{z:1,n:'中'},l:{z:1.12,n:'大'},xl:{z:1.28,n:'特大'}};
const UI_ORDER=['xs','s','m','l','xl'];
function autoUiLevel(){const w=innerWidth,h=innerHeight;if(w<760||w<h*0.9&&w<1000)return 'xs';
  const bw=w<1100?1:w<1600?2:w<1900?3:4,bh=h<600?1:h<860?2:h<1020?3:4;return UI_ORDER[Math.min(bw,bh)];}
function uiPref(){try{return localStorage.getItem('kunitori_ui')||'auto';}catch(e){return 'auto';}}
function applyUi(){const pref=uiPref();const auto=autoUiLevel();
  // 並べ方は画面の形で決める（スマホ・縦長なら地図の下に操作の欄）。大きさは「表示」ボタンで選んだものを優先
  const lv=auto==='xs'?'xs':(pref==='auto'?auto:pref);const z=UI_LV[pref==='auto'?auto:pref].z;
  const r=document.documentElement;const changed=r.dataset.ui!==lv||r.style.getPropertyValue('--ui')!==String(z);r.dataset.ui=lv;r.style.setProperty('--ui',z);
  const b=document.getElementById('bUi');if(b)b.innerHTML=`表示<br>${pref==='auto'?'自動':UI_LV[pref].n}`;
  if(changed&&S&&$('#map')){setTimeout(()=>{if(on3D())window.dispatchEvent(new Event('resize'));},50);}}
function cycleUi(){const seq=['auto','s','m','l','xl'];const i=seq.indexOf(uiPref());const nx=seq[(i+1)%seq.length];try{localStorage.setItem('kunitori_ui',nx);}catch(e){}applyUi();}
{let t=null;addEventListener('resize',()=>{clearTimeout(t);t=setTimeout(applyUi,120);});}
applyUi();
document.addEventListener('mouseover',e=>{const t=e.target.closest('[data-tip]');if(t)tip(e,esc(t.dataset.tip));else if(!e.target.closest('#map,.v3c,.t3u'))tip(null);});
titleScreen();
