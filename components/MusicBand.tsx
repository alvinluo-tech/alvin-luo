"use client";

/* ============================================================
 * MusicBand — Bento 通栏音乐叙事区
 *
 * 左：NOW PLAYING（封面 + 歌名 + 一句歌词）
 * 右：ON REPEAT（本周循环 Top 3）
 * 底：PLAYLISTS 封面 + 大数字统计（等级/红心/累计听歌）
 *
 * 数据源未配置 → 整块隐藏；任一接口挂掉 → 只降级对应小块
 * 数据获取全部走 lib/music 的 useMusic（轮询/缓存/降级在那里）
 * ============================================================ */

import {
  isMusicConfigured,
  useMusic,
  type NowPlaying,
  type MusicStats,
  type Playlist,
  type Song,
} from "@/lib/music";
import { T } from "./i18n";

export default function MusicBand() {
  const npSet = useMusic<NowPlaying>("/api/now-playing");
  const repeatSet = useMusic<{ songs: Song[] }>("/api/on-repeat");
  const plSet = useMusic<{ playlists: Playlist[] }>("/api/playlists");
  const statsSet = useMusic<MusicStats>("/api/stats");

  // 未配置数据源：整块隐藏，保持原 Bento 布局
  if (!isMusicConfigured()) return null;

  // 首次加载中：占位骨架（已有 is-loaded 淡入的传统）
  const settled = npSet.settled && repeatSet.settled && plSet.settled && statsSet.settled;
  if (!settled) {
    return (
      <article className="tile tile-wide music-band">
        <h3 className="tile-title">MUSIC</h3>
        <p className="music-loading">
          <T en="Tuning in…" zh="正在调频…" />
        </p>
      </article>
    );
  }

  const np: NowPlaying = npSet.data ?? { playing: false };
  const repeat: Song[] = repeatSet.data?.songs ?? [];
  const playlists: Playlist[] = plSet.data?.playlists ?? [];
  const stats = statsSet.data;
  const hasPlaylists = playlists.length > 0;
  const hasStats = Boolean(
    stats?.ok && (stats.level || stats.likedCount || stats.totalMinutes),
  );

  return (
    <article className="tile tile-wide music-band" id="now-playing">
      <h3 className="tile-title">
        <T en="MUSIC" zh="音乐" />
      </h3>

      <div className="band-top">
        {/* ---- NOW PLAYING ---- */}
        <div className={np.playing ? "band-np is-playing" : "band-np"}>
          {np.playing && np.cover ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img className="np-cover" src={np.cover} alt={`${np.name} 专辑封面`} />
          ) : (
            <span className="np-cover np-cover-empty" aria-hidden="true">
              ♪
            </span>
          )}
          <div className="np-meta">
            {np.playing ? (
              <>
                <p className="np-name">{np.name}</p>
                <p className="np-artist">
                  {np.artist}
                  {np.album ? ` · ${np.album}` : ""}
                </p>
              </>
            ) : (
              <>
                <p className="np-name">
                  <T en="Not playing anything" zh="现在没在听歌" />
                </p>
                <p className="np-artist">
                  <T en="Probably coding. Or lifting." zh="大概在写代码，或者在撸铁。" />
                </p>
              </>
            )}
            {np.playing && np.lyricLine && (
              <p className="np-lyric">「{np.lyricLine}」</p>
            )}
          </div>
        </div>

        {/* ---- ON REPEAT ---- */}
        {repeat.length > 0 && (
          <div className="band-repeat">
            <p className="band-sub">
              <T en="ON REPEAT — THIS WEEK" zh="本周循环" />
            </p>
            <ul className="or-list">
              {repeat.map((s, i) => (
                <li key={s.name + i}>
                  <span className="or-idx">{i + 1}</span>
                  {s.cover && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img className="or-thumb" src={s.cover} alt="" loading="lazy" />
                  )}
                  <span className="or-name" title={s.name}>
                    {s.name}
                  </span>
                  {s.playCount != null && <b className="or-count">×{s.playCount}</b>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ---- 底部：歌单封面 + 大数字 ---- */}
      {(hasPlaylists || hasStats) && (
        <div className="band-bottom">
          {hasPlaylists && (
            <div className="band-playlists">
              {playlists.map((p) => (
                <figure className="pl" key={p.id} title={p.name}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="pl-cover" src={p.cover} alt={p.name} loading="lazy" />
                  <figcaption>
                    {p.name}
                    <span>{p.trackCount} 首</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
          {hasStats && (
            <div className="band-stats">
              {stats?.totalMinutes != null && (
                <span>
                  <b>{stats?.totalMinutes.toLocaleString()}</b>
                  <T en="min played" zh="分钟已听" />
                </span>
              )}
              {stats?.likedCount != null && (
                <span>
                  <b>{stats?.likedCount.toLocaleString()}</b>
                  <T en="liked" zh="首红心" />
                </span>
              )}
              {stats?.level != null && (
                <span>
                  <b>Lv.{stats?.level}</b>
                  <T en="netease" zh="网易云等级" />
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
