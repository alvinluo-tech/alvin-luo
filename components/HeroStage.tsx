"use client";

/* ============================================================
 * HeroStage — “透视透镜”人像交互
 *
 * 第一性原理：「身体在哪」这个信息本身就写在训练照片的
 * alpha 通道里，不需要用几何形状去逼近身形——
 *
 *   · 揭示范围 = 训练照片的不透明像素 ∩ 跟随鼠标的圆形透镜
 *   · 是否激活 = 光标处（含少量外扩）是否存在身体像素
 *
 * 因此悬停在上半身任何位置（肩、胸、腹、腰、手臂）都会生效，
 * 换任何姿势/构图的照片都不用重新调参。脸部不会发生变化，
 * 悬停时效果自然淡出（见 CONFIG.face）。
 * ============================================================ */

import { useEffect, useRef } from "react";
import { T, pick, useLocale } from "./i18n";

const CONFIG = {
  lensR: 0.18,        // 透镜半径（相对图片宽度）
  lensMinPx: 70,      // 透镜最小像素半径
  posEase: 0.16,      // 透镜跟随缓动系数（越小越“软”）
  intensityEase: 0.1, // 透视显隐缓动系数
  bodyDilate: 16,     // 轮廓外扩（显示像素）：刚滑出身体边缘时有余量，不易“断触”
  /* 脸部排除区（椭圆，归一化坐标）：脸在两张照片里是一样的，
     悬停脸时不激活透视，避免“圈住脸却什么都没发生” */
  face: { cx: 0.5, cy: 0.185, rx: 0.115, ry: 0.125 },
};

/* GitHub Pages 子路径部署：NEXT_PUBLIC_* 变量在构建时内联进客户端包 */
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

/* 命中检测缩略图尺寸（小而快；放大采样自带几像素羽化） */
const HIT_W = 160;
const HIT_H = 240;

export default function HeroStage() {
  const stageRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hintRef = useRef<HTMLParagraphElement>(null);
  const { locale } = useLocale();

  useEffect(() => {
    /* 先取原始引用判空，再创建非空别名 —— 闭包内保持非空类型 */
    const stageEl = stageRef.current;
    const canvasEl = canvasRef.current;
    const hintEl = hintRef.current;
    const revealCanvas = document.createElement("canvas");
    const ctx0 = canvasEl?.getContext("2d");
    const rctx0 = revealCanvas.getContext("2d");
    if (!stageEl || !canvasEl || !hintEl || !ctx0 || !rctx0) return;

    const stage = stageEl;
    const canvas = canvasEl;
    const hint = hintEl;
    const ctx = ctx0;
    const rctx = rctx0;

    /* ---------- 状态 ---------- */
    const lens = { x: 0.5, y: 0.47 };
    const lensTarget = { x: 0.5, y: 0.47 };
    let intensity = 0;
    let intensityTarget = 0;
    let isSelf = false;
    let touchLocked = false;
    let rafId = 0;
    let idleDrawn = false; // 静止且无透视时只画一次底图，避免空转 GPU
    const state: {
      images: { clothed: HTMLImageElement; training: HTMLImageElement } | null;
      w: number;
      h: number;
    } = { images: null, w: 0, h: 0 };

    /* ---------- 身体命中图：训练照片的 alpha（脸部已抠除） ---------- */
    const hitCanvas = document.createElement("canvas");
    hitCanvas.width = HIT_W;
    hitCanvas.height = HIT_H;
    const hitCtx = hitCanvas.getContext("2d", { willReadFrequently: true });
    let hitData: Uint8ClampedArray | null = null;
    let pixelReadsOK = true;

    function buildHitMap(training: HTMLImageElement) {
      if (!hitCtx) return;
      hitCtx.clearRect(0, 0, HIT_W, HIT_H);
      hitCtx.drawImage(training, 0, 0, HIT_W, HIT_H);

      // 抠除脸部（软边椭圆）
      const f = CONFIG.face;
      hitCtx.globalCompositeOperation = "destination-out";
      hitCtx.save();
      hitCtx.translate(f.cx * HIT_W, f.cy * HIT_H);
      hitCtx.scale(f.rx * HIT_W, f.ry * HIT_H);
      const g = hitCtx.createRadialGradient(0, 0, 0.7, 0, 0, 1);
      g.addColorStop(0, "rgba(0,0,0,1)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      hitCtx.fillStyle = g;
      hitCtx.beginPath();
      hitCtx.arc(0, 0, 1, 0, Math.PI * 2);
      hitCtx.fill();
      hitCtx.restore();
      hitCtx.globalCompositeOperation = "source-over";

      try {
        hitData = hitCtx.getImageData(0, 0, HIT_W, HIT_H).data;
      } catch {
        // canvas 被跨域污染（如直接以 file:// 打开）时兜底
        pixelReadsOK = false;
        console.warn("像素读取不可用，激活判定退化为矩形区域");
      }
    }

    /* 光标处是否存在身体像素（含 bodyDilate 外扩），返回 0~1 */
    function bodyAlpha(nx: number, ny: number) {
      if (!hitData || !state.w) return 0;
      if (!pixelReadsOK) {
        // 兜底：粗略的上半身矩形
        return nx > 0.2 && nx < 0.8 && ny > 0.26 && ny < 0.72 ? 1 : 0;
      }
      const r = Math.max(1, Math.round((CONFIG.bodyDilate / state.w) * HIT_W));
      const hx = Math.round(nx * HIT_W);
      const hy = Math.round(ny * HIT_H);
      let best = 0;
      for (let dy = -r; dy <= r; dy++) {
        const y = hy + dy;
        if (y < 0 || y >= HIT_H) continue;
        for (let dx = -r; dx <= r; dx++) {
          const x = hx + dx;
          if (x < 0 || x >= HIT_W) continue;
          const a = hitData[(y * HIT_W + x) * 4 + 3];
          if (a > best) best = a;
        }
      }
      return best / 255;
    }

    /* ---------- 资源加载 ---------- */
    const loadImage = (src: string) =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });

    let cancelled = false;
    Promise.all([
      loadImage(`${BASE_PATH}/photos/hero-clothed.png`),
      loadImage(`${BASE_PATH}/photos/hero-training.png`),
    ])
      .then(([clothed, training]) => {
        if (cancelled) return;
        state.images = { clothed, training };
        buildHitMap(training);
        resize();
        canvas.classList.add("is-loaded");
        rafId = requestAnimationFrame(loop);
      })
      .catch((err) => console.warn("照片加载失败：", err));

    /* ---------- 尺寸（含 DPR） ---------- */
    function resize() {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = revealCanvas.width = Math.round(rect.width * dpr);
      canvas.height = revealCanvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      rctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      state.w = rect.width;
      state.h = rect.height;
      idleDrawn = false; // canvas.width 重置会清空位图，必须允许下一帧重绘底图
      render();
    }

    /* ---------- 交互 ---------- */
    function updatePointerTarget(clientX: number, clientY: number) {
      const rect = canvas.getBoundingClientRect();
      const nx = (clientX - rect.left) / rect.width;
      const ny = (clientY - rect.top) / rect.height;
      lensTarget.x = nx;
      lensTarget.y = ny;
      // 光标下有身体（含少量外扩）就激活，透明度即强度，轮廓边缘自然过渡
      intensityTarget = bodyAlpha(nx, ny);
    }

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" && !touchLocked) return;
      updatePointerTarget(e.clientX, e.clientY);
    };

    const onPointerLeave = () => {
      if (touchLocked) return;
      intensityTarget = 0;
    };

    /* 触屏没有 hover：点身体开启透视（可滑动跟随），点其他区域关闭 */
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse") return;
      // 胶囊自己有 click 处理：不拦截会让 pointerdown 先开启、click 再翻转关闭，
      // 净效果为零——触屏上胶囊永远开不了
      if ((e.target as HTMLElement | null)?.closest?.(".xray-toggle")) return;
      const rect = canvas.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width;
      const ny = (e.clientY - rect.top) / rect.height;
      if (bodyAlpha(nx, ny) > 0.2) {
        touchLocked = true;
        lensTarget.x = nx;
        lensTarget.y = ny;
        intensityTarget = 1;
        capsule?.classList.add("is-on");
      } else {
        touchLocked = false;
        intensityTarget = 0;
        capsule?.classList.remove("is-on");
      }
    };

    /* 触屏胶囊开关：一键切换透视，不用手指反复点击人像（避免遮挡视线） */
    const capsule = stage.querySelector<HTMLButtonElement>(".xray-toggle");
    const onCapsule = () => {
      touchLocked = !touchLocked;
      if (touchLocked) {
        lensTarget.x = 0.5;
        lensTarget.y = 0.46;
        intensityTarget = 1;
      } else {
        intensityTarget = 0;
      }
      capsule?.classList.toggle("is-on", touchLocked);
    };
    capsule?.addEventListener("click", onCapsule);

    /* 鼠标视差：照片随光标轻微位移（仅精确指针） */
    const heroSection = stage.closest<HTMLElement>(".hero");
    const finePointer = matchMedia("(pointer: fine)").matches;
    const onHeroMove = (e: PointerEvent) => {
      if (!heroSection) return;
      const r = heroSection.getBoundingClientRect();
      const px = ((e.clientX - r.left) / r.width - 0.5) * 2; // -1 ~ 1
      const py = ((e.clientY - r.top) / r.height - 0.5) * 2;
      stage.style.setProperty("--px", `${px * 7}px`);
      stage.style.setProperty("--py", `${py * 5}px`);
    };
    const onHeroLeave = () => {
      stage.style.setProperty("--px", "0px");
      stage.style.setProperty("--py", "0px");
    };

    stage.addEventListener("pointermove", onPointerMove);
    stage.addEventListener("pointerleave", onPointerLeave);
    stage.addEventListener("pointerdown", onPointerDown);
    if (heroSection && finePointer) {
      heroSection.addEventListener("pointermove", onHeroMove);
      heroSection.addEventListener("pointerleave", onHeroLeave);
    }

    /* ---------- 渲染 ---------- */
    function render() {
      const { images, w, h } = state;
      if (!images || !w) return;

      /* 缓动 */
      lens.x += (lensTarget.x - lens.x) * CONFIG.posEase;
      lens.y += (lensTarget.y - lens.y) * CONFIG.posEase;
      intensity += (intensityTarget - intensity) * CONFIG.intensityEase;

      const active = intensity > 0.004 || intensityTarget > 0;
      if (!active) {
        if (!idleDrawn) {
          ctx.clearRect(0, 0, w, h);
          ctx.drawImage(images.clothed, 0, 0, w, h);
          idleDrawn = true;
        }
      } else {
        idleDrawn = false;
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(images.clothed, 0, 0, w, h);

        const lensR = Math.max(CONFIG.lensR * w, CONFIG.lensMinPx);

        // 1) 透镜范围内先“擦掉”穿衣服层。
        //    衣服是悬垂的，轮廓比裸身宽（尤其下腹衣摆），
        //    不擦的话底层衣服会绕着揭示区露出细边，产生割裂感。
        //    擦掉后露出的纸面 = 衣服被“看穿”后的诚实结果。
        ctx.globalCompositeOperation = "destination-out";
        ctx.globalAlpha = intensity;
        softMask(ctx, lens.x * w, lens.y * h, lensR, lensR, 0.62);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";

        // 2) 再叠上训练层（自带裸身轮廓）∩ 透镜
        composeReveal(images.training, w, h);
        ctx.drawImage(revealCanvas, 0, 0, w, h);
      }

      updateStateLabel();
      maybeHideHint();
    }

    /* 揭示层 = 训练照片（自带身体轮廓 alpha） ∩ 圆形透镜 ∩ 整体强度
       “X 光圈”用 source-atop 画，自动只落在身体像素上 */
    function composeReveal(training: HTMLImageElement, w: number, h: number) {
      const lensR = Math.max(CONFIG.lensR * w, CONFIG.lensMinPx);

      rctx.clearRect(0, 0, w, h);
      rctx.drawImage(training, 0, 0, w, h);

      // 蒙版：跟随鼠标的圆形透镜（软边）
      rctx.globalCompositeOperation = "destination-in";
      softMask(rctx, lens.x * w, lens.y * h, lensR, lensR, 0.62);

      // 蒙版：整体强度淡入淡出
      rctx.fillStyle = `rgba(0,0,0,${intensity})`;
      rctx.fillRect(0, 0, w, h);

      // 透镜边缘的“X 光圈”：内圈线 + 外圈荧光绿，
      // source-atop 使描边只画在已有像素（身体）上。
      // 内圈线颜色跟随主题，暗色下用纸色才可见
      const dark = document.documentElement.dataset.theme === "dark";
      rctx.globalCompositeOperation = "source-atop";
      rctx.globalAlpha = intensity;
      rctx.lineWidth = 1.5;
      rctx.strokeStyle = dark ? "rgba(240,240,230,0.85)" : "rgba(16,20,0,0.85)";
      rctx.beginPath();
      rctx.arc(lens.x * w, lens.y * h, lensR, 0, Math.PI * 2);
      rctx.stroke();
      rctx.lineWidth = 2;
      rctx.strokeStyle = dark ? "rgba(163,230,53,0.9)" : "rgba(196,232,0,0.9)";
      rctx.beginPath();
      rctx.arc(lens.x * w, lens.y * h, lensR + 5, 0, Math.PI * 2);
      rctx.stroke();
      rctx.globalAlpha = 1;
      rctx.globalCompositeOperation = "source-over";
    }

    /* 圆形软边蒙版（rx === ry），inner 为实心半径比 */
    function softMask(
      c: CanvasRenderingContext2D,
      x: number,
      y: number,
      rx: number,
      ry: number,
      inner: number,
    ) {
      c.save();
      c.translate(x, y);
      c.scale(rx, ry);
      const g = c.createRadialGradient(0, 0, inner, 0, 0, 1);
      g.addColorStop(0, "rgba(0,0,0,1)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = g;
      c.beginPath();
      c.arc(0, 0, 1, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }

    /* ---------- 文案状态 ---------- */
    function updateStateLabel() {
      // 带迟滞的切换，避免在阈值附近抖动
      if (!isSelf && intensity > 0.55) isSelf = true;
      if (isSelf && intensity < 0.42) isSelf = false;
      stage.classList.toggle("is-self", isSelf);
    }

    let hintHidden = false;
    function maybeHideHint() {
      if (!hintHidden && intensity > 0.6) {
        hintHidden = true;
        hint.classList.add("is-hidden");
      }
    }

    /* ---------- 主循环 ----------
       注意：不要在 visibilitychange 里取消 rAF —— 后台标签页本来就会
       被浏览器自动节流，手动取消后若“恢复可见”事件丢失，循环会永久停摆 */
    function loop() {
      render();
      rafId = requestAnimationFrame(loop);
    }

    /* 调试句柄：可在控制台手动驱动一帧，也方便自动化测试 */
    window.__hero = {
      get intensity() {
        return intensity;
      },
      get isSelf() {
        return isSelf;
      },
      get images() {
        return state.images;
      },
      get size() {
        return { w: state.w, h: state.h };
      },
      bodyAlpha,
      tick: render,
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      ro.disconnect();
      stage.removeEventListener("pointermove", onPointerMove);
      stage.removeEventListener("pointerleave", onPointerLeave);
      stage.removeEventListener("pointerdown", onPointerDown);
      capsule?.removeEventListener("click", onCapsule);
      if (heroSection && finePointer) {
        heroSection.removeEventListener("pointermove", onHeroMove);
        heroSection.removeEventListener("pointerleave", onHeroLeave);
      }
      delete window.__hero;
    };
  }, []);

  return (
    <figure className="stage" id="stage" ref={stageRef}>
      {/* 背景装饰：等高线 + 软色块，模仿原站“人像融入纸面”的底纹。
          颜色走 CSS 变量（globals.css 定义，暗色自动换色） */}
      <svg className="stage-art" viewBox="0 0 620 840" aria-hidden="true">
        <ellipse cx="130" cy="560" rx="95" ry="125" fill="var(--art-blob)" />
        <path
          d="M70,800 C 40,600 200,540 160,380 C 125,240 280,150 250,10"
          fill="none"
          stroke="var(--art-line)"
          strokeWidth="2"
        />
        <path
          d="M560,840 C 600,620 450,560 500,380 C 540,240 430,160 470,20"
          fill="none"
          stroke="var(--art-line)"
          strokeWidth="2"
        />
        <path
          d="M0,180 C 120,150 200,240 330,210 C 460,180 540,260 620,230"
          fill="none"
          stroke="var(--art-line-soft)"
          strokeWidth="2"
        />
      </svg>

      <div className="stage-card">
        {/* 双状态人像由 Canvas 合成渲染（穿衣服层 + 训练层 + 鼠标透镜），
            无底色无边框，直接浮在页面纸面上 */}
        <canvas
          id="heroCanvas"
          ref={canvasRef}
          role="img"
          aria-label={pick(
            locale,
            "A young man standing; hover over his upper body to see through the shirt",
            "站立的年轻人，鼠标滑过上半身会透过衣服看到训练状态",
          )}
        />

        {/* 触屏专用：透视开关胶囊（桌面隐藏） */}
        <button type="button" className="xray-toggle" aria-label="开关 X 光透视">
          X-RAY
        </button>
      </div>

      {/* 状态标签：两行叠放，随鼠标是否在身体上交叉切换 */}
      <span className="stage-label" aria-live="polite">
        <span className="dot" aria-hidden="true" />
        <span className="labels">
          <span className="label is-web">BUILDING&nbsp;FOR&nbsp;THE&nbsp;WEB</span>
          <span className="label is-self">BUILDING&nbsp;MYSELF</span>
        </span>
      </span>

      <p className="stage-hint" ref={hintRef}>
        <T en="Hover the torso · X-RAY" zh="鼠标滑过上半身 · X-RAY" />
      </p>
    </figure>
  );
}
