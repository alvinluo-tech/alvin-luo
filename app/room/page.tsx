import type { Metadata } from "next";
import RoomScene from "@/components/RoomScene";

export const metadata: Metadata = {
  title: "Alvin 的房间 — THE ROOM",
  description:
    "一个手绘等距小房间：书桌里藏着项目，书架上是书，唱片机放着正在听的歌，猫在等你点它。时钟和窗户跟着杜伦的真实时间走。",
};

/* /room = 房间即导航：每件家具都是一扇门 */
export default function RoomPage() {
  return <RoomScene />;
}
