"use client";

/**
 * /upload —— 手机端旅行照片上传。
 * 流程：选照片 → 读 EXIF（时间/GPS）→ 自动建议行程 → 转 WebP → 批量上传 → 发布触发构建。
 *
 * 归站规则（2026-11 调整）：
 *   ≤50km   自动归入；
 *   50–200km 只给候选，不自动采用；
 *   >200km  视为「不在已知站点」，不猜、不回落默认行程，交给用户选择或新建。
 * 安全：页面只是壳，写权限在 Worker 的 UPLOAD_TOKEN。
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { TRIPS } from "@/data/trips";
import { distanceKm, formatTakenAt, isHeic, readPhotoMeta, suggestTrip, toOptimizedImage } from "@/lib/client-photo";
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

type Status = "processing" | "ready" | "uploading" | "done" | "error";

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
  blob?: Blob;
  thumb?: Blob;
  preview?: string;
  thumbPreview?: string;
  gps?: [number, number];
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
  return { processing: "处理中", ready: "待上传", uploading: "上传中", done: "已上传", error: "失败" }[s];
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

/** 只把可重建状态写进 IndexedDB；Blob 单独按 id 存，避免每次改行程都重写大文件 */
function toDraftMeta(items: Item[]): DraftMeta[] {
  return items
    .filter((i) => i.status !== "processing")
    .map((i, order) => ({
      id: i.id,
      order,
      trip: i.trip,
      status: i.status as DraftMeta["status"],
      url: i.url,
      error: i.error,
      cover: i.cover,
      candidate: i.candidate,
      nearest: i.nearest,
      distanceKm: i.distanceKm,
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
  const [dialog, setDialog] = useState<TripDialog>({
    open: false,
    coord: null,
    country: "",
    countryEn: "",
    place: "",
    error: "",
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const restoredRef = useRef(false);
  const itemsRef = useRef<Item[]>([]);

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
              cover?: boolean;
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
                error: m.error,
                cover: m.cover,
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

  async function addFiles(list: FileList | null) {
    if (!list?.length) return;
    const files = Array.from(list).filter((f) => f.type.startsWith("image/") || isHeic(f));
    if (!files.length) {
      setNotice("没有识别到图片文件");
      return;
    }
    setNotice("");

    for (const file of files) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const meta = await readPhotoMeta(file);
      const sug = suggestTrip(meta.gps);
      // 有 GPS 但没匹配上就不猜；只有完全没有 GPS 时才用默认行程
      const trip = sug.trip ?? (meta.gps ? "" : defaultTrip);

      setItems((prev) => [
        ...prev,
        {
          id,
          name: file.name,
          size: file.size,
          gps: meta.gps,
          trip,
          candidate: sug.candidate,
          nearest: sug.nearest,
          distanceKm: sug.distanceKm,
          takenAt: meta.takenAt,
          width: 0,
          height: 0,
          status: "processing",
          cover: false,
        },
      ]);

      try {
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
        setItems((prev) =>
          prev.map((it) =>
            it.id === id
              ? {
                  ...it,
                  blob: conv.blob,
                  thumb: conv.thumb,
                  preview,
                  thumbPreview: preview,
                  width: conv.width,
                  height: conv.height,
                  status: "ready",
                }
              : it
          )
        );
      } catch (err) {
        setItems((prev) =>
          prev.map((it) =>
            it.id === id
              ? { ...it, status: "error", error: err instanceof Error ? err.message : "转码失败" }
              : it
          )
        );
      }
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  function patch(id: string, next: Partial<Item>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...next } : it)));
  }

  function remove(id: string) {
    void removeDraftFile(id).catch(() => {});
    setItems((prev) => {
      const target = prev.find((it) => it.id === id);
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

  function openNewTrip(coord: [number, number] | null) {
    setDialog({ open: true, coord, country: "", countryEn: "", place: "", error: "" });
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

  async function uploadOne(item: Item): Promise<UploadedPhoto> {
    if (!item.blob) throw new Error("文件还没准备好");
    if (!item.trip) throw new Error("还没选行程");
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
    fd.append("cover", item.cover ? "1" : "0");

    const res = await fetch(`${API}/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
      signal: timeoutSignal(120_000),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.status === 401) throw new Error("token 无效，请重新输入");
      throw new Error(data.error || `上传失败（HTTP ${res.status}）`);
    }
    const data = (await res.json()) as UploadedPhoto;
    return { ...data, trip: item.trip, takenAt: item.takenAt };
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
        const meta = await uploadOne(item);
        patch(item.id, { status: "done", url: meta.url, blob: undefined, uploadedSize: meta.bytes });
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
    patch: Partial<Pick<UploadedPhoto, "trip" | "caption" | "cover">>,
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
      const res = await fetch(`${API}/health`, { signal: timeoutSignal(10_000) });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; github?: { configured?: boolean } };
      if (res.ok && data.ok) {
        setNotice(
          `Worker 在线：${API}${data.github ? `　GitHub 发布：${data.github.configured ? "已配置" : "未配置"}` : ""}`
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
          onClick={() => openNewTrip(items.find((i) => !i.trip && i.gps)?.gps ?? null)}
        >
          ＋ 新建行程
        </button>

        <button type="button" className="upload-ghost" onClick={() => void testConnection()}>
          测试连接
        </button>
      </section>

      {notice ? <p className="upload-notice">{notice}</p> : null}

      <section className="upload-list" aria-live="polite">
        {items.length === 0 ? (
          <p className="upload-empty">还没有照片。点「选择照片」开始。</p>
        ) : (
          items.map((item) => {
            const unmatched = item.status === "ready" && !item.trip;
            return (
              <article
                key={item.id}
                className={`upload-item is-${item.status}${unmatched ? " is-unmatched" : ""}`}
              >
                <div className="upload-thumb">
                  {(item.thumbPreview ?? item.preview) ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={item.thumbPreview ?? item.preview} alt="" />
                  ) : (
                    <span>{item.status === "processing" ? "转码中…" : "!"}</span>
                  )}
                </div>

                <div className="upload-info">
                  <b title={item.name}>{item.name}</b>
                  <span>
                    {formatTakenAt(item.takenAt)}
                    {item.width ? ` · ${item.width}×${item.height}` : ""} · 原始 {mb(item.size)}
                    {item.blob ? ` → 上传 ${mb(item.blob.size)}` : item.uploadedSize ? ` → 已上传 ${mb(item.uploadedSize)}` : ""}
                  </span>

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

                  {unmatched ? (
                    <span className="upload-suggest">
                      {item.candidate ? (
                        <button type="button" onClick={() => patch(item.id, { trip: item.candidate!, candidate: undefined })}>
                          采用 {tripLabel(item.candidate)}
                        </button>
                      ) : null}
                      <button type="button" onClick={() => openNewTrip(item.gps ?? null)}>
                        ＋ 新建行程
                      </button>
                    </span>
                  ) : null}
                </div>

                <div className="upload-controls">
                  <select
                    value={item.trip}
                    onChange={(e) => patch(item.id, { trip: e.target.value, candidate: undefined })}
                    disabled={busy || item.status === "done" || item.status === "uploading"}
                    aria-label="归到哪个行程"
                  >
                    {tripOptions(true)}
                  </select>

                  <label className="upload-cover">
                    <input
                      type="checkbox"
                      checked={item.cover}
                      onChange={() => setCover(item.id)}
                      disabled={busy || item.status === "done" || !item.trip}
                    />
                    封面
                  </label>

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
          {doneCount ? `　已上传 ${doneCount} 张` : ""}
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



