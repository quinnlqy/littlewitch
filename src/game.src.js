
"use strict";
/* =========================================================================
   小魔女夜空飞行 — 横版飞行射击
   单文件 HTML5 Canvas 像素游戏
   ========================================================================= */

const W = 480, H = 270;
const cv  = document.getElementById('cv');
/* WB08：外扩层只画「天空 / 湖面 / 岸景」，所以要把场景单独重画一遍。
   drawSceneLayer 全程直接用模块级 ctx，这里留成 let，重画那一小段里
   把 ctx 临时指到离屏画布上，画完立刻换回来（同步执行，不会串帧）。 */
let ctx = cv.getContext('2d', { alpha:false });
/* 背景外扩层：把当前帧缩到 160×90，再由 CSS 模糊铺满容器（16.5 / V07） */
/* WB21：原来的 #bleed 160×90 小画布外扩层已删除 ——
   背景现在直接按可见范围连续绘制，不再需要任何副本 / 模糊 / 拉伸。 */
ctx.imageSmoothingEnabled = false;

function clamp(v,a,b){ return v<a?a:(v>b?b:v); }
function rand(a,b){ return a + Math.random()*(b-a); }
function randi(a,b){ return Math.floor(rand(a,b+1)); }
function pick(a){ return a[(Math.random()*a.length)|0]; }

/* ============================ 1. 像素工具 ============================ */

// 把字符画数组渲染成离屏 canvas
function makeSprite(rows, pal, sc){
  sc = sc || 1;
  let w = 0; rows.forEach(r => w = Math.max(w, r.length));
  const h = rows.length;
  const c = document.createElement('canvas');
  c.width = w*sc; c.height = h*sc;
  const g = c.getContext('2d');
  for(let y=0;y<h;y++){
    const line = rows[y];
    for(let x=0;x<w;x++){
      const ch = line[x];
      if(!ch || ch==='.' || ch===' ') continue;
      const col = pal[ch];
      if(!col) continue;
      g.fillStyle = col;
      g.fillRect(x*sc, y*sc, sc, sc);
    }
  }
  return c;
}

// 生成纯色剪影（受击闪白）
function silhouette(spr, color){
  const c = document.createElement('canvas');
  c.width = spr.width; c.height = spr.height;
  const g = c.getContext('2d');
  g.drawImage(spr,0,0);
  const d = g.getImageData(0,0,c.width,c.height);
  const px = d.data;
  const m = document.createElement('canvas'); m.width=c.width; m.height=c.height;
  const mg = m.getContext('2d');
  const q = mg.createImageData(c.width,c.height);
  const rgb = hexToRgb(color);
  for(let i=0;i<px.length;i+=4){
    if(px[i+3] > 40){
      q.data[i]=rgb[0]; q.data[i+1]=rgb[1]; q.data[i+2]=rgb[2]; q.data[i+3]=255;
    }
  }
  mg.putImageData(q,0,0);
  return m;
}
function hexToRgb(h){
  h = h.replace('#','');
  return [parseInt(h.substr(0,2),16), parseInt(h.substr(2,2),16), parseInt(h.substr(4,2),16)];
}

// 像素矩形（用于程序化大图形）
function px(g,x,y,w,h,c){ g.fillStyle=c; g.fillRect(x|0,y|0,w|0,h|0); }
// 像素圆
function pxCircle(g,cx,cy,r,c){
  g.fillStyle=c;
  for(let y=-r;y<=r;y++){
    const dx = Math.floor(Math.sqrt(Math.max(0,r*r-y*y)));
    g.fillRect(Math.round(cx-dx), Math.round(cy+y), dx*2+1, 1);
  }
}

function drawSpr(spr, x, y, flip){
  const X = Math.round(x), Y = Math.round(y);
  if(flip){
    ctx.save(); ctx.translate(X+spr.width, Y); ctx.scale(-1,1);
    ctx.drawImage(spr,0,0); ctx.restore();
  } else {
    ctx.drawImage(spr, X, Y);
  }
}

/* ============================ 2. 位图字体 ============================ */

const FONT_DATA = {
' ':['.....','.....','.....','.....','.....','.....','.....'],
'A':['.###.','#...#','#...#','#####','#...#','#...#','#...#'],
'B':['####.','#...#','#...#','####.','#...#','#...#','####.'],
'C':['.###.','#...#','#....','#....','#....','#...#','.###.'],
'D':['####.','#...#','#...#','#...#','#...#','#...#','####.'],
'E':['#####','#....','#....','####.','#....','#....','#####'],
'F':['#####','#....','#....','####.','#....','#....','#....'],
'G':['.###.','#...#','#....','#.###','#...#','#...#','.###.'],
'H':['#...#','#...#','#...#','#####','#...#','#...#','#...#'],
'I':['#####','..#..','..#..','..#..','..#..','..#..','#####'],
'J':['..###','...#.','...#.','...#.','...#.','#..#.','.##..'],
'K':['#...#','#..#.','#.#..','##...','#.#..','#..#.','#...#'],
'L':['#....','#....','#....','#....','#....','#....','#####'],
'M':['#...#','##.##','#.#.#','#.#.#','#...#','#...#','#...#'],
'N':['#...#','##..#','#.#.#','#.#.#','#..##','#...#','#...#'],
'O':['.###.','#...#','#...#','#...#','#...#','#...#','.###.'],
'P':['####.','#...#','#...#','####.','#....','#....','#....'],
'Q':['.###.','#...#','#...#','#...#','#.#.#','#..#.','.##.#'],
'R':['####.','#...#','#...#','####.','#.#..','#..#.','#...#'],
'S':['.####','#....','#....','.###.','....#','....#','####.'],
'T':['#####','..#..','..#..','..#..','..#..','..#..','..#..'],
'U':['#...#','#...#','#...#','#...#','#...#','#...#','.###.'],
'V':['#...#','#...#','#...#','#...#','#...#','.#.#.','..#..'],
'W':['#...#','#...#','#...#','#.#.#','#.#.#','##.##','#...#'],
'X':['#...#','#...#','.#.#.','..#..','.#.#.','#...#','#...#'],
'Y':['#...#','#...#','.#.#.','..#..','..#..','..#..','..#..'],
'Z':['#####','....#','...#.','..#..','.#...','#....','#####'],
'0':['.###.','#...#','#..##','#.#.#','##..#','#...#','.###.'],
'1':['..#..','.##..','..#..','..#..','..#..','..#..','.###.'],
'2':['.###.','#...#','....#','...#.','..#..','.#...','#####'],
'3':['####.','....#','....#','.###.','....#','....#','####.'],
'4':['...#.','..##.','.#.#.','#..#.','#####','...#.','...#.'],
'5':['#####','#....','####.','....#','....#','#...#','.###.'],
'6':['..##.','.#...','#....','####.','#...#','#...#','.###.'],
'7':['#####','....#','...#.','..#..','.#...','.#...','.#...'],
'8':['.###.','#...#','#...#','.###.','#...#','#...#','.###.'],
'9':['.###.','#...#','#...#','.####','....#','...#.','.##..'],
':':['.....','..#..','.....','.....','.....','..#..','.....'],
'.':['.....','.....','.....','.....','.....','.....','..#..'],
',':['.....','.....','.....','.....','.....','..#..','.#...'],
'!':['..#..','..#..','..#..','..#..','..#..','.....','..#..'],
'?':['.###.','#...#','....#','...#.','..#..','.....','..#..'],
'-':['.....','.....','.....','#####','.....','.....','.....'],
'+':['.....','..#..','..#..','#####','..#..','..#..','.....'],
'/':['....#','....#','...#.','..#..','.#...','#....','#....'],
'%':['#...#','...#.','...#.','..#..','.#...','.#...','#...#'],
"'":['..#..','..#..','.....','.....','.....','.....','.....'],
'(':['...#.','..#..','.#...','.#...','.#...','..#..','...#.'],
')':['.#...','..#..','...#.','...#.','...#.','..#..','.#...'],
'<':['...#.','..#..','.#...','#....','.#...','..#..','...#.'],
'>':['.#...','..#..','...#.','....#','...#.','..#..','.#...'],
'*':['.....','#.#.#','.###.','#####','.###.','#.#.#','.....'],
'=':['.....','.....','#####','.....','#####','.....','.....']
};
const GLYPH_W = 5, GLYPH_H = 7;
const glyphCache = new Map();
/* v1.7 试过把 HUD 换成楷体，结论是行不通：
   canvas 内部只有 480×270，8px 楷体在这个分辨率下笔画糊成一团（"MAGIC" 读成 "MAOIC"），
   而 5×7 点阵字本来就是为这个分辨率设计的，反而清晰。
   所以字形沿用点阵，改在笔画外面加一层柔光，让它不那么"硬邦邦"。 */
function glyph(ch, color){
  const key = ch + color;
  if(glyphCache.has(key)) return glyphCache.get(key);
  const rows = FONT_DATA[ch] || FONT_DATA['?'];
  const c = document.createElement('canvas');
  c.width = GLYPH_W; c.height = GLYPH_H;
  const g = c.getContext('2d');
  g.fillStyle = color;
  for(let y=0;y<GLYPH_H;y++){
    const line = rows[y] || '';
    for(let x=0;x<GLYPH_W;x++) if(line[x]==='#') g.fillRect(x,y,1,1);
  }
  glyphCache.set(key,c);
  return c;
}
function textWidth(t, sc){ sc = sc||1; return (t.length * (GLYPH_W+1) - 1) * sc; }
function drawText(t, x, y, color, sc, shadow){
  sc = sc||1; t = String(t).toUpperCase();
  if(shadow){
    /* v1.9：原来是一份硬 1px 偏移，像素字一加硬投影就变成贴纸。
       改成两层低透明、略微错开的偏移 —— 便宜的伪模糊，
       读起来是"洇开的底"而不是"描了一圈边"。 */
    for(let k=0;k<2;k++){
      const ox = (k ? -0.55 : 0.45) * sc;
      const oy = (k ? 1.25 : 0.85) * sc;
      ctx.globalAlpha = k ? 0.20 : 0.34;
      for(let i=0;i<t.length;i++){
        drawGlyph(t[i], shadow, x + i*(GLYPH_W+1)*sc + ox, y + oy, sc, true);
      }
    }
    ctx.globalAlpha = 1;
  }
  for(let i=0;i<t.length;i++) drawGlyph(t[i], color, x + i*(GLYPH_W+1)*sc, y, sc);
}
function drawGlyph(ch, color, x, y, sc, bare){
  const g = glyph(ch,color);
  if(bare){ ctx.drawImage(g, Math.round(x), Math.round(y), GLYPH_W*sc, GLYPH_H*sc); return; }
  /* 柔光层：同色、略放大、低透明度铺一层，笔画边缘就有了渗透感 */
  ctx.globalAlpha = 0.26;
  ctx.drawImage(g, Math.round(x) - 0.5, Math.round(y) - 0.5,
                GLYPH_W*sc + 1, GLYPH_H*sc + 1);
  ctx.globalAlpha = 1;
  ctx.drawImage(g, Math.round(x), Math.round(y), GLYPH_W*sc, GLYPH_H*sc);
}
function drawTextC(t, cx, y, color, sc, shadow){
  drawText(t, cx - textWidth(t,sc)/2, y, color, sc, shadow);
}

/* ============================ 3. 精灵美术 ============================ */

// 精灵容器
const SP = {};

/* @@HERO_ANIM_BEGIN@@ */
/* ============ 主角序列帧（视频提取，四组动作）============
   flight 悬停 / move 横移 / attack 射击与施法 / long 持续施法（Fever）
   由 build_hero_frames.py 从 art/animations/video-flight-actions-v1 打包注入 */
const HERO_ANIM = {
  flight: { w:150, h:147, cols:6, n:6, ax:80.0, ay:114.2, img:new Image(), rects:[[0,0],[150,0],[300,0],[450,0],[600,0],[750,0]] },
  move: { w:150, h:147, cols:6, n:11, ax:80.0, ay:114.2, img:new Image(), rects:[[0,0],[150,0],[300,0],[450,0],[600,0],[750,0],[0,147],[150,147],[300,147],[450,147],[600,147]] },
  attack: { w:144, h:141, cols:9, n:36, ax:76.8, ay:109.6, img:new Image(), rects:[[0,0],[144,0],[288,0],[432,0],[576,0],[720,0],[864,0],[1008,0],[1152,0],[0,141],[144,141],[288,141],[432,141],[576,141],[720,141],[864,141],[1008,141],[1152,141],[0,282],[144,282],[288,282],[432,282],[576,282],[720,282],[864,282],[1008,282],[1152,282],[0,423],[144,423],[288,423],[432,423],[576,423],[720,423],[864,423],[1008,423],[1152,423]] },
  long: { w:124, h:121, cols:9, n:38, ax:66.1, ay:94.4, img:new Image(), rects:[[0,0],[124,0],[248,0],[372,0],[496,0],[620,0],[744,0],[868,0],[992,0],[0,121],[124,121],[248,121],[372,121],[496,121],[620,121],[744,121],[868,121],[992,121],[0,242],[124,242],[248,242],[372,242],[496,242],[620,242],[744,242],[868,242],[992,242],[0,363],[124,363],[248,363],[372,363],[496,363],[620,363],[744,363],[868,363],[992,363],[0,484],[124,484]] },
};
/*@@ASSET_214@@*/
/*@@ASSET_215@@*/
/*@@ASSET_216@@*/
/*@@ASSET_217@@*/
/* @@BOOST_ANIM_BEGIN@@ */
/* ============ 加速飞行动作（01B_加速飞行_绝不施法）============
   boostStart 加速起手 14 帧 / boostLoop 高速循环 12 帧
   与 flight/move 同一裁剪框、同一锚点，切换时不位移不缩放
   由 build_flight_boost.py 提取、inject_flight_boost.py 注入 */
  HERO_ANIM.boostStart = { w:150, h:147, cols:6, n:14, ax:80.0, ay:114.2, img:new Image(), rects:[[0,0],[150,0],[300,0],[450,0],[600,0],[750,0],[0,147],[150,147],[300,147],[450,147],[600,147],[750,147],[0,294],[150,294]] };
  HERO_ANIM.boostLoop = { w:150, h:147, cols:6, n:12, ax:80.0, ay:114.2, img:new Image(), rects:[[0,0],[150,0],[300,0],[450,0],[600,0],[750,0],[0,147],[150,147],[300,147],[450,147],[600,147],[750,147]] };
/*@@ASSET_225@@*/
/*@@ASSET_226@@*/
/* @@BOOST_ANIM_END@@ */
/* @@HERO_ANIM_END@@ */


const PAL = {
  K:'#150f22',
  p:'#5A5463', P:'#7C6C93', w:'#E8788F', e:'#E6DCEF',
  o:'#D9773A', O:'#F0A05C', y:'#F6DFA6', v:'#7C8F5A',
  A:'#3a3f57', B:'#6b7396', C:'#241a33', D:'#4a3670', r:'#ff4d4d'
};



/* --- 蝙蝠 16x12 --- */
const BAT_A = [
'......K..K......',
'.....KpKKpK.....',
'.....KpPPpK.....',
'..K..KpPPpK..K..',
'.KpK.KpwepK.KpK.',
'KpppKKpPPpKKpppK',
'KPpppKpPPpKpppPK',
'KPpppKKppKKpppPK',
'.KpppKKKKKpppK..',
'..KpppKKKpppK...',
'...KpppppK......',
'....KKKKK.......'
];
const BAT_B = [
'................',
'......K..K......',
'.....KpKKpK.....',
'.....KpPPpK.....',
'..KK.KpPPpK.KK..',
'.KppKKpwepKKppK.',
'KpppKKpPPpKKpppK',
'KPppppKppKppppPK',
'.KPpppKKKKpppPK.',
'..KppppppppppK..',
'...KKpppppKK....',
'.....KKKKK......'
];
/* ============ 敌人 / Boss / 道具 立绘（AI 生成，与主角同一套绘本水彩）============ */
/* 源图 design/raw/sheet_mobs.png、sheet_boss.png、sheet_props.png
   build_assets_v2.py 切图抠底 -> inject_assets.py 打包注入 */
const ART = {};
let artReady = false, _artN = 0;
const _ART_TOTAL = 24;                 // 每个素材 2 张：本体 + 受击闪白剪影
/* 立绘的不透明包围盒，返回归一化的 [x0,y0,x1,y1]（0~1） */
function _inkBox(im){
  const w = im.naturalWidth, h = im.naturalHeight;
  if(!w || !h) return null;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.drawImage(im, 0, 0);
  let d;
  try { d = g.getImageData(0, 0, w, h).data; } catch(e){ return null; }
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for(let y = 0; y < h; y++){
    for(let x = 0; x < w; x++){
      if(d[(y*w + x)*4 + 3] > 24){
        if(x < x0) x0 = x;
        if(x > x1) x1 = x;
        if(y < y0) y0 = y;
        if(y > y1) y1 = y;
      }
    }
  }
  if(x1 < 0) return null;
  return [x0/w, y0/h, (x1+1)/w, (y1+1)/h];
}

function _art(key, src, sil){
  const im = new Image();
  im.onload = function(){
    im.ink = _inkBox(im);          // 预烘墨迹包围盒，供碰撞调试层比对
    if(++_artN >= _ART_TOTAL) artReady = true;
  };
  im.src = src;
  ART[key] = im;
  const w = new Image();
  w.onload = function(){
    // 顺带烘一张深色剪影：运行时当作外描边，保证任何背景上都分得清轮廓
    const c = document.createElement('canvas');
    c.width = w.naturalWidth; c.height = w.naturalHeight;
    const g = c.getContext('2d');
    g.drawImage(w, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = '#0c0718';
    g.fillRect(0, 0, c.width, c.height);
    ART[key + 'D'] = c;
    if(++_artN >= _ART_TOTAL) artReady = true;
  };
  w.src = sil;
  ART[key + 'W'] = w;
}
/* @@MON_ANIM_ASSETS_BEGIN@@ 由 inject_monsters.py 生成，勿手改 */
const MON_SPEC = {"imp":{"fw":91,"fh":87,"cols":6,"n":24,"fps":12,"eq":0.80951,"rects":[[0,0],[91,0],[182,0],[273,0],[364,0],[455,0],[0,87],[91,87],[182,87],[273,87],[364,87],[455,87],[0,174],[91,174],[182,174],[273,174],[364,174],[455,174],[0,261],[91,261],[182,261],[273,261],[364,261],[455,261]]},"fish":{"fw":96,"fh":81,"cols":6,"n":24,"fps":12,"eq":0.8818,"rects":[[0,0],[96,0],[192,0],[288,0],[384,0],[480,0],[0,81],[96,81],[192,81],[288,81],[384,81],[480,81],[0,162],[96,162],[192,162],[288,162],[384,162],[480,162],[0,243],[96,243],[192,243],[288,243],[384,243],[480,243]]},"carrier":{"fw":125,"fh":162,"cols":6,"n":24,"fps":12,"eq":0.9481,"rects":[[0,0],[125,0],[250,0],[375,0],[500,0],[625,0],[0,162],[125,162],[250,162],[375,162],[500,162],[625,162],[0,324],[125,324],[250,324],[375,324],[500,324],[625,324],[0,486],[125,486],[250,486],[375,486],[500,486],[625,486]]},"head":{"fw":64,"fh":81,"cols":6,"n":24,"fps":12,"eq":0.78236,"rects":[[0,0],[64,0],[128,0],[192,0],[256,0],[320,0],[0,81],[64,81],[128,81],[192,81],[256,81],[320,81],[0,162],[64,162],[128,162],[192,162],[256,162],[320,162],[0,243],[64,243],[128,243],[192,243],[256,243],[320,243]]},"bat":{"fw":116,"fh":81,"cols":6,"n":24,"fps":12,"eq":0.95732,"rects":[[0,0],[116,0],[232,0],[348,0],[464,0],[580,0],[0,81],[116,81],[232,81],[348,81],[464,81],[580,81],[0,162],[116,162],[232,162],[348,162],[464,162],[580,162],[0,243],[116,243],[232,243],[348,243],[464,243],[580,243]]},"boss1":{"fw":171,"fh":174,"cols":6,"n":24,"fps":12,"eq":0.78961,"rects":[[0,0],[171,0],[342,0],[513,0],[684,0],[855,0],[0,174],[171,174],[342,174],[513,174],[684,174],[855,174],[0,348],[171,348],[342,348],[513,348],[684,348],[855,348],[0,522],[171,522],[342,522],[513,522],[684,522],[855,522]]},"boss2":{"fw":167,"fh":209,"cols":6,"n":24,"fps":12,"eq":0.86035,"rects":[[0,0],[167,0],[334,0],[501,0],[668,0],[835,0],[0,209],[167,209],[334,209],[501,209],[668,209],[835,209],[0,418],[167,418],[334,418],[501,418],[668,418],[835,418],[0,627],[167,627],[334,627],[501,627],[668,627],[835,627]]},"headAtk":{"fw":64,"fh":81,"cols":6,"n":16,"fps":12,"eq":0.78236,"rects":[[0,0],[64,0],[128,0],[192,0],[256,0],[320,0],[0,81],[64,81],[128,81],[192,81],[256,81],[320,81],[0,162],[64,162],[128,162],[192,162]]},"carrierAtk":{"fw":125,"fh":162,"cols":6,"n":16,"fps":12,"eq":0.9481,"rects":[[0,0],[125,0],[250,0],[375,0],[500,0],[625,0],[0,162],[125,162],[250,162],[375,162],[500,162],[625,162],[0,324],[125,324],[250,324],[375,324]]},"boss1Atk":{"fw":184,"fh":174,"cols":6,"n":18,"fps":12,"eq":0.78961,"rects":[[0,0],[184,0],[368,0],[552,0],[736,0],[920,0],[0,174],[184,174],[368,174],[552,174],[736,174],[920,174],[0,348],[184,348],[368,348],[552,348],[736,348],[920,348]]},"batAtk":{"fw":116,"fh":81,"cols":6,"n":18,"fps":12,"eq":0.95732,"rects":[[0,0],[116,0],[232,0],[348,0],[464,0],[580,0],[0,81],[116,81],[232,81],[348,81],[464,81],[580,81],[0,162],[116,162],[232,162],[348,162],[464,162],[580,162]]},"boss1Tell":{"fw":171,"fh":174,"cols":6,"n":16,"fps":12,"eq":0.78961,"rects":[[0,0],[171,0],[342,0],[513,0],[684,0],[855,0],[0,174],[171,174],[342,174],[513,174],[684,174],[855,174],[0,348],[171,348],[342,348],[513,348]]},"boss2Atk":{"fw":195,"fh":209,"cols":6,"n":16,"fps":12,"eq":0.86035,"rects":[[0,0],[195,0],[390,0],[585,0],[780,0],[975,0],[0,209],[195,209],[390,209],[585,209],[780,209],[975,209],[0,418],[195,418],[390,418],[585,418]]}};
const MON_B64 = {
/*@@ASSET_327@@*/
/*@@ASSET_328@@*/
/*@@ASSET_329@@*/
/*@@ASSET_330@@*/
/*@@ASSET_331@@*/
/*@@ASSET_332@@*/
/*@@ASSET_333@@*/
/*@@ASSET_334@@*/
/*@@ASSET_335@@*/
/*@@ASSET_336@@*/
/*@@ASSET_337@@*/
/*@@ASSET_338@@*/
/*@@ASSET_339@@*/
};
/* @@MON_ANIM_ASSETS_END@@ */
/*@@ASSET_342@@*/
/*@@ASSET_343@@*/
/*@@ASSET_344@@*/
/*@@ASSET_345@@*/
/*@@ASSET_346@@*/
/*@@ASSET_347@@*/
/*@@ASSET_348@@*/
/*@@ASSET_349@@*/
/*@@ASSET_350@@*/
/*@@ASSET_351@@*/
/*@@ASSET_352@@*/
/*@@ASSET_353@@*/

/* --- 星星能量 9x9 --- */
const STAR_A = [
'....#....',
'...###...',
'...###...',
'#########',
'.#######.',
'..#####..',
'...###...',
'..##.##..',
'.##...##.'
];
const STAR_B = [
'....#....',
'....#....',
'...###...',
'#########',
'#########',
'.#######.',
'..#####..',
'...###...',
'...#.#...'
];
const STAR_PAL = { '#':'#F2CF8A' };
SP.star  = makeSprite(STAR_A, STAR_PAL);
SP.starB = makeSprite(STAR_B, STAR_PAL);
SP.starHi= makeSprite(STAR_A.map(r=>r.replace(/#/g,'W')), {W:'#FFF4DC'});

/* --- HUD 图标 --- */
SP.heart = makeSprite([
'.##.##.',
'#######',
'#######',
'.#####.',
'..###..',
'...#...'
], { '#':'#E8788F' });
SP.heartOff = makeSprite([
'.##.##.',
'#######',
'#######',
'.#####.',
'..###..',
'...#...'
], { '#':'#4a3550' });
SP.hudStar = makeSprite([
'..#..',
'.###.',
'#####',
'.###.',
'..#..'
], { '#':'#F2CF8A' });
SP.hudBomb = makeSprite([
'....#..',
'...#...',
'..##...',
'.####..',
'######.',
'######.',
'.####..'
], { '#':'#CDBCE6' });

/* --- 玩家魔法弹 --- */
SP.shot = makeSprite([
'.......',
'.o###o.',
'oO###Oo',
'.o###o.',
'.......'
], { 'o':'#9BD0EE','O':'#E6F4FC','#':'#ffffff' });
SP.shotBig = makeSprite([
'.........',
'..ooooo..',
'.o#####o.',
'oO#####Oo',
'.o#####o.',
'..ooooo..',
'.........'
], { 'o':'#A98FD0','O':'#D9CDF0','#':'#ffffff' });

/* --- 敌方火球 --- */
SP.fire = makeSprite([
'..r....',
'.rRr...',
'rRRRr..',
'.rRRr..',
'..r....',
'.......'
], { 'r':'#ff6a1a','R':'#ffd15c' });
SP.fireB = makeSprite([
'...r...',
'..rRr..',
'.rRRRr.',
'..rRr..',
'...r...'
], { 'r':'#ff6a1a','R':'#ffd15c' });

/* --- 道具 12x12 --- */
const SHIELD_ROWS = [
'...#####...',
'..#TTTTT#..',
'.#TTWWWTT#.',
'.#TWWWWWT#.',
'.#TWWTTWT#.',
'.#TWWTTWT#.',
'.#TWWWWWT#.',
'..#TWWT#T#.',
'...#TTT#...',
'....###....'
];
SP.shield = makeSprite(SHIELD_ROWS, { T:'#9BD0EE', W:'#ffffff' });

/* --- BOSS 南瓜王 程序化绘制 72x72 --- */
function buildBoss(flash){
  const S = 72, c = document.createElement('canvas'); c.width=S; c.height=S;
  const g = c.getContext('2d');
  const k   = flash ? '#ffffff' : '#2a0f18';
  const body= flash ? '#ffffff' : '#e8712a';
  const lit = flash ? '#ffffff' : '#ffa74a';
  const dk  = flash ? '#ffffff' : '#a83d10';
  const stem= flash ? '#ffffff' : '#4f8f3a';
  const eye = flash ? '#ffffff' : '#F6DFA6';
  const mth = flash ? '#ffffff' : '#3a0d16';

  // 藤蔓王冠触须
  for(let i=0;i<7;i++){
    const ang = -Math.PI + i*(Math.PI/6);
    const bx = 36 + Math.cos(ang)*26, by = 40 + Math.sin(ang)*22;
    for(let t=0;t<10;t++){
      px(g, bx+Math.cos(ang)*t*1.4, by+Math.sin(ang)*t*1.4- (t*t)*0.08, 2,2, stem);
    }
  }
  // 南瓜本体（多层横向）
  const prof = [
    [10,16,52], [ 6,18,60], [ 3,20,66], [ 1,22,70], [ 0,24,72],
    [ 0,26,72], [ 0,28,72], [ 1,30,70], [ 2,32,68], [ 4,34,64],
    [ 7,36,58], [12,38,48], [18,40,36]
  ];
  let yy = 18;
  prof.forEach(function(p, idx){
    const x = p[0], h = p[1], w = p[2];
    for(let j=0;j<h;j++){
      const row = yy+j;
      // 瓜瓣：左右侧暗，中间亮
      for(let i=0;i<w;i++){
        const gx = x+i;
        let col = body;
        const rel = (i/(w-1));
        if(rel<0.10 || rel>0.90) col = dk;
        else if(rel>0.42 && rel<0.58) col = lit;
        // 竖直瓜瓣纹
        const rib = Math.abs(Math.sin(rel*Math.PI*3.0));
        if(rib>0.93) col = dk;
        px(g, gx, row, 1,1, col);
      }
    }
    yy += h;
  });
  // 顶部瓜蒂
  px(g,34,10,4,9, stem); px(g,30,12,12,3, stem); px(g,27,14,18,2, stem);
  px(g,38,6,6,5, stem); px(g,43,8,8,3, stem);
  // 眼睛（发光三角）
  const eyeShape = [
    [0,0,10,3],[1,3,8,3],[2,6,6,3],[3,9,4,2]
  ];
  [[12,30,1],[50,30,-1]].forEach(function(e){
    const ex=e[0], ey=e[1], dir=e[2];
    eyeShape.forEach(function(s, i){
      const w = s[2], sx = dir>0 ? ex+s[0] : ex+10-s[0]-w;
      px(g, sx, ey+s[1], w, s[3], i===0?k:eye);
    });
    px(g, dir>0?ex+3:ex+7, ey+4, 3,4, raceColor(flash));
  });
  // 鼻子
  px(g,34,42,4,4, mth);
  // 锯齿嘴
  const mouthY = 50, mx = 14, mw = 44;
  for(let i=0;i<mw;i++){
    const t = i/(mw-1);
    const h = 4 + Math.round(Math.sin(t*Math.PI)*7);
    px(g, mx+i, mouthY, 1, h, mth);
  }
  // 牙齿
  for(let i=0;i<4;i++){
    px(g, mx+5+i*10, mouthY, 4, 4, flash?'#ffffff':'#fff3d0');
  }
  // 内发光
  return c;
}
function raceColor(flash){ return flash ? '#ffffff' : '#ff3d3d'; }
/* Boss 改用立绘图，见上方 ART.boss */

/* ============================ 4. 音频 ============================ */

const Audio7 = {
  ac:null, master:null, musicGain:null, sfxGain:null, starGain:null, lim:null,
  sfxK:1,                         /* v1.12e：单次音效的归一系数（见 SFX_TRIM） */
  muted:false, started:false,
  nextNoteTime:0, step:0, timer:null, mode:'normal',
  init(){
    if(this.ac) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return;
    this.ac = new AC();
    this.master = this.ac.createGain(); this.master.gain.value = 0.5;
    /* v1.12e：限幅器兜底。sfxGain 抬到 4.0 之后，多声同时响（射击+受击+击破）
       叠加可能过 1.0，这个压缩器只在接近满刻度时压一下，平时不动声音。 */
    this.lim = this.ac.createDynamicsCompressor();
    this.lim.threshold.value = -6; this.lim.knee.value = 0; this.lim.ratio.value = 14;
    this.lim.attack.value = 0.003; this.lim.release.value = 0.12;
    this.master.connect(this.lim);
    this.lim.connect(this.ac.destination);
    this.musicGain = this.ac.createGain(); this.musicGain.gain.value = 0.34;
    this.musicGain.connect(this.master);
    /* v1.12e：0.5 -> 4.0。原来音效峰值只有 0.02~0.08，而背景乐峰值 0.375，
       差了约 20dB —— 实战里基本听不见。这里整体抬 8 倍，再按实测峰值逐个归一。 */
    this.sfxGain = this.ac.createGain(); this.sfxGain.gain.value = 4.0;
    this.sfxGain.connect(this.master);
    /* v1.12b：绽放循环乐独立总线。原来走 musicGain(0.34)，和 0.45 直出的 mp3
       差了几十倍，实战里基本听不见 —— 单独给一条 0.9 的通道。 */
    this.starGain = this.ac.createGain(); this.starGain.gain.value = 1.45;
    this.starGain.connect(this.master);
  },
  resume(){ if(this.ac && this.ac.state==='suspended') this.ac.resume(); },
  tone(o){
    if(!this.ac || this.muted) return;
    const t = this.ac.currentTime + (o.delay||0);
    const osc = this.ac.createOscillator();
    const g = this.ac.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.freq, t);
    if(o.detune) osc.detune.setValueAtTime(o.detune, t);
    if(o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20,o.to), t + o.dur);
    const busT = o.bus || this.sfxGain;
    const v = (o.vol===undefined?0.2:o.vol) * (busT === this.sfxGain ? this.sfxK : 1);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + (o.atk||0.006));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    osc.connect(g); g.connect(o.bus || this.sfxGain);
    osc.start(t); osc.stop(t + o.dur + 0.02);
  },
  noise(o){
    if(!this.ac || this.muted) return;
    const t = this.ac.currentTime + (o.delay||0);
    const dur = o.dur||0.2;
    const len = Math.max(1, Math.floor(this.ac.sampleRate*dur));
    const buf = this.ac.createBuffer(1, len, this.ac.sampleRate);
    const d = buf.getChannelData(0);
    for(let i=0;i<len;i++) d[i] = (Math.random()*2-1) * (1 - i/len);
    const src = this.ac.createBufferSource(); src.buffer = buf;
    const f = this.ac.createBiquadFilter();
    f.type = o.type||'highpass';
    f.frequency.setValueAtTime(o.f||800, t);
    if(o.f2) f.frequency.exponentialRampToValueAtTime(Math.max(60,o.f2), t+dur);
    const g = this.ac.createGain();
    const busN = o.bus || this.sfxGain;
    const volN = (o.vol===undefined?0.2:o.vol) * (busN === this.sfxGain ? this.sfxK : 1);
    g.gain.setValueAtTime(volN, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
    src.connect(f); f.connect(g); g.connect(busN);
    src.start(t); src.stop(t+dur+0.02);
  }
};


/* ---- 背景乐：生成好的 mp3 优先，解码失败再退回芯片合成 ----
   两首都内联在 BGM_SRC 里；Audio7.muted 与 <audio>.muted 保持同步。 */
const BGM_SRC = {
  normal: '@@AUDIO_bgm_normal@@',
  boss:   '@@AUDIO_bgm_boss@@'
};
/* 结算短曲：胜利 9 秒、失败 7 秒（都带淡出），只播一次不循环 */
const STING_SRC = {
  win:  '@@AUDIO_bgm_win@@',
  lose: '@@AUDIO_bgm_lose@@'
};
const STING = {
  el: null, failed: false,
  play(name){
    if(this.failed) return false;
    if(!this.el){
      this.el = document.getElementById('sting');
      if(this.el) this.el.addEventListener('error', function(){ STING.failed = true; });
    }
    if(!this.el) return false;
    this.el.src = STING_SRC[name];
    this.el.loop = false;
    this.el.volume = 0.6;
    this.el.muted = !!Audio7.muted;
    const p = this.el.play();
    if(p && p.catch) p.catch(function(){ STING.failed = true; });
    return true;
  },
  stop(){ if(this.el){ this.el.pause(); this.el.currentTime = 0; } },
  syncMute(){ if(this.el) this.el.muted = !!Audio7.muted; }
};
const BGM = {
  el: null, cur: '', failed: false,
  init(){
    if(this.el) return this.el;
    this.el = document.getElementById('bgm');
    if(this.el){
      this.el.volume = 0.28;        /* v1.12e：0.45 -> 0.28，峰值≈0.23，音效稳稳在上面 */
      this.el.addEventListener('error', function(){ BGM.failed = true; });
    }
    return this.el;
  },
  play(name){
    if(this.failed) return false;
    const el = this.init();
    if(!el || !BGM_SRC[name]) return false;
    if(this.cur !== name){
      this.cur = name;
      el.src = BGM_SRC[name];
    }
    el.muted = !!Audio7.muted;
    const p = el.play();
    if(p && p.catch) p.catch(function(){ startSynthMusic(); });
    return true;
  },
  stop(){ if(this.el) this.el.pause(); },
  syncMute(){ if(this.el) this.el.muted = !!Audio7.muted; }
};

/* ---- v1.12 绽放循环乐（超级星那种持续背景乐）----
   不占体积：用 Audio7 的振荡器现场合成。四四拍十六分音符的上下行琶音 + 低音根音，
   亮square 主奏、triangle 打底，音量压在 0.05 左右 —— 盖不住射击与受击提示。
   生命周期完全跟 bloomT：开启起、归零停、暂停停、死亡/收尾停。 */
const StarLoop = {
  timer:null, running:false, next:0, step:0, demo:false,
  BASE: 523.25,                       /* C5 */
  PAT: [0, 4, 7, 12, 7, 4, 0, 7, 12, 16, 12, 7, 4, 0, 4, 7],
  start(demo){
    if(!Audio7.ac) return;
    this.demo = !!demo;
    if(this.running){
      /* 已在跑：只更新 demo 标记，不重排时间轴（避免重音） */
      return;
    }
    this.running = true; this.step = 0;
    this.next = Audio7.ac.currentTime + 0.03;
    const self = this;
    this.timer = setInterval(function(){ self.tick(); }, 40);
  },
  stop(){
    this.running = false;
    if(this.timer){ clearInterval(this.timer); this.timer = null; }
    duckBgm(1);
  },
  tick(){
    if(!this.running || !Audio7.ac) return;
    const now = Audio7.ac.currentTime;
    if(this.next < now) this.next = now + 0.02;
    /* 只在绽放真的还在生效时出声；一旦归零立刻收。
       试听面板（?audio=1）里 demo=true，不受游戏状态约束。 */
    if(!this.demo && (player.bloomT <= 0 || player.dead || game.state !== 'play')){
      this.stop(); return;
    }
    while(this.next < now + 0.14){
      const i = this.step % 16;
      const semi = this.PAT[i] + (Math.floor(this.step / 16) % 2 ? 12 : 0);
      const f = this.BASE * Math.pow(2, semi / 12);
      const dl = Math.max(0, this.next - now);
      Audio7.tone({ freq:f, to:f*1.004, dur:0.10, vol:0.190, type:'square',
                    delay:dl, bus:Audio7.starGain });
      if(i % 4 === 0){
        Audio7.tone({ freq:f/4, to:f/4, dur:0.17, vol:0.150, type:'triangle',
                      delay:dl, bus:Audio7.starGain });
      }
      this.next += 0.105;
      this.step++;
    }
  }
};
/* 绽放期间把背景乐压下去一点，收尾时回来 —— 和「吃星」那套做法一致 */
function duckBgm(k){
  if(BGM.el && BGM.el.volume !== undefined) BGM.el.volume = 0.28 * k;
}
/* 绽放期把 mp3 背景乐压到 0.18（原来是 0.42×0.45≈0.19，但循环乐自己也小，
   两层差不多响，结果互相盖住 —— 现在循环乐明显在前，背景乐退到后面） */

/* 音效库：每条都是「低频冲击 + 中频主体 + 噪声尾巴」的叠加，
   尽量用 detune 与滑音做出质感，不加音频文件、不加体积。 */
const SFX = {
  /* ---------- 玩家：射击 ---------- */
  shoot(){                       // L1：干脆的一声
    Audio7.tone({freq:880, to:1500, dur:0.06, vol:0.09, type:'square'});
    Audio7.tone({freq:440, to:760,  dur:0.05, vol:0.05, type:'triangle', detune:-8});
  },
  shootBig(){                    // L2 / L3：更亮、带一点金属芯
    Audio7.tone({freq:1040, to:1760, dur:0.07, vol:0.10, type:'square'});
    Audio7.tone({freq:1560, to:2300, dur:0.05, vol:0.045, type:'triangle', detune:12});
    Audio7.noise({dur:0.05, vol:0.05, f:3200, type:'highpass'});
  },
  /* ---------- 玩家：四魔法 ---------- */
  magicFire(){                   // 炉火 v1.12：起手轰鸣 + 整段持续火声 + 四下噼啪
    Audio7.tone({freq:132, to:58, dur:0.40, vol:0.17, type:'sawtooth'});
    /* 持续层：滤波器在 1 秒里从低往高再回落，听起来是「火在往前卷」 */
    Audio7.noise({dur:0.98, vol:0.17, f:520, f2:1500, type:'lowpass'});
    Audio7.noise({dur:0.34, vol:0.07, f:2400, f2:6200, type:'highpass', delay:0.05});
    /* 噼啪：四下与八段火焰的节奏对齐，不逐段刷 */
    for(let k = 0; k < 4; k++){
      Audio7.noise({dur:0.055, vol:0.055, f:3600, f2:1400, type:'bandpass',
                    delay:0.10 + k * 0.22});
    }
  },
  fireTick(){                    // 火焰擦过目标的短促「嗤」
    Audio7.noise({dur:0.05, vol:0.035, f:2600, f2:900, type:'highpass'});
  },
  magicThunder(){                // 雷光：裂响 + 尾部余震
    Audio7.noise({dur:0.22, vol:0.22, f:5200, f2:1200, type:'highpass'});
    Audio7.tone({freq:1600, to:220, dur:0.22, vol:0.12, type:'square'});
    Audio7.noise({dur:0.35, vol:0.07, f:900, f2:200, type:'lowpass', delay:0.08});
  },
  magicBurst(){                  // 爆裂：闷响 + 碎片
    Audio7.tone({freq:90, to:38, dur:0.5, vol:0.2, type:'sine'});
    Audio7.noise({dur:0.4, vol:0.24, f:1600, f2:120, type:'lowpass'});
    Audio7.noise({dur:0.14, vol:0.09, f:4200, type:'highpass', delay:0.05});
  },
  magicStar(){                   // 落星：下坠哨音
    Audio7.tone({freq:1800, to:520, dur:0.34, vol:0.10, type:'triangle'});
    Audio7.tone({freq:2400, to:900, dur:0.30, vol:0.05, type:'sine', detune:20, delay:0.02});
  },
  /* ---------- 玩家：绽放 / 受伤 / 拾取 ---------- */
  fever(){                       // 充能上扫 + 爆发和弦
    Audio7.tone({freq:220, to:880, dur:0.34, vol:0.14, type:'sawtooth'});
    [523,659,784,1047].forEach((f,i)=>{
      Audio7.tone({freq:f, dur:0.30, vol:0.13, type:'triangle', delay:0.16 + i*0.05});
    });
    Audio7.noise({dur:0.5, vol:0.10, f:2600, f2:700, type:'highpass', delay:0.16});
  },
  feverEnd(){                    // 收光：轻轻落下
    [1047,784,523].forEach((f,i)=> Audio7.tone({freq:f, dur:0.16, vol:0.07, type:'triangle', delay:i*0.05}));
  },
  hurt(){                        // 受伤：闷击 + 刺耳下滑
    Audio7.tone({freq:420, to:80, dur:0.3, vol:0.22, type:'sawtooth'});
    Audio7.tone({freq:110, to:52, dur:0.3, vol:0.16, type:'square'});
    Audio7.noise({dur:0.18, vol:0.16, f:900, f2:120, type:'lowpass'});
  },
  lowHp(){                       // 低血：两声心跳
    Audio7.tone({freq:70, to:48, dur:0.16, vol:0.20, type:'sine'});
    Audio7.tone({freq:66, to:44, dur:0.16, vol:0.16, type:'sine', delay:0.22});
  },
  star(){                        // 星辉
    Audio7.tone({freq:1180, dur:0.08, vol:0.12, type:'triangle'});
    Audio7.tone({freq:1760, dur:0.12, vol:0.10, type:'triangle', delay:0.05});
  },
  crystal(){                     // 微光
    Audio7.tone({freq:1420, dur:0.05, vol:0.08, type:'triangle'});
    Audio7.tone({freq:1980, dur:0.07, vol:0.06, type:'triangle', delay:0.025});
  },
  cup(){                         // 茶杯
    Audio7.tone({freq:1320, dur:0.07, vol:0.10, type:'triangle'});
    Audio7.tone({freq:1760, dur:0.09, vol:0.08, type:'triangle', delay:0.05});
  },
  levelUp(){                     // 射击升级
    [659,880,1319].forEach((f,i)=> Audio7.tone({freq:f, dur:0.18, vol:0.14, type:'square', delay:i*0.08}));
    Audio7.noise({dur:0.3, vol:0.06, f:4200, type:'highpass', delay:0.1});
  },
  /* ---------- 敌人 ---------- */
  impCry(){                      // 蓝翼夜怪：尖细吱声
    Audio7.tone({freq:520, to:320, dur:0.12, vol:0.07, type:'sawtooth', detune:30});
  },
  fishSplash(){                  // 雾鳍飞鱼：水花
    Audio7.noise({dur:0.22, vol:0.10, f:1400, f2:400, type:'bandpass'});
  },
  batFlap(){                     // 暮影蝠：两下拍翅
    Audio7.noise({dur:0.07, vol:0.09, f:320, f2:120, type:'lowpass'});
    Audio7.noise({dur:0.07, vol:0.07, f:300, f2:110, type:'lowpass', delay:0.11});
  },
  headPuff(){                    // 桥洞雾怪：鼓腮
    Audio7.tone({freq:180, to:90, dur:0.2, vol:0.09, type:'sine'});
    Audio7.noise({dur:0.18, vol:0.06, f:700, f2:300, type:'lowpass', delay:0.04});
  },
  carrierGulp(){                 // 吞光灯怪：吞咽
    Audio7.tone({freq:300, to:70, dur:0.26, vol:0.11, type:'triangle'});
    Audio7.noise({dur:0.2, vol:0.06, f:500, f2:160, type:'lowpass', delay:0.06});
  },
  enemyShot(){                   // 敌方开火
    Audio7.tone({freq:560, to:280, dur:0.09, vol:0.09, type:'square'});
    Audio7.tone({freq:280, to:140, dur:0.1, vol:0.05, type:'triangle', detune:-10});
  },
  enemyHit(){                    // 打中普通怪
    Audio7.noise({dur:0.06, vol:0.12, f:2400, type:'highpass'});
    Audio7.tone({freq:620, to:420, dur:0.05, vol:0.06, type:'square'});
  },
  enemyDie(){                    // 击破普通怪
    Audio7.noise({dur:0.22, vol:0.16, f:1800, f2:200, type:'lowpass'});
    Audio7.tone({freq:420, to:150, dur:0.2, vol:0.08, type:'sawtooth'});
  },
  fearPuff(){                    // 吞光灯怪受惊吐雾
    Audio7.noise({dur:0.3, vol:0.14, f:900, f2:260, type:'lowpass'});
    Audio7.tone({freq:260, to:520, dur:0.24, vol:0.07, type:'triangle'});
  },
  /* ---------- Boss ---------- */
  bossRoar(){                    // 入场低吼
    Audio7.tone({freq:70, to:44, dur:0.9, vol:0.22, type:'sawtooth', detune:-20});
    Audio7.tone({freq:105, to:62, dur:0.8, vol:0.12, type:'square', detune:18});
    Audio7.noise({dur:0.9, vol:0.14, f:420, f2:110, type:'lowpass'});
  },
  bossWall(){                    // 夜雾横推
    Audio7.noise({dur:0.7, vol:0.16, f:600, f2:220, type:'lowpass'});
    Audio7.tone({freq:88, to:60, dur:0.7, vol:0.12, type:'sawtooth'});
  },
  bossBreath(){                  // 吞光吐息
    Audio7.noise({dur:1.2, vol:0.22, f:2600, f2:600, type:'bandpass'});
    Audio7.tone({freq:150, to:90, dur:1.1, vol:0.10, type:'sawtooth', detune:-14});
  },
  bossOrb(){                     // 追光雾球
    Audio7.tone({freq:760, to:300, dur:0.3, vol:0.09, type:'triangle'});
  },
  charge(){                      // 通用蓄力 / 预兆
    Audio7.tone({freq:300, to:760, dur:0.26, vol:0.06, type:'sine'});
  },
  bossCharge(){                  // 扑灯冲撞
    Audio7.noise({dur:0.5, vol:0.18, f:1800, f2:400, type:'bandpass'});
    Audio7.tone({freq:64, to:40, dur:0.6, vol:0.2, type:'sine'});
  },
  bossHalf(){                    // 半血转换：下沉和弦 + 爆散
    [392,311,233,175].forEach((f,i)=> Audio7.tone({freq:f, dur:0.5, vol:0.12, type:'sawtooth', delay:i*0.09}));
    Audio7.noise({dur:0.8, vol:0.18, f:1400, f2:160, type:'lowpass', delay:0.1});
  },
  bossWeak(){                    // 弱点暴露
    [784,1047,1319,1568].forEach((f,i)=> Audio7.tone({freq:f, dur:0.14, vol:0.08, type:'triangle', delay:i*0.05}));
  },
  bossBreak(){                   // 终 Boss 击破：长尾爆炸
    Audio7.tone({freq:110, to:30, dur:1.1, vol:0.26, type:'sawtooth'});
    Audio7.noise({dur:1.2, vol:0.34, f:2600, f2:60, type:'lowpass'});
    Audio7.noise({dur:0.5, vol:0.14, f:5200, f2:1200, type:'highpass', delay:0.05});
  },
  boom(){
    Audio7.noise({dur:0.38, vol:0.28, f:1400, f2:90, type:'lowpass'});
    Audio7.tone({freq:180, to:44, dur:0.35, vol:0.16, type:'triangle'});
  },
  bigBoom(){
    Audio7.noise({dur:0.85, vol:0.40, f:2000, f2:60, type:'lowpass'});
    Audio7.tone({freq:120, to:32, dur:0.8, vol:0.22, type:'sawtooth'});
  },
  hit(){ Audio7.noise({dur:0.06, vol:0.13, f:2200, type:'highpass'}); },
  warn(){ [880,880].forEach((f,i)=> Audio7.tone({freq:f, dur:0.16, vol:0.2, type:'square', delay:i*0.22})); },
  bomb(){
    Audio7.tone({freq:1200, to:200, dur:0.5, vol:0.2, type:'square'});
    Audio7.noise({dur:0.6, vol:0.3, f:1600, f2:70, type:'lowpass'});
  },
  /* ---------- 流程 ---------- */
  phaseChange(){                 // 换阶段
    Audio7.tone({freq:392, to:587, dur:0.4, vol:0.09, type:'triangle'});
    Audio7.noise({dur:0.5, vol:0.05, f:1200, f2:2600, type:'highpass'});
  },
  win(){                         // 胜利号角（AI 短曲未就绪时的合成版）
    [523,659,784,1047].forEach((f,i)=> Audio7.tone({freq:f, dur:0.26, vol:0.16, type:'triangle', delay:i*0.12}));
    [523,784,1047].forEach((f)=> Audio7.tone({freq:f, dur:0.7, vol:0.12, type:'triangle', delay:0.5}));
  },
  lose(){                        // 失败收尾
    [523,466,392,311].forEach((f,i)=> Audio7.tone({freq:f, dur:0.4, vol:0.15, type:'triangle', delay:i*0.18}));
    Audio7.tone({freq:262, dur:0.9, vol:0.10, type:'sine', delay:0.72});
  }
};

/* ---- v1.12e 音效音量归一 ----
   实测（master 输出后的峰值）：背景乐峰值 0.833×0.34≈0.28，而音效原本只有 0.002~0.11。
   这里把 sfxGain 抬到 4.0，再按「峰值拉到 0.36 左右」逐个补系数（clamp 0.42~3.0），
   让所有音效落在同一量级，并且在有背景乐的情况下还听得清。
   系数由测量得出，改音效内容后重跑 tools/measure_sfx.py 复算即可。 */
const SFX_TRIM = {
  "shoot":1.201, "shootBig":1.21, "magicFire":0.926, "fireTick":3.93, "magicThunder":0.506, "magicBurst":0.19,
  "magicStar":1.473, "fever":0.733, "feverEnd":2.0, "hurt":0.424, "lowHp":0.969, "star":1.305,
  "crystal":2.013, "cup":1.074, "levelUp":1.049, "impCry":2.529, "fishSplash":3.543, "batFlap":12.0,
  "headPuff":1.737, "carrierGulp":1.446, "enemyShot":1.145, "enemyHit":1.066, "enemyDie":1.377, "fearPuff":1.45,
  "bossRoar":0.497, "bossWall":1.236, "bossBreath":0.697, "bossOrb":1.713, "charge":2.61, "bossCharge":0.669,
  "bossHalf":0.804, "bossWeak":1.926, "bossBreak":0.363, "boom":0.644, "bigBoom":0.45, "hit":1.089,
  "warn":0.761, "bomb":0.515, "phaseChange":1.224, "win":0.45, "lose":0.95};
(function normalizeSfx(){
  Object.keys(SFX_TRIM).forEach(function(k){
    const f = SFX[k];
    if(typeof f !== 'function') return;
    const g = SFX_TRIM[k];
    SFX[k] = function(){
      const prev = Audio7.sfxK;
      Audio7.sfxK = g;
      try { return f.apply(SFX, arguments); }
      finally { Audio7.sfxK = prev; }
    };
  });
})();

/* ---- 音效试听面板（?audio=1）----
   直接听：不依赖对局状态。带一个电平表，能看出「到底有没有声」。
   绽放循环乐用 StarLoop 的 demo 模式（不受 bloomT 约束）。 */
function initAudioTest(){
  if(document.getElementById('audioTest')) return;
  const wrap = document.createElement('div');
  wrap.id = 'audioTest';
  wrap.style.cssText = [
    'position:fixed','left:10px','top:10px','z-index:99999',
    'padding:10px 12px','border-radius:10px',
    'background:rgba(12,8,24,0.88)','border:1px solid rgba(160,138,200,0.45)',
    'font:12px/1.5 system-ui,sans-serif','color:#E8DEF8',
    'box-shadow:0 8px 30px rgba(0,0,0,0.5)','max-width:260px'
  ].join(';');
  const row = (label, fn, id) => {
    const b = document.createElement('button');
    b.textContent = label;
    if(id) b.id = id;
    b.style.cssText = 'margin:2px 4px 2px 0;padding:4px 8px;border-radius:6px;cursor:pointer;' +
                      'background:#2A1E44;color:#EADFFF;border:1px solid rgba(170,150,220,0.5);font:12px system-ui';
    b.onclick = () => { Audio7.init(); Audio7.resume(); fn(); };
    wrap.appendChild(b);
    return b;
  };
  const title = document.createElement('div');
  title.textContent = '音效试听（?audio=1）';
  title.style.cssText = 'font-weight:700;color:#FFD98A;margin-bottom:6px';
  wrap.appendChild(title);

  /* 电平表 */
  const meter = document.createElement('div');
  meter.style.cssText = 'height:8px;border-radius:4px;background:#241a38;overflow:hidden;margin-bottom:8px';
  const bar = document.createElement('div');
  bar.style.cssText = 'height:100%;width:0%;background:linear-gradient(90deg,#6BD3A0,#FFD98A)';
  meter.appendChild(bar); wrap.appendChild(meter);

  /* 按钮 */
  let starBtn = null;
  starBtn = row('播放/停止 绽放循环乐', function(){
    if(StarLoop.running && StarLoop.demo){ StarLoop.stop(); }
    else { StarLoop.start(true); duckBgm(0.40); }
    starBtn.textContent = (StarLoop.running && StarLoop.demo) ? '停止 绽放循环乐' : '播放 绽放循环乐';
  });
  row('炉火', () => SFX.magicFire());
  row('火焰命中', () => SFX.fireTick());
  row('射击 L1', () => SFX.shoot());
  row('射击 L3', () => SFX.shootBig());
  row('绽放开启音', () => SFX.fever());
  row('受击', () => SFX.hurt());
  row('Boss 怒吼', () => SFX.bossRoar());
  row('Boss 弱点', () => SFX.bossWeak());
  row('击破', () => SFX.enemyDie());
  row('过关', () => SFX.win());

  /* 总音量 */
  const vr = document.createElement('div');
  vr.style.cssText = 'margin-top:8px;display:flex;align-items:center;gap:6px';
  vr.innerHTML = '<span>总音量</span>';
  const slider = document.createElement('input');
  slider.type = 'range'; slider.min = '0'; slider.max = '100'; slider.value = '50';
  slider.style.cssText = 'flex:1';
  slider.oninput = function(){
    Audio7.init();
    if(Audio7.master) Audio7.master.gain.value = slider.value / 100;
  };
  vr.appendChild(slider); wrap.appendChild(vr);

  const tip = document.createElement('div');
  tip.textContent = '如果电平表在跳但听不到：先点一下页面，再看系统/标签页是否静音。';
  tip.style.cssText = 'margin-top:6px;color:#9C8FB8;font-size:11px';
  wrap.appendChild(tip);
  document.body.appendChild(wrap);

  /* 电平表刷新 */
  let an = null, buf = null;
  const pump = function(){
    if(Audio7.ac && !an){
      an = Audio7.ac.createAnalyser(); an.fftSize = 512;
      Audio7.master.connect(an);
      buf = new Float32Array(an.fftSize);
    }
    if(an){
      an.getFloatTimeDomainData(buf);
      let mx = 0;
      for(let i = 0; i < buf.length; i++){ const v = Math.abs(buf[i]); if(v > mx) mx = v; }
      bar.style.width = Math.min(100, Math.round(mx * 320)) + '%';
    }
    requestAnimationFrame(pump);
  };
  pump();
}



/* ---- 芯片音乐（A 小调万圣节循环）---- */
function nf(m){ return 440 * Math.pow(2,(m-69)/12); }
const MEL_NORMAL = [
  69,null,72,null,76,null,75,null, 72,null,71,null,69,null,null,null,
  68,null,71,null,74,null,72,null, 71,null,69,null,68,null,null,null,
  69,null,72,null,76,null,77,null, 76,null,72,null,71,null,null,null,
  64,null,67,null,71,null,72,null, 71,null,67,null,64,null,null,null
];
const MEL_BOSS = [
  69,72,76,72,69,72,76,79, 77,76,72,76,77,79,81,79,
  76,72,69,72,76,79,76,72, 71,68,64,68,71,74,77,80,
  69,72,76,72,69,72,76,79, 84,83,81,79,77,76,74,72,
  71,74,77,74,71,74,77,80, 79,77,74,71,68,67,65,64
];
const BASS_NORMAL = [
  45,null,null,null,45,null,null,null, 41,null,null,null,41,null,null,null,
  40,null,null,null,40,null,null,null, 40,null,null,null,40,null,null,null,
  45,null,null,null,45,null,null,null, 43,null,null,null,43,null,null,null,
  40,null,null,null,40,null,null,null, 40,null,null,null,40,null,null,null
];
const BASS_BOSS = [
  45,45,null,45,45,null,45,null, 41,41,null,41,41,null,41,null,
  43,43,null,43,43,null,43,null, 40,40,null,40,40,null,40,null,
  45,45,null,45,45,null,45,null, 48,48,null,48,48,null,48,null,
  44,44,null,44,44,null,44,null, 40,40,null,40,40,null,40,null
];
function scheduleMusic(){
  const A = Audio7;
  if(!A.ac) return;
  const spb = 60/ (A.mode==='boss' ? 152 : 132) / 4; // 16分音符
  while(A.nextNoteTime < A.ac.currentTime + 0.12){
    const s = A.step % 64;
    const mel = A.mode==='boss' ? MEL_BOSS : MEL_NORMAL;
    const bas = A.mode==='boss' ? BASS_BOSS : BASS_NORMAL;
    const m = mel[s];
    if(m!==null && m!==undefined){
      A.tone({freq:nf(m+12), dur:spb*1.7, vol:0.09, type:'square', delay:A.nextNoteTime-A.ac.currentTime, bus:A.musicGain});
    }
    const b = bas[s];
    if(b!==null && b!==undefined){
      A.tone({freq:nf(b), dur:spb*1.9, vol:0.13, type:'triangle', delay:A.nextNoteTime-A.ac.currentTime, bus:A.musicGain});
    }
    if(s%4===0) A.noise({dur:0.06, vol:0.055, f:6000, type:'highpass', delay:A.nextNoteTime-A.ac.currentTime, bus:A.musicGain});
    if(s%8===0) A.noise({dur:0.13, vol:0.16, f:220, f2:60, type:'lowpass', delay:A.nextNoteTime-A.ac.currentTime, bus:A.musicGain});
    A.nextNoteTime += spb;
    A.step++;
  }
}
let musicTimer = null;
function startSynthMusic(){
  if(!Audio7.ac) return;
  Audio7.nextNoteTime = Audio7.ac.currentTime + 0.06;
  Audio7.step = 0;
  if(!musicTimer) musicTimer = setInterval(scheduleMusic, 25);
}
/* ============================ v1.2.0 HUD（DOM 版） ============================
   全部数值写进 DOM，不再用 canvas 画 HUD。只在值变化时改 DOM，避免每帧重排。 */
const HEART_SRC = '@@ART_icons/heart@@';
const HUD = { el:null, hearts:null, cache:{} };

function hudInit(){
  HUD.el = document.getElementById('hud');
  HUD.hearts = document.getElementById('hudHearts');
  HUD.cache = {};
  if(HUD.hearts && !HUD.hearts.dataset.built){
    /* 心形图标：生成的 heart.png，空心用同一个图降低透明度 */
    let html = '';
    for(let i = 0; i < player.maxHp; i++){
      html += '<img src="' + HEART_SRC + '" alt="">';
    }
    HUD.hearts.innerHTML = html;
    HUD.hearts.dataset.built = '1';
  }
}

function hudSet(id, value){
  if(HUD.cache[id] === value) return;
  HUD.cache[id] = value;
  const el = document.getElementById(id);
  if(el) el.textContent = value;
}

function hudWidth(id, pct){
  const key = id + ':w';
  const v = Math.round(pct * 1000) / 10;
  if(HUD.cache[key] === v) return;
  HUD.cache[key] = v;
  const el = document.getElementById(id);
  if(el) el.style.width = v + '%';
}

function syncHud(){
  if(!HUD.el) hudInit();
  if(!HUD.el) return;

  /* 生命心 */
  if(HUD.hearts && HUD.hearts.children.length){
    for(let i = 0; i < HUD.hearts.children.length; i++){
      HUD.hearts.children[i].classList.toggle('off', i >= player.hp);
    }
  }
  /* 射击等级 + 成长条 */
  hudSet('hudShotLv', 'L' + player.shotLv);
  /* v1.3.1：到顶就是满级，成长条填满（原来 L3 的 need 与 prev 相同，算出 0%） */
  const topLv = SHOT_LV.length;
  if(player.shotLv >= topLv){
    hudWidth('hudGrow', 1);
  } else {
    const need = SHOT_LV[Math.min(player.shotLv, topLv - 1)].need;
    const prev = SHOT_LV[Math.max(0, player.shotLv - 1)].need;
    const span = Math.max(1, need - prev);
    hudWidth('hudGrow', clamp((player.grow - prev) / span, 0, 1));
  }

  /* R06：萤火归途时，顶部最重要的信息是「已接取 / 总数」，时间退到次要 */
  if(game.teaTime){
    hudSet('hudStage', '萤火 ' + game.fireflies + ' / ' + FLY_N);
  } else {
    /* 阶段 + 时间：Boss 段的阶段名和 Boss 名会撞（PH05 阶段名就叫「湖边大夜怪」），
       这时上行只留时间，名字交给下面那行。 */
    const bossOn = !!(boss && game.bossActive && boss.hp > 0);
    hudSet('hudStage', bossOn ? '' : (PHASE_TABLE[game.phase] ? PHASE_TABLE[game.phase].cn : ''));
  }
  /* v1.3.1：分钟也补两位，统一 00:10 / 01:05 */
  const sec = Math.floor(game.elapsed);
  const mm = Math.floor(sec / 60), ss = sec % 60;
  hudSet('hudTime', (mm < 10 ? '0' : '') + mm + ':' + (ss < 10 ? '0' : '') + ss);

  /* Boss */
  const bw = document.getElementById('hudBoss');
  placeToast();
  if(bw){
    const on = !!(boss && game.bossActive && boss.hp > 0);
    bw.classList.toggle('on', on);
    /* v1.3.1：中 Boss 没有三阶段，不显示刻度；终 Boss 用真实阈值 35% / 70% */
    const isB2 = !!(on && boss && boss.id === 'b2');
    const ta = document.getElementById('tickA'), tb = document.getElementById('tickB');
    if(ta) ta.style.display = isB2 ? '' : 'none';
    if(tb) tb.style.display = isB2 ? '' : 'none';
    if(on){
      hudSet('hudBossName', boss.id === 'b1' ? '打盹的夜团' : '湖边大夜怪');
      hudWidth('hudBossHp', clamp(boss.hp / boss.maxhp, 0, 1));
      if(boss.id === 'b2'){
        hudSet('hudBossPhase', B2_PHASE_NAME[Math.min(3, boss.ph) - 1]);
      } else {
        hudSet('hudBossPhase', '');
      }
    }
  }
  /* 分数 */
  hudSet('hudScore', String(game.score));

  /* R06：归途阶段技能不可用，整组收起，避免玩家继续盯 0/3 与绽放 */
  const ui = document.getElementById('touchUI');
  if(ui) ui.classList.toggle('tea', !!game.teaTime);
  /* 技能键 */
  syncSkillBtns();
}

/* 炉火 / 绽放按钮：图标状态、数值、绽放内嵌进度条与四种状态 */
function syncSkillBtns(){
  const subF = document.getElementById('subMagic');
  const subB = document.getElementById('subBloom');
  const bar  = document.getElementById('bloomBar');
  const wrap = bar ? bar.parentElement : null;

  if(subF) subF.textContent = player.fireAmmo + '/' + FIRE_MAX;

  if(!subB) return;
  let txt = '0%', pct = 0, mode = 'idle';
  if(player.bloomT > 0){
    /* 开启中：同一条切换成剩余时间 */
    mode = 'run';
    pct = clamp(player.bloomT / BLOOM_T, 0, 1);
    txt = player.bloomT.toFixed(1) + '秒';   /* R01：单行，不换行、不顶到键帽 */
  } else if(player.bloom >= 100){
    mode = 'full';
    pct = 1;
    txt = '就绪';
  } else {
    pct = clamp(player.bloom / 100, 0, 1);
    txt = Math.floor(player.bloom) + '%';
  }
  if(subB.dataset.mode !== mode){
    subB.dataset.mode = mode;
    subB.classList.toggle('ready', mode === 'full');
  }
  if(subB.textContent !== txt) subB.textContent = txt;
  if(wrap){
    wrap.classList.toggle('full', mode === 'full');
    wrap.classList.toggle('run', mode === 'run');
  }
  if(bar) bar.style.width = (pct * 100).toFixed(1) + '%';
}

/* 提示条位置：Boss 在场时下面多出「名字 + 血条 + 阶段名」三层，
   顶部提示必须让开，否则 R05 那句「第二阶段 · 逐灯」正好压在自己的血条上。
   只在位置真的变了时写 style，避免每帧触发重排。 */
function placeToast(){
  const tEl = document.getElementById('toast');
  if(!tEl) return;
  const bossOn = !!(boss && game.bossActive && boss.hp > 0);
  const v = bossOn ? (coarsePointer ? '23%' : '17.6%')
                   : (coarsePointer ? '15.6%' : '11.5%');
  if(tEl.style.top !== v) tEl.style.top = v;
}

function startMusic(){
  Audio7.init();
  if(Audio7.ac) Audio7.resume();
  /* 有生成好的 mp3 就用它；没有（或被浏览器拦下）再走芯片合成 */
  if(BGM.play(Audio7.mode === 'boss' ? 'boss' : 'normal')) return;
  startSynthMusic();
}
function stopMusic(){
  BGM.stop();
  if(musicTimer){ clearInterval(musicTimer); musicTimer = null; }
}
/* Boss 入场 / 击破时换曲；普通段与 Boss 段都只换曲不重开整关 */
function setMusicMode(m){
  if(Audio7.mode === m) return;
  Audio7.mode = m;
  if(game.state === 'play'){
    stopMusic();
    startMusic();
  }
}

/* ============================ 5. 输入 ============================ */
/* 策划案 2.2 / 16.2：键盘 WASD；触屏用二维相对摇杆 + 三个独立技能触点。
   两套输入共用同一份语义输入（ax / ay / 施法 / 切换 / 绽放），
   战斗逻辑不区分来源，暂停与恢复统一清空。 */

/* 触屏判定：粗指针，或 ?touch=1 强制（用于桌面录制与自检）。
   必须在任何顶层 input 代码之前确定，后面 updatePlayer / HUD 都要读它。 */
let coarsePointer = false;
/* v1.3.1 §6：设备布局与输入能力分离 —— 有触摸不等于要手机布局。
   触屏笔记本 / 触屏一体机（宽 ≥1200 或短边 ≥900）仍走桌面布局 + 键鼠；
   手机、平板（如 1024×768）走触控布局。?touch=1 / ?touch=0 可强制覆盖。 */
function detectCoarsePointer(){
  try {
    const q = new URLSearchParams(location.search || '');
    const forced = q.get('touch');
    if(forced === '1') return true;
    if(forced === '0') return false;
    const touchCapable = window.matchMedia('(pointer: coarse)').matches
      || window.matchMedia('(any-pointer: coarse)').matches
      || (navigator.maxTouchPoints || 0) > 0;
    if(!touchCapable) return false;
    /* v1.12.0（D04）：不再用分辨率推断「有键盘」。
       1366×1024 的纯触控平板以前会被判成桌面，结果没有摇杆、没有自动连射。
       现在只要设备具备粗指针/触点就走触控布局；想用键鼠请用 ?touch=0 覆盖。 */
    return true;
  } catch(e){ return false; }
}
coarsePointer = detectCoarsePointer();

const Keys = {};
const Input = {
  magicPressed:false,       // Z / 施法触点 边沿
  feverPressed:false,       // E / K / 绽放触点 边沿
  cyclePressed:false,       // Q / 切换触点 边沿
  selectMagic:-1,           // 1–4：直选魔法
  pointerY:null, usingPointer:false,
  /* 二维相对摇杆（16.2）：-1..1 的归一化位移，死区内为 0 */
  stickX:0, stickY:0, stickOn:false
};

/* 统一清空：暂停、恢复、失焦、隐藏、旋转都走这里。
   清掉的不是按键状态，而是「这一帧的意图」——恢复后必须重新按/重新触碰。 */
function clearInputs(){
  for(const k in Keys) Keys[k] = false;
  Input.magicPressed = false;
  Input.feverPressed = false;
  Input.cyclePressed = false;
  Input.selectMagic = -1;
  Input.pointerY = null;
  Input.usingPointer = false;
  Input.stickX = 0; Input.stickY = 0; Input.stickOn = false;
  stickReset();
  clearTouchBtns();               // 技能按钮的候选指针一起作废（WB09）
}

/* R 的「重新开始」要连按两次才生效：R 就在 E 右边一格，手滑一下就把整局清空太难接受。
   第一次按只记时间戳并提示，2 秒内再按一次才真的重开。 */
let restartArmedAt = 0;
const RESTART_WINDOW = 2000;      // 毫秒

function axisX(){
  if(Input.stickOn) return Input.stickX;
  let v = 0;
  if(Keys['a'] || Keys['arrowleft'])  v -= 1;
  if(Keys['d'] || Keys['arrowright']) v += 1;
  return v;
}
function axisY(){
  if(Input.stickOn) return Input.stickY;
  let v = 0;
  if(Keys['w'] || Keys['arrowup'])   v -= 1;
  if(Keys['s'] || Keys['arrowdown']) v += 1;
  return v;
}
function keyShoot(){ return !!Keys[' '] || !!Keys['j']; }

window.addEventListener('keydown', function(e){
  const k = e.key.toLowerCase();
  /* 焦点在按钮上时不要在 window 层吞掉空格 / 回车：
     浏览器要用它激活按钮（「本局详情」展开、按钮点击），
     否则结算页按空格会直接重开，把详情顶掉。 */
  const onBtn = document.activeElement &&
                document.activeElement.tagName === 'BUTTON';
  if(onBtn && (k === ' ' || k === 'enter')) return;
  /* 全服名册是只读浮层：开着的时候只认 Esc（关掉它），
     否则空格会顺着下面「标题/结算页空格=开局」的分支，把玩家直接拖进下一局 */
  if(rankScreenOpen()){
    if(k === 'escape') closeRank();
    e.preventDefault();
    return;
  }
  if(['arrowup','arrowdown','arrowleft','arrowright',' ','w','a','s','d','z','q','e','k','j','1','2','3','4','f1','`'].indexOf(k) >= 0) e.preventDefault();
  if(e.repeat) return;
  Keys[k] = true;

  if(k === ' ' || k === 'enter'){
    const now = performance.now();
    if(game.state === 'title'){
      /* 刚回到标题时锁 0.35 秒：不然狂按空格射击的玩家会一路「射→死→回标题→重开」自动连开 */
      if(now - (game.titleAt || 0) > 350) startGame();
      return;
    }
    if(game.state === 'pause'){ resumeGame(); return; }
    if(game.state === 'lose'){
      /* 新版失败页：空格 = 再试一次（不是回主页）。
         回主页在「本局详情」里，避免误触。 */
      if(now - (game.endAt || 0) > 700) startGame();
      return;
    }
    if(game.state === 'win'){
      /* 胜利页的按钮写「再来一次」，空格就走同一条路（原先回主页，与文案不符） */
      if(now - (game.endAt || 0) > 700) startGame();
      return;
    }
  }
  if(game.state === 'play'){
    if(k === 'z') Input.magicPressed = true;
    if(k === 'e' || k === 'k') Input.feverPressed = true;
    /* v1.3.1：1–4 直选魔法已取消（只有炉火），按键不再写入 selectMagic */
  }
  if(k === 'p' || k === 'escape'){
    if(game.state === 'play'){ pauseGame(); }
    else if(game.state === 'pause'){
      /* v1.3.1：子视图里的 Esc 只回上一层，不直接恢复游戏 */
      if(!document.getElementById('pzConfirm').hidden){ closePauseConfirm(); }
      else if(!document.getElementById('pzHelp').hidden){ showPauseHelp(false); }
      else { resumeGame(); }
    }
  }
  /* v1.3.1 §4.5：暂停时 Tab 只在当前视图里循环（主菜单 / 说明 / 确认各一组） */
  if(k === 'tab' && game.state === 'pause'){
    trapPauseTab(e.shiftKey);
    return;
  }
  if(k === 'm'){ setMuted(!Audio7.muted); }
  if(k === 'r' && (game.state === 'play' || game.state === 'pause')){
    const now = performance.now();
    if(restartArmedAt && now - restartArmedAt < RESTART_WINDOW){
      restartArmedAt = 0;
      startGame();
    } else {
      restartArmedAt = now;
      flashMsg('再按一次 R 重新开始');
    }
  }
  if(k === 'f'){ toggleFullscreen(); }
  if(k === 'f1' || k === '`'){
    game.dbg = !game.dbg;
    flashMsg(game.dbg ? '调试：青=受伤 红=受弹 绿=拾取 蓝=爆裂 灰=立绘框'
                      : '调试关闭');
  }
  Audio7.init(); Audio7.resume();
  Input.usingPointer = false;
  Input.stickOn = false;
});
window.addEventListener('keyup', function(e){ Keys[e.key.toLowerCase()] = false; });

/* 失焦 = 暂停（16.8）：只清键位不够，游戏还在跑。
   visibilitychange 处理切标签页 / 锁屏，blur 处理切窗口 / 点开别的应用。 */
window.addEventListener('blur', function(){
  clearInputs();
  if(game.state === 'play') pauseGame();
});
document.addEventListener('visibilitychange', function(){
  if(document.hidden){
    clearInputs();
    if(game.state === 'play') pauseGame();
  }
});

/* 触控/鼠标：画布拖拽仍作为高度兜底（桌面鼠标），触屏改走下面的摇杆 */
function ptrPos(e){
  const r = cv.getBoundingClientRect();
  const cy = e.touches ? e.touches[0].clientY : e.clientY;
  return (cy - r.top) / r.height * H;
}
cv.addEventListener('mousedown', function(e){
  if(coarsePointer) return;
  Input.usingPointer = true; Input.pointerY = ptrPos(e);
});
cv.addEventListener('mousemove', function(e){ if(Input.usingPointer) Input.pointerY = ptrPos(e); });
window.addEventListener('mouseup', function(){ Input.usingPointer = false; });

/* ==================== 16.2 二维相对摇杆 ====================
   手指按下处即圆心（相对摇杆，不是固定圆盘），之后的位移映射成 -1..1。
   死区 0.14 并把死区外的行程重新映射到 0..1，轻推也走得出慢速。 */
const stickZone = document.getElementById('stickZone');
const stickBase = document.getElementById('stickBase');
const stickKnob = document.getElementById('stickKnob');
const touchUI   = document.getElementById('touchUI');
/* 死区按档位给绝对像素（手机 4 / 平板 6），再换算成半径比例（WB08） */
function stickDeadRatio(){
  const r = stickRadius();
  const px = (r >= 36) ? 6 : 4;
  return Math.max(0.04, Math.min(0.30, px / Math.max(1, r)));
}
let stickId = null, stickX0 = 0, stickY0 = 0;

function stickRadius(){
  /* 直接读摇杆圆盘的实际尺寸，CSS 改基准时这里不用跟着改 */
  const w = stickBase ? stickBase.offsetWidth : 0;
  return w > 0 ? w * 0.5 : 52;
}
function stickReset(){
  stickId = null;
  if(stickKnob) stickKnob.style.transform = 'translate(0px,0px)';
  if(stickBase) stickBase.classList.remove('on');
  if(touchUI) touchUI.classList.remove('stickOn');
}
function stickOrigin(cx, cy){
  const sr = document.getElementById('stage').getBoundingClientRect();
  /* WB08：圆盘原点要避开战斗核心（含左右预留带），手指坐标仍然按真实按下点算，
     位移方向不变 —— 只是把「显示出来的圆心」挪到核心外的预留带里，
     不挡角色、不挡子弹。 */
  const p = stickClampOrigin(cx - sr.left, cy - sr.top);
  stickBase.style.left = p.x + 'px';
  stickBase.style.top  = p.y + 'px';
}

/* WB08：战斗核心（16:9 contain 之后）在屏幕上的矩形。控件原点不得落进它。 */
function coreRectCSS(){
  const vp = document.getElementById('viewport');
  if(!vp) return null;
  const r = vp.getBoundingClientRect();
  if(!(r.width > 8 && r.height > 8)) return null;
  return { x0: r.left, y0: r.top, x1: r.right, y1: r.bottom, w: r.width, h: r.height };
}

/* WB08：短边 600 分「手机 / 平板」两档（策划 16.3–16.5）。
   两档的战斗核心都是 16:9 contain，差别在**防遮挡预留**：
   手机右侧要给技能列、左下要给摇杆，预留得多；平板按键更大但屏也大，比例可以小一点。
   预留值用核心尺寸的比例算，换分辨率时自己跟着走。 */
function deviceTier(){
  const r = viewRect();
  return (Math.min(r.w, r.h) >= 600) ? 'tablet' : 'phone';
}
function reserveCSS(){
  const c = coreRectCSS();
  if(!c) return null;
  return (deviceTier() === 'tablet')
    ? { left: c.w * 0.10, right: c.w * 0.16, bottom: c.h * 0.10 }
    : { left: c.w * 0.12, right: c.w * 0.22, bottom: c.h * 0.14 };
}

/* 摇杆圆盘原点：优先落在战斗核心左侧的预留带里（宽屏多出来的那条），
   核心占满整屏时退回竖直方向的下缘预留带；两向都没有余量（正好 16:9）
   就夹在核心左侧四分之一以内，至少不压中间的目标区。 */
function stickClampOrigin(bx, by){
  const sr = document.getElementById('stage').getBoundingClientRect();
  const c = coreRectCSS();
  if(!c) return { x: bx, y: by };
  const r  = stickRadius();
  const cxl = c.x0 - sr.left, cxr = c.x1 - sr.left;
  const cyt = c.y0 - sr.top,  cyb = c.y1 - sr.top;
  if(!(bx > cxl && bx < cxr && by > cyt && by < cyb)) return { x: bx, y: by };
  const bandL = Math.max(0, cxl), bandR = Math.max(0, sr.width - cxr);
  const bandB = Math.max(0, sr.height - cyb);
  /* 两档防遮挡预留：手机左侧留 12%、平板 10%（见 reserveCSS） */
  const rv = reserveCSS();
  const keepL = rv ? Math.min(c.w * 0.22, rv.left) : 0;
  if(Math.max(bandL, bandR) >= r * 1.2){
    const x = (bandL >= bandR)
      ? Math.min(cxl - r * 0.55, Math.max(r * 0.9, cxl * 0.5))
      : Math.max(cxr + r * 0.55, Math.min(sr.width - r * 0.9, cxr + bandR * 0.5));
    return { x: x, y: by };
  }
  if(bandB >= r * 1.2){
    return { x: bx, y: Math.min(sr.height - r * 0.9, cyb + r * 0.55) };
  }
  /* 正好 16:9、两向都没有黑边：夹在核心左侧的防遮挡预留带内 */
  return { x: Math.min(bx, cxl + keepL), y: by };
}
function stickApply(dx, dy){
  const MR = stickRadius();
  const m = Math.sqrt(dx*dx + dy*dy);
  if(m > MR){ dx = dx/m*MR; dy = dy/m*MR; }
  let nx = dx/MR, ny = dy/MR;
  const dz = stickDeadRatio();
  nx = Math.abs(nx) <= dz ? 0 : (nx - Math.sign(nx)*dz) / (1-dz);
  ny = Math.abs(ny) <= dz ? 0 : (ny - Math.sign(ny)*dz) / (1-dz);
  Input.stickX = nx; Input.stickY = ny;
  stickKnob.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px)';
}

if(stickZone){
  stickZone.addEventListener('pointerdown', function(e){
    e.preventDefault();
    Audio7.init(); Audio7.resume();
    if(game.state === 'title'){ startGame(); return; }
    if(game.state === 'win' || game.state === 'lose'){
      if(performance.now() - (game.endAt || 0) > 700) showTitle();
      return;
    }
    if(game.state !== 'play') return;
    if(stickId !== null) return;                 // 指针身份：只认第一根手指
    stickId = e.pointerId;
    stickX0 = e.clientX; stickY0 = e.clientY;
    stickOrigin(stickX0, stickY0);
    stickBase.classList.add('on');
    if(touchUI) touchUI.classList.add('stickOn');
    Input.stickOn = true;
    Input.stickX = 0; Input.stickY = 0;
    try { stickZone.setPointerCapture(e.pointerId); } catch(err){}
  }, {passive:false});

  stickZone.addEventListener('pointermove', function(e){
    if(stickId === null || e.pointerId !== stickId) return;
    e.preventDefault();
    stickApply(e.clientX - stickX0, e.clientY - stickY0);
  }, {passive:false});

  const endStick = function(e){
    if(stickId === null || (e && e.pointerId !== stickId)) return;
    stickReset();
    Input.stickX = 0; Input.stickY = 0; Input.stickOn = false;
  };
  stickZone.addEventListener('pointerup', endStick);
  stickZone.addEventListener('pointercancel', endStick);
  stickZone.addEventListener('lostpointercapture', endStick);
}

/* ==================== 16.3 三个技能触点 ====================
   三个触点各自独立监听，互不抢占；按下即置边沿，由 updatePlayer 消费。 */
/* WB09：触控技能改为「抬起提交、滑出取消」。
   按下只形成候选（记下 pointerId 并压态），抬起时手指仍在同一个按钮热区内才提交；
   移出热区、pointercancel、丢捕获都不施法、不扣费，也不留压态。
   每个按钮只认自己那根手指，所以移动摇杆的手指滑到技能上抬起不会误触发，
   一根手指也不可能同时切换和扣魔力；长按只在抬起时算一次。 */
const TOUCH_BTNS = [];

function clearTouchBtns(){
  for(let i=0;i<TOUCH_BTNS.length;i++){
    TOUCH_BTNS[i].pid = null;
    TOUCH_BTNS[i].el.classList.remove('down');
  }
}

function bindTouchBtn(id, act){
  const el = document.getElementById(id);
  if(!el) return;
  const rec = { el: el, pid: null, act: act };
  TOUCH_BTNS.push(rec);

  const inHot = function(e){
    const r = el.getBoundingClientRect();
    const pad = 6;                        // 热区比可见圆略放宽一点，拇指压边也认
    return e.clientX >= r.left - pad && e.clientX <= r.right + pad &&
           e.clientY >= r.top  - pad && e.clientY <= r.bottom + pad;
  };

  el.addEventListener('pointerdown', function(e){
    e.preventDefault(); e.stopPropagation();
    if(game.state !== 'play') return;
    if(rec.pid !== null) return;          // 已经有一根手指压着，第二根不重复触发
    Audio7.init(); Audio7.resume();
    rec.pid = e.pointerId;
    el.classList.add('down');
    try { el.setPointerCapture(e.pointerId); } catch(err){}
  }, {passive:false});

  const finish = function(e){
    if(e.pointerId !== rec.pid) return;
    const submit = (e.type === 'pointerup') && inHot(e);
    rec.pid = null;
    el.classList.remove('down');
    if(submit) rec.act();
  };
  el.addEventListener('pointerup', finish);
  el.addEventListener('pointercancel', finish);
  el.addEventListener('lostpointercapture', finish);
}
bindTouchBtn('btnMagic',  function(){ Input.magicPressed = true; });
bindTouchBtn('btnBloom',  function(){ Input.feverPressed = true; });

/* ==================== 16.6 / 16.8 旋转与安全区 ====================
   竖屏是唯一不可玩的姿态：自动暂停并给出横屏引导，横过来自动继续。
   面板朝向变化（120Hz 抖动、地址栏伸缩）都归一到这里判一次。 */
function isPortrait(){
  return window.innerHeight > window.innerWidth * 1.02;
}
let _rotOn = false;
function updateRotate(){
  /* WB23：#rotate 浮层已经并进 #tooSmall（见 fit 里的 gated 判定），
     这里不再自己开关面板，只保留「竖着点进来时别让游戏在背后空跑」。 */
  const on = coarsePointer && isPortrait();
  if(on === _rotOn) return;
  _rotOn = on;
  if(on && game.state === 'play') pauseGame();
}

/* 声音：默认静音，入口常显（第 1.3 节） */
function syncSoundUI(){
  const b = document.getElementById('sndBtn');
  if(b){
    b.textContent = '♪';
    /* WB15：颜色 + 斜杠 + 文案三处同时变，静音与有声不再是「一点色差」 */
    b.classList.toggle('off', Audio7.muted);
    b.setAttribute('aria-pressed', Audio7.muted ? 'false' : 'true');
    b.title = Audio7.muted ? '声音：关（点击开启）' : '声音：开（点击关闭）';
  }
  const pb = document.getElementById('btnSound');
  if(pb){
    const sp = pb.querySelector('span');
    if(sp) sp.textContent = Audio7.muted ? '声音：关' : '声音：开';
    else pb.textContent = Audio7.muted ? '声音：关' : '声音：开';
  }
}
function setMuted(m){
  Audio7.muted = !!m;
  try { localStorage.setItem('lwf_muted', Audio7.muted ? '1' : '0'); } catch(e){}
  BGM.syncMute();
  STING.syncMute();
  syncSoundUI();
  flashMsg(Audio7.muted ? '已静音' : '声音已开');
}
/* v1.2.0：默认开启声音。原来首次进入写成了 true（静音），
   玩家不点一下就没有任何音乐音效；现在只在玩家主动关过时才静音。
   localStorage 存的是玩家选择，没记录 = 开着。 */
try {
  const mv = localStorage.getItem('lwf_muted');
  Audio7.muted = (mv === '1');
} catch(e){ Audio7.muted = false; }
/* 开局就把两态同步到按钮上：原来只有点过一次才有斜杠，
   默认静音时看起来仍像「有声」 */
syncSoundUI();

(function bindUI(){
  const snd = document.getElementById('sndBtn');
  if(snd) snd.addEventListener('pointerdown', function(e){
    e.preventDefault(); e.stopPropagation();
    Audio7.init(); setMuted(!Audio7.muted); Audio7.resume();
  }, {passive:false});
  const bs = document.getElementById('btnSound');
  if(bs) bs.addEventListener('click', function(e){
    e.preventDefault(); e.stopPropagation();
    Audio7.init(); setMuted(!Audio7.muted); Audio7.resume();
  });
  const br = document.getElementById('btnResume');
  if(br) br.addEventListener('click', function(e){ e.stopPropagation(); resumeGame(); });
  /* v1.3.1：重开与返回标题都先出面板内确认，默认焦点在「取消」 */
  const bt = document.getElementById('btnRestart');
  if(bt) bt.addEventListener('click', function(e){
    e.stopPropagation();
    openPauseConfirm('restart');
  });
  const bh = document.getElementById('btnSwapHand');
  if(bh) bh.addEventListener('click', function(e){ e.stopPropagation(); swapHand(); });

  /* WB10：HUD 上的暂停热区（触屏也能主动暂停） */
  const bp = document.getElementById('btnPause');
  if(bp) bp.addEventListener('click', function(e){
    e.stopPropagation();
    Audio7.init(); Audio7.resume();
    if(game.state === 'play') pauseGame();
  });

  /* ---- 开始页 / 失败结算页（新版） ---- */
  const bStart = document.getElementById('btnStart');
  if(bStart) bStart.addEventListener('click', function(e){
    e.preventDefault(); e.stopPropagation();
    /* 这一次点击是浏览器认定的「用户手势」，是全屏请求唯一可靠的时机 */
    if(coarsePointer) enterFullscreen();
    Audio7.init(); Audio7.resume(); startGame();
  });
  const bRetry = document.getElementById('btnRetry');
  if(bRetry) bRetry.addEventListener('click', function(e){
    e.preventDefault(); e.stopPropagation();
    if(coarsePointer) enterFullscreen();
    Audio7.init(); Audio7.resume(); startGame();
  });
  /* 「本局详情」只切换折叠，绝不开始新一局 */
  const bDetail = document.getElementById('btnDetail');
  if(bDetail) bDetail.addEventListener('click', function(e){
    e.preventDefault(); e.stopPropagation();
    const det = document.getElementById('loseDetail');
    if(!det) return;
    const open = det.hidden;
    det.hidden = !open;
    bDetail.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  /* v1.2.0 暂停页：返回标题 / 全屏 */
  const bPzHome = document.getElementById('btnPzHome');
  if(bPzHome) bPzHome.addEventListener('click', function(e){
    e.preventDefault(); e.stopPropagation();
    openPauseConfirm('home');
  });

  /* 操作说明子视图：打开/返回都保持在暂停，Esc 只回暂停菜单 */
  const bh2 = document.getElementById('btnHelp');
  if(bh2) bh2.addEventListener('click', function(e){
    e.preventDefault(); e.stopPropagation();
    showPauseHelp(true);
  });
  const bhb = document.getElementById('btnHelpBack');
  if(bhb) bhb.addEventListener('click', function(e){
    e.preventDefault(); e.stopPropagation();
    showPauseHelp(false);
  });
  const bcNo = document.getElementById('btnConfirmNo');
  if(bcNo) bcNo.addEventListener('click', function(e){
    e.preventDefault(); e.stopPropagation();
    closePauseConfirm();
  });
  const bcYes = document.getElementById('btnConfirmYes');
  if(bcYes) bcYes.addEventListener('click', function(e){
    e.preventDefault(); e.stopPropagation();
    const act = _pauseConfirmAction;
    closePauseConfirm();
    clearFireWisps();
    if(act === 'home') showTitle();
    else startGame();
  });
  const bFull = document.getElementById('btnFull');
  if(bFull) bFull.addEventListener('click', function(e){
    e.preventDefault(); e.stopPropagation();
    toggleFullscreen();
  });

  const bHome = document.getElementById('btnHome');
  if(bHome) bHome.addEventListener('click', function(e){
    e.preventDefault(); e.stopPropagation();
    showTitle();
  });
  /* 胜利页：再来一次 / 详情 / 返回主页 */
  const bAgain = document.getElementById('btnAgain');
  if(bAgain) bAgain.addEventListener('click', function(e){
    e.preventDefault(); e.stopPropagation();
    Audio7.init(); Audio7.resume(); startGame();
  });
  const bWD = document.getElementById('btnWinDetail');
  if(bWD) bWD.addEventListener('click', function(e){
    e.preventDefault(); e.stopPropagation();
    const det = document.getElementById('winDetail');
    if(!det) return;
    const open = det.hidden;
    det.hidden = !open;
    bWD.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  const bWH = document.getElementById('btnWinHome');
  if(bWH) bWH.addEventListener('click', function(e){
    e.preventDefault(); e.stopPropagation();
    showTitle();
  });

  /* WB10：暂停菜单里直接改选魔法。只换当前魔法，不施法、不扣魔力，也不会恢复游戏。 */
  const grid = document.getElementById('mgGrid');
  if(grid){
    grid.addEventListener('click', function(e){
      const card = e.target && e.target.closest ? e.target.closest('.mgCard') : null;
      if(!card) return;
      e.stopPropagation();
      const idx = parseInt(card.dataset.mg, 10);
      if(isNaN(idx)) return;
      selectMagicCard(idx);
    });
  }
})();

/* 暂停页的魔法卡与当前选择同步（WB10） */
function syncMagicCards(){
  const grid = document.getElementById('mgGrid');
  if(!grid) return;
  const cards = grid.querySelectorAll('.mgCard');
  for(let i=0;i<cards.length;i++){
    cards[i].classList.toggle('sel', i === player.magic);
  }
}

/* v1.3.1：四魔法卡已从暂停页移除，这里不再允许改变当前技能。
   保留函数名给旧调用方，只做一次提示，绝不写 player.magic。 */
function selectMagicCard(idx){
  /* 旧的四魔法直选已取消：保留空实现给旧调用方，不做任何提示 */
  if(idx === 0) return;
}

/* 左右手交换（16.8）：整块 UI 镜像，选择持久化 */
function swapHand(){
  const ui = document.getElementById('touchUI');
  if(!ui) return;
  const on = !ui.classList.contains('swap');
  ui.classList.toggle('swap', on);
  try { localStorage.setItem('lwf_hand', on ? 'left' : 'right'); } catch(e){}
  flashMsg(on ? '摇杆在右手' : '摇杆在左手');
}
try {
  if(localStorage.getItem('lwf_hand') === 'left'){
    const ui = document.getElementById('touchUI');
    if(ui) ui.classList.add('swap');
  }
} catch(e){}

/* 画布点击：只负责开始 / 回标题，触控层自己的点击不再冒泡进来 */
document.getElementById('stage').addEventListener('click', function(e){
  if(e.target && e.target.closest && e.target.closest('#touchUI')) return;
  Audio7.init(); Audio7.resume();
  const now = performance.now();
  if(game.state === 'title'){ if(now - (game.titleAt || 0) > 350){ if(coarsePointer) enterFullscreen(); startGame(); } }
  /* 胜利 / 失败页点空白都不做事：重开只认主按钮与空格，
     回主页在「本局详情」里，避免手滑。 */
});

/* WB20：真全屏。手机浏览器里地址栏 / 标签栏吃掉 15~25% 的高度，
   那部分高度一丢，16:9 核心就被压成窄条、两侧补边带变宽。
   进全屏后地址栏消失，舞台就能拿到整块屏。
   注意 iOS Safari 的 iPhone 不支持 Element.requestFullscreen（只支持 video），
   那边靠 manifest/apple-mobile-web-app-capable 走「添加到主屏幕」。 */
function enterFullscreen(){
  _fitQuietUntil = Date.now() + 1600;
  try{
    const el = document.documentElement;
    const isFs = document.fullscreenElement || document.webkitFullscreenElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if(!isFs && req){
      const p = req.call(el, { navigationUI: 'hide' });
      if(p && p.catch) p.catch(function(){});
    }
    /* 横屏锁只是顺手的：桌面浏览器与 iOS 上会直接 reject，忽略即可 */
    if(screen.orientation && screen.orientation.lock){
      const q = screen.orientation.lock('landscape');
      if(q && q.catch) q.catch(function(){});
    }
  }catch(e){}
  /* 全屏切换会让可视区连跳几帧，前后都补一次 fit */
  setTimeout(fit, 60); setTimeout(fit, 260); setTimeout(fit, 600);
}

function toggleFullscreen(){
  const isFs = document.fullscreenElement || document.webkitFullscreenElement;
  if(!isFs){ enterFullscreen(); return; }
  _fitQuietUntil = Date.now() + 1200;
  try{
    const ex = document.exitFullscreen || document.webkitExitFullscreen;
    if(ex) ex.call(document);
  }catch(e){}
  setTimeout(fit, 60); setTimeout(fit, 260);
}

/* 触屏标记落到 body 上，键位说明与按钮显隐都跟着它走 */
if(coarsePointer) document.body.classList.add('touch');

/* @@SCENE_V20@@ */
/* @@SCENE_V20B@@ */
/* ============================ 6. 背景 ============================ */

const TW = 1920;          // 云层的横向循环宽度（逻辑像素）

/* ---- 6.0 背景贴图：AI 生成绘本水彩，与主角同一套笔触 ---- */
/* 源图 design/raw/sheet_sky.png、sheet_land.png；由 build_assets_v2.py 切图 */
/* @@BG_ART_BEGIN@@ */
const BG_SRC = {
/*@@ASSET_809@@*/
/*@@ASSET_810@@*/
/*@@ASSET_811@@*/
/*@@ASSET_812@@*/
/*@@ASSET_813@@*/
/*@@ASSET_814@@*/
/*@@ASSET_815@@*/
  lake_far: "@@ART_lake_far@@",
  lake_mid: "@@ART_lake_mid@@",
  /* v1.12.2（SC05/SC06）：湖岸路灯的整幅条带 —— 远山 + 石岸 + 湖面 + 旧路灯（生图合成） */
  sc05:     "@@ART_sc05@@",
/*@@ASSET_816@@*/
};
/* @@BG_ART_END@@ */

const BG_IMG = {};
(function(){
  for(const k in BG_SRC){
    (function(key){
      const im = new Image();
      im.onload = function(){
        // 贴图按 2x 设备像素准备，逻辑尺寸取一半，绘制时正好 1:1
        im.logW = im.naturalWidth  * 0.5;
        im.logH = im.naturalHeight * 0.5;
      };
      im.src = BG_SRC[key];
      BG_IMG[key] = im;
    })(k);
  }
})();
function bgOk(k){
  const im = BG_IMG[k];
  return !!(im && im.complete && im.logW);
}

/* ---- 生图特效素材（v1.4.0）--------------------------------------------
   全部由生图产出，构建时内联成 data URI：
     fireball 灯怪火团 · mist 雾爆 · ring 冲击环 · swirl 雾漩涡
     misttex 浓雾带 · water 湖面水纹（整幅纹理）· bridge 石桥单元（唯一带 alpha）
   发光类都是纯黑底，绘制时用 'lighter'：黑=加 0，天生透明，
   既不用抠图，也不会出现抠图常见的白边。 */
const FX_SRC = {
  fireball: "@@ART_fx_fireball@@",
  mist:     "@@ART_fx_mist@@",
  ring:     "@@ART_fx_ring@@",
  swirl:    "@@ART_fx_swirl@@",
  misttex:  "@@ART_fx_misttex@@",
  water:    "@@ART_fx_water@@",
  bridge:   "@@ART_fx_bridge@@",
  /* v1.11.0 大夜怪五招（生图，黑底叠加）*/
  wdrop:    "@@ART_fx_wdrop@@",
  orb:      "@@ART_fx_orb@@",
  breath:   "@@ART_fx_breath@@",
  trail:    "@@ART_fx_trail@@",
  tidew:    "@@ART_fx_tidew@@",
  weak:     "@@ART_fx_weak@@",
  /* v1.12.0（D14）：绽放光环改走程序化绘制（见 drawBloomDecor 的穹顶 + 环绕星屑），
     不再引用不存在的 fx_bloom 素材 —— 构建里那条「缺资源」警告随之消失。
     以后要换生图素材，在这里补一条 bloom 指向 src/art/fx_bloom.webp 即可接管。 */
};
const FX_IMG = {};
(function(){
  for(const k in FX_SRC){
    const im = new Image();
    im.src = FX_SRC[k];
    FX_IMG[k] = im;
  }
})();
function fxOK(k){
  const im = FX_IMG[k];
  return !!(im && im.complete && im.naturalWidth);
}
/* 叠加发光贴图：以 (x,y) 为中心，w×h，可旋转。alpha 掐在 0..1。 */
function glowAt(k, x, y, w, h, rot, alpha, flip){
  if(alpha <= 0.004 || !fxOK(k)) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.translate(x, y);
  if(rot) ctx.rotate(rot);
  /* v1.12.2：flip 用于「方向有语义」的素材（速度尾迹的密集端必须贴在本体身后） */
  if(flip) ctx.scale(-1, 1);
  ctx.drawImage(FX_IMG[k], -w * 0.5, -h * 0.5, w, h);
  ctx.restore();
  ctx.globalAlpha = 1;
}

/* ---- 条带底边渐隐 ----
   远山贴图的下三分之一是一整条实心雾带，底边是一条笔直的横线；
   叠到村舍上面时就被读成「山和村庄之间被切了一刀」。
   这里在图片加载后烘焙一份「底边渐隐」的离屏副本：只在首次用到时做一次，
   每帧零开销，横向镜像循环也不受影响（纵向遮罩左右对称）。 */
const LAYER_FADE = {};
function layerFaded(k, frac){
  const im = BG_IMG[k];
  if(!im || !im.complete || !im.logW) return null;
  const key = k + '@' + frac.toFixed(3);
  const hit = LAYER_FADE[key];
  if(hit && hit.__src === im && hit.__natW === im.naturalWidth) return hit;
  const cv = document.createElement('canvas');
  cv.width  = im.naturalWidth  || im.width;
  cv.height = im.naturalHeight || im.height;
  if(!cv.width || !cv.height) return null;
  const g = cv.getContext('2d');
  g.drawImage(im, 0, 0);
  const y0 = cv.height * (1 - frac);
  g.globalCompositeOperation = 'destination-out';
  const mg = g.createLinearGradient(0, y0, 0, cv.height);
  mg.addColorStop(0,    'rgba(0,0,0,0)');
  mg.addColorStop(0.55, 'rgba(0,0,0,0.55)');
  mg.addColorStop(1,    'rgba(0,0,0,1)');
  g.fillStyle = mg;
  g.fillRect(0, y0, cv.width, cv.height - y0);
  g.globalCompositeOperation = 'source-over';
  cv.logW = im.logW;
  cv.logH = im.logH;
  cv.__src = im;
  cv.__natW = im.naturalWidth;
  LAYER_FADE[key] = cv;
  return cv;
}

/* ---- 条带顶边渐隐 ----
   mist 贴图自己的上边缘是有 alpha 的（20–30%），直接摆在 y=H-116 就会沿着贴图
   顶边切出一条横线 —— 在湖岸这一屏特别显眼，因为上面正好是深色的林带。
   这里烘焙一份「顶边渐隐」的离屏副本，让雾是从天上飘下来的，而不是一条色带。 */
const LAYER_TOP_FADE = {};
function layerTopFaded(k, frac){
  const im = BG_IMG[k];
  if(!im || !im.complete || !im.logW) return null;
  const key = 'T' + k + '@' + frac.toFixed(3);
  const hit = LAYER_TOP_FADE[key];
  if(hit && hit.__src === im && hit.__natW === im.naturalWidth) return hit;
  const cv = document.createElement('canvas');
  cv.width  = im.naturalWidth  || im.width;
  cv.height = im.naturalHeight || im.height;
  if(!cv.width || !cv.height) return null;
  const g = cv.getContext('2d');
  g.drawImage(im, 0, 0);
  const y1 = cv.height * frac;
  g.globalCompositeOperation = 'destination-out';
  const mg = g.createLinearGradient(0, 0, 0, y1);
  mg.addColorStop(0,   'rgba(0,0,0,1)');
  mg.addColorStop(0.55,'rgba(0,0,0,0.55)');
  mg.addColorStop(1,   'rgba(0,0,0,0)');
  g.fillStyle = mg;
  g.fillRect(0, 0, cv.width, y1);
  g.globalCompositeOperation = 'source-over';
  cv.logW = im.logW;
  cv.logH = im.logH;
  cv.__src = im;
  cv.__natW = im.naturalWidth;
  LAYER_TOP_FADE[key] = cv;
  return cv;
}

/* 星空（V04）：原来 150 颗高亮方块和敌弹、掉落、击中效果挤在同一层视觉密度里，
   蓝色小点常被读成可收集物。现在减到 74 颗、整体压暗，
   并且主要飞行带（y 60–200）保留得更稀，把「看得清」让给敌弹与掉落。 */
const SKY_STARS = [];
for(let i=0;i<74;i++){
  const y = Math.random() * 210;
  if(y > 60 && y < 200 && Math.random() < 0.45) continue;
  SKY_STARS.push({
    x: Math.random()*W, y: y,
    s: 1, p: Math.random()*6.28,
    b: randi(70, 150)
  });
}

// 云：三张手绘云按不同速度/透明度循环，取代原先的椭圆叠色块
const CLOUD_KEYS = ['cloud1','cloud2','cloud3'];
const CLOUDS = [];
for(let i=0;i<7;i++){
  /* R04：云的体量收到 96–172（原来是 150–280，一块云就占掉小半屏），
     透明度也压到 0.14–0.30：云要退在角色 / 弹幕后面当远景，
     而不是和月亮抢画面、把天空糊成一团实心块。 */
  CLOUDS.push({
    k: CLOUD_KEYS[i % 3],
    x: (i / 7) * TW + rand(-60, 60),
    y: randi(6, 104),
    w: randi(96, 172),
    s: rand(0.022, 0.085),
    a: rand(0.14, 0.30)
  });
}

/* ==================== 6.1 场景表（策划案 8.4–8.9） ====================
   六个场景共用同一批手绘条带（moon / cloud / mount / town / mist），
   靠天色、月位、条带显隐与各自的程序化构件区分。
   SCENE_A 是交叉淡入系数，叠进本层的每一笔透明度里，
   所以同一套绘制代码既能整张铺满，也能半透明地盖在旧场景上。 */
let SCENE_A = 1;
function sa(a){ return Math.max(0, Math.min(1, a * SCENE_A)).toFixed(3); }
function setA(a){ ctx.globalAlpha = Math.max(0, Math.min(1, a * SCENE_A)); }
function hexA(h, a){
  const n = parseInt(h.slice(1), 16);
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' +
         Math.max(0, Math.min(1, a * SCENE_A)).toFixed(3) + ')';
}

const SCENE_DEF = {
  SC01: {                                     /* 8.4 村口湖岸：PH01 局部 0–18 秒 */
    sky:      ['#150b2b', '#281646', '#3a2350', '#4a2a4c'],
    stars:    1.00,
    cloud:    0.85,
    moon:     { x:W - 124, y:56, d:70,  glow:0.16 },
    mount:    { a:0.95, dy:0  },
    town:     { a:1.00, dy:0  },
    mist:     0.11,
    props:    'village',
    /* 村口湖岸改用手绘条带：远景山 + 中景岸/水（见 tools/make_lake_layers.py） */
    art:      { far:'lake_far', mid:'lake_mid' }
  },
  SC02: {                                     /* 8.5 满月湖面：PH01 局部 18–45 秒 */
    sky:      ['#150b2b', '#2a1748', '#372150', '#452a4e'],
    stars:    0.85,
    cloud:    0.55,
    moon:     { x:W - 150, y:64, d:78,  glow:0.24 },   /* V02：满月从 104 收到 78，别压过主角 */
    mount:    { a:0.70, dy:8  },
    /* V03：岸景不只是「暗」，是整排房子被水面盖住了 ——
       原来 dy=+10 把村舍推到 195.5 起，而水面从 194 就开始铺，
       房子全被水压到下面，只剩一条黑带。这里把村舍抬高到水线以上，
       房子的一半沉进水里当倒影，才是湖岸该有的读法。 */
    town:     { a:0.84, dy:-3 },
    mist:     0.07,
    props:    'lake',
    art:      { far:'lake_far', mid:'lake_mid' }
  },
  SC03: {                                     /* 8.6 屋后夜团：PH02 */
    sky:      ['#120a24', '#22123c', '#2e1b40', '#3b2340'],
    stars:    0.55,
    cloud:    0.75,
    moon:     { x:W - 160, y:62, d:72,  glow:0.17 },
    mount:    { a:0.70, dy:6  },
    town:     { a:0.85, dy:4  },
    mist:     0.17,
    props:    'backhouse'
  },
  SC04: {                                     /* 8.7 桥下通道：PH03 */
    sky:      ['#0d081d', '#1a1030', '#241634', '#2c1a36'],
    stars:    0.35,
    cloud:    0.40,
    moon:     { x:W - 96,  y:44, d:58,  glow:0.10 },
    mount:    { a:0.42, dy:10 },
    town:     { a:0.55, dy:8  },
    mist:     0.13,
    props:    'bridge'
  },
  SC05: {                                     /* 8.8 湖岸路灯：PH04 → PH05 */
    sky:      ['#0f0a20', '#1e1233', '#2a1b3c', '#372344'],
    stars:    0.45,
    cloud:    0.42,
    moon:     { x:W - 214, y:50, d:66,  glow:0.20 },
    mount:    { a:0.55, dy:8  },
    town:     { a:0.72, dy:6  },
    mist:     0.12,
    props:    'lamp',
    /* v1.12.2：湖面和岸改生图条带（tools/make_sc05_layers.py）。
       水面、石岸、芦苇、村舍和那盏旧路灯都画在条带里，代码只补月光与灯亮。 */
    art:      { mid:'sc05' },
    lampArt:  true,
    moonTop:  true
  },
  SC06: {                                     /* 8.9 萤火归途：PH06 */
    sky:      ['#171029', '#2b1a45', '#3a2650', '#4b3158'],
    stars:    0.60,
    cloud:    0.40,
    moon:     { x:W - 214, y:50, d:64,  glow:0.22 },
    mount:    { a:0.62, dy:6  },
    town:     { a:0.82, dy:2  },
    mist:     0.10,
    props:    'lamp',
    /* 归途与终战用同一条带：打完大夜怪灯全亮，画面不换画风 */
    art:      { mid:'sc05' },
    lampArt:  true,
    moonTop:  true
  }
};

/* ---- 场景构件：SC01 村口（坡岸 / 木栅栏 / 暖窗） ---- */
function scenePropsVillage(t){
  const cam = game.cam;

  /* 暖窗只画成极柔的光团，不画硬矩形 —— 手绘村舍的窗位对不齐反而更假（8.2 窗光面积受控） */
  const wins = [[62,204,12],[148,210,10],[236,201,13],[338,208,11],[418,203,10]];
  const woff = ((cam * 0.36) % 480 + 480) % 480;
  const wk0 = Math.floor((VIEW.x0 + woff) / 480) - 1;
  const wk1 = Math.ceil((VIEW.x1 + woff) / 480) + 1;
  for(let k = wk0; k <= wk1; k++){
    for(let i = 0; i < wins.length; i++){
      const wx = wins[i][0] - woff + k * 480;
      if(wx < VIEW.x0 - 32 || wx > VIEW.x1 + 32) continue;
      const wy = wins[i][1], wr = wins[i][2];
      const wg = ctx.createRadialGradient(wx, wy, 0, wx, wy, wr);
      /* 每找回一盏灯，岸上的窗就更暖一点（8.8 / R14） */
      const warm = 1 + game.lampsLit * 0.14;
      wg.addColorStop(0,    'rgba(231,182,127,' + sa(0.30 * warm) + ')');
      wg.addColorStop(0.45, 'rgba(231,182,127,' + sa(0.12 * warm) + ')');
      wg.addColorStop(1,    'rgba(231,182,127,0)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = wg;
      ctx.fillRect(wx - wr, wy - wr, wr * 2, wr * 2);
    }
  }

  /* 近岸坡：一条起伏的暗带压在地平线上（FG00：岸沿主要 y≥250） */
  ctx.globalAlpha = 1;
  const sg = ctx.createLinearGradient(0, 244, 0, H);
  sg.addColorStop(0, 'rgba(42,30,58,' + sa(0.55) + ')');
  sg.addColorStop(1, 'rgba(16,10,28,' + sa(0.90) + ')');
  ctx.fillStyle = sg;
  ctx.beginPath();
  /* 岸沿起伏按 60 一档循环（周期 480），续铺到整个可见范围 */
  ctx.moveTo(VIEW.x0 - 8, 246);
  for(let i = Math.floor(VIEW.x0 / 60) - 1; i <= Math.ceil(VIEW.x1 / 60) + 1; i++){
    const by = [2,-1,2,0,3,-1,2,0][((i % 8) + 8) % 8];
    ctx.lineTo(i * 60, 246 + by);
  }
  ctx.lineTo(VIEW.x1 + 8, H + 8); ctx.lineTo(VIEW.x0 - 8, H + 8);
  ctx.closePath(); ctx.fill();

  /* 木栅栏：细柱 + 两道横杆 */
  const fgap = 26, foff = ((cam * 0.62) % fgap + fgap) % fgap;
  /* 栅栏压在暗岸上，颜色要比岸亮一点才读得出来 */
  ctx.strokeStyle = 'rgba(104,80,110,' + sa(0.80) + ')';
  ctx.lineWidth = 1.4;
  const f0 = Math.floor((VIEW.x0 + foff) / fgap) - 1;
  const f1 = Math.ceil((VIEW.x1 + foff) / fgap) + 1;
  for(let i = f0; i <= f1; i++){
    const x = i * fgap - foff;
    if(x < VIEW.x0 - 8 || x > VIEW.x1 + 8) continue;
    ctx.beginPath(); ctx.moveTo(x, 226); ctx.lineTo(x, 241); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(104,80,110,' + sa(0.55) + ')';
  ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.moveTo(VIEW.x0 - 8, 230);   ctx.lineTo(VIEW.x1 + 8, 230);   ctx.stroke();
  ctx.beginPath(); ctx.moveTo(VIEW.x0 - 8, 236.5); ctx.lineTo(VIEW.x1 + 8, 236.5); ctx.stroke();
}

/* ---- 场景构件：湖面（SC02 满月湖面 / SC05·SC06 湖岸水面）----
   R04：整段重做。原来水体只铺到 y=262 就收成近黑，底下一整条是全屏通用的深紫土层，
   所以「湖」在读图里只是一条略亮的横带：没有水体、没有月光、没有倒影。
   现在分五层叠出来：水线柔光 → 水体渐变（一路铺到画面底）→ 月光碎影柱 →
   暖窗 / 路灯倒影 → 分层波纹；SC02 再加一条起伏的草岸压边当近景。
   opt.top  水线 y（SC02 = 212，路灯段 = 232）
   opt.mx   月影的 x
   opt.near 近岸档（路灯段）：倒影换成路灯暖光，不再加草岸（那一带已经有芦苇）
   opt.lit  0..1 路灯亮了几盏 */
function scenePropsLake(t, opt){
  opt = opt || {};
  const cam  = game.cam;
  const top  = opt.top == null ? 212 : opt.top;
  const mx   = opt.mx  == null ? SCENE_DEF.SC02.moon.x : opt.mx;
  const near = !!opt.near;
  const la   = clamp(opt.lit == null ? 0 : opt.lit, 0, 1);
  const H1   = Math.max(18, H - top);        /* 水体高度 */
  const k    = H1 / 72;                      /* 相对 SC02 的压缩比 */

  /* ① 水体本体：从水线一路铺到画面底，不再在中途收成一条黑带。
     色相偏冷（#68809E 系），比 #3A2B47 的土层更亮更蓝，两者在同一屏里能分开读。 */
  const wt = ctx.createLinearGradient(0, top - 2, 0, H + 2);
  const st = (dy, col, a) => wt.addColorStop(clamp(dy * k / (H1 + 4), 0, 1),
                                            'rgba(' + col + ',' + sa(a) + ')');
  ctx.globalAlpha = 1;
  st(-2, '96,112,150',  0.00);
  st(2,  '96,112,150',  0.40);
  st(10, '82,98,138',   0.58);
  st(24, '62,76,112',   0.72);
  st(44, '44,54,90',    0.84);
  st(74, '22,24,46',    0.95);
  /* ② 水线：不做成一条水平直线 —— 那条线正好压在村舍脚下，读起来像用尺子画的。
     用一条缓慢起伏的曲线当前沿（随时间轻轻挪动），水面以上 4px 的柔光再被这条
     曲线裁掉，于是水线是「水漫过岸脚」的软边，而不是一道贯穿全屏的接缝。 */
  const waveY = (x) => top
    + Math.sin(cam * 0.05 + x * 0.037) * 1.7
    + Math.sin(x * 0.0113 + t * 0.30) * 0.9;
  ctx.beginPath();
  ctx.moveTo(VIEW.x0 - 10, waveY(VIEW.x0 - 10));
  for(let x = VIEW.x0 - 10; x <= VIEW.x1 + 10; x += 32){
    ctx.quadraticCurveTo(x + 16, waveY(x + 16), x + 32, waveY(x + 32));
  }
  ctx.lineTo(VIEW.x1 + 10, H + 10); ctx.lineTo(VIEW.x0 - 10, H + 10); ctx.closePath();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = wt;
  ctx.fillRect(VIEW.x0, top - 4, VIEW.w, H - top + 4);
  const hz = ctx.createLinearGradient(0, top - 4, 0, top + 4);
  hz.addColorStop(0.00, 'rgba(226,220,246,' + sa(0.00) + ')');
  hz.addColorStop(0.50, 'rgba(226,220,246,' + sa(0.17) + ')');
  hz.addColorStop(1.00, 'rgba(226,220,246,' + sa(0.00) + ')');
  ctx.fillStyle = hz;
  ctx.fillRect(VIEW.x0, top - 4, VIEW.w, 8);

  /* ②b 水纹叠层（v1.4.0 生图）：横向平铺、随相机慢移的月光水纹。
     用 screen 叠在已有水色上 —— 只加碎光不改明暗，水体该有的深色留得住。
     纹理高度正好等于水体高度，所以不会被拉成横向拉丝。 */
  if(fxOK('water')){
    const tw3 = 240, th3 = H - top + 2;
    const off = ((cam * 0.35) % tw3 + tw3) % tw3;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.46 * SCENE_A;
    const w0 = tileFrom(tw3, off), w1 = tileTo(tw3, off);
    for(let i = w0; i <= w1; i++){
      ctx.drawImage(FX_IMG.water, i * tw3 - off, top - 1, tw3, th3);
    }
    ctx.restore();
  }

  /* ③ 暖光倒影：SC02 是岸上暖窗，路灯段是头顶那盏灯。
     倒影一律「上浓下淡 + 断成几截」，长度的衰减跟水体一起压缩。 */
  if(!near){
    const rwins = [[62,4],[148,3],[236,4],[338,3],[418,3]];
    const rwoff = ((cam * 0.36) % 480 + 480) % 480;
    const warm  = 1 + game.lampsLit * 0.14;
    const rk0 = Math.floor((VIEW.x0 + rwoff) / 480) - 1;
    const rk1 = Math.ceil((VIEW.x1 + rwoff) / 480) + 1;
    for(let kk = rk0; kk <= rk1; kk++){
      for(let i = 0; i < rwins.length; i++){
        const rx = rwins[i][0] - rwoff + kk * 480;
        if(rx < VIEW.x0 - 20 || rx > VIEW.x1 + 20) continue;
        const rl = (rwins[i][1] * 5) * k;
        const y0 = top + 2;
        const rg2 = ctx.createLinearGradient(0, y0, 0, y0 + rl);
        rg2.addColorStop(0.00, 'rgba(236,186,128,' + sa(0.34 * warm) + ')');
        rg2.addColorStop(0.55, 'rgba(236,186,128,' + sa(0.13 * warm) + ')');
        rg2.addColorStop(1.00, 'rgba(236,186,128,0)');
        ctx.fillStyle = rg2;
        ctx.fillRect(rx - 1.4, y0, 2.8, rl);
        /* 断口：两三条短横，倒影才有水面的碎感 */
        ctx.fillStyle = 'rgba(240,196,140,' + sa(0.16 * warm) + ')';
        ctx.fillRect(rx - 3.4, y0 + 3.5 * k, 6.8, 0.9);
        ctx.fillRect(rx - 2.6, y0 + 8.5 * k, 5.2, 0.9);
        ctx.fillRect(rx - 3.0, y0 + 13.5 * k, 6.0, 0.8);
      }
    }
  } else {
    /* 路灯：灯头 x≈406，杆脚 x=448，暖光落在两人之间那道水面上 */
    const lx = 414, y0 = top + 1, rl = 26 * k;
    const lg = ctx.createLinearGradient(0, y0, 0, y0 + rl);
    lg.addColorStop(0.00, 'rgba(255,226,168,' + sa(0.10 + 0.26 * la) + ')');
    lg.addColorStop(1.00, 'rgba(255,214,150,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(lx - 5, y0, 10, rl);
    for(let i = 0; i < 4; i++){
      const ww = 9 - i * 1.6;
      ctx.fillStyle = 'rgba(255,232,182,' + sa((0.14 + 0.20 * la) - i * 0.030) + ')';
      ctx.fillRect(lx - ww * 0.5 + Math.sin(t * 1.1 + i) * 1.2, y0 + (2.5 + i * 4.2) * k, ww, 1.1);
    }
    /* 岸上暖窗在近岸水里同样留一点碎光 */
    const rwoff = ((cam * 0.30) % 480 + 480) % 480;
    const wins = [[300,7],[356,6],[214,6],[408,5]];
    const nk0 = Math.floor((VIEW.x0 + rwoff) / 480) - 1;
    const nk1 = Math.ceil((VIEW.x1 + rwoff) / 480) + 1;
    for(let kk = nk0; kk <= nk1; kk++){
      for(let i = 0; i < wins.length; i++){
        const rx = wins[i][0] - rwoff + kk * 480;
        if(rx < VIEW.x0 - 20 || rx > VIEW.x1 + 20) continue;
        ctx.fillStyle = 'rgba(236,186,128,' + sa(0.10 + 0.10 * la) + ')';
        ctx.fillRect(rx - 1.2, top + 2, 2.4, wins[i][1] * 2.4 * k);
      }
    }
  }

  /* ④ 月光碎影柱：跟着月亮走，自上而下变窄变淡，并随水波左右轻晃 */
  const rows0 = 12;
  for(let i = 0; i < rows0; i++){
    const yy = top + 2 + (i * (H1 * 0.62) / rows0);
    const ww = (27 - i * 1.7) * (1 + 0.22 * Math.sin(t * 1.7 + i * 0.9));
    if(ww <= 1) continue;
    ctx.fillStyle = 'rgba(243,236,210,' + sa(Math.max(0.030, 0.30 - i * 0.022)) + ')';
    ctx.fillRect(mx - ww * 0.5 + Math.sin(t * 0.8 + i * 0.7) * 1.6, yy, ww, 1.4);
  }

  /* ⑤ 水面波纹：五档速度错开的短横线，越近越长越淡。
     不能画成等距密条（看着像弹幕），所以长度、间隔都带随机偏移。 */
  const rows = [
    { dy:9,  spd:6.6,  col:'158,176,212', a:0.22, n:8, lo:10, span:26 },
    { dy:18, spd:8.4,  col:'176,190,222', a:0.18, n:7, lo:8,  span:24 },
    { dy:29, spd:10.4, col:'150,166,202', a:0.15, n:6, lo:14, span:40 },
    { dy:42, spd:12.0, col:'128,146,186', a:0.12, n:5, lo:18, span:50 },
    { dy:58, spd:14.2, col:'108,124,168', a:0.09, n:4, lo:22, span:58 }
  ];
  ctx.globalAlpha = 1;
  for(let r = 0; r < rows.length; r++){
    const R = rows[r];
    const ry = top + R.dy * k;
    if(ry > H - 4) continue;
    const tile = 260;
    const off = ((cam * R.spd) % tile + tile) % tile;
    const ri0 = tileFrom(tile, off), ri1 = tileTo(tile, off);
    for(let i = ri0; i <= ri1; i++){
      for(let j = 0; j < R.n; j++){
        const bx = i * tile + j * (tile / R.n) - off + (j * 37 % 19);
        if(bx < VIEW.x0 - 60 || bx > VIEW.x1 + 10) continue;
        const len = R.lo + ((j * 53) % Math.max(1, R.span - R.lo));
        ctx.fillStyle = 'rgba(' + R.col + ',' + sa(R.a) + ')';
        ctx.fillRect(bx, ry + (j % 2) * 1.8, len, 1);
      }
    }
  }

  /* ⑥ 近岸草岸（只有 SC02）：顶边是起伏的草线 + 一丛丛草叶，
     只压画面下缘的一条，不是整幅横带 —— 完整横带会把水压成近黑。 */
  if(!near){
    const y0 = H - 16;
    ctx.beginPath();
    ctx.moveTo(VIEW.x0 - 8, y0 + 3);
    for(let x = VIEW.x0 - 8; x <= VIEW.x1 + 8; x += 26){
      ctx.quadraticCurveTo(x + 13, y0 - 2.6 + Math.sin(x * 0.061) * 2.4,
                           x + 26, y0 + 2.4 + Math.sin(x * 0.047 + 1.2) * 2.0);
    }
    ctx.lineTo(VIEW.x1 + 8, H + 8); ctx.lineTo(VIEW.x0 - 8, H + 8); ctx.closePath();
    const fg = ctx.createLinearGradient(0, y0 - 4, 0, H + 2);
    fg.addColorStop(0.00, 'rgba(44,40,64,' + sa(0.14) + ')');
    fg.addColorStop(0.45, 'rgba(26,24,44,' + sa(0.52) + ')');
    fg.addColorStop(1.00, 'rgba(12,11,24,' + sa(0.86) + ')');
    ctx.fillStyle = fg;
    ctx.fill();
    /* 草叶：短、疏、带一点摇摆，让岸沿有毛发感而不是一条硬边 */
    ctx.lineCap = 'round';
    const gN = Math.ceil((VIEW.x1 - VIEW.x0 + 24) / 11.4);
    for(let i = 0; i < gN; i++){
      const bx = VIEW.x0 - 10 + i * 11.4 + (i * 7 % 5);
      if(bx > VIEW.x1 + 10) break;
      const hh = 4.5 + ((i * 37) % 9);
      const bend = Math.sin(t * 1.2 + i * 0.8) * 1.8;
      ctx.strokeStyle = 'rgba(15,12,26,' + sa(0.86) + ')';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(bx, H - 3);
      ctx.quadraticCurveTo(bx + bend * 0.5, H - 3 - hh * 0.6, bx + bend, H - 3 - hh);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
  } else {
    /* 近岸档只压最后 10px 的暗角，把画面底边收住，不挡水面 */
    const vg = ctx.createLinearGradient(0, H - 12, 0, H);
    vg.addColorStop(0, 'rgba(9,7,17,0)');
    vg.addColorStop(1, 'rgba(9,7,17,' + sa(0.80) + ')');
    ctx.fillStyle = vg;
    ctx.fillRect(VIEW.x0, H - 12, VIEW.w, 12);
  }
  ctx.restore();
}

/* ---- 场景构件：SC03 屋后夜团（右侧旧屋压边 / 更浓的雾） ---- */
function scenePropsBackhouse(t){
  ctx.globalAlpha = 1;

  /* 右侧旧屋：屋檐压进画面，中 Boss 从这片屋影下出来（8.6 延续湖岸，不另切地图）。
     左边界定在 372，避开 Boss 停留位 346±34，不让黑屋吃掉 Boss 轮廓。
     WB21：右边界跟到可见范围外缘 —— 手机多出来的那截也是「同一栋黑屋」，不是空白。 */
  const hL = 372, hR = VIEW.x1 + 12, hTop = 96;
  const wg3 = ctx.createLinearGradient(hL, 0, hR, 0);
  wg3.addColorStop(0,   'rgba(52,42,70,' + sa(0.94) + ')');
  wg3.addColorStop(0.4, 'rgba(34,27,48,' + sa(0.94) + ')');
  wg3.addColorStop(1,   'rgba(20,15,32,' + sa(0.94) + ')');
  ctx.fillStyle = wg3;
  ctx.fillRect(hL, hTop, hR - hL, 246 - hTop);

  /* 屋面：两坡屋顶压在墙顶，屋脊在画外，左坡朝月亮 -->
     朝月的一侧留一条受光窄边，屋影才有体积，不是一块黑板 */
  ctx.fillStyle = 'rgba(30,24,44,' + sa(0.96) + ')';
  ctx.beginPath();
  ctx.moveTo(hL - 8, hTop + 2);
  ctx.lineTo(hR, hTop - 46);
  ctx.lineTo(hR, hTop + 2);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(124,102,136,' + sa(0.34) + ')';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(hL - 8, hTop + 2);
  ctx.lineTo(hR, hTop - 46);
  ctx.stroke();

  /* 檐口：一道略宽的深色压条，把屋顶和墙分开 */
  ctx.fillStyle = 'rgba(18,13,28,' + sa(0.90) + ')';
  ctx.fillRect(hL - 9, hTop, hR - hL + 9, 5);

  /* 墙身石缝：低对比横线，读得出是石屋 */
  ctx.strokeStyle = 'rgba(14,10,24,' + sa(0.45) + ')';
  ctx.lineWidth = 1;
  for(let y = hTop + 22; y < 244; y += 17){
    ctx.beginPath(); ctx.moveTo(hL + 2, y); ctx.lineTo(hR, y); ctx.stroke();
  }

  /* 歪烟囱 */
  ctx.fillStyle = 'rgba(20,15,30,' + sa(0.96) + ')';
  ctx.fillRect(424, 34, 14, 30);
  ctx.fillRect(421, 30, 20, 6);
  ctx.strokeStyle = 'rgba(124,102,136,' + sa(0.28) + ')';
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(424, 34); ctx.lineTo(424, 64); ctx.stroke();

  /* 两扇冷窗：不亮，和 SC01 的暖窗形成对照 */
  ctx.fillStyle = 'rgba(58,50,78,' + sa(0.92) + ')';
  ctx.fillRect(400, 132, 18, 24);
  ctx.fillRect(432, 132, 18, 24);
  ctx.strokeStyle = 'rgba(22,17,34,' + sa(0.92) + ')';
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(409, 132); ctx.lineTo(409, 156); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(441, 132); ctx.lineTo(441, 156); ctx.stroke();
  /* 窗台 */
  ctx.fillStyle = 'rgba(80,66,96,' + sa(0.55) + ')';
  ctx.fillRect(398, 156, 22, 2);
  ctx.fillRect(430, 156, 22, 2);

  /* 左侧屋角：画面最近的一栋房子，只露出屋檐和一角石墙。
     原来是一块带斜角的纯色多边形、底边在 y=190 处硬切在山脊上，
     没有屋面、没有檐口、没有墙脚，读起来像界面上多出来的一块面板。
     这里按「坡屋面 → 檐口压条 → 檐下阴影 → 石墙 → 暖窗」补齐体积，
     墙脚一直落到地平线 y=248，和村舍带接上，不再悬空。 */
  const ehL = Math.min(-36, VIEW.x0 - 36), ehR = 58, eTop = 54, eEaveY = 101, eBot = 248;
  const roofY = function(x){ return eTop + (x - ehL) * 0.5; };

  /* 墙体：上沿跟着坡屋面走，右边界就是这栋房子的转角（画内的竖边） */
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(ehL, roofY(ehL) + 10);
  ctx.lineTo(ehR, roofY(ehR) + 10);
  ctx.lineTo(ehR, eBot);
  ctx.lineTo(ehL, eBot);
  ctx.closePath();
  ctx.clip();
  const wg4 = ctx.createLinearGradient(0, roofY(ehL) + 10, 0, eBot);
  wg4.addColorStop(0,    'rgba(34,26,50,' + sa(0.96) + ')');
  wg4.addColorStop(0.55, 'rgba(24,18,38,' + sa(0.96) + ')');
  wg4.addColorStop(1,    'rgba(15,11,26,' + sa(0.96) + ')');
  ctx.fillStyle = wg4;
  ctx.fillRect(ehL, roofY(ehL) + 10, ehR - ehL, eBot - roofY(ehL) - 10);
  /* 石缝：和右侧旧屋同一套，低对比 */
  ctx.strokeStyle = 'rgba(13,9,22,' + sa(0.42) + ')';
  ctx.lineWidth = 1;
  for(let y = eEaveY + 22; y < eBot; y += 17){
    ctx.beginPath(); ctx.moveTo(ehL, y); ctx.lineTo(ehR, y); ctx.stroke();
  }
  /* 檐下阴影：屋檐挡住月光，贴着屋面往下一段更暗（跟着坡面走，不是一条竖直的暗条） */
  const esh = ctx.createLinearGradient(0, roofY(ehL) + 10, 0, roofY(ehR) + 44);
  esh.addColorStop(0, 'rgba(8,5,16,' + sa(0.58) + ')');
  esh.addColorStop(1, 'rgba(8,5,16,0)');
  ctx.fillStyle = esh;
  ctx.beginPath();
  ctx.moveTo(ehL, roofY(ehL) + 10);
  ctx.lineTo(ehR, roofY(ehR) + 10);
  ctx.lineTo(ehR, roofY(ehR) + 44);
  ctx.lineTo(ehL, roofY(ehL) + 44);
  ctx.closePath(); ctx.fill();
  ctx.restore();

  /* 坡屋面：朝月的一侧受光，屋檐这侧暗下去，坡面才有厚度 */
  const rgp = ctx.createLinearGradient(ehL, eTop, ehR, eEaveY);
  rgp.addColorStop(0, 'rgba(56,43,72,' + sa(0.97) + ')');
  rgp.addColorStop(1, 'rgba(27,20,41,' + sa(0.97) + ')');
  ctx.fillStyle = rgp;
  ctx.beginPath();
  ctx.moveTo(ehL, eTop);
  ctx.lineTo(ehR, roofY(ehR));
  ctx.lineTo(ehR, roofY(ehR) + 10);
  ctx.lineTo(ehL, eTop + 10);
  ctx.closePath(); ctx.fill();
  /* 屋脊方向的受光窄边：一条亮线把坡面和夜空分开 */
  ctx.strokeStyle = 'rgba(148,124,164,' + sa(0.40) + ')';
  ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(ehL, eTop); ctx.lineTo(ehR, roofY(ehR)); ctx.stroke();
  /* 檐口压条：屋面与墙体之间的深色分界 */
  ctx.fillStyle = 'rgba(14,10,24,' + sa(0.92) + ')';
  ctx.beginPath();
  ctx.moveTo(ehL, eTop + 10);
  ctx.lineTo(ehR, roofY(ehR) + 10);
  ctx.lineTo(ehR, roofY(ehR) + 13.5);
  ctx.lineTo(ehL, eTop + 13.5);
  ctx.closePath(); ctx.fill();
  /* 转角处一条极淡的收边，房子的右边界不是被刀切出来的 */
  ctx.strokeStyle = 'rgba(120,98,132,' + sa(0.18) + ')';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(ehR, roofY(ehR) + 13); ctx.lineTo(ehR, eBot); ctx.stroke();

  /* 暖窗：这面墙上唯一亮着的一扇，和右侧冷窗拉开，说明这边还住着人 */
  const wx = 12, wy = 146, ww2 = 20, wh2 = 22;
  const lw = ctx.createRadialGradient(wx + ww2 * 0.5, wy + wh2 * 0.5, 1,
                                      wx + ww2 * 0.5, wy + wh2 * 0.5, 26);
  lw.addColorStop(0,   'rgba(231,182,127,' + sa(0.30) + ')');
  lw.addColorStop(1,   'rgba(231,182,127,0)');
  ctx.globalAlpha = 1;
  ctx.fillStyle = lw;
  ctx.fillRect(wx - 26, wy - 26, ww2 + 52, wh2 + 52);
  /* 窗洞 + 窗框 + 中梃 */
  ctx.fillStyle = 'rgba(238,196,142,' + sa(0.62) + ')';
  ctx.fillRect(wx, wy, ww2, wh2);
  ctx.strokeStyle = 'rgba(26,18,38,' + sa(0.90) + ')';
  ctx.lineWidth = 1.6;
  ctx.strokeRect(wx - 0.8, wy - 0.8, ww2 + 1.6, wh2 + 1.6);
  ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.moveTo(wx + ww2 * 0.5, wy); ctx.lineTo(wx + ww2 * 0.5, wy + wh2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(wx, wy + wh2 * 0.44); ctx.lineTo(wx + ww2, wy + wh2 * 0.44); ctx.stroke();
  /* 窗台 */
  ctx.fillStyle = 'rgba(86,71,102,' + sa(0.50) + ')';
  ctx.fillRect(wx - 2, wy + wh2 + 1, ww2 + 4, 2);

  /* 夜团更浓的一层雾：Boss 从雾里鼓起来（跟着可见范围铺，两侧才不会断） */
  const fg = ctx.createRadialGradient(W * 0.60, 152, 40, W * 0.60, 152, 300);
  fg.addColorStop(0, 'rgba(58,40,74,' + sa(0.22) + ')');
  fg.addColorStop(1, 'rgba(58,40,74,0)');
  ctx.globalAlpha = 1;
  ctx.fillStyle = fg;
  ctx.fillRect(VIEW.x0, 40, VIEW.w, 214);
}

/* ---- 场景构件：SC04 桥下通道（顶梁 / 石柱 / 矮栏杆） ----
   dx 用来做 8.6 的「石桥顶部从右侧进入」：过渡 0.8 秒里 dx 从 W 收到 0。 */
function scenePropsBridge(t, dx){
  const cam = game.cam;
  const beamY = 54, beamH = 25;                 /* 8.3 BG05：桥顶 y=57–75 */

  /* v1.4.0：石桥换成生图素材。
     素材是一个「中间一根石柱、左右各半个拱洞」的单元（左右边缘正好切在拱顶），
     所以正反交替平铺时拱洞是连续接上的，也不会出现贴图接缝。
     单元宽 132（比原来的柱距 118 略宽，让石柱看着更厚），从桥面顶一直落到地面。 */
  if(fxOK('bridge')){
    const pitch = 132, top2 = 50, hh = 246 - top2;
    const period = pitch * 2;
    const off = (((cam * 24 + (dx || 0)) % period) + period) % period;
    ctx.globalAlpha = 1;
    /* WB21：柱阵份数按可见范围算（原来是「一直画到 W+period 为止」） */
    const b0 = tileFrom(period, off), b1 = tileTo(period, off);
    for(let i = b0; i <= b1; i++){
      const x0 = i * period - off;
      if(x0 > VIEW.x1 + period || x0 + period < VIEW.x0 - period) continue;
      /* 正片 */
      ctx.drawImage(FX_IMG.bridge, x0, top2, pitch, hh);
      /* 镜像片：拱洞接得上，石柱一正一反各自成柱 */
      ctx.save();
      ctx.translate(x0 + period, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(FX_IMG.bridge, 0, top2, pitch, hh);
      ctx.restore();
    }
    /* 柱后透出的紫夜空：只压暗桥下一条，幅度很小 */
    const vg2 = ctx.createLinearGradient(0, 79, 0, 176);
    vg2.addColorStop(0, 'rgba(18,10,32,' + sa(0.26) + ')');
    vg2.addColorStop(1, 'rgba(18,10,32,0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = vg2;
    ctx.fillRect(VIEW.x0, 79, VIEW.w, 97);
    return;
  }

  ctx.globalAlpha = 1;
  const vw2 = VIEW.w, vx0 = VIEW.x0;
  const bg2 = ctx.createLinearGradient(0, beamY, 0, beamY + beamH);
  bg2.addColorStop(0,    'rgba(78,67,86,'  + sa(0.98) + ')');
  bg2.addColorStop(0.62, 'rgba(58,49,66,'  + sa(0.98) + ')');
  bg2.addColorStop(1,    'rgba(40,32,48,'  + sa(0.98) + ')');
  ctx.fillStyle = bg2;
  ctx.fillRect(vx0 - 10 + dx, beamY, vw2 + 20, beamH);

  /* 横梁下沿受光 */
  ctx.fillStyle = 'rgba(108,82,98,' + sa(0.55) + ')';
  ctx.fillRect(vx0 - 10 + dx, beamY + beamH - 3, vw2 + 20, 2);

  /* 横梁石缝 */
  const seam = ((cam * 24) % 46 + 46) % 46;
  ctx.strokeStyle = 'rgba(32,25,40,' + sa(0.75) + ')';
  ctx.lineWidth = 1;
  for(let i = Math.floor((vx0 + seam) / 46) - 1; i <= Math.ceil((vx0 + vw2 + seam) / 46) + 1; i++){
    const x = i * 46 - seam + dx;
    if(x < vx0 - 8 || x > vx0 + vw2 + 8) continue;
    ctx.beginPath(); ctx.moveTo(x, beamY + 2); ctx.lineTo(x, beamY + beamH - 3); ctx.stroke();
  }

  /* 石柱：从横梁垂到地面，宽 24、间距 118 —— 柱间留 94 的通路，
     不是封死飞行空间的实心墙（8.7） */
  const colW = 24, gap = 118;
  const colOff = ((cam * 24) % gap + gap) % gap;
  for(let i = Math.floor((vx0 + colOff) / gap) - 1; i <= Math.ceil((vx0 + vw2 + colOff) / gap) + 1; i++){
    const cx = i * gap - colOff + dx;
    if(cx + colW < vx0 - 8 || cx > vx0 + vw2 + 8) continue;
    const cg = ctx.createLinearGradient(cx, 0, cx + colW, 0);
    cg.addColorStop(0,    'rgba(50,42,58,' + sa(0.96) + ')');
    cg.addColorStop(0.34, 'rgba(72,61,80,' + sa(0.96) + ')');
    cg.addColorStop(1,    'rgba(38,31,46,' + sa(0.96) + ')');
    ctx.fillStyle = cg;
    ctx.fillRect(cx, beamY + beamH - 1, colW, 246 - (beamY + beamH - 1));

    /* 石块横缝 */
    ctx.strokeStyle = 'rgba(30,24,38,' + sa(0.70) + ')';
    ctx.lineWidth = 1;
    for(let b = 1; b <= 5; b++){
      const by = beamY + beamH + b * 34;
      if(by > 244) break;
      ctx.beginPath(); ctx.moveTo(cx + 1, by); ctx.lineTo(cx + colW - 1, by); ctx.stroke();
    }
    /* 柱脚收口 */
    ctx.fillStyle = 'rgba(34,27,42,' + sa(0.92) + ')';
    ctx.fillRect(cx - 3, 240, colW + 6, 6);
    /* 青灰苔斑 */
    ctx.fillStyle = 'rgba(86,104,104,' + sa(0.18) + ')';
    ctx.fillRect(cx + 3,  beamY + beamH + 18, 7, 3);
    ctx.fillRect(cx + 12, beamY + beamH + 74, 5, 2);
  }

  /* 柱间矮栏杆：只连柱与柱之间，不横穿整屏（8.7） */
  ctx.strokeStyle = 'rgba(62,52,72,' + sa(0.50) + ')';
  ctx.lineWidth = 1.3;
  for(let i = Math.floor((vx0 + colOff) / gap) - 1; i <= Math.ceil((vx0 + vw2 + colOff) / gap) + 1; i++){
    const x0 = i * gap - colOff + dx;
    if(x0 + colW > vx0 + vw2 + 8 || x0 + gap < vx0 - 8) continue;
    ctx.beginPath(); ctx.moveTo(x0 + colW, 206); ctx.lineTo(x0 + gap, 206); ctx.stroke();
  }

  /* 柱后透出的紫夜空：只压暗桥下一条，幅度很小 */
  const vg2 = ctx.createLinearGradient(0, 79, 0, 176);
  vg2.addColorStop(0, 'rgba(18,10,32,' + sa(0.26) + ')');
  vg2.addColorStop(1, 'rgba(18,10,32,0)');
  ctx.globalAlpha = 1;
  ctx.fillStyle = vg2;
  ctx.fillRect(vx0 - 10, 79, vw2 + 20, 97);
}

/* ---- 场景构件：SC05 / SC06 湖岸路灯（路灯 / 芦苇 / 栅栏 / 暖窗） ----
   lit = false 是 PH04 预警与 PH05 终战：路灯被黑雾包着；
   lit = true  是 PH06 萤火归途：雾散、灯亮、芦苇不再急摆（8.9）。 */
/* 灯点亮瞬间的光爆时长（秒） */
const LAMP_FLASH_T = 1.0;

/* ---- SC05 / SC06 生图条带的环境光（v1.12.2）----
   水面、石岸、芦苇、村舍和那盏旧路灯都画在条带里（tools/make_sc05_layers.py），
   代码只负责会动 / 会变的部分：
     ① 月光碎影 —— 月亮是世界坐标，不能跟着条带漂；
     ② 路灯点亮 —— 开战全黑，击破大夜怪后依次亮起（8.8 / 8.9 的「灯回来」）。
   灯的位置由条带的滚动偏移算出：条带是「A + 镜像(A)」，同一盏灯每侧各出现一次。 */
const SC05_LAMP_FX = 0.9102;        /* 灯在单侧条带里的横向比例 */
const SC05_LAMP_HEAD_Y = 117;       /* 灯头世界 y */
const SC05_LAMP_BASE_Y = 234;       /* 灯座（岸线）世界 y */
function sc05LampXs(){
  const im = BG_IMG['sc05'];
  if(!im || !im.logW) return [];
  const tw = im.logW;                                  /* 一整个镜像周期 */
  const off = ((game.cam * 0.30) % tw + tw) % tw;
  const half = tw * 0.5;
  const out = [];
  /* WB21：份数按可见范围算 —— 手机两侧多出来的补边里也有灯，不能空着 */
  const i0 = Math.floor((VIEW.x0 + off) / tw) - 1;
  const i1 = Math.ceil((VIEW.x1 + off) / tw) + 1;
  for(let i = i0; i <= i1; i++){
    const base = -off + i * tw;
    out.push({ x: base + SC05_LAMP_FX * half, k: 0 });
    out.push({ x: base + tw - SC05_LAMP_FX * half, k: 1 });
  }
  return out;
}
function scenePropsLampArt(t){
  const sc = SCENE_DEF[game.sceneKey] || SCENE_DEF.SC05;
  const mx = sc.moon ? sc.moon.x : W - 214;
  const litN = (game.sceneKey === 'SC06') ? 3 : clamp(game.lampsLit | 0, 0, 3);
  const fl = clamp((game.lampFlash || 0) / LAMP_FLASH_T, 0, 1);

  /* ①a 月光铺底：条带是生图，整屏偏暗；用一层极淡的冷白光把月亮和湖面连起来。
     只加不压（lighter），不改变条带本身的明暗关系。 */
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const wash = ctx.createRadialGradient(mx, 60, 10, mx, 200, 210);
  wash.addColorStop(0.00, 'rgba(206,214,240,' + sa(0.10) + ')');
  wash.addColorStop(0.45, 'rgba(168,180,220,' + sa(0.045) + ')');
  wash.addColorStop(1.00, 'rgba(120,132,190,0)');
  ctx.fillStyle = wash;
  ctx.fillRect(VIEW.x0, VIEW.y0, VIEW.w, VIEW.h);
  ctx.restore();
  ctx.globalAlpha = 1;

  /* ① 月光碎影：贴着真实月亮画，水面才不是一张死图 */
  const rows = 12, y0 = 236, y1 = 268;
  for(let i = 0; i < rows; i++){
    const yy = y0 + (i * (y1 - y0)) / rows;
    const ww = (30 - i * 1.9) * (1 + 0.22 * Math.sin(t * 1.7 + i * 0.9));
    if(ww <= 1) continue;
    ctx.fillStyle = 'rgba(243,236,210,' + sa(Math.max(0.025, 0.27 - i * 0.019)) + ')';
    ctx.fillRect(mx - ww * 0.5 + Math.sin(t * 0.8 + i * 0.7) * 1.8, yy, ww, 1.3);
  }

  /* ② 路灯：没亮就什么都不画 —— 画里那盏本来就是黑的 */
  if(litN <= 0) return;
  const lamps = sc05LampXs();
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for(let i = 0; i < lamps.length; i++){
    const L = lamps[i];
    if(L.k >= litN) continue;                     /* 第 1 / 2 / 3 档依次点亮 */
    if(L.x < VIEW.x0 - 46 || L.x > VIEW.x1 + 46) continue;
    const on = 0.82 + 0.18 * Math.sin(t * 2.1 + L.x * 0.05);
    /* 灯泡：先给一颗小而亮的芯，「这是一盏灯」才成立 */
    const g = ctx.createRadialGradient(L.x, SC05_LAMP_HEAD_Y, 0, L.x, SC05_LAMP_HEAD_Y, 16);
    g.addColorStop(0.00, 'rgba(255,252,236,' + sa(0.95 * on + 0.05 * fl) + ')');
    g.addColorStop(0.35, 'rgba(255,228,170,' + sa(0.62 * on) + ')');
    g.addColorStop(1.00, 'rgba(255,196,128,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(L.x, SC05_LAMP_HEAD_Y, 16, 0, Math.PI * 2); ctx.fill();
    /* 外层光晕：收小、压淡，别把灯杆和芦苇糊成一团光 */
    const h = ctx.createRadialGradient(L.x, SC05_LAMP_HEAD_Y, 0, L.x, SC05_LAMP_HEAD_Y, 40);
    h.addColorStop(0.00, 'rgba(255,206,140,' + sa(0.15 * on) + ')');
    h.addColorStop(0.55, 'rgba(255,186,120,' + sa(0.05 * on) + ')');
    h.addColorStop(1.00, 'rgba(255,180,110,0)');
    ctx.fillStyle = h;
    ctx.beginPath(); ctx.arc(L.x, SC05_LAMP_HEAD_Y, 40, 0, Math.PI * 2); ctx.fill();
    /* 往下的光锥：灯照岸脚，别照到水面以外 */
    const cg = ctx.createLinearGradient(0, SC05_LAMP_HEAD_Y, 0, SC05_LAMP_BASE_Y + 6);
    cg.addColorStop(0.00, 'rgba(255,214,158,' + sa(0.11 * on) + ')');
    cg.addColorStop(1.00, 'rgba(255,206,150,0)');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.moveTo(L.x - 7, SC05_LAMP_HEAD_Y);
    ctx.lineTo(L.x + 7, SC05_LAMP_HEAD_Y);
    ctx.lineTo(L.x + 26, SC05_LAMP_BASE_Y + 6);
    ctx.lineTo(L.x - 26, SC05_LAMP_BASE_Y + 6);
    ctx.closePath(); ctx.fill();
    /* 水面倒影：断成几截，才像被波纹切开 */
    for(let k = 0; k < 5; k++){
      const yy = SC05_LAMP_BASE_Y + 3 + k * 5.4;
      const ww = 9 - k * 1.2;
      ctx.fillStyle = 'rgba(255,222,164,' + sa((0.20 - k * 0.032) * on) + ')';
      ctx.fillRect(L.x - ww * 0.5 + Math.sin(t * 1.3 + k) * 1.4, yy, ww, 1.2);
    }
  }
  /* ③ 灯亮之后整条岸暖一档：这是「村子回来了」的整体感，不靠加亮单盏灯 */
  if(litN >= 2){
    const warm = ctx.createLinearGradient(0, 150, 0, H);
    warm.addColorStop(0.00, 'rgba(255,196,130,0)');
    warm.addColorStop(0.55, 'rgba(255,196,130,' + sa(0.030 * (litN - 1)) + ')');
    warm.addColorStop(1.00, 'rgba(255,186,120,0)');
    ctx.fillStyle = warm;
    ctx.fillRect(VIEW.x0, 150, VIEW.w, Math.max(H - 150, VIEW.y1 - 150));
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function scenePropsLamp(t, allLit){
  const cam = game.cam;

  /* 三盏灯不是到齐才一起亮的：每击破一只吞光灯怪收回一盏，
     罩内玻璃、光晕、黑雾、芦苇受压程度都按 lampsLit 分三档推进。
     原来只在 lampsLit>=3 时整体翻牌，前两盏收回时画面上一点变化都没有，
     「一盏路灯亮了」就成了一句没有着落的话。 */
  const litN = allLit ? 3 : clamp(game.lampsLit | 0, 0, 3);
  const la   = litN / 3;
  const fl   = clamp((game.lampFlash || 0) / LAMP_FLASH_T, 0, 1);   /* 刚点亮那一下 */

  /* 远村暖窗：灯亮之后更亮，表示小屋回到远景 */
  const wins = [[300,206,11],[356,212,9],[214,208,10],[408,204,9],[268,214,8]];
  const wN   = 3 + Math.round(2 * la);
  const woff = ((cam * 0.30) % 480 + 480) % 480;
  const a0   = 0.16 + 0.18 * la;
  ctx.globalAlpha = 1;
  for(let i = 0; i < wN; i++){
    const wx = wins[i][0] - woff;
    if(wx < VIEW.x0 - 30 || wx > VIEW.x1 + 30) continue;
    const wy = wins[i][1], wr = wins[i][2];
    const wg = ctx.createRadialGradient(wx, wy, 0, wx, wy, wr);
    wg.addColorStop(0,    'rgba(231,182,127,' + sa(a0) + ')');
    wg.addColorStop(0.45, 'rgba(231,182,127,' + sa(a0 * 0.4) + ')');
    wg.addColorStop(1,    'rgba(231,182,127,0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = wg;
    ctx.fillRect(wx - wr, wy - wr, wr * 2, wr * 2);
  }

  /* 矮木栅栏：在 340–400 之间给路灯让位 */
  const fgap = 22, foff = ((cam * 0.5) % fgap + fgap) % fgap;
  ctx.strokeStyle = 'rgba(56,42,60,' + sa(0.80) + ')';
  ctx.lineWidth = 1.3;
  for(let i = Math.floor((VIEW.x0 + foff) / fgap) - 1; i <= Math.ceil((VIEW.x1 + foff) / fgap) + 1; i++){
    const x = i * fgap - foff;
    if(x > 336 && x < 402) continue;
    ctx.beginPath(); ctx.moveTo(x, 228); ctx.lineTo(x, 240); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(56,42,60,' + sa(0.58) + ')';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(VIEW.x0 - 8, 232); ctx.lineTo(VIEW.x1 + 8, 232); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(VIEW.x0 - 8, 237); ctx.lineTo(VIEW.x1 + 8, 237); ctx.stroke();

  /* 芦苇：底部一丛丛细长曲线。原来每丛十几根、根根笔直，
     远看像一道栅栏，所以减到五六根、加大高差和弯度，8.9 之后摆幅收到三分之一。 */
  const sway = (1 - 0.65 * la);
  const clumps = [[338,6,1.00],[362,5,0.82],[396,7,1.10],[446,5,0.90],[470,4,0.74]];
  ctx.lineCap = 'round';
  for(let c = 0; c < clumps.length; c++){
    const bx = clumps[c][0], n = clumps[c][1], sc2 = clumps[c][2];
    for(let i = 0; i < n; i++){
      const x0 = bx + Math.sin(i * 3.1 + c) * 6;
      const h  = (20 + ((i * 41 + c * 17) % 26)) * sc2;
      const bend = Math.sin(t * 1.4 + i * 1.3 + c * 1.9) * 5 * sway;
      ctx.strokeStyle = 'rgba(34,27,48,' + sa(0.80) + ')';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(x0, 250);
      ctx.quadraticCurveTo(x0 - bend * 0.4, 250 - h * 0.55, x0 + bend, 250 - h);
      ctx.stroke();
      /* 芦花：顶端一小撮，让芦苇有头，不是一堆竖线 */
      if((i + c) % 2 === 0){
        ctx.fillStyle = 'rgba(72,58,84,' + sa(0.55) + ')';
        ctx.beginPath();
        ctx.ellipse(x0 + bend, 250 - h, 1.6, 3.6, bend * 0.06, 0, 6.2832);
        ctx.fill();
      }
    }
  }
  ctx.lineCap = 'butt';

  /* 旧路灯：歪斜的杆 + 梯形灯罩（8.8 灯只是背景，无 HP、无攻击）。
     杆身加长、灯罩放大到一眼能认出是灯，不然只是一根竖线。 */
  const bx = 448, by = 250, tx = 424, ty = 104;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(48,39,56,' + sa(0.96) + ')';
  ctx.lineWidth = 4.2;
  ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = 'rgba(92,74,102,' + sa(0.55) + ')';
  ctx.beginPath(); ctx.moveTo(bx - 1.4, by - 6); ctx.lineTo(tx - 1.4, ty + 12); ctx.stroke();
  /* 灯亮时杆的上半段被照亮一截 —— 不然整根杆子在夜里就是一条看不见的黑线，
     只剩灯罩悬在半空 */
  if(la > 0.02){
    const pg = ctx.createLinearGradient(tx, ty, bx, by);
    pg.addColorStop(0.00, 'rgba(255,226,174,' + sa(0.42 * la) + ')');
    pg.addColorStop(0.38, 'rgba(255,214,150,' + sa(0.14 * la) + ')');
    pg.addColorStop(1.00, 'rgba(255,214,150,0)');
    ctx.strokeStyle = pg;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(tx + 1.8, ty + 8); ctx.lineTo(bx + 1.8, by); ctx.stroke();
  }
  /* 杆脚：一小块石基，让杆子站得住 */
  ctx.fillStyle = 'rgba(40,32,48,' + sa(0.94) + ')';
  ctx.beginPath(); ctx.ellipse(bx, by - 1, 6.5, 2.6, 0, 0, Math.PI * 2); ctx.fill();
  /* 杆上的斜撑 + 灯臂 */
  ctx.strokeStyle = 'rgba(48,39,56,' + sa(0.96) + ')';
  ctx.lineWidth = 2.0;
  ctx.beginPath(); ctx.moveTo(bx - 4, by - 30); ctx.lineTo(tx + 10, ty + 26); ctx.stroke();
  ctx.lineWidth = 2.6;
  ctx.beginPath(); ctx.moveTo(tx + 1, ty + 2); ctx.lineTo(tx - 15, ty - 10); ctx.stroke();

  const hx = tx - 18, hy = ty - 15;
  /* 灯罩：梯形 + 顶盖 */
  ctx.fillStyle = 'rgba(58,46,66,' + sa(0.96) + ')';
  ctx.beginPath();
  ctx.moveTo(hx - 11, hy - 3); ctx.lineTo(hx + 11, hy - 3);
  ctx.lineTo(hx + 16, hy + 13); ctx.lineTo(hx - 16, hy + 13);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(38,30,46,' + sa(0.96) + ')';
  ctx.fillRect(hx - 13, hy - 6, 26, 4);
  /* 罩内的玻璃：暗时只透一点灰，点亮一档就暖一档 */
  const ga = 0.40 + 0.55 * la;
  const gr = Math.round(120 + 135 * la);
  const gg = Math.round(104 + 132 * la);
  const gb = Math.round(124 + 72 * la);
  ctx.fillStyle = 'rgba(' + gr + ',' + gg + ',' + gb + ',' + sa(ga) + ')';
  ctx.beginPath();
  ctx.moveTo(hx - 9, hy + 1); ctx.lineTo(hx + 9, hy + 1);
  ctx.lineTo(hx + 13, hy + 11); ctx.lineTo(hx - 13, hy + 11);
  ctx.closePath(); ctx.fill();

  /* 光晕：未点亮只有一丝余温，每亮一档涨一截 */
  const gAmt = 0.18 + 0.82 * la;
  const gw   = 0.46 + 0.54 * la;
  const lx = hx, ly = hy + 6;
  const lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, 92 * gw);
  lg.addColorStop(0,    'rgba(255,230,186,' + sa(0.52 * gAmt) + ')');
  lg.addColorStop(0.28, 'rgba(231,182,127,' + sa(0.26 * gAmt) + ')');
  lg.addColorStop(0.62, 'rgba(214,160,124,' + sa(0.10 * gAmt) + ')');
  lg.addColorStop(1,    'rgba(231,182,127,0)');
  ctx.globalAlpha = 1;
  ctx.fillStyle = lg;
  ctx.fillRect(lx - 100, ly - 100, 200, 200);

  /* 刚点亮的那一下：一团短促的白热 + 一圈扩散的光环，
     让「一盏路灯亮了」在画面里有个明确的落点，而不只是一行字。 */
  if(fl > 0.001){
    const e = fl * fl;
    const bg2 = ctx.createRadialGradient(lx, ly, 0, lx, ly, 46 + 22 * (1 - fl));
    bg2.addColorStop(0,    'rgba(255,248,222,' + sa(0.62 * e) + ')');
    bg2.addColorStop(0.42, 'rgba(255,222,168,' + sa(0.28 * e) + ')');
    bg2.addColorStop(1,    'rgba(255,206,140,0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = bg2;
    ctx.fillRect(lx - 80, ly - 80, 160, 160);

    /* 扩散的柔光环：不用描边圆 —— 硬边圆环在夜景里会读成 UI 元件，
       和手绘水彩的调子不搭，改用一圈带软边的光晕往外推。 */
    const rr = 24 + 58 * (1 - fl);
    const og = ctx.createRadialGradient(lx, ly, rr * 0.52, lx, ly, rr);
    og.addColorStop(0,    'rgba(255,232,186,0)');
    og.addColorStop(0.72, 'rgba(255,228,176,' + sa(0.26 * e) + ')');
    og.addColorStop(1,    'rgba(255,214,150,0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = og;
    ctx.fillRect(lx - rr, ly - rr, rr * 2, rr * 2);
  }

  /* 未点亮时被黑雾包裹（8.8）；每收回一盏雾退一档，第三盏之后全散（8.9） */
  if(la < 0.98){
    const fa = 1 - la;
    const fg2 = ctx.createRadialGradient(lx, ly, 6, lx, ly, 74);
    fg2.addColorStop(0,   'rgba(12,8,22,' + sa(0.72 * fa) + ')');
    fg2.addColorStop(0.6, 'rgba(12,8,22,' + sa(0.34 * fa) + ')');
    fg2.addColorStop(1,   'rgba(12,8,22,0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = fg2;
    ctx.fillRect(lx - 78, ly - 78, 156, 156);
  }
  ctx.lineCap = 'butt';
}

/* ==================== WB21 可见世界范围（背景连续绘制） ====================
   逻辑世界固定 480×270：角色、敌人、子弹、碰撞、移动范围、关卡数值全都不动。
   手机横屏比 16:9 宽出来的那部分，**只让背景继续往 x<0 / x>W 画**，不复制任何战斗对象。

   VIEW 是本帧可见范围，单位与世界坐标一致，由 render() 每帧按 game.core 反推：
   世界 x=0 落在核心左边缘、x=W 落在核心右边缘，所以
     VIEW.x0 = -core.x / (core.w/W)          （负数 = 左补边对应的世界宽度）
     VIEW.x1 = W + (容器宽 - core.x - core.w) / (core.w/W)
   所有背景层只读 VIEW，不再写死 0..W；相机、缩放、时间、各层视差速度仍是同一套。 */
const VIEW = { x0: 0, x1: W, y0: 0, y1: H, w: W, h: H, cx: W / 2, cy: H / 2 };
function setView(core, cssW, cssH){
  const sx = core.w / W, sy = core.h / H;
  /* 各向外扩 2 世界像素：换尺寸/dpr 取整时不会在画布边缘留一条缝 */
  VIEW.x0 = Math.floor(-core.x / sx) - 2;
  VIEW.x1 = Math.ceil(W + (cssW - core.x - core.w) / sx) + 2;
  VIEW.y0 = Math.floor(-core.y / sy) - 2;
  VIEW.y1 = Math.ceil(H + (cssH - core.y - core.h) / sy) + 2;
  VIEW.w = VIEW.x1 - VIEW.x0;
  VIEW.h = VIEW.y1 - VIEW.y0;
  VIEW.cx = (VIEW.x0 + VIEW.x1) / 2;
  VIEW.cy = (VIEW.y0 + VIEW.y1) / 2;
}
/* 以 period 为周期把某层铺满可见范围：x = i*period - off。
   返回需要绘制的索引区间（含两侧各多一块，防止取整露缝）。 */
function tileFrom(period, off){
  return Math.floor((VIEW.x0 + off) / period) - 1;
}
function tileTo(period, off){
  return Math.ceil((VIEW.x1 + off) / period) + 1;
}

/* ---- 单场景整张绘制：天空 → 星 → 月 → 云 → 远山 → 村舍 → 地平线 → 土层 → 雾 → 构件 ---- */
const MOUNT_FADE = 0.30;   /* 远山条带底边渐隐占条带高度的比例 */
/* 月亮：位置与直径逐场景不同，SC02 是唯一的大满月。
   v1.12.3：抽成函数，因为生图场景要把月亮画在条带**之后** ——
   条带顶部是雾的透明过渡区，月亮画在条带前面就会被雾啃掉下半。 */
function drawMoonLayer(sc, t){
  if(!sc.moon || !bgOk('moon')) return;
  {
    const im = BG_IMG.moon;
    const d  = sc.moon.d;
    const mx = sc.moon.x + Math.sin(t * 0.13) * 3, my = sc.moon.y;
    const mg = ctx.createRadialGradient(mx, my, d * 0.40, mx, my, d * 1.18);
    mg.addColorStop(0,    'rgba(255,242,205,' + sa(sc.moon.glow) + ')');
    mg.addColorStop(0.45, 'rgba(214,190,246,' + sa(0.10) + ')');
    mg.addColorStop(1,    'rgba(180,150,240,0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = mg;
    ctx.fillRect(mx - d * 1.3, my - d * 1.3, d * 2.6, d * 2.6);
    /* 月亮贴图本身在马海交界处有一条硬横线，1:1 铺到 220 屏幕像素时会被放大成缝，
       给 0.6px 模糊化成水彩的柔边，顺带让边缘不那么"贴上去"。 */
    setA(1);
    ctx.filter = 'blur(0.6px)';
    ctx.drawImage(im, mx - d * 0.5, my - d * 0.5, d, d);
    ctx.filter = 'none';
    /* V02：再收一层纹理 —— 但不再用一层平铺的冷紫（那样月盘会发灰、像一块贴纸）。
       改成「中心暖、边缘沉的球面渐变」：中间留一点奶油暖调，边缘压暗做体积，
       外加一圈极细的亮边把月亮从夜空里剥出来。 */
    ctx.save();
    ctx.beginPath(); ctx.arc(mx, my, d * 0.5, 0, Math.PI * 2); ctx.clip();
    const wm = ctx.createRadialGradient(mx - d * 0.13, my - d * 0.15, d * 0.05,
                                        mx, my, d * 0.53);
    wm.addColorStop(0.00, 'rgba(255,247,220,' + sa(0.20) + ')');
    wm.addColorStop(0.50, 'rgba(255,236,196,' + sa(0.09) + ')');
    wm.addColorStop(0.82, 'rgba(126,92,72,'  + sa(0.16) + ')');
    wm.addColorStop(1.00, 'rgba(86,60,52,'    + sa(0.34) + ')');
    ctx.globalAlpha = 1;
    ctx.fillStyle = wm;
    ctx.fillRect(mx - d*0.5, my - d*0.5, d, d);
    ctx.restore();
    /* 细亮边：让月盘边界清楚，不至于和云糊在一起 */
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(255,248,222,' + sa(0.30) + ')';
    ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.arc(mx, my, d * 0.5 - 0.7, 0, Math.PI * 2); ctx.stroke();
  }

}

function drawSceneLayer(key, t){
  const sc = SCENE_DEF[key];
  if(!sc) return;
  const cam = game.cam;
  ctx.save();

  /* 天空（gradient 的 alpha 承担交叉淡入，所以 globalAlpha 保持 1）
     WB21：铺满整个可见范围。gradient 仍按世界 0..H 定义，
     超出部分由 canvas 自动沿用首/末色标 —— 竖边不会因为换高度而变色。 */
  const grd = ctx.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0,    hexA(sc.sky[0], 1));
  grd.addColorStop(0.42, hexA(sc.sky[1], 1));
  grd.addColorStop(0.72, hexA(sc.sky[2], 1));
  grd.addColorStop(1,    hexA(sc.sky[3], 1));
  ctx.globalAlpha = 1;
  ctx.fillStyle = grd;
  ctx.fillRect(VIEW.x0, VIEW.y0, VIEW.w, VIEW.h);

  /* 星：星表本身是 0..W 的一段随机分布，按 W 为周期续铺到可见范围两侧。
     星不随相机移动，重复周期看不出来（也不必为手机重做一张更宽的星图）。 */
  for(let i = 0; i < SKY_STARS.length; i++){
    const st = SKY_STARS[i];
    if(st.y > 212) continue;
    const tw = 0.55 + 0.45 * Math.sin(t * 2 + st.p);
    const lum = st.b / 255;                 // V04：每颗星自己的亮度，不再是同一档亮
    ctx.fillStyle = 'rgba(255,246,214,' + sa((0.16 + tw * 0.42) * lum * sc.stars) + ')';
    for(let k = tileFrom(W, -st.x); k <= tileTo(W, -st.x); k++){
      const xx = st.x + k * W;
      if(xx < VIEW.x0 - 2 || xx > VIEW.x1 + 2) continue;
      ctx.fillRect(xx | 0, st.y | 0, st.s, st.s);
    }
  }
  ctx.globalAlpha = 1;

  /* 村口湖岸的远景山：必须画在月亮**之前**。
     条带顶部是「山脊以上的天空」，虽然在资源里做了长渐变，但它终究是不透明的整条，
     画在月亮上面会把月盘下半截切平。放到月亮前面，月亮就完整地压在远山之上。
     条带一直裁到源图 0.70，底边落在 229（水面以下，被中景盖住）——
     中景树冠被蒙版挖空的地方会露出后面，条带底边若停在可见区内就会从树缝里露出硬边。 */
  if(sc.art) drawLayer(sc.art.far, 229, 0.10, 1, 0, 0);

  if(!sc.moonTop) drawMoonLayer(sc, t);
  /* 云 */
  for(let i = 0; i < CLOUDS.length; i++){
    const c = CLOUDS[i];
    if(!bgOk(c.k)) continue;
    const im = BG_IMG[c.k];
    const ch = c.w * im.logH / im.logW;
    let x = c.x - cam * c.s;
    x = ((x % TW) + TW) % TW;
    /* 桥下与湖岸终段抬头只看得到一线天，云要压下来，不然六个场景都长一样 */
    let ca = c.a * (sc.cloud == null ? 1 : sc.cloud);
    /* WB21：云的循环份数按可见范围算，不再固定 -1..1 三份 */
    const k0 = Math.floor((VIEW.x0 - x) / TW) - 1;
    const k1 = Math.ceil((VIEW.x1 - x) / TW) + 1;
    /* v1.12.3：云不从月亮上过。月亮是这一屏的定位点，被云啃掉一截会读成
       「月亮缺了一块」；与月盘相交的云只留一层薄纱，保证整轮月亮都在。
       月亮是绝对世界坐标、只画一次，所以这里按世界坐标判一次就够。 */
    if(sc.moon){
      const mr = sc.moon.d * 0.78;
      for(let k = k0; k <= k1; k++){
        const xx = x + k * TW;
        if(xx + c.w > sc.moon.x - mr && xx < sc.moon.x + mr &&
           c.y + ch > sc.moon.y - mr && c.y < sc.moon.y + mr){ ca *= 0.14; break; }
      }
    }
    setA(ca);
    for(let k = k0; k <= k1; k++){
      const xx = x + k * TW;
      if(xx + c.w < VIEW.x0 - 2 || xx > VIEW.x1 + 2) continue;
      ctx.drawImage(im, xx, c.y, c.w, ch);
    }
  }
  ctx.globalAlpha = 1;

  /* 远山 / 村舍：贴图条带，横向镜像无缝循环。
     远山条带下缘做渐隐，山脚化进村舍的夜雾里，不再是一条笔直的底边
     （贴图底部本来是一条实心雾带，硬边正好落在村舍屋脊上方，读起来像被切了一刀）。 */
  /* 村口湖岸（SC01/SC02）：远景山与中景岸/水都换成生图条带。
     原来那套 mount / town 贴图 + 「渐变 + 横线」的程序化水面，在这一屏里
     底部会被读成一堵暗墙，所以整个换掉。 */
  if(sc.art){
    drawLayer(sc.art.mid, H,   0.30, 1, 0, 0);
    /* WB21：容器比 16:9 **更高**时（平板 4:3 横屏），核心下缘之外还要有水。
       把同一条带按可见底边再铺一次、只取核心以下那一段：
       取的是条带自己的近水段，既不是拉伸也不是镜像，相机与视差完全一致。 */
    if(VIEW.y1 > H + 0.5){
      ctx.save();
      ctx.beginPath();
      ctx.rect(VIEW.x0, H, VIEW.w, VIEW.y1 - H + 1);
      ctx.clip();
      drawLayer(sc.art.mid, VIEW.y1, 0.30, 1, 0, 0);
      ctx.restore();
    }
    /* v1.12.2：条带自带水面与那盏旧路灯，这里只叠会动的东西 ——
       月光碎影、路灯点亮后的光罩 / 光锥 / 水面倒影。 */
    if(sc.moonTop) drawMoonLayer(sc, t);
    if(sc.lampArt) scenePropsLampArt(t);
  } else {
    drawLayer('mount', 212, 0.14, sc.mount.a, sc.mount.dy, MOUNT_FADE);

    /* 山脚过渡带：一条极淡的雾横跨「远山底边 → 村舍屋脊」这段，
       垫在村舍下面，透过村舍顶部那段半透明的雾，把叠合处再抹匀一遍。 */
    if(BG_IMG.mount && BG_IMG.mount.logH){
      const mBot = 212 + (sc.mount.dy || 0);
      const gy = mBot - BG_IMG.mount.logH * MOUNT_FADE - 3;
      const gp = ctx.createLinearGradient(0, gy, 0, mBot + 16);
      gp.addColorStop(0.00, 'rgba(124,108,152,' + sa(0.00) + ')');
      gp.addColorStop(0.46, 'rgba(116,100,144,' + sa(0.10) + ')');
      gp.addColorStop(1.00, 'rgba(92,78,122,'  + sa(0.00) + ')');
      ctx.globalAlpha = 1;
      ctx.fillStyle = gp;
      ctx.fillRect(VIEW.x0, gy, VIEW.w, mBot + 16 - gy);
    }

    drawLayer('town',  248, 0.36, sc.town.a,  sc.town.dy);

    /* 村舍暖光校正：贴图本身偏冷灰，窗光看起来是白的。
       在村舍带范围内压一层很淡的暖色 screen，把墙和窗拉回「有人住」的温度。
       只作用在 185.5–248 这条带里，山和天空不受影响。 */
    if(BG_IMG.town && BG_IMG.town.logH){
      const ty = 248 - BG_IMG.town.logH + (sc.town.dy || 0);
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const wg = ctx.createLinearGradient(0, ty, 0, 248);
      wg.addColorStop(0.00, 'rgba(84,50,24,'  + sa(0.10) + ')');
      wg.addColorStop(0.62, 'rgba(104,62,26,' + sa(0.17) + ')');
      wg.addColorStop(1.00, 'rgba(54,30,14,'  + sa(0.05) + ')');
      ctx.globalAlpha = 1;
      ctx.fillStyle = wg;
      ctx.fillRect(VIEW.x0, ty, VIEW.w, 248 - ty);
      ctx.restore();
    }
  }

  /* 地平线暖光：上下都收口，否则末端 0.14 的透明度会在 y=248 处留一道台阶 */
  const hg = ctx.createLinearGradient(0, H - 32, 0, H - 12);
  hg.addColorStop(0.00, 'rgba(196,150,190,0)');
  hg.addColorStop(0.52, 'rgba(196,150,190,' + sa(0.13) + ')');
  hg.addColorStop(1.00, 'rgba(196,150,190,0)');
  ctx.globalAlpha = 1;
  ctx.fillStyle = hg;
  ctx.fillRect(VIEW.x0, H - 32, VIEW.w, 20);

  /* 渐深土层：顶端 8px 淡入，接住村舍/水面那条带，
     否则 y=244 处会留下一条贯穿全屏的硬边（六个场景里五个都能测到）。
     WB21：一直铺到可见范围底边 —— 容器比 16:9 更高时（平板 4:3），
     底下那几十像素由这条**同一渐变**的最深一档填满，不是另画一块遮罩。 */
  if(!sc.art){
  const gg = ctx.createLinearGradient(0, H - 34, 0, H);
  gg.addColorStop(0.00, hexA('#3A2B47', 0));
  gg.addColorStop(0.26, hexA('#3A2B47', 0.88));
  gg.addColorStop(0.40, hexA('#241A33', 1));
  gg.addColorStop(0.66, hexA('#170F24', 1));
  gg.addColorStop(1.00, hexA('#0A0713', 1));
  ctx.fillStyle = gg;
  ctx.fillRect(VIEW.x0, H - 34, VIEW.w, Math.max(34, VIEW.y1 - (H - 34)));
  }

  /* 低空雾：贴图顶边硬，先用「顶边渐隐」副本，雾才是从夜雾里渗出来的一条 */
  for(let i = 0; i < 2; i++){
    const k = 'mist' + (i + 1);
    if(!bgOk(k)) continue;
    const im = layerTopFaded(k, 0.55) || BG_IMG[k];
    const mw = 300 + i * 120, mh = mw * BG_IMG[k].logH / BG_IMG[k].logW;
    let x = i * 430 - cam * (0.52 + i * 0.16);
    x = ((x % TW) + TW) % TW;
    setA(sc.mist * 1.25);
    const m0 = Math.floor((VIEW.x0 - x) / TW) - 1;
    const m1 = Math.ceil((VIEW.x1 - x) / TW) + 1;
    for(let j = m0; j <= m1; j++){
      const xx = x + j * TW;
      if(xx + mw < VIEW.x0 - 2 || xx > VIEW.x1 + 2) continue;
      ctx.drawImage(im, xx, H - 116 + i * 20, mw, mh);
    }
  }
  ctx.globalAlpha = 1;

  /* 各场景自己的构件 */
  if(sc.art){ /* 条带里已经有岸 / 芦苇 / 倒影，不必再叠程序化构件 */ }
  else if(sc.props === 'village')      scenePropsVillage(t);
  else if(sc.props === 'lake')    scenePropsLake(t, { mx: sc.moon ? sc.moon.x : undefined });
  else if(sc.props === 'backhouse') scenePropsBackhouse(t);
  else if(sc.props === 'bridge'){
    /* 8.6「石桥顶部从右侧进入」：用向右推进的擦入，而不是平移整组桥。
       平移会让循环柱阵里凭空多出一根远处的柱子，擦入才是从右边推出来的读感。 */
    const u = clamp(game.bridgeIn == null ? 1 : game.bridgeIn, 0, 1);
    if(u > 0.002){
      /* WB21：擦入前沿从**可见范围**的外缘推起，否则手机两侧的补边会先露出桥、
         中间反而还没有 —— 读起来像桥是从屏幕中间长出来的。 */
      const ex = VIEW.x0 + VIEW.w * (1 - u);
      ctx.save();
      ctx.beginPath(); ctx.rect(ex, VIEW.y0, VIEW.x1 - ex + 2, VIEW.h);
      ctx.clip();
      scenePropsBridge(t, 0);
      ctx.restore();
      if(u < 0.998){
        /* 前沿一条柔光，桥是从夜雾里推出来的，不是被刀切开的 */
        const eg = ctx.createLinearGradient(ex - 30, 0, ex + 4, 0);
        eg.addColorStop(0, 'rgba(126,106,148,0)');
        eg.addColorStop(1, 'rgba(126,106,148,' + sa(0.34) + ')');
        ctx.globalAlpha = 1;
        ctx.fillStyle = eg;
        ctx.fillRect(ex - 30, 54, 34, 26);
      }
    }
  }
  /* 路灯：归途阶段全亮；战斗阶段每击破一只灯怪补亮一盏 */
  else if(sc.props === 'lamp'){
    /* R04：湖岸路灯 / 萤火归途同样在湖边 —— 先铺同一套水面（月影、暖窗倒影、反光横线），
       再叠路灯构件，让最终战下部读得出连续水体，而不是一片深紫土带。
       这两段岸上有栅栏和芦苇（y 228–250），所以水线压到 232，只当近岸一条浅水。 */
    const allLit = (key === 'SC06') || game.lampsLit >= 3;
    scenePropsLake(t, { top: 232, near: true,
                        mx: sc.moon ? sc.moon.x : undefined,
                        lit: allLit ? 1 : clamp((game.lampsLit | 0) / 3, 0, 1) });
    scenePropsLamp(t, allLit);
  }

  ctx.restore();
}

/* ---- 场景推进：相位决定目标场景，切换做 1.2 秒交叉淡入 ---- */
function targetScene(){
  if(game.teaTime) return 'SC06';
  const id = game.phaseId;
  if(id === 'PH01') return (game.phaseT >= 18) ? 'SC02' : 'SC01';
  if(id === 'PH02') return (game.transT > 0) ? 'SC04' : 'SC03';   /* 击破过渡里桥顶开始进场 */
  if(id === 'PH03') return 'SC04';
  if(id === 'PH04' || id === 'PH05') return 'SC05';
  if(id === 'PH06') return 'SC06';
  return 'SC01';
}

function updateScene(dt){
  const want = targetScene();
  if(want !== game.sceneKey){
    game.scenePrev = game.sceneKey;
    game.sceneKey  = want;
    game.sceneFade = 0;
  }
  if(game.sceneFade < 1) game.sceneFade = Math.min(1, game.sceneFade + dt / 1.20);

  /* 8.6：中 Boss 击破后的 0.8 秒过渡里，石桥顶部从右侧进入 */
  if(game.phaseId === 'PH03' || (game.phaseId === 'PH02' && game.transT <= 0)){
    game.bridgeIn = 1;
  } else if(game.phaseId === 'PH02'){
    game.bridgeIn = clamp(1 - game.transT / BOSS_EXIT_T, 0, 1);
  } else {
    game.bridgeIn = 0;
  }
}

function drawBackground(t){
  ctx.imageSmoothingEnabled = true;

  /* 交叉淡入：旧场景整张铺底，新场景按进度盖上去。
     直接两层各给 0.5 会让中途整体发暗，所以第二层用进度当透明度。 */
  if(game.sceneFade < 1 && game.scenePrev && SCENE_DEF[game.scenePrev]){
    SCENE_A = 1;
    drawSceneLayer(game.scenePrev, t);
  }
  SCENE_A = (game.sceneFade < 1) ? game.sceneFade : 1;
  drawSceneLayer(game.sceneKey || 'SC01', t);
  SCENE_A = 1;

  ctx.globalAlpha = 1;
  ctx.imageSmoothingEnabled = false;
}

/* 贴图条带铺一层到整屏：bottom 为条带底边的逻辑 y，alpha/dy 供场景调显隐与高度，
   fade>0 时改用「底边渐隐」副本（占条带高度的比例），让条带下缘化进下一层而不是硬切。
   WB21：条带本身是「A + 镜像(A)」的完整循环周期，所以按周期续铺就必然无缝；
   份数由可见范围算（原来固定画 2 份、只覆盖 0..W，手机两侧就只能是补边带）。 */
function drawLayer(k, bottom, sp, alpha, dy, fade){
  const base = BG_IMG[k];
  if(!base || !base.complete || !base.logW) return;
  const a = (alpha == null) ? 1 : alpha;
  if(a <= 0) return;
  const im = (fade > 0) ? layerFaded(k, fade) : base;
  const tw = base.logW, th = base.logH, y = bottom - th + (dy || 0);
  let off = ((game.cam * sp) % tw + tw) % tw;
  setA(a);
  const src = im || base;
  const i0 = tileFrom(tw, off), i1 = tileTo(tw, off);
  for(let i = i0; i <= i1; i++){
    const x = i * tw - off;
    if(x + tw < VIEW.x0 - 2 || x > VIEW.x1 + 2) continue;
    ctx.drawImage(src, x, y, tw, th);
  }
  ctx.globalAlpha = 1;
}

/* ============================ 7. 游戏对象 ============================ */

/* ---- 世界状态 ---- */
/* 当前关卡名：开始页与失败结算页都读这一处，改关卡不用改两遍 */
const STAGE_NAME = '第一关 · 湖畔夜巡';

const game = {
  dbg: false,                      // F1 / ` 切换碰撞调试层
  state:'title',                  // title play pause win lose
  t:0, cam:0, elapsed:0, scroll:82,
  score:0, kills:0, bloomMaxLv:1, lampsLit:0, lampFlash:0, lampIgnite:0,
  bloomChargeOff:false,             // v1.10.1：最终 Boss 击破后不再攒绽放能量
  bridgeDone:false, bridgeFade:0,   // v1.11.0：PH03 自然收尾（活怪清零 → 0.30s 散残弹）
  heartsSpawned:0,                  // v1.11.0：本关已生成爱心数（上限 3）
  motes:0,                          // 回收微光数（射击成长另记）
  starsGot:0,                       // 回收星辉数
  wicks:0,                          // 回收魔力灯芯数
  fireflies:0,                      // 萤火归途接到的萤火
  shake:0, flash:0,          /* 提示文字改由 TOAST 队列管理（R14） */
  bossActive:false, bossDead:false, midBossDead:false,
  teaTime:false, cleared:false, failReason:'',
  /* 成功过场：萤火归途收完后小魔女向右飞出屏幕，飞完才弹结算 */
  flyOut:0, flyOutX0:0, flyBackX:0, flyBackY:0, flyBackY0:0,
  warnT:0, flyT:0, flyIdx:0, flyBannerT:0, lakeOn:false,
  /* 场景（策划案 8.4–8.9）：sceneKey 当前场景 / scenePrev 淡出中的旧场景 */
  sceneKey:'SC01', scenePrev:null, sceneFade:1, bridgeIn:0,
  /* 阶段状态机（策划案 9 / 10.3）：phase 是阶段索引，phaseT 是本阶段局部秒数 */
  phase:0, phaseId:'PH01', phaseT:0, phaseEvt:0, transT:0, introT:0,
  lifeBonusGiven:false
};

/* ---- 玩家（策划案 1.1 初始资源：5 生命 / 0 分 / 0 能量 / 2 格魔力 / L1）---- */
const player = {
  x:100, y:133, vx:0, vy:0,
  hp:5, maxHp:5,
  /* 射击成长（4.2）：每回收一颗微光 +1，18 → L2、56 → L3，只升不降 */
  grow:0, shotLv:1,
  /* 四魔法共用三格魔力（4.3） */
  magic:0,                         // 0 炉火 1 雷光 2 爆裂 3 落星
  mp:2, mpT:0,                     // 魔力格 / 缺格恢复累计秒
  /* 星光绽放（4.8）：每一轮绽放有自己的回收数与等级，星辉绑定所属轮次 */
  /* bloomT = 唯一的绽放剩余时间（强化 / 无敌 / 护膜 / HUD 共用这一份） */
  bloom:0, bloomT:0, bloomLv:1, bloomCnt:0, bloomRound:null,
  /* 炉火分段结算 */
  flameT:0, flameAcc:0, flameSeg:0,
  invuln:0, fireT:0, magicLock:0, castT:0, recoil:0, shootAnim:0,
  animT:0, tilt:0, vtilt:0,
  dead:false
};

const enemies = [], pbullets = [], ebullets = [], particles = [];
const pickups = [], popups = [], orbs = [];
/* 绽放的两组受限资源（WB05 预算）：装饰粒子 36 / 命中穿透组 6，都是硬上限 */
const BL_P = [], BL_HIT = [];
const BURSTS = [];   // 火花爆裂的延迟爆破
let boss = null;

/* ---- 常量（策划案 2.2 / 2.3 / 4 章）---- */
const SPD_X = 160, SPD_Y = 155;
const AREA = { x0:28, x1:335, y0:43, y1:225 };
/* 萤火归途要放宽右侧：EVT06 的萤火按 65+((53i)%350) 生成，最右到 x=404，
   还会向左飘 25 左右，原来 x1=335 根本飞不过去，右边两只永远捡不到。
   这个阶段没有敌人，放宽到 428 不会撞到什么。 */
const AREA_TEA_X1 = 428;
const SHOT_IV = 0.15, SHOT_SPD = 380, SHOT_LIFE = 1.4;

/* ---- 受击与碰撞（2.3）----
   玩家受击核心 r9；敌弹 r3，中心距 <12 受伤。
   攻击采用「弹半径 + 目标受弹半径」：普通怪 11、中 Boss 22、终 Boss 30、重雾球 10。 */
const HIT_R_PLAYER = 9, HIT_R_EBULLET = 12;
const HIT_R_TOUCH = 19, HIT_R_BOSS_TOUCH = 36;
const RR_ENEMY = 11, RR_MID = 22, RR_BOSS = 30, RR_ORB = 10;
/* 受弹半径一律取目标自身的权威值：中 Boss 22、终 Boss 30、普通怪 11、重球 10。
   以前 updateBullets / updateBursts 统一套 RR_BOSS=30，中 Boss 的 22 形同虚设
   （距中心 29 的 r4 弹会被判命中）。 */
function bossHitR(b){ return (b && b.r) ? b.r : RR_BOSS; }
const PB_R = 4, PB_R_BLOOM = 6;
const INVULN_T = 1.5;

/* ---- 射击成长（4.2）---- */
/* 1.8.0：三级阈值 0 / 22 / 82，与《普通射击成长.csv》一致。
   判定、成长条、刻度、标题与教学全部读这一份，别再另写 18/56。 */
/* v1.12.0（D01）：射击表回到策划案基准 —— 主弹 1.0 / 1.2 / 1.4、侧弹 0 / 0.2 / 0.3，
   阈值 0 / 22 / 82、射击间隔 0.15 秒不变。弱点 ×1.5 与炉火 8×2 各自独立，
   不靠翻整张表来凑伤害。上一轮「输入 2 点验证弱点倍率」的例子是文档笔误。 */
const SHOT_LV = [
  { need:0,  n:1, main:1.0, side:0.0, ang:0.00 },
  { need:22, n:3, main:1.2, side:0.2, ang:0.04 },
  { need:82, n:3, main:1.4, side:0.3, ang:0.07 }
];
const GROW_MAX = 82;

/* WB01：标题卡的「22 颗 L2 · 82 颗 L3」从这张表生成，HTML 里不再写死。
   改了 SHOT_LV 上面那句数字会自动跟着变，不会再出现「标题还写 18/56」。 */
(function syncGrowHint(){
  const el = document.getElementById('growHint');
  if(!el || SHOT_LV.length < 3) return;
  el.innerHTML = '回收<b>微光</b>让射击变强：<b>' + SHOT_LV[1].need +
                 '</b> 颗 L2 · <b>' + SHOT_LV[2].need + '</b> 颗 L3';
})();

/* ---- 四魔法（4.1 / 4.4–4.7）---- */
const MAGICS = [
  { id:'SK03', name:'FLAME', cn:'炉火', col:'#F5A05C', col2:'#FFD9A0' },
  { id:'SK04', name:'BOLT',  cn:'雷光', col:'#9BD0EE', col2:'#E6F4FF' },
  { id:'SK06', name:'BURST', cn:'爆裂', col:'#C9A6E8', col2:'#F0E0FF' },
  { id:'SK07', name:'STAR',  cn:'落星', col:'#8FE8C8', col2:'#DAFFEC' }
];
const MAGIC_CD = 1.00;      // 共同施法间隔
const FIRE_MAX = 3;             // CH01：炉火库存上限 3，开局 0

/* CH01：炉火是唯一库存技能，0–3 次。唯一来源是「玩家有效击破吞光灯怪」；
   微光 / 星辉 / 灯芯 / 等待时间 / PH04 路灯 / 中 Boss 恢复一律不再给炉火。
   source 不是 'carrier' 就整条拒绝并返回 0，调用方据此决定是否播反馈。 */
function addFire(n, source){
  if(source !== 'carrier') return 0;
  const before = player.fireAmmo;
  player.fireAmmo = clamp(player.fireAmmo + n, 0, FIRE_MAX);
  return player.fireAmmo - before;
}
const FLAME_T = 1.0, FLAME_SEG = 0.12, FLAME_N = 8, FLAME_DMG = 2, FLAME_BAND = 18;
const BOLT_DMG = 2;
const BURST_DELAY = 0.25, BURST_R = 72, BURST_DMG = 9, BURST_RANGE = 260;
const BURST_CLEAR_R = BURST_R;          // 4.6：范围清弹半径与伤害半径同一把尺
const FALL_N = 3, FALL_IV = 0.12, FALL_DMG = 4, FALL_SPD = 360, FALL_LIFE = 1.2, FALL_TURN = 540;

/* ---- 星光绽放（4.8 / WB05）----
   时间轴按 绽放特效.csv BF01–BF07：
     τ 0.00–0.32  BF01 开启：抬杖、杖头星芒、半径 12→56 的薄断环
     τ 0.32–4.00  BF02 持续：边光 + 四段短弧 + 扫帚彗尾（尾长 48）
     τ 4.50–5.00  BF06 结束预告：最后 0.5 秒里短弧与彗尾一起收紧
     τ 5.00       BF07 归零：同一帧关掉强化、无敌和全部护膜 / 星光，不留收尾光圈
   v1.10.1：bloomT 是唯一的绽放剩余时间 —— 攻击强化、无敌、持续星光 / 护膜、
   按钮倒计时全部读它；改时长只改 BLOOM_T 一处，四者一起变。
   原来那 0.24 秒「只收光」的尾巴已删除：无敌结束后不能再留像仍受保护的光圈。 */
const BLOOM_T = 5.0, BLOOM_DMG = 1.5, BLOOM_CLEAR_R = 56;
const BLOOM_HP_RATE = 0.5;              // v1.10.1：每 1 点 Boss 真实生命损失 +0.5 能量
const BL_IN = 0.32, BL_HOLD = 4.50, BL_OUT = 5.00;
const BL_DECOR_MAX = 36;        // 装饰粒子预算
const BL_DECOR_LOW = 18;        // 最低档（手机上再按档位取）
const BL_HIT_MAX = 6;           // 命中 / 穿透组同时上限
const BL_HIT_LOW = 3;
const BL_HIT_IV = 0.06;         // 全局生成间隔
const BL_SAFE_PAD = 6;          // 危险外扩 6 逻辑像素内不再长新装饰
/* 强化弹：命中第一只普通怪后继续，第二只后终止（BF04/BF05、QA31）。
   这里存的是「还能再穿过几只」，所以是 1 而不是 2 —— 写 2 会打穿三只。 */
const BLOOM_PIERCE = 1;
const BLOOM_MOTE = 5;                   // v1.6.0：每颗微光 +5 绽放能量
/* ---- v1.11.0 回血爱心（C15–C21）----
   首轮调校值：fish 8% / head 12%，单关最多 3 颗，每只怪 UID 只掷一次。
   独立分支：24 直接接、80 锁定吸附、220 速度、8 秒寿命，
   不套微光的全屏吸附与 1.8 秒强制回收。 */
const HEART_RATE = { fish: 0.08, head: 0.12 };
const HEART_MAX = 3;
const HEART_PICK = 24, HEART_MAGNET = 80, HEART_SPD = 220, HEART_LIFE = 8;
const HEART_HOME = 88;                  // v1.11.0b：80 半径外主动飘向玩家的速度
/* v1.10.1：帮助里的时长和 BLOOM_T 同源 —— 改时长不用再改文案 */
(function syncBloomHelp(){
  const el = document.getElementById('helpBloom');
  if(!el) return;
  el.textContent = '能量满后开启 ' + BLOOM_T + ' 秒攻击强化，并在这 ' + BLOOM_T +
                   ' 秒内无敌。拾取微光，或命中 Boss 可充能。';
})();
const STARS_LV = [
  /* 星辉单颗得分按本轮回收数分级（道具表 IT10：100/150/200/250/300） */
  { need:0,  score:100 }, { need:2,  score:150 }, { need:4,  score:200 },
  { need:7,  score:250 }, { need:10, score:300 }
];

/* ---- 阶段驱动（策划案 9 章）：胜负不再由全局秒数判定 ----
   route 为固定路线秒数，null 表示由 Boss 击破推进。 */
const BOSS_EXIT_T = 0.80;      // 击破死亡 / 过桥表现时长（7.1 / 7.2）
const INTRO_T = 3.0;           // 开场倒计时（11.2）：只做表现与耗资源技能门禁
const PHASE_TABLE = [
  /* v1.6.0 节奏：45 / 击破 / 43 / 4 / 击破 / 10，固定段合计 102 秒 + 两 Boss 段 */
  { id:'PH01', route:45,   name:'LAKE',   cn:'村口湖岸' },
  { id:'PH02', route:null, name:'IDOL',   cn:'屋后夜团' },   /* WB15：PH02 是屋后夜团，
                                                                  「满月湖面」是 PH01 内部 18 秒后的湖面换景 */
  { id:'PH03', route:43,   name:'BRIDGE', cn:'石桥下'   },
  { id:'PH04', route:4,    name:'WARN',   cn:'湖岸预警' },
  { id:'PH05', route:null, name:'GUARD',  cn:'湖边大夜怪'},
  { id:'PH06', route:10,   name:'TEA',    cn:'萤火归途' }
];

/* ---- 重置 ---- */
function resetWorld(){
  enemies.length = 0; pbullets.length = 0; ebullets.length = 0;
  particles.length = 0; pickups.length = 0; popups.length = 0;
  orbs.length = 0; FXS.length = 0; BURSTS.length = 0;
  LAMP_WISPS.length = 0;
  game.trace = []; game.supplyMote = 0; game.moteMiss = 0;
  /* v1.3.1：在途火种必须随重开清掉，否则上一局的到账会落进新局 */
  clearFireWisps();
  fireRewardSeq = 0;
  boss = null;
  game.t = 0; game.cam = 0; game.elapsed = 0; game.scroll = 82;
  game.score = 0; game.kills = 0; game.bloomMaxLv = 1; game.lampsLit = 0; game.lampIgnite = 0;
  game.lampFlash = 0;
  game.motes = 0; game.starsGot = 0; game.wicks = 0; game.fireflies = 0;
  game.shake = 0; game.flash = 0;
  game.bossActive = false; game.bossDead = false; game.midBossDead = false;
  game.teaTime = false; game.cleared = false; game.failReason = '';
  game.warnT = 0; game.flyT = 0; game.flyIdx = 0; game.flyBannerT = 0;
  game.lakeOn = false;                        // 换景字幕只打一次
  /* 场景回到 SC01，不吃上一局残留的过渡状态 */
  game.sceneKey = 'SC01'; game.scenePrev = null; game.sceneFade = 1; game.bridgeIn = 0;
  game.wallHint = false;
  /* 阶段状态机从 PH01 起步，局部时钟归零（10.3：局部时间不以全局时间反推） */
  game.phase = 0; game.phaseId = PHASE_TABLE[0].id;
  game.phaseT = 0; game.phaseEvt = 0; game.transT = 0; game.introT = INTRO_T;
  game.lifeBonusGiven = false;
  /* CH02：每个 Boss 段至多一只支援灯怪，重开清零 */
  game.supportDone = { PH02:false, F2:false, F3:false };

  player.x = 100; player.y = 133; player.vx = 0; player.vy = 0;
  player.hp = player.maxHp = 5;
  /* 初始资源（1.1）：射击 L1 / 成长 0 / 绽放 0 / 魔力 2 格 / 当前炉火 */
  player.grow = 0; player.shotLv = 1;
  player.magic = 0; player.fireAmmo = 0; player.mpT = 0;
  player.bloom = 0; player.bloomT = 0; player.bloomLv = 1; player.bloomCnt = 0;
  player.bloomRound = null;
  game.bloomChargeOff = false;
  game.bridgeDone = false; game.bridgeFade = 0;
  game.heartsSpawned = 0;
  BL_P.length = 0; BL_HIT.length = 0;
  player.flameT = 0; player.flameAcc = 0; player.flameSeg = 0;
  player.invuln = 0; player.fireT = 0; player.magicLock = 0; player.castT = 0; player.recoil = 0;
  player.shootAnim = 0;
  player.animT = 0; player.tilt = 0; player.vtilt = 0; player.dead = false;
  player.boostOn = false; player.boostHold = 0; player.boostT = 0; player.boostCd = 0; player.boostSkip = false;
  heroAnim.name = 'flight'; heroAnim.t = 0;
  Audio7.mode = 'normal';
}

/* ---- 粒子 / 飘字 ---- */
function spark(x, y, n, colors, spd, life){
  for(let i=0;i<n;i++){
    const a = Math.random()*Math.PI*2, s = rand(spd*0.3, spd);
    particles.push({
      x:x, y:y, vx:Math.cos(a)*s, vy:Math.sin(a)*s,
      life:rand(life*0.5, life), max:life,
      c:pick(colors), sz:pick([1,1,2,2,3])
    });
  }
}
function updateParticles(dt){
  for(let i=particles.length-1;i>=0;i--){
    const p = particles[i];
    p.x += p.vx*dt; p.y += p.vy*dt;
    p.vx *= 0.94; p.vy *= 0.94;
    p.life -= dt;
    if(p.life <= 0) particles.splice(i,1);
  }
}
function drawParticles(){
  for(let i=0;i<particles.length;i++){
    const p = particles[i];
    ctx.globalAlpha = clamp(p.life/p.max, 0, 1);
    ctx.fillStyle = p.c;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), p.sz, p.sz);
  }
  ctx.globalAlpha = 1;
}
function popup(x, y, text, color){
  popups.push({ x:x, y:y, text:text, c:color||'#F6DFA6', t:0, life:0.9 });
}
/* 顶部提示（11.3 / R14）：一条一条排队，不再「新文字直接顶掉旧文字」。
   pri=1 的预兆类提示插到队首，保证「前面有一大团夜雾」这类不会被
   微光 / 切换魔法的碎提示挤掉。 */
const TOAST = { cur:null, t:0, q:[], hold:1.6 };

function flashMsg(text, pri){
  if(!text) return;
  if(TOAST.cur && TOAST.cur.text === text) return;
  for(let i=0;i<TOAST.q.length;i++) if(TOAST.q[i].text === text) return;
  const item = { text:text };
  if(pri) TOAST.q.unshift(item);
  else    TOAST.q.push(item);
  if(TOAST.q.length > 6) TOAST.q.length = 6;      // 兜底：别无限堆积
}

function updateToast(dt){
  const el = document.getElementById('toast');
  if(!TOAST.cur){
    if(!TOAST.q.length) return;
    TOAST.cur = TOAST.q.shift();
    TOAST.t = 0;
    if(el){ el.textContent = TOAST.cur.text; el.classList.add('on'); }
    return;
  }
  TOAST.t += dt;
  if(TOAST.t >= TOAST.hold){
    TOAST.cur = null;
    if(el) el.classList.remove('on');
  }
}

function clearToast(){
  TOAST.cur = null; TOAST.t = 0; TOAST.q.length = 0;
  const el = document.getElementById('toast');
  if(el) el.classList.remove('on');
}
function drawPopups(){
  /* v1.2.0：飘字改用中文字体（原 drawText 是自定义像素字模，中文会变成“??”）。
     「炉火+1」这类带中文的提示必须走 drawCN。 */
  for(let i=0;i<popups.length;i++){
    const p = popups[i];
    const a = clamp(1 - p.t/p.life, 0, 1);
    const y = p.y - p.t*22;
    ctx.save();
    ctx.globalAlpha = a * 0.42;
    ctx.font = '800 8px ' + CN_FONT;
    ctx.textAlign = 'center'; ctx.fillStyle = '#150f22';
    ctx.fillText(p.text, p.x + 0.6, y + 0.9);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = a;
    drawCN(p.text, p.x, y, 8, p.c, 'center', 800);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

/* ============================ 8. 敌人与关卡时间轴 ============================ */
/* 策划案 6 章：5 种普通怪。美术暂用现有立绘占位，靠色调与尺寸区分。 */
/* 策划案 6.1：五种夜怪的生命 / 速度 / 击破分；amp 与 om 是各自的起伏参数

   ---- WB02 密度校准（唯一真源，改这里就够）----
   策划案 569 要求「手机目标可见普通怪通常 3–8 只」「零敌区间 ≤2.4 秒」，
   但按《配置表/怪物.csv》的 2 点生命 + 《普通射击成长.csv》的 0.15 秒间隔：
   L2 每轮 1.6 伤害 → 一只 2 HP 只要 0.3 秒，一波 3 只 0.9 秒清光，
   2.2 秒的波间隔里有 1.3 秒空屏 —— 实测可见怪中位 1、零敌最长 2.6 秒，不达标。
   波次总量（v1.12：103 只 / 39 波）、波间隔（2.2–2.6 秒）、射击成长表三项都被任务书锁死，
   能调的只有敌人耐久：这里按 tools/probe_density.py 的扫描结果抬到
   「可见中位 3、峰值 6、零敌 1.2 秒、整关 153 秒」的一档。
   速度 / 击破分 / 微光数量一律不动，怪的行为逻辑也不变。 */
const ENEMY_HP = { imp:6, fish:6, bat:6, head:8, carrier:10 };
const ENEMY_DEF = {
  imp:     { hp:ENEMY_HP.imp,     spd:82,  amp:6,  om:2.0, w:36, h:30, art:'imp'    },
  fish:    { hp:ENEMY_HP.fish,    spd:100, amp:28, om:3.5, w:36, h:28, art:'fish'   },
  carrier: { hp:ENEMY_HP.carrier, spd:45,  amp:6,  om:1.8, w:50, h:56, art:'carrier'},
  head:    { hp:ENEMY_HP.head,    spd:76,  amp:4,  om:2.0, w:28, h:28, art:'head'   },
  bat:     { hp:ENEMY_HP.bat,     spd:90,  amp:0,  om:0,   w:44, h:28, art:'bat'    }
};

/* 稳定对象 ID：掉落目标按它排序 / 记忆，不用会随 splice 变化的数组下标（WB12） */
let _uidSeq = 1;
function nextUid(){ return _uidSeq++; }

function addEnemy(kind, x, y, phase, idx){
  const d = ENEMY_DEF[kind];
  enemies.push({
    uid: nextUid(),
    kind:kind, x:x, y:y, baseY:y, age:0, phase:phase||0,
    hp:d.hp, maxhp:d.hp, w:d.w, h:d.h,
    spd:d.spd, amp:d.amp, om:d.om, flash:0,
    /* MN03 受惊吐雾 */
    fearArmed:false, fearT:0, fearDone:false,
    /* MN04 桥洞双雾 */
    inZoneT:0, chargeT:0, shotDone:false,
    /* MN05 折翼俯冲 */
    mode:'fly', mt:0, dashVx:0, dashVy:0, diveDone:false,
    /* CH04：锁定点、剩余俯冲距离、采样累计 */
    lockX:0, lockY:0, dashLeft:0, sampled:0,
    order:idx||0
  });
}

/* 编队生成：相邻间距 26，相位 i*0.5；除飞鱼外叠加 -23/0/+23 高度错位 */
/* 编队生成（策划案 10.1 / 6.2 / 6.3）：同组相位差 0.5，x 间距按怪物类型 */
function spawnWave(kind, n, baseY){
  /* WB02：横向仍按原来的紧凑编队（摊太开会把后几只推到屏外排队，屏内反而更空），
     但纵向不再共用同一条水平线 —— 三只完全同高时，一次连射就能整波清掉。 */
  const dx  = (kind === 'fish' || kind === 'bat' || kind === 'carrier') ? 36 : 30;
  const amp = ENEMY_DEF[kind].amp;
  for(let i=0;i<n;i++){
    let y = baseY;
    if(kind === 'imp'){
      // MN01：四只一组，基础 y 依序叠加 −18 / 0 / +18 循环
      y = baseY + [-18, 0, 18][i % 3];
    } else if(n >= 2){
      /* 非 imp 的编队原来共用同一个 baseY，三只完全同高 */
      y = baseY + [(n >= 3 ? -26 : -14), 0, (n >= 3 ? 26 : 14)][i % 3];
    }
    y = clamp(y, 50 + amp, 218 - amp);
    addEnemy(kind, 500 + i*dx, y, i * 0.5, i);
    /* 出场音只给吞光灯怪：普通小队两秒一波，每次都响会吵 */
    if(kind === 'carrier' && i === 0) SFX.carrierGulp();
  }
}

/* 水晶（可折射，也可拾取）*/
/* v1.5 取消射击晶石：不再有可射击/可拾取的水晶对象（1.2） */
function addCrystal(){ }

/* ---- 阶段内波次表（1.8.0《波次.csv》）：时间一律为「阶段 ID + 局部秒数」 ----
   后半段绝不能再用全局秒数，否则中 Boss 拖长会把后续战斗叠在一起。
   v1.12.0（D12）按当前表重算：PH01 18 波 / 48 只、PH03 21 波 / 55 只，
   固定路线合计 39 普通波 / 103 只 / 6 只灯怪 / 109 微光；
   加教学 2 + 中 Boss 10 + 终 Boss 14 = 固定内容 135 颗，
   三只条件支援最多另加 6，上界 141（不是保证供给）。 */
const WAVE_ROWS = [
  /* [阶段, 相对生成秒, 怪物, 数量, 基础y] */
  ['PH01',  0.8, 'imp',     3, 124],
  ['PH01',  3.4, 'imp',     3, 172],
  ['PH01',  6.0, 'imp',     3,  94],
  ['PH01',  8.6, 'imp',     3, 146],
  ['PH01', 11.2, 'carrier', 1, 126],   // W05 第一只吞光灯怪（SUP02）
  ['PH01', 13.8, 'imp',     3,  78],
  ['PH01', 16.4, 'imp',     3, 184],
  ['PH01', 19.0, 'fish',    3, 160],
  ['PH01', 21.6, 'fish',    3,  94],
  ['PH01', 24.2, 'imp',     3, 142],
  ['PH01', 24.9, 'carrier', 1, 178],   // CH02 LC02 新增
  ['PH01', 26.8, 'fish',    3, 180],
  ['PH01', 29.4, 'fish',    3,  88],
  ['PH01', 32.0, 'imp',     3, 134],
  ['PH01', 34.6, 'fish',    3, 168],
  ['PH01', 37.2, 'carrier', 1, 130],   // W15 第二只吞光灯怪（SUP03）
  ['PH01', 39.8, 'imp',     3,  86],
  ['PH01', 42.0, 'fish',    3, 142],

  ['PH03',  0.5, 'head',    2,  90],   // W19 先读雾怪
  ['PH03',  2.8, 'head',    2, 174],
  ['PH03',  5.0, 'bat',     3,  80],   // W21 再读俯冲
  ['PH03',  7.2, 'bat',     3, 185],
  ['PH03',  9.4, 'imp',     3, 110],
  ['PH03', 11.6, 'head',    3, 174],
  ['PH03', 12.7, 'carrier', 1,  82],   // CH02 LC04 新增
  ['PH03', 13.8, 'fish',    3, 110],
  ['PH03', 16.0, 'bat',     3,  78],
  ['PH03', 18.2, 'imp',     3, 145],
  ['PH03', 20.4, 'fish',    3, 100],
  ['PH03', 22.6, 'head',    3, 178],
  ['PH03', 24.8, 'bat',     3,  80],
  ['PH03', 25.9, 'carrier', 1, 178],   // CH02 LC05 新增
  ['PH03', 27.0, 'fish',    3, 150],
  ['PH03', 29.2, 'imp',     3, 100],
  ['PH03', 31.4, 'head',    3, 174],
  ['PH03', 33.6, 'carrier', 1, 142],   // W34 第三只吞光灯怪（SUP05）
  ['PH03', 35.8, 'fish',    3, 136],
  ['PH03', 38.0, 'bat',     3,  82],
  ['PH03', 40.2, 'imp',     3, 150]
];

const WAVES = { PH01:[], PH02:[], PH03:[], PH04:[], PH05:[], PH06:[] };
WAVE_ROWS.forEach(function(r){
  WAVES[r[0]].push({ t:r[1], fn:function(){ spawnWave(r[2], r[3], r[4]); } });
});
/* EVT01：PH01 局部 3 秒的教学微光（SUP01，成长 +2） */
WAVES.PH01.push({ t:3.0, fn:function(){ dropMote(270, 133, 2); } });
WAVES.PH01.sort(function(a, b){ return a.t - b.t; });
/* 两个 Boss 各自在阶段 0 秒入场 */
WAVES.PH02.push({ t:0.00, fn:function(){ spawnBoss1(); } });   // W18
WAVES.PH05.push({ t:0.00, fn:function(){ spawnBoss2(); } });   // W38

/* ============================ 9. 更新 ============================ */

/* 权威更新路径（2.4 / 5.2 / 10.4）
   三条纪律：
   ① 只有 play 才推进游戏时钟 —— 暂停 / 结算 / 隐藏时 game.t 不动，
      背景、预兆、角色动画全部静止；
   ② 每一个子系统之后立刻校验存活，结束即退出，后续步骤一个都不跑；
   ③ 所有会改变分数 / 资源 / 血量的入口（damageBoss / damageEnemy / collect）
      自己也要校验，不能只靠调用顺序。 */
function gameLive(){ return game.state === 'play' && !player.dead; }

function update(dt){
  if(game.state !== 'play') return;
  game.t += dt;
  /* WB14：航程只统计「真正在打」的时间。
     开场 3 秒准备、PH06 满 10 秒后的飞出演出、暂停与结算都不计入。 */
  if(game.introT <= 0 && !game.cleared) game.elapsed += dt;
  game.cam += game.scroll * dt;
  if(game.lampFlash > 0) game.lampFlash = Math.max(0, game.lampFlash - dt);
  updateLampWisps(dt);
  updateFireWisps(dt);
  /* v1.12.2：击破大夜怪后，三档路灯依次点亮（每档 0.28 秒，各带一次光爆） */
  if(game.lampIgnite > 0){
    game.lampIgnite += dt;
    const n = Math.min(3, Math.ceil(game.lampIgnite / 0.28));
    if(n > game.lampsLit){ game.lampsLit = n; game.lampFlash = LAMP_FLASH_T; }
    if(game.lampsLit >= 3) game.lampIgnite = 0;
  }

  updatePhase(dt);    if(!gameLive()) return;
  updateScene(dt);
  updatePlayer(dt);   if(!gameLive()) return;
  updateEnemies(dt);  if(!gameLive()) return;
  updateBoss(dt);     if(!gameLive()) return;
  updateOrbs(dt);     if(!gameLive()) return;
  updateBullets(dt);  if(!gameLive()) return;
  updateBursts(dt);   if(!gameLive()) return;
  updatePickups(dt);  if(!gameLive()) return;
  updateBloomFx(dt);
  updateFireflies(dt);
  updateParticles(dt);
  updatePopups(dt);
  updateFx(dt);

  if(player.invuln > 0)    player.invuln -= dt;
  if(player.magicLock > 0) player.magicLock -= dt;
  if(player.castT > 0)     player.castT -= dt;
  if(player.recoil > 0)    player.recoil = Math.max(0, player.recoil - dt/0.15);
  if(player.shootAnim > 0) player.shootAnim = Math.max(0, player.shootAnim - dt);
  /* 绽放读秒：只看 bloomTick。PH04 里已经开着的绽放照常烧完（WB07），
     准备期 / Boss 过渡 / 归途才真的冻住 */
  /* v1.10.1：共享剩余时间归零的那一步，强化与无敌一起结束（唯一入口）。
     末尾那个 1e-9 的复位是必须的：0.0166… 连续相减会留下 1e-14 量级的正残差，
     不抹掉的话「还剩 0.0 秒」的那一帧仍然是强化 + 无敌状态，
     强化与无敌就会比倒计时多撑一帧 —— 同帧结束就成了假的。 */
  if(player.bloomT > 0 && caps().bloomTick){
    player.bloomT = Math.max(0, player.bloomT - dt);
    if(player.bloomT < 1e-9) player.bloomT = 0;
    /* 归零当步：循环乐与强化/无敌/护膜一起收 */
    if(player.bloomT === 0) StarLoop.stop();
  }
  /* CH01：炉火没有自然恢复，也不随时间补 */
  /* v1.12f：BGM 看门狗。切曲时给 <audio> 换 src，浏览器有时会把元素挂起，
     表现就是「打着打着没背景乐了」。每秒查一次，播放中掉线就重新拉起来。 */
  game.bgmChk = (game.bgmChk || 0) + dt;
  if(game.bgmChk >= 1.0){
    game.bgmChk = 0;
    if(game.state === 'play' && !BGM.failed && BGM.el && BGM.el.paused && !document.hidden){
      startMusic();
    }
  }
  if(game.shake > 0)       game.shake = Math.max(0, game.shake - dt*12);
  /* 低血心跳：只在 1 点血时，3 秒一次，别太吵 */
  if(player.hp === 1 && !player.dead){
    game.lowHpT = (game.lowHpT || 0) + dt;
    if(game.lowHpT >= 3){ game.lowHpT = 0; SFX.lowHp(); }
  } else game.lowHpT = 0;
  if(game.flash > 0)       game.flash = Math.max(0, game.flash - dt*3);
  if(game.warnT > 0)       game.warnT = Math.max(0, game.warnT - dt);
  if(game.introT > 0)      game.introT = Math.max(0, game.introT - dt);
  if(game.flyBannerT > 0)  game.flyBannerT = Math.max(0, game.flyBannerT - dt);
  updateToast(dt);
}

/* 自然回魔按能力表的 regen 位走（PH01 / PH02 / PH03 / PH05 为 1），
   不再单独维护一份阶段名单，免得和 CAP 表打架 */

/* ---- 阶段能力表（2.4 / 10.4 / 11.2）----
   原来「能不能打」散在 attackLocked / magicLocked / 各处的 teaTime 判断里，
   三秒准备期漏了射击、Boss 0.8 秒过渡漏了施法与绽放读秒。
   现在移动 / 射击 / 施法 / 回收 / 自然恢复 / 绽放时钟都由同一张表决定。 */
/* ---- 阶段能力表（2.4 / 10.4 / 11.2 / WB07）----
   原来「能不能打」散在 attackLocked / magicLocked / 各处的 teaTime 判断里，
   三秒准备期漏了射击、Boss 0.8 秒过渡漏了施法与绽放读秒。
   现在移动 / 射击 / 施法 / 回收 / 自然恢复 / 绽放都只读这张表。

   WB07：把「能不能开启新绽放」和「已有绽放要不要继续读秒」拆成两位。
   原来共用一个 bloom 位，结果 PH04 的四秒预警把已经开着的绽放冻住了。 */
const CAP = {
  FULL:  { move:1, shoot:1, cast:1, pick:1, regen:1, bloom:1, bloomTick:1, firefly:1 },
  /* 开场三秒准备：只能移动，其它全部冻结 */
  PREP:  { move:1, shoot:0, cast:0, pick:0, regen:0, bloom:0, bloomTick:0, firefly:0 },
  /* Boss 击破的 0.8 秒过渡：演出期间不产生也不结算战斗物；
     但普通掉落照常吸附、已入账的 Boss 光迹照常飞走（10.4） */
  /* v1.10.1：Boss 换阶段（0.8 秒过渡）里共享倒计时继续走，不冻结、不延长 */
  TRANS: { move:1, shoot:0, cast:0, pick:1, regen:0, bloom:0, bloomTick:1, firefly:0 },
  /* PH04 预警 4 秒：停新攻击 / 停施法 / 停新开绽放 / 停自然回魔，
     但已有绽放剩余时间照常消耗、已有道具继续吸附。 */
  WARN:  { move:1, shoot:0, cast:0, pick:1, regen:0, bloom:0, bloomTick:1, firefly:0 },
  /* PH06 萤火归途：强化结束、旧战斗奖励已清，只接萤火 */
  TEA:   { move:1, shoot:0, cast:0, pick:1, regen:0, bloom:0, bloomTick:0, firefly:1 }
};
function caps(){
  if(game.introT > 0) return CAP.PREP;
  if(game.transT > 0) return CAP.TRANS;
  if(game.teaTime)    return CAP.TEA;
  if(game.phaseId === 'PH04') return CAP.WARN;
  return CAP.FULL;
}

/* 状态时间契约：能不能开火 */
function attackLocked(){ return !caps().shoot; }
/* 耗资源技能：施法门禁与射火同源，不再单独漏判 */
function magicLocked(){ return !caps().cast; }

/* ---- 阶段状态机（策划案 9 章 + 10.2 事件表）---- */
function updatePhase(dt){
  // 开场倒计时内不推进路线、不生成战斗物（策划案 11.2）
  if(game.introT > 0) return;

  // 阶段收尾：Boss 击破后的 0.8 秒死亡 / 过桥表现，期间不再生成后续路线内容
  if(game.transT > 0){
    game.transT -= dt;
    if(game.transT <= 0) enterPhase(game.phase + 1);
    return;
  }

  game.phaseT += dt;

  /* SC02 满月湖面：PH01 局部 18 秒换景。
     场景本体由 updateScene 按相位切（含 1.2 秒交叉淡入），这里只打一次字幕节拍。 */
  if(game.phaseId === 'PH01' && game.phaseT >= 18 && !game.lakeOn){
    game.lakeOn = true;
    flashMsg('满月湖面');
  }

  const ph = PHASE_TABLE[game.phase];
  const list = WAVES[ph.id] || [];

  // 阶段内波次：只按本阶段局部秒数触发
  while(game.phaseEvt < list.length && game.phaseT >= list[game.phaseEvt].t){
    list[game.phaseEvt].fn();
    game.phaseEvt++;
  }

  if(ph.route == null) return;          // Boss 阶段：等了击破，不限时

  /* v1.11.0（C05–C09）：PH03 的 43 秒只是排程结束点，不是删怪点。
     最后一波派发完之后停止补刷，玩家继续在桥下打；
     等活怪全部被击破或自然飞走，再用 0.30 秒收残弹（残弹不再造成伤害），
     拾取物与在途火种全部保留，然后照原样进 PH04 四秒预警。
     排程没派发完就绝不推进，也不靠别的超时兜底。 */
  if(ph.id === 'PH03'){
    if(game.phaseEvt < list.length) return;        // 还有波次没派发
    if(enemies.length > 0){ game.bridgeFade = 0; return; }   // 还有活怪：继续打
    if(!game.bridgeDone){
      game.bridgeDone = true;
      game.bridgeFade = 0.30;                      // 收残弹
      for(let i = 0; i < ebullets.length; i++){
        ebullets[i].life = Math.min(ebullets[i].life, 0.30);
      }
    }
    if(game.bridgeFade > 0){
      game.bridgeFade = Math.max(0, game.bridgeFade - dt);
      return;
    }
    enterPhase(game.phase + 1);
    return;
  }
  if(game.phaseT < ph.route) return;

  if(ph.id === 'PH06'){
    // EVT07：PH06 +5.00 停止生成，先让小魔女飞出画面，飞出去之后才结算
    if(!game.cleared){
      game.cleared = true;
      startFlyOut();
    }
    return;
  }
  enterPhase(game.phase + 1);
}

/* 进入某一阶段：局部时钟归零，阶段内事件索引归零 */
/* v1.3.1 §5.3：进入归途 / 成功页前把已登记的有效奖励结清，再清光迹，
   避免 UI 收起后还有火种飞向旧位置。 */
function settleFireRewards(){
  for(let i = 0; i < FIRE_WISPS.length; i++){
    const w = FIRE_WISPS[i];
    if(w.el) w.el.remove();
    if(player.fireAmmo < FIRE_MAX) player.fireAmmo++;
    else game.score += 100;
  }
  FIRE_WISPS.length = 0;
}
function enterPhase(idx){
  if(idx >= PHASE_TABLE.length) return;
  /* 进 PH06（归途）前结清在途火种 */
  if(PHASE_TABLE[idx] && PHASE_TABLE[idx].id === 'PH06') settleFireRewards();
  game.phase = idx;
  game.phaseId = PHASE_TABLE[idx].id;
  pushTrace('phase', { to: PHASE_TABLE[idx].id });
  game.phaseT = 0;
  game.phaseEvt = 0;
  game.transT = 0;

  const id = game.phaseId;
  if(game.phase > 0) SFX.phaseChange();
  if(id === 'PH03'){
    game.bridgeDone = false; game.bridgeFade = 0;
    flashMsg('石桥下通道');
  } else if(id === 'PH04'){
    /* CH01：路灯不再补炉火（炉火只从灯怪来） */
    /* 预警整体 4 秒（route），但闪烁提示只演前 1.6 秒，不刷满整段 */
    game.warnT = 1.6;
    flashMsg('前面有一大团夜雾', 1);
    SFX.warn();
  } else if(id === 'PH06'){
    enterTeaTime();
  }
}

/* ---- 玩家 ---- */
function updatePlayer(dt){
  if(player.dead) return;

  /* 成功过场：两段式。
     原来是从当前位置直接右冲 —— 但茶歇结束时玩家多半已经贴在右边界（x≈428），
     到出画只有 50 多像素，0.15 秒就没了，这段过场等于看不见。
     现在先往后上方退一小段蓄力（同时把 boostStart 起手动画演完），
     再向右加速冲出去，才有"起飞"的读感。 */
  if(game.flyOut > 0){
    game.flyOut += dt;
    const WU = 0.62;                            // 蓄力时长
    if(game.flyOut < WU){
      /* ① 后撤蓄力：smoothstep 缓入缓出，退到 flyBackX / flyBackY */
      const u = clamp(game.flyOut / WU, 0, 1);
      const e = u*u*(3 - 2*u);
      player.x = game.flyOutX0 + (game.flyBackX - game.flyOutX0) * e;
      player.y = game.flyBackY0 + (game.flyBackY - game.flyBackY0) * e;
      player.vx = 0; player.vy = 0;
      player.animT += dt;
      player.boostT = (player.boostT || 0) + dt;
      player.vtilt += (0 - player.vtilt) * clamp(8*dt, 0, 1);
      player.tilt  += (0 - player.tilt)  * clamp(9*dt, 0, 1);
    } else {
      /* ② 冲刺出画：速度从 150 加到 770，越长越快 */
      const t2  = game.flyOut - WU;
      const spd = 150 + 620 * clamp(t2 / 0.90, 0, 1);
      player.x += spd * dt;
      player.vx = spd;
      player.vy = 0;
      player.animT += dt;
      player.boostT = (player.boostT || 0) + dt;
      player.vtilt += (1 - player.vtilt) * clamp(8*dt, 0, 1);
      player.tilt  += (0 - player.tilt)    * clamp(9*dt, 0, 1);
      if(player.x > 545){ game.flyOut = 0; endGame(true); }
    }
    return;
  }

  let ax = axisX(), ay = axisY();
  /* 摇杆是模拟量，键盘是 ±1：统一按模长归一，斜向不会比正向更快 */
  const mag = Math.sqrt(ax*ax + ay*ay);
  if(mag > 1){ ax /= mag; ay /= mag; }
  if(Input.usingPointer && Input.pointerY !== null && !ax && !ay){
    ay = clamp((Input.pointerY - player.y) / 26, -1, 1);
  }

  const k = clamp(12*dt, 0, 1);
  player.vx += (ax*SPD_X - player.vx) * k;
  player.vy += (ay*SPD_Y - player.vy) * k;
  /* 萤火归途放宽右侧，其余阶段维持原活动区（挡住贴脸打怪） */
  player.x = clamp(player.x + player.vx*dt, AREA.x0, game.teaTime ? AREA_TEA_X1 : AREA.x1);
  player.y = clamp(player.y + player.vy*dt, AREA.y0, AREA.y1);

  player.tilt  += ((player.vy/SPD_Y) - player.tilt)  * clamp(9*dt, 0, 1);
  player.vtilt += ((player.vx/SPD_X) - player.vtilt) * clamp(8*dt, 0, 1);
  player.animT += dt;

  /* SK01 星屑射击：每 0.15 秒一轮，触控自动（2.2 / 4.2）；萤火归途关闭 */
  if(!attackLocked() && (keyShoot() || coarsePointer)){
    player.fireT -= dt;
    if(player.fireT <= 0){ fireShot(); player.fireT = SHOT_IV; }
  } else {
    player.fireT = 0;
  }

  /* 炉火分段结算（4.4）：0 / 0.12 / … / 0.84 共 8 段 */
  if(player.flameT > 0){
    player.flameT -= dt;
    player.flameAcc += dt;
    while(player.flameAcc >= FLAME_SEG && player.flameSeg < FLAME_N){
      player.flameAcc -= FLAME_SEG;
      flameSegment();
      player.flameSeg++;
    }
  }

  /* v1.3.1：Q 切换与 1–4 直选已移除。旧路径会把 player.magic 写成非 0，
     而 useMagic() 只允许索引 0，导致之后按 Z 被拒绝 —— 这是 P0。
     这里直接丢弃这两个输入边沿，保证 player.magic 恒为 0。 */
  Input.cyclePressed = false;
  Input.selectMagic = -1;
  /* SK03–SK07 使用魔法（Z）：共用三格魔力与 1 秒间隔 */
  if(Input.magicPressed){
    Input.magicPressed = false;
    useMagic();
  }
  /* SK05 星光绽放（E / K）*/
  if(Input.feverPressed){
    Input.feverPressed = false;
    useBloom();
  }
}

/* ---- SK01 星屑射击 ---- */
/* SK01 星屑射击（4.2）：主弹 (20,2)，侧弹 (18,−6)/(18,+10)，速度 380、寿命 1.4 */
function fireShot(){
  /* 状态时间契约：PH04 预警 / PH06 归途内不产生新弹。
     输入层已经挡住，这里再拦一道，避免残留的自动射击 / 触控自动射击漏过去。 */
  if(attackLocked()) return;
  player.recoil = 1;
  player.shootAnim = 0.16;        /* v1.12.0（D09）：真的打出一轮弹 = 播射击动作 */
  const lv = SHOT_LV[player.shotLv - 1];
  if(player.shotLv >= 2) SFX.shootBig(); else SFX.shoot();
  const bl = player.bloomT > 0;
  const mul = bl ? BLOOM_DMG : 1;
  const angs = (lv.n === 1) ? [0] : [-lv.ang, 0, lv.ang];
  for(let i=0;i<angs.length;i++){
    const a = angs[i];
    const isMain = (a === 0);
    pbullets.push({
      x: player.x + (isMain ? 20 : 18),
      y: player.y + (isMain ? 2 : (a > 0 ? 10 : -6)),
      vx: Math.cos(a) * SHOT_SPD,
      vy: Math.sin(a) * SHOT_SPD,
      life: SHOT_LIFE, type:'shot',
      dmg: (isMain ? lv.main : lv.side) * mul,
      r: bl ? PB_R_BLOOM : PB_R,
      pierce: bl ? BLOOM_PIERCE : 0,
      hitSet: bl ? [] : null
    });
  }
  /* v1.12.0（D10）：这里原来还有一声无条件的 SFX.shoot()，
     和上面按等级播的那次重复 —— 一轮两声，删掉。 */
}

/* 刷新射击等级（4.2）：阈值只读 SHOT_LV，判定 / 成长条 / 说明文字共用一份 */
/* R07 / R08：极轻量的过程记录（只在关键节点 push，不参与任何判定）。
   控制台里 game.trace 就能读到：每次升级的时刻 / 相位 / 已回收数，
   每次换相位的时刻，开局给了多少微光。多跑几局拿来对成长与时长。 */
function pushTrace(kind, data){
  if(!game.trace) game.trace = [];
  if(game.trace.length > 120) return;
  data.k = kind;
  data.t = +(game.elapsed || 0).toFixed(2);
  data.ph = game.phaseId;
  game.trace.push(data);
  if(typeof console !== 'undefined' && console.debug) console.debug('[trace]', kind, data);
}
function updateShotLv(){
  var _oldLv = player.shotLv;
  let lv = 1;
  for(let i = SHOT_LV.length - 1; i >= 0; i--){
    if(player.grow >= SHOT_LV[i].need){ lv = i + 1; break; }
  }
  if(lv > player.shotLv){
    player.shotLv = lv;
    if(_oldLv) SFX.levelUp();          // 开局那次不算升级
    /* R07：升级时刻 + 当时的相位 / 已回收微光，供成长节奏核对 */
    pushTrace('lv', { lv: lv, grow: player.grow, motes: game.motes,
                      supply: game.supplyMote || 0 });
    flashMsg('射击升级 L' + lv);
    spark(player.x + 20, player.y, 10, ['#FFF2CF','#9BD0EE'], 120, 0.4);
  }
}

/* ---- SK02 水晶折射：普通弹命中水晶 ---- */
/* SK02 已停用（1.2）：保留空实现，避免旧调用点报错 */
function refractFrom(){ }

/* ---- SK03 / SK04 库存魔法 ---- */
/* ---- 四魔法（4.1 / 4.4–4.7）---- */
/* v1.3.1：唯一技能是炉火。setMagic / cycleMagic 保留名字给旧调用方，
   但不允许把 player.magic 改成非 0 —— 否则 useMagic() 会一直拒绝。 */
function setMagic(m){
  /* v1.10.1：旧魔法切换入口已清理，切到别的槽直接无效（不再喊话） */
  const idx = ((m % 4) + 4) % 4;
  if(idx !== 0) return;
  player.magic = 0;
}
function cycleMagic(){ setMagic(0); }

function useMagic(){
  if(magicLocked()) return;                     // 萤火归途 / 开场倒计时 / PH04 预警内不接受
  if(player.magicLock > 0) return;              // 共同施法间隔 1.00 秒
  /* CH01：唯一可施放的是炉火（索引 0）。其他索引属于遗留实现，不提供入口。 */
  if(player.magic !== 0) return;
  if(player.fireAmmo <= 0){ flashMsg('击败灯怪补充炉火'); return; }
  player.fireAmmo = clamp(player.fireAmmo - 1, 0, FIRE_MAX);
  player.magicLock = MAGIC_CD;
  player.castT = 1.0;
  const m = player.magic;
  if(m === 0)      magicFlame();
  else if(m === 1) magicBolt();
  else if(m === 2) magicBurst();
  else             magicStarfall();
}

/* SK03 炉火（4.4）：1 秒 8 段，每段对前方 |dy|≤18 的目标各 2 伤害，贯穿不阻断 */
function magicFlame(){
  player.flameT = FLAME_T;
  player.flameAcc = 0;
  player.flameSeg = 1;
  flameSegment();                               // 0 时刻立即结算第一段
  fxFlame(player.x + HERO_MUZZLE.dx, player.y + 1);
  SFX.magicFire();
}
function flameSegment(){
  const y = player.y, x0 = player.x;
  let hitAny = 0;                       /* v1.12：这一段有没有真的烧到东西 */

  for(let i=enemies.length-1;i>=0;i--){
    const e = enemies[i];
    const cy = e.y + e.h*0.5;
    if(e.x + e.w < 0 || e.x > W) continue;
    if(e.x + e.w*0.5 < x0) continue;
    if(Math.abs(cy - y) > FLAME_BAND) continue;
    /* v1.11.0：炉火必须报明确的 'flame' 类型 —— 吞光灯怪只对这一种免疫，
       报 'magic' 会把所有魔法混成一类，以后再出别的「抗火」就分不清了。 */
    damageEnemy(e, FLAME_DMG, 'flame');
    hitAny++;
  }
  if(boss && Math.abs(boss.y + boss.h*0.5 - y) <= FLAME_BAND &&
     boss.x + boss.w*0.5 >= x0 && boss.x < W){
    damageBoss(FLAME_DMG);
    hitAny++;
  }
  for(let i=orbs.length-1;i>=0;i--){
    const o = orbs[i];
    if(o.x >= x0 && o.x <= W && Math.abs(o.y - y) <= FLAME_BAND + RR_ORB) damageOrb(o, FLAME_DMG);
  }
  for(let i=ebullets.length-1;i>=0;i--){
    const b = ebullets[i];
    if(b.x >= x0 && b.x <= W && Math.abs(b.y - y) <= FLAME_BAND){ ebullets.splice(i,1); hitAny++; }
  }
  /* 烧到东西才出「嗤」的一声，空放不响（v1.12） */
  if(hitAny > 0 && typeof SFX !== 'undefined' && SFX.fireTick) SFX.fireTick();
}

/* SK04 雷光（4.5）：屏内各 2 伤害 + 清普通敌弹；重雾球只受 2 点 */
function magicBolt(){
  const sx = player.x + HERO_MUZZLE.dx, sy = player.y + 1;
  let n = 0;
  for(let i=enemies.length-1;i>=0;i--){
    const e = enemies[i];
    if(e.x < 0 || e.x > W) continue;
    if(n < 8){ fxBolt(sx, sy, e.x + e.w*0.5, e.y + e.h*0.5, n*0.03); n++; }
    damageEnemy(e, BOLT_DMG, 'magic');
  }
  if(boss && boss.x >= 0 && boss.x <= W){
    if(n < 8){ fxBolt(sx, sy, boss.x + boss.w*0.5, boss.y + boss.h*0.5, n*0.03); n++; }
    damageBoss(BOLT_DMG);
  }
  for(let i=orbs.length-1;i>=0;i--){
    const o = orbs[i];
    if(o.x < 0 || o.x > W) continue;
    if(n < 8){ fxBolt(sx, sy, o.x, o.y, n*0.03); n++; }
    damageOrb(o, BOLT_DMG);
  }
  for(let i=ebullets.length-1;i>=0;i--){
    const b = ebullets[i];
    if(b.x >= 0 && b.x <= W && b.y >= 0 && b.y <= H) ebullets.splice(i,1);
  }
  if(n === 0){
    for(let i=0;i<3;i++){
      fxBolt(sx, sy, clamp(sx + rand(80, 240), 40, W-20), clamp(player.y + rand(-70, 70), 30, H-40), i*0.04);
    }
  }
  game.flash = 0.14;
  SFX.magicThunder();
}

/* SK06 火花爆裂（4.6）：锁最近目标，0.25 秒后半径 72 内各 9 伤害 */
function magicBurst(){
  SFX.magicBurst();
  let best = null, bestD = 1e9;
  const px = player.x;
  /* 4.6：按真实直线距离取最近，不再给 y 加微小权重；
     距离相同用固定的对象序号决胜，同一时刻的结果可复现。 */
  let seq = 0;
  function consider(cx, cy, key){
    const id = seq++;
    if(cx < px || cx > px + BURST_RANGE) return;
    const dx = cx - px, dy = cy - player.y;
    const d = Math.sqrt(dx*dx + dy*dy);
    if(d < bestD - 1e-9 || (Math.abs(d - bestD) <= 1e-9 && best && id < best.id)){
      bestD = d; best = { x:cx, y:cy, key:key, id:id };
    }
  }
  for(let i=0;i<enemies.length;i++){
    const e = enemies[i];
    consider(e.x + e.w*0.5, e.y + e.h*0.5, 'e'+i);
  }
  if(boss) consider(boss.x + boss.w*0.5, boss.y + boss.h*0.5, 'b');
  for(let i=0;i<orbs.length;i++) consider(orbs[i].x, orbs[i].y, 'o'+i);

  let tx, ty;
  if(best){ tx = best.x; ty = best.y; }
  else { tx = player.x + 140; ty = player.y; }
  tx = clamp(tx, 40, 450);
  ty = clamp(ty, 52, 218);

  BURSTS.push({ x:tx, y:ty, t:0, delay:BURST_DELAY, life:0.5, done:false });
  pushFx({ layer:'front', life: 0.5, draw: function(f){
    const q = f.t;
    // 0–0.25 低亮紫白范围环
    if(q < BURST_DELAY){
      const g = q / BURST_DELAY;
      ctx.globalAlpha = 0.18 + 0.22*g;
      ctx.strokeStyle = '#C9A6E8';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(tx, ty, BURST_R * (0.55 + 0.45*g), 0, Math.PI*2); ctx.stroke();
      ctx.globalAlpha = 0.10 + 0.12*g;
      ctx.fillStyle = '#C9A6E8';
      ctx.beginPath(); ctx.arc(tx, ty, BURST_R * (0.55 + 0.45*g), 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
    } else {
      // 爆开：短促小烟花
      const g = (q - BURST_DELAY) / 0.25;
      if(g > 1) return;
      const a = 1 - g;
      const rr = BURST_R * (0.35 + 0.75*g);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = a * 0.75;
      ctx.strokeStyle = '#F0E0FF';
      ctx.lineWidth = 2.4 * a + 0.6;
      ctx.beginPath(); ctx.arc(tx, ty, rr, 0, Math.PI*2); ctx.stroke();
      for(let i=0;i<10;i++){
        const ang = i*Math.PI*2/10 + q*2;
        const r0 = rr*0.55, r1 = rr*1.05;
        ctx.globalAlpha = a * 0.85;
        ctx.strokeStyle = '#E0C8FF';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(tx + Math.cos(ang)*r0, ty + Math.sin(ang)*r0);
        ctx.lineTo(tx + Math.cos(ang)*r1, ty + Math.sin(ang)*r1);
        ctx.stroke();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }});
  SFX.charge();
}

/* SK07 落星（4.7）：0 / 0.12 / 0.24 秒生成三颗追踪星，各 4 伤害 */
function magicStarfall(){
  const list = pickFallTargets(FALL_N);
  for(let i=0;i<FALL_N;i++){
    pbullets.push({
      x: player.x + 20, y: player.y + 2,
      vx: FALL_SPD, vy: 0, life: FALL_LIFE,
      type:'falling', dmg: FALL_DMG, r: 5,
      target: list[i] || null,
      /* WB12：后两颗在 0.12 / 0.24 秒后才真正激活，
         出生点要在激活那一刻按玩家当时的位置重算，不能用施法瞬间的旧坐标 */
      delay: i * FALL_IV,
      born: true,
      life: FALL_LIFE + i * FALL_IV,
      turn: FALL_TURN * Math.PI / 180
    });
  }
  SFX.magicStar();
}
/* 4.7 / WB12：三颗星先一人一个覆盖屏内普通目标（未分配优先、距离、稳定 ID），
   目标少于星数时允许集中；一个普通目标都没有时才打屏内 Boss。 */
function pickFallTargets(n){
  const pool = fallPool();
  const out = [];
  if(!pool.length) return out;
  const taken = {};
  for(let i=0;i<n;i++){
    let pick = null;
    for(let k=0;k<pool.length;k++){
      const c = pool[k];
      if(pool.length > 1 && taken[c.key]) continue;
      pick = c; break;
    }
    if(!pick) pick = pool[0];
    taken[pick.key] = 1;
    out.push(pick);
  }
  return out;
}

/* ---- 绽放表现资源（WB05）----
   两张表都设硬上限：装饰粒子 36（手机最低档 18）、命中/穿透组 6（最低档 3），
   全局生成间隔 ≥0.06 秒。预算不足时优先保「真实交点」的命中反馈，
   装饰只是氛围，不能抢危险提示的位置。 */
let blDecorAcc = 0, blHitCD = 0;

/* 危险区查询：吐息矩形 / 冲撞航道 / 敌弹 / 重球。
   半径外扩 pad（默认 6）——装饰粒子在这个范围内不再新生，
   重叠的装饰面按配置压到 alpha ≤0.05。 */
function bloomHazardAt(x, y, pad){
  const p = (pad === undefined) ? BL_SAFE_PAD : pad;
  const b = boss;
  if(b && b.id === 'b2'){
    if(b.mode === 'breath' && Math.abs(y - b.bY) <= BR_HH + p &&
       x >= BR_X0 - p && x <= BR_X1 + p) return true;
    if(b.mode === 'charge' && Math.abs(y - b.chY) <= CHARGE_TOUCH_R + p &&
       x >= CH_CX1 - p && x <= CH_CX0 + p) return true;
  }
  for(let i=0;i<ebullets.length;i++){
    const e = ebullets[i];
    const dx = e.x - x, dy = e.y - y, rr = HIT_R_EBULLET + p;
    if(dx*dx + dy*dy <= rr*rr) return true;
  }
  for(let i=0;i<orbs.length;i++){
    const o = orbs[i];
    const dx = o.x - x, dy = o.y - y, rr = RR_ORB + p;
    if(dx*dx + dy*dy <= rr*rr) return true;
  }
  return false;
}

/* 装饰粒子预算：触屏设备走最低档，桌面走满档 */
function bloomDecorCap(){ return coarsePointer ? BL_DECOR_LOW : BL_DECOR_MAX; }
function bloomHitCap(){   return coarsePointer ? BL_HIT_LOW   : BL_HIT_MAX; }

function updateBloomFx(dt){
  if(blHitCD > 0) blHitCD = Math.max(0, blHitCD - dt);

  for(let i=BL_P.length-1;i>=0;i--){
    const p = BL_P[i];
    p.t += dt;
    if(p.t >= p.life){ BL_P.splice(i,1); continue; }
    p.x += p.vx*dt; p.y += p.vy*dt;
    p.vy -= 26*dt;                              // 暖屑往上飘
    p.vx *= (1 - 1.6*dt);
  }
  for(let i=BL_HIT.length-1;i>=0;i--){
    const h = BL_HIT[i];
    h.t += dt;
    if(h.t >= h.life) BL_HIT.splice(i,1);
  }

  if(player.bloomT <= 0) return;
  const tau = BLOOM_T - player.bloomT;
  /* 只在 BF02 持续段长装饰；BF01 有专属星芒，BF06/BF07 是收束动作 */
  if(tau <= BL_IN || tau >= BL_OUT) return;
  const cap = bloomDecorCap();
  blDecorAcc += dt;
  while(blDecorAcc >= 0.055){
    blDecorAcc -= 0.055;
    if(BL_P.length >= cap) break;
    const a = Math.random()*Math.PI*2;
    const r = 10 + Math.random()*22;
    const sx = player.x + Math.cos(a)*r;
    const sy = player.y + Math.sin(a)*r*0.8;
    if(bloomHazardAt(sx, sy)) continue;          // 危险外扩内不长新粒子
    BL_P.push({ x:sx, y:sy, vx:Math.cos(a)*10, vy:-8 - Math.random()*14,
                t:0, life:0.35 + Math.random()*0.35,
                c: Math.random() < 0.5 ? '#FFF4CC' : '#99DDEB' });
  }
}

/* BF04 / BF05：真实交点上的短促反馈。
   kind='pierce' 是首次穿透（拉长星梭 + 出口断环），'end' 是终止命中（至多 4 碎光）。
   同弹同目标只一次由调用方的 hitSet 保证，这里只管表现与预算。 */
function bloomHitFx(x, y, kind){
  if(blHitCD > 0) return;
  blHitCD = BL_HIT_IV;
  if(BL_HIT.length >= bloomHitCap()) BL_HIT.shift();
  BL_HIT.push({ x:x, y:y, t:0, life:0.16, kind:kind || 'end',
                rot: Math.random()*Math.PI });
}
/* SK05 星光绽放（v1.10.1）：100 能量 → BLOOM_T 秒；同一份剩余时间里
   攻击强化与无敌同时有效。开启清半径 56 内普通弹（一次），不做持续清屏。
   WB05：不再压黑背景、不再全屏闪白、不再震屏、不做命中停顿。
   开启的表现全部交给 drawBloomDecor 的 BF01 段（薄断环 + 杖头星芒）。 */
function useBloom(){
  if(magicLocked()) return;
  /* v1.10.1：绽放进行中的重复输入（长按 E、连点按钮）一律静默忽略 ——
     不重开、不延长、不预约下一次，也不重复扣能量。 */
  if(player.bloomT > 0) return;
  if(player.bloom < 100){ flashMsg('绽放还未充满'); return; }
  player.bloom = 0;
  player.bloomT = BLOOM_T;
  player.bloomLv = 1;
  player.bloomCnt = 0;
  /* 新一轮：独立的对象，本轮掉落的所有星辉都指向它 */
  player.bloomRound = { lv:1, cnt:0 };
  StarLoop.start();                       /* v1.12：绽放循环乐跟着这段剩余时间起 */
  duckBgm(0.40);
  for(let i=ebullets.length-1;i>=0;i--){
    const b = ebullets[i];
    const dx = b.x - player.x, dy = b.y - player.y;
    if(dx*dx + dy*dy < BLOOM_CLEAR_R*BLOOM_CLEAR_R) ebullets.splice(i,1);
  }
  /* v1.10.1：不再另开 0.35 秒技能无敌 —— 无敌就是 bloomT > 0 本身，
     和攻击强化同帧开始、同帧结束。 */
  spark(player.x, player.y, 14, ['#FFF2CF','#F6E6C8','#9BD0EE'], 130, 0.5);
  flashMsg('星光绽放');
  SFX.fever();
}



/* ---- SK05 Fever ---- */
function useFever(){ useBloom(); }

/* ---- 敌人 ---- */
/* 普通怪行为（策划案 6.2–6.6 / MN01–MN05）
   五种都从屏外进入、不在玩家身旁生成；接触伤害 1。 */
function updateEnemies(dt){
  for(let i=enemies.length-1;i>=0;i--){
    const e = enemies[i];
    e.age += dt;
    if(e.flash > 0) e.flash -= dt;
    const cxIn = e.x + e.w*0.5;
    const onScreen = (cxIn > 0 && cxIn < W);

    if(e.kind === 'bat'){
      e._px = e.x; e._py = e.y;          /* v1.12.0（D11）：记录本帧起点，接触判定走扫掠 */
      updateBat(e, dt);
    } else {
      e.x -= e.spd * dt;
      if(e.kind === 'fish'){
        /* MN02 波浪鱼群 */
        e.y = e.baseY + 28 * Math.sin(3.5*e.age + e.phase);
      } else {
        e.y = e.baseY + e.amp * Math.sin(e.om*e.age + e.phase);
      }
      if(e.kind === 'carrier') updateLantern(e, dt, onScreen);
      if(e.kind === 'head')    updateMistHead(e, dt, onScreen);
    }

    /* 离场删除（俯冲可能把蝠带到画面外，留足余量） */
    if(e.x < -70 || e.x > W + 200 || e.y < -80 || e.y > H + 80){ enemies.splice(i,1); continue; }

    /* 接触伤害：绽放无敌期间整段跳过 —— 不能被「无敌中的玩家」撞死（v1.10.1） */
    if(canBeHurt()){
      /* v1.12.0（D11）：用敌我**相对运动的线段**判接触，不再只测终点。
         30fps 下蝙蝠一帧能走 8~9 像素，只测端点会漏掉擦边穿越。
         注意 segT 未命中返回 -1（真值！），必须显式比 >= 0。 */
      const ex0 = (e._px !== undefined ? e._px : e.x) + e.w*0.5;
      const ey0 = (e._py !== undefined ? e._py : e.y) + e.h*0.5;
      const ex1 = e.x + e.w*0.5, ey1 = e.y + e.h*0.5;
      const px0 = player.x - (player.vx || 0) * dt, py0 = player.y - (player.vy || 0) * dt;
      const tA = segT(px0, py0, player.x, player.y, ex1, ey1, HIT_R_TOUCH);
      const tB = segT(ex0, ey0, ex1, ey1, player.x, player.y, HIT_R_TOUCH);
      const hit = (tA >= 0) || (tB >= 0);
      if(hit){
        hitPlayer();
        killEnemy(e, 'contact');
      }
    }
  }
}

/* MN03 受惊吐雾（EN03 吞光灯怪）：第一次被伤到且未死亡 → 灯芯变亮，0.55 秒后
   向左一次发三颗扇形弹（偏角 −0.25 / 0 / 0.25，速度 65）。不瞄准，一生一次。 */
function updateLantern(e, dt, onScreen){
  if(e.fearDone || !e.fearArmed) return;
  /* 本体尚未入屏、或玩家已在它右侧 → 预兆暂不开始 */
  /* CH02：Boss 高压招式（吐息/冲撞/夜潮）期间不开始新的反击预兆；
     已经蓄力的也不推进，等高压结束再按距离重新判断。 */
  if(supportLanternBlocked()){ return; }
  /* CH02：入屏且玩家在左方至少 120 逻辑像素才开始蓄火，条件失去则取消待发 */
  if(!onScreen || e.x <= player.x + 120){ e.fearT = 0; return; }
  if(e.fearT <= 0) e.fearT = 0.65;
  e.fearT -= dt;
  if(e.fearT > 0) return;
  e.fearDone = true;
  const cx = e.x + e.w*0.5, cy = e.y + e.h*0.5;
  for(let i=-1;i<=1;i++){
    const a = Math.PI + i*0.25;
    /* CH02：三颗火团扇射，速度 110、半径 3、寿命 5 秒。
       fire:true 让它走专属的火焰外观，不再和其他怪共用粉紫圆弹。 */
    ebullets.push({ x:cx - 10, y:cy, vx:Math.cos(a)*110, vy:Math.sin(a)*110, life:5, r:3,
                    fire:true, seed:Math.random()*6.283 });
  }
  SFX.enemyShot();
}

/* MN04 桥洞双雾（EN04 桥洞雾怪）：进入 x≤430 达 0.4 秒后，且仍在玩家右侧
   至少 100 像素才蓄力；鼓腮 0.60 秒后在自己 y±10 各发一颗世界坐标向左的弹。
   CH03：速度 -136（不再跟着怪走），寿命 5 秒；发射后 0.5 秒比怪多拉开 30 像素。 */
function updateMistHead(e, dt, onScreen){
  if(e.shotDone) return;
  if(e.x > 430){ e.inZoneT = 0; return; }
  e.inZoneT += dt;
  if(e.inZoneT < 0.4) return;
  const farEnough = (e.x > player.x + 100);
  if(e.chargeT > 0){
    if(!farEnough){ e.chargeT = 0; return; }
    e.chargeT -= dt;
    if(e.chargeT <= 0){
      e.shotDone = true;
      const cy = e.y + e.h*0.5;
      /* CH03：世界 vx=-136（原来 -80 只比怪快 4 像素/秒，看着像挂在嘴边） */
      ebullets.push({ x:e.x - 8, y:cy - 10, vx:-136, vy:0, life:5, r:3 });
      ebullets.push({ x:e.x - 8, y:cy + 10, vx:-136, vy:0, life:5, r:3 });
      SFX.enemyShot();
    }
    return;
  }
  if(farEnough) e.chargeT = 0.60;
}

/* MN05 折翼俯冲（EN05 暮影蝠）：以 90 左飞，到 x=430 时若仍在玩家右侧
   至少 120 像素，折翼停留 0.45 秒并锁定方向，再以 150 冲 1.4 秒，之后恢复左飞 90。
   条件不足则跳过俯冲，一生只俯冲一次，不发射弹幕。 */
/* MN05 折翼俯冲（CH04）：0.55 秒预兆分成两段 —— 前 0.40 秒每只蝠各自采样
   玩家当前位置，最后 0.15 秒冻结锁定点；然后以 260 沿该方向直线俯冲，
   时长 = 距离/260，末帧把步长截断到剩余距离，到点后左飞离场。
   一生一次；途中不再追踪玩家，玩家看到锁线后移动就能躲开。 */
const BAT_TRIGGER_X = 430, BAT_MIN_DX = 120;
const BAT_WARN = 0.55, BAT_SAMPLE = 0.40;
const BAT_SPD = 260, BAT_EXIT = 90;

function updateBat(e, dt){
  if(e.mode === 'fly' || e.mode === 'fly2'){
    e.x -= e.spd * dt;
    if(e.mode === 'fly' && !e.diveDone && e.x + e.w*0.5 <= BAT_TRIGGER_X){
      e.diveDone = true;
      const cx = e.x + e.w*0.5;
      if(cx > player.x + BAT_MIN_DX){
        e.mode = 'aim';
        e.mt = BAT_WARN;
        e.lockX = player.x; e.lockY = player.y;
        e.sampled = 0;
        SFX.charge();
      } else {
        e.mode = 'fly2';
      }
    }
    return;
  }
  if(e.mode === 'aim'){
    e.mt -= dt;
    /* 前 0.40 秒持续刷新锁定点；进入最后 0.15 秒后不再改 */
    if(e.mt > BAT_WARN - BAT_SAMPLE){
      e.lockX = player.x;
      e.lockY = player.y;
      e.sampled += dt;
    }
    if(e.mt <= 0){
      const cx = e.x + e.w*0.5, cy = e.y + e.h*0.5;
      const dx = e.lockX - cx, dy = e.lockY - cy;
      const L = Math.sqrt(dx*dx + dy*dy) || 1;
      e.dashVx = dx / L * BAT_SPD;
      e.dashVy = dy / L * BAT_SPD;
      e.dashLeft = L;              // 剩余距离，末帧截断
      e.mode = 'dash';
      SFX.enemyShot();
    }
    return;
  }
  if(e.mode === 'dash'){
    const step = BAT_SPD * dt;
    if(step >= e.dashLeft){
      /* 到点：补完最后一小段就停，不越过、也不夹断 y */
      const k = e.dashLeft / BAT_SPD;
      e.x += e.dashVx * k;
      e.y += e.dashVy * k;
      e.dashLeft = 0;
      e.mode = 'exit';
      return;
    }
    e.x += e.dashVx * dt;
    e.y += e.dashVy * dt;
    e.dashLeft -= step;
    return;
  }
  /* exit：恢复水平左飞离场 */
  e.x -= BAT_EXIT * dt;
}

/* v1.5 起普通怪不再共用瞄准式射手逻辑，行为各自实现于 updateLantern / updateMistHead */
function updateEnemyShooter(){ }

/* ---- 灯芯归位 ----
   吞光灯怪带着「被吞掉的灯」，击破后那点光要自己飘回去。
   只打一行「一盏路灯亮了」是不够的：三只灯怪分别死在 SC01/SC02/SC04，
   那几个场景里根本没有路灯可看。这里补一束从怪身上升起的暖光，
   任何场景都成立；SC05/SC06 那边再把背景路灯按 lampsLit 分档点亮。 */
const LAMP_WISPS = [];
function spawnLampWisp(x, y){
  LAMP_WISPS.push({ x0:x, y0:y, t:0, dur:1.25, trail:[] });
}
function updateLampWisps(dt){
  for(let i = LAMP_WISPS.length - 1; i >= 0; i--){
    const w = LAMP_WISPS[i];
    w.t += dt;
    const u = clamp(w.t / w.dur, 0, 1);
    w.trail.push([w.x0 + 40 * u * u, w.y0 - 62 * u - 26 * u * u]);
    if(w.trail.length > 15) w.trail.shift();
    if(u >= 1) LAMP_WISPS.splice(i, 1);
  }
}
function drawLampWisps(){
  for(let i = 0; i < LAMP_WISPS.length; i++){
    const w = LAMP_WISPS[i];
    const u = clamp(w.t / w.dur, 0, 1);
    const life = 1 - u * u;
    for(let k = 0; k < w.trail.length; k++){
      const p = w.trail[k], a = (k + 1) / w.trail.length;
      ctx.fillStyle = 'rgba(255,224,164,' + sa(0.52 * a * life) + ')';
      ctx.beginPath();
      ctx.arc(p[0], p[1], 1.1 + 2.7 * a * life, 0, 6.2832);
      ctx.fill();
    }
    const h = w.trail[w.trail.length - 1];
    if(!h) continue;
    const hr = 13 + 7 * life;
    const hg = ctx.createRadialGradient(h[0], h[1], 0, h[0], h[1], hr);
    hg.addColorStop(0,    'rgba(255,250,226,' + sa(0.96 * life) + ')');
    hg.addColorStop(0.38, 'rgba(255,220,158,' + sa(0.62 * life) + ')');
    hg.addColorStop(1,    'rgba(255,206,140,0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = hg;
    ctx.fillRect(h[0] - hr, h[1] - hr, hr * 2, hr * 2);
  }
}

function damageEnemy(e, dmg, source){
  if(!gameLive()) return;
  /* v1.11.0（C01/C03）：吞光灯怪对「火焰类型」完全免疫。
     判断放在扣血、白闪、fearArmed、击破之前 —— 不只藏一个伤害数字。
     免疫反馈每只每秒最多一次：一小簇火星 + 「耐火」，不跟着八段连刷。
     火焰不因此回血、不反射、不产生掉落，也不挡住后面的其他目标。 */
  if(source === 'flame' && e.kind === 'carrier'){
    if(game.t - (e.fireImmuneT || -99) >= 1.0){
      e.fireImmuneT = game.t;
      popup(e.x + e.w*0.5, e.y - 3, '耐火', '#C9B8E0');
      spark(e.x + e.w*0.5, e.y + e.h*0.45, 4, ['#FFD08A','#FF9C6A'], 46, 0.20);
    }
    return;
  }
  e.hp -= dmg;
  e.flash = 0.09;
  /* MN03：首次被玩家伤到且未死亡时点亮反击预兆 */
  if(e.kind === 'carrier' && e.hp > 0 && source !== 'contact') e.fearArmed = true;
  if(e.hp <= 0) killEnemy(e, source);
  else if(source !== 'contact') SFX.enemyHit();
}

/* 击破结算（策划案 5.2）：一般怪 1 微光（灯怪 2 微光 + 1 灯芯），
   绽放中另加 1 颗星辉；碰撞消除 / 出屏 / 清场都不给奖励。 */
function killEnemy(e, source){
  const idx = enemies.indexOf(e);
  if(idx < 0) return;
  enemies.splice(idx, 1);

  const cx = e.x + e.w*0.5, cy = e.y + e.h*0.5;
  const byPlayer = (source !== 'contact' && source !== 'clear');

  if(byPlayer){
    SFX.enemyDie();
    /* CH01：只有玩家用射击 / 炉火击破灯怪才产生火种；碰撞清除与离场不给 */
    if(e.kind === 'carrier') spawnFireWisp(cx, cy);
    game.kills++;
    const sc = (e.kind === 'carrier') ? 300 : 100;
    game.score += sc;
    if(e.kind === 'carrier'){
      dropMote(cx, cy, 2);
      dropWick(cx, cy);
      /* 8.8 / R14：吞光灯怪身上带着收回来的灯，
         击破即点亮一盏背景路灯，故事焦点和战斗奖励对齐 */
      /* v1.3.1：这里不再放飞暖光 —— 炉火的唯一主轨迹是火种飞进按钮，
         路灯改在火种到账后次级变亮（见 updateFireWisps）。 */
      spark(cx, cy, 7, ['#FFE6B0','#FFD08A','#FFF6DC'], 62, 0.34);
    } else {
      dropMote(cx, cy, 1);
    }
    /* v1.11.0（C15–C17）：只有 fish / head 的有效击破掷一次爱心。
       条件：缺血、场上没有另一颗爱心、本关已生成 <3、且在本阶段允许的相位里。
       每只怪一个 UID 只判一次；漏捡过期仍占额度；重开清零。 */
    if(!e.heartRolled){
      e.heartRolled = true;
      const rate = HEART_RATE[e.kind] || 0;
      const phaseOk = (game.phaseId === 'PH01' || game.phaseId === 'PH03');
      let hasHeart = false;
      for(let q = 0; q < pickups.length; q++) if(pickups[q].type === 'heart'){ hasHeart = true; break; }
      if(rate > 0 && phaseOk && player.hp < player.maxHp && !hasHeart &&
         game.heartsSpawned < HEART_MAX && Math.random() < rate){
        dropHeart(cx, cy);
      }
    }
    /* v1.11.0（C14）：绽放击破不再额外出星辉 —— 星辉升阶整套退出有效结算。
       五秒强化 / 一次穿透 / 五秒无敌与正常分数保持不变。 */
    popup(cx, cy, '+' + sc, '#F2CF8A');
  }

  spark(cx, cy, 10, ['#C9A6E8','#9BD0EE','#F6E6FF'], 110, 0.4);
  if(byPlayer) SFX.hit();
}

/* ---- Boss ---- */
function spawnBoss1(){
  setMusicMode('boss');
  SFX.bossRoar();
  boss = {
    uid: nextUid(), id:'b1', x:490, y:93, baseY:93, age:0,        // y 取上半高，中心落在 133
    hp:190, maxhp:190, w:88, h:80, r:RR_MID,   // v1.6.0：中 Boss 190 HP
    flash:0, entered:false, glow:0,
    cyc:0, evN:0, shotIdx:0, aimLocked:false, aimX:0, aimY:0, aimAng:null,
    targetY:86, puff:0, fanFired:false
  };
  game.bossActive = true;
  flashMsg('夜团醒了');
}
/* 终 Boss（7.2 / 7.3）：320 HP，半血 160 转阶段。
   F1 顺序 BS03 夜雾横推 → BS04 单球 → BS05 吞光吐息 → 循环
   F2 顺序 BS06 扑灯冲撞 → BS05 → BS04 双球 → BS03 → 循环 */
const B2_HP = 320, B2_WEAK_MUL = 1.5;
/* CH06：320 → 224 → 112 → 0 三段。
   F1 聚雾（雾墙→单球）／F2 逐灯（冲撞→吐息→雾墙）／F3 夜潮（三重夜潮→双球→冲撞）。
   高输出可跨阈值直达，不锁血、不回填。 */
const B2_THRESH = [224, 112];
const B2_PHASE_NAME = ['聚雾', '逐灯', '夜潮'];
/* 弱点增伤单次最长 1.5 秒（吐息恢复 1.80 秒里只有前 1.5 秒算，与 7.2 一致） */
const B2_WEAK_MUL_WIN = 1.5;
const B2_HOME_CX = 401, B2_CY = 133;
const B2_F1 = ['wall', 'orb'];
const B2_F2 = ['charge', 'breath', 'wall'];
const B2_F3 = ['tide', 'orb', 'charge'];
const B2_TRANS_T = 0.70;
/* BS07 三重夜潮：三条横向扫线按顺序亮起 */
const TIDE_Y = [80, 134, 188];
const TIDE_HH = 14;
const TIDE_WARN = [0.00, 1.60, 3.00];
const TIDE_PRE  = [0.85, 0.65, 0.65];
const TIDE_ON   = [0.85, 2.25, 3.65];
const TIDE_DUR  = 0.40;
const TIDE_END  = 4.05, TIDE_REC = 1.40, TIDE_TOTAL = 5.45;
const TIDE_X0 = 24, TIDE_X1 = 390;
/* BS03 夜雾横推：缺口三档轮换，全战接续 */
const WALL_GAPS = [80, 188, 134];
const CHARGE_TOUCH_R = 36;
/* BS05 吞光吐息 */
const BR_WARN = 1.15, BR_MOUTH = 0.40, BR_ON = 1.20, BR_REC = 1.80;
const BR_X0 = 24, BR_X1 = 390, BR_HH = 22, BR_YMIN = 80, BR_YMAX = 188;
/* v1.12.0（D06）：口部挂点只有这一份。
   取自 boss2 图集首帧：奶白困倦脸在左下方，小嘴位于 22.5% 宽 / 58.5% 高处。
   吐息的可见嘴、喷射起点、预兆带、危险带、弱点金环和「×1.5」短签全部读它，
   不再各自按「本体中心」估。 */
const B2_MOUTH_FX = 0.225, B2_MOUTH_FY = 0.585;
function boss2Mouth(b){
  return { x: b.x + b.w * B2_MOUTH_FX, y: b.y + b.h * B2_MOUTH_FY };
}
/* BS06 扑灯冲撞 */
const CH_WARN = 1.10, CH_SPD = 320, CH_CX0 = 401, CH_CX1 = 110;
const CH_STAG = 0.75, CH_BACK = 0.80, CH_REC = 1.20;
const CH_YMIN = 90, CH_YMAX = 178;

function spawnBoss2(){
  setMusicMode('boss');
  SFX.bossRoar();
  boss = {
    uid: nextUid(), id:'b2', x:490, y:85, baseY:85, age:0,
    hp:B2_HP, maxhp:B2_HP, w:88, h:96, r:RR_BOSS,
    flash:0, entered:false, glow:0,
    /* 阶段与招式序列。step 指向「当前正在演的那一招」：
       出生就演 F1 第一招 wall，所以 step=0（若留 -1，第一次换招会又抽到 wall，
       雾墙连打两次），缺口也已吃掉第 0 档，gapIdx 从 1 起。 */
    ph:1, step:0, mode:'wall', mt:0, contact:true, transDone:false,
    /* BS03 */
    gapIdx:1, gapY:WALL_GAPS[0], wallX:410, wallFired:false,
    /* BS04 */
    orbFired:0, aimX:0, aimY:0, lastOrbT:0,
    /* BS05 */
    bY:133, mouthY:96 * B2_MOUTH_FY, breathOn:false,
    /* BS06 */
    chY:132, cx:B2_HOME_CX, backT:0,
    /* 弱点窗口（>0 表示玩家伤害 ×1.5） */
    weakT:0, weakShown:false, wpopT:0
  };
  game.bossActive = true;
  /* 名字已经在 HUD 顶部常驻，这里给一句氛围提示，不重复名字 */
  flashMsg('湖面起雾了…');
}

/* 换下一招：phase 决定序列，标出一招的进入时刻 */
function boss2Next(b){
  b._snd = 0;
  const order = (b.ph === 3) ? B2_F3 : (b.ph === 2 ? B2_F2 : B2_F1);
  b.step = (b.step + 1) % order.length;
  b.mode = order[b.step];
  b.mt = 0;
  b.weakT = 0;
  b.weakShown = false;                          // 新一招重新允许一次「露出破绽！」确认
  b.weakT0 = 0;                                 // v1.12.0（D07）：新招清掉上一窗口起点
  b.mouthY = b.h * B2_MOUTH_FY;                 /* v1.12.0（D06）：真实嘴位，不是本体中心 */
  b.breathY0 = undefined;                       /* v1.12.0（D06）：下一招重新记吐息起点 */
  b.y = (b.id === 'b1') ? b.baseY : 85;         /* 回到站位，不带着吐息的高度进下一招 */
  if(b.mode === 'wall'){
    b.wallFired = false;
    b.wallX = 410;
    b.gapY = WALL_GAPS[b.gapIdx % 3];
    b.gapIdx++;                                  // 缺口序号接续，全战共用
  } else if(b.mode === 'orb'){
    b.orbFired = 0;
    b.aimX = player.x; b.aimY = player.y;        // 预兆开始即锁定，双球瞄同一点
    b.lastOrbT = 0;
    SFX.charge();
  } else if(b.mode === 'breath'){
    b.bY = clamp(player.y, BR_YMIN, BR_YMAX);
    b.breathOn = false;
    b.mouthY = b.h * B2_MOUTH_FY;
    SFX.charge();
  } else if(b.mode === 'tide'){
    /* BS07：三条扫线各自的状态位；本招只打一次 */
    b.tideHit = [false, false, false];
    b.tideSnd = [false, false, false];
    b.tideRec = false;
    b.contact = false;
    SFX.charge();
  } else if(b.mode === 'charge'){
    b.chY = clamp(player.y, CH_YMIN, CH_YMAX);
    b.cx = B2_HOME_CX;
    b.backT = 0;
    b.hitEnd = false;
    SFX.charge();
  }
}

/* 换阶段（EVT10）：清掉全部在途攻击与碰撞，0.70 秒散雾回位（B2_TRANS_T），下一段从首招开始 */
/* CH06：目标阶段只看当前血量；一次转场只走一段，跨级也不补演中间段 */
function boss2TargetPhase(hp){
  if(hp <= B2_THRESH[1]) return 3;
  if(hp <= B2_THRESH[0]) return 2;
  return 1;
}
function boss2EnterTrans(b, target){
  b.pendingPh = target;
  b.mode = 'trans'; b.mt = 0;
  b.contact = false; b.weakT = 0; b.breathOn = false;
  b.wallFired = false; b.orbFired = 0;
  b.tideOn = [false, false, false];
  clearEbullets();
  orbs.length = 0;
  BURSTS.length = 0;
  spark(b.x + b.w*0.5, b.y + b.h*0.5, 26, ['#C9A6E8','#FFE6B4','#F6DFA6'], 150, 0.7);
  /* v1.4.0：换阶段时补一记雾爆，让「它变了」在画面上有个落点 */
  (function(){
    const bx0 = b.x + b.w*0.5, by0 = b.y + b.h*0.5;
    pushFx({
      layer:'front', life: 0.75,
      draw: function(f){
        const q = f.t / 0.75, e = 1 - Math.pow(1 - q, 2.1);
        glowAt('mist', bx0, by0, 50 + 160 * e, 50 + 160 * e, 0, 0.70 * (1 - q));
        glowAt('ring', bx0, by0, 30 + 190 * e, 30 + 190 * e, 0, 0.42 * (1 - q));
      }
    });
  })();
  SFX.bossHalf();
  /* R05：按实际阶段说话，不再固定「聚雾 · X」前缀 */
  const ord = ['一', '二', '三'][target - 1] || '';
  flashMsg('第' + ord + '阶段 · ' + B2_PHASE_NAME[target - 1], 1);
}

/* 弱点窗口：口部金色断环 + 一句确认（WB04）
   weakT 是「还能吃 1.5 倍的剩余秒数」，由各恢复态反复挂满，
   结束时期满自解；倍率取真正落伤那一刻的 weakT，延迟爆裂跨边界也正确。 */
/* remain：本窗口还剩多少秒。窗口多长就吃多久，不能溢出到下一段
   （冲撞的失衡只有 0.75 秒，返回段的 0.80 秒应该照常有接触危险、但没有增伤）。 */
function boss2OpenWeak(b, remain){
  b.weakT = Math.max(0, Math.min(B2_WEAK_MUL_WIN, remain));
  if(!(b.weakT0 > 0) || b.weakT > b.weakT0) b.weakT0 = b.weakT;   // v1.11.0：窗口起点
  if(!b.weakShown){
    b.weakShown = true;
    SFX.bossWeak();
    flashMsg('露出破绽！');
  }
}

function boss2Weak(b, t){
  if(b.weakT <= 0) return;
  b.weakT = Math.max(0, b.weakT - t);
}

/* ---- BS05 吐息：矩形 x24..390 / y±22，玩家 r9 圆与矩形相交 ----
   每次有效命中扣 1 生命并遵守 1.5 秒无敌；结束后的 1.80 秒是弱点窗口。 */
function boss2BreathHit(b){
  const py = player.y;
  if(py + HIT_R_PLAYER < b.bY - BR_HH || py - HIT_R_PLAYER > b.bY + BR_HH) return;
  if(player.x + HIT_R_PLAYER < BR_X0 || player.x - HIT_R_PLAYER > BR_X1) return;
  hitPlayer();
}

function updateBoss2(b, dt){
  b.mt += dt;                     // age 由 updateBoss 统一推进，这里不再重复加
  if(b.wpopT > 0) b.wpopT -= dt;

  /* 半血转换：只一次，且 HP<=0 时优先击破，不在这里切换 */
  /* CH06：存活时按阈值推进阶段；一次只进一段，跨级直入目标段 */
  if(b.hp > 0 && b.mode !== 'trans'){
    const target = boss2TargetPhase(b.hp);
    if(target > b.ph) boss2EnterTrans(b, target);
  }

  /* 弱点倒计时（吐息恢复 / 冲撞两处恢复由各状态自己挂） */
  if(b.weakT > 0){
    b.weakT = Math.max(0, b.weakT - dt);
    if(b.weakT <= 0) b.weakShown = false;         // 窗口关闭，下个窗口再确认一次
  }

  const homeY = B2_CY - b.h * 0.5;

  if(b.mode === 'trans'){
    /* B2_TRANS_T = 0.70 秒散雾：从当前位置回到 (401,133) */
    const u = clamp(b.mt / B2_TRANS_T, 0, 1);
    const e = u * u * (3 - 2 * u);
    b.cx = b.cx + (B2_HOME_CX - b.cx) * e;
    b.x = b.cx - b.w * 0.5;
    b.y = b.y + (homeY - b.y) * e;
    if(u >= 1){
      b.ph = b.pendingPh || b.ph;
      b.phT = 0;
      b.step = -1;
      b.contact = true;
      b.x = B2_HOME_CX - b.w * 0.5; b.y = homeY;
      boss2Next(b);                       // 下一段的首招按表来
    }
    return;
  }

  /* F1 时本体缓慢起伏；F2 与冲撞期间由各状态直接摆位 */
  if(b.mode !== 'charge'){
    b.x = B2_HOME_CX - b.w * 0.5;
    b.y = homeY + 12 * Math.sin(0.8 * b.age);
    b.cx = B2_HOME_CX;
  }
  b.glow = 0;

  if(b.mode === 'wall'){
    if(b.mt < 0.85){ if(!b._snd){ b._snd = 1; SFX.bossWall(); } return; }   // BS03 预兆 0.85
    if(!b.wallFired) fireMistWall(b);
    b.wallX -= 84 * dt;                           // 虚拟墙统一推进
    if(b.wallX < 16) boss2Next(b);
    return;
  }

  if(b.mode === 'orb'){
    const n = (b.ph >= 2) ? 2 : 1;
    b.glow = (b.mt < 0.75) ? clamp(b.mt / 0.75, 0, 1) : 0;
    /* F2 在 +0.75 / +1.40 各发一颗，都朝同一个最初锁定点 */
    const at = (b.ph >= 2) ? [0.75, 1.40] : [0.75];
    while(b.orbFired < n && b.mt >= at[b.orbFired]){
      b.orbFired++;
      b.lastOrbT = b.mt;
      const mm = boss2Mouth(b);
      const cy = mm.y;
      /* 从真实的嘴边算角，不然方向会整体偏 2–3 像素 */
      let ang = Math.atan2(b.aimY - cy, b.aimX - mm.x);
      if(Math.cos(ang) > -0.10) ang = Math.PI;
      spawnOrb(mm.x, cy, Math.cos(ang) * 90, Math.sin(ang) * 90);
      SFX.bossOrb();
      SFX.enemyShot();
    }
    /* 末球后至少 1.50 秒，且本招重球全部消失才进下一招 */
    if(b.orbFired >= n && b.mt >= b.lastOrbT + 1.50 && orbs.length === 0) boss2Next(b);
    return;
  }

  if(b.mode === 'breath'){
    if(!b._snd){ b._snd = 1; SFX.bossBreath(); }
    /* v1.12.0（D06）：口部 0.40 秒滑到锁定高度，**本体跟着走**。
       以前只把 mouthY 这个锚点挪过去，身体还在 y133 —— 金环和喷射口浮在脸外，
       和其它招式读起来不是同一只 Boss。现在整只身体一起抬/压，
       mouthY 固定写回身体中点，所有特效（预兆、危险带、弱点）共用这一个挂点。 */
    const mo = clamp(b.mt / BR_MOUTH, 0, 1);
    if(b.breathY0 === undefined) b.breathY0 = b.y;
    /* 移动量按「嘴到 bY」算，不是「中心到 bY」—— 否则金环落在脸颊上。 */
    const targetY = Math.max(4, Math.min(270 - 4 - b.h, b.bY - b.h * B2_MOUTH_FY));
    b.y = b.breathY0 + (targetY - b.breathY0) * mo;
    b.mouthY = b.h * B2_MOUTH_FY;
    if(b.mt < BR_WARN) return;
    if(b.mt < BR_WARN + BR_ON){
      b.breathOn = true;
      boss2BreathHit(b);
      return;
    }
    b.breathOn = false;
    /* 恢复 1.80 秒：露出破绽，受伤 ×1.5（窗口随剩余时间一起收） */
    if(b.mt < BR_WARN + BR_ON + BR_REC){
      boss2OpenWeak(b, BR_WARN + BR_ON + BR_REC - b.mt);
      return;
    }
    boss2Next(b);
    return;
  }

  if(b.mode === 'tide'){
    /* BS07 三重夜潮：y80 / y134 / y188 依次扫过，同一时刻只有一条是危险带。
       预兆 0.85 / 0.65 / 0.65 秒；危险各 0.40 秒；4.05 秒全部关闭，
       之后 1.40 秒恢复期按弱点处理（×1.5）；整招 5.45 秒。 */
    const t = b.mt;
    for(let i = 0; i < 3; i++){
      if(!b.tideSnd[i] && t >= TIDE_WARN[i]){
        b.tideSnd[i] = true;
        SFX.bossWall();
      }
      if(!b.tideHit[i] && t >= TIDE_ON[i] && t < TIDE_ON[i] + TIDE_DUR){
        const py = player.y;
        if(Math.abs(py - TIDE_Y[i]) <= TIDE_HH + HIT_R_PLAYER &&
           player.x >= TIDE_X0 && player.x <= TIDE_X1){
          b.tideHit[i] = true;
          hitPlayer();
        }
      }
    }
    if(t >= TIDE_END && !b.tideRec){
      b.tideRec = true;
      /* v1.12.0（D07）：不要直接写 weakT —— 弱点窗口必须走同一个入口，
         由 boss2OpenWeak 建立起点 weakT0、清掉本窗口的短签标记和音效。
         以前这里绕过入口，短签条件 weakT0>0 不成立，F1 直跳 F3 时读不到签。 */
      b.weakShown = false;
      b.weakT0 = 0;
      boss2OpenWeak(b, TIDE_REC);
    }
    if(t >= TIDE_TOTAL) boss2Next(b);
    return;
  }

  if(b.mode === 'charge'){
    if(!b._snd){ b._snd = 1; SFX.bossCharge(); }
    const travel = (CH_CX0 - CH_CX1) / CH_SPD;    // 291/320
    if(b.mt < CH_WARN){
      /* 预兆：本体先压到锁定航道的 y */
      const u = clamp(b.mt / CH_WARN, 0, 1);
      b.y = homeY + (b.chY - b.h * 0.5 - homeY) * u;
      b.x = B2_HOME_CX - b.w * 0.5; b.cx = B2_HOME_CX;
      return;
    }
    if(b.mt < CH_WARN + travel){
      const u = (b.mt - CH_WARN) / travel;
      const px = b.cx;
      b.cx = CH_CX0 + (CH_CX1 - CH_CX0) * u;
      b.x = b.cx - b.w * 0.5;
      if(chargeSweepHit(px, b.cx, b.chY)) return;
      return;
    }
    if(b.mt < CH_WARN + travel + CH_STAG){
      /* 端点失衡 0.75 秒：弱点窗口一。
         按帧推进时 u 取不到 1，会停在 x≈112.8，所以「到点」放在这里收口：
         一进入这一段就钉到 x=110 并给一次撞击反馈，之后的返回才从端点出发。 */
      if(!b.hitEnd){
        b.hitEnd = true;
        b.cx = CH_CX1; b.x = b.cx - b.w * 0.5;
        game.shake = 6;
        SFX.bigBoom();
      }
      boss2OpenWeak(b, CH_WARN + travel + CH_STAG - b.mt);
      return;
    }
    if(b.mt < CH_WARN + travel + CH_STAG + CH_BACK){
      /* 原线返回 0.80 秒：仍有接触危险 */
      const u = (b.mt - CH_WARN - travel - CH_STAG) / CH_BACK;
      const px = b.cx;
      b.cx = CH_CX1 + (CH_CX0 - CH_CX1) * u;
      b.x = b.cx - b.w * 0.5;
      chargeSweepHit(px, b.cx, b.chY);
      return;
    }
    if(b.mt < CH_WARN + travel + CH_STAG + CH_BACK + CH_REC){
      /* 回位恢复 1.20 秒：弱点窗口二 */
      const u = (b.mt - CH_WARN - travel - CH_STAG - CH_BACK) / CH_REC;
      b.y = (b.chY - b.h * 0.5) + (homeY - (b.chY - b.h * 0.5)) * clamp(u, 0, 1);
      boss2OpenWeak(b, CH_WARN + travel + CH_STAG + CH_BACK + CH_REC - b.mt);
      return;
    }
    boss2Next(b);
  }
}

/* 冲撞扫掠：按本帧的相对线段判定，低帧率也不会穿过去 */
function chargeSweepHit(px, nx, cy){
  if(!canBeHurt()) return false;
  const rr = CHARGE_TOUCH_R;
  const t = segT(px, cy, nx, cy, player.x, player.y, rr);
  if(t < 0) return false;
  hitPlayer();
  return true;
}


/* 重雾球 BS04：半径 10、HP 5、方向锁定不追踪。
   普通射击与四魔法可伤害，雷光只 2 点不清除，绽放清弹也不删除它。 */
function spawnOrb(x, y, vx, vy){
  orbs.push({ uid: nextUid(), x:x, y:y, vx:vx, vy:vy, hp:5, maxhp:5, r:RR_ORB, flash:0, t:0 });
}

function updateOrbs(dt){
  for(let i=orbs.length-1;i>=0;i--){
    const o = orbs[i];
    if(!o) continue;
    o.t += dt;
    o.x += o.vx*dt; o.y += o.vy*dt;
    if(o.flash > 0) o.flash -= dt;
    if(o.x < -24 || o.x > 520 || o.y < -24 || o.y > 294){ orbs.splice(i,1); continue; }
    /* 2.3：重雾球与无敌玩家相交同样删除，只是不扣血 */
    const dx = o.x - player.x, dy = o.y - player.y;
    const rr = HIT_R_PLAYER + o.r;
    if(dx*dx + dy*dy < rr*rr){
      orbs.splice(i,1);
      if(canBeHurt()) hitPlayer();
    }
  }
}

function damageOrb(o, dmg){
  o.hp -= dmg;
  o.flash = 0.09;
  if(o.hp > 0) return;
  const idx = orbs.indexOf(o);
  if(idx >= 0) orbs.splice(idx, 1);
  /* 被打散不给资源与击破统计 */
  spark(o.x, o.y, 14, ['#8A5FA8','#C9A6E8','#E8D0FF'], 120, 0.45);
}

/* SK06 火花爆裂（4.6）：0.25 秒后半径 72 内各 9 伤害 */
function updateBursts(dt){
  for(let i=BURSTS.length-1;i>=0;i--){
    const b = BURSTS[i];
    if(!b) continue;
    b.t += dt;
    if(!b.done && b.t >= b.delay){
      b.done = true;
      game.shake = Math.max(game.shake, 3);
      const rEnemy = BURST_R + RR_ENEMY, rOrb = BURST_R + RR_ORB, rBoss = BURST_R + bossHitR(boss);
      for(let k=enemies.length-1;k>=0;k--){
        const e = enemies[k];
        const dx = e.x + e.w*0.5 - b.x, dy = e.y + e.h*0.5 - b.y;
        if(dx*dx + dy*dy < rEnemy*rEnemy) damageEnemy(e, BURST_DMG, 'burst');
      }
      for(let k=orbs.length-1;k>=0;k--){
        const o = orbs[k];
        const dx = o.x - b.x, dy = o.y - b.y;
        if(dx*dx + dy*dy < rOrb*rOrb) damageOrb(o, BURST_DMG);
      }
      if(boss){
        const dx = boss.x + boss.w*0.5 - b.x, dy = boss.y + boss.h*0.5 - b.y;
        if(dx*dx + dy*dy < rBoss*rBoss) damageBoss(BURST_DMG);
      }
      /* 4.6：同一爆心半径 72 内清普通敌弹（重雾球不在其列，仍只吃伤害） */
      for(let k=ebullets.length-1;k>=0;k--){
        const eb = ebullets[k];
        const dx = eb.x - b.x, dy = eb.y - b.y;
        if(dx*dx + dy*dy < BURST_CLEAR_R*BURST_CLEAR_R) ebullets.splice(k,1);
      }
      spark(b.x, b.y, 18, ['#E0C8FF','#C9A6E8','#FFFFFF'], 170, 0.5);
      SFX.hit();
    }
    if(b.t > b.delay + b.life) BURSTS.splice(i,1);
  }
}

/* ---- CH02 Boss 支援灯怪（LC07 / LC08 / LC09）----
   每段至多一只，同屏至多一只；只在「恢复窗」刷，不在吐息/冲撞/夜潮的高压帧插入。
   高度取玩家所在半区的远侧：玩家 y>=134 时选 80，否则 188；从 x=500 进入。 */
function supportLanternBlocked(){
  const b = boss;
  if(!b || b.id === 'b1') return false;
  if(b.mode === 'trans') return true;
  /* v1.12.0（D08）：只认「真实恢复窗」= 弱点窗口 weakT>0。
     原来按招式 mode 一刀切，把「包含恢复段的整招」全封了，
     结果蓄力/预兆期反而能刷出补给；中 Boss 的鼓腮预兆也照样生成。 */
  if(b.weakT > 0) return false;
  return true;
}
function updateSupportLantern(){
  if(!boss || !game.bossActive || game.teaTime) return;
  if(!game.supportDone) game.supportDone = { PH02:false, F2:false, F3:false };
  /* 同屏至多一只支援灯怪 */
  for(let i=0;i<enemies.length;i++) if(enemies[i].support) return;

  const b = boss;
  let key = null;
  if(b.id === 'b1'){
    /* v1.12.0（D08）：中 Boss 也有明确恢复窗 —— 见 updateBoss1 的 recWin。
       原来的「5 秒后可刷」会在鼓腮预兆（0.8–1.45）里生成支援；
       改用 weakT 又会永远刷不出来（中 Boss 不吃弱点倍率，没有 weakT）。 */
    if(game.phaseT < 5) return;
    if(!b.recWin) return;
    key = 'PH02';
  } else {
    if(b.ph < 2) return;
    if((b.phT || 0) < 1.2) return;             // 进入本段至少 1.2 秒
    if(supportLanternBlocked()) return;        // 高压招式中不刷
    key = (b.ph >= 3) ? 'F3' : 'F2';
  }
  if(game.supportDone[key]) return;
  game.supportDone[key] = true;

  const y = (player.y >= 134) ? 80 : 188;
  addEnemy('carrier', 500, y, 0, 0);
  const e = enemies[enemies.length - 1];
  e.support = true;
  e.x = 500;
  SFX.carrierGulp();
}

function updateBoss(dt){
  if(!boss) return;
  const b = boss;
  b.age += dt;
  b.phT = (b.phT || 0) + dt;      /* CH02：本段已进入多久，支援灯怪用它判 1.2 秒 */
  if(b.flash > 0) b.flash -= dt;
  b.glow = 0;

  /* 停留x 390 / 401 是本体中心，本体宽 88 → 左边缘 346 / 357 */
  const homeX = (b.id === 'b1') ? 346 : 357;
  if(!b.entered){
    if(b.x > homeX) b.x = Math.max(homeX, b.x - 65*dt);
    else b.entered = true;
    b.y = b.baseY;
  }
  if(b.entered){
    if(b.id === 'b1') updateBoss1(b, dt);
    else              updateBoss2(b, dt);
  }
  updateSupportLantern();

  /* 接触危险：换阶段散雾的 0.70 秒里 contact=false，
     不然玩家贴脸看转换会被一段「不该存在的身体」撞死。 */
  if(canBeHurt() && b.contact !== false){
    const dx = b.x + b.w*0.5 - player.x, dy = b.y + b.h*0.5 - player.y;
    if(dx*dx + dy*dy < HIT_R_BOSS_TOUCH*HIT_R_BOSS_TOUCH) hitPlayer();
  }
}

/* EN06 打盹的夜团（7.1）：190 HP，5.8 秒固定循环（v1.6.0 Boss循环表）
   1) 0.00–0.80 向 y=86/184 交替移位
   2) 0.80 起鼓腮预兆 0.65 秒 → 1.45 / 1.70 / 1.95 沿同一锁定点三连吐（BS01）
      1.95–3.20 恢复
   3) 3.20 起预兆 0.65 秒（雾团膨起）→ 3.85 朝左固定五向扇（BS02）
      3.85–5.80 恢复，循环归零 */
function updateBoss1(b, dt){
  const P = 5.8;
  b.cyc += dt;
  const n = Math.floor(b.cyc / P);
  const q = b.cyc - n * P;
  if(n !== b.evN){
    b.evN = n;
    b.shotIdx = 0; b.aimLocked = false; b.fanFired = false; b.aimAng = null;
    b.targetY = (n % 2 === 0) ? 86 : 184;
  }
  const wantY = b.targetY - b.h*0.5;          // y=86 / 184 指本体中心
  if(q < 0.80){                              // 步骤1：0–0.80 移位
    b.y += (wantY - b.y) * clamp(7*dt, 0, 1);
  } else {
    b.y += Math.sin(b.age*1.6) * 6 * dt;      // 其余时间轻微起伏
  }
  b.y = clamp(b.y, 34, 214);

  /* 步骤2：0.80 鼓腮锁定玩家当时位置（预兆 0.65 秒，到 1.45 发第一颗） */
  if(q >= 0.80 && !b.aimLocked){
    b.aimLocked = true;
    b.aimX = player.x; b.aimY = player.y;
    /* 7.1：方向在预兆开始时就锁死，三发共用同一个角度，
       不再「每发重新按当时的位置算一次」 */
    const cx0 = b.x + b.w*0.5, cy0 = b.y + b.h*0.5;
    let a0 = Math.atan2(b.aimY - cy0, b.aimX - cx0);
    if(Math.cos(a0) > -0.15) a0 = Math.PI + (a0 > 0 ? 0.6 : -0.6);
    b.aimAng = a0;
    SFX.charge();
  }
  if(q >= 0.80 && q < 1.45) b.glow = 0.65;

  /* 1.45 / 1.70 / 1.95 三连吐，同一锁定方向 */
  const shots = [1.45, 1.70, 1.95];
  while(b.shotIdx < 3 && q >= shots[b.shotIdx]){
    const cy = b.y + b.h*0.5;
    const ang = (b.aimAng == null) ? Math.PI : b.aimAng;   // 三发同一方向
    ebullets.push({ x:b.x - 14, y:cy, vx:Math.cos(ang)*84, vy:Math.sin(ang)*84, life:8, r:3 });
    SFX.enemyShot();
    b.shotIdx++;
  }

  /* 步骤3：3.20–3.85 五枚附属雾团一起膨起（预兆 0.65 秒） */
  b.puff = (q >= 3.20 && q < 3.85) ? clamp((q - 3.20) / 0.65, 0, 1) : 0;
  if(b.puff > 0) b.glow = Math.max(b.glow, b.puff * 0.8);

  /* 3.85 松团散雾：朝左固定扇形 −0.72 / −0.36 / 0 / 0.36 / 0.72，速度 65 */
  if(q >= 3.85 && !b.fanFired){
    b.fanFired = true;
    const cx = b.x + b.w*0.5, cy = b.y + b.h*0.5;
    for(let i=-2;i<=2;i++){
      const ang = Math.PI + i*0.36;
      ebullets.push({ x:cx - 12, y:cy, vx:Math.cos(ang)*65, vy:Math.sin(ang)*65, life:8, r:3 });
    }
    SFX.enemyShot();
  }

  /* v1.12.0（D08）：中 Boss 的真实恢复窗 —— 9.1 表里的 1.95–3.20 与 3.85–5.80。
     0.80–1.45 鼓腮预兆、1.45–1.95 三连吐、3.20–3.85 扇射预兆都不算恢复，
     支援灯怪只在 recWin 里投放（原来按 weakT 判，中 Boss 根本没有 weakT，
     等于永远不刷；按「时间≥5 秒」判又会在鼓腮预兆里刷）。 */
  b.recWin = (q >= 1.95 && q < 3.20) || (q >= 3.85 && b.fanFired === true);
}

/* BS03 夜雾横推：x=410、y=48..224 每 16 一个候选点共 12 个，
   移除距缺口中心 ≤40 的候选，其余以 84 水平向左。 */
function fireMistWall(b){
  b.wallFired = true;
  for(let y=48; y<=224; y+=16){
    if(Math.abs(y - b.gapY) <= 40) continue;
    /* v1.11.0（FX-B03）：雾墙改成分离的玫紫雾滴 —— 打上 mist 标记单独绘制，
       缺口处的候选点本来就不发弹，所以缺口保持真空。 */
    ebullets.push({ x:410, y:y, vx:-84, vy:0, life:12, r:3, mist:true });
  }
  SFX.enemyShot();
  if(!game.wallHint){
    game.wallHint = true;
    flashMsg('从空隙穿过');
  }
}

/* Boss 击破（5.2）：中 Boss 1000 分 + 10 微光；最终 Boss 2500 分 + 14 微光，
   不额外产星辉；同时清全部敌弹与重雾球。 */
function damageBoss(dmg){
  /* 权威门禁（5.2）：已经失败 / 已经离开 play 的这一步不再结算任何 Boss 奖励 */
  if(!boss || !gameLive()) return;
  /* WB04：弱点倍率取真正落伤这一刻的状态，延迟爆裂跨窗口边界才对得上。
     只作用于玩家的直接伤害（普通星弹 / 魔法 / 强化弹），重雾球不经过这里。 */
  const weak = (boss.id === 'b2' && boss.weakT > 0);
  const real = weak ? dmg * B2_WEAK_MUL : dmg;
  /* v1.10.1 充能：按 min(命中前剩余HP, 最终伤害) 记「真实生命损失」，
     含弱点倍率；过量伤害和尸体残弹都不算。能量保留小数。 */
  const hpBefore = Math.max(0, boss.hp);
  const applied  = Math.max(0, Math.min(hpBefore, real));
  boss.hp -= applied;
  /* 绽放期间不攒下一轮能量（微光成长 / 分数照常）；
     最终 Boss 击破后战斗充能整体关闭，避免「死后才闪就绪」。 */
  if(applied > 0 && !bloomActive() && !game.bloomChargeOff){
    player.bloom = Math.min(100, player.bloom + applied * BLOOM_HP_RATE);
  }
  boss.flash = 0.07;
  if(weak && (boss.wpopT || 0) <= 0){
    boss.wpopT = 0.34;                            // 弱点期间不刷屏，0.34 秒一条
    popup(boss.x + boss.w*0.5, boss.y - 4, '×1.5', '#FFD98A');
  }
  if(boss.hp <= 0){
    const b = boss;
    const isFinal = (b.id === 'b2');
    if(isFinal){
      /* v1.10.1：最终击破 = 技能与战斗充能一起收尾。
         不能在这一步之后再涨一格能量、闪出「就绪」。 */
      game.bloomChargeOff = true;
      player.bloom = 0;
      player.bloomT = 0;
      /* v1.12.2：夜雾散了，岸上的路灯开始一盏盏亮（0.28 秒一档） */
      game.lampIgnite = 0.0001;
    }
    const cx = b.x + b.w*0.5, cy = b.y + b.h*0.5;
    game.score += isFinal ? 2500 : 1000;
    clearEbullets();
    BURSTS.length = 0;
    /* 8. / 10.4：过渡演出期间清掉我方残弹与未结算技能，不留空放 */
    pbullets.length = 0;
    player.flameT = 0; player.flameSeg = 0; player.flameAcc = 0;
    const nMote = isFinal ? 14 : 10;         // v1.6.0：14 / 10 微光
    creditBossMotes(cx, cy, nMote);           // 击破事务内一次性入账（5.2 / 10.4）
    spark(cx, cy, 40, ['#C9A6E8','#F0C0A8','#9BD0EE','#FFF2CF'], 190, 0.8);
    popup(cx, cy, '+' + (isFinal ? 2500 : 1000), '#F2CF8A');
    fxBossBreak(b);                    // 0.8 秒裂解表现，填满阶段过渡窗口
    SFX.bossBreak();
    game.shake = 8;
    if(isFinal){
      setMusicMode('normal');
      game.bossDead = true;
      flashMsg('大夜怪散去', 1);
    } else {
      game.midBossDead = true;
      /* v1.12f：中 Boss 死后要把音乐换回场地曲。
         原来只在「最终击破」调 setMusicMode('normal')，中 Boss 打完一直挂着 Boss 曲；
         Boss 曲放完（或元素被浏览器挂起）之后就没有声音了。 */
      setMusicMode('normal');
      flashMsg('夜团散去，进入石桥', 1);
      /* EVT02 / SUP04：中 Boss 击破恢复 —— 生命 +1（封顶 5）、魔力保底 1 格。
         只执行一次（boss 已置空，不可能重复进入）。 */
      if(player.hp < player.maxHp){
        player.hp++;
        popup(player.x, player.y - 18, 'HP+1', '#FF9BC0');
      }
      /* CH01：中 Boss 击破不再补炉火 */
    }
    boss = null;
    game.bossActive = false;
    /* v1.12.0（D05）：击破当步关闭旧战斗危险 ——
       残留小怪与敌弹直接退场（不给击破奖励、不进计分），重球也清掉；
       0.80 秒表现里角色可以移动，拾取与在途火种照常，
       但不会再被残留小怪撞死，也不会收到新的火团。 */
    clearBattlefield();
    orbs.length = 0;
    game.transT = BOSS_EXIT_T;
  }
}

/* 5.2 / 10.4：Boss 微光在击破瞬间结算成长 / 分数 / 当时的绽放能量，
   光迹只是表现，不参与拾取。
   原来丢实体等吸附：站位偏远或绽放计时快结束时，10 / 14 颗会有一部分没吸到。 */
function creditBossMotes(cx, cy, n){
  let gain = 0;
  for(let i=0;i<n;i++){
    game.motes++;
    gain += 20;
    player.grow = Math.min(GROW_MAX, player.grow + 1);
    if(!bloomActive() && !game.bloomChargeOff)
      player.bloom = Math.min(100, player.bloom + BLOOM_MOTE);
    pickups.push({ type:'mote', ghost:1, x:cx + rand(-18,18), y:cy + rand(-18,18),
                   t:0, age:0, vx:rand(-30,-10), vy:rand(-26,26), fallback:0.6 });
  }
  game.score += gain;
  updateShotLv();
  popup(cx, cy - 12, '+' + gain, '#F6E6C8');
}

function clearEbullets(){ ebullets.length = 0; orbs.length = 0; }

/* EVT04：清旧小怪与旧敌弹，不给清场奖励（策划案 8.8 / 10.3） */
function clearBattlefield(){
  enemies.length = 0;
  ebullets.length = 0;
}

/* ---- 玩家子弹 ---- */
/* 落星追踪（4.7）：转向 540°/s，方向逐帧修正；目标死亡或离屏立即重锁。
   原来目标一消失就把 target 置空、放任直飞，三颗星经常空飞。 */

/* 目标池：屏内普通怪 / 重雾球 / Boss，按与玩家的距离排序，
   距离相同按对象序号稳定排序，避免同帧里目标来回跳。 */
/* WB12 目标池优先级：
   1) 先只收「中心真的在屏内」的普通怪与重球；
   2) 排位是 未分配 → 曼哈顿距离 → 稳定 uid；
   3) 只要池里有普通目标就绝不选 Boss，三颗可以集中打同一个普通目标；
   4) 一个普通目标都没有时，才看屏内的 Boss；
   5) 全空返回空数组，落星保持原方向飞到寿命结束。 */
function fallPool(){
  const used = {};
  /* 场上在飞的落星用来标「已分配」。某些隔离自检环境只注入敌我两边的数据，
     这里对 pbullets 缺失做一次兜底，正式运行里它一定存在。 */
  const flying = (typeof pbullets === 'undefined' || !pbullets) ? [] : pbullets;
  for(let i=0;i<flying.length;i++){
    const b = flying[i];
    if(b.type !== 'falling' || !b.target || !b.target.ref) continue;
    const u = b.target.ref.uid;
    if(u !== undefined) used[u] = 1;
  }
  const inSight = (x, y) => (x > 0 && x < W && y > 0 && y < H);
  const norm = [];
  for(let i=0;i<enemies.length;i++){
    const e = enemies[i];
    const cx = e.x + e.w*0.5, cy = e.y + e.h*0.5;
    if(!inSight(cx, cy)) continue;
    norm.push({ kind:'enemy', ref:e, d: Math.abs(cx - player.x) + Math.abs(cy - player.y),
                uid: e.uid || 0, key: 'e' + (e.uid || ('i' + i)),
                used: used[e.uid] ? 1 : 0 });
  }
  for(let i=0;i<orbs.length;i++){
    const o = orbs[i];
    if(!inSight(o.x, o.y)) continue;
    norm.push({ kind:'orb', ref:o, d: Math.abs(o.x - player.x) + Math.abs(o.y - player.y),
                uid: o.uid || 0, key: 'o' + (o.uid || ('i' + i)),
                used: used[o.uid] ? 1 : 0 });
  }
  norm.sort(function(x,y){ return (x.used - y.used) || (x.d - y.d) || (x.uid - y.uid); });
  if(norm.length) return norm;
  if(boss && inSight(boss.x + boss.w*0.5, boss.y + boss.h*0.5)){
    const cx = boss.x + boss.w*0.5, cy = boss.y + boss.h*0.5;
    return [{ kind:'boss', ref:boss, d: Math.abs(cx - player.x) + Math.abs(cy - player.y),
              uid: boss.uid || 0, key: 'b' + (boss.uid || 0), used: 0 }];
  }
  return [];
}

function targetPos(tg){
  const ref = tg.ref;
  if(tg.kind === 'orb') return { x:ref.x, y:ref.y };
  return { x:ref.x + ref.w*0.5, y:ref.y + ref.h*0.5 };
}

function steerFalling(b, dt){
  let tg = b.target, alive = false, tx = 0, ty = 0;
  const vis = (x, y) => (x > 0 && x < W && y > 0 && y < H);   // 与 fallPool 同一口径
  if(tg){
    const ref = tg.ref;
    if(tg.kind === 'enemy'){
      if(enemies.indexOf(ref) >= 0 && ref.hp > 0 &&
         vis(ref.x + ref.w*0.5, ref.y + ref.h*0.5)){
        alive = true; tx = ref.x + ref.w*0.5; ty = ref.y + ref.h*0.5;
      }
    } else if(tg.kind === 'orb'){
      if(orbs.indexOf(ref) >= 0 && vis(ref.x, ref.y)){
        alive = true; tx = ref.x; ty = ref.y;
      }
    } else if(tg.kind === 'boss'){
      if(boss && boss === ref && vis(boss.x + boss.w*0.5, boss.y + boss.h*0.5)){
        alive = true; tx = boss.x + boss.w*0.5; ty = boss.y + boss.h*0.5;
      }
    }
  }
  if(!alive){
    /* 目标没了就当场重锁，而不是继续直飞 */
    const pool = fallPool();
    b.target = pool.length ? pool[0] : null;
    tg = b.target;
    if(!tg) return;                      // 整屏无目标：保持当前方向滑出
    const p2 = targetPos(tg);
    tx = p2.x; ty = p2.y;
  }
  const desired = Math.atan2(ty - b.y, tx - b.x);
  const cur = Math.atan2(b.vy, b.vx);
  let d = desired - cur;
  while(d > Math.PI)  d -= Math.PI*2;
  while(d < -Math.PI) d += Math.PI*2;
  const maxT = b.turn * dt;
  const na = cur + clamp(d, -maxT, maxT);
  b.vx = Math.cos(na) * FALL_SPD;
  b.vy = Math.sin(na) * FALL_SPD;
}

/* 攻击检测（2.3 / 4.2）：按上一帧到当前帧的线段扫掠，
   取最近交点结算，低帧率下也不会穿过薄目标。
   线段与圆命中返回 0..1 的参数 t，未命中返回 -1。 */
function segT(x0, y0, x1, y1, cx, cy, rr){
  const dx = x1 - x0, dy = y1 - y0;
  const L2 = dx*dx + dy*dy;
  let t = 0;
  if(L2 > 0) t = clamp(((cx - x0)*dx + (cy - y0)*dy) / L2, 0, 1);
  const qx = x0 + dx*t, qy = y0 + dy*t;
  const ex = cx - qx, ey = cy - qy;
  return (ex*ex + ey*ey < rr*rr) ? t : -1;
}

function updateBullets(dt){
  /* 隔离自检环境只注入被点名的函数，特效钩子与常量可能缺位：
     这里兜底成空函数/默认值，命中与穿透判定完全不受影响。 */
  const fxHit = (typeof bloomHitFx === 'function') ? bloomHitFx : function(){};
  const BL_PIERCE = (typeof BLOOM_PIERCE === 'number') ? BLOOM_PIERCE : 1;
  /* ---- 敌方先结算（2.3 / 5.2「失败优先」）----
     先处理敌弹与本帧位移后的玩家，再处理我方弹命中：
     同一步里既中弹又打爆 Boss 时，先判失败，奖励不再补发。 */
  /* ---- 敌方：玩家受击核心 r9，中心距 <12 受伤 ---- */
  for(let i=ebullets.length-1;i>=0;i--){
    const b = ebullets[i];
    if(!b) continue;
    b.x += b.vx*dt; b.y += b.vy*dt;
    b.life -= dt;
    /* v1.11.0（C09）：桥下收尾的 0.30 秒里残弹只散雾，不再有判定 */
    if(game.bridgeFade > 0) b.noHit = true;
    if(b.life <= 0 || b.x < -24 || b.x > 520 || b.y < -24 || b.y > 294){ ebullets.splice(i,1); continue; }
    /* 2.3：相交就删除，无敌只免伤不免疫（不扩大受击范围） */
    const dx = b.x - player.x, dy = b.y - player.y;
    if(!b.noHit && dx*dx + dy*dy < HIT_R_EBULLET*HIT_R_EBULLET){
      /* 相交就删弹（无敌只免伤，不免疫、不扩大受击范围） */
      ebullets.splice(i,1);
      if(canBeHurt()) hitPlayer();
    }
  }

  /* ---- 我方 ---- */
  /* ---- 我方 ---- */
  for(let i=pbullets.length-1;i>=0;i--){
    const b = pbullets[i];
    if(!b) continue;                 // Boss 击破会整表清空，循环里要防越界
    if(b.type === 'falling' && b.delay > 0){
      b.delay -= dt;                 // 生成间隔内挂机，寿命同时冻结
      /* 激活的这一刻才定出弹点（WB12）：后两颗要跟着玩家当时的位置走 */
      if(b.delay <= 0 && b.born){
        b.born = false;
        b.x = player.x + 20; b.y = player.y + 2;
        b.vx = FALL_SPD; b.vy = 0;
      }
      continue;
    }
    if(b.type === 'falling') steerFalling(b, dt);

    const x0 = b.x, y0 = b.y;
    b.x += b.vx*dt; b.y += b.vy*dt;
    b.life -= dt;
    if(b.life <= 0 || b.x > W + 30 || b.y < -30 || b.y > H + 30){ pbullets.splice(i,1); continue; }

    /* 找最近交点（普通怪 / Boss / 重雾球共用同一条线段） */
    let kind = -1, target = null, bestT = 2;
    for(let e=0;e<enemies.length;e++){
      const en = enemies[e];
      if(b.hitSet && b.hitSet.indexOf(en) >= 0) continue;
      const t = segT(x0, y0, b.x, b.y, en.x + en.w*0.5, en.y + en.h*0.5, b.r + RR_ENEMY);
      if(t >= 0 && t < bestT){ bestT = t; kind = 0; target = en; }
    }
    if(boss && !(b.hitSet && b.hitSet.indexOf(boss) >= 0)){
      /* 半径统一：Boss 自带 r 就用它，没有才退回 RR_BOSS（WB13） */
      const bhr = boss.r ? boss.r : RR_BOSS;
      const t = segT(x0, y0, b.x, b.y, boss.x + boss.w*0.5, boss.y + boss.h*0.5, b.r + bhr);
      if(t >= 0 && t < bestT){ bestT = t; kind = 1; target = boss; }
    }
    for(let k=0;k<orbs.length;k++){
      const o = orbs[k];
      if(b.hitSet && b.hitSet.indexOf(o) >= 0) continue;
      const t = segT(x0, y0, b.x, b.y, o.x, o.y, b.r + RR_ORB);
      if(t >= 0 && t < bestT){ bestT = t; kind = 2; target = o; }
    }

    if(kind < 0) continue;
    /* 真实交点：用线段上的参数 t 还原坐标，反馈才挂得住（BF04 / BF05） */
    const ix = x0 + (b.x - x0) * bestT, iy = y0 + (b.y - y0) * bestT;

    if(kind === 0){
      /* 绽放弹可依次穿过最多 2 个普通怪，同一目标只结算一次 */
      if(b.hitSet) b.hitSet.push(target);
      damageEnemy(target, b.dmg, (b.type === 'falling') ? 'falling' : 'shot');
      if(b.pierce > 0){
        b.pierce--;
        if(b.pierce < BL_PIERCE) fxHit(ix, iy, 'pierce');   // 首次穿透
        spark(b.x, b.y, 2, ['#DAFFEC','#FFF6DC'], 60, 0.16);
        continue;
      }
      if(b.pierce === 0 && b.hitSet) fxHit(ix, iy, 'end');     // 第二次命中即终止
    } else if(kind === 1){
      damageBoss(b.dmg);
      if(b.hitSet) fxHit(ix, iy, 'end');
    } else {
      damageOrb(target, b.dmg);
      if(b.hitSet) fxHit(ix, iy, 'end');
    }
    spark(b.x, b.y, 3, ['#FFF2CF','#F6DFA6'], 70, 0.2);
    pbullets.splice(i,1);
  }
}

/* ---- 水晶 ---- */
function updateCrystals(){ }

function pickCrystal(){ }

/* ---- 掉落物 ---- */
function dropCrystal(){ }
/* 掉落与回收（策划案 5.1 / 5.3）：
   微光 / 星辉 / 灯芯先散开 0.12 秒表明来源，再按每秒差值系数 5 吸附，距离<18 收取；
   最长 1.8 秒后直接回收。萤火不吸附，靠移动接取（距离<20）。 */
function dropMote(x, y, n){
  n = n || 1;
  /* R07：记「供给」—— 生成多少颗微光。回收 / 漏失另记，三数一对就知道
     成长偏晚到底是掉得少，还是掉在路上没吸到。 */
  game.supplyMote = (game.supplyMote || 0) + n;
  for(let i=0;i<n;i++){
    pickups.push({ type:'mote', x:x, y:y, t:rand(0,6), age:0,
      vx:rand(-30,-10), vy:rand(-26,26), fallback:1.8 });
  }
}
function dropHeart(x, y){
  game.heartsSpawned++;
  pickups.push({ type:'heart', x:x, y:y, t:0, age:0, vx:-22, vy:10, fallback:HEART_LIFE });
}
function dropWick(x, y){
  pickups.push({ type:'wick', x:x, y:y, t:0, age:0,
    vx:rand(-14,-4), vy:rand(-16,16), fallback:1.8 });
}
function dropShine(x, y){
  pickups.push({ type:'shine', x:x, y:y, t:0, age:0,
    vx:rand(-24,-8), vy:rand(-22,22), fallback:1.8,
    round:player.bloomRound });
}
function dropFirefly(x, y){
  pickups.push({ type:'fly', x:x, y:y, t:0, age:0, vx:FLY_HV, vy:FLY_FALL, fallback:99 });
}
function dropStar(x, y){ dropShine(x, y); }
function dropCup(x, y){ pickups.push({ type:'cup', x:x, y:y, t:0, vx:-8, vy:72 }); }

/* ---- CH01 炉火火种：击破灯怪后飞向炉火按钮的库存区域 ----
   先在原地亮 0.10 秒（破灯），再沿 0.45 秒曲线飞到按钮；抵达才算到账。
   飞行不参与碰撞、不可被打掉，也不绕到玩家身上。 */
const FIRE_WISPS = [];
/* 世界坐标(480×270) → #hud 内的 CSS 像素 */
function worldToHud(wx, wy){
  /* M01：世界实际画在 game.core 里（手机不是铺满），起点必须按 core 映射 */
  const hud = document.getElementById('hud');
  const stage = document.getElementById('stage');
  if(!hud || !stage) return { x:0, y:0 };
  const sr = stage.getBoundingClientRect(), rb = hud.getBoundingClientRect();
  const c = game.core || { x:0, y:0, w: sr.width, h: sr.height };
  return {
    x: (sr.left - rb.left) + c.x + (wx / W) * c.w,
    y: (sr.top - rb.top) + c.y + (wy / H) * c.h
  };
}
/* 终点：炉火按钮里「火焰图标」的中心（不是按钮中心，也不写死坐标） */
function fireIconCenter(){
  const ico = document.querySelector('#btnMagic .ico');
  const hud = document.getElementById('hud');
  if(!ico || !hud) return { x:40, y:240 };
  const r = ico.getBoundingClientRect(), b = hud.getBoundingClientRect();
  return { x: r.left - b.left + r.width * 0.5, y: r.top - b.top + r.height * 0.5 };
}
/* 到账时图标短亮 0.18 秒 + 数字轻跳 */
function flashFireBtn(){
  const btn = document.getElementById('btnMagic');
  if(!btn) return;
  btn.classList.add('lit');
  setTimeout(function(){ btn.classList.remove('lit'); }, 180);
}
var fireRewardSeq = 0;   /* resetWorld 可能早于此处执行，用 var 避免 TDZ */
/* v1.3.1：击破当步就建唯一 rewardId 并按「已持有 + 在途」预约一个空位。
   容量满时当场转 100 分，不播假的入槽动画；飞行中施法也不重分配已判定的结果。 */
function spawnFireWisp(x, y){
  const hud = document.getElementById('hud');
  if(!hud) return;
  const id = ++fireRewardSeq;
  if(player.fireAmmo + FIRE_WISPS.length >= FIRE_MAX){
    game.score += 100;
    showFirePlus('炉火已满 +100', true);
    return;
  }
  const el = document.createElement('i');
  el.className = 'fireWisp';
  hud.appendChild(el);
  /* v1.12.0（V01）：起点存**世界坐标**，每帧再经 worldToHud 映射。
     以前存的是施放那一瞬的 CSS 坐标，旋转 / 换手 / resize 之后核心矩形变了，
     起点还钉在旧位置，整条弧线会突然跳一下。 */
  FIRE_WISPS.push({ id: id, wx: x, wy: y, el: el, t: 0, hold: 0.10, fly: 0.60 });
}

/* 资源区反馈：文字挂在炉火按钮旁，不再在玩家头上飘 */
function showFirePlus(text, dim){
  const hud = document.getElementById('hud');
  const btn = document.getElementById('btnMagic');
  if(!hud || !btn) return;
  const r = btn.getBoundingClientRect(), b = hud.getBoundingClientRect();
  const el = document.createElement('span');
  el.className = 'firePlus' + (dim ? ' dim' : '');
  el.textContent = text;
  el.style.left = (r.left - b.left + r.width * 0.5) + 'px';
  el.style.top = (r.top - b.top - 6) + 'px';
  hud.appendChild(el);
  setTimeout(function(){ el.remove(); }, 620);
}

/* 清掉在途奖励：重开 / 返回标题 / 失败时调用，避免上一局的火种落进新局 */
function clearFireWisps(){
  for(let i = 0; i < FIRE_WISPS.length; i++){
    if(FIRE_WISPS[i].el) FIRE_WISPS[i].el.remove();
  }
  FIRE_WISPS.length = 0;
}
function updateFireWisps(dt){
  for(let i = FIRE_WISPS.length - 1; i >= 0; i--){
    const w = FIRE_WISPS[i];
    w.t += dt;
    if(!w.el){ FIRE_WISPS.splice(i, 1); continue; }
    /* v1.12.0（V01）：起点每帧重映射；终点也每帧重读真实图标中心，两端一起跟布局走 */
    const p0 = worldToHud(w.wx, w.wy);
    if(w.t < w.hold){
      w.el.style.left = p0.x + 'px';
      w.el.style.top = p0.y + 'px';
      continue;
    }
    const t = clamp((w.t - w.hold) / w.fly, 0, 1);
    const e = t * t * (3 - 2 * t);
    const p1 = fireIconCenter();              /* 每帧重读：布局变化后仍对准 */
    const cx = (p0.x + p1.x) * 0.5;
    const cy = Math.min(p0.y, p1.y) - 46;   /* 向上拱的短弧 */
    const u = 1 - e;
    w.el.style.left = (u*u*p0.x + 2*u*e*cx + e*e*p1.x) + 'px';
    w.el.style.top  = (u*u*p0.y + 2*u*e*cy + e*e*p1.y) + 'px';
    w.el.style.opacity = String(1 - 0.15 * e);
    if(w.t >= w.hold + w.fly){
      w.el.remove();
      if(addFire(1, 'carrier') > 0){
        showFirePlus('炉火 +1', false);
        flashFireBtn();
        /* 到账之后才让背景路灯次级变亮（原来击破瞬间就飞一束暖光，抢了火种的视线） */
        /* v1.12.2：火种到账不再点亮背景路灯。
           路灯改成剧情节拍 —— 开战全黑，击破大夜怪后整条岸一盏盏亮起来。
           拿补给顺手把村子点亮，会让「打完天才亮」这件事没有落点。 */
        Audio7.tone({freq:660, dur:0.16, vol:0.10, type:'triangle'});
        Audio7.tone({freq:990, dur:0.22, vol:0.08, type:'triangle', delay:0.09});
      } else {
        game.score += 100;
        showFirePlus('炉火已满 +100', true);
      }
      FIRE_WISPS.splice(i, 1);
    }
  }
}

function updatePickups(dt){
  /* WB07：这张表以前写了 pick 位却没人读，PH04 / 过渡期的吸附其实一直在跑。
     现在真的读：pick=0（只有三秒准备期）时整表冻结，其余阶段照常吸附。 */
  if(!caps().pick) return;
  for(let i=pickups.length-1;i>=0;i--){
    const p = pickups[i];
    p.t += dt; p.age += dt;

/* 纯表现光迹（Boss 击破）：只飞向玩家再消失，不入账 */
    if(p.ghost){
      const k = clamp(6*dt, 0, 1);
      p.x += (player.x - p.x) * k;
      p.y += (player.y - p.y) * k;
      if(p.age >= p.fallback) pickups.splice(i,1);
      continue;
    }

    /* CH07：萤火进入 96 就锁定吸附，以 220 飞向躯干，距 36 内直接接取。
       吸附状态一旦建立就保持（不因玩家挪开而反复进出），直到接到或阶段结束。 */
    if(p.type === 'fly'){
      if(!player.dead){
        const dx = player.x - p.x, dy = player.y - p.y;
        const d = Math.sqrt(dx*dx + dy*dy);
        if(p.attract || d <= FLY_MAGNET){
          p.attract = true;
          const step = FLY_MAG_SPD * dt;
          if(d <= FLY_GRAB || step >= d){ collect(p); pickups.splice(i,1); continue; }
          p.x += dx / d * step;
          p.y += dy / d * step;
          if(p.y > 285){ pickups.splice(i,1); }
          continue;
        }
      }
      p.x += p.vx*dt; p.y += p.vy*dt;
      if(p.y > 285){ pickups.splice(i,1); continue; }
      continue;
    }

    /* v1.11.0：爱心独立分支 —— 只在这里推进，绝不落进微光的通用吸附/回收。
       v1.11.0b（用户要求「爱心改飘过来」）：不再只在 80 内才吸 ——
       远处就以温柔的 88 像素/秒朝玩家飘，进 80 后加速到 220，24 内直接接取。
       仍然只走这条分支，不用微光那套全屏吸附与 1.8 秒兜底。 */
    if(p.type === 'heart'){
      if(player.dead){
        if(p.age >= HEART_LIFE) pickups.splice(i,1);
        continue;
      }
      const hdx = player.x - p.x, hdy = player.y - p.y;
      const hd = Math.sqrt(hdx*hdx + hdy*hdy) || 1;
      const hspd = (hd <= HEART_MAGNET) ? HEART_SPD : HEART_HOME;
      const hstep = hspd * dt;
      if(hd <= HEART_PICK || hstep >= hd){ collect(p); pickups.splice(i,1); continue; }
      p.x += hdx / hd * hstep;
      p.y += hdy / hd * hstep;
      p.attract = true;
      p.x = clamp(p.x, -20, W + 20);
      if(p.age >= HEART_LIFE) pickups.splice(i,1);
      continue;
    }

    if(p.type === 'cup'){
      p.x += p.vx*dt; p.y += p.vy*dt;
      if(p.y > 285){ pickups.splice(i,1); continue; }
    } else if(p.age < 0.12){
      /* 0.12 秒短距离散开 */
      p.x += p.vx*dt; p.y += p.vy*dt;
      p.vx *= 0.90; p.vy *= 0.90;
    } else {
      const k = clamp(5*dt, 0, 1);
      p.x += (player.x - p.x) * k;
      p.y += (player.y - p.y) * k;
    }

    /* 有效战斗中不因飞出边界消失，最长 1.8 秒后直接回收 */
    if(p.age >= p.fallback){ collect(p); pickups.splice(i,1); continue; }
    if(player.dead) continue;
    const dx = p.x - player.x, dy = p.y - player.y;
    const RAD = (p.type === 'cup') ? 20 : 18;
    if(dx*dx + dy*dy < RAD*RAD){ collect(p); pickups.splice(i,1); }
  }
}

function collect(p){
  /* 拾取同样走权威门禁：失败那一帧之后飘到身上的东西不再入账 */
  if(!gameLive()) return;
  if(p.type === 'mote'){
    /* IT03 微光：成长 +1、绽放能量 +5、+20 分；绽放中不再涨能量（4.8） */
    game.collect++; game.motes++;
    game.score += 20;
    player.grow = Math.min(GROW_MAX, player.grow + 1);
    if(!bloomActive() && !game.bloomChargeOff)
      player.bloom = Math.min(100, player.bloom + BLOOM_MOTE);
    popup(p.x, p.y, '+20', '#F6E6C8');
    updateShotLv();
    if(game.motes === 1) flashMsg('微光让射击变强');
    SFX.star();
  } else if(p.type === 'heart'){
    /* v1.11.0（C19）：回血 1 点、封顶 5；掉落后才满血的按 +100 分结算。
       不补炉火、不补绽放能量、不补成长。 */
    if(player.hp < player.maxHp){
      player.hp = Math.min(player.maxHp, player.hp + 1);
      popup(p.x, p.y - 6, '+1', '#FF9BC0');
      spark(p.x, p.y, 8, ['#FF9BC0','#FFD9E6'], 70, 0.35);
      SFX.hit && SFX.hit();
    } else {
      game.score += 100;
      popup(p.x, p.y - 6, '+100', '#FFD08A');
    }
  } else if(p.type === 'wick'){
    /* CH01：灯芯只加分，不再补炉火 */
    game.collect++; game.wicks++;
    game.score += 100; popup(p.x, p.y, '+100', '#9BD0EE');
    SFX.crystal();
  } else if(p.type === 'shine'){
    /* v1.11.0（C14）：星辉只保留基础拾取分，轮次等级与 STARS_LV 升阶
       整条退出有效结算 —— 绽放击破不再掉星辉，捡到也不再涨等级。 */
    game.collect++; game.starsGot++;
    game.score += 100;
    popup(p.x, p.y, '+100', '#E8D8FF');
    SFX.star();
  } else if(p.type === 'fly'){
    /* IT05 萤火：+200 分、萤火数 +1，无资源恢复 */
    game.collect++; game.fireflies++;
    game.score += 200;
    popup(p.x, p.y, '+200', '#F6DFA6');
    SFX.star();
  } else if(p.type === 'cup'){
    game.collect++; game.cups++;
    game.score += 200;
    popup(p.x, p.y, 'CUP +200', '#F6E6C8');
    SFX.cup();
  }
}

/* ---- 受伤 ---- */
/* ---- v1.10.1：绽放状态的唯一判定 ----
   bloomActive() 就是「共享剩余时间还没走完」。
   攻击强化、无敌、持续护膜/星光、按钮倒计时全部读它，没有第二套计时。 */
function bloomActive(){ return player.bloomT > 0; }
/* 能不能受伤：普通受伤无敌（独立计时）与绽放状态是 OR 关系。
   注意——受伤无敌只挡伤害，不驱动技能时长。 */
function canBeHurt(){
  /* v1.12.0（D05）：Boss 击破的 0.80 秒过渡里不吃任何伤害 */
  if(game.transT > 0) return false;
  return !player.dead && player.invuln <= 0 && !bloomActive();
}

function hitPlayer(){
  /* 绽放期间：不扣血、不震屏、不播受伤音、不触发受伤闪烁；
     也不写 player.invuln —— 受伤无敌必须保持独立，不能变成第二个技能计时器。 */
  if(!canBeHurt()) return;
  player.hp--;
  player.invuln = INVULN_T;
  game.shake = 6;
  game.flash = 0.28;
  SFX.hurt();
  spark(player.x, player.y, 12, ['#FF9BC0','#E8788F','#FFE0EA'], 120, 0.45);
  if(player.hp <= 0){
    player.hp = 0;
    player.dead = true;
    endGame(false, '生命耗尽');
  }
}

/* ---- Tea Time（PH06，策划案 8.9 / 10.3）----
   进入条件只有「终 Boss 击破表现完成」，不存在 55 秒超时失败。 */
/* PH06 萤火归途（5.3 / 9）：停止战斗、清理旧战斗奖励，移动仍保留，接 FLY_N 只萤火 */
function enterTeaTime(){
  game.teaTime = true;
  game.bossActive = false;
  boss = null;
  enemies.length = 0;
  ebullets.length = 0;
  pbullets.length = 0;
  orbs.length = 0;
  BURSTS.length = 0;
  pickups.length = 0;
  player.bloomT = 0;          // v1.10.1：强化、无敌与护膜同一步结束
  player.bloom = 0;
  StarLoop.stop();            // v1.12：循环乐同时收
  player.flameT = 0;
  game.flyT = 0; game.flyIdx = 0; game.fireflies = 0;
  game.teaBannerT = 1.8;
  game.lampFlash = LAMP_FLASH_T;   // SC06 传 allLit，灯本来就全亮，这里补一次点亮光爆
  flashMsg('夜怪散了，回家吧', 1);
}

function updateFireflies(dt){ updateTeaCups(dt); }

/* 成功过场（EVT07 之后）：萤火收完，小魔女从当前位置向右飞出屏幕。
   这里只负责起手，运动在 updatePlayer 的 flyOut 分支里推进，
   飞出画面后由那边收尾调用 endGame(true) 弹结算。 */
function startFlyOut(){
  game.flyOut   = 0.0001;
  game.flyOutX0 = player.x;
  game.flyBackY0 = player.y;
  /* 后撤落点：左移 105、上移 24，并夹在活动区附近，别退到画面外 */
  game.flyBackX = clamp(player.x - 105, 58, 250);
  game.flyBackY = clamp(player.y - 24, 46, 200);
  player.boostT = 0;
  player.boostOn = true;
  player.vy = 0;
  game.teaBannerT = 0;
}

/* 萤火归途生成（5.3）：局部 τ 每 0.30 秒 1 只，共 FLY_N 只 */
/* EVT08 / SUP08：24 只，间隔 0.30 秒，生成窗 0–6.90 秒。
   原来写成"攒够 0.23 秒发一只、再清零"，首只被推迟一个间隔且总数是 18；
   改成按下标排期，第 i 只正好落在 i*0.30，最后一只 23*0.30=6.90。 */
const FLY_N = 24, FLY_IV = 0.25;
/* CH07：出生点从屏外 y=-8 改成可见天空 y=80，下落 48；间距 0.25 秒 */
const FLY_SPAWN_Y = 80, FLY_FALL = 48, FLY_HV = -8;
const FLY_GRAB = 36, FLY_MAGNET = 96, FLY_MAG_SPD = 220;
function updateTeaCups(dt){
  if(!game.teaTime) return;
  game.flyT += dt;
  while(game.flyIdx < FLY_N && game.flyT >= game.flyIdx * FLY_IV){
    const i = game.flyIdx;
    dropFirefly(80 + ((53 * i) % 320), FLY_SPAWN_Y);
    game.flyIdx++;
  }
}

function updatePopups(dt){
  for(let i=popups.length-1;i>=0;i--){
    popups[i].t += dt;
    if(popups[i].t >= popups[i].life) popups.splice(i,1);
  }
}

/* ======================= 9.5 特效层（FX） =======================
   一次性的短表现统一走这里：Boss 击破碎块、焰流、电弧。
   只做视觉，不参与任何碰撞；实例自带 t / life / layer。
   layer='back' 画在 Boss 之前（碎块留在原来的位置），
   layer='front' 画在玩家之后（火舌、电弧盖在角色上面）。 */
const FXS = [];
function pushFx(o){ o.t = 0; FXS.push(o); return o; }
function updateFx(dt){
  for(let i=FXS.length-1;i>=0;i--){
    const f = FXS[i];
    f.t += dt;
    if(f.t >= f.life){ FXS.splice(i,1); continue; }
    if(f.upd) f.upd(f, dt);
  }
}
function drawFx(layer){
  for(let i=0;i<FXS.length;i++){
    const f = FXS[i];
    if(f.layer === layer) f.draw(f);
  }
}
/* 与 drawFit 完全相同的换算，供特效精确对齐立绘框 */
function fitRect(key, cx, cy, maxH, scale){
  const im = ART[key];
  if(!im || !im.complete || !im.naturalWidth) return null;
  const s = (maxH * (scale || 1)) / im.naturalHeight;
  const w = Math.round(im.naturalWidth * s), h = Math.round(im.naturalHeight * s);
  return { x: Math.round(cx - w*0.5), y: Math.round(cy - h*0.5), w: w, h: h };
}
function strokePts(pts){
  if(!pts.length) return;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
}

/* ---------- Boss 击破 0.8 秒（策划案 7.1 / 7.2）----------
   立绘按网格切成石片，各自向外飞散 + 旋转 + 下坠 + 淡出，
   开头 0.25 秒有一次放射裂光，中 Boss 的 5 枚环石单独飞散。 */
function fxBossBreak(b){
  const key = (b.id === 'b1') ? 'boss1' : 'boss2';
  const cxb = b.x + b.w*0.5, cyb = b.y + b.h*0.5;
  const r = fitRect(key, cxb, cyb, b.h, 1.15);
  if(!r) return;

  const cols = 3;
  const rows = 2;
  const pieces = [];
  for(let ry=0; ry<rows; ry++){
    for(let rx=0; rx<cols; rx++){
      const pw = r.w / cols, ph = r.h / rows;
      const px0 = r.x + pw*rx, py0 = r.y + ph*ry;
      const mx = px0 + pw*0.5, my = py0 + ph*0.5;
      const dx = mx - cxb, dy = my - cyb;
      const L = Math.max(1, Math.sqrt(dx*dx + dy*dy));
      pieces.push({
        sx: px0, sy: py0, sw: pw, sh: ph,
        cx: mx, cy: my,
        vx: (dx/L) * rand(30, 54),
        vy: (dy/L) * rand(30, 54) - 20,        // 先微微上抛再落
        rot: rand(-0.55, -0.15) * (dx >= 0 ? 1 : -1),
        delay: rand(0, 0.09)
      });
    }
  }

  // 放射裂光：折线点在这里一次算好，避免每帧乱跳
  const cracks = [];
  for(let i=0;i<7;i++){
    const a = -Math.PI/2 + rand(-1.55, 1.55);
    const seg = 4, pts = [];
    const rad = Math.max(r.w, r.h) * 0.62 * rand(0.5, 1.0);
    for(let k=0;k<=seg;k++){
      const q = k/seg;
      const wob = (k === 0 || k === seg) ? 0 : rand(-6, 6);
      pts.push([cxb + Math.cos(a)*rad*q + wob, cyb + Math.sin(a)*rad*q + wob]);
    }
    cracks.push(pts);
  }

  // 中 Boss 环石：记下击破瞬间的角度，之后各自散开
  const age0 = b.age;

  /* v1.4.0：击破瞬间补两记生图特效 —— 一团雾爆 + 一圈冲击环。
     原来只有碎块和几道折线，读起来像「图裂了」而不是「雾散了」。 */
  pushFx({
    layer:'front', life: 0.92,
    draw: function(f){
      const q = f.t / 0.92;
      const e = 1 - Math.pow(1 - q, 2.2);          // 先快后慢地铺开
      const fade = 1 - q;
      glowAt('mist', cxb, cyb, 50 + 165 * e, 50 + 165 * e, 0, 0.52 * fade);
      glowAt('ring', cxb, cyb, 34 + 250 * e, 34 + 250 * e, 0, 0.48 * fade);
      /* 第二圈晚半拍，扩散的层次更厚 */
      if(q > 0.22){
        const q2 = (q - 0.22) / 0.78, e2 = 1 - Math.pow(1 - q2, 2.0);
        glowAt('ring', cxb, cyb, 24 + 210 * e2, 24 + 210 * e2, 0, 0.30 * (1 - q2));
      }
    }
  });

  pushFx({
    layer:'back', life: BOSS_EXIT_T,
    draw: function(f){
      const im = ART[key];
      if(!im || !im.complete || !im.naturalWidth) return;

      // 1) 首帧整块亮起（0–0.09s），像石头被击裂时的一瞬反光
      if(f.t < 0.09){
        const wl = ART[key + 'W'];
        if(wl && wl.complete && wl.naturalWidth){
          ctx.globalAlpha = (1 - f.t/0.09) * 0.75;
          ctx.drawImage(wl, r.x, r.y, r.w, r.h);
          ctx.globalAlpha = 1;
        }
      }

      // 2) 放射裂光（0–0.25s）
      if(f.t < 0.25){
        const la = 1 - f.t/0.25;
        ctx.strokeStyle = '#FFF2CF';
        ctx.lineWidth = 1;
        for(let i=0;i<cracks.length;i++){
          const pts = cracks[i];
          const grow = clamp(f.t/0.12, 0, 1);
          ctx.globalAlpha = la * 0.9;
          ctx.beginPath();
          ctx.moveTo(pts[0][0], pts[0][1]);
          for(let k=1;k<pts.length;k++){
            const q = k/(pts.length-1);
            if(q > grow) break;
            ctx.lineTo(pts[k][0], pts[k][1]);
          }
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      // 3) 石片：各自旋转飞散，0.30s 后淡出
      for(let i=0;i<pieces.length;i++){
        const pc = pieces[i];
        if(f.t < pc.delay) continue;
        const k = f.t - pc.delay;
        const ox = pc.vx * k;
        const oy = pc.vy * k + 54 * k * k;
        const a = clamp(1 - (f.t - 0.30) / 0.50, 0, 1);
        if(a <= 0.01) continue;
        const bx2 = pc.cx + ox, by2 = pc.cy + oy;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.translate(bx2, by2);
        ctx.rotate(pc.rot * k * 3.0);
        ctx.translate(-bx2, -by2);
        ctx.beginPath();
        ctx.rect(pc.sx + ox, pc.sy + oy, pc.sw, pc.sh);
        ctx.clip();
        ctx.drawImage(im, r.x + ox, r.y + oy, r.w, r.h);
        ctx.restore();
      }

      // 4) 中 Boss 环石散开（终 Boss 没有环石）
      if(b.id === 'b1'){
        const a2 = clamp(1 - (f.t - 0.20) / 0.55, 0, 1);
        if(a2 > 0.01){
          for(let i=0;i<5;i++){
            const ang = age0*1.6 + i*Math.PI*2/5;
            const spread = 1 + f.t * 2.6;
            const sx = cxb + Math.cos(ang)*58*spread;
            const sy = cyb + Math.sin(ang)*50*spread + 60*f.t*f.t;
            const rr = 6.2 * clamp(1 - f.t*0.9, 0, 1);
            if(rr < 1) continue;
            ctx.globalAlpha = a2 * 0.9;
            ctx.fillStyle = '#6A4A54';
            hexPath(ctx, sx, sy, rr);
            ctx.fill();
            ctx.fillStyle = '#9E7680';
            hexPath(ctx, sx - 1.0, sy - 1.4, rr*0.62);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
        }
      }
    }
  });
}

/* ---------- SK03 焰流（策划案 4.4）----------
   橙红外缘 / 浅金核心的扁长火舌，从施法手向右拉到视口边缘，
   主体高约 54、最高不超过 55% 不透明度，持续 0.65 秒。
   用 lighter 混合，否则橙色叠在暗紫夜空上会被压成一条棕色缎带。 */
/* ---------- SK03 炉火（v1.12.0 / D02）----------
   伤害每段读当前 player.x / y，所以视觉效果也必须跟着人走：
   这里不再把施放瞬间的坐标焊死，而是每帧读**当前**杖头位置；
   life 与技能时钟一致（FLAME_T = 1.00 秒），八段伤害到 0.84 秒时画面仍在，
   最后一帧才淡出 —— 不再出现「伤害还在、火已经没了」的隐形伤害。 */
function fxFlame(px, py){
  const seed = rand(0, 6.28);
  // 预生成火团的相位，保证整段火焰形状稳定、只是跟着时间脉动
  const blobs = [];
  for(let i=0;i<12;i++){
    blobs.push({ ph: rand(0, 6.28), dy: rand(-0.35, 0.35), rr: rand(0.78, 1.18), ang: rand(-0.16, 0.16) });
  }
  pushFx({
    layer:'front', life: FLAME_T,
    draw: function(f){
      const p = f.t / f.life;
      /* v1.12.0（D02）：每帧读**当前**杖头，整段焰流跟着人走；
         八段伤害到 0.84 秒，所以画面要撑到 1.00 秒，只在最后 0.14 秒淡出。 */
      const px = player.x + HERO_MUZZLE.dx;
      const py = player.y + 1;
      const env   = Math.min(1, 0.42 + p / 0.10);   /* 起手有底：第一段在 t=0 就结算 */
      const fadeA = 1 - Math.max(0, Math.min(1, (p - 0.86) / 0.14));
      const Hc  = 54 * env;
      if(Hc < 3 || fadeA <= 0.01) return;
      const x0 = px - 2, x1 = W + 20;
      const L  = x1 - x0;

      /* 火焰轮廓：上缘跳动大、下缘较平（火往上飘）；杖尖收成一点再展开 */
      function flamePath(){
        ctx.beginPath();
        ctx.moveTo(x0, py);
        const step = 6;
        for(let x=x0; x<=x1; x+=step){
          const q = (x-x0)/L;
          const ramp = Math.min(1, q/0.13);
          const k = Hc * 0.5 * ramp * Math.pow(1-q, 0.45);
          const n1 = Math.sin(x*0.085 + f.t*30 + seed);
          const n2 = Math.sin(x*0.31 - f.t*20 + seed*2.1);
          ctx.lineTo(x, py - k*0.62 + (n1*0.6 + n2*0.4)*k*0.36);
        }
        for(let x=x1; x>=x0; x-=step){
          const q = (x-x0)/L;
          const ramp = Math.min(1, q/0.13);
          const k = Hc * 0.5 * ramp * Math.pow(1-q, 0.45);
          const n1 = Math.sin(x*0.085 - f.t*26 + seed*1.7);
          ctx.lineTo(x, py + k*0.44 - n1*k*0.18);
        }
        ctx.closePath();
      }

      ctx.save();
      ctx.globalAlpha = fadeA;

      /* A0. 水彩晕（v1.8）：最外层一层很宽很淡的暖雾。
            水彩画火不靠饱和靠"晕开"——这层负责把火焰和紫色夜空接起来。
            没有它，火焰边缘就是一道剪纸般的硬轮廓，跟背景两张皮。 */
      const bloomR = Hc * 1.95;
      const bmx = x0 + L * 0.32;
      ctx.globalCompositeOperation = 'lighter';
      const bmg = ctx.createRadialGradient(bmx, py, 0, bmx, py, bloomR);
      bmg.addColorStop(0.00, 'rgba(255,196,140,0.135)');
      bmg.addColorStop(0.34, 'rgba(238,156,116,0.062)');
      bmg.addColorStop(0.70, 'rgba(198,128,148,0.024)');
      bmg.addColorStop(1.00, 'rgba(148,108,172,0.000)');
      ctx.fillStyle = bmg;
      ctx.save();
      ctx.translate(bmx, py); ctx.scale(1.95, 1);
      ctx.beginPath(); ctx.arc(0, 0, bloomR, 0, Math.PI*2); ctx.fill();
      ctx.restore();

      /* A. 暗底（v1.8c 重建）：上一版把这里提到了中等棕，
            结果整条焰流没有暗部、和亮部挤在同一调子上，糊成粉雾。
            火必须有暗的一侧 —— 这里压回深赭褐，只在远端转灰紫消散。 */
      ctx.globalCompositeOperation = 'source-over';
      const gd = ctx.createLinearGradient(x0, 0, x1, 0);
      gd.addColorStop(0.00, 'rgba(84,34,22,0.72)');
      gd.addColorStop(0.30, 'rgba(96,40,26,0.60)');
      gd.addColorStop(0.68, 'rgba(96,46,50,0.38)');
      gd.addColorStop(1.00, 'rgba(74,44,66,0.14)');
      ctx.fillStyle = gd;
      flamePath();
      ctx.fill();

      /* B. 亮部：一律 lighter */
      ctx.globalCompositeOperation = 'lighter';
      const grd = ctx.createLinearGradient(x0, 0, x1, 0);
      grd.addColorStop(0.00, 'rgba(255,238,196,0.60)');
      grd.addColorStop(0.16, 'rgba(255,186,96,0.42)');
      grd.addColorStop(0.50, 'rgba(236,116,54,0.22)');
      grd.addColorStop(0.86, 'rgba(178,84,92,0.07)');
      grd.addColorStop(1.00, 'rgba(138,92,134,0.03)');
      ctx.fillStyle = grd;
      flamePath();
      ctx.fill();

      /* B1. 杖尖白热核心：整个特效最关键的"这是火"的线索。
             没有它，无论怎么调色都像一团暖雾。 */
      const hotR = Hc * 0.62;
      const hot = ctx.createRadialGradient(x0 + 5, py, 0, x0 + 5, py, hotR);
      hot.addColorStop(0.00, 'rgba(255,252,238,' + (0.80*env).toFixed(3) + ')');
      hot.addColorStop(0.24, 'rgba(255,232,168,' + (0.66*env).toFixed(3) + ')');
      hot.addColorStop(0.60, 'rgba(255,170,84,'  + (0.30*env).toFixed(3) + ')');
      hot.addColorStop(1.00, 'rgba(255,150,70,0)');
      ctx.fillStyle = hot;
      ctx.save();
      ctx.translate(x0 + 5, py); ctx.scale(1.65, 0.92);
      ctx.beginPath(); ctx.arc(0, 0, hotR, 0, Math.PI*2); ctx.fill();
      ctx.restore();

      /* B. 火团：整段火焰的主体形态，越靠右越稀越淡 → 读成"喷出去的焰流" */
      for(let i=0;i<blobs.length;i++){
        const q  = i/(blobs.length-1);
        const bx = x0 + L * Math.pow(q, 0.82) * 0.93;
        const bl = blobs[i];
        const pulse = 0.86 + 0.14*Math.sin(f.t*9 + bl.ph);
        const rr  = Hc * (0.60 - 0.24*q) * bl.rr * pulse * Math.min(1, q/0.10 || 1);
        if(rr < 2.5) continue;
        const by  = py + bl.dy * Hc * (0.30 + 0.30*q) + Math.sin(f.t*11 + bl.ph)*Hc*0.09;
        const rrx = rr * 1.55, rry = rr * 0.80;
        const a0 = (0.27 - 0.09*q) * (1 - q*0.12);
        const g2 = ctx.createRadialGradient(bx, by, 0, bx, by, rrx);
        const aq = a0 * (1.34 - 0.55*q);      // 近端更实，远端更快稀薄
        g2.addColorStop(0.00, 'rgba(255,246,214,' + (aq*0.98).toFixed(3) + ')');
        g2.addColorStop(0.30, 'rgba(255,186,88,'  + (aq*0.92).toFixed(3) + ')');
        g2.addColorStop(0.62, 'rgba(240,124,52,'  + (aq*0.58).toFixed(3) + ')');
        g2.addColorStop(0.86, 'rgba(168,68,54,'   + (aq*0.24).toFixed(3) + ')');
        g2.addColorStop(1.00, 'rgba(120,74,112,0)');
        ctx.fillStyle = g2;
        ctx.beginPath();
        ctx.ellipse(bx, by, rrx, rry, bl.ang, 0, Math.PI*2);
        ctx.fill();
      }

      /* C. 近端几段短高光（只在前半段，断开分布，不做成一根发光管） */
      for(let i=0;i<4;i++){
        const q0 = 0.06 + i*0.11;
        const q1 = q0 + 0.055;
        const ax = x0 + L*q0, bx2 = x0 + L*q1;
        const yy = py + Math.sin(i*1.9 + f.t*20)*Hc*0.10;
        ctx.strokeStyle = 'rgba(255,250,232,' + (0.46*env*(1-i*0.18)).toFixed(3) + ')';
        ctx.lineWidth = 1.3 + 1.1*env;
        ctx.beginPath();
        ctx.moveTo(ax, yy);
        ctx.lineTo(bx2, yy + Math.sin(i*2.7)*2);
        ctx.stroke();
      }

      /* D. 火尾飘出的火星 */
      for(let i=0;i<10;i++){
        const q = ((i*0.115 + f.t*1.3 + seed*0.11) % 1);
        const hx = x0 + L*q;
        const hy = py + Math.sin(i*2.3 + f.t*11 + seed)*Hc*0.50;
        /* 火星也去掉硬像素方块：小圆点才像水彩里甩出来的飞白 */
        ctx.fillStyle = 'rgba(255,228,180,' + ((1-q)*0.60*env).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(hx, hy, 0.9 + 0.5*(1-q), 0, Math.PI*2); ctx.fill();
      }

      ctx.restore();
    }
  });
}

/* ---------- SK04 电弧（策划案 4.5）----------
   每帧重算抖动 → 天然的闪烁感；主干之外抽 3 条短分叉。 */
function fxBolt(x0, y0, x1, y1, delay){
  const dly = delay || 0;
  pushFx({
    layer:'front', life: dly + 0.42,
    draw: function(f){
      const tt = f.t - dly;
      if(tt < 0) return;
      const a = clamp(1 - tt/0.42, 0, 1);
      const dx = x1-x0, dy = y1-y0;
      const L  = Math.max(1, Math.sqrt(dx*dx + dy*dy));
      const nx = -dy/L, ny = dx/L;

      // 主干：12 段
      const segs = 12, pts = [];
      for(let i=0;i<=segs;i++){
        const q = i/segs;
        const amp = (i===0 || i===segs) ? 0 : Math.sin(Math.PI*q) * 15;
        const j = rand(-1, 1) * amp;
        pts.push([x0 + dx*q + nx*j, y0 + dy*q + ny*j]);
      }

      // 分叉：从主干中段抽出 3 条短枝
      const forks = [];
      for(let k=0;k<3;k++){
        const i0 = 3 + Math.floor(rand(0, segs-6));
        const ang = rand(0.55, 0.95) * (rand(0,1) < 0.5 ? 1 : -1);
        const len = rand(11, 24) * (0.6 + 0.4*a);
        const bx0 = pts[i0][0], by0 = pts[i0][1];
        const c = Math.cos(ang), sn = Math.sin(ang);
        const ex = bx0 + (dx/L*c - dy/L*sn) * len;
        const ey = by0 + (dx/L*sn + dy/L*c) * len;
        const fp = [[bx0, by0]];
        for(let k2=1;k2<=3;k2++){
          const q = k2/3;
          fp.push([bx0 + (ex-bx0)*q + rand(-4,4), by0 + (ey-by0)*q + rand(-4,4)]);
        }
        forks.push(fp);
      }

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      /* 折角收圆：默认的 miter 会在大角度拐点戳出一根尖刺，跟水彩笔触不搭 */
      ctx.lineJoin = 'round';
      ctx.lineCap  = 'round';

      // 外发光
      ctx.globalAlpha = a * 0.22;
      ctx.strokeStyle = '#5C8FD0'; ctx.lineWidth = 7;
      strokePts(pts);
      for(let k=0;k<forks.length;k++) strokePts(forks[k]);

      // 中层
      ctx.globalAlpha = a * 0.55;
      ctx.strokeStyle = '#9BD0EE'; ctx.lineWidth = 3;
      strokePts(pts);
      for(let k=0;k<forks.length;k++) strokePts(forks[k]);

      // 白热芯
      ctx.globalAlpha = a * 0.95;
      ctx.strokeStyle = '#F4FCFF'; ctx.lineWidth = 1.4;
      strokePts(pts);

      // 起点光斑
      ctx.globalAlpha = a * 0.55;
      pxCircle(ctx, x0, y0, 4.5, '#CFE9FF');

      // 落点冲击：目标常被一击必杀，弧末端不能悬空
      const ip = clamp(tt/0.22, 0, 1);
      if(ip < 1){
        const rr = 3 + ip*15;
        ctx.globalAlpha = (1-ip) * 0.55;
        ctx.strokeStyle = '#CFE9FF';
        ctx.lineWidth = 2 - ip*1.2;
        ctx.beginPath(); ctx.arc(x1, y1, rr, 0, Math.PI*2); ctx.stroke();
        ctx.globalAlpha = (1-ip) * 0.85;
        pxCircle(ctx, x1, y1, 3.2*(1-ip*0.5), '#FFFFFF');
      }

      ctx.restore();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1;
    }
  });
}

/* ============================ 10. 绘制 ============================ */

/* ---------- 主角（视频提取序列帧，见下方 HERO_ANIM）---------- */

/* ---------- 主角序列帧播放 ----------
   flight / move 素材本身是往返循环，只存唯一帧，这里来回播放；
   shoot 先用 0–8 起手再循环 9–26 的星形释放段；cast 用完整 36 帧一次性播完；
   long 是 Fever 的持续施法，抽帧后慢速往返。 */
const HERO_CLIPS = {
  flight: { kind:'flight', fps:8,  from:0,  to:-1, loop:'pingpong' },
  move:   { kind:'move',   fps:12, from:0,  to:-1, loop:'pingpong' },
  shoot:  { kind:'attack', fps:12, from:9,  to:26, loop:'loop', intro:[0,8] },
  cast:   { kind:'long',   fps:20, from:16, to:44, loop:'once' },
  fever:  { kind:'long',   fps:6,  from:0,  to:-1, loop:'pingpong' }
};
// 朝向：素材本身就是朝右飞的——长杆伸向身前、扫帚头拖在身后、帽尖被气流吹向左侧。
// 不要再镜像，镜像会让她背对飞行方向（脸朝左、扫帚头朝前）。
const HERO_FLIP = false;
// 出弹口，和 fireShot() 里的 (player.x + 20, player.y + 2) 保持一致
const HERO_MUZZLE = { dx: 20, dy: 2 };
const heroAnim = { name:'flight', t:0 };

/* @@BOOST_LOGIC_BEGIN@@ */
/* ---------- 加速飞行（向前推进）----------
   按住向右超过 0.16s 起飞：起手播一次 → 高速循环；松开回落到 flight/move。
   2.0s 内反复起停不再重播起手，直接进循环，避免抖来抖去时一顿一顿的。 */
Object.assign(HERO_CLIPS, {
  boostStart: { kind:'boostStart', fps:15, from:0, to:-1, loop:'once' },
  boostLoop:  { kind:'boostLoop',  fps:12, from:0, to:-1, loop:'loop' }
});
const BOOST_TRIGGER = 0.16, BOOST_RETRIGGER = 2.00;

function pickHeroClip(dt){
  // player 是字面量对象，这里兜底，避免首次调用时 boost 字段为 undefined
  player.boostT = player.boostT || 0; player.boostHold = player.boostHold || 0; player.boostCd = player.boostCd || 0;
  /* 成功过场：直接借加速飞行那套（先起手再循环），优先级高于一切，
     否则下面的 teaTime 分支会把 boostT 清零 */
  if(game.flyOut > 0){
    const d0 = HERO_ANIM.boostStart.n / 15;
    return (player.boostT >= d0) ? 'boostLoop' : 'boostStart';
  }
  if(player.dead || game.teaTime){ player.boostOn = false; player.boostHold = 0; player.boostT = 0; }
  const fwd = !game.teaTime && player.vx > SPD_X * 0.55;
  player.boostHold = fwd ? (player.boostHold || 0) + dt : 0;
  if(player.boostCd > 0) player.boostCd -= dt;

  if(!player.boostOn && player.boostHold >= BOOST_TRIGGER){
    player.boostOn = true;
    player.boostT = 0;
    player.boostSkip = player.boostCd > 0;      // 刚松手又马上加速 → 跳过起手
  }
  if(player.boostOn){
    player.boostT += dt;
    if(!fwd && player.vx < SPD_X * 0.35){
      player.boostOn = false;
      player.boostCd = BOOST_RETRIGGER;         // 冷却从这里开始计，不是从起飞算
    }
  }

  if(player.bloomT > 0)                  return 'fever';   // v1.5 起 Fever 改名星光绽放
  if(player.castT > 0)                   return 'cast';
  /* v1.12.0（D09）：键盘和触控自动连射走同一个「刚开过火」标记 */
  if(!game.teaTime && (keyShoot() || player.shootAnim > 0)) return 'shoot';
  if(player.boostOn){
    const dur = HERO_ANIM.boostStart.n / 15;
    return (player.boostSkip || player.boostT >= dur) ? 'boostLoop' : 'boostStart';
  }
  if(Math.abs(player.vx) > 45)           return 'move';
  return 'flight';
}

/* 加速速度线：源素材的速度线在抠像时被剔掉，这里按同一节奏补回来 */
function drawBoostStreaks(){
  const k = clamp((player.boostT - 0.04) / 0.30, 0, 1);
  if(k <= 0) return;
  const seed = Math.floor(player.boostT * 18);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for(let i=0;i<5;i++){
    const s = Math.sin(seed * 7.13 + i * 2.71);
    const c = Math.cos(seed * 3.07 + i * 1.93);
    const y = player.y + (i - 2) * 9 + s * 3;
    const len = 15 + Math.abs(s) * 24;
    const x = player.x - 32 - Math.abs(c) * 16;
    ctx.globalAlpha = 0.20 * k;
    ctx.fillStyle = i % 2 ? '#CFE6FF' : '#E8D8FF';
    ctx.fillRect(Math.round(x - len), Math.round(y), Math.round(len), 1);
  }
  ctx.restore();
}
/* @@BOOST_LOGIC_END@@ */

function heroFrameIndex(clip, t){
  const A = HERO_ANIM[clip.kind];
  if(!A || !A.n) return 0;
  const n = A.n, from = clip.from || 0;
  const to = (clip.to == null || clip.to < 0) ? n - 1 : Math.min(clip.to, n - 1);
  const k = Math.floor(t * clip.fps);

  if(clip.loop === 'once')  return Math.min(to, from + k);

  if(clip.intro){
    const introN = clip.intro[1] - clip.intro[0] + 1;      // 起手段帧数
    if(k < introN) return clip.intro[0] + k;
    const span = to - from + 1;
    return from + ((k - introN) % span);
  }
  if(clip.loop === 'loop'){
    return from + (k % (to - from + 1));
  }
  // pingpong：0..n-1 再 n-2..1
  const span = to - from + 1;
  const m = span * 2 - 2;
  const kk = k % m;
  return from + (kk < span ? kk : m - kk);
}

function drawPlayer(dt){
  /* V08：失败页仍要看见同一个角色 —— 只是低头、收杖、往下沉，
     而不是换成另一张比例更修长的插画。 */
  if(player.dead && game.state !== 'lose') return;
  if(!player.dead && player.invuln > 0 && Math.floor(player.invuln*12) % 2 === 0) return;

  /* dt 为 0 表示「本帧不推进动画」（暂停 / 结算）：
     不能用 `dt || 0.0167` 兜底，否则暂停时角色仍在播片。 */
  const adt = (dt == null) ? 0.0167 : dt;
  const t = player.animT;

  // 动作选择：星光绽放 > 施法 > 射击 > 加速 > 横移 > 悬停（加速状态机见 pickHeroClip）
  let name = pickHeroClip(adt);
  if(heroAnim.name !== name){ heroAnim.name = name; heroAnim.t = 0; }
  heroAnim.t += adt;

  const clip = HERO_CLIPS[name];
  const A = HERO_ANIM[clip.kind];

  // 立绘尺寸：图集按 2x 设备像素准备，逻辑坐标里画一半
  const dw = A ? A.w * 0.5 : 76, dh = A ? A.h * 0.5 : 58;

  // 帚尾拖光（越靠后越淡），横冲时更长
  const boost = 1 + clamp(Math.abs(player.vx)/160, 0, 1) * 0.9;
  const trail = Math.round(4 * boost);
  for(let i=0;i<trail;i++){
    ctx.globalAlpha = (0.20 - i*0.04) * 0.9;
    ctx.fillStyle = i%2 ? '#A98FD0' : '#9BD0EE';
    ctx.fillRect(Math.round(player.x - dw*0.42 - i*5), Math.round(player.y + dh*0.18 + (i%2)), 4, 2);
  }
  ctx.globalAlpha = 1;

  /* @@BOOST_FX@@ */
  if(player.boostOn) drawBoostStreaks();
  // 主角背光
  const hg = ctx.createRadialGradient(player.x, player.y, 6, player.x, player.y, 54);
  hg.addColorStop(0,   'rgba(255,247,225,0.13)');
  hg.addColorStop(0.55,'rgba(200,180,240,0.05)');
  hg.addColorStop(1,   'rgba(190,160,240,0)');
  ctx.fillStyle = hg; ctx.fillRect(player.x-56, player.y-56, 112, 112);

  if(!A || !A.img.complete || !A.img.naturalWidth){
    ctx.fillStyle = '#F1EAD6';
    ctx.fillRect(player.x-13, player.y-13, 26, 26);
    return;
  }

  const idx = heroFrameIndex(clip, heroAnim.t);
  const r = A.rects[idx] || A.rects[0];
  // 后坐：素材里攻击帧的身体姿势其实没变，靠这一点位移把"开火"读出来
  const recoil = clamp(player.recoil, 0, 1);
  const rx = -recoil * 2.4;
  const cx = player.x + rx;                 // 镜像轴心：后坐也一起带过去
  ctx.imageSmoothingEnabled = true;
  /* 失败姿态：绕自身旋转一点并轻微下沉，素材、比例、帽子蓝结全都不变 */
  const down = player.dead;
  if(down){
    ctx.save();
    ctx.translate(cx, player.y + 3);
    ctx.rotate(-0.30);
    ctx.translate(-cx, -(player.y + 3));
    ctx.globalAlpha = 0.88;
  }
  if(HERO_FLIP){
    ctx.save();
    ctx.translate(cx, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(A.img, r[0], r[1], A.w, A.h,
                  -dw*0.5, player.y - dh*0.5, dw, dh);
    ctx.restore();
  } else {
    ctx.drawImage(A.img, r[0], r[1], A.w, A.h,
                  cx - dw*0.5, player.y - dh*0.5, dw, dh);
  }
  ctx.imageSmoothingEnabled = false;
  if(down) ctx.restore();

  // 法杖尖星光：每次开火闪一下，和 6.67 发/秒的节奏同步
  if(recoil > 0.02 && (name === 'shoot' || name === 'cast')){
    const fx2 = cx + HERO_MUZZLE.dx;
    const fy2 = player.y + HERO_MUZZLE.dy;
    const rad = 3 + recoil * 6;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = recoil * 0.85;
    ctx.fillStyle = name === 'cast' ? '#FFF0B8' : '#FFF8DE';
    ctx.beginPath();
    ctx.moveTo(fx2, fy2 - rad);
    ctx.lineTo(fx2 + rad*0.30, fy2 - rad*0.30);
    ctx.lineTo(fx2 + rad, fy2);
    ctx.lineTo(fx2 + rad*0.30, fy2 + rad*0.30);
    ctx.lineTo(fx2, fy2 + rad);
    ctx.lineTo(fx2 - rad*0.30, fy2 + rad*0.30);
    ctx.lineTo(fx2 - rad, fy2);
    ctx.lineTo(fx2 - rad*0.30, fy2 - rad*0.30);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // 随行小幽灵已经烘焙在立绘里（脸侧那只），这里不再另画光团，避免出现两个同伴

  // 星光绽放：角色本体只留一层极淡边光，主体配色不变（BF02「边光稳定」）
  if(player.bloomT > 0){
    const a2 = 0.16 + 0.06*Math.sin(t*9);
    ctx.globalAlpha = Math.min(0.26, a2);
    ctx.strokeStyle = '#FFF4CC'; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.arc(player.x, player.y, 20, 0, Math.PI*2); ctx.stroke();
    ctx.globalAlpha = 1; ctx.lineWidth = 1;
  }
}

/* ---------- 星光绽放的表现（WB05 / BF01–BF07）----------
   全部画在角色后层，且在敌方预兆、敌弹、重球之下 ——
   装饰永远不许盖住「这里要打你」的提示。 */
function blEase(u){ return u*u*(3-2*u); }

function drawBloomDecor(){
  /* v1.10.1：只看唯一剩余时间。归零当帧整块不再画 —— 没有收尾尾巴。 */
  const remain = player.bloomT;
  if(remain <= 0) return;
  const px = player.x, py = player.y;
  const tau = (remain > 0) ? (BLOOM_T - remain) : BLOOM_T;
  /* 杖头挂点：立绘里魔杖在右手，约在角色中心右侧偏上一点 */
  const tipX = px + 17, tipY = py - 5;
  /* 与危险区重叠时，装饰面压到 0.05：不许靠装饰提高危险区的亮度对比 */
  const faceMul = bloomHazardAt(px, py, BL_SAFE_PAD) ? 0.05 : 1;
  const tt = game.t;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  /* ---- v1.12 生图星光光环 ----
     中心镂空的手绘光环，绕角色慢转；开启 0.18 秒展开、最后 0.5 秒收紧。
     它和倒计时读的是同一个 remain，归零当帧整块不画。 */
  if(fxOK('bloom')){
    const close2 = clamp((tau - BL_HOLD) / (BL_OUT - BL_HOLD), 0, 1);
    const open   = clamp(tau / 0.18, 0, 1);
    const eo     = blEase(open);
    const sc2    = (0.58 + 0.42 * eo) * (1 - 0.16 * close2);
    const a2     = (0.60 * Math.max(faceMul, 0.06)) * (1 - 0.55 * close2) * (0.30 + 0.70 * eo);
    glowAt('bloom', px, py, 104 * sc2, 104 * sc2, tt * 0.34, a2);
    glowAt('bloom', px, py, 74 * sc2, 74 * sc2, -tt * 0.60, a2 * 0.55);
  }

  /* ---- BF01 开启 0.00–0.32：薄断环 12→56 + 杖头星芒 6→12 ---- */
  if(remain > 0 && tau < BL_IN){
    const u = clamp(tau / BL_IN, 0, 1);
    const e = blEase(u);
    const R = 12 + 44 * e;
    const a = (0.65 * (1 - 0.45*u)) * Math.max(faceMul, 0.05);
    ctx.globalAlpha = a;
    ctx.strokeStyle = '#FFF4CC';
    ctx.lineWidth = 1.5 - 0.7*u;
    for(let k=0;k<4;k++){
      const a0 = k * Math.PI * 0.5 + 0.42;
      ctx.beginPath(); ctx.arc(px, py, R, a0, a0 + Math.PI*0.5 - 0.62); ctx.stroke();
    }
    /* 内侧一圈浅青，让断环有层次 */
    ctx.globalAlpha = a * 0.55;
    ctx.strokeStyle = '#99DDEB'; ctx.lineWidth = 0.9;
    for(let k=0;k<4;k++){
      const a0 = -k * Math.PI * 0.5 - 0.30;
      ctx.beginPath(); ctx.arc(px, py, R - 4.5, a0, a0 + Math.PI*0.5 - 0.72); ctx.stroke();
    }
    /* 杖头星芒：0.10 起亮到 0.18，之后保持到 0.32 */
    if(tau >= 0.10){
      const s2 = clamp((tau - 0.10) / 0.08, 0, 1);
      const R2 = 6 + 6 * s2;
      ctx.globalAlpha = (0.55 + 0.35*s2) * Math.max(faceMul, 0.05);
      blStar(tipX, tipY, R2, 6, '#FFF4CC');
      ctx.globalAlpha = (0.35 * s2) * Math.max(faceMul, 0.05);
      blStar(tipX, tipY, R2 * 1.9, 4, '#99DDEB');
    }
  }

  /* ---- BF02 持续 0.32–4.00 / BF06 结束预告 4.00–5.00 ---- */
  if(remain > 0 && tau >= BL_IN){
    /* 最后 0.5 秒收紧：短弧变细变淡、彗尾从 48 收到 24（v1.10.1） */
    const closing = clamp((tau - BL_HOLD) / (BL_OUT - BL_HOLD), 0, 1);   // 0..1
    /* 局部光晕面：半径 32，alpha ≤0.10 */
    const hr = 32;
    const hg2 = ctx.createRadialGradient(px, py, 2, px, py, hr);
    hg2.addColorStop(0.00, 'rgba(255,244,204,' + (0.10 * faceMul).toFixed(3) + ')');
    hg2.addColorStop(0.55, 'rgba(153,221,235,' + (0.045 * faceMul).toFixed(3) + ')');
    hg2.addColorStop(1.00, 'rgba(153,221,235,0)');
    ctx.fillStyle = hg2;
    ctx.fillRect(px - hr, py - hr, hr*2, hr*2);

    /* 四段短弧缓转：亮度随 BF06 缓降，不扩大光圈 */
    /* 有生图光环时程序化短弧只保留 45% —— 两层都满亮会糊成一片 */
    const arcA = (0.50 - 0.32 * closing) * Math.max(faceMul, 0.05) * (fxOK('bloom') ? 0.45 : 1);
    ctx.globalAlpha = arcA;
    ctx.strokeStyle = '#FFF4CC';
    ctx.lineWidth = 1.4 - 0.8 * closing;
    const ar = 30 + 1.5*Math.sin(tt*1.6);
    for(let k=0;k<4;k++){
      const a0 = k * Math.PI*0.5 + tt * 0.55;
      ctx.beginPath(); ctx.arc(px, py, ar, a0, a0 + Math.PI*0.5 - 0.55); ctx.stroke();
    }
    ctx.globalAlpha = arcA * 0.6;
    ctx.strokeStyle = '#99DDEB';
    for(let k=0;k<4;k++){
      const a0 = -k * Math.PI*0.5 - tt * 0.42 + 0.7;
      ctx.beginPath(); ctx.arc(px, py, ar - 5, a0, a0 + Math.PI*0.5 - 0.75); ctx.stroke();
    }

    /* 扫帚彗尾：长 48 → 24（BF06 收），宽 12，alpha ≤0.35，向后弯 */
    const tl = 48 - 24 * closing;
    const hw = 6 - 1.5 * closing;
    const tailA = 0.35 * Math.max(faceMul, 0.05) * (1 - 0.35*closing);
    ctx.globalAlpha = tailA;
    const bx0 = px - 12, by0 = py + 10;
    const tg2 = ctx.createLinearGradient(bx0, by0, bx0 - tl, by0 + 12);
    tg2.addColorStop(0.00, 'rgba(255,244,204,0.95)');
    tg2.addColorStop(0.45, 'rgba(153,221,235,0.55)');
    tg2.addColorStop(1.00, 'rgba(153,221,235,0)');
    ctx.fillStyle = tg2;
    ctx.beginPath();
    ctx.moveTo(bx0, by0 - hw);
    ctx.quadraticCurveTo(bx0 - tl*0.55, by0 - hw*0.2 + 4, bx0 - tl, by0 + 12);
    ctx.quadraticCurveTo(bx0 - tl*0.55, by0 + hw*0.9 + 4, bx0, by0 + hw);
    ctx.closePath(); ctx.fill();

    /* 杖头常亮一点，让人看得出强化来自「这根杖」 */
    ctx.globalAlpha = 0.30 * Math.max(faceMul, 0.05);
    blStar(tipX, tipY, 4.2 + 0.8*Math.sin(tt*7), 4, '#FFF4CC');

    /* ---- v1.12 手绘兜底（生图光环就位后自动让位）----
       1) 一层极淡的穹顶：只在半径外缘亮，中心完全透，角色不被糊住；
       2) 六枚环绕星屑，各自带一点拖尾，速度与相位错开，读起来像「在转」；
       3) 全部跟着同一个 closing 收，归零当帧一起消失。 */
    if(!fxOK('bloom')){
      const a3 = (1 - 0.55 * closing) * Math.max(faceMul, 0.05);
      const R3 = (48 + 3.6*Math.sin(tt*2.2)) * (1 - 0.10 * closing);
      /* 穹顶：中间留空，只在 0.72~1.0 之间有一圈淡光 */
      const dome = ctx.createRadialGradient(px, py, R3*0.62, px, py, R3*1.10);
      dome.addColorStop(0.00, 'rgba(255,244,204,0)');
      dome.addColorStop(0.66, 'rgba(255,244,204,0)');
      dome.addColorStop(0.82, 'rgba(255,246,214,' + (0.14 * a3).toFixed(3) + ')');
      dome.addColorStop(1.00, 'rgba(153,221,235,0)');
      ctx.fillStyle = dome;
      ctx.fillRect(px - R3*1.1, py - R3*1.1, R3*2.2, R3*2.2);

      /* 六枚环绕星屑：2.6 秒一圈，半径与高度错开成椭圆 */
      ctx.globalAlpha = 0.75 * a3;
      for(let k = 0; k < 6; k++){
        const a0 = tt * 2.4 + k * Math.PI / 3;
        const rr = R3 * (0.86 + 0.10 * Math.sin(tt*1.7 + k));
        const sx2 = px + Math.cos(a0) * rr;
        const sy2 = py + Math.sin(a0) * rr * 0.72;
        const tw = 0.55 + 0.45 * Math.sin(tt * 5.2 + k * 1.9);
        blStar(sx2, sy2, (2.4 + 2.2 * tw) * (1 - 0.3*closing), 4,
               k % 2 ? '#99DDEB' : '#FFF4CC');
        /* 朝切向拖一小段，读成「绕着走」而不是「浮着」 */
        ctx.globalAlpha = 0.20 * tw * a3;
        ctx.strokeStyle = k % 2 ? '#99DDEB' : '#FFF4CC';
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.moveTo(sx2, sy2);
        ctx.lineTo(sx2 - Math.cos(a0) * 5.5, sy2 - Math.sin(a0) * 4.0);
        ctx.stroke();
        ctx.globalAlpha = 0.75 * a3;
      }
      ctx.globalAlpha = 1;
    }
  }

  /* ---- 装饰粒子（预算内，且都不在危险外扩里）---- */
  for(let i=0;i<BL_P.length;i++){
    const p = BL_P[i];
    const k = 1 - p.t / p.life;
    ctx.globalAlpha = 0.55 * k;
    ctx.fillStyle = p.c;
    ctx.fillRect(p.x, p.y, 1.4, 1.4);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

/* 四芒 / 六芒星：星头用，纯程序绘制（绽放资源 BFA03 允许程序绘制） */
function blStar(x, y, r, n, col){
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  const rin = r * 0.34;
  for(let k=0;k<n*2;k++){
    const rr = (k % 2) ? rin : r;
    const a = k * Math.PI / n - Math.PI*0.5;
    const sx = Math.cos(a) * rr, sy = Math.sin(a) * rr;
    if(k === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
  }
  ctx.closePath();
  ctx.fillStyle = col;
  ctx.fill();
  ctx.restore();
}

/* BF04 / BF05：真实交点上的短促反馈，0.16 秒 */
function drawBloomHitFx(){
  if(!BL_HIT.length) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for(let i=0;i<BL_HIT.length;i++){
    const h = BL_HIT[i];
    const u = clamp(h.t / h.life, 0, 1);
    const fade = 1 - u;
    if(h.kind === 'pierce'){
      /* 首次穿透：沿弹速方向拉长的星梭 + 出口短断环 */
      ctx.globalAlpha = 0.85 * fade;
      ctx.strokeStyle = '#FFF4CC';
      ctx.lineWidth = 2.6 * fade + 0.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(h.x - 12, h.y);
      ctx.lineTo(h.x + 12, h.y);
      ctx.stroke();
      ctx.globalAlpha = 0.55 * fade;
      ctx.strokeStyle = '#99DDEB';
      ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.arc(h.x + 6, h.y, 8 + 4*u, -0.9, 0.9); ctx.stroke();
    } else {
      /* 终止命中：交点小星芒 + 至多 4 碎光 */
      ctx.globalAlpha = 0.9 * fade;
      blStar(h.x, h.y, 6 * (1 - u*0.5), 4, '#FFF4CC');
      ctx.globalAlpha = 0.6 * fade;
      for(let k=0;k<4;k++){
        const a = h.rot + k * Math.PI * 0.5;
        const d = 6 + 12 * u;
        ctx.fillStyle = k % 2 ? '#FFF4CC' : '#99DDEB';
        ctx.fillRect(h.x + Math.cos(a)*d, h.y + Math.sin(a)*d, 1.6, 1.6);
      }
    }
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

/* ---------- 敌人（策划案 6 章；美术暂用现有立绘 + 色相区分）---------- */
/* 按原图比例缩放并居中绘制（策划案 6.1：以自身位置而非贴图边界判定命中）
   受击不是整帧替换成白剪影——持续射击时闪白帧会占掉近一半时间，
   改为在原画上叠一层半透明白，保留轮廓与配色 */
/* 六棱石块路径（中 Boss 环石用） */
function hexPath(g, x, y, r){
  g.beginPath();
  for(let k=0;k<6;k++){
    const a = -Math.PI/2 + k*Math.PI/3;
    const px2 = x + Math.cos(a)*r;
    const py2 = y + Math.sin(a)*r*0.92;
    if(k === 0) g.moveTo(px2, py2); else g.lineTo(px2, py2);
  }
  g.closePath();
}

/* 立绘按高度 h 绘制时的宽度（用于把血条、预兆线挂在画面上而不是判定盒上） */
function artW(key, h){
  const im = ART[key];
  if(!im || !im.naturalHeight) return h * 0.8;
  return h * im.naturalWidth / im.naturalHeight;
}

/* 每种怪的描边强度：越暗的立绘越需要亮晕，否则在夜空里糊成一团 */
/* V06：灯怪去掉外发光边，避免整团泛白糊掉提把与灯芯 */
const ENEMY_RIM = { imp:1, fish:1, carrier:0, head:1, bat:2.6 };

function drawFit(key, cx, cy, maxH, flash, scale, rim){
  const im = ART[key];
  if(!im || !im.complete || !im.naturalWidth) return;
  const s = (maxH * (scale || 1)) / im.naturalHeight;
  const w = Math.round(im.naturalWidth * s), h = Math.round(im.naturalHeight * s);
  const x = Math.round(cx - w*0.5), y = Math.round(cy - h*0.5);
  ctx.imageSmoothingEnabled = true;

  // 双层轮廓：外层极淡亮晕（防深底吞掉暮紫蝙蝠）+ 内层深描边（防浅云糊掉蓝翼小妖）
  const rk = (rim === true) ? 1 : (rim || 0);
  if(rk > 0){
    const wl = ART[key + 'W'];
    if(wl){
      const g = 1.17 + 0.03*(rk - 1);
      const lw = w * g, lh = h * g;
      ctx.globalAlpha = Math.min(0.46, 0.15 * rk);
      ctx.drawImage(wl, cx - lw*0.5, cy - lh*0.5, lw, lh);
      ctx.globalAlpha = 1;
    }
    const dk = ART[key + 'D'];
    if(dk){
      const rw = w * 1.09, rh = h * 1.09;
      ctx.globalAlpha = 0.40;
      ctx.drawImage(dk, cx - rw*0.5, cy - rh*0.5, rw, rh);
      ctx.globalAlpha = 1;
    }
  }

  ctx.drawImage(im, x, y, w, h);
  const sil = ART[key + 'W'];
  if(flash && sil && sil.complete && sil.naturalWidth){
    ctx.globalAlpha = 0.35;
    ctx.drawImage(sil, x, y, w, h);
    ctx.globalAlpha = 1;
  }
  ctx.imageSmoothingEnabled = false;
}
/* @@MON_ANIM_LOGIC_BEGIN@@ 怪物序列帧渲染（inject_monsters.py） */
const MON_ANIM = {};
(function(){
  for(const k in MON_SPEC){
    const A = Object.assign({}, MON_SPEC[k]);
    A.img = new Image();
    A.img.src = MON_B64[k];
    MON_ANIM[k] = A;
  }
})();

function monReady(A){ return !!(A && A.img && A.img.complete && A.img.naturalWidth); }

/* 受击闪白：把当前帧临时染成纯色再叠上去。
   旧立绘那套 ART[key+'W'] 剪影是单帧的，动画摆到展翅帧时形状对不上，会露出多余的翅膀轮廓，
   所以这里按当前帧现烘一张，只在受击的几帧里跑，开销可以忽略。 */
const _monWhite = {};
function monWhite(key, fr){
  const A = MON_ANIM[key];
  if(!monReady(A)) return null;
  let c = _monWhite[key];
  if(!c || c.cv.width !== A.fw || c.cv.height !== A.fh){
    const cv = document.createElement('canvas');
    cv.width = A.fw; cv.height = A.fh;
    c = _monWhite[key] = { cv: cv, g: cv.getContext('2d') };
  }
  const g = c.g, r = A.rects[fr];
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, A.fw, A.fh);
  g.drawImage(A.img, r[0], r[1], A.fw, A.fh, 0, 0, A.fw, A.fh);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = '#FFF6E8';
  g.fillRect(0, 0, A.fw, A.fh);
  g.globalCompositeOperation = 'source-over';
  return c.cv;
}

/* tt：动画时刻（秒），传 e.age / b.age
   frLock：定格帧号，>=0 时不走循环（折翼停留用）
   rim：外层淡亮晕强度，图集自带水彩描边，一般给弱值 */
function drawMonFit(key, cx, cy, maxH, flash, scale, rim, tt, frLock){
  const A = MON_ANIM[key];
  if(!monReady(A)) return drawFit(key, cx, cy, maxH, flash, scale, rim);

  const s = (maxH * (scale || 1) * A.eq) / A.fh;
  const w = Math.max(1, Math.round(A.fw * s));
  const h = Math.max(1, Math.round(A.fh * s));
  const x = Math.round(cx - w*0.5), y = Math.round(cy - h*0.5);
  const fr = (frLock >= 0) ? (frLock % A.n)
                           : ((((tt || 0) * A.fps) | 0) % A.n);
  const r = A.rects[fr];
  if(!r) return;

  const rk = (rim === true) ? 1 : (rim || 0);
  if(rk > 0){
    const cv = monWhite(key, fr);
    if(cv){
      ctx.globalAlpha = Math.min(0.30, 0.12 * rk);
      const lw = w * 1.14, lh = h * 1.14;
      ctx.drawImage(cv, Math.round(cx - lw*0.5), Math.round(cy - lh*0.5), Math.round(lw), Math.round(lh));
      ctx.globalAlpha = 1;
    }
  }

  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(A.img, r[0], r[1], A.fw, A.fh, x, y, w, h);
  if(flash){
    const cv = monWhite(key, fr);
    if(cv){
      ctx.globalAlpha = 0.40;
      ctx.drawImage(cv, x, y, w, h);
      ctx.globalAlpha = 1;
    }
  }
  ctx.imageSmoothingEnabled = false;
}

/* 进度驱动：prog 0→1 对应整段攻击动作，与游戏里的状态时长解耦 */
function drawMonProg(key, cx, cy, maxH, flash, scale, rim, prog){
  const A = MON_ANIM[key];
  if(!monReady(A)) return drawFit(key, cx, cy, maxH, flash, scale, rim);
  const fr = Math.max(0, Math.min(A.n - 1, Math.floor(clamp(prog, 0, 1) * A.n)));
  return drawMonFit(key, cx, cy, maxH, flash, scale, rim, 0, fr);
}
/* @@MON_ANIM_LOGIC_END@@ */





const ENEMY_ART = { imp:'imp', fish:'fish', carrier:'carrier', head:'head', bat:'bat' };

function drawEnemy(e){
  const key = ENEMY_ART[e.kind] || 'bat';
  const t = e.age;
  const flash = e.flash > 0;
  const cx = e.x + e.w*0.5, cy = e.y + e.h*0.5;
  /* V06：灯怪按 50×56 的可见轮廓校准（不再 1.42 倍膨胀成中型 Boss），
     其它怪仍保留「立绘比判定盒大一圈」的手感 */
  const HH = e.h * (e.kind === 'carrier' ? 1.00 : 1.42);
  const RK = ENEMY_RIM[key] || 1;

  /* 攻击动作优先：状态机走到攻击段就盖掉常驻循环，让玩家看得出它在蓄力 */
  let atk = null, atkProg = 0, atkDy = 0, atkSc = 1;
  if(e.kind === 'head' && e.chargeT > 0){
    /* 桥洞雾怪鼓腮双雾：chargeT 从 0.60 掉到 0，正好把鼓腮 → 吐雾演完 */
    atk = 'headAtk';  atkProg = 1 - clamp(e.chargeT / 0.60, 0, 1);
  } else if(e.kind === 'carrier' && e.fearArmed && !e.fearDone && e.fearT > 0){
    /* 吞光灯怪受惊吐雾：提灯先爆亮再回暗 */
    atk = 'carrierAtk'; atkProg = 1 - clamp(e.fearT / 0.55, 0, 1);
  } else if(e.kind === 'bat' && e.mode === 'aim'){
    /* 暮影蝠折翼蓄力：只演动作的前 35%，停在收翅姿态等俯冲 */
    atk = 'batAtk'; atkProg = 0.35 * (1 - clamp(e.mt / 0.45, 0, 1)); atkDy = 1.2;
  } else if(e.kind === 'bat' && e.mode === 'dash'){
    /* 俯冲：接在蓄力之后演完剩下 65%，展翅张开 */
    atk = 'batAtk'; atkProg = 0.35 + 0.65 * (1 - clamp(e.mt / 1.40, 0, 1)); atkSc = 1.08;
  }

  if(atk){
    drawMonProg(atk, cx, cy + atkDy, HH, flash, atkSc, RK, atkProg);
  } else if(e.kind === 'fish'){
    /* 序列帧自带摆尾起伏，不再叠一层 sin 浮动，否则两套节奏互相打架 */
    drawMonFit(key, cx, cy, HH, flash, 1, RK, t);
  } else if(e.kind === 'carrier' || e.kind === 'head'){
    drawMonFit(key, cx, cy, HH, flash, 1, RK, t);
  } else {
    const f = Math.sin(t*11);
    drawMonFit(key, cx, cy + f*0.7, HH, flash, 1 + f*0.03, RK, t);
  }

  /* 血条（多血量怪）：挂在立绘上沿外侧，别压到画上。
     原来用 e.w 宽度 + 2px 实心红条，小鱼那种 20 宽的怪在 3 倍屏上
     就是一块 60px 的粉色板子浮在天上。收窄、压薄、加圆角与暗底，
     让它退成一条「刻度」，只在受过伤时才出现。 */
  if(e.maxhp > 1 && e.hp < e.maxhp){
    const bw2 = Math.min(e.w * 0.62, 22);
    const top = Math.round(cy - HH*0.5) - 3.4;
    const bx = Math.round(cx - bw2 * 0.5);
    ctx.fillStyle = 'rgba(26,12,34,0.62)';
    ctx.beginPath(); ctx.roundRect(bx - 0.6, top - 0.6, bw2 + 1.2, 2.4, 1.2); ctx.fill();
    ctx.fillStyle = '#E8788F';
    ctx.beginPath();
    ctx.roundRect(bx, top, Math.max(1.2, bw2 * e.hp / e.maxhp), 1.2, 0.6);
    ctx.fill();
  }
}

/* ---------- Boss ---------- */
function drawBoss(){
  if(!boss) return;
  const b = boss;
  const t = b.age;
  const flash = b.flash > 0;

  // 蓄力 / 膨起亮起（由 updateBoss1 / updateBoss2 的 glow 驱动）
  const glow = b.glow || 0;
  if(glow > 0){
    /* v1.8：原来是一枚实心暖圆，会把本体盖住一层黄。
       改成径向晕：中心淡、外缘完全透明，只在轮廓外发一点热。 */
    const gcx = b.x + b.w*0.5, gcy = b.y + b.h*0.42;
    const ga  = (0.13 + 0.15*Math.abs(Math.sin(t*26))) * glow;
    const gg  = ctx.createRadialGradient(gcx, gcy, b.w*0.12, gcx, gcy, b.w*0.70);
    gg.addColorStop(0.00, 'rgba(240,214,158,' + ga.toFixed(3) + ')');
    gg.addColorStop(0.55, 'rgba(226,190,150,' + (ga*0.42).toFixed(3) + ')');
    gg.addColorStop(1.00, 'rgba(210,176,160,0.000)');
    ctx.fillStyle = gg;
    ctx.fillRect(gcx - b.w*0.70, gcy - b.w*0.70, b.w*1.40, b.w*1.40);
  }

  // 呼吸缩放
  const br = 1 + Math.sin(t*2.2)*0.02;
  // 中 Boss「打盹的夜团」与终 Boss「湖边大夜怪」各用一张独立立绘
  const key = (b.id === 'b1') ? 'boss1' : 'boss2';
  const cxb = b.x + b.w*0.5, cyb = b.y + b.h*0.5;

  /* v1.4.0：夜雾漩涡常驻光环 —— 大夜团的核心气质是「一整团会转的雾」。
     两片反向旋转的雾旋叠在本体后面：外层慢、内层快；
     本体鼓起（glow 高）时一起变亮，平时也一直在缓缓流动，
     所以它站在那儿不动也不像一张贴图。 */
  if(fxOK('swirl')){
    const gsw = 0.20 + 0.26 * glow;
    glowAt('swirl', cxb, cyb, b.w * 1.70, b.w * 1.70,  t * 0.17, gsw);
    glowAt('swirl', cxb, cyb, b.w * 1.10, b.w * 1.10, -t * 0.29, gsw * 0.80);
  }

  // 常驻淡雾光晕：Boss 站在画面右缘、被暗角压掉近一半亮度，
  // 用一圈柔和冷光把它从夜空和月盘里托出来（夜雾聚成的身体本就该发虚光）
  const haloR = b.w * 0.78;
  const hg = ctx.createRadialGradient(cxb, cyb, haloR*0.30, cxb, cyb, haloR);
  hg.addColorStop(0, 'rgba(202,190,232,' + (0.20 + 0.10*glow).toFixed(3) + ')');
  hg.addColorStop(1, 'rgba(202,190,232,0)');
  ctx.fillStyle = hg;
  ctx.fillRect(cxb - haloR, cyb - haloR, haloR*2, haloR*2);

  // 中 Boss 的 5 枚软雾团：先画，压在绒团之后，形成环绕感
  // （纯装饰不挡弹；策划案 7.1 角速度 1.6 弧度/秒，松团散雾前一起膨起）
  if(b.id === 'b1'){
    const pk = b.puff || 0;
    for(let i=0;i<5;i++){
      const a = t*1.6 + i*Math.PI*2/5;
      const sx = cxb + Math.cos(a)*58, sy = cyb + Math.sin(a)*50;
      const r = (5.4 + 0.9*Math.sin(t*3.1 + i)) * (1 + pk*0.55);
      // 用径向渐变而不是实心圆，雾团才有虚边，不会像一枚硬币
      const pg = ctx.createRadialGradient(sx, sy, 0, sx, sy, r*2.1);
      pg.addColorStop(0.00, 'rgba(196,186,220,' + (0.52 + 0.24*pk).toFixed(3) + ')');
      pg.addColorStop(0.48, 'rgba(150,142,178,' + (0.34 + 0.22*pk).toFixed(3) + ')');
      pg.addColorStop(1.00, 'rgba(140,132,168,0)');
      ctx.fillStyle = pg;
      ctx.beginPath(); ctx.arc(sx, sy, r*2.1, 0, Math.PI*2); ctx.fill();
      // 左上一点受光，跟绒团的打光方向一致
      ctx.globalAlpha = 0.42 + 0.20*pk;
      pxCircle(ctx, sx - r*0.34, sy - r*0.38, r*0.42, '#CFC6E4');
      ctx.globalAlpha = 1;
    }
  }

  /* Boss 立绘边缘是绒毛，不吃缩放描边（会把毛边放大成一圈亮点），
     改用整体提亮与内部明暗对比来跟夜空拉开 */
  /* @@BOSS_ATK_BEGIN@@
     中 Boss 的两招各有专属动作（v1.6.0 的 5.8 秒循环）：
       q 0.80–2.05  鼓腮锁定 → 三连吐（1.45 / 1.70 / 1.95），嘴越张越大
       q 3.20–3.96  松团散雾，本体鼓胀再回缩
     终 Boss 的追光雾球：orb 模式 0–0.90 秒演出（0.75 蓄力 + 出球），
       之后回常驻循环；夜雾横推（wall 模式）没有可用素材，
       本体本来就不动，靠雾墙表现。
     其余时间仍是常驻循环。 */
  /* FX-B06（v1.11.0）：冲出段身后最多 2 道残影，只是形体，不带任何判定；
     本体轮廓始终清楚，读者不会把残影当成第二个危险源。 */
  if(b.id === 'b2' && b.mode === 'charge' && (b.mt || 0) > CH_WARN){
    const travel = (CH_CX0 - CH_CX1) / CH_SPD;
    const u = clamp(((b.mt || 0) - CH_WARN) / travel, 0, 1);
    /* FX-B06：生图速度尾迹。冲撞是从右往左，所以尾迹必须在**身后（右侧）**：
       素材的密集端在右、丝缕朝左，直接画就成了「迎面喷气」，看着像吐息放反了。
       这里横向镜像，并把密集端贴在本体右缘，丝缕才朝右散开。抖不参与判定。 */
    if(u > 0 && u < 1 && fxOK('trail')){
      glowAt('trail', cxb + b.w * 0.5 + b.w * 1.8, cyb, b.w * 3.6, b.h * 1.0, 0, 0.62, true);
    }
    if(u > 0 && u < 1){
      for(let k = 1; k <= 2; k++){
        ctx.save();
        ctx.globalAlpha = 0.20 / k;
        drawMonFit(key, cxb + k * 13, cyb, b.h, false, 1.15 * br, 0, t);
        ctx.restore();
      }
    }
  }

  let bossAtk = false;
  if(b.id === 'b1'){
    const q1 = (b.cyc || 0) % 5.8;
    if(q1 >= 0.80 && q1 < 2.05){
      drawMonProg('boss1Tell', cxb, cyb, b.h, flash, 1.15 * br, 0, clamp((q1 - 0.80) / 1.25, 0, 1));
      bossAtk = true;
    } else if(q1 >= 3.20 && q1 < 3.96){
      drawMonProg('boss1Atk', cxb, cyb, b.h, flash, 1.15 * br, 0, clamp((q1 - 3.20) / 0.76, 0, 1));
      bossAtk = true;
    }
  } else if(b.id === 'b2' && b.mode === 'orb' && (b.mt || 0) < 0.95){
    drawMonProg('boss2Atk', cxb, cyb, b.h, flash, 1.15 * br, 0, clamp((b.mt || 0) / 0.90, 0, 1));
    bossAtk = true;
  }
  if(!bossAtk) drawMonFit(key, cxb, cyb, b.h, flash, 1.15 * br, 0, t);
  /* @@BOSS_ATK_END@@ */
}

/* ---------- 子弹 ---------- */
function drawBullets(){
  /* 我方：乳白十字星屑 + 浅蓝短尾；落星为青绿四芒星 */
  for(let i=0;i<pbullets.length;i++){
    const b = pbullets[i];
    const cx = Math.round(b.x), cy = Math.round(b.y);
    if(b.type === 'falling'){
      /* 落星：柔光芯 + 四芒柔光，替掉原来的硬十字 */
      const fg = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, 9);
      fg.addColorStop(0.00, 'rgba(255,255,255,1.00)');
      fg.addColorStop(0.26, '#DAFFEC');
      fg.addColorStop(0.60, hexA('#8FE8C8', 0.36));
      fg.addColorStop(1.00, hexA('#8FE8C8', 0.00));
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.arc(b.x, b.y, 9, 0, Math.PI*2); ctx.fill();
      ctx.save();
      ctx.lineCap = 'round';
      const ag = ctx.createLinearGradient(b.x - 8, b.y, b.x + 8, b.y);
      ag.addColorStop(0.00, hexA('#8FE8C8', 0.00));
      ag.addColorStop(0.50, hexA('#DAFFEC', 0.90));
      ag.addColorStop(1.00, hexA('#8FE8C8', 0.00));
      ctx.strokeStyle = ag; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(b.x - 8, b.y); ctx.lineTo(b.x + 8, b.y); ctx.stroke();
      const bg2 = ctx.createLinearGradient(b.x, b.y - 11, b.x, b.y + 11);
      bg2.addColorStop(0.00, hexA('#8FE8C8', 0.00));
      bg2.addColorStop(0.50, hexA('#DAFFEC', 0.95));
      bg2.addColorStop(1.00, hexA('#8FE8C8', 0.00));
      ctx.strokeStyle = bg2; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(b.x, b.y - 11); ctx.lineTo(b.x, b.y + 11); ctx.stroke();
      ctx.restore();
      continue;
    }
    const bl = (b.r > PB_R);
    const core = bl ? 3.6 : 2.5;
    /* 星屑：柔光底 + 一颗硬边的四芒星。
       之前只有一层径向渐变，三向散射在空中拉开后就是一串白泡泡，
       和敌弹、微光混在一起分不出是什么（参考稿里我方弹是明确的星形）。 */
    const R = bl ? 7.6 : 5.8;              // 星芒外径
    const rin = bl ? 2.1 : 1.6;            // 内凹半径
    const glowR = core * 3.2;
    const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, glowR);
    g.addColorStop(0.00, 'rgba(255,255,255,0.92)');
    g.addColorStop(0.30, hexA(bl ? '#DAFFEC' : '#FFF6DC', 0.55));
    g.addColorStop(0.66, hexA(bl ? '#9BD0EE' : '#C8E6FF', 0.20));
    g.addColorStop(1.00, hexA(bl ? '#9BD0EE' : '#C8E6FF', 0.00));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(b.x, b.y, glowR, 0, Math.PI*2); ctx.fill();
    /* 四芒星本体：四个长尖 + 四个内凹点，尖端带一点拖尾方向 */
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.beginPath();
    for(let k=0;k<8;k++){
      const rr = (k % 2) ? rin : (k === 0 ? R * 1.35 : R);
      const a = k * Math.PI / 4;
      const px2 = Math.cos(a) * rr, py2 = Math.sin(a) * rr;
      if(k === 0) ctx.moveTo(px2, py2); else ctx.lineTo(px2, py2);
    }
    ctx.closePath();
    const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
    sg.addColorStop(0.00, '#FFFFFF');
    sg.addColorStop(0.42, bl ? '#EAFFF4' : '#FFFDF2');
    sg.addColorStop(1.00, hexA(bl ? '#9BD0EE' : '#CFE6FF', 0.86));
    ctx.fillStyle = sg;
    ctx.fill();
    ctx.restore();
    /* 亮核 */
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    ctx.beginPath(); ctx.arc(b.x, b.y, bl ? 1.7 : 1.4, 0, Math.PI*2); ctx.fill();
    /* 拖尾：沿飞行反方向渐隐，给弹丸一点方向感 */
    const sp0 = Math.hypot(b.vx, b.vy) || 1;
    const tl = bl ? 17 : 12;
    const tx = b.x - (b.vx/sp0) * tl, ty = b.y - (b.vy/sp0) * tl;
    const tg = ctx.createLinearGradient(b.x, b.y, tx, ty);
    tg.addColorStop(0.00, hexA(bl ? '#EAFFF4' : '#FFF6DC', 0.68));
    tg.addColorStop(1.00, hexA(bl ? '#9BD0EE' : '#C8E6FF', 0.00));
    ctx.strokeStyle = tg;
    ctx.lineWidth = core * 1.0;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(tx, ty); ctx.stroke();
  }
  /* 敌弹：雾紫柔光球 + 一圈亮边 + 深芯。
     光靠渐变在亮背景（月盘、湖面）上会糊掉，补一圈收边和一点深色核心，
     形状、明度都和星屑分开，玩家一眼能分辨「这个是会撞死我的」。 */
  for(let i=0;i<ebullets.length;i++){
    const b = ebullets[i];
    if(b.fire){
      /* R03 / v1.4.0：灯怪火团换成生图火球。
         素材头在左、尾在右，用「负宽度」把头翻到原点，再按速度方向旋转 ——
         尾焰永远拖在运动反方向，转向也不需要换图。
         判定半径仍是 r3，外观放大不放大碰撞。 */
      if(fxOK('fireball')){
        const ang = Math.atan2(b.vy || 0, b.vx || -1);
        /* 素材已镜像成「头在右」，所以 +x 就是运动方向：
           头钉在原点，尾巴自然铺向 -x（运动反方向）。
           火头占宽度的 27%，矩形右缘放到 +0.27w 才能让头正好落在弹丸位置。 */
        const w = 30, h = 15, HEAD = 0.27;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.translate(b.x, b.y);
        ctx.rotate(ang);
        ctx.globalAlpha = 0.90 + 0.10 * Math.sin(game.t * 26 + (b.seed || 0));
        ctx.drawImage(FX_IMG.fireball, -w * (1 - HEAD), -h * 0.5, w, h);
        ctx.restore();
        ctx.globalAlpha = 1;
        /* 亮核：远处一闪也能读成「一颗火」而不是一条光带 */
        ctx.fillStyle = 'rgba(255,248,220,0.90)';
        ctx.beginPath(); ctx.arc(b.x, b.y, 1.5, 0, Math.PI*2); ctx.fill();
        continue;
      }
      /* 素材没加载时的兜底：原来的程序化火团 */
      const dir = (b.vx || -1) < 0 ? 1 : -1;
      const tg = ctx.createLinearGradient(b.x, b.y, b.x + dir * 11, b.y);
      tg.addColorStop(0.00, 'rgba(255,150,60,.70)');
      tg.addColorStop(1.00, 'rgba(140,36,16,0)');
      ctx.fillStyle = tg;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y - 2.8);
      ctx.lineTo(b.x + dir * 11, b.y);
      ctx.lineTo(b.x, b.y + 2.8);
      ctx.closePath(); ctx.fill();

      const fg = ctx.createRadialGradient(b.x - 0.6, b.y - 0.8, 0, b.x, b.y, 7.4);
      fg.addColorStop(0.00, 'rgba(255,252,236,1.00)');
      fg.addColorStop(0.22, '#FFD27A');
      fg.addColorStop(0.52, '#FF7A2A');
      fg.addColorStop(0.80, 'rgba(188,48,18,.86)');
      fg.addColorStop(1.00, 'rgba(120,26,10,0.00)');
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.arc(b.x, b.y, 7.4, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = 'rgba(150,36,16,.85)';
      ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.arc(b.x, b.y, 3.8, 0, Math.PI*2); ctx.stroke();
      continue;
    }
    if(b.mist){
      /* FX-B03：竖列雾滴。亮核 + 暗边 + 朝运动反方向的短尾（8–12px），
         彼此分离，不连成一条有判定的实体墙。 */
      const dir = (b.vx < 0) ? 1 : -1;
      const tg = ctx.createLinearGradient(b.x, b.y, b.x + dir * 10, b.y);
      tg.addColorStop(0.00, 'rgba(194,106,171,0.55)');
      tg.addColorStop(1.00, 'rgba(73,48,95,0)');
      ctx.fillStyle = tg;
      ctx.fillRect(dir > 0 ? b.x : b.x - 10, b.y - 1.7, 10, 3.4);
      /* 暗边：先一圈深色，月亮前也读得出轮廓；再叠生图雾滴（亮芯 + 暗紫边 + 右向短尾） */
      ctx.fillStyle = 'rgba(34,18,48,0.96)';
      ctx.beginPath(); ctx.arc(b.x, b.y, 6.2, 0, Math.PI*2); ctx.fill();
      if(fxOK('wdrop')){
        glowAt('wdrop', b.x + 0.6, b.y, 16.5, 15, 0, 0.95);
      } else {
        const g2 = ctx.createRadialGradient(b.x - 0.9, b.y - 1.1, 0, b.x, b.y, 5.1);
        g2.addColorStop(0.00, '#FFEAF7');
        g2.addColorStop(0.30, '#E486C0');
        g2.addColorStop(0.72, '#9C4180');
        g2.addColorStop(1.00, 'rgba(70,32,68,0)');
        ctx.fillStyle = g2;
        ctx.beginPath(); ctx.arc(b.x, b.y, 5.1, 0, Math.PI*2); ctx.fill();
      }
      continue;
    }
    const g = ctx.createRadialGradient(b.x - 0.6, b.y - 0.8, 0, b.x, b.y, 7.6);
    g.addColorStop(0.00, 'rgba(255,246,252,1.00)');
    g.addColorStop(0.20, '#FFE0F0');
    g.addColorStop(0.46, hexA('#E88AC8', 0.90));
    g.addColorStop(0.74, hexA('#B45C9C', 0.34));
    g.addColorStop(1.00, hexA('#B45C9C', 0.00));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(b.x, b.y, 7.6, 0, Math.PI*2); ctx.fill();
    /* 亮边：半径 3.6 的一圈，让弹在远处也能读成圆点而不是光斑 */
    ctx.strokeStyle = 'rgba(255,222,244,0.80)';
    ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.arc(b.x, b.y, 3.6, 0, Math.PI*2); ctx.stroke();
    /* 芯：亮白色小点。
       原来这里是一颗深芯，结果整个弹看起来像个粉色甜甜圈；
       改成白芯 + 外面一圈极细的深色收边，亮底上也不会糊掉。 */
    ctx.fillStyle = 'rgba(255,255,255,0.98)';
    ctx.beginPath(); ctx.arc(b.x, b.y, 1.35, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = 'rgba(96,34,78,0.34)';
    ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.arc(b.x, b.y, 4.5, 0, Math.PI*2); ctx.stroke();
  }
}

/* ---------- 水晶 ---------- */
function drawCrystals(){ }

/* ---------- 道具 ---------- */
function drawPickups(){
  const t = game.t;
  for(let i=0;i<pickups.length;i++){
    const p = pickups[i];
    const cx = Math.round(p.x), cy = Math.round(p.y);
    if(p.type === 'mote'){
      /* IT03 微光：暖白光滴（上尖下圆）+ 极淡青尾 + 一圈暖晕。
         原来用两根矩形拼十字，和星屑、星辉区分不开 —— 三样都是白十字。 */
      const pu = 0.72 + 0.28*Math.sin(t*9 + i);
      const tg2 = ctx.createLinearGradient(cx - 9, cy, cx, cy);
      tg2.addColorStop(0, 'rgba(150,210,245,0)');
      tg2.addColorStop(1, 'rgba(150,210,245,0.55)');
      ctx.fillStyle = tg2;
      ctx.fillRect(cx - 9, cy - 0.6, 9, 1.2);
      const hg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 8.4);
      hg.addColorStop(0.00, 'rgba(255,246,214,' + (0.50*pu).toFixed(2) + ')');
      hg.addColorStop(0.45, 'rgba(255,226,160,' + (0.20*pu).toFixed(2) + ')');
      hg.addColorStop(1.00, 'rgba(255,214,140,0)');
      ctx.fillStyle = hg;
      ctx.beginPath(); ctx.arc(cx, cy, 8.4, 0, Math.PI*2); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx, cy - 4.8);
      ctx.bezierCurveTo(cx + 2.7, cy - 1.2, cx + 2.7, cy + 2.9, cx, cy + 3.3);
      ctx.bezierCurveTo(cx - 2.7, cy + 2.9, cx - 2.7, cy - 1.2, cx, cy - 4.8);
      ctx.closePath();
      const bgm = ctx.createLinearGradient(cx, cy - 4.8, cx, cy + 3.3);
      bgm.addColorStop(0.00, '#FFFFFF');
      bgm.addColorStop(0.52, '#FFF6DC');
      bgm.addColorStop(1.00, '#FFDFA2');
      ctx.fillStyle = bgm; ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath(); ctx.arc(cx - 0.9, cy - 0.8, 0.95, 0, Math.PI*2); ctx.fill();
    } else if(p.type === 'shine'){
      /* IT10 星辉：金色四芒星 + 长尾 + 光晕。
         金色是关键 —— 和冷白的星屑、粉紫的敌弹在色相上直接分开，
         一眼就知道「这个要去捡」。 */
      const pu = 0.80 + 0.20*Math.sin(t*11 + i);
      const hgs = ctx.createRadialGradient(cx, cy, 0, cx, cy, 13);
      hgs.addColorStop(0.00, 'rgba(255,238,180,' + (0.40*pu).toFixed(2) + ')');
      hgs.addColorStop(0.48, 'rgba(255,214,120,' + (0.15*pu).toFixed(2) + ')');
      hgs.addColorStop(1.00, 'rgba(255,200,100,0)');
      ctx.fillStyle = hgs;
      ctx.beginPath(); ctx.arc(cx, cy, 13, 0, Math.PI*2); ctx.fill();
      const tgs = ctx.createLinearGradient(cx - 11, cy, cx, cy);
      tgs.addColorStop(0, 'rgba(255,214,140,0)');
      tgs.addColorStop(1, 'rgba(255,232,170,0.62)');
      ctx.fillStyle = tgs;
      ctx.fillRect(cx - 11, cy - 0.7, 11, 1.4);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.sin(t * 1.4 + i) * 0.16);
      ctx.beginPath();
      for(let k=0;k<8;k++){
        const rr = (k % 2) ? 2.0 : (k === 0 ? 8.0 : 6.4);
        const a = k * Math.PI / 4;
        const px3 = Math.cos(a) * rr, py3 = Math.sin(a) * rr;
        if(k === 0) ctx.moveTo(px3, py3); else ctx.lineTo(px3, py3);
      }
      ctx.closePath();
      const sgm = ctx.createRadialGradient(0, 0, 0, 0, 0, 6.6);
      sgm.addColorStop(0.00, '#FFFFFF');
      sgm.addColorStop(0.40, '#FFEDB4');
      sgm.addColorStop(1.00, 'rgba(245,200,106,0.92)');
      ctx.fillStyle = sgm; ctx.fill();
      ctx.restore();
    } else if(p.type === 'heart'){
      /* v1.11.0（C21）：粉红心形 —— 和圆弹靠形状分开，不靠颜色硬碰。
         外圈只给很淡的粉色晕，压不住 Boss 预兆与敌弹轮廓。 */
      const hp2 = 0.86 + 0.14*Math.sin(t*7 + i);
      const hgh = ctx.createRadialGradient(cx, cy, 0, cx, cy, 11);
      hgh.addColorStop(0.00, 'rgba(255,150,190,' + (0.34*hp2).toFixed(3) + ')');
      hgh.addColorStop(0.55, 'rgba(255,110,160,' + (0.13*hp2).toFixed(3) + ')');
      hgh.addColorStop(1.00, 'rgba(255,90,150,0)');
      ctx.fillStyle = hgh;
      ctx.beginPath(); ctx.arc(cx, cy, 11, 0, Math.PI*2); ctx.fill();
      const k = 1 + 0.05*Math.sin(t*6 + i);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(k, k);
      ctx.beginPath();
      ctx.moveTo(0, 4.6);
      ctx.bezierCurveTo(-6.4, 0.4, -5.2, -5.0, -2.0, -5.0);
      ctx.bezierCurveTo(-0.8, -5.0, -0.1, -4.2, 0, -3.4);
      ctx.bezierCurveTo(0.1, -4.2, 0.8, -5.0, 2.0, -5.0);
      ctx.bezierCurveTo(5.2, -5.0, 6.4, 0.4, 0, 4.6);
      ctx.closePath();
      const hg2 = ctx.createLinearGradient(0, -5, 0, 4.6);
      hg2.addColorStop(0.00, '#FFE3EE');
      hg2.addColorStop(0.42, '#FF9BC0');
      hg2.addColorStop(1.00, '#E85C90');
      ctx.fillStyle = hg2; ctx.fill();
      ctx.strokeStyle = 'rgba(255,220,236,0.85)'; ctx.lineWidth = 0.7; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.beginPath(); ctx.ellipse(-2.0, -2.6, 1.25, 0.9, -0.5, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    } else if(p.type === 'wick'){
      /* IT11 灯芯：小灯笼 + 蓝白火苗。
         原来是 pxCircle + 两根矩形拼的像素画法，和旁边三样柔光放在一起
         明显是两个世代的东西。这里换成柔光灯笼：暖晕 → 灯盏 → 火苗。 */
      const fl = 1 + 0.20*Math.sin(t*10 + i);
      const hgw = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 10);
      hgw.addColorStop(0.00, 'rgba(190,230,255,0.34)');
      hgw.addColorStop(0.50, 'rgba(150,200,246,0.14)');
      hgw.addColorStop(1.00, 'rgba(150,200,246,0)');
      ctx.fillStyle = hgw;
      ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, Math.PI*2); ctx.fill();
      /* 灯盏：一个上宽下窄的小碗 */
      ctx.beginPath();
      ctx.moveTo(p.x - 4.2, p.y + 1.4);
      ctx.quadraticCurveTo(p.x, p.y + 5.6, p.x + 4.2, p.y + 1.4);
      ctx.closePath();
      ctx.fillStyle = 'rgba(72,90,132,0.95)'; ctx.fill();
      ctx.strokeStyle = 'rgba(150,186,230,0.72)'; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(p.x - 4.2, p.y + 1.4); ctx.lineTo(p.x + 4.2, p.y + 1.4); ctx.stroke();
      /* 火苗：朝上的水滴，白芯 + 蓝边 */
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 6.2 * fl);
      ctx.bezierCurveTo(p.x + 2.3, p.y - 2.2, p.x + 1.9, p.y + 0.6, p.x, p.y + 1.0);
      ctx.bezierCurveTo(p.x - 1.9, p.y + 0.6, p.x - 2.3, p.y - 2.2, p.x, p.y - 6.2 * fl);
      ctx.closePath();
      const fgm = ctx.createLinearGradient(p.x, p.y - 6.2*fl, p.x, p.y + 1);
      fgm.addColorStop(0.00, '#FFFFFF');
      fgm.addColorStop(0.45, '#DFF3FF');
      fgm.addColorStop(1.00, '#8CC4EE');
      ctx.fillStyle = fgm; ctx.fill();
      /* 火苗两侧两道短弧：灯笼的护条 */
      ctx.globalAlpha = 0.42;
      ctx.strokeStyle = '#9BD0EE'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(p.x, p.y, 6.4, -0.95, 0.30); ctx.stroke();
      ctx.beginPath(); ctx.arc(p.x, p.y, 6.4, 2.10, 3.35); ctx.stroke();
      ctx.globalAlpha = 1;
    } else if(p.type === 'fly'){
      /* IT05 萤火：暖黄光点 + 两片柔翅。原来也是 pxCircle 像素圆，
         现在改成径向光晕 + 椭圆翅，和微光/星辉同一套笔触。 */
      const wg = 0.5 + 0.5*Math.sin(t*13 + i);
      const hgf = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 9.5);
      hgf.addColorStop(0.00, 'rgba(255,236,170,' + (0.50 + 0.26*wg).toFixed(2) + ')');
      hgf.addColorStop(0.45, 'rgba(255,214,120,' + (0.22 + 0.12*wg).toFixed(2) + ')');
      hgf.addColorStop(1.00, 'rgba(255,200,90,0)');
      ctx.fillStyle = hgf;
      ctx.beginPath(); ctx.arc(p.x, p.y, 9.5, 0, Math.PI*2); ctx.fill();
      /* 翅：两枚半透明椭圆，随呼吸开合 */
      const wspan = 3.0 + wg*2.4;
      ctx.globalAlpha = 0.40 + 0.30*wg;
      ctx.fillStyle = '#FFEFC0';
      for(let s2 = -1; s2 <= 1; s2 += 2){
        ctx.beginPath();
        ctx.ellipse(p.x + s2 * wspan * 0.55, p.y - 1.4, wspan * 0.58, 1.9, s2 * 0.42, 0, Math.PI*2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      /* 本体：暖白小圆 + 高光 */
      ctx.fillStyle = '#FFF3CE';
      ctx.beginPath(); ctx.arc(p.x, p.y, 1.9, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.arc(p.x - 0.5, p.y - 0.6, 0.75, 0, Math.PI*2); ctx.fill();
    } else if(p.type === 'cup'){
      drawFit('cup', p.x, p.y, 24);
    }
  }
}

/* 重雾球：暗紫锯齿外圈 + 明显的雾团本体，和圆形灯芯/粉紫敌弹区分 */
function drawOrbs(){
  for(let i=0;i<orbs.length;i++){
    const o = orbs[i];
    /* 外层雾晕：先铺一层很淡的径向渐变，让球体边缘化开而不是切一圈硬边 */
    const halo = ctx.createRadialGradient(o.x, o.y, o.r*0.35, o.x, o.y, o.r + 13);
    halo.addColorStop(0.00, hexA('#9A6FBC', 0.42));
    halo.addColorStop(0.52, hexA('#8A5FA8', 0.20));
    halo.addColorStop(1.00, hexA('#8A5FA8', 0.00));
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(o.x, o.y, o.r + 13, 0, Math.PI*2); ctx.fill();

    /* 不规则雾边：锯齿保留（这是雾团的个性），但描边柔化、拐角收圆 */
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = hexA('#C08AE0', 0.68); ctx.lineWidth = 1.7;
    ctx.beginPath();
    const seg = 12;
    for(let k=0;k<seg;k++){
      const a = k/seg*Math.PI*2 + o.t*0.8;
      const r = o.r + 4.5 + ((k % 2) ? 2.8 : -1.2) + Math.sin(o.t*7 + k)*0.7;
      const qx = o.x + Math.cos(a)*r, qy = o.y + Math.sin(a)*r;
      if(k === 0) ctx.moveTo(qx, qy); else ctx.lineTo(qx, qy);
    }
    ctx.closePath(); ctx.stroke();
    ctx.restore();

    /* v1.11.0（FX-B04）：生图重雾球 —— 暗紫密核 + 淡洋红发光边 + 三五片卷雾。
       素材的暗核本身是「加 0」，所以叠在上面只出亮边与外圈卷雾，
       底下的程序化暗核仍然是实心的，权重/轮廓都对。 */
    if(fxOK('orb')){
      glowAt('orb', o.x, o.y, o.r * 4.6, o.r * 4.6, o.t * 0.55, 0.62);
      glowAt('orb', o.x, o.y, o.r * 3.2, o.r * 3.2, -o.t * 0.85, 0.34);
    } else if(fxOK('misttex')){
      glowAt('misttex', o.x, o.y, o.r * 4.2, o.r * 2.6, o.t * 0.9, 0.26);
    }
    /* 本体：径向渐变，左上浓、右下透，像一颗被雾包住的墨点 */
    const body = ctx.createRadialGradient(o.x - o.r*0.34, o.y - o.r*0.40, o.r*0.08,
                                          o.x, o.y, o.r*1.06);
    if(o.flash > 0){
      body.addColorStop(0.00, '#FFFFFF');
      body.addColorStop(0.62, '#F2E4FF');
      body.addColorStop(1.00, '#D8C2F0');
    } else {
      body.addColorStop(0.00, '#7A5A9E');
      body.addColorStop(0.52, '#4A3266');
      body.addColorStop(1.00, '#332046');
    }
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, Math.PI*2); ctx.fill();

    /* 左上一点高光，方向跟月亮一致 */
    ctx.globalAlpha = 0.55;
    const hi = ctx.createRadialGradient(o.x - o.r*0.38, o.y - o.r*0.44, 0,
                                        o.x - o.r*0.38, o.y - o.r*0.44, o.r*0.62);
    hi.addColorStop(0, 'rgba(255,255,255,0.85)');
    hi.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hi;
    ctx.beginPath(); ctx.arc(o.x - o.r*0.38, o.y - o.r*0.44, o.r*0.62, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;
  }
}

/* 怪物预兆：必须先于危险判定出现，且不在玩家附近随机起手 */
function drawEnemyTell(){
  for(let i=0;i<enemies.length;i++){
    const e = enemies[i];
    const cx = e.x + e.w*0.5, cy = e.y + e.h*0.5;
    if(e.kind === 'carrier' && e.fearArmed && !e.fearDone && e.fearT > 0){
      const g = 1 - clamp(e.fearT/0.55, 0, 1);
      /* v1.8：原来是实心橙圆，饱和又硬，跟立绘两张皮。
         改成水彩晕 —— 宽淡暖雾底 + 一粗一细两圈很轻的环，颜色压到赭黄偏灰。 */
      const crr = 15 + 9*g;
      const cg  = ctx.createRadialGradient(cx, cy, 0, cx, cy, crr);
      cg.addColorStop(0.00, 'rgba(255,224,186,' + (0.11 + 0.15*g).toFixed(3) + ')');
      cg.addColorStop(0.46, 'rgba(238,196,150,' + (0.09 + 0.13*g).toFixed(3) + ')');
      cg.addColorStop(1.00, 'rgba(206,158,142,0.000)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = cg;
      ctx.beginPath(); ctx.arc(cx, cy, crr, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 0.20 + 0.26*g;
      ctx.strokeStyle = '#E8C29A'; ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.arc(cx, cy, 17 - 4*g, 0, Math.PI*2); ctx.stroke();
      ctx.globalAlpha = 0.30 + 0.38*g;
      ctx.strokeStyle = '#F0D2AE'; ctx.lineWidth = 1.0;
      ctx.beginPath(); ctx.arc(cx, cy, 17 - 4*g, 0, Math.PI*2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if(e.kind === 'head' && e.chargeT > 0){
      const g = 1 - clamp(e.chargeT/0.60, 0, 1);
      const aw = artW('head', e.h * 1.42);
      /* 原来是一整个实心绿球，会把鼓腮动作整个糊住；改成外环 + 极淡填充，
         提示还在，本体能透出来看清它在鼓腮 */
      /* v1.8b：黄绿 #C8E88A 在紫夜空里太跳，压成灰调鼠尾草绿 */
      ctx.globalAlpha = 0.06 + 0.11*g;
      pxCircle(ctx, cx, cy, 11 + 6*g, '#B9CC96');
      ctx.globalAlpha = 0.30 + 0.38*g;
      ctx.strokeStyle = '#B9CC96'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(cx, cy, 13 + 7*g, 0, Math.PI*2); ctx.stroke();
      ctx.globalAlpha = 0.30 + 0.32*g;
      ctx.strokeStyle = '#B9CC96'; ctx.lineWidth = 1;
      for(let k=-1;k<=1;k+=2){
        ctx.beginPath();
        ctx.moveTo(cx - aw*0.5 - 3, cy + k*10);
        ctx.lineTo(cx - aw*0.5 - 15 - 10*g, cy + k*10);
        ctx.stroke();
      }
      /* 嘴前凝出的粉紫小球：0 → 5px，鼓到最大就是发弹瞬间 */
      const br = 5 * g;
      if(br > 0.6){
        /* v1.8：实心像素圆 → 淡淡的径向渐变球，边缘化开 */
        const mx = cx - aw*0.06, my = cy - e.h*0.12;
        const mg = ctx.createRadialGradient(mx - br*0.30, my - br*0.30, 0, mx, my, br*1.55);
        mg.addColorStop(0.00, 'rgba(248,240,255,' + (0.60 + 0.38*g).toFixed(3) + ')');
        mg.addColorStop(0.38, 'rgba(206,172,234,' + (0.48 + 0.34*g).toFixed(3) + ')');
        mg.addColorStop(1.00, 'rgba(168,132,206,0.000)');
        ctx.fillStyle = mg;
        ctx.beginPath(); ctx.arc(mx, my, br*1.55, 0, Math.PI*2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    if(e.kind === 'bat'){
      if(e.mode === 'aim'){
        const a = Math.atan2(e.dashVy, e.dashVx);
        const pulse = 0.45 + 0.45*Math.abs(Math.sin(game.t*16));
        const x1 = cx + Math.cos(a)*14, y1 = cy + Math.sin(a)*14;
        const x2 = cx + Math.cos(a)*150, y2 = cy + Math.sin(a)*150;
        /* v1.8：锁定线读成一道"光痕"而不是激光瞄准器。
           沿线做 alpha 渐变（近端实、远端化开），两端圆头，
           暗底那层也降下来 —— 原来的 3px 近黑线在夜空上太抢。 */
        const lg = ctx.createLinearGradient(x1, y1, x2, y2);
        lg.addColorStop(0.00, 'rgba(226,200,255,' + (pulse*0.78).toFixed(3) + ')');
        lg.addColorStop(0.42, 'rgba(200,168,240,' + (pulse*0.30).toFixed(3) + ')');
        lg.addColorStop(1.00, 'rgba(180,150,230,0.000)');
        ctx.save();
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.globalAlpha = pulse * 0.34;
        ctx.strokeStyle = '#2A1638'; ctx.lineWidth = 3.0;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = lg; ctx.lineWidth = 1.55;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.restore();
      } else if(e.mode === 'dash'){
        ctx.globalAlpha = 0.45;
        ctx.fillStyle = '#C9A6E8';
        ctx.fillRect(Math.round(cx - e.dashVx*0.09), Math.round(cy - e.dashVy*0.09), 3, 3);
        ctx.globalAlpha = 1;
      }
    }
  }
}

/* WB04：弱点窗口的口部金色断环。
   整圈画出来像一个 UI 光圈，所以断成四段弧、每段端点收细，
   再配一点上浮的金屑，读起来是「这里在漏气」，而不是「这里有个按钮」。 */
function drawBossWeakPoint(){
  const b = boss;
  if(!b || b.id !== 'b2' || !(b.weakT > 0)) return;
  const mm = boss2Mouth(b);
  const mx = mm.x, my = mm.y;               /* v1.12.0（D06）：与吐息共用同一个嘴位 */
  const fade = clamp(b.weakT / 0.35, 0, 1);          // 收尾 0.35 秒淡出，不留硬切
  const g = 0.5 + 0.5 * Math.sin(game.t * 9);
  const R0 = 13.5 + 1.6 * g;
  ctx.save();
  ctx.globalAlpha = (0.55 + 0.35 * g) * fade;
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.7;
  ctx.strokeStyle = '#FFD98A';
  for(let k=0;k<4;k++){
    const a0 = k * Math.PI * 0.5 + game.t * 0.9;
    ctx.beginPath();
    ctx.arc(mx, my, R0, a0, a0 + Math.PI * 0.5 - 0.34);
    ctx.stroke();
  }
  /* v1.11.0（FX-W01）：生图的金色裂光叠在口部，弧形与金屑都是画出来的，
     只贴在口部一小块，不把整只 Boss 刷白。 */
  if(fxOK('weak')){
    glowAt('weak', mx, my, 44 + 4*g, 40 + 4*g, game.t * 0.22, (0.55 + 0.25*g) * fade);
  }
  /* 内侧一圈更暖的细弧，跟金色主环错开相位，像雾在往外渗 */
  ctx.globalAlpha = (0.30 + 0.22 * g) * fade;
  ctx.lineWidth = 0.9;
  ctx.strokeStyle = '#FFF2CF';
  for(let k=0;k<3;k++){
    const a0 = -k * (Math.PI * 2 / 3) - game.t * 1.3;
    ctx.beginPath();
    ctx.arc(mx, my, R0 - 4.2, a0, a0 + Math.PI * 0.5 - 0.5);
    ctx.stroke();
  }
  /* v1.11.0（FX-W01 / C13）：「弱点 ×1.5」小签 —— 每个窗口只亮前 0.9 秒，
     贴在口部右上方，不搬动底部 HUD；weakT 归零当帧一起消失。 */
  if(b.weakT0 > 0 && (b.weakT0 - b.weakT) < 0.9){
    const u = clamp((b.weakT0 - b.weakT) / 0.9, 0, 1);
    const al = (u < 0.15 ? u / 0.15 : 1) * (u > 0.75 ? (1 - u) / 0.25 : 1) * fade;
    ctx.globalAlpha = Math.max(0, al);
    ctx.font = '700 7px ' + CN_FONT;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tw = ctx.measureText('弱点 ×1.5').width;
    const cxp = mx + 30, cyp = my - 14;
    ctx.beginPath();
    if(ctx.roundRect) ctx.roundRect(cxp - tw*0.5 - 3.5, cyp - 5, tw + 7, 10, 5);
    else ctx.rect(cxp - tw*0.5 - 3.5, cyp - 5, tw + 7, 10);
    ctx.fillStyle = 'rgba(28,16,8,0.62)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,217,138,0.75)'; ctx.lineWidth = 0.7; ctx.stroke();
    ctx.fillStyle = '#FFD98A';
    ctx.fillText('弱点 ×1.5', cxp, cyp + 0.5);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.globalAlpha = 1;
  }

  /* 上浮金屑：证明弱点窗口在「倒计时」而不是常驻 */
  for(let i=0;i<5;i++){
    const ph = (game.t * 0.8 + i * 0.2) % 1;
    const sx = mx + Math.sin(game.t * 2.2 + i * 1.7) * (6 + i);
    const sy = my - 4 - ph * 16;
    ctx.globalAlpha = (1 - ph) * 0.7 * fade;
    ctx.fillStyle = i % 2 ? '#FFE6B4' : '#FFF6DC';
    ctx.fillRect(sx, sy, 1.3, 1.3);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

/* Boss 预兆：三招各有一套。
   BS03 夜雾横推：x=410 竖虚线，缺口位置整段留白；
   BS05 吞光吐息：x24–390 / y±22 的横向危险带，预兆期只勾边，吐息期填实；
   BS06 扑灯冲撞：x110–401 的航道两条边线 + 端点箭头，返回段保留。 */
function drawBossTell(){
  const b = boss;
  if(!b || b.id !== 'b2') return;

  if(b.mode === 'wall' && b.mt <= 0.85){
    const x = 410;
    const g = b.mt / 0.85;
    const a = 0.45 + 0.45 * g;
    /* v1.4.0：雾墙真的是一堵「雾」—— 一段浓雾带竖起来压在通道上。
       先画雾再画虚线柱，柱是这堵雾中间的硬芯。 */
    if(fxOK('misttex')){
      ctx.save();
      ctx.translate(x, 136);
      ctx.rotate(Math.PI * 0.5);
      glowAt('misttex', 0, 0, 188, 44, 0, 0.16 + 0.36 * g);
      ctx.restore();
    }
    /* 虚线柱：暗底 + 亮芯，压在石身或夜空上都清楚；缺口位置整段留白 */
    for(let y=46; y<=226; y+=8){
      if(Math.abs(y - b.gapY) <= 40) continue;
      ctx.globalAlpha = 0.80 * a;
      ctx.fillStyle = '#1B0D2A';
      ctx.fillRect(x - 2, y, 4, 5);
      ctx.globalAlpha = a;
      ctx.fillStyle = '#FFE6F4';
      ctx.fillRect(x - 1, y + 1, 2, 3);
    }
    /* 缺口两端短刻线，标出安全带宽度（不在通道里放亮箭头） */
    ctx.globalAlpha = Math.min(1, a + 0.15);
    ctx.fillStyle = '#CFE9DA';
    ctx.fillRect(x - 3, b.gapY - 42, 6, 2);
    ctx.fillRect(x - 3, b.gapY + 40, 6, 2);
    ctx.globalAlpha = 1;
    return;
  }

  if(b.mode === 'tide'){
    /* CH06 / BS07：三条扫线。未激活只画细预兆线，激活那条才铺实心危险带，
       不在还没轮的线上提前画伤害面。 */
    const t = b.mt;
    for(let i = 0; i < 3; i++){
      const y = TIDE_Y[i];
      const preStart = TIDE_WARN[i], on = TIDE_ON[i], off = on + TIDE_DUR;
      if(t < preStart) continue;
      if(t < on){
        /* 预兆：两条细线夹住扫线宽度，随倒数变亮 */
        const g = (t - preStart) / Math.max(0.01, TIDE_PRE[i]);
        ctx.globalAlpha = 0.25 + 0.45 * g;
        ctx.fillStyle = '#E8C6FF';
        ctx.fillRect(TIDE_X0, y - TIDE_HH, TIDE_X1 - TIDE_X0, 1);
        ctx.fillRect(TIDE_X0, y + TIDE_HH - 1, TIDE_X1 - TIDE_X0, 1);
      } else if(t < off){
        /* 危险：实心带 + 上下亮边 */
        const k = 1 - (t - on) / TIDE_DUR;
        ctx.globalAlpha = 0.30 + 0.32 * k;
        ctx.fillStyle = '#6B2E8C';
        ctx.fillRect(TIDE_X0, y - TIDE_HH, TIDE_X1 - TIDE_X0, TIDE_HH * 2);
        ctx.globalAlpha = 0.65 + 0.30 * k;
        ctx.fillStyle = '#FFD9F2';
        ctx.fillRect(TIDE_X0, y - TIDE_HH, TIDE_X1 - TIDE_X0, 2);
        ctx.fillRect(TIDE_X0, y + TIDE_HH - 2, TIDE_X1 - TIDE_X0, 2);
        /* v1.4.0：危险带上叠一层向左流动的浓雾 —— 读得出「这一排正往左推」，
           而不是一条静止的紫色矩形；雾层不会扩大判定。 */
        if(fxOK('tidew')){
          const ww = TIDE_X1 - TIDE_X0;
          /* 整条同时可见：主带铺满真实长度，纹理只是装饰，波头不是危险起点 */
          glowAt('tidew', (TIDE_X0 + TIDE_X1) * 0.5, y, ww * 1.02, TIDE_HH * 2.3,
                 0, (0.50 + 0.22 * k));
          const drift = -((game.t * 96) % ww);
          glowAt('tidew', TIDE_X1 + drift - ww * 0.3, y, ww * 0.62, TIDE_HH * 2.0,
                 0, (0.20 + 0.10 * k));
        } else if(fxOK('misttex')){
          const ww = TIDE_X1 - TIDE_X0;
          const drift = -((game.t * 110) % (ww * 0.6));
          glowAt('misttex', (TIDE_X0 + TIDE_X1) * 0.5 + drift, y,
                 ww * 1.12, TIDE_HH * 2.2, 0, 0.24 + 0.30 * k);
        }
      }
    }
    ctx.globalAlpha = 1;
    return;
  }

  if(b.mode === 'breath'){
    const y0 = b.bY - BR_HH, y1 = b.bY + BR_HH;
    const grown = clamp(b.mt / BR_MOUTH, 0, 1);
    const live = b.mt >= BR_WARN && b.mt < BR_WARN + BR_ON;
    const warnIn = 1 - clamp(b.mt / BR_WARN, 0, 1);
    /* FX-B05 预兆（v1.11.0）：不是虚线矩形，而是「真实危险带的两条低亮边 + 极浅底色」，
       从嘴边一直贯通到左端 —— 玩家在预兆期就能读出整条带子的上下边界。 */
    if(b.mt < BR_WARN){
      const a = 0.30 + 0.46 * (1 - warnIn);
      /* 极浅底色：只是「这一排会亮」，还不到危险 */
      const wp = ctx.createLinearGradient(0, y0, 0, y1);
      wp.addColorStop(0.00, 'rgba(73,48,95,0)');
      wp.addColorStop(0.50, 'rgba(120,66,124,' + (0.10 * a).toFixed(3) + ')');
      wp.addColorStop(1.00, 'rgba(73,48,95,0)');
      ctx.fillStyle = wp;
      ctx.fillRect(BR_X0, y0, BR_X1 - BR_X0, y1 - y0);
      /* 上下两条边：略有雾纹的细线，越接近吐息越亮 */
      ctx.globalAlpha = a;
      ctx.strokeStyle = '#F4BDDF';
      ctx.lineWidth = 1.0;
      ctx.beginPath(); ctx.moveTo(BR_X0, y0 + 0.5); ctx.lineTo(BR_X1, y0 + 0.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(BR_X0, y1 - 0.5); ctx.lineTo(BR_X1, y1 - 0.5); ctx.stroke();
      /* 从口部往左扫的一道细亮线，读得出「从这边烧过去」 */
      const sweep = BR_X1 - (BR_X1 - BR_X0) * grown;
      const sg = ctx.createLinearGradient(sweep, 0, BR_X1, 0);
      sg.addColorStop(0.00, 'rgba(255,214,168,0)');
      sg.addColorStop(1.00, 'rgba(255,224,180,' + (0.42 * a).toFixed(3) + ')');
      ctx.fillStyle = sg;
      ctx.fillRect(sweep, b.bY - 1, BR_X1 - sweep, 1.6);
      ctx.globalAlpha = 1;
      return;
    }
    /* FX-B05 吞光吐息（v1.11.0）：不是金色的「水管」，是一整条紫雾流。
       启动当步整条危险范围（x24..390、y±22）就同时可见：
       先铺一层连贯的半透明紫底，再叠从右向左流动的雾纹；
       边缘羽化，但真实边界稳定 —— 纹理的空白不会被读成安全缺口。 */
    if(live){
      const fl = 0.90 + 0.10 * Math.sin(game.t * 26);
      const bg3 = ctx.createLinearGradient(0, y0, 0, y1);
      bg3.addColorStop(0.00, 'rgba(73,48,95,0.00)');
      bg3.addColorStop(0.22, 'rgba(94,58,116,' + (0.50 * fl).toFixed(3) + ')');
      bg3.addColorStop(0.50, 'rgba(146,74,140,' + (0.62 * fl).toFixed(3) + ')');
      bg3.addColorStop(0.78, 'rgba(94,58,116,' + (0.50 * fl).toFixed(3) + ')');
      bg3.addColorStop(1.00, 'rgba(73,48,95,0.00)');
      ctx.fillStyle = bg3;
      ctx.fillRect(BR_X0, y0, BR_X1 - BR_X0, y1 - y0);

      /* 生图烟带（v1.11.0）：主带一整条铺满真实判定宽度 —— 没有拼接缝；
         再叠一条窄一点、缓慢左移的副本，读得出「在流」而不是一张贴纸。 */
      if(fxOK('breath')){
        const ww = BR_X1 - BR_X0;
        const bh = (y1 - y0) * 1.10;
        glowAt('breath', (BR_X0 + BR_X1) * 0.5, b.bY, ww * 1.03, bh, 0, 0.72);
        const drift = -(((game.t * 74) % ww));
        glowAt('breath', BR_X1 + drift - ww * 0.34, b.bY, ww * 0.66, bh * 1.18, 0, 0.26);
      } else if(fxOK('misttex')){
        const ww = BR_X1 - BR_X0;
        for(let k = 0; k < 3; k++){
          const drift = -(((game.t * (52 + k * 18) + k * 140) % ww));
          glowAt('misttex', BR_X1 + drift - ww * 0.5, b.bY,
                 ww * 1.05, (y1 - y0) * (1.05 + k * 0.25), 0, 0.20 + 0.06 * k);
        }
      }
      /* 口部最紧：一团压得住的雾核，越往左越松 */
      if(fxOK('breath')){
        glowAt('breath', BR_X1 - 16, b.bY, 96, (y1 - y0) * 1.5, 0, 0.30);
      }
      /* 上下真实边界：深紫描边 + 内侧一条玫紫亮线，稳定不跟着雾纹抖 */
      ctx.globalAlpha = 0.90;
      ctx.strokeStyle = '#F4BDDF';
      ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.moveTo(BR_X0, y0 + 0.6); ctx.lineTo(BR_X1, y0 + 0.6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(BR_X0, y1 - 0.6); ctx.lineTo(BR_X1, y1 - 0.6); ctx.stroke();
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = '#49305F';
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(BR_X0, y0 - 1.0); ctx.lineTo(BR_X1, y0 - 1.0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(BR_X0, y1 + 1.0); ctx.lineTo(BR_X1, y1 + 1.0); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    return;
  }

  if(b.mode === 'charge'){
    const travel = (CH_CX0 - CH_CX1) / CH_SPD;
    const tBack0 = CH_WARN + travel + CH_STAG;
    const inWarn  = b.mt < CH_WARN;
    const inBack  = b.mt >= tBack0 && b.mt < tBack0 + CH_BACK;
    if(!inWarn && !inBack) return;
    const y = b.chY;
    /* FX-B06（v1.11.0）：不用大号虚线矩形。航道是两条轻薄的边线，
       加上 3~4 个低亮左向短箭纹，长度与实际路线一致；返回段同一条航道重勾。 */
    const a = inWarn ? (0.26 + 0.44 * clamp(b.mt / CH_WARN, 0, 1)) : 0.30;
    const x0 = CH_CX1, x1 = CH_CX0;
    ctx.globalAlpha = a;
    ctx.strokeStyle = inWarn ? '#F4BDDF' : '#FFD8E8';
    ctx.lineWidth = 1.0;
    ctx.beginPath(); ctx.moveTo(x0, y - CHARGE_TOUCH_R); ctx.lineTo(x1, y - CHARGE_TOUCH_R); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x0, y + CHARGE_TOUCH_R); ctx.lineTo(x1, y + CHARGE_TOUCH_R); ctx.stroke();
    /* 短箭纹：沿航道均匀铺 4 组，方向朝左（冲出去的方向） */
    ctx.fillStyle = inWarn ? '#FFD0DA' : '#FFE6D2';
    const nArrow = coarsePointer ? 3 : 4;
    for(let k = 0; k < nArrow; k++){
      const ax = x0 + (x1 - x0) * (0.18 + k * 0.22);
      const ph = (game.t * 0.9 + k * 0.25) % 1;          // 一点点流动感，不改成波头判定
      ctx.globalAlpha = a * (0.55 + 0.35 * Math.sin(ph * Math.PI));
      ctx.beginPath();
      ctx.moveTo(ax - 5, y);
      ctx.lineTo(ax + 4, y - 3.0);
      ctx.lineTo(ax + 1.4, y);
      ctx.lineTo(ax + 4, y + 3.0);
      ctx.closePath(); ctx.fill();
    }
    /* 左端收口：撞到哪儿去 */
    ctx.globalAlpha = a;
    ctx.fillStyle = inWarn ? '#F4BDDF' : '#FFE6D2';
    for(let k=0;k<3;k++){
      const rr3 = 4.4 - k * 1.2;
      ctx.globalAlpha = a * (0.85 - k * 0.24);
      ctx.beginPath();
      ctx.moveTo(x0 + 4, y);
      ctx.lineTo(x0 + 11, y - rr3);
      ctx.lineTo(x0 + 11, y + rr3);
      ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

/* ---------- HUD ---------- */
function drawGem(x, y, fire){
  drawFit(fire ? 'cryFire' : 'cryIce', x, y + 3.5, 15);
}

/* ---------- 开场操作提示（V05）----------
   原来左下角常驻五行键位，占掉底角一大块、还和上方 HUD 重复讲操作，
   湖岸那点叙事全被压在黑框里。
   现在改成开场逐条淡入的短提示：每 1.6 秒出一条，全部出完停 1.2 秒，
   再用 1.6 秒整体淡出；之后画面只剩 HUD。
   桌面端淡出后留一行极短键位（半透明），触屏端完全不显示 —— 按钮就在手上。 */
const HINT_ROWS = [
  { k:'移动',   t:'W A S D 或方向键' },
  { k:'射击',   t:'按住空格持续发射' },
  { k:'炉火',   t:'Z 施放 · 击败灯怪补充' },
  { k:'绽放',   t:'E 微光满槽时开启' }
];
const HINT_IV = 1.6;        // 每条出现间隔
const HINT_HOLD = 1.2;      // 全部出完后的停留
const HINT_FADE = 1.6;      // 整体淡出时长
const HINT_END = HINT_ROWS.length * HINT_IV + HINT_HOLD + HINT_FADE;

function hintAlpha(i, t){
  const t0 = i * HINT_IV;
  if(t < t0) return 0;
  const fin = clamp((t - t0) / 0.45, 0, 1);
  const outStart = HINT_ROWS.length * HINT_IV + HINT_HOLD;
  const fout = 1 - clamp((t - outStart) / HINT_FADE, 0, 1);
  return fin * fout;
}

function drawControlHint(){
  if(game.teaTime) return;
  /* 只在局内画：暂停页自己有一份可以反复查阅的键位说明（V05），
     两套同时出现既重复又互相压字 */
  if(game.state !== 'play') return;
  const t = game.elapsed;   // 准备期就开始播，玩家读的时候正好在等倒计时

  if(t < HINT_END){
    /* 开场阶段：左下角逐条淡入，底板随整体透明度一起淡出 */
    const a0 = 1 - clamp((t - (HINT_ROWS.length*HINT_IV + HINT_HOLD)) / HINT_FADE, 0, 1);
    if(a0 > 0.01){
      ctx.save();
      ctx.globalAlpha = a0 * 0.55;
      ctx.beginPath(); ctx.roundRect(W - 118, 44, 114, 46, 5);
      ctx.fillStyle = 'rgba(14,8,26,1)';
      ctx.fill();
      ctx.restore();
    }
    for(let i=0;i<HINT_ROWS.length;i++){
      const a = hintAlpha(i, t);
      if(a <= 0.01) continue;
      const y = 55 + i * 9.4;
      ctx.save();
      ctx.globalAlpha = a;
      drawCN(HINT_ROWS[i].k, W - 108, y + 3.2, 7.6, 'rgba(255,246,220,0.94)', 'left', 700);
      drawCN(HINT_ROWS[i].t, W - 84, y + 3.0, 7.2, 'rgba(200,188,226,0.86)', 'left', 500);
      ctx.restore();
    }
    return;
  }

  /* 淡出之后：桌面留一行紧凑键位，字号只有原来的一半，不抢画面 */
  if(coarsePointer) return;
  ctx.save();
  ctx.globalAlpha = 0.34;
  drawCN('WASD 移动 · 空格 射击 · Z 炉火 · E 绽放 · P 暂停', W - 6, 24, 6.4,
         'rgba(216,204,240,0.95)', 'right', 500);
  ctx.restore();
}

/* ---------- 水彩笔触（v1.7）----------
   HUD 原来用的是 7×6 的像素图案，和绘本水彩的背景、立绘放在一起像两个游戏。
   这里换成程序化水彩：两层叠加（外层淡晕 + 内层有芯渐变）+ 圆角，
   边缘不再是一个个方块，笔触和背景对得上。 */
function hexA(hex, a){
  const n = parseInt(hex.slice(1), 16);
  return 'rgba(' + (n>>16&255) + ',' + (n>>8&255) + ',' + (n&255) + ',' + a + ')';
}
function heartPath(cx, cy, s){
  ctx.moveTo(cx, cy + s*0.74);
  ctx.bezierCurveTo(cx - s*1.16, cy - s*0.06, cx - s*0.58, cy - s*1.00, cx, cy - s*0.30);
  ctx.bezierCurveTo(cx + s*0.58, cy - s*1.00, cx + s*1.16, cy - s*0.06, cx, cy + s*0.74);
  ctx.closePath();
}
/* 水彩心形：外层一圈几乎看不见的晕，内层是有亮芯的渐变 */
function washHeart(cx, cy, s, col, a){
  ctx.save();
  ctx.globalAlpha = a * 0.34;
  ctx.fillStyle = hexA(col, 0.50);
  ctx.beginPath(); heartPath(cx, cy, s * 1.18); ctx.fill();

  const g = ctx.createRadialGradient(cx - s*0.32, cy - s*0.36, s*0.06, cx, cy + s*0.12, s*1.06);
  g.addColorStop(0.00, '#FFF0F4');
  g.addColorStop(0.34, col);
  g.addColorStop(1.00, hexA(col, 0.88));
  ctx.globalAlpha = a;
  ctx.fillStyle = g;
  ctx.beginPath(); heartPath(cx, cy, s); ctx.fill();
  ctx.restore();
}
/* 水彩格子（魔力格）：圆角 + 内部灯芯，不是填满的方块 */
function washSlot(x, y, w, h, col, on, a){
  ctx.save();
  ctx.globalAlpha = a;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 2.4);
  ctx.fillStyle = on ? hexA(col, 0.24) : 'rgba(24,15,40,0.52)';
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = on ? hexA(col, 0.88) : 'rgba(205,185,235,0.44)';
  ctx.stroke();
  if(on){
    const cx = x + w*0.5, cy = y + h*0.5;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, w*0.60);
    g.addColorStop(0.00, 'rgba(255,255,255,0.94)');
    g.addColorStop(0.42, hexA(col, 0.86));
    g.addColorStop(1.00, hexA(col, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, w*0.60, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();
}
/* 水彩细条（成长 / 能量）：两端收圆，右端提亮像颜料积在那里 */
function washBar(x, y, w, h, p, col, a){
  ctx.save();
  ctx.globalAlpha = a;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, h*0.5);
  ctx.fillStyle = 'rgba(22,12,36,0.62)'; ctx.fill();
  /* 空槽描一道：进度为 0 时整条几乎看不见，标签会显得悬空 */
  ctx.lineWidth = 0.7;
  ctx.strokeStyle = 'rgba(198,180,230,0.22)';
  ctx.stroke();
  const q = clamp(p, 0, 1);
  if(q > 0.01){
    const ww = Math.max(h, w * q);
    ctx.beginPath(); ctx.roundRect(x, y, ww, h, h*0.5);
    const g = ctx.createLinearGradient(x, 0, x + ww, 0);
    g.addColorStop(0.00, hexA(col, 0.48));
    g.addColorStop(0.72, hexA(col, 0.94));
    g.addColorStop(1.00, hexA('#FFFFFF', 0.88));
    ctx.fillStyle = g; ctx.fill();
  }
  ctx.restore();
}

/* ---------- 中文 HUD 文字 ----------
   像素字库只有 ASCII，之前 HUD 里所有标签都只能是英文缩写，
   和绘本水彩的场景、立绘像是两个游戏（V01）。
   这里直接用系统中文黑体画，只用于标签与小数值；像素字仍留给世界内的飘字。 */
const CN_FONT = '"PingFang SC","Microsoft YaHei","Hiragino Sans GB",system-ui,sans-serif';
function drawCN(t, x, y, size, color, align, weight){
  ctx.save();
  ctx.font = (weight || 600) + ' ' + size + 'px ' + CN_FONT;
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = color;
  ctx.fillText(t, x, y);
  ctx.restore();
}
/* 标签统一：低对比的淡紫，只负责说明「这一行是什么」 */
const HUD_LAB = 'rgba(206,192,232,0.72)';

/* 「数值 + 单位」右对齐成组：单位小一号贴右侧，数值紧贴它左边 */
function drawCNPair(value, label, xRight, y, vsize, lsize, vcol, lcol){
  ctx.save();
  ctx.font = '600 ' + lsize + 'px ' + CN_FONT;
  const lw = ctx.measureText(label).width;
  ctx.restore();
  drawCN(label, xRight, y, lsize, lcol, 'right', 500);
  drawCN(value, xRight - lw - 2.5, y, vsize, vcol, 'right', 700);
}

/* 顶部标题：文字两侧各一条向外淡出的细线 + 一个菱点，
   参考稿的「—— 湖畔 ——」就是这个节奏，比一串孤零零的字更稳。
   线长按文字宽度自适应，标题变长也不会顶到两边的数值。 */
function drawPhaseTitle(text, cx, y, col){
  const size = 9.4;
  ctx.save();
  ctx.font = '700 ' + size + 'px ' + CN_FONT;
  const tw = ctx.measureText(text).width;
  ctx.restore();
  drawCN(text, cx, y, size, col || 'rgba(235,226,252,0.96)', 'center', 700);

  const inner = tw * 0.5 + 7;
  const outer = inner + 13;
  for(let s = -1; s <= 1; s += 2){
    const x0 = cx + s * inner, x1 = cx + s * outer;
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, 'rgba(214,198,244,0.42)');
    g.addColorStop(1, 'rgba(214,198,244,0)');
    ctx.strokeStyle = g;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x0, y - 3.2); ctx.lineTo(x1, y - 3.2); ctx.stroke();
    /* 内端一个 1.6 的小菱点 */
    ctx.fillStyle = 'rgba(232,220,255,0.62)';
    ctx.beginPath();
    ctx.moveTo(x0, y - 4.8); ctx.lineTo(x0 + 1.6, y - 3.2);
    ctx.lineTo(x0, y - 1.6); ctx.lineTo(x0 - 1.6, y - 3.2);
    ctx.closePath(); ctx.fill();
  }
}

/* 桌面端的绽放条：右下角一块，和触屏那个「绽放」按钮同一个位置语言。
   触屏走 DOM 按钮上的百分比，这里就不重复画。 */
function drawBloomChip(){
  const xr = W - 14, y = H - 16, bw = 26;
  const active = player.bloomT > 0;
  const ready = player.bloom >= 100;
  const col = active ? '#FFF2CF' : (ready ? '#B8E986' : '#7FA867');
  /* WB05：强化期间这块的主词是「强化」+ 5.0→0.0 秒，轮次等级退成次要信息 */
  drawCN(active ? '强化' : '绽放', xr - bw - 6, y, 7.2,
         active ? '#FFF2CF' : HUD_LAB, 'right', active ? 700 : 500);
  washBar(xr - bw, y - 4.6, bw, 4, active ? (player.bloomT / BLOOM_T) : (player.bloom / 100), col, 1);
  /* 数值放在条上面，避免和「F 全屏」那行抢位置 */
  if(active){
    drawCN(player.bloomT.toFixed(1) + 's', xr, y - 7.2, 7.4, '#FFF2CF', 'right', 700);
    drawCN('LV' + player.bloomLv, xr - 22, y - 7.2, 6.2, 'rgba(200,190,226,0.72)', 'right', 500);
  } else {
    const txt = ready ? '就绪' : Math.round(player.bloom) + '%';
    drawCN(txt, xr, y - 7.2, 7.4, ready ? '#B8E986' : 'rgba(196,184,222,0.9)', 'right', 700);
  }
}

/* 触屏：把绽放状态写到「绽放」按钮上（参考稿把能量放在按钮上）。
   只在文字真的变了时改 DOM，不然每帧写一次 data-p 会一直触发重排。 */
let _bloomP = null, _bloomLbl = null;
function syncBloomBtn(){
  if(!coarsePointer) return;
  const el = document.getElementById('btnBloom');
  if(!el) return;
  /* 萤火归途里绽放停用：主词要退回「绽放」，不能停在上一状态留下的「强化」 */
  const active = player.bloomT > 0 && !game.teaTime;
  const lbl = active ? '强化' : '绽放';
  if(lbl !== _bloomLbl){
    _bloomLbl = lbl;
    if(el.firstChild && el.firstChild.nodeType === 3) el.firstChild.nodeValue = lbl;
    else el.textContent = lbl;
  }
  if(game.teaTime){
    if(_bloomP !== ''){
      _bloomP = '';
      el.dataset.p = '';
      el.classList.remove('ready');
      el.classList.add('off');
    }
    return;
  }
  el.classList.remove('off');
  const ready = player.bloom >= 100;
  /* WB05：强化期间按钮主词固定写「强化」，副行是倒计时 + 轮次等级 */
  const txt = active ? ('LV' + player.bloomLv + ' ' + player.bloomT.toFixed(1) + 's')
                     : (ready ? '就绪' : Math.round(player.bloom) + '%');
  if(txt !== _bloomP){
    _bloomP = txt;
    el.dataset.p = txt;
    el.classList.toggle('ready', ready || active);
  }
}

/* WB11：萤火归途里整套技能组一起停用 —— 绽放和切换都压暗，
   魔法按钮留着显示「接萤火」当说明，位置一律不动。
   切换键的副行写「下一种魔法」的纹样与名字，玩家不用点也知道会切到什么。 */
/* CH05：技能组只剩「炉火 + 绽放」两个主键，切换键已移除。
   这里只负责归途期间把整个技能组一起压暗。 */
function syncSkillGroup(){
  if(!coarsePointer) return;
  const bl = document.getElementById('btnBloom');
  if(bl) bl.classList.toggle('off', !!game.teaTime);
}

/* WB11：把魔法状态写到「魔法」按钮上 —— 当前魔法名 + 魔力格 / 冷却 / 无魔力。
   只在文字真的变了时改 DOM，避免每帧写 data-p 触发重排。 */
let _mgP = null, _mgLbl = null;
function syncMagicBtn(){
  if(!coarsePointer) return;
  const el = document.getElementById('btnMagic');
  if(!el) return;
  /* CH01 / CH05：炉火是唯一库存技能，按钮直接显示「已持 / 上限」 */
  if(_mgLbl !== '炉火'){
    _mgLbl = '炉火';
    if(el.firstChild && el.firstChild.nodeType === 3) el.firstChild.nodeValue = '炉火';
    else el.textContent = '炉火';
  }
  el.style.color = '#FFD9A0';
  let sub;
  if(game.teaTime)               sub = '接萤火';
  else if(player.fireAmmo <= 0)  sub = '0/' + FIRE_MAX;
  else if(player.magicLock > 0)  sub = player.fireAmmo + '/' + FIRE_MAX + ' ' + player.magicLock.toFixed(1) + 's';
  else sub = player.fireAmmo + '/' + FIRE_MAX;
  if(sub !== _mgP){
    _mgP = sub;
    el.dataset.p = sub;
    el.classList.toggle('nomp', !game.teaTime && player.fireAmmo <= 0);
  }
}

/* 顶部状态栏：一行排完（生命 / 射击 / 魔力），和参考稿的节奏一致。
   原来是三行竖排、压到 y=4..47，而可行区域从 y=43 起 —— 小魔女飞到高位
   就直接盖在「魔力 / 绽放」上，字和精灵互相糊。改成单行后整块只占 8..21，
   飞行区完全让开，不用靠压暗去救可读性。
   绽放不进这一行（480 宽放不下四组），触屏显示在「绽放」按钮上，桌面在右下角。 */
function drawHUD(){
  /* v1.2.0：HUD 已全部改成 DOM（#hud），这里只保留 canvas 内的飘字与提示，
     原来画心形 / 射击 / 成长条 / 分数 / Boss 条 / 技能槽的整块都不再执行。 */
  if(true) return;
  syncBloomBtn();
  syncMagicBtn();
  syncSkillGroup();
  /* WB11：HUD 的字不能只跟着世界像素走 —— 480×270 世界坐标在手机上
     只有 1.2 倍缩放时 6.8px 的字落到屏幕上只剩 8 CSS px。这里按
     「常用 ≥12 CSS px」反算一个系数，只对触屏档生效（桌面保持原样）。 */
  const K = game.hudK || 1;
  const rowY = 16;               // 这一行的基准线
  /* ---- 生命 ---- */
  for(let i=0;i<player.maxHp;i++){
    const alive = i < player.hp;
    washHeart(9.4 + i*9.6, 12.4, 3.9, alive ? '#E8788F' : '#5c4669', alive ? 1 : 0.6);
  }

  /* 萤火归途期间不暗示仍可施法（11.1）：整块战斗资源隐藏 */
  if(!game.teaTime){
    /* ---- 射击成长（4.2）---- */
    drawCN('射击', 52, rowY, 6.8*K, HUD_LAB);
    const lvCol = (player.shotLv >= 3) ? '#F2CF8A' : '#BFE2F7';
    drawCN('L' + player.shotLv, 74, rowY + 0.4, 7.8*K, lvCol, 'left', 700);
    const gbx = 87, gby = 11.4, gbw = 31, gbh = 3.4;
    washBar(gbx, gby, gbw, gbh, player.grow / GROW_MAX,
            (player.shotLv >= 3) ? '#F2CF8A' : '#9BD0EE', 1);
    /* 两道刻度：位置来自 SHOT_LV，改阈值时自动跟着走 */
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = '#FFFFFF';
    for(let i=1;i<SHOT_LV.length;i++){
      ctx.fillRect(gbx + Math.round(gbw*(SHOT_LV[i].need/GROW_MAX)) - 0.5, gby, 1, gbh);
    }
    ctx.restore();

    /* CH05：炉火库存只在左下按钮上显示，HUD 左上只留生命与射击成长，避免两处重复 */
    /* 共同施法间隔：贴着魔力格，短促的一条 */
    if(player.magicLock > 0){
      washBar(148, 20.4, 28, 1.4, 1 - player.magicLock / MAGIC_CD, '#F5A05C', 0.85);
    }
  }

  /* 绽放：触屏在按钮上显示，桌面在右下角补一块（原来占 HUD 第三行，
     把整块顶栏顶到 y=47，正好撞上飞行区上限） */
  /* CH05：绽放只在左下按钮上显示，右下那条孤立条已腾出 */

  /* ---- 分数：右上一个整组，「分」在右、数值在左，只有数值高亮。
     右侧留出声音按钮的宽度，否则「分」会被 ♪ 压住；按钮是 CSS 像素、
     画布是世界像素，所以内缩量在 fit() 里按实际尺寸换算。 ---- */
  /* WB11：手机屏幕小，实时分数与秒数都收进结算页，顶部只留战斗必需的信息 */
  if(!coarsePointer){
    drawCNPair(String(game.score), '分', W - 8 - (game.hudR || 0), 16, 12, 7.4, '#F2CF8A', HUD_LAB);
  }

  /* ---- 阶段 + 已用时间（11.1：正向统计，不出现倒计时）---- */
  if(!game.teaTime){
    drawPhaseTitle(PHASE_TABLE[game.phase].cn, W/2, 16);
    /* 手机不显示实时秒数（WB11），桌面保留 */
    if(!coarsePointer) drawCN(Math.round(game.elapsed) + ' 秒', W/2, 26, 7.2, HUD_LAB, 'center');
  }

  /* 萤火归途：阶段名让位，计数占顶部正中 —— 原来和分数都锚在右上角 W-8，
     两串数字直接叠在一起 */
  if(game.teaTime){
    drawPhaseTitle('萤火 ' + game.fireflies + ' / ' + FLY_N, W/2, 16, '#F6DFA6');
  }

  /* 开场准备 3 秒（11.2）：不生成攻击、不消耗资源 */
  if(game.introT > 0){
    const n = Math.ceil(game.introT);
    ctx.globalAlpha = 0.55 + 0.45*Math.abs(Math.sin(game.t*4));
    drawCN('准备', W/2, H/2 - 30, 11, '#FFF2CF', 'center', 700);
    drawCN(String(n), W/2, H/2 + 2, 30, '#FFF2CF', 'center', 700);
    ctx.globalAlpha = 1;
  }

  /* ---- Boss 条（底部中央）：名称 + 生命比例 ----
     原来只有一条 7px 高、描边 0.30 的细条，压在暗场景上几乎看不见；
     这里给深色轨道 + 内阴影 + 高光前锋，名字加一层极淡的底带保证可读。 */
  if(boss && game.bossActive){
    const bw = 232, bh = 8, bx = W/2 - bw/2;
    /* WB11：手机顶部空间紧，Boss 条移到顶部留白区（阶段名之下、提示条之上），
       名字不画，只留条 + 阶段签，避免和顶部三样东西抢位置。 */
    const by = coarsePointer ? 30 : (H - 27);
    const bcol = (boss.id === 'b1') ? '#C8A0B8' : '#EC9078';
    const r = clamp(boss.hp/boss.maxhp, 0, 1);
    ctx.save();
    /* 轨道：比场景更暗，两端收圆 */
    ctx.beginPath(); ctx.roundRect(bx - 1.5, by - 1.5, bw + 3, bh + 3, (bh + 3) * 0.5);
    ctx.fillStyle = 'rgba(10,6,20,0.72)'; ctx.fill();
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, bh * 0.5);
    ctx.fillStyle = 'rgba(26,16,42,0.92)'; ctx.fill();
    ctx.lineWidth = 0.9;
    ctx.strokeStyle = hexA(bcol, 0.55); ctx.stroke();
    /* 填充：左端压深、右端提亮，前锋再加一团光，长度一眼能读 */
    const ww = bw * r;
    if(ww > 1.6){
      const bg2 = ctx.createLinearGradient(bx, 0, bx + ww, 0);
      bg2.addColorStop(0.00, hexA(bcol, 0.62));
      bg2.addColorStop(0.72, hexA(bcol, 0.96));
      bg2.addColorStop(1.00, hexA('#FFF0F4', 0.94));
      ctx.beginPath(); ctx.roundRect(bx, by, Math.max(bh, ww), bh, bh * 0.5);
      ctx.fillStyle = bg2; ctx.fill();
      /* 上半一条内高光，条才有厚度 */
      ctx.beginPath();
      ctx.roundRect(bx + 1, by + 1, Math.max(bh, ww) - 2, bh * 0.38, bh * 0.19);
      ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fill();
      const hx2 = bx + Math.max(bh, ww);
      const hg3 = ctx.createRadialGradient(hx2, by + bh*0.5, 0, hx2, by + bh*0.5, 15);
      hg3.addColorStop(0.00, hexA('#FFF2F6', 0.42));
      hg3.addColorStop(1.00, hexA('#FFF2F6', 0.00));
      ctx.fillStyle = hg3;
      ctx.fillRect(hx2 - 15, by - 8, 30, bh + 16);
    }
    /* 两端刻度：说明这是一条「有头有尾」的血条 */
    ctx.strokeStyle = hexA(bcol, 0.40); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(bx - 4, by - 2); ctx.lineTo(bx - 4, by + bh + 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx + bw + 4, by - 2); ctx.lineTo(bx + bw + 4, by + bh + 2); ctx.stroke();
    /* WB03：终 Boss 的半血细标（160/320）。没过半血之前它是一道暗刻度，
       过半血后点成暖色，玩家能看出「还有一段」而不是只剩一点血。 */
    if(boss.id === 'b2'){
      /* CH06：两道刻度把 320 分成 320→224→112→0 三段 */
      for(let ti = 0; ti < B2_THRESH.length; ti++){
        const hxT = bx + bw * (B2_THRESH[ti] / B2_HP);
        const passedT = boss.hp <= B2_THRESH[ti];
        ctx.globalAlpha = passedT ? 0.85 : 0.45;
        ctx.strokeStyle = passedT ? '#FFD98A' : hexA('#FFE0C8', 0.55);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(hxT, by - 3); ctx.lineTo(hxT, by + bh + 3);
        ctx.stroke();
      }
      const hx3 = bx + bw * (B2_THRESH[0] / B2_HP);
      const passed = boss.hp <= B2_THRESH[0];
      if(passed){
        const hg4 = ctx.createRadialGradient(hx3, by + bh*0.5, 0, hx3, by + bh*0.5, 10);
        hg4.addColorStop(0.00, 'rgba(255,224,160,0.40)');
        hg4.addColorStop(1.00, 'rgba(255,224,160,0.00)');
        ctx.fillStyle = hg4;
        ctx.fillRect(hx3 - 10, by - 7, 20, bh + 14);
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    /* 名字：先垫一层横向淡出的暗带，避免压在屋影或月亮上读不出 */
    const nm = (boss.id === 'b1') ? '打盹的夜团' : '湖边大夜怪';
    /* WB03：阶段名做成名字前面的一枚小签（F1「聚雾」偏冷，F2「躁动」点暖）。
       放在血条右侧会撞上右下角的绽放条，所以并进同一行居中排。
       WB11：手机档上下都紧（上面是阶段名、下面是提示条），名字省掉只留签；
       签从条上方改挂到条左端同一水平线，左边那块区域手机上是空的。 */
    const isB2 = (boss.id === 'b2');
    const ph2 = isB2 && (boss.ph >= 2);
    const lbl = isB2 ? B2_PHASE_NAME[Math.min(3, boss.ph) - 1] : '';
    const lc  = (isB2 && boss.ph === 3) ? '#E8A0FF' : (ph2 ? '#FF9C86' : '#B8C8EC');
    ctx.save();
    ctx.font = '700 ' + (8*K) + 'px ' + CN_FONT;
    const chipW = isB2 ? (ctx.measureText(lbl).width + 12*K) : 0;
    ctx.restore();
    if(coarsePointer){
      if(isB2){
        /* 手机档：签挂在条左端，字号跟 HUD 系数一起放大，高度同步 */
        const chh2 = 9.4*K, cw = chipW, cy0 = by + bh*0.5 - chh2*0.5;
        const cx0 = bx - cw - 5;
        ctx.beginPath(); ctx.roundRect(cx0, cy0, cw, chh2, chh2 * 0.5);
        ctx.fillStyle = 'rgba(10,6,20,0.78)'; ctx.fill();
        ctx.strokeStyle = hexA(lc, 0.46); ctx.lineWidth = 0.8; ctx.stroke();
        drawCN(lbl, cx0 + cw*0.5, cy0 + chh2 - 2.1, 8*K, lc, 'center', 700);
      }
    } else {
      ctx.save();
      ctx.font = '700 9px ' + CN_FONT;
      const nw = ctx.measureText(nm).width;
      ctx.restore();
      const groupW = nw + (isB2 ? chipW + 6 : 0);
      const gx = W/2 - groupW * 0.5;
      const bandX = gx - 14, bandW = groupW + 28;
      const nband = ctx.createLinearGradient(bandX, 0, bandX + bandW, 0);
      nband.addColorStop(0.00, 'rgba(14,8,26,0)');
      nband.addColorStop(0.16, 'rgba(14,8,26,0.62)');
      nband.addColorStop(0.84, 'rgba(14,8,26,0.62)');
      nband.addColorStop(1.00, 'rgba(14,8,26,0)');
      ctx.fillStyle = nband;
      ctx.fillRect(bandX, by - 15, bandW, 13);
      if(isB2){
        const cw = chipW, cy0 = by - 12.4, chh = 9.4;
        ctx.beginPath(); ctx.roundRect(gx, cy0, cw, chh, chh * 0.5);
        ctx.fillStyle = 'rgba(10,6,20,0.78)'; ctx.fill();
        ctx.strokeStyle = hexA(lc, 0.46); ctx.lineWidth = 0.8; ctx.stroke();
        drawCN(lbl, gx + cw*0.5, cy0 + 7.3, 8, lc, 'center', 700);
      }
      drawCN(nm, gx + groupW, by - 5, 9, '#F2CF8A', 'right', 700);
    }
  }

  /* 战前 WARNING（萤火归途期间不残留） */
  if(game.warnT > 0 && !game.teaTime){
    ctx.globalAlpha = 0.55 + 0.45*Math.sin(game.t*14);
    drawCN('注意前方', W/2, H/2 - 44, 13, '#FF9AA6', 'center', 700);
    ctx.globalAlpha = 1;
  }

  /* 萤火归途短标题 */
  if(game.teaBannerT > 0){
    const a = clamp(game.teaBannerT / 0.6, 0, 1);
    const hbw = 136, hbx = W/2 - hbw/2, hby = 48, hbh = 23;
    ctx.save();
    ctx.globalAlpha = a;
    const hband = ctx.createLinearGradient(hbx, 0, hbx + hbw, 0);
    hband.addColorStop(0.00, 'rgba(20,12,36,0.00)');
    hband.addColorStop(0.24, 'rgba(20,12,36,0.50)');
    hband.addColorStop(0.76, 'rgba(20,12,36,0.50)');
    hband.addColorStop(1.00, 'rgba(20,12,36,0.00)');
    ctx.beginPath(); ctx.roundRect(hbx, hby, hbw, hbh, 10);
    ctx.fillStyle = hband; ctx.fill();
    ctx.restore();
    drawCN('回家', W/2, 60, 12, '#FFF2CF', 'center', 700);
  }

  /* 开场操作提示（V05）：逐条淡入，演完就退场 */
  drawControlHint();
}

/* ---------- 渲染 ---------- */
/* 暗角 + 阶段色调。核心与补边缓冲都要走同一份，
   否则留白区比核心亮一档，接缝会显出一条竖线 / 横线。 */
function drawAtmos(){
  /* V03：暗角减弱并向外推，底部岸景不再被压成一条黑带。
     WB21：暗角与阶段色调都按**整个可见范围**画一次，不再只画核心 ——
     否则中央和两侧会各有一套明暗，交界处就是一条竖直的亮度分界。
     做法：把渐变坐标系平移到可见范围中心，再按可见宽高比横向拉伸，
     可见范围正好等于 480×270 时（桌面 16:9）结果与原实现逐像素一致。 */
  const kx = VIEW.w / W;
  const vg = ctx.createRadialGradient(0, 0, H*0.46, 0, 0, H*1.02);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(6,3,14,0.34)');
  ctx.save();
  ctx.translate(VIEW.cx, VIEW.cy - 6);
  ctx.scale(kx, 1);
  ctx.fillStyle = vg;
  /* 局部坐标里 ±W / ±H 覆盖：世界 x 方向被 kx 放大回来正好等于可见宽度 */
  ctx.fillRect(-W, -H, W * 2, H * 2);
  ctx.restore();

  /* 阶段氛围（策划案 8.1 / 8.9）：桥下压成更深的紫黑，茶会只略微提亮 */
  if(game.state === 'play' || game.state === 'pause'){
    if(game.phaseId === 'PH03' || game.phaseId === 'PH04'){
      /* 场景层已经把 SC04/SC05 压深了，这里只补 0.10，避免叠成一片黑 */
      ctx.fillStyle = 'rgba(16,7,32,0.10)';
      ctx.fillRect(VIEW.x0, VIEW.y0, VIEW.w, VIEW.h);
    } else if(game.phaseId === 'PH06'){
      ctx.fillStyle = 'rgba(255,234,204,0.10)';
      ctx.fillRect(VIEW.x0, VIEW.y0, VIEW.w, VIEW.h);
    }
  }
}

function render(dt){
  const _dt = dt || 0.0167;
  ctx.save();
  /* v1.3.1：backing 跟容器走；世界按 game.core 的核心矩形映射。
     WB21：核心矩形只是**战斗坐标系**，背景不再被它裁住 ——
     先把可见范围换算成世界坐标（setView），背景整幅连画，
     战斗对象再单独裁进 480×270。 */
  const stEl = document.getElementById('stage');
  const stW = stEl ? (stEl.clientWidth || 1) : W;
  const stH = stEl ? (stEl.clientHeight || 1) : H;
  const bk = cv.width / stW;                 /* backing / CSS */
  const core = game.core || { x: 0, y: 0, w: stW, h: stH };
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0b0716';
  ctx.fillRect(0, 0, cv.width, cv.height);
  const ws = (core.w / W) * bk;
  ctx.setTransform(ws, 0, 0, ws, core.x * bk, core.y * bk);
  setView(core, stW, stH);

  /* 震屏只在战斗进行时生效。暂停 / 结算 / 标题状态下 update 不跑、
     shake 不会衰减，主循环却还在每帧 render —— 带着 shake 随机平移就会
     让整张背景一直抖（失败后回主页「界面一直闪」就是这个）。 */
  const shakeLive = game.state === 'play' && game.shake > 0;
  const sx = shakeLive ? Math.round(rand(-game.shake, game.shake)) : 0;
  const sy = shakeLive ? Math.round(rand(-game.shake, game.shake)) : 0;

  /* ---- ① 背景：按整个可见范围连续绘制（同一相机、缩放、时间、视差） ---- */
  ctx.save();
  ctx.beginPath();
  ctx.rect(VIEW.x0, VIEW.y0, VIEW.w, VIEW.h);
  ctx.clip();
  ctx.translate(sx, sy);
  drawBackground(game.t);
  ctx.restore();

  /* ---- ② 战斗对象：只画在 480×270 逻辑区里，不复制到两侧 ---- */
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.clip();
  ctx.translate(sx, sy);
  drawPickups();
  enemies.forEach(drawEnemy);
  /* WB05 图层：绽放装饰与命中组都在「敌方预兆 / 敌弹 / 重球 / 吐息冲撞提示」之下，
     HUD 之上没有任何装饰。装饰只服务角色，不许抢危险提示的位置。 */
  drawBloomDecor();
  drawBloomHitFx();
  drawEnemyTell();           // 灯芯变亮 / 鼓腮 / 俯冲锁定线
  drawOrbs();                // 重雾球
  drawFx('back');            // Boss 击破碎块留在原位置
  drawBoss();
  drawBossWeakPoint();       // 弱点窗口的口部金色断环（WB04）
  drawBossTell();            // 三招预兆：缺口 / 吐息带 / 冲撞航道
  drawBullets();
  ctx.restore();

  /* ---- ②b 主角与她自己的前景特效：允许压到延伸区上 ----
     立绘是 150×147 的裁剪框、以 player.x 为中心（左右各 37.5 世界像素），
     玩家贴到 x=0 时扫把会被核心矩形切掉一截 —— 手机截图里「最左侧扫把不全」就是这个。
     手机横屏的延伸区有 55~82 世界像素，足够她整幅画完，所以这一层只到画布边为止。
     16:9（桌面）延伸区为 0，效果与原来完全一致。 */
  ctx.save();
  ctx.translate(sx, sy);
  /* 暂停 / 结算时传 0：角色动画由有效游戏时钟推进，画面真的静止 */
  drawPlayer(game.state === 'play' ? _dt : 0);
  drawFx('front');           // 焰流 / 电弧盖在角色之上
  ctx.restore();

  /* ---- ②c 粒子与灯灵：仍限制在核心内，不往延伸区撒 ---- */
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.clip();
  ctx.translate(sx, sy);
  drawParticles();
  drawLampWisps();           // 收回来的那点灯，飘走时盖在特效之上
  ctx.restore();

  /* ---- ③ 全屏氛围：闪白与暗角铺满整个可见范围，不分区处理 ---- */
  /* 闪白同理：只属于战斗中的受伤/击破反馈，不在暂停/结算/标题上常亮 */
  if(game.flash > 0 && game.state === 'play'){
    ctx.globalAlpha = clamp(game.flash, 0, 1)*0.6;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(VIEW.x0, VIEW.y0, VIEW.w, VIEW.h);
    ctx.globalAlpha = 1;
  }
  drawAtmos();

  /* ---- ④ HUD / 飘字：属于战斗坐标系，仍只画在核心内 ---- */
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.clip();
  if(game.state === 'play' || game.state === 'pause') drawHUD();
  if(game.dbg) drawDebugOverlay();
  drawPopups();
  ctx.restore();
  ctx.restore();
}

/* ======================= 10.5 碰撞调试叠加层（F1 / `） =======================
   所有半径直接取自判定代码里的常量，改数值这里会自动跟着变：
     玩家受击   HIT_R_EBULLET = 12       （敌弹 vs 玩家，单圆）
     敌弹视觉   b.r = 3                  （只是画出来的大小）
     我方弹 vs 小怪  en.r = 15
     我方弹 vs Boss  r = 26 / 34
     玩家 vs 小怪接触 19                 （以怪物中心为圆心）
     水晶折射   11      水晶拾取 18
     道具拾取   star 23 / cup 20 / 其它 18
   ========================================================================= */
const DBG_C = {
  hurt:   '#5FE8FF',   // 玩家受击
  hit:    '#FF5A6E',   // 敌方被击
  touch:  '#FFA63A',   // 接触伤害
  pick:   '#6BFF9E',   // 拾取
  refract:'#E05AFF',   // 水晶折射
  bullet: '#FFE24D',   // 敌弹实体
  ink:    'rgba(150,170,200,0.85)'   // 立绘墨迹框
};

function dbgCircle(x, y, r, col, fillA){
  if(r <= 0) return;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI*2);
  if(fillA){
    ctx.globalAlpha = fillA; ctx.fillStyle = col; ctx.fill(); ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = col; ctx.lineWidth = 0.5; ctx.stroke();
}
function dbgBox(x, y, w, h, col){
  if(w <= 0 || h <= 0) return;
  ctx.strokeStyle = col; ctx.lineWidth = 0.5;
  ctx.strokeRect(x + 0.25, y + 0.25, w - 0.5, h - 0.5);
}
function dbgCross(x, y, col, s){
  s = s || 2;
  ctx.fillStyle = col;
  ctx.fillRect(x - s, y - 0.5, s*2, 1);
  ctx.fillRect(x - 0.5, y - s, 1, s*2);
}
/* 按 drawFit 的同一套换算，把立绘墨迹框还原到逻辑坐标 */
function dbgInk(key, cx, cy, maxH, scale){
  const im = ART[key];
  if(!im || !im.ink) return;
  const s = (maxH * (scale || 1)) / im.naturalHeight;
  const w = im.naturalWidth * s, h = im.naturalHeight * s;
  const x = cx - w*0.5, y = cy - h*0.5;
  const k = im.ink;
  dbgBox(x + k[0]*w, y + k[1]*h, (k[2]-k[0])*w, (k[3]-k[1])*h, DBG_C.ink);
}

function drawDebugOverlay(){
  const t = game.t;
  ctx.save();

  /* ---------- 玩家 ---------- */
  if(!player.dead){
    const clip = HERO_CLIPS[heroAnim.name] || HERO_CLIPS.flight;
    const A = HERO_ANIM[clip.kind];
    if(A && A.img.complete && A.img.naturalWidth){
      const dw = A.w*0.5, dh = A.h*0.5;
      dbgBox(player.x - dw*0.5, player.y - dh*0.5, dw, dh, DBG_C.ink);
      dbgCross(player.x + HERO_MUZZLE.dx, player.y + HERO_MUZZLE.dy, DBG_C.bullet, 2.5);
    }
    dbgCircle(player.x, player.y, HIT_R_PLAYER, DBG_C.hurt, 0.10);
    dbgCross(player.x, player.y, DBG_C.hurt, 2.5);
  }

  /* ---------- 小怪：受弹半径 11 ---------- */
  for(let i=0;i<enemies.length;i++){
    const e = enemies[i];
    const cx = e.x + e.w*0.5, cy = e.y + e.h*0.5;
    dbgInk(ENEMY_ART[e.kind] || 'bat', cx, cy, e.h*1.42, 1);
    dbgCircle(cx, cy, RR_ENEMY, DBG_C.hit, 0.10);
    dbgCircle(cx, cy, HIT_R_TOUCH, DBG_C.touch, 0);
    dbgCross(cx, cy, DBG_C.hit, 2);
  }

  /* ---------- Boss ---------- */
  if(boss){
    const cx = boss.x + boss.w*0.5, cy = boss.y + boss.h*0.5;
    const rr = (boss.id === 'b1') ? RR_MID : RR_BOSS;
    dbgInk(boss.id === 'b1' ? 'boss1' : 'boss2', cx, cy, boss.h, 1.15);
    dbgCircle(cx, cy, rr, DBG_C.hit, 0.08);
    dbgCircle(cx, cy, HIT_R_BOSS_TOUCH, DBG_C.touch, 0);
    dbgCross(cx, cy, DBG_C.hit, 3);
  }

  /* ---------- 重雾球：受弹半径 10 ---------- */
  for(let i=0;i<orbs.length;i++){
    const o = orbs[i];
    dbgCircle(o.x, o.y, RR_ORB, DBG_C.hit, 0.10);
    dbgCircle(o.x, o.y, HIT_R_PLAYER + o.r, DBG_C.hurt, 0);
    dbgCross(o.x, o.y, DBG_C.hit, 2);
  }

  /* ---------- 敌弹 ---------- */
  for(let i=0;i<ebullets.length;i++){
    const b = ebullets[i];
    dbgCircle(b.x, b.y, b.r || 3, DBG_C.bullet, 0.55);
  }

  /* ---------- 爆裂范围 ---------- */
  for(let i=0;i<BURSTS.length;i++){
    const b = BURSTS[i];
    dbgCircle(b.x, b.y, BURST_R, DBG_C.bullet, 0.10);
    dbgCross(b.x, b.y, DBG_C.bullet, 2);
  }

  /* ---------- 道具：拾取半径 ---------- */
  for(let i=0;i<pickups.length;i++){
    const p = pickups[i];
    const R = (p.type === 'fly') ? FLY_GRAB : (p.type === 'cup' ? 20 : 18);
    dbgCircle(p.x, p.y, R, DBG_C.pick, 0.06);
    dbgCross(p.x, p.y, DBG_C.pick, 1.5);
  }

  ctx.restore();
}

/* ============================ 11. 流程控制 ============================ */

const sc = {
  title: document.getElementById('scTitle'),
  pause: document.getElementById('scPause'),
  win:   document.getElementById('scWin'),
  lose:  document.getElementById('scLose'),
  rank:  document.getElementById('scRank')
};
function showScreen(name){
  Object.keys(sc).forEach(function(k){ sc[k].classList.toggle('on', k === name); });
  if(name === 'pause') syncMagicCards();      // 每次打开暂停页都对齐当前魔法
  /* 面板打开时收起触控层（16.4）：摇杆与技能键在暂停 / 结算里没有意义，
     留着还会挡住「继续」这类按钮的点击。 */
  document.body.classList.toggle('menu', !!name);
  /* #scTitle 刚从 display:none 变成 flex 时才有真实高度，量一次重排 */
  if(name === 'title') fitTitle();
}
function startGame(){
  /* v1.12.0（D15）：试听（StarLoop.demo）与正式技能循环分开管理 ——
     开始 / 重开 / 回标题都把试听收干净，别让它带着 demo 标记进战场。 */
  if(typeof StarLoop !== 'undefined' && StarLoop && StarLoop.demo) StarLoop.stop();
  document.body.classList.remove('paused');
  Audio7.init(); Audio7.resume();
  restartArmedAt = 0;
  clearInputs();
  clearToast();
  resetWorld();
  game.state = 'play';
  showScreen(null);
  STING.stop();
  stopMusic(); Audio7.mode = 'normal'; startMusic();
}
/* 暂停 / 恢复都清空输入（16.8）：
   暂停时按住的方向键与触点不会在恢复后继续生效，恢复必须由新输入重新驱动。 */
function pauseGame(){
  StarLoop.stop();                        /* 暂停先收声，恢复再起 */
  if(game.state !== 'play') return;
  game.state = 'pause';
  document.body.classList.add('paused');
  clearInputs();
  showPauseHelp(false);
  const cf = document.getElementById('pzConfirm');
  if(cf) cf.hidden = true;
  syncPauseCard();
  showScreen('pause');
  /* 焦点落在继续按钮；不影响鼠标党的视觉（只对键盘导航生效） */
  setTimeout(function(){
    const r = document.getElementById('btnResume');
    if(r){ try { r.focus({ preventScroll:true }); } catch(e){} }
  }, 0);
  stopMusic();
}
/* v1.3.1 §4.5：暂停时 Tab 只在当前视图内循环，不跑到背后的游戏/其它面板 */
function trapPauseTab(shift){
  const confirm = document.getElementById('pzConfirm');
  const help = document.getElementById('pzHelp');
  let root = document.getElementById('pzMain');
  if(confirm && !confirm.hidden) root = confirm;
  else if(help && !help.hidden) root = help;
  if(!root) return;
  const list = Array.prototype.slice.call(root.querySelectorAll('button'))
    .filter(function(el){ return el.offsetParent !== null && !el.disabled; });
  if(!list.length) return;
  const cur = document.activeElement;
  let i = list.indexOf(cur);
  if(i < 0) i = shift ? 0 : -1;
  const next = (i + (shift ? -1 : 1) + list.length) % list.length;
  try { list[next].focus({ preventScroll:true }); } catch(e){}
}

/* ---- v1.3.1 暂停菜单：说明子视图与确认层 ---- */
let _pauseConfirmAction = null;
function openPauseConfirm(act){
  _pauseConfirmAction = act;
  const box = document.getElementById('pzConfirm');
  const txt = document.getElementById('pzConfirmTxt');
  if(txt) txt.textContent = (act === 'home') ? '返回标题会结束本局，确定吗？' : '重新开始这一局？';
  if(box) box.hidden = false;
  clearInputs();
  /* 同步聚焦「取消」：文档要求默认焦点在取消 */
  const no = document.getElementById('btnConfirmNo');
  if(no){ try { no.focus({ preventScroll:true }); } catch(e){} }
}
function closePauseConfirm(){
  _pauseConfirmAction = null;
  const box = document.getElementById('pzConfirm');
  if(box) box.hidden = true;
  clearInputs();
  const r = document.getElementById('btnResume');
  if(r){ try { r.focus({ preventScroll:true }); } catch(e){} }
}
function showPauseHelp(on){
  const main = document.getElementById('pzMain');
  const help = document.getElementById('pzHelp');
  if(help) help.hidden = !on;
  if(main) main.hidden = on;
  clearInputs();
  const f = on ? document.getElementById('btnHelpBack') : document.getElementById('btnHelp');
  if(f){ try { f.focus({ preventScroll:true }); } catch(e){} }
}

/* 暂停卡片：阶段 / 时间 / 炉火库存 / 绽放能量与进度条 */
function syncPauseCard(){
  const set = function(id, v){
    const el = document.getElementById(id);
    if(el) el.textContent = v;
  };
  set('pzStage', PHASE_TABLE[game.phase] ? PHASE_TABLE[game.phase].cn : '湖畔夜巡');
  const sec = Math.floor(game.elapsed);
  set('pzTime', (sec < 10 ? '0' : '') + Math.floor(sec / 60) + ':' +
                (sec % 60 < 10 ? '0' : '') + (sec % 60));
  /* v1.3.1：暂停主菜单不再展示资源面板，只保留可选的关卡名与时间 */
}

function resumeGame(){
  document.body.classList.remove('paused');
  if(game.state !== 'pause') return;
  clearInputs();
  game.state = 'play';
  /* 暂停前还在绽放里：恢复时把循环乐接回来（不倒计时、不补偿） */
  if(player.bloomT > 0){ StarLoop.start(); duckBgm(0.42); }
  showScreen(null);
  Audio7.resume(); startMusic();
}
function showTitle(){
  if(typeof StarLoop !== 'undefined' && StarLoop && StarLoop.demo) StarLoop.stop();
  document.body.classList.remove('paused');
  game.state = 'title';
  game.titleAt = performance.now();
  /* 回主页必须清掉上一局的残留反馈：
     shake 在 update 停跑后不会自己衰减，而主循环仍在每帧 render，
     带着 shake 渲染就是「整张背景每帧随机平移」——看起来就是一直闪。
     flash 同理，会留一层常亮的白蒙。 */
  game.shake = 0;
  game.flash = 0;
  game.warnT = 0;
  game.teaBannerT = 0;
  clearInputs();
  clearToast();
  showScreen('title');
  stopMusic();
}

function bestScore(){
  let b = 0;
  try { b = parseInt(localStorage.getItem('lwf_best') || '0', 10) || 0; } catch(e){}
  return b;
}
function statRows(el){
  const best = bestScore();
  const rows = [
    ['得分', game.score],
    ['击破', game.kills],
    ['回收微光', game.motes],
    ['射击等级', 'L' + player.shotLv],
    ['萤火', game.fireflies + ' / ' + FLY_N],
    ['剩余生命', player.hp + ' / ' + player.maxHp],
    ['用时', Math.round(game.elapsed) + ' 秒'],
    /* 最高分只认成功记录：失败局不冒充刷新（11.2） */
    ['最高分', best]
  ];
  el.innerHTML = rows.map(function(r){
    return '<div class="row"><span>'+r[0]+'</span><span>'+r[1]+'</span></div>';
  }).join('');
}

/* ---- 胜利结算页（同构）：得分主视觉 + 击破/用时 + 详情折叠 ---- */
function fillWinScreen(){
  const set = function(id, v){
    const el = document.getElementById(id);
    if(el) el.textContent = v;
  };
  set('winStage', STAGE_NAME);
  set('winScore', String(game.score));
  set('winKills', String(game.kills));
  set('winTime', Math.max(1, Math.round(game.elapsed)) + ' 秒');
  set('wMotes', String(game.motes));
  set('wShot', 'L' + player.shotLv);
  set('wFly', game.fireflies + ' / ' + FLY_N);
  set('wHp', player.hp + ' / ' + player.maxHp);
  set('wBest', String(bestScore()));
  /* 只有真的刷新了纪录才亮牌（isRecord 在 endGame 里按写入前的最高分判定） */
  const rec = document.getElementById('winRecord');
  if(rec) rec.hidden = !game.isRecord;
  const det = document.getElementById('winDetail');
  const btn = document.getElementById('btnWinDetail');
  if(det) det.hidden = true;
  if(btn) btn.setAttribute('aria-expanded', 'false');
}

/* ---- 失败结算页（新版）：默认只读三项，其余收进「本局详情」 ---- */
function fillLoseScreen(){
  const set = function(id, v){
    const el = document.getElementById(id);
    if(el) el.textContent = v;
  };
  const best = bestScore();
  set('loseStage', STAGE_NAME);
  set('loseScore', String(game.score));
  set('loseKills', String(game.kills));
  /* 用时至少显示 1 秒：0.4 秒摔下去写「0 秒」很怪 */
  set('loseTime', Math.max(1, Math.round(game.elapsed)) + ' 秒');
  /* 详情里才有的四项 */
  set('dMotes', String(game.motes));
  set('dShot', 'L' + player.shotLv);
  set('dBloom', 'LV' + game.bloomMaxLv);
  set('dFly', game.fireflies + ' / ' + FLY_N);
  /* 失败局不会刷新最高分（11.2），这里只显示历史值，不写「新纪录」 */
  set('dBest', String(best));
  /* 每次进结算都收回详情，避免上一局展开着带进来 */
  const det = document.getElementById('loseDetail');
  const btn = document.getElementById('btnDetail');
  if(det) det.hidden = true;
  if(btn) btn.setAttribute('aria-expanded', 'false');
}

/* ======================= 11.9 全服夜巡名册（排行榜） =======================
   只读视图。数据由 src/toy-bridge.js 暴露的 window.ToyRank 提供：
     window.ToyRank = { available, load(period) -> {items, mine} }
   没有 Toy SDK（普通浏览器 / 单文件版）时整页退化成「未接通」说明：
   不编造名单、不发任何请求、也不影响游戏本体。
   排行榜额度是「同一个 Toy 的所有玩家共享」，所以只做手动刷新 + 会话内缓存，
   绝不 setInterval 轮询。 */
var RANK_LIMIT = 20;
var rankPeriod = 'all';
var rankReturn = 'title';          /* 关闭后回到哪一页 */
var rankData = {};                 /* period -> {items, mine} */
var rankSeq = 0;                   /* 只认最后一次请求，防止切页签时旧结果覆盖新结果 */
var rankNoteDefault = '';

function rankScreenOpen(){
  return !!sc.rank && sc.rank.classList.contains('on');
}
function rankApi(){
  return (typeof window.ToyRank === 'object' && window.ToyRank) ? window.ToyRank : null;
}
function openRank(from){
  /* 战斗中不弹名册：暂停页没入口，键盘/触屏更不该半路打断 */
  if(game.state === 'play') return;
  rankReturn = (from === 'win' || from === 'lose') ? from : 'title';
  rankPeriod = 'all';
  var kick = document.getElementById('rkStage');
  if(kick) kick.textContent = STAGE_NAME;
  showScreen('rank');
  syncRankTabs();
  /* 通关页进来时最高分可能刚变，强制取一次；其余情况先用会话缓存 */
  loadRank(from === 'win');
}
function closeRank(){
  showScreen(rankReturn);
}
function syncRankTabs(){
  var tabs = document.querySelectorAll('#rkTabs .rkTab');
  for(var i = 0; i < tabs.length; i++){
    var on = tabs[i].getAttribute('data-period') === rankPeriod;
    tabs[i].classList.toggle('on', on);
    tabs[i].setAttribute('aria-selected', on ? 'true' : 'false');
  }
}
function setRankPeriod(p){
  if(!p || p === rankPeriod) return;
  rankPeriod = p;
  syncRankTabs();
  loadRank(false);
}
function setRankMine(mine){
  var el = document.getElementById('rkMine');
  if(!el) return;
  el.textContent = '';
  if(!mine){ el.textContent = '—'; return; }
  /* 是否上榜只认 ranked：分数允许为 0 / 负数，不能拿 score 判断 */
  if(!mine.ranked){ el.textContent = '暂未上榜'; return; }
  el.appendChild(document.createTextNode('第 ' + mine.rank + ' 名 · '));
  var em = document.createElement('em');
  em.textContent = String(mine.score);
  el.appendChild(em);
  el.appendChild(document.createTextNode(' 分'));
}
function rankState(title, lines){
  var box = document.createElement('div');
  box.className = 'rkState';
  var b = document.createElement('b');
  b.textContent = title;
  box.appendChild(b);
  (lines || []).forEach(function(t){
    var s = document.createElement('small');
    s.textContent = t;
    box.appendChild(s);
  });
  return box;
}
function rankSkeleton(){
  var frag = document.createDocumentFragment();
  for(var i = 0; i < 5; i++){
    var line = document.createElement('div');
    line.className = 'rkSkel';
    var no = document.createElement('i');
    var ava = document.createElement('i'); ava.className = 'c';
    var name = document.createElement('i');
    var score = document.createElement('i'); score.className = 's';
    line.appendChild(no); line.appendChild(ava); line.appendChild(name); line.appendChild(score);
    frag.appendChild(line);
  }
  return frag;
}
/* 一行：名次 / 头像 / 昵称 / 分数。昵称一律 textContent，绝不拼进 innerHTML */
function rankRowEl(item){
  var row = document.createElement('div');
  row.className = 'rkRow' + ((item.rank | 0) >= 1 && (item.rank | 0) <= 3 ? ' top' : '');

  var no = document.createElement('span');
  var r = item.rank | 0;
  no.className = 'rkNo' + (r >= 1 && r <= 3 ? ' m' + r : '');
  no.textContent = String(item.rank);
  row.appendChild(no);

  var ava = document.createElement('span');
  ava.className = 'rkAva';
  if(item.avatar){
    var img = document.createElement('img');
    img.alt = '';
    img.loading = 'lazy';
    img.addEventListener('error', function(){ img.remove(); ava.textContent = '✦'; });
    img.src = item.avatar;
    ava.appendChild(img);
  } else {
    ava.textContent = '✦';
  }
  row.appendChild(ava);

  var name = document.createElement('span');
  name.className = 'rkName';
  name.textContent = item.nickname || '匿名夜行者';
  row.appendChild(name);

  var score = document.createElement('span');
  score.className = 'rkScore';
  score.textContent = String(item.score);
  var unit = document.createElement('i');
  unit.textContent = '分';
  score.appendChild(unit);
  row.appendChild(score);

  return row;
}
function paintRank(data){
  var list = document.getElementById('rkList');
  if(!list) return;
  var card = list.closest('.rkCard'); if(card) card.classList.remove('off');
  list.textContent = '';
  var note = document.getElementById('rkNote');
  if(note && rankNoteDefault) note.textContent = rankNoteDefault;
  setRankMine(data && data.mine);
  var items = (data && data.items) || [];
  if(!items.length){
    list.appendChild(rankState('名册还是空的', [
      '通关第一关并刷新最高分，',
      '就会成为名册上的第一条记录。'
    ]));
    return;
  }
  var frag = document.createDocumentFragment();
  items.forEach(function(item){ frag.appendChild(rankRowEl(item)); });
  list.appendChild(frag);
}
function paintRankOffline(){
  var list = document.getElementById('rkList');
  if(!list) return;
  var card = list.closest('.rkCard'); if(card) card.classList.add('off');
  list.textContent = '';
  setRankMine(null);
  var best = bestScore();
  list.appendChild(rankState('名册还没接通', [
    '全服名册在 B站 App 内打开并登录后可见；',
    '当前环境没有可用的 Toy 排行服务。',
    best > 0 ? ('这台设备上的最高分是 ' + best + ' 分。') : '先通关一局，留下你的最高分。'
  ]));
  var note = document.getElementById('rkNote');
  if(note) note.textContent = '排行榜由 Toy 平台提供（getRankList / getMyRank），本地单文件版不联网，所以只能显示本机最高分。';
}
function paintRankError(err){
  var list = document.getElementById('rkList');
  if(!list) return;
  var card = list.closest('.rkCard'); if(card) card.classList.remove('off');
  list.textContent = '';
  setRankMine(null);
  var limited = !!err && String(err.type) === 'http_error' && String(err.code) === '307044';
  list.appendChild(rankState(limited ? '查得有点急' : '名册没取到', limited
    ? ['同一 Toy 的玩家共享查询额度，', '歇一会儿再点「刷新」试试。']
    : ['稍后再点「刷新」；', '若一直失败，可能是还没登录 B站 账号。']));
}
function loadRank(force){
  var list = document.getElementById('rkList');
  if(!list) return;
  var cached = rankData[rankPeriod];
  if(cached && !force){ paintRank(cached); return; }

  rankSeq++;
  var seq = rankSeq;
  list.textContent = '';
  list.appendChild(rankSkeleton());
  setRankMine(null);

  var api = rankApi();
  if(!api || !api.available){ paintRankOffline(); return; }

  api.load(rankPeriod).then(function(res){
    if(seq !== rankSeq) return;          /* 期间切了页签：丢掉旧结果 */
    rankData[rankPeriod] = res || { items: [], mine: null };
    paintRank(rankData[rankPeriod]);
  }).catch(function(err){
    if(seq !== rankSeq) return;
    paintRankError(err);
  });
}

(function bindRankUI(){
  var note = document.getElementById('rkNote');
  if(note) rankNoteDefault = note.textContent;
  function on(id, fn){
    var el = document.getElementById(id);
    if(!el) return;
    el.addEventListener('click', function(e){
      e.preventDefault(); e.stopPropagation(); fn();
    });
  }
  on('btnRank', function(){ openRank('title'); });
  on('btnRankWin', function(){ openRank('win'); });
  on('btnRankLose', function(){ openRank('lose'); });
  on('btnRankClose', closeRank);
  on('btnRankRefresh', function(){ loadRank(true); });
  var tabs = document.getElementById('rkTabs');
  if(tabs) tabs.addEventListener('click', function(e){
    var btn = e.target && e.target.closest ? e.target.closest('.rkTab') : null;
    if(btn) setRankPeriod(btn.getAttribute('data-period'));
  });
  /* 点卡片外的暗底也能关：名册是只读浮层，不担心里面丢东西。
     顺手截住冒泡 —— #stage 上挂着「点空白=开始游戏」，不拦的话点页签会把玩家
     直接扔进战斗（state 还是 title 时）。 */
  if(sc.rank) sc.rank.addEventListener('click', function(e){
    e.stopPropagation();
    if(e.target === sc.rank) closeRank();
  });
})();

function endGame(won, reason){
  document.body.classList.remove('paused');
  if(game.state !== 'play') return;
  game.state = won ? 'win' : 'lose';
  game.endAt = performance.now();
  if(!won) game.failReason = reason || '';
  else {
    // 成功剩余生命奖励：每颗 150，只结算一次（策划案 12.1）
    if(!game.lifeBonusGiven){
      game.lifeBonusGiven = true;
      game.score += Math.max(0, player.hp) * 150;
    }
  }
  stopMusic();
  /* 最高成功分只在成功时更新，失败不写（策划案 11.2）。
     isRecord 用「写入前」的最高分判定，结算页据此决定要不要亮「新纪录」。 */
  game.isRecord = false;
  if(won){
    try {
      const b = bestScore();
      if(game.score > b){
        game.isRecord = true;
        localStorage.setItem('lwf_best', String(game.score));
      }
    } catch(e){}
  }
  /* v1.3.1：失败与结算都清掉在途火种，避免动效落在已消失的按钮上 */
  clearFireWisps();
  /* 结算音乐：优先播放生成的短曲，解码失败再退回合成琶音 */
  STING.stop();
  const stingOk = STING.play(won ? 'win' : 'lose');
  if(won){ if(!stingOk) SFX.win(); fillWinScreen(); showScreen('win'); }
  else   {
    if(!stingOk) SFX.lose();
    /* 新版失败页：得分 / 击破 / 用时三项主视觉，其余收进详情。
       不再把本局截图铺成整页背景 —— 新设计要「月夜背景 + 角色 + 文字」三层，
       截图会盖掉背景层；角色已经由背景插画承担。 */
    fillLoseScreen();
    showScreen('lose');
  }
}

/* V08：失败结算不再用另一张 AI 插画，直接把「这一局怎么结束的」那两帧拍下来
   当背景 —— 角色、帽子、蓝结、体型一定是同一个，暗部也不用再猜身体细节。 */
let _loseShot = 0;
function captureLoseBackdrop(){
  const id = ++_loseShot;
  /* 结算背景要的是「她倒下的那一刻」，不是那一刻正在飞的分数字。
     飘字和没结算完的临时特效先清掉，否则会被永远定格在插画上。 */
  popups.length = 0;
  const grab = function(){
    if(id !== _loseShot) return;
    try{
      const url = cv.toDataURL('image/webp', 0.86);
      const el = document.getElementById('scLose');
      if(el){
        el.style.backgroundImage =
          'linear-gradient(180deg, rgba(10,6,26,0.34) 0%, rgba(8,5,20,0.66) 56%, rgba(5,3,14,0.90) 100%), url(' + url + ')';
        el.style.backgroundSize = 'cover';
        el.style.backgroundPosition = 'center';
      }
    }catch(e){}
  };
  requestAnimationFrame(function(){ requestAnimationFrame(grab); });
}

/* ============================ 12. 主循环 ============================ */

let lastT = performance.now();
function loop(now){
  requestAnimationFrame(loop);
  let dt = (now-lastT)/1000; lastT = now;
  if(dt>0.05) dt = 0.05;
  update(dt);
  render(dt);
  syncHud();
}
requestAnimationFrame(loop);

/* ============================ 13. 自适应缩放 ============================ */

/* --- 调试模式：?auto=1&jumpto=秒 用于截图验证 --- */
(function(){
  try{
    if(typeof location==='undefined' || typeof URLSearchParams==='undefined') return;
    const q = new URLSearchParams(location.search || '');
    if(q.get('auto')==='1'){
      const jt = parseFloat(q.get('jumpto')||'0');
      if(game.state==='title') startGame();
      if(jt>0){
        const DT = 1/120;
        let steps = Math.round(jt/DT);
        for(let i=0;i<steps;i++){
          update(DT);
          // 简易 AI：正弦飞行
          Input.usingPointer = true;
          Input.pointerY = 135 + Math.sin(i/700)*80;
        }
      }
      render(0.0167);
    }
  }catch(e){ console.error(e); }
})();

/* 16:9 战斗核心等比映射到容器（contain）。
   WB21：核心之外不再是「补边带」—— 背景按可见范围继续画世界，
   setView() 把容器尺寸换算成世界坐标区间，各背景层只读 VIEW。 */
/* WB08：可用矩形按 VisualViewport 算（刘海、手势区、地址栏、分屏都会改它），
   拿不到时才退回 innerWidth/innerHeight。
   短边 600 分手机 / 平板两档，战斗核心都要 ≥384×216，用不到的余量只做背景延展。 */
function viewRect(){
  const vv = window.visualViewport;
  if(vv && vv.width > 0 && vv.height > 0){
    return { w: Math.round(vv.width), h: Math.round(vv.height),
             ox: Math.round(vv.offsetLeft || 0), oy: Math.round(vv.offsetTop || 0) };
  }
  return { w: window.innerWidth, h: window.innerHeight, ox: 0, oy: 0 };
}

/* WB24：开始页在矮横屏会「上下都超框」——
   窄屏是上下布局：立绘占 40% 高，剩下 60% 放标题/按钮/提示，
   而右侧那一列的自然高度（kicker+标题+按钮+副标题+按键图例+提示+试听）在 375 高时是 257px，
   行高只有 225px，底部溢出 32px；315 高时溢出 67px，直接切掉「收集微光…」那行。
   立绘那 6px 的帽子则是另一个原因（图片的百分比下边距按宽度算，被顶出框），已在 CSS 里修掉。
   这里按实测处理剩下的：先压缩立绘行（最多压到 22%），压到底还不够才把整列文案等比缩小。
   宽横屏（844×390 走左右双栏）不参与这套逻辑。 */
function fitTitle(){
  const side = document.querySelector('#scTitle .tsSide');
  if(!side) return;
  const rs = document.documentElement.style;
  if(!document.body.classList.contains('narrow')){
    rs.removeProperty('--tsArt');
    side.style.transform = 'none';
    return;
  }
  const fh = parseFloat(rs.getPropertyValue('--sh')) || (window.innerHeight || H) || H;
  /* 立绘是这一屏的主视觉，压到 30% 就打住；再不够就把文案列整体缩一点，
     宁可字小一档，也别把小女巫压成一张贴纸。 */
  const maxArt = Math.round(fh * 0.40), minArt = Math.round(fh * 0.30);
  /* 先按基准给立绘行，量出右侧真正需要多高（行高不够时 scrollHeight 才是内容高度） */
  rs.setProperty('--tsArt', maxArt + 'px');
  side.style.transform = 'none';
  const need = side.scrollHeight;
  if(need > fh - maxArt + 1){
    /* 留 8px 下边距：贴着舞台底边会显得被切了半行 */
    const art = Math.max(minArt, fh - need - 8);
    rs.setProperty('--tsArt', art + 'px');
    const left = fh - art;
    side.style.transform = (need > left + 1)
      ? 'scale(' + (left / need).toFixed(3) + ')' : 'none';
  }
}

let _fitW = 0, _fitH = 0, _tooSmall = false;
/* 进全屏 / 转屏的瞬间，可视区会连跳好几个尺寸，先静音 1.5s 再说 */
let _fitQuietUntil = 0;
function fit(){
  /* v1.3.1：桌面统一居中 16:9 gameFrame，1280×720 是 UI 设计基准。
     手机 / 平板仍按实际可用区铺满（安全区由 viewRect 扣掉）。 */
  const stage = document.getElementById('stage');
  /* WB20：舞台尺寸改按 **可见视口**（visualViewport）算，不再用 innerWidth/innerHeight。
     手机浏览器的地址栏 / 标签栏不算进布局视口，原来舞台比真正看得见的区域高一截：
     底部按钮被地址栏压住，可用高度一小，16:9 核心只能在中间挤成窄条，
     两侧补边带被撑到 150px 宽 —— 玩家截到的「拉扯的线」和「不是全屏」都是这一处。 */
  const vr0 = viewRect();
  const vw0 = vr0.w || 1280;
  const vh0 = vr0.h || 720;
  let fw, fh;
  if(coarsePointer){
    fw = vw0; fh = vh0;
  } else {
    fw = Math.min(vw0, vh0 * 16 / 9);
    fh = fw * 9 / 16;
  }
  if(stage){
    stage.style.width  = Math.round(fw) + 'px';
    stage.style.height = Math.round(fh) + 'px';
    /* 居中自己算：CSS 的 left:50% + translate(-50%,-50%) 只对布局视口居中，
       地址栏伸缩时 visualViewport 带 offsetTop，整块会偏到画面外一截。 */
    stage.style.left = Math.round(vr0.ox + (vw0 - fw) / 2) + 'px';
    stage.style.top  = Math.round(vr0.oy + (vh0 - fh) / 2) + 'px';
    stage.style.transform = 'none';
  }
  /* v1.12：窄屏判定看**舞台**，不看视口。
     之前用 @media (max-aspect-ratio:5/4)，而媒体查询算的是视口 ——
     桌面把 16:9 画面信箱居中时视口是方的（例如 1024×900），
     于是标题页被误判成竖屏、排成上下堆叠、按钮顶出画面。
     现在只有舞台本身窄（≤820 宽 或 宽高比 <5:4）才切 body.narrow。 */
  try {
    document.body.classList.toggle('narrow', fw <= 820 || (fh > 0 && fw / fh < 1.25));
    /* v1.12f：浮层（标题 / 结算 / 暂停）里所有 vmin、vh 都改成按**舞台**算。
       原来用视口单位：桌面把 16:9 画面居中后舞台只有 576 高，而 vmin 是 900 ——
       字号按 900 排，内容就顶出舞台，结算页的「再来一次」被切掉。 */
    const rs = document.documentElement.style;
    rs.setProperty('--svmin', Math.min(fw, fh).toFixed(1) + 'px');
    rs.setProperty('--sh', fh.toFixed(1) + 'px');
    rs.setProperty('--sw', fw.toFixed(1) + 'px');
  } catch(e){}
  /* UI 缩放基准：1280 宽对应 1.0；HUD/按钮/字号的 CSS 尺寸都乘这个值 */
  /* 手机/平板用固定触控尺寸，不跟桌面比例缩放 */
  const ui = coarsePointer ? 1 : (fw / 1280);

  /* v1.3.1 §2.3：世界 480×270 完整放进「上 72 / 下 104」留白后的核心矩形，
     水平居中；背景仍铺满整个 gameFrame。 */
  /* v1.3.2：场景铺满整个 16:9 游戏容器，UI 直接浮在场景上。
     桌面容器本来就是 16:9，core 等于全屏；
     手机/平板容器可能不是 16:9，这里按等比缩放居中（M01），
     否则 1024×768 会下方留空、844×390 会裁掉底部。 */
  let cw2 = fw, ch2 = fw * 9 / 16;
  if(ch2 > fh + 0.5){ ch2 = fh; cw2 = fh * 16 / 9; }
  game.core = { x: (fw - cw2) / 2, y: (fh - ch2) / 2, w: cw2, h: ch2 };
  /* WB20：核心矩形同步给 CSS —— HUD / 摇杆 / 技能键 / 暂停键都按它定位，
     否则它们会贴在 #stage 的边上、落进补边带，离战斗画面很远。 */
  try {
    const rsC = document.documentElement.style;
    rsC.setProperty('--coreX', Math.round(game.core.x) + 'px');
    rsC.setProperty('--coreY', Math.round(game.core.y) + 'px');
    rsC.setProperty('--coreW', Math.round(game.core.w) + 'px');
    rsC.setProperty('--coreH', Math.round(game.core.h) + 'px');
  } catch(e){}
  try { document.documentElement.style.setProperty('--ui', ui.toFixed(4)); } catch(e){}

  const r = viewRect();
  const vw = r.w, vh = r.h;
  const s = Math.min(vw/W, vh/H);
  /* WB11：HUD 字号要独立按 CSS 尺寸达标（常用 ≥12、关键数值 ≥14）。
     HUD 里最小的标签是 6.8 世界 px、关键数值是 7.8 世界 px，
     两者各按自己的目标反算，取大的那个，保证「标签 ≥12、数值 ≥14」。 */
  game.hudK = coarsePointer
    ? clamp(Math.max(12 / Math.max(0.001, 6.8 * s),
                     14 / Math.max(0.001, 7.8 * s)), 1, 1.7)
    : 1;
  const vp = document.getElementById('viewport');
  /* 铺满 gameFrame：世界 480×270 与 16:9 容器同比例，直接整幅映射 */
  vp.style.width  = '100%';
  vp.style.height = '100%';

  /* v1.3.1：画布 backing 跟容器走（原来固定 960×540，1280 宽时被拉伸发糊）。
     DPR 上限 2，避免 4K 屏把缓存撑爆。 */
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const bw = Math.round(fw * dpr), bh = Math.round(fh * dpr);
  const cvEl = document.getElementById('cv');
  if(cvEl && (cvEl.width !== bw || cvEl.height !== bh)){
    cvEl.width = bw; cvEl.height = bh;
  }
  /* 16.4：可用区不足就不进战斗。Aw<568 / Ah<280 / 战斗核心 <384×216 都算不够。
     WB23：门禁面板改成「一块、说人话、配小女巫」：
       · 竖着拿手机（短边≤560 且 高>宽）→「请使用横屏进行游玩」，不显示测量值；
       · 只是窗口太小（桌面拖窄）→「窗口太小啦」，保留测量值方便排查。
     竖屏判定放宽到「短边 ≤560」：有些 webview 不报 coarse pointer，
     但窗口是 375×632 这种窄竖条时，它显然就是手机。 */
  const coreW = W*s, coreH = H*s;
  const sizeBad = (vw < 568) || (vh < 280) || (coreW < 384) || (coreH < 216);
  const tall = (vh > vw * 1.02) && (coarsePointer || Math.min(vw, vh) <= 560);
  const gated = sizeBad || tall;
  const tsEl = document.getElementById('tooSmall');
  if(tsEl){
    const tsNum = document.getElementById('tsNum');
    const tsTtl = document.getElementById('tsTtl');
    const tsMsg = document.getElementById('tsMsg');
    tsEl.classList.toggle('on', gated);
    tsEl.classList.toggle('tall', tall);
    if(tsTtl) tsTtl.textContent = tall ? '请使用横屏进行游玩' : '窗口太小啦';
    if(tsMsg) tsMsg.textContent = tall
      ? '横过来才能握住摇杆和技能键呀'
      : '把窗口放大到 568×280 以上，或者切成横屏';
    if(tsNum){
      if(!gated || tall){
        /* 竖屏只给玩家一句话；没被拦下时也不留旧数字，
           免得下次拦截时先闪一帧过期的测量值。 */
        tsNum.hidden = true;
        tsNum.textContent = '';
      } else {
        tsNum.hidden = false;
        const why = (vw < 568) ? '可用宽度 ' + vw + ' < 568'
                  : (vh < 280) ? '可用高度 ' + vh + ' < 280'
                  : (coreW < 384) ? '战斗核心宽 ' + Math.round(coreW) + ' < 384'
                  : '战斗核心高 ' + Math.round(coreH) + ' < 216';
        tsNum.textContent = '当前可用区 ' + vw + '×' + vh +
          ' · 核心 ' + Math.round(coreW) + '×' + Math.round(coreH) + ' · ' + why;
      }
    }
  }
  if(gated !== _tooSmall){
    _tooSmall = gated;
    if(gated && game.state === 'play') pauseGame();
  }
  /* 界面字号按视口短边算，不跟 16:9 核心的 s 走 ——
     s 只反映画布缩放（1024 宽时是 2.13），跟着它算会让结算面板的字
     小到读不清。这里改成 vmin 的比例，各分辨率下观感一致。
     WB10：触屏档下限抬到 12px，暂停菜单的按钮与魔法卡才读得清、点得准。 */
  document.getElementById('overlay').style.fontSize =
    Math.max(coarsePointer ? 12 : 10, Math.min(vw, vh) * 0.022) + 'px';
  /* 提示条挂在 #viewport 里（跟着画布走），字号按画布缩放换算成世界 6.8 */
  const tEl = document.getElementById('toast');
  if(tEl) tEl.style.fontSize = Math.max(11, 6.8 * s) + 'px';
  placeToast();
  /* 触控 UI 用视口短边基准，不跟 stage 缩放走（见 CSS 注释） */
  updateRotate();
  /* 开始页的立绘行 / 文案列按舞台高度重新分配（矮横屏防上下超框） */
  fitTitle();
  /* 右上角声音按钮是 CSS 像素，右上角的分数是画布世界像素。
     视口越窄，按钮换算成世界像素就越宽；这里算出它占多少，
     交给 drawHUD 让分数往左让开，避免「分」被按钮压住。 */
  /* CH05：右上角现在是「暂停 + 声音」两个按钮，分数要让开整组宽度 */
  const snd = document.getElementById('sndBtn');
  const pau = document.getElementById('btnPause');
  let rightPx = 0, got = false;
  if(snd){ rightPx += (snd.getBoundingClientRect().width || 24); got = true; }
  if(pau && getComputedStyle(pau).display !== 'none'){
    rightPx += (pau.getBoundingClientRect().width || 44) + 8;
    got = true;
  }
  if(got) game.hudR = Math.round(rightPx / Math.max(0.0001, s)) + 10;
  /* 同横屏下尺寸变了（分屏、地址栏伸缩、旋转）也要统一暂停 + 清触点 */
  if(_fitW && (Math.abs(vw - _fitW) > 2 || Math.abs(vh - _fitH) > 2) && game.state === 'play'
     && Date.now() > _fitQuietUntil){
    pauseGame();
    flashMsg('画面尺寸变了，点继续', 1);
  }
  _fitW = vw; _fitH = vh;
}
window.addEventListener('resize', fit);
window.addEventListener('orientationchange', function(){ setTimeout(fit, 120); });
/* VisualViewport：地址栏伸缩、手势区变化、分屏改尺寸都会走这里（WB08） */
if(window.visualViewport){
  window.visualViewport.addEventListener('resize', fit);
  window.visualViewport.addEventListener('scroll', fit);
}
/* 开始页的关卡名与失败页同源（改关卡只改 STAGE_NAME） */
(function syncStageName(){
  const el = document.getElementById('tsStage');
  if(el) el.textContent = STAGE_NAME;
})();

/* 胜利页复用开始页那张角色图：data URI 只内联一次，运行时把 src 抄过去，
   否则单文件里同一张图会被打包两遍（多 300KB）。 */
(function shareWitchArt(){
  const a = document.getElementById('tsWitch');
  const b = document.getElementById('winWitch');
  if(a && b && !b.getAttribute('src')) b.src = a.src;
  /* WB23：竖屏提示面板的小女巫也复用这一张，别在单文件里再内联一份 */
  const c = document.getElementById('tsWitchTip');
  if(a && c && !c.getAttribute('src')) c.src = a.src;
})();

fit();
showScreen('title');

/* 音效试听面板：标题页右下角的「♪ 音效试听」按钮，或地址后加 ?audio=1 */
(function bindAudioTest(){
  const btn = document.getElementById('btnAudioTest');
  if(btn){
    btn.addEventListener('click', function(e){
      e.stopPropagation();
      Audio7.init(); Audio7.resume();
      initAudioTest();
    });
  }
  if(/[?&]audio=1/.test(location.search)) initAudioTest();
})();
