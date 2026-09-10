"use client";

import { useEffect, useRef, useState } from "react";
import { T } from "./i18n";
import { playKeyThock } from "@/lib/sfx";

/* Bento 里的极客终端：交互增强版，支持点触快捷芯片、键盘上下翻看历史、Matrix 绿色代码雨、AI 智能问答、高对比清晰配色 */
type Line = { kind: "in" | "out" | "ok" | "err" | "dim"; text: string };

const BANNER: Line[] = [
  { kind: "dim", text: "alvin-os v2.6 (Darwin x86_64/arm64) — Session initialized" },
  { kind: "out", text: "Welcome to Alvin's interactive shell. Type `help`, `matrix`, `ai ask`, or click chips:" },
];

const SKILLS: [string, number][] = [
  ["TypeScript", 92],
  ["React / Next.js", 90],
  ["Node / Express", 86],
  ["Python", 78],
  ["Rust / Tauri", 65],
  ["SQL / ClickHouse", 75],
];

function getAiResponse(query: string): string {
  const q = query.toLowerCase();
  if (!q || q === "ai" || q === "ask") {
    return "🤖 [Alvin AI]: Ask me anything! Try:\n  • ai ask what is your bench press PR?\n  • ai ask tell me about your projects\n  • ai ask what tech stack do you use?\n  • ai ask why Durham, UK?";
  }
  if (q.includes("bench") || q.includes("gym") || q.includes("lift") || q.includes("squat") || q.includes("deadlift") || q.includes("workout") || q.includes("leg")) {
    return "🏋️ [Alvin AI]: Alvin is officially in the 100KG Bench Press Club (PR achieved)! But please don't mention squats or deadlifts—his leg day attendance record is currently '404 Not Found'. True software engineers only optimize the pressing muscles so keyboards don't stand a chance.";
  }
  if (q.includes("project") || q.includes("built") || q.includes("work") || q.includes("app") || q.includes("portfolio")) {
    return "🚀 [Alvin AI]: Flagship projects shipped by Alvin:\n  1. Encounter — End-to-end encrypted intimacy tracker for couples with AES-256-GCM & zero-knowledge PIN lock.\n  2. TaskFlow — Productivity OS managing cognitive energy instead of time, with AI task decomposition.\n  3. CoreLayer — Local-first AI agent desktop control plane built with Tauri 2 & Rust.\nCheck them out in the #projects section above!";
  }
  if (q.includes("stack") || q.includes("tech") || q.includes("language") || q.includes("react") || q.includes("tailwind") || q.includes("css") || q.includes("rust")) {
    return "⚡ [Alvin AI]: Core stack: Next.js 16 (App Router), React 19, TypeScript, Rust/Tauri 2, and Node.js. Alvin adheres to zero-runtime Vanilla CSS architecture—mastering fundamental web APIs for 60fps performance without framework bloat.";
  }
  if (q.includes("durham") || q.includes("uk") || q.includes("school") || q.includes("university") || q.includes("where")) {
    return "🏰 [Alvin AI]: Alvin is studying & engineering in Durham, United Kingdom. Historic castle surroundings, classic rainy afternoons, deep code focus, and heavy bench sessions.";
  }
  if (q.includes("who") || q.includes("about") || q.includes("bio") || q.includes("alvin")) {
    return "👨‍💻 [Alvin AI]: Alvin Luo — Software Engineer who lifts. Building products by day, building myself after hours. Passionate about thoughtful design engineering, weightless spatial interfaces, and progressive overload in code & gym.";
  }
  if (q.includes("hire") || q.includes("contact") || q.includes("job") || q.includes("email") || q.includes("reach")) {
    return "📫 [Alvin AI]: Open to engineering opportunities and high-leverage products. Reach Alvin directly at luoyaosheng123@gmail.com or connect via GitHub @alvinluo-tech!";
  }
  if (q.includes("music") || q.includes("song") || q.includes("listen")) {
    return "🎵 [Alvin AI]: Music fuels every build session. See the live NetEase Music band on the home page or head over to /room to watch the vinyl player spin in real-time!";
  }
  return `🤖 [Alvin AI]: Query received: "${query}". Alvin is either in the flow state refactoring code, writing in /now, or pushing 100KG on the bench. Try asking about 'projects', 'stack', 'bench press', or type 'matrix'!`;
}

export default function TerminalTile() {
  const [lines, setLines] = useState<Line[]>(BANNER);
  const [value, setValue] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState<number>(-1);
  const [matrixActive, setMatrixActive] = useState(false);

  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const matrixCanvasRef = useRef<HTMLCanvasElement>(null);

  // Matrix 代码雨画布渲染逻辑
  useEffect(() => {
    if (!matrixActive) return;
    const canvas = matrixCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.parentElement?.clientWidth || 700;
      canvas.height = canvas.parentElement?.clientHeight || 280;
    };
    resize();
    window.addEventListener("resize", resize);

    const chars = "ｦｱｳｴｵｶｷｹｺｻｼｽｾｿﾀﾂﾃﾅﾆﾇﾈﾊﾋﾎﾏﾐﾑﾒﾓﾔﾕﾗﾘﾜ0123456789ABCDEF$#@%&*<>{}[]~/\\";
    const fontSize = 13;
    const columns = Math.floor(canvas.width / fontSize);
    const drops: number[] = Array.from({ length: columns }, () => Math.floor(Math.random() * -30));

    let animId = 0;
    let lastTime = 0;
    const interval = 32;

    const draw = (time: number) => {
      animId = requestAnimationFrame(draw);
      if (time - lastTime < interval) return;
      lastTime = time;

      ctx.fillStyle = "rgba(8, 12, 5, 0.22)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        const char = chars[Math.floor(Math.random() * chars.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;

        ctx.fillStyle = drops[i] > 1 && Math.random() > 0.82 ? "#ffffff" : "#a3e635";
        ctx.fillText(char, x, y);

        if (y > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
    };

    animId = requestAnimationFrame(draw);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key.toLowerCase() === "q") {
        setMatrixActive(false);
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKey);
    };
  }, [matrixActive]);

  // 每次输出新内容自动滚动到最底部
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [lines]);

  const run = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;

    const cmd = trimmed.toLowerCase();
    const out: Line[] = [{ kind: "in", text: `$ ${trimmed}` }];

    // 记录历史
    setHistory((prev) => (prev[prev.length - 1] === trimmed ? prev : [...prev, trimmed]));
    setHistoryIdx(-1);

    if (cmd === "matrix" || cmd === "rain") {
      setMatrixActive(true);
      out.push({
        kind: "ok",
        text: "🟢 Matrix digital code rain sequence initialized. Press [ESC] or click [EXIT] to return.",
      });
      setLines((l) => [...l, ...out].slice(-80));
      setValue("");
      return;
    }

    if (cmd.startsWith("ai ") || cmd.startsWith("ask ") || cmd === "ai" || cmd === "ask") {
      const q = trimmed.replace(/^(ai\s+ask|ai|ask)\s*/i, "").trim();
      out.push({ kind: "ok", text: getAiResponse(q) });
      setLines((l) => [...l, ...out].slice(-80));
      setValue("");
      return;
    }

    switch (cmd) {
      case "help":
        out.push({
          kind: "ok",
          text: "Available commands:",
        });
        out.push({
          kind: "out",
          text: "  help                Show this command guide\n  matrix              Launch iconic Matrix digital green code rain\n  ai ask <query>      Chat with Alvin's client-side AI agent\n  bench               Check 100KG bench press & leg day status\n  room                Visit /room (Alvin's 2.5D isometric room)\n  year                Open /year (2026 Annual Report Wrapped)\n  cat xray-hero-effect Read the flagship post summary\n  skills              Inspect technical skill matrix\n  cat bio.txt         Read personal background & philosophy\n  ls                  List files and directories in workspace\n  whoami              Current identity, location & role\n  workout             Get a randomized daily training menu\n  contact             Show email and GitHub links\n  date                Print live local time in Durham, UK\n  sudo hire-alvin     Attempt special hiring protocol\n  clear               Clear terminal output buffer",
        });
        break;

      case "bench":
      case "benchpress":
      case "lift":
        out.push({
          kind: "ok",
          text: "🏋️ BENCH PRESS STATUS: 100KG (PR achieved)!\nLeg day status: 404 Not Found.\n\"A true software engineer only trains the pressing muscles so keyboards don't stand a chance.\"",
        });
        break;

      case "room":
        out.push({ kind: "ok", text: "Opening Alvin's 2.5D Room: /room ..." });
        if (typeof window !== "undefined") {
          setTimeout(() => { window.location.href = "/room"; }, 400);
        }
        break;

      case "year":
      case "wrapped":
        out.push({ kind: "ok", text: "Opening 2026 Annual Report: /year ..." });
        if (typeof window !== "undefined") {
          setTimeout(() => { window.location.href = "/year"; }, 400);
        }
        break;

      case "cat xray-hero-effect":
      case "cat xray":
      case "xray":
        out.push({
          kind: "ok",
          text: "ARTICLE: X-Ray Hero Effect — 透视层与物理光影的工程实现",
        });
        out.push({
          kind: "out",
          text: "深入剖析利用 WebGL/Canvas 与 CSS 混合模式打造具深度感的透视人像、\n视差位移与 X 光透视骨骼。阅读完整长文: /blog/xray-hero-effect",
        });
        break;

      case "sudo hire-alvin":
      case "hire":
      case "hire-alvin":
        out.push({
          kind: "ok",
          text: "Access Granted: [200 OK] — High-Impact Software Engineer detected!",
        });
        out.push({
          kind: "out",
          text: "Thank you for your interest. Let's craft refined software and build bold products together.\nReach out directly: luoyaosheng123@gmail.com",
        });
        break;

      case "ls":
      case "dir":
        out.push({
          kind: "out",
          text: "drwxr-xr-x  projects/\ndrwxr-xr-x  room/\ndrwxr-xr-x  year/\ndrwxr-xr-x  travel/\n-rw-r--r--  bio.txt\n-rw-r--r--  xray-hero-effect.md\n-rwxr-xr-x  skills.sh\n-rw-r--r--  contact.json",
        });
        break;

      case "cat bio.txt":
      case "cat bio":
      case "bio":
        out.push({
          kind: "out",
          text: "Alvin Luo — Software Engineer based in Durham, UK.\nObsessed with high-performance web systems, crafting refined interfaces,\nand turning complex problems into elegant software.",
        });
        out.push({
          kind: "dim",
          text: "Motto: \"Care about your craft. Ship with pride.\"",
        });
        break;

      case "skills":
        out.push({ kind: "dim", text: "Compiling skill matrix benchmarks..." });
        for (const [name, lvl] of SKILLS) {
          const bars = Math.round(lvl / 10);
          out.push({
            kind: "ok",
            text: `${name.padEnd(18, " ")} [${"■".repeat(bars)}${"·".repeat(10 - bars)}] ${lvl}%`,
          });
        }
        break;

      case "whoami":
        out.push({
          kind: "out",
          text: "user: alvin\nrole: Full-stack Software Engineer\nbase: Durham, United Kingdom (54.7761° N, 1.5759° W)\nstatus: Online & Building",
        });
        break;

      case "contact":
      case "email":
        out.push({
          kind: "ok",
          text: "Email:  luoyaosheng123@gmail.com\nGitHub: https://github.com/alvinluo-tech",
        });
        break;

      case "date": {
        const now = new Date();
        const ukTime = new Intl.DateTimeFormat("en-GB", {
          timeZone: "Europe/London",
          dateStyle: "full",
          timeStyle: "medium",
        }).format(now);
        out.push({
          kind: "ok",
          text: `Durham, UK (Europe/London): ${ukTime}`,
        });
        break;
      }

      case "workout": {
        const workouts = [
          ["Bench Press (Barbell) 5x5 @ 100KG", "Incline Dumbbell Press 4x8", "Chest Dips 3x12", "Cable Flyes 3x15"],
          ["Overhead Press 4x6", "Lateral Raises 4x15", "Rear Delt Reverse Flyes 3x15", "Face Pulls 4x12"],
          ["Weighted Pull-ups 4x6", "Barbell Rows 4x8", "Lat Pulldown 3x10", "Hammer Curls 3x12"],
          ["Incline Bench Press 4x6", "Push-ups to failure 3 sets", "Tricep Rope Pushdown 4x12", "Hanging Leg Raises 3x15"],
        ];
        const pick = workouts[Math.floor(Math.random() * workouts.length)];
        out.push({ kind: "ok", text: "TODAY'S TRAINING MENU (Chest & Upper Body Heavy):" });
        for (const item of pick) {
          out.push({ kind: "out", text: `  ▸ ${item}` });
        }
        break;
      }

      case "sudo":
      case "sudo rm -rf /":
      case "sudo su":
        out.push({
          kind: "err",
          text: "Permission denied: Guest user cannot sudo Alvin's machine 😉",
        });
        break;

      case "clear":
      case "cls":
        setLines([]);
        setValue("");
        return;

      default:
        out.push({
          kind: "err",
          text: `zsh: command not found: ${trimmed}. Try typing \`help\`, \`matrix\`, \`ai ask\`, or click any chip.`,
        });
        break;
    }

    setLines((l) => [...l, ...out].slice(-80));
    setValue("");
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      run(value);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length === 0) return;
      const nextIdx = historyIdx === -1 ? history.length - 1 : Math.max(0, historyIdx - 1);
      setHistoryIdx(nextIdx);
      setValue(history[nextIdx] || "");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (history.length === 0 || historyIdx === -1) return;
      const nextIdx = historyIdx + 1;
      if (nextIdx >= history.length) {
        setHistoryIdx(-1);
        setValue("");
      } else {
        setHistoryIdx(nextIdx);
        setValue(history[nextIdx] || "");
      }
    }
  };

  const focusInput = () => {
    inputRef.current?.focus();
  };

  const QUICK_COMMANDS = ["help", "matrix", "ai ask", "bench", "workout", "skills", "room", "clear"];

  return (
    <article className="tile tile-term" onClick={focusInput} aria-label="Interactive developer terminal">
      {/* 终端顶部 Mac 风格窗体栏 */}
      <div className="term-chrome">
        <div className="term-dots" aria-hidden="true">
          <span className="term-dot term-dot-red" />
          <span className="term-dot term-dot-yellow" />
          <span className="term-dot term-dot-green" />
        </div>
        <span className="term-chrome-title">alvin@durham: ~/portfolio</span>
        <span className="term-live-tag">
          <span className="term-pulse-dot" />
          INTERACTIVE
        </span>
      </div>

      {/* 输出视口：点击任何地方自动聚焦输入框 */}
      <div className="term-body" ref={bodyRef} tabIndex={-1}>
        {lines.map((l, i) => (
          <p
            key={i}
            className={`term-line term-line-${l.kind}`}
          >
            {l.text}
          </p>
        ))}
      </div>

      {/* 快捷操作芯片：点一下直接执行，防呆防懒 */}
      <div className="term-chips" onClick={(e) => e.stopPropagation()}>
        <span className="term-chips-label">
          <T en="QUICK:" zh="快捷:" />
        </span>
        {QUICK_COMMANDS.map((cmd) => (
          <button
            key={cmd}
            type="button"
            className={cmd === "matrix" || cmd === "ai ask" ? "term-chip term-chip-highlight" : "term-chip"}
            onClick={() => {
              if (cmd === "ai ask") {
                run("ai ask what projects have you built?");
              } else {
                run(cmd);
              }
              focusInput();
            }}
          >
            {cmd === "matrix" ? "🟢 matrix" : cmd === "ai ask" ? "🤖 ai ask" : cmd}
          </button>
        ))}
      </div>

      {/* 命令行输入条：高对比、明亮光标、带执行按钮 */}
      <div className="term-input" onClick={focusInput}>
        <span className="term-prompt" aria-hidden="true">
          alvin@durham %
        </span>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            playKeyThock();
          }}
          onKeyDown={onKey}
          placeholder="type 'help', 'matrix', 'ai ask why 100kg bench'..."
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          aria-label="终端命令行输入"
        />
        <button
          type="button"
          className="term-run-btn"
          onClick={(e) => {
            e.stopPropagation();
            run(value);
            focusInput();
          }}
        >
          RUN ↵
        </button>
      </div>

      {/* Matrix 绿色数字代码雨全屏浮层 */}
      {matrixActive && (
        <div className="term-matrix-overlay" onClick={(e) => e.stopPropagation()}>
          <canvas ref={matrixCanvasRef} className="term-matrix-canvas" />
          <div className="term-matrix-hud">
            <span className="term-matrix-title">MATRIX CODE RAIN v2.6 // DECRYPTING REALITY</span>
            <button
              type="button"
              className="term-matrix-exit"
              onClick={() => setMatrixActive(false)}
            >
              EXIT [ESC / Q] ✕
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
