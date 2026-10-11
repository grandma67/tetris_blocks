// Visual effects: particle bursts, shockwaves, fireworks, screen shake,
// floating text and the ambient themed background. One RAF loop drives both
// canvases.

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

class Layer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
  }
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}

export class FX {
  constructor({ fxCanvas, ambientCanvas, shakeTarget, textLayer }) {
    this.fx = new Layer(fxCanvas);
    this.amb = new Layer(ambientCanvas);
    this.shakeTarget = shakeTarget;
    this.textLayer = textLayer;
    this.particles = [];
    this.rings = [];
    this.ambient = [];
    this.theme = null;
    this.last = performance.now();
    window.addEventListener('resize', () => {
      this.fx.resize();
      this.amb.resize();
      this.seedAmbient();
    });
    requestAnimationFrame((t) => this.loop(t));
  }

  setTheme(theme) {
    this.theme = theme;
    this.seedAmbient();
  }

  // ---------- Bursts ----------

  burst(x, y, color, count = 12, power = 1) {
    if (reduceMotion) count = Math.ceil(count / 3);
    const style = this.theme?.particles || { shape: 'square' };
    const emoji = style.shape === 'emoji';
    if (emoji) count = Math.ceil(count / 3);
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2);
      const speed = rand(120, 420) * power;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed - rand(60, 200) * power,
        life: 0,
        max: rand(0.6, 1.2) * (emoji ? 1.4 : 1),
        size: emoji ? rand(14, 26) : rand(3, 8) * Math.min(power, 1.8),
        color,
        shape: style.shape,
        emoji: emoji ? pick(style.emojis) : null,
        glow: style.glow,
        rot: rand(0, Math.PI * 2),
        vr: rand(-8, 8),
        g: 700,
      });
    }
  }

  shockwave(x, y, color, maxR = 220, width = 6) {
    this.rings.push({ x, y, r: 0, maxR, color, width, life: 0, max: 0.6 });
  }

  fireworks(colors, count = 6) {
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const x = rand(this.fx.w * 0.15, this.fx.w * 0.85);
        const y = rand(this.fx.h * 0.12, this.fx.h * 0.5);
        const c = pick(colors);
        this.burst(x, y, c, 40, 1.4);
        this.shockwave(x, y, c, 140, 3);
      }, i * 220);
    }
  }

  confetti(colors, count = 120) {
    if (reduceMotion) count = 30;
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: rand(0, this.fx.w),
        y: rand(-this.fx.h * 0.4, -10),
        vx: rand(-60, 60),
        vy: rand(80, 260),
        life: 0,
        max: rand(2.2, 3.5),
        size: rand(5, 10),
        color: pick(colors),
        shape: 'confetti',
        rot: rand(0, Math.PI * 2),
        vr: rand(-10, 10),
        g: 120,
      });
    }
  }

  // ---------- DOM effects ----------

  shake(intensity = 1) {
    if (reduceMotion || !this.shakeTarget) return;
    const el = this.shakeTarget;
    el.style.setProperty('--shake', `${Math.round(4 + intensity * 5)}px`);
    el.classList.remove('shake');
    void el.offsetWidth; // restart animation
    el.classList.add('shake');
  }

  floatText(text, x, y, cls = '') {
    const el = document.createElement('div');
    el.className = `float-text ${cls}`;
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    this.textLayer.appendChild(el);
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }

  flash() {
    const el = document.createElement('div');
    el.className = 'screen-flash';
    this.textLayer.appendChild(el);
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }

  // ---------- Ambient background ----------

  seedAmbient() {
    const mode = this.theme?.ambient || 'none';
    const n = reduceMotion ? 12 : mode === 'stars' ? 70 : 28;
    this.ambient = [];
    if (mode === 'none') return;
    for (let i = 0; i < n; i++) this.ambient.push(this.spawnAmbient(mode, true));
  }

  spawnAmbient(mode, initial) {
    const { w, h } = this.amb;
    const p = { x: rand(0, w), y: initial ? rand(0, h) : 0, t: rand(0, 10), mode };
    switch (mode) {
      case 'stars':
        return { ...p, size: rand(0.5, 2), vy: rand(2, 10), tw: rand(1, 3) };
      case 'bubbles':
        return { ...p, y: initial ? p.y : h + 20, size: rand(3, 14), vy: -rand(15, 45), wob: rand(0.5, 2) };
      case 'petals':
        return { ...p, y: initial ? p.y : -20, size: rand(10, 18), vy: rand(15, 35), vx: rand(10, 35), emoji: pick(this.theme.particles.emojis || ['🌸']), rot: rand(0, 6) };
      case 'embers':
        return { ...p, y: initial ? p.y : h + 10, size: rand(1, 3.5), vy: -rand(25, 70), wob: rand(0.5, 2) };
      default:
        return p;
    }
  }

  drawAmbient(dt) {
    const { ctx, w, h } = this.amb;
    ctx.clearRect(0, 0, w, h);
    if (!this.ambient.length) return;
    const accent = this.theme.palette[0];
    for (let i = 0; i < this.ambient.length; i++) {
      const a = this.ambient[i];
      a.t += dt;
      switch (a.mode) {
        case 'stars': {
          a.y += a.vy * dt;
          ctx.globalAlpha = 0.35 + 0.45 * Math.abs(Math.sin(a.t * a.tw));
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(a.x, a.y, a.size, a.size);
          if (a.y > h) this.ambient[i] = this.spawnAmbient('stars', false);
          break;
        }
        case 'bubbles': {
          a.y += a.vy * dt;
          const x = a.x + Math.sin(a.t * a.wob) * 10;
          ctx.globalAlpha = 0.35;
          ctx.strokeStyle = accent;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(x, a.y, a.size, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 0.25;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(x - a.size * 0.35, a.y - a.size * 0.35, a.size * 0.25, 0, Math.PI * 2);
          ctx.fill();
          if (a.y < -20) this.ambient[i] = this.spawnAmbient('bubbles', false);
          break;
        }
        case 'petals': {
          a.y += a.vy * dt;
          a.x += (a.vx + Math.sin(a.t) * 20) * dt;
          ctx.globalAlpha = 0.55;
          ctx.save();
          ctx.translate(a.x, a.y);
          ctx.rotate(a.rot + Math.sin(a.t) * 0.8);
          ctx.font = `${a.size}px serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(a.emoji, 0, 0);
          ctx.restore();
          if (a.y > h + 20 || a.x > w + 20) this.ambient[i] = { ...this.spawnAmbient('petals', false), x: rand(-w * 0.3, w) };
          break;
        }
        case 'embers': {
          a.y += a.vy * dt;
          const x = a.x + Math.sin(a.t * a.wob) * 14;
          ctx.globalAlpha = 0.4 + 0.5 * Math.abs(Math.sin(a.t * 3));
          ctx.fillStyle = i % 3 ? accent : '#ffd23f';
          ctx.shadowColor = accent;
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(x, a.y, a.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          if (a.y < -10) this.ambient[i] = this.spawnAmbient('embers', false);
          break;
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---------- Main loop ----------

  drawFx(dt) {
    const { ctx, w, h } = this.fx;
    ctx.clearRect(0, 0, w, h);

    for (const r of this.rings) {
      r.life += dt;
      const k = r.life / r.max;
      r.r = r.maxR * (1 - (1 - k) ** 3);
      ctx.globalAlpha = Math.max(0, 1 - k);
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width * (1 - k) + 1;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    this.rings = this.rings.filter((r) => r.life < r.max);

    for (const p of this.particles) {
      p.life += dt;
      p.vy += p.g * dt;
      p.vx *= 1 - 1.5 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      const k = p.life / p.max;
      ctx.globalAlpha = Math.max(0, 1 - k * k);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      if (p.glow) {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 12;
      }
      ctx.fillStyle = p.color;
      const s = p.size * (1 - k * 0.5);
      switch (p.shape) {
        case 'circle':
          ctx.beginPath();
          ctx.arc(0, 0, s / 1.5, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'emoji':
          ctx.font = `${s}px serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(p.emoji, 0, 0);
          break;
        case 'confetti':
          ctx.scale(1, Math.cos(p.life * 6));
          ctx.fillRect(-s / 2, -s / 4, s, s / 2);
          break;
        default:
          ctx.fillRect(-s / 2, -s / 2, s, s);
      }
      ctx.restore();
    }
    this.particles = this.particles.filter((p) => p.life < p.max && p.y < h + 50);
    ctx.globalAlpha = 1;
  }

  loop(t) {
    const dt = Math.min(0.05, (t - this.last) / 1000);
    this.last = t;
    if (!document.hidden) {
      this.drawAmbient(dt);
      // Keep drawing one extra frame after the last particle dies so it's cleared.
      const busy = this.particles.length > 0 || this.rings.length > 0;
      if (busy || this.fxDirty) {
        this.drawFx(dt);
        this.fxDirty = busy;
      }
    }
    requestAnimationFrame((tt) => this.loop(tt));
  }
}
