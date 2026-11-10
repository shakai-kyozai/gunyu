/* =========================================================
   群雄割拠　立体の地図（three.js）
   標高：国土地理院の標高タイル（高さは8倍に強調）
   ========================================================= */
import * as THREE from 'three';
import {MapControls} from 'three/addons/controls/MapControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const X0=MAP_BG.x,Y0=MAP_BG.y,MW=MAP_BG.w,MH=MAP_BG.h;
const KM=1.249,EX=8,HS=4/KM*EX;      // 色の値1.0（4000m）の高さ
const OS=2;                           // 色をぬる画像：1単位あたりの画素
const SEG_X=512;
const PIECE_H=15;
// 引きにしたとき：軍勢の駒・札・矢印・にらみの範囲を、ARMY_FADE[0]から小さくうすくし、ARMY_FADE[1]で消す（カメラのきょり）
const ARMY_FADE=[400,540];
const toW=(x,y)=>[x-X0-MW/2,y-Y0-MH/2];
const toG=(wx,wz)=>[wx+X0+MW/2,wz+Y0+MH/2];
let R=null,host=null,running=false;

/* ---------- 高さ ---------- */
function hAt(u,v){
  const w=R.hw,h=R.hh,HD=R.HD;
  u=Math.min(1,Math.max(0,u));v=Math.min(1,Math.max(0,v));
  const x=u*(w-1),y=v*(h-1);const x0=Math.floor(x),y0=Math.floor(y),x1=Math.min(x0+1,w-1),y1=Math.min(y0+1,h-1);
  const fx=x-x0,fy=y-y0;const g=(a,b)=>{const i=(b*w+a)*4;return (HD[i]*256+HD[i+1])/65535;};
  return g(x0,y0)*(1-fx)*(1-fy)+g(x1,y0)*fx*(1-fy)+g(x0,y1)*(1-fx)*fy+g(x1,y1)*fx*fy;
}
const hRaw=(x,y)=>hAt((x-X0)/MW,(y-Y0)/MH)*HS;
// 建物と駒を置く所だけ、地面を平らにならす（まん中は平ら、まわりはなだらかに元の地形へもどす）
// r0：平らにする半径、r1：元の地形にもどるまでの半径（どちらも地図の単位）
const FLAT_BLD=0.8,FLAT_BLD_OUT=1.9,FLAT_PAD=[6,13];
function buildFlat(){const L=[];
  const site=(x,y,r0,r1)=>{// 平らにする高さ：平らな所の中の陸の高さの平均
    let s=0,n=0;for(let i=0;i<24;i++){const t=i/24*Math.PI*2;for(const k of [0,0.5,1]){const h=hRaw(x+Math.cos(t)*r0*k,y+Math.sin(t)*r0*k);if(h>0.05){s+=h;n++;}}}
    if(!n)return;L.push({x,y,r0,r1,h:s/n});};
  for(const a of AREAS){const k=propOf(a);const fp=k&&VIEW3D.props&&VIEW3D.props[k]?VIEW3D.props[k].fp:8;
    site(a.c[0],a.c[1],fp*FLAT_BLD,fp*FLAT_BLD_OUT);
    // 軍勢が立つ街道の上も、小さくならす
    const R=landRoads(a.id);if(!R.length)site(a.c[0],a.c[1]+13,FLAT_PAD[0],FLAT_PAD[1]);
    for(const b of R)for(let k=0;k<3;k++){const q=standPt(a.id,b,k);site(q[0],q[1],FLAT_PAD[0],FLAT_PAD[1]);}}
  // 探しやすいように升目に分ける
  const G=40,grid={};for(const f of L){const x0=Math.floor((f.x-f.r1)/G),x1=Math.floor((f.x+f.r1)/G),y0=Math.floor((f.y-f.r1)/G),y1=Math.floor((f.y+f.r1)/G);
    for(let i=x0;i<=x1;i++)for(let j=y0;j<=y1;j++)(grid[i+','+j]=grid[i+','+j]||[]).push(f);}
  R.flat={G,grid};}
function hFlat(x,y,h){if(!R.flat||h<=0.05)return h;const L=R.flat.grid[Math.floor(x/R.flat.G)+','+Math.floor(y/R.flat.G)];if(!L)return h;
  for(const f of L){const d=Math.hypot(x-f.x,y-f.y);if(d>=f.r1)continue;let w=d<=f.r0?1:1-(d-f.r0)/(f.r1-f.r0);w=w*w*(3-2*w);h=h+(f.h-h)*w;}
  return h;}
const hGame=(x,y)=>hFlat(x,y,hRaw(x,y));
const loadImg=src=>new Promise((ok,ng)=>{const i=new Image();i.crossOrigin='anonymous';i.onload=()=>ok(i);i.onerror=ng;i.src=src;});

/* ---------- 準備 ---------- */
async function init(){
  const canvas=document.createElement('canvas');canvas.className='v3c';
  let renderer;
  try{renderer=new THREE.WebGLRenderer({canvas,antialias:true});}catch(e){return false;}
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x172842);
  const camera=new THREE.PerspectiveCamera(38,1,2,6000);
  const controls=new MapControls(camera,canvas);
  controls.addEventListener('change',()=>{if(R)R.lastAct=performance.now();});
  for(const ev of ['pointerdown','pointermove','wheel'])canvas.addEventListener(ev,()=>{if(R)R.lastAct=performance.now();},{passive:true});
  controls.enableDamping=true;controls.dampingFactor=0.12;controls.maxPolarAngle=1.22;controls.minDistance=70;controls.maxDistance=2600;
  controls.zoomSpeed=1.2;controls.screenSpacePanning=false;
  scene.add(new THREE.HemisphereLight(0xffffff,0x40506a,1.6));
  const sun=new THREE.DirectionalLight(0xfff2dc,2.1);sun.position.set(-500,800,450);scene.add(sun);
  // 駒と建物は別の場面に置き、地形・道・線のあとで描く（道や矢印の色が上にのらないように）
  const scene2=new THREE.Scene();scene2.add(new THREE.HemisphereLight(0xffffff,0x40506a,1.6));{const s2=sun.clone();scene2.add(s2);}

  let hImg,tex,mdl;
  const parseB64=async t=>{const bytes=Uint8Array.from(atob(t.trim()),c=>c.charCodeAt(0));return (await new GLTFLoader().parseAsync(bytes.buffer,'')).scene;};
  const loadModel=k=>fetch(VIEW3D.models[k].src).then(r=>{if(!r.ok)throw new Error(r.status);return r.text();}).then(parseB64).then(sc=>[k,sc]).catch(e=>{console.warn('model',k,e);return [k,null];});
  try{[hImg,tex,mdl]=await Promise.all([loadImg(VIEW3D.h),new THREE.TextureLoader().loadAsync(VIEW3D.tex),Promise.all(Object.keys(VIEW3D.models).map(loadModel))]);}
  catch(e){console.error(e);return false;}
  tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  const hc=document.createElement('canvas');hc.width=hImg.width;hc.height=hImg.height;
  const hx=hc.getContext('2d');hx.drawImage(hImg,0,0);
  R={canvas,renderer,scene,scene2,camera,controls,HD:hx.getImageData(0,0,hc.width,hc.height).data,hw:hc.width,hh:hc.height};

  // 色をぬる画像（勢力の色・境目・街道・選んだ地域）
  const oc=document.createElement('canvas');oc.width=Math.round(MW*OS);oc.height=Math.round(MH*OS);
  const ovTex=new THREE.CanvasTexture(oc);ovTex.colorSpace=THREE.NoColorSpace;ovTex.anisotropy=tex.anisotropy;
  R.oc=oc;R.ovTex=ovTex;
  // 光る層（ブルーム風）：境目の近くを家の色でぼんやり光らせる。陰影の影響を受けずに明るく見える
  const GS=OS*0.5;const gc=document.createElement('canvas');gc.width=Math.round(MW*GS);gc.height=Math.round(MH*GS);
  const glowTex=new THREE.CanvasTexture(gc);glowTex.colorSpace=THREE.SRGBColorSpace;R.gc=gc;R.GS=GS;R.glowTex=glowTex;R.glowAmt={value:0.55};

  // 地形
  const SEG_Y=Math.round(SEG_X*MH/MW);
  const geo=new THREE.PlaneGeometry(MW,MH,SEG_X,SEG_Y);geo.rotateX(-Math.PI/2);
  const pos=geo.attributes.position,uv=geo.attributes.uv;
  buildFlat();
  for(let i=0;i<pos.count;i++){const u=uv.getX(i),v=1-uv.getY(i);pos.setY(i,hFlat(X0+u*MW,Y0+v*MH,hAt(u,v)*HS));}
  geo.computeVertexNormals();
  const mat=new THREE.MeshLambertMaterial({map:tex});
  const detTex=detailTex();R.detTex=detTex;
  // 近づいた区画の高精細の地面（4枚まで）
  R.hi=[0,1,2,3].map(()=>({tex:null,key:null,rect:new THREE.Vector4(0,0,0,0),mix:{value:0},want:0}));
  const blank=new THREE.DataTexture(new Uint8Array([0,0,0,255]),1,1);blank.needsUpdate=true;
  mat.onBeforeCompile=sh=>{sh.uniforms.ovMap={value:ovTex};sh.uniforms.detMap={value:detTex};sh.uniforms.glowMap={value:glowTex};sh.uniforms.glowAmt=R.glowAmt;
    sh.fragmentShader=sh.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n{vec4 gw=texture2D(glowMap,vMapUv);totalEmissiveRadiance+=gw.rgb*gw.a*glowAmt;}');
    R.hi.forEach((h,i)=>{sh.uniforms['hi'+i]={value:h.tex||blank};sh.uniforms['hr'+i]={value:h.rect};sh.uniforms['hm'+i]=h.mix;h.u=sh.uniforms['hi'+i];});
    sh.fragmentShader=sh.fragmentShader.replace('#include <map_pars_fragment>','#include <map_pars_fragment>\nuniform sampler2D ovMap;uniform sampler2D detMap;uniform sampler2D glowMap;uniform float glowAmt;uniform sampler2D hi0,hi1,hi2,hi3;uniform vec4 hr0,hr1,hr2,hr3;uniform float hm0,hm1,hm2,hm3;')
      .replace('#include <map_fragment>',`#include <map_fragment>
 float hiA=0.0;
 {vec2 tt=(vMapUv-hr0.xy)/hr0.zw;if(hm0>0.0&&tt.x>=0.0&&tt.x<=1.0&&tt.y>=0.0&&tt.y<=1.0){diffuseColor.rgb=mix(diffuseColor.rgb,texture2D(hi0,tt).rgb,hm0);hiA=max(hiA,hm0);}}
 {vec2 tt=(vMapUv-hr1.xy)/hr1.zw;if(hm1>0.0&&tt.x>=0.0&&tt.x<=1.0&&tt.y>=0.0&&tt.y<=1.0){diffuseColor.rgb=mix(diffuseColor.rgb,texture2D(hi1,tt).rgb,hm1);hiA=max(hiA,hm1);}}
 {vec2 tt=(vMapUv-hr2.xy)/hr2.zw;if(hm2>0.0&&tt.x>=0.0&&tt.x<=1.0&&tt.y>=0.0&&tt.y<=1.0){diffuseColor.rgb=mix(diffuseColor.rgb,texture2D(hi2,tt).rgb,hm2);hiA=max(hiA,hm2);}}
 {vec2 tt=(vMapUv-hr3.xy)/hr3.zw;if(hm3>0.0&&tt.x>=0.0&&tt.x<=1.0&&tt.y>=0.0&&tt.y<=1.0){diffuseColor.rgb=mix(diffuseColor.rgb,texture2D(hi3,tt).rgb,hm3);hiA=max(hiA,hm3);}}
{vec3 b0=pow(max(diffuseColor.rgb,vec3(0.0)),vec3(1.0/2.2));float L=dot(b0,vec3(0.299,0.587,0.114));
 // 細かな模様：森のこずえ・野原の色むら・田畑のまだら（近づいたときに見える）
 vec3 dA=texture2D(detMap,vMapUv*vec2(10.0,9.31)).rgb;vec3 dB=texture2D(detMap,vMapUv*vec2(40.0,37.2)).rgb;
 float water=smoothstep(0.02,0.07,b0.b-b0.g);float green=smoothstep(0.0,0.10,b0.g-b0.r);float low=smoothstep(0.30,0.42,L);
 float f=(0.9+0.2*dA.r)*mix(1.0,0.72+0.5*dB.g,green*0.8);
 vec3 fld=(vec3(dA.b,dB.b,dA.g)-0.5)*vec3(0.10,0.08,0.03)*low;
 b0=mix(b0*mix(f,1.0,hiA*0.85)+fld*(1.0-hiA),b0,water);
 // 家の色：地形の明るさと細かさをのこしたまま、色だけをのせる
 vec4 ov=texture2D(ovMap,vMapUv);float Lo=max(dot(ov.rgb,vec3(0.299,0.587,0.114)),0.12);
 vec3 t=clamp(ov.rgb*(L/Lo)*1.08,0.0,1.0);
 diffuseColor.rgb=pow(mix(b0,t,ov.a),vec3(2.2));}`);};
  const land=new THREE.Mesh(geo,mat);scene.add(land);R.land=land;
  const seaFar=new THREE.Mesh(new THREE.PlaneGeometry(9000,9000),new THREE.MeshBasicMaterial({color:0x172842}));seaFar.rotateX(-Math.PI/2);seaFar.position.y=-0.5;scene.add(seaFar);

  // 地域の形（クリックの判定と色ぬり）
  R.path={};R.bb={};R.pctx=document.createElement('canvas').getContext('2d');
  for(const a of AREAS){R.path[a.id]=new Path2D(a.d);
    let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(const m of a.d.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)){const x=+m[1],y=+m[2];if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}
    R.bb[a.id]=[x0,y0,x1,y1];
    R.hc=R.hc||{};R.hc[a.id]=hGame(a.c[0],a.c[1]);}

  // 兵科ごとの駒（足軽・騎馬・弓・鉄砲・当主）
  R.models={};
  for(const [k,base] of mdl){if(!base)continue;
    base.traverse(o=>{if(o.isLight)o.visible=false;if(o.isMesh){if(!o.geometry.attributes.normal)o.geometry.computeVertexNormals();const m=o.material;if(m.map)m.map.colorSpace=THREE.SRGBColorSpace;o.material=new THREE.MeshLambertMaterial({map:m.map,color:m.map?0xffffff:(m.color||0xffffff)});}});
    const inner=new THREE.Group();inner.add(base);inner.rotation.y=VIEW3D.models[k].yaw||0;
    {const b=new THREE.Box3().setFromObject(inner);const c=b.getCenter(new THREE.Vector3());base.position.sub(new THREE.Vector3(c.x,b.min.y,c.z));}
    const h=new THREE.Box3().setFromObject(inner).getSize(new THREE.Vector3()).y;
    R.models[k]={obj:inner,h,cfg:VIEW3D.models[k]};}
  if(!Object.keys(R.models).length)return false;
  try{R.kamonImg=await loadImg(KAMON.src);}catch(e){R.kamonImg=null;}
  R.mats={};R.geoDisc=new THREE.CylinderGeometry(6,6.6,1.3,28);R.geoPole=new THREE.CylinderGeometry(0.22,0.22,14,6);
  R.geoFlag=new THREE.PlaneGeometry(4,7);R.geoHit=new THREE.BoxGeometry(14,PIECE_H+4,12);R.geoSel=new THREE.TorusGeometry(8.6,0.9,8,40);
  R.matSel=new THREE.MeshBasicMaterial({color:0xffd34d,transparent:true});R.borderMat={};R.matHit=new THREE.MeshBasicMaterial();
  R.pieceG=new THREE.Group();scene2.add(R.pieceG);R.arrowG=new THREE.Group();scene.add(R.arrowG);R.animG=new THREE.Group();scene2.add(R.animG);
  // 矢印の点線
  const dc=document.createElement('canvas');dc.width=32;dc.height=4;const dx=dc.getContext('2d');dx.fillStyle='#fff';dx.fillRect(0,0,20,4);
  R.dash=new THREE.CanvasTexture(dc);R.dash.wrapS=THREE.RepeatWrapping;

  // 地名と札をのせる層
  const lay=document.createElement('div');lay.className='v3l';R.labels=lay;
  R.alab=AREAS.map(a=>{const d=document.createElement('div');const main=isMain(a.id),sp=a.k!=='城';
    d.className='k3'+(main?' main':'')+(sp?' sp':'');
    d.innerHTML=`<i class="k3i k${a.k}"><svg viewBox="0 0 512 512"><path d="${ICONS[a.k]}"/></svg></i><span>${a.n}</span>`;
    lay.appendChild(d);return {a,d,main,sp,x:0,y:0,vis:null};});
  R.hnBox=document.createElement('div');R.hnBox.className='h3box';lay.insertBefore(R.hnBox,lay.firstChild);R.hn=[];
  R.tagBox=document.createElement('div');lay.appendChild(R.tagBox);R.tags=[];

  // 操作
  let down=null;
  canvas.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY,b:e.button};});
  canvas.addEventListener('pointerup',e=>{if(!down)return;const moved=Math.hypot(e.clientX-down.x,e.clientY-down.y)>5;const b=down.b;down=null;if(moved)return;
    if(b===2){const hit=pickPiece(e);const a=hit?hit.a:pickArea(e);if(a)rightClickArea(a);return;}
    if(b!==0)return;
    const hit=pickPiece(e);if(hit){clickArea(hit.a,hit.h,hit.id);return;}
    const a=pickArea(e);if(a)clickArea(a);});
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  let hov=null;
  canvas.addEventListener('pointermove',e=>{if(e.buttons){tip(null);return;}if(hov){hov=e;return;}hov=e;requestAnimationFrame(()=>{const ev=hov;hov=null;const a=pickArea(ev);canvas.style.cursor=a?'pointer':'grab';if(a)tip(ev,areaTip(a));else tip(null);});});
  canvas.addEventListener('pointerleave',()=>tip(null));
  R.ro=new ResizeObserver(()=>resize());
  R.clock=performance.now();
  return true;
}
function resize(){if(!R||!host)return;const r=host.getBoundingClientRect();if(!r.width||!r.height)return;
  // 画面の大きさに合わせて描く細かさを変える（小さい画面・低い性能の端末では軽く）
  const lv=document.documentElement.dataset.ui||'m';R.renderer.setPixelRatio(Math.min(devicePixelRatio,{xs:1.5,s:1.25,m:1.5,l:1.75,xl:2}[lv]||1.5));
  R.renderer.setSize(r.width,r.height,false);R.camera.aspect=r.width/r.height;R.camera.updateProjectionMatrix();R.W=r.width;R.H=r.height;}

/* ---------- 地図の建物（城・港・鉱山・寺社・京都・堺） ---------- */
// 地域ごとに決まった乱数（毎回同じ見た目になる）
function rnd01(id){let h=2166136261;for(const ch of id)h=Math.imul(h^ch.charCodeAt(0),16777619);return n=>{let x=Math.imul(h^(n*2654435761),1597334677);x^=x>>>15;x=Math.imul(x,2246822519);x^=x>>>13;return ((x>>>0)%10000)/10000;};}
function propOf(a){
  if(a.k==='城'){if(a.ter==='山')return 'yama';if(isMain(a.id))return 'late';return a.koku>=PROP_MID_KOKU?'mid':'early';}
  return {'港':'minato','銀':'gin','寺':'tera','京':'kyoto','堺':'sakai'}[a.k]||null;}
const PROP_MID_KOKU=(()=>{const v=AREAS.filter(a=>a.k==='城'&&a.ter!=='山'&&!isMain(a.id)).map(a=>a.koku).sort((x,y)=>x-y);return v.length?v[Math.floor(v.length/2)]:0;})();
async function loadProps(){
  if(R.propsLoading)return;R.propsLoading=true;
  const P=VIEW3D.props;const parse=async t=>{const bytes=Uint8Array.from(atob(t.trim()),c=>c.charCodeAt(0));return (await new GLTFLoader().parseAsync(bytes.buffer,'')).scene;};
  // 山城などは何種類かのモデルから地域ごとに選ぶ
  const want={};R.propKey={};for(const a of AREAS){const k=propOf(a);if(!k||!P[k])continue;const srcs=Array.isArray(P[k].src)?P[k].src:[P[k].src];const v=Math.floor(rnd01(a.id)(11)*srcs.length)%srcs.length;const key=k+'#'+v;R.propKey[a.id]=key;(want[key]=want[key]||[]).push(a);}
  R.propG=new THREE.Group();R.scene2.add(R.propG);R.props=[];R.propH={};
  await Promise.all(Object.keys(want).map(async key=>{const [k,vi]=key.split('#');const src=Array.isArray(P[k].src)?P[k].src[+vi]:P[k].src;
    try{const sc=await parse(await fetch(src).then(r=>{if(!r.ok)throw new Error(r.status);return r.text();}));
      let mesh=null;sc.updateMatrixWorld(true);sc.traverse(o=>{if(o.isMesh&&!mesh)mesh=o;});if(!mesh)return;
      const geo=mesh.geometry.clone();geo.applyMatrix4(mesh.matrixWorld);if(!geo.attributes.normal)geo.computeVertexNormals();
      geo.computeBoundingBox();const b=geo.boundingBox.clone();const sx=b.max.x-b.min.x,sz=b.max.z-b.min.z;const s=P[k].fp/Math.max(sx,sz);
      geo.translate(-(b.min.x+b.max.x)/2,-b.min.y,-(b.min.z+b.max.z)/2);geo.scale(s,s,s);
      const map=mesh.material.map;if(map){map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;}
      const list=want[key];const im=new THREE.InstancedMesh(geo,new THREE.MeshLambertMaterial({map}),list.length);
      im.renderOrder=2;im.frustumCulled=false;// 元の形の位置だけで画面外と判定されて消えないように
      R.propH[key]=(b.max.y-b.min.y)*s;
      const V_=P[k].vary||{};const col=new THREE.Color();
      list.forEach((a,i)=>{const [x,z]=toW(a.c[0],a.c[1]);const r=rnd01(a.id);
        // 同じ形が並ばないように：向き・大きさ・高さ・色を地域ごとに少しずつ変える
        const rot=(r(1)-0.5)*2*(V_.yaw||0.25);const mir=1;// 左右反転は光の当たり方がおかしくなるので使わない
        const sz=1+(r(3)-0.5)*2*(V_.size||0.08),sh=1+(r(4)-0.5)*2*(V_.height||0.08);
        R.props.push({im,i,a,x,z,y:R.hc[a.id]-0.6,rot,k,sx:sz*mir,sy:sh,sz:sz*(1+(r(5)-0.5)*0.12)});
        const t=V_.tint||0.06;col.setRGB(1+(r(6)-0.5)*2*t,1+(r(7)-0.5)*2*t*(V_.green?1.6:1),1+(r(8)-0.5)*2*t);const b=1+(r(9)-0.5)*2*(V_.bright||0.06);col.multiplyScalar(b);im.setColorAt(i,col);});
      if(im.instanceColor)im.instanceColor.needsUpdate=true;
      R.propG.add(im);
    }catch(e){console.warn('prop',key,e);}
  }));
  R.propS=null;R.labels.classList.add('props');
}
function placeProps(ps){
  if(!R.props||!R.props.length)return;if(R.propS&&Math.abs(ps-R.propS)/R.propS<0.04)return;R.propS=ps;
  const m=new THREE.Matrix4(),q=new THREE.Quaternion(),sc=new THREE.Vector3(),p=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
  const used=new Set();
  for(const o of R.props){q.setFromAxisAngle(up,o.rot);sc.set(ps*o.sx,ps*o.sy,ps*o.sz);p.set(o.x,o.y,o.z);m.compose(p,q,sc);o.im.setMatrixAt(o.i,m);used.add(o.im);}
  for(const im of used)im.instanceMatrix.needsUpdate=true;
}
const propTop=(a,ps)=>{const k=R.props&&R.props.length&&R.propKey?R.propKey[a.id]:null;return k&&R.propH[k]?R.propH[k]*ps:0;};

/* ---------- 地面の細かな模様（くり返し使える512pxの画像をその場でつくる） ---------- */
function detailTex(){const N=512;const c=document.createElement('canvas');c.width=c.height=N;const x=c.getContext('2d');const img=x.createImageData(N,N);
  let sd=12345;const rnd=()=>(sd=(sd*16807)%2147483647)/2147483647;
  const grid=n=>{const gg=new Float32Array(n*n);for(let i=0;i<n*n;i++)gg[i]=rnd();return gg;};
  const vn=(gg,n,u,v)=>{const X=u*n,Y=v*n;const x0=Math.floor(X),y0=Math.floor(Y);const fx=X-x0,fy=Y-y0;const sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);
    const g_=(a,b)=>gg[((b%n+n)%n)*n+((a%n+n)%n)];return (g_(x0,y0)*(1-sx)+g_(x0+1,y0)*sx)*(1-sy)+(g_(x0,y0+1)*(1-sx)+g_(x0+1,y0+1)*sx)*sy;};
  const O=[[8,0.4],[16,0.3],[32,0.2],[64,0.1]].map(([n,w])=>[grid(n),n,w]);const cn=grid(64),cn2=grid(128),pt=grid(24),pt2=grid(40);
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){const u=i/N,v=j/N;let f=0;for(const [gg,n,w] of O)f+=vn(gg,n,u,v)*w;
    // こずえ：細かい点を強めて丸い木のかたまりに
    let k=vn(cn,64,u,v)*0.6+vn(cn2,128,u,v)*0.4;k=Math.min(1,Math.max(0,(k-0.35)*2.2));
    // 田畑：区画ごとに色が変わるまだら
    const p=Math.floor(vn(pt,24,u,v)*5)/5*0.6+Math.floor(vn(pt2,40,u,v)*4)/4*0.4;
    const o=(j*N+i)*4;img.data[o]=f*255;img.data[o+1]=k*255;img.data[o+2]=p*255;img.data[o+3]=255;}
  x.putImageData(img,0,0);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.NoColorSpace;t.anisotropy=4;return t;}

/* ---------- 高精細の区画を、カメラの近くだけ読みこむ ---------- */
function updateHi(dist,now){
  const T=VIEW3D.tiles;if(!T||!R.hi[0].u)return;
  const has=new Set(T.list);const want=[];
  if(dist<T.near){const tg=R.controls.target;const [gx,gy]=toG(tg.x,tg.z);
    const fu=(gx-X0)/MW*T.ow/T.ts,fv=(gy-Y0)/MH*T.oh/T.ts;const bx=Math.round(fu)-1,by=Math.round(fv)-1;
    for(let j=0;j<2;j++)for(let i=0;i<2;i++){const k=(bx+i)+'_'+(by+j);if(has.has(k))want.push(k);}}
  // いらなくなった区画をうすくして外す・必要な区画を読みこむ
  for(const h of R.hi){h.want=want.includes(h.key)?1:0;}
  for(const k of want){if(R.hi.some(h=>h.key===k))continue;const h=R.hi.find(h=>!h.key||(!h.want&&h.mix.value<=0.01&&!h.loading));if(!h)break;
    if(h.tex){h.tex.dispose();h.tex=null;}h.key=k;h.want=1;h.loading=true;h.mix.value=0;const [tx,ty]=k.split('_').map(Number);
    const tw=Math.min(T.ts,T.ow-tx*T.ts),th=Math.min(T.ts,T.oh-ty*T.ts);h.rect.set(tx*T.ts/T.ow,1-(ty*T.ts+th)/T.oh,tw/T.ow,th/T.oh);
    new THREE.TextureLoader().loadAsync(`${T.dir}t_${k}.jpg`).then(t=>{if(h.key!==k){t.dispose();return;}t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(8,R.renderer.capabilities.getMaxAnisotropy());t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;h.tex=t;h.u.value=t;h.loading=false;}).catch(()=>{h.loading=false;h.key=null;});}
  for(const h of R.hi){const tgt=h.want&&h.tex?1:0;h.mix.value+=(tgt-h.mix.value)*0.12;if(Math.abs(tgt-h.mix.value)<0.01)h.mix.value=tgt;if(!h.want&&h.mix.value===0&&h.tex&&!h.loading){/* 次に使うまで残す */}}
}

/* ---------- クリックした場所 ---------- */
function ray(e){const r=R.canvas.getBoundingClientRect();const v=new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);const rc=new THREE.Raycaster();rc.setFromCamera(v,R.camera);return rc;}
function pickPiece(e){const rc=ray(e);const hits=rc.intersectObjects(R.pieceG.children.map(g=>g.userData.hit).filter(Boolean),false);return hits.length?hits[0].object.userData.army:null;}
function pickArea(e){
  // 地形の高さにそって光線を進め、地面に当たる点を求める
  const o=ray(e).ray;const top=HS*1.02;if(o.direction.y>=0&&o.origin.y>top)return null;
  let t0=o.direction.y<0?Math.max(0,(top-o.origin.y)/o.direction.y):0,t1=o.direction.y<0?(-0.5-o.origin.y)/o.direction.y:t0+4000;
  const p=new THREE.Vector3();const above=t=>{o.at(t,p);const [gx,gy]=toG(p.x,p.z);return p.y>hGame(gx,gy);};
  const N=160;let prev=t0,hit=null;for(let i=1;i<=N;i++){const t=t0+(t1-t0)*i/N;if(!above(t)){hit=t;break;}prev=t;}
  if(hit==null)return null;let a=prev,b=hit;for(let k=0;k<12;k++){const m=(a+b)/2;if(above(m))a=m;else b=m;}
  o.at(b,p);const [gx,gy]=toG(p.x,p.z);return areaAt(gx,gy);
}
function areaAt(x,y){for(const a of AREAS){const b=R.bb[a.id];if(x<b[0]||x>b[2]||y<b[1]||y>b[3])continue;if(R.pctx.isPointInPath(R.path[a.id],x,y))return a.id;}return null;}

/* ---------- 色をぬる ---------- */
function drawOverlay(){
  const g=R.oc.getContext('2d');g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,R.oc.width,R.oc.height);
  g.setTransform(OS,0,0,OS,-X0*OS,-Y0*OS);g.lineJoin='round';g.lineCap='round';
  const mode=UI.mapMode;
  // 内側はうすく塗る
  for(const a of AREAS){const o=S.own[a.id];let col=null,al=0;
    if(mode==='dip'){const k=dipKey(o);col=DIPCOL[k];al=k==='self'?REALM_IN.self:k==='neutral'?(NEUTRAL_POW[a.id]?0.16:0):REALM_IN.other;}
    else if(mode==='pow'){const c=o&&H[o]?H[o].col:null;col=c||'#888';al=c?(o===S.me?REALM_IN.self:REALM_IN.other):(NEUTRAL_POW[a.id]?0.14:0);}
    if(al>0){g.globalAlpha=al;g.fillStyle=col;g.fill(R.path[a.id]);}
  }
  // 境目の近くほど濃く（HOI4風）：家ごとに領地の形で切りぬき、境目の線を太い順に重ねる
  if(mode!=='ter'){const E=realmEdges();
    for(const h in E.by){const col=realmCol(h);const clip=new Path2D();for(const a of areasOf(h))clip.addPath(R.path[a]);
      g.save();g.clip(clip);g.strokeStyle=col;
      const band=(list,B)=>{if(!list.length)return;const pth=new Path2D();for(const e of list){pth.moveTo(e.p[0],e.p[1]);pth.lineTo(e.q[0],e.q[1]);}for(const [w,o] of B){g.globalAlpha=Math.min(1,o*1.2);g.lineWidth=w;g.stroke(pth);}};
      band(E.by[h].land,REALM_BANDS3);band(E.by[h].coast,REALM_COAST3);band(E.by[h].land,[[1.1,0.75]]);
      g.restore();}
    g.globalAlpha=1;}
  // にらみの範囲：敵の軍勢がいる地域を赤い斜線で
  if(!S.dead[S.me]){const Z=[...zocOf(S.me)];if(Z.length){
    if(!R.zocPat){const c=document.createElement('canvas');c.width=c.height=12;const x=c.getContext('2d');x.strokeStyle='rgba(255,90,70,0.85)';x.lineWidth=3;for(const o_ of [-12,0,12]){x.beginPath();x.moveTo(o_,12);x.lineTo(o_+12,0);x.stroke();}R.zocPat=g.createPattern(c,'repeat');}
    const pth=new Path2D();for(const a of Z)if(R.path[a])pth.addPath(R.path[a]);
    g.save();g.globalAlpha=0.35*(R.af==null?1:R.af)+0.0;g.fillStyle='#7a1208';g.fill(pth);g.globalAlpha=0.8;g.fillStyle=R.zocPat;
    g.fill(pth);
    g.globalAlpha=0.9;g.strokeStyle='#b0281a';g.lineWidth=1.4;g.stroke(pth);g.restore();}}
  // 地域の細い輪郭
  g.lineWidth=0.4;g.strokeStyle=mode==='ter'?'rgba(30,22,12,0.22)':'rgba(30,22,12,0.38)';for(const a of AREAS)g.stroke(R.path[a.id]);
  // 街道
  const drawn=new Set();
  for(const x in EDGE)for(const y in EDGE[x]){const k=[x,y].sort().join('|');if(drawn.has(k))continue;drawn.add(k);const e=EDGE[x][y];const a=A[x].c,b=A[y].c;
    if(e.r==='海路'){g.setLineDash([3,4]);g.strokeStyle='rgba(170,205,235,0.45)';g.lineWidth=0.6;}
    else continue; // 陸の街道は地形の上に砂利道として引く（buildRoads）
    g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.stroke();}
  g.setLineDash([]);

  // 行ける地域・選んだ地域
  // ふちから内側へ、ぼかした光を入れる
  const glow=(pth,col,w,fo,sa)=>{g.save();g.globalAlpha=fo;g.fillStyle=col;g.fill(pth);g.globalAlpha=1;
    g.clip(pth);g.filter=`blur(${Math.round(w*OS*0.45)}px)`;g.strokeStyle=col;g.globalAlpha=sa;g.lineWidth=w;g.stroke(pth);g.restore();
    g.save();g.filter=`blur(${Math.round(w*OS*0.3)}px)`;g.globalAlpha=sa*0.4;g.strokeStyle=col;g.lineWidth=w*0.4;g.stroke(pth);g.restore();};
  if(UI.reach)for(const a in UI.reach)glow(R.path[a],'#ffe28a',5,0.05,0.42);
  if(UI.area&&R.path[UI.area])glow(R.path[UI.area],'#fff1b8',7,0.08,0.6);
  if(UI.warnH)for(const a of areasOf(UI.warnH))if(R.path[a])glow(R.path[a],'#ff8a3a',7,0.22,0.8);
  R.ovTex.needsUpdate=true;
  // 光る層
  {const q=R.gc.getContext('2d');q.setTransform(1,0,0,1,0,0);q.clearRect(0,0,R.gc.width,R.gc.height);q.setTransform(R.GS,0,0,R.GS,-X0*R.GS,-Y0*R.GS);q.lineJoin='round';q.lineCap='round';
   const lite=(c,k)=>{const n=parseInt(c.slice(1),16);let r=n>>16,g_=(n>>8)&255,b=n&255;r=r+(255-r)*k;g_=g_+(255-g_)*k;b=b+(255-b)*k;return `rgb(${r|0},${g_|0},${b|0})`;};
   if(mode!=='ter'){const E=realmEdges();
     for(const h in E.by){if(!E.by[h].land.length)continue;const col=realmCol(h);const me=h===S.me;const clip=new Path2D();for(const a of areasOf(h))clip.addPath(R.path[a]);
       const pth=new Path2D();for(const e of E.by[h].land){pth.moveTo(e.p[0],e.p[1]);pth.lineTo(e.q[0],e.q[1]);}
       q.save();q.clip(clip);q.strokeStyle=lite(col,0.25);
       const gw=R.glowW||1;q.filter=`blur(${Math.round(4*gw*R.GS)}px)`;q.globalAlpha=me?0.75:0.5;q.lineWidth=12*gw;q.stroke(pth);
       q.filter=`blur(${Math.round(1.6*R.GS)}px)`;q.globalAlpha=me?0.9:0.65;q.lineWidth=3;q.stroke(pth);
       q.restore();}}
   // にらみの範囲：光る層に斜線を入れる（色の層だけだと地形の明るさに合わせて見えなくなるため）
   if(!S.dead[S.me]){const Z=[...zocOf(S.me)];if(Z.length){
     if(!R.zocPatG){const c=document.createElement('canvas');c.width=c.height=16;const x=c.getContext('2d');x.strokeStyle='rgb(255,60,40)';x.lineWidth=5;for(const o_ of [-16,0,16]){x.beginPath();x.moveTo(o_,16);x.lineTo(o_+16,0);x.stroke();}R.zocPatG=q.createPattern(c,'repeat');}
     const pth=new Path2D();for(const a of Z)if(R.path[a])pth.addPath(R.path[a]);q.save();q.globalAlpha=0.95;q.fillStyle=R.zocPatG;q.fill(pth);q.restore();}}
   // 選んだ地域も光らせる
   const sg=(a,c,w,al)=>{if(!R.path[a])return;q.save();q.clip(R.path[a]);q.filter=`blur(${Math.round(w*0.5*R.GS)}px)`;q.globalAlpha=al;q.strokeStyle=c;q.lineWidth=w;q.stroke(R.path[a]);q.restore();};
   if(UI.reach)for(const a in UI.reach)sg(a,'#ffe28a',8,0.5);
   if(UI.area)sg(UI.area,'#fff1b8',12,0.8);
   if(UI.warnH)for(const a of areasOf(UI.warnH))sg(a,'#ff8a3a',12,0.9);
   R.glowTex.needsUpdate=true;}
}

/* ---------- 家の名前（地図の上に大きく） ---------- */
function buildHouseNames(){R.hnBox.innerHTML='';R.hn=[];if(UI.mapMode==='ter'||UI.hideNames)return;
  for(const L of houseLabels()){const me=L.h===S.me;
    for(const c of L.chars){const d=document.createElement('div');d.className='h3n'+(me?' me':'');d.textContent=c.ch;R.hnBox.appendChild(d);
      const [x,z]=toW(c.x,c.y);R.hn.push({d,x,z,y:hGame(c.x,c.y)+3,fs:L.fs,vis:null});}}}
/* ---------- 駒 ---------- */
function flagMat(h){const hc=H[h].col;const key='flag|'+h;if(R.mats[key])return R.mats[key];
  if(!R.kamonImg||kamonIdx(h)<0)return matOf(hc);
  const c=document.createElement('canvas');c.width=64;c.height=112;const x=c.getContext('2d');
  x.fillStyle='#f4efe2';x.fillRect(0,0,64,112);x.fillStyle=hc;x.fillRect(0,0,64,14);x.fillRect(0,98,64,14);
  const i=kamonIdx(h),N=KAMON.n,C=KAMON.cell;x.drawImage(R.kamonImg,(i%N)*C,Math.floor(i/N)*C,C,C,5,29,54,54);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
  return R.mats[key]=new THREE.MeshLambertMaterial({map:t,side:THREE.DoubleSide});}
function matOf(col){return R.mats[col]||(R.mats[col]=new THREE.MeshLambertMaterial({color:col,side:THREE.DoubleSide}));}
function modelOf(kind){return R.models[kind]||R.models.ashi||Object.values(R.models)[0];}
function kindOf(ar){
  const n=nOf(ar);let best='ashi',v=-1;for(const t of TORDER)if((n[t]||0)>v){v=n[t]||0;best=t;}return best;}
const isLord=ar=>ar&&ar.cmd===lordIdx(ar.h)&&ar.cmd>=0&&!!R.models.taisho;
function makePiece(fill,hc,kind,lord){
  const g=new THREE.Group();const M=modelOf(kind);
  const m=M.obj.clone(true);const wrap=new THREE.Group();wrap.add(m);wrap.scale.setScalar(PIECE_H*(M.cfg.s||1)/M.h);g.add(wrap);
  g.userData.kind=kind;g.userData.lordless=!lord;
  if(lord){const L=R.models.taisho;const lm=L.obj.clone(true);const lw=new THREE.Group();lw.add(lm);lw.scale.setScalar(PIECE_H*0.9*(L.cfg.s||1)/L.h);lw.position.set(-1.5,0,5.5);g.add(lw);}
  const disc=new THREE.Mesh(R.geoDisc,matOf(fill));disc.position.y=0.3;g.add(disc);
  const pole=new THREE.Mesh(R.geoPole,matOf('#3a2a1a'));pole.position.set(-3.6,8,0);g.add(pole);
  const flag=new THREE.Mesh(R.geoFlag,flagMat(hc));flag.position.set(-3.6,11.5,0);g.add(flag);
  g.userData.wrap=wrap;
  return g;
}
const pieceCol=h=>h===S.me?'#3d6fd6':DIPCOL[dipKey(h)];
function faceAngle(ar){const o=S.orders[ar.id];
  if(o&&o.length){const d=A[o[0]].c,c=A[ar.a].c;const dx=d[0]-c[0],dy=d[1]-c[1];if(Math.hypot(dx,dy)>1)return Math.atan2(-dy,dx);}
  // 待っている軍勢は、城を背にして街道の先を向く
  {const p=standPos(ar),c=A[ar.a].c;const dx=p[0]-c[0],dy=p[1]-c[1];if(Math.hypot(dx,dy)>2)return Math.atan2(-dy,dx);}
  const idle=(modelOf(kindOf(ar)).cfg.idle)||0.35;return (ar.face==='l')?Math.PI+idle:-idle;}
function slot(list,j){return [(j-(list.length-1)/2)*14,13];}
function setOrder(o,n){o.traverse(x=>{if(x.isMesh)x.renderOrder=n;});}
function buildPieces(){
  for(const g of [...R.pieceG.children])R.pieceG.remove(g);
  R.tagBox.innerHTML='';R.tags=[];
  const byA={};for(const x of S.armies)(byA[x.a]=byA[x.a]||[]).push(x);
  for(const a in byA){const c=A[a].c;const list=byA[a];
    list.forEach((ar,j)=>{
      const [gx,gy]=standPos(ar);
      const p=makePiece(pieceCol(ar.h),ar.h,kindOf(ar),isLord(ar));const [wx,wz]=toW(gx,gy);
      p.position.set(wx,hGame(gx,gy),wz);p.rotation.y=faceAngle(ar);
      const hit=new THREE.Mesh(R.geoHit,R.matHit);hit.visible=false;hit.position.y=(PIECE_H+4)/2;hit.userData.army={a,h:ar.h,id:ar.id};p.add(hit);p.userData.hit=hit;
      if(ar.id===UI.sel){const r=new THREE.Mesh(R.geoSel,R.matSel);r.rotation.x=Math.PI/2;r.position.y=0.8;p.add(r);p.userData.sel=r;}
      p.userData.id=ar.id;setOrder(p,2);R.pieceG.add(p);
      const t=document.createElement('div');t.className='t3u'+(ar.h===S.me?' me':'')+(ar.id===UI.sel?' sel':'');t.style.setProperty('--hc',H[ar.h].col);
      t.innerHTML=`<b>${kamonHTML(ar.h)}</b><span>${ar.u.length}</span>${needsRefill(ar)?'<em>✚</em>':''}`;t.title=hn(ar.h)+'　'+cmdOf(ar).n;
      t.onclick=ev=>{ev.stopPropagation();clickArea(a,ar.h,ar.id);};t.oncontextmenu=ev=>{ev.preventDefault();ev.stopPropagation();rightClickArea(a);};
      t.onmousemove=ev=>tip(ev,areaTip(a));t.onmouseleave=()=>tip(null);
      const nm=document.createElement('div');nm.className='t3n'+(ar.h===S.me?' me':'')+(ar.id===UI.sel?' sel':'');nm.style.setProperty('--hc',H[ar.h].col);nm.innerHTML=`<span class="nn">${esc(cmdOf(ar).n)}の軍勢</span><b class="nt">${(totU(ar)*100).toLocaleString()}</b>`;
      nm.onclick=t.onclick;
      R.tagBox.appendChild(t);R.tagBox.appendChild(nm);R.tags.push({el:t,nm,obj:p,me:ar.h===S.me,sel:ar.id===UI.sel});
    });
  }
}

/* ---------- ZOC（敵の軍勢のまわりと街道を赤い斜線の帯で。地形の上にくっきり） ---------- */
function zocTex(){const c=document.createElement('canvas');c.width=c.height=32;const x=c.getContext('2d');x.fillStyle='rgba(110,16,8,0.45)';x.fillRect(0,0,32,32);
  x.strokeStyle='rgba(255,105,85,0.95)';x.lineWidth=6;x.beginPath();for(const o of [-32,0,32]){x.moveTo(o,32);x.lineTo(o+32,0);}x.stroke();
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;}
function buildZoc(){if(R.zocG){for(const m of [...R.zocG.children]){R.zocG.remove(m);m.geometry.dispose();}}}


/* ---------- 命令の矢印 ---------- */
function ribbon(S_,w,uvL){
  const pos=[],uv=[],idx=[];
  for(let i=0;i<S_.length;i++){const p=S_[i];const a=S_[Math.max(0,i-1)],b=S_[Math.min(S_.length-1,i+1)];
    let dx=b[0]-a[0],dz=b[2]-a[2];const L=Math.hypot(dx,dz)||1;dx/=L;dz/=L;const nx=-dz*w/2,nz=dx*w/2;
    pos.push(p[0]+nx,p[1],p[2]+nz,p[0]-nx,p[1],p[2]-nz);uv.push(p[3]/uvL,0,p[3]/uvL,1);
    if(i>0){const k=i*2;idx.push(k-2,k-1,k,k-1,k+1,k);}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);return g;
}
function arrowList(){
  const out=[];
  const add=(ord,col,planned)=>{for(const id in ord){const ar=S.armies.find(x=>x.id==id);const st=UI.replay?S.lastStart[id]:ar&&ar.a;if(!st)continue;
    const p=[st].concat(ord[id]);if(p.length<2)continue;const pts=routePts(p);
    if(!UI.replay&&ar){const q=standPos(ar);pts[0]=q;}
    out.push({pts,col,planned});}};
  if(UI.replay){const mine={},oth={};for(const id in S.lastOrders){const h=(S.armies.find(x=>x.id==id)||{}).h;(h===S.me?mine:oth)[id]=S.lastOrders[id];}add(oth,'#c0392b',false);add(mine,'#2c5aa0',false);}
  else add(S.orders,'#1f5fd0',true);
  return out;
}
function buildArrows(k){
  for(const g of [...R.arrowG.children]){R.arrowG.remove(g);g.traverse(o=>{if(o.geometry&&o.userData.own)o.geometry.dispose();});}
  R.arrowK=k;R.arrowMats=[];
  const LIFT=4;
  for(const ar of arrowList()){
    const P=ar.pts;const e=P[P.length-1];
    const hl=13*k,hw=8.5*k;const sh=arrowShape(P,6+10*k,hl);const tip=sh.tip,baseP=sh.base,ux=sh.ux,uy=sh.uy;
    const Q=sh.body;
    // 道にそって点を並べる（地形の上に浮かせる）
    const smp=[];let acc=0;
    for(let i=0;i<Q.length-1;i++){const a=Q[i],b=Q[i+1];const l=Math.hypot(b[0]-a[0],b[1]-a[1]);const n=Math.max(1,Math.ceil(l/2));
      for(let j=(i?1:0);j<=n;j++){const f=j/n;const gx=a[0]+(b[0]-a[0])*f,gy=a[1]+(b[1]-a[1])*f;const [wx,wz]=toW(gx,gy);smp.push([wx,hGame(gx,gy)+LIFT,wz,acc+l*f]);}
      acc+=l;}
    const grp=new THREE.Group();
    const mBg=new THREE.MeshBasicMaterial({color:0xfffdf6,transparent:true,opacity:0.85,depthTest:false,depthWrite:false,side:THREE.DoubleSide});
    const mLn=new THREE.MeshBasicMaterial({color:ar.col,map:R.dash,transparent:true,depthTest:false,depthWrite:false,side:THREE.DoubleSide});
    const mHd=new THREE.MeshBasicMaterial({color:ar.col,transparent:true,depthTest:false,depthWrite:false,side:THREE.DoubleSide});
    const bg=new THREE.Mesh(ribbon(smp,7.5*k,1),mBg);bg.renderOrder=5;bg.userData.own=1;grp.add(bg);
    const ln=new THREE.Mesh(ribbon(smp,4.4*k,16*k),mLn);ln.renderOrder=6;ln.userData.own=1;grp.add(ln);
    // 矢じり
    const hy=Math.max(hGame(tip[0],tip[1]),hGame(baseP[0],baseP[1]))+LIFT;
    const v=(x,y)=>{const [wx,wz]=toW(x,y);return [wx,hy,wz];};
    const hg=new THREE.BufferGeometry();hg.setAttribute('position',new THREE.Float32BufferAttribute([...v(tip[0],tip[1]),...v(baseP[0]-uy*hw,baseP[1]+ux*hw),...v(baseP[0]+uy*hw,baseP[1]-ux*hw)],3));
    const hd=new THREE.Mesh(hg,mHd);hd.renderOrder=7;hd.userData.own=1;grp.add(hd);
    if(ar.planned){const rg=new THREE.RingGeometry(11*k,13.5*k,36);rg.rotateX(-Math.PI/2);const ring=new THREE.Mesh(rg,mHd);const [wx,wz]=toW(e[0],e[1]);ring.position.set(wx,hGame(e[0],e[1])+LIFT,wz);ring.renderOrder=7;ring.userData.own=1;grp.add(ring);}
    R.arrowG.add(grp);R.arrowMats.push(mBg,mLn,mHd);
  }
}
/* ---------- 街道（砂利道） ---------- */
function gravelTex(){
  // 砂利道の模様をその場でつくる：明るい土色に小石の点、道のふちは少し暗く
  const c=document.createElement('canvas');c.width=128;c.height=32;const x=c.getContext('2d');
  x.fillStyle='#d9ccaa';x.fillRect(0,0,128,32);
  let sd=7;const r=()=>(sd=(sd*16807)%2147483647)/2147483647;
  for(let i=0;i<900;i++){const v=150+Math.floor(r()*90);const a=0.35+r()*0.5;x.fillStyle=`rgba(${v},${v-8},${v-24},${a})`;const s=0.8+r()*1.8;x.fillRect(r()*128,3+r()*26,s,s);}
  for(let i=0;i<260;i++){const v=90+Math.floor(r()*50);x.fillStyle=`rgba(${v},${v-10},${v-25},0.55)`;x.fillRect(r()*128,3+r()*26,1,1);}
  // わだち
  x.fillStyle='rgba(120,100,70,0.22)';x.fillRect(0,10,128,2);x.fillRect(0,20,128,2);
  const t=new THREE.CanvasTexture(c);t.wrapS=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;}
function buildRoads(k){
  if(VIEW3D.roadsInMap){if(R.roadG)R.roadG.visible=false;return;} // 陸の街道は地面の画像に描きこみ済み（線としては引かない）
  if(!R.roadG){R.roadG=new THREE.Group();R.scene.add(R.roadG);R.gravel=gravelTex();
    R.roadMat={edge:new THREE.MeshBasicMaterial({color:0x4a3a26,transparent:true,opacity:0.75,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-6}),
      main:new THREE.MeshBasicMaterial({map:R.gravel,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-8}),
      mtn:new THREE.MeshBasicMaterial({map:R.gravel,color:0xe9e0cc,transparent:true,opacity:0.85,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-8})};}
  for(const m of [...R.roadG.children]){R.roadG.remove(m);m.geometry.dispose();}
  const LIFT=1.3;const W={main:1.9*k+0.5,mtn:1.1*k+0.3};
  const lists={main:[],mtn:[]};const drawn=new Set();
  for(const x in EDGE)for(const y in EDGE[x]){const key=[x,y].sort().join('|');if(drawn.has(key))continue;drawn.add(key);const e=EDGE[x][y];if(e.r==='海路')continue;lists[e.c===1?'main':'mtn'].push(roadPts(x,y));}
  // 道すじを2単位ごとに点を打ちなおし、となりの点から向きを決めて帯にする
  const resample=P=>{const out=[[P[0][0],P[0][1],0]];let acc=0;for(let i=1;i<P.length;i++){const a=P[i-1],b=P[i];const L=Math.hypot(b[0]-a[0],b[1]-a[1]);const n=Math.max(1,Math.ceil(L/2));for(let j=1;j<=n;j++){const f=j/n;out.push([a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f,acc+L*f]);}acc+=L;}return out;};
  const strip=(lines,w,uvL,gap)=>{const pos=[],uv=[],idx=[];
    for(const P of lines){const Sm=resample(P);let prev=null;
      for(let i=0;i<Sm.length;i++){const a=Sm[Math.max(0,i-1)],b=Sm[Math.min(Sm.length-1,i+1)];let dx=b[0]-a[0],dy=b[1]-a[1];const L=Math.hypot(dx,dy)||1;const nx=-dy/L*w/2,ny=dx/L*w/2;const [x,y,d]=Sm[i];
        const hh=Math.max(hGame(x+nx,y+ny),hGame(x-nx,y-ny),hGame(x,y))+LIFT;
        const [ax,az]=toW(x+nx,y+ny),[bx,bz]=toW(x-nx,y-ny);const base=pos.length/3;pos.push(ax,hh,az,bx,hh,bz);const u=d/uvL;uv.push(u,0,u,1);
        if(prev!==null&&!(gap&&Math.floor(d/gap)%2===1))idx.push(prev,prev+1,base,prev+1,base+1,base);prev=base;}}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);return g;};
  const add=(geo,mat,ro)=>{const m=new THREE.Mesh(geo,mat);m.renderOrder=ro;R.roadG.add(m);};
  add(strip(lists.main,W.main*1.45,8),R.roadMat.edge,1);
  add(strip(lists.main,W.main,8),R.roadMat.main,1);
  add(strip(lists.mtn,W.mtn*1.5,6),R.roadMat.edge,1);
  add(strip(lists.mtn,W.mtn,6),R.roadMat.mtn,1);
}

/* ---------- 境目の線（地形の上にくっきり引く） ---------- */
function buildBorders(k){
  if(!R.borderG){R.borderG=new THREE.Group();R.scene.add(R.borderG);}
  for(const m of [...R.borderG.children]){R.borderG.remove(m);m.geometry.dispose();}
  const LIFT=0.9;const lists={};
  for(const e of borderSegs()){const [a,b]=e.ids;const oa=S.own[a]||null,ob=S.own[b]||null;if(oa===ob)continue;
    const me=oa===S.me||ob===S.me;if(!me||UI.mapMode==='ter')continue;(lists.me=lists.me||[]).push(e);}
  const W={me:1.5*k,oth:1.25*k};const COL={me:0x2f63d8,oth:0x24180c};
  for(const key in lists){const pos=[],idx=[];const w=W[key]/2;
    for(const e of lists[key]){const dx=e.q[0]-e.p[0],dy=e.q[1]-e.p[1];const L=Math.hypot(dx,dy)||1;const nx=-dy/L*w,ny=dx/L*w;const ex=dx/L*w*0.5,ey=dy/L*w*0.5;
      const n=Math.max(1,Math.ceil(L/2.5));let prev=null;
      for(let i=0;i<=n;i++){const f=i/n;let x=e.p[0]+dx*f,y=e.p[1]+dy*f;if(i===0){x-=ex;y-=ey;}if(i===n){x+=ex;y+=ey;}
        const hh=hGame(x,y)+LIFT;const [ax,az]=toW(x+nx,y+ny),[bx,bz]=toW(x-nx,y-ny);const base=pos.length/3;pos.push(ax,hh,az,bx,hh,bz);
        if(prev!==null)idx.push(prev,prev+1,base,prev+1,base+1,base);prev=base;}}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setIndex(idx);
    const m=new THREE.Mesh(geo,R.borderMat[key]||(R.borderMat[key]=new THREE.MeshBasicMaterial({color:COL[key],depthTest:false,depthWrite:false,side:THREE.DoubleSide})));
    m.renderOrder=1;R.borderG.add(m);}
}
const lodOf=d=>Math.max(0.35,Math.min(1.45,d/800));

/* ---------- 毎フレーム ---------- */
const V=new THREE.Vector3(),V2=new THREE.Vector3();
function frame(now){
  if(!running)return;
  if(!R.canvas.isConnected){running=false;return;}
  requestAnimationFrame(frame);
  // 描く回数をへらして軽くする：さわっている間・動きのあるときは毎回、何もしないときは1秒に12回、上に画面（合戦・結果など）が出ているときは1秒に4回
  {const act=R.tw||R.anim||now-(R.lastAct||0)<1500;const cov=document.getElementById('dlg');const covered=cov&&cov.classList.contains('on');
    // ほかのウィンドウを操作しているとき（1台で何人分も開いているときなど）は、1秒に2〜3回だけ描く
    const unf=!document.hasFocus();const gap=covered?250:act?0:unf?400:80;if(gap&&now-(R.lastDraw||0)<gap)return;R.lastDraw=now;}
  const dt=Math.min(0.05,(now-R.clock)/1000);R.clock=now;
  const cam=R.camera,ctl=R.controls;
  if(R.tw){const t=Math.min(1,(now-R.tw.t0)/R.tw.dur);const e=t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
    cam.position.lerpVectors(R.tw.p0,R.tw.p1,e);ctl.target.lerpVectors(R.tw.q0,R.tw.q1,e);if(t>=1)R.tw=null;}
  ctl.update();
  const dist=cam.position.distanceTo(ctl.target);
  // 遠くから見るときは駒を大きく
  const ps=Math.max(0.6,Math.min(2.3,dist/700));
  const af=Math.max(0,Math.min(1,(ARMY_FADE[1]-dist)/(ARMY_FADE[1]-ARMY_FADE[0])));R.af=af;const ak=0.35+0.65*af;
  const aOn=af>0.02;R.pieceG.visible=aOn;R.arrowG.visible=aOn;if(R.zocG)R.zocG.visible=aOn;
  if(R.zocMat){R.zocMat.opacity=af;R.zocEdge.opacity=0.55*af;}
  if(R.tagBox){const op=aOn?af.toFixed(2):'0';if(R.tagOp!==op){R.tagOp=op;R.tagBox.style.opacity=op;R.tagBox.style.visibility=aOn?'':'hidden';}}
  for(const g of R.pieceG.children){g.scale.setScalar(ps*ak);if(g.userData.sel){g.userData.sel.material.opacity=0.55+0.45*Math.sin(now/260);}}
  updateHi(dist,now);
  const k=lodOf(dist);if(!R.arrowK||Math.abs(k-R.arrowK)/R.arrowK>0.12){buildArrows(k);buildBorders(k);buildRoads(k);}
  R.dash.offset.x-=dt*1.2;
  const pulse=0.72+0.28*Math.sin(now/420);for(const m of R.arrowMats||[])if(m.color&&m!==undefined)m.opacity=(m.map?1:m.color.getHex()===0xfffdf6?0.85:1)*pulse*(R.af==null?1:R.af);
  // 移動のアニメーション
  if(R.anim)stepAnim(now,ps);
  // 建物は画面の上でほぼ同じ大きさ（最初のアイコンより少し大きいくらい）に見えるようにする。近づいたときだけ少し大きく見える
  const pps=Math.max(0.6,Math.min(1.5,dist/470));placeProps(pps);
  R.renderer.render(R.scene,cam);R.renderer.autoClear=false;R.renderer.render(R.scene2,cam);R.renderer.autoClear=true;
  // 地名
  const band=dist>1250?0:dist>650?1:2;
  if(band!==R.band){R.band=band;R.labels.dataset.band=band;}
  for(const L of R.alab){
    const show=band===2||L.main||(band===1&&L.sp);
    if(!show){if(L.vis!==false){L.d.style.display='none';L.vis=false;}continue;}
    V.set(...toWv(L.a.c),R.hc[L.a.id]+1+propTop(L.a,pps));V.set(V.x,V.z,V.y);// x,y,z
    V.project(cam);const vis=V.z<1&&Math.abs(V.x)<1.05&&Math.abs(V.y)<1.05;
    if(!vis){if(L.vis!==false){L.d.style.display='none';L.vis=false;}continue;}
    if(L.vis!==true){L.d.style.display='';L.vis=true;}
    L.d.style.transform=`translate(${((V.x+1)/2*R.W).toFixed(1)}px,${((1-V.y)/2*R.H).toFixed(1)}px)`;
  }
  // 家の名前：画面の上での大きさを地図の縮尺に合わせる。近づくとうすく
  if(R.hn.length){const op=dist>900?0.8:dist>450?0.55:0.22;if(R.hnOp!==op){R.hnOp=op;R.hnBox.style.opacity=op;}
    const W2=R.W/2,H2=R.H/2;
    for(const N of R.hn){V.set(N.x,N.y,N.z);V.project(cam);const vis=V.z<1&&Math.abs(V.x)<1.1&&Math.abs(V.y)<1.1;
      if(!vis){if(N.vis!==false){N.d.style.display='none';N.vis=false;}continue;}
      const sx=(V.x+1)*W2,sy=(1-V.y)*H2;V2.set(N.x+N.fs*0.5,N.y,N.z);V2.project(cam);const V3x=(V2.x+1)*W2,V3y=(1-V2.y)*H2;
      const px=Math.max(6,Math.hypot(V3x-sx,V3y-sy)*2);
      if(N.vis!==true){N.d.style.display='';N.vis=true;}
      N.d.style.transform=`translate(${sx.toFixed(1)}px,${sy.toFixed(1)}px) translate(-50%,-50%)`;N.d.style.fontSize=px.toFixed(1)+'px';}}
  // 軍勢の札
  for(const T of R.tags){V.copy(T.obj.position);V.y+=(PIECE_H+3)*ps*ak;V.project(cam);const vis=V.z<1&&Math.abs(V.x)<1.05&&Math.abs(V.y)<1.05&&T.obj.visible;
    T.el.style.display=vis?'':'none';if(vis)T.el.style.transform=`translate(${((V.x+1)/2*R.W).toFixed(1)}px,${((1-V.y)/2*R.H).toFixed(1)}px) scale(${ak.toFixed(2)})`;
    // 大将の名前（○○の軍勢）は駒の足もとに。遠いときは自分の軍勢と選んだ軍勢だけ
    // 兵の数はいつも、大将の名前は近いとき・自分の軍勢・選んだ軍勢だけ
    const showN=T.sel||(dist<520)||(band>=1&&T.me);
    if(!vis){T.nm.style.display='none';continue;}T.nm.classList.toggle('short',!showN);
    V.copy(T.obj.position);V.project(cam);T.nm.style.display='';T.nm.style.transform=`translate(${((V.x+1)/2*R.W).toFixed(1)}px,${((1-V.y)/2*R.H).toFixed(1)}px) scale(${ak.toFixed(2)})`;}
}
function toWv(c){const [x,z]=toW(c[0],c[1]);return [x,z];}

/* ---------- 移動のアニメーション ---------- */
function stepAnim(now,ps){
  const an=R.anim;const t=Math.min(1,(now-an.t0)/an.T);const e=t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
  for(const tr of an.tracks){let s=e*tr.tot,i=0;while(i<tr.L.length-1&&s>tr.L[i]){s-=tr.L[i];i++;}
    const a=tr.pts[i],b=tr.pts[i+1],f=tr.L[i]?Math.min(1,s/tr.L[i]):1;const x=a[0]+(b[0]-a[0])*f,y=a[1]+(b[1]-a[1])*f;
    const hop=Math.abs(Math.sin(e*Math.PI*6))*2.4*ps;const [wx,wz]=toW(x,y);
    tr.p.position.set(wx,hGame(x,y)+hop,wz);tr.p.rotation.y=Math.atan2(-(b[1]-a[1]),b[0]-a[0]);tr.p.scale.setScalar(ps);
    if(tr.lost&&t>0.8)tr.p.visible=t<0.97;}
  if(t>=1){for(const tr of an.tracks)R.animG.remove(tr.p);for(const g of R.pieceG.children)g.visible=true;const cb=an.done;R.anim=null;cb&&cb();}
}

/* ---------- 外から呼ぶ ---------- */
const T3D={
  ready:false,
  // 光の強さ（a：明るさ　w：にじむ幅の倍率）
  setGlow(a,w){if(!R)return;R.glowAmt.value=a;R.glowW=w||1;T3D.update();},
  async mount(mw){
    host=mw;
    if(!R){if(T3D.failed)return false;
      const ld=document.createElement('div');ld.className='v3load';ld.textContent='立体の地図を読みこんでいます…';mw.appendChild(ld);
      let ok=false;try{ok=await init();}catch(e){console.error(e);ok=false;}
      ld.remove();if(!ok){T3D.failed=true;R=null;return false;}
      T3D.ready=true;}
    if(host!==mw)return false;
    mw.appendChild(R.canvas);mw.appendChild(R.labels);
    R.ro.disconnect();R.ro.observe(mw);resize();
    R.band=null;for(const L of R.alab)L.vis=null;
    T3D.update();
    if(!running){running=true;R.clock=performance.now();requestAnimationFrame(frame);}
    if(VIEW3D.props&&!R.propsLoading)setTimeout(()=>loadProps(),50);
    // 高解像度の地面（4096px）を、ほかの読みこみが終わったあとで差しかえる
    if(VIEW3D.texHi&&!R.hiLoading&&R.renderer.capabilities.maxTextureSize>=4096){R.hiLoading=true;setTimeout(()=>{new THREE.TextureLoader().loadAsync(VIEW3D.texHi).then(t=>{t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(8,R.renderer.capabilities.getMaxAnisotropy());t.generateMipmaps=true;const m=R.land.material;const old=m.map;m.map=t;m.needsUpdate=true;if(old)old.dispose();}).catch(e=>console.warn('texHi',e));},1500);}
    return true;
  },
  unmount(){running=false;if(R){R.canvas.remove();R.labels.remove();R.ro.disconnect();}host=null;},
  update(){if(!R||!S||!host)return;R.lastAct=performance.now();for(const L of R.alab){const sg=S.siege&&S.siege[L.a.id];const sp=L.d.querySelector('span');if(sp)sp.textContent=sg?`${L.a.n}（籠城 あと${sg.left}）`:L.a.n;L.d.classList.toggle('sg',!!sg);}drawOverlay();buildPieces();buildZoc();buildHouseNames();R.arrowK=null;},
  view(target,dist,dur=600){const cam=R.camera,ctl=R.controls;
    // 今の向きを保ったまま、近づく・離れる
    const dir=cam.position.clone().sub(ctl.target);if(dir.length()<1)dir.set(0,0.74,0.67);dir.normalize();
    const minY=0.6;if(dir.y<minY){dir.y=minY;dir.normalize();}
    R.tw={t0:performance.now(),dur,p0:cam.position.clone(),q0:ctl.target.clone(),q1:target.clone(),p1:target.clone().add(dir.multiplyScalar(dist))};},
  fit(){if(!R)return;T3D.focus(AREAS.map(a=>a.id),40);},
  focus(list,pad=160){if(!R)return;if(!list.length)return T3D.fit();
    let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(const a of list){const c=A[a].c;x0=Math.min(x0,c[0]);y0=Math.min(y0,c[1]);x1=Math.max(x1,c[0]);y1=Math.max(y1,c[1]);}
    const [wx,wz]=toW((x0+x1)/2,(y0+y1)/2);const ext=Math.max(220,x1-x0+pad,(y1-y0+pad)*(R.W||1200)/(R.H||700));
    T3D.view(new THREE.Vector3(wx,0,wz+20),Math.min(2400,Math.max(160,ext*1.15)));},
  zoom(f){if(!R)return;const ctl=R.controls;const d=R.camera.position.distanceTo(ctl.target);
    T3D.view(ctl.target.clone(),Math.min(ctl.maxDistance,Math.max(ctl.minDistance,d*f)),350);},
  animate(tracks,done){
    if(!R||!host){done();return;}
    const ids=new Set(tracks.map(t=>String(t.id)));
    for(const g of R.pieceG.children)if(ids.has(String(g.userData.id)))g.visible=false;
    const list=[];
    for(const tr of tracks){const ar=S.armies.find(x=>x.id==tr.id);
      // 動き始めと着いた所も、城のそばの街道の上にする
      if(tr.path&&tr.path.length>1){tr.pts=tr.pts.slice();tr.pts[0]=standToward(tr.path[0],tr.path[1]);const n=tr.path.length;tr.pts[tr.pts.length-1]=ar&&ar.a===tr.path[n-1]?standPos(ar):standToward(tr.path[n-1],tr.path[n-2]);}const p=makePiece(pieceCol(tr.h),tr.h,ar?kindOf(ar):'ashi',isLord(ar));setOrder(p,2);R.animG.add(p);
      const L=[];let tot=0;for(let i=1;i<tr.pts.length;i++){const d=Math.hypot(tr.pts[i][0]-tr.pts[i-1][0],tr.pts[i][1]-tr.pts[i-1][1]);L.push(d);tot+=d;}
      list.push({p,pts:tr.pts,L,tot,lost:tr.lost});}
    if(!list.length){for(const g of R.pieceG.children)g.visible=true;done();return;}
    R.anim={t0:performance.now(),T:1900,tracks:list,done};
  }
};
window.T3D=T3D;
if(typeof window.onT3D==='function'){const f=window.onT3D;window.onT3D=null;f();}
