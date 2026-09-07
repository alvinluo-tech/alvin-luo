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
export function playClick(pitch: 2200 | 900 = 2200) {
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
    /* 无声环境（自动化/无音频设备）直接忽略 */
  }
}
