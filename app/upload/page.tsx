import type { Metadata } from "next";
import TravelUpload from "@/components/TravelUpload";

export const metadata: Metadata = {
  title: "上传旅行照片 — UPLOAD",
  robots: { index: false, follow: false },
};

export default function UploadPage() {
  return <TravelUpload />;
}
