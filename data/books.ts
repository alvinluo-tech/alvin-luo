/* ============================================================
 * 书架数据 —— 唯一数据源
 *
 * 首页书架瓷砖（BookshelfTile）与 /year 年度报告书架卡共用。
 * color 为书脊底色（深绿/橄榄系手作调），stars 1-5 推荐指数。
 * ============================================================ */

export type Book = {
  /** 展示标题（书脊竖排） */
  title: string;
  /** 备用名/中文名 */
  en: string;
  /** 书脊底色 */
  color: string;
  /** 一句批注（hover 抽出时显示） */
  note: string;
  /** 推荐指数 1-5 */
  stars: number;
};

export const BOOKS: Book[] = [
  {
    title: "黑客与画家",
    en: "Hackers & Painters",
    color: "#3d4a2a",
    note: "程序员是数字时代的匠人，创造和画画一样是设计。",
    stars: 5,
  },
  {
    title: "Atomic Habits",
    en: "掌控习惯",
    color: "#6b6f3f",
    note: "1% 的每天进步——健身和写代码都吃这一套。",
    stars: 5,
  },
  {
    title: "设计心理学",
    en: "DoET",
    color: "#8a8f5a",
    note: "好的设计是让人感觉不到设计。代码同理。",
    stars: 4,
  },
  {
    title: "纳瓦尔宝典",
    en: "Almanack",
    color: "#2f3524",
    note: "用杠杆思考：代码、媒体、资本，都是复利的燃料。",
    stars: 4,
  },
  {
    title: "The Pragmatic Programmer",
    en: "程序员修炼之道",
    color: "#544a1e",
    note: "Care about your craft。每年学一门新语言。",
    stars: 5,
  },
];
