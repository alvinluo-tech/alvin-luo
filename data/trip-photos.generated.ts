/* 由 scripts/gen-trip-photos.mjs 自动生成 —— 请勿手改
 *
 * 用途：R2 批量上传后，把「站点编号 → 照片列表」注入旅行轨迹页。
 * 优先级：trips.ts 里手写的 photoUrl > 本文件 > 本地 public/travel/{img}.webp
 * 重新生成：npm run photos:gen -- --in <photo_links.txt|manifest.json>
 *          npm run photos:gen -- --remote https://upload.alvin-luo.me/manifest
 */

export type GeneratedTripPhoto = {
  url: string;
  /** 列表/地图用的小图；缺省时回退 url */
  thumb?: string;
  /** 拍摄时间（ISO 8601，带偏移则保留） */
  takenAt?: string;
  w?: number;
  h?: number;
  caption?: string;
  place?: string;
};

/** 上传页新建、还没写进 trips.ts 的行程（构建时并进 TRIPS） */
export type GeneratedTrip = {
  img: string;
  country: string;
  countryEn?: string;
  place: string;
  date: string;
  note: string;
  coord: [number, number];
};

/** 站点编号 → 照片（第一张为封面） */
export const TRIP_PHOTOS: Record<string, GeneratedTripPhoto[]> = {

};

/** 站点编号 → 派生日期（"2026.11.16"）。trips.ts 里手写了 date 的优先 */
export const TRIP_DATE: Record<string, string> = {

};

/** 全局时间线：按拍摄时间升序，供未来的时间轨迹地图使用 */
export const PHOTO_TIMELINE: (GeneratedTripPhoto & { trip: string })[] = [

];

/** 上传页新建的行程 */
export const EXTRA_TRIPS: GeneratedTrip[] = [

];
