"use client";

/* ============================================================
 * BenchPressTile — 卧推 100KG 破百俱乐部交互玩具
 *
 * 拟物物理感升级：
 * · 标准奥林匹克 20KG 杠铃杆
 * · 4 档快捷预设（20/60/80/100KG）+ 自由配重片架（+20/+15/+10/+5/+2.5KG）
 * · 单独点击杠铃杆上的片可卸载该片，伴随清脆金属碰撞音效 (playMetalClank)
 * · 动态弯曲阻尼：根据当前配重触发不同弯曲动画与 PR 徽章
 * ============================================================ */

import { useState } from "react";
import { T, useLocale } from "./i18n";
import { playMetalClank, playClick } from "@/lib/sfx";
import "./BenchPressTile.css";

export type PlateWeight = 20 | 15 | 10 | 5 | 2.5;

const PRESETS: { label: string; labelZh: string; total: number; plates: PlateWeight[] }[] = [
  { label: "20KG", labelZh: "20KG 空杆", total: 20, plates: [] },
  { label: "60KG", labelZh: "60KG 热身", total: 60, plates: [20] },
  { label: "80KG", labelZh: "80KG 进阶", total: 80, plates: [20, 10] },
  { label: "100KG", labelZh: "100KG 破百!", total: 100, plates: [20, 20] },
];

const RACK_PLATES: { weight: PlateWeight; color: string; label: string }[] = [
  { weight: 20, color: "red", label: "20" },
  { weight: 15, color: "yellow", label: "15" },
  { weight: 10, color: "green", label: "10" },
  { weight: 5, color: "white", label: "5" },
  { weight: 2.5, color: "black", label: "2.5" },
];

export default function BenchPressTile() {
  const { locale } = useLocale();
  // 左右单侧装载的片（数组，例如 [20, 20] 表示单侧两块 20KG）
  const [plates, setPlates] = useState<PlateWeight[]>([20, 20]); // 默认 100KG 破百

  // 总重量 = 杠铃空杆 20KG + 双侧片重量
  const totalWeight = 20 + plates.reduce((sum, p) => sum + p * 2, 0);

  // 加片（两侧对称添加，单侧最多 6 片防止视觉越界）
  const addPlate = (weight: PlateWeight) => {
    if (plates.length >= 6) {
      playClick(800);
      return;
    }
    const next = [...plates, weight].sort((a, b) => b - a);
    setPlates(next);
    const newTotal = 20 + next.reduce((sum, p) => sum + p * 2, 0);
    if (newTotal >= 100) {
      playMetalClank();
    } else {
      playClick(1600);
    }
  };

  // 卸载单片（点击杠铃上的片触发）
  const removePlate = (idx: number) => {
    const next = plates.filter((_, i) => i !== idx);
    setPlates(next);
    playClick(1200);
  };

  // 选择预设
  const selectPreset = (targetPlates: PlateWeight[]) => {
    setPlates(targetPlates);
    const newTotal = 20 + targetPlates.reduce((sum, p) => sum + p * 2, 0);
    if (newTotal >= 100) {
      playMetalClank();
    } else {
      playClick(1400);
    }
  };

  // 清空还原为空杆
  const resetBar = () => {
    setPlates([]);
    playClick(900);
  };

  // 弯曲度阶梯样式
  const barWhipClass =
    totalWeight >= 140
      ? "is-monster"
      : totalWeight >= 100
        ? "is-heavy"
        : totalWeight >= 60
          ? "is-medium"
          : "";

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
          <span className="bench-weight-num">{totalWeight}</span>
          <span className="bench-weight-unit">KG</span>
          <span className="bench-lbs">({Math.round(totalWeight * 2.20462)} LBS)</span>
        </div>
      </div>

      {/* 交互式奥林匹克标准杠铃杆渲染 */}
      <div className="barbell-stage" title={locale === "zh" ? "点击杠铃上的片可卸下" : "Click loaded plate to unload"}>
        <div className={`barbell-assembly ${barWhipClass}`}>
          {/* 左杠铃套筒与片 */}
          <div className="bar-sleeve sleeve-left">
            <span className="collar-stop" />
            <div className="plates-rack plates-left">
              {plates.map((p, i) => (
                <button
                  key={`left-${p}-${i}`}
                  type="button"
                  className={`plate plate-${String(p).replace(".", "_")}`}
                  title={`${p}KG (点击卸下)`}
                  onClick={(e) => {
                    e.stopPropagation();
                    removePlate(i);
                  }}
                >
                  <span className="plate-inner">{p}</span>
                </button>
              ))}
            </div>
            {plates.length > 0 && <span className="spring-collar" title="Spring collar" />}
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
              {plates.map((p, i) => (
                <button
                  key={`right-${p}-${i}`}
                  type="button"
                  className={`plate plate-${String(p).replace(".", "_")}`}
                  title={`${p}KG (点击卸下)`}
                  onClick={(e) => {
                    e.stopPropagation();
                    removePlate(i);
                  }}
                >
                  <span className="plate-inner">{p}</span>
                </button>
              ))}
            </div>
            {plates.length > 0 && <span className="spring-collar" title="Spring collar" />}
          </div>
        </div>

        <p className="barbell-hint">
          <T
            en="Click plates to add / click bar plates to unload ↓"
            zh="点击下方配重片装填 · 点击杠上片卸下 ↓"
          />
        </p>
      </div>

      {/* 实体配重架与挡位选择器 */}
      <div className="bench-controls">
        {/* 自由加片实体配重架 */}
        <div className="bench-plate-rack" aria-label="配重架">
          <span className="plate-rack-label">
            <T en="LOAD" zh="装载" />:
          </span>
          {RACK_PLATES.map((rp) => (
            <button
              key={rp.weight}
              type="button"
              className={`rack-plate-btn rack-color-${rp.color}`}
              onClick={() => addPlate(rp.weight)}
              title={`+ ${rp.weight * 2}KG (${rp.weight}KG x 2)`}
            >
              <span className="rack-plus">+</span>
              <span className="rack-num">{rp.weight}</span>
              <span className="rack-unit">KG</span>
            </button>
          ))}
          <button
            type="button"
            className="rack-plate-btn rack-reset-btn"
            onClick={resetBar}
            title={locale === "zh" ? "清空回 20KG 空杆" : "Reset to 20KG Bar"}
          >
            <T en="Clear" zh="清空" />
          </button>
        </div>

        {/* 经典预设档位 */}
        <div className="bench-presets">
          {PRESETS.map((preset) => {
            const isMatch = preset.total === totalWeight;
            return (
              <button
                key={preset.total}
                type="button"
                className={isMatch ? "bench-preset-btn is-active" : "bench-preset-btn"}
                onClick={() => selectPreset(preset.plates)}
              >
                <span className="preset-weight">
                  {locale === "zh" ? preset.labelZh : preset.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* 100KG 专属彩蛋横幅 */}
        {totalWeight >= 100 && (
          <div className={`bench-pr-badge ${totalWeight >= 140 ? "is-monster-pr" : ""}`}>
            <span className="pr-sparkle">✦</span>
            <span className="pr-text">
              {totalWeight >= 140 ? (
                <T
                  en={`MONSTER WEIGHT: ${totalWeight}KG! You just lifted an adult panda!`}
                  zh={`怪兽级配重: ${totalWeight}KG! 相当于徒手推起一头成年大熊猫！`}
                />
              ) : (
                <T
                  en="100KG Club Member · Leg Day Avoidance: 100% · ≈ Lifting 12 Mac Pros"
                  zh="卧推破百达成 · 腿部逃避率: 100% · 相当于徒手推起 12 台 Mac Pro"
                />
              )}
            </span>
          </div>
        )}
      </div>
    </article>
  );
}
