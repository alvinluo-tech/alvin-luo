"use client";

/* ============================================================
 * PassportStamp — 11国复古海关出入境印章系统
 *
 * 拟物物化：将尚未拍摄真实照片的 37 个旅行足迹
 * 从原本简陋的「把照片放进 public/travel/xx.webp」占位文本，
 * 进化为极具收藏感与质感的「数字护照出入境海关查验印章（Visa Stamp）」。
 *
 * 设计特征：
 * · 每个国家有专属官方出入境印章形制（双环圆章、八角防伪章、申根椭圆章、国徽角章）
 * · 4 种复古印泥色泽（赤红、青蓝、墨绿、紫罗兰），带轻微自然摆角 (±3°)
 * · 护照防伪底纹纸面（Guilloche Security Watermark Pattern）
 * · 包含出入境口岸三字代码、日期戳记与航空离境符号 ✈
 * ============================================================ */

import { type Trip } from "@/data/trips";

type StampTheme = {
  authorityZh: string;
  authorityEn: string;
  shape: "circle" | "octagon" | "rect" | "oval";
  colorClass: string;
  codePrefix: string;
};

const COUNTRY_STAMP_THEMES: Record<string, StampTheme> = {
  "中国": {
    authorityZh: "中国边防检查",
    authorityEn: "CHINA IMMIGRATION",
    shape: "rect",
    colorClass: "stamp-red",
    codePrefix: "CN",
  },
  "英国": {
    authorityZh: "英国边境署",
    authorityEn: "UK BORDER FORCE",
    shape: "octagon",
    colorClass: "stamp-purple",
    codePrefix: "GB",
  },
  "新加坡": {
    authorityZh: "新加坡移民局",
    authorityEn: "IMMIGRATION SINGAPORE",
    shape: "circle",
    colorClass: "stamp-blue",
    codePrefix: "SG",
  },
  "马来西亚": {
    authorityZh: "马来西亚入境处",
    authorityEn: "IMMIGRATION MALAYSIA",
    shape: "circle",
    colorClass: "stamp-blue",
    codePrefix: "MY",
  },
  "泰国": {
    authorityZh: "泰国移民局查验",
    authorityEn: "ROYAL THAI IMMIGRATION",
    shape: "rect",
    colorClass: "stamp-green",
    codePrefix: "TH",
  },
  "法国": {
    authorityZh: "法国边境警察",
    authorityEn: "POLICE AUX FRONTIÈRES",
    shape: "oval",
    colorClass: "stamp-blue",
    codePrefix: "FR",
  },
  "西班牙": {
    authorityZh: "西班牙国家警察",
    authorityEn: "ESPAÑA · FRONTERAS",
    shape: "oval",
    colorClass: "stamp-red",
    codePrefix: "ES",
  },
  "冰岛": {
    authorityZh: "冰岛边防检查",
    authorityEn: "ÍSLAND LANDAMÆRI",
    shape: "octagon",
    colorClass: "stamp-blue",
    codePrefix: "IS",
  },
  "摩洛哥": {
    authorityZh: "摩洛哥国家安全局",
    authorityEn: "SÛRETÉ NATIONALE MAROC",
    shape: "rect",
    colorClass: "stamp-green",
    codePrefix: "MA",
  },
  "意大利": {
    authorityZh: "意大利边境警察",
    authorityEn: "POLIZIA DI STATO",
    shape: "oval",
    colorClass: "stamp-green",
    codePrefix: "IT",
  },
  "马耳他": {
    authorityZh: "马耳他边境警务",
    authorityEn: "MALTA BORDER FORCE",
    shape: "circle",
    colorClass: "stamp-red",
    codePrefix: "MT",
  },
};

export default function PassportStamp({ trip }: { trip: Trip }) {
  const theme = COUNTRY_STAMP_THEMES[trip.country] ?? {
    authorityZh: "入境查验",
    authorityEn: "BORDER CONTROL",
    shape: "rect",
    colorClass: "stamp-red",
    codePrefix: "VISA",
  };

  // 根据 trip.img 稳定生成一个微小随机旋转倾角 (-3deg ~ +3deg)
  const seed = parseInt(trip.img, 10) || 5;
  const rotation = ((seed * 7) % 7) - 3;

  const cityName = trip.place.split(" ")[0];
  const dateStr = trip.dateEn || trip.date;
  const visaSerial = `${theme.codePrefix}-${trip.img.padStart(3, "0")}`;

  return (
    <div className="passport-visa-page" aria-label={`海关出入境签注: ${trip.place}`}>
      {/* 护照防伪底纹图案 */}
      <div className="passport-security-pattern" aria-hidden="true" />

      {/* 实体印泥印章主体 */}
      <div
        className={`passport-stamp ${theme.shape} ${theme.colorClass}`}
        style={{ "--rot": `${rotation}deg` } as React.CSSProperties}
      >
        <div className="stamp-inner-border">
          {/* 顶栏官方署名 */}
          <div className="stamp-header">
            <span className="stamp-authority">{theme.authorityEn}</span>
          </div>

          {/* 核心口岸城市与飞机离境标志 */}
          <div className="stamp-center">
            <span className="stamp-plane" aria-hidden="true">✈</span>
            <span className="stamp-city">{cityName}</span>
            <span className="stamp-type">ENTRY</span>
          </div>

          {/* 日期戳记与签证编号 */}
          <div className="stamp-footer">
            <span className="stamp-date">{dateStr}</span>
            <span className="stamp-code">{visaSerial}</span>
          </div>
        </div>
      </div>

      <span className="passport-page-num" aria-hidden="true">
        PAGE {trip.img}
      </span>
    </div>
  );
}
