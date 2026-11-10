/* =========================================================
   群雄割拠　みんなで遊ぶ（通信）
   Cloud Firestore＋匿名ログイン。部屋を作った人の画面が「親」になり、ターンを計算して全員に配る。
   データ：rooms/{部屋番号}                … host, hostNick, hostPlays, turnSec, status（lobby/playing）, resume（続きから）
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
  auth:null,authUid:1,rd:{},btr:{},away:new Set(),bt:null,bseq:0,stBattle:'',btq:[],btBusy:false,btLast:0,liveSeen:new Set(),resolving:false,timer:0,doing:new Set(),stWrite:0};
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

/* ---------- 保存（部屋を作った人） ----------
   ターンが進むたびに、この端末（ブラウザ）に自動で保存する。ファイルに書き出すこともできる。
   続きから遊ぶときは、新しい部屋を作るときに「続きから」を選ぶ（部屋番号は新しくなる） */
const SAVE_MP='gunyu_mpsave';
function saveObj(){const a=M.auth;return {v:1,savedAt:Date.now(),turn:a.turn,y:YEARS[a.turn],players:a.players||{},turnSec:a.turnSec||0,ended:!!a.ended,s:JSON.stringify({S:a,uid:M.authUid})};}
function autoSave(){if(!M.auth)return null;const v=saveObj();lsSet(SAVE_MP,JSON.stringify(v));return v;}
function lastSave(){try{const v=JSON.parse(lsGet(SAVE_MP)||'null');return v&&v.s?v:null;}catch(e){return null;}}
const saveTxt=v=>`${v.y}年・ターン${v.turn+1}／${YEARS.length}　（${Object.keys(v.players).map(h=>`${H[h]?H[h].n:h}：${v.players[h]}`).join('、')}）`;
function download(){const v=autoSave();if(!v)return;
  try{const blob=new Blob([JSON.stringify(v)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);
    a.download=`群雄割拠_${v.y}年_ターン${v.turn+1}.json`;document.body.appendChild(a);a.click();a.remove();
    toast('保存のファイルを書き出した（ダウンロードした場所を確かめる）',false,4000);}
  catch(e){toast('ファイルに書き出せなかった。この端末には自動で保存されている',true,5000);}}

/* ---------- 入口：部屋を作る／部屋に入る ---------- */
const TIMES=[[90,'1分30秒'],[120,'2分'],[180,'3分'],[300,'5分'],[0,'なし（全員がそろうまで待つ）']];
function open(nick){M.nick=nick;M.house=null;M.resumeSave=null;
  const def=typeof TURN_SEC==='number'&&TURN_SEC?TURN_SEC:120;const ls=lastSave();
  openDlg(`<h3>みんなで遊ぶ</h3>
    <p>だれかが「部屋」を作り、ほかの人は部屋番号を入れて参加する。<b>動かす家は、部屋に入ってから選ぶ</b>。部屋を作った人の画面がターンを計算するので、部屋を作った人は画面を閉じない。</p>
    <div class="mpent">
      <div class="mpcol"><b>部屋に入る</b>
        <input type="text" id="mpcode" inputmode="numeric" maxlength="${ROOM_DIGITS+1}" placeholder="部屋番号（${ROOM_DIGITS}けた）" autocomplete="off" value="${esc(lsGet('gunyu_room')||'')}">
        <div class="hint">「${esc(nick)}」で参加する。遊んでいる途中なら、同じニックネームで入り直せる。</div>
        <button class="btn pri" type="button" id="mpjoin">参加する</button></div>
      <div class="mpcol"><b>部屋を作る</b>
        <label class="mpopt"><input type="radio" name="mpplay" value="1" checked> 自分も家を動かす</label>
        <label class="mpopt"><input type="radio" name="mpplay" value="0"> 見守るだけ（先生）</label>
        <label class="mpopt">1ターンの時間 <select id="mpsec">${TIMES.map(([v,n])=>`<option value="${v}" ${v===def?'selected':''}>${n}</option>`).join('')}</select></label>
        <div class="mpsv"><label class="mpopt"><input type="radio" name="mpnew" value="new" checked> 新しく始める</label>
          ${ls?`<label class="mpopt"><input type="radio" name="mpnew" value="ls"> 続きから：${esc(saveTxt(ls))}</label>`:''}
          <label class="mpopt"><input type="radio" name="mpnew" value="file"> 続きから（保存したファイル）<input type="file" id="mpfile" accept=".json,application/json"></label></div>
        <button class="btn" type="button" id="mpmake">部屋を作る</button></div>
    </div>
    <p class="mperr" id="mperr"></p>
    <div class="row"><button class="btn" type="button" onclick="closeDlg()">もどる</button></div>`,'mpbox',true);
  const c=q$('#mpcode');c.focus();c.onkeydown=e=>{if(e.key==='Enter')join();};
  const f=q$('#mpfile');f.onchange=()=>{const r=document.querySelector('input[name=mpnew][value=file]');if(r)r.checked=true;};
  q$('#mpjoin').onclick=join;q$('#mpmake').onclick=make;}
function err(t){const e=q$('#mperr');if(e)e.textContent=t;}
function busy(on){document.querySelectorAll('#mpjoin,#mpmake').forEach(b=>b.disabled=on);}
async function pickSave(){const how=(document.querySelector('input[name=mpnew]:checked')||{}).value||'new';
  if(how==='ls')return lastSave();
  if(how==='file'){const f=q$('#mpfile').files[0];if(!f)throw new Error('保存したファイルを選んでください');
    const v=JSON.parse(await f.text());if(!v||!v.s)throw new Error('群雄割拠の保存ファイルではない');return v;}
  return null;}

async function make(){busy(true);err('部屋を作っている…');
  const plays=(document.querySelector('input[name=mpplay]:checked')||{}).value==='1';const sec=+q$('#mpsec').value;
  try{const sv=await pickSave();await login();
    for(let i=0;i<8;i++){const lo=10**(ROOM_DIGITS-1);const code=String(lo+Math.floor(Math.random()*9*lo));
      try{await setDoc(doc(db,'rooms',code),{host:M.uid,hostNick:M.nick,hostPlays:plays,turnSec:sec,status:'lobby',
          resume:sv?{turn:sv.turn,y:sv.y,players:sv.players}:null,created:serverTimestamp()});M.code=code;break;}
      catch(e){if(!/permission/.test(e.code||''))throw e;}}  // 使われている番号ならやり直す
    if(!M.code)throw new Error('部屋番号を決められなかった');
    // 続きから：保存した状態を部屋に置いておく（始めるときに読む）
    if(sv)await setDoc(R('game','state'),{turn:sv.turn,t0:Date.now(),dur:0,ended:!!sv.ended,lobby:true,s:sv.s});
    if(plays)await setDoc(R('players',M.uid),{nick:M.nick,house:null,joined:serverTimestamp()});
    lsSet('gunyu_room',M.code);M.role='host';M.room=(await getDoc(R())).data();closeDlg();lobby();
  }catch(e){err(errMsg(e));M.code=null;busy(false);}}

async function join(){const code=(q$('#mpcode').value||'').replace(/\D/g,'');
  if(code.length!==ROOM_DIGITS){err(`部屋番号は${ROOM_DIGITS}けたの数字である`);return;}
  busy(true);err('部屋をさがしている…');
  try{await login();
    const r=await getDoc(doc(db,'rooms',code));
    if(!r.exists()){err('その番号の部屋はない。番号を確かめてください。');busy(false);return;}
    M.code=code;M.room=r.data();lsSet('gunyu_room',code);
    // 部屋を作った人が入り直した
    if(M.room.host===M.uid){M.role='host';closeDlg();if(M.room.status==='playing')await hostResume();else lobby();return;}
    const hs={};(await getDocs(C('houses'))).forEach(d=>hs[d.id]=d.data());
    if(M.room.status==='playing'){
      // 遊んでいる途中：自分の家（同じタブ、または同じニックネーム）で入り直す
      let h=Object.keys(hs).find(k=>hs[k].uid===M.uid)||Object.keys(hs).find(k=>hs[k].nick===M.nick);
      if(!h){err('この部屋のゲームはもう始まっている。参加していた人は、同じニックネームで入り直す。');M.code=null;busy(false);return;}
      if(hs[h].uid!==M.uid)await setDoc(R('houses',h),{uid:M.uid,nick:hs[h].nick});
      M.house=h;M.nick=hs[h].nick;await setDoc(R('players',M.uid),{nick:M.nick,house:h,joined:serverTimestamp()});
      M.role='player';closeDlg();enterGame();return;}
    // 待合室：同じニックネームの人がいたら入れない（自分が入り直したときは入れる）
    const ps={};(await getDocs(C('players'))).forEach(d=>ps[d.id]=d.data());
    if(!ps[M.uid]&&Object.keys(ps).some(u=>ps[u].nick===M.nick)){err(`「${M.nick}」というニックネームの人が、もうこの部屋にいる。タイトル画面でニックネームを変えてください。`);M.code=null;busy(false);return;}
    const mine=Object.keys(hs).find(k=>hs[k].uid===M.uid);M.house=mine||null;
    await setDoc(R('players',M.uid),{nick:M.nick,house:M.house,joined:serverTimestamp()});
    M.role='player';closeDlg();lobby();
  }catch(e){err(errMsg(e));M.code=null;busy(false);}}

/* ---------- 待合室：家を選ぶ ---------- */
// 家の札（houses）の持ち主が今もいる参加者だけを数える（入り直した人の古い分は出さない）
const activePlayers=()=>Object.keys(M.players).filter(u=>{const p=M.players[u];return !p.house||(M.houses[p.house]&&M.houses[p.house].uid===u);});
function houseTile(k,canPick){const d=HOUSE_DEF.find(x=>x[0]===k);const hm=A[d[3][0]];const cl=M.houses[k];const mine=cl&&cl.uid===M.uid;
  const prev=M.room.resume&&M.room.resume.players[k];
  const f=FACE[k]?`<img class="hgf" src="img/face/${k}.jpg" alt="">`:`<span class="hgf none">${esc((H[k].bu[0][0]||d[1])[0])}</span>`;
  return `<button type="button" class="hgc mpht ${mine?'on':''} ${cl&&!mine?'tk':''}" data-k="${k}" style="--hc:${H[k].col}" ${canPick?'':'disabled'}>${f}<span class="hgk">${kamonHTML(k)}</span>
    <b>${d[4]?'<i class="hgs">☆</i>':''}${esc(d[1])}家</b><small>${esc(hm.n)}（${esc(hm.pv)}）</small>
    ${cl?`<span class="who hu">${HU_SVG}${esc(cl.nick)}</span>`:prev?`<span class="mpprev">前回：${esc(prev)}</span>`:''}</button>`;}
// 待合室の地図：はじめの領地を家の色でぬる。家の領地をクリックすると、その家を選ぶ
function lobbyMap(){const own={};for(const d of HOUSE_DEF)for(const a of d[3])own[a]=d[0];
  const nm=k=>{const d=HOUSE_DEF.find(x=>x[0]===k);return d?d[1]+'家':'';};
  const paths=AREAS.map(a=>`<path class="lma${own[a.id]?' k':''}" d="${a.d}" data-k="${own[a.id]||''}"><title>${esc(own[a.id]?nm(own[a.id])+'（'+a.n+'）':a.n)}</title></path>`).join('');
  const labels=HOUSE_DEF.map(d=>{const a=AREAS.find(x=>x.id===d[3][0]);if(!a)return '';
    return `<g class="lml" data-k="${d[0]}" transform="translate(${a.c[0]},${a.c[1]})"><text class="lmn">${esc(d[1].replace(/（.*）/,''))}</text><text class="lmu" y="15"></text></g>`;}).join('');
  return `<svg class="lmap" id="lmap" xmlns="http://www.w3.org/2000/svg">${paths}<g id="lmlab">${labels}</g></svg>`;}
// 待合室の地図は、ゲームと同じ地図を使う（はじめの年のようす）。領地をクリックすると、その家を選ぶ
function lobbyGameMap(canPick){const kS=S;
  try{if(!S||S.mode!=='preview'){newGame(HOUSE_DEF[0][0]);S.me=null;S.mode='preview';}
    UI.lobbyPick=a=>{const k=S.own[a];if(!k){toast('ここはどの家の領地でもない（国人衆）',true);return;}if(canPick)pick(k);};
    UI.mapMode='pow';UI.vb=null;buildMap();UI.vb=UI.full.slice();setVB();drawMap();
    const bg=q$('#mapbg');if(bg)bg.setAttribute('href',MAP_BG.pol);}
  catch(e){console.warn(e);}}
function lobbyNicks(){const sv=q$('#map');if(!sv||!S||S.mode!=='preview')return;let g=sv.querySelector('#lmnick');
  if(!g){g=document.createElementNS('http://www.w3.org/2000/svg','g');g.id='lmnick';sv.appendChild(g);}
  const ns='http://www.w3.org/2000/svg';g.innerHTML='';
  document.querySelectorAll('#gA .area').forEach(p=>{const k=S.own[p.dataset.a];const cl=k&&M.houses[k];p.classList.toggle('lmine',!!cl&&cl.uid===M.uid);p.classList.toggle('ltk',!!cl&&cl.uid!==M.uid);});
  for(const k in M.houses){const d=HOUSE_DEF.find(x=>x[0]===k);if(!d)continue;const a=AREAS.find(x=>x.id===d[3][0]);if(!a)continue;const cl=M.houses[k];const mine=cl.uid===M.uid;
    const t=document.createElementNS(ns,'g');t.setAttribute('class','lmtag'+(mine?' mine':''));t.setAttribute('transform',`translate(${a.c[0]},${a.c[1]+30})`);
    const w=Math.max(60,cl.nick.length*21+30);t.innerHTML=`<rect x="${-w/2}" y="-17" width="${w}" height="34" rx="17"/><text y="8">${esc(cl.nick)}</text>`;g.appendChild(t);}}
function lobbyMapDraw(canPick){if(q$('#lmwrap .lmw')){lobbyNicks();return;}const sv=q$('#lmap');if(!sv)return;
  if(!sv.getAttribute('viewBox')){try{const bb=sv.getBBox();sv.setAttribute('viewBox',`${bb.x-8} ${bb.y-8} ${bb.width+16} ${bb.height+16}`);}catch(e){}
    sv.querySelectorAll('path.lma.k').forEach(p=>{const k=p.dataset.k;
      p.onmouseenter=()=>sv.querySelectorAll(`path[data-k="${k}"]`).forEach(x=>x.classList.add('hv'));
      p.onmouseleave=()=>sv.querySelectorAll('path.hv').forEach(x=>x.classList.remove('hv'));
      if(canPick)p.onclick=()=>pick(k);});}
  sv.querySelectorAll('path.lma.k').forEach(p=>{const k=p.dataset.k;const cl=M.houses[k];const mine=cl&&cl.uid===M.uid;
    p.style.fill=H[k].col;p.classList.toggle('mine',!!mine);p.classList.toggle('tk',!!cl&&!mine);});
  sv.querySelectorAll('.lml').forEach(g=>{const k=g.dataset.k;const cl=M.houses[k];const u=g.querySelector('.lmu');u.textContent=cl?cl.nick:'';
    g.classList.toggle('on',!!cl);g.classList.toggle('mine',!!cl&&cl.uid===M.uid);});}
function lobby(){if(typeof MUSIC!=='undefined')MUSIC.scene('lobby');const host=M.role==='host';const canPick=!host||M.room.hostPlays;const rs=M.room.resume;
  q$('#app').innerHTML=`<div class="mpscr">
    <div class="mphead"><div><div class="mpl">部屋番号</div><div class="mpcode">${fmtCode(M.code)}</div>
      <div class="hint">${host?'ほかの人は「みんなで遊ぶ」→ 部屋番号を入れて参加する。':`部屋を作った人：${esc(M.room.hostNick||'')}　`}1ターンの時間：${esc((TIMES.find(t=>t[0]===M.room.turnSec)||[0,'なし'])[1])}</div></div>
      <div class="mpst" id="mpst">つながっている</div></div>
    ${rs?`<p class="mpwait">前回の続き（${rs.y}年・ターン${rs.turn+1}）から始める。前回と同じ家を選ぶ（「前回：」の名前が目じるし）。だれも選ばなかった家は、コンピューターが動かす。</p>`:''}
    ${canPick?`<div class="mpmine" id="mpmine"></div>`:''}
    <h3>${canPick?'動かす家を選ぶ <span class="hint">地図の領地か一覧をクリックして選ぶ。名前が出ている家は、ほかの人が選んでいる。☆はおすすめの家</span>':'家と動かす人'}</h3>
    <div class="mptabs"><button type="button" class="btn small" data-v="map">地図から選ぶ</button><button type="button" class="btn small" data-v="list">一覧から選ぶ</button></div>
    <div class="lmwrap" id="lmwrap"><div class="mapw lmw"><svg id="map"></svg></div></div>
    <div class="hgrid mphg" id="mpgrid"></div>
    <h3>参加している人 <span id="mpcnt"></span></h3><div class="mplist" id="mplist"></div>
    <p class="hint">だれも選ばなかった家は、コンピューターが動かす。</p>
    <div class="row">${host?`<button class="btn" type="button" id="mpclose">部屋を閉じる</button><button class="btn pri" type="button" id="mpstart" disabled>ゲームを始める</button>`:`<button class="btn" type="button" id="mpleave">部屋からぬける</button>`}</div></div>`;
  const draw=()=>{if(!q$('#mpgrid'))return;
    if(!host&&!M.players[M.uid]){stopAll();alertMsg('部屋から外された。');setTimeout(()=>location.reload(),2500);return;}
    const mineH=Object.keys(M.houses).find(k=>M.houses[k].uid===M.uid)||null;M.house=mineH;
    q$('#mpgrid').innerHTML=HOUSE_DEF.map(d=>houseTile(d[0],canPick)).join('');lobbyMapDraw(canPick);
    if(canPick)document.querySelectorAll('.mpht').forEach(b=>b.onclick=()=>pick(b.dataset.k));
    const me=q$('#mpmine');if(me)me.innerHTML=mineH?`<div class="mpp" style="--hc:${H[mineH].col}"><span class="mpf">${face(mineH)}<i>${kamonHTML(mineH)}</i></span><div class="mpn"><span class="hint">あなたが動かす家</span><b>${esc(hname(mineH))}</b><span class="who hu">${HU_SVG}${esc(M.nick)}</span></div><span class="hint">ほかの家をクリックすると変えられる</span></div>`
      :`<p class="mpwait need">下の一覧から、動かす家をクリックして選ぶ。</p>`;
    const us=activePlayers();q$('#mpcnt').textContent=`${us.length}人`;
    q$('#mplist').innerHTML=us.length?us.map(u=>{const p=M.players[u];const btn=u===M.uid?'<span class="hint">あなた</span>':host?`<button class="btn small" type="button" data-kick="${u}">外す</button>`:'';
      return p.house?pcard(p,btn):`<div class="mpp"><span class="mpf"></span><div class="mpn"><b class="hint">家を選んでいる…</b><span class="who hu">${HU_SVG}${esc(p.nick)}</span></div>${btn}</div>`;}).join(''):'<p class="hint">まだだれも参加していない</p>';
    document.querySelectorAll('[data-kick]').forEach(b=>b.onclick=()=>kick(b.dataset.kick));
    const st=q$('#mpstart');if(st)st.disabled=!Object.keys(M.houses).length;};
  const view=v=>{M.lview=v;lsSet('gunyu_lview',v);q$('#lmwrap').style.display=v==='map'?'':'none';q$('#mpgrid').style.display=v==='map'?'none':'';
    document.querySelectorAll('.mptabs .btn').forEach(b=>b.classList.toggle('pri',b.dataset.v===v));};
  document.querySelectorAll('.mptabs .btn').forEach(b=>b.onclick=()=>view(b.dataset.v));view(lsGet('gunyu_lview')||'map');lobbyGameMap(canPick);
  sub(C('players'),s=>{M.players={};s.forEach(d=>M.players[d.id]=d.data());draw();});
  sub(C('houses'),s=>{M.houses={};s.forEach(d=>M.houses[d.id]=d.data());draw();});
  if(host){q$('#mpclose').onclick=closeRoom;q$('#mpstart').onclick=startGame;}
  else{sub(R(),s=>{if(!s.exists()){stopAll();alertMsg('部屋が閉じられた。');setTimeout(()=>location.reload(),2500);return;}
      M.room=s.data();if(M.room.status==='playing'&&!M.inGame){stopAll();if(!M.house){alertMsg('家を選ばないうちにゲームが始まった。この部屋には参加できない。');return;}enterGame();}});
    q$('#mpleave').onclick=async()=>{if(!confirm('部屋からぬけますか？'))return;
      try{stopAll();await deleteDoc(R('players',M.uid));if(M.house)await deleteDoc(R('houses',M.house));}catch(e){}location.reload();};}}
async function pick(k){const cl=M.houses[k];if(cl&&cl.uid===M.uid)return;
  if(cl){toast(`${hname(k)}は「${cl.nick}」が選んでいる`,true);return;}
  try{const cur=await getDoc(R('houses',k));if(cur.exists()&&cur.data().uid!==M.uid){toast(`${hname(k)}は「${cur.data().nick}」が選んだ`,true);return;}
    await setDoc(R('houses',k),{uid:M.uid,nick:M.nick});
    const old=M.house;M.house=k;if(old&&old!==k)await deleteDoc(R('houses',old)).catch(()=>{});
    await setDoc(R('players',M.uid),{nick:M.nick,house:k,joined:serverTimestamp()});}
  catch(e){toast(errMsg(e),true);}}
function pcard(p,btn){
  return `<div class="mpp" style="--hc:${H[p.house]?H[p.house].col:'#888'}"><span class="mpf">${face(p.house)}<i>${kamonHTML(p.house)}</i></span>
    <div class="mpn"><b>${esc(hname(p.house))}</b><span class="who hu">${HU_SVG}${esc(p.nick)}</span></div>${btn||''}</div>`;}
async function closeRoom(){if(!confirm('部屋を閉じると、参加している人は全員ぬける。閉じますか？'+(M.auth?'（ゲームはこの端末に保存されている。新しい部屋を作るときに「続きから」で再開できる）':'')))return;
  if(M.auth)autoSave();try{stopAll();await deleteDoc(R());}catch(e){toast(errMsg(e),true);}lsSet('gunyu_room','');location.reload();}
async function kick(u){const p=M.players[u];if(!p||!confirm(`${p.nick}${p.house?'（'+hname(p.house)+'）':''}を部屋から外しますか？`))return;
  try{await deleteDoc(R('players',u));if(p.house&&M.houses[p.house]&&M.houses[p.house].uid===u)await deleteDoc(R('houses',p.house));}catch(e){toast(errMsg(e),true);}}

/* =========================================================
   親の画面（部屋を作った人）：ターンを計算して配る
   ========================================================= */
// 親の状態（M.auth）でエンジンを動かす。自分の画面の S はそのまま残す
function withAuth(fn){const kS=S,kU=uid;S=M.auth;uid=M.authUid;try{return fn();}finally{M.auth=S;M.authUid=uid;S=kS;uid=kU;}}
const liveHumans=()=>withAuth(()=>humans().filter(h=>alive(h)&&!S.ended));
async function writeState(){const a=M.auth;M.t0=Date.now();
  await setDoc(R('game','state'),{turn:a.turn,t0:M.t0,dur:a.turnSec||0,ended:!!a.ended,s:JSON.stringify({S:a,uid:M.authUid})});
  autoSave();M.rd={};await writeStatus(true);}
async function writeStatus(force){const now=Date.now();if(!force&&now-M.stWrite<1500){clearTimeout(M._stT);M._stT=setTimeout(()=>writeStatus(true),1600);return;}
  M.stWrite=now;const turn=M.auth.turn;const ready=Object.keys(M.rd).filter(h=>M.rd[h].turn===turn);
  try{await setDoc(R('game','status'),{turn,ready,tot:liveHumans().length,resolving:!!M.resolving,battle:M.stBattle||''});}catch(e){console.warn(e);}}
async function startGame(){const ps={};for(const k in M.houses)ps[k]=M.houses[k].nick;
  if(!Object.keys(ps).length)return;
  const no=activePlayers().filter(u=>!M.players[u].house).map(u=>M.players[u].nick);
  if(no.length&&!confirm(`家を選んでいない人がいる（${no.join('、')}）。その人は参加できない。始めますか？`))return;
  if(M.room.hostPlays&&!Object.keys(M.houses).some(k=>M.houses[k].uid===M.uid)&&!confirm('あなたはまだ家を選んでいない。見守るだけで始めますか？'))return;
  q$('#mpstart').disabled=true;
  const kS=S,kU=uid;
  try{if(M.room.resume){const d=await getDoc(R('game','state'));const o=JSON.parse(d.data().s);S=o.S;uid=o.uid;}
    else newGame(Object.keys(ps)[0]);
    S.players=ps;S.mode='multi';S.me=null;S.turnSec=M.room.turnSec||0;S.ended=false;
    M.auth=S;M.authUid=uid;}
  finally{S=kS;uid=kU;}
  try{await writeState();await updateDoc(R(),{status:'playing'});}catch(e){toast(errMsg(e),true);q$('#mpstart').disabled=false;return;}
  stopAll();hostDuties();M.house=Object.keys(M.houses).find(k=>M.houses[k].uid===M.uid)||null;UI.lobbyPick=null;
  if(M.house)enterGame();else watchScreen();}
async function hostResume(){
  const d=await getDoc(R('game','state'));if(!d.exists()||d.data().lobby){lobby();return;}
  const o=JSON.parse(d.data().s);M.auth=o.S;M.authUid=o.uid;M.t0=d.data().t0;
  const hs={};(await getDocs(C('houses'))).forEach(x=>hs[x.id]=x.data());M.houses=hs;
  hostDuties();M.house=Object.keys(hs).find(k=>hs[k].uid===M.uid&&o.S.players&&o.S.players[k])||null;
  if(M.house)enterGame();else watchScreen();}
function hostDuties(){
  sub(C('ready'),s=>{s.forEach(d=>M.rd[d.id]=d.data());writeStatus();checkAll();if(M.role==='host'&&!M.house)watchScreen();});
  sub(C('letters'),s=>s.docChanges().forEach(c=>{if(c.type!=='removed')hostLetter(c.doc.id,c.doc.data());}));
  sub(C('houses'),s=>{M.houses={};s.forEach(d=>M.houses[d.id]=d.data());});
  sub(C('btr'),s=>s.forEach(d=>M.btr[d.id]=d.data()));
  M.timer=setInterval(()=>{const a=M.auth;if(!M.house)tickWatch();if(!a||a.ended||M.resolving)return;
    if(a.turnSec&&Date.now()>M.t0+a.turnSec*1000+8000)resolveTurn();},1000);}
function checkAll(){const a=M.auth;if(!a||a.ended||M.resolving)return;const hs=liveHumans();
  if(hs.length&&hs.every(h=>M.rd[h]&&M.rd[h].turn===a.turn))resolveTurn();}
/* ---------- 合戦をその場で：陣形・しんがり・城の守り方を、かかわる家の人が選ぶ ----------
   親は合戦の場面ごとに bt/{家} に書き、かかわる人の返事（btr/{家}）を待つ。時間内に返事がない人は、そのターンのあいだコンピューターにまかせる */
const BT_WAIT={start:30000,round:20000,end:30000};
function btSides(ev){const hu=h=>!!(M.auth.players&&M.auth.players[h])&&!M.away.has(h);
  const hsA=ev.A.hs.filter(hu),hsD=ev.D.hs.filter(hu);
  const ch=(sd,hs)=>{const m=(sd.guards||[]).find(g=>g.main);return m&&hs.includes(m.h)?m.h:hs[0]||null;};
  const watch=[...ev.A.hs.map(h=>[h,'A']),...ev.D.hs.map(h=>[h,'D']),...(ev.def?[[ev.def,'D']]:[])].filter(([h])=>M.auth.players&&M.auth.players[h]);
  return {hsA,hsD,chA:ch(ev.A,hsA),chD:ch(ev.D,hsD),watch};}
async function hostEvent(ev){
  if(ev.k==='start'){M.bt=btSides(ev);M.stBattle=`${ev.name}（${[...ev.A.hs,...ev.D.hs].filter(h=>H[h]).map(h=>H[h].n).join('・')}）`;writeStatus();}
  const B=M.bt;if(!B)return undefined;
  const tg=[...B.hsA.map(h=>[h,'A']),...B.hsD.map(h=>[h,'D'])].filter(([h])=>!M.away.has(h));
  for(const [h,sd] of B.watch)if(!tg.some(t=>t[0]===h))tg.push([h,sd]);if(!tg.length)return undefined;
  const seq=M.bseq=Math.max((M.bseq||0)+1,Date.now());
  let evs=ev;if(ev.k==='end'){const r={...ev.rec};delete r.ev;evs={k:'end',rec:r};}
  await Promise.all(tg.map(([h,side])=>setDoc(R('bt',h),{seq,turn:M.auth.turn,t:Date.now(),s:JSON.stringify({ev:evs,side,chA:B.chA,chD:B.chD})}).catch(e=>console.warn(e))));
  const who=ev.k==='retreat'||ev.k==='forms'?[]:[B.chA,B.chD].filter(h=>h&&!M.away.has(h));
  if(!who.length)return undefined;
  const got=await waitBtr(who,seq,BT_WAIT[ev.k]||20000);
  for(const h of who)if(!got[h])M.away.add(h);   // 返事がない人は、このターンのあいだコンピューターにまかせる
  if(ev.k==='start')return {formA:got[B.chA]&&got[B.chA].form,formD:got[B.chD]&&got[B.chD].form};
  if(ev.k==='round')return {retreatA:!!(got[B.chA]&&got[B.chA].retreat),retreatD:!!(got[B.chD]&&got[B.chD].retreat)};
  return undefined;}
function waitBtr(who,seq,ms){return new Promise(ok=>{const t0=Date.now();
  const chk=()=>{const got={};for(const h of who){const r=M.btr[h];if(r&&r.seq===seq)got[h]=r;}
    if(who.every(h=>got[h])||Date.now()-t0>ms){clearInterval(iv);ok(got);}};
  const iv=setInterval(chk,250);chk();});}
async function resolveTurn(){if(M.resolving||!M.auth||M.auth.ended)return;M.resolving=true;M.away=new Set();M.bt=null;M.stBattle='';writeStatus(true);
  try{withAuth(()=>{
      for(const h of humans().slice().sort()){const r=M.rd[h];if(!r||r.turn!==S.turn||!alive(h))continue;
        try{for(const a of JSON.parse(r.acts||'[]'))try{doAct(h,a.k,a.args);}catch(e){console.warn('act',h,a,e);}
          const o=JSON.parse(r.orders||'{}');for(const id in o){const x=S.armies.find(y=>String(y.id)===String(id));if(x&&x.h===h)S.orders[x.id]=o[id];}}
        catch(e){console.warn('ready',h,e);}}
      S._live=h=>isHu(h)&&!M.away.has(h);S._watch=hs=>hs.some(h=>h&&isHu(h));});
    const g=withAuth(()=>endTurnG());let input;
    let st=null;
    for(;;){const r=withAuth(()=>g.next(input));input=undefined;
      // 陣形が決まった（人の家の選んだ陣形と、コンピューターの陣形）ことを知らせる
      if(st){const f={k:'forms',formA:st.formA,formD:st.formD};st=null;try{await hostEvent(f);}catch(e){console.warn(e);}}
      if(r.done)break;if(r.value.k==='start')st=r.value;
      try{input=await hostEvent(r.value);}catch(e){console.warn(e);}}
    withAuth(()=>{delete S._live;delete S._watch;S.resY=yearNow();nextTurn();});M.stBattle='';
    await writeState();}
  catch(e){console.error(e);toast('ターンの計算でエラーが起きた：'+errMsg(e),true,8000);}
  M.resolving=false;M.bt=null;if(!M.house)watchScreen();}
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
    <div class="row"><button class="btn" type="button" id="mpclose">部屋を閉じる</button><button class="btn" type="button" id="mpsave">ゲームを保存（ファイルに書き出す）</button>${v.ended?'':'<button class="btn pri" type="button" id="mpnow">今すぐ次のターンへ進める</button>'}</div>
    <p class="hint">ゲームは、ターンが進むたびにこの端末にも自動で保存される。授業で終わらなかったときは、次の時間に新しい部屋を作るときに「続きから」を選ぶ。</p></div>`;
  const tr=q$('#tickrun');if(tr)tr.innerHTML=`<span>石高：${v.rank.slice(0,5).map((r,i)=>`${i+1}位 ${esc(H[r.h].n)}（${r.k}万石）`).join('　')}</span>`+v.news.map(t=>`<span>${esc(t)}</span>`).join('');
  q$('#mpclose').onclick=closeRoom;q$('#mpsave').onclick=download;const nb=q$('#mpnow');if(nb)nb.onclick=()=>{if(confirm('命令を送っていない家は、その場にとどまる。進めますか？'))resolveTurn();};
  tickWatch();}
function tickWatch(){const e=q$('#mptm');if(!e||!M.auth)return;const d=M.auth.turnSec;if(M.resolving){e.textContent=M.stBattle?`合戦が行われている：${M.stBattle}`:'ターンを計算している…';return;}
  if(!d){e.textContent='時間の制限なし（全員がそろうと進む）';return;}const left=Math.max(0,Math.round(d-(Date.now()-M.t0)/1000));
  e.textContent=`のこり ${Math.floor(left/60)}:${String(left%60).padStart(2,'0')}`;}

/* =========================================================
   遊ぶ人の画面
   ========================================================= */
function enterGame(){M.inGame=true;UI.lobbyPick=null;if(S&&S.mode==='preview')S=null;
  sub(R('bt',M.house),s=>{if(s.exists())onBt(s.data());});
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
  if(newTurn){M.btq=[];M.btRun=(M.btRun||0)+1;M.btBusy=false;M.turn=d.turn;M.acts=[];M.ready=false;M.status=null;
    // 同じターンの途中で読みこみ直したときは、操作をもどす
    const sv=ssGet('gunyu_acts');if(sv){try{const v=JSON.parse(sv);if(v.code===M.code&&v.turn===d.turn){M.acts=v.acts||[];M.saveOrders=v.orders||{};M.ready=!!v.ready;}}catch(e){}}}
  rebuild(newTurn?(M.saveOrders||{}):null);M.saveOrders=null;
  if(first){startUI();if(S.ended){showEnd();return;}showEvent();return;}
  if(!newTurn){refresh();return;}
  stopTurnTimer();closeDlg();
  UI.sel=null;UI.mode=null;UI.reach=null;UI.replay=true;refresh();
  animateMoves(()=>playMine(myBattlesOf(S.lastBattles),()=>{if(S.ended)showEnd();else showResultDlg();}));}
const btKey=b=>[b.name,b.a,(b.attHs||[]).join(',')].join('|');
function onBt(d){if(!d||d.seq<=M.btLast||d.turn!==M.turn||Date.now()-d.t>90000)return;M.btLast=d.seq;
  let o;try{o=JSON.parse(d.s);}catch(e){return;}M.btq.push({seq:d.seq,...o});pumpBt();}
async function pumpBt(){if(M.btBusy)return;M.btBusy=true;const run=M.btRun=(M.btRun||0)+1;
  while(M.btq.length&&run===M.btRun){const x=M.btq.shift();try{await showBt(x);}catch(e){console.warn(e);}}
  if(run===M.btRun)M.btBusy=false;}
function btReply(seq,data){setDoc(R('btr',M.house),{uid:M.uid,seq,...data,at:serverTimestamp()}).catch(e=>console.warn(e));}
function showBt(x){return new Promise(done=>{const ev=x.ev;
  if(ev.k==='start'){stopTurnTimer();ev.meA=x.side==='A'&&x.chA===S.me;ev.meD=x.side==='D'&&x.chD===S.me;const choose=ev.meA||ev.meD;
    // 人が選ぶ側の陣形は、決まるまで出さない
    if(x.chA)ev.formA=null;if(x.chD)ev.formD=null;
    LB.open(ev,false,ch=>{if(choose)btReply(x.seq,{form:ch&&ch.form||null});done();});
    if(choose){const c=q$('#bvch');if(c&&c.style.display!=='none')c.insertAdjacentHTML('beforeend','<div class="hint bvchh">30秒のうちに選ぶ。選ばないと、自動で決まる。</div>');}
    else{const pn=q$('#bvpn');if(pn)pn.textContent='同じ側の家が陣形を選んでいる…';}}
  else if(ev.k==='round'){if(!LB.alive()){done();return;}LB.round(ev,c=>{if(LB.myS)btReply(x.seq,{retreat:!!(c&&c.retreat)});done();});}
  else if(ev.k==='retreat'){if(!LB.alive()){done();return;}LB.retreat(ev,()=>done());}
  else if(ev.k==='forms'){if(LB.alive()){const c=q$('#bvch');if(c)c.style.display='none';LB.ev.formA=ev.formA;LB.ev.formD=ev.formD;
      const a=q$('#bvfmA'),d=q$('#bvfmD');if(a)a.textContent='陣形：'+LB.fm('A',ev.formA);if(d)d.textContent='陣形：'+LB.fm('D',ev.formD);
      if(LB.F&&LB.F.setForms)LB.F.setForms(ev.formA,ev.formD);
      LB.log(`<b>陣形が決まった：${esc(LB.iA.name)}は${LB.fm('A',ev.formA)}、${esc(LB.iD.name)}は${LB.fm('D',ev.formD)}。</b>`,'ph');}
    done();}
  else if(ev.k==='end'){M.liveSeen.add(btKey(ev.rec));if(!LB.alive()){btReply(x.seq,{ack:1});done();return;}LB.end(ev.rec,()=>{btReply(x.seq,{ack:1});done();});}
  else done();});}
function playMine(list,done){list=list.filter(b=>!M.liveSeen.has(btKey(b)));M.liveSeen=new Set();let i=0;const next=()=>{const b=list[i++];if(!b){done();return;}playBattle(b,next);};next();}
// 親の状態＋自分の操作のやりなおし ＝ 自分の画面
function rebuild(orders){const keep=orders||(S&&S.mode==='multi'?S.orders:{})||{};
  S=clone(M.base);uid=M.baseUid;S.me=M.house;
  for(const a of M.acts)try{doAct(S.me,a.k,a.args);}catch(e){console.warn(e);}
  S.orders={};for(const id in keep){const x=S.armies.find(y=>String(y.id)===String(id));if(x&&x.h===S.me)S.orders[x.id]=keep[id];}}
function applyPatch(p){let o;try{o=JSON.parse(p);}catch(e){return;}if(!M.base||o.seq<=M.pseq)return;M.pseq=o.seq;
  Object.assign(M.base,{rel:o.rel,gold:o.gold,lord:o.lord,req:o.req});rebuild();if(q$('#map'))refresh();}
function saveLocal(){ssSet('gunyu_acts',JSON.stringify({code:M.code,turn:M.turn,acts:M.acts,orders:S&&S.orders||{},ready:M.ready}));}
function record(k,args){M.acts.push({k,args:clone(args)});saveLocal();}
async function ready(auto){if(M.ready||!S||S.ended||S.dead[S.me])return;if(typeof SFX!=='undefined')SFX.play('se_turn_end');M.ready=true;stopTurnTimer();
  const orders={};for(const id in S.orders){const x=S.armies.find(y=>String(y.id)===String(id));if(x&&x.h===S.me)orders[id]=S.orders[id];}
  try{await setDoc(R('ready',S.me),{uid:M.uid,turn:M.turn,acts:JSON.stringify(M.acts),orders:JSON.stringify(orders),at:serverTimestamp()});
    saveLocal();toast(auto?'時間切れ。ここまでの命令を送った':'命令を送った。ほかの家がそろうと、ターンが進む');}
  catch(e){M.ready=false;toast(errMsg(e),true);}
  if(q$('#map'))refresh();}
async function unready(){if(!M.ready)return;
  try{await setDoc(R('ready',S.me),{uid:M.uid,turn:-1,acts:'[]',orders:'{}',at:serverTimestamp()});M.ready=false;saveLocal();startTurnTimer();toast('命令をなおせる。なおしたら、もう一度「次のターンへ」を押す');}
  catch(e){toast(errMsg(e),true);}
  refresh();}
function waitTxt(){const st=M.status;if(!st||st.turn!==M.turn)return '';if(st.resolving)return st.battle?`。合戦が行われている：${st.battle}`:'。ターンを計算している…';return `（${st.ready.length}／${st.tot}）`;}
function leftSec(){return M.dur?Math.max(3,M.dur-(Date.now()-M.t0)/1000):0;}
function afterResult(){UI.replay=false;UI.area=null;if(S.ended){showEnd();return;}showEvent();}

/* ---------- 書状 ---------- */
async function letter(to,type,target,text){if(typeof SFX!=='undefined')SFX.play('se_letter_send');
  const tn=(LETTER_TYPES.find(x=>x.id===type)||{}).n||type;
  try{if(isHu(to)){const why=humanLetterWhy(S.me,to,type);if(why){alertMsg(`${hname(to)}へは送れない：${why}`);return;}
      const toUid=M.houses[to]&&M.houses[to].uid;if(!toUid){alertMsg(`${hname(to)}を動かす人が見つからない。`);return;}
      await addDoc(C('letters'),{from:M.uid,to:toUid,fromH:S.me,toH:to,fromNick:S.players[S.me]||M.nick,toNick:S.players[to]||'',type,target:target||null,text:text||null,ai:false,
        status:HU_NOASK.includes(type)?'auto':'pending',turn:M.turn,created:serverTimestamp()});
      toast(HU_NOASK.includes(type)?`${hname(to)}へ「${tn}」を送った`:`${hname(to)}（${S.players[to]}）へ書状を送った。返事を待っている…`,false,3500);}
    else{await addDoc(C('letters'),{from:M.uid,to:M.room.host,fromH:S.me,toH:to,fromNick:S.players[S.me]||M.nick,toNick:'',type,target:target||null,text:text||null,ai:true,status:'pending',turn:M.turn,created:serverTimestamp()});
      toast(`${hname(to)}へ書状を送った。返事を待っている…`,false,3000);}}
  catch(e){toast(errMsg(e),true);}}
function incoming(id,L){if(typeof SFX!=='undefined')SFX.play('se_letter_arrive');const tn=(LETTER_TYPES.find(x=>x.id===L.type)||{}).n||L.type;const tg=L.target&&A[L.target]?`（${A[L.target].n}）`:'';
  const det=(LETTER_TYPES.find(x=>x.id===L.type)||{}).d||'';
  openDlg(`<div class="rpw in"><div class="rpt">${esc(hname(L.fromH))}から書状が届いた<span class="who hu lg">${HU_SVG}${esc(L.fromNick)}</span></div>
    <div class="rpm"><span class="rpf" style="--hc:${H[L.fromH]?H[L.fromH].col:'#888'}">${face(L.fromH)}<i>${kamonHTML(L.fromH)}</i></span>
      <div class="rpq"><div class="rpq0">書状の中身</div><div class="rpq1">「${esc(tn+tg)}」</div>${L.text&&L.text!==tn?`<div class="rpq2">${esc(L.text)}</div>`:''}<div class="rpq0">${esc(det)}</div></div></div>
    <div class="row"><button class="btn" type="button" id="mpng">断る</button><button class="btn pri" type="button" id="mpok">承諾する</button></div></div>`,'rpbox',false);
  const ans=async st=>{document.querySelectorAll('#mpok,#mpng').forEach(b=>b.disabled=true);
    try{await updateDoc(R('letters',id),{status:st,answered:serverTimestamp()});closeDlg();toast(st==='ok'?'承諾の返事を送った':'断りの返事を送った');}
    catch(e){closeDlg();toast(errMsg(e),true);}};
  q$('#mpok').onclick=()=>ans('ok');q$('#mpng').onclick=()=>ans('ng');}

window.NET={open,save:saveLocal,download,isHost:()=>M.role==='host'&&!!M.auth,record,ready,unready,isReady:()=>M.ready,waitTxt,leftSec,afterResult,letter};
