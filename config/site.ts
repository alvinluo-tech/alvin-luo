/* ============================================================
   站点配置：把需要你个人信息的地方都集中在这里，改这一个文件即可
   ============================================================ */

export const SITE_URL = "https://alvin-luo.me";

/** GitHub 用户名 —— 控制 GitHub 热力图瓷砖；保持占位值则显示提示框 */
export const GITHUB_USER: string = "alvinluo-tech";

/** GitHub 主页链接 —— 导航 / ⌘K 面板 / Hero 按钮统一从这里取 */
export const GITHUB_URL = `https://github.com/${GITHUB_USER}`;

/** 联系邮箱 —— Bento 的 SAY HELLO 瓷砖 */
export const EMAIL = "luoyaosheng123@gmail.com";

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
  /** 架构 X-Ray：底层技术栈链路（UI → 逻辑 → 存储 → 平台） */
  arch?: string[];
};

export const PROJECTS: Project[] = [
  {
    id: "encounter",
    title: "Encounter — Encrypted Intimacy Tracker",
    titleZh: "Encounter — 加密亲密记录",
    desc: "A secure digital sanctuary for couples: log moments in under 3 seconds, then explore timeline analytics, map heatmaps and replay — all end-to-end encrypted, PIN-locked, with full audit logs.",
    descZh:
      "给伴侣的安全数字空间：3 秒极速记录亲密时刻，时间线分析、地图热力与回放；AES-256-GCM 端到端加密 + PIN 锁 + 审计日志，隐私压倒一切。",
    tags: ["Next.js 16", "Supabase", "E2E 加密", "PWA"],
    demo: "https://encounter.alvin-luo.me/",
    repo: "https://github.com/alvinluo-tech/intimacy-tracker",
    art: "waves",
    arch: ["Next.js 16 UI", "Server Actions", "Supabase Postgres + RLS", "AES-256-GCM"],
  },
  {
    id: "taskflow",
    title: "TaskFlow — Cognitive-Load Task OS",
    titleZh: "TaskFlow — 认知负荷任务系统",
    desc: "A productivity OS that manages cognitive energy instead of time: a daily load cap with overload warnings, an immersive flow timer, AI one-click planning, and unlimited nested task trees.",
    descZh:
      "不管理时间，管理认知能量：每日负荷上限与过载预警、沉浸式专注计时、AI 一键排程、无限层级任务树——为高强度深度工作者打造的生产力操作系统。",
    tags: ["AI 排程", "任务管理", "专注计时", "Web 应用"],
    demo: "https://taskflow.luodo.app",
    repo: "https://github.com/alvinluo-tech/Taskflow",
    art: "grid",
    // 技术栈未核实（仓库暂不可访问），X-Ray 架构链路留空，组件自动隐藏按钮
  },
  {
    id: "corelayer",
    title: "CoreLayer — Local-First AI Agent Control Plane",
    titleZh: "CoreLayer — 本地优先 AI Agent 指挥台",
    desc: "A Tauri desktop control plane that turns goals into governed agent work: task graphs, risk-tiered approvals, an MCP tool registry, and a multi-model router across Groq, OpenRouter, Ollama and more.",
    descZh:
      "Tauri 桌面指挥台：把目标拆成任务图交给 Agent 执行——权限分级审批、MCP 工具注册表、多模型路由（Groq / OpenRouter / Ollama），带语音管线的本地 Jarvis。",
    tags: ["Tauri 2", "Rust", "React 19", "MCP"],
    demo: "https://corelayer.alvin-luo.me/",
    repo: "https://github.com/alvinluo-tech/CoreLayer",
    art: "lines",
    arch: ["Tauri 2 (Rust)", "React 19 + Vite", "Node Daemon (Hono)", "SQLite + Drizzle"],
  },
];
