/* 精神食粮书架：CSS 3D 书脊，hover 抽出一半露出批注与推荐指数
   数据在 data/books.ts（与 /year 年度报告书架卡共用） */
import { BOOKS } from "@/data/books";

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
