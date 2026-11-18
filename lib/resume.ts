/* ============================================================
 * 简历数据 —— 唯一数据源（双语）
 *
 * 中文版来源：resume_luo_v6_21（2026-11，互联网通用方向）
 * 英文版来源：english/v2（2026-11，外企技术岗位）
 *
 * 维护流程：改 PDF → 替换 public/resume/ 下对应文件 → 同步本文件。
 * 两边不一致时以 PDF 为准（招聘方拿到的是 PDF）。
 *
 * 约定：
 * - 手机号只存在于 PDF（hr 场景需要），HTML 永不展示；
 * - 正文里的 **粗体** 与 PDF 的高亮一致（页面用 <Rich> 渲染）；
 * - 两版的项目顺序不同（英文版项目在前），由 sections 数组控制。
 * ============================================================ */

export type ResumeBullet = { text: string };
export type ResumeVerify = { label: string; href: string };

export type ResumeEdu = {
  school: string;
  schoolEn?: string;
  degree: string;
  period: string;
  note?: string;
  majors: string[];
  verify?: ResumeVerify;
};

export type ResumeExp = {
  company: string;
  role: string;
  period: string;
  bullets: ResumeBullet[];
  verify?: ResumeVerify;
};

export type ResumeProject = {
  name: string;
  tagline: string;
  type: string;
  meta?: string;
  desc?: string;
  period: string;
  bullets: ResumeBullet[];
  verify?: ResumeVerify;
};

export type SectionId = "education" | "experience" | "projects" | "skills" | "honors";

export type ResumeData = {
  /** 页面主名（中文版中文名，英文版英文名） */
  name: string;
  /** 副名：中文版显示英文名，英文版留空 */
  nameEn?: string;
  /** 抬头元信息（英文版无出生年月/性别） */
  meta?: string;
  contacts: { label: string; value: string; href: string }[];
  pdf: string;
  /** 下载时落盘的文件名 */
  pdfName: string;
  pdfSize: string;
  /** 另一语言版本，纸面上给一条直达链接 */
  altPdf: { href: string; name: string; label: string; size: string };
  updated: string;
  /** 分节顺序：英文版把项目放在实习之前 */
  sections: SectionId[];
  titles: Record<SectionId, { main: string; sub?: string }>;
  education: ResumeEdu[];
  experience: ResumeExp[];
  projects: ResumeProject[];
  skills: { label: string; items: string }[];
  honors: string[];
  languages: string;
};

/* ---------------- 中文版：v6.21 ---------------- */

export const RESUME_ZH: ResumeData = {
  name: "骆耀升",
  nameEn: "Alvin Luo",
  meta: "2004.11 · 男",
  contacts: [
    { label: "Email", value: "alvin290@163.com", href: "mailto:alvin290@163.com" },
    { label: "Blog", value: "alvin-luo.me", href: "/" },
    { label: "GitHub", value: "alvinluo-tech", href: "https://github.com/alvinluo-tech" },
  ],
  pdf: "/resume/alvin-luo-resume.pdf",
  pdfName: "Luo-Yaosheng-CV-ZH.pdf",
  pdfSize: "454 KB",
  altPdf: { href: "/resume/alvin-luo-resume-en.pdf", name: "Yaosheng-Luo-CV-EN.pdf", label: "English version", size: "90 KB" },
  updated: "2026-11",

  sections: ["education", "experience", "projects", "skills", "honors"],
  titles: {
    education: { main: "教育背景", sub: "EDUCATION" },
    experience: { main: "实习经历", sub: "EXPERIENCE" },
    projects: { main: "核心项目", sub: "PROJECTS" },
    skills: { main: "专业技能", sub: "SKILLS" },
    honors: { main: "荣誉与语言", sub: "HONORS & LANGUAGES" },
  },

  education: [
    {
      school: "杜伦大学",
      schoolEn: "Durham University",
      degree: "高级计算机科学（AI）硕士",
      period: "2025.09 – 2027.01（预计）",
      note: "QS 2027 世界大学排名第 85 位。",
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
      role: "爬虫实习工程师 · 数据工程与后端研发",
      period: "2025.02 – 2025.05",
      bullets: [
        { text: "**架构解耦与吞吐翻倍：**基于 Scrapy-Redis 与 RabbitMQ 解耦采集接口和任务调度，构建五节点分布式爬取集群；合规限速下系统吞吐量提升至原来的 **2 倍**。" },
        { text: "**高可用分流与故障转移：**基于 Nginx + FastAPI 设计服务负载均衡与节点心跳、故障转移策略，消除单点瓶颈，提升多节点采集链路的连续性。" },
        { text: "**自适应频控代理池：**根据池内有效 IP 数量动态调整心跳频率，降低无效探测开销；代理可用率维持 **95%+**，无效重试率由 **25% 降至 8%**。" },
        { text: "**涉外技术方案沟通：**参与辉瑞制药技术团队需求对接，以英文讲解采集架构及稳定性方案，支持签约 **80 万元**技术服务项目。" },
      ],
    },
  ],

  projects: [
    {
      name: "CoreLayer",
      tagline: "Local-first AI Agent Runtime & Execution Harness",
      type: "个人开源项目",
      meta: "corelayer.alvin-luo.me",
      period: "2026.06 – 至今",
      bullets: [
        {
          text: "**DAG 动态编排与 Git Worktree 隔离调度：**针对单 Coding Agent 在长链路任务中易出现 Context 腐化与文件并发冲突的痛点，设计 **Planner → Worker ⇄ Verifier** 协同架构；基于 **TaskGraph DAG** 拆解子任务，通过 Git Worktree 为并发 Worker（Claude Code / Codex / OpenCode）分配物理隔离工作目录；超长工具输出落盘并回填摘要引用，跨会话以 **Handoff Protocol** 实现 **Context Reset 无损交接**；基于 **SQLite FTS5** 构建仓库级情景记忆（Repo Memory），以 **Reflector–Curator** 增量条目模式实现跨会话经验演进。",
        },
        {
          text: "**机械化质量门禁（Verifier Gate）与防死循环熔断：**贯彻“生成与验证分离”原则，在 DAG 节点间内置确定性校验回路（自动执行 Type Check、Linter 与单测并将报错回流自愈）；设计 **Loop of Death** 防御机制（同参调用去重、无 Diff 进展检测与 Per-task Token Budget 硬上限），长程多步任务端到端一次交付率从单 Agent 的 **54% 提升至 87%**。",
        },
        {
          text: "**纵深安全护栏（Permission Guard）与工具 / Skills 渐进式披露：**构建统一 mcp-client 与 tool-registry（支持 stdio / SSE / Streamable HTTP），采用 **Progressive Disclosure** 按需加载工具 Schema 与 AGENTS.md / Skills 索引，削减初始上下文开销 **62%**；结合 Shell AST 语法树解析（拦截管道 / 高危注入）与 Tauri 2 Capabilities 作用域限制（严格隔离工作区读写 Scope 与网络白名单），实现 Read / Write / External / Destructive 四级风险 HITL 挂起审批与秒级断点恢复。",
        },
        {
          text: "**多模型网关（Model Gateway）与 Trajectory 评测闭环：**基于 Hono + SQLite 构建守护进程，对自研 Planner、Verifier 与内部循环流量固定前缀结构，使 **Prefix Caching 命中率达 82%+**；按任务复杂度分级路由（Opus/R1 规划 + 轻量执行），Token 成本降低 **45%**；沉淀 **46 个真实工程任务黄金集**与全链路 Trajectory 归因面板，驱动工具 Schema、规则索引与校验策略的受限自进化迭代（Bounded Harness Evolution）与防退化回归验收。",
        },
      ],
      verify: { label: "在线体验", href: "https://corelayer.alvin-luo.me" },
    },
    {
      name: "CrawlerHub",
      tagline: "分布式采集与 Agentic Hybrid RAG 检索引擎",
      type: "个人项目",
      desc: "面向公开社交媒体笔记的品类反馈检索：回答具体观点时给出处，涉及总体数量与时间变化时以结构化统计为准。",
      period: "2024.05 – 2026.05（架构迭代重构）",
      bullets: [
        {
          text: "**增量入库与数据版本：**基于 2024 年自研的 Scrapy-Redis / Scrapyd 分布式采集底座，2026 年接入 Qdrant 与大模型，二次重构为 Agentic RAG 引擎；以笔记 ID + 内容哈希识别增量与更新，按标题、正文、标签切分，保留原文链接、发布时间及抓取版本，异步写入 MySQL 与 Qdrant。原采集系统吞吐量由 **800 提升至 1,200 条/小时**，故障定位时间由 **10 缩短至 3 分钟**。",
        },
        {
          text: "**中文 Hybrid Search：**以 **BGE-M3** 生成稠密语义向量；对品牌、品类别名做归一化，以 Qdrant BM25 多语言 tokenizer 构建稀疏检索。两路各取 Top 20，经 **RRF** 融合后使用 **bge-reranker-v2-m3** 交叉精排，减少短笔记、专有名词及同义表述的漏召回。",
        },
        {
          text: "**意图路由与可溯源问答：**通过轻量 Query Router 拆解复合提问，将数量、时间趋势路由至 MySQL 聚合，将具体观点路由至 Qdrant 证据检索；按品类、发布时间过滤并注入 Top 6 片段与原文 URL，答案逐条标注来源，证据不足或过期时返回“不足以判断”，避免从局部样本推断总体趋势。",
        },
        {
          text: "**索引一致性与降级：**以 Redis 队列异步驱动 Embedding 与索引更新，使用笔记 ID + 内容版本作幂等键，失败任务限次重试；复抓发现编辑或删除时更新 MySQL 与 Qdrant，并支持按采集版本重建索引。Embedding 或重排模型不可用时降级为 BM25 检索并保留来源链接。",
        },
        {
          text: "**检索评测闭环：**构建覆盖术语精确匹配、语义改写、时间限定和无答案场景的 **150 条标注查询**，对 BM25、Dense、RRF 和 Rerank 做消融；Hybrid + Rerank 将 **Recall@5 由单路 Dense 的 0.72 提升至 0.85，MRR@10 达 0.79，引用支持率达 93%+**，按 Bad Case 类型优化切分、过滤与候选数。",
        },
      ],
      verify: { label: "源码", href: "https://gitee.com/alvin_GDUT/crawler-hub" },
    },
  ],

  skills: [
    {
      label: "Agent Harness 与编排",
      items:
        "熟悉 Claude Code、DeepSeek Harness、OpenClaw、Hermes 与 LangGraph 架构范式；掌握 TaskGraph DAG、Planner–Worker–Verifier、Git Worktree 隔离与跨会话 Handoff；MCP（stdio / SSE / Streamable HTTP）、ACP（Agent Client Protocol）、A2A 协同、Agent Skills 渐进式披露与 Tool Registry；具备 Computer-Use / Browser-Use Agents 工程化认知。",
    },
    {
      label: "上下文、记忆与自进化评测",
      items:
        "Context Reset、长工具输出 Offloading、Prefix Caching；Repo Memory（FTS5）与基于 Trajectory 归因的 Harness 受限自进化；Shell AST + Tauri Capabilities 隔离、确定性 Verifier Gate 与回归评测。",
    },
    {
      label: "RAG 与知识检索",
      items:
        "结构化 Chunking 与增量索引、BGE-M3 + Qdrant；Dense/BM25 双路召回、RRF 融合、BGE-Reranker 交叉精排；Recall@K / MRR / 引用支持率评测。",
    },
    {
      label: "编程语言",
      items: "TypeScript / JavaScript（Node.js、React、Hono）、Python（FastAPI、PyTorch）、Java、SQL、Go。",
    },
    {
      label: "工程基建与中间件",
      items:
        "Docker、Kubernetes（K8s）、Nginx、Kafka、RabbitMQ、Redis、MySQL、PostgreSQL、Elasticsearch、SQLite（Drizzle）、Linux、Git、Tauri。",
    },
  ],

  honors: ["两次获优秀学生二等奖学金", "校级「优秀学生干部」", "普译奖全国大学生翻译大赛汉译英三等奖"],
  languages: "CET-6 520 · 雅思 6.5 · 可进行英文技术交流",
};

/* ---------------- 英文版：english v2 ---------------- */

export const RESUME_EN: ResumeData = {
  name: "Yaosheng Luo",
  contacts: [
    { label: "Email", value: "alvin290@163.com", href: "mailto:alvin290@163.com" },
    { label: "GitHub", value: "github.com/alvinluo-tech", href: "https://github.com/alvinluo-tech" },
    { label: "Website", value: "alvin-luo.me", href: "/" },
  ],
  pdf: "/resume/alvin-luo-resume-en.pdf",
  pdfName: "Yaosheng-Luo-CV-EN.pdf",
  pdfSize: "90 KB",
  altPdf: { href: "/resume/alvin-luo-resume.pdf", name: "Luo-Yaosheng-CV-ZH.pdf", label: "中文版", size: "454 KB" },
  updated: "Nov 2026",

  sections: ["education", "projects", "experience", "skills", "honors"],
  titles: {
    education: { main: "EDUCATION" },
    experience: { main: "PROFESSIONAL EXPERIENCE" },
    projects: { main: "SELECTED PROJECTS" },
    skills: { main: "TECHNICAL SKILLS" },
    honors: { main: "AWARDS & LANGUAGES" },
  },

  education: [
    {
      school: "Durham University",
      degree: "MSc Advanced Computer Science (Artificial Intelligence)",
      period: "Sep 2025 – Jan 2027 (expected)",
      majors: ["Natural Language Processing", "Machine Learning and Deep Learning", "Reinforcement Learning"],
      verify: { label: "See my UK footprints in Durham", href: "/travel?country=英国" },
    },
    {
      school: "Guangdong University of Technology",
      degree: "Bachelor's Degree in Big Data Management and Application",
      period: "Sep 2021 – Jul 2025",
      note: "GPA 3.9/5.0",
      majors: ["Data Mining", "Text Mining", "AI Applications", "Big Data Platforms (Hadoop)", "NoSQL Databases"],
    },
  ],

  experience: [
    {
      company: "Guangzhou Kuaijuece Information Technology",
      role: "Web Crawling Engineering Intern · Data Engineering & Backend Development",
      period: "Feb 2025 – May 2025",
      bullets: [
        { text: "Built a five-node **Scrapy-Redis/RabbitMQ** crawler cluster, **doubling throughput** within rate limits. Added **Nginx/FastAPI** load balancing, node heartbeats and failover." },
        { text: "Adjusted proxy health-check frequency to pool availability, maintaining **95%+ proxy availability** and reducing invalid-request retries from **25% to 8%**." },
        { text: "Presented collection architecture and reliability approaches in English during technical discussions with **Pfizer**, supporting an **RMB 800,000** technical services contract." },
      ],
    },
  ],

  projects: [
    {
      name: "CoreLayer",
      tagline: "AI Agent Runtime & Execution Harness",
      type: "Independent Open-Source Project",
      meta: "corelayer.alvin-luo.me",
      period: "Jun 2026 – Present",
      bullets: [
        { text: "Designed a **Planner-Worker-Verifier** runtime with DAG task scheduling and Git worktree isolation for concurrent Claude Code, Codex and OpenCode workers. Added structured session handoffs, file-backed tool outputs and **SQLite FTS5 repository memory** with incremental reflection and curation." },
        { text: "Built deterministic type-check, lint and unit-test gates with error feedback, repeated-call detection, no-progress checks and per-task token budgets; improved end-to-end first-pass task completion from **54% to 87%**." },
        { text: "Implemented an **MCP client and tool registry** supporting stdio, SSE and Streamable HTTP. Loaded tool schemas and skills on demand to reduce initial context overhead by **62%**; combined shell AST checks, Tauri capabilities and risk-based human approval with resumable execution." },
        { text: "Built a local model gateway using **Hono and SQLite**. Stable prompt prefixes for internal planner/verifier calls achieved **82%+ prefix-cache hits**; complexity-based model routing reduced token costs by **45%**. Added **46 engineering evaluation tasks**, trajectory analysis and regression gates for controlled harness updates." },
      ],
      verify: { label: "Live demo", href: "https://corelayer.alvin-luo.me" },
    },
    {
      name: "CrawlerHub",
      tagline: "Distributed Ingestion & Hybrid RAG",
      type: "Independent Project",
      meta: "Extended the original collection system with RAG in 2026",
      period: "May 2024 – May 2026",
      bullets: [
        { text: "Extended a **Scrapy-Redis/Scrapyd** collection pipeline with content-hash deduplication, structured chunking, source metadata and versioned writes to **MySQL and Qdrant**. Increased collection throughput from **800 to 1,200 records/hour** and reduced fault diagnosis time from **10 to 3 minutes**." },
        { text: "Combined **BGE-M3 embeddings and BM25** keyword retrieval with alias normalization, reciprocal rank fusion (RRF) and **bge-reranker-v2-m3** reranking. Routed aggregate and trend questions to SQL and evidence-based questions to vector search, with source citations and abstention when evidence was insufficient." },
        { text: "Maintained indexes with Redis queues, versioned idempotent writes, bounded retries, edit/deletion propagation and BM25 fallback. Compared retrieval variants on **150 labeled queries**: Recall@5 rose from **0.72 to 0.85**, with **MRR@10 of 0.79** and **93%+ citation support**." },
      ],
      verify: { label: "Source", href: "https://gitee.com/alvin_GDUT/crawler-hub" },
    },
  ],

  skills: [
    {
      label: "Languages & frameworks",
      items: "TypeScript/JavaScript (Node.js, Hono, React), Python (FastAPI, PyTorch), Java, SQL, Go.",
    },
    {
      label: "Agent engineering",
      items:
        "DAG orchestration, tool calling, MCP, agent skills, context engineering, memory, human-in-the-loop approvals and trajectory evaluation; familiarity with LangGraph and Hermes architectures.",
    },
    {
      label: "Data & infrastructure",
      items:
        "Qdrant, PostgreSQL, MySQL, SQLite/Drizzle, Redis, Elasticsearch, RabbitMQ, Kafka, Docker, Kubernetes, Nginx, Linux and Git.",
    },
  ],

  honors: ["Second-Class Academic Scholarship (twice)", "University-level Outstanding Student Leader Award"],
  languages: "IELTS 6.5 · CET-6 520 · Experience presenting technical solutions in English",
};

/** 服务端元信息（metadata / OG）沿用中文版抬头 */
export const RESUME = RESUME_ZH;

export const RESUME_BY_LOCALE: Record<"zh" | "en", ResumeData> = {
  zh: RESUME_ZH,
  en: RESUME_EN,
};
