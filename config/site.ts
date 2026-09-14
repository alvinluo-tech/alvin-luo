/* ============================================================
   站点配置：把需要你个人信息的地方都集中在这里，改这一个文件即可
   （项目数据在 data/projects.ts，书架在 data/books.ts，旅行在 data/trips.ts）
   ============================================================ */

export const SITE_URL = "https://alvin-luo.me";

/** GitHub 用户名 —— 控制 GitHub 热力图瓷砖；保持占位值则显示提示框 */
export const GITHUB_USER: string = "alvinluo-tech";

/** GitHub 主页链接 —— 导航 / ⌘K 面板 / Hero 按钮统一从这里取 */
export const GITHUB_URL = `https://github.com/${GITHUB_USER}`;

/** 联系邮箱 —— Bento 的 SAY HELLO 瓷砖 / 终端瓷砖 contact 命令 */
export const EMAIL = "luoyaosheng123@gmail.com";

/** 年度报告年份 —— /year 页、OG 海报、终端命令共用这一个常量 */
export const REPORT_YEAR = "2026";

/** 导航活态指示器：你的所在城市与时区（访客看到的时钟以你为准） */
export const LIVE_STATUS = {
  city: "DURHAM",
  timeZone: "Europe/London",
};

/** 网易云 NOW PLAYING 数据源（netease-now-playing 项目部署后的地址）
 *  base 和 key 都填上才启用；留空则音乐瓷砖整体隐藏 */
export const NETEASE_API = {
  base: "https://netease-api-ruby.vercel.app", // 如 "https://你的项目.vercel.app"（不带末尾斜杠）
  key: "1722aaefad7e456c4091617bbd21f43e", // 服务端 API_KEY 环境变量的值
};
