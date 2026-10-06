import type { Metadata } from "next";
import ResumeSheet from "@/components/ResumeSheet";
import { RESUME } from "@/lib/resume";
import { SITE_URL } from "@/config/site";

/* /resume —— 简历纸面。入口：导航 CV / 房间纸页 / 终端 resume / 页脚。
   openGraph.title 必须显式写，否则分享卡标题继承根默认值（坑 #14） */
export const metadata: Metadata = {
  title: `${RESUME.name} ${RESUME.nameEn} — 简历 CV`,
  description: `${RESUME.nameEn}（${RESUME.name}）— 杜伦大学计算机科学硕士 · AI Agent / 全栈。${RESUME.education[0].note ?? ""}`,
  alternates: { canonical: "/resume" },
  openGraph: {
    title: `${RESUME.name} ${RESUME.nameEn} — 简历 CV`,
    description: "杜伦大学 CS 硕士 · AI Agent / 全栈 · CoreLayer 500+ commits",
    url: `${SITE_URL}/resume`,
    type: "profile",
  },
};

export default function ResumePage() {
  return (
    <main className="rs-page">
      <ResumeSheet />
    </main>
  );
}
