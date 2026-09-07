/* NOW PLAYING 代理：把 key 藏在服务端
 *
 * 浏览器 → /api/now-playing（同源，无 key）
 * 本服务端 → ${NETEASE_API_BASE}/api/now-playing?key=…（key 只在这里出现）
 *
 * 响应缓存 60s：所有访客共享一份上游结果，保护网易云限额。
 * 未配置环境变量 / 上游异常时优雅降级为 { playing: false }，页面无需特殊处理。
 */

export const revalidate = 60;

export async function GET() {
  const base = process.env.NETEASE_API_BASE?.replace(/\/+$/, "");
  const key = process.env.NETEASE_API_KEY;

  if (!base || !key) {
    return Response.json({ configured: false, playing: false });
  }

  try {
    const res = await fetch(`${base}/api/now-playing?key=${encodeURIComponent(key)}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) {
      return Response.json({ configured: true, playing: false, upstream: res.status });
    }
    const data = await res.json();
    return Response.json(
      { configured: true, ...data },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
    );
  } catch {
    return Response.json({ configured: true, playing: false });
  }
}
