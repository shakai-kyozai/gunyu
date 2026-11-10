/* =========================================================
   群雄割拠　みんなで遊ぶ（通信）
   Cloud Firestore＋匿名ログイン。いまは「部屋づくり・参加・書状の通信テスト」まで。
   データ：rooms/{部屋番号}　… host（先生のuid）, status, created
           rooms/{部屋番号}/houses/{家}   … uid, nick（同じ家を2人が選ばないための札）
           rooms/{部屋番号}/players/{uid} … nick, house, joined
           rooms/{部屋番号}/letters/{id}  … from, to, fromH, toH, fromNick, toNick, type, status（pending/ok/ng）
   ========================================================= */
const V='10.12.2', G=`https://www.gstatic.com/firebasejs/${V}/`;
const {initializeApp}=await import(G+'firebase-app.js');
const {initializeAuth,browserSessionPersistence,inMemoryPersistence,signInAnonymously}=await import(G+'firebase-auth.js');
const FS=await import(G+'firebase-firestore.js');
const {initializeFirestore,doc,getDoc,setDoc,updateDoc,deleteDoc,collection,addDoc,onSnapshot,serverTimestamp,query,where,orderBy,limit}=FS;

const app=initializeApp(FIREBASE_CONFIG);
// タブごとに別の参加者になる（同じタブで読みこみ直しても同じ参加者のまま）
const auth=initializeAuth(app,{persistence:[browserSessionPersistence,inMemoryPersistence]});
const db=initializeFirestore(app,{experimentalAutoDetectLongPolling:true});

const M={uid:null,code:null,role:null,nick:'',house:null,players:{},unsub:[],shown:{}};
const q$=s=>document.querySelector(s);
const hname=k=>H[k]?H[k].n+'家':k;
const face=k=>FACE[k]?`<img src="img/face/${k}.jpg" alt="">`:`<b>${esc(H[k]?H[k].k||'':'')}</b>`;
const fmtCode=c=>String(c).replace(/^(\d{3})(\d+)$/,'$1 $2');
const roomRef=()=>doc(db,'rooms',M.code);
const sub=(r,fn)=>M.unsub.push(onSnapshot(r,fn,e=>{console.warn(e);status('通信が切れた。ページを読みこみ直してください。',true);}));
function status(t,bad){const s=q$('#mpst');if(s){s.textContent=t;s.classList.toggle('bad',!!bad);}}
function stopAll(){M.unsub.forEach(f=>{try{f();}catch(e){}});M.unsub=[];}
function errMsg(e){const c=e&&e.code||'';
  if(/permission/.test(c))return '書きこみが許可されなかった（Firebaseのルールを確認）';
  if(/unavailable|network/.test(c))return 'Firebaseにつながらない（ネットワークを確認）';
  if(/admin-restricted|operation-not-allowed/.test(c))return '匿名ログインが有効になっていない（Firebaseの設定を確認）';
  return (e&&e.message)||String(e);}

async function login(){if(M.uid)return M.uid;const r=await signInAnonymously(auth);M.uid=r.user.uid;return M.uid;}

/* ---------- 入口：部屋を作る／部屋に入る ---------- */
function open(nick,house){M.nick=nick;M.house=house;
  openDlg(`<h3>みんなで遊ぶ</h3>
    <p>先生が「部屋」を作り、みんなは部屋番号を入れて参加する。いまは、参加と書状のやりとりを試す<b>通信テスト</b>である。</p>
    <div class="mpent">
      <div class="mpcol"><b>部屋に入る（生徒）</b>
        <input type="text" id="mpcode" inputmode="numeric" maxlength="${ROOM_DIGITS+1}" placeholder="部屋番号（${ROOM_DIGITS}けた）" autocomplete="off">
        <div class="hint">${esc(hname(house))}・${esc(nick)} で参加する</div>
        <button class="btn pri" type="button" id="mpjoin">参加する</button></div>
      <div class="mpcol"><b>部屋を作る（先生）</b>
        <div class="hint">部屋番号が出るので、みんなに伝える。先生は家を動かさない。</div>
        <button class="btn" type="button" id="mpmake">部屋を作る</button></div>
    </div>
    <p class="mperr" id="mperr"></p>
    <div class="row"><button class="btn" type="button" onclick="closeDlg()">もどる</button></div>`,'mpbox',true);
  const c=q$('#mpcode');c.focus();c.onkeydown=e=>{if(e.key==='Enter')join();};
  q$('#mpjoin').onclick=join;q$('#mpmake').onclick=make;}
function err(t){const e=q$('#mperr');if(e)e.textContent=t;}
function busy(on){document.querySelectorAll('#mpjoin,#mpmake').forEach(b=>b.disabled=on);}

async function make(){busy(true);err('部屋を作っている…');
  try{await login();
    for(let i=0;i<8;i++){const lo=10**(ROOM_DIGITS-1);const code=String(lo+Math.floor(Math.random()*9*lo));
      try{await setDoc(doc(db,'rooms',code),{host:M.uid,hostNick:M.nick,status:'lobby',created:serverTimestamp()});M.code=code;break;}
      catch(e){if(!/permission/.test(e.code||''))throw e;}}  // 使われている番号ならやり直す
    if(!M.code)throw new Error('部屋番号を決められなかった');
    M.role='host';closeDlg();hostScreen();
  }catch(e){err(errMsg(e));busy(false);}}

async function join(){const code=(q$('#mpcode').value||'').replace(/\D/g,'');
  if(code.length!==ROOM_DIGITS){err(`部屋番号は${ROOM_DIGITS}けたの数字である`);return;}
  busy(true);err('部屋をさがしている…');
  try{await login();
    const r=await getDoc(doc(db,'rooms',code));
    if(!r.exists()){err('その番号の部屋はない。番号を確かめてください。');busy(false);return;}
    if(r.data().host===M.uid){err('この画面は、部屋を作った先生の画面である。参加は別の端末かタブで行う。');busy(false);return;}
    M.code=code;
    // 家の札：だれも取っていなければ自分のものにする
    const hr=doc(db,'rooms',code,'houses',M.house);const h=await getDoc(hr);
    if(h.exists()&&h.data().uid!==M.uid){err(`${hname(M.house)}は、すでに「${h.data().nick}」が選んでいる。タイトル画面で別の家を選んでください。`);M.code=null;busy(false);return;}
    if(!h.exists())await setDoc(hr,{uid:M.uid,nick:M.nick});
    await setDoc(doc(db,'rooms',code,'players',M.uid),{nick:M.nick,house:M.house,joined:serverTimestamp()});
    M.role='player';closeDlg();playerScreen();
  }catch(e){err(errMsg(e));M.code=null;busy(false);}}

/* ---------- 参加者の一覧 ---------- */
function watchPlayers(draw){
  sub(collection(db,'rooms',M.code,'players'),s=>{M.players={};s.forEach(d=>M.players[d.id]=d.data());draw();});
  sub(roomRef(),s=>{if(!s.exists()&&M.role==='player'){stopAll();alertMsg('先生が部屋を閉じた。');setTimeout(()=>location.reload(),2500);}});}
function pcard(uid,p,btn){
  return `<div class="mpp" style="--hc:${H[p.house]?H[p.house].col:'#888'}"><span class="mpf">${face(p.house)}<i>${kamonHTML(p.house)}</i></span>
    <div class="mpn"><b>${esc(hname(p.house))}</b><span class="who hu">${HU_SVG}${esc(p.nick)}</span></div>${btn||''}</div>`;}

/* ---------- 先生の画面 ---------- */
function hostScreen(){
  q$('#app').innerHTML=`<div class="mpscr">
    <div class="mphead"><div><div class="mpl">部屋番号</div><div class="mpcode">${fmtCode(M.code)}</div>
      <div class="hint">生徒は「みんなで遊ぶ」→ 部屋番号を入れて参加する</div></div>
      <div class="mpst" id="mpst">つながっている</div></div>
    <h3>参加している人 <span id="mpcnt">0</span>人</h3><div class="mplist" id="mplist"></div>
    <h3>書状のやりとり（通信テスト）</h3><div class="mplog" id="mplog"><p class="hint">まだない</p></div>
    <div class="row"><button class="btn" type="button" id="mpclose">部屋を閉じる</button>
      <button class="btn pri" type="button" disabled title="次の段階で作る">ゲームを始める（準備中）</button></div></div>`;
  watchPlayers(()=>{const ks=Object.keys(M.players);q$('#mpcnt').textContent=ks.length;
    q$('#mplist').innerHTML=ks.length?ks.map(u=>pcard(u,M.players[u],`<button class="btn small" type="button" data-kick="${u}">外す</button>`)).join(''):'<p class="hint">まだだれも参加していない</p>';
    document.querySelectorAll('[data-kick]').forEach(b=>b.onclick=()=>kick(b.dataset.kick));});
  sub(query(collection(db,'rooms',M.code,'letters'),orderBy('created','desc'),limit(30)),s=>{
    const a=[];s.forEach(d=>a.push(d.data()));
    q$('#mplog').innerHTML=a.length?a.map(L=>`<div class="mpli ${L.status}"><b>${esc(hname(L.fromH))}</b>（${esc(L.fromNick)}）→ <b>${esc(hname(L.toH))}</b>（${esc(L.toNick)}）　「${esc(ltn(L.type))}」　<span>${L.status==='ok'?'承諾':L.status==='ng'?'拒絶':'返事待ち'}</span></div>`).join(''):'<p class="hint">まだない</p>';});
  q$('#mpclose').onclick=async()=>{if(!confirm('部屋を閉じると、参加している人は全員ぬける。閉じますか？'))return;
    try{stopAll();await deleteDoc(roomRef());}catch(e){toast(errMsg(e),true);}location.reload();};}
async function kick(u){const p=M.players[u];if(!p||!confirm(`${p.nick}（${hname(p.house)}）を部屋から外しますか？`))return;
  try{await deleteDoc(doc(db,'rooms',M.code,'players',u));await deleteDoc(doc(db,'rooms',M.code,'houses',p.house));}catch(e){toast(errMsg(e),true);}}

/* ---------- 生徒の画面 ---------- */
const ltn=t=>{const x=LETTER_TYPES.find(l=>l.id===t);return x?x.n:t;};
function playerScreen(){
  q$('#app').innerHTML=`<div class="mpscr">
    <div class="mphead"><div><div class="mpl">部屋番号 ${fmtCode(M.code)}</div>
      <div class="mpme">${pcard(M.uid,{nick:M.nick,house:M.house})}</div></div>
      <div class="mpst" id="mpst">つながっている</div></div>
    <p class="mpwait">先生がゲームを始めるのを待っている。待っているあいだに、ほかの家へ書状を送って通信を試せる。</p>
    <h3>同じ部屋の家</h3><div class="mplist" id="mplist"></div>
    <div class="row"><button class="btn" type="button" id="mpleave">部屋からぬける</button></div></div>`;
  watchPlayers(()=>{
    if(!M.players[M.uid]){stopAll();alertMsg('先生が、あなたを部屋から外した。');setTimeout(()=>location.reload(),2500);return;}
    const ks=Object.keys(M.players).filter(u=>u!==M.uid);
    q$('#mplist').innerHTML=ks.length?ks.map(u=>pcard(u,M.players[u],`<button class="btn small pri" type="button" data-to="${u}">書状を送る</button>`)).join(''):'<p class="hint">ほかの家はまだ参加していない</p>';
    document.querySelectorAll('[data-to]').forEach(b=>b.onclick=()=>letterDlg(b.dataset.to));});
  // 自分あての書状 → 返事をする
  sub(query(collection(db,'rooms',M.code,'letters'),where('to','==',M.uid)),s=>s.docChanges().forEach(c=>{
    const L=c.doc.data();if(L.status==='pending'&&!M.shown['in'+c.doc.id]){M.shown['in'+c.doc.id]=1;incoming(c.doc.id,L);}}));
  // 自分が送った書状 → 返事が来たら大きく出す
  sub(query(collection(db,'rooms',M.code,'letters'),where('from','==',M.uid)),s=>s.docChanges().forEach(c=>{
    const L=c.doc.data();if(L.status!=='pending'&&c.type==='modified'&&!M.shown['re'+c.doc.id]){M.shown['re'+c.doc.id]=1;reply(L);}}));
  q$('#mpleave').onclick=async()=>{if(!confirm('部屋からぬけますか？'))return;
    try{stopAll();await deleteDoc(doc(db,'rooms',M.code,'players',M.uid));await deleteDoc(doc(db,'rooms',M.code,'houses',M.house));}catch(e){}location.reload();};}

function letterDlg(to){const p=M.players[to];if(!p)return;
  const types=LETTER_TYPES.filter(t=>['domei','fusen','wabo'].includes(t.id));
  openDlg(`<h3>${esc(hname(p.house))}<span class="who hu">${HU_SVG}${esc(p.nick)}</span> へ書状を送る</h3>
    <div class="mpty">${types.map(t=>`<button class="btn" type="button" data-t="${t.id}"><b>${esc(t.n)}</b><small>${esc(t.d)}</small></button>`).join('')}</div>
    <p class="hint">通信テストなので、承諾しても断ってもゲームには影響しない。</p>
    <div class="row"><button class="btn" type="button" onclick="closeDlg()">やめる</button></div>`,'mpbox',true);
  document.querySelectorAll('[data-t]').forEach(b=>b.onclick=async()=>{document.querySelectorAll('[data-t]').forEach(x=>x.disabled=true);
    try{await addDoc(collection(db,'rooms',M.code,'letters'),{from:M.uid,to,fromH:M.house,toH:p.house,fromNick:M.nick,toNick:p.nick,type:b.dataset.t,status:'pending',created:serverTimestamp()});
      closeDlg();toast(`${hname(p.house)}へ書状を送った。返事を待っている…`);}
    catch(e){closeDlg();toast(errMsg(e),true);}});}

function incoming(id,L){
  openDlg(`<div class="rpw in"><div class="rpt">${esc(hname(L.fromH))}から書状が届いた<span class="who hu lg">${HU_SVG}${esc(L.fromNick)}</span></div>
    <div class="rpm"><span class="rpf" style="--hc:${H[L.fromH]?H[L.fromH].col:'#888'}">${face(L.fromH)}<i>${kamonHTML(L.fromH)}</i></span>
      <div class="rpq"><div class="rpq0">書状の中身</div><div class="rpq1">「${esc(ltn(L.type))}」</div></div></div>
    <div class="row"><button class="btn" type="button" id="mpng">断る</button><button class="btn pri" type="button" id="mpok">承諾する</button></div></div>`,'rpbox',false);
  const ans=async st=>{document.querySelectorAll('#mpok,#mpng').forEach(b=>b.disabled=true);
    try{await updateDoc(doc(db,'rooms',M.code,'letters',id),{status:st,answered:serverTimestamp()});closeDlg();toast(st==='ok'?'承諾の返事を送った':'断りの返事を送った');}
    catch(e){closeDlg();toast(errMsg(e),true);}};
  q$('#mpok').onclick=()=>ans('ok');q$('#mpng').onclick=()=>ans('ng');}

function reply(L){const ok=L.status==='ok';
  openDlg(`<div class="rpw ${ok?'ok':'ng'}"><div class="rpt">${esc(hname(L.toH))}からの返事<span class="who hu lg">${HU_SVG}${esc(L.toNick)}</span></div>
    <div class="rpm"><span class="rpf" style="--hc:${H[L.toH]?H[L.toH].col:'#888'}">${face(L.toH)}<i>${kamonHTML(L.toH)}</i></span>
      <div class="rpq"><div class="rpq0">「${esc(ltn(L.type))}」への返事</div><div class="rpq1">${ok?'承知した。':'お断りする。'}</div></div>
      <div class="rps">${ok?'承諾':'拒絶'}</div></div>
    <div class="row"><button class="btn pri" type="button" onclick="closeDlg()">とじる</button></div></div>`,'rpbox',true);}

window.NET={open};
