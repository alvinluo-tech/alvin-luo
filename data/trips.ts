/* ============================================================
 * 旅行数据 —— 唯一数据源
 *
 * 首页胶片：只显示 featured: true 的站（不足 3 站时回退为前 8 站）
 * /travel 归档页：显示全部，可按国家筛选
 *
 * 加一条记录 = 加一个对象；照片命名对应 public/travel/{img}.jpg
 * 中文为默认字段；noteEn/countryEn/dateEn 为英文模式显示值
 * ============================================================ */

export type Trip = {
  img: string; // public/travel/{img}.jpg
  country: string;
  countryEn?: string;
  place: string;
  date: string;
  dateEn?: string;
  note: string;
  noteEn?: string;
  coord: [number, number]; // [lng, lat] —— 归档页地图脉冲点
  featured?: boolean; // 是否上首页胶片
};

export const TRIPS: Trip[] = [
  {
    img: "01",
    country: "日本",
    countryEn: "Japan",
    place: "东京 TOKYO",
    date: "2024 · 春",
    dateEn: "Spring 2024",
    note: "第一次一个人出国",
    noteEn: "First solo trip abroad",
    coord: [139.69, 35.68],
    featured: true,
  },
  {
    img: "02",
    country: "韩国",
    countryEn: "Korea",
    place: "首尔 SEOUL",
    date: "2024 · 秋",
    dateEn: "Autumn 2024",
    note: "算法和烤肉都不好消化",
    noteEn: "Algorithms and BBQ — neither digests well",
    coord: [126.98, 37.57],
    featured: true,
  },
  {
    img: "03",
    country: "泰国",
    countryEn: "Thailand",
    place: "清迈 CHIANG MAI",
    date: "2025 · 夏",
    dateEn: "Summer 2025",
    note: "古城骑车，后座是笔记本电脑",
    noteEn: "Cruising the old town, laptop on the back seat",
    coord: [98.98, 18.79],
    featured: true,
  },
  {
    img: "04",
    country: "中国",
    countryEn: "China",
    place: "大理 DALI",
    date: "2025 · 秋",
    dateEn: "Autumn 2025",
    note: "洱海边写代码，风比风扇好用",
    noteEn: "Coding by the lake — the breeze beats any fan",
    coord: [100.16, 25.69],
    featured: true,
  },
  {
    img: "05",
    country: "中国",
    countryEn: "China",
    place: "青岛 QINGDAO",
    date: "2026 · 夏",
    dateEn: "Summer 2026",
    note: "红瓦绿树，啤酒要袋装",
    noteEn: "Red roofs, green trees, beer in a plastic bag",
    coord: [120.38, 36.07],
    featured: true,
  },
  // TODO: 继续往下加你的足迹，例如：
  // { img: "06", country: "新加坡", countryEn: "Singapore", place: "新加坡 SINGAPORE", date: "2026 · 冬", dateEn: "Winter 2026", note: "花园城市的空调冷得像冬天", noteEn: "Garden city, walk-in freezer AC", featured: true },
];

/** 国家显示名：英文模式优先用 countryEn（国家名是数据，UI 按 locale 取） */
export function countryLabel(trip: Trip, locale: "en" | "zh") {
  return locale === "en" ? (trip.countryEn ?? trip.country) : trip.country;
}

/** 日期显示 */
export function dateLabel(trip: Trip, locale: "en" | "zh") {
  return locale === "en" ? (trip.dateEn ?? trip.date) : trip.date;
}
