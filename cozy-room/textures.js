// 程序化贴图：所有画面（城市夜景、显示器、电视、海报、地毯……）都用 Canvas 现画，无需外部图片
import * as THREE from 'three';

export function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const rand = rng(20261124);
export const rr = (a, b) => a + (b - a) * rand();
export const pick = (arr) => arr[Math.floor(rand() * arr.length)];

export function canvasTex(w, h, draw, { srgb = true, repeat = null } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.userData.ctx = g;
  return t;
}

export function rrect(g, x, y, w, h, r) {
  if (typeof r === 'number') r = [r, r, r, r];
  const [tl, tr, br, bl] = r;
  g.beginPath();
  g.moveTo(x + tl, y);
  g.arcTo(x + w, y, x + w, y + h, tr);
  g.arcTo(x + w, y + h, x, y + h, br);
  g.arcTo(x, y + h, x, y, bl);
  g.arcTo(x, y, x + w, y, tl);
  g.closePath();
}

// ---------- 材质纹理 ----------
export function woodTexture(base = '#7a4e2c', repeat = [1, 1]) {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) {
      const y = rand() * h, dark = rand() < 0.65;
      g.strokeStyle = dark ? `rgba(30,14,4,${rr(0.05, 0.22)})` : `rgba(255,220,180,${rr(0.03, 0.09)})`;
      g.lineWidth = rr(0.5, 3);
      g.beginPath();
      const ph = rand() * 10, amp = rr(1, 5);
      for (let x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x * 0.012 + ph) * amp);
      g.stroke();
    }
  }, { repeat });
}

export function noiseTexture(base, amount, repeat) {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const img = g.getImageData(0, 0, w, h);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (rand() - 0.5) * amount;
      img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
    }
    g.putImageData(img, 0, 0);
  }, { repeat });
}

// ---------- 窗外城市夜景 ----------
export function cityTexture() {
  return canvasTex(2048, 1024, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#04060c'); gr.addColorStop(0.5, '#0c1220'); gr.addColorStop(0.78, '#251f2c'); gr.addColorStop(1, '#3b2a24');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(255,255,255,${rr(0.1, 0.5)})`; g.fillRect(rand() * w, rand() * h * 0.4, 1.5, 1.5); }
    const layers = [
      { min: 280, max: 560, col: '#141a29', lit: 0.22, cx: 11, cy: 15, a: 0.5 },
      { min: 360, max: 760, col: '#0d111c', lit: 0.32, cx: 15, cy: 19, a: 0.85 },
      { min: 160, max: 430, col: '#07090f', lit: 0.3, cx: 20, cy: 25, a: 1 },
    ];
    const warm = ['#ffd27a', '#ffe2a8', '#ffc061', '#fff1d0', '#cfe0ff', '#ffb35c'];
    for (const L of layers) {
      let x = -30;
      while (x < w) {
        const bw = rr(60, 190), bh = rr(L.min, L.max), top = h - bh;
        g.fillStyle = L.col; g.fillRect(x, top, bw, bh);
        for (let wy = top + 10; wy < h - 8; wy += L.cy)
          for (let wx = x + 7; wx < x + bw - 9; wx += L.cx)
            if (rand() < L.lit) { g.fillStyle = pick(warm); g.globalAlpha = rr(0.35, 1) * L.a; g.fillRect(wx, wy, L.cx - 5, L.cy - 7); g.globalAlpha = 1; }
        if (rand() < 0.25) { g.fillStyle = '#ff3b30'; g.beginPath(); g.arc(x + bw / 2, top - 4, 3, 0, Math.PI * 2); g.fill(); }
        x += bw + rr(0, 24);
      }
    }
  });
}

// ---------- 显示器画面 ----------
export function monitorLeftTexture() {
  return canvasTex(1024, 576, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#5a6670'); gr.addColorStop(0.55, '#2b3238'); gr.addColorStop(1, '#101316');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const ridge = (base, amp, col, f) => {
      g.fillStyle = col; g.beginPath(); g.moveTo(0, h);
      for (let x = 0; x <= w; x += 8) g.lineTo(x, base + Math.sin(x * f) * amp + Math.sin(x * f * 3.7) * amp * 0.35);
      g.lineTo(w, h); g.closePath(); g.fill();
    };
    ridge(h * 0.45, 40, '#3c454c', 0.008); ridge(h * 0.58, 30, '#262c31', 0.013); ridge(h * 0.75, 18, '#15181b', 0.02);
    // 角色剪影
    g.fillStyle = '#0a0b0c';
    g.beginPath(); g.ellipse(w * 0.5, h * 0.47, 22, 26, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(w * 0.5 - 50, h * 0.9); g.lineTo(w * 0.5 - 38, h * 0.53); g.lineTo(w * 0.5 + 38, h * 0.53); g.lineTo(w * 0.5 + 62, h * 0.9); g.closePath(); g.fill();
    g.fillRect(w * 0.5 + 40, h * 0.5, 8, 150);
    // 雾
    const fog = g.createLinearGradient(0, h * 0.6, 0, h); fog.addColorStop(0, 'rgba(160,170,180,0)'); fog.addColorStop(1, 'rgba(160,170,180,.18)');
    g.fillStyle = fog; g.fillRect(0, 0, w, h);
    // HUD
    g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(30, 30, 260, 18); g.fillStyle = '#c8352c'; g.fillRect(32, 32, 190, 14);
    g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(30, 54, 200, 10); g.fillStyle = '#d9c27a'; g.fillRect(32, 56, 150, 6);
    g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 3; g.beginPath(); g.arc(w - 90, h - 90, 60, 0, Math.PI * 2); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.85)'; g.font = 'bold 26px Georgia, serif'; g.fillText('CHAPTER III', w - 230, 50);
  });
}

export function monitorRightTexture() {
  return canvasTex(1024, 576, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#7d0d0d'); gr.addColorStop(0.45, '#d8321b'); gr.addColorStop(0.75, '#ff8a2a'); gr.addColorStop(1, '#3a0d06');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,220,140,.9)'; g.beginPath(); g.arc(w * 0.68, h * 0.62, 70, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2a0805';
    g.beginPath(); g.moveTo(0, h); g.lineTo(0, h * 0.72); g.lineTo(140, h * 0.72); g.lineTo(170, h * 0.6); g.lineTo(300, h * 0.6); g.lineTo(330, h * 0.76);
    g.lineTo(700, h * 0.78); g.lineTo(740, h * 0.66); g.lineTo(880, h * 0.66); g.lineTo(910, h * 0.8); g.lineTo(w, h * 0.8); g.lineTo(w, h); g.closePath(); g.fill();
    // 骑马剪影
    g.fillStyle = '#120302'; const cx = w * 0.42, cy = h * 0.8;
    g.beginPath(); g.ellipse(cx, cy, 70, 30, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(cx + 55, cy - 10); g.lineTo(cx + 100, cy - 60); g.lineTo(cx + 118, cy - 52); g.lineTo(cx + 80, cy + 5); g.fill();
    g.lineWidth = 9; g.strokeStyle = '#120302';
    for (const dx of [-50, -30, 35, 55]) { g.beginPath(); g.moveTo(cx + dx, cy + 15); g.lineTo(cx + dx + (dx > 0 ? 10 : -6), cy + 75); g.stroke(); }
    g.beginPath(); g.moveTo(cx - 10, cy - 25); g.lineTo(cx - 5, cy - 95); g.lineTo(cx + 20, cy - 95); g.lineTo(cx + 15, cy - 25); g.fill();
    g.beginPath(); g.arc(cx + 6, cy - 112, 15, 0, Math.PI * 2); g.fill();
    g.fillRect(cx - 22, cy - 128, 58, 7);
    // 标题
    g.textAlign = 'center'; g.font = '900 92px Georgia, "Times New Roman", serif';
    g.lineWidth = 8; g.strokeStyle = '#2a0805'; g.strokeText('WILD WEST', w / 2, 120);
    g.fillStyle = '#fff2dc'; g.fillText('WILD WEST', w / 2, 120);
    g.font = 'bold 40px Georgia, serif'; g.fillStyle = '#ffd59a'; g.fillText('— II —', w / 2, 175);
  });
}

// ---------- 电视画面（每帧重绘：派对小游戏） ----------
export function createTVTexture() {
  const tex = canvasTex(1024, 576, () => {});
  const g = tex.userData.ctx, w = 1024, h = 576;
  const guys = [
    { c: '#ff5aa5', x: 0.22 }, { c: '#ffd23f', x: 0.4 }, { c: '#4ad3ff', x: 0.6 }, { c: '#7cf06b', x: 0.78 },
  ];
  tex.userData.draw = (t) => {
    const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#38b6ff'); sky.addColorStop(1, '#c6f0ff');
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff4b0'; g.beginPath(); g.arc(860, 90, 50, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,.95)';
    for (let i = 0; i < 4; i++) {
      const x = ((t * 28 + i * 320) % 1350) - 180, y = 70 + (i % 2) * 60;
      g.beginPath(); g.arc(x, y, 30, 0, 7); g.arc(x + 35, y - 12, 38, 0, 7); g.arc(x + 75, y, 28, 0, 7); g.fill();
    }
    g.fillStyle = '#6fd36b'; g.beginPath(); g.ellipse(250, h + 40, 420, 220, 0, 0, 7); g.fill();
    g.fillStyle = '#4fbf55'; g.beginPath(); g.ellipse(800, h + 60, 460, 240, 0, 0, 7); g.fill();
    // 转盘平台
    g.fillStyle = '#ff7b39'; g.beginPath(); g.ellipse(w / 2, h * 0.83, 400, 46, 0, 0, 7); g.fill();
    g.fillStyle = '#ffb36b'; g.beginPath(); g.ellipse(w / 2, h * 0.8, 400, 46, 0, 0, 7); g.fill();
    // 果冻小人
    guys.forEach((p, i) => {
      const bounce = Math.abs(Math.sin(t * 3.2 + i * 1.3)) * 70;
      const x = w * p.x + Math.sin(t * 1.5 + i) * 20, y = h * 0.72 - bounce;
      g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(x, h * 0.79, 34 - bounce * 0.15, 9, 0, 0, 7); g.fill();
      g.fillStyle = p.c; rrect(g, x - 32, y - 90, 64, 100, 32); g.fill();
      g.fillStyle = '#fff'; rrect(g, x - 22, y - 72, 44, 26, 13); g.fill();
      g.fillStyle = '#222'; g.beginPath(); g.arc(x - 8, y - 59, 5, 0, 7); g.arc(x + 8, y - 59, 5, 0, 7); g.fill();
    });
    g.textAlign = 'center'; g.font = '900 78px "Arial Black", Impact, sans-serif';
    g.lineWidth = 12; g.strokeStyle = '#7a2bd6'; g.strokeText('PARTY TIME!', w / 2, 210);
    g.fillStyle = '#ffe14d'; g.fillText('PARTY TIME!', w / 2, 210);
    g.textAlign = 'left'; g.font = 'bold 30px "Arial Black", sans-serif'; g.fillStyle = '#fff';
    g.fillText(`★ ${1200 + Math.floor(t * 7) % 800}`, 30, 50);
    tex.needsUpdate = true;
  };
  tex.userData.draw(0);
  return tex;
}

// ---------- 海报 ----------
export function posterTexture(kind) {
  return canvasTex(512, 700, (g, w, h) => {
    g.textAlign = 'center';
    if (kind === 'headphones') {
      g.fillStyle = '#1e1c1b'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#e9c79a'; g.lineWidth = 26; g.beginPath(); g.arc(w / 2, h * 0.48, 150, Math.PI, 0); g.stroke();
      for (const s of [-1, 1]) {
        g.fillStyle = '#e07a3c'; rrect(g, w / 2 + s * 150 - 55, h * 0.45, 110, 170, 50); g.fill();
        g.fillStyle = '#f2d2a8'; rrect(g, w / 2 + s * 150 - 35, h * 0.48, 70, 120, 32); g.fill();
      }
      g.fillStyle = '#e9c79a'; g.font = '900 52px "Arial Black", sans-serif'; g.fillText('SOUND ON', w / 2, h * 0.2);
    } else if (kind === 'vinyl') {
      g.fillStyle = '#0d0d0f'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#18181b'; g.beginPath(); g.arc(w / 2, h * 0.45, 200, 0, 7); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 2;
      for (let r = 80; r < 200; r += 7) { g.beginPath(); g.arc(w / 2, h * 0.45, r, 0, 7); g.stroke(); }
      g.fillStyle = '#d9342b'; g.beginPath(); g.arc(w / 2, h * 0.45, 62, 0, 7); g.fill();
      g.fillStyle = '#0d0d0f'; g.beginPath(); g.arc(w / 2, h * 0.45, 8, 0, 7); g.fill();
      g.fillStyle = '#f0e6d8'; g.font = 'bold 46px Georgia, serif'; g.fillText('VINYL NIGHTS', w / 2, h * 0.86);
    } else if (kind === 'cute') {
      g.fillStyle = '#bfe3f5'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#ff9db5'; g.beginPath(); g.arc(w / 2, h * 0.5, 150, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(w / 2 - 50, h * 0.47, 22, 0, 7); g.arc(w / 2 + 50, h * 0.47, 22, 0, 7); g.fill();
      g.fillStyle = '#333'; g.beginPath(); g.arc(w / 2 - 50, h * 0.47, 10, 0, 7); g.arc(w / 2 + 50, h * 0.47, 10, 0, 7); g.fill();
      g.fillStyle = '#ffe36e'; for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(rand() * w, rand() * h, rr(6, 14), 0, 7); g.fill(); }
    } else if (kind === 'gameover') {
      g.fillStyle = '#ff6fa8'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#2b0b1c'; g.font = '900 108px "Arial Black", Impact, sans-serif'; g.fillText('GAME', w / 2, 250); g.fillText('OVER', w / 2, 370);
      g.fillStyle = '#ffe14d'; const px = 22, hx = w / 2 - px * 3.5, hy = 450;
      ['0110110', '1111111', '1111111', '0111110', '0011100', '0001000'].forEach((row, j) => [...row].forEach((c, i) => c === '1' && g.fillRect(hx + i * px, hy + j * px, px - 2, px - 2)));
    } else if (kind === 'play') {
      g.fillStyle = '#3ccf91'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#123d2b'; rrect(g, 90, 300, 332, 170, 85); g.fill();
      g.fillStyle = '#3ccf91'; g.fillRect(150, 370, 70, 22); g.fillRect(174, 346, 22, 70);
      g.beginPath(); g.arc(340, 360, 16, 0, 7); g.arc(375, 395, 16, 0, 7); g.fill();
      g.fillStyle = '#123d2b'; g.font = '900 120px "Arial Black", Impact, sans-serif'; g.fillText('PLAY', w / 2, 210);
      g.font = 'bold 34px sans-serif'; g.fillText('PRESS START', w / 2, 590);
    } else if (kind === 'levelup') {
      g.fillStyle = '#ff4d3d'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#ffd23f'; g.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 70 : 160; g.lineTo(w / 2 + Math.cos(a) * r, 400 + Math.sin(a) * r); }
      g.closePath(); g.fill();
      g.fillStyle = '#fff'; g.font = '900 96px "Arial Black", Impact, sans-serif'; g.fillText('LEVEL', w / 2, 140); g.fillText('UP!', w / 2, 240);
    } else if (kind === 'sunset') {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2d1b4e'); gr.addColorStop(0.5, '#ff7a59'); gr.addColorStop(1, '#ffd29a');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = '#fff0c2'; g.beginPath(); g.arc(w / 2, h * 0.55, 110, 0, 7); g.fill();
      ['#3b2a5a', '#5a2f5f', '#7a3a5c'].forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.moveTo(0, h);
        for (let x = 0; x <= w; x += 8) g.lineTo(x, h * (0.66 + i * 0.1) + Math.sin(x * 0.02 + i) * 18); g.lineTo(w, h); g.fill(); });
    }
  });
}

// ---------- Switch 造型地毯 ----------
export function rugTexture() {
  return canvasTex(1024, 2048, (g, w, h) => {
    const r = 260, end = 420;
    g.fillStyle = '#18a9e0'; rrect(g, 0, 0, w, end + 40, [r, r, 0, 0]); g.fill();
    g.fillStyle = '#ff4a55'; rrect(g, 0, h - end - 40, w, end + 40, [0, 0, r, r]); g.fill();
    g.fillStyle = '#141414'; g.fillRect(0, end, w, h - end * 2);
    g.fillStyle = '#f5f1e8'; rrect(g, 70, end + 60, w - 140, h - end * 2 - 120, 20); g.fill();
    const dark = '#1c1c1e';
    // 蓝色手柄：摇杆 + 方向键
    g.fillStyle = dark; g.beginPath(); g.arc(w * 0.32, 200, 80, 0, 7); g.fill();
    g.fillStyle = '#2b2b2e'; g.beginPath(); g.arc(w * 0.32, 200, 52, 0, 7); g.fill();
    g.fillStyle = dark; for (const [dx, dy] of [[0, -62], [0, 62], [-62, 0], [62, 0]]) { g.beginPath(); g.arc(w * 0.68 + dx, 230 + dy, 30, 0, 7); g.fill(); }
    g.fillRect(w * 0.5 - 30, 90, 60, 14);
    // 红色手柄：ABXY + 摇杆
    for (const [dx, dy] of [[0, -62], [0, 62], [-62, 0], [62, 0]]) { g.beginPath(); g.arc(w * 0.32 + dx, h - 230 + dy, 30, 0, 7); g.fill(); }
    g.beginPath(); g.arc(w * 0.68, h - 200, 80, 0, 7); g.fill();
    g.fillStyle = '#2b2b2e'; g.beginPath(); g.arc(w * 0.68, h - 200, 52, 0, 7); g.fill();
    g.fillStyle = dark; g.fillRect(w * 0.5 - 30, h - 104, 60, 14); g.fillRect(w * 0.5 - 7, h - 127, 14, 60);
    // LOADING... 98%（沿长边书写）
    g.save(); g.translate(w / 2, h / 2); g.rotate(Math.PI / 2);
    g.fillStyle = '#141414'; g.textAlign = 'left'; g.font = '900 150px "Courier New", monospace';
    g.fillText('LOADING...', -520, -80);
    g.lineWidth = 22; g.strokeStyle = '#141414'; rrect(g, -520, 10, 1040, 150, 40); g.stroke();
    g.fillStyle = '#141414'; rrect(g, -496, 34, 1040 * 0.955 - 48, 102, 24); g.fill();
    g.font = '900 120px "Courier New", monospace'; g.fillText('98%', 260, -80);
    g.restore();
    // 绒毛质感
    for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${rand() < 0.5 ? '0,0,0' : '255,255,255'},${rr(0.02, 0.07)})`; g.fillRect(rand() * w, rand() * h, 3, 3); }
  });
}

// ---------- 冰箱内部 ----------
export function fridgeTexture() {
  return canvasTex(512, 820, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#f4fbff'); gr.addColorStop(1, '#cfe3f2');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const colors = ['#e63946', '#1d4ed8', '#16a34a', '#f59e0b', '#7c3aed', '#ec4899', '#0ea5e9', '#ef4444'];
    for (let row = 0; row < 4; row++) {
      const base = 190 + row * 195;
      g.fillStyle = 'rgba(120,150,170,.55)'; g.fillRect(0, base, w, 8);
      for (let x = 22; x < w - 50; x += 62) {
        const tall = row === 3 && rand() < 0.5, ch = tall ? 170 : 120;
        g.fillStyle = pick(colors); rrect(g, x, base - ch, 50, ch, tall ? 14 : 8); g.fill();
        g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(x + 8, base - ch + 14, 8, ch - 28);
        g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(x, base - ch + ch * 0.4, 50, 14);
      }
    }
    g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
  });
}

// ---------- 数字时钟 ----------
export function createClockTexture() {
  const tex = canvasTex(256, 112, () => {});
  const g = tex.userData.ctx;
  tex.userData.draw = () => {
    const d = new Date(), s = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
    g.fillStyle = '#0b0b0c'; g.fillRect(0, 0, 256, 112);
    g.fillStyle = '#ff9a3c'; g.font = 'bold 72px "Courier New", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(s, 128, 60);
    tex.needsUpdate = true;
  };
  tex.userData.draw();
  return tex;
}
