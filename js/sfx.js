/* =========================================================
   群雄割拠　効果音
   音のファイルは snd/ に置く（mp3）。名前の最後に 2,3… がついたものは、同じ音のちがう版として順に使う。
   音の大きさは VOL で決める（0〜1）。右上の「音」ボタンで、入・切と大きさを変えられる。
   ========================================================= */
const SFX=(()=>{
  // 音ごとの大きさと、ちがう版の数
  const VOL={se_click:.35,se_select:.45,se_cancel:.4,se_card_pick:.5,se_card_drop:.55,se_march_order:.6,se_new_army:.7,se_policy:.7,
    se_turn_end:.7,se_armies_move:.35,se_new_year:.6,se_letter_send:.6,se_letter_arrive:.75,se_reply_ok:.75,se_reply_ng:.7,se_vassal:.75,
    se_battle_start:.75,se_form_select:.7,se_teppo_single:.3,se_teppo_volley:.6,se_arrow_volley:.45,se_arrow_hit:.25,se_spear_clash:.55,
    se_cavalry_charge:.6,se_melee_loop:.35,se_retreat:.65,se_general_killed:.8,se_rout:.6,se_castle_fall:.75,se_victory:.8,
    se_event_crisis:.75,se_ikki:.75,se_result:.6,se_rank_up:.7,se_clan_destroyed:.8};
  const VAR={se_teppo_single:['se_teppo_single','se_teppo_single2','se_teppo_single3','se_teppo_single4','se_teppo_single5'],
    se_arrow_hit:['se_arrow_hit1','se_arrow_hit2','se_arrow_hit3','se_arrow_hit4','se_arrow_hit5','se_arrow_hit6'],
    se_arrow_volley:['se_arrow_volley','se_arrow_volley2'],se_melee_loop:['se_melee_loop1','se_melee_loop2'],se_armies_move:['se_armies_move','se_armies_move2']};
  // 同じ音を続けて鳴らすときの間（ミリ秒）
  const GAP={se_teppo_single:55,se_arrow_hit:70,se_teppo_volley:1400,se_arrow_volley:1600,se_click:40,se_select:60};
  const ls=k=>{try{return localStorage.getItem(k);}catch(e){return null;}};const lss=(k,v)=>{try{localStorage.setItem(k,v);}catch(e){}};
  let ctx=null,master=null,on=ls('gunyu_snd')!=='0',level=+(ls('gunyu_sndv')||'0.8');
  const buf={},loading={},last={};
  const base=()=>(window.GUNYU_BASE||'')+'snd/';
  function unlock(){if(ctx)return;try{ctx=new (window.AudioContext||window.webkitAudioContext)();master=ctx.createGain();master.gain.value=on?level:0;master.connect(ctx.destination);}catch(e){ctx=null;return;}
    // よく使う音を先に読んでおく
    ['se_click','se_select','se_cancel','se_turn_end','se_battle_start','se_teppo_single','se_teppo_single2','se_teppo_single3','se_arrow_hit1','se_arrow_hit2'].forEach(load);
    setTimeout(()=>{for(const k in VOL)(VAR[k]||[k]).forEach(load);},2500);}
  function load(n){if(buf[n]||loading[n]||!ctx)return loading[n];
    loading[n]=fetch(base()+n+'.mp3').then(r=>r.ok?r.arrayBuffer():Promise.reject(r.status)).then(a=>new Promise((ok,ng)=>ctx.decodeAudioData(a,ok,ng))).then(b=>{buf[n]=b;return b;}).catch(e=>{console.warn('sound',n,e);});
    return loading[n];}
  function pick(k){const v=VAR[k];if(!v)return k;return v[Math.floor(Math.random()*v.length)];}
  function play(k,o){o=o||{};if(!on||!ctx)return null;const now=performance.now();const g=GAP[k];if(g&&now-(last[k]||0)<g)return null;last[k]=now;
    const n=pick(k);const b=buf[n];if(!b){load(n);return null;}
    try{const s=ctx.createBufferSource();s.buffer=b;if(o.rate)s.playbackRate.value=o.rate;else if(VAR[k])s.playbackRate.value=0.94+Math.random()*0.12;
      const gn=ctx.createGain();gn.gain.value=(VOL[k]??.6)*(o.v??1);s.connect(gn);gn.connect(master);s.loop=!!o.loop;s.start(ctx.currentTime+(o.delay||0));
      return {stop(f){try{if(f){gn.gain.setTargetAtTime(0,ctx.currentTime,f/3);s.stop(ctx.currentTime+f);}else s.stop();}catch(e){}}};}catch(e){return null;}}
  let loopNow=null;
  function loop(k){stopLoop();loopNow=play(k,{loop:true});}
  function stopLoop(f){if(loopNow){loopNow.stop(f??.4);loopNow=null;}}
  function set(o){if('on' in o){on=o.on;lss('gunyu_snd',on?'1':'0');}if('level' in o){level=o.level;lss('gunyu_sndv',String(level));}
    if(master)master.gain.value=on?level:0;if(!on)stopLoop(0);btn();if(typeof MUSIC!=='undefined')MUSIC.vol();}
  // 右上の「音」ボタン
  function btn(){let b=document.getElementById('sndBtn');
    if(!b){b=document.createElement('button');b.id='sndBtn';b.type='button';b.title='効果音の入・切と大きさ';document.body.appendChild(b);
      b.onclick=e=>{e.stopPropagation();unlock();const lv=[0,.4,.8,1];if(!on){set({on:true,level:.4});return;}const i=lv.indexOf(level);if(i>=lv.length-1)set({on:false});else set({level:lv[i+1]});};}
    b.innerHTML=`<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M4 9h4l5-4v14l-5-4H4z"/>${on?`<path d="M16 9c1 .9 1.5 1.9 1.5 3s-.5 2.1-1.5 3" stroke="currentColor" stroke-width="1.8" fill="none"/>${level>.5?'<path d="M18.5 6.5c1.7 1.5 2.5 3.4 2.5 5.5s-.8 4-2.5 5.5" stroke="currentColor" stroke-width="1.8" fill="none"/>':''}`:'<path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="1.8"/>'}</svg><span>${on?['','小','中','大'][[0,.4,.8,1].indexOf(level)]||'':'切'}</span>`;}
  // ボタンを押したときの音（もどる・とじる などは別の音）
  addEventListener('pointerdown',()=>unlock(),{capture:true});
  addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('button,.btn,.hgc,.dktab');if(!b||b.id==='sndBtn'||b.disabled)return;
    const t=(b.textContent||'').trim();
    if(/^(もどる|とじる|閉じる|やめる|キャンセル)/.test(t))play('se_cancel');else if(!b.classList.contains('bvcb')&&!b.classList.contains('ego'))play('se_click');},{capture:true});
  setTimeout(btn,0);
  return {play,loop,stopLoop,set,unlock,isOn:()=>on,level:()=>level};
})();

/* ---------- 音楽：場面ごとに曲を切りかえる（前の曲は静かに消す） ---------- */
const MUSIC=(()=>{let cur=null,el=null,want=null,started=false;
  const base=()=>(window.GUNYU_BASE||'')+'bgm/';
  const v=()=>SFX.isOn()?SFX.level()*(typeof BGM_VOL==='number'?BGM_VOL:.55):0;
  function fade(a,to,ms,done){const from=a.volume;const t0=performance.now();const step=()=>{const k=Math.min(1,(performance.now()-t0)/ms);a.volume=Math.max(0,Math.min(1,from+(to-from)*k));if(k<1)requestAnimationFrame(step);else done&&done();};step();}
  function scene(n){want=n;if(!started)return;if(n===cur)return;const B=typeof BGM!=='undefined'&&BGM[n];
    if(el){const old=el;fade(old,0,1200,()=>{old.pause();old.src='';});el=null;}cur=n;if(!B)return;
    const a=new Audio(base()+B.f+'.mp3');a.loop=!!B.loop;a.volume=0;a.preload='auto';el=a;
    a.onended=()=>{if(el===a&&!B.loop){cur=null;if(n==='crisis')scene('map');}};
    a.play().then(()=>fade(a,v(),1600)).catch(()=>{});}
  function vol(){if(el)el.volume=v();}
  // ブラウザは、画面にさわるまで音を出さない。さわったら、そのときの場面の曲を流す
  addEventListener('pointerdown',()=>{if(started)return;started=true;if(want)scene(want);},{capture:true});
  return {scene,vol,now:()=>cur};})();

/* ---------- ゲームの場面に音をつける ---------- */
(function(){
  const wrap=(name,before,after)=>{const o=window[name];if(typeof o!=='function')return;window[name]=function(...a){try{before&&before(...a);}catch(e){}const r=o.apply(this,a);try{after&&after(r,...a);}catch(e){}return r;};};
  const P=k=>SFX.play(k);const M=n=>MUSIC.scene(n);
  wrap('titleScreen',()=>M('title'));
  wrap('startUI',()=>M('map'));
  wrap('setTab',null,()=>M(UI.tab==='dip'?'diplomacy':'map'));
  if(document.getElementById('nick'))M('title');
  wrap('selArmy',()=>P('se_select'));
  wrap('makeArmy',null,()=>P('se_new_army'));
  wrap('doNewArmy',null,()=>P('se_new_army'));
  wrap('doRecruit',()=>P('se_card_drop'));
  wrap('doPolicy',null,()=>P('se_policy'));
  wrap('jorakuGo',null,()=>P('se_policy'));
  wrap('doResolve',()=>P('se_turn_end'));
  wrap('animateMoves',()=>{if(S&&S.lastOrders&&Object.keys(S.lastOrders).length)P('se_armies_move');});
  wrap('showEvent',()=>{P('se_new_year');M(UI.tab==='dip'?'diplomacy':'map');const ev=(S&&S.events||[]).filter(e=>e.h===S.me).map(e=>e.t).join(' ');
    if(/一揆/.test(ev)){setTimeout(()=>P('se_ikki'),900);M('crisis');}else if(/本能寺|亡くなった|謀反|裏切/.test(ev)){setTimeout(()=>P('se_event_crisis'),900);M('crisis');}});
  wrap('showResultDlg',()=>{P('se_result');M('result');try{const hs=Object.keys(H).filter(alive);const order=hs.sort((a,b)=>kokuOf(b)-kokuOf(a));const off=S.mode==='multi'?2:1;
    const pv=h=>{const a=S.hist[h]||[];return a.length>=off?a[a.length-off]:0;};const po=Object.keys(H).filter(h=>pv(h)>0).sort((a,b)=>pv(b)-pv(a));
    if(po.indexOf(S.me)>order.indexOf(S.me))setTimeout(()=>P('se_rank_up'),700);}catch(e){}});
  wrap('showEnd',()=>{const lost=S&&S.dead&&S.dead[S.me]||(S&&S.unifier&&S.unifier!==S.me);if(lost)P('se_clan_destroyed');else P('se_victory');M(lost?'lose':'win');});
  wrap('replyDlg',(to,type,L)=>{const ok=L&&L.ok;P(ok&&(type==='kudaru'||type==='kosan')?'se_vassal':ok?'se_reply_ok':'se_reply_ng');});
  wrap('doLetter',()=>P('se_letter_send'));
  wrap('answerInbox',(i,yes)=>{const m=S.inbox[i];P(yes&&m&&m.type==='kashin'?'se_vassal':yes?'se_reply_ok':'se_cancel');});
  // 行き先を決めたとき
  const og=window.guardOrder;if(og)window.guardOrder=function(ar,path,go){return og.call(this,ar,path,(...a)=>{P('se_march_order');return go(...a);});};
  // 合戦
  if(typeof LB!=='undefined'){const oo=LB.open;LB.open=function(ev,auto,cb){P('se_battle_start');M(ev&&ev.field?'battle':'siege');return oo.call(this,ev,auto,cb?(ch=>{if(ch&&ch.form)P('se_form_select');cb(ch);}):cb);};
    const oe=LB.end;LB.end=function(b,cb){SFX.stopLoop(.6);try{const me=S&&S.me;const won=b&&b.r&&((b.r.win==='att'&&(b.attHs||[]).includes(me))||(b.r.win==='def'&&((b.defHs||[]).includes(me)||b.def===me)));
      const fell=b&&b.r&&b.r.win==='att'&&!b.field;if(fell)P('se_castle_fall');setTimeout(()=>P(won?'se_victory':'se_rout'),fell?900:0);}catch(e){}return oe.call(this,b,cb);};
    const ort=LB.retreat;LB.retreat=function(ev,cb){P('se_retreat');SFX.stopLoop(.8);return ort.call(this,ev,cb);};}
})();
