/* 精神食粮书架：CSS 3D 书脊，hover 抽出一半露出批注与推荐指数
   BOOKS 同时被 /year 年度报告书架卡复用 */
export const BOOKS = [
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

export default function BookshelfTile() {
  return (
    <article className="tile tile-books">
      <h3 className="tile-title">BOOKSHELF — 精神食粮</h3>
      <div className="shelf-scene" aria-label="推荐书架">
        <div className="shelf-row">
          {BOOKS.map((b) => (
            <div className="book" key={b.title} tabIndex={0}>
              <span className="book-spine" style={{ background: b.color }}>
                <span className="book-title">{b.title}</span>
              </span>
              <span className="book-note">
                <b>{b.title}</b>
                <i>{b.note}</i>
                <em aria-label={`${b.stars} 星推荐`}>
                  {"★".repeat(b.stars)}
                  {"☆".repeat(5 - b.stars)}
                </em>
              </span>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}
