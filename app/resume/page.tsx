import type { Metadata } from "next";
import ResumeSheet from "@/components/ResumeSheet";
import { SITE_URL } from "@/config/site";

/* /resume —— 简历纸面。入口：导航 CV / 房间纸页 / 终端 resume / 页脚。
   openGraph.title 必须显式写，否则分享卡标题继承根默认值（坑 #14） */
export const metadata: Metadata = {
  title: `骆耀升 Alvin Luo — 简历 CV / Resume`,
  description: `骆耀升（Alvin Luo）— 杜伦大学高级计算机科学（AI）硕士 · AI Agent / 全栈。中英文双语简历，纸面内容与下载的 PDF 随界面语言切换。`,
  alternates: { canonical: "/resume" },
  openGraph: {
    title: `骆耀升 Alvin Luo — 简历 CV / Resume`,
    description: "杜伦大学 Advanced CS (AI) 硕士 · AI Agent / 全栈 · CoreLayer 500+ commits",
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
