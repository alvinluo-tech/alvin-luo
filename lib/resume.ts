/* ============================================================
 * 简历数据 —— 唯一数据源
 *
 * 来源：用户提供的 resume_luo_v6_3 PDF（2026-09 版），经 pdf.js 提取。
 * 修改简历的正确流程：改 PDF → 替换 public/resume/alvin-luo-resume.pdf
 * → 同步更新本文件。两边不一致时以 PDF 为准（招聘方拿到的是 PDF）。
 *
 * 隐私约定：手机号只存在于 PDF（hr 场景需要），HTML 不展示；
 * HTML 走邮箱。verify 字段是「证据链接」——站内可点的实证。
 * ============================================================ */

export type ResumeBullet = { text: string; verify?: { label: string; href: string } };

export const RESUME = {
  name: "骆耀升",
  nameEn: "Alvin Luo",
  /** 头部一行：出生年月 · 性别 · 籍贯 */
  meta: "2004.11 · 男 · 江西吉安",
  /** 站内展示的联系方式（无手机号——只留 PDF） */
  contacts: [
    { label: "Email", value: "alvinluo68@163.com", href: "mailto:alvinluo68@163.com" },
    { label: "Blog", value: "alvin-luo.me", href: "/" },
    { label: "GitHub", value: "alvinluo-tech", href: "https://github.com/alvinluo-tech" },
  ],
  pdf: "/resume/alvin-luo-resume.pdf",
  pdfSize: "909 KB",
  updated: "2026-09",

  education: [
    {
      school: "杜伦大学",
      schoolEn: "Durham University",
      degree: "计算机科学硕士",
      period: "2025.09 – 2027.01（预计）",
      note: "QS 2027 世界排名第 85；已完成课程，预计 2027 年 1 月获学位。",
      majors: ["自然语言处理", "机器学习与深度学习", "强化学习", "人工智能交互框架与实践"],
      verify: { label: "杜伦在哪，看看我的英国足迹", href: "/travel?country=英国" },
    },
    {
      school: "广东工业大学",
      schoolEn: "Guangdong University of Technology",
      degree: "大数据管理与应用学士",
      period: "2021.09 – 2025.07",
      note: "GPA 3.9 / 5.0",
      majors: ["数据挖掘", "文本挖掘", "人工智能应用", "大数据平台基础（Hadoop）", "NoSQL 数据库"],
    },
  ],

  experience: [
    {
      company: "广州快决测信息科技有限公司",
      role: "爬虫实习工程师 · 技术部",
      period: "2025.02 – 2025.05",
      bullets: [
        { text: "主导爬虫框架重构：基于 scrapy-redis 与 RabbitMQ 解耦爬取接口与任务调度，支持分布式爬取，框架性能提升 200%。" },
        { text: "应用 Nginx + FastAPI 设计爬虫接口负载均衡策略，爬取效率提升 200%、系统稳定性提升 130%。" },
        { text: "开发维护 IP 代理池：定时心跳检测机制，代理可用性 95%+，IP 采购成本降低 30%。" },
        { text: "参与辉瑞制药技术团队商务谈判，全英文沟通技术细节，推动技术服务签约，为公司创收 80 万元。" },
      ] as ResumeBullet[],
    },
  ],

  projects: [
    {
      name: "CoreLayer",
      tagline: "Local-first AI Agent 执行控制层",
      meta: "corelayer.alvin-luo.me · 500+ commits",
      period: "2026.06 – 至今",
      type: "个人开源项目",
      bullets: [
        { text: "独立设计并实现 AI Agent 执行控制层：目标自动转化为含任务、Agent 运行、审批、产物与审计日志的工作区，Claude Code / Codex / OpenCode 作为受权限管控的托管 Worker 运行。" },
        { text: "实现 MCP-first 工具体系（stdio / HTTP / SSE 多协议，工具统一注册路由）与风险分级权限护栏（自动执行 → 显式审批、待执行恢复）；构建多供应商模型网关（OpenAI 兼容协议，DeepSeek / MiMo 等）按任务类型路由。" },
        { text: "工程化：Tauri 2 + React 19 桌面端 + Node.js (Hono) 守护进程，pnpm Monorepo 拆分 model-gateway / mcp-client / tool-registry / permission-guard，SQLite (Drizzle) 本地优先 + Supabase 云同步；语音链路：唤醒词 → ASR 流式识别 → TTS → 打断。" },
      ] as ResumeBullet[],
      verify: { label: "在线体验", href: "https://corelayer.alvin-luo.me" },
    },
    {
      name: "EasySplit",
      tagline: "OCR 收据分账全栈应用",
      meta: "",
      period: "2025.10 – 2025.11",
      type: "个人项目",
      bullets: [
        { text: "独立开发并部署 OCR 收据分账应用：识别收据项目与金额并结构化解析、自动完成多人分账；FastAPI 后端 + Docker 部署，独立完成引擎接入、业务逻辑到服务器部署全流程。" },
      ] as ResumeBullet[],
      verify: { label: "开发复盘文章", href: "/blog/easy-split" },
    },
    {
      name: "数据采集系统",
      tagline: "全栈独立开发",
      meta: "gitee.com/alvin_GDUT/crawler-hub",
      period: "2024.05 – 2024.06",
      type: "个人项目",
      bullets: [
        { text: "全栈开发：Vue3 / Vite / Pinia + Flask + Scrapy / Scrapyd + MySQL / Redis，Docker 部署华为云；多维检索与 Redis 进度可视化，数据获取效率 +50%、问题响应 +30%、资源利用率 +25%。" },
      ] as ResumeBullet[],
      verify: { label: "源码", href: "https://gitee.com/alvin_GDUT/crawler-hub" },
    },
    {
      name: "股票投资组合优化",
      tagline: "省级创新创业项目",
      meta: "",
      period: "2023 – 2024",
      type: "研究项目",
      bullets: [
        { text: "微调 BERT 对股民评论情感分类构建市场情绪因子，结合 Bi-LSTM 多步股价预测与集成方法优化组合权重；回测期策略净值 1.00 → 1.60，立项为省级创新创业项目。" },
      ] as ResumeBullet[],
    },
  ],

  campus: [
    "班长（大学四年）：连续四年负责班级主要事务管理、对接老师组织班级活动，获校级「优秀学生干部」称号。",
    "国际交流：2023.07 赴泰国宋卡王子大学交流访学；2024.01 校科创营小组组长，带领外国组员完成项目；2024.07 粤港澳夏令营，访学香港理工大学、香港岭南大学。",
    "校园活动：参与 3 次校级晚会活动，主要负责活动策划。",
  ],

  skills: [
    { label: "LLM & Agent", items: "RAG · Embedding · 向量数据库 · MCP 协议 · Function Calling / Tool Use · Prompt Engineering · 权限护栏与审计日志" },
    { label: "编程语言", items: "Python · TypeScript / JavaScript (Node.js 22) · Java · SQL" },
    { label: "AI / 机器学习", items: "PyTorch · Scikit-learn · BERT 微调 · Bi-LSTM · Pandas" },
    { label: "后端", items: "FastAPI · Flask · Koa.js · Hono · Nginx · RabbitMQ" },
    { label: "前端", items: "React 19 · Vue3 · Vite · Tailwind CSS · 微信小程序" },
    { label: "爬虫与数据", items: "Scrapy · scrapy-redis · Scrapyd · MySQL · Redis · MongoDB · SQLite (Drizzle) · Supabase · Hadoop · Docker · Git · Linux" },
  ],

  honors: [
    "2021–2022 学年度优秀学生二等奖学金",
    "2022–2023 学年度优秀学生二等奖学金（班排名第二）",
    "第七、八届全国学术英语词汇竞赛二等奖",
    "校运会 1500m 第一名",
    "2021–2022 学年度「优秀学生干部」",
    "2022–2023 学年度「学风建设先进个人」",
    "2022 年第六届普译奖全国大学生翻译大赛汉译英三等奖",
  ],
  languages: "CET-4 525 · CET-6 520 · 雅思 6.5（可全英文工作交流）",

  summary: [
    "快速的 AI 前沿技术学习能力，对 Agent、RAG、模型训练方向保持高密度学习与实践投入。",
    "独立的 AI 系统设计与交付能力，深度 Vibe Coding 实践者，建立系统化的 AI Coding 开发流程并融入日常开发，主导开源项目 CoreLayer（500+ commits）。",
    "全栈工程落地能力，从 AI 能力接入、前后端开发到容器化与云端部署均可独立闭环。",
    "良好的沟通能力、团队协作精神以及抗压能力，能快速投入团队工作。",
  ],
} as const;
