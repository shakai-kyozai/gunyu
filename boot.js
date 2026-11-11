/* 群雄割拠　起動用（GitHub Pages でも GAS でも同じものを使う） */
(function(){
  var B=window.GUNYU_BASE||'';
  if(B&&!document.querySelector('base[href]')){var b=document.createElement('base');b.href=B;document.head.prepend(b);}
  function css(h){var l=document.createElement('link');l.rel='stylesheet';l.href=h;document.head.appendChild(l);}
  css('https://fonts.googleapis.com/css2?family=BIZ+UDPGothic:wght@400;700&family=BIZ+UDPMincho:wght@400;700&family=Yuji+Syuku&display=swap');
  css(B+'style.css');
  if(!document.getElementById('app')){
    document.body.insertAdjacentHTML('afterbegin',
      '<div id="ticker"><span class="lab">天下のうわさ</span><span class="run" id="tickrun"></span></div>'+
      '<div id="app"></div><div id="dlg"><div id="dlgBox"></div></div><div id="tip"></div>');
  }
  var list=['js/mapdata2.js','js/roadpaths.js','data.js','js/icons.js','js/fx.js','js/engine4.js','js/ui5.js','js/sfx.js'];
  function fail(f){document.getElementById('app').innerHTML='<p style="padding:2em;font-size:18px">読みこみに失敗しました（'+f+'）。ページを読みこみ直してください。</p>';}
  function next(i){
    var s=document.createElement('script');
    if(i<list.length){s.src=B+list[i];s.onload=function(){next(i+1);};}
    else{s.type='module';s.src=B+'js/view3d.js';}
    s.onerror=function(){if(i<list.length)fail(s.src);else console.warn('3D map failed',s.src);};
    document.body.appendChild(s);
  }
  next(0);
  // 読みこんだ版を、画面の左下に小さく出す（新しい版が届いているかを確かめるため）
  const m=(B||'').match(/@([0-9a-z.\-]+)\//);const v=m?m[1]:'';
  if(v){const t=document.createElement('div');t.id='verTag';t.textContent='版 '+(v.length===40?v.slice(0,7):v);
    t.style.cssText='position:fixed;left:6px;bottom:4px;z-index:200;font:11px "BIZ UDPGothic",sans-serif;color:#c9b48a;opacity:.6;pointer-events:none';document.body.appendChild(t);}
})();
