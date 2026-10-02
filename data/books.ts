/* ============================================================
 * 书架数据 —— 唯一数据源
 *
 * 首页书架瓷砖（BookshelfTile）与 /year 年度报告书架卡共用。
 *
 * color 为书脊底色，深浅不限 —— BookshelfTile 会按对比度自动决定
 * 书脊文字用纸白还是墨色，不必手动指定。
 * 建议相邻书脊拉开明度（深浅交替），整排才不会读成一个色块。
 * ============================================================ */

export type Book = {
  /** 展示标题（书脊竖排） */
  title: string;
  /** 原文名 / 中文名 —— 与 title 互补，作为悬停卡的次级信息 */
  en: string;
  /** 作者 */
  author: string;
  /** 出版年（可选，留空则不显示） */
  year?: string;
  /** 书脊底色 */
  color: string;
  /** 一句批注（悬停卡主体内容） */
  note: string;
  /** 推荐指数 1-5 */
  stars: number;
  /** 标记「正在读」：书脊拉出主位 + 荧光绿标识，确保视觉有落点 */
  reading?: boolean;
  /** 在读进度 0-100（可选，仅 reading 时有意义）：悬停卡显示进度条 */
  progress?: number;
  /** 可选外链（豆瓣 / 出版社页）。有值时悬停卡出现「查看详情 ↗」 */
  link?: string;
};

export const BOOKS: Book[] = [
  {
    title: "黑客与画家",
    en: "Hackers & Painters",
    author: "Paul Graham",
    year: "2004",
    color: "#3d4a2a",
    note: "程序员是数字时代的匠人，创造和画画一样是设计。",
    stars: 5,
  },
  {
    title: "Atomic Habits",
    en: "掌控习惯",
    author: "James Clear",
    year: "2018",
    /* 浅色书脊：在整排深色中提供一个视觉停顿点 */
    color: "#cfd6a8",
    note: "1% 的每天进步——健身和写代码都吃这一套。",
    stars: 5,
  },
  {
    title: "设计心理学",
    en: "The Design of Everyday Things",
    author: "Don Norman",
    year: "1988",
    /* 中调色：纸白字只有 3.2:1 不达 AA，组件会自动改用墨色字（5.5:1） */
    color: "#8a8f5a",
    note: "好的设计是让人感觉不到设计。代码同理。",
    stars: 4,
  },
  {
    title: "纳瓦尔宝典",
    en: "The Almanack of Naval Ravikant",
    author: "Eric Jorgenson",
    year: "2020",
    color: "#2f3524",
    note: "用杠杆思考：代码、媒体、资本，都是复利的燃料。",
    stars: 4,
  },
  {
    title: "The Pragmatic Programmer",
    en: "程序员修炼之道",
    author: "Andrew Hunt & David Thomas",
    year: "1999",
    /* 最浅的一本：与相邻的深色书脊形成最强对比 */
    color: "#dcdcc8",
    note: "Care about your craft。每年学一门新语言。",
    stars: 5,
    /* 唯一「正在读」：书架需要一个视觉落点，否则五本等重没有入口。
       这类字段应始终只有一本为 true —— 多于一本就失去「主位」的意义 */
    reading: true,
    progress: 62,
  },
];
