/* ============================================================
 * 旅行数据 —— 唯一数据源
 *
 * 首页胶片：只显示 featured: true 的站（不足 3 站时回退为前 8 站）
 * /travel 归档页：显示全部，可按国家筛选
 *
 * 2026-09 按实际到访清单重写（11 国 38 站）。
 * date/note 留空 = 待补（不编造）；照片缺失时卡片自动显示
 * 「Drop your photo at public/travel/{img}.jpg」占位。
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
  hasPhoto?: boolean; // 照片文件是否已就位（缺省则自动查询 AVAILABLE_PHOTOS）
};

/** 现已存放在 public/travel/ 中的照片编号（新照片放入 public/travel/{img}.jpg 后在此登记，杜绝浏览器 404） */
export const AVAILABLE_PHOTOS = new Set<string>(["05"]);

export function hasTripPhoto(trip: Trip): boolean {
  return trip.hasPhoto ?? AVAILABLE_PHOTOS.has(trip.img);
}

export const TRIPS: Trip[] = [
  /* ---------- 中国 ---------- */
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
  {
    img: "06",
    country: "中国",
    countryEn: "China",
    place: "广州 GUANGZHOU",
    date: "",
    note: "",
    coord: [113.26, 23.13],
  },
  {
    img: "07",
    country: "中国",
    countryEn: "China",
    place: "九江 JIUJIANG",
    date: "",
    note: "",
    coord: [116.0, 29.71],
  },
  {
    img: "08",
    country: "中国",
    countryEn: "China",
    place: "北京 BEIJING",
    date: "",
    note: "",
    coord: [116.4, 39.9],
    featured: true,
  },
  {
    img: "09",
    country: "中国",
    countryEn: "China",
    place: "西双版纳 XISHUANGBANNA",
    date: "",
    note: "",
    coord: [100.8, 22.0],
  },
  {
    img: "10",
    country: "中国",
    countryEn: "China",
    place: "香格里拉 SHANGRI-LA",
    date: "",
    note: "",
    coord: [99.71, 27.83],
    featured: true,
  },
  {
    img: "11",
    country: "中国",
    countryEn: "China",
    place: "雨崩 YUBENG",
    date: "",
    note: "",
    coord: [98.86, 28.38],
  },
  {
    img: "12",
    country: "中国",
    countryEn: "China",
    place: "昆明 KUNMING",
    date: "",
    note: "",
    coord: [102.83, 24.88],
  },
  {
    img: "13",
    country: "中国",
    countryEn: "China",
    place: "南昌 NANCHANG",
    date: "",
    note: "",
    coord: [115.89, 28.68],
  },
  {
    img: "14",
    country: "中国",
    countryEn: "China",
    place: "汕头 SHANTOU",
    date: "",
    note: "",
    coord: [116.68, 23.35],
  },
  {
    img: "15",
    country: "中国",
    countryEn: "China",
    place: "深圳 SHENZHEN",
    date: "",
    note: "",
    coord: [114.06, 22.55],
  },

  /* ---------- 新加坡 ---------- */
  {
    img: "16",
    country: "新加坡",
    countryEn: "Singapore",
    place: "新加坡 SINGAPORE",
    date: "",
    note: "",
    coord: [103.82, 1.35],
    featured: true,
  },

  /* ---------- 马来西亚 ---------- */
  {
    img: "17",
    country: "马来西亚",
    countryEn: "Malaysia",
    place: "吉隆坡 KUALA LUMPUR",
    date: "",
    note: "",
    coord: [101.69, 3.14],
    featured: true,
  },
  {
    img: "18",
    country: "马来西亚",
    countryEn: "Malaysia",
    place: "仙本那 SEMPORNA",
    date: "",
    note: "",
    coord: [118.61, 4.48],
  },

  /* ---------- 泰国 ---------- */
  {
    img: "19",
    country: "泰国",
    countryEn: "Thailand",
    place: "合艾 HAT YAI",
    date: "",
    note: "",
    coord: [100.13, 7.01],
  },

  /* ---------- 英国 ---------- */
  {
    img: "20",
    country: "英国",
    countryEn: "United Kingdom",
    place: "爱丁堡 EDINBURGH",
    date: "",
    note: "",
    coord: [-3.19, 55.95],
  },
  {
    img: "21",
    country: "英国",
    countryEn: "United Kingdom",
    place: "伦敦 LONDON",
    date: "",
    note: "",
    coord: [-0.13, 51.51],
    featured: true,
  },
  {
    img: "22",
    country: "英国",
    countryEn: "United Kingdom",
    place: "利兹 LEEDS",
    date: "",
    note: "",
    coord: [-1.55, 53.8],
  },
  {
    img: "23",
    country: "英国",
    countryEn: "United Kingdom",
    place: "湖区 LAKE DISTRICT",
    date: "",
    note: "",
    coord: [-3.13, 54.6],
  },
  {
    img: "24",
    country: "英国",
    countryEn: "United Kingdom",
    place: "杜伦 DURHAM",
    date: "",
    note: "",
    coord: [-1.58, 54.78],
  },

  /* ---------- 西班牙 ---------- */
  {
    img: "25",
    country: "西班牙",
    countryEn: "Spain",
    place: "巴塞罗那 BARCELONA",
    date: "",
    note: "",
    coord: [2.17, 41.39],
    featured: true,
  },
  {
    img: "26",
    country: "西班牙",
    countryEn: "Spain",
    place: "帕尔马 PALMA",
    date: "",
    note: "",
    coord: [2.65, 39.57],
  },
  {
    img: "27",
    country: "西班牙",
    countryEn: "Spain",
    place: "拉斯帕尔马斯 LAS PALMAS",
    date: "",
    note: "",
    coord: [-15.44, 28.12],
  },
  {
    img: "28",
    country: "西班牙",
    countryEn: "Spain",
    place: "马德里 MADRID",
    date: "",
    note: "",
    coord: [-3.7, 40.42],
  },

  /* ---------- 冰岛 ---------- */
  {
    img: "29",
    country: "冰岛",
    countryEn: "Iceland",
    place: "雷克雅未克 REYKJAVÍK",
    date: "",
    note: "",
    coord: [-21.94, 64.15],
    featured: true,
  },

  /* ---------- 法国 ---------- */
  {
    img: "30",
    country: "法国",
    countryEn: "France",
    place: "巴黎 PARIS",
    date: "",
    note: "",
    coord: [2.35, 48.86],
    featured: true,
  },
  {
    img: "31",
    country: "法国",
    countryEn: "France",
    place: "尼斯 NICE",
    date: "",
    note: "",
    coord: [7.26, 43.71],
  },
  {
    img: "32",
    country: "法国",
    countryEn: "France",
    place: "马赛 MARSEILLE",
    date: "",
    note: "",
    coord: [5.37, 43.3],
  },

  /* ---------- 摩洛哥 ---------- */
  {
    img: "33",
    country: "摩洛哥",
    countryEn: "Morocco",
    place: "撒哈拉沙漠 SAHARA",
    date: "",
    note: "",
    coord: [-4.0, 31.1],
    featured: true,
  },
  {
    img: "34",
    country: "摩洛哥",
    countryEn: "Morocco",
    place: "马拉喀什 MARRAKECH",
    date: "",
    note: "",
    coord: [-7.99, 31.63],
  },

  /* ---------- 意大利 ---------- */
  {
    img: "35",
    country: "意大利",
    countryEn: "Italy",
    place: "那不勒斯 NAPLES",
    date: "",
    note: "",
    coord: [14.25, 40.85],
    featured: true,
  },
  {
    img: "36",
    country: "意大利",
    countryEn: "Italy",
    place: "索伦托 SORRENTO",
    date: "",
    note: "",
    coord: [14.43, 40.63],
  },
  {
    img: "37",
    country: "意大利",
    countryEn: "Italy",
    place: "波西塔塔 POSITANO",
    date: "",
    note: "",
    coord: [14.49, 40.63],
  },
  {
    img: "38",
    country: "意大利",
    countryEn: "Italy",
    place: "卡普里 CAPRI",
    date: "",
    note: "",
    coord: [14.24, 40.55],
  },
  {
    img: "39",
    country: "意大利",
    countryEn: "Italy",
    place: "陶尔米纳 TAORMINA",
    date: "",
    note: "",
    coord: [15.29, 37.85],
  },
  {
    img: "40",
    country: "意大利",
    countryEn: "Italy",
    place: "切法卢 CEFALÙ",
    date: "",
    note: "",
    coord: [14.02, 38.04],
  },
  {
    img: "41",
    country: "意大利",
    countryEn: "Italy",
    place: "巴勒莫 PALERMO",
    date: "",
    note: "",
    coord: [13.36, 38.12],
  },

  /* ---------- 马耳他 ---------- */
  {
    img: "42",
    country: "马耳他",
    countryEn: "Malta",
    place: "瓦莱塔 VALLETTA",
    date: "",
    note: "",
    coord: [14.51, 35.9],
  },
];

/** 国家显示名：英文模式优先用 countryEn（国家名是数据，UI 按 locale 取） */
export function countryLabel(trip: Trip, locale: "en" | "zh") {
  return locale === "en" ? (trip.countryEn ?? trip.country) : trip.country;
}

/** 日期显示 */
export function dateLabel(trip: Trip, locale: "en" | "zh") {
  return locale === "en" ? (trip.dateEn ?? trip.date) : trip.date;
}
