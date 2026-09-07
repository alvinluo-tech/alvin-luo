import type { Metadata } from "next";
import TravelArchive from "@/components/TravelArchive";

export const metadata: Metadata = {
  title: "全部足迹 — ARCHIVE",
  description: "去过的每一个国家与城市，按国家归档。",
};

export default function TravelPage() {
  return <TravelArchive />;
}
