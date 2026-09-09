"use client";

import { useEffect, useRef, useState } from "react";
import { T } from "./i18n";

/* Bento 里的极客终端：交互增强版，支持点触快捷芯片、键盘上下翻看历史、点哪都能聚焦输入、高对比清晰配色 */
type Line = { kind: "in" | "out" | "ok" | "err" | "dim"; text: string };

const BANNER: Line[] = [
  { kind: "dim", text: "alvin-os v2.4 (Darwin x86_64/arm64) — Session initialized" },
  { kind: "out", text: "Welcome to Alvin's interactive shell. Type `help` or click the chips below:" },
];

const SKILLS: [string, number][] = [
  ["TypeScript", 92],
  ["React / Next.js", 90],
  ["Node / Express", 86],
  ["Python", 78],
  ["Rust / Tauri", 65],
  ["SQL / ClickHouse", 75],
];

export default function TerminalTile() {
  const [lines, setLines] = useState<Line[]>(BANNER);
  const [value, setValue] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState<number>(-1);

  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

    switch (cmd) {
      case "help":
        out.push({
          kind: "ok",
          text: "Available commands:",
        });
        out.push({
          kind: "out",
          text: "  help                Show this command guide\n  room                Visit /room (Alvin's 2.5D isometric room)\n  year                Open /year (2026 Annual Report Wrapped)\n  cat xray-hero-effect Read the flagship post summary\n  skills              Inspect technical skill matrix\n  cat bio.txt         Read personal background & philosophy\n  ls                  List files and directories in workspace\n  whoami              Current identity, location & role\n  workout             Get a randomized daily training menu\n  contact             Show email and GitHub links\n  date                Print live local time in Durham, UK\n  sudo hire-alvin     Attempt special hiring protocol\n  clear               Clear terminal output buffer",
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
          text: `Durham, UK Time: ${ukTime}`,
        });
        break;
      }

      case "workout": {
        const workouts = [
          ["Bench Press 5×5 (Heavy)", "Incline DB Press 4×8", "Cable Fly 3×12", "Dips 3×Failure"],
          ["Back Squat 5×5", "Romanian Deadlift 4×8", "Leg Press 3×12", "Calf Raise 4×15"],
          ["Conventional Deadlift 3×5", "Barbell Row 4×8", "Pull-ups 3×Failure", "Face Pull 3×15"],
        ];
        const pick = workouts[Math.floor(Math.random() * workouts.length)];
        out.push({ kind: "ok", text: "TODAY'S TRAINING MENU:" });
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
          text: `zsh: command not found: ${trimmed}. Try typing \`help\` or click any chip above.`,
        });
        break;
    }

    setLines((l) => [...l, ...out].slice(-60));
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

  const QUICK_COMMANDS = ["help", "room", "year", "skills", "cat bio.txt", "whoami", "workout", "clear"];

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
            className="term-chip"
            onClick={() => {
              run(cmd);
              focusInput();
            }}
          >
            {cmd}
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
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKey}
          placeholder="type 'help' or click quick chips above..."
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
    </article>
  );
}
