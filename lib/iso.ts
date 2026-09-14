/* ============================================================
 * 等距（isometric）几何工具 —— RoomScene 专用纯函数
 *
 * 地板平面由 u=(-1,.3) / v=(1,.3) 两个方向向量张开，
 * up 表示沿墙向上（屏幕 y-）。
 * ============================================================ */

export type P = [number, number];

const U: [number, number] = [-1, 0.3];
const V: [number, number] = [1, 0.3];

/** 地板坐标：o=基准点，a=沿 u 偏移，b=沿 v 偏移，up=向上 */
export const pt = (o: P, a: number, b = 0, up = 0): P => [
  o[0] + U[0] * a + V[0] * b,
  o[1] + U[1] * a + V[1] * b - up,
];

/** 点集 → SVG polygon points 字符串 */
export const poly = (...pts: P[]) =>
  pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");

/** 等距箱体：pos=底面中心，a=沿 u 半宽，b=沿 v 半深，h=高。
 *  返回顶面 / 南西面 / 南东面三个 polygon points */
export function boxIso(pos: P, a: number, b: number, h: number) {
  const A = pt(pos, -a, -b);
  const B = pt(pos, a, -b);
  const C = pt(pos, a, b);
  const D = pt(pos, -a, b);
  const up = (p: P): P => [p[0], p[1] - h];
  const A2 = up(A), B2 = up(B), C2 = up(C), D2 = up(D);
  return { top: poly(A2, B2, C2, D2), sw: poly(A, D, D2, A2), se: poly(D, C, C2, D2) };
}

/** 悬空等距箱体：h0=底面高度，h1=顶面高度（用于搁板等悬空面） */
export function boxIsoRaised(pos: P, a: number, b: number, h0: number, h1: number) {
  const A = pt(pos, -a, -b, h0);
  const B = pt(pos, a, -b, h0);
  const C = pt(pos, a, b, h0);
  const D = pt(pos, -a, b, h0);
  const A2 = pt(pos, -a, -b, h1);
  const B2 = pt(pos, a, -b, h1);
  const C2 = pt(pos, a, b, h1);
  const D2 = pt(pos, -a, b, h1);
  return { top: poly(A2, B2, C2, D2), sw: poly(A, D, D2, A2), se: poly(D, C, C2, D2) };
}
