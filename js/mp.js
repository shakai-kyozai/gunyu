/* =========================================================
   群雄割拠　みんなで遊ぶ（通信）
   Cloud Firestore＋匿名ログイン。部屋を作った人の画面が「親」になり、ターンを計算して全員に配る。
   データ：rooms/{部屋番号}                … host, hostNick, hostPlays, hostHouse, turnSec, status（lobby/playing）
           rooms/{部屋番号}/houses/{家}     … uid, nick（同じ家を2人が選ばないための札）
           rooms/{部屋番号}/players/{uid}   … nick, house
           rooms/{部屋番号}/game/state      … turn, t0, dur, s（ゲームの状態。親の画面だけが書く）
           rooms/{部屋番号}/game/status     … turn, ready（命令を送った家）
           rooms/{部屋番号}/ready/{家}      … uid, turn, acts（募兵・政策などの操作）, orders（軍勢の行き先）
           rooms/{部屋番号}/letters/{id}    … 書状。コンピューターの家あて（ai）は親の画面が返事を書く
   ========================================================= */
const V='10.12.2', G=`https://www.gstatic.com/firebasejs/${V}/`;
const {initializeApp}=await import(G+'firebase-app.js');
const {initializeAuth,browserSessionPersistence,inMemoryPersistence,signInAnonymously}=await import(G+'firebase-auth.js');
const FS=await import(G+'firebase-firestore.js');
const {initializeFirestore,doc,getDoc,getDocs,setDoc,updateDoc,deleteDoc,collection,addDoc,onSnapshot,serverTimestamp,query,where}=FS;

const app=initializeApp(FIREBASE_CONFIG);
// タブごとに別の参加者になる（同じタブで読みこみ直しても同じ参加者のまま）
const auth=initializeAuth(app,{persistence:[browserSessionPersistence,inMemoryPersistence]});
const db=initializeFirestore(app,{experimentalAutoDetectLongPolling:true});

const M={uid:null,code:null,role:null,nick:'',house:null,room:null,players:{},houses:{},unsub:[],shown:{},
  // 遊ぶ人
  inGame:false,base:null,baseUid:1,turn:-1,acts:[],ready:false,t0:0,dur:0,pseq:0,status:null,
  // 親の画面
  auth:null,authUid:1,rd:{},resolving:false,timer:0,doing:new Set(),stWrite:0};
const q$=s=>document.querySelector(s);
const hname=k=>H[k]?H[k].n+'家':k;
const face=k=>FACE[k]?`<img src="img/face/${k}.jpg" alt="">`:`<b>${esc(H[k]?H[k].k||'':'')}</b>`;
const fmtCode=c=>String(c).replace(/^(\d{3})(\d+)$/,'$1 $2');
const R=(...p)=>doc(db,'rooms',M.code,...p);
const C=(...p)=>collection(db,'rooms',M.code,...p);
const clone=o=>JSON.parse(JSON.stringify(o));
const sub=(r,fn)=>M.unsub.push(onSnapshot(r,fn,e=>{console.warn(e);netBad('通信が切れた。ページを読みこみ直してください。');}));
function stopAll(){M.unsub.forEach(f=>{try{f();}catch(e){}});M.unsub=[];if(M.timer)clearInterval(M.timer);M.timer=0;}
function netBad(t){const s=q$('#mpst');if(s){s.textContent=t;s.classList.add('bad');}else toast(t,true,6000);}
function errMsg(e){const c=e&&e.code||'';
  if(/permission/.test(c))return '書きこみが許可されなかった（Firebaseのルールを確認）';
  if(/unavailable|network/.test(c))return 'Firebaseにつながらない（ネットワークを確認）';
  if(/admin-restricted|operation-not-allowed/.test(c))return '匿名ログインが有効になっていない（Firebaseの設定を確認）';
  return (e&&e.message)||String(e);}
async function login(){if(M.uid)return M.uid;const r=await signInAnonymously(auth);M.uid=r.user.uid;return M.uid;}
const lsGet=k=>{try{return localStorage.getItem(k);}catch(e){return null;}};
const lsSet=(k,v)=>{try{localStorage.setItem(k,v);}catch(e){}};
const ssGet=k=>{try{return sessionStorage.getItem(k);}catch(e){return null;}};
const ssSet=(k,v)=>{try{sessionStorage.setItem(k,v);}catch(e){}};

/* ---------- 入口：部屋を作る／部屋に入る ---------- */
const TIMES=[[90,'1分30秒'],[120,'2分'],[180,'3分'],[300,'5分'],[0,'なし（全員がそろうまで待つ）']];
function open(nick,house){M.nick=nick;M.house=house;
  const def=typeof TURN_SEC==='number'&&TURN_SEC?TURN_SEC:120;
  openDlg(`<h3>みんなで遊ぶ</h3>
    <p>だれかが「部屋」を作り、ほかの人は部屋番号を入れて参加する。部屋を作った人の画面がターンを計算するので、<b>部屋を作った人は画面を閉じない</b>。</p>
    <div class="mpent">
      <div class="mpcol"><b>部屋に入る</b>
        <input type="text" id="mpcode" inputmode="numeric" maxlength="${ROOM_DIGITS+1}" placeholder="部屋番号（${ROOM_DIGITS}けた）" autocomplete="off" value="${esc(lsGet('gunyu_room')||'')}">
        <div class="hint">${esc(hname(house))}・${esc(nick)} で参加する（遊んでいる途中なら、同じニックネームで入り直せる）</div>
        <button class="btn pri" type="button" id="mpjoin">参加する</button></div>
      <div class="mpcol"><b>部屋を作る</b>
        <label class="mpopt"><input type="radio" name="mpplay" value="1" checked> 自分も${esc(hname(house))}を動かす</label>
        <label class="mpopt"><input type="radio" name="mpplay" value="0"> 見守るだけ（先生）</label>
        <label class="mpopt">1ターンの時間 <select id="mpsec">${TIMES.map(([v,n])=>`<option value="${v}" ${v===def?'selected':''}>${n}</option>`).join('')}</select></label>
        <button class="btn" type="button" id="mpmake">部屋を作る</button></div>
    </div>
    <p class="mperr" id="mperr"></p>
    <div class="row"><button class="btn" type="button" onclick="closeDlg()">もどる</button></div>`,'mpbox',true);
  const c=q$('#mpcode');c.focus();c.onkeydown=e=>{if(e.key==='Enter')join();};
  q$('#mpjoin').onclick=join;q$('#mpmake').onclick=make;}
function err(t){const e=q$('#mperr');if(e)e.textContent=t;}
function busy(on){document.querySelectorAll('#mpjoin,#mpmake').forEach(b=>b.disabled=on);}

async function make(){busy(true);err('部屋を作っている…');
  const plays=(document.querySelector('input[name=mpplay]:checked')||{}).value==='1';const sec=+q$('#mpsec').value;
  try{await login();
    for(let i=0;i<8;i++){const lo=10**(ROOM_DIGITS-1);const code=String(lo+Math.floor(Math.random()*9*lo));
      try{await setDoc(doc(db,'rooms',code),{host:M.uid,hostNick:M.nick,hostPlays:plays,hostHouse:plays?M.house:null,turnSec:sec,status:'lobby',created:serverTimestamp()});M.code=code;break;}
      catch(e){if(!/permission/.test(e.code||''))throw e;}}  // 使われている番号ならやり直す
    if(!M.code)throw new Error('部屋番号を決められなかった');
    if(plays){await setDoc(R('houses',M.house),{uid:M.uid,nick:M.nick});await setDoc(R('players',M.uid),{nick:M.nick,house:M.house,joined:serverTimestamp()});}
    lsSet('gunyu_room',M.code);M.role='host';M.room=(await getDoc(R())).data();closeDlg();hostLobby();
  }catch(e){err(errMsg(e));M.code=null;busy(false);}}

async function join(){const code=(q$('#mpcode').value||'').replace(/\D/g,'');
  if(code.length!==ROOM_DIGITS){err(`部屋番号は${ROOM_DIGITS}けたの数字である`);return;}
  busy(true);err('部屋をさがしている…');
  try{await login();
    const r=await getDoc(doc(db,'rooms',code));
    if(!r.exists()){err('その番号の部屋はない。番号を確かめてください。');busy(false);return;}
    M.code=code;M.room=r.data();lsSet('gunyu_room',code);
    // 部屋を作った人が入り直した
    if(M.room.host===M.uid){M.role='host';closeDlg();if(M.room.status==='playing')await hostResume();else hostLobby();return;}
    if(M.room.status==='playing'){
      // 遊んでいる途中：自分の家（同じタブ、または同じニックネーム）で入り直す
      const hs={};(await getDocs(C('houses'))).forEach(d=>hs[d.id]=d.data());
      let h=Object.keys(hs).find(k=>hs[k].uid===M.uid)||Object.keys(hs).find(k=>hs[k].nick===M.nick);
      if(!h){err('この部屋のゲームはもう始まっている。参加していた人は、同じニックネームで入り直す。');M.code=null;busy(false);return;}
      if(hs[h].uid!==M.uid)await setDoc(R('houses',h),{uid:M.uid,nick:hs[h].nick});
      M.house=h;M.nick=hs[h].nick;await setDoc(R('players',M.uid),{nick:M.nick,house:h,joined:serverTimestamp()});
      M.role='player';closeDlg();enterGame();return;}
    // 家の札：だれも取っていなければ自分のものにする
    const hr=R('houses',M.house);const h=await getDoc(hr);
    if(h.exists()&&h.data().uid!==M.uid){err(`${hname(M.house)}は、すでに「${h.data().nick}」が選んでいる。タイトル画面で別の家を選んでください。`);M.code=null;busy(false);return;}
    if(!h.exists())await setDoc(hr,{uid:M.uid,nick:M.nick});
    await setDoc(R('players',M.uid),{nick:M.nick,house:M.house,joined:serverTimestamp()});
    M.role='player';closeDlg();playerLobby();
  }catch(e){err(errMsg(e));M.code=null;busy(false);}}

/* ---------- 待合室 ---------- */
function watchPlayers(draw){
  sub(C('players'),s=>{M.players={};s.forEach(d=>M.players[d.id]=d.data());draw();});}
function pcard(p,btn){
  return `<div class="mpp" style="--hc:${H[p.house]?H[p.house].col:'#888'}"><span class="mpf">${face(p.house)}<i>${kamonHTML(p.house)}</i></span>
    <div class="mpn"><b>${esc(hname(p.house))}</b><span class="who hu">${HU_SVG}${esc(p.nick)}</span></div>${btn||''}</div>`;}
function hostLobby(){
  q$('#app').innerHTML=`<div class="mpscr">
    <div class="mphead"><div><div class="mpl">部屋番号</div><div class="mpcode">${fmtCode(M.code)}</div>
      <div class="hint">ほかの人は「みんなで遊ぶ」→ 部屋番号を入れて参加する。1ターンの時間：${esc((TIMES.find(t=>t[0]===M.room.turnSec)||[0,'なし'])[1])}</div></div>
      <div class="mpst" id="mpst">つながっている</div></div>
    <h3>参加している家 <span id="mpcnt">0</span></h3><div class="mplist" id="mplist"></div>
    <p class="hint">参加していない家は、コンピューターが動かす。全員がそろったら「ゲームを始める」を押す。</p>
    <div class="row"><button class="btn" type="button" id="mpclose">部屋を閉じる</button>
      <button class="btn pri" type="button" id="mpstart" disabled>ゲームを始める</button></div></div>`;
  watchPlayers(()=>{const ks=Object.keys(M.players);q$('#mpcnt').textContent=ks.length;
    q$('#mplist').innerHTML=ks.length?ks.map(u=>pcard(M.players[u],u===M.uid?'<span class="hint">あなた</span>':`<button class="btn small" type="button" data-kick="${u}">外す</button>`)).join(''):'<p class="hint">まだだれも参加していない</p>';
    document.querySelectorAll('[data-kick]').forEach(b=>b.onclick=()=>kick(b.dataset.kick));
    q$('#mpstart').disabled=!ks.length;});
  q$('#mpclose').onclick=closeRoom;q$('#mpstart').onclick=startGame;}
async function closeRoom(){if(!confirm('部屋を閉じると、参加している人は全員ぬける。閉じますか？'))return;
  try{stopAll();await deleteDoc(R());}catch(e){toast(errMsg(e),true);}lsSet('gunyu_room','');location.reload();}
async function kick(u){const p=M.players[u];if(!p||!confirm(`${p.nick}（${hname(p.house)}）を部屋から外しますか？`))return;
  try{await deleteDoc(R('players',u));await deleteDoc(R('houses',p.house));}catch(e){toast(errMsg(e),true);}}
function playerLobby(){
  q$('#app').innerHTML=`<div class="mpscr">
    <div class="mphead"><div><div class="mpl">部屋番号 ${fmtCode(M.code)}</div>
      <div class="mpme">${pcard({nick:M.nick,house:M.house})}</div></div>
      <div class="mpst" id="mpst">つながっている</div></div>
    <p class="mpwait">部屋を作った人（${esc(M.room.hostNick||'')}）がゲームを始めるのを待っている。</p>
    <h3>同じ部屋の家</h3><div class="mplist" id="mplist"></div>
    <div class="row"><button class="btn" type="button" id="mpleave">部屋からぬける</button></div></div>`;
  watchPlayers(()=>{
    if(!M.players[M.uid]){stopAll();alertMsg('部屋から外された。');setTimeout(()=>location.reload(),2500);return;}
    const ks=Object.keys(M.players);q$('#mplist').innerHTML=ks.map(u=>pcard(M.players[u],u===M.uid?'<span class="hint">あなた</span>':'')).join('');});
  sub(R(),s=>{if(!s.exists()){stopAll();alertMsg('部屋が閉じられた。');setTimeout(()=>location.reload(),2500);return;}
    M.room=s.data();if(M.room.status==='playing'&&!M.inGame){stopAll();enterGame();}});
  q$('#mpleave').onclick=async()=>{if(!confirm('部屋からぬけますか？'))return;
    try{stopAll();await deleteDoc(R('players',M.uid));await deleteDoc(R('houses',M.house));}catch(e){}location.reload();};}

/* =========================================================
   親の画面（部屋を作った人）：ターンを計算して配る
   ========================================================= */
// 親の状態（M.auth）でエンジンを動かす。自分の画面の S はそのまま残す
function withAuth(fn){const kS=S,kU=uid;S=M.auth;uid=M.authUid;try{return fn();}finally{M.auth=S;M.authUid=uid;S=kS;uid=kU;}}
const liveHumans=()=>withAuth(()=>humans().filter(h=>alive(h)&&!S.ended));
async function writeState(){const a=M.auth;M.t0=Date.now();
  await setDoc(R('game','state'),{turn:a.turn,t0:M.t0,dur:a.turnSec||0,ended:!!a.ended,s:JSON.stringify({S:a,uid:M.authUid})});
  M.rd={};await writeStatus(true);}
async function writeStatus(force){const now=Date.now();if(!force&&now-M.stWrite<1500){clearTimeout(M._stT);M._stT=setTimeout(()=>writeStatus(true),1600);return;}
  M.stWrite=now;const turn=M.auth.turn;const ready=Object.keys(M.rd).filter(h=>M.rd[h].turn===turn);
  try{await setDoc(R('game','status'),{turn,ready,tot:liveHumans().length});}catch(e){console.warn(e);}}
async function startGame(){const ps={};for(const u in M.players)ps[M.players[u].house]=M.players[u].nick;
  if(!Object.keys(ps).length)return;q$('#mpstart').disabled=true;
  const kS=S,kU=uid;newGame(Object.keys(ps)[0]);S.players=ps;S.mode='multi';S.me=null;S.turnSec=M.room.turnSec||0;
  M.auth=S;M.authUid=uid;S=kS;uid=kU;
  try{await writeState();await updateDoc(R(),{status:'playing'});}catch(e){toast(errMsg(e),true);q$('#mpstart').disabled=false;return;}
  stopAll();hostDuties();if(M.room.hostPlays){M.house=M.room.hostHouse;enterGame();}else watchScreen();}
async function hostResume(){
  const d=await getDoc(R('game','state'));if(!d.exists()){hostLobby();return;}
  const o=JSON.parse(d.data().s);M.auth=o.S;M.authUid=o.uid;M.t0=d.data().t0;
  hostDuties();if(M.room.hostPlays){M.house=M.room.hostHouse;enterGame();}else watchScreen();}
function hostDuties(){
  sub(C('ready'),s=>{s.forEach(d=>M.rd[d.id]=d.data());writeStatus();checkAll();if(M.role==='host'&&!M.room.hostPlays)watchScreen();});
  sub(C('letters'),s=>s.docChanges().forEach(c=>{if(c.type!=='removed')hostLetter(c.doc.id,c.doc.data());}));
  sub(C('houses'),s=>{M.houses={};s.forEach(d=>M.houses[d.id]=d.data());});
  M.timer=setInterval(()=>{const a=M.auth;if(!a||a.ended||M.resolving)return;
    if(a.turnSec&&Date.now()>M.t0+a.turnSec*1000+8000)resolveTurn();
    if(!M.room.hostPlays)tickWatch();},1000);}
function checkAll(){const a=M.auth;if(!a||a.ended||M.resolving)return;const hs=liveHumans();
  if(hs.length&&hs.every(h=>M.rd[h]&&M.rd[h].turn===a.turn))resolveTurn();}
async function resolveTurn(){if(M.resolving||!M.auth||M.auth.ended)return;M.resolving=true;
  try{withAuth(()=>{
      for(const h of humans().slice().sort()){const r=M.rd[h];if(!r||r.turn!==S.turn||!alive(h))continue;
        try{for(const a of JSON.parse(r.acts||'[]'))try{doAct(h,a.k,a.args);}catch(e){console.warn('act',h,a,e);}
          const o=JSON.parse(r.orders||'{}');for(const id in o){const x=S.armies.find(y=>String(y.id)===String(id));if(x&&x.h===h)S.orders[x.id]=o[id];}}
        catch(e){console.warn('ready',h,e);}}
      drive(endTurnG());S.resY=yearNow();nextTurn();});
    await writeState();}
  catch(e){console.error(e);toast('ターンの計算でエラーが起きた：'+errMsg(e),true,8000);}
  M.resolving=false;if(!M.room.hostPlays)watchScreen();}
// 書状：コンピューターの家あては返事を書く。人どうしは、返事が決まったら結果を反映する
function patchOf(){return JSON.stringify({seq:Date.now(),rel:S.rel,gold:S.gold,lord:S.lord,req:S.req});}
async function hostLetter(id,L){if(L.applied||M.doing.has(id)||!M.auth)return;
  let up=null;
  if(L.ai&&L.status==='pending'){M.doing.add(id);up=withAuth(()=>{const r=sendLetter(L.toH,L.type,L.target||null,L.text||null,L.fromH);return {status:r.ok?'ok':'ng',reply:r.reply,applied:true,patch:patchOf()};});}
  else if(!L.ai&&L.status==='auto'){M.doing.add(id);up=withAuth(()=>{const ok=humanLetter(L.fromH,L.toH,L.type,L.target||null,true,L.text);return {status:ok?'ok':'ng',applied:true,patch:patchOf()};});}
  else if(!L.ai&&(L.status==='ok'||L.status==='ng')){M.doing.add(id);up=withAuth(()=>{humanLetter(L.fromH,L.toH,L.type,L.target||null,L.status==='ok',L.text);return {applied:true,patch:patchOf()};});}
  if(!up)return;try{await updateDoc(R('letters',id),up);}catch(e){console.warn(e);M.doing.delete(id);}}

/* ---------- 見守る画面（先生） ---------- */
function watchScreen(){const a=M.auth;if(!a)return;const hs=Object.keys(a.players||{});
  const v=withAuth(()=>({y:yearNow(),turn:S.turn,ended:S.ended,rows:hs.map(h=>({h,nick:S.players[h],k:Math.round(kokuOf(h)),n:areasOf(h).length,t:troopsOf(h),dead:!alive(h)})),
    rank:Object.keys(H).filter(alive).sort((p,q)=>kokuOf(q)-kokuOf(p)).slice(0,10).map(h=>({h,k:Math.round(kokuOf(h))})),news:S.news.slice(-10).reverse()}));
  const rdy=h=>M.rd[h]&&M.rd[h].turn===v.turn;
  q$('#app').innerHTML=`<div class="mpscr">
    <div class="mphead"><div><div class="mpl">部屋番号 ${fmtCode(M.code)}　｜　見守る画面</div>
      <div class="mpyr">${v.ended?'ゲーム終了':`${wareki(v.y)}（${v.y}年）　ターン ${v.turn+1}／${YEARS.length}`}</div>
      <div class="mptm" id="mptm"></div></div><div class="mpst" id="mpst">つながっている</div></div>
    <h3>人が動かす家　命令を送った家 ${hs.filter(rdy).length}／${hs.filter(h=>!v.rows.find(r=>r.h===h).dead).length}</h3>
    <table class="mpt"><tr><th>家</th><th>動かす人</th><th>石高</th><th>地域</th><th>兵</th><th>このターン</th></tr>
      ${v.rows.sort((p,q)=>q.k-p.k).map(r=>`<tr><td><span class="mpk" style="background:${H[r.h].col}">${kamonHTML(r.h)}</span>${esc(hname(r.h))}</td><td>${esc(r.nick)}</td><td>${r.k}万石</td><td>${r.n}</td><td>${(r.t*100).toLocaleString()}人</td>
        <td>${r.dead?'<span class="dn">滅亡</span>':rdy(r.h)?'<b class="up">命令を送った</b>':'<span class="hint">考え中…</span>'}</td></tr>`).join('')}</table>
    <div class="mpcols"><div><h3>石高の順位（全国）</h3><ol class="mprk">${v.rank.map(r=>`<li><span class="mpk" style="background:${H[r.h].col}">${kamonHTML(r.h)}</span>${esc(hname(r.h))}　${r.k}万石${a.players[r.h]?`<span class="who hu sm">${HU_SVG}${esc(a.players[r.h])}</span>`:''}</li>`).join('')}</ol></div>
      <div><h3>全国のうごき</h3><ul class="mpnews">${v.news.map(t=>`<li>${esc(t)}</li>`).join('')}</ul></div></div>
    <div class="row"><button class="btn" type="button" id="mpclose">部屋を閉じる</button>${v.ended?'':'<button class="btn pri" type="button" id="mpnow">今すぐ次のターンへ進める</button>'}</div></div>`;
  const tr=q$('#tickrun');if(tr)tr.innerHTML=`<span>石高：${v.rank.slice(0,5).map((r,i)=>`${i+1}位 ${esc(H[r.h].n)}（${r.k}万石）`).join('　')}</span>`+v.news.map(t=>`<span>${esc(t)}</span>`).join('');
  q$('#mpclose').onclick=closeRoom;const nb=q$('#mpnow');if(nb)nb.onclick=()=>{if(confirm('命令を送っていない家は、その場にとどまる。進めますか？'))resolveTurn();};
  tickWatch();}
function tickWatch(){const e=q$('#mptm');if(!e||!M.auth)return;const d=M.auth.turnSec;if(M.resolving){e.textContent='ターンを計算している…';return;}
  if(!d){e.textContent='時間の制限なし（全員がそろうと進む）';return;}const left=Math.max(0,Math.round(d-(Date.now()-M.t0)/1000));
  e.textContent=`のこり ${Math.floor(left/60)}:${String(left%60).padStart(2,'0')}`;}

/* =========================================================
   遊ぶ人の画面
   ========================================================= */
function enterGame(){M.inGame=true;
  sub(R('game','state'),s=>{if(s.exists())onState(s.data());});
  sub(R('game','status'),s=>{if(!s.exists())return;M.status=s.data();if(S&&S.mode==='multi'&&q$('#map'))endBtnUI();});
  sub(C('houses'),s=>{M.houses={};s.forEach(d=>M.houses[d.id]=d.data());});
  sub(R(),s=>{if(!s.exists()){stopAll();alertMsg('部屋が閉じられた。');setTimeout(()=>location.reload(),3000);}});
  // 自分あての書状 → 返事をする。結果が決まったら反映する
  sub(query(C('letters'),where('to','==',M.uid)),s=>s.docChanges().forEach(c=>{const L=c.doc.data();const id=c.doc.id;
    if(L.patch)applyPatch(L.patch);
    if(L.ai)return;
    if(L.status==='pending'&&!M.shown['in'+id]){M.shown['in'+id]=1;incoming(id,L);}
    if(L.status!=='pending'&&L.applied&&HU_NOASK.includes(L.type)&&!M.shown['au'+id]){M.shown['au'+id]=1;
      alertMsg(L.type==='break'?`${hname(L.fromH)}（${L.fromNick}）が、わが家との約束を取り消した。これより敵対である。`:`${hname(L.fromH)}（${L.fromNick}）が、わが家からはなれて独立した。これより敵対である。`);}}));
  // 自分が送った書状 → 返事が来たら大きく出す
  sub(query(C('letters'),where('from','==',M.uid)),s=>s.docChanges().forEach(c=>{const L=c.doc.data();const id=c.doc.id;
    if(L.patch)applyPatch(L.patch);
    if(L.status!=='pending'&&L.status!=='auto'&&(L.ai?L.applied:true)&&!M.shown['re'+id]){M.shown['re'+id]=1;
      if(L.ai)replyDlg(L.toH,L.type,{ok:L.status==='ok',reply:L.reply||''});
      else if(HU_NOASK.includes(L.type)){if(L.applied)toast(`${hname(L.toH)}へ「${(LETTER_TYPES.find(x=>x.id===L.type)||{}).n}」を送った`);else M.shown['re'+id]=0;}
      else replyDlg(L.toH,L.type,{ok:L.status==='ok',reply:L.status==='ok'?'承知した。':'お断りする。'});}}));}
// 状態が届いた：新しいターンなら結果を見せる
function onState(d){
  const o=JSON.parse(d.s);const first=!S||S.mode!=='multi'||!q$('#map');const newTurn=d.turn!==M.turn||d.ended&&!(S&&S.ended);
  M.base=o.S;M.baseUid=o.uid;M.t0=d.t0;M.dur=d.dur;M.pseq=Math.max(M.pseq,d.t0);
  if(newTurn){M.turn=d.turn;M.acts=[];M.ready=false;M.status=null;
    // 同じターンの途中で読みこみ直したときは、操作をもどす
    const sv=ssGet('gunyu_acts');if(sv){try{const v=JSON.parse(sv);if(v.code===M.code&&v.turn===d.turn){M.acts=v.acts||[];M.saveOrders=v.orders||{};M.ready=!!v.ready;}}catch(e){}}}
  rebuild(newTurn?(M.saveOrders||{}):null);M.saveOrders=null;
  if(first){startUI();if(S.ended){showEnd();return;}showEvent();return;}
  if(!newTurn){refresh();return;}
  stopTurnTimer();closeDlg();
  UI.sel=null;UI.mode=null;UI.reach=null;UI.replay=true;refresh();
  animateMoves(()=>playMine(myBattlesOf(S.lastBattles),()=>{if(S.ended)showEnd();else showResultDlg();}));}
function playMine(list,done){let i=0;const next=()=>{const b=list[i++];if(!b){done();return;}playBattle(b,next);};next();}
// 親の状態＋自分の操作のやりなおし ＝ 自分の画面
function rebuild(orders){const keep=orders||(S&&S.mode==='multi'?S.orders:{})||{};
  S=clone(M.base);uid=M.baseUid;S.me=M.house;
  for(const a of M.acts)try{doAct(S.me,a.k,a.args);}catch(e){console.warn(e);}
  S.orders={};for(const id in keep){const x=S.armies.find(y=>String(y.id)===String(id));if(x&&x.h===S.me)S.orders[x.id]=keep[id];}}
function applyPatch(p){let o;try{o=JSON.parse(p);}catch(e){return;}if(!M.base||o.seq<=M.pseq)return;M.pseq=o.seq;
  Object.assign(M.base,{rel:o.rel,gold:o.gold,lord:o.lord,req:o.req});rebuild();if(q$('#map'))refresh();}
function saveLocal(){ssSet('gunyu_acts',JSON.stringify({code:M.code,turn:M.turn,acts:M.acts,orders:S&&S.orders||{},ready:M.ready}));}
function record(k,args){M.acts.push({k,args:clone(args)});saveLocal();}
async function ready(auto){if(M.ready||!S||S.ended||S.dead[S.me])return;M.ready=true;stopTurnTimer();
  const orders={};for(const id in S.orders){const x=S.armies.find(y=>String(y.id)===String(id));if(x&&x.h===S.me)orders[id]=S.orders[id];}
  try{await setDoc(R('ready',S.me),{uid:M.uid,turn:M.turn,acts:JSON.stringify(M.acts),orders:JSON.stringify(orders),at:serverTimestamp()});
    saveLocal();toast(auto?'時間切れ。ここまでの命令を送った':'命令を送った。ほかの家がそろうと、ターンが進む');}
  catch(e){M.ready=false;toast(errMsg(e),true);}
  if(q$('#map'))refresh();}
async function unready(){if(!M.ready)return;
  try{await setDoc(R('ready',S.me),{uid:M.uid,turn:-1,acts:'[]',orders:'{}',at:serverTimestamp()});M.ready=false;saveLocal();startTurnTimer();toast('命令をなおせる。なおしたら、もう一度「次のターンへ」を押す');}
  catch(e){toast(errMsg(e),true);}
  refresh();}
function waitTxt(){const st=M.status;if(!st||st.turn!==M.turn)return '';return `（${st.ready.length}／${st.tot}）`;}
function leftSec(){return M.dur?Math.max(3,M.dur-(Date.now()-M.t0)/1000):0;}
function afterResult(){UI.replay=false;UI.area=null;if(S.ended){showEnd();return;}showEvent();}

/* ---------- 書状 ---------- */
async function letter(to,type,target,text){
  const tn=(LETTER_TYPES.find(x=>x.id===type)||{}).n||type;
  try{if(isHu(to)){const why=humanLetterWhy(S.me,to,type);if(why){alertMsg(`${hname(to)}へは送れない：${why}`);return;}
      const toUid=M.houses[to]&&M.houses[to].uid;if(!toUid){alertMsg(`${hname(to)}を動かす人が見つからない。`);return;}
      await addDoc(C('letters'),{from:M.uid,to:toUid,fromH:S.me,toH:to,fromNick:S.players[S.me]||M.nick,toNick:S.players[to]||'',type,target:target||null,text:text||null,ai:false,
        status:HU_NOASK.includes(type)?'auto':'pending',turn:M.turn,created:serverTimestamp()});
      toast(HU_NOASK.includes(type)?`${hname(to)}へ「${tn}」を送った`:`${hname(to)}（${S.players[to]}）へ書状を送った。返事を待っている…`,false,3500);}
    else{await addDoc(C('letters'),{from:M.uid,to:M.room.host,fromH:S.me,toH:to,fromNick:S.players[S.me]||M.nick,toNick:'',type,target:target||null,text:text||null,ai:true,status:'pending',turn:M.turn,created:serverTimestamp()});
      toast(`${hname(to)}へ書状を送った。返事を待っている…`,false,3000);}}
  catch(e){toast(errMsg(e),true);}}
function incoming(id,L){const tn=(LETTER_TYPES.find(x=>x.id===L.type)||{}).n||L.type;const tg=L.target&&A[L.target]?`（${A[L.target].n}）`:'';
  const det=(LETTER_TYPES.find(x=>x.id===L.type)||{}).d||'';
  openDlg(`<div class="rpw in"><div class="rpt">${esc(hname(L.fromH))}から書状が届いた<span class="who hu lg">${HU_SVG}${esc(L.fromNick)}</span></div>
    <div class="rpm"><span class="rpf" style="--hc:${H[L.fromH]?H[L.fromH].col:'#888'}">${face(L.fromH)}<i>${kamonHTML(L.fromH)}</i></span>
      <div class="rpq"><div class="rpq0">書状の中身</div><div class="rpq1">「${esc(tn+tg)}」</div>${L.text&&L.text!==tn?`<div class="rpq2">${esc(L.text)}</div>`:''}<div class="rpq0">${esc(det)}</div></div></div>
    <div class="row"><button class="btn" type="button" id="mpng">断る</button><button class="btn pri" type="button" id="mpok">承諾する</button></div></div>`,'rpbox',false);
  const ans=async st=>{document.querySelectorAll('#mpok,#mpng').forEach(b=>b.disabled=true);
    try{await updateDoc(R('letters',id),{status:st,answered:serverTimestamp()});closeDlg();toast(st==='ok'?'承諾の返事を送った':'断りの返事を送った');}
    catch(e){closeDlg();toast(errMsg(e),true);}};
  q$('#mpok').onclick=()=>ans('ok');q$('#mpng').onclick=()=>ans('ng');}

window.NET={open,save:saveLocal,record,ready,unready,isReady:()=>M.ready,waitTxt,leftSec,afterResult,letter};
