/* ============================================================
 * 微音效（默认静音）：导航右侧 ♪ 开关，状态存 localStorage
 * 只在用户主动开启后发声——Web Audio 短促方波“咔哒”
 * ============================================================ */

let ctx: AudioContext | null = null;

export function sfxEnabled() {
  try {
    return localStorage.getItem("sfx") === "on";
  } catch {
    return false;
  }
}

export function setSfxEnabled(on: boolean) {
  try {
    if (on) localStorage.setItem("sfx", "on");
    else localStorage.removeItem("sfx");
  } catch {
    /* ignore */
  }
}

/** 高频短促“咔哒”（主题开关/面板展开） */
export function playClick(pitch: number = 2200) {
  if (!sfxEnabled()) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "square";
    o.frequency.value = pitch;
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.08);
  } catch {
    /* 无声环境直接忽略 */
  }
}

/** 机械键盘微清脆敲击音（终端输入） */
export function playKeyThock() {
  if (!sfxEnabled()) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(420, t);
    osc.frequency.exponentialRampToValueAtTime(110, t + 0.04);
    gain.gain.setValueAtTime(0.04, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.06);
  } catch {
    /* ignore */
  }
}

/** 奥林匹克杠铃片清脆金属撞击音（装卸杠铃片） */
export function playMetalClank() {
  if (!sfxEnabled()) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    const t = ctx.currentTime;

    // 金属泛音 1 (高频钟鸣)
    const o1 = ctx.createOscillator();
    const g1 = ctx.createGain();
    o1.type = "triangle";
    o1.frequency.setValueAtTime(1420, t);
    o1.frequency.exponentialRampToValueAtTime(1180, t + 0.18);
    g1.gain.setValueAtTime(0.08, t);
    g1.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o1.connect(g1).connect(ctx.destination);
    o1.start(t);
    o1.stop(t + 0.24);

    // 金属泛音 2 (低沉钢体震颤)
    const o2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    o2.type = "sine";
    o2.frequency.setValueAtTime(240, t);
    o2.frequency.exponentialRampToValueAtTime(160, t + 0.25);
    g2.gain.setValueAtTime(0.12, t);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    o2.connect(g2).connect(ctx.destination);
    o2.start(t);
    o2.stop(t + 0.3);
  } catch {
    /* ignore */
  }
}

/** 黑胶唱片唱针落盘杂音与沙沙底噪 */
export function playVinylNeedle() {
  if (!sfxEnabled()) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    const t = ctx.currentTime;

    // 落盘低频微撞击
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(95, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.08);
    oscGain.gain.setValueAtTime(0.14, t);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    osc.connect(oscGain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.12);

    // 几粒白噪点模拟黑胶沙沙声 (Crackle)
    const bufferSize = ctx.sampleRate * 0.18;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      // 随机脉冲模拟唱片灰尘跳音
      data[i] = Math.random() > 0.94 ? (Math.random() * 2 - 1) * 0.4 : (Math.random() * 2 - 1) * 0.05;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.05, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    noise.connect(noiseGain).connect(ctx.destination);
    noise.start(t);
  } catch {
    /* ignore */
  }
}
