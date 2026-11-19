"use client";

/**
 * /upload —— 手机端旅行照片上传。
 * 流程：选照片 → 立即入列表占位（排队中）→ 读 EXIF（时间/GPS）→ 计算原文件 SHA-256
 *       → 查重（已上传过就标记、不压缩）→ 转 WebP（压缩中）→ 批量上传 → 发布触发构建。
 *
 * 归站规则（2026-11 调整）：
 *   ≤50km   自动归入；
 *   50–200km 只给候选，不自动采用；
 *   >200km  视为「不在已知站点」，不猜、不回落默认行程，交给用户选择或新建。
 * 安全：页面只是壳，写权限在 Worker 的 UPLOAD_TOKEN。
 * 查重：原文件字节的 SHA-256；客户端先查（manifest 里已知的 hash + 本批已选），
 *       Worker 端再用 `travel/_hashes/<sha>` 标记兜底（409），删除照片会清标记。
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { TRIPS } from "@/data/trips";
import { distanceKm, formatTakenAt, isHeic, readPhotoMeta, sha256Hex, suggestTrip, toOptimizedImage } from "@/lib/client-photo";
import { tripFromPlace, type GeoPlace } from "@/lib/geo";
import {
  clearDraft,
  loadDraft,
  putDraftFile,
  removeDraftFile,
  saveDraftMeta,
  type DraftMeta,
} from "@/lib/upload-draft";
import "./TravelUpload.css";

const API = (process.env.NEXT_PUBLIC_UPLOAD_API || "https://upload.alvin-luo.me").replace(/\/+$/, "");
const TOKEN_KEY = "travel_upload_token";
const TRIP_KEY = "travel_upload_last_trip";

type Status = "queued" | "processing" | "ready" | "uploading" | "done" | "duplicate" | "error";

type LocalTrip = {
  img: string;
  country: string;
  countryEn?: string;
  place: string;
  coord: [number, number];
};

type Item = {
  id: string;
  name: string;
  size: number;
  /** 未压缩时保留文件句柄（File 只是引用，不占内存）；「仍然上传」复查重照片时要用 */
  file?: File;
  blob?: Blob;
  thumb?: Blob;
  preview?: string;
  thumbPreview?: string;
  gps?: [number, number];
  geo?: GeoPlace;
  geoStatus?: "loading" | "done" | "error";
  geoError?: string;
  trip: string;
  candidate?: string;
  nearest?: string;
  distanceKm?: number;
  takenAt: string;
  width: number;
  height: number;
  status: Status;
  url?: string;
  uploadedSize?: number;
  error?: string;
  cover: boolean;
  /** 原文件字节 SHA-256 */
  hash?: string;
  /** EXIF 方向（「仍然上传」重压缩时用） */
  orientation?: number;
  /** 用户坚持上传重复照片 */
  forced?: boolean;
  /** 判定为重复时，已有照片的信息 */
  dupOf?: {
    trip: string;
    takenAt?: string;
    key?: string;
    thumbUrl?: string;
    /** true = 与本次已选的照片重复，而不是历史已上传 */
    inBatch?: boolean;
  };
};

/** 已知照片 hash：uploaded = 已上传成功；pending = 本批已选但还没传 */
type HashInfo = {
  state: "uploaded" | "pending";
  trip: string;
  takenAt?: string;
  key?: string;
  thumbUrl?: string;
};

type RunStatus = {
  state: string;
  conclusion?: string | null;
  url?: string;
  updatedAt?: string;
};

type UploadedPhoto = {
  key: string;
  url: string;
  thumbUrl?: string;
  bytes?: number;
  trip: string;
  takenAt?: string;
  caption?: string;
  place?: string;
  cover?: boolean;
};

type TripDialog = {
  open: boolean;
  coord: [number, number] | null;
  country: string;
  countryEn: string;
  place: string;
  error: string;
};

const MANUAL_TRIPS: LocalTrip[] = TRIPS.map((t) => ({
  img: t.img,
  country: t.country,
  countryEn: t.countryEn,
  place: t.place,
  coord: t.coord,
}));

function groupTrips(trips: LocalTrip[]): Record<string, LocalTrip[]> {
  const groups: Record<string, LocalTrip[]> = {};
  for (const t of trips) (groups[t.country] ??= []).push(t);
  return groups;
}

function nextTripId(trips: LocalTrip[]): string {
  const max = trips.reduce((m, t) => Math.max(m, Number.parseInt(t.img, 10) || 0), 0);
  return String(max + 1).padStart(2, "0");
}

function mb(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function statusText(s: Status): string {
  return {
    queued: "排队中",
    processing: "压缩中",
    ready: "待上传",
    uploading: "上传中",
    done: "已上传",
    duplicate: "已上传过",
    error: "失败",
  }[s];
}

/** 把一帧让给浏览器：先画出「排队中」，再开始压缩这种重活 */
function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => setTimeout(resolve, 0));
    else setTimeout(resolve, 0);
  });
}

function timeoutSignal(ms: number): AbortSignal | undefined {
  const timeout = (AbortSignal as unknown as { timeout?: (n: number) => AbortSignal }).timeout;
  try {
    return timeout ? timeout(ms) : undefined;
  } catch {
    return undefined;
  }
}

function friendlyError(err: unknown, fallback: string): string {
  if (err instanceof DOMException && (err.name === "TimeoutError" || err.name === "AbortError")) {
    return "请求超时，请检查网络后重试";
  }
  return err instanceof Error ? err.message : fallback;
}

/** 只把可重建状态写进 IndexedDB；Blob 单独按 id 存，避免每次改行程都重写大文件。
 *  排队中/压缩中/已上传过的条目没有恢复价值，不写草稿。 */
function toDraftMeta(items: Item[]): DraftMeta[] {
  return items
    .filter((i) => i.status === "ready" || i.status === "uploading" || i.status === "done" || i.status === "error")
    .map((i, order) => ({
      id: i.id,
      order,
      trip: i.trip,
      status: i.status as DraftMeta["status"],
      url: i.url,
      uploadedSize: i.uploadedSize,
      error: i.error,
      cover: i.cover,
      candidate: i.candidate,
      nearest: i.nearest,
      distanceKm: i.distanceKm,
      hash: i.hash,
    }));
}

export default function TravelUpload() {
  const [token, setToken] = useState("");
  const [tokenDraft, setTokenDraft] = useState("");
  const [defaultTrip, setDefaultTrip] = useState(TRIPS[0]?.img ?? "05");
  const [items, setItems] = useState<Item[]>([]);
  const [extraTrips, setExtraTrips] = useState<LocalTrip[]>([]);
  const [uploaded, setUploaded] = useState<UploadedPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [run, setRun] = useState<RunStatus | null>(null);
  const [publishing, setPublishing] = useState(false);
  /** 本批「读信息 + 查重 + 压缩」的进度，显示在底栏 */
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [dialog, setDialog] = useState<TripDialog>({
    open: false,
    coord: null,
    country: "",
    countryEn: "",
    place: "",
    error: "",
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLElement>(null);
  const restoredRef = useRef(false);
  const itemsRef = useRef<Item[]>([]);
  const geoCache = useRef(new Map<string, GeoPlace | null>());
  /** hash → 已上传/本批已选。manifest 拉到后填充 uploaded；本批选中时填 pending */
  const knownHashes = useRef(new Map<string, HashInfo>());

  useEffect(() => {
    setToken(localStorage.getItem(TOKEN_KEY) || "");
    const last = localStorage.getItem(TRIP_KEY);
    if (last && MANUAL_TRIPS.some((t) => t.img === last)) setDefaultTrip(last);

    // 刷新后把上次新建、还没进构建的行程和最近上传拉回来
    fetch(`${API}/manifest`)
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (
          data: {
            trips?: Array<{ id: string; country: string; countryEn?: string; place: string; coord: [number, number] }>;
            photos?: Array<{
              key: string;
              url: string;
              thumbUrl?: string;
              trip: string;
              takenAt?: string;
              caption?: string;
              place?: string;
              cover?: boolean;
              hash?: string;
            }>;
          } | null
        ) => {
          if (!data) return;
          const known = new Set(MANUAL_TRIPS.map((t) => t.img));
          if (data.trips) {
            setExtraTrips(
              data.trips
                .filter((t) => t.id && !known.has(t.id))
                .map((t) => ({ img: t.id, country: t.country, countryEn: t.countryEn, place: t.place, coord: t.coord }))
                .filter((t) => Array.isArray(t.coord) && t.coord.length === 2)
            );
          }
          if (data.photos) {
            /* 全量登记已知 hash（不只最近 40 张），离线判重靠它 */
            for (const p of data.photos) {
              if (p.hash) {
                knownHashes.current.set(p.hash, {
                  state: "uploaded",
                  trip: p.trip,
                  takenAt: p.takenAt,
                  key: p.key,
                  thumbUrl: p.thumbUrl,
                });
              }
            }
            setUploaded(
              data.photos
                .slice(-40)
                .reverse()
                .map((p) => ({
                  key: p.key,
                  url: p.url,
                  thumbUrl: p.thumbUrl,
                  trip: p.trip,
                  takenAt: p.takenAt,
                  caption: p.caption,
                  place: p.place,
                  cover: p.cover,
                }))
            );
          }
        }
      )
      .catch(() => {
        /* 离线时忽略 */
      });
  }, []);

  /* 刷新 / 误关页面后恢复草稿：文件在 IndexedDB，状态在 meta */
  useEffect(() => {
    let alive = true;
    loadDraft()
      .then(({ files, meta }) => {
        if (!alive) return;
        if (!files.length) {
          restoredRef.current = true;
          return;
        }
        const metaById = new Map(meta.map((m) => [m.id, m]));
        const restored: Item[] = files
          .flatMap((f) => {
            const m = metaById.get(f.id);
            if (!m) return [];
            if (!f.blob && !f.thumb && m.status !== "done") return [];
            const status: Status = m.status === "uploading" ? "ready" : m.status;
            const preview = f.thumb ?? f.blob;
            const previewUrl = preview ? URL.createObjectURL(preview) : undefined;
            return [
              {
                id: f.id,
                name: f.name,
                size: f.size,
                blob: f.blob,
                thumb: f.thumb,
                preview: previewUrl,
                thumbPreview: previewUrl,
                gps: f.gps,
                trip: m.trip,
                candidate: m.candidate,
                nearest: m.nearest,
                distanceKm: m.distanceKm,
                takenAt: f.takenAt,
                width: f.width,
                height: f.height,
                status,
                url: m.url,
                uploadedSize: m.uploadedSize,
                error: m.error,
                cover: m.cover,
                hash: m.hash,
              },
            ];
          })
          .sort((a, b) => (metaById.get(a.id)?.order ?? 0) - (metaById.get(b.id)?.order ?? 0));

        if (restored.length) {
          // 合并而不是替换：恢复期间用户可能已经新选了照片
          setItems((prev) => {
            const seen = new Set(prev.map((p) => p.id));
            return [...restored.filter((r) => !seen.has(r.id)), ...prev];
          });
          /* 恢复出来的条目也要进查重表，否则同批再选一次还会被当新照片 */
          for (const r of restored) {
            if (r.hash && r.status !== "done") {
              knownHashes.current.set(r.hash, {
                state: "pending",
                trip: r.trip,
                takenAt: r.takenAt,
                thumbUrl: r.thumbPreview,
              });
            }
          }
          const interrupted = meta.filter((m) => m.status === "uploading").length;
          setNotice(
            interrupted
              ? `已恢复 ${interrupted} 张上次中断的上传，状态改回待上传，请确认后重试`
              : `已恢复 ${restored.length} 张未完成的草稿`
          );
        }
        restoredRef.current = true;
      })
      .catch(() => {
        restoredRef.current = true;
      });
    return () => {
      alive = false;
    };
  }, []);

  /* 元数据变动后轻量落盘（Blob 不在这里重写） */
  useEffect(() => {
    itemsRef.current = items;
    if (!restoredRef.current) return;
    const timer = setTimeout(() => {
      void saveDraftMeta(toDraftMeta(items)).catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [items]);

  /* 手机切后台 / 页面卸载时立刻补一次 */
  useEffect(() => {
    const flush = () => {
      if (!restoredRef.current) return;
      void saveDraftMeta(toDraftMeta(itemsRef.current)).catch(() => {});
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  /* 还有没传完的照片时，桌面端刷新/关闭给一次确认 */
  useEffect(() => {
    const pending = items.some((i) => i.status === "ready" || i.status === "uploading");
    if (!pending) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [items]);

  const allTrips = useMemo(() => [...MANUAL_TRIPS, ...extraTrips], [extraTrips]);
  const groups = useMemo(() => groupTrips(allTrips), [allTrips]);
  const tripById = useMemo(() => new Map(allTrips.map((t) => [t.img, t])), [allTrips]);

  const ready = useMemo(() => items.filter((i) => i.status === "ready"), [items]);
  const uploadable = useMemo(() => ready.filter((i) => i.trip), [ready]);
  const missing = ready.length - uploadable.length;
  const pendingBytes = useMemo(() => uploadable.reduce((n, i) => n + (i.blob?.size ?? i.size), 0), [uploadable]);
  const doneCount = useMemo(() => items.filter((i) => i.status === "done").length, [items]);
  const dupCount = useMemo(() => items.filter((i) => i.status === "duplicate").length, [items]);

  function tripLabel(id: string): string {
    const t = tripById.get(id);
    return t ? `${t.img} · ${t.place.split(" ")[0]}` : id;
  }

  function tripOptions(includeEmpty = false) {
    return (
      <>
        {includeEmpty ? <option value="">— 选择行程 —</option> : null}
        {Object.entries(groups).map(([country, list]) => (
          <optgroup key={country} label={country}>
            {list.map((t) => (
              <option key={t.img} value={t.img}>
                {t.img} · {t.place}
              </option>
            ))}
          </optgroup>
        ))}
      </>
    );
  }

  function saveToken() {
    const next = tokenDraft.trim();
    if (!next) return;
    localStorage.setItem(TOKEN_KEY, next);
    setToken(next);
    setTokenDraft("");
  }

  function pickDefaultTrip(id: string) {
    setDefaultTrip(id);
    localStorage.setItem(TRIP_KEY, id);
  }

  /** 地名解析串行队列：Worker 端 geopace 1.1s/条，一次选十几张不同地点的照片
      时，并发请求会把排在后面的拖过超时线（报「解析失败」）；客户端排队后，
      每个请求只需覆盖自己的上游耗时，同坐标的重复项命中 geoCache 直接返回。 */
  const geoQueue = useRef<Promise<void>>(Promise.resolve());

  function geocode(gps: [number, number]): Promise<{ geo?: GeoPlace; error?: string }> {
    const run = geoQueue.current.then(() => doGeocode(gps));
    geoQueue.current = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  async function doGeocode(gps: [number, number]): Promise<{ geo?: GeoPlace; error?: string }> {
    const key = `${gps[1].toFixed(2)},${gps[0].toFixed(2)}`;
    if (geoCache.current.has(key)) {
      const cached = geoCache.current.get(key);
      return cached ? { geo: cached } : { error: "之前解析失败" };
    }
    try {
      const res = await fetch(
        `${API}/geocode?lat=${encodeURIComponent(gps[1])}&lng=${encodeURIComponent(gps[0])}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          signal: timeoutSignal(30_000),
        }
      );
      if (!res.ok) return { error: `HTTP ${res.status}` };
      const data = (await res.json()) as GeoPlace & { ok?: boolean };
      if (!data?.label) return { error: "未找到地名" };
      geoCache.current.set(key, data);
      return { geo: data };
    } catch (err) {
      return { error: friendlyError(err, "网络错误") };
    }
  }

  async function retryGeo(item: Item) {
    if (!item.gps) return;
    geoCache.current.delete(`${item.gps[1].toFixed(2)},${item.gps[0].toFixed(2)}`);
    patch(item.id, { geoStatus: "loading", geoError: undefined });
    const r = await geocode(item.gps);
    patch(item.id, {
      geo: r.geo,
      geoStatus: r.geo ? "done" : "error",
      geoError: r.error,
    });
  }

  /** 同一天（±18h）已归站的照片里，出现最多的行程 */
  function sameDayTrip(item: Item): { trip: string; count: number } | null {
    if (!item.takenAt) return null;
    const t = Date.parse(item.takenAt);
    if (!Number.isFinite(t)) return null;

    const counts = new Map<string, { count: number; nearest: number }>();
    const consider = (trip?: string, takenAt?: string) => {
      if (!trip || !takenAt) return;
      const d = Math.abs(Date.parse(takenAt) - t);
      if (!Number.isFinite(d) || d > 18 * 3600 * 1000) return;
      const cur = counts.get(trip) ?? { count: 0, nearest: Number.POSITIVE_INFINITY };
      cur.count += 1;
      cur.nearest = Math.min(cur.nearest, d);
      counts.set(trip, cur);
    };

    for (const it of items) if (it.id !== item.id) consider(it.trip, it.takenAt);
    for (const p of uploaded) consider(p.trip, p.takenAt);

    const best = [...counts.entries()].sort(
      (a, b) => b[1].count - a[1].count || a[1].nearest - b[1].nearest
    )[0];
    return best ? { trip: best[0], count: best[1].count } : null;
  }

  /** 压缩 + 入草稿 + 变「待上传」。addFiles 与「仍然上传」共用 */
  async function compressAndStage(
    id: string,
    file: File,
    meta: { takenAt: string; gps?: [number, number]; orientation?: number },
    hash?: string
  ) {
    try {
      const oldPreview = itemsRef.current.find((i) => i.id === id)?.preview;
      const conv = await toOptimizedImage(file, {
        hasGps: Boolean(meta.gps),
        orientation: meta.orientation,
      });
      const preview = URL.createObjectURL(conv.thumb);
      void putDraftFile({
        id,
        name: file.name,
        size: file.size,
        blob: conv.blob,
        thumb: conv.thumb,
        width: conv.width,
        height: conv.height,
        takenAt: meta.takenAt,
        gps: meta.gps,
      }).catch(() => {
        /* 存储空间不足时仍可继续上传 */
      });
      patch(id, {
        blob: conv.blob,
        thumb: conv.thumb,
        preview,
        thumbPreview: preview,
        width: conv.width,
        height: conv.height,
        status: "ready",
        hash,
        file: undefined,
      });
      if (oldPreview && oldPreview !== preview) URL.revokeObjectURL(oldPreview);
      if (hash) {
        const cur = knownHashes.current.get(hash);
        if (cur) knownHashes.current.set(hash, { ...cur, thumbUrl: preview });
      }
    } catch (err) {
      patch(id, {
        status: "error",
        error: err instanceof Error ? err.message : "转码失败",
        file: undefined,
      });
    }
  }

  async function addFiles(list: FileList | null) {
    if (!list?.length) return;
    const files = Array.from(list).filter((f) => f.type.startsWith("image/") || isHeic(f));
    if (!files.length) {
      setNotice("没有识别到图片文件");
      return;
    }
    if (fileRef.current) fileRef.current.value = "";
    setNotice("");

    /* 阶段 1：先同步把占位全部放进列表，界面立刻有反馈。
       压缩是重活，放到阶段 2 逐张做，期间卡片显示「排队中 / 压缩中」。 */
    const seeds = files.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      preview: URL.createObjectURL(file),
    }));
    setItems((prev) => [
      ...prev,
      ...seeds.map((s) => ({
        id: s.id,
        name: s.file.name,
        size: s.file.size,
        file: s.file,
        preview: s.preview,
        thumbPreview: s.preview,
        trip: "",
        takenAt: "",
        width: 0,
        height: 0,
        status: "queued" as Status,
        cover: false,
      })),
    ]);
    setProgress({ done: 0, total: seeds.length });

    /* 手机端把列表滚进视野：看得见进度，就不会误以为还卡在「添加照片」 */
    requestAnimationFrame(() => {
      if (window.matchMedia("(max-width: 700px)").matches) {
        listRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    });

    /* 让浏览器先把「排队中」画出来，再开始读 EXIF / 压缩 */
    await nextPaint();

    let done = 0;
    for (const seed of seeds) {
      const file = seed.file;
      try {
        const meta = await readPhotoMeta(file);
        const sug = suggestTrip(meta.gps);
        // 有 GPS 但没匹配上就不猜；只有完全没有 GPS 时才用默认行程
        const trip = sug.trip ?? (meta.gps ? "" : defaultTrip);
        const hash = await sha256Hex(file);

        /* 查重：同文件再选一次直接标「已上传过」，不压缩、不解析地名 */
        const dup = hash ? knownHashes.current.get(hash) : undefined;
        if (dup) {
          const dupPreview = dup.state === "uploaded" ? dup.thumbUrl : undefined;
          patch(seed.id, {
            status: "duplicate",
            hash,
            gps: meta.gps,
            takenAt: meta.takenAt,
            trip,
            candidate: sug.candidate,
            nearest: sug.nearest,
            distanceKm: sug.distanceKm,
            dupOf: { ...dup, inBatch: dup.state === "pending" },
            preview: dupPreview ?? seed.preview,
            thumbPreview: dupPreview ?? seed.preview,
            geoStatus: undefined,
          });
          if (dupPreview && dupPreview !== seed.preview) URL.revokeObjectURL(seed.preview);
          done += 1;
          setProgress({ done, total: seeds.length });
          await nextPaint();
          continue;
        }
        if (hash) {
          knownHashes.current.set(hash, { state: "pending", trip, takenAt: meta.takenAt });
        }

        patch(seed.id, {
          status: "processing",
          gps: meta.gps,
          takenAt: meta.takenAt,
          trip,
          candidate: sug.candidate,
          nearest: sug.nearest,
          distanceKm: sug.distanceKm,
          hash,
          orientation: meta.orientation,
          geoStatus: meta.gps ? "loading" : undefined,
        });

        // 后台解析地名：命中后补到卡片上，不阻塞转码
        if (meta.gps) {
          const gps = meta.gps;
          void geocode(gps).then((r) => {
            setItems((prev) =>
              prev.map((it) =>
                it.id === seed.id
                  ? {
                      ...it,
                      geo: r.geo,
                      geoStatus: r.geo ? "done" : "error",
                      geoError: r.error,
                    }
                  : it
              )
            );
            // 弹窗如果已经打开且还是空的，地名到了就补上预填
            if (r.geo) {
              setDialog((d) => {
                if (!d.open || d.country || d.place || !d.coord) return d;
                const same =
                  Math.abs(d.coord[0] - gps[0]) < 0.001 && Math.abs(d.coord[1] - gps[1]) < 0.001;
                if (!same) return d;
                const pre = tripFromPlace(r.geo);
                return { ...d, country: pre.country, countryEn: pre.countryEn, place: pre.place };
              });
            }
          });
        }

        await compressAndStage(
          seed.id,
          file,
          { takenAt: meta.takenAt, gps: meta.gps, orientation: meta.orientation },
          hash
        );
      } catch (err) {
        patch(seed.id, {
          status: "error",
          error: err instanceof Error ? err.message : "读取信息失败",
          file: undefined,
        });
      }
      done += 1;
      setProgress({ done, total: seeds.length });
      /* 每张之间让出一帧，保证滚动和进度更新能画出来 */
      await nextPaint();
    }
    setProgress(null);
  }

  /** 重复照片：用户坚持要传。用保留的 File 现场压缩，再回到待上传 */
  async function forceUpload(item: Item) {
    if (!item.file) {
      setNotice("原文件已不在内存里，请重新选择这张照片");
      return;
    }
    if (item.hash) knownHashes.current.delete(item.hash);
    patch(item.id, {
      status: "processing",
      forced: true,
      dupOf: undefined,
      error: undefined,
      uploadedSize: undefined,
    });
    await compressAndStage(
      item.id,
      item.file,
      { takenAt: item.takenAt, gps: item.gps, orientation: item.orientation },
      item.hash
    );
  }

  function patch(id: string, next: Partial<Item>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...next } : it)));
  }

  function remove(id: string) {
    void removeDraftFile(id).catch(() => {});
    setItems((prev) => {
      const target = prev.find((it) => it.id === id);
      if (target?.hash) {
        const info = knownHashes.current.get(target.hash);
        if (info?.state === "pending") knownHashes.current.delete(target.hash);
      }
      if (target?.preview) URL.revokeObjectURL(target.preview);
      if (target?.thumbPreview && target.thumbPreview !== target.preview) {
        URL.revokeObjectURL(target.thumbPreview);
      }
      return prev.filter((it) => it.id !== id);
    });
  }

  function clearList() {
    if (!window.confirm("清空当前列表？已上传的照片不会被删除。")) return;
    for (const it of items) {
      if (it.preview) URL.revokeObjectURL(it.preview);
      if (it.thumbPreview && it.thumbPreview !== it.preview) URL.revokeObjectURL(it.thumbPreview);
    }
    setItems([]);
    void clearDraft().catch(() => {});
    setNotice("列表已清空，草稿已移除");
  }

  function setCover(id: string) {
    setItems((prev) => {
      const target = prev.find((it) => it.id === id);
      if (!target) return prev;
      return prev.map((it) =>
        it.trip === target.trip ? { ...it, cover: it.id === id ? !target.cover : false } : it
      );
    });
  }

  function openNewTrip(coord: [number, number] | null, geo?: GeoPlace | null) {
    const pre = tripFromPlace(geo);
    setDialog({
      open: true,
      coord,
      country: pre.country,
      countryEn: pre.countryEn,
      place: pre.place,
      error: "",
    });
  }

  async function createTrip() {
    const country = dialog.country.trim();
    const place = dialog.place.trim();
    const coord = dialog.coord;
    if (!country || !place) {
      setDialog((d) => ({ ...d, error: "国家和城市都要填" }));
      return;
    }
    if (!coord) {
      setDialog((d) => ({ ...d, error: "没有 GPS 就无法确定坐标；请从一张带 GPS 的照片旁点「新建行程」" }));
      return;
    }

    const base = Number(nextTripId(allTrips));
    let trip: LocalTrip | null = null;
    let conflict = false;

    try {
      for (let attempt = 0; attempt < 3 && !trip; attempt++) {
        const num = base + attempt;
        if (num > 99) break;
        const id = String(num).padStart(2, "0");
        const res = await fetch(`${API}/trip`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            id,
            country,
            countryEn: dialog.countryEn.trim() || undefined,
            place,
            coord,
          }),
          signal: timeoutSignal(20_000),
        });
        if (res.status === 409) {
          conflict = true;
          continue;
        }
        const data = (await res.json().catch(() => ({}))) as { error?: string; id?: string };
        if (!res.ok) throw new Error(data.error || `新建失败（HTTP ${res.status}）`);
        trip = {
          img: data.id || id,
          country,
          countryEn: dialog.countryEn.trim() || undefined,
          place,
          coord,
        };
      }
    } catch (err) {
      setDialog((d) => ({ ...d, error: friendlyError(err, "新建失败") }));
      return;
    }

    if (!trip) {
      setDialog((d) => ({
        ...d,
        error: conflict ? "行程编号被占用了，请刷新页面再试" : "找不到可用编号",
      }));
      return;
    }

    try {
      setExtraTrips((prev) => [...prev, trip]);

      // 把坐标 120km 内、还没归站的同批照片一起归进去
      const targets = items.filter(
        (it) => !it.trip && it.gps && distanceKm(it.gps, trip.coord) <= 120
      );
      const targetIds = new Set(targets.map((t) => t.id));
      setItems((prev) =>
        prev.map((it) =>
          targetIds.has(it.id) ? { ...it, trip: trip.img, candidate: undefined } : it
        )
      );

      setDialog({ open: false, coord: null, country: "", countryEn: "", place: "", error: "" });
      setNotice(
        `已新建 ${trip.place}（${trip.img}）${targets.length ? `，同批 ${targets.length} 张一并归入` : ""}`
      );
    } catch (err) {
      setDialog((d) => ({ ...d, error: err instanceof Error ? err.message : "新建失败" }));
    }
  }

  type UploadOutcome =
    | { ok: true; photo: UploadedPhoto }
    | { ok: false; duplicate?: { trip?: string; takenAt?: string; key?: string; url?: string }; error?: string };

  async function uploadOne(item: Item): Promise<UploadOutcome> {
    if (!item.blob) return { ok: false, error: "文件还没准备好" };
    if (!item.trip) return { ok: false, error: "还没选行程" };
    const fd = new FormData();
    const ext = item.blob.type === "image/jpeg" ? "jpg" : item.blob.type === "image/png" ? "png" : "webp";
    fd.append("file", new File([item.blob], `${item.trip}.${ext}`, { type: item.blob.type || "image/webp" }));
    if (item.thumb) {
      const thumbExt =
        item.thumb.type === "image/jpeg" ? "jpg" : item.thumb.type === "image/png" ? "png" : "webp";
      fd.append(
        "thumb",
        new File([item.thumb], `${item.trip}-thumb.${thumbExt}`, {
          type: item.thumb.type || "image/webp",
        })
      );
    }
    fd.append("trip", item.trip);
    fd.append("takenAt", item.takenAt);
    fd.append("w", String(item.width));
    fd.append("h", String(item.height));
    if (item.geo?.label) fd.append("place", item.geo.label);
    fd.append("cover", item.cover ? "1" : "0");
    /* 原文件 hash：服务端据此兜底查重；用户点过「仍然上传」才带 force */
    if (item.hash) fd.append("hash", item.hash);
    if (item.forced) fd.append("force", "1");

    const res = await fetch(`${API}/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
      signal: timeoutSignal(120_000),
    });
    if (res.status === 409) {
      const data = (await res.json().catch(() => ({}))) as {
        photo?: { trip?: string; takenAt?: string; key?: string; url?: string } | null;
      };
      return { ok: false, duplicate: data.photo ?? {} };
    }
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.status === 401) return { ok: false, error: "token 无效，请重新输入" };
      return { ok: false, error: data.error || `上传失败（HTTP ${res.status}）` };
    }
    const data = (await res.json()) as UploadedPhoto;
    return { ok: true, photo: { ...data, trip: item.trip, takenAt: item.takenAt } };
  }

  async function uploadAll() {
    if (busy || !uploadable.length) return;
    setBusy(true);
    setNotice("");
    for (const snapshot of uploadable) {
      // 用最新状态，避免上传途中改行程后仍传到旧行程
      const item = itemsRef.current.find((i) => i.id === snapshot.id);
      if (!item || item.status !== "ready" || !item.trip) continue;
      patch(item.id, { status: "uploading", error: undefined });
      try {
        const outcome = await uploadOne(item);
        if (!outcome.ok) {
          /* 服务端兜底判重（并发/异设备上传）：转成「已上传过」，不算失败 */
          if (outcome.duplicate) {
            const dup = outcome.duplicate;
            patch(item.id, {
              status: "duplicate",
              dupOf: {
                trip: dup.trip || item.trip,
                takenAt: dup.takenAt,
                key: dup.key,
              },
              error: undefined,
            });
            if (item.hash) {
              knownHashes.current.set(item.hash, {
                state: "uploaded",
                trip: dup.trip || item.trip,
                takenAt: dup.takenAt,
                key: dup.key,
              });
            }
            setNotice("服务器判定有照片重复，已标记为「已上传过」");
          } else {
            patch(item.id, { status: "error", error: outcome.error ?? "上传失败" });
          }
          continue;
        }
        const meta = outcome.photo;
        patch(item.id, { status: "done", url: meta.url, blob: undefined, uploadedSize: meta.bytes });
        if (item.hash) {
          knownHashes.current.set(item.hash, {
            state: "uploaded",
            trip: meta.trip,
            takenAt: meta.takenAt,
            key: meta.key,
            thumbUrl: meta.thumbUrl,
          });
        }
        // 草稿瘦身：上传成功后只保留缩略图，释放 IndexedDB 空间
        if (item.thumb) {
          void putDraftFile({
            id: item.id,
            name: item.name,
            size: item.size,
            thumb: item.thumb,
            width: item.width,
            height: item.height,
            takenAt: item.takenAt,
            gps: item.gps,
          }).catch(() => {});
        }
        setUploaded((prev) => [meta, ...prev.filter((p) => p.key !== meta.key)]);
      } catch (err) {
        patch(item.id, { status: "error", error: friendlyError(err, "上传失败") });
      }
    }
    if (missing) setNotice(`${missing} 张还没选行程，已跳过；选好后再传一次即可`);
    setBusy(false);
  }

  async function patchPhoto(
    key: string,
    patch: Partial<Pick<UploadedPhoto, "trip" | "caption" | "place" | "cover">>,
    success: string
  ) {
    try {
      const res = await fetch(`${API}/photo`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ key, ...patch }),
        signal: timeoutSignal(20_000),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || `修改失败（HTTP ${res.status}）`);
      setUploaded((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));
      setNotice(success);
    } catch (err) {
      setNotice(friendlyError(err, "修改失败"));
    }
  }

  function movePhoto(key: string, trip: string) {
    if (!trip) return;
    void patchPhoto(key, { trip }, `已改到 ${tripLabel(trip)}；下次构建后生效`);
  }

  function editCaption(p: UploadedPhoto) {
    const next = window.prompt("图注（留空清除）", p.caption ?? "");
    if (next === null) return;
    const caption = next.trim();
    void patchPhoto(
      p.key,
      { caption },
      caption ? "图注已更新；下次构建后生效" : "图注已清除"
    );
  }

  function toggleCover(p: UploadedPhoto) {
    const next = !p.cover;
    void patchPhoto(p.key, { cover: next }, next ? "已设为封面；下次构建后生效" : "已取消封面");
  }

  function editPlace(p: UploadedPhoto) {
    const next = window.prompt("拍摄地（如 Vik, Iceland）", p.place ?? "");
    if (next === null) return;
    const place = next.trim();
    void patchPhoto(
      p.key,
      { place },
      place ? "拍摄地已更新；下次构建后生效" : "拍摄地已清除"
    );
  }

  async function deletePhoto(p: UploadedPhoto) {
    if (
      !window.confirm(
        `删除这张照片？\n${p.key}\n\n会同时删除原图、缩略图和元数据，不可恢复。`
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`${API}/photo`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ key: p.key }),
        signal: timeoutSignal(30_000),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || `删除失败（HTTP ${res.status}）`);
      setUploaded((prev) => prev.filter((x) => x.key !== p.key));
      setNotice("已删除；下次构建后从站点消失");
    } catch (err) {
      setNotice(friendlyError(err, "删除失败"));
    }
  }

  async function publish() {
    if (publishing) return;
    setPublishing(true);
    setNotice("");
    try {
      const res = await fetch(`${API}/publish`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || `发布失败（HTTP ${res.status}）`);
      setNotice("已触发 GitHub Actions 构建，约 2 分钟后上线");
      void pollStatus(8);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "发布失败");
    } finally {
      setPublishing(false);
    }
  }

  async function pollStatus(times = 1) {
    for (let i = 0; i < times; i++) {
      try {
        const res = await fetch(`${API}/status`, { headers: { Authorization: `Bearer ${token}` }, signal: timeoutSignal(15_000) });
        if (res.ok) {
          const data = (await res.json()) as RunStatus;
          setRun(data);
          if (data.state === "completed") return;
        }
      } catch {
        /* 网络抖动忽略 */
      }
      await new Promise((r) => setTimeout(r, 6000));
    }
  }

  async function testConnection() {
    setNotice("正在连接…");
    try {
      /* geocode=1 是诊断口，Worker 端已要求鉴权；这里带上 token */
      const res = await fetch(`${API}/health?geocode=1`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: timeoutSignal(20_000),
      });
      if (res.status === 401) {
        setNotice("token 无效，请重新输入");
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        geocode?: { status?: number | string; provider?: string; label?: string };
        github?: { configured?: boolean };
      };
      if (res.ok && data.ok) {
        const g = data.geocode;
        const geoText =
          g?.status === 200
            ? `正常（${g.provider ?? "?"} · ${g.label ?? ""}）`
            : `异常（${g?.status ?? "未返回"}）`;
        setNotice(
          `Worker 在线：${API}　地名服务：${geoText}${data.github ? `　GitHub 发布：${data.github.configured ? "已配置" : "未配置"}` : ""}`
        );
      } else {
        setNotice(`Worker 响应异常（HTTP ${res.status}）`);
      }
    } catch {
      setNotice(`连不上 ${API} —— 还没部署或域名没生效`);
    }
  }

  if (!token) {
    return (
      <main className="upload-page">
        <header className="upload-head">
          <p className="upload-kicker">TRAVEL UPLOAD</p>
          <h1>
            手机传照片<span>.</span>
          </h1>
          <p className="upload-sub">先输入上传口令。它只保存在这台手机的浏览器里。</p>
        </header>
        <section className="upload-gate">
          <label htmlFor="upload-token">UPLOAD TOKEN</label>
          <input
            id="upload-token"
            type="password"
            autoComplete="current-password"
            value={tokenDraft}
            onChange={(e) => setTokenDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveToken()}
            placeholder="wrangler secret put UPLOAD_TOKEN 设置的那串"
          />
          <button type="button" onClick={saveToken} disabled={!tokenDraft.trim()}>
            保存并进入
          </button>
          <p className="upload-hint">API：{API}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="upload-page">
      <header className="upload-head">
        <p className="upload-kicker">TRAVEL UPLOAD</p>
        <h1>
          手机传照片<span>.</span>
        </h1>
        <p className="upload-sub">
          自动读拍摄时间和 GPS 归站 → 转 WebP → 批量上传 → 点一次发布才触发构建。
        </p>
      </header>

      <section className="upload-bar">
        <label className="upload-pick">
          <input
            ref={fileRef}
            type="file"
            accept="image/*,.heic,.heif"
            multiple
            onChange={(e) => void addFiles(e.target.files)}
          />
          <span>选择照片</span>
        </label>

        <label className="upload-default">
          无 GPS 时默认
          <select value={defaultTrip} onChange={(e) => pickDefaultTrip(e.target.value)}>
            {tripOptions()}
          </select>
        </label>

        <button
          type="button"
          className="upload-ghost"
          onClick={() => {
            const first = items.find((i) => !i.trip && i.gps);
            openNewTrip(first?.gps ?? null, first?.geo);
          }}
        >
          ＋ 新建行程
        </button>

        <button type="button" className="upload-ghost" onClick={() => void testConnection()}>
          测试连接
        </button>
      </section>

      {notice ? <p className="upload-notice">{notice}</p> : null}

      <section className="upload-list" aria-live="polite" ref={listRef}>
        {items.length === 0 ? (
          <p className="upload-empty">还没有照片。点「选择照片」开始。</p>
        ) : (
          items.map((item) => {
            const unmatched = item.status === "ready" && !item.trip;
            const dayTrip = unmatched ? sameDayTrip(item) : null;
            const locked = busy || item.status === "done" || item.status === "uploading" || item.status === "duplicate" || item.status === "queued" || item.status === "processing";
            return (
              <article
                key={item.id}
                className={`upload-item is-${item.status}${unmatched ? " is-unmatched" : ""}`}
              >
                <div className="upload-thumb">
                  <span className="upload-thumb-ph" aria-hidden="true">
                    {item.status === "duplicate" ? "✓" : item.status === "error" ? "!" : "…"}
                  </span>
                  {(item.thumbPreview ?? item.preview) ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={item.thumbPreview ?? item.preview}
                      alt=""
                      onError={(e) => {
                        e.currentTarget.dataset.broken = "1";
                      }}
                    />
                  ) : null}
                </div>

                <div className="upload-info">
                  <b title={item.name}>{item.name}</b>
                  <span>
                    {item.status === "queued" ? "读取信息中…" : formatTakenAt(item.takenAt)}
                    {item.width ? ` · ${item.width}×${item.height}` : ""} · 原始 {mb(item.size)}
                    {item.blob ? ` → 上传 ${mb(item.blob.size)}` : item.uploadedSize ? ` → 已上传 ${mb(item.uploadedSize)}` : ""}
                  </span>

                  {item.status === "duplicate" ? (
                    <em className="is-dup">
                      {item.dupOf?.inBatch
                        ? "这张照片在这批里已经选过一次了"
                        : `已上传过${item.dupOf?.trip ? ` · ${tripLabel(item.dupOf.trip)}` : ""}${
                            item.dupOf?.takenAt ? ` · ${formatTakenAt(item.dupOf.takenAt)}` : ""
                          }`}
                    </em>
                  ) : null}

                  {unmatched ? (
                    <em className="is-unmatched">
                      {item.gps
                        ? item.candidate
                          ? `GPS 最近是 ${tripLabel(item.candidate)}（约 ${item.distanceKm ?? "?"}km），要归到这里吗？`
                          : `GPS 最近的是 ${item.nearest ? tripLabel(item.nearest) : "未知"}（约 ${item.distanceKm ?? "?"}km），不在已知站点`
                        : "没有 GPS，也没选行程"}
                    </em>
                  ) : item.candidate && item.trip === item.candidate ? (
                    <em>GPS 建议 {tripLabel(item.candidate)} · 约 {item.distanceKm ?? "?"}km</em>
                  ) : item.gps && item.trip ? (
                    <em>
                      GPS 归到 {tripLabel(item.trip)}
                      {typeof item.distanceKm === "number" ? ` · 约 ${item.distanceKm}km` : ""}
                    </em>
                  ) : !item.gps && item.trip ? (
                    <em>无 GPS，按默认行程归到 {tripLabel(item.trip)}</em>
                  ) : null}

                  {item.error ? <em className="is-error">{item.error}</em> : null}

                  {item.geo ? (
                    <span className="upload-geo">
                      拍摄地 · {item.geo.label}
                      {item.geo.city ? `（${item.geo.city}）` : ""}
                    </span>
                  ) : item.geoStatus === "loading" ? (
                    <span className="upload-geo">地名解析中…</span>
                  ) : item.geoStatus === "error" ? (
                    <span className="upload-geo is-error">
                      地名解析失败{item.geoError ? `（${item.geoError}）` : ""}
                      <button type="button" onClick={() => void retryGeo(item)}>
                        重试
                      </button>
                    </span>
                  ) : null}

                  {unmatched ? (
                    <span className="upload-suggest">
                      {dayTrip ? (
                        <button
                          type="button"
                          className="is-strong"
                          onClick={() => patch(item.id, { trip: dayTrip.trip, candidate: undefined })}
                        >
                          归到 {tripLabel(dayTrip.trip)}（同日 {dayTrip.count} 张）
                        </button>
                      ) : null}
                      {item.candidate && (!dayTrip || dayTrip.trip !== item.candidate) ? (
                        <button type="button" onClick={() => patch(item.id, { trip: item.candidate!, candidate: undefined })}>
                          采用 {tripLabel(item.candidate)}
                        </button>
                      ) : null}
                      <button type="button" onClick={() => openNewTrip(item.gps ?? null, item.geo)}>
                        {item.geo?.city ? `＋ 新建 ${item.geo.city}` : "＋ 新建行程"}
                      </button>
                    </span>
                  ) : null}
                </div>

                <div className="upload-controls">
                  <select
                    value={item.trip}
                    onChange={(e) => patch(item.id, { trip: e.target.value, candidate: undefined })}
                    disabled={locked}
                    aria-label="归到哪个行程"
                  >
                    {tripOptions(true)}
                  </select>

                  <label className="upload-cover">
                    <input
                      type="checkbox"
                      checked={item.cover}
                      onChange={() => setCover(item.id)}
                      disabled={locked || !item.trip}
                    />
                    封面
                  </label>

                  {item.status === "duplicate" ? (
                    <button
                      type="button"
                      className="upload-ghost upload-force"
                      onClick={() => void forceUpload(item)}
                      disabled={busy}
                    >
                      仍然上传
                    </button>
                  ) : null}

                  <span className={`upload-state is-${item.status}`}>{statusText(item.status)}</span>

                  {item.url ? (
                    <a href={item.url} target="_blank" rel="noreferrer">
                      查看
                    </a>
                  ) : null}

                  <button
                    type="button"
                    className="upload-ghost"
                    onClick={() => remove(item.id)}
                    disabled={busy || item.status === "uploading"}
                  >
                    移除
                  </button>
                </div>
              </article>
            );
          })
        )}
      </section>

      {uploaded.length ? (
        <details className="upload-history">
          <summary>
            最近上传 · {uploaded.length} 张<span>（归错了可以直接改）</span>
          </summary>
          <ul>
            {uploaded.map((p) => (
              <li key={p.key}>
                {p.thumbUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    className="upload-history-thumb"
                    src={p.thumbUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <span className="upload-history-thumb is-empty" aria-hidden="true" />
                )}
                <div className="upload-history-main">
                  <span className="upload-history-meta">
                    {p.takenAt ? formatTakenAt(p.takenAt) : p.key.split("/").pop()}
                    {p.place ? ` · ${p.place}` : " · 未记录拍摄地"}
                    {p.caption ? ` · ${p.caption}` : ""}
                  </span>
                  <div className="upload-history-actions">
                    <select
                      value={p.trip}
                      onChange={(e) => movePhoto(p.key, e.target.value)}
                      aria-label="修改归属"
                    >
                      {tripOptions(true)}
                    </select>
                    <button
                      type="button"
                      onClick={() => editCaption(p)}
                      aria-label="编辑图注"
                      title="编辑图注"
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      onClick={() => editPlace(p)}
                      aria-label="编辑拍摄地"
                      title="编辑拍摄地"
                    >
                      📍
                    </button>
                    <button
                      type="button"
                      className={p.cover ? "is-on" : undefined}
                      onClick={() => toggleCover(p)}
                      aria-label={p.cover ? "取消封面" : "设为封面"}
                      title={p.cover ? "取消封面" : "设为封面"}
                    >
                      {p.cover ? "★" : "☆"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void deletePhoto(p)}
                      aria-label="删除照片"
                      title="删除照片"
                    >
                      ✕
                    </button>
                    <a href={p.url} target="_blank" rel="noreferrer">
                      查看
                    </a>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <footer className="upload-actions">
        <span>
          {uploadable.length} 张待上传 · {mb(pendingBytes)}
          {missing ? `　· ${missing} 张待定行程` : ""}
          {dupCount ? `　· ${dupCount} 张已上传过` : ""}
          {doneCount ? `　已上传 ${doneCount} 张` : ""}
          {progress ? (
            <span className="upload-progress" role="status">
              <i style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%` }} />
              处理中 {progress.done}/{progress.total}
            </span>
          ) : null}
        </span>
        <button type="button" onClick={() => void uploadAll()} disabled={busy || !uploadable.length}>
          {busy ? "上传中…" : "开始上传"}
        </button>
        <button
          type="button"
          className="is-primary"
          onClick={() => void publish()}
          disabled={publishing || busy || ready.length > 0}
        >
          {publishing ? "发布中…" : "发布这批"}
        </button>
      </footer>

      {run ? (
        <section className="upload-run">
          <b>最近一次构建</b>
          <span>
            {run.state}
            {run.conclusion ? ` · ${run.conclusion}` : ""}
          </span>
          {run.url ? (
            <a href={run.url} target="_blank" rel="noreferrer">
              在 GitHub 查看
            </a>
          ) : null}
        </section>
      ) : null}

      <div className="upload-foot-actions">
        <button
          type="button"
          className="upload-token-reset"
          onClick={() => {
            localStorage.removeItem(TOKEN_KEY);
            setToken("");
          }}
        >
          清除本机 token
        </button>
        <button
          type="button"
          className="upload-token-reset"
          onClick={clearList}
          disabled={!items.length}
        >
          清空列表
        </button>
      </div>

      {dialog.open ? (
        <div className="upload-modal" role="dialog" aria-modal="true" aria-label="新建行程">
          <div className="upload-modal-card">
            <h2>新建行程</h2>
            <p className="upload-hint">
              坐标：{dialog.coord ? `${dialog.coord[0].toFixed(2)}, ${dialog.coord[1].toFixed(2)}` : "无 GPS"}
            </p>
            <label>
              国家（中文）
              <input
                value={dialog.country}
                onChange={(e) => setDialog((d) => ({ ...d, country: e.target.value }))}
                placeholder="意大利"
              />
            </label>
            <label>
              Country（英文，可选）
              <input
                value={dialog.countryEn}
                onChange={(e) => setDialog((d) => ({ ...d, countryEn: e.target.value }))}
                placeholder="Italy"
              />
            </label>
            <label>
              城市（中文 + 英文）
              <input
                value={dialog.place}
                onChange={(e) => setDialog((d) => ({ ...d, place: e.target.value }))}
                placeholder="米兰 MILAN"
              />
            </label>
            {dialog.error ? <p className="upload-err">{dialog.error}</p> : null}
            <div className="upload-modal-actions">
              <button
                type="button"
                className="upload-ghost"
                onClick={() => setDialog({ open: false, coord: null, country: "", countryEn: "", place: "", error: "" })}
              >
                取消
              </button>
              <button type="button" className="is-primary" onClick={() => void createTrip()}>
                创建并归入
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}




