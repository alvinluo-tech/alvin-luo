"use client";

/* ============================================================
 * ContactTile — Bento 数字明信片投递盒 (Say Hello Postbox)
 *
 * 拟物物理感：将原本只有一串静态邮箱文字的瓷砖，
 * 升级为可玩、可选主题、可一键复制与唤起邮件客户端的互动投递站。
 *
 * 功能：
 * · 快捷话题标签（喝咖啡、聊合作、撸猫打招呼）一键预填充邮件主题
 * · 一键复制邮箱（带 COPIED ✓ 触感反馈）
 * · 唤起原生邮件客户端
 * · 复古邮戳标记与航空信封质感
 * ============================================================ */

import { useState } from "react";
import { EMAIL } from "@/config/site";
import { playClick } from "@/lib/sfx";
import { T } from "./i18n";

type Topic = {
  key: string;
  icon: string;
  en: string;
  zh: string;
  subject: string;
};

const TOPICS: Topic[] = [
  {
    key: "collab",
    icon: "💼",
    en: "Project / Work",
    zh: "项目合作",
    subject: "Project Inquiry via alvin-luo.me",
  },
  {
    key: "coffee",
    icon: "☕",
    en: "Coffee Chat",
    zh: "喝杯咖啡",
    subject: "Coffee Chat from alvin-luo.me",
  },
  {
    key: "cat",
    icon: "🐾",
    en: "Say Hi to Cat",
    zh: "向猫问好",
    subject: "Saying Hi to the Room Cat 🐾",
  },
];

export default function ContactTile() {
  const [selectedTopic, setSelectedTopic] = useState<Topic>(TOPICS[0]);
  const [copied, setCopied] = useState(false);

  const handleSelectTopic = (t: Topic) => {
    setSelectedTopic(t);
    playClick(1600);
  };

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(EMAIL);
      setCopied(true);
      playClick(2200);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 降级使用 prompt 或 mailto
      window.location.href = `mailto:${EMAIL}`;
    }
  };

  const mailtoUrl = `mailto:${EMAIL}?subject=${encodeURIComponent(selectedTopic.subject)}`;

  return (
    <article className="tile tile-contact" aria-label="Contact postbox widget">
      <div className="contact-head-bar">
        <h3 className="tile-title">
          <T en="SAY HELLO" zh="打个招呼" />
        </h3>
        <span className="postbox-seal" aria-hidden="true" title="Durham Airmail Postmark">
          POST 📮
        </span>
      </div>

      {/* 快捷话题选择标签 */}
      <div className="contact-topic-row" aria-label="选择对话主题">
        {TOPICS.map((t) => {
          const isSelected = selectedTopic.key === t.key;
          return (
            <button
              key={t.key}
              type="button"
              className={`topic-chip ${isSelected ? "is-active" : ""}`}
              onClick={() => handleSelectTopic(t)}
            >
              <span className="topic-icon">{t.icon}</span>
              <span className="topic-text">
                <T en={t.en} zh={t.zh} />
              </span>
            </button>
          );
        })}
      </div>

      {/* 投递卡片操作区 */}
      <div className="contact-action-box">
        <a className="contact-main-link" href={mailtoUrl} title={`Send email with subject: ${selectedTopic.subject}`}>
          <span className="email-addr">{EMAIL}</span>
          <span className="contact-send-badge">
            <T en="SEND ↗" zh="发信 ↗" />
          </span>
        </a>

        <button
          type="button"
          className={`contact-copy-btn ${copied ? "is-copied" : ""}`}
          onClick={handleCopy}
          title={copied ? "Copied to clipboard!" : "Copy email address"}
        >
          {copied ? "COPIED ✓" : "COPY"}
        </button>
      </div>
    </article>
  );
}
