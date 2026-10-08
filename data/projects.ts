/* ============================================================
 * 项目展示数据 —— 唯一数据源（从 config/site.ts 迁出：
 * site.ts 只留元数据，数据归 data/）
 *
 * title/desc 默认英文（站点默认语言），titleZh/descZh 为中文翻译
 * ============================================================ */

export type ArchTier = {
  tier: string;
  name: string;
  desc?: string;
};

export type Project = {
  id: string;
  title: string;
  titleZh?: string;
  desc: string;
  descZh?: string;
  tags: string[];
  demo?: string;
  repo?: string;
  /** 封面花纹样式：dots / lines / grid / waves（无图或加载中时的回退底纹） */
  art: "dots" | "lines" | "grid" | "waves";
  /** 真实产品截图（public/ 下路径，如 "/projects/xxx.webp"）；缺省则用花纹封面 */
  image?: string;
  /** 架构 X-Ray：底层技术栈链路（支持字符串或分层走查结构） */
  arch?: (string | ArchTier)[];
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
    image: "/projects/encounter.webp",
    arch: [
      { tier: "01 · UI", name: "Next.js 16 PWA", desc: "移动优先 · 离线缓存" },
      { tier: "02 · COMPUTE", name: "Server Actions", desc: "零 API 样板 · 服务端校验" },
      { tier: "03 · DATA", name: "Supabase + RLS", desc: "行级安全 · 跨租户绝对隔离" },
      { tier: "04 · CRYPTO", name: "AES-256-GCM E2EE", desc: "本地密钥 · 服务端零知识" },
    ],
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
    image: "/projects/taskflow.webp",
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
    image: "/projects/corelayer.webp",
    arch: [
      { tier: "01 · CLIENT", name: "Tauri 2 (Rust) + React 19", desc: "桌面宿主 · 本地极低内存占用" },
      { tier: "02 · PROTOCOL", name: "MCP-first 工具体系", desc: "stdio / HTTP / SSE 多协议统一路由" },
      { tier: "03 · GATEWAY", name: "Node.js (Hono) 网关", desc: "多供应商模型路由 (DeepSeek / MiMo)" },
      { tier: "04 · STORAGE", name: "SQLite (Drizzle) + Supabase", desc: "本地优先 · 云端增量同步" },
    ],
  },
];
