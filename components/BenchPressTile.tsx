"use client";

import { useState } from "react";
import { T, useLocale } from "./i18n";
import { playMetalClank, playClick } from "@/lib/sfx";

type PlateWeight = 20 | 15 | 10 | 5;

const PRESETS = [
  { label: "20KG", labelZh: "20KG 空杆", total: 20, plates: [] as PlateWeight[], desc: "Warmup / 空杆热身" },
  { label: "60KG", labelZh: "60KG 热身", total: 60, plates: [20] as PlateWeight[], desc: "Working set 1 / 入门常规组" },
  { label: "80KG", labelZh: "80KG 进阶", total: 80, plates: [20, 10] as PlateWeight[], desc: "Heavy / 力量冲刺" },
  { label: "100KG", labelZh: "100KG 破百!", total: 100, plates: [20, 20] as PlateWeight[], desc: "🏆 PR Milestone / 卧推破百俱乐部" },
];

export default function BenchPressTile() {
  const { locale } = useLocale();
  const [selectedIdx, setSelectedIdx] = useState(3); // 默认高光展示 100KG 破百
  const current = PRESETS[selectedIdx];

  const handleSelect = (idx: number) => {
    setSelectedIdx(idx);
    if (idx === 3) {
      playMetalClank();
    } else {
      playClick(1400);
    }
  };

  return (
    <article className="tile tile-bench" aria-label="Bench press milestone interactive widget">
      <div className="bench-header">
        <div className="bench-title-group">
          <h3 className="tile-title">
            <T en="BENCH PRESS — 100KG PR" zh="卧推 — 100KG 破百俱乐部" />
          </h3>
          <p className="bench-subtitle">
            <T
              en="Specialist: 100KG Bench Press · Squat: 404 Not Found · Deadlift: Loading..."
              zh="专注卧推 100KG · 深蹲: 404 Not Found · 硬拉: Loading... (合法逃避练腿)"
            />
          </p>
        </div>
        <div className="bench-readout">
          <span className="bench-weight-num">{current.total}</span>
          <span className="bench-weight-unit">KG</span>
          <span className="bench-lbs">({(current.total * 2.20462).toFixed(0)} LBS)</span>
        </div>
      </div>

      {/* 交互式奥林匹克标准杠铃杆渲染 */}
      <div className="barbell-stage" onClick={() => handleSelect((selectedIdx + 1) % PRESETS.length)}>
        <div className={`barbell-assembly ${current.total >= 100 ? "is-heavy" : ""}`}>
          {/* 左杠铃套筒与片 */}
          <div className="bar-sleeve sleeve-left">
            <span className="collar-stop" />
            <div className="plates-rack plates-left">
              {current.plates.map((p, i) => (
                <span
                  key={`${p}-${i}`}
                  className={`plate plate-${p}`}
                  title={`${p}KG`}
                >
                  <span className="plate-inner">{p}</span>
                </span>
              ))}
            </div>
            {current.plates.length > 0 && <span className="spring-collar" title="Spring collar" />}
          </div>

          {/* 杠铃杆核心（带滚花压花抓握标记） */}
          <div className="bar-shaft">
            <span className="knurling knurl-left" />
            <span className="knurl-ring ring-1" />
            <span className="knurling knurl-center" />
            <span className="knurl-ring ring-2" />
            <span className="knurling knurl-right" />
          </div>

          {/* 右杠铃套筒与片 */}
          <div className="bar-sleeve sleeve-right">
            <span className="collar-stop" />
            <div className="plates-rack plates-right">
              {current.plates.map((p, i) => (
                <span
                  key={`${p}-${i}`}
                  className={`plate plate-${p}`}
                  title={`${p}KG`}
                >
                  <span className="plate-inner">{p}</span>
                </span>
              ))}
            </div>
            {current.plates.length > 0 && <span className="spring-collar" title="Spring collar" />}
          </div>
        </div>

        <p className="barbell-hint">
          <T en="Click barbell or buttons below to load weight ↓" zh="点击杠铃或下方按钮装填配重 ↓" />
        </p>
      </div>

      {/* 挡位选择器与极客彩蛋徽章 */}
      <div className="bench-controls">
        <div className="bench-presets">
          {PRESETS.map((preset, idx) => (
            <button
              key={preset.total}
              type="button"
              className={idx === selectedIdx ? "bench-preset-btn is-active" : "bench-preset-btn"}
              onClick={() => handleSelect(idx)}
            >
              <span className="preset-weight">
                {locale === "zh" ? preset.labelZh : preset.label}
              </span>
            </button>
          ))}
        </div>

        {/* 100KG 专属彩蛋横幅 */}
        {current.total >= 100 && (
          <div className="bench-pr-badge">
            <span className="pr-sparkle">✦</span>
            <span className="pr-text">
              <T
                en="100KG Club Member · Leg Day Avoidance: 100% · ≈ Lifting 12 Mac Pros"
                zh="卧推破百达成 · 腿部逃避率: 100% · 相当于徒手推起 12 台 Mac Pro"
              />
            </span>
          </div>
        )}
      </div>
    </article>
  );
}
