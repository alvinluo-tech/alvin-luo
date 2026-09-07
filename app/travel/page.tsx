import type { Metadata } from "next";
import TravelArchive from "@/components/TravelArchive";

export const metadata: Metadata = {
  title: "全部足迹 — ARCHIVE & MAP",
  description: "交互式旅行足迹地图与按国家城市归档的相册。",
};

/* /travel = 独立旅行画廊：雷达仪表 + 拍立得交互足迹地图 + 按国家分组归档 */
export default function TravelPage() {
  return <TravelArchive />;
}
