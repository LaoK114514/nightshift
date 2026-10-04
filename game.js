(function(){
try {
/* ============================================================
   精神病院·夜班 v2 — 3D 恐怖生存
   3 层楼、楼梯切换、程序化纹理、实时阴影、天台月色
   ============================================================ */

/* ---------------- 常量 ---------------- */
var NIGHT_DURATION = 240;
var EYE_HEIGHT = 1.55;
var PLAYER_RADIUS = 0.35;
var WALK_SPEED = 4.0, SPRINT_SPEED = 6.4;
var FLOORS = 3;
var FLOOR_H = 4.4;
var FLOOR_NAMES = ['1F 病房层', '2F 实验层', '3F 天台'];

/* ---------------- DOM ---------------- */
var $ = function(id){ return document.getElementById(id); };
var canvas = $('game');
var elHpFill = $('healthfill'), elHpText = $('hptext');
var elTime = $('time'), elDawnFill = $('dawnfill'), elDawnLabel = $('dawnlabel');
var elFloorLabel = $('floorlabel');
var elWeaponName = $('weaponname'), elMag = $('mag'), elReserve = $('reserve');
var elCrosshair = $('crosshair'), elMessage = $('message');
var elStick = $('stick'), elJoystick = $('joystick');
var elStatic = $('static'), elDmg = $('dmgflash'), elLowhp = $('lowhp');
var elDoorbtn = $('doorbtn');
var elDiffbtn = $('diffbtn');
var elGfxbtn = $('gfxbtn');
var elFade = $('fade');
var elHeal = $('healflash');
var elLoading = $('loading');
var elFps = $('fps');
var debugOn = /[?&]debug=1/.test(location.search);
if(debugOn && elFps) elFps.style.display = 'block';
var elFlashbtn = $('flashbtn');
var elRunbtn = $('runbtn');
var elStamFill = $('stamfill');
var elThreat = $('threat');
var elSanityFill = $('sanityfill');
var elSanityState = $('sanitystate');
var elObjectives = $('objectives');
var elStickbtn = $('stickbtn');
var elHidebtn = $('hidebtn'), elHideView = $('hideview');
var elRotate = $('rotate');
var elScreen = $('screen'), elStartBtn = $('startbtn');

/* ---------------- 音频 ---------------- */
var AudioSys = {
  ctx:null, master:null, _nb:null, dead:false,
  safe:function(fn){ if(this.dead) return; try { fn(); } catch(e){ this.dead = true; } },
  init(){ if(this.ctx) return; try{ this.ctx = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ this.ctx=null; return; }
    this.master = this.ctx.createGain(); this.master.gain.value = 0.75; this.master.connect(this.ctx.destination); },
  resume(){ if(this.ctx && this.ctx.state==='suspended') this.ctx.resume(); },
  now(){ return this.ctx ? this.ctx.currentTime : 0; },
  noiseBuffer(){ if(!this.ctx) return null; if(!this._nb){ var len=this.ctx.sampleRate*2; var b=this.ctx.createBuffer(1,len,this.ctx.sampleRate); var d=b.getChannelData(0); for(var i=0;i<len;i++) d[i]=Math.random()*2-1; this._nb=b; } return this._nb; },
  tone(freq,dur,type,gain,freqEnd){
    if(!this.ctx) return; var t=this.now(); var o=this.ctx.createOscillator(); var g=this.ctx.createGain();
    o.type=type||'sine'; o.frequency.setValueAtTime(freq,t);
    if(freqEnd) o.frequency.exponentialRampToValueAtTime(Math.max(1,freqEnd),t+dur);
    g.gain.setValueAtTime(gain,t); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t+dur+0.03);
  },
  noise(dur,gain,freq,type){
    if(!this.ctx) return; var t=this.now(); var s=this.ctx.createBufferSource(); s.buffer=this.noiseBuffer(); s.loop=true;
    var f=this.ctx.createBiquadFilter(); f.type=type||'lowpass'; f.frequency.value=freq||2000;
    var g=this.ctx.createGain(); g.gain.setValueAtTime(gain,t); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t); s.stop(t+dur+0.03);
  },
  startAmbient(){
    if(!this.ctx) return; var ctx=this.ctx, t=this.now();
    var g=ctx.createGain(); g.gain.value=0.10; g.connect(this.master);
    var o1=ctx.createOscillator(); o1.type='sine'; o1.frequency.value=52;
    var o2=ctx.createOscillator(); o2.type='sine'; o2.frequency.value=56;
    var o3=ctx.createOscillator(); o3.type='sawtooth'; o3.frequency.value=28; var g3=ctx.createGain(); g3.gain.value=0.05;
    var n=ctx.createBufferSource(); n.buffer=this.noiseBuffer(); n.loop=true;
    var nf=ctx.createBiquadFilter(); nf.type='lowpass'; nf.frequency.value=160; var ng=ctx.createGain(); ng.gain.value=0.06;
    o1.connect(g); o2.connect(g); o3.connect(g3); g3.connect(g); n.connect(nf); nf.connect(ng); ng.connect(g);
    o1.start(t); o2.start(t); o3.start(t); n.start(t);
  },
  gunshot(power){ var self = this; this.safe(function(){ self.noise(0.13, 0.45*power, 2400); self.tone(140,0.09,'square',0.22, 42); self.noise(0.05, 0.25, 6000, 'highpass'); }); },
  reload(){ var t=this.now(); this.tone(950,0.04,'square',0.12); this.tone(700,0.05,'square',0.12); this.tone(1000,0.03,'square',0.1); },
  reloadEnd(){ this.tone(500,0.05,'square',0.14); this.tone(1300,0.03,'square',0.1); },
  hurt(){ this.tone(95,0.28,'sine',0.5,45); this.noise(0.16,0.22,420); },
  shriek(){ this.tone(900,0.55,'sawtooth',0.18,1700); this.tone(1400,0.4,'sine',0.1,2200); this.noise(0.3,0.1,3000,'bandpass'); },
  roar(){ this.tone(70,0.8,'sawtooth',0.28,50); this.tone(120,0.6,'square',0.12,80); },
  whisper(){ this.noise(0.4,0.14,700,'bandpass'); this.tone(280,0.4,'sine',0.08,190); },
  pickup(){ this.tone(660,0.1,'sine',0.22); this.tone(990,0.14,'sine',0.22); this.tone(1320,0.18,'sine',0.18); },
  empty(){ this.tone(1500,0.03,'square',0.1); },
  door(){ this.noise(0.4, 0.12, 900, 'bandpass'); this.tone(85, 0.5, 'sawtooth', 0.1, 60); this.tone(140, 0.3, 'square', 0.05, 90); },
  heal(){ this.tone(520,0.12,'sine',0.2); this.tone(780,0.18,'sine',0.18); this.tone(1040,0.24,'sine',0.12); },
  bang(){ this.noise(0.09, 0.32, 500); this.tone(70, 0.09, 'square', 0.22, 45); },
  heartbeat(){ this.tone(55,0.12,'sine',0.5,38); },
  stairs(){ this.tone(220,0.25,'sine',0.18, 160); this.tone(330,0.3,'sine',0.12, 240); }
};

/* ---------------- 小工具 ---------------- */
function clamp(v,a,b){ return v<a?a:(v>b?b:v); }
function rand(a,b){ return a + Math.random()*(b-a); }
function randi(a,b){ return Math.floor(rand(a,b+1)); }
function dist2(ax,az,bx,bz){ var dx=ax-bx,dz=az-bz; return dx*dx+dz*dz; }
function floorY(f){ return f*FLOOR_H; }

/* ---------------- Three.js 初始化 ---------------- */
var scene = new THREE.Scene();
scene.background = new THREE.Color(0x04050a);
scene.fog = new THREE.FogExp2(0x04060c, 0.11);

var renderer = new THREE.WebGLRenderer({canvas:canvas, antialias:true, powerPreference:'high-performance'});
var PXR = 0.6;
renderer.setPixelRatio(PXR);
renderer.setSize(window.innerWidth, window.innerHeight);
if('useLegacyLights' in renderer) renderer.useLegacyLights = true;
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = false;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

/* ---------------- 后处理：泛光 + 调色 + 暗角 + 颗粒 ---------------- */
var PostFX = (function(){
  var w = Math.max(64, Math.floor(window.innerWidth * PXR));
  var h = Math.max(64, Math.floor(window.innerHeight * PXR));
  var sceneRT = new THREE.WebGLRenderTarget(w, h, {minFilter:THREE.LinearFilter, magFilter:THREE.LinearFilter});
  var gw = Math.max(64, Math.floor(w/2)), gh = Math.max(64, Math.floor(h/2));
  var glowA = null, glowB = null;
  function ensureGlow(){
    if(glowA) return;
    glowA = new THREE.WebGLRenderTarget(gw, gh, {minFilter:THREE.LinearFilter, magFilter:THREE.LinearFilter});
    glowB = new THREE.WebGLRenderTarget(gw, gh, {minFilter:THREE.LinearFilter, magFilter:THREE.LinearFilter});
  }
  var fxScene = new THREE.Scene();
  var fxCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  var brightMat = new THREE.ShaderMaterial({
    uniforms: { tScene:{value:sceneRT.texture}, threshold:{value:0.62}, intensity:{value:1.0} },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }',
    fragmentShader: 'uniform sampler2D tScene; uniform float threshold; uniform float intensity; varying vec2 vUv; void main(){ vec4 c=texture2D(tScene,vUv); float b=max(c.r,max(c.g,c.b)); float wd=smoothstep(threshold,1.05,b); gl_FragColor=vec4(c.rgb*wd*intensity,1.0); }'
  });
  var blurMat = new THREE.ShaderMaterial({
    uniforms: { tSrc:{value:null}, dir:{value:new THREE.Vector2(1,0)}, res:{value:new THREE.Vector2(gw,gh)} },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }',
    fragmentShader: 'uniform sampler2D tSrc; uniform vec2 dir; uniform vec2 res; varying vec2 vUv; void main(){ vec2 o=dir/res; vec3 c=texture2D(tSrc,vUv).rgb*0.227027; c+=texture2D(tSrc,vUv+o*1.384615).rgb*0.316216; c+=texture2D(tSrc,vUv-o*1.384615).rgb*0.316216; c+=texture2D(tSrc,vUv+o*3.230769).rgb*0.070270; c+=texture2D(tSrc,vUv-o*3.230769).rgb*0.070270; gl_FragColor=vec4(c,1.0); }'
  });
  var finalMat = new THREE.ShaderMaterial({
    uniforms: {
      tScene:{value:sceneRT.texture}, tGlow:{value:null}, time:{value:0},
      res:{value:new THREE.Vector2(w,h)}, glowAmount:{value:0.85}, vignette:{value:0.85},
      grain:{value:0.028}, saturation:{value:1.08}, exposure:{value:1.05}, caAmount:{value:0.0035}
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }',
    fragmentShader: 'uniform sampler2D tScene; uniform sampler2D tGlow; uniform float time; uniform vec2 res; uniform float glowAmount; uniform float vignette; uniform float grain; uniform float saturation; uniform float exposure; uniform float caAmount; varying vec2 vUv; float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); } void main(){ vec2 uv=vUv; vec2 cc=uv-0.5; float ca=dot(cc,cc)*caAmount; float r=texture2D(tScene, uv+cc*ca).r; vec2 gb=texture2D(tScene, uv).gb; float bb=texture2D(tScene, uv-cc*ca).b; vec3 col=vec3(r,gb.x,bb); col += texture2D(tGlow, uv).rgb*glowAmount; col *= exposure; col = clamp(col,0.0,1.0); col = col*(2.51*col+0.03)/(col*(2.43*col+0.59)+0.14); float lum=dot(col,vec3(0.299,0.587,0.114)); col = mix(vec3(lum), col, saturation); col.r*=1.04; col.g*=1.0; col.b*=0.98; col = clamp(col,0.0,1.0); float vd=length(cc)*1.35; col *= 1.0 - vignette*smoothstep(0.42,1.15,vd); col += (hash(uv*res+time)-0.5)*grain; col = pow(clamp(col,0.0,1.0), vec3(0.4545)); gl_FragColor = vec4(col,1.0); }'
  });
  var quad = new THREE.Mesh(new THREE.PlaneGeometry(2,2), finalMat);
  fxScene.add(quad);
  var enabled = true;
  var glowOn = false;
  function resize(){
    w = Math.max(64, Math.floor(window.innerWidth * PXR));
    h = Math.max(64, Math.floor(window.innerHeight * PXR));
    sceneRT.setSize(w, h);
    gw = Math.max(64, Math.floor(w/2)); gh = Math.max(64, Math.floor(h/2));
    if(glowA){ glowA.setSize(gw, gh); glowB.setSize(gw, gh); }
    blurMat.uniforms.res.value.set(gw, gh);
    finalMat.uniforms.res.value.set(w, h);
  }
  function render(renderer, scene, camera){
    finalMat.uniforms.time.value = performance.now() * 0.001;
    renderer.setRenderTarget(sceneRT);
    renderer.render(scene, camera);
    if(glowOn){
      ensureGlow();
      brightMat.uniforms.tScene.value = sceneRT.texture;
      quad.material = brightMat;
      renderer.setRenderTarget(glowA);
      renderer.render(fxScene, fxCam);
      blurMat.uniforms.tSrc.value = glowA.texture;
      blurMat.uniforms.dir.value.set(1.5, 0);
      quad.material = blurMat;
      renderer.setRenderTarget(glowB);
      renderer.render(fxScene, fxCam);
      blurMat.uniforms.tSrc.value = glowB.texture;
      blurMat.uniforms.dir.value.set(0, 1.5);
      quad.material = blurMat;
      renderer.setRenderTarget(glowA);
      renderer.render(fxScene, fxCam);
      finalMat.uniforms.tGlow.value = glowA.texture;
      finalMat.uniforms.glowAmount.value = 0.85;
    } else {
      finalMat.uniforms.glowAmount.value = 0.0;
    }
    finalMat.uniforms.tScene.value = sceneRT.texture;
    quad.material = finalMat;
    renderer.setRenderTarget(null);
    renderer.render(fxScene, fxCam);
  }
  /* 理智驱动的画面扭曲：v=1 清醒 / v=0 崩溃 */
  function setMood(v){
    var k = 1 - (v < 0 ? 0 : (v > 1 ? 1 : v));
    finalMat.uniforms.grain.value = 0.028 + k*0.085;
    finalMat.uniforms.caAmount.value = 0.0035 + k*0.016;
    finalMat.uniforms.vignette.value = 0.85 + k*0.30;
    finalMat.uniforms.saturation.value = 1.08 - k*0.5;
  }
  return { render:render, resize:resize, enabled:function(){ return enabled; }, setEnabled:function(v){ enabled = v; }, setGlow:function(v){ glowOn = v; }, glow:function(){ return glowOn; }, setMood:setMood };
})();

var camera = new THREE.PerspectiveCamera(72, window.innerWidth/window.innerHeight, 0.05, 90);
camera.rotation.order = 'YXZ';
scene.add(camera);

/* ---------------- 程序化纹理（高分辨率 + 法线 + 环境反射） ---------------- */
function makeCanvas(w, h, draw){
  var c = document.createElement('canvas');
  if(typeof h === 'function'){ draw = h; h = w; }
  c.width = w; c.height = h;
  var ctx = c.getContext('2d');
  draw(ctx, w, h);
  return c;
}
function tex(canvas, repX, repY){
  var t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  if(repX) t.repeat.set(repX, repY || repX);
  return t;
}
function noiseCanvas(w, h, base, amp){
  return makeCanvas(w, h, function(ctx, w, h){
    var img = ctx.createImageData(w, h);
    for(var i = 0; i < img.data.length; i += 4){
      var v = base + Math.random() * amp | 0;
      img.data[i] = v; img.data[i+1] = v; img.data[i+2] = v; img.data[i+3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  });
}
function heightToNormal(hc, strength){
  var w = hc.width, h = hc.height;
  var img = hc.getContext('2d').getImageData(0, 0, w, h).data;
  var out = document.createElement('canvas'); out.width = w; out.height = h;
  var octx = out.getContext('2d');
  var od = octx.createImageData(w, h);
  for(var y = 0; y < h; y++){
    for(var x = 0; x < w; x++){
      var xl = x > 0 ? x-1 : 0, xr = x < w-1 ? x+1 : w-1, yu = y > 0 ? y-1 : 0, yd = y < h-1 ? y+1 : h-1;
      var l = img[(y*w+xl)*4], r = img[(y*w+xr)*4], u = img[(yu*w+x)*4], d = img[(yd*w+x)*4];
      var nx = (l - r) * strength, ny = (u - d) * strength, nz = 128;
      var len = Math.sqrt(nx*nx + ny*ny + nz*nz);
      var i = (y*w + x) * 4;
      od.data[i]   = (nx/len*0.5 + 0.5) * 255;
      od.data[i+1] = (ny/len*0.5 + 0.5) * 255;
      od.data[i+2] = (nz/len*0.5 + 0.5) * 255;
      od.data[i+3] = 255;
    }
  }
  octx.putImageData(od, 0, 0);
  return out;
}
// 地板：瓷砖 + 污渍 + 划痕
var floorCanvas = (function(){
  var s = 256, c = makeCanvas(s, s, function(ctx){
    ctx.fillStyle = '#2a3136'; ctx.fillRect(0, 0, s, s);
    var g = ctx.createLinearGradient(0, 0, s, s);
    g.addColorStop(0, 'rgba(255,255,255,0.06)'); g.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(8,10,12,0.55)'; ctx.lineWidth = 3;
    for(var i = 0; i <= s; i += 64){
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(s, i); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1;
    for(var j = 0; j <= s; j += 64){ ctx.beginPath(); ctx.moveTo(j+2, 0); ctx.lineTo(j+2, s); ctx.stroke(); }
    for(var k = 0; k < 170; k++){
      ctx.fillStyle = 'rgba(0,0,0,' + rand(0.02, 0.14) + ')';
      ctx.beginPath(); ctx.arc(rand(0, s), rand(0, s), rand(2, 18), 0, 6.29); ctx.fill();
    }
    for(var m = 0; m < 55; m++){
      ctx.fillStyle = 'rgba(110,84,52,' + rand(0.03, 0.1) + ')';
      ctx.beginPath(); ctx.arc(rand(0, s), rand(0, s), rand(1, 7), 0, 6.29); ctx.fill();
    }
    for(var n = 0; n < 46; n++){
      ctx.strokeStyle = 'rgba(255,255,255,' + rand(0.02, 0.05) + ')'; ctx.lineWidth = 1;
      var px = rand(0, s), py = rand(0, s);
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + rand(-30, 30), py + rand(-30, 30)); ctx.stroke();
    }
  });
  return c;
})();
var floorHeight = (function(){
  var s = 256, c = makeCanvas(s, s, function(ctx){
    ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#3d3d3d';
    for(var i = 0; i <= s; i += 64){ ctx.fillRect(i-2, 0, 4, s); ctx.fillRect(0, i-2, s, 4); }
    var img = ctx.getImageData(0, 0, s, s);
    for(var y = 0; y < s; y++) for(var x = 0; x < s; x++){
      var i4 = (y*s+x)*4, v = img.data[i4] + (Math.random()*36|0);
      img.data[i4] = img.data[i4+1] = img.data[i4+2] = v > 255 ? 255 : v;
    }
    ctx.putImageData(img, 0, 0);
  });
  return c;
})();
// 墙面：石膏 + 霉斑 + 裂缝
var wallCanvas = (function(){
  var s = 256, c = makeCanvas(s, s, function(ctx){
    ctx.fillStyle = '#59604f'; ctx.fillRect(0, 0, s, s);
    var g = ctx.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, 'rgba(255,255,255,0.07)'); g.addColorStop(0.55, 'rgba(0,0,0,0.12)'); g.addColorStop(1, 'rgba(0,0,0,0.32)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    for(var i = 0; i < 95; i++){
      var x = rand(0, s), w = rand(2, 12);
      ctx.fillStyle = 'rgba(16,20,14,' + rand(0.03, 0.12) + ')';
      ctx.fillRect(x, 0, w, s);
    }
    for(var m = 0; m < 26; m++){
      var mx = rand(0, s), my = rand(0, s), mr = rand(4, 16);
      var rg = ctx.createRadialGradient(mx, my, 0, mx, my, mr);
      rg.addColorStop(0, 'rgba(60,70,40,' + rand(0.06, 0.14) + ')'); rg.addColorStop(1, 'rgba(60,70,40,0)');
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(mx, my, mr, 0, 6.29); ctx.fill();
    }
    for(var j = 0; j < 10; j++){
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1;
      var px = rand(0, s), py = rand(0, s);
      ctx.beginPath(); ctx.moveTo(px, py);
      for(var k = 0; k < 7; k++){ px += rand(-18, 18); py += rand(8, 26); ctx.lineTo(px, py); }
      ctx.stroke();
    }
    for(var l = 0; l < 320; l++){
      ctx.fillStyle = 'rgba(0,0,0,' + rand(0.02, 0.08) + ')';
      ctx.beginPath(); ctx.arc(rand(0, s), rand(0, s), rand(0.5, 3), 0, 6.29); ctx.fill();
    }
  });
  return c;
})();
var wallHeight = (function(){
  var s = 256, c = makeCanvas(s, s, function(ctx){
    ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, s, s);
    var img = ctx.getImageData(0, 0, s, s);
    for(var y = 0; y < s; y++) for(var x = 0; x < s; x++){
      var i4 = (y*s+x)*4, v = img.data[i4] + (Math.random()*70|0);
      img.data[i4] = img.data[i4+1] = img.data[i4+2] = v > 255 ? 255 : v;
    }
    ctx.putImageData(img, 0, 0);
    ctx.strokeStyle = '#4c4c4c'; ctx.lineWidth = 2;
    for(var j = 0; j < 8; j++){
      var px = rand(0, s), py = rand(0, s);
      ctx.beginPath(); ctx.moveTo(px, py);
      for(var k = 0; k < 6; k++){ px += rand(-20, 20); py += rand(10, 30); ctx.lineTo(px, py); }
      ctx.stroke();
    }
  });
  return c;
})();
// 天花板：混凝土 + 水渍
var ceilCanvas = (function(){
  var s = 128, c = makeCanvas(s, s, function(ctx){
    ctx.fillStyle = '#26292d'; ctx.fillRect(0, 0, s, s);
    var g = ctx.createRadialGradient(s/2, s/2, 10, s/2, s/2, s/1.3);
    g.addColorStop(0, 'rgba(255,255,255,0.06)'); g.addColorStop(1, 'rgba(0,0,0,0.38)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    var img = ctx.getImageData(0, 0, s, s);
    for(var i = 0; i < img.data.length; i += 4){
      var v = img.data[i] + (Math.random()*30-15|0);
      img.data[i] = img.data[i+1] = img.data[i+2] = v < 0 ? 0 : (v > 255 ? 255 : v);
    }
    ctx.putImageData(img, 0, 0);
    for(var j = 0; j < 6; j++){
      var mx = rand(0, s), my = rand(0, s), mr = rand(10, 30);
      var rg = ctx.createRadialGradient(mx, my, 0, mx, my, mr);
      rg.addColorStop(0, 'rgba(80,70,40,' + rand(0.08, 0.16) + ')'); rg.addColorStop(1, 'rgba(80,70,40,0)');
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(mx, my, mr, 0, 6.29); ctx.fill();
    }
  });
  return c;
})();
var ceilHeight = noiseCanvas(128, 128, 128, 60);
// 血迹（更细腻的喷溅）
var bloodCanvas = (function(){
  var s = 128, c = makeCanvas(s, s, function(ctx){
    ctx.clearRect(0, 0, s, s);
    for(var i = 0; i < 34; i++){
      var x = rand(6, s-6), y = rand(6, s-6), r = rand(2, 18);
      ctx.fillStyle = '#3c0909'; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.29); ctx.fill();
      ctx.fillStyle = '#3c0909';
      for(var d = 0; d < 4; d++){
        var a = rand(0, 6.29), rr = rand(r*0.5, r*2.2);
        ctx.beginPath(); ctx.arc(x + Math.cos(a)*rr*0.6, y + Math.sin(a)*rr*0.6, rand(1, 4), 0, 6.29); ctx.fill();
      }
    }
    for(var j = 0; j < 16; j++){ ctx.fillStyle = '#701212'; ctx.beginPath(); ctx.arc(rand(6, s-6), rand(6, s-6), rand(1, 6), 0, 6.29); ctx.fill(); }
    for(var k = 0; k < 130; k++){ ctx.fillStyle = 'rgba(150,20,20,' + rand(0.15, 0.5) + ')'; ctx.fillRect(rand(0, s), rand(0, s), 1, 1); }
  });
  return c;
})();
// 木纹（门/枪托/家具）
var woodCanvas = makeCanvas(256, 256, function(ctx, w, h){
  ctx.fillStyle = '#46311f'; ctx.fillRect(0, 0, w, h);
  for(var i = 0; i <= w; i += 64){ ctx.fillStyle = 'rgba(20,12,6,0.55)'; ctx.fillRect(i-1, 0, 2, h); }
  for(var j = 0; j < 90; j++){
    ctx.strokeStyle = 'rgba(30,18,8,' + rand(0.08, 0.3) + ')'; ctx.lineWidth = 1;
    var x = rand(0, w), y = rand(0, h);
    ctx.beginPath(); ctx.moveTo(x, y);
    for(var k = 0; k < 5; k++){ x += rand(-4, 4); y += rand(6, 14); ctx.lineTo(x, y); }
    ctx.stroke();
  }
  for(var m = 0; m < 5; m++){
    var kx = rand(20, w-20), ky = rand(20, h-20);
    ctx.fillStyle = 'rgba(30,16,8,0.8)';
    ctx.beginPath(); ctx.ellipse(kx, ky, rand(3, 6), rand(4, 8), rand(0, 3), 0, 6.29); ctx.fill();
    ctx.strokeStyle = 'rgba(70,44,22,0.7)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(kx, ky, rand(5, 9), rand(7, 12), rand(0, 3), 0, 6.29); ctx.stroke();
  }
  for(var n = 0; n < 20; n++){ ctx.fillStyle = 'rgba(0,0,0,' + rand(0.05, 0.16) + ')'; ctx.beginPath(); ctx.arc(rand(0, w), rand(0, h), rand(2, 8), 0, 6.29); ctx.fill(); }
});
// 拉丝金属
var metalCanvas = makeCanvas(128, 128, function(ctx, w, h){
  ctx.fillStyle = '#4c5158'; ctx.fillRect(0, 0, w, h);
  for(var i = 0; i < h; i++){
    var v = 70 + Math.random() * 26 | 0;
    ctx.fillStyle = 'rgba(' + v + ',' + (v+4) + ',' + (v+10) + ',0.5)';
    ctx.fillRect(0, i, w, 1);
  }
  for(var j = 0; j < 16; j++){ ctx.fillStyle = 'rgba(180,190,200,' + rand(0.05, 0.16) + ')'; ctx.fillRect(rand(0, w), rand(0, h), rand(2, 14), 1); }
  for(var k = 0; k < 8; k++){ ctx.fillStyle = 'rgba(0,0,0,' + rand(0.1, 0.3) + ')'; ctx.fillRect(0, rand(0, h), w, rand(1, 2)); }
});
// 病号服布料
var fabricCanvas = makeCanvas(256, 256, function(ctx, w, h){
  ctx.fillStyle = '#6f7f8b'; ctx.fillRect(0, 0, w, h);
  for(var i = 0; i < h; i += 4){ ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(0, i, w, 1); }
  for(var i = 0; i < w; i += 4){ ctx.fillStyle = 'rgba(0,0,0,0.05)'; ctx.fillRect(i, 0, 1, h); }
  for(var j = 0; j < 26; j++){
    ctx.strokeStyle = 'rgba(40,50,58,' + rand(0.1, 0.3) + ')'; ctx.lineWidth = rand(1, 3);
    var x = rand(0, w), y = 0;
    ctx.beginPath(); ctx.moveTo(x, y);
    for(var k = 0; k < 8; k++){ x += rand(-8, 8); y += 32; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  for(var m = 0; m < 30; m++){ ctx.fillStyle = 'rgba(30,24,16,' + rand(0.05, 0.2) + ')'; ctx.beginPath(); ctx.arc(rand(0, w), rand(0, h), rand(1, 6), 0, 6.29); ctx.fill(); }
});
// 毛毯
var blanketCanvas = makeCanvas(256, 256, function(ctx, w, h){
  ctx.fillStyle = '#5f6b58'; ctx.fillRect(0, 0, w, h);
  for(var i = 0; i < h; i += 3){ ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fillRect(0, i, w, 1); }
  for(var j = 0; j < 14; j++){
    ctx.strokeStyle = 'rgba(30,36,26,' + rand(0.15, 0.4) + ')'; ctx.lineWidth = rand(2, 5);
    var x = 0, y = rand(0, h);
    ctx.beginPath(); ctx.moveTo(x, y);
    for(var k = 0; k < 8; k++){ x += 32; y += rand(-6, 6); ctx.lineTo(x, y); }
    ctx.stroke();
  }
});
// 皮肤
var skinCanvas = makeCanvas(128, 128, function(ctx, w, h){
  ctx.fillStyle = '#d9c0a8'; ctx.fillRect(0, 0, w, h);
  for(var i = 0; i < 400; i++){ ctx.fillStyle = 'rgba(160,130,105,' + rand(0.03, 0.12) + ')'; ctx.fillRect(rand(0, w), rand(0, h), 1, 1); }
  ctx.fillStyle = 'rgba(255,240,220,0.06)'; ctx.fillRect(0, 0, w, 12);
});
// 疯医生面孔（手术帽+口罩+血丝眼）
var faceDoctorCanvas = makeCanvas(128, 128, function(ctx, w, h){
  ctx.fillStyle = '#d9c0a8'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#5e7d8c'; ctx.fillRect(0, 0, w, 26);
  ctx.fillStyle = '#e8ecf0'; ctx.fillRect(28, 58, 72, 34);
  ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 1;
  for(var i=0;i<3;i++){ ctx.beginPath(); ctx.moveTo(28, 66+i*11); ctx.lineTo(100, 66+i*11); ctx.stroke(); }
  ctx.fillStyle = '#f2ede2';
  ctx.beginPath(); ctx.ellipse(44, 46, 9, 6, 0, 0, 6.29); ctx.fill();
  ctx.beginPath(); ctx.ellipse(84, 46, 9, 6, 0, 0, 6.29); ctx.fill();
  ctx.fillStyle = '#2a0d0d';
  ctx.beginPath(); ctx.arc(45, 46, 3, 0, 6.29); ctx.fill();
  ctx.beginPath(); ctx.arc(83, 46, 3, 0, 6.29); ctx.fill();
  ctx.strokeStyle = 'rgba(150,20,20,0.8)';
  for(var j=0;j<4;j++){
    ctx.beginPath(); ctx.moveTo(37+rand(-3,3), 42); ctx.lineTo(46+rand(-3,3), 47); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(76+rand(-3,3), 42); ctx.lineTo(85+rand(-3,3), 47); ctx.stroke();
  }
});
// 病人面孔（血丝眼 + 张开的嘴 + 血污）
var facePatientCanvas = makeCanvas(128, 128, function(ctx, w, h){
  ctx.fillStyle = '#cbb49c'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(38, 52, 14, 10, 0, 0, 6.29); ctx.fill();
  ctx.beginPath(); ctx.ellipse(90, 52, 14, 10, 0, 0, 6.29); ctx.fill();
  ctx.fillStyle = '#e8e2d8';
  ctx.beginPath(); ctx.ellipse(36, 50, 9, 8, 0, 0, 6.29); ctx.fill();
  ctx.beginPath(); ctx.ellipse(92, 50, 9, 8, 0, 0, 6.29); ctx.fill();
  ctx.fillStyle = '#3a1010';
  ctx.beginPath(); ctx.arc(37, 50, 3.4, 0, 6.29); ctx.fill();
  ctx.beginPath(); ctx.arc(91, 50, 3.4, 0, 6.29); ctx.fill();
  ctx.strokeStyle = 'rgba(150,20,20,0.8)'; ctx.lineWidth = 1;
  for(var i = 0; i < 6; i++){
    ctx.beginPath(); ctx.moveTo(28+rand(-3,3), 45+rand(-2,2)); ctx.lineTo(44+rand(-3,3), 50+rand(-3,3)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(84+rand(-3,3), 45+rand(-2,2)); ctx.lineTo(100+rand(-3,3), 50+rand(-3,3)); ctx.stroke();
  }
  ctx.fillStyle = '#1a0c0c';
  ctx.beginPath(); ctx.ellipse(64, 88, 12, 9, 0, 0, 6.29); ctx.fill();
  ctx.fillStyle = '#d8cfc2';
  for(var j = 0; j < 4; j++){ ctx.fillRect(55+j*5, 82, 3, 4); ctx.fillRect(55+j*5, 92, 3, 3); }
  ctx.fillStyle = 'rgba(90,10,10,0.55)';
  ctx.beginPath(); ctx.arc(88, 96, 5, 0, 6.29); ctx.fill();
  ctx.fillStyle = 'rgba(110,16,16,0.6)'; ctx.fillRect(20, 68, 4, 30);
  ctx.strokeStyle = 'rgba(120,60,50,0.7)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(24, 30); ctx.lineTo(42, 40); ctx.stroke();
});
// 八尺面孔（苍白 + 红唇微笑）
var faceHachiCanvas = makeCanvas(128, 128, function(ctx, w, h){
  ctx.fillStyle = '#e6ddcc'; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(40,34,30,0.7)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(34, 44); ctx.quadraticCurveTo(44, 40, 52, 44); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(76, 44); ctx.quadraticCurveTo(84, 40, 94, 44); ctx.stroke();
  ctx.fillStyle = '#1a1410';
  ctx.beginPath(); ctx.ellipse(38, 58, 4, 6, 0, 0, 6.29); ctx.fill();
  ctx.beginPath(); ctx.ellipse(90, 58, 4, 6, 0, 0, 6.29); ctx.fill();
  ctx.strokeStyle = '#7a2a26'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(64, 86, 14, 0.15, Math.PI-0.15); ctx.stroke();
  ctx.fillStyle = 'rgba(200,120,110,0.25)';
  ctx.beginPath(); ctx.ellipse(30, 78, 10, 6, 0, 0, 6.29); ctx.fill();
  ctx.beginPath(); ctx.ellipse(98, 78, 10, 6, 0, 0, 6.29); ctx.fill();
});
// 幽灵面孔（黑眼洞 + 张开的黑洞嘴）
var faceGhostCanvas = makeCanvas(128, 128, function(ctx, w, h){
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(210,216,224,0.85)';
  ctx.beginPath(); ctx.ellipse(64, 64, 40, 50, 0, 0, 6.29); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.9)';
  ctx.beginPath(); ctx.ellipse(46, 54, 7, 9, 0.2, 0, 6.29); ctx.fill();
  ctx.beginPath(); ctx.ellipse(82, 54, 7, 9, -0.2, 0, 6.29); ctx.fill();
  ctx.beginPath(); ctx.ellipse(64, 84, 9, 14, 0, 0, 6.29); ctx.fill();
});
// 幽灵裹尸布（褶皱 + 破边）
var shroudCanvas = makeCanvas(256, 256, function(ctx, w, h){
  ctx.clearRect(0, 0, w, h);
  for(var i = 0; i < 40; i++){
    var x = i * 6.4;
    var bright = (i % 2 === 0) ? 0.85 : 0.55;
    ctx.fillStyle = 'rgba(216,222,228,' + (bright * (0.55 + rand(0, 0.2))) + ')';
    ctx.fillRect(x, 0, 6.4, h);
    if(i % 3 === 1){ ctx.fillStyle = 'rgba(90,100,110,0.25)'; ctx.fillRect(x, 0, 1.6, h); }
  }
  // 底部破边
  for(var j = 0; j < 256; j += 4){
    var cut = rand(0, 34);
    ctx.clearRect(j, h - cut, 4, cut);
  }
});
// 瘦长西装前襟（白衬衫 + 红领带）
var suitFrontCanvas = makeCanvas(128, 160, function(ctx, w, h){
  ctx.fillStyle = '#101216'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(8,9,12,0.9)';
  ctx.beginPath(); ctx.moveTo(48, 0); ctx.lineTo(80, 0); ctx.lineTo(72, h); ctx.lineTo(56, h); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#e8e8ea';
  ctx.beginPath(); ctx.moveTo(56, 6); ctx.lineTo(72, 6); ctx.lineTo(66, 62); ctx.lineTo(62, 62); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#8e1c1c';
  ctx.beginPath(); ctx.moveTo(62, 14); ctx.lineTo(66, 14); ctx.lineTo(70, 60); ctx.lineTo(58, 60); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath(); ctx.moveTo(61, 60); ctx.lineTo(67, 60); ctx.lineTo(67, 74); ctx.lineTo(61, 74); ctx.closePath(); ctx.fill();
});
// 白裙（八尺）
var dressCanvas = makeCanvas(256, 256, function(ctx, w, h){
  ctx.fillStyle = '#e6e2d8'; ctx.fillRect(0, 0, w, h);
  for(var i = 0; i < 30; i++){
    ctx.strokeStyle = 'rgba(150,145,135,' + rand(0.08, 0.22) + ')'; ctx.lineWidth = rand(1, 3);
    var x = rand(0, w), y = 0;
    ctx.beginPath(); ctx.moveTo(x, y);
    for(var k = 0; k < 8; k++){ x += rand(-6, 6); y += 32; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(120,115,105,0.15)'; ctx.fillRect(0, h-18, w, 18);
});
// 屋顶混凝土
var roofCanvas = makeCanvas(512, 512, function(ctx, w, h){
  ctx.fillStyle = '#3a3d40'; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(10,12,14,0.5)'; ctx.lineWidth = 3;
  for(var i = 0; i <= w; i += 128){ ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke(); }
  for(var i = 0; i <= h; i += 128){ ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(w, i); ctx.stroke(); }
  for(var j = 0; j < 300; j++){ ctx.fillStyle = 'rgba(255,255,255,' + rand(0.01, 0.05) + ')'; ctx.fillRect(rand(0, w), rand(0, h), 1, 1); }
  for(var k = 0; k < 40; k++){ ctx.fillStyle = 'rgba(0,0,0,' + rand(0.05, 0.2) + ')'; ctx.beginPath(); ctx.arc(rand(0, w), rand(0, h), rand(2, 9), 0, 6.29); ctx.fill(); }
  for(var m = 0; m < 6; m++){ ctx.fillStyle = 'rgba(20,20,22,0.4)'; ctx.fillRect(rand(0, w-60), rand(0, h-40), rand(30, 60), rand(20, 40)); }
});
// 恐怖画作 ×2
var paintCanvasA = makeCanvas(96, 128, function(ctx, w, h){
  ctx.fillStyle = '#15161c'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#b8a894';
  ctx.beginPath(); ctx.ellipse(48, 56, 22, 28, 0, 0, 6.29); ctx.fill();
  ctx.fillStyle = '#0c0c10';
  ctx.beginPath(); ctx.ellipse(38, 52, 5, 6, 0, 0, 6.29); ctx.fill();
  ctx.beginPath(); ctx.ellipse(58, 52, 5, 6, 0, 0, 6.29); ctx.fill();
  ctx.strokeStyle = 'rgba(140,20,20,0.85)'; ctx.lineWidth = 2;
  for(var i = 0; i < 5; i++){ ctx.beginPath(); ctx.moveTo(34+rand(-3,3), 38); ctx.lineTo(42+rand(-3,3), 64); ctx.stroke(); }
  ctx.fillStyle = '#1a0d0d'; ctx.beginPath(); ctx.ellipse(48, 84, 7, 5, 0, 0, 6.29); ctx.fill();
});
var paintCanvasB = makeCanvas(96, 128, function(ctx, w, h){
  var g2 = ctx.createLinearGradient(0, 0, 0, h);
  g2.addColorStop(0, '#0c0d12'); g2.addColorStop(1, '#05060a');
  ctx.fillStyle = g2; ctx.fillRect(0, 0, w, h);
  // 走廊透视
  ctx.strokeStyle = '#23262e'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(18, 20); ctx.lineTo(30, h-10); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(78, 20); ctx.lineTo(66, h-10); ctx.stroke();
  ctx.strokeStyle = '#1c1f26'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(18, 20); ctx.lineTo(78, 20); ctx.stroke();
  // 尽头的红门
  var dg = ctx.createRadialGradient(48, 92, 2, 48, 92, 26);
  dg.addColorStop(0, 'rgba(160,30,30,0.9)'); dg.addColorStop(1, 'rgba(160,30,30,0)');
  ctx.fillStyle = dg; ctx.fillRect(24, 68, 48, 48);
  ctx.fillStyle = '#7a1616'; ctx.fillRect(42, 78, 12, 32);
});
// 窗户（月光）
var windowCanvas = makeCanvas(128, 192, function(ctx, w, h){
  var wg = ctx.createLinearGradient(0, 0, 0, h);
  wg.addColorStop(0, '#8fa8d0'); wg.addColorStop(0.5, '#a9c0e2'); wg.addColorStop(1, '#6c84b0');
  ctx.fillStyle = wg; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#0e1218';
  ctx.fillRect(0, 0, w, 6); ctx.fillRect(0, h-6, w, 6);
  ctx.fillRect(62, 0, 5, h);
  ctx.fillRect(0, 93, w, 5);
  ctx.fillStyle = 'rgba(230,240,255,0.5)';
  ctx.beginPath(); ctx.arc(96, 36, 14, 0, 6.29); ctx.fill();
  ctx.fillStyle = 'rgba(140,160,200,0.25)';
  ctx.beginPath(); ctx.arc(96, 36, 22, 0, 6.29); ctx.fill();
});

// 夜空（银河 + 星 + 云 + 月亮）
var skyCanvas = (function(){
  var c = document.createElement('canvas'); c.width = 1024; c.height = 512;
  var ctx = c.getContext('2d');
  var g = ctx.createLinearGradient(0, 0, 0, 1024);
  g.addColorStop(0, '#02040c'); g.addColorStop(0.5, '#060d1e'); g.addColorStop(0.78, '#0e1830'); g.addColorStop(1, '#18233a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1024, 512);
  for(var b = 0; b < 26; b++){
    ctx.fillStyle = 'rgba(120,150,220,' + rand(0.008, 0.02) + ')';
    ctx.beginPath(); ctx.ellipse(rand(400, 1700), rand(150, 450), rand(200, 600), rand(40, 110), rand(-0.5, 0.2), 0, 6.29); ctx.fill();
  }
  for(var i = 0; i < 400; i++){
    var br = rand(0.25, 1);
    ctx.fillStyle = 'rgba(' + (200 + rand(0,55)|0) + ',' + (210 + rand(0,45)|0) + ',' + (230 + rand(0,25)|0) + ',' + (rand(0.2, 0.95)*br) + ')';
    ctx.fillRect(rand(0, 1024), rand(0, 330), rand(1, 2.6), rand(1, 2.6));
  }
  for(var cl = 0; cl < 5; cl++){
    ctx.fillStyle = 'rgba(8,12,22,' + rand(0.25, 0.5) + ')';
    ctx.beginPath(); ctx.ellipse(rand(200, 1800), rand(120, 380), rand(200, 420), rand(14, 30), 0, 0, 6.29); ctx.fill();
  }
  var mx = 815, my = 105;
  var mg = ctx.createRadialGradient(mx, my, 6, mx, my, 150);
  mg.addColorStop(0, 'rgba(246,249,255,0.98)'); mg.addColorStop(0.16, 'rgba(214,224,246,0.75)'); mg.addColorStop(0.5, 'rgba(190,205,240,0.16)'); mg.addColorStop(1, 'rgba(190,205,240,0)');
  ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mx, my, 150, 0, 6.29); ctx.fill();
  ctx.fillStyle = '#eef2fa'; ctx.beginPath(); ctx.arc(mx, my, 52, 0, 6.29); ctx.fill();
  ctx.fillStyle = 'rgba(160,172,202,0.5)';
  [[-16,8,9],[-30,-4,5],[14,-12,12],[8,20,6],[24,-20,7]].forEach(function(cr){ ctx.beginPath(); ctx.arc(mx+cr[0], my+cr[1], cr[2], 0, 6.29); ctx.fill(); });
  ctx.fillStyle = 'rgba(235,240,250,0.35)';
  ctx.beginPath(); ctx.arc(mx-30, my+16, 16, 0, 6.29); ctx.fill();
  return c;
})();
var skyTex = new THREE.CanvasTexture(skyCanvas);

// 法线贴图
var floorNormalTex = new THREE.CanvasTexture(heightToNormal(floorHeight, 0.9));
var wallNormalTex = new THREE.CanvasTexture(heightToNormal(wallHeight, 0.55));
var ceilNormalTex = new THREE.CanvasTexture(heightToNormal(ceilHeight, 0.4));
[floorNormalTex, wallNormalTex, ceilNormalTex].forEach(function(t){ t.wrapS = t.wrapT = THREE.RepeatWrapping; });

// 环境反射（地板光泽）
var envMap = null;
try {
  var pmrem = new THREE.PMREMGenerator(renderer);
  envMap = pmrem.fromEquirectangular(skyTex).texture;
  pmrem.dispose();
} catch(e){ envMap = null; }


/* ---------------- 灯光 ---------------- */
var hemi = new THREE.HemisphereLight(0x2e3d5c, 0x0d0e12, 0.55);
scene.add(hemi);
var moonLight = new THREE.DirectionalLight(0x9db4e8, 0.35);
moonLight.position.set(8, 16, 6);
scene.add(moonLight);

var flash = new THREE.SpotLight(0xfff1cf, 2.6, 30, 0.55, 0.65, 1.0);
flash.position.set(0,0,0);
flash.castShadow = true;
flash.shadow.mapSize.set(512,512);
flash.shadow.camera.near = 0.1;
flash.shadow.camera.far = 28;
flash.shadow.bias = -0.0006;
camera.add(flash);
var flashTarget = new THREE.Object3D(); flashTarget.position.set(0,0,-6);
camera.add(flashTarget); flash.target = flashTarget;

// 手电可见光束
var beamCanvas = makeCanvas(256, 64, function(ctx, w, h){
  for(var x = 0; x < w; x++){
    var u = Math.abs((x/w)*2 - 1);
    var radial = Math.max(0, 1 - u*u*2.4);
    for(var y = 0; y < h; y++){
      var v = y/h;
      var fade = Math.sin(Math.min(1, Math.max(0.02, v)) * Math.PI);
      ctx.fillStyle = 'rgba(255,242,205,' + (radial*fade*0.55).toFixed(3) + ')';
      ctx.fillRect(x, y, 1, 1);
    }
  }
});
var beam = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 6.6, 16, 20, 1, true),
  new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(beamCanvas), transparent:true, opacity:0.22, blending:THREE.AdditiveBlending, side:THREE.DoubleSide, depthWrite:false, fog:false}));
beam.rotation.x = -Math.PI/2;
beam.position.set(0.05, -0.12, -8.1);
camera.add(beam);
// 光束尘埃
var DUST_N = 45;
var dustArr = [];
for(var di = 0; di < DUST_N; di++){
  dustArr.push({x:rand(-2.6,2.6), y:rand(-1.5,1.5), z:rand(-9,-0.5), vx:rand(-0.06,0.06), vy:rand(-0.03,0.05), vz:rand(0,0.08), s:rand(0.008,0.028)});
}
var dustGeo = new THREE.BufferGeometry();
var dustPos = new Float32Array(DUST_N*3);
var dustMat = new THREE.PointsMaterial({color:0xffe9bd, size:0.02, transparent:true, opacity:0.55, blending:THREE.AdditiveBlending, depthWrite:false, sizeAttenuation:true, fog:false});
var dustPts = new THREE.Points(dustGeo, dustMat);
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
camera.add(dustPts);

var roomLights = [];
var lightCols = [0xcfd6e0, 0xffe8c0, 0xd8e6ff];
function addRoomLight(x,y,z,intensity,dist){
  var p = new THREE.PointLight(lightCols[randi(0,2)], intensity, dist||9, 2);
  p.position.set(x,y,z); scene.add(p);
  roomLights.push({p:p, base:intensity, ph:rand(0,6.28)});
}

/* ---------------- 材质 ---------------- */
function mat(color){ return new THREE.MeshLambertMaterial({color:color}); }
function matE(color){ return new THREE.MeshBasicMaterial({color:color}); }
function floorMat(w,d){
  var rp = Math.max(1, Math.round(w/2.5)), rq = Math.max(1, Math.round(d/2.5));
  var t = tex(floorCanvas, rp, rq);
  var n = tex(floorNormalTex, rp, rq);
  var m = new THREE.MeshStandardMaterial({map:t, normalMap:n, normalScale:new THREE.Vector2(0.5,0.5), roughness:0.38, metalness:0.22});
  if(envMap){ m.envMap = envMap; m.envMapIntensity = 0.35; }
  return m;
}
function wallMat(len,h){
  var rp = Math.max(1, Math.round(len/2.4)), rq = Math.max(1, Math.round(h/2.4));
  var t = tex(wallCanvas, rp, rq);
  var n = tex(wallNormalTex, rp, rq);
  return new THREE.MeshStandardMaterial({map:t, normalMap:n, normalScale:new THREE.Vector2(0.4,0.4), roughness:0.94, metalness:0.02});
}
function ceilMat(w,d){
  var rp = Math.max(1, Math.round(w/3)), rq = Math.max(1, Math.round(d/3));
  var t = tex(ceilCanvas, rp, rq);
  var n = tex(ceilNormalTex, rp, rq);
  return new THREE.MeshStandardMaterial({map:t, normalMap:n, normalScale:new THREE.Vector2(0.35,0.35), roughness:1, metalness:0});
}
function roofMat(w,d){
  var rp = Math.max(1, Math.round(w/5)), rq = Math.max(1, Math.round(d/5));
  var t = tex(roofCanvas, rp, rq);
  return new THREE.MeshStandardMaterial({map:t, roughness:0.9, metalness:0.05});
}

/* ---------------- 地图（多层） ---------------- */
var wallsByFloor = [];
var spawnPointsByFloor = [];
var stairPads = [];   // {x,z,floor,dir,mesh}
var currentFloor = 0;

var FLOOR0_ROOMS = [
  {x0:-16,x1:-9, z0:2.2, z1:8, name:'病房A', side:'S'},
  {x0:-8, x1:-1, z0:2.2, z1:8, name:'病房B', side:'S'},
  {x0:1,  x1:8,  z0:2.2, z1:8, name:'病房C', side:'S'},
  {x0:9,  x1:16, z0:2.2, z1:8, name:'病房D', side:'S'},
  {x0:-16,x1:-9, z0:-8,z1:-2.2,name:'病房E', side:'N'},
  {x0:9,  x1:16, z0:-8,z1:-2.2,name:'病房F', side:'N'},
  {x0:-8,x1:-2.2,z0:-22,z1:-17,name:'护士站', side:'L'},
  {x0:-8,x1:-2.2,z0:-16,z1:-11,name:'药房', side:'L'},
  {x0:-8,x1:-2.2,z0:-10,z1:-5, name:'卫生间', side:'L'},
  {x0:2.2,x1:8,  z0:-22,z1:-17,name:'安保室', side:'R'},
  {x0:2.2,x1:8,  z0:-16,z1:-11,name:'停尸房', side:'R'},
  {x0:2.2,x1:8,  z0:-10,z1:-5, name:'储物间', side:'R'}
];
var FLOOR1_ROOMS = [
  {x0:-16,x1:-9, z0:2.2, z1:8, name:'病房G', side:'S'},
  {x0:-8, x1:-1, z0:2.2, z1:8, name:'病房H', side:'S'},
  {x0:1,  x1:8,  z0:2.2, z1:8, name:'病房I', side:'S'},
  {x0:9,  x1:16, z0:2.2, z1:8, name:'病房J', side:'S'},
  {x0:-16,x1:-9, z0:-8,z1:-2.2,name:'病房K', side:'N'},
  {x0:9,  x1:16, z0:-8,z1:-2.2,name:'病房L', side:'N'},
  {x0:-8,x1:-2.2,z0:-22,z1:-17,name:'化验室', side:'L'},
  {x0:-8,x1:-2.2,z0:-16,z1:-11,name:'档案室', side:'L'},
  {x0:-8,x1:-2.2,z0:-10,z1:-5, name:'办公室', side:'L'},
  {x0:2.2,x1:8,  z0:-22,z1:-17,name:'手术室', side:'R'},
  {x0:2.2,x1:8,  z0:-16,z1:-11,name:'药库', side:'R'},
  {x0:2.2,x1:8,  z0:-10,z1:-5, name:'监控室', side:'R'}
];
function addBoxWall(f, minX, maxX, minZ, maxZ, h){
  h = h || 3.2;
  var y0 = floorY(f);
  var w = maxX-minX, d = maxZ-minZ;
  var m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), wallMat(w,h));
  m.position.set((minX+maxX)/2, y0+h/2, (minZ+maxZ)/2);
  m.receiveShadow = true;
  scene.add(m);
  wallsByFloor[f].push({minX:minX,maxX:maxX,minZ:minZ,maxZ:maxZ});
}

function buildFloorRooms(f, rooms){
  var i, r, mid, midX, dw = 0.82;
  var y0 = floorY(f);
  // 地板与天花板（覆盖主楼+支楼+楼梯井）
  var fl = new THREE.Mesh(new THREE.BoxGeometry(35,0.25,34), floorMat(35,34));
  fl.position.set(-0.9, y0-0.125, -7.8); fl.receiveShadow = true; scene.add(fl);
  var ce = new THREE.Mesh(new THREE.BoxGeometry(35,0.25,34), ceilMat(35,34));
  ce.position.set(-0.9, y0+3.3, -7.8); scene.add(ce);
  // ---- 走廊两侧连续墙（含房门开口，无缝隙） ----
  function wallX(minX, maxX, minZ, maxZ, opens){
    var segs = [minX];
    opens.slice().sort(function(a,b){ return a[0]-b[0]; }).forEach(function(o){
      segs.push(Math.max(minX, o[0])); segs.push(Math.min(maxX, o[1]));
    });
    segs.push(maxX);
    for(var si=0; si<segs.length; si+=2){
      if(segs[si+1]-segs[si] > 0.01) addBoxWall(f, segs[si], segs[si+1], minZ, maxZ);
    }
  }
  function wallZ(minX, maxX, minZ, maxZ, opens){
    var segs = [minZ];
    opens.slice().sort(function(a,b){ return a[0]-b[0]; }).forEach(function(o){
      segs.push(Math.max(minZ, o[0])); segs.push(Math.min(maxZ, o[1]));
    });
    segs.push(maxZ);
    for(var sj=0; sj<segs.length; sj+=2){
      if(segs[sj+1]-segs[sj] > 0.01) addBoxWall(f, minX, maxX, segs[sj], segs[sj+1]);
    }
  }
  var opensS = [], opensN = [], opensL = [], opensR = [];
  for(i=0;i<rooms.length;i++){
    r = rooms[i];
    if(r.side==='S') opensS.push([(r.x0+r.x1)/2-0.82, (r.x0+r.x1)/2+0.82]);
    else if(r.side==='N') opensN.push([(r.x0+r.x1)/2-0.82, (r.x0+r.x1)/2+0.82]);
    else if(r.side==='L') opensL.push([(r.z0+r.z1)/2-0.82, (r.z0+r.z1)/2+0.82]);
    else opensR.push([(r.z0+r.z1)/2-0.82, (r.z0+r.z1)/2+0.82]);
  }
  // 主廊南墙（z≈2.2，全段连续）
  wallX(-16, 16, 2.05, 2.35, opensS);
  // 主廊北墙（z≈-2.2，支廊两侧两段 + 拐角处与支廊墙重叠 0.15 防漏）
  wallX(-16, -2.05, -2.35, -2.05, opensN.filter(function(o){ return o[0] < -2.2; }));
  wallX(2.05, 16, -2.35, -2.05, opensN.filter(function(o){ return o[0] > 2.2; }));
  // 支廊西墙 / 东墙（x≈±2.2，全段连续，覆盖房间间隙与楼梯口旁）
  wallZ(-2.35, -2.05, -23, -2.05, opensL);
  wallZ(2.05, 2.35, -23, -2.05, opensR);
  // ---- 固定墙体 ----
  // 主廊南外墙
  addBoxWall(f, -16, 16, 8.05, 8.35);
  // 主廊北房间外墙
  addBoxWall(f, -16, -9, -8.35, -8.05);
  addBoxWall(f, 9, 16, -8.35, -8.05);
  // 支廊两侧外墙
  addBoxWall(f, -8.35, -8.05, -23, -2.2);
  addBoxWall(f, 8.05, 8.35, -23, -2.2);
  // 南侧房间隔墙
  [-9, 0, 9].forEach(function(bx){
    addBoxWall(f, bx-0.15, bx+0.15, 2.2, 8);
  });
  // 北侧房间隔墙
  addBoxWall(f, -9.15, -8.85, -8, -2.2);
  addBoxWall(f, 8.85, 9.15, -8, -2.2);
  // 支廊房间隔墙
  [-17, -11].forEach(function(bz){
    addBoxWall(f, -8, -2.2, bz-0.15, bz+0.15);
    addBoxWall(f, 2.2, 8, bz-0.15, bz+0.15);
  });
  // 主廊西端：0 层封死，1 层为西楼梯井（1↔2）
  if(f === 0){
    addBoxWall(f, -16.05, -15.75, -8, 8);
  }
  // 支廊北端：真实楼梯井（0↔1）
  buildNorthShaft(f);
  if(f === 1){ buildWestShaft(f); }
  // 主廊东端封死
  addBoxWall(f, 15.85, 16.15, -8, 8);
  // ---- 照明 ----
  addRoomLight(0, y0+2.8, 0, 1.0, 12);
  addRoomLight(-8, y0+2.8, 0, 1.0, 12);
  addRoomLight(8, y0+2.8, 0, 1.0, 12);
  addRoomLight(0, y0+2.8, -10, 1.0, 12);
  [[-12,0],[-6,0],[0,0],[6,0],[12,0],[0,-8],[0,-16]].forEach(function(p){
    var lamp = new THREE.Mesh(new THREE.BoxGeometry(1.4,0.1,0.4), matE(0xffe9b8));
    lamp.position.set(p[0], y0+3.14, p[1]); scene.add(lamp);
  });
  // ---- 环境道具 ----
  var baseMat = new THREE.MeshStandardMaterial({color:0x15181c, roughness:0.75});
  var baseboard = function(w, d, x, z){
    var b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.14, d), baseMat);
    b.position.set(x, y0+0.07, z); scene.add(b);
  };
  baseboard(32.6, 0.05, 0, 2.12);
  baseboard(13.8, 0.05, -9.1, -2.12);
  baseboard(13.8, 0.05, 9.1, -2.12);
  baseboard(0.05, 20.8, -2.12, -12.6);
  baseboard(0.05, 20.8, 2.12, -12.6);
  // 安全出口灯
  var exitCanvas = makeCanvas(128, 64, function(ctx, w, h){
    ctx.fillStyle = '#0a2e16'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#5fe08e'; ctx.font = 'bold 40px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('安全出口', w/2, h/2);
  });
  var exitMat = new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(exitCanvas), side:THREE.DoubleSide});
  var exitSign = function(x, y, z, rotY){
    var s = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.45), exitMat);
    s.position.set(x, y0+2.5, z); s.rotation.y = rotY;
    scene.add(s);
  };
  exitSign(15.75, 0, 0, -Math.PI/2);
  exitSign(0.25, 0, -2.1, 0);
  exitSign(0, 0, -22.7, 0);
  // 灭火器
  var addExtinguisher = function(x, z, rotY){
    var g2 = new THREE.Group();
    var body = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.42, 10), new THREE.MeshStandardMaterial({color:0xb02222, roughness:0.35}));
    body.position.y = 0.75;
    var top = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 8), new THREE.MeshStandardMaterial({color:0x20242a, roughness:0.5}));
    top.position.y = 1.0;
    var hose = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 10), new THREE.MeshStandardMaterial({color:0x2a2e33, roughness:0.6}));
    hose.position.set(0.02, 0.95, 0); hose.rotation.y = Math.PI/2;
    g2.add(body); g2.add(top); g2.add(hose);
    g2.position.set(x, y0, z); g2.rotation.y = rotY || 0;
    scene.add(g2);
  };
  addExtinguisher(4, 2.28, 0);
  addExtinguisher(-10, 2.28, 0);
  addExtinguisher(2.2, -6, -Math.PI/2);
  addExtinguisher(-2.2, -14, Math.PI/2);
  // 天花板管道
  var pipeMat = new THREE.MeshStandardMaterial({map:new THREE.CanvasTexture(metalCanvas), roughness:0.4, metalness:0.8});
  var pipe1 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 32, 8), pipeMat);
  pipe1.rotation.z = Math.PI/2; pipe1.position.set(0, y0+3.1, 1.2); scene.add(pipe1);
  var pipe2 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 21, 8), pipeMat);
  pipe2.rotation.x = Math.PI/2; pipe2.position.set(-1.2, y0+3.06, -12.6); scene.add(pipe2);
  var pipe3 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 32, 8), pipeMat);
  pipe3.rotation.z = Math.PI/2; pipe3.position.set(0, y0+2.98, -1.2); scene.add(pipe3);

  // ---- 每间房：窗户 + 房门 + 门牌 + 顶灯 + 装饰 ----
  var frameMatD = new THREE.MeshStandardMaterial({map:new THREE.CanvasTexture(woodCanvas), roughness:0.6, metalness:0.15});
  for(i=0;i<rooms.length;i++){
    r = rooms[i];
    mid = (r.z0+r.z1)/2; midX = (r.x0+r.x1)/2;
    var cxR = midX;
    var hingeX, hingeZ, panelZ, dirSign, baseRotY, aabb;
    var plaquePos, plaqueRot;
    if(r.side==='L'){
      hingeX = -2.2; hingeZ = mid+0.78; panelZ = -0.75; dirSign = 1; baseRotY = 0;
      aabb = {minX:-2.48, maxX:-2.32, minZ:mid-0.78, maxZ:mid+0.78};
      plaquePos = [-2.18, y0+2.62, mid]; plaqueRot = Math.PI/2;
      addWindow(-8.02, y0, mid, Math.PI/2);
    } else if(r.side==='R'){
      hingeX = 2.2; hingeZ = mid-0.78; panelZ = 0.75; dirSign = -1; baseRotY = 0;
      aabb = {minX:2.32, maxX:2.48, minZ:mid-0.78, maxZ:mid+0.78};
      plaquePos = [2.18, y0+2.62, mid]; plaqueRot = -Math.PI/2;
      addWindow(8.02, y0, mid, -Math.PI/2);
    } else if(r.side==='N'){
      hingeX = midX+0.78; hingeZ = -2.2; panelZ = -0.75; dirSign = 1; baseRotY = Math.PI/2;
      aabb = {minX:midX-0.78, maxX:midX+0.78, minZ:-2.48, maxZ:-2.32};
      plaquePos = [midX, y0+2.62, -2.18]; plaqueRot = 0;
      addWindow(midX, y0, -8.02, 0);
    } else {
      hingeX = midX-0.78; hingeZ = 2.2; panelZ = -0.75; dirSign = -1; baseRotY = -Math.PI/2;
      aabb = {minX:midX-0.78, maxX:midX+0.78, minZ:2.32, maxZ:2.48};
      plaquePos = [midX, y0+2.62, 2.18]; plaqueRot = Math.PI;
      addWindow(midX, y0, 8.02, Math.PI);
    }
    // 房门组
    var dg = new THREE.Group();
    dg.position.set(hingeX, y0+1.06, hingeZ);
    dg.rotation.y = baseRotY;
    var panel = new THREE.Mesh(new THREE.BoxGeometry(0.07, 2.12, 1.5), frameMatD);
    panel.position.set(0, 0, panelZ);
    panel.castShadow = true;
    dg.add(panel);

    var knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshStandardMaterial({color:0xb8a06a, roughness:0.3, metalness:0.8}));
    knob.position.set(r.side==='R' ? -0.03 : 0.03, 0, panelZ + (r.side==='R' ? -0.6 : 0.6));
    dg.add(knob);
    scene.add(dg);
    doors.push({g:dg, floor:f, side:r.side, nx:(r.side==='L'?1:(r.side==='R'?-1:0)), nz:(r.side==='N'?1:(r.side==='S'?-1:0)), dirSign:dirSign, baseRotY:baseRotY, ang:0, target:0, doorT:0,
      minX:aabb.minX, maxX:aabb.maxX, minZ:aabb.minZ, maxZ:aabb.maxZ});
    // 门框
    var fPost1, fPost2, fTop;
    if(r.side==='L' || r.side==='R'){
      fPost1 = new THREE.Mesh(new THREE.BoxGeometry(0.1,2.3,0.1), frameMatD); fPost1.position.set(hingeX, y0+1.16, mid+0.78); scene.add(fPost1);
      fPost2 = new THREE.Mesh(new THREE.BoxGeometry(0.1,2.3,0.1), frameMatD); fPost2.position.set(hingeX, y0+1.16, mid-0.78); scene.add(fPost2);
      fTop = new THREE.Mesh(new THREE.BoxGeometry(0.1,0.12,1.7), frameMatD); fTop.position.set(hingeX, y0+2.32, mid); scene.add(fTop);
    } else {
      fPost1 = new THREE.Mesh(new THREE.BoxGeometry(0.1,2.3,0.1), frameMatD); fPost1.position.set(midX+0.78, y0+1.16, hingeZ); scene.add(fPost1);
      fPost2 = new THREE.Mesh(new THREE.BoxGeometry(0.1,2.3,0.1), frameMatD); fPost2.position.set(midX-0.78, y0+1.16, hingeZ); scene.add(fPost2);
      fTop = new THREE.Mesh(new THREE.BoxGeometry(1.7,0.12,0.1), frameMatD); fTop.position.set(midX, y0+2.32, hingeZ); scene.add(fTop);
    }
    // 门牌
    var plaque = makeCanvas(256, 96, function(ctx, w, h){
      ctx.fillStyle = 'rgba(10,12,14,0.92)'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(190,200,210,0.55)'; ctx.lineWidth = 4; ctx.strokeRect(6, 6, w-12, h-12);
      ctx.fillStyle = '#cfd8de'; ctx.font = 'bold 52px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(r.name, w/2, h/2+4);
    });
    var sign = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.44), new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(plaque), side:THREE.DoubleSide}));
    sign.position.set(plaquePos[0], plaquePos[1], plaquePos[2]);
    sign.rotation.y = plaqueRot;
    scene.add(sign);
    // 房间顶灯
    var rlamp = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.06, 0.5), matE(0xffe9b8));
    rlamp.position.set(cxR, y0+3.12, mid); scene.add(rlamp);
    decorateRoom(f, r, i);
  }
  addBloodDecals(f);
  spawnPointsByFloor[f].push([0,-20],[-14,0],[14,0],[0,-8],[-12,5],[12,5]);
  for(i=0;i<rooms.length;i++){ r = rooms[i]; spawnPointsByFloor[f].push([(r.x0+r.x1)/2,(r.z0+r.z1)/2]); }
}

function buildRoof(f){
  var y0 = floorY(f);
  var slabM = function(w, d, x, z){
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, d), roofMat(w, d));
    m.position.set(x, y0-0.15, z); m.receiveShadow = true; scene.add(m);
  };
  // 屋顶板（西端留出楼梯房洞口 x∈[-21,-19.9], z∈[-2.9,2.9]）
  slabM(38.2, 25.1, -1.9, -15.45);
  slabM(38.2, 6.95, -1.9, 6.375);
  slabM(36, 5.8, -0.8, 0);
  function rail(minX,maxX,minZ,maxZ){
    var w=maxX-minX, d=maxZ-minZ;
    var m=new THREE.Mesh(new THREE.BoxGeometry(w,1.1,d), wallMat(w,1.1));
    m.position.set((minX+maxX)/2, y0+0.55, (minZ+maxZ)/2);
    m.receiveShadow=true; scene.add(m);
    wallsByFloor[f].push({minX:minX,maxX:maxX,minZ:minZ,maxZ:maxZ});
  }
  rail(-21.15,-20.85,-28,9.85);
  rail(16.95,17.25,-28,9.85);
  rail(-21,17.2,-28.15,-27.85);
  rail(-21,17.2,9.55,9.85);
  buildWestHouse();
  // 天台设备（分散）
  var water = new THREE.Mesh(new THREE.CylinderGeometry(1.5,1.7,3.2,12), mat(0x2f363c));
  water.position.set(-12, y0+1.6, -15); water.castShadow=true; scene.add(water);
  var vent1 = new THREE.Mesh(new THREE.BoxGeometry(2.2,1.2,1.6), mat(0x3a4148));
  vent1.position.set(10, y0+0.6, -6); vent1.castShadow=true; scene.add(vent1);
  var vent2 = new THREE.Mesh(new THREE.BoxGeometry(1.8,1.0,2.4), mat(0x343b41));
  vent2.position.set(6, y0+0.5, -16); vent2.castShadow=true; scene.add(vent2);
  var unit = new THREE.Mesh(new THREE.BoxGeometry(2.4,1.1,1.2), mat(0x41484e));
  unit.position.set(-10, y0+0.55, 4); unit.castShadow=true; scene.add(unit);
  var unit2 = new THREE.Mesh(new THREE.BoxGeometry(1.8,1.0,1.8), mat(0x3a4148));
  unit2.position.set(12, y0+0.5, -2); unit2.castShadow=true; scene.add(unit2);
  var pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.14,10,8), mat(0x33393f));
  pipe.rotation.x = Math.PI/2; pipe.position.set(-4, y0+0.15, -10); pipe.castShadow=true; scene.add(pipe);
  // 城市天际线
  var cityCanvas = makeCanvas(1024, 96, function(ctx, w, h){
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(2,4,8,0.88)';
    var x = 0;
    while(x < w){
      var bw = rand(30, 90), bh = rand(14, 80);
      ctx.fillRect(x, h-bh, bw, bh);
      for(var wy = 0; wy < bh-8; wy += 8){
        for(var wx = 0; wx < bw-6; wx += 10){
          if(Math.random() < 0.12){
            ctx.fillStyle = 'rgba(255,200,120,' + rand(0.2, 0.8) + ')';
            ctx.fillRect(x+wx+2, h-bh+wy+3, 3, 4);
            ctx.fillStyle = 'rgba(2,4,8,0.88)';
          }
        }
      }
      x += bw + rand(2, 14);
    }
  });
  var cityTex = new THREE.CanvasTexture(cityCanvas);
  var city = new THREE.Mesh(new THREE.CylinderGeometry(75, 75, 36, 24, 1, true), new THREE.MeshBasicMaterial({map:cityTex, side:THREE.BackSide, transparent:true, fog:false, depthWrite:false}));
  city.position.set(0, y0+4, -7.8);
  scene.add(city);
  var starGeo = new THREE.BufferGeometry();
  var starPos = new Float32Array(400*3);
  for(var si = 0; si < 400; si++){
    var a = rand(0, 6.28), e = rand(0.25, 1.3), r = rand(50, 70);
    starPos[si*3] = Math.cos(a)*r; starPos[si*3+1] = y0 + Math.sin(e)*22; starPos[si*3+2] = Math.sin(a)*r - 7.8;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  var stars = new THREE.Points(starGeo, new THREE.PointsMaterial({color:0xdce4ff, size:0.14, transparent:true, opacity:0.9, blending:THREE.AdditiveBlending, fog:false, depthWrite:false}));
  scene.add(stars);
  var moonGlowCanvas = makeCanvas(128, 128, function(ctx, w, h){
    var g2 = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
    g2.addColorStop(0, 'rgba(244,248,255,0.95)'); g2.addColorStop(0.25, 'rgba(210,224,246,0.5)'); g2.addColorStop(1, 'rgba(210,224,246,0)');
    ctx.fillStyle = g2; ctx.fillRect(0, 0, w, h);
  });
  var moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(moonGlowCanvas), blending:THREE.AdditiveBlending, transparent:true, fog:false, depthWrite:false}));
  moonGlow.scale.set(18, 18, 1);
  moonGlow.position.set(46, y0+26, 12);
  scene.add(moonGlow);
  addBloodDecals(f);
  spawnPointsByFloor[f].push([0,-19],[-14,0],[10,-16],[-10,4],[8,-2],[2,6]);
  addRoomLight(0, y0+3, -8, 0.7, 16);
  addRoomLight(-8, y0+3, 2, 0.6, 10);
}

function addBloodDecals(f){
  var y0 = floorY(f);
  var pts = [[-1,-6],[1,-4],[-1.5,3],[1.5,6],[-5,6.5],[5,0.5],[-5,-11.5],[5,12],[0.5,-11],[-1,14],[1,-14]];
  var i;
  for(i=0;i<pts.length;i++){
    var t = tex(bloodCanvas);
    var m = new THREE.Mesh(new THREE.PlaneGeometry(rand(1,2.6),rand(0.7,2)),
      new THREE.MeshStandardMaterial({map:t, transparent:true, roughness:0.9}));
    m.rotation.x = -Math.PI/2; m.rotation.z = rand(0,6.28);
    m.position.set(pts[i][0], y0+0.015, pts[i][1]); scene.add(m);
  }
  var wallPts = [[-2,0.7,2],[2,1.1,-3],[-2,1.4,-7],[2,0.9,7],[-5,1.0,12]];
  for(i=0;i<wallPts.length;i++){
    var t2 = tex(bloodCanvas);
    var s = new THREE.Mesh(new THREE.PlaneGeometry(rand(0.5,1.2),rand(0.7,1.3)),
      new THREE.MeshStandardMaterial({map:t2, transparent:true, roughness:0.9}));
    s.position.set(wallPts[i][0], y0+wallPts[i][1], wallPts[i][2]);
    if(Math.abs(wallPts[i][0])<2.5) s.rotation.y = Math.PI/2; else s.rotation.y = 0;
    scene.add(s);
  }
}

function box(w,h,d,color,x,y,z,parent,opts){
  var m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat(color));
  if(opts && opts.standard){ m.material = new THREE.MeshStandardMaterial({color:color, roughness:opts.roughness!=null?opts.roughness:0.7, metalness:opts.metalness||0.05}); }
  m.position.set(x,y,z);
  if(opts && opts.castShadow) m.castShadow = true;
  (parent||scene).add(m); return m;
}

function makeBed(x, yBase, z, rotY){
  var g = new THREE.Group();
  var metalM = new THREE.MeshStandardMaterial({color:0x8b9299, roughness:0.4, metalness:0.7});
  var mattM = new THREE.MeshStandardMaterial({color:0x9aa1a8, roughness:0.9});
  var blkM = new THREE.MeshStandardMaterial({map:new THREE.CanvasTexture(blanketCanvas), roughness:0.95});
  var legGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8);
  var legs = [[-0.85,0.15,-0.4],[0.85,0.15,-0.4],[-0.85,0.15,0.4],[0.85,0.15,0.4]];
  for(var i=0;i<4;i++){
    var l = new THREE.Mesh(legGeo, metalM); l.position.set(legs[i][0],legs[i][1],legs[i][2]); l.castShadow = true; g.add(l);
  }
  var hf1 = new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.02,0.5,6), metalM); hf1.rotation.z=Math.PI/2; hf1.position.set(-0.85,0.62,-0.4); g.add(hf1);
  var hf2 = new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.02,0.5,6), metalM); hf2.rotation.z=Math.PI/2; hf2.position.set(-0.85,0.62,0.4); g.add(hf2);
  var frame = new THREE.Mesh(new THREE.BoxGeometry(1.9,0.06,0.9), metalM); frame.position.y = 0.31; g.add(frame);
  var mattress = new THREE.Mesh(new THREE.BoxGeometry(1.85,0.16,0.85), mattM); mattress.position.y = 0.4; mattress.castShadow = true; g.add(mattress);
  var blanket = new THREE.Mesh(new THREE.BoxGeometry(1.8,0.09,0.85), blkM); blanket.position.set(0.05,0.52,-0.02); blanket.castShadow = true; g.add(blanket);
  var pillow = new THREE.Mesh(new THREE.BoxGeometry(0.55,0.12,0.55), mattM); pillow.position.set(-0.62,0.55,0); g.add(pillow);
  g.position.set(x,yBase,z); g.rotation.y = rotY;
  scene.add(g);
}
function makeIVStand(x, yBase, z){
  var g = new THREE.Group();
  var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.02,1.9,8), new THREE.MeshStandardMaterial({color:0xb8bec4, roughness:0.4, metalness:0.7}));
  pole.position.y = 0.95; pole.castShadow = true; g.add(pole);
  var hook = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.015, 6, 10), new THREE.MeshStandardMaterial({color:0xb8bec4, roughness:0.4, metalness:0.7}));
  hook.position.set(0.08, 1.82, 0); hook.rotation.y = Math.PI/2; g.add(hook);
  var bag = new THREE.Mesh(new THREE.BoxGeometry(0.22,0.34,0.04), new THREE.MeshStandardMaterial({color:0xd8e0b8, roughness:0.6, transparent:true, opacity:0.85}));
  bag.position.set(-0.02, 1.55, 0); g.add(bag);
  var base = new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.24,0.04,10), new THREE.MeshStandardMaterial({color:0x2a2e33, roughness:0.6, metalness:0.4}));
  base.position.y = 0.02; g.add(base);
  g.position.set(x, yBase, z);
  scene.add(g);
}
function makeChair(x, yBase, z, rotY){
  var g = new THREE.Group();
  var metalM = new THREE.MeshStandardMaterial({color:0x7a8086, roughness:0.4, metalness:0.7});
  var padM = new THREE.MeshStandardMaterial({color:0x3a4046, roughness:0.8});
  var seat = new THREE.Mesh(new THREE.BoxGeometry(0.45,0.06,0.45), padM); seat.position.y = 0.45; g.add(seat);
  var back = new THREE.Mesh(new THREE.BoxGeometry(0.45,0.5,0.05), padM); back.position.set(0,0.72,-0.2); g.add(back);
  var legGeo = new THREE.CylinderGeometry(0.015,0.015,0.45,6);
  [[-0.18,0.18],[0.18,0.18],[-0.18,-0.18],[0.18,-0.18]].forEach(function(p){
    var l = new THREE.Mesh(legGeo, metalM); l.position.set(p[0],0.225,p[1]); g.add(l);
  });
  g.position.set(x,yBase,z); g.rotation.y = rotY;
  scene.add(g);
}
function makeMonitor(x, yBase, z, rotY){
  var g = new THREE.Group();
  var screenCanvas = makeCanvas(128, 96, function(ctx, w, h){
    ctx.fillStyle = '#071208'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#39d96a'; ctx.lineWidth = 2;
    ctx.beginPath();
    for(var i = 0; i < w; i += 4){
      var v = Math.sin(i*0.12) * 12 + Math.sin(i*0.31) * 6;
      var y = 46 - v + (Math.random()*2-1);
      if(i === 0) ctx.moveTo(i, y); else ctx.lineTo(i, y);
    }
    ctx.stroke();
    ctx.fillStyle = '#39d96a'; ctx.font = 'bold 20px monospace';
    ctx.fillText('ECG', 8, 20);
  });
  var scr = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.3), new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(screenCanvas)}));
  scr.position.set(0, 1.25, 0.1); g.add(scr);
  var body = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.38, 0.16), new THREE.MeshStandardMaterial({color:0x23272c, roughness:0.5}));
  body.position.set(0, 1.25, 0); g.add(body);
  var stand = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.9, 8), new THREE.MeshStandardMaterial({color:0x2a2e33, roughness:0.5}));
  stand.position.y = 0.8; g.add(stand);
  var base = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.3), new THREE.MeshStandardMaterial({color:0x2a2e33, roughness:0.5}));
  base.position.y = 0.35; g.add(base);
  g.position.set(x, yBase, z); g.rotation.y = rotY;
  scene.add(g);
}
var sharedWindowTex = new THREE.CanvasTexture(windowCanvas);
var sharedWindowMat = new THREE.MeshBasicMaterial({map:sharedWindowTex});
function addWindow(x, yBase, z, faceX){
  var g = new THREE.Group();
  var glow = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.2), sharedWindowMat);
  glow.position.y = 1.7;
  var frame = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.35, 1.75), new THREE.MeshStandardMaterial({color:0x1c2026, roughness:0.7}));
  frame.position.y = 1.7;
  g.add(glow); g.add(frame);
  g.position.set(x, yBase, z);
  g.rotation.y = faceX;
  scene.add(g);
}
var posterTexes = [];
var posterIdx = 0;
(function(){
  var loader = new THREE.TextureLoader();
  ['img/poster1.png','img/poster2.png','img/poster3.png'].forEach(function(p){
    try {
      var t = loader.load(p);
      if(THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
      posterTexes.push(t);
    } catch(e){}
  });
})();
function addPainting(x, yBase, z, rotY, which){
  var c = which ? paintCanvasB : paintCanvasA;
  var g = new THREE.Group();
  var useMap = posterTexes.length ? posterTexes[(posterIdx++) % posterTexes.length] : new THREE.CanvasTexture(c);
  var canvas = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 1.0), new THREE.MeshStandardMaterial({map:useMap, roughness:0.85}));
  canvas.position.y = 1.6;
  var frame = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.1, 0.05), new THREE.MeshStandardMaterial({map:new THREE.CanvasTexture(woodCanvas), roughness:0.6}));
  frame.position.y = 1.6; frame.position.z = 0.03;
  g.add(canvas); g.add(frame);
  g.position.set(x, yBase, z); g.rotation.y = rotY;
  scene.add(g);
}

/* ---------------- 房间内部装饰 ---------------- */
function makeNightstand(x, yBase, z){
  var g = new THREE.Group();
  var body = new THREE.Mesh(new THREE.BoxGeometry(0.5,0.6,0.45), new THREE.MeshStandardMaterial({map:new THREE.CanvasTexture(woodCanvas), roughness:0.6}));
  body.position.y = 0.3; body.castShadow = true;
  var top = new THREE.Mesh(new THREE.BoxGeometry(0.56,0.05,0.5), new THREE.MeshStandardMaterial({color:0x8a8172, roughness:0.5}));
  top.position.y = 0.63;
  var drawer = new THREE.Mesh(new THREE.BoxGeometry(0.42,0.12,0.02), new THREE.MeshStandardMaterial({color:0xb8a06a, roughness:0.4, metalness:0.6}));
  drawer.position.set(0,0.35,0.23);
  g.add(body); g.add(top); g.add(drawer);
  g.position.set(x,yBase,z);
  scene.add(g);
}
function makeShelf(x, yBase, z, rotY){
  var g = new THREE.Group();
  var woodM = new THREE.MeshStandardMaterial({map:new THREE.CanvasTexture(woodCanvas), roughness:0.6});
  var sideGeo = new THREE.BoxGeometry(0.06,2.1,0.5);
  [-0.6,0.6].forEach(function(px){
    var s = new THREE.Mesh(sideGeo, woodM); s.position.set(px,1.05,0); s.castShadow = true; g.add(s);
  });
  for(var i=0;i<3;i++){
    var sh = new THREE.Mesh(new THREE.BoxGeometry(1.26,0.06,0.46), woodM);
    sh.position.set(0,0.35+i*0.68,0); g.add(sh);
  }
  g.position.set(x,yBase,z); g.rotation.y = rotY || 0;
  scene.add(g);
}
function makeCrate(x, yBase, z, s){
  s = s || 1;
  var m = new THREE.Mesh(new THREE.BoxGeometry(0.7*s,0.6*s,0.6*s), new THREE.MeshStandardMaterial({map:new THREE.CanvasTexture(woodCanvas), roughness:0.75}));
  m.position.set(x, yBase+0.3*s, z); m.castShadow = true;
  scene.add(m);
}
function makeFlask(x, yBase, z, color){
  var g = new THREE.Group();
  var body = new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.11,0.26,8), new THREE.MeshStandardMaterial({color:color||0x88b8d8, roughness:0.2, metalness:0.1, transparent:true, opacity:0.9}));
  body.position.y = 0.9;
  var neck = new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,0.1,6), new THREE.MeshStandardMaterial({color:0x9aa5ad, roughness:0.3, metalness:0.4}));
  neck.position.y = 1.07;
  g.add(body); g.add(neck);
  g.position.set(x,yBase,z);
  scene.add(g);
}
function makeToilet(x, yBase, z, rotY){
  var g = new THREE.Group();
  var base = new THREE.Mesh(new THREE.BoxGeometry(0.45,0.42,0.6), new THREE.MeshStandardMaterial({color:0xc9cdd2, roughness:0.3}));
  base.position.y = 0.21;
  var tank = new THREE.Mesh(new THREE.BoxGeometry(0.4,0.5,0.16), new THREE.MeshStandardMaterial({color:0xc9cdd2, roughness:0.3}));
  tank.position.set(0,0.6,-0.25);
  var seat = new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.2,0.06,12), new THREE.MeshStandardMaterial({color:0xb8bec4, roughness:0.35}));
  seat.position.set(0,0.44,0.12); seat.rotation.x = Math.PI/2;
  g.add(base); g.add(tank); g.add(seat);
  g.position.set(x,yBase,z); g.rotation.y = rotY || 0;
  scene.add(g);
}
function makeSink(x, yBase, z){
  var g = new THREE.Group();
  var cab = new THREE.Mesh(new THREE.BoxGeometry(0.7,0.8,0.5), new THREE.MeshStandardMaterial({color:0x9aa1a8, roughness:0.5}));
  cab.position.y = 0.4;
  var basin = new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.2,0.06,10), new THREE.MeshStandardMaterial({color:0xd8dde2, roughness:0.25}));
  basin.position.set(0,0.82,0.1); basin.rotation.x = Math.PI/2;
  g.add(cab); g.add(basin);
  g.position.set(x,yBase,z);
  scene.add(g);
}
function makeLocker(x, yBase, z, rotY){
  var g = new THREE.Group();
  var body = new THREE.Mesh(new THREE.BoxGeometry(0.7,1.9,0.5), new THREE.MeshStandardMaterial({color:0x3f474d, roughness:0.5, metalness:0.5}));
  body.position.y = 0.95; body.castShadow = true;
  for(var i=0;i<3;i++){
    var vent = new THREE.Mesh(new THREE.BoxGeometry(0.3,0.08,0.02), matE(0x1c2126));
    vent.position.set(0,0.35+i*0.55,0.26); g.add(vent);
  }
  var handle = new THREE.Mesh(new THREE.BoxGeometry(0.06,0.18,0.03), new THREE.MeshStandardMaterial({color:0xb8a06a, roughness:0.3, metalness:0.6}));
  handle.position.set(-0.2,1.0,0.26); g.add(handle);
  g.add(body);
  g.position.set(x,yBase,z); g.rotation.y = rotY || 0;
  scene.add(g);
}
function makeDesk(x, yBase, z, rotY){
  var g = new THREE.Group();
  var top = new THREE.Mesh(new THREE.BoxGeometry(1.8,0.07,0.9), new THREE.MeshStandardMaterial({map:new THREE.CanvasTexture(woodCanvas), roughness:0.55}));
  top.position.y = 0.75; top.castShadow = true;
  var legGeo = new THREE.BoxGeometry(0.09,0.75,0.09);
  [[-0.8,0.35],[0.8,0.35],[-0.8,-0.35],[0.8,-0.35]].forEach(function(p){
    var l = new THREE.Mesh(legGeo, new THREE.MeshStandardMaterial({color:0x2a2e33, roughness:0.5, metalness:0.4}));
    l.position.set(p[0],0.375,p[1]); g.add(l);
  });
  var paper = new THREE.Mesh(new THREE.BoxGeometry(0.3,0.01,0.4), new THREE.MeshStandardMaterial({color:0xd8d2c4, roughness:0.9}));
  paper.position.set(-0.4,0.79,0); paper.rotation.y = 0.3;
  g.add(top); g.add(paper);
  g.position.set(x,yBase,z); g.rotation.y = rotY || 0;
  scene.add(g);
}
function makeBodyBag(x, yBase, z){
  var m = new THREE.Mesh(new THREE.BoxGeometry(0.8,0.32,2.1), new THREE.MeshStandardMaterial({color:0xd8dde0, roughness:0.85}));
  m.position.set(x, yBase+0.16, z); m.castShadow = true;
  scene.add(m);
}
function makePanel(x, yBase, z, rotY){
  var g = new THREE.Group();
  var body = new THREE.Mesh(new THREE.BoxGeometry(1.1,1.6,0.24), new THREE.MeshStandardMaterial({color:0x2e343a, roughness:0.4, metalness:0.5}));
  body.position.y = 0.9; body.castShadow = true;
  for(var i=0;i<6;i++){
    var led = new THREE.Mesh(new THREE.BoxGeometry(0.05,0.05,0.02), matE(Math.random()<0.5?0xff3020:0x30d050));
    led.position.set(-0.35+(i%3)*0.35, 1.25-Math.floor(i/3)*0.4, 0.13); g.add(led);
  }
  g.add(body);
  g.position.set(x,yBase,z); g.rotation.y = rotY || 0;
  scene.add(g);
}
function makeOpLamp(x, yBase, z){
  var g = new THREE.Group();
  var arm = new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,1.0,8), new THREE.MeshStandardMaterial({color:0xb8bec4, roughness:0.4, metalness:0.7}));
  arm.position.y = 2.4;
  var lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.34,0.34,0.1,14), matE(0xfff2d0));
  lamp.position.y = 1.92; lamp.rotation.x = Math.PI/2;
  g.add(arm); g.add(lamp);
  g.position.set(x,yBase,z);
  scene.add(g);
}
function makeWasher(x, yBase, z, rotY){
  var g = new THREE.Group();
  var body = new THREE.Mesh(new THREE.BoxGeometry(0.9,0.95,0.9), new THREE.MeshStandardMaterial({color:0xb8bec4, roughness:0.35, metalness:0.3}));
  body.position.y = 0.5; body.castShadow = true;
  var doorC = new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.3,0.06,16), new THREE.MeshStandardMaterial({color:0x5a646c, roughness:0.3, metalness:0.4}));
  doorC.position.set(0,0.55,0.46); doorC.rotation.x = Math.PI/2;
  g.add(body); g.add(doorC);
  g.position.set(x,yBase,z); g.rotation.y = rotY || 0;
  scene.add(g);
}
var FLASK_COLORS = [0x88b8d8, 0x9cd8a0, 0xd8b878, 0xd8a0a0, 0xb8a0d8, 0x90d0c0];
function decorateRoom(f, r, idx){
  var y0 = floorY(f);
  var cx = (r.x0+r.x1)/2, mid = (r.z0+r.z1)/2;
  var name = r.name;
  var backZ = (r.side === 'S') ? r.z1 - 2.1 : r.z0 + 2.1;
  var frontZ = (r.side === 'S') ? r.z0 + 1.6 : r.z1 - 1.6;
  var sideX = r.x0 < 0 ? r.x1 - 1.5 : r.x0 + 1.5;
  var outX = r.x0 < 0 ? r.x0 + 1.6 : r.x1 - 1.6;
  if(name.indexOf('病房') === 0){
    makeBed(cx, y0, backZ, 0);
    makeNightstand(outX, y0, r.z0 + 2.6);
    if(idx % 2 === 0) makeChair(sideX, y0, frontZ, 1.2);
    else makeIVStand(outX, y0, frontZ);
    addPainting(cx, y0, (r.side === 'S' ? r.z1-0.42 : r.z0+0.42), (r.side === 'S' ? Math.PI : 0), idx % 3 === 0);
  } else if(name === '护士站'){
    makeDesk(cx, y0, r.z0 + 3.2, Math.PI);
    makeChair(cx, y0, r.z0 + 4.9, 0);
    makeLocker(sideX, y0, frontZ, 0);
    addPainting(cx, y0, r.z0 + 0.42, 0, false);
  } else if(name === '药房'){
    makeShelf(outX, y0, backZ, 0);
    makeShelf(outX, y0, r.z0 + 4.4, 0);
    makeCrate(sideX, y0, frontZ);
    makeFlask(cx, y0, r.z1 - 1.2, FLASK_COLORS[0]);
  } else if(name === '卫生间'){
    makeToilet(outX + 0.6, y0, backZ + 0.4, 0);
    makeToilet(outX - 0.6, y0, backZ + 0.4, 0);
    makeSink(sideX, y0, frontZ);
    makeSink(sideX, y0, r.z0 + 4.2);
  } else if(name === '安保室'){
    makeDesk(cx, y0, r.z0 + 3.2, Math.PI);
    makeChair(cx, y0, r.z0 + 4.9, 0);
    makeLocker(outX, y0, frontZ, 0);
  } else if(name === '储物间' || name === '库房'){
    makeCrate(outX - 0.8, y0, backZ, 1.2);
    makeCrate(outX + 0.8, y0, backZ + 0.8, 1);
    makeShelf(sideX, y0, frontZ, Math.PI/2);
    makeCrate(outX, y0, r.z0 + 4.4, 0.8);
  } else if(name === '停尸房'){
    var morgue = [[cx, r.z0 + 2.2], [cx, r.z0 + 3.7], [cx, r.z0 + 5.2]];
    for(var mi=0; mi<morgue.length; mi++){
      box(2.0,0.9,0.8, 0x6a6f74, morgue[mi][0], y0+0.45, morgue[mi][1], null, {standard:true, castShadow:true});
      box(1.8,0.25,0.7, 0xc2c9d0, morgue[mi][0], y0+1.0, morgue[mi][1], null, {standard:true});
    }
    makeBodyBag(outX, y0, frontZ);
    makeBodyBag(outX - 1.4, y0, r.z1 - 2.0);
  } else if(name === '器材间' || name === '器械室'){
    makeShelf(outX, y0, backZ, 0);
    makeShelf(outX, y0, r.z0 + 4.4, 0);
    makeCrate(sideX, y0, frontZ, 1.2);
  } else if(name === '配电间' || name === '机房'){
    makePanel(outX, y0, backZ + 0.3, 0);
    makePanel(outX + 1.2, y0, r.z0 + 3.6, 0);
    box(1.2,1.0,0.8, 0x33393f, sideX, y0+0.5, frontZ, null, {standard:true, castShadow:true});
  } else if(name === '化验室'){
    box(2.2,0.85,1.0, 0x6a6f74, cx, y0+0.425, backZ, null, {standard:true, castShadow:true});
    for(var fi=0; fi<5; fi++){
      makeFlask(cx - 0.8 + fi*0.4, y0, backZ, FLASK_COLORS[fi]);
    }
    makeChair(sideX, y0, frontZ, 0.5);
  } else if(name === '档案室'){
    makeShelf(outX, y0, r.z0 + 1.7, 0);
    makeShelf(outX, y0, r.z0 + 3.0, 0);
    makeShelf(outX, y0, r.z0 + 4.3, 0);
  } else if(name === '治疗室'){
    makeBed(cx, y0, backZ, 0);
    makeMonitor(sideX, y0, r.z0 + 3.4, 0);
    makeIVStand(outX, y0, frontZ);
  } else if(name === '办公室'){
    makeDesk(cx - 1.5, y0, r.z0 + 3.0, Math.PI);
    makeDesk(cx + 1.5, y0, r.z1 - 2.6, 0);
    makeChair(cx - 1.5, y0, r.z0 + 4.8, 0);
    makeChair(cx + 1.5, y0, r.z1 - 4.3, Math.PI);
    addPainting(cx, y0, r.z0 + 0.42, 0, true);
  } else if(name === '隔离室'){
    makeBed(cx, y0, backZ, 0);
    makeChair(outX, y0, frontZ, 1.0);
    makeIVStand(sideX, y0, r.z0 + 3.2);
  } else if(name === '标本室'){
    makeShelf(outX, y0, backZ, 0);
    for(var ji=0; ji<4; ji++){
      makeFlask(cx - 1.2 + ji*0.8, y0, frontZ, 0x90d080);
    }
    box(1.6,0.85,0.8, 0x5a6068, sideX, y0+0.425, r.z0 + 3.4, null, {standard:true, castShadow:true});
  } else if(name === '观察室'){
    makeDesk(cx, y0, r.z1 - 2.8, 0);
    makeChair(cx, y0, r.z1 - 4.4, Math.PI);
    addPainting(cx, y0, r.z0 + 0.42, 0, false);
  } else if(name === '手术室'){
    box(2.4,0.9,1.1, 0x7a8288, cx, y0+0.45, backZ, null, {standard:true, castShadow:true});
    box(2.2,0.12,1.0, 0xc2c9d0, cx, y0+0.95, backZ, null, {standard:true});
    makeOpLamp(cx, y0, backZ);
    makeMonitor(sideX, y0, frontZ, Math.PI);
    makeChair(outX, y0, r.z0 + 4.6, 1.4);
  } else if(name === '监控室'){
    makeMonitor(cx - 1.4, y0, r.z0 + 2.2, Math.PI);
    makeMonitor(cx, y0, r.z0 + 2.2, Math.PI);
    makeMonitor(cx + 1.4, y0, r.z0 + 2.2, Math.PI);
    makeDesk(sideX, y0, frontZ, Math.PI/2);
    makeChair(sideX, y0, r.z1 - 3.0, -Math.PI/2);
  } else if(name === '药库'){
    makeShelf(outX, y0, backZ, 0);
    makeShelf(outX, y0, r.z0 + 4.4, 0);
    makeCrate(sideX, y0, frontZ, 1.1);
  } else if(name === '洗衣房'){
    makeWasher(outX, y0, backZ, 0);
    makeWasher(outX - 1.4, y0, backZ, 0.3);
    makeCrate(sideX, y0, frontZ, 1.2);
  }
}

var stairsRamps = [];
function buildNorthShaft(f){
  var y0 = floorY(f);
  addBoxWall(f, -2.8, -2.2, -23.15, -22.85);
  addBoxWall(f, 2.2, 2.8, -23.15, -22.85);
  addBoxWall(f, -2.95, -2.65, -27.5, -22.85);
  addBoxWall(f, 2.65, 2.95, -27.5, -22.85);
  addBoxWall(f, -2.8, 2.8, -27.65, -27.35, 4.4);
  var slabM = function(w, d, x, z){
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), ceilMat(w, d));
    m.position.set(x, y0-0.125, z); m.receiveShadow = true; scene.add(m);
  };
  slabM(5.6, 0.6, 0, -27.2);        // 远端平台
  slabM(3.3, 3.4, -1.65, -25.2);    // 西侧步道
  slabM(5.6, 0.65, 0, -23.18);      // 井口平台
  if(f === 0){ slabM(2.3, 3.4, 1.55, -25.2); } // 底层楼梯下补底
}
function buildWestShaft(f){
  var y0 = floorY(f);
  addBoxWall(f, -16.05, -15.75, -2.8, -2.2);
  addBoxWall(f, -16.05, -15.75, 2.2, 2.8);
  addBoxWall(f, -20.8, -15.85, -2.95, -2.65);
  addBoxWall(f, -20.8, -15.85, 2.65, 2.95);
  addBoxWall(f, -20.95, -20.65, -2.8, 2.8, 4.4);
  var slabM = function(w, d, x, z){
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), ceilMat(w, d));
    m.position.set(x, y0-0.125, z); m.receiveShadow = true; scene.add(m);
  };
  slabM(0.5, 5.6, -20.55, 0);      // 远端平台
  slabM(3.4, 3.3, -18.6, -1.65);    // 南侧步道
  slabM(1.05, 5.6, -16.375, 0);     // 井口平台
  slabM(3.4, 2.3, -18.6, 1.65);     // 楼梯下方补底
}
function buildWestHouse(){
  var f = 2, y0 = floorY(f);
  // 房体（x∈[-21,-18.8]），东侧开门洞 z∈[-0.9,0.9]
  wallsByFloor[f].push({minX:-21.15,maxX:-20.85,minZ:-2.9,maxZ:2.9});
  wallsByFloor[f].push({minX:-21,maxX:-18.8,minZ:-3.05,maxZ:-2.75});
  wallsByFloor[f].push({minX:-21,maxX:-18.8,minZ:2.75,maxZ:3.05});
  wallsByFloor[f].push({minX:-18.95,maxX:-18.65,minZ:-2.9,maxZ:-0.9});
  wallsByFloor[f].push({minX:-18.95,maxX:-18.65,minZ:2.6,maxZ:2.9});
  var hm = new THREE.MeshStandardMaterial({color:0x3a4148, roughness:0.6});
  var wall = function(w,h,d,x,y,z){
    var m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), hm);
    m.position.set(x,y,z); m.receiveShadow = true; m.castShadow = true; scene.add(m);
  };
  wall(0.3, 2.6, 5.8, -21, y0+1.3, 0);
  wall(2.2, 2.6, 0.3, -19.9, y0+1.3, -2.9);
  wall(2.2, 2.6, 0.3, -19.9, y0+1.3, 2.9);
  wall(0.3, 2.6, 2.0, -18.8, y0+1.3, -1.9);
  wall(0.3, 2.6, 0.3, -18.8, y0+1.3, 2.75);
  wall(2.2, 0.14, 5.8, -19.9, y0+2.62, 0);   // 屋顶
  var fm = new THREE.MeshStandardMaterial({map:new THREE.CanvasTexture(roofCanvas), roughness:0.9});
  var fslab = function(w, d, x, z){
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), fm);
    m.position.set(x, y0+0.05, z); m.receiveShadow = true; scene.add(m);
  };
  // 房内地板（楼梯洞 z∈[0.5,2.6] 全段留空，梯段由此下到 1 层）
  fslab(2.2, 3.4, -19.9, -1.2);
  fslab(2.2, 0.3, -19.9, 2.75);
}
function addStairFlight(axis, c0, c1, w0, w1, y0, y1, lower, upper){
  if(axis === 'z'){
    stairsRamps.push({axis:'z', x0:w0, x1:w1, z0:c0, z1:c1, y0:y0, y1:y1, lower:lower, upper:upper});
  } else {
    stairsRamps.push({axis:'x', z0:w0, z1:w1, x0:c0, x1:c1, y0:y0, y1:y1, lower:lower, upper:upper});
  }
  var stepsN = 14;
  var rise = (y1-y0)/stepsN, tread = Math.abs(c1-c0)/stepsN;
  var stepMat = new THREE.MeshStandardMaterial({color:0x3d434c, roughness:0.8, metalness:0.15});
  for(var i=0;i<stepsN;i++){
    var tt = (i+0.5)/stepsN;
    var yy = y0 + (y1-y0)*tt;
    var cc = c0 + (c1-c0)*tt;
    var step;
    if(axis === 'z'){ step = new THREE.Mesh(new THREE.BoxGeometry(w1-w0, rise+0.02, tread+0.02), stepMat); }
    else { step = new THREE.Mesh(new THREE.BoxGeometry(tread+0.02, rise+0.02, w1-w0), stepMat); }
    if(axis === 'z') step.position.set((w0+w1)/2, yy, cc);
    else step.position.set(cc, yy, (w0+w1)/2);
    step.castShadow = true; step.receiveShadow = true;
    scene.add(step);
  }
  // 扶手
  var ang = Math.atan2(y1-y0, Math.abs(c1-c0));
  var railMat = new THREE.MeshStandardMaterial({color:0x2c3238, roughness:0.5, metalness:0.4});
  [-1, 1].forEach(function(sg){
    var rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.0, Math.abs(c1-c0)+0.5), railMat);
    if(axis === 'z'){
      rail.position.set(sg>0 ? w1-0.12 : w0+0.12, (y0+y1)/2, (c0+c1)/2);
      rail.rotation.x = -ang;
    } else {
      rail.position.set((c0+c1)/2, (y0+y1)/2, sg>0 ? w1-0.12 : w0+0.12);
      rail.rotation.z = sg*ang;
    }
    rail.castShadow = true;
    scene.add(rail);
  });
}
function buildStairs(){
  // 北楼梯：0 ↔ 1（沿 z，向北上升）
  addStairFlight('z', -23.5, -26.9, 0.5, 2.6, floorY(0), floorY(1), 0, 1);
  // 西楼梯：1 ↔ 2（沿 x，向西上升）
  addStairFlight('x', -16.9, -20.3, 0.5, 2.6, floorY(1), floorY(2), 1, 2);
}

function buildAllFloors(){
  var f;
  for(f=0; f<FLOORS; f++){ wallsByFloor.push([]); spawnPointsByFloor.push([]); }
  buildFloorRooms(0, FLOOR0_ROOMS);
  buildFloorRooms(1, FLOOR1_ROOMS);
  buildRoof(2);
  buildStairs();
}

/* ---------------- 房门系统 ---------------- */
var doors = [];
function openDoor(d){
  if(!d || d.target !== 0 || d.locked) return;
  d.target = 1.75;
  AudioSys.door();
}
function toggleLock(d){
  if(!d) return;
  d.locked = !d.locked;
  if(d.locked){ d.target = 0; d.ang = 0; d.g.rotation.y = d.baseRotY; }
  AudioSys.door();
  showMsg(d.locked ? '门锁上了' : '门解锁了', 1.2);
}
function updateDoors(dt){
  for(var i=0;i<doors.length;i++){
    var d = doors[i];
    if(d.ang !== d.target){
      d.ang += (d.target - d.ang) * Math.min(1, dt*3.5);
      if(Math.abs(d.ang - d.target) < 0.02) d.ang = d.target;
      d.g.rotation.y = d.baseRotY + d.ang * d.dirSign;
    }
    if(!d.locked && d.bangT && d.bangT > 0 && d.ang === 0){ d.g.rotation.z = 0; }
  }
}
function resolveDoors(pos, radius, floor){
  for(var i=0;i<doors.length;i++){
    var d = doors[i];
    if(d.floor !== floor || d.ang > 0.9) continue;
    var cx = clamp(pos.x, d.minX, d.maxX), cz = clamp(pos.z, d.minZ, d.maxZ);
    var dx = pos.x - cx, dz = pos.z - cz, d2 = dx*dx + dz*dz;
    if(d2 < radius*radius){
      var dd = Math.sqrt(d2);
      if(dd < 0.0001){ pos.x = cx + (pos.x >= cx ? radius : -radius); }
      else { var push = (radius-dd)/dd; pos.x += dx*push; pos.z += dz*push; }
    }
  }
}
function nearestDoor(){
  /* 按到门框的距离判定：正对/背对/侧身都能交互 */
  var best = null, bestD = 2.3;
  for(var i=0;i<doors.length;i++){
    var d = doors[i];
    if(d.floor !== currentFloor) continue;
    var cx = clamp(player.pos.x, d.minX, d.maxX);
    var cz = clamp(player.pos.z, d.minZ, d.maxZ);
    var dx = player.pos.x - cx, dz = player.pos.z - cz;
    var dist = Math.sqrt(dx*dx + dz*dz);
    if(dist < bestD){ bestD = dist; best = d; }
  }
  return best;
}
/* ---------------- 碰撞 ---------------- */
function resolveCircle(pos, radius, walls){
  for(var i=0;i<walls.length;i++){
    var w = walls[i];
    var cx = clamp(pos.x, w.minX, w.maxX);
    var cz = clamp(pos.z, w.minZ, w.maxZ);
    var dx = pos.x-cx, dz = pos.z-cz;
    var d2 = dx*dx+dz*dz;
    if(d2 < radius*radius){
      var d = Math.sqrt(d2);
      if(d < 0.0001){
        var left = pos.x-w.minX, right = w.maxX-pos.x, top = pos.z-w.minZ, bot = w.maxZ-pos.z;
        var m = Math.min(left,right,top,bot);
        if(m===left) pos.x = w.minX-radius; else if(m===right) pos.x = w.maxX+radius;
        else if(m===top) pos.z = w.minZ-radius; else pos.z = w.maxZ+radius;
      } else {
        var push = (radius-d)/d;
        pos.x += dx*push; pos.z += dz*push;
      }
    }
  }
}

if(elGfxbtn) elGfxbtn.addEventListener('pointerdown', function(e){
  e.preventDefault();
  qualityLevel = qualityLevel >= 2 ? 0 : 2;
  applyQuality();
  elGfxbtn.textContent = qualityLevel >= 2 ? '画质 · 高清' : '画质 · 流畅';
  AudioSys.pickup();
});
elDiffbtn.addEventListener('pointerdown', function(e){
  e.preventDefault();
  difficulty = difficulty === 1 ? 1.5 : 1;
  elDiffbtn.textContent = difficulty === 1 ? '难度 · 普通' : '难度 · 困难';
  AudioSys.pickup();
});
elDoorbtn.addEventListener('pointerdown', function(e){
  e.preventDefault();
  var di = +elDoorbtn.dataset.door;
  if(di >= 0 && doors[di]){
    var dd = doors[di];
    if(dd.locked) toggleLock(dd);
    else if(dd.ang > 0.5) toggleLock(dd);
    else openDoor(dd);
  }
});
/* ---------------- 粒子 ---------------- */
var particles = [];
function spawnBlood(x,y,z,n){
  for(var i=0;i<n;i++){
    if(particles.length>160) break;
    var t = tex(bloodCanvas);
    var m = new THREE.Mesh(new THREE.PlaneGeometry(rand(0.05,0.14),rand(0.05,0.14)),
      new THREE.MeshBasicMaterial({map:t, transparent:true, opacity:0.95}));
    m.position.set(x+rand(-0.1,0.1), y+rand(-0.1,0.1), z+rand(-0.1,0.1));
    m.rotation.set(rand(0,3.14),rand(0,3.14),rand(0,3.14));
    scene.add(m);
    particles.push({m:m, vx:rand(-1.4,1.4), vy:rand(0.6,2.4), vz:rand(-1.4,1.4), life:rand(0.35,0.7)});
  }
}
function updateParticles(dt){
  for(var i=particles.length-1;i>=0;i--){
    var p = particles[i];
    p.life -= dt; if(p.life<=0){ scene.remove(p.m); p.m.geometry.dispose(); p.m.material.dispose(); particles.splice(i,1); continue; }
    p.vy -= 6*dt;
    p.m.position.x += p.vx*dt; p.m.position.y += p.vy*dt; p.m.position.z += p.vz*dt;
    p.m.material.opacity = clamp(p.life*1.6,0,1);
  }
}

/* ---------------- 武器 ---------------- */
var WEAPONS = [
  {name:'手枪',   magSize:12, dmg:34, pellets:1, spread:0.012, rate:0.32, reloadT:1.4, auto:false},
  {name:'霰弹枪', magSize:6,  dmg:22, pellets:8, spread:0.055, rate:0.9, reloadT:2.2, auto:false},
  {name:'冲锋枪', magSize:30, dmg:12, pellets:1, spread:0.032, rate:0.085, reloadT:1.8, auto:true},
  {name:'狙击枪', magSize:5,  dmg:150, pellets:1, spread:0.001, rate:1.4, reloadT:2.8, auto:false}
];
var player = {
  pos:new THREE.Vector3(0,0,0), yaw:Math.PI, pitch:0,
  hp:100, maxHp:100,
  weapons:[{idx:0, mag:12}], cur:0, unlocked:[0],
  fireCd:0, reloading:false, reloadT:0, firing:false,
  speed:0,
  stamina:200, staminaMax:200, exhausted:false, boostT:0,
  sanity:100, sanityMax:100, medUsed:0, sticks:2,
  hiding:false, hideLocker:null, hideT:0
};
for(var wi=1; wi<WEAPONS.length; wi++){ player.weapons.push({idx:wi, mag:WEAPONS[wi].magSize}); }

/* 枪模型（第一人称） */
var gunGroup = new THREE.Group();
camera.add(gunGroup);
gunGroup.position.set(0.24,-0.22,-0.5);
var muzzle = new THREE.Mesh(new THREE.PlaneGeometry(0.18,0.18), new THREE.MeshBasicMaterial({color:0xffd27a, transparent:true, opacity:0}));
muzzle.position.set(0,0.02,-0.32); gunGroup.add(muzzle);
var gunBasePos = gunGroup.position.clone();
var gunBaseRot = gunGroup.rotation.clone();
var recoil = 0;
var rampTrack = { id:-1, t0:0 }, rampCooldown = 0;
var flashOn = true;
var DEV_PASS = 'zzs';
var dev = { on:false, god:false, infAmmo:false, infStam:false, infFlash:false,
            oneShot:false, freeze:false, fast:false, debug:false };
var devPanelOpen = false, devTaps = 0, devTapTimer = 0;
var noiseLevel = 0;      /* 动静/暴露度：跑步与开灯会拉高，怪物更容易发现你 */
var runHeld = false;
var magDrops = [];

function buildGunModel(idx){
  while(gunGroup.children.length>1) gunGroup.remove(gunGroup.children[gunGroup.children.length-1]);
  var g = new THREE.Group(); var m;
  var metalMat = new THREE.MeshStandardMaterial({map:new THREE.CanvasTexture(metalCanvas), roughness:0.35, metalness:0.85});
  var darkMat = new THREE.MeshStandardMaterial({color:0x14161a, roughness:0.5, metalness:0.6});
  var woodMat = new THREE.MeshStandardMaterial({map:new THREE.CanvasTexture(woodCanvas), roughness:0.55, metalness:0.1});
  var dotMat = new THREE.MeshBasicMaterial({color:0x8fe8ff});
  var cy = function(r1, r2, len, segs){ return new THREE.CylinderGeometry(r1, r2, len, segs || 10); };
  if(idx===0){
    var slide = new THREE.Mesh(new THREE.BoxGeometry(0.052,0.068,0.2), metalMat); slide.position.set(0,0.045,-0.02); g.add(slide);
    var barrel = new THREE.Mesh(cy(0.017,0.019,0.1,8), metalMat); barrel.rotation.x=Math.PI/2; barrel.position.set(0,0.045,-0.15); g.add(barrel);
    var muzzle = new THREE.Mesh(cy(0.022,0.022,0.03,8), darkMat); muzzle.rotation.x=Math.PI/2; muzzle.position.set(0,0.045,-0.19); g.add(muzzle);
    var frame = new THREE.Mesh(new THREE.BoxGeometry(0.048,0.05,0.14), darkMat); frame.position.set(0,0.01,-0.03); g.add(frame);
    var grip = new THREE.Mesh(new THREE.BoxGeometry(0.045,0.12,0.055), darkMat); grip.position.set(0,-0.07,0.02); grip.rotation.x=0.2; g.add(grip);
    var tg1 = new THREE.Mesh(new THREE.BoxGeometry(0.02,0.045,0.01), darkMat); tg1.position.set(0,-0.015,0.045); g.add(tg1);
    var tg2 = new THREE.Mesh(new THREE.BoxGeometry(0.02,0.01,0.05), darkMat); tg2.position.set(0,-0.038,0.055); g.add(tg2);
    var trig = new THREE.Mesh(new THREE.BoxGeometry(0.012,0.03,0.008), darkMat); trig.position.set(0,0.005,0.045); trig.rotation.x=-0.15; g.add(trig);
    var hammer = new THREE.Mesh(new THREE.BoxGeometry(0.02,0.03,0.01), metalMat); hammer.position.set(0,0.07,0.04); g.add(hammer);
    var base = new THREE.Mesh(new THREE.BoxGeometry(0.045,0.015,0.06), darkMat); base.position.set(0,-0.13,0.02); g.add(base);
    var sf = new THREE.Mesh(new THREE.BoxGeometry(0.012,0.02,0.012), metalMat); sf.position.set(0,0.09,-0.13); g.add(sf);
    var sr = new THREE.Mesh(new THREE.BoxGeometry(0.012,0.018,0.012), metalMat); sr.position.set(0,0.086,-0.045); g.add(sr);
    var dotF = new THREE.Mesh(new THREE.BoxGeometry(0.006,0.006,0.004), dotMat); dotF.position.set(0,0.1,-0.13); g.add(dotF);
    addHand(g, -0.005, -0.06, 0.02);
  } else if(idx===1){
    var b1 = new THREE.Mesh(cy(0.02,0.02,0.52,8), metalMat); b1.rotation.x=Math.PI/2; b1.position.set(0,0.02,-0.29); g.add(b1);
    var b2 = new THREE.Mesh(cy(0.018,0.018,0.38,8), darkMat); b2.rotation.x=Math.PI/2; b2.position.set(0,-0.014,-0.19); g.add(b2);
    var bead = new THREE.Mesh(new THREE.SphereGeometry(0.008,6,5), dotMat); bead.position.set(0,0.045,-0.55); g.add(bead);
    var recv = new THREE.Mesh(new THREE.BoxGeometry(0.05,0.06,0.2), metalMat); recv.position.set(0,0.01,0.05); g.add(recv);
    var port = new THREE.Mesh(new THREE.BoxGeometry(0.02,0.025,0.07), darkMat); port.position.set(0.026,0.03,0.05); g.add(port);
    var pump = new THREE.Mesh(new THREE.BoxGeometry(0.075,0.065,0.18), woodMat); pump.position.set(0,-0.015,-0.19); g.add(pump);
    var ribs = new THREE.Mesh(new THREE.BoxGeometry(0.078,0.02,0.16), darkMat); ribs.position.set(0,-0.045,-0.19); g.add(ribs);
    var stock = new THREE.Mesh(new THREE.BoxGeometry(0.05,0.09,0.24), woodMat); stock.position.set(0,-0.02,0.2); stock.rotation.x=-0.08; g.add(stock);
    var butt = new THREE.Mesh(new THREE.BoxGeometry(0.055,0.1,0.05), darkMat); butt.position.set(0,-0.035,0.3); g.add(butt);
    var tg = new THREE.Mesh(new THREE.BoxGeometry(0.02,0.045,0.01), darkMat); tg.position.set(0,-0.012,0.1); g.add(tg);
    addHand(g, -0.01, -0.02, -0.14);
  } else if(idx===3){
    /* 狙击枪：长枪管 + 瞄准镜 + 拉栓 + 两脚架 */
    var rbar = new THREE.Mesh(cy(0.016,0.017,0.72,8), metalMat); rbar.rotation.x=Math.PI/2; rbar.position.set(0,0.03,-0.38); g.add(rbar);
    var rmz = new THREE.Mesh(cy(0.024,0.024,0.05,8), darkMat); rmz.rotation.x=Math.PI/2; rmz.position.set(0,0.03,-0.74); g.add(rmz);
    var rrecv = new THREE.Mesh(new THREE.BoxGeometry(0.055,0.07,0.26), darkMat); rrecv.position.set(0,0.02,0.02); g.add(rrecv);
    var rscope = new THREE.Mesh(cy(0.028,0.028,0.26,10), darkMat); rscope.rotation.x=Math.PI/2; rscope.position.set(0,0.105,-0.08); g.add(rscope);
    var rlens = new THREE.Mesh(cy(0.031,0.031,0.02,10), new THREE.MeshBasicMaterial({color:0x1b3a4a})); rlens.rotation.x=Math.PI/2; rlens.position.set(0,0.105,-0.215); g.add(rlens);
    var rmount1 = new THREE.Mesh(new THREE.BoxGeometry(0.02,0.04,0.03), metalMat); rmount1.position.set(0,0.075,-0.14); g.add(rmount1);
    var rmount2 = new THREE.Mesh(new THREE.BoxGeometry(0.02,0.04,0.03), metalMat); rmount2.position.set(0,0.075,-0.02); g.add(rmount2);
    var rbolt = new THREE.Mesh(new THREE.BoxGeometry(0.09,0.016,0.016), metalMat); rbolt.position.set(0.05,0.05,0.03); g.add(rbolt);
    var rknob = new THREE.Mesh(new THREE.SphereGeometry(0.014,8,6), metalMat); rknob.position.set(0.095,0.05,0.03); g.add(rknob);
    var rstock = new THREE.Mesh(new THREE.BoxGeometry(0.05,0.095,0.3), woodMat); rstock.position.set(0,-0.015,0.24); rstock.rotation.x=-0.06; g.add(rstock);
    var rbutt = new THREE.Mesh(new THREE.BoxGeometry(0.055,0.11,0.05), darkMat); rbutt.position.set(0,-0.03,0.4); g.add(rbutt);
    var rmag = new THREE.Mesh(new THREE.BoxGeometry(0.04,0.1,0.08), darkMat); rmag.position.set(0,-0.06,0); g.add(rmag);
    var rtg = new THREE.Mesh(new THREE.BoxGeometry(0.02,0.045,0.01), darkMat); rtg.position.set(0,-0.02,0.09); g.add(rtg);
    var rbip = new THREE.Mesh(cy(0.008,0.008,0.26,6), darkMat); rbip.position.set(0,-0.1,-0.5); rbip.rotation.z=0.18; g.add(rbip);
    addHand(g, -0.005, -0.05, -0.05);
  } else {
    var recv2 = new THREE.Mesh(new THREE.BoxGeometry(0.06,0.08,0.32), metalMat); recv2.position.set(0,0.03,0); g.add(recv2);
    var b3 = new THREE.Mesh(cy(0.015,0.015,0.17,8), metalMat); b3.rotation.x=Math.PI/2; b3.position.set(0,0.035,-0.21); g.add(b3);
    var frontRing = new THREE.Mesh(new THREE.TorusGeometry(0.03,0.006,6,10), darkMat); frontRing.position.set(0,0.02,-0.25); g.add(frontRing);
    var cock = new THREE.Mesh(new THREE.BoxGeometry(0.015,0.03,0.05), darkMat); cock.position.set(0,0.08,-0.02); g.add(cock);
    var mag = new THREE.Mesh(new THREE.BoxGeometry(0.045,0.22,0.06), darkMat); mag.position.set(0,-0.1,0.03); mag.rotation.x=-0.22; g.add(mag);
    var grip2 = new THREE.Mesh(new THREE.BoxGeometry(0.05,0.1,0.06), darkMat); grip2.position.set(0,-0.08,0.12); grip2.rotation.x=0.15; g.add(grip2);
    var stock2 = new THREE.Mesh(new THREE.BoxGeometry(0.04,0.05,0.2), darkMat); stock2.position.set(0,0.01,0.22); g.add(stock2);
    var stockStrut = new THREE.Mesh(new THREE.BoxGeometry(0.025,0.1,0.03), darkMat); stockStrut.position.set(0,-0.03,0.18); stockStrut.rotation.x=-0.3; g.add(stockStrut);
    var fg = new THREE.Mesh(new THREE.BoxGeometry(0.045,0.07,0.05), darkMat); fg.position.set(0,-0.03,-0.17); g.add(fg);
    var s3 = new THREE.Mesh(new THREE.BoxGeometry(0.014,0.03,0.014), metalMat); s3.position.set(0,0.085,-0.05); g.add(s3);
    addHand(g, -0.005, -0.06, 0.02);
  }
  gunGroup.add(g);
}
function addHand(parent, x, y, z){
  var skin = new THREE.MeshStandardMaterial({color:0xb59b82, roughness:0.85});
  var palm = new THREE.Mesh(new THREE.BoxGeometry(0.062,0.045,0.045), skin); palm.position.set(x,y,z); parent.add(palm);
  for(var i=0;i<4;i++){
    var f = new THREE.Mesh(new THREE.CylinderGeometry(0.008,0.007,0.05,6), skin);
    f.position.set(x-0.026+i*0.017, y+0.032, z+0.01); f.rotation.x=-0.5;
    parent.add(f);
  }
  var thumb = new THREE.Mesh(new THREE.CylinderGeometry(0.008,0.007,0.032,6), skin);
  thumb.position.set(x-0.037, y+0.018, z-0.004); thumb.rotation.x=-0.3;
  parent.add(thumb);
}

/* ---------------- 怪物 ---------------- */
var MONSTER_TYPES = {
  patient:    {hp:60,  speed:2.1, dmg:10, radius:0.45, height:1.7, halfH:0.85, atkR:1.45, atkCd:1.0},
  crawler:    {hp:45,  speed:3.3, dmg:11, radius:0.42, height:1.0, halfH:0.5,  atkR:1.25, atkCd:0.7},
  blind:      {hp:130, speed:1.3, dmg:24, radius:0.5,  height:1.95, halfH:0.98, atkR:1.75, atkCd:1.1, blind:true},
  doctor:     {hp:90,  speed:2.7, dmg:13, radius:0.45, height:1.8, halfH:0.9,  atkR:1.5,  atkCd:0.9},
  ghost:      {hp:90,  speed:2.9, dmg:14, radius:0.5,  height:1.6, halfH:0.8,  atkR:1.55, atkCd:0.9, ghost:true},
  hachishaku: {hp:300, speed:1.5, dmg:24, radius:0.6,  height:2.6, halfH:1.3,  atkR:1.9,  atkCd:1.1},
  slender:    {hp:200, speed:2.3, dmg:18, radius:0.45, height:2.7, halfH:1.35, atkR:1.8,  atkCd:1.0, slender:true}
};
var monsters = [];
var spawnTimers = {};

function markShadow(group){
  group.traverse(function(o){ if(o.isMesh){ o.castShadow = true; } });
}

function buildMonsterMesh(type){
  var g = new THREE.Group(); var m;
  var t = MONSTER_TYPES[type];
  var texStd = function(canvas, rough){ return new THREE.MeshStandardMaterial({map:new THREE.CanvasTexture(canvas), roughness:rough!=null?rough:0.9}); };
  var skinM = new THREE.MeshStandardMaterial({color:0xd9c0a8, roughness:0.85});
  var cyl = function(r1, r2, len, segs){ return new THREE.CylinderGeometry(r1, r2, len, segs || 8); };
  if(type==='slender'){
    // 西装躯干 + 白衬衫红领带
    var torsoS = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.5, 0.26), new THREE.MeshStandardMaterial({color:0x14161a, roughness:0.5}));
    torsoS.position.y = 0.8; g.add(torsoS);
    var chest = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.55), texStd(suitFrontCanvas, 0.5));
    chest.position.set(0, 1.02, 0.136); g.add(chest);
    // 无脸白头（球体）
    var headS = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), new THREE.MeshStandardMaterial({color:0xe8e8ec, roughness:0.85}));
    headS.scale.set(1, 1.15, 1); headS.position.y = 1.94; g.add(headS);
    var neckS = new THREE.Mesh(cyl(0.05, 0.06, 0.12, 8), new THREE.MeshStandardMaterial({color:0xe0e0e4, roughness:0.9}));
    neckS.position.y = 1.72; g.add(neckS);
    // 超长手臂（圆柱）
    var armSL = new THREE.Group(); armSL.position.set(-0.25, 1.42, 0);
    m = new THREE.Mesh(cyl(0.045, 0.04, 0.75, 8), new THREE.MeshStandardMaterial({color:0x14161a, roughness:0.5})); m.position.y=-0.35; armSL.add(m);
    m = new THREE.Mesh(cyl(0.036, 0.03, 0.7, 8), new THREE.MeshStandardMaterial({color:0x101216, roughness:0.5})); m.position.y=-0.95; armSL.add(m);
    m = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.24, 0.05), skinM); m.position.y=-1.32; armSL.add(m);
    var armSR = armSL.clone(); armSR.position.x = 0.25;
    g.add(armSL); g.add(armSR);
    // 细长腿
    var legSL = new THREE.Group(); legSL.position.set(-0.11, 0.55, 0);
    m = new THREE.Mesh(cyl(0.05, 0.045, 0.7, 8), new THREE.MeshStandardMaterial({color:0x0c0d11, roughness:0.6})); m.position.y=-0.35; legSL.add(m);
    m = new THREE.Mesh(cyl(0.04, 0.035, 0.6, 8), new THREE.MeshStandardMaterial({color:0x08090c, roughness:0.6})); m.position.y=-0.9; legSL.add(m);
    m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.2), new THREE.MeshStandardMaterial({color:0x05060a, roughness:0.6})); m.position.set(0,-1.18,-0.04); legSL.add(m);
    var legSR = legSL.clone(); legSR.position.x = 0.11;
    g.add(legSL); g.add(legSR);
    // 背生触手（追逐时舞动）
    var tents = [];
    var tentMat = new THREE.MeshStandardMaterial({color:0x0a0b0e, roughness:0.55});
    for(var ti=0; ti<4; ti++){
      var tent = new THREE.Group();
      for(var tsi=0; tsi<5; tsi++){
        var seg = new THREE.Mesh(new THREE.SphereGeometry(0.05 - tsi*0.0045, 6, 5), tentMat);
        seg.position.y = -tsi*0.15;
        seg.scale.y = 1.2;
        tent.add(seg);
      }
      tent.position.set(rand(-0.06,0.06), 1.1, -0.1);
      tent.rotation.x = rand(-0.5, 0.3);
      tent.rotation.y = rand(0, 6.28);
      tent.userData = {ph: rand(0, 6.28), sp: rand(0.7, 1.3)};
      g.add(tent);
      tents.push(tent);
    }
    g.userData = {armL:armSL, armR:armSR, legL:legSL, legR:legSR, torso:torsoS, tents:tents};
  } else if(type==='hachishaku'){
    // 白裙（锥形裙摆）+ 上身 + 长袖
    var skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.8, 1.35, 12, 1, false), texStd(dressCanvas, 0.9));
    skirt.position.y = 0.68; g.add(skirt);
    var torsoH = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.75, 0.27), texStd(dressCanvas, 0.9));
    torsoH.position.y = 1.35; g.add(torsoH);
    var headH = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), skinM);
    headH.scale.set(1, 1.1, 1); headH.position.y = 2.0; g.add(headH);
    var faceH = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.24), texStd(faceHachiCanvas));
    faceH.position.set(0, 2.0, 0.125); g.add(faceH);
    var neckH = new THREE.Mesh(cyl(0.055, 0.065, 0.12, 8), skinM);
    neckH.position.y = 1.82; g.add(neckH);
    // 超长直发（前后多层）
    var hairB = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 1.9), new THREE.MeshStandardMaterial({color:0x0e0e12, roughness:0.9, side:THREE.DoubleSide}));
    hairB.position.set(0, 1.3, -0.2); g.add(hairB);
    var hairB2 = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 1.7), new THREE.MeshStandardMaterial({color:0x131318, roughness:0.9, side:THREE.DoubleSide}));
    hairB2.position.set(0, 1.4, -0.16); g.add(hairB2);
    var hairF = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.5), new THREE.MeshStandardMaterial({color:0x0e0e12, roughness:0.9, side:THREE.DoubleSide}));
    hairF.position.set(0, 2.02, 0.16); g.add(hairF);
    // 宽檐帽 + 红丝带
    var brim = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.05, 16), new THREE.MeshStandardMaterial({color:0x1a1a20, roughness:0.7}));
    brim.position.y = 2.26; g.add(brim);
    var crown = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.24, 12), new THREE.MeshStandardMaterial({color:0x1a1a20, roughness:0.7}));
    crown.position.y = 2.37; g.add(crown);
    var ribbon = new THREE.Mesh(new THREE.CylinderGeometry(0.285, 0.285, 0.05, 12), new THREE.MeshStandardMaterial({color:0x7a1f24, roughness:0.7}));
    ribbon.position.y = 2.3; g.add(ribbon);
    // 超长手臂 + 广袖
    var armHL = new THREE.Group(); armHL.position.set(-0.28, 1.45, 0);
    m = new THREE.Mesh(cyl(0.05, 0.045, 0.5, 8), texStd(dressCanvas, 0.9)); m.position.y=-0.25; armHL.add(m);
    m = new THREE.Mesh(cyl(0.04, 0.035, 0.5, 8), texStd(dressCanvas, 0.9)); m.position.y=-0.72; armHL.add(m);
    var sleeve = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.5, 10, 1, true), texStd(dressCanvas, 0.9));
    sleeve.position.y = -0.88; armHL.add(sleeve);
    m = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.2, 0.06), skinM); m.position.y=-1.02; armHL.add(m);
    var armHR = armHL.clone(); armHR.position.x = 0.28;
    g.add(armHL); g.add(armHR);
    g.userData = {armL:armHL, armR:armHR, torso:torsoH};
  } else if(type==='ghost'){
    // 菲涅尔发光内体
    var glowMat = new THREE.ShaderMaterial({
      uniforms: { uTime:{value:0}, uColor:{value:new THREE.Color(0xdde4ea)} },
      vertexShader: 'varying vec3 vN; varying vec3 vP; void main(){ vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.0); vP = mv.xyz; gl_Position = projectionMatrix*mv; }',
      fragmentShader: 'uniform vec3 uColor; varying vec3 vN; varying vec3 vP; void main(){ float fr = pow(1.0 - abs(dot(normalize(vN), normalize(-vP))), 2.2); vec3 col = uColor*(0.3 + fr*1.7); float a = 0.5 + fr*0.5; gl_FragColor = vec4(col, a); }',
      transparent: true, depthWrite: false, side: THREE.DoubleSide
    });
    var bodyG = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 0.95, 10), glowMat);
    bodyG.position.y = 0.48; g.add(bodyG);
    var headG = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), new THREE.MeshStandardMaterial({color:0xd5dade, roughness:0.9, transparent:true, opacity:0.7}));
    headG.scale.set(1, 1.1, 1); headG.position.y = 1.08; g.add(headG);
    var faceG = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.24), new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(faceGhostCanvas), transparent:true}));
    faceG.position.set(0, 1.08, 0.11); g.add(faceG);
    var hairG = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.55, 0.28), new THREE.MeshStandardMaterial({color:0x141418, roughness:0.95, transparent:true, opacity:0.75}));
    hairG.position.y = 1.2; g.add(hairG);
    // 裹尸布（外层，纹理）
    var shroud = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.62, 1.35, 12, 1, true), new THREE.MeshStandardMaterial({map:new THREE.CanvasTexture(shroudCanvas), transparent:true, opacity:0.72, roughness:0.9, side:THREE.DoubleSide, depthWrite:false}));
    shroud.position.y = 0.62; g.add(shroud);
    g.userData = {shroud:shroud, glowMat:glowMat};
  } else if(type==='blind'){
    /* 盲眼修女：黑袍 + 白头巾 + 蒙眼布 */
    var robe = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.46, 1.5, 10), new THREE.MeshStandardMaterial({color:0x0d0e12, roughness:0.92}));
    robe.position.y = 0.78; g.add(robe);
    var collar = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.14, 10), new THREE.MeshStandardMaterial({color:0xe6e4dc, roughness:0.8}));
    collar.position.y = 1.5; g.add(collar);
    var headB = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), skinM);
    headB.position.y = 1.63; g.add(headB);
    var coif = new THREE.Mesh(new THREE.SphereGeometry(0.175, 12, 10), new THREE.MeshStandardMaterial({color:0xeeece4, roughness:0.85}));
    coif.position.y = 1.66; coif.scale.set(1, 1.05, 1); g.add(coif);
    var faceB = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.22), skinM);
    faceB.position.set(0, 1.62, 0.17); g.add(faceB);
    var band = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.07, 0.03), new THREE.MeshStandardMaterial({color:0xd8d2c4, roughness:0.9}));
    band.position.set(0, 1.65, 0.175); g.add(band);
    var armBL = new THREE.Group(); armBL.position.set(-0.28, 1.4, 0);
    m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.042, 0.62, 8), new THREE.MeshStandardMaterial({color:0x0d0e12, roughness:0.92})); m.position.y=-0.31; armBL.add(m);
    m = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), skinM); m.position.y=-0.64; armBL.add(m);
    var armBR = armBL.clone(); armBR.position.x = 0.28;
    g.add(armBL); g.add(armBR);
    var rosary = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 6, 12), new THREE.MeshStandardMaterial({color:0x8a7a4a, roughness:0.4, metalness:0.6}));
    rosary.position.set(0, 1.25, 0.26); g.add(rosary);
    g.userData = {armL:armBL, armR:armBR, torso:robe};
  } else if(type==='crawler'){
    /* 爬行者：贴地爬行，四肢拖行 */
    var bodyC = new THREE.Mesh(new THREE.BoxGeometry(0.44,0.3,0.66), texStd(fabricCanvas));
    bodyC.position.y = 0.28; g.add(bodyC);
    var headC = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), skinM);
    headC.position.set(0, 0.34, 0.36); g.add(headC);
    var faceC = new THREE.Mesh(new THREE.PlaneGeometry(0.23, 0.26), texStd(facePatientCanvas));
    faceC.position.set(0, 0.35, 0.5); g.add(faceC);
    var armCL = new THREE.Group(); armCL.position.set(-0.21, 0.3, 0.2);
    m = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.045,0.44,7), skinM); m.rotation.x = 1.35; m.position.set(0,-0.06,0.21); armCL.add(m);
    var armCR = armCL.clone(); armCR.position.x = 0.21;
    g.add(armCL); g.add(armCR);
    var legCL = new THREE.Group(); legCL.position.set(-0.15, 0.26, -0.32);
    m = new THREE.Mesh(new THREE.CylinderGeometry(0.055,0.05,0.46,7), skinM); m.rotation.x = -1.3; m.position.set(0,-0.03,-0.21); legCL.add(m);
    var legCR = legCL.clone(); legCR.position.x = 0.15;
    g.add(legCL); g.add(legCR);
    g.userData = {armL:armCL, armR:armCR, legL:legCL, legR:legCR, torso:bodyC};
  } else if(type==='doctor'){
    // 疯医生：白大褂 + 手术帽口罩 + 手术刀
    var coatD = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.72, 0.3), new THREE.MeshStandardMaterial({color:0xe8ecee, roughness:0.8}));
    coatD.position.y = 0.66; g.add(coatD);
    var flapL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.28), new THREE.MeshStandardMaterial({color:0xdde3e6, roughness:0.8}));
    flapL.position.set(-0.17, 0.35, 0); g.add(flapL);
    var flapR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.28), new THREE.MeshStandardMaterial({color:0xdde3e6, roughness:0.8}));
    flapR.position.set(0.17, 0.35, 0); g.add(flapR);
    var headD = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), skinM);
    headD.scale.set(1, 1.08, 1); headD.position.y = 1.15; g.add(headD);
    var faceD = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.28), texStd(faceDoctorCanvas));
    faceD.position.set(0, 1.15, 0.135); g.add(faceD);
    var armDL = new THREE.Group(); armDL.position.set(-0.31, 0.9, 0);
    m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.36, 8), new THREE.MeshStandardMaterial({color:0xe8ecee, roughness:0.8})); m.position.y=-0.18; armDL.add(m);
    m = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.3, 8), skinM); m.position.y=-0.48; armDL.add(m);
    m = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.22), new THREE.MeshStandardMaterial({map:new THREE.CanvasTexture(metalCanvas), roughness:0.3, metalness:0.9}));
    m.position.set(0.02, -0.66, 0.08); m.rotation.x = 0.6; armDL.add(m);  // 手术刀
    var armDR = armDL.clone(); armDR.position.x = 0.31; armDR.rotation.z = 0;
    armDR.children[armDR.children.length-1].visible = false;
    g.add(armDL); g.add(armDR);
    var legDL = new THREE.Group(); legDL.position.set(-0.13, 0.44, 0);
    m = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.4, 8), new THREE.MeshStandardMaterial({color:0x3a4046, roughness:0.85})); m.position.y=-0.2; legDL.add(m);
    m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.36, 8), new THREE.MeshStandardMaterial({color:0x2a2e33, roughness:0.85})); m.position.y=-0.55; legDL.add(m);
    m = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.24), new THREE.MeshStandardMaterial({color:0x14161a, roughness:0.9})); m.position.set(0,-0.72,-0.02); legDL.add(m);
    var legDR = legDL.clone(); legDR.position.x = 0.13;
    g.add(legDL); g.add(legDR);
    g.userData = {armL:armDL, armR:armDR, legL:legDL, legR:legDR, torso:coatD};
  } else {
    // 病人：病号服 + 球头 + 血脸 + 乱发
    var torsoP = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.66, 0.3), texStd(fabricCanvas));
    torsoP.position.y = 0.62; g.add(torsoP);
    var shoulderL = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), texStd(fabricCanvas));
    shoulderL.position.set(-0.26, 0.92, 0); g.add(shoulderL);
    var shoulderR = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), texStd(fabricCanvas));
    shoulderR.position.set(0.26, 0.92, 0); g.add(shoulderR);
    var belt = new THREE.Mesh(new THREE.BoxGeometry(0.51, 0.06, 0.31), new THREE.MeshStandardMaterial({color:0x2a2d32, roughness:0.8}));
    belt.position.y = 0.32; g.add(belt);
    var neckP = new THREE.Mesh(cyl(0.06, 0.07, 0.1, 8), skinM);
    neckP.position.y = 0.99; g.add(neckP);
    var headP = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), skinM);
    headP.scale.set(1, 1.08, 1); headP.position.y = 1.13; g.add(headP);
    var faceP = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.28), texStd(facePatientCanvas));
    faceP.position.set(0, 1.13, 0.135); g.add(faceP);
    var hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.1, 0.33), new THREE.MeshStandardMaterial({color:0x241a12, roughness:0.95}));
    hairTop.position.y = 1.26; g.add(hairTop);
    for(var hi = 0; hi < 5; hi++){
      var strand = new THREE.Mesh(new THREE.BoxGeometry(0.055, rand(0.14, 0.3), 0.05), new THREE.MeshStandardMaterial({color:0x241a12, roughness:0.95}));
      strand.position.set(rand(-0.15, 0.15), rand(1.02, 1.18), 0.11);
      strand.rotation.x = rand(0.25, 0.9);
      g.add(strand);
    }
    // 手臂（圆柱）
    var armPL = new THREE.Group(); armPL.position.set(-0.32, 0.88, 0);
    m = new THREE.Mesh(cyl(0.055, 0.05, 0.34, 8), texStd(fabricCanvas)); m.position.y=-0.17; armPL.add(m);
    m = new THREE.Mesh(cyl(0.045, 0.04, 0.3, 8), skinM); m.position.y=-0.46; armPL.add(m);
    m = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.13, 0.05), skinM); m.position.y=-0.63; armPL.add(m);
    for(var fi=0; fi<3; fi++){
      var fing = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.05, 0.016), skinM);
      fing.position.set(-0.02+fi*0.02, -0.72, 0.01); armPL.add(fing);
    }
    var armPR = armPL.clone(); armPR.position.x = 0.32;
    g.add(armPL); g.add(armPR);
    // 腿
    var legPL = new THREE.Group(); legPL.position.set(-0.13, 0.42, 0);
    m = new THREE.Mesh(cyl(0.07, 0.06, 0.36, 8), new THREE.MeshStandardMaterial({color:0x5a6670, roughness:0.85})); m.position.y=-0.18; legPL.add(m);
    m = new THREE.Mesh(cyl(0.055, 0.05, 0.34, 8), skinM); m.position.y=-0.5; legPL.add(m);
    m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.07, 0.26), new THREE.MeshStandardMaterial({color:0x2e2a26, roughness:0.9})); m.position.set(0,-0.68,-0.03); legPL.add(m);
    var legPR = legPL.clone(); legPR.position.x = 0.13;
    g.add(legPL); g.add(legPR);
    g.userData = {armL:armPL, armR:armPR, legL:legPL, legR:legPR, torso:torsoP};
  }
  markShadow(g);
  return g;
}
function spawnMonster(type){
  var t = MONSTER_TYPES[type];
  var pts = spawnPointsByFloor[currentFloor] || spawnPointsByFloor[0] || [];
  if(!pts || pts.length === 0) return;
  var cand = [];
  for(var i=0;i<pts.length;i++){
    if(dist2(player.pos.x,player.pos.z, pts[i][0], pts[i][1]) > (140 - noiseLevel*55)) cand.push(pts[i]);
  }
  if(cand.length===0) cand = pts;
  var sp = cand[randi(0,cand.length-1)];
  var mesh = buildMonsterMesh(type);
  var ghost = !!t.ghost;
  mesh.position.set(sp[0], floorY(currentFloor), sp[1]);
  scene.add(mesh);
  monsters.push({type:type, mesh:mesh, floor:currentFloor,
    pos:new THREE.Vector3(sp[0], floorY(currentFloor)+(ghost?0.75:0), sp[1]),
    hp:t.hp, alive:true, atkTimer:0, bob:rand(0,6.28), dist:0});
}

/* ---------------- 电池（手电耗电） ---------------- */
var flashCharge = 1;
var batteries = [];
var batteryCanvas = makeCanvas(128, 128, function(ctx, w, h){
  ctx.fillStyle = '#222830'; ctx.fillRect(34, 20, 60, 84);
  ctx.fillStyle = '#c9a13a'; ctx.fillRect(38, 24, 52, 76);
  ctx.fillStyle = '#e8e2d0'; ctx.font = 'bold 44px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('+', 64, 68);
  ctx.fillStyle = '#222830'; ctx.fillRect(50, 8, 28, 12);
});
function spawnBattery(x, z, f){
  var g2 = new THREE.Group();
  var m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.3, 0.12), new THREE.MeshStandardMaterial({map:new THREE.CanvasTexture(batteryCanvas), roughness:0.6}));
  g2.add(m);
  var glow = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), new THREE.MeshBasicMaterial({color:0xffd98a, transparent:true, opacity:0.4}));
  glow.position.y = 0.4; g2.add(glow);
  g2.position.set(x, floorY(f)+0.7, z);
  scene.add(g2);
  batteries.push({g:g2, glow:glow, x:x, z:z, floor:f, t:0});
}
function updateBatteries(dt){
  for(var i=batteries.length-1;i>=0;i--){
    var p = batteries[i];
    p.t += dt;
    p.g.rotation.y += dt*1.8;
    p.glow.material.opacity = 0.3 + Math.sin(p.t*3)*0.15;
    if(p.floor===currentFloor && dist2(player.pos.x, player.pos.z, p.x, p.z) < 2.2){
      flashCharge = 1;
      scene.remove(p.g);
      batteries.splice(i,1);
      stats.pickups++;
      AudioSys.pickup();
      showMsg('更换电池 · 手电恢复满亮度', 1.8);
    }
  }
}

/* ---------------- 镇静剂 ---------------- */
var sedatives = [];
var sedCanvas = makeCanvas(128, 128, function(ctx, w, h){
  ctx.fillStyle = '#e9edf0'; ctx.fillRect(44, 18, 40, 92);
  ctx.fillStyle = '#8fb8cc'; ctx.fillRect(48, 40, 32, 66);
  ctx.fillStyle = '#c9a13a'; ctx.fillRect(48, 22, 32, 14);
  ctx.fillStyle = '#b0342c'; ctx.fillRect(52, 96, 24, 10);
});
function spawnSedative(x, z, f){
  var g2 = new THREE.Group();
  var m = new THREE.Mesh(new THREE.CylinderGeometry(0.045,0.045,0.22,10), new THREE.MeshStandardMaterial({map:new THREE.CanvasTexture(sedCanvas), roughness:0.4, metalness:0.2}));
  g2.add(m);
  var glow = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), new THREE.MeshBasicMaterial({color:0x9fd8ff, transparent:true, opacity:0.4}));
  glow.position.y = 0.4; g2.add(glow);
  g2.position.set(x, floorY(f)+0.75, z);
  scene.add(g2);
  sedatives.push({g:g2, glow:glow, x:x, z:z, floor:f, t:0});
}
function updateSedatives(dt){
  for(var i=sedatives.length-1;i>=0;i--){
    var p = sedatives[i];
    p.t += dt;
    p.g.rotation.y += dt*2;
    p.glow.material.opacity = 0.3 + Math.sin(p.t*3.4)*0.15;
    if(p.floor===currentFloor && dist2(player.pos.x, player.pos.z, p.x, p.z) < 2.0){
      player.stamina = player.staminaMax;
      player.exhausted = false;
      player.boostT = 8;
      player.sanity = player.sanityMax;      /* 镇静剂同时稳定精神 */
      scene.remove(p.g);
      sedatives.splice(i,1);
      stats.pickups++;
      AudioSys.heal();
      showMsg('注射镇静剂 · 体力全满 · 8 秒提速', 2);
      updateHud();
  objTimer += dt;
  if(objTimer > 0.35){ objTimer = 0; updateObjectives(); checkAchievements(); }
    }
  }
}
/* ---------------- 病历纸条 ---------------- */
var notes = [];
var noteCanvas = makeCanvas(128, 128, function(ctx, w, h){
  ctx.fillStyle = '#d8d2bc'; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(120,100,70,0.5)'; ctx.lineWidth = 2;
  for(var i=0;i<5;i++){ ctx.beginPath(); ctx.moveTo(8, 26+i*24); ctx.lineTo(w-8, 26+i*24); ctx.stroke(); }
  ctx.fillStyle = 'rgba(160,30,30,0.75)';
  ctx.beginPath(); ctx.arc(104, 20, 9, 0, 6.29); ctx.fill();
});
var NOTE_TEXTS = [
  '病历 001 · 3床病人整夜低语「她在墙里」——已加大镇静剂量。',
  '值班记录 · 午夜之后，不要回应任何呼叫铃。那不是病人。',
  '尸检报告 · 死者左手无名指缺失。切口不是手术造成的。',
  '化验单 · 血液样本 07 在显微镜下仍在移动。',
  '监控日志 · 凌晨3:07，走廊里多了一扇门。',
  '日记残页 · 她在找她的脸。别让她看见你的。'
];
function spawnNote(x, z, f, idx){
  var g2 = new THREE.Group();
  var m = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshStandardMaterial({map:new THREE.CanvasTexture(noteCanvas), roughness:0.85, side:THREE.DoubleSide}));
  g2.add(m);
  var glow = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), new THREE.MeshBasicMaterial({color:0x8fb0ff, transparent:true, opacity:0.4}));
  glow.position.y = 0.4; g2.add(glow);
  g2.position.set(x, floorY(f)+0.7, z);
  scene.add(g2);
  notes.push({g:g2, glow:glow, x:x, z:z, floor:f, idx:idx, t:0});
}
function updateNotes(dt){
  for(var i=notes.length-1;i>=0;i--){
    var p = notes[i];
    p.t += dt;
    p.g.rotation.y += dt*1.5;
    p.glow.material.opacity = 0.3 + Math.sin(p.t*2.5)*0.15;
    if(p.floor===currentFloor && dist2(player.pos.x, player.pos.z, p.x, p.z) < 1.9){
      stats.notes++;
      stats.pickups++;
      scene.remove(p.g);
      notes.splice(i,1);
      AudioSys.pickup();
      showMsg(NOTE_TEXTS[p.idx], 5);
    }
  }
}

/* ---------------- 急救包 ---------------- */
var healthPacks = [];
var packCanvas = makeCanvas(128, 128, function(ctx, w, h){
  ctx.fillStyle = '#e8e6df'; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 3; ctx.strokeRect(4, 4, w-8, h-8);
  ctx.fillStyle = '#c22f2f';
  ctx.fillRect(54, 24, 20, 80);
  ctx.fillRect(24, 54, 80, 20);
});
function spawnHealthPack(x, z, f){
  var g = new THREE.Group();
  var m = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.24), new THREE.MeshStandardMaterial({map:new THREE.CanvasTexture(packCanvas), roughness:0.7}));
  g.add(m);
  var glow = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshBasicMaterial({color:0x7ae08a, transparent:true, opacity:0.4}));
  glow.position.y = 0.5; g.add(glow);
  g.position.set(x, floorY(f)+0.8, z);
  scene.add(g);
  healthPacks.push({g:g, glow:glow, x:x, z:z, floor:f, t:0});
}
function updateHealthPacks(dt){
  for(var i=healthPacks.length-1;i>=0;i--){
    var p = healthPacks[i];
    p.t += dt;
    p.g.rotation.y += dt*1.6;
    p.glow.material.opacity = 0.3 + Math.sin(p.t*3)*0.15;
    if(p.floor===currentFloor && dist2(player.pos.x, player.pos.z, p.x, p.z) < 2.2){
      if(player.hp >= player.maxHp) continue;
      player.hp = Math.min(player.maxHp, player.hp + 25);
      player.medUsed++;
      scene.remove(p.g);
      healthPacks.splice(i,1);
      healFlash = 1;
      AudioSys.heal();
      showMsg('使用急救包 · 生命 +25', 1.8);
      updateHud();
    }
  }
}

/* ---------------- 拾取物（武器） ---------------- */
var pickups = [];
function spawnPickup(idx, x, z, f){
  var y0 = floorY(f);
  var g = new THREE.Group();
  var m = new THREE.Mesh(new THREE.BoxGeometry(0.4,0.12,0.14), new THREE.MeshStandardMaterial({color:0x3a2f22, roughness:0.5})); g.add(m);
  var glow = new THREE.Mesh(new THREE.SphereGeometry(0.22,10,8), new THREE.MeshBasicMaterial({color:0x88c4ff, transparent:true, opacity:0.5}));
  glow.position.y=0.5; g.add(glow);
  g.position.set(x,y0+0.9,z); scene.add(g);
  pickups.push({g:g, glow:glow, idx:idx, x:x, z:z, floor:f, t:0});
}

/* ---------------- 提示 ---------------- */
var msgTimer = 0;
function showMsg(text, dur){
  elMessage.textContent = text;
  elMessage.classList.add('show');
  msgTimer = dur || 3.2;
}

/* ---------------- 输入 ---------------- */
var joyPointer = -1, lookPointer = -1, lookLast = {x:0,y:0};
var joyVec = {x:0,y:0};
var SENS = 0.0032;

function joyCenter(){
  var r = elJoystick.getBoundingClientRect();
  return {x: r.left + r.width/2, y: r.top + r.height/2, rad: r.width/2};
}
function onPointerDown(e){
  if(e.target.closest && e.target.closest('button')) return;
  var c = joyCenter();
  var dx = e.clientX - c.x, dy = e.clientY - c.y;
  var inJoy = (dx*dx+dy*dy <= (c.rad+30)*(c.rad+30));
  if(inJoy && joyPointer<0){ joyPointer = e.pointerId; joyVec.x=0; joyVec.y=0; }
  else if(lookPointer<0){ lookPointer = e.pointerId; lookLast.x=e.clientX; lookLast.y=e.clientY; }
}
function onPointerMove(e){
  if(e.pointerId===joyPointer){
    var c = joyCenter();
    var dx = e.clientX-c.x, dy = e.clientY-c.y;
    var len = Math.sqrt(dx*dx+dy*dy), max=c.rad*0.72;
    if(len>max){ dx=dx/len*max; dy=dy/len*max; len=max; }
    elStick.style.transform = 'translate(calc(-50% + '+dx+'px), calc(-50% + '+dy+'px))';
    if(len>4){ joyVec.x = dx/max; joyVec.y = dy/max; } else { joyVec.x=0; joyVec.y=0; }
  } else if(e.pointerId===lookPointer){
    var ddx = e.clientX-lookLast.x, ddy = e.clientY-lookLast.y;
    lookLast.x = e.clientX; lookLast.y = e.clientY;
    player.yaw -= ddx*SENS;
    player.pitch -= ddy*SENS;
    player.pitch = clamp(player.pitch, -1.45, 1.45);
  }
}
function onPointerUp(e){
  if(e.pointerId===joyPointer){ joyPointer=-1; joyVec.x=0; joyVec.y=0; elStick.style.transform='translate(-50%,-50%)'; }
  if(e.pointerId===lookPointer){ lookPointer=-1; }
}
document.addEventListener('pointerdown', onPointerDown);
document.addEventListener('pointermove', onPointerMove);
document.addEventListener('pointerup', onPointerUp);
document.addEventListener('pointercancel', onPointerUp);

$('fire').addEventListener('pointerdown', function(e){ e.preventDefault(); player.firing=true; });
$('fire').addEventListener('pointerup', function(e){ e.preventDefault(); player.firing=false; });
$('fire').addEventListener('pointercancel', function(){ player.firing=false; });
$('reload').addEventListener('pointerdown', function(e){ e.preventDefault(); startReload(); });
function toggleFlash(){
  flashOn = !flashOn;
  if(flashOn) achState.flashUsed = true;
  flash.visible = flashOn;
  beam.visible = flashOn;
  flash.intensity = flashOn ? (0.9 + flashCharge*1.7) : 0;
  if(elFlashbtn){
    elFlashbtn.classList.toggle('off', !flashOn);
    var lb = elFlashbtn.querySelector('span');
    if(lb) lb.textContent = flashOn ? '手电' : '已关灯';
  }
  AudioSys.pickup();
  showMsg(flashOn ? '手电已打开' : '手电已关闭（黑暗中更危险）', 1.4);
}
if(elFlashbtn) elFlashbtn.addEventListener('pointerdown', function(e){ e.preventDefault(); toggleFlash(); });
/* 跑步：点一下切换开/关（不会卡住） */
var runMode = false;
function setRunMode(v){
  runMode = !!v;
  runHeld = false;
  if(elRunbtn){
    elRunbtn.classList.toggle('active', runMode);
    var rb = elRunbtn.querySelector('span');
    if(rb) rb.textContent = runMode ? '跑动' : '跑步';
  }
}
if(elHidebtn) elHidebtn.addEventListener('pointerdown', function(e){
  e.preventDefault(); e.stopPropagation();
  if(player.hiding) exitLocker(false);
  else { var L2 = nearestLocker(); if(L2) enterLocker(L2); }
});
if(elStickbtn) elStickbtn.addEventListener('pointerdown', function(e){
  e.preventDefault(); e.stopPropagation();
  throwGlowStick();
});
if(elRunbtn) elRunbtn.addEventListener('pointerdown', function(e){
  e.preventDefault();
  setRunMode(!runMode);
  AudioSys.pickup();
  showMsg(runMode ? '跑步模式：开启（脚步声很大）' : '跑步模式：关闭', 1.2);
});
/* 兜底：手指抬起/切后台一律复位，避免状态卡死 */
document.addEventListener('pointerup', function(){ runHeld = false; }, true);
document.addEventListener('pointercancel', function(){ runHeld = false; }, true);
window.addEventListener('blur', function(){ runHeld = false; });
document.addEventListener('visibilitychange', function(){ if(document.hidden) runHeld = false; });
$('weapon').addEventListener('pointerdown', function(e){ e.preventDefault(); cycleWeapon(); });

var keys = {};
document.addEventListener('keydown', function(e){ keys[e.code]=true; if(e.code==='KeyR') startReload(); if(e.code==='KeyF') toggleFlash(); if(e.code==='KeyG') throwGlowStick(); });
document.addEventListener('keyup', function(e){ keys[e.code]=false; });

/* ---------------- 武器逻辑 ---------------- */
function curWeapon(){ return WEAPONS[player.weapons[player.cur].idx]; }
function curSlot(){ return player.weapons[player.cur]; }
function startReload(){
  if(dev.on && dev.infAmmo) return;
  var w = curWeapon(), s = curSlot();
  if(player.reloading || s.mag>=w.magSize) return;
  player.reloading = true; player.reloadT = w.reloadT;
  player.reloadDur = w.reloadT; player.magDropped = false;
  AudioSys.reload();
}
/* 换弹时掉落的弹匣 */
function dropMagazine(){
  var m = new THREE.Mesh(new THREE.BoxGeometry(0.05,0.12,0.032),
    new THREE.MeshStandardMaterial({color:0x2b2f36, roughness:0.5, metalness:0.65}));
  var wv = new THREE.Vector3();
  gunGroup.getWorldPosition(wv);
  m.position.copy(wv);
  m.position.y -= 0.05;
  scene.add(m);
  magDrops.push({m:m, vy:0.35, vx:rand(-0.35,0.35), vz:rand(-0.35,0.35), life:2.4});
}
function updateMagDrops(dt){
  for(var i=magDrops.length-1;i>=0;i--){
    var p = magDrops[i];
    p.vy -= dt*9.8;
    p.m.position.y += p.vy*dt;
    p.m.position.x += p.vx*dt;
    p.m.position.z += p.vz*dt;
    p.m.rotation.x += dt*7; p.m.rotation.z += dt*5;
    p.life -= dt;
    if(p.life <= 0 || p.m.position.y < floorY(currentFloor)+0.03){
      scene.remove(p.m); magDrops.splice(i,1);
    }
  }
}
function cycleWeapon(){
  var n = player.unlocked.length; if(n<=1) return;
  var cur = player.weapons[player.cur].idx;
  var pos = player.unlocked.indexOf(cur);
  var next = player.unlocked[(pos+1)%n];
  for(var i=0;i<player.weapons.length;i++){ if(player.weapons[i].idx===next){ player.cur=i; break; } }
  player.reloading=false; player.fireCd=0;
  buildGunModel(next);                       /* 关键：重建武器模型 */
  recoil = 0;
  muzzle.material.opacity = 0;
  gunGroup.position.copy(gunBasePos);
  gunGroup.rotation.set(gunBaseRot.x, gunBaseRot.y, gunBaseRot.z);
  updateWeaponHud();
  AudioSys.pickup();
  showMsg('切换到 ' + curWeapon().name, 1.0);
}
function unlockWeapon(idx, early){
  if(player.unlocked.indexOf(idx)>=0) return;
  player.unlocked.push(idx);
  var w = WEAPONS[idx];
  stats.pickups++;
  showMsg((early?'你找到了 ':'天快亮时，你在值班室找到了 ')+w.name, 3.5);
  AudioSys.pickup();
  for(var i=0;i<player.weapons.length;i++){ if(player.weapons[i].idx===idx){ player.cur=i; break; } }
  buildGunModel(idx); updateWeaponHud();
}

function fire(){
  var w = curWeapon(), s = curSlot();
  if(player.reloading) return;
  if(player.fireCd>0) return;
  if(s.mag<=0 && !(dev.on && dev.infAmmo)){
    if(!player.reloading){ AudioSys.empty(); startReload(); showMsg('自动换弹', 0.8); }
    return;
  }
  if(!(dev.on && dev.infAmmo)) s.mag--;
  player.fireCd = w.rate;
  recoil = 1;
  muzzle.material.opacity = 1; muzzle.rotation.z = rand(0,6.28);
  AudioSys.gunshot(w.pellets>1?1.5:1);
  noisePulse = Math.max(noisePulse, w.pellets>1 ? 2.6 : 1.8);   /* 枪声会把盲眼修女引过来 */
  cameraShake = Math.min(cameraShake + (w.pellets>1?0.09:0.05), 0.2);

  var origin = camera.position.clone();
  var dir = new THREE.Vector3(); camera.getWorldDirection(dir);
  for(var p=0;p<w.pellets;p++){
    var d = dir.clone();
    if(w.spread>0){ d.x += rand(-w.spread,w.spread); d.y += rand(-w.spread,w.spread); d.z += rand(-w.spread,w.spread); }
    d.normalize();
    var best = null, bestT = 1e9, hitAny = false;
    for(var i=0;i<monsters.length;i++){
      var mo = monsters[i]; if(!mo.alive) continue;
      var t = MONSTER_TYPES[mo.type];
      var c = new THREE.Vector3(mo.pos.x, mo.pos.y + t.halfH, mo.pos.z);
      var tt = raySphere(origin, d, c, t.halfH*0.95);
      if(tt>=0 && tt<bestT){ bestT=tt; best=mo; }
    }
    if(best){
      var hp = new THREE.Vector3().copy(origin).addScaledVector(d, bestT);
      best.hp -= (dev.on && dev.oneShot) ? 99999 : w.dmg;
      spawnBlood(hp.x, hp.y, hp.z, 6);
      hitAny = true;
      if(best.hp<=0){ killMonster(best); }
    }
  }
  if(hitAny){
    elCrosshair.classList.add('hit');
    clearTimeout(crosshairHitTimer);
    crosshairHitTimer = setTimeout(function(){ elCrosshair.classList.remove('hit'); }, 120);
  }
  updateWeaponHud();
}

function raySphere(o,d,c,r){
  var ox=o.x-c.x, oy=o.y-c.y, oz=o.z-c.z;
  var b = 2*(ox*d.x+oy*d.y+oz*d.z);
  var a = d.x*d.x+d.y*d.y+d.z*d.z;
  var cc = ox*ox+oy*oy+oz*oz - r*r;
  var disc = b*b-4*a*cc;
  if(disc<0) return -1;
  var t = (-b-Math.sqrt(disc))/(2*a);
  return t>=0?t:-1;
}

function killMonster(mo){
  mo.alive=false;
  if(mo.fake){
    /* 幻视被打散：白费子弹 */
    showMsg('……只是个影子', 1.2);
    try { AudioSys.whisper(); } catch(e){}
    return;
  }
  stats.kills++;
  stats.score += 10;
  achState.killed[mo.type] = true;
  spawnBlood(mo.pos.x, mo.pos.y+1, mo.pos.z, 16);
  mo.deathT = 0.5;
  mo.dying = true;
  AudioSys.tone(80,0.3,'sawtooth',0.15,40);
}

function updateWeaponHud(){
  var w = curWeapon(), s = curSlot();
  elWeaponName.textContent = w.name;
  elMag.textContent = s.mag;
  elReserve.textContent = '∞';
}

/* ---------------- 相机抖动 & 瘦长鬼影 ---------------- */
var highFpsFor = 0;
/* 画质档位：0=最低(0.7x,无泛光/无阴影) 1=中(0.9x+阴影) 2=高(1.0x+泛光+阴影) */
var qualityLevel = 0;
function applyQuality(){
  var pxr = qualityLevel === 0 ? 0.6 : (qualityLevel === 1 ? 0.8 : 1.0);
  try {
    renderer.setPixelRatio(pxr);
    renderer.setSize(window.innerWidth, window.innerHeight);
    if(PostFX && PostFX.resize) PostFX.resize();
    if(PostFX && PostFX.setGlow) PostFX.setGlow(qualityLevel >= 2);
    renderer.shadowMap.enabled = (qualityLevel >= 1);
  } catch(e){}
}
var fpsAvg = 60, fpsFrames = 0, fpsTime = 0, lowFpsFor = 0;
var healFlash = 0;
var regenT = 0;
var stats = {kills:0, pickups:0, notes:0, score:0};
var night = 1;
var objectives = [];
var objTimer = 0, sanityBreakT = 0, hbT = 0;
var noisePulse = 0;                 /* 枪声引起的额外动静 */
var eventTimer = 42, eventActive = '', eventT = 0, lastEvent = '';
var eventSpeedMul = 1;
var glowSticks = [];
var lightMul = 1;
/* ---- 成就 ---- */
var achState = { survived:false, flashUsed:false, madT:0, hidT:0, killed:{} };
function loadAch(){ try { return JSON.parse(localStorage.getItem('ns_ach') || '{}') || {}; } catch(e){ return {}; } }
function saveAch(id){ try { var s = loadAch(); s[id] = 1; localStorage.setItem('ns_ach', JSON.stringify(s)); } catch(e){} }
var ACHS = [
  { id:'first',  name:'第一夜',   desc:'首次活到天亮',                    check:function(){ return achState.survived; } },
  { id:'truth',  name:'真相',     desc:'集齐 6 份病历并活到天亮',          check:function(){ return achState.survived && stats.notes >= 6; } },
  { id:'hachi',  name:'巨人杀手', desc:'击杀八尺大人',                    check:function(){ return !!achState.killed.hachishaku; } },
  { id:'slender',name:'直视恐惧', desc:'击杀瘦长鬼影',                    check:function(){ return !!achState.killed.slender; } },
  { id:'blind',  name:'无声胜有声',desc:'击杀盲眼修女',                   check:function(){ return !!achState.killed.blind; } },
  { id:'dark',   name:'隐形人',   desc:'全程不开手电活到天亮',            check:function(){ return achState.survived && !achState.flashUsed; } },
  { id:'night3', name:'长夜漫漫', desc:'守到第 3 夜',                     check:function(){ return night >= 3; } },
  { id:'butcher',name:'屠夫',     desc:'单夜击杀 15 个怪物',              check:function(){ return stats.kills >= 15; } },
  { id:'nomed',  name:'铁人',     desc:'不使用急救包活到天亮',            check:function(){ return achState.survived && player.medUsed === 0; } },
  { id:'mad',    name:'疯狂',     desc:'理智归零后仍存活 30 秒',          check:function(){ return achState.madT >= 30; } },
  { id:'hider',  name:'屏息',     desc:'在柜中躲过 15 秒未被发现',        check:function(){ return achState.hidT >= 15; } },
  { id:'ghost',  name:'驱魔人',   desc:'击杀女鬼',                        check:function(){ return !!achState.killed.ghost; } }
];
function unlockAch(a){
  if(loadAch()[a.id]) return;
  saveAch(a.id);
  stats.score += 20;
  showMsg('★ 成就解锁：' + a.name, 2.8);
  try { AudioSys.pickup(); } catch(e){}
}
function checkAchievements(){
  for(var i=0;i<ACHS.length;i++){
    var a = ACHS[i];
    if(loadAch()[a.id]) continue;
    try { if(a.check()) unlockAch(a); } catch(e){}
  }
}
var elStory = $('story'), storyOrig = elStory ? elStory.innerHTML : '';
function showAchievements(){
  if(!elStory) return;
  if(elStory.dataset.mode === 'ach'){
    elStory.classList.remove('show');
    elStory.dataset.mode = '';
    elStory.innerHTML = storyOrig;
    return;
  }
  var saved = loadAch(), got = 0, html = '<p>成 就</p>';
  for(var i=0;i<ACHS.length;i++){
    var a = ACHS[i], has = !!saved[a.id];
    if(has) got++;
    html += '<div class="ctl" style="color:' + (has ? '#e8dfc0' : '#6f6a5e') + ';letter-spacing:0.06em">' +
            (has ? '★ ' : '· ') + a.name + ' —— ' + a.desc + '</div>';
  }
  html += '<div class="ctl" style="margin-top:10px">已解锁 ' + got + ' / ' + ACHS.length + '</div>';
  elStory.innerHTML = html;
  elStory.dataset.mode = 'ach';
  elStory.classList.add('show');
}
if($('achbtn')) $('achbtn').addEventListener('pointerdown', function(e){ e.preventDefault(); showAchievements(); });
if($('howbtn')) $('howbtn').addEventListener('pointerdown', function(e){
  if(elStory && elStory.dataset.mode === 'ach'){ elStory.dataset.mode = ''; elStory.innerHTML = storyOrig; }
});
var difficulty = 1;
var cameraShake = 0;
var crosshairHitTimer = 0;
var staticLevel = 0;
var fadeLevel = 0;
var stairTimer = -1;
var padLatch = false;

/* ---------------- 主循环 ---------------- */
var started = false, gameOver = false;
var elapsed = 0, lastTime = performance.now();
var cameraDir = new THREE.Vector3();
var weaponSway = 0;
var bobPhase = 0;
var heartbeatCd = 0;

function floorLabelText(){
  return FLOOR_NAMES[currentFloor] + (night > 1 ? (' · 第 ' + night + ' 夜') : '');
}
function applyFloorVisuals(){
  scene.fog.density = (currentFloor===FLOORS-1) ? 0.035 : 0.11;
  scene.fog.color.set(currentFloor===FLOORS-1 ? 0x0a1424 : 0x04060c);
  scene.background = (currentFloor===FLOORS-1) ? skyTex : new THREE.Color(0x04050a);
  moonLight.intensity = (currentFloor===FLOORS-1) ? 0.85 : 0.3;
  hemi.intensity = (currentFloor===FLOORS-1) ? 0.7 : 0.5;
  elFloorLabel.textContent = floorLabelText();
}

function resetGame(){
  var i;
  for(i=monsters.length-1;i>=0;i--){ scene.remove(monsters[i].mesh); }
  monsters.length = 0;
  for(var j=pickups.length-1;j>=0;j--){ scene.remove(pickups[j].g); }
  pickups.length = 0;
  for(var k=particles.length-1;k>=0;k--){ scene.remove(particles[k].m); }
  particles.length = 0;
  for(var hp=healthPacks.length-1;hp>=0;hp--){ scene.remove(healthPacks[hp].g); }
  healthPacks.length = 0;
  for(var bt=batteries.length-1;bt>=0;bt--){ scene.remove(batteries[bt].g); }
  batteries.length = 0;
  for(var nt=notes.length-1;nt>=0;nt--){ scene.remove(notes[nt].g); }
  notes.length = 0;
  for(var sd=sedatives.length-1;sd>=0;sd--){ scene.remove(sedatives[sd].g); }
  sedatives.length = 0;
  player.boostT = 0;
  stats.kills = 0; stats.pickups = 0; stats.notes = 0; stats.score = 0;
  achState.killed = {}; achState.madT = 0; achState.hidT = 0;
  player.sanity = player.sanityMax; player.medUsed = 0;
  sanityBreakT = 0; hbT = 0; objTimer = 0;
  for(var gs=glowSticks.length-1; gs>=0; gs--){ if(glowSticks[gs].light) scene.remove(glowSticks[gs].light); scene.remove(glowSticks[gs].m); }
  glowSticks.length = 0;
  player.sticks = 3; updateStickHud();
  player.hiding = false; player.hideLocker = null;
  if(elHideView) elHideView.classList.remove('on');
  for(var lk=0; lk<lockers.length; lk++){ lockers[lk].discovered = false; lockers[lk].discT = 0; }
  for(var skp=stickPacks.length-1; skp>=0; skp--){ scene.remove(stickPacks[skp].g); }
  stickPacks.length = 0;
  lightMul = 1; eventSpeedMul = 1; eventActive = ''; eventTimer = rand(40, 60); lastEvent = ''; noisePulse = 0;
  rollObjectives();
  if(PostFX && PostFX.setMood) PostFX.setMood(1);
  flashCharge = 1;
  flashOn = true;
  player.stamina = player.staminaMax; player.exhausted = false;
  noiseLevel = 0;
  setRunMode(false);
  flash.visible = true; beam.visible = true;
  if(elFlashbtn){ elFlashbtn.classList.remove('off'); var fb = elFlashbtn.querySelector('span'); if(fb) fb.textContent = '手电'; }
  for(var md=magDrops.length-1;md>=0;md--){ scene.remove(magDrops[md].m); }
  magDrops.length = 0;
  rampCooldown = 0; rampTrack.id = -1;
  currentFloor = 0;
  player.pos.set(0, floorY(0), 0); player.yaw=-Math.PI/2; player.pitch=0;
  player.hp=player.maxHp; elapsed=0; gameOver=false; started=true;
  player.cur=0; player.unlocked=[0];
  for(var w=0;w<player.weapons.length;w++){ player.weapons[w].mag = WEAPONS[player.weapons[w].idx].magSize; }
  player.reloading=false; player.fireCd=0; player.firing=false;
  spawnTimers = {};
  stairTimer = -1; fadeLevel = 0; staticLevel = 0;
  applyFloorVisuals();
  buildGunModel(0); updateWeaponHud();
  spawnPickup(1, 5.1, -19.5, 0);   // 1F 安保室（支廊东侧）
  spawnPickup(2, 5.1, -13.5, 1);   // 2F 药库（支廊东侧）
  spawnPickup(3, -14.5, -6, 2);    // 3F 天台楼梯房旁（狙击枪）
  spawnSedative(8.5, 3.4, 0);      // 1F 病房C
  spawnSedative(-8.5, -13.5, 1);   // 2F 病房H
  spawnSedative(12.5, 5.1, 2);     // 3F 天台东侧
  spawnSedative(-5.1, -19.5, 0);   // 1F 护士站
  spawnStickPack(-12.5, -8.5, 0);  // 1F 病房D
  spawnStickPack(12.5, -13.5, 1);  // 2F 病房I
  spawnStickPack(6.2, 5.1, 2);     // 3F 天台东侧
  /* 藏身柜 */
  spawnLocker(-9, 1.55, 0, -Math.PI/2);
  spawnLocker(9.4, 1.55, 0, -Math.PI/2);
  spawnLocker(1.55, -9.5, 0, 0);
  spawnLocker(-9, 1.55, 1, -Math.PI/2);
  spawnLocker(9.4, 1.55, 1, -Math.PI/2);
  spawnLocker(1.55, -21.5, 1, 0);
  spawnLocker(-11.5, -6.0, 2, 0);
  spawnLocker(10.5, -8.0, 2, 0);
  // 急救包分布
  spawnHealthPack(-5.1, -19.5, 0);  // 1F 护士站
  spawnHealthPack(-5.1, -13.5, 0);  // 1F 药房
  spawnHealthPack(-4.5, 5.1, 0);    // 1F 病房B
  spawnHealthPack(-5.1, -19.5, 1);  // 2F 化验室
  spawnHealthPack(5.1, -13.5, 1);   // 2F 药库
  spawnHealthPack(12.5, 5.1, 1);    // 2F 病房J
  spawnHealthPack(-17.6, 1.5, 2);   // 3F 天台（楼梯房旁）
  // 电池分布
  spawnBattery(6.2, -2.5, 0);    // 1F 病房B旁
  spawnBattery(-12.5, 5.1, 0);   // 1F 病房A
  spawnBattery(5.1, -19.5, 1);   // 2F 手术室
  spawnBattery(-12.5, 5.1, 1);   // 2F 病房G
  spawnBattery(-8, -8, 2);       // 3F 天台
  // 病历纸条
  spawnNote(-12.5, 5.1, 0, 0);   // 1F 病房A
  spawnNote(-5.1, -19.5, 0, 1);  // 1F 护士站
  spawnNote(5.1, 3.5, 0, 2);     // 1F 停尸房
  spawnNote(-5.1, -19.5, 1, 3);  // 2F 化验室
  spawnNote(5.1, -8.5, 1, 4);    // 2F 监控室
  spawnNote(-14, 2, 2, 5);       // 3F 天台
  updateHud();
  showMsg('00:00 夜班开始 · 受伤了找急救包 · 活到 06:00', 3.5);
}

function startGame(){
  if(started) return;
  AudioSys.init(); AudioSys.resume(); AudioSys.startAmbient();
  elScreen.classList.add('hidden');
  resetGame();
}
elStartBtn.addEventListener('pointerdown', function(e){ e.preventDefault(); startGame(); });

function update(dt){
  try { updateInner(dt); }
  catch(e){
    if(!lastErrMsg){ lastErrMsg = (e && e.message) ? e.message : 'unknown'; }
    if(window.onerror) window.onerror('update错误: ' + lastErrMsg, '', 0);
  }
}
function updateInner(dt){
  if(!started || gameOver) return;
  if(devPanelOpen) return;                       /* 开发者面板打开时暂停 */

  elapsed += dt * (dev.on && dev.fast ? 5 : 1); /* 开发者时间加速 */

  /* --- 躲藏中：不能移动/开枪，理智与体力缓慢恢复 --- */
  if(player.hiding){
    var HL = player.hideLocker;
    if(!HL){ player.hiding = false; }
    else {
      player.hideT += dt;
      if(!HL.discovered) achState.hidT += dt;
      player.sanity = Math.min(player.sanityMax, player.sanity + dt*4.5);
      player.stamina = Math.min(player.staminaMax, player.stamina + dt*22);
      player.boostT = Math.max(0, player.boostT);
      camera.position.set(HL.x + Math.sin(HL.rotY)*0.06, floorY(currentFloor)+1.42, HL.z + Math.cos(HL.rotY)*0.06);
      camera.rotation.set(clamp(player.pitch, -0.55, 0.5), player.yaw, 0, 'YXZ');
      camera.getWorldDirection(cameraDir);
      /* 被发现的柜子：3.5 秒后被揪出来 */
      if(HL.discovered){
        HL.discT += dt;
        if(HL.discT > 0.5 && HL.discT < 3.4 && Math.random() < dt*3) { try { AudioSys.bang(); } catch(e){} }
        if(HL.discT >= 3.5){ exitLocker(true); }
      }
      updateDoors(dt);
      updateHud(); updateObjectives();
      return;
    }
  }

  /* --- 移动 --- */
  var mv = {f:0,s:0};
  if(joyVec.x||joyVec.y){ mv.f = -joyVec.y; mv.s = joyVec.x; }
  if(keys['KeyW']||keys['ArrowUp']) mv.f+=1;
  if(keys['KeyS']||keys['ArrowDown']) mv.f-=1;
  if(keys['KeyA']||keys['ArrowLeft']) mv.s-=1;
  if(keys['KeyD']||keys['ArrowRight']) mv.s+=1;
  /* 只有开启跑步模式（按钮/Shift）才冲刺，推摇杆走路不会掉体力 */
  var wantSprint = runMode || runHeld || keys['ShiftLeft'] || keys['ShiftRight'];
  var sprint = wantSprint && !player.exhausted && player.stamina > 0;

  var speed = (sprint?SPRINT_SPEED:WALK_SPEED) * (player.boostT>0 ? 1.22 : 1);
  var fl = Math.sqrt(mv.f*mv.f+mv.s*mv.s);
  if(fl>1){ mv.f/=fl; mv.s/=fl; }
  // 前方向与相机一致（修复反向）
  var fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
  var rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
  var vx = (fx*mv.f + rx*mv.s)*speed;
  var vz = (fz*mv.f + rz*mv.s)*speed;
  var moving = (Math.abs(mv.f)+Math.abs(mv.s))>0.01;
  player.speed = moving?speed:0;

  /* --- 体力 & 动静（暴露度） --- */
  var sprinting = sprint && moving;
  if(dev.on && dev.infStam){
    player.stamina = player.staminaMax; player.exhausted = false;
  } else if(sprinting){
    player.stamina = Math.max(0, player.stamina - dt*26);   /* 满体力约可跑 7.7 秒 */
  } else {
    player.stamina = Math.min(player.staminaMax, player.stamina + dt*(player.exhausted?11:18));
  }
  if(player.stamina <= 0 && !player.exhausted){
    player.exhausted = true;
    showMsg('体力耗尽 · 走一走恢复体力', 2);
  }
  if(player.exhausted && player.stamina > 60) player.exhausted = false;
  if(player.boostT > 0) player.boostT -= dt;
  /* 跑步 = 脚步声很大；开着手电 = 灯光暴露 */
  noiseLevel = (sprinting ? 1.0 : 0) + (flashOn ? 0.7 : 0);

  /* --- 理智值：黑暗与恐惧侵蚀，安全时恢复 --- */
  var nearestD = 999;
  for(var mi=0; mi<monsters.length; mi++){
    var mm = monsters[mi];
    if(!mm.alive || mm.fake || mm.floor !== currentFloor) continue;
    var mdx = mm.pos.x - player.pos.x, mdz = mm.pos.z - player.pos.z;
    var mdd = Math.sqrt(mdx*mdx + mdz*mdz);
    if(mdd < nearestD) nearestD = mdd;
  }
  var sDelta = 0;
  if(!flashOn) sDelta -= 2.4;                                  /* 黑暗侵蚀 */
  if(nearestD < 12) sDelta -= (12 - nearestD) * 0.34;           /* 恐惧 */
  if(flashOn && nearestD > 14) sDelta += 1.7;                   /* 安全恢复 */
  if(player.boostT > 0) sDelta += 1.2;                          /* 镇静剂安定 */
  player.sanity = clamp(player.sanity + sDelta*dt, 0, player.sanityMax);
  var sRatio = player.sanity / player.sanityMax;
  if(PostFX && PostFX.setMood) PostFX.setMood(clamp(sRatio, 0, 1));
  if(sRatio < 0.55) staticLevel = Math.max(staticLevel, (1-sRatio)*0.22);
  if(sRatio < 0.38 && Math.random() < dt*0.22) { try { AudioSys.whisper(); } catch(e){} }
  if(sRatio < 0.25){
    hbT += dt;
    if(hbT > 1.15 - sRatio*2){ hbT = 0; try { AudioSys.heartbeat(); } catch(e){} }
  }
  if(player.sanity <= 0){
    sanityBreakT += dt;
    achState.madT += dt;
    if(sanityBreakT >= 1){ sanityBreakT = 0; damagePlayer(3, null); showMsg('精神崩溃 · 理智耗尽', 1.2); }
  } else sanityBreakT = 0;

  /* 枪声动静衰减 */
  if(noisePulse > 0) noisePulse = Math.max(0, noisePulse - dt*0.7);

  /* --- 幻视：理智低时出现假怪物 --- */
  if(sRatio < 0.42 && !dev.freeze){
    var fakeCount = 0;
    for(var fc=0; fc<monsters.length; fc++){ if(monsters[fc].fake) fakeCount++; }
    if(fakeCount < 3 && Math.random() < dt*(0.42 - sRatio)*0.85){
      var fakeTypes = ['patient','crawler','doctor','ghost'];
      var ft = fakeTypes[randi(0, fakeTypes.length-1)];
      var ang = rand(0, 6.28), rdist = rand(9, 17);
      var fxp = clamp(player.pos.x + Math.cos(ang)*rdist, -20.5, 16.8);
      var fzp = clamp(player.pos.z + Math.sin(ang)*rdist, -27.6, 9.2);
      var fmesh = buildMonsterMesh(ft);
      fmesh.position.set(fxp, floorY(currentFloor), fzp);
      fmesh.traverse(function(o){
        if(o.isMesh && o.material && o.material.clone){
          o.material = o.material.clone();
          o.material.transparent = true; o.material.opacity = 0.88;
        }
      });
      scene.add(fmesh);
      monsters.push({type:ft, mesh:fmesh, floor:currentFloor, fake:true, life:rand(7,13),
        pos:new THREE.Vector3(fxp, floorY(currentFloor), fzp),
        hp:9999, alive:true, atkTimer:99, bob:rand(0,6.28), dist:99});
      try { AudioSys.whisper(); } catch(e){}
    }
  }
  player.pos.x += vx*dt; player.pos.z += vz*dt;
  resolveCircle(player.pos, PLAYER_RADIUS, wallsByFloor[currentFloor]);
  resolveDoors(player.pos, PLAYER_RADIUS, currentFloor);
  if(player.pos.x<-20.8) player.pos.x=-20.8; if(player.pos.x>17.1) player.pos.x=17.1;
  if(player.pos.z<-27.9) player.pos.z=-27.9; if(player.pos.z>9.5) player.pos.z=9.5;

  /* --- 开门交互 --- */
  var nDoor = nearestDoor();
  if(nDoor){
    elDoorbtn.style.display = 'flex';
    elDoorbtn.dataset.door = doors.indexOf(nDoor);
    var lbl = nDoor.locked ? '解锁' : (nDoor.ang > 0.5 ? '锁门' : '开门');
    var lb = elDoorbtn.querySelector('span');
    if(lb) lb.textContent = lbl;
  } else {
    elDoorbtn.style.display = 'none';
  }
  var nLocker = nearestLocker();
  if(elHidebtn){
    if(player.hiding){ elHidebtn.style.display = 'flex'; }
    else if(nLocker){ elHidebtn.style.display = 'flex'; if(elHidebtn.querySelector('span')) elHidebtn.querySelector('span').textContent = '躲藏'; }
    else elHidebtn.style.display = 'none';
  }
  if(keys['KeyE']){
    keys['KeyE'] = false;
    if(nDoor){
      if(nDoor.locked) toggleLock(nDoor);
      else if(nDoor.ang > 0.5) toggleLock(nDoor);
      else openDoor(nDoor);
    }
  }

  /* --- 门动画 --- */
  updateDoors(dt);
  /* --- 真实楼梯（沿斜面行走，跨层无缝） --- */
  if(rampCooldown > 0) rampCooldown -= dt;
  var ramp = null, rampIdx = -1;
  for(var ri=0; ri<stairsRamps.length; ri++){
    var rp = stairsRamps[ri];
    var inRamp = (rp.axis === 'z')
      ? (player.pos.x >= rp.x0 && player.pos.x <= rp.x1 && player.pos.z >= Math.min(rp.z0,rp.z1) && player.pos.z <= Math.max(rp.z0,rp.z1))
      : (player.pos.z >= rp.z0 && player.pos.z <= rp.z1 && player.pos.x >= Math.min(rp.x0,rp.x1) && player.pos.x <= Math.max(rp.x0,rp.x1));
    if(!inRamp) continue;
    /* 必须真的站在这段楼梯的高度上（防止在天台隔着楼梯房误触） */
    var tTest = clamp(rp.axis === 'z'
      ? (rp.z0 - player.pos.z)/(rp.z0 - rp.z1)
      : (rp.x0 - player.pos.x)/(rp.x0 - rp.x1), 0, 1);
    var yTest = rp.y0 + (rp.y1 - rp.y0)*tTest;
    if(Math.abs(player.pos.y - yTest) > 1.0) continue;
    ramp = rp; rampIdx = ri; break;
  }
  if(ramp){
    var tR = clamp(ramp.axis === 'z'
      ? (ramp.z0 - player.pos.z)/(ramp.z0 - ramp.z1)
      : (ramp.x0 - player.pos.x)/(ramp.x0 - ramp.x1), 0, 1);
    player.pos.y = ramp.y0 + (ramp.y1 - ramp.y0)*tR;
    if(rampTrack.id !== rampIdx){ rampTrack.id = rampIdx; rampTrack.t0 = tR; }
    if(rampCooldown <= 0){
      /* 必须从另一端走上来/走下去（走完全程）才切层 */
      if(tR >= 0.985 && currentFloor !== ramp.upper && rampTrack.t0 < 0.7){
        currentFloor = ramp.upper;
        applyFloorVisuals(); AudioSys.stairs();
        showMsg('来到 ' + FLOOR_NAMES[currentFloor], 2);
        rampCooldown = 1.5; rampTrack.id = -1;
        player.pos.y = floorY(currentFloor);
      } else if(tR <= 0.015 && currentFloor !== ramp.lower && rampTrack.t0 > 0.3){
        currentFloor = ramp.lower;
        applyFloorVisuals(); AudioSys.stairs();
        showMsg('回到 ' + FLOOR_NAMES[currentFloor], 2);
        rampCooldown = 1.5; rampTrack.id = -1;
        player.pos.y = floorY(currentFloor);
      }
    }
  } else {
    player.pos.y = floorY(currentFloor);
    rampTrack.id = -1;
  }

  /* --- 相机 --- */
  bobPhase += dt*(moving? (sprint?12:9) : 0);
  var bobY = moving? Math.sin(bobPhase)*0.04 : 0;
  camera.position.set(player.pos.x, player.pos.y+EYE_HEIGHT+bobY, player.pos.z);
  camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
  if(cameraShake>0){
    camera.rotation.x += rand(-1,1)*cameraShake;
    camera.rotation.y += rand(-1,1)*cameraShake;
    cameraShake = Math.max(0, cameraShake - dt*0.5);
  }
  camera.getWorldDirection(cameraDir);

  /* --- 武器 & 换弹 --- */
  if(player.fireCd>0) player.fireCd -= dt;
  if(player.reloading){
    player.reloadT -= dt;
    if(player.reloadT<=0){ player.reloading=false; curSlot().mag = curWeapon().magSize; AudioSys.reloadEnd(); updateWeaponHud(); }
  }
  if(player.firing && !gameOver) fire();

  /* --- 后坐力 & 枪口火焰 --- */
  gunGroup.position.copy(gunBasePos);
  gunGroup.rotation.set(gunBaseRot.x, gunBaseRot.y, gunBaseRot.z);
  if(recoil>0){
    recoil = Math.max(0, recoil - dt*8);
    gunGroup.position.z = gunBasePos.z + recoil*0.12;
    gunGroup.position.y = gunBasePos.y + recoil*0.03;
  }
  /* --- 换弹动画：压枪下沉 + 侧倾 + 退弹匣 + 回位 --- */
  if(player.reloading && player.reloadDur > 0){
    var rprog = clamp(1 - player.reloadT/player.reloadDur, 0, 1);
    var ra = Math.sin(rprog*Math.PI);
    gunGroup.position.y -= ra*0.19;
    gunGroup.position.z += ra*0.05;
    gunGroup.rotation.x = gunBaseRot.x - ra*0.95;
    gunGroup.rotation.z = gunBaseRot.z + ra*0.30;
    if(!player.magDropped && rprog > 0.22){ player.magDropped = true; dropMagazine(); }
  }
  updateMagDrops(dt);
  /* --- 武器摆动（呼吸/步伐） --- */
  weaponSway = clamp(weaponSway + (moving ? dt*2.5 : -dt*2.5), 0.25, 1);
  var swayT = elapsed*2.1;
  var swx = (Math.sin(swayT)*0.013 + Math.sin(swayT*1.7)*0.006) * weaponSway;
  var swy = (Math.abs(Math.cos(swayT))*0.015 + Math.sin(swayT*0.9)*0.004) * weaponSway;
  gunGroup.position.x += swx;
  gunGroup.position.y -= swy;
  gunGroup.rotation.z += swx*2.2;
  if(muzzle.material.opacity>0) muzzle.material.opacity = Math.max(0, muzzle.material.opacity - dt*20);

  /* --- 光束尘埃 & 手电微闪 --- */
  for(var dI = 0; dI < DUST_N; dI++){
    var dP = dustArr[dI];
    dP.x += dP.vx*dt; dP.y += dP.vy*dt; dP.z += dP.vz*dt;
    if(dP.z < -10 || Math.abs(dP.x) > 3.4){ dP.x = rand(-2.6,2.6); dP.y = rand(-1.5,1.5); dP.z = -0.6; }
    dustPos[dI*3] = dP.x; dustPos[dI*3+1] = dP.y; dustPos[dI*3+2] = dP.z;
  }
  dustGeo.attributes.position.needsUpdate = true;
  beam.material.opacity = 0.3 + Math.sin(elapsed*47)*0.015;
  dustMat.opacity = 0.55 * flash.intensity/2.6;

  /* --- 手电耗电：只在开灯时耗电 --- */
  if(started && !gameOver && flashOn && !(dev.on && dev.infFlash)){
    flashCharge = Math.max(0, flashCharge - dt/100);
    if(flashCharge < 0.18 && Math.random() < dt*0.15) showMsg('手电快没电了 · 找电池', 1.5);
  }
  flash.intensity = flashOn ? (0.9 + flashCharge*1.7) : 0;
  flash.visible = flashOn;
  beam.visible = flashOn;

  /* --- 急救包 & 治疗反馈 --- */
  updateHealthPacks(dt);
  updateBatteries(dt);
  updateNotes(dt);
  updateSedatives(dt);
  updateGlowSticks(dt);
  updateStickPacks(dt);
  updateEvents(dt);
  if(healFlash>0){
    healFlash = Math.max(0, healFlash - dt*1.8);
    elHeal.style.opacity = healFlash*0.55;
  }
  if(player.hp > 0 && player.hp < 20 && !gameOver){
    regenT = (regenT||0) + dt;
    if(regenT >= 3){
      regenT = 0;
      player.hp = Math.min(20, player.hp + 1);
      updateHud();
    }
  } else {
    regenT = 0;
  }
  updateHud();

  /* --- 怪物 --- */
  updateSpawning(dt);
  updateMonsters(dt);
  updatePickups(dt);
  updateParticles(dt);

  /* --- 受击/低血量/心跳 --- */
  heartbeatCd -= dt;
  if(player.hp<=35 && heartbeatCd<=0){ AudioSys.heartbeat(); heartbeatCd = 0.9; }
  elLowhp.style.opacity = player.hp<=35 ? 0.6+Math.sin(elapsed*6)*0.2 : 0;

  /* --- 瘦长鬼影干扰衰减 --- */
  staticLevel = Math.max(0, staticLevel - dt*0.9);

  /* --- 提示 & 淡入 --- */
  if(msgTimer>0){ msgTimer-=dt; if(msgTimer<=0) elMessage.classList.remove('show'); }
  if(fadeLevel>0){ fadeLevel = Math.max(0, fadeLevel - dt*2.2); }
  elFade.style.opacity = fadeLevel;

  updateHud();

  if(elapsed >= NIGHT_DURATION){ win(); }
}

function updateSpawning(dt){
  var t = elapsed;
  var dmul = difficulty * (1 + (night-1)*0.28);   /* 每过一夜更难 */
  var want = {
    patient: Math.round(Math.min(1 + Math.floor(t/45), 3) * dmul),
    crawler: t>35 ? Math.round(Math.min(1 + Math.floor((t-35)/70), 2) * dmul) : 0,
    blind: t>60 ? Math.round(Math.min(1 + Math.floor((t-60)/120), 2) * dmul) : 0,
    doctor: t>75 ? Math.round(Math.min(1 + Math.floor((t-75)/85), 2) * dmul) : 0,
    ghost: t>50 ? Math.round(Math.min(1 + Math.floor((t-50)/90), 2) * dmul) : 0,
    hachishaku: t>90 ? Math.round(1 * dmul) : 0,
    slender: t>160 ? 1 : 0
  };
  var names = ['patient','crawler','blind','doctor','ghost','hachishaku','slender'];
  for(var n=0;n<names.length;n++){
    var nm = names[n];
    if(spawnTimers[nm] === undefined) spawnTimers[nm] = 0;
    if(spawnTimers[nm] > 0) spawnTimers[nm] -= dt;
    var count = 0;
    for(var i=0;i<monsters.length;i++){ if(monsters[i].alive && monsters[i].type===nm && monsters[i].floor===currentFloor) count++; }
    if(count < want[nm] && spawnTimers[nm] <= 0){
      spawnMonster(nm);
      spawnTimers[nm] = 1.0 / (1 + noiseLevel*0.6);
    }
  }
}

function updateMonsters(dt){
  var i, mo, t;
  for(i=monsters.length-1;i>=0;i--){
    mo = monsters[i];
    t = MONSTER_TYPES[mo.type];
    if(mo.dying){
      mo.deathT -= dt;
      mo.mesh.rotation.x = Math.min(1.5, mo.mesh.rotation.x + dt*6);
      mo.mesh.position.y -= dt*0.6;
      if(mo.deathT<=0){ scene.remove(mo.mesh); monsters.splice(i,1); }
      continue;
    }
    if(!mo.alive) continue;
    if(dev.on && dev.freeze) continue;

    mo.bob += dt;
    if(mo.atkTimer>0) mo.atkTimer -= dt;

    var dx = player.pos.x - mo.pos.x, dz = player.pos.z - mo.pos.z;
    var dist = Math.sqrt(dx*dx+dz*dz);
    mo.dist = dist;
    var sameFloor = Math.abs(player.pos.y - mo.pos.y) < 1.4;
    var sp = t.speed * (1 + noiseLevel*0.16) * (1 + (night-1)*0.06) * eventSpeedMul;
    /* 玩家躲进柜子且没被发现 → 怪物失去目标，四处游荡 */
    if(player.hiding && player.hideLocker && !player.hideLocker.discovered && !mo.fake){
      sp *= 0.3;
      mo.wanderT = (mo.wanderT||0) - dt;
      if(mo.wanderT <= 0 || mo.wanderX === undefined){
        mo.wanderT = rand(2.2, 4.5);
        mo.wanderX = clamp(mo.pos.x + rand(-7,7), -19.5, 16);
        mo.wanderZ = clamp(mo.pos.z + rand(-7,7), -26.5, 8.5);
      }
      var wx = mo.wanderX - mo.pos.x, wz = mo.wanderZ - mo.pos.z;
      var wl = Math.sqrt(wx*wx + wz*wz);
      if(wl > 0.4){
        mo.pos.x += (wx/wl)*sp*dt;
        mo.pos.z += (wz/wl)*sp*dt;
      }
      mo.mesh.position.x = mo.pos.x; mo.mesh.position.z = mo.pos.z;
      mo.dist = dist;
      animateLimbs(mo, dt);
      continue;
    }
    if(mo.fake){
      /* 幻视：闪烁的假怪物，靠近就消散，不会伤害你 */
      mo.life -= dt;
      mo.mesh.visible = (Math.sin(mo.bob*13) > -0.6);
      sp = t.speed * 0.3;
      if(mo.life <= 0 || dist < 3.2){
        scene.remove(mo.mesh);
        monsters.splice(i, 1);
        try { AudioSys.whisper(); } catch(e){}
        continue;
      }
    }
    if(t.blind){
      /* 盲眼：完全靠声音定位 */
      var loud = Math.max(noiseLevel, noisePulse);
      sp = (loud > 0.5) ? (t.speed*3.2 + loud*0.9) : (t.speed*0.22);
      sp *= (1 + (night-1)*0.06) * eventSpeedMul;
      mo.heading = (loud > 0.5);
    }

    var frozen = false;
    if(t.slender){
      var toSlender = new THREE.Vector3(mo.pos.x-camera.position.x, (mo.pos.y+t.halfH)-camera.position.y, mo.pos.z-camera.position.z).normalize();
      var dot = toSlender.dot(cameraDir);
      if(dot > 0.985){ frozen = true; }
      if(frozen){ sp = 0; } else { sp = t.speed*1.35*(1 + noiseLevel*0.16); }
      if(dist < 12){
        var inView = dot > 0.985;
        staticLevel = Math.max(staticLevel, (inView?0.55:0.25) * clamp(1 - dist/12, 0.15, 1));
        if(inView) cameraShake = Math.min(cameraShake + 0.03, 0.12);
      }
    }

    if(dist > 0.001 && sp>0 && sameFloor){
      var nx = dx/dist, nz = dz/dist;
      var wantX = nx*sp*dt, wantZ = nz*sp*dt;
      if(!t.ghost){
        mo.pos.x += wantX; mo.pos.z += wantZ;
        resolveCircle(mo.pos, t.radius, wallsByFloor[mo.floor]);
        resolveDoors(mo.pos, t.radius, mo.floor);
        // 病人/八尺会自己撞开门
        if(mo.type==='patient' || mo.type==='doctor' || mo.type==='hachishaku'){
          for(var di=0; di<doors.length; di++){
            var dd = doors[di];
            if(dd.floor !== mo.floor || dd.ang > 0.9) continue;
            var ccx = clamp(mo.pos.x, dd.minX, dd.maxX), ccz = clamp(mo.pos.z, dd.minZ, dd.maxZ);
            var dxx = mo.pos.x - ccx, dzz = mo.pos.z - ccz;
            if(dxx*dxx + dzz*dzz < 0.85){
              if(dd.locked){
                dd.bangT = (dd.bangT||0) + dt;
                dd.g.rotation.z = Math.sin(dd.bangT*28) * 0.05 * Math.min(1, dd.bangT*2);
                if(Math.random() < dt*2.2) AudioSys.bang();
                if(dd.bangT > 3.5){
                  dd.locked = false; dd.bangT = 0; dd.g.rotation.z = 0;
                  openDoor(dd);
                  showMsg('门被撞开了！', 2);
                }
              } else {
                dd.doorT = (dd.doorT||0) + dt;
                if(dd.doorT > (mo.type==='hachishaku' ? 0.8 : 1.5)){ openDoor(dd); dd.doorT = 0; }
              }
            }
          }
        }
      } else {
        mo.pos.x += wantX; mo.pos.z += wantZ;
      }
      mo.mesh.rotation.y = Math.atan2(dx,dz);
    }

    if(t.ghost){ mo.mesh.position.y = mo.pos.y + Math.sin(mo.bob*2.2)*0.25; }
    else { mo.mesh.position.y = mo.pos.y; }
    mo.mesh.position.x = mo.pos.x; mo.mesh.position.z = mo.pos.z;

    animateLimbs(mo, dt);

    if(!mo.fake && !player.hiding && dist < t.atkR && sameFloor && mo.atkTimer<=0){
      mo.atkTimer = t.atkCd;
      damagePlayer(t.dmg, mo);
    }

    if(dist<9 && sameFloor && Math.random()<dt*0.5){
      if(mo.type==='ghost') AudioSys.shriek();
      else if(mo.type==='hachishaku') AudioSys.roar();
      else if(mo.type==='slender' || mo.type==='doctor') AudioSys.whisper();
    }
  }
}

function animateLimbs(mo, dt){
  var u = mo.mesh.userData;
  if(mo.type==='slender'){
    var raise = clamp(1 - mo.dist/10, 0, 1);
    if(u.armL){ u.armL.rotation.x = -raise*1.55; }
    if(u.armR){ u.armR.rotation.x = -raise*1.55; }
    if(u.tents){
      for(var ti2=0; ti2<u.tents.length; ti2++){
        var tnt = u.tents[ti2];
        tnt.rotation.z = Math.sin(mo.bob*tnt.userData.sp + tnt.userData.ph) * 0.18 * (0.4 + raise);
        tnt.rotation.x = -0.35 - raise*0.75 + Math.sin(mo.bob*1.3 + tnt.userData.ph)*0.12;
        for(var s2=0; s2<tnt.children.length; s2++){
          tnt.children[s2].position.x = Math.sin(mo.bob*1.5 + tnt.userData.ph + s2*0.55) * 0.035 * (1 + raise);
        }
      }
    }
    return;
  }
  var s = Math.sin(mo.bob*(mo.dist<3?6:10));
  if(u.armL){ u.armL.rotation.x = s*0.6; }
  if(u.armR){ u.armR.rotation.x = -s*0.6; }
  if(u.legL){ u.legL.rotation.x = -s*0.7; }
  if(u.legR){ u.legR.rotation.x = s*0.7; }
  if(u.torso){ u.torso.rotation.z = Math.sin(mo.bob*5)*0.06; }
  if(u.shroud){ u.shroud.material.opacity = 0.72 + Math.sin(mo.bob*3)*0.12; }
  if(u.glowMat){ u.glowMat.uniforms.uTime.value = mo.bob; }
}

function damagePlayer(dmg, mo){
  if(gameOver) return;
  if(dev.on && dev.god) return;
  player.hp -= dmg;
  elDmg.style.opacity = 1;
  setTimeout(function(){ elDmg.style.opacity = 0; }, 160);
  cameraShake = Math.min(cameraShake+0.15, 0.25);
  AudioSys.hurt();
  if(player.hp<=0){ player.hp=0; lose(); }
  updateHud();
}

function updatePickups(dt){
  for(var i=pickups.length-1;i>=0;i--){
    var p = pickups[i];
    p.t += dt;
    p.g.rotation.y += dt*1.6;
    p.glow.material.opacity = 0.35+Math.sin(p.t*3)*0.2;
    if(p.floor===currentFloor && dist2(player.pos.x,player.pos.z, p.x,p.z) < 2.6){
      unlockWeapon(p.idx, true);
      scene.remove(p.g);
      pickups.splice(i,1);
    }
  }
}

/* ---------------- HUD ---------------- */
function fmtClock(sec){
  var total = Math.floor(sec/NIGHT_DURATION*360);
  var h = Math.floor(total/60), m = total%60;
  return (h<10?'0':'')+h+':'+(m<10?'0':'')+m;
}
function fmtLeft(sec){
  var left = Math.max(0, Math.ceil(NIGHT_DURATION-sec));
  var m = Math.floor(left/60), s = left%60;
  return (m<10?'0':'')+m+':'+(s<10?'0':'')+s;
}
function updateHud(){
  elHpFill.style.width = (player.hp/player.maxHp*100)+'%';
  elHpText.textContent = Math.ceil(player.hp)+' / '+player.maxHp;
  elTime.textContent = fmtClock(elapsed);
  elDawnFill.style.width = (elapsed/NIGHT_DURATION*100)+'%';
  elDawnLabel.textContent = '距天亮 '+fmtLeft(elapsed);
  elStatic.style.opacity = staticLevel;
  /* 体力条 */
  if(elStamFill){
    var sr = clamp(player.stamina/player.staminaMax, 0, 1);
    elStamFill.style.width = (sr*100)+'%';
    elStamFill.className = player.exhausted ? 'empty' : (sr < 0.4 ? 'low' : '');
  }
  /* 理智条 */
  if(elSanityFill){
    var snr = clamp(player.sanity/player.sanityMax, 0, 1);
    elSanityFill.style.width = (snr*100)+'%';
    elSanityFill.className = snr < 0.25 ? 'empty' : (snr < 0.55 ? 'low' : '');
  }
  if(elSanityState){
    var snr2 = player.sanity/player.sanityMax;
    elSanityState.textContent = snr2 >= 0.75 ? '清醒' : (snr2 >= 0.5 ? '不安' : (snr2 >= 0.25 ? '恍惚' : '崩溃边缘'));
    elSanityState.className = snr2 >= 0.75 ? '' : (snr2 >= 0.5 ? 'warn' : 'bad');
  }
  /* 暴露提示：安静 / 有动静 / 很显眼 */
  if(elThreat){
    var lv = noiseLevel >= 1.2 ? 2 : (noiseLevel >= 0.6 ? 1 : 0);
    elThreat.textContent = lv===2 ? '很显眼 · 它们来了' : (lv===1 ? '有动静' : '安静');
    elThreat.className = lv===2 ? 'bad' : (lv===1 ? 'warn' : '');
  }
}

/* ---------------- 结束 ---------------- */
function lose(){
  gameOver = true;
  stats.score = Math.max(0, stats.score - 10);
  showScreen('你死了','值班医生倒在了黎明前的黑暗里。', '重新值班', false);
}
function win(){
  gameOver = true;
  achState.survived = true;
  checkAchievements();
  night++;                       /* 通关后进入下一夜（无尽守夜） */
  var truth = stats.notes >= 6;
  var sub;
  if(truth){
    sub = '06:00。六份病历拼出了全部真相——这家医院从来没有「夜班医生」，只有一代代替换掉的守夜人。你活了下来，但你已经知道了太多。';
  } else {
    sub = '06:00。第一缕晨光照进走廊，你活了下来。还有 ' + (6 - stats.notes) + ' 份病历散落在黑暗里，真相仍不完整。';
  }
  showScreen(truth ? '真 相' : '天亮了', sub, night > 1 ? '继续守夜' : '再来一夜', true);
}
function showScreen(title, sub, btn, winState){
  elScreen.classList.remove('hidden');
  elScreen.innerHTML = '';
  var wrap = document.createElement('div'); wrap.className = 'menu-wrap';
  var en = document.createElement('div'); en.className = 'title-en'; en.textContent = winState ? 'DAWN' : 'YOU DIED';
  var line = document.createElement('div'); line.className = 'title-line';
  var h = document.createElement('h1'); h.className = 'title-cn'; h.textContent = title;
  var d = document.createElement('div'); d.className = 'story show'; d.style.marginTop = '18px'; d.style.textAlign = 'center';
  d.textContent = sub;
  var st = document.createElement('div'); st.className = 'title-en'; st.style.marginTop = '18px'; st.style.letterSpacing = '0.3em';
  var _sc = stats.score + stats.notes*18 + Math.min(stats.kills,25)*3 + Math.round(player.hp*0.7) + (winState ? 40 : 0);
  var _rk = _sc >= 190 ? 'S' : (_sc >= 145 ? 'A' : (_sc >= 100 ? 'B' : 'C'));
  var _nb = saveBest(_sc, night, _rk);
  var _best = loadBest();
  st.textContent = '击杀 ' + stats.kills + ' · 病历 ' + stats.notes + '/6 · 存活 ' + Math.floor(elapsed) + ' 秒';
  var st2 = document.createElement('div'); st2.className = 'title-en'; st2.style.marginTop = '9px'; st2.style.letterSpacing = '0.28em';
  st2.textContent = '评级 ' + _rk + ' · 得分 ' + _sc + ' · 第 ' + night + ' 夜' + (_nb ? '  ★新纪录' : (' · 最佳 ' + (_best.rank||'-') + '/' + (_best.score||0)));
  var b = document.createElement('button'); b.className = 'menu-item'; b.id = 'startbtn'; b.textContent = btn;
  wrap.appendChild(st); wrap.appendChild(st2);
  wrap.appendChild(en); wrap.appendChild(h); wrap.appendChild(line); wrap.appendChild(d); wrap.appendChild(b);
  elScreen.appendChild(wrap);
  b.addEventListener('pointerdown', function(e){ e.preventDefault(); location.reload(); });
}

/* ---------------- 荧光棒（可投掷的应急光源） ---------------- */
function updateStickHud(){
  if(!elStickbtn) return;
  var sp = elStickbtn.querySelector('span');
  if(sp) sp.textContent = '×' + player.sticks;
  elStickbtn.classList.toggle('off', player.sticks <= 0);
}
function throwGlowStick(){
  if(player.sticks <= 0){ showMsg('没有荧光棒了', 1); try{ AudioSys.empty(); }catch(e){} return; }
  player.sticks--;
  updateStickHud();
  var dir = new THREE.Vector3(); camera.getWorldDirection(dir);
  var m = new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.025,0.24,8),
    new THREE.MeshBasicMaterial({color:0xa8ff92}));
  m.position.copy(camera.position); m.position.y -= 0.14;
  scene.add(m);
  glowSticks.push({m:m, light:null, active:false, t:0, life:30,
    vx:dir.x*11, vy:dir.y*11 + 2.4, vz:dir.z*11});
  try { AudioSys.pickup(); } catch(e){}
  showMsg('投出荧光棒 · 剩余 ' + player.sticks, 1.2);
}
function updateGlowSticks(dt){
  for(var i=glowSticks.length-1;i>=0;i--){
    var s = glowSticks[i];
    if(!s.active){
      s.vy -= dt*12;
      s.m.position.x += s.vx*dt;
      s.m.position.y += s.vy*dt;
      s.m.position.z += s.vz*dt;
      s.m.rotation.x += dt*8; s.m.rotation.z += dt*6;
      s.t += dt;
      var gy = floorY(currentFloor) + 0.07;
      if(s.m.position.y <= gy || s.t > 4){
        s.m.position.y = gy;
        s.active = true;
        s.m.rotation.set(Math.PI/2, 0, 0);
        var lt = new THREE.PointLight(0x8dff7a, 1.5, 10, 2);
        lt.position.set(s.m.position.x, s.m.position.y + 0.3, s.m.position.z);
        scene.add(lt); s.light = lt;
      }
    } else {
      s.t += dt; s.life -= dt;
      if(s.light) s.light.intensity = 1.35 + Math.sin(s.t*9)*0.25;
      var ddx = player.pos.x - s.m.position.x, ddz = player.pos.z - s.m.position.z;
      if(Math.sqrt(ddx*ddx + ddz*ddz) < 5.5 && Math.abs(player.pos.y - s.m.position.y) < 2.2){
        player.sanity = Math.min(player.sanityMax, player.sanity + dt*7);
      }
      if(s.life <= 0){
        if(s.light) scene.remove(s.light);
        scene.remove(s.m);
        glowSticks.splice(i, 1);
      }
    }
  }
}

/* 荧光棒补给点 */
var stickPacks = [];
function spawnStickPack(x, z, f){
  var g2 = new THREE.Group();
  var m = new THREE.Mesh(new THREE.BoxGeometry(0.18,0.28,0.18),
    new THREE.MeshStandardMaterial({color:0x8dff7a, roughness:0.5, emissive:0x1f5a18}));
  g2.add(m);
  var glow = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8),
    new THREE.MeshBasicMaterial({color:0xa8ff92, transparent:true, opacity:0.4}));
  glow.position.y = 0.4; g2.add(glow);
  g2.position.set(x, floorY(f)+0.75, z);
  scene.add(g2);
  stickPacks.push({g:g2, glow:glow, x:x, z:z, floor:f, t:0});
}
function updateStickPacks(dt){
  for(var i=stickPacks.length-1; i>=0; i--){
    var p = stickPacks[i];
    p.t += dt;
    p.g.rotation.y += dt*1.8;
    p.glow.material.opacity = 0.3 + Math.sin(p.t*3.2)*0.15;
    if(p.floor===currentFloor && dist2(player.pos.x, player.pos.z, p.x, p.z) < 2.0){
      player.sticks = Math.min(6, player.sticks + 1);
      scene.remove(p.g);
      stickPacks.splice(i, 1);
      updateStickHud();
      try { AudioSys.pickup(); } catch(e){}
      showMsg('拾取荧光棒 ×1 · 共 ' + player.sticks, 1.6);
    }
  }
}

/* ---------------- 环境事件 ---------------- */
function triggerEvent(){
  var evs = ['blackout','bloodmoon','whisper','supply'];
  var pick = evs[randi(0, evs.length-1)];
  var tries = 0;
  while(pick === lastEvent && tries < 8){ pick = evs[randi(0, evs.length-1)]; tries++; }
  lastEvent = pick; eventActive = pick;
  if(pick === 'blackout'){
    eventT = 15; lightMul = 0.05;
    showMsg('停电了 · 整层楼陷入黑暗', 2.6);
    try { AudioSys.empty(); AudioSys.whisper(); } catch(e){}
  } else if(pick === 'bloodmoon'){
    eventT = 22; eventSpeedMul = 1.35;
    scene.fog.color.set(0x2a0a0a);
    showMsg('血月升起 · 它们变得狂躁', 2.6);
    try { AudioSys.roar(); } catch(e){}
  } else if(pick === 'whisper'){
    eventT = 2;
    player.sanity = Math.max(0, player.sanity - 18);
    showMsg('无数低语钻进耳朵 · 理智 -18', 2.6);
    try { AudioSys.whisper(); } catch(e){}
  } else {
    eventT = 2;
    var ang = rand(0, 6.28), rd = rand(7, 12);
    var sx = clamp(player.pos.x + Math.cos(ang)*rd, -19.5, 16);
    var sz = clamp(player.pos.z + Math.sin(ang)*rd, -26.5, 8.5);
    spawnHealthPack(sx, sz, currentFloor);
    spawnSedative(clamp(sx + 2.5, -19.5, 16), sz, currentFloor);
    showMsg('远处传来补给箱落地的声音', 2.6);
    try { AudioSys.pickup(); } catch(e){}
  }
}
function updateEvents(dt){
  if(eventActive){
    eventT -= dt;
    if(eventT <= 0){
      if(eventActive === 'blackout') lightMul = 1;
      if(eventActive === 'bloodmoon'){
        eventSpeedMul = 1;
        scene.fog.color.set(currentFloor===FLOORS-1 ? 0x0a1424 : 0x04060c);
      }
      eventActive = ''; eventTimer = rand(38, 62);
    }
  } else {
    eventTimer -= dt;
    if(eventTimer <= 0) triggerEvent();
  }
}

/* ---------------- 夜班任务 ---------------- */
function rollObjectives(){
  objectives = [];
  var pool = [
    { need: 2 + Math.min(night-1, 2), label: function(o){ return '找到病历 ' + Math.min(stats.notes, o.need) + '/' + o.need; },
      check: function(o){ return stats.notes >= o.need; } },
    { need: 4 + night*2, label: function(o){ return '击杀怪物 ' + Math.min(stats.kills, o.need) + '/' + o.need; },
      check: function(o){ return stats.kills >= o.need; } },
    { need: 110 + night*15, label: function(o){ return '活过 ' + fmtClock(Math.min(elapsed, o.need)); },
      check: function(o){ return elapsed >= o.need; } }
  ];
  /* 随机取 2 个不重复的任务 */
  var i1 = randi(0, pool.length-1);
  var i2 = (i1 + 1 + randi(0, pool.length-2)) % pool.length;
  objectives.push(pool[i1]); objectives.push(pool[i2]);
}
function updateObjectives(){
  if(!elObjectives) return;
  var html = '';
  for(var i=0;i<objectives.length;i++){
    var o = objectives[i];
    var ok = o.check(o);
    if(ok && !o.done){
      o.done = true;
      stats.score += 30;
      showMsg('任务完成 · +30 分', 2);
      try { AudioSys.pickup(); } catch(e){}
    }
    html += '<div class="obj' + (ok ? ' done' : '') + '">' + (ok ? '✓ ' : '· ') + o.label(o) + '</div>';
  }
  elObjectives.innerHTML = html;
}

/* ---------------- 最高纪录（本地保存） ---------------- */
function loadBest(){
  try { return JSON.parse(localStorage.getItem('ns_best') || '{}') || {}; } catch(e){ return {}; }
}
function saveBest(score, n, rank){
  try {
    var b = loadBest();
    if(!b.score || score > b.score){
      localStorage.setItem('ns_best', JSON.stringify({score:score, night:n, rank:rank}));
      return true;
    }
  } catch(e){}
  return false;
}

/* ---------------- 藏身柜 ---------------- */
var lockers = [];
function spawnLocker(x, z, f, rotY){
  var grp = new THREE.Group();
  var bodyMat = new THREE.MeshStandardMaterial({map:new THREE.CanvasTexture(metalCanvas), roughness:0.6, metalness:0.5});
  var box = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.9, 0.6), bodyMat);
  box.position.y = 0.95; grp.add(box);
  var doorA = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.66, 0.04), new THREE.MeshStandardMaterial({color:0x2b3138, roughness:0.55, metalness:0.5}));
  doorA.position.set(-0.22, 0.98, 0.31); grp.add(doorA);
  var doorB = doorA.clone(); doorB.position.x = 0.22; grp.add(doorB);
  var vent = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.04, 0.02), new THREE.MeshStandardMaterial({color:0x14181d, roughness:0.9}));
  for(var vi=0; vi<4; vi++){
    var vv = vent.clone(); vv.position.set(0, 1.55 - vi*0.06, 0.335); grp.add(vv);
  }
  var handle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.14, 0.03), new THREE.MeshStandardMaterial({color:0x8a8578, roughness:0.4, metalness:0.8}));
  handle.position.set(-0.03, 0.98, 0.345); grp.add(handle);
  grp.position.set(x, floorY(f), z);
  grp.rotation.y = rotY || 0;
  scene.add(grp);
  /* 碰撞体（旋转后取包围盒近似） */
  var hw = (Math.abs(Math.cos(rotY||0)) > 0.5) ? 0.48 : 0.33;
  var hd = (Math.abs(Math.cos(rotY||0)) > 0.5) ? 0.33 : 0.48;
  wallsByFloor[f].push({minX:x-hw, maxX:x+hw, minZ:z-hd, maxZ:z+hd});
  lockers.push({g:grp, x:x, z:z, floor:f, rotY:rotY||0, discovered:false, discT:0});
}
function nearestLocker(){
  var best = null, bestD = 2.2;
  for(var i=0;i<lockers.length;i++){
    var L = lockers[i];
    if(L.floor !== currentFloor) continue;
    var dx = player.pos.x - L.x, dz = player.pos.z - L.z;
    var d = Math.sqrt(dx*dx + dz*dz);
    if(d < bestD){ bestD = d; best = L; }
  }
  return best;
}
function enterLocker(L){
  if(!L) return;
  player.hiding = true; player.hideLocker = L; player.hideT = 0;
  L.discovered = false; L.discT = 0;
  /* 躲进去前被看见 → 会被揪出来 */
  for(var i=0;i<monsters.length;i++){
    var mo = monsters[i];
    if(!mo.alive || mo.fake || mo.floor !== currentFloor) continue;
    var dx = mo.pos.x - L.x, dz = mo.pos.z - L.z;
    if(Math.sqrt(dx*dx + dz*dz) < 9.5){ L.discovered = true; break; }
  }
  elHidebtn.querySelector('span').textContent = '出来';
  if(elHideView) elHideView.classList.add('on');
  showMsg(L.discovered ? '它们看见你躲进来了！' : '你屏住呼吸，藏进柜子', 1.8);
  try { AudioSys.door(); } catch(e){}
}
function exitLocker(forced){
  var L = player.hideLocker;
  player.hiding = false; player.hideLocker = null;
  if(elHideView) elHideView.classList.remove('on');
  if(elHidebtn) elHidebtn.querySelector('span').textContent = '躲藏';
  if(L){
    /* 站到柜子前方 */
    var fx = Math.sin(L.rotY), fz = Math.cos(L.rotY);
    player.pos.x = L.x + fx*0.95;
    player.pos.z = L.z + fz*0.95;
  }
  if(forced){
    damagePlayer(16, null);
    showMsg('柜门被猛地拉开！', 2);
    try { AudioSys.bang(); AudioSys.shriek(); } catch(e){}
  } else {
    showMsg('你从柜子里出来', 1.2);
    try { AudioSys.door(); } catch(e){}
  }
}

/* ---------------- 开发者模式 ---------------- */
var elDevPass = $('devpass'), elDevPanel = $('devpanel'), elDevInput = $('devinput');
var elDevMsg = $('devmsg'), elDevGrid = $('devgrid');
var DEV_ITEMS = [
  ['god','无限生命','t'], ['infAmmo','无限子弹','t'], ['infStam','无限体力','t'],
  ['infFlash','手电不耗电','t'], ['oneShot','一击必杀','t'], ['freeze','冻结怪物','t'],
  ['fast','时间加速 ×5','t'], ['debug','显示状态行','t'],
  ['unlock','解锁全部武器','a'], ['heal','回满生命体力','a'], ['clear','清空场上怪物','a'],
  ['spawnP','刷出病人','a'], ['spawnC','刷出爬行者','a'], ['spawnG','刷出女鬼','a'],
  ['spawnH','刷出八尺大人','a'], ['dawn','立即天亮（胜利）','a']
];
function devSpawnAt(type){
  var t = MONSTER_TYPES[type]; if(!t) return;
  var fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
  var px = player.pos.x + fx*4.5, pz = player.pos.z + fz*4.5;
  var mesh = buildMonsterMesh(type);
  mesh.position.set(px, floorY(currentFloor), pz);
  scene.add(mesh);
  monsters.push({type:type, mesh:mesh, floor:currentFloor,
    pos:new THREE.Vector3(px, floorY(currentFloor)+(t.ghost?0.75:0), pz),
    hp:t.hp, alive:true, atkTimer:0, bob:rand(0,6.28), dist:0});
  showMsg('已刷出：' + type, 1.2);
}
function devAction(k){
  if(k==='unlock'){
    for(var i=1;i<WEAPONS.length;i++){
      if(player.unlocked.indexOf(i) < 0) player.unlocked.push(i);
      var has = false;
      for(var j=0;j<player.weapons.length;j++){ if(player.weapons[j].idx===i) has = true; }
      if(!has) player.weapons.push({idx:i, mag:WEAPONS[i].magSize});
    }
    buildGunModel(player.weapons[player.cur].idx);
    updateWeaponHud();
    showMsg('已解锁全部武器', 1.5);
  } else if(k==='heal'){
    player.hp = player.maxHp; player.stamina = player.staminaMax; player.exhausted = false;
    updateHud(); showMsg('生命 / 体力已回满', 1.5);
  } else if(k==='clear'){
    for(var m=monsters.length-1;m>=0;m--){ if(monsters[m].alive) killMonster(monsters[m]); }
    showMsg('已清空场上怪物', 1.5);
  } else if(k==='dawn'){
    gameOver = true; win();
  } else if(k==='spawnP'){ devSpawnAt('patient'); }
  else if(k==='spawnC'){ devSpawnAt('crawler'); }
  else if(k==='spawnG'){ devSpawnAt('ghost'); }
  else if(k==='spawnH'){ devSpawnAt('hachishaku'); }
}
function buildDevPanel(){
  if(!elDevGrid) return;
  elDevGrid.innerHTML = '';
  DEV_ITEMS.forEach(function(it){
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'dev-toggle' + ((it[2]==='t' && dev[it[0]]) ? ' on' : '');
    b.textContent = it[1];
    b.addEventListener('pointerdown', function(e){
      e.preventDefault(); e.stopPropagation();
      if(it[2]==='t'){
        dev[it[0]] = !dev[it[0]];
        b.classList.toggle('on', dev[it[0]]);
        if(it[0]==='debug' && elFps) elFps.style.display = dev.debug ? 'block' : 'none';
      } else {
        devAction(it[0]);
      }
      AudioSys.pickup();
    });
    elDevGrid.appendChild(b);
  });
}
function openDevPass(){
  if(!elDevPass) return;
  devTaps = 0;
  elDevMsg.textContent = ''; elDevInput.value = '';
  elDevPass.classList.remove('dev-hide');
  setTimeout(function(){ try { elDevInput.focus(); } catch(e){} }, 150);
}
function openDevPanel(){
  devPanelOpen = true;
  buildDevPanel();
  if(elDevPanel) elDevPanel.classList.remove('dev-hide');
}
function closeDevPanel(){
  devPanelOpen = false;
  if(elDevPanel) elDevPanel.classList.add('dev-hide');
}
if($('devok')) $('devok').addEventListener('pointerdown', function(e){
  e.preventDefault();
  var v = (elDevInput.value || '').trim().toLowerCase();
  if(v === DEV_PASS){
    dev.on = true;
    elDevPass.classList.add('dev-hide');
    AudioSys.pickup();
    openDevPanel();
  } else {
    elDevMsg.textContent = '密码错误';
    elDevInput.value = '';
    AudioSys.empty();
  }
});
if($('devcancel')) $('devcancel').addEventListener('pointerdown', function(e){
  e.preventDefault();
  elDevPass.classList.add('dev-hide');
});
if($('devclose')) $('devclose').addEventListener('pointerdown', function(e){
  e.preventDefault(); closeDevPanel();
});
if(elDevInput) elDevInput.addEventListener('keydown', function(e){
  if(e.key === 'Enter'){ e.preventDefault(); if($('devok')) $('devok').dispatchEvent(new Event('pointerdown')); }
});
/* 隐藏入口：连点菜单底部版本号 / 游戏内楼层标签 5 次 */
document.addEventListener('pointerdown', function(e){
  var t = e.target; if(!t) return;
  var cls = (typeof t.className === 'string') ? t.className : '';
  var isFoot = (cls.indexOf('menu-foot') >= 0);
  var isFloor = (t.id === 'floorlabel');
  var isTitle = (cls.indexOf('title-cn') >= 0) || (cls.indexOf('title-en') >= 0) || (cls.indexOf('title-line') >= 0);
  if(!isFoot && !isFloor && !isTitle) return;
  devTaps++;
  clearTimeout(devTapTimer);
  devTapTimer = setTimeout(function(){ devTaps = 0; }, 1400);
  if(devTaps >= 5){
    devTaps = 0;
    if(dev.on) openDevPanel(); else openDevPass();
  }
}, true);

/* ---------------- 初始化（分步异步，低端机也不会假死黑屏） ---------------- */
function setLoadingText(t){
  var lt = document.getElementById('loadtext');
  if(lt) lt.textContent = t;
}
for(var fi0 = 0; fi0 < FLOORS; fi0++){ wallsByFloor.push([]); spawnPointsByFloor.push([]); }
var initSteps = [
  ['正在准备 1F 病房层 …', function(){ buildFloorRooms(0, FLOOR0_ROOMS); }],
  ['正在准备 2F 实验层 …', function(){ buildFloorRooms(1, FLOOR1_ROOMS); }],
  ['正在准备 3F 天台 …',   function(){ buildRoof(2); }],
  ['正在搭建楼梯 …',       function(){ buildStairs(); }],
  ['正在准备装备 …',       function(){ buildGunModel(0); updateWeaponHud(); elFloorLabel.textContent = floorLabelText(); }],
  ['就绪',                 function(){ applyQuality(); if(elLoading){ elLoading.classList.add('hidden'); setTimeout(function(){ elLoading.innerHTML = ''; }, 800); } }]
];
var initIdx = 0, initFailed = false;
function runInit(){
  if(initIdx >= initSteps.length || initFailed) return;
  var step = initSteps[initIdx];
  setLoadingText(step[0]);
  setTimeout(function(){
    try { step[1](); }
    catch(e){
      initFailed = true;
      if(window.onerror) window.onerror('初始化失败: ' + (e && e.message), '', 0);
      setLoadingText('初始化出错 · 见左上角红字');
      if(elLoading) elLoading.classList.add('hidden');
      return;
    }
    initIdx++;
    runInit();
  }, 40);
}
runInit();

var lastFrameAt = 0, rafId = 0, contextLost = false;
var frameCount = 0, lastErrMsg = '';
function render(){
  rafId = requestAnimationFrame(render);
  lastFrameAt = performance.now();
  frameCount++;
  var now = performance.now();
  var dt = clamp((now-lastTime)/1000, 0, 0.05);
  lastTime = now;
  if(contextLost){ return; }
  update(dt);
  if(!started){
    var mt = now*0.001;
    camera.position.y = EYE_HEIGHT + Math.sin(mt*0.6)*0.035;
    camera.rotation.set(0, -Math.PI/2 + Math.sin(mt*0.12)*0.1, 0, 'YXZ');
    camera.getWorldDirection(cameraDir);
  }
  for(var i=0;i<roomLights.length;i++){
    var L = roomLights[i];
    var flick = 1 + Math.sin(now*0.02+L.ph)*0.15 + (Math.random()<0.03?rand(-0.5,0.2):0);
    L.p.intensity = Math.max(0.06, L.base*flick*lightMul);
  }
  /* --- 后处理渲染（失败自动降级，避免黑屏） --- */
  if(PostFX.enabled()){
    try { PostFX.render(renderer, scene, camera); }
    catch(e){ PostFX.setEnabled(false); renderer.render(scene, camera); }
  } else { renderer.render(scene, camera); }

  /* --- FPS 监测与动态画质 --- */
  fpsFrames++; fpsTime += dt;
  if(fpsTime >= 1){
    fpsAvg = fpsFrames/fpsTime; fpsFrames = 0; fpsTime = 0;
    if(elFps){
      elFps.textContent = 'V1.1 ' + Math.round(fpsAvg) + 'fps 帧' + frameCount + ' ' + Math.floor(elapsed) + 's 怪' + monsters.length + ' 档' + qualityLevel + (contextLost ? ' 上下文丢失' : '') + (lastErrMsg ? (' 错:' + lastErrMsg) : '');
    }
    if(fpsAvg < 22){ lowFpsFor += 1; highFpsFor = 0; }
    else if(fpsAvg > 48){ highFpsFor += 1; lowFpsFor = Math.max(0, lowFpsFor-1); }
    else { lowFpsFor = Math.max(0, lowFpsFor-1); highFpsFor = 0; }
    if(lowFpsFor >= 2 && qualityLevel > 0){
      qualityLevel--; applyQuality();
      showMsg('已降低画质以保证流畅', 2);
      lowFpsFor = -3;
    }
    if(highFpsFor >= 3 && qualityLevel < 2){
      qualityLevel++; applyQuality();
      showMsg('运行流畅 · 已提升画质', 2);
      highFpsFor = -4;
    }
  }
}
render();

/* 切后台/回前台 & WebGL 上下文丢失恢复（手机必须处理，否则回来会卡死） */
document.addEventListener('visibilitychange', function(){
  if(!document.hidden){
    lastTime = performance.now();
    if(!contextLost){ cancelAnimationFrame(rafId); rafId = requestAnimationFrame(render); }
  }
});
var ctxRecoverTimer = 0;
canvas.addEventListener('webglcontextlost', function(e){
  e.preventDefault();
  contextLost = true;
  try { if(elLoading){ elLoading.classList.remove('hidden'); setLoadingText('画面正在恢复 …'); } } catch(err){}
  clearTimeout(ctxRecoverTimer);
  ctxRecoverTimer = setTimeout(function(){
    if(!contextLost) return;
    /* 先尝试让 three.js 强制恢复 */
    try { if(renderer.forceContextRestore) renderer.forceContextRestore(); } catch(err){}
    setTimeout(function(){
      if(contextLost){
        var rc = parseInt(sessionStorage.getItem('ctxReloads') || '0', 10);
        if(rc < 2){ sessionStorage.setItem('ctxReloads', String(rc + 1)); location.reload(); }
        else { setLoadingText('画面无法恢复 · 请关闭后重新打开'); }
      }
    }, 900);
  }, 900);
}, false);
canvas.addEventListener('webglcontextrestored', function(){
  contextLost = false;
  clearTimeout(ctxRecoverTimer);
  lastTime = performance.now();
  try { PostFX.resize(); } catch(err){}
  try { if(elLoading) elLoading.classList.add('hidden'); } catch(err){}
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(render);
}, false);
/* 看门狗：若 2 秒没有新帧（系统挂起渲染循环），自动重启 */
setInterval(function(){
  if(contextLost && !window.__ctxReloading){
    window.__ctxReloading = true;
    setTimeout(function(){ location.reload(); }, 1200);
    return;
  }
  if(started && !contextLost && performance.now() - lastFrameAt > 2500){
    lastTime = performance.now();
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(render);
  }
}, 1500);

var rotateShown = false, rotateTimer = 0;
function checkOrientation(){
  var port = window.innerHeight > window.innerWidth;
  if(port && elRotate && !rotateShown){
    elRotate.style.display = 'flex';
    elRotate.style.opacity = 1;
    rotateShown = true;
    clearTimeout(rotateTimer);
    rotateTimer = setTimeout(function(){
      elRotate.style.opacity = 0;
      setTimeout(function(){ elRotate.style.display = 'none'; }, 700);
    }, 2400);
  } else if(!port && elRotate){
    elRotate.style.display = 'none';
  }
}
window.addEventListener('resize', function(){
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  PostFX.resize();
  checkOrientation();
});
checkOrientation();

setInterval(function(){
  if(!started || gameOver) return;
  if(player.unlocked.indexOf(1)<0 && elapsed>8) showMsg('1F 安保室有一把霰弹枪，可以去找找', 2.5);
  else if(player.unlocked.indexOf(2)<0 && elapsed>30) showMsg('2F 药库有一把冲锋枪，上楼去找找', 2.5);
}, 6000);

} catch(e){
  var _lt = document.getElementById('loadtext');
  if(_lt) _lt.textContent = '启动失败 · 见左上角红字';
  if(window.onerror) window.onerror('启动失败: ' + (e && e.message), '', 0);
}
})();
