// 从当前游戏提取；独立试听时不连接游戏 BGM。
const Audio7 = {
  ac:null, master:null, musicGain:null, sfxGain:null, starGain:null, lim:null,
  sfxK:1,                         /* v1.12e：单次音效的归一系数（见 SFX_TRIM） */
  volK:1,                         /* v1.12f：总音量系数（0~1），音效走 master，音乐走 BGM.applyVol() */
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


function duckBgm(){}
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

window.WitchAudio={Audio7,SFX,StarLoop,scheduleMusic};
