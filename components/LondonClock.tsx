"use client";

import { useEffect, useState } from "react";

/* 伦敦实时时间 + 状态胶囊：让人看出这是一个在某个经纬度自律生活的活人 */
const STATUS: { from: number; to: number; en: string; zh: string }[] = [
  { from: 0, to: 6, en: "Recharging (asleep)", zh: "充电中（睡觉）" },
  { from: 6, to: 9, en: "Morning gym session", zh: "晨练撸铁" },
  { from: 9, to: 12, en: "Building things", zh: "构建产品中" },
  { from: 12, to: 14, en: "Lunch & a walk", zh: "午饭 + 散步" },
  { from: 14, to: 19, en: "Deep in the code mines", zh: "代码矿井深处" },
  { from: 19, to: 23, en: "Side quests & reading", zh: "支线任务 + 阅读" },
  { from: 23, to: 24, en: "Recharging (asleep)", zh: "充电中（睡觉）" },
];

export default function LondonClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 20_000);
    return () => clearInterval(id);
  }, []);

  // 服务端与首帧客户端渲染占位，避免 hydration 不匹配
  const time = now
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/London",
        hour: "2-digit",
        minute: "2-digit",
      }).format(now)
    : "--:--";
  const hour = now
    ? Number(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: "Europe/London",
          hour: "2-digit",
          // h23 固定 0-23；部分引擎对 hour12:false 会输出 "24"，导致状态句落到兜底分支
          hourCycle: "h23",
        }).format(now),
      )
    : 12;
  const status = STATUS.find((s) => hour >= s.from && hour < s.to) ?? STATUS[2];

  return (
    <p className="london-clock" suppressHydrationWarning>
      <span className="lc-dot" aria-hidden="true" />
      <b>DURHAM {time}</b>
      <span className="lc-status">
        {now ? (
          <>
            · <span className="cn">{status.zh}</span> / {status.en}
          </>
        ) : (
          "· …"
        )}
      </span>
    </p>
  );
}
