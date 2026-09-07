"use client";

import { useRef, useState } from "react";

/* Bento 里的极客终端：help / cat bio.txt / skills / workout / whoami / clear */
type Line = { kind: "in" | "out" | "ok"; text: string };

const BANNER: Line[] = [
  { kind: "out", text: "alvin-os v2.0 — type `help` to get started" },
];

const SKILLS: [string, number][] = [
  ["TypeScript", 88],
  ["React / Next.js", 84],
  ["Rust / Tauri", 62],
  ["Python", 74],
  ["Gym volume", 91],
];

function workoutOfTheDay() {
  const plans = [
    ["Bench Press 5×5", "Incline DB 4×8", "Cable Fly 3×12", "Dips 3×至力竭"],
    ["Squat 5×5", "RDL 4×8", "Leg Press 3×12", "Calf Raise 4×15"],
    ["Deadlift 3×5", "Barbell Row 4×8", "Pull-ups 3×至力竭", "Face Pull 3×15"],
  ];
  const plan = plans[Math.floor(Math.random() * plans.length)];
  return ["今日训练菜单（滚一随机数，练就完了）:", ...plan.map((x) => `  ▸ ${x}`)];
}

export default function TerminalTile() {
  const [lines, setLines] = useState<Line[]>(BANNER);
  const [value, setValue] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);

  const run = (raw: string) => {
    const cmd = raw.trim().toLowerCase();
    const out: Line[] = [{ kind: "in", text: `$ ${raw.trim()}` }];
    switch (cmd) {
      case "":
        break;
      case "help":
        out.push({
          kind: "out",
          text: "available: cat bio.txt · skills · workout · whoami · clear",
        });
        break;
      case "cat bio.txt":
        out.push({
          kind: "out",
          text: "白天写代码把数字世界捏成形，晚上撸铁把物理世界举起来。",
        });
        out.push({ kind: "out", text: "Believes shipping > talking. And that abs are just cache." });
        break;
      case "skills":
        out.push({ kind: "out", text: "loading skill matrix ..." });
        for (const [name, lvl] of SKILLS) {
          const bars = Math.round(lvl / 10);
          out.push({
            kind: "ok",
            text: `${name.padEnd(16, " ")} [${"█".repeat(bars)}${"░".repeat(10 - bars)}] ${lvl}%`,
          });
        }
        break;
      case "workout":
        for (const t of workoutOfTheDay()) out.push({ kind: "ok", text: t });
        break;
      case "whoami":
        out.push({ kind: "out", text: "alvin — builder by day, lifter after hours." });
        break;
      case "clear":
        setLines([]);
        setValue("");
        return;
      default:
        out.push({ kind: "out", text: `command not found: ${cmd} — try \`help\`` });
    }
    setLines((l) => [...l, ...out].slice(-40));
    setValue("");
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") run(value);
  };

  return (
    <article className="tile tile-term" onClick={() => bodyRef.current?.scrollTo({ top: 1e6 })}>
      <h3 className="tile-title">TERMINAL — 彩蛋</h3>
      <div
        className="term-body"
        ref={(el) => {
          bodyRef.current = el;
          if (el) el.scrollTop = el.scrollHeight;
        }}
      >
        {lines.map((l, i) => (
          <p key={i} className={l.kind === "in" ? "term-in" : l.kind === "ok" ? "term-ok" : undefined}>
            {l.text}
          </p>
        ))}
      </div>
      <div className="term-input">
        <span className="term-prompt">$</span>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKey}
          placeholder="help"
          spellCheck={false}
          aria-label="终端输入"
        />
      </div>
    </article>
  );
}
