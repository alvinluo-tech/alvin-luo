"use client";

/* CURRENTLY 瓷砖里的彩蛋行：今天算法推给我的歌。
   数据源未配置 / 拿不到数据 → 不渲染 */

import { useEffect, useState } from "react";
import { getDailyPicks, isMusicConfigured, type DailyPickSong } from "@/lib/music";
import { T } from "./i18n";

export default function DailyPick() {
  const [pick, setPick] = useState<DailyPickSong | null>(null);

  useEffect(() => {
    if (!isMusicConfigured()) return;
    let alive = true;
    getDailyPicks().then((d) => {
      const s = d?.songs?.[0];
      if (alive && s?.name) setPick(s);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!pick) return null;

  return (
    <li className="daily-pick">
      <T en="Today the algorithm picks:" zh="算法今天推给我：" /> {pick.name}
      {pick.artist ? ` — ${pick.artist}` : ""}
    </li>
  );
}
