/* =========================================================
   群雄割拠　合戦の演出（PixiJS）
   合戦の絵の上に、すきとおった演出の層を重ねる。鉄砲の発火・硝煙・着弾、矢の着地の土ぼこり、打ち合いの火花など。
   PixiJS を読みこめない端末では、これまでの描き方のまま動く（BFX.attach が null を返す）。
   ========================================================= */
(function(){
  const PIXI_URL='https://cdn.jsdelivr.net/npm/pixi.js@7.4.2/dist/pixi.min.js';
  let loading=null;
  function load(){if(window.PIXI)return Promise.resolve(true);if(loading)return loading;
    loading=new Promise(ok=>{const s=document.createElement('script');s.src=PIXI_URL;s.crossOrigin='anonymous';s.onload=()=>ok(!!window.PIXI);s.onerror=()=>ok(false);document.head.appendChild(s);});
    return loading;}
  const MAXP=700;   // 粒の数の上限（重くならないように）
  let TX=null;
  function textures(){if(TX)return TX;const mk=(sz,fn)=>{const c=document.createElement('canvas');c.width=c.height=sz;fn(c.getContext('2d'),sz);return PIXI.Texture.from(c);};
    TX={
      soft:mk(64,(g,s)=>{const r=g.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(.45,'rgba(255,255,255,.55)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,s,s);}),
      smoke:mk(96,(g,s)=>{for(let i=0;i<7;i++){const x=s/2+(Math.random()-.5)*s*.34,y=s/2+(Math.random()-.5)*s*.34,rr=s*(.22+Math.random()*.16);const r=g.createRadialGradient(x,y,0,x,y,rr);r.addColorStop(0,'rgba(255,255,255,.55)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,s,s);}}),
      flash:mk(64,(g,s)=>{const c=s/2;const r=g.createRadialGradient(c,c,0,c,c,c);r.addColorStop(0,'rgba(255,255,240,1)');r.addColorStop(.25,'rgba(255,220,120,.95)');r.addColorStop(.6,'rgba(255,140,40,.35)');r.addColorStop(1,'rgba(255,100,0,0)');g.fillStyle=r;g.fillRect(0,0,s,s);
        g.strokeStyle='rgba(255,250,220,.9)';g.lineWidth=2;for(let a=0;a<6;a++){const an=a*Math.PI/3+.3;g.beginPath();g.moveTo(c,c);g.lineTo(c+Math.cos(an)*c*.95,c+Math.sin(an)*c*.95);g.stroke();}}),
      spark:mk(16,(g,s)=>{const r=g.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,s,s);})};
    return TX;}
  function attach(cv){
    const wrap=cv.parentElement;if(!wrap)return null;
    const fx={ready:false,q:[],ps:[],app:null,shakeA:0,
      gun(...a){this.ready?gun(...a):this.q.length<40&&this.q.push(['gun',a]);},
      dust(...a){if(this.ready)dust(...a);},
      sparks(...a){if(this.ready)sparks(...a);},
      blast(...a){if(this.ready)blast(...a);},
      shake(a){this.shakeA=Math.max(this.shakeA,a);},
      destroy(){this.dead=true;if(this.app){try{this.app.destroy(true,{children:true});}catch(e){}}wrap.style.transform='';}};
    load().then(ok=>{if(!ok||fx.dead||!cv.isConnected)return;
      try{
        const app=new PIXI.Application({width:cv.width,height:cv.height,backgroundAlpha:0,antialias:false,resolution:Math.min(2,window.devicePixelRatio||1),autoDensity:false});
        const v=app.view;v.className='bvfx';v.style.cssText='position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:1';
        wrap.insertBefore(v,cv.nextSibling);
        fx.app=app;textures();
        fx.smokeL=new PIXI.Container();fx.addL=new PIXI.Container();
        app.stage.addChild(fx.smokeL,fx.addL);
        app.ticker.add(()=>tick(app.ticker.deltaMS/1000));
        fx.ready=true;for(const [k,a] of fx.q.splice(0))fx[k](...a);
      }catch(e){console.warn('PixiJS',e);}});
    // 粒：sprite, 速さ, 寿命, 大きさ・濃さの変わり方
    function add(L,tex,x,y,o){if(fx.ps.length>=MAXP)return null;const s=new PIXI.Sprite(tex);s.anchor.set(.5);s.x=x;s.y=y;s.tint=o.tint??0xffffff;s.blendMode=o.add?PIXI.BLEND_MODES.ADD:PIXI.BLEND_MODES.NORMAL;
      s.rotation=Math.random()*Math.PI*2;L.addChild(s);const p={s,vx:o.vx||0,vy:o.vy||0,g:o.g||0,dr:o.dr||0,t:0,life:o.life,s0:o.s0,s1:o.s1,a0:o.a0??1,a1:o.a1??0,drag:o.drag??0,delay:o.delay||0};
      s.visible=!p.delay;s.scale.set(p.s0);s.alpha=p.a0;fx.ps.push(p);return p;}
    function tick(dt){const ps=fx.ps;for(let i=ps.length-1;i>=0;i--){const p=ps[i];
        if(p.delay>0){p.delay-=dt;if(p.delay>0)continue;p.s.visible=true;}
        p.t+=dt;const q=p.t/p.life;if(q>=1){p.s.destroy();ps.splice(i,1);continue;}
        p.vx*=1-p.drag*dt;p.vy=p.vy*(1-p.drag*dt)+p.g*dt;p.s.x+=p.vx*dt;p.s.y+=p.vy*dt;p.s.rotation+=p.dr*dt;
        const e=1-(1-q)*(1-q);p.s.scale.set(p.s0+(p.s1-p.s0)*e);p.s.alpha=p.a0+(p.a1-p.a0)*q;}
      // 画面のゆれ（鉄砲の一斉射撃のとき）
      if(fx.shakeA>0.05){wrap.style.transform=`translate(${(Math.random()-.5)*fx.shakeA}px,${(Math.random()-.5)*fx.shakeA}px)`;fx.shakeA*=Math.pow(0.02,dt);}
      else if(fx.shakeA){fx.shakeA=0;wrap.style.transform='';}}
    const R=(a,b)=>a+Math.random()*(b-a);
    // 鉄砲：銃口の火、硝煙（白い煙が流れて残る）、着弾の土ぼこりと火花
    function gun(x0,y0,x1,y1){const dir=x1>=x0?1:-1;const mx=x0+dir*12,my=y0-2;
      add(fx.addL,TX.flash,mx,my,{add:true,tint:0xffe6a8,life:.11,s0:.18,s1:.62,a0:1,a1:0});
      add(fx.addL,TX.soft,mx+dir*6,my,{add:true,tint:0xffffff,life:.07,s0:.25,s1:.12,a0:1,a1:0});
      for(let k=0;k<3;k++)add(fx.smokeL,TX.smoke,mx+dir*R(2,10),my+R(-3,3),{tint:k?0xdcd7cc:0xebe6dc,life:R(1.8,3.2),s0:R(.12,.2),s1:R(.6,1.05),a0:R(.3,.48),a1:0,vx:dir*R(8,26)+R(-4,4),vy:R(-16,-5),drag:.6,dr:R(-.5,.5),delay:k*.03});
      const tt=Math.hypot(x1-x0,y1-y0)/1400;   // 弾が届くまで
      for(let k=0;k<2;k++)add(fx.smokeL,TX.smoke,x1+R(-5,5),y1+R(0,4),{tint:0x8a7050,life:R(.5,.9),s0:.08,s1:R(.28,.42),a0:.55,a1:0,vy:R(-18,-6),vx:R(-8,8),drag:1.5,delay:tt});
      for(let k=0;k<4;k++){const an=R(0,Math.PI*2),sp=R(40,120);add(fx.addL,TX.spark,x1,y1,{add:true,tint:0xffb347,life:R(.18,.32),s0:.5,s1:.15,a0:1,a1:0,vx:Math.cos(an)*sp,vy:Math.sin(an)*sp-40,g:260,delay:tt});}}
    // 矢が地面に落ちたときの土ぼこり
    function dust(x,y){add(fx.smokeL,TX.smoke,x+R(-3,3),y+R(0,3),{tint:0x9a7c55,life:R(.4,.7),s0:.05,s1:R(.18,.28),a0:.5,a1:0,vy:R(-10,-3),drag:1.5});}
    // 打ち合いの火花
    function sparks(x,y,n){n=n||6;for(let k=0;k<n;k++){const an=R(0,Math.PI*2),sp=R(60,170);add(fx.addL,TX.spark,x,y,{add:true,tint:k%2?0xffd27a:0xff8a3a,life:R(.2,.4),s0:R(.45,.75),s1:.1,a0:1,a1:0,vx:Math.cos(an)*sp,vy:Math.sin(an)*sp-50,g:320});}
      add(fx.addL,TX.soft,x,y,{add:true,tint:0xffcf7a,life:.12,s0:.2,s1:.5,a0:.8,a1:0});}
    // 大きな土けむり（総大将が討たれた・敗走など）
    function blast(x,y){add(fx.addL,TX.flash,x,y,{add:true,tint:0xffc070,life:.25,s0:.4,s1:1.6,a0:.9,a1:0});
      for(let k=0;k<12;k++){const an=R(0,Math.PI*2),sp=R(20,70);add(fx.smokeL,TX.smoke,x,y,{tint:k%3?0x6e5a44:0xb8a88c,life:R(1,1.8),s0:.15,s1:R(.6,1),a0:.6,a1:0,vx:Math.cos(an)*sp,vy:Math.sin(an)*sp*.5-15,drag:1.2});}
      fx.shake(7);}
    return fx;}
  window.BFX={attach,load};
  // 合戦のときにすぐ使えるよう、少しあとで読みこんでおく
  setTimeout(load,4000);
})();
