/* ============================================================
   站点配置：把需要你个人信息的地方都集中在这里，改这一个文件即可
   ============================================================ */

export const SITE_URL = "https://alvin-luo.me";

/** GitHub 用户名 —— 控制 GitHub 热力图瓷砖；保持占位值则显示提示框 */
export const GITHUB_USER: string = "alvinluo-tech";

/** GitHub 主页链接 —— 导航 / ⌘K 面板 / Hero 按钮统一从这里取 */
export const GITHUB_URL = `https://github.com/${GITHUB_USER}`;

/** 联系邮箱 —— Bento 的 SAY HELLO 瓷砖 */
export const EMAIL = "you@example.com";

/** 网易云 NOW PLAYING 数据源（netease-now-playing 项目部署后的地址）
 *  base 和 key 都填上才启用；留空则音乐瓷砖整体隐藏 */
export const NETEASE_API = {
  base: "", // 如 "https://你的项目.vercel.app"（不带末尾斜杠）
  key: "", // 服务端 API_KEY 环境变量的值
};

/** 项目展示数据 —— TODO: 替换成你自己的项目
 *  title/desc 默认英文（站点默认语言），titleZh/descZh 为中文翻译 */
export type Project = {
  id: string;
  title: string;
  titleZh?: string;
  desc: string;
  descZh?: string;
  tags: string[];
  demo?: string;
  repo?: string;
  /** 封面花纹样式：dots / lines / grid / waves */
  art: "dots" | "lines" | "grid" | "waves";
};

export const PROJECTS: Project[] = [
  {
    id: "p1",
    title: "TODO: Project one",
    titleZh: "TODO：项目名称一",
    desc: "One line on what problem it solves and what makes it interesting. Replace with a real project, then add screenshots or links.",
    descZh:
      "一句话讲清楚它解决什么问题、亮点是什么。这里是项目简介的占位，替换成真实项目后记得配上截图或链接。",
    tags: ["Next.js", "TypeScript"],
    demo: "#",
    repo: "#",
    art: "dots",
  },
  {
    id: "p2",
    title: "TODO: Project two",
    titleZh: "TODO：项目名称二",
    desc: "Second project placeholder. Pick the 3-4 projects that best represent you — quality over quantity.",
    descZh: "第二个项目的简介占位。建议挑最能代表你的 3-4 个项目，宁缺毋滥。",
    tags: ["Canvas", "动画"],
    demo: "#",
    repo: "#",
    art: "lines",
  },
  {
    id: "p3",
    title: "TODO: Project three",
    titleZh: "TODO：项目名称三",
    desc: "Third project placeholder. Add a live demo link if you have one, otherwise just the repo.",
    descZh: "第三个项目的简介占位。有线上 demo 就放 demo 链接，没有就只留仓库地址。",
    tags: ["Python", "爬虫"],
    repo: "#",
    art: "grid",
  },
  {
    id: "p4",
    title: "TODO: Project four",
    titleZh: "TODO：项目名称四",
    desc: "Fourth project placeholder. An open-source library, a small tool, or even a fun refactor works.",
    descZh: "第四个项目的简介占位。也可以是一个开源库、一个小工具，甚至一次有趣的重构。",
    tags: ["CLI", "工具"],
    repo: "#",
    art: "waves",
  },
];
