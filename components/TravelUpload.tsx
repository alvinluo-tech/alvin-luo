"use client";

/**
 * /upload —— 手机端旅行照片上传。
 * 流程：选照片 → 读 EXIF（时间/GPS）→ 自动建议行程 → 转 WebP → 批量上传 → 发布触发构建。
 * 安全：页面本身只是壳，真正的写权限在 Worker 的 UPLOAD_TOKEN。
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { TRIPS } from "@/data/trips";
import { formatTakenAt, isHeic, readPhotoMeta, suggestTrip, toWebp } from "@/lib/client-photo";
import "./TravelUpload.css";

const API = (process.env.NEXT_PUBLIC_UPLOAD_API || "https://upload.alvin-luo.me").replace(/\/+$/, "");
const TOKEN_KEY = "travel_upload_token";
const TRIP_KEY = "travel_upload_last_trip";

type Status = "processing" | "ready" | "uploading" | "done" | "error";

type Item = {
  id: string;
  name: string;
  size: number;
  blob?: Blob;
  preview?: string;
  trip: string;
  suggested?: string;
  distanceKm?: number;
  ambiguous: boolean;
  takenAt: string;
  width: number;
  height: number;
  status: Status;
  url?: string;
  error?: string;
  cover: boolean;
};

type RunStatus = {
  state: string;
  conclusion?: string | null;
  url?: string;
  updatedAt?: string;
};

const TRIP_BY_ID = new Map(TRIPS.map((t) => [t.img, t]));

const GROUPS = TRIPS.reduce<Record<string, typeof TRIPS>>((acc, t) => {
  (acc[t.country] ??= []).push(t);
  return acc;
}, {});

function tripLabel(id: string): string {
  const t = TRIP_BY_ID.get(id);
  return t ? `${t.img} · ${t.place.split(" ")[0]}` : id;
}

function mb(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function statusText(s: Status): string {
  return { processing: "处理中", ready: "待上传", uploading: "上传中", done: "已上传", error: "失败" }[s];
}

export default function TravelUpload() {
  const [token, setToken] = useState("");
  const [tokenDraft, setTokenDraft] = useState("");
  const [defaultTrip, setDefaultTrip] = useState(TRIPS[0]?.img ?? "05");
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [run, setRun] = useState<RunStatus | null>(null);
  const [publishing, setPublishing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setToken(localStorage.getItem(TOKEN_KEY) || "");
    const last = localStorage.getItem(TRIP_KEY);
    if (last && TRIP_BY_ID.has(last)) setDefaultTrip(last);
  }, []);

  const ready = useMemo(() => items.filter((i) => i.status === "ready"), [items]);
  const pendingBytes = useMemo(() => ready.reduce((n, i) => n + (i.blob?.size ?? i.size), 0), [ready]);
  const doneCount = useMemo(() => items.filter((i) => i.status === "done").length, [items]);

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
      const trip = sug.trip ?? defaultTrip;

      setItems((prev) => [
        ...prev,
        {
          id,
          name: file.name,
          size: file.size,
          trip,
          suggested: sug.trip,
          distanceKm: sug.distanceKm,
          ambiguous: sug.ambiguous,
          takenAt: meta.takenAt,
          width: 0,
          height: 0,
          status: "processing",
          cover: false,
        },
      ]);

      try {
        const conv = await toWebp(file);
        const preview = URL.createObjectURL(conv.blob);
        setItems((prev) =>
          prev.map((it) =>
            it.id === id
              ? { ...it, blob: conv.blob, preview, width: conv.width, height: conv.height, status: "ready" }
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
    setItems((prev) => {
      const target = prev.find((it) => it.id === id);
      if (target?.preview) URL.revokeObjectURL(target.preview);
      return prev.filter((it) => it.id !== id);
    });
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

  async function uploadOne(item: Item): Promise<string> {
    if (!item.blob) throw new Error("文件还没准备好");
    const fd = new FormData();
    fd.append("file", new File([item.blob], `${item.trip}.webp`, { type: "image/webp" }));
    fd.append("trip", item.trip);
    fd.append("takenAt", item.takenAt);
    fd.append("w", String(item.width));
    fd.append("h", String(item.height));
    fd.append("cover", item.cover ? "1" : "0");

    const res = await fetch(`${API}/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.status === 401) throw new Error("token 无效，请重新输入");
      throw new Error(data.error || `上传失败（HTTP ${res.status}）`);
    }
    const data = (await res.json()) as { url: string };
    return data.url;
  }

  async function uploadAll() {
    if (busy || !ready.length) return;
    setBusy(true);
    setNotice("");
    for (const item of ready) {
      patch(item.id, { status: "uploading", error: undefined });
      try {
        const url = await uploadOne(item);
        patch(item.id, { status: "done", url });
      } catch (err) {
        patch(item.id, { status: "error", error: err instanceof Error ? err.message : "上传失败" });
      }
    }
    setBusy(false);
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
        const res = await fetch(`${API}/status`, { headers: { Authorization: `Bearer ${token}` } });
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
      const res = await fetch(`${API}/health`);
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean };
      setNotice(res.ok && data.ok ? `Worker 在线：${API}` : `Worker 响应异常（HTTP ${res.status}）`);
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
          <button type="button" onClick={saveToken} disabled={!tokenDraft.trim()}>            保存并进入
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
            {Object.entries(GROUPS).map(([country, list]) => (
              <optgroup key={country} label={country}>
                {list.map((t) => (
                  <option key={t.img} value={t.img}>
                    {t.img} · {t.place}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        <button type="button" className="upload-ghost" onClick={() => void testConnection()}>
          测试连接
        </button>
      </section>

      {notice ? <p className="upload-notice">{notice}</p> : null}

      <section className="upload-list" aria-live="polite">
        {items.length === 0 ? (
          <p className="upload-empty">还没有照片。点「选择照片」开始。</p>
        ) : (
          items.map((item) => (
            <article key={item.id} className={`upload-item is-${item.status}`}>
              <div className="upload-thumb">
                {item.preview ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={item.preview} alt="" />
                ) : (
                  <span>{item.status === "processing" ? "转码中…" : "!"}</span>
                )}
              </div>

              <div className="upload-info">
                <b title={item.name}>{item.name}</b>
                <span>
                  {formatTakenAt(item.takenAt)}
                  {item.width ? ` · ${item.width}×${item.height}` : ""} · {mb(item.size)}
                </span>
                {item.ambiguous && item.suggested ? (
                  <em>
                    GPS 离 {tripLabel(item.suggested)} 约 {item.distanceKm ?? "?"}km，附近还有别的站点，确认一下
                  </em>
                ) : item.suggested ? (
                  <em>
                    {item.trip === item.suggested ? "GPS 已归到 " : "GPS 建议 "}
                    {tripLabel(item.suggested)}
                    {typeof item.distanceKm === "number" ? ` · 约 ${item.distanceKm}km` : ""}
                  </em>
                ) : null}
                {item.error ? <em className="is-error">{item.error}</em> : null}
              </div>

              <div className="upload-controls">
                <select
                  value={item.trip}
                  onChange={(e) => patch(item.id, { trip: e.target.value })}
                  disabled={item.status === "done" || item.status === "uploading"}
                  aria-label="归到哪个行程"
                >
                  {Object.entries(GROUPS).map(([country, list]) => (
                    <optgroup key={country} label={country}>
                      {list.map((t) => (
                        <option key={t.img} value={t.img}>
                          {t.img} · {t.place}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>

                <label className="upload-cover">
                  <input
                    type="checkbox"
                    checked={item.cover}
                    onChange={() => setCover(item.id)}
                    disabled={item.status === "done"}
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
          ))
        )}
      </section>

      <footer className="upload-actions">
        <span>
          {ready.length} 张待上传 · {mb(pendingBytes)}
          {doneCount ? `　已上传 ${doneCount} 张` : ""}
        </span>
        <button type="button" onClick={() => void uploadAll()} disabled={busy || !ready.length}>
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
    </main>
  );
}
