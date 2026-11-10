/* =========================================================
   群雄割拠　ゲームのしくみ
   ========================================================= */
let S=null,uid=1;
const $=q=>document.querySelector(q);
const rnd=n=>Math.floor(Math.random()*n);
const d6=()=>1+rnd(6);
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=rnd(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;};
const sum=o=>TORDER.reduce((s,t)=>s+(o[t]||0),0);
const UNIT_MAX=10;            // 1枚のカード＝最大1000人
const ARMY_MAX=12;            // 1つの軍勢に並べられるカードの数
const XPL=['新兵','足軽','熟練','精鋭','歴戦','手練れ'];
const xpLv=xp=>Math.min(5,Math.floor(xp/20));
const xpFac=xp=>1+0.07*xpLv(xp);
const nOf=ar=>{const c=zero();for(const u of ar.u)c[u.t]+=u.n;return c;};
const totU=ar=>ar.u.reduce((s,u)=>s+u.n,0);
const mkUnit=(t,n,xp=0)=>({id:uid++,t,n,xp});
function cardsFrom(counts,xp=0){const L=[];for(const t of TORDER){let n=Math.round(counts[t]||0);while(n>0){const k=Math.min(UNIT_MAX,n);L.push(mkUnit(t,k,xp));n-=k;}}return L;}
const zero=()=>({ashi:0,kiba:0,yumi:0,teppo:0});
const A={};AREAS.forEach(a=>A[a.id]=a);
function hslHex(h,s,l){s/=100;l/=100;const k=n=>(n+h/30)%12,a=s*Math.min(l,1-l),f=n=>l-a*Math.max(-1,Math.min(k(n)-3,9-k(n),1));return '#'+[f(0),f(8),f(4)].map(x=>Math.round(x*255).toString(16).padStart(2,'0')).join('');}
const H={};
HOUSE_DEF.forEach((h,i)=>{H[h[0]]={id:h[0],n:h[1],k:h[2],home:h[3],star:h[4],goal:h[5],need:h[6],gt:h[7],hist:h[8],bet:h[9],bu:h[10],kr:h[11],
  col:(typeof HOUSE_COL!=='undefined'&&HOUSE_COL[h[0]])||hslHex((i*137.508)%360,58+(i%3)*10,44+(i%4)*6)};});
/* 道のつながり */
const EDGE={};AREAS.forEach(a=>EDGE[a.id]={});
for(const a of AREAS)for(const b of a.adj){if(A[b])EDGE[a.id][b]={c:2,r:'山道'};}
const ROADPAIRS=[];
for(const nm in ROADS){const L=ROADS[nm];for(let i=0;i<L.length-1;i++){const x=L[i],y=L[i+1];if(!A[x]||!A[y]){console.warn('road?',x,y);continue;}EDGE[x][y]={c:1,r:nm};EDGE[y][x]={c:1,r:nm};ROADPAIRS.push([x,y,nm]);}}
for(const [x,y,c] of SEA){if(!A[x]||!A[y])continue;EDGE[x][y]={c,r:'海路'};EDGE[y][x]={c,r:'海路'};}
const nbr=a=>Object.keys(EDGE[a]);
/* 国の拠点の城：国ごとに最初の地域（本城がある場合はその家の本城） */
const PROV_MAIN={};for(const a of AREAS)if(!PROV_MAIN[a.pid])PROV_MAIN[a.pid]=a.id;
for(const h of HOUSE_DEF){const a=h[3][0];PROV_MAIN[A[a].pid]=a;}
const isMain=a=>PROV_MAIN[A[a].pid]===a;
const provAreas=a=>AREAS.filter(x=>x.pid===A[a].pid).map(x=>x.id);

const hn=h=>!h?'国人衆':H[h]?H[h].n+'家':h;
const yearNow=()=>YEARS[S.turn];
// 主従（家臣）：家臣の家は主君の陣営の一員になる。ほかの家との関係（同盟・敵対など）は主君と同じになる
const topOf=h=>(S&&S.lord&&S.lord[h])||h;             // その家の陣営の主君（家臣でなければ自分）
const sameCamp=(a,b)=>!!a&&!!b&&topOf(a)===topOf(b);
const campOf=h=>{const t=topOf(h);return Object.keys(H).filter(x=>alive(x)&&topOf(x)===t);};
const rkey=(a,b)=>[a,b].sort().join('|');
const rel=(a,b)=>{if(a===b)return 'self';if(!a||!b)return 'none';const ta=topOf(a),tb=topOf(b);if(ta===tb)return 'kashin';return S.rel[rkey(ta,tb)]||'none';};
function setRel(a,b,v){if(!a||!b||a===b)return;
  if(sameCamp(a,b)){if(v==='kashin')return;releaseVassal(S.lord[a]?a:b,v);return;}  // 同じ陣営どうしで争うと、家臣は独立する
  S.rel[rkey(topOf(a),topOf(b))]=v;}
// x を L の家臣にする（x の家臣も L の家臣になる）。x のこれまでの約束はなくなり、主君の関係にしたがう
function makeVassal(x,L){L=topOf(L);if(!x||x===L)return;S.lord=S.lord||{};
  for(const v in S.lord)if(S.lord[v]===x)S.lord[v]=L;
  S.lord[x]=L;for(const k in S.rel)if(k.split('|').includes(x))delete S.rel[k];}
// 家臣 x が主君からはなれる。主君との関係は v（ふつうは敵対）、ほかの家とは中立から
function releaseVassal(x,v){if(!S.lord||!S.lord[x])return;const L=S.lord[x];delete S.lord[x];
  for(const k in S.rel)if(k.split('|').includes(x))delete S.rel[k];S.rel[rkey(x,L)]=v||'teki';}
const campKoku=h=>Math.round(campOf(h).reduce((s,x)=>s+kokuOf(x),0)*10)/10;
const friendly=(a,b)=>{if(a===b)return true;const r=rel(a,b);return r==='domei'||r==='fusen'||r==='kashin';};
const allied=(a,b)=>{if(a===b)return true;const r=rel(a,b);return r==='domei'||r==='kashin';};
const alive=h=>!S.dead[h];
const ownerOf=a=>S.own[a]||null;
const areasOf=h=>Object.keys(S.own).filter(a=>S.own[a]===h);
const armiesOf=h=>S.armies.filter(x=>x.h===h);
const armiesAt=a=>S.armies.filter(x=>x.a===a);
const koku=a=>A[a].koku*((S.own[a]&&S.pol[S.own[a]].kenchi)?1.2:1);
const kokuOf=h=>Math.round(areasOf(h).reduce((s,a)=>s+koku(a),0)*10)/10;
const capOf=h=>Math.round(kokuOf(h)*2.5);            // 兵の上限（百人）
const troopsOf=h=>armiesOf(h).reduce((s,x)=>s+totU(x),0);
const overFac=h=>{const c=capOf(h),t=troopsOf(h);if(!c)return 1;return t>c?1-Math.min(0.25,(t-c)/c*0.5):1;};
const isHonjo=(a,h)=>h&&H[h]&&H[h].home[0]===a;
const canTeppo=h=>TEPPO_SRC.some(a=>S.own[a]===h)||S.pol[h].kirisuto;

function garFull(a){
  const h=S.own[a];const k=koku(a);
  if(h)return {ashi:Math.round(k*0.35),kiba:0,yumi:Math.round(k*0.1),teppo:0};
  const p=NEUTRAL_POW[a]||0.8;
  return {ashi:Math.round(k*0.45*p),kiba:0,yumi:Math.round(k*0.12*p),teppo:NEUTRAL_TEPPO.includes(a)?Math.round(k*0.15*p):0};
}
function newGame(me){
  S={me,turn:0,own:{},gar:{},armies:[],busho:{},gold:{},pol:{},rel:{},lord:{},dead:{},log:[],letters:[],promises:[],hist:{},start:{},orders:{},req:[],wabo:{},waboNext:{},news:[],war:{},battles:[],ended:false};
  for(const id in H){S.gold[id]=12;S.pol[id]={};S.hist[id]=[];S.busho[id]=H[id].bu.map(b=>({n:b[0],t:b[1],dead:false}));}
  for(const id in H)for(const a of H[id].home)S.own[a]=id;
  for(const a of AREAS)S.gar[a.id]=garFull(a.id);
  for(const id in H){
    const cap=capOf(id);let tot=Math.round(cap*0.75);
    const homes=H[id].home;const nArm=Math.min(S.busho[id].length,homes.length>=3?2:1);
    for(let i=0;i<nArm;i++){
      const n=Math.round(tot*(i===0?(nArm>1?0.6:1):0.4));
      const kb=H[id].kr;
      const ar={id:uid++,h:id,a:homes[i===0?0:Math.min(homes.length-1,Math.floor(homes.length/2))],cmd:i,u:cardsFrom({ashi:n*(0.8-kb),kiba:n*kb,yumi:n*0.2},25).slice(0,ARMY_MAX)};
      S.armies.push(ar);
    }
  }
  for(const [a,b,v] of REL0)setRel(a,b,v);
  for(const id in H)S.start[id]=kokuOf(id);
  snapshot();
}
function snapshot(){for(const id in H)S.hist[id].push(kokuOf(id));}
function cmdOf(ar){const b=ar.cmd!=null&&S.busho[ar.h]?S.busho[ar.h][ar.cmd]:null;return b&&!b.dead?b:{n:'足軽大将',t:50};}
function freeBusho(h){const used=new Set(armiesOf(h).map(x=>x.cmd));return S.busho[h].map((b,i)=>({b,i})).filter(o=>!o.b.dead&&!used.has(o.i));}
function news(t){S.news.push(t);if(S.news.length>50)S.news.shift();}

/* ---------- 移動できる範囲 ---------- */
function passable(h,a){const o=S.own[a];if(o===h)return true;if(o&&allied(h,o))return true;return false;}
// ZOC（敵対している家の軍勢のとなりの地域）：そこに入った軍勢は、その先へ進めない
const hostile=(a,b)=>a!==b&&!friendly(a,b);
// ZOC（にらみの範囲）：敵の軍勢がいる地域だけ（ZOC_COST＝道のり。0なら、その地域だけ）。海はこえない
const ZOC_COST=0;
function zocAreas(a){const d={[a]:0},q=[a];while(q.length){q.sort((x,y)=>d[x]-d[y]);const x=q.shift();
  for(const y of nbr(x)){const e=EDGE[x][y];if(e.r==='海路')continue;const nd=d[x]+e.c;if(nd>ZOC_COST)continue;if(d[y]===undefined||nd<d[y]){d[y]=nd;q.push(y);}}}
  return new Set(Object.keys(d));}
function zocOf(h){const z=new Set();for(const x of S.armies){if(x.h===h||rel(h,x.h)!=='teki')continue;for(const b of zocAreas(x.a))z.add(b);}return z;}
// ZOCの中にいる敵どうしの軍勢を、すべて戦いに引きずりこむ（同じ地域・となりの同盟軍もいっしょに戦う）
function* zocEngageG(plans,battles,fought,moved){
  const Zc={};const zc=a=>Zc[a]||(Zc[a]=zocAreas(a));
  const pairs=[];
  for(const x of S.armies)for(const y of S.armies){
    if(x.id>=y.id||x.a===y.a||rel(x.h,y.h)!=='teki')continue;
    if(fought.has(x.id)||fought.has(y.id))continue;
    if(moved&&x.a===x.startA&&y.a===y.startA)continue; // 動いたあとは、動いた軍勢がかかわる組だけ
    if(!zc(x.a).has(y.a))continue;
    pairs.push([x,y,totU(x)+totU(y)]);}
  pairs.sort((p,q)=>q[2]-p[2]);
  for(const [x,y] of pairs){
    if(fought.has(x.id)||fought.has(y.id)||!S.armies.includes(x)||!S.armies.includes(y))continue;
    // 戦う場所：自分の領地にいる方（どちらもなら小さい方）の地域。もう一方が攻める
    const home=v=>S.own[v.a]&&allied(v.h,S.own[v.a]);
    let def=y,att=x;
    if(home(x)&&!home(y))def=x,att=y;else if(home(x)===home(y)&&totU(x)<totU(y))def=x,att=y;
    // 動いてZOCに入った方が攻める
    if(moved){if(att.a===att.startA&&def.a!==def.startA){const t=att;att=def;def=t;}}
    const side=(v,enemy)=>armiesAt(v.a).filter(w=>!fought.has(w.id)&&allied(w.h,v.h)&&rel(w.h,enemy.h)==='teki');
    const sA=side(att,def),sB=side(def,att);
    sA.concat(sB).forEach(w=>fought.add(w.id));
    const ae=att.a,de=def.a;
    yield* fieldBattleG(sA,sB,de,plans,battles,{zoc:true,from:ae});
  }
}
function reach(ar){
  const dist={[ar.a]:0},prev={},q=[ar.a];const out={};const zoc=zocOf(ar.h);
  while(q.length){
    q.sort((x,y)=>dist[x]-dist[y]);const x=q.shift();
    if(x!==ar.a&&!passable(ar.h,x))continue; // 敵や国人衆の地域で止まる
    if(x!==ar.a&&zoc.has(x))continue;        // 敵の軍勢のとなり（ZOC）で止まる
    for(const y of nbr(x)){const nd=dist[x]+EDGE[x][y].c;if(nd>MP)continue;if(dist[y]===undefined||nd<dist[y]){dist[y]=nd;prev[y]=x;q.push(y);}}
  }
  for(const y in dist){if(y===ar.a)continue;const p=[];let c=y;while(c!==ar.a){p.unshift(c);c=prev[c];}out[y]={cost:dist[y],path:p};}
  return out;
}

/* ---------- 戦い（3つの段階・サイコロ） ---------- */
function advVs(t,comp){const tot=sum(comp);if(!tot)return 1;let m=0;for(const e of TORDER){if(!comp[e])continue;const f=BEATS[t].includes(e)?ADV:BEATS[e].includes(t)?DIS:1;m+=comp[e]/tot*f;}return m;}
function phasePow(ph,t){let p=PHASES[ph].p[t];if(t==='teppo'&&ph===0&&yearNow()>=1574)p=2.4;return p;}
// その段階で損害を受けやすい兵科（射撃戦は前に立つ足軽、鑓合わせは長柄足軽、打撃は騎馬と足軽、乱戦は足軽）
const EXPO=[{ashi:1.5,kiba:0.9,yumi:0.7,teppo:0.7},{ashi:1.5,kiba:0.7,yumi:0.8,teppo:0.8},{ashi:1.2,kiba:1.4,yumi:0.9,teppo:0.9},{ashi:1.3,kiba:1.0,yumi:0.9,teppo:0.9}];
/* ---------- 大将と旗本（護衛） ---------- */
const lordIdx=h=>(S.busho[h]||[]).findIndex(b=>!b.dead);           // いまの当主（生きている武将のうち最初の人）
const GP=()=>typeof GUARD==='object'&&GUARD.pow?GUARD.pow:5;
function guardMax(ar){const b=ar.cmd!=null&&S.busho[ar.h]?S.busho[ar.h][ar.cmd]:null;if(!b||b.dead)return 0;const G=typeof GUARD==='object'?GUARD:{lord:2,gen:1};return ar.cmd===lordIdx(ar.h)?G.lord:G.gen;}
function guardOf(ar){const m=guardMax(ar);if(ar.g==null)ar.g=m;return Math.min(ar.g,m);}
function killCommander(ar,rec){const b=ar.cmd!=null?S.busho[ar.h][ar.cmd]:null;if(!b||b.dead)return;const wasLord=ar.cmd===lordIdx(ar.h);b.dead=true;ar.g=0;
  if(rec)rec.dead=(rec.dead||[]).concat(b.n);
  news(`${hn(ar.h)}の${b.n}が討ち死にした`);
  if(ar.h===S.me)S.log.push({y:yearNow(),t:`${b.n}が討ち死にする`});
  if(wasLord){const ni=lordIdx(ar.h);const nb=ni>=0?S.busho[ar.h][ni]:null;news(nb?`${hn(ar.h)}では${nb.n}が家をついだ`:`${hn(ar.h)}は当主を失った`);
    if(ar.h===S.me)S.events.push({h:S.me,t:`当主の${b.n}が討ち死にした。${nb?nb.n+'が家をつぐ。':'家をつぐ武将がいない。'}`});}}
// コンピューターの陣形えらび：兵が多ければ攻め、少なければ守り
function aiForm(my,en){const r=my/Math.max(0.1,en);const q=Math.random();return r>1.3?(q<.55?'bal':'atk'):r<0.8?(q<.7?'def':'bal'):['atk','bal','def'][rnd(3)];}
// 戦い：射撃戦→鑓合わせ→打撃→乱戦（→乱戦がつづく）。あなたの軍勢がかかわるときは、陣形をえらび、段階ごとに退却できる（yield で画面とやりとりする）
function* fightG(att,def,area,opt){
  // att/def：{cards:[{t,n,fac,ref,xp,gar}], cmd:{n,t}, castle, soubu, guards:[{ar,n,max,main,name,h}], me, hs}
  opt=opt||{};const siege=!opt.field;
  const comp=cs=>{const c=zero();for(const u of cs)c[u.t]+=u.n;return c;};
  const A0=comp(att.cards),D0=comp(def.cards);
  const ar=A[area];
  let mA=(1+(att.cmd.t-60)/100)*(att.soubu?1.1:1),mD=(1+(def.cmd.t-60)/100)*(def.soubu?1.1:1);
  const mods=[];
  if(!siege)mods.push('野戦：行軍中の軍勢どうしがぶつかった');
  if(opt.kozume&&opt.kozume.length)mods.push(`後詰め：${opt.kozume.join('・')}の軍勢が助けに入った`);
  if(opt.siege!=null)mods.push(`籠城中の城（あと${opt.siege}ターン）`);
  else if(ar.ter==='山'){mD*=1.2;mods.push('山地：守る側の力+2割、攻める側の騎馬の力-3割');}
  if(def.castle){mD*=1+0.15*def.castle;mods.push(`城：守る側の力+${def.castle*15}%`);
    mods.push('堀と土塁：攻める側の騎馬は馬を下りて戦う（力-4割）','横矢：城の弓・鉄砲は横から撃ちかける（力+25%）');}
  const MO=typeof MORALE==='object'?MORALE:{start:100,rout:20,lossK:140,teppoK:0.8,teppoMax:25,generalDead:15,front:10,castle:0.8};
  att.sonae=att.hs.some(h=>S.pol[h]&&S.pol[h].sonae);def.sonae=def.hs.some(h=>S.pol[h]&&S.pol[h].sonae);
  if(att.sonae)mods.push(`${siege?'攻める側':'ぶつかった側'}は備を立てている（打撃の力が上がり、士気がくずれにくい）`);
  if(def.sonae)mods.push(`${siege?'守る側':'迎え撃つ側'}は備を立てている（打撃の力が上がり、士気がくずれにくい）`);
  const gsum=G=>G.reduce((q,x)=>q+x.n,0);
  const pw=sd=>sum(comp(sd.cards))+gsum(sd.guards)*GP();
  // 陣形（コンピューターの分はここで決める）
  att.form=aiForm(pw(att),pw(def));
  def.form=siege?(def.guards.length?(pw(def)<pw(att)*0.7?'honmaru':(Math.random()<.5?'front':'honmaru')):'honmaru'):aiForm(pw(def),pw(att));
  const live=!!(att.me||def.me);const events=[];
  const side=sd=>({hs:sd.hs,cmd:sd.cmd,guards:sd.guards.map(x=>({name:x.name,n:x.n,max:x.max,main:x.main,h:x.h})),cards:sd.cards.map(c=>({t:c.t,n:c.n,gar:!!c.gar,xp:c.xp||0}))});
  const st={k:'start',name:opt.name,a:area,y:yearNow(),ter:ar.ter,field:!siege,siege,meA:!!att.me,meD:!!def.me,A:side(att),D:side(def),formA:att.form,formD:def.form,mods:mods.slice(),def:opt.owner||null,moA:MO.start,moD:MO.start,sonaeA:att.sonae,sonaeD:def.sonae};
  if(live){const ch=yield st;if(ch&&ch.form){if(att.me)att.form=ch.form;if(def.me&&(siege?SIEGE_CMD[ch.form]:FORMS[ch.form]))def.form=ch.form;}}
  const fA=FORMS[att.form],fD=siege?SIEGE_CMD[def.form]:FORMS[def.form];
  let moA=MO.start,moD=MO.start+(siege&&def.form==='front'?MO.front:0);
  st.formA=att.form;st.formD=def.form;st.moA=moA;st.moD=moD;st.sonaeA=att.sonae;st.sonaeD=def.sonae;events.push(st);
  let bA=1,bD=1;
  mods.push(`${siege?'攻める側':'ぶつかった側'}：${fA.n}`,`${siege?'守る側':'迎え撃つ側'}：${fD.n}`);
  if(!siege){if(fA.beats===def.form){bA+=FORM_BEAT;mods.push(`${fA.n}は${fD.n}に強い（+${FORM_BEAT*100}%）`);}if(fD.beats===att.form){bD+=FORM_BEAT;mods.push(`${fD.n}は${fA.n}に強い（+${FORM_BEAT*100}%）`);}}
  const wrap=(a_,b_)=>(!siege&&a_.form==='bal'&&pw(a_)>pw(b_)*1.3)?1+(FORMS.bal.wrap||0):1;
  const wA=wrap(att,def),wD=wrap(def,att);if(wA>1)mods.push('鶴翼の陣で敵をつつんだ（+15%）');if(wD>1)mods.push('鶴翼の陣で敵をつつんだ（+15%）');
  const log=[];const sA=sum(A0),sD=sum(D0);
  let ended=null,retreat=null,rout=null;const MAXR=typeof BATTLE_ROUNDS==='number'?BATTLE_ROUNDS:6;
  let pinA=0.5,pinD=0.5;   // 鑓合わせで、どれだけ敵の足を止めたか（0〜1）
  const hit=(cards,d,ph)=>{const s_=cards.reduce((q,u)=>q+u.n,0);if(!s_)return 0;let rem=Math.min(d,s_*0.98),l=0;
    const w=cards.map(u=>u.n*EXPO[ph][u.t]*(0.55+Math.random()*0.9));
    for(let pass=0;pass<5&&rem>1e-6;pass++){let W=0;cards.forEach((u,i)=>{if(u.n>0.01)W+=w[i];});if(W<=0)break;let used=0;
      cards.forEach((u,i)=>{if(u.n<=0.01)return;const x=Math.min(u.n,rem*w[i]/W);u.n-=x;used+=x;});rem-=used;l+=used;}
    return l;};
  // 旗本：くる損害のうち expo の分を旗本が受ける（総大将の旗本が多めに受ける）。旗本は pow 分の1しか減らない
  const hitG=(G,d,expo)=>{const live_=G.filter(x=>x.n>0);if(!live_.length)return {d,l:0};const share=d*expo;let l=0;const W=live_.reduce((q,x)=>q+(x.main?2:1),0);
    for(const x of live_){const part=share*(x.main?2:1)/W/GP()*(0.5+Math.random());const loss=Math.min(x.n,part);x.n-=loss;if(x.n<0.004)x.n=0;l+=loss;}return {d:d-share,l};};
  const r2=v=>Math.round(v*100)/100;
  for(let ri=0;ri<MAXR;ri++){const ph=Math.min(ri,3);
    const rA=d6(),rD=d6();
    const cA=comp(att.cards),cD=comp(def.cards);
    const nA0=sum(cA)+gsum(att.guards)*GP(),nD0=sum(cD)+gsum(def.guards)*GP();
    const dmg=(cards,enemy,m,roll,isAtt)=>{let d=0;for(const u of cards){let p=phasePow(ph,u.t);
      if(isAtt&&u.t==='kiba'&&ar.ter==='山')p*=0.7;
      if(isAtt&&u.t==='kiba'&&def.castle)p*=0.6;                         // 堀と土塁で馬が使えない
      if(!isAtt&&def.castle&&(u.t==='yumi'||u.t==='teppo'))p*=1.25;      // 横矢掛り
      d+=u.n*p*advVs(u.t,enemy)*u.fac;}return d*m*(0.7+0.1*roll)*0.1;};
    const gd=(G,roll)=>gsum(G)*GP()*[0.4,0.8,1.6,1.4][ph]*0.1*(0.7+0.1*roll);
    // 打撃：鑓合わせで敵の足を止めていれば、騎馬武者と旗本の突撃が深く入る（備を立てていればその差が大きい）
    const strike=(pin,son)=>ph===2?1+(pin-0.5)*(son?0.7:0.35)+(son?0.05:0):1;
    const sA_=strike(pinA,att.sonae),sD_=strike(pinD,def.sonae);
    const kibaPart=(cards,G,roll,isAtt)=>{if(ph!==2)return 0;let d=0;for(const u of cards)if(u.t==='kiba'){let p=phasePow(ph,u.t);if(isAtt&&ar.ter==='山')p*=0.7;if(isAtt&&def.castle)p*=0.6;d+=u.n*p*u.fac;}return d*0.1*(0.7+0.1*roll)+gd(G,roll);};
    let dA=(dmg(att.cards,cD,1,rA,true)+gd(att.guards,rA)+kibaPart(att.cards,att.guards,rA,true)*(sA_-1))*mA*fA.dealt*bA*wA*fD.taken;
    let dD=(dmg(def.cards,cA,1,rD,false)+gd(def.guards,rD)+kibaPart(def.cards,def.guards,rD,false)*(sD_-1))*mD*fD.dealt*bD*wD*fA.taken;
    const gD=hitG(def.guards,dA,fD.expo),gA=hitG(att.guards,dD,fA.expo);
    const lD=hit(def.cards,gD.d,ph),lA=hit(att.cards,gA.d,ph);
    const deadA=[],deadD=[];
    for(const x of att.guards)if(x.n<=0&&!x.dead){x.dead=true;deadA.push(x.name);}
    for(const x of def.guards)if(x.n<=0&&!x.dead){x.dead=true;deadD.push(x.name);}
    // 鑓合わせのあと：長柄足軽（足軽）の残りの多さで、敵の足をどれだけ止めたかが決まる
    if(ph===1){const aA=comp(att.cards).ashi,aD=comp(def.cards).ashi;const r_=(x,y)=>Math.max(0,Math.min(1,0.5+(x-y)/Math.max(2,x+y)*1.2));pinA=r_(aA,aD);pinD=r_(aD,aA);}
    // 士気：受けた損害（はじめの兵の数に対する割合）と、鉄砲の音と煙で下がる
    const tep=sd=>comp(sd.cards).teppo;
    const supA=ph===0?Math.min(MO.teppoMax,tep(def)*phasePow(0,'teppo')*MO.teppoK*(0.7+0.1*rD)*(def.castle?1.25:1)):0;   // 攻める側がうける
    const supD=ph===0?Math.min(MO.teppoMax,tep(att)*phasePow(0,'teppo')*MO.teppoK*(0.7+0.1*rA)):0;
    const mf=(sd,f)=>(sd.sonae?0.85:1)*(f&&f.morale?f.morale:1);
    const nA1=sum(comp(att.cards))+gsum(att.guards)*GP(),nD1=sum(comp(def.cards))+gsum(def.guards)*GP();
    const dmA=((nA0-nA1)/Math.max(0.5,sA)*MO.lossK+supA+deadA.length*MO.generalDead)*mf(att,fA);
    const dmD=((nD0-nD1)/Math.max(0.5,sD)*MO.lossK+supD+deadD.length*MO.generalDead)*mf(def,fD)*(def.castle?MO.castle:1);
    moA=Math.max(0,moA-dmA);moD=Math.max(0,moD-dmD);
    const L={ph:ri<4?PHASES[ph].n:'乱戦（つづき）',pi:ph,ri,rA,rD,lA:Math.round((lA+gA.l)*100),lD:Math.round((lD+gD.l)*100),nA:att.cards.map(u=>r2(u.n)),nD:def.cards.map(u=>r2(u.n)),gA:att.guards.map(x=>r2(x.n)),gD:def.guards.map(x=>r2(x.n)),deadA,deadD,
      moA:Math.round(moA),moD:Math.round(moD),supA:Math.round(supA),supD:Math.round(supD)};
    if(ph===1){L.pinA=r2(pinA);L.pinD=r2(pinD);}
    if(ph===2){L.strA=Math.round((sA_-1)*100);L.strD=Math.round((sD_-1)*100);}
    log.push(L);events.push({k:'round',log:L});
    const mdA=att.guards.some(x=>x.main&&x.dead),mdD=def.guards.some(x=>x.main&&x.dead);
    if(mdA||mdD){ended=mdD&&!mdA?'att':mdA&&!mdD?'def':(sum(comp(att.cards))/sA>sum(comp(def.cards))/sD?'att':'def');L.cmdFall=mdA&&mdD?'both':mdA?'A':'D';}
    const frA=sum(comp(att.cards))/Math.max(0.01,sA),frD=sum(comp(def.cards))/Math.max(0.01,sD);
    // 士気がくずれた側は敗走する
    if(!ended&&(moA<=MO.rout||moD<=MO.rout)){rout='morale';ended=moA<=MO.rout&&moD<=MO.rout?(moA>moD?'att':'def'):moA<=MO.rout?'def':'att';L.moraleRout=ended==='att'?'D':'A';}
    const routed=frA<0.35||frD<0.35;
    let ret=null;
    if(live){const c=yield {k:'round',log:L,frA,frD,last:!!(ended||routed||ri===MAXR-1)};if(c&&c.retreat&&!ended&&!routed&&ri<MAXR-1)ret=att.me?'att':'def';}
    if(!ret&&!ended&&!routed&&ri>=1&&ri<MAXR-1){for(const k of ['att','def']){const sd=k==='att'?att:def;if(sd.me)continue;const my=k==='att'?frA:frD,en=k==='att'?frD:frA;const mo=k==='att'?moA:moD;if((my<0.5&&en>0.7||mo<35)&&Math.random()<0.5){ret=k;break;}}}
    if(ret){// しんがり：いちばん経験のある部隊が残って敵を食い止める。そのあいだにほかの部隊は退く
      const sd=ret==='att'?att:def,en=ret==='att'?def:att;
      const cand=sd.cards.map((c,i)=>({c,i})).filter(o=>!o.c.gar&&o.c.n>=0.5).sort((p,q)=>(q.c.xp||0)-(p.c.xp||0)||q.c.n-p.c.n);
      const sh=cand[0];
      if(sh){const n0=sh.c.n;const blow=sum(comp(en.cards))*0.12*(0.7+Math.random()*0.6)+gsum(en.guards)*GP()*0.05;sh.c.n=Math.max(0,sh.c.n-Math.min(sh.c.n,blow));
        retreat={side:ret==='att'?'A':'D',idx:sh.i,t:sh.c.t,xp:sh.c.xp||0,n0:r2(n0),n1:r2(sh.c.n),cmd:sd.cmd.n,hs:sd.hs,nA:att.cards.map(u=>r2(u.n)),nD:def.cards.map(u=>r2(u.n))};}
      else retreat={side:ret==='att'?'A':'D',idx:-1,cmd:sd.cmd.n,hs:sd.hs,nA:att.cards.map(u=>r2(u.n)),nD:def.cards.map(u=>r2(u.n))};
      events.push({k:'retreat',...retreat});
      if(live)yield {k:'retreat',...retreat};
      break;}
    if(ended||routed)break;
  }
  const A1=comp(att.cards),D1=comp(def.cards);
  let win=ended||(retreat?(retreat.side==='A'?'def':'att'):(sum(A1)/Math.max(1,sA)>sum(D1)/Math.max(1,sD)?'att':'def'));
  if(!retreat){const lose=win==='att'?def.cards:att.cards;for(const u of lose)u.n*=0.85;}
  const res={win,log,mods,A0,D0,nA1:att.cards.map(u=>r2(u.n)),nD1:def.cards.map(u=>r2(u.n)),A1:comp(att.cards),D1:comp(def.cards),cmdA:att.cmd,cmdD:def.cmd,formA:att.form,formD:def.form,retreat,rout,moA:Math.round(moA),moD:Math.round(moD),gA:att.guards.map(x=>r2(x.n)),gD:def.guards.map(x=>r2(x.n)),events};
  events.push({k:'end',win,nA1:res.nA1,nD1:res.nD1,retreat:!!retreat,cmdFall:ended&&log.length?log[log.length-1].cmdFall||null:null,moraleRout:log.length?log[log.length-1].moraleRout||null:null});
  return res;
}
// 戦う側の情報：カードと旗本（総大将＝いちばん統率の高い大将）
function sideOf(arms,extraCards){
  const cards=arms.flatMap(x=>x.u.map(u=>({t:u.t,n:u.n,fac:overFac(x.h)*xpFac(u.xp),ref:u,xp:u.xp,arId:x.id}))).concat(extraCards||[]);
  const real=arms.filter(x=>guardMax(x)>0);
  const main=real.slice().sort((p,q)=>cmdOf(q).t-cmdOf(p).t)[0]||null;
  const guards=real.filter(x=>guardOf(x)>0).map(x=>({ar:x,n:guardOf(x),max:guardMax(x),main:x===main,name:cmdOf(x).n,h:x.h}));
  return {cards,guards,main,me:arms.some(x=>x.h===S.me),hs:[...new Set(arms.map(x=>x.h))]};
}
// 旗本の結果をもどす。全滅した旗本の大将は討ち死に
function guardsBack(sd,rec){for(const g of sd.guards){g.ar.g=Math.round(g.n*100)/100;if(g.dead||g.n<=0)killCommander(g.ar,rec);}}
function drive(g){let r=g.next();while(!r.done)r=g.next();return r.value;}
function fight(att,def,area,opt){return drive(fightG(att,def,area,opt));}
/* ---------- 1ターンの解決 ---------- */
function resolveTurn(orders){return drive(resolveTurnG(orders));}
function* resolveTurnG(orders){
  // orders: armyId -> path[]
  const plans={};
  for(const ar of S.armies){ar.startA=ar.a;const p=orders[ar.id];if(!p||!p.length)continue;let c=0,prevA=ar.a;const steps=[];for(const x of p){if(!EDGE[prevA][x])break;c+=EDGE[prevA][x].c;if(c>MP)break;steps.push({a:x,t:c});prevA=x;}plans[ar.id]={steps,i:0,stop:false};}
  const battles=[];const fought=new Set();S._busy=new Set();
  // 動く前：ZOCの中にいる敵どうしは、にげられずに戦う
  yield* zocEngageG(plans,battles,fought,false);
  for(let t=1;t<=MP;t++){
    // 同じ道を逆向きに進む敵どうしは、すれちがわずに道の上でぶつかる（野戦）
    const onRoad=[];
    for(const ar of S.armies){const pl=plans[ar.id];if(!pl||pl.stop||pl.i>=pl.steps.length)continue;const st=pl.steps[pl.i];const t0=pl.i?pl.steps[pl.i-1].t:0;if(t0<t&&t<=st.t)onRoad.push({ar,from:ar.a,to:st.a});}
    const done=new Set();
    for(const m of onRoad){if(done.has(m.ar.id)||!S.armies.includes(m.ar))continue;
      const opp=onRoad.filter(o=>!done.has(o.ar.id)&&S.armies.includes(o.ar)&&o.from===m.to&&o.to===m.from&&hostile(o.ar.h,m.ar.h));
      if(!opp.length)continue;
      const sideA=onRoad.filter(o=>o.from===m.from&&o.to===m.to&&allied(o.ar.h,m.ar.h)).map(o=>o.ar);
      const leadB=opp.sort((p,q)=>totU(q.ar)-totU(p.ar))[0].ar.h;
      const sideB=opp.filter(o=>allied(o.ar.h,leadB)).map(o=>o.ar);
      sideA.concat(sideB).forEach(x=>done.add(x.id));
      yield* fieldBattleG(sideA,sideB,m.to,plans,battles);
    }
    const arrived=new Set();
    for(const ar of S.armies){const pl=plans[ar.id];if(!pl||pl.stop)continue;
      while(pl.i<pl.steps.length&&pl.steps[pl.i].t<=t){
        const nx=pl.steps[pl.i].a;
        // 和睦命令
        const o=S.own[nx];if(o&&S.wabo[ar.h]===o){pl.stop=true;S.events.push({h:ar.h,t:`停戦命令のため、${hn(o)}の${A[nx].n}へは進めなかった`});break;}
        ar.prev=ar.a;ar.a=nx;pl.i++;arrived.add(nx);
        if(!passable(ar.h,nx)){pl.stop=true;break;}
      }
    }
    for(const a of arrived)yield* battleAtG(a,plans,battles);
  }
  // 動いたあと：敵のZOCに入った軍勢は、その敵と戦う
  yield* zocEngageG(plans,battles,fought,true);
  delete S._busy;
  return battles;
}
/* ---------- 後詰め：命令を出していない近くの軍勢が、攻められた城を助けに入る ---------- */
function kozume(a,owner,plans){const out=[];if(!owner||!H[owner])return out;
  for(const b of nbr(a)){if(EDGE[a][b].r==='海路')continue;
    for(const x of armiesAt(b)){if(!sameCamp(x.h,owner)||totU(x)<1)continue;
      const pl=plans[x.id];if(pl&&pl.steps.length)continue;              // 命令を出している軍勢は来ない
      if(S._busy&&S._busy.has(x.id))continue;                             // このターンもう戦った軍勢は来ない
      if(armiesAt(b).some(y=>hostile(y.h,x.h)))continue;
      if(isHonjo(b,x.h)&&nbr(b).some(c=>c!==a&&armiesAt(c).some(y=>rel(y.h,x.h)==='teki')))continue;  // 本拠も危ないときは動かない
      x.prev=x.a;x.a=a;plans[x.id]={steps:[],i:0,stop:true};out.push(x);
      news(`後詰め：${hn(x.h)}の${cmdOf(x).n}の軍勢が${A[a].n}の助けに入った`);
      if(x.h===S.me)S.log.push({y:yearNow(),t:`後詰め：${cmdOf(x).n}の軍勢が${A[b].n}から${A[a].n}の助けに入る`});}}
  return out;}
const holdTurns=(a,h)=>A[a].k!=='城'||!h||!H[h]?0:isHonjo(a,h)?(typeof SIEGE_TURNS==='object'?SIEGE_TURNS.honjo:3):isMain(a)?(typeof SIEGE_TURNS==='object'?SIEGE_TURNS.main:2):0;
function* battleAtG(a,plans,battles){
  let koz=[];
  for(let loop=0;loop<4;loop++){
    const owner=S.own[a]||null;
    const here=armiesAt(a);
    const defArm=here.filter(x=>owner&&allied(x.h,owner));
    const attArmAll=here.filter(x=>!owner||!friendly(x.h,owner));
    if(!attArmAll.length)return;
    // 攻める側：最も大きな軍勢の家と、その同盟家
    const byH={};for(const x of attArmAll)byH[x.h]=(byH[x.h]||0)+totU(x);
    const lead=Object.keys(byH).sort((p,q)=>byH[q]-byH[p])[0];
    const attArm=attArmAll.filter(x=>allied(x.h,lead));
    // 同じ地域に、たがいに敵どうしの軍勢が入ってきたら、まずその軍勢どうしで戦う（野戦）
    const rivals=attArmAll.filter(x=>hostile(x.h,lead)&&!allied(x.h,lead));
    if(rivals.length){const lb=rivals.sort((p,q)=>totU(q)-totU(p))[0].h;yield* fieldBattleG(attArm,rivals.filter(x=>allied(x.h,lb)),a,plans,battles);continue;}
    if(loop===0&&owner){koz=kozume(a,owner,plans);if(koz.length)defArm.push(...koz);}
    const g=S.gar[a];const gs=sum(g);
    if(!defArm.length&&gs<0.5){capture(a,lead,attArm,plans);if(S.siege)delete S.siege[a];return;}
    const garCards=gs>=0.5?TORDER.filter(t=>g[t]>0).map(t=>({t,n:g[t],fac:xpFac(20),gar:t,xp:20})):[];
    const bestCmd=arms=>arms.map(cmdOf).sort((p,q)=>q.t-p.t)[0]||{n:owner?'城代':'国人衆の頭',t:owner?50:45};
    const SA=sideOf(attArm),SD=sideOf(defArm,garCards);
    if(!defArm.length)SD.hs=owner?[owner]:[];
    const attCards=SA.cards,defCards=SD.cards.filter(c=>!c.gar);
    const snapA=attCards.map(c=>({t:c.t,n:c.n})),snapD=SD.cards.map(c=>({t:c.t,n:c.n,gar:!!c.gar}));
    const r=yield* fightG({...SA,cmd:bestCmd(attArm),soubu:S.pol[lead].soubuji},{...SD,cmd:bestCmd(defArm),castle:isHonjo(a,owner)?2:1,soubu:owner&&S.pol[owner].soubuji},a,{name:A[a].n+'の戦い',owner,kozume:koz.map(x=>cmdOf(x).n),siege:S.siege&&S.siege[a]?S.siege[a].left:null});
    // 結果をカードにもどす・経験値
    const back=(cards,won)=>{for(const c of cards){if(c.gar){g[c.gar]=Math.max(0,Math.round(c.n*10)/10);continue;}c.ref.n=Math.max(0,Math.round(c.n*10)/10);if(c.ref.n>=0.5)c.ref.xp=Math.min(100,c.ref.xp+(won?25:10));}};
    back(attCards,r.win==='att');back(defCards.concat(garCards),r.win==='def');
    const rec0={dead:null};guardsBack(SA,rec0);guardsBack(SD,rec0);
    for(const x of attArm.concat(defArm))x.u=x.u.filter(u=>u.n>=0.5);
    const rec={name:A[a].n+'の戦い',y:yearNow(),a,att:lead,attHs:[...new Set(attArm.map(x=>x.h))],def:owner,defHs:[...new Set(defArm.map(x=>x.h))],r,cA:snapA,cD:snapD,ter:A[a].ter,attN:Math.round(sum(r.A0)),defN:Math.round(sum(r.D0)),dead:rec0.dead||undefined,ev:r.events};
    battles.push(rec);
    {const wn=r.win==='att'?hn(lead):(owner?hn(owner):(NEUTRAL_NAME[a]||'国人衆'));const ls=r.win==='att'?(owner?hn(owner):(NEUTRAL_NAME[a]||'国人衆')):hn(lead);
     news(`${rec.name}（${A[a].pv}国）：${wn}が${ls}を破った`);
     if(rec.attHs.includes(S.me)||owner===S.me||rec.defHs.includes(S.me)){const won=(rec.attHs.includes(S.me)&&r.win==='att')||((owner===S.me||rec.defHs.includes(S.me))&&r.win==='def');S.log.push({y:yearNow(),t:`${rec.name}で${won?'勝つ':'敗れる'}（相手：${won?ls:wn}）`,battle:true});
       S.myBattles=(S.myBattles||[]).concat({name:rec.name,y:yearNow(),won,vs:won?ls:wn,pv:A[a].pv});}}
    if(koz.length)rec.kozume=koz.map(x=>cmdOf(x).n);
    if(S._busy)for(const x of attArm.concat(defArm))S._busy.add(x.id);
    // 籠城：本拠・国の拠点の城は、負けてもすぐには落ちない。城兵は本丸にこもり、兵糧が尽きるまで持ちこたえる
    const ht=r.win==='att'?holdTurns(a,owner):0;S.siege=S.siege||{};const sg=S.siege[a];
    if(r.win==='att'&&ht&&!(sg&&sg.left<=1)){
      for(const x of defArm)retreat(x,null,plans);
      for(const x of attArm)if(plans[x.id])plans[x.id].stop=true;
      const f=garFull(a);for(const t of TORDER)g[t]=Math.max(Math.round(g[t]*10)/10,Math.round(f[t]*0.3*10)/10);
      if(sg)sg.left-=1;else S.siege[a]={by:lead,left:ht,y:yearNow()};
      const L=S.siege[a].left;rec.siege=L;
      news(`${A[a].n}の城兵は本丸にこもって籠城した（${hn(lead)}が包囲。あと${L}ターンで兵糧が尽きる）`);
      if(owner===S.me){S.log.push({y:yearNow(),t:`${A[a].n}が${hn(lead)}に包囲され、籠城する（あと${L}ターン）`});S.events.push({h:S.me,t:`${A[a].n}は籠城している。あと${L}ターンのうちに軍勢を送って包囲をやぶらないと落城する。`});}
      if(rec.attHs.includes(S.me))S.events.push({h:S.me,t:`${A[a].n}の城兵は本丸にこもった。包囲をつづければ、あと${L}ターンで落城する（軍勢を${A[a].n}から動かさないこと）。`});
      if(SA.me||SD.me)yield {k:'end',rec};
      return;}
    if(SA.me||SD.me)yield {k:'end',rec};
    if(r.win==='att'){
      for(const x of defArm)retreat(x,null,plans);
      S.gar[a]=zero();
      capture(a,lead,attArm,plans);if(S.siege&&S.siege[a]){delete S.siege[a];news(`${A[a].n}が落城した`);}
      return;
    }else{
      for(const x of attArm)retreat(x,x.prev,plans);
      if(S.siege&&S.siege[a]&&!armiesAt(a).some(x=>rel(x.h,owner)!=='self'&&!friendly(x.h,owner))){delete S.siege[a];news(`${A[a].n}の包囲がやぶられた`);if(owner===S.me)S.log.push({y:yearNow(),t:`${A[a].n}の包囲をやぶる`});}
      // ほかに攻める家がいればもう一度
    }
  }
}
/* 野戦：行軍中の軍勢どうしの戦い。勝った方は目的地へ進み、負けた方はもとの領地へ退く */
function* fieldBattleG(sideA,sideB,a,plans,battles,opt={}){
  if(!sideA.length||!sideB.length)return;
  const bestCmd=arms=>arms.map(cmdOf).sort((p,q)=>q.t-p.t)[0];
  const ha=sideA[0].h,hb=sideB[0].h;
  const SA=sideOf(sideA),SB=sideOf(sideB);
  const aC=SA.cards,bC=SB.cards;const snapA=aC.map(c=>({t:c.t,n:c.n})),snapD=bC.map(c=>({t:c.t,n:c.n}));
  const r=yield* fightG({...SA,cmd:bestCmd(sideA),soubu:S.pol[ha].soubuji},{...SB,cmd:bestCmd(sideB),castle:0,soubu:S.pol[hb].soubuji},a,{field:true,name:A[a].n+'の戦い'});
  const back=(cards,won)=>{for(const c of cards){c.ref.n=Math.max(0,Math.round(c.n*10)/10);if(c.ref.n>=0.5)c.ref.xp=Math.min(100,c.ref.xp+(won?25:10));}};
  back(aC,r.win==='att');back(bC,r.win==='def');
  const rec0={dead:null};guardsBack(SA,rec0);guardsBack(SB,rec0);
  for(const x of sideA.concat(sideB))x.u=x.u.filter(u=>u.n>=0.5);
  const win=r.win==='att'?sideA:sideB,lose=r.win==='att'?sideB:sideA;
  const wh=win[0].h,lh=lose[0].h;
  const rec={name:A[a].n+'の戦い',y:yearNow(),a,att:ha,attHs:[...new Set(sideA.map(x=>x.h))],def:null,defHs:[...new Set(sideB.map(x=>x.h))],r,cA:snapA,cD:snapD,ter:A[a].ter,field:true,zoc:!!opt.zoc,attN:Math.round(sum(r.A0)),defN:Math.round(sum(r.D0)),dead:rec0.dead||undefined,ev:r.events};
  battles.push(rec);
  news(`${rec.name}（${A[a].pv}国・野戦）：${hn(wh)}が${hn(lh)}を破った`);
  if(sideA.concat(sideB).some(x=>x.h===S.me)){const won=win.some(x=>x.h===S.me);
    S.log.push({y:yearNow(),t:`${rec.name}（野戦）で${won?'勝ち、そのまま進む':'敗れ、退く'}（相手：${won?hn(lh):hn(wh)}）`,battle:true});
    S.myBattles=(S.myBattles||[]).concat({name:rec.name,y:yearNow(),won,vs:won?hn(lh):hn(wh),pv:A[a].pv});}
  // 負けた方：勝った方の行き先をさけて、ターンのはじめにいた領地（だめなら近くの自分の領地）へ退く
  const avoid=new Set(win.map(x=>{const pl=plans[x.id];return pl&&!pl.stop&&pl.steps[pl.i]?pl.steps[pl.i].a:x.a;}));
  for(const x of lose){if(plans[x.id])plans[x.id].stop=true;if(totU(x)<1){S.armies=S.armies.filter(y=>y!==x);continue;}
    const ok=b=>b&&!avoid.has(b)&&(S.own[b]===x.h||(S.own[b]&&allied(x.h,S.own[b])))&&!armiesAt(b).some(y=>hostile(y.h,x.h));
    // 動いていない軍勢は、勝った軍勢から遠ざかる方のとなりへ下がる
    const wa=win[0].a;const away=b=>(b===wa||nbr(wa).includes(b))?1:0;
    const cand=x.a===x.startA?[...shuffle(nbr(x.a).filter(b=>EDGE[x.a][b].r!=='海路')).sort((p,q)=>away(p)-away(q)),x.a]:[x.startA,...shuffle(nbr(x.a)),x.a];
    const dest=cand.find(ok);
    if(dest)x.a=dest;else if(opt.zoc){}else if(!(S.own[x.a]===x.h)){S.armies=S.armies.filter(y=>y!==x);S.events.push({h:x.h,t:`野戦に敗れ、退く場所がなく、軍勢がちりぢりになった`});}}
  for(const x of win)if(!x.u.length)S.armies=S.armies.filter(y=>y!==x);
  if(SA.me||SB.me)yield {k:'end',rec};
}
function capture(a,h,arms,plans){
  const from=S.own[a]||null;
  S.own[a]=h;S.gar[a]=zero();
  for(const x of arms){if(plans[x.id])plans[x.id].stop=true;}
  S.changes.push({a,from,to:h});
  // 国の拠点の城を落とすと、同じ国で同じ持ち主の地域もついてくる
  if(isMain(a)){
    for(const b of provAreas(a)){
      if(b===a||NEUTRAL_POW[b])continue;
      if((S.own[b]||null)!==from)continue;
      if(armiesAt(b).some(x=>from?allied(x.h,from):true))continue;
      S.own[b]=h;S.gar[b]=zero();S.changes.push({a:b,from,to:h,follow:a});
    }
  }
}
function retreat(x,pref,plans){
  if(plans[x.id])plans[x.id].stop=true;
  const ok=b=>b&&(S.own[b]===x.h||(S.own[b]&&allied(x.h,S.own[b])))&&!armiesAt(b).some(y=>!friendly(y.h,x.h));
  let dest=ok(pref)?pref:shuffle(nbr(x.a)).find(ok);
  if(totU(x)<1){S.armies=S.armies.filter(y=>y!==x);return;}
  if(dest){x.a=dest;}else{S.armies=S.armies.filter(y=>y!==x);S.events.push({h:x.h,t:`退く場所がなく、${A[x.a].n}の軍勢がちりぢりになった`});}
}

/* ---------- 兵を集める ---------- */
function unitCost(t){return TYPES[t].cost*2;}  // 1枚（1000人）
function recruit(h,ar,t){
  if(t==='teppo'&&!canTeppo(h))return false;
  if(S.gold[h]<unitCost(t))return false;
  if(S.own[ar.a]!==h)return false;
  if(ar.u.length>=ARMY_MAX)return false;
  S.gold[h]-=unitCost(t);ar.u.push(mkUnit(t,UNIT_MAX,0));
  return true;
}
function disband(ar,ids){ar.u=ar.u.filter(u=>!ids.includes(u.id));if(!ar.u.length)S.armies=S.armies.filter(x=>x!==ar);}
// 補充：自分の領内にいて、減っているカード
function needsRefill(ar){return S.own[ar.a]===ar.h&&ar.u.some(u=>u.n<UNIT_MAX-0.05);}
function refill(h){
  for(const ar of armiesOf(h)){
    if(!needsRefill(ar))continue;
    for(const u of ar.u){
      if(u.n>=UNIT_MAX)continue;
      const add=Math.min(UNIT_MAX-u.n,UNIT_MAX*0.4);
      const cost=Math.ceil(add/UNIT_MAX*unitCost(u.t)*0.6);
      if(S.gold[h]<cost)continue;
      S.gold[h]-=cost;
      u.xp=u.xp*u.n/(u.n+add);   // 新しい兵がまざり、経験が下がる
      u.n=Math.round((u.n+add)*10)/10;
    }
  }
}
function newArmy(h,a,bi){const ar={id:uid++,h,a,cmd:bi,u:[]};ar.g=guardMax(ar);S.armies.push(ar);return ar;}
function upkeep(h){if(!areasOf(h).length)return 0;   // 領地のない軍勢（浪人の軍勢・領地なしの家臣）は維持費がかからない
  return Math.ceil(troopsOf(h)/(typeof UPKEEP_DIV==='number'?UPKEEP_DIV:30));}
// 年貢：家臣は収入の一部を主君に納める（NENGU_RATE は data2.js）
const nenguRate=()=>typeof NENGU_RATE==='number'?NENGU_RATE:0.2;
function nenguOut(h){const g=income(h);return S.lord&&S.lord[h]&&alive(S.lord[h])&&g>0?Math.max(1,Math.round(g*nenguRate())):0;}
function nenguIn(h){let g=0;for(const v in (S.lord||{}))if(S.lord[v]===h&&alive(v))g+=nenguOut(v);return g;}
function income(h){
  const K=typeof INCOME_RATE==='number'?INCOME_RATE:1;
  let g=0;for(const a of areasOf(h)){g+=(koku(a)*0.3+KIND[A[a].k].g)*K;}
  const p=S.pol[h];if(p.rakuichi)g*=1.2;if(p.kirisuto)g+=3;
  return Math.round(g);
}

/* ---------- 政策 ---------- */
function policyOk(h,id){
  const P=POLICIES.find(p=>p.id===id);const p=S.pol[h];
  if(yearNow()<P.y)return {ok:false,why:`${P.y}年から使える`};
  if(p[id])return {ok:false,why:'実行ずみ'};
  if(S.gold[h]<P.cost)return {ok:false,why:'金が足りない'};
  const own=a=>S.own[a]===h;
  if(id==='joraku'&&!own('kyoto'))return {ok:false,why:'京都をおさえていない'};
  if(id==='kirisuto'&&!areasOf(h).some(a=>A[a].k==='港'))return {ok:false,why:'港を持っていない'};
  if(id==='katana'&&!p.kenchi)return {ok:false,why:'検地が必要'};
  if(id==='soubuji'){if(!own('kyoto'))return {ok:false,why:'京都をおさえていない'};const mine=kokuOf(h);if(Object.keys(H).some(o=>o!==h&&kokuOf(o)>=mine))return {ok:false,why:'最も多くの石高を持っていない'};}
  return {ok:true};
}
function applyPolicy(h,id){
  const P=POLICIES.find(p=>p.id===id);S.gold[h]-=P.cost;S.pol[h][id]=yearNow();
  if(id==='joraku')news(`${hn(h)}が足利義昭を連れて上洛した`);
  if(id==='soubuji')news(`${hn(h)}が関白となり、惣無事令を出した`);
  if(id==='kenchi')news(`${hn(h)}が検地を行った`);
  if(id==='sonae')news(`${hn(h)}が軍勢を兵種ごとの備に組みなおした`);
  if(h===S.me)S.log.push({y:yearNow(),t:`政策「${P.n}」を行う`});
}

/* ---------- コンピューターの大名 ---------- */
function powEst(n,fac=1){return (n.ashi*1.1+n.kiba*1.5+n.yumi*1.0+n.teppo*(yearNow()>=1574?1.9:1.5))*fac;}
function defEst(a,h){
  const o=S.own[a]||null;let p=powEst(S.gar[a]);
  for(const x of armiesAt(a))if(o?allied(x.h,o):true)if(x.h!==h)p+=powEst(nOf(x),overFac(x.h));
  for(const b of nbr(a))for(const x of armiesAt(b))if(o&&x.h===o)p+=powEst(nOf(x))*0.35;
  let m=1;if(A[a].ter==='山')m*=1.2;m*=1+0.15*(isHonjo(a,o)?2:1);
  return p*m;
}
function pickWar(h){
  const nb=neighborsOf(h).filter(o=>alive(o));
  if(!nb.length)return null;
  const cur=S.war[h];if(cur&&nb.includes(cur)&&!friendly(h,cur)&&Math.random()<.8)return cur;
  const sc=o=>(rel(h,o)==='teki'?3:0)-(friendly(h,o)?4-H[h].bet*8:0)-troopsOf(o)/Math.max(1,troopsOf(h))*2+H[h].goal.filter(a=>S.own[a]===o).length*2+Math.random()*2;
  return nb.sort((a,b)=>sc(b)-sc(a))[0];
}
function neighborsOf(h){const s=new Set();for(const a of areasOf(h))for(const b of nbr(a)){const o=S.own[b];if(o&&o!==h&&H[o])s.add(o);}return [...s];}
function aiTurn(h,orders){
  S.war[h]=pickWar(h);const W=S.war[h];
  // 兵を集める
  const cap=capOf(h);
  for(const ar of shuffle(armiesOf(h))){
    if(S.own[ar.a]!==h)continue;
    let guard=6;
    while(guard--&&S.gold[h]>8&&troopsOf(h)+UNIT_MAX<cap*1.05){
      const r=Math.random();const t=canTeppo(h)&&r<.25?'teppo':r<.25+H[h].kr?'kiba':r<.5+H[h].kr?'yumi':'ashi';
      if(!recruit(h,ar,t))break;
    }
  }
  // 新しい軍勢
  const fb=freeBusho(h);
  if(fb.length&&S.gold[h]>=8&&troopsOf(h)<cap*0.9&&areasOf(h).length>=2){
    const a=areasOf(h).filter(x=>!armiesAt(x).length).sort((x,y)=>frontier(h,y)-frontier(h,x))[0];
    if(a){const ar=newArmy(h,a,fb[0].i);recruit(h,ar,'ashi');recruit(h,ar,'ashi');recruit(h,ar,'yumi');if(!ar.u.length)S.armies=S.armies.filter(x=>x!==ar);}
  }
  // 政策
  for(const p of ['soubuji','joraku','katana','kenchi','sonae','rakuichi','kirisuto','bunkoku']){if(policyOk(h,p).ok&&S.gold[h]>POLICIES.find(x=>x.id===p).cost+4&&Math.random()<.6)applyPolicy(h,p);}
  // 軍勢を動かす
  const my=armiesOf(h);const targeted={};
  const cand=[];const used=new Set();
  // 包囲している軍勢は、そのまま包囲をつづける
  for(const ar of my){const sg=S.siege&&S.siege[ar.a];if(sg&&S.own[ar.a]&&rel(h,S.own[ar.a])!=='self'&&!friendly(h,S.own[ar.a]))used.add(ar.id);}
  // 自分の城が包囲されていたら、とどく軍勢を助けに送る
  for(const a in (S.siege||{})){if(!S.own[a]||!sameCamp(S.own[a],h))continue;const bp=armiesAt(a).filter(x=>!friendly(x.h,h)).reduce((q,x)=>q+powEst(nOf(x)),0);let sent=0;
    for(const ar of my.slice().sort((p,q)=>totU(q)-totU(p))){if(used.has(ar.id)||sent>bp*1.1)continue;const R=reach(ar);if(!R[a])continue;orders[ar.id]=R[a].path;used.add(ar.id);sent+=powEst(nOf(ar),overFac(h));}}
  for(const ar of my){if(used.has(ar.id))continue;
    const R=reach(ar);const myP=powEst(nOf(ar),overFac(h))*(1+(cmdOf(ar).t-60)/100);
    for(const d in R){
      const o=S.own[d]||null;if(o===h)continue;
      if(o&&sameCamp(h,o))continue;
      if(o&&S.lord&&S.lord[h]&&rel(h,o)==='none')continue;   // 家臣は主君の知らない戦を始めない
      if(o&&friendly(h,o)&&!(o===W&&Math.random()<H[h].bet))continue;
      if(o&&S.wabo[h]===o)continue;
      if(o&&allied(h,o))continue;
      const de=defEst(d,h)+1;
      let v=koku(d)+(isMain(d)?provAreas(d).filter(b=>(S.own[b]||null)===o&&!NEUTRAL_POW[b]).reduce((q,b)=>q+koku(b),0)*0.7:0)+KIND[A[d].k].g*2+(H[h].goal.includes(d)?12:0)+(o===W?6:0)+(o&&rel(h,o)==='teki'?3:0)+(!o?2:0);
      cand.push({ar,d,path:R[d].path,v,de,myP});
    }
  }
  cand.sort((p,q)=>q.v*Math.min(2,q.myP/q.de)-p.v*Math.min(2,p.myP/p.de));
  // used は上で作った（包囲・後詰めに使った軍勢）
  for(const c of cand){
    if(used.has(c.ar.id))continue;
    const add=(targeted[c.d]||0)+c.myP;
    if(add>c.de*1.25||(add>c.de*0.9&&Math.random()<.3)){
      // 本拠が手薄にならないように
      if(isHonjo(c.ar.a,h)&&threat(c.ar.a,h)>powEst(S.gar[c.ar.a])*1.3&&armiesAt(c.ar.a).filter(x=>x.h===h).length<2)continue;
      orders[c.ar.id]=c.path;used.add(c.ar.id);targeted[c.d]=add;
    }else if(add>c.de*0.5){targeted[c.d]=add;}
  }
  // 残りは危ない自分の地域へ
  for(const ar of my){if(used.has(ar.id))continue;const R=reach(ar);let best=null,bt=0;for(const d in R){if(S.own[d]!==h)continue;const t=threat(d,h)-defEst(d,'_');if(t>bt){bt=t;best=d;}}
    if(best&&threat(ar.a,h)<bt*0.5){orders[ar.id]=R[best].path;used.add(ar.id);}}
}
function frontier(h,a){return nbr(a).filter(b=>S.own[b]!==h).length;}
function threat(a,h){let p=0;for(const b of nbr(a))for(const x of armiesAt(b))if(!friendly(x.h,h))p+=powEst(nOf(x));return p;}
function aiHonor(orders){
  for(const r of S.req){
    if(!r.ok)continue;
    if(Math.random()<H[r.h].bet*0.6){r.broken=true;continue;}
    const ar=armiesOf(r.h).find(x=>!orders[x.id]&&reach(x)[r.target]);
    if(ar){orders[ar.id]=reach(ar)[r.target].path;r.done=true;}
  }
}
function aiDiplomacy(){
  const ids=Object.keys(H).filter(id=>alive(id)&&id!==S.me&&!(S.lord&&S.lord[id]));
  // 弱い家が、強い敵の軍門に下る／力をつけた家臣が独立する
  for(const a of shuffle(ids.slice())){if(S.lord&&S.lord[a])continue;
    const ka=campKoku(a);const strong=neighborsOf(a).map(topOf).filter((b,i,l)=>l.indexOf(b)===i&&b!==a&&alive(b)&&rel(a,b)==='teki'&&campKoku(b)>=ka*3&&ka<40);
    if(!strong.length||Math.random()>0.12)continue;const b=strong.sort((x,y)=>campKoku(y)-campKoku(x))[0];
    if(b===topOf(S.me)&&b===S.me){S.inbox=S.inbox||[];S.inboxNext=S.inboxNext||[];S.inboxNext.push({from:a,type:'kashin',t:`${hn(a)}より：これ以上は戦えぬ。貴家の軍門に下り、家臣に加えていただきたい。`});continue;}
    if(b===topOf(S.me))continue;
    makeVassal(a,b);news(`${hn(a)}が${hn(b)}の軍門に下り、家臣となった`);}
  for(const v in (S.lord||{})){if(v===S.me||!alive(v))continue;const L=S.lord[v];
    if(kokuOf(v)>kokuOf(L)*0.8&&Math.random()<0.15){releaseVassal(v,'teki');news(`${hn(v)}が${hn(L)}からはなれて独立し、両家は敵対した`);if(L===S.me){S.log.push({y:yearNow(),t:`家臣の${hn(v)}が独立し、敵となった`});S.events.push({h:S.me,t:`家臣の${hn(v)}がそむいて独立した。これより${hn(v)}は敵である。`});}}}
  for(let i=0;i<5;i++){
    const a=ids[rnd(ids.length)],nb=neighborsOf(a).map(topOf).filter((b,j,l)=>l.indexOf(b)===j&&b!==topOf(S.me)&&b!==a&&alive(b));if(!nb.length)continue;
    const b=nb[rnd(nb.length)];const r=rel(a,b);
    if(r==='none'&&Math.random()<.5){setRel(a,b,Math.random()<.5?'domei':'fusen');news(`${hn(a)}と${hn(b)}が${rel(a,b)==='domei'?'同盟':'不可侵の約束'}を結んだらしい`);}
    else if((r==='domei'||r==='fusen')&&Math.random()<.12){setRel(a,b,'teki');news(`${hn(a)}と${hn(b)}の約束が破れた`);}
  }
}
function aiLetters(){
  const nb=(S.lord&&S.lord[S.me])?[]:neighborsOf(S.me).filter(h=>alive(h)&&!(S.lord&&S.lord[h]));S.inbox=(S.inboxNext||[]).filter(m=>alive(m.from)&&!(S.lord&&S.lord[m.from]));S.inboxNext=[];
  for(const h of shuffle(nb).slice(0,2)){const r=rel(h,S.me);
    if(r==='none'&&Math.random()<.45)S.inbox.push({from:h,type:'fusen',t:`${hn(h)}より：たがいに兵を向けぬ約束をしたい。`});
    else if(r==='fusen'&&Math.random()<.3)S.inbox.push({from:h,type:'domei',t:`${hn(h)}より：われらと同盟を結ばぬか。`});
    else if(r==='teki'&&Math.random()<.2)S.inbox.push({from:h,type:'fusen',t:`${hn(h)}より：争いはもう十分だ。和睦しよう。`});}
}

/* ---------- ターンを終える ---------- */
function endTurn(){return drive(endTurnG());}
function* endTurnG(){
  S.events=[];S.changes=[];
  const orders={};
  for(const id in S.orders)orders[id]=S.orders[id];
  for(const h in H){if(h!==S.me&&alive(h))aiTurn(h,orders);}
  aiHonor(orders);
  // 約束やぶり
  for(const ar of S.armies){const p=orders[ar.id];if(!p||!p.length)continue;const d=p[p.length-1];const o=S.own[d];
    if(o&&H[o]&&o!==ar.h&&friendly(ar.h,o)){S.promises.push({y:yearNow(),a:ar.h,b:o,t:`${hn(ar.h)}が約束をやぶり、${hn(o)}の${A[d].n}を攻めた`});setRel(ar.h,o,'teki');news(`${hn(ar.h)}が約束をやぶって${hn(o)}を攻めた`);if(ar.h===S.me||o===S.me)S.log.push({y:yearNow(),t:`${hn(ar.h)}が約束をやぶり、${hn(o)}の${A[d].n}を攻める`});}}
  // 中立（とくに約束のない）家の領地に軍勢を進めたら、その家とは敵対になる
  for(const ar of S.armies){const p=orders[ar.id];if(!p||!p.length)continue;
    for(const d of p){const o=S.own[d];if(!o||!H[o]||o===ar.h||rel(ar.h,o)!=='none')continue;
      setRel(ar.h,o,'teki');news(`${hn(ar.h)}が${hn(o)}の${A[d].n}に攻めこみ、両家は敵対した`);
      if(o===S.me){S.log.push({y:yearNow(),t:`${hn(ar.h)}が${A[d].n}に攻めこんできた。${hn(ar.h)}は敵になった`});S.events.push({h:S.me,t:`${hn(ar.h)}が${A[d].n}に攻めこんできた。これより${hn(ar.h)}は敵（赤色）である。`});}
      if(ar.h===S.me){S.log.push({y:yearNow(),t:`${hn(o)}の${A[d].n}に攻めこみ、${hn(o)}と敵対する`});S.events.push({h:S.me,t:`${hn(o)}の${A[d].n}に攻めこんだため、${hn(o)}は敵（赤色）になった。`});}
      break;}}
  S.lastOrders=JSON.parse(JSON.stringify(orders));
  S.lastStart={};S.lastH={};S.armies.forEach(x=>{S.lastStart[x.id]=x.a;S.lastH[x.id]=x.h;});
  const battles=yield* resolveTurnG(orders);
  S.lastBattles=battles;
  // 籠城：包囲がつづいていれば兵糧がへる。尽きたら落城。包囲の軍勢がいなくなれば包囲はとける
  for(const a in (S.siege||{})){const sg=S.siege[a];const owner=S.own[a];
    const bes=armiesAt(a).filter(x=>owner&&x.h!==owner&&!friendly(x.h,owner));
    if(!owner||!bes.length){delete S.siege[a];if(owner){news(`${A[a].n}の包囲がとけた`);if(owner===S.me)S.log.push({y:yearNow(),t:`${A[a].n}の包囲がとけた`});}continue;}
    sg.left-=1;
    if(sg.left<=0){const by=bes.sort((p,q)=>totU(q)-totU(p))[0].h;const arms=bes.filter(x=>allied(x.h,by));delete S.siege[a];S.gar[a]=zero();capture(a,by,arms,{});
      news(`${A[a].n}は兵糧が尽きて落城した（${hn(by)}が手に入れた）`);if(owner===S.me)S.events.push({h:S.me,t:`${A[a].n}は兵糧が尽き、落城した。`});}
    else{if(owner===S.me)S.events.push({h:S.me,t:`${A[a].n}は籠城をつづけている。あと${sg.left}ターンで兵糧が尽きる。`});}}
  for(const c of S.changes){
    if(c.to===S.me)S.log.push({y:yearNow(),t:`${A[c.a].n}（${A[c.a].pv}）を手に入れる${c.follow?`（${A[c.follow].n}が落ちたため）`:c.from?`（${hn(c.from)}から）`:''}`});
    else if(c.from===S.me)S.log.push({y:yearNow(),t:`${A[c.a].n}（${A[c.a].pv}）を${hn(c.to)}に奪われる`});
    if(!c.follow)news(`${hn(c.to)}が${A[c.a].n}（${A[c.a].pv}）を${c.from?hn(c.from)+'から奪った':'手に入れた'}${isMain(c.a)?'。'+A[c.a].pv+'国の拠点の城である':''}`);
  }
  S.orders={};S.req=[];S.wabo={};
  // 年末：一揆・収入・維持費・城兵の回復
  S.ikki=[];
  for(const a of Object.keys(S.own)){
    const h=S.own[a];if(!h||!H[h])continue;if(armiesAt(a).some(x=>x.h===h))continue;if(isHonjo(a,h))continue;
    let p=(typeof IKKI_BASE==='number'?IKKI_BASE:0.015)+(IKKO.includes(a)?0.07:0)+(nbr(a).some(b=>A[b].k==='寺'&&!S.own[b])?0.04:0);
    if(S.pol[h].bunkoku)p*=0.4;if(S.pol[h].kirisuto&&IKKO.includes(a))p+=0.05;if(S.pol[h].katana)p=0;
    if(Math.random()<p){delete S.own[a];S.gar[a]=garFull(a);S.ikki.push({a,h});news(`${A[a].n}で一揆が起き、${hn(h)}の支配からはなれた`);if(h===S.me)S.log.push({y:yearNow(),t:`${A[a].n}で一揆が起き、地域を失う`});}
  }
  // 家臣の年貢（収入の計算は地域が決まってから）
  const NG={};for(const v in (S.lord||{})){if(!alive(v)||!alive(S.lord[v]))continue;const g=nenguOut(v);NG[v]=(NG[v]||0)-g;NG[S.lord[v]]=(NG[S.lord[v]]||0)+g;
    if(v===S.me)S.log.push({y:yearNow(),t:`主君の${hn(S.lord[v])}に年貢として金${g}を納める`});else if(S.lord[v]===S.me)S.log.push({y:yearNow(),t:`家臣の${hn(v)}から年貢として金${g}が届く`});}
  for(const h in H){if(!alive(h))continue;S.gold[h]+=income(h)-upkeep(h)+(NG[h]||0);if(S.gold[h]<0){for(const x of armiesOf(h))for(const u of x.u)u.n=Math.floor(u.n*0.85*10)/10;S.gold[h]=0;if(h===S.me)S.events.push({h,t:'金が足りず、兵の一部が逃げた'});}}
  for(const a of AREAS){if(S.siege&&S.siege[a.id])continue;const f=garFull(a.id);const g=S.gar[a.id];for(const t of TORDER)g[t]=Math.min(f[t],g[t]+Math.ceil(f[t]*0.5));}
  for(const x of S.armies){x.rec=0;x.g=guardMax(x);}   // 旗本は年ごとにそろいなおす
  for(const h in H)if(alive(h))refill(h);
  for(const x of S.armies)x.u=x.u.filter(u=>u.n>=0.5);
  S.armies=S.armies.filter(x=>totU(x)>=1);
  // 地域をなくした家の軍勢はちりぢりに
  // 地域をなくした家：コンピューターの家は滅ぶ。人が動かす家は、軍勢が残っていれば、最後の城を取った大名の家臣になる（領地なし・軍勢だけ）
  for(const h in H){if(!alive(h)||areasOf(h).length)continue;
    const human=S.players&&S.players[h];
    if(human&&armiesOf(h).some(x=>totU(x)>=1)){
      if(!S.landless)S.landless={};const was=S.landless[h];S.landless[h]=S.landless[h]||yearNow();
      const lastC=S.changes.filter(c=>c.from===h&&c.to&&H[c.to]&&!c.follow).pop()||S.changes.filter(c=>c.from===h&&c.to&&H[c.to]).pop();
      const by=lastC?topOf(lastC.to):null;
      if(!was&&by&&alive(by)&&!(S.lord&&S.lord[h])&&by!==h){makeVassal(h,by);
        news(`${hn(h)}はすべての領地を失い、${hn(by)}の家臣となった（軍勢だけが残る）`);
        S.log.push({y:yearNow(),t:`すべての領地を失い、${hn(by)}の家臣となる（軍勢は残る）`});
        if(h===S.me)S.events.push({h,t:`すべての領地を失った。${hn(by)}の家臣となり、軍勢だけで主君のために戦う。「独立する」の書状で下剋上すれば、領地のない軍勢だけで、ふたたび領地を取りにいける。`});}
      else if(!was){news(`${hn(h)}はすべての領地を失ったが、軍勢は残っている`);if(h===S.me)S.events.push({h,t:'すべての領地を失った。領地のない軍勢だけで、ふたたび城を取りにいこう（領地がないあいだは維持費がかからない）。'});}
      continue;}
    S.armies=S.armies.filter(x=>x.h!==h);S.dead[h]=yearNow();news(`${hn(h)}が滅んだ`);if(h===S.me)S.log.push({y:yearNow(),t:'すべての地域を失い、家が滅ぶ'});
    if(S.landless)delete S.landless[h];}
  // 領地を取りもどしたら、領地なしの印をはずす
  for(const h in (S.landless||{}))if(areasOf(h).length){delete S.landless[h];news(`${hn(h)}がふたたび領地を手に入れた`);}
  // 主君が滅んだ家臣は独立する。滅んだ家臣は主従から外す
  for(const v in (S.lord||{})){if(S.dead[v]){delete S.lord[v];continue;}const L=S.lord[v];if(S.dead[L]){delete S.lord[v];for(const k in S.rel)if(k.split('|').includes(v))delete S.rel[k];news(`主君の${hn(L)}が滅び、${hn(v)}は独立した`);if(v===S.me)S.events.push({h:S.me,t:`主君の${hn(L)}が滅んだ。わが家は独立した。`});}}
}
function nextTurn(){
  snapshot();
  const totK=AREAS.reduce((s,a)=>s+a.koku,0);
  for(const h in H){if(alive(h)&&!(S.lord&&S.lord[h])&&S.own.kyoto&&topOf(S.own.kyoto)===h&&campKoku(h)>=totK*(typeof UNIFY_SHARE==='number'?UNIFY_SHARE:0.5))S.unifier=h;}
  if(S.unifier||S.turn>=YEARS.length-1){S.ended=true;save();return false;}
  S.turn++;
  const y=yearNow();
  S.wabo=S.waboNext||{};S.waboNext={};
  if(y===1562&&alive('oda')&&alive('matsudaira')&&S.me!=='oda'&&S.me!=='matsudaira'){setRel('oda','matsudaira','domei');setRel('imagawa','matsudaira','teki');news('松平家が今川家からはなれ、織田家と同盟を結んだ（清洲同盟）');}
  if(y===1582)honnoji();
  aiDiplomacy();aiLetters();
  save();return true;
}
function honnoji(){
  let top=null,max=-1;for(const h in H){if(!alive(h))continue;const n=kokuOf(h);if(n>max){max=n;top=h;}}
  if(!top)return;const ars=armiesOf(top);if(!ars.length)return;
  const dist=a=>{const q=[[a,0]],seen=new Set([a]);while(q.length){const [x,d]=q.shift();if(x==='kyoto')return d;for(const n of nbr(x))if(!seen.has(n)){seen.add(n);q.push([n,d+1]);}}return 99;};
  const ar=ars.sort((p,q)=>dist(p.a)-dist(q.a))[0];
  S.armies=S.armies.filter(x=>x!==ar);
  if(S.own[ar.a]===top&&!isHonjo(ar.a,top)){delete S.own[ar.a];S.gar[ar.a]=garFull(ar.a);}
  news(`本能寺の変：${hn(top)}の家臣がそむき、${A[ar.a].n}の軍勢を失った`);
  if(top===S.me)S.log.push({y:1581,t:`家臣がそむき、${A[ar.a].n}の軍勢を失う（本能寺の変）`});
  S.honno={h:top,a:ar.a};
}

/* ---------- 書状 ---------- */
const LETTER_TYPES=[
 {id:'domei',n:'同盟を結ぼう',d:'たがいに攻めず、領地を通り合える'},
 {id:'fusen',n:'たがいに攻めない約束をしよう',d:'不可侵の約束'},
 {id:'support',n:'援軍をたのむ',d:'相手の軍勢が、あなたと同じ地域を攻める',target:true},
 {id:'gift',n:'贈り物をする（金5）',d:'相手との仲がよくなる'},
 {id:'break',n:'約束を取り消す',d:'同盟・不可侵をやめる'},
 {id:'wabo',n:'和睦を申し出る',d:'敵対している家と戦いをやめ、中立にもどる。相手が勝っているときは受けてもらいにくい。金を5そえると受けてもらいやすい'},
 {id:'threat',n:'従うように迫る',d:'相手が弱ければ、金を差し出させる'},
 {id:'kudaru',n:'軍門に下る（家臣になる）',d:'相手の家臣になり、主君の陣営の一員として戦う。外交は主君と同じになり、毎ターン年貢を納める'},
 {id:'kosan',n:'家臣になるよう勧める',d:'相手がずっと弱ければ、あなたの家臣になり、毎ターン年貢を納めてくる'},
 {id:'dokuritsu',n:'主君からはなれて独立する',d:'家臣をやめる。主君の家とは敵対になる'}
];
// いま送れる書状の種類（家臣のあいだは、外交は主君にまかせる）
function letterTypesFor(to){const me=S.me;const vas=S.lord&&S.lord[me];
  if(vas)return S.lord[me]===to?['support','gift','dokuritsu']:sameCamp(me,to)?['support','gift']:['gift'];
  if(sameCamp(me,to))return ['support','gift'];
  return LETTER_TYPES.map(t=>t.id).filter(k=>k!=='dokuritsu');}
function sendLetter(to,type,target,text){
  const me=S.me;const r=rel(me,to);const myN=troopsOf(me),thN=troopsOf(to);
  const enemyOfEnemy=neighborsOf(to).some(x=>x!==me&&rel(to,x)==='teki'&&rel(me,x)==='teki');
  let ok=false,reply='';
  const myK=campKoku(me),thK=campKoku(to);
  if(!letterTypesFor(to).includes(type)){reply=S.lord&&S.lord[me]?`（家臣なので、ほかの家との外交は主君の${hn(S.lord[me])}が行う）`:'（この書状は送れない）';}
  else if(S.lord&&S.lord[to]&&!sameCamp(me,to)){reply=`わが家は${hn(S.lord[to])}の家臣である。話は主君にしてほしい。`;}
  else if(type==='kudaru'){const p=thK<myK*0.8?0.08:r==='teki'?0.75:0.9;ok=Math.random()<p;
    if(ok){makeVassal(me,to);reply='よくぞ決心された。これより貴家はわが家の家臣である。ともに天下をめざそう。';S.log.push({y:yearNow(),t:`${hn(to)}の軍門に下り、家臣となる`});news(`${hn(me)}が${hn(to)}の軍門に下り、家臣となった`);}
    else reply='貴家ほどの家を家臣にするわけにはいかぬ。';}
  else if(type==='kosan'){const q=myK/Math.max(1,thK);const p=q>=3?0.7:q>=2?0.35:0.03;ok=Math.random()<p;
    if(ok){makeVassal(to,me);reply='……やむをえぬ。貴家の軍門に下ろう。';S.log.push({y:yearNow(),t:`${hn(to)}が軍門に下り、家臣となる`});news(`${hn(to)}が${hn(me)}の軍門に下り、家臣となった`);}
    else{reply=q<1.5?'われらを家臣にしようなど、思い上がりもはなはだしい。':'まだ、われらは戦える。';if(q<1.5&&r!=='teki')setRel(me,to,'teki');}}
  else if(type==='dokuritsu'){if(S.lord[me]!==to)reply='（あなたの主君ではない）';else{releaseVassal(me,'teki');ok=true;reply='恩知らずめ。次に会うのは戦場だ。';S.log.push({y:yearNow(),t:`${hn(to)}からはなれて独立する`});news(`${hn(me)}が${hn(to)}からはなれて独立した`);}}
  else if(type==='wabo'){if(r!=='teki')reply='（敵対していない）';else{
    const q=myK/Math.max(1,thK);
    let p=0.4+(q>=1.3?0.2:q<0.7?-0.2:0)+(myN>=thN?0.1:-0.1)+(enemyOfEnemy?0.15:0);
    const pay=S.gold[me]>=5;if(pay)p+=0.15;p=Math.max(0.05,Math.min(0.9,p));ok=Math.random()<p;
    if(ok){if(pay){S.gold[me]-=5;S.gold[to]+=5;}setRel(me,to,'none');reply=pay?'金5、たしかに受け取った。和睦しよう。これよりたがいに兵を引く。':'よかろう。和睦しよう。これよりたがいに兵を引く。';S.log.push({y:yearNow(),t:`${hn(to)}と和睦する${pay?'（金5をそえる）':''}`});news(`${hn(me)}と${hn(to)}が和睦した`);}
    else reply=q<0.8?'勝ちいくさの最中に、なぜ兵を引かねばならぬ。':'まだ決着はついておらぬ。和睦はできぬ。';}}
  else if(type==='domei'){const p=(r==='teki'?0.15:r==='fusen'?0.6:0.4)+(myN>=thN?0.15:0)+(enemyOfEnemy?0.2:0);ok=Math.random()<p;if(ok){setRel(me,to,'domei');reply='よかろう。これより両家は同盟である。';}else reply=r==='teki'?'これまでのいきさつがある。同盟など結べぬ。':'今はまだ、その時ではない。';}
  else if(type==='fusen'){const p=(r==='teki'?0.3:0.65)+(myN>thN?0.1:0);ok=Math.random()<p;if(ok){if(r!=='domei')setRel(me,to,'fusen');reply='承知した。たがいに兵を向けぬことを約束しよう。';}else reply='約束はできぬ。';}
  else if(type==='support'){const o=S.own[target];const can=armiesOf(to).some(x=>reach(x)[target]);const p=r==='kashin'?0.95:r==='domei'?0.75:r==='fusen'?0.4:0.12;
    if(!can)reply=`わが家の軍勢は、${A[target].n}まで届かぬ。`;
    else if(o===to||(o&&friendly(to,o)))reply=`${A[target].n}を攻めるのに力は貸せぬ。`;
    else{ok=Math.random()<p;reply=ok?`よかろう。わが家の軍勢も${A[target].n}へ向かおう。`:'今回は兵を出せぬ。';if(ok)S.req.push({h:to,target,ok:true});}}
  else if(type==='gift'){if(S.gold[me]<5)reply='（金が足りない）';else{S.gold[me]-=5;S.gold[to]+=5;ok=true;reply='ありがたく受け取ろう。';if(r==='teki'&&Math.random()<.5){setRel(me,to,'none');reply+='これまでのことは水に流そう。';}}}
  else if(type==='break'){if(r==='domei'||r==='fusen'){setRel(me,to,'teki');ok=true;reply='そうか。ならば次に会うのは戦場だ。';S.promises.push({y:yearNow(),a:me,b:to,t:`${hn(me)}が${hn(to)}との約束を取り消した`});}else reply='（約束はしていない）';}
  else if(type==='threat'){if(myN>=thN*2&&neighborsOf(me).includes(to)){const g=Math.min(S.gold[to],8);S.gold[to]-=g;S.gold[me]+=g;ok=true;reply=`……わかった。金${g}を差し出そう。`;if(Math.random()<.5)setRel(me,to,'teki');}else{reply='われらを見くびるな。';setRel(me,to,'teki');}}
  const L={y:yearNow(),from:me,to,type,text:text||LETTER_TYPES.find(x=>x.id===type).n+(target?`（${A[target].n}）`:''),reply,ok};
  S.letters.push(L);
  if(ok&&(type==='domei'||type==='fusen'))S.log.push({y:yearNow(),t:`${hn(to)}と${type==='domei'?'同盟':'不可侵の約束'}を結ぶ`});
  return L;
}

/* ---------- 得点 ---------- */
function goalDone(h){return H[h].goal.filter(a=>S.own[a]===h).length>=H[h].need;}
function score(h){const k=kokuOf(h);return Math.round(k+Math.max(0,k-S.start[h])+(goalDone(h)?30:0)+(alive(h)?20:0));}
const SAVE_KEY='kunitori2.save';
function save(){try{localStorage.setItem(SAVE_KEY,JSON.stringify({S,uid}));}catch(e){}}
function load(){try{return JSON.parse(localStorage.getItem(SAVE_KEY));}catch(e){return null;}}
