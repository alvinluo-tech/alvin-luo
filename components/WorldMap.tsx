"use client";

/* ============================================================
 * WorldMap — 旅行足迹矢量投影地图
 *
 * · D3-Zoom 平滑缩放平移：支持鼠标滚轮 1x~6x、拖拽平移、双击聚焦
 * · 拟物堆叠照片卡片（Stacked Photo Cards）：每个足迹城市悬浮叠放拍立得
 * · 扑克牌扇形展开（Fan-out Spread）：鼠标悬停时照片向左右优雅散开
 * · 100% 离线打包：内置 TopoJSON 地理数据，零外部网络依赖
 * ============================================================ */

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { geoEqualEarth, geoPath, geoGraticule10, geoGraticule } from "d3-geo";
import { zoom, zoomIdentity, ZoomTransform, ZoomBehavior } from "d3-zoom";
import { select } from "d3-selection";
import "d3-transition";
import { feature } from "topojson-client";
import type { Topology, Objects } from "topojson-specification";
import type { FeatureCollection, Geometry } from "geojson";
import worldTopology from "@/data/countries-110m.json";
import { TRIPS, dateLabel } from "@/data/trips";
import { useLocale } from "./i18n";

/** 访问过的国家映射表（ISO 编码 + 匹配关键字） */
const VISITED_COUNTRIES: Record<string, { id: string; nameEn: string; nameZh: string }> = {
  "156": { id: "156", nameEn: "China", nameZh: "中国" },
  "392": { id: "392", nameEn: "Japan", nameZh: "日本" },
  "410": { id: "410", nameEn: "South Korea", nameZh: "韩国" },
  "764": { id: "764", nameEn: "Thailand", nameZh: "泰国" },
};

/** 航线轨迹（经纬度坐标对：[出发点 lng, lat], [目的点 lng, lat]） */
const FLIGHT_ROUTES: [number, number][][] = [
  // 杜伦 (当前 Base) ↔ 中国青岛
  [[-1.5759, 54.7761], [120.38, 36.07]],
  // 大理 ↔ 清迈
  [[100.16, 25.69], [98.98, 18.79]],
  // 大理 ↔ 青岛
  [[100.16, 25.69], [120.38, 36.07]],
  // 青岛 ↔ 首尔
  [[120.38, 36.07], [126.98, 37.57]],
  // 首尔 ↔ 东京
  [[126.98, 37.57], [139.69, 35.68]],
];

/** 城市去重列表（按坐标去重） */
const CITIES = (() => {
  const seen = new Set<string>();
  return TRIPS.filter((t) => {
    const key = t.coord.join(",");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
})();

/** 当前大本营：英国杜伦 (Durham, UK) */
const BASE_LOCATION = {
  nameZh: "杜伦",
  nameEn: "Durham",
  roleZh: "常驻 / BASE",
  roleEn: "CURRENT BASE",
  coord: [-1.5759, 54.7761] as [number, number],
};

/** 城市代表性微缩图标 / 艺术占位符（当照片就位前展示手作印章感） */
const CITY_EMOJIS: Record<string, string[]> = {
  "01": ["🗼", "🍣", "🌸"], // 东京
  "02": ["🏯", "🍖", "☕"], // 首尔
  "03": ["🐘", "🛵", "🥥"], // 清迈
  "04": ["🌊", "🚲", "🍵"], // 大理
  "05": ["🍺", "⛵", "🏖️"], // 青岛
};

interface WorldMapProps {
  onCityClick?: (img: string) => void;
  focusedCity?: string | null;
}

export default function WorldMap({ onCityClick, focusedCity }: WorldMapProps) {
  const { locale } = useLocale();
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  // 缩放变换矩阵状态
  const [currentTransform, setCurrentTransform] = useState<ZoomTransform>(zoomIdentity);
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
  const [activeStack, setActiveStack] = useState<string | null>(null);
  const [showWheelHint, setShowWheelHint] = useState(false);
  const [isMac, setIsMac] = useState(false);
  const hintTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 客户端检测系统（区分 Mac ⌘ 与 Windows Ctrl）
  useEffect(() => {
    if (typeof navigator !== "undefined") {
      setIsMac(/Mac|iPod|iPhone|iPad/i.test(navigator.userAgent || navigator.platform));
    }
    return () => {
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    };
  }, []);

  // 协同滚轮手势监听（防页面滚动劫持）：普通滚动不缩放地图，显示 Ctrl 提示
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) {
      setShowWheelHint(true);
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
      hintTimerRef.current = setTimeout(() => {
        setShowWheelHint(false);
      }, 1500);
    } else {
      setShowWheelHint(false);
    }
  }, []);

  // 投影系统：EqualEarth，全球视角但优雅平衡
  const { countryPaths, graticulePath, spherePath, flightPaths, cityPositions, basePosition } =
    useMemo(() => {
      // 960 x 480 标准宽屏比例
      const projection = geoEqualEarth()
        .scale(175)
        .translate([480, 250]);

      const pathGen = geoPath(projection);

      // 解析 TopoJSON 为 GeoJSON
      const countriesGeo = feature(
        worldTopology as unknown as Topology<Objects>,
        (worldTopology as unknown as Topology<Objects>).objects.countries
      ) as unknown as FeatureCollection<Geometry, { name?: string }>;

      // 生成国家路径
      const cPaths = countriesGeo.features.map((f) => {
        const id = String(f.id);
        const visitedInfo = VISITED_COUNTRIES[id];
        return {
          id,
          name: f.properties?.name ?? id,
          isVisited: Boolean(visitedInfo),
          visitedInfo,
          d: pathGen(f) ?? "",
        };
      });

      // 经纬网
      const grat = geoGraticule10();
      const gPath = pathGen(grat) ?? "";
      const sPath = pathGen(geoGraticule().outline()) ?? "";

      // 航线路径
      const fPaths = FLIGHT_ROUTES.map((route) => {
        return pathGen({
          type: "LineString",
          coordinates: route,
        }) ?? "";
      });

      // 城市点位映射
      const cPositions = CITIES.map((c) => {
        const [x, y] = projection(c.coord) ?? [0, 0];
        return { ...c, x, y };
      });

      // 英国杜伦 Base 点位映射
      const [bx, by] = projection(BASE_LOCATION.coord) ?? [0, 0];

      return {
        countryPaths: cPaths,
        graticulePath: gPath,
        spherePath: sPath,
        flightPaths: fPaths,
        cityPositions: cPositions,
        basePosition: { x: bx, y: by },
      };
    }, []);

  // 初始化 D3-Zoom 行为
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = select(svgRef.current);

    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 5])
      .translateExtent([
        [-1600, -800],
        [2000, 1200],
      ])
      .filter((event) => {
        // 协同手势过滤：仅在按住 Ctrl 或 ⌘ 键时才激活滚轮缩放，杜绝滑动页面时误触地图缩放
        if (event.type === "wheel") {
          return event.ctrlKey || event.metaKey;
        }
        // 移动触控设备：双指才缩放，单指滑动页面
        if (event.type === "touchstart") {
          return event.touches.length > 1;
        }
        // 允许常规鼠标左键拖拽平移，忽略右键/中键
        return !event.ctrlKey && !event.button;
      })
      .on("zoom", (event) => {
        setCurrentTransform(event.transform);
      });

    zoomRef.current = zoomBehavior;
    svg.call(zoomBehavior);

    // 初始状态优雅聚焦欧亚走廊（杜伦到东亚），兼顾足迹与生活大本营
    svg.call(
      zoomBehavior.transform,
      zoomIdentity.translate(-240, 40).scale(1.28)
    );

    // 双击平滑聚焦到东亚核心足迹区
    svg.on("dblclick.zoom", () => {
      svg.transition().duration(750).call(
        zoomBehavior.transform,
        zoomIdentity.translate(-1020, -110).scale(2)
      );
    });

    return () => {
      svg.on(".zoom", null);
    };
  }, []);

  // 外部联动：当传入 focusedCity（例如从首页某张胶片直达）时，相机自动平滑飞向该城市并扇形展开
  useEffect(() => {
    if (!focusedCity || !svgRef.current || !zoomRef.current) return;
    const city = cityPositions.find((c) => c.img === focusedCity);
    if (!city) return;

    setActiveStack(city.img);

    // 计算居中坐标：画布为 960x480，缩放倍率 2.4
    const k = 2.4;
    const tx = 480 - city.x * k;
    const ty = 240 - city.y * k;

    select(svgRef.current)
      .transition()
      .duration(950)
      .call(
        zoomRef.current.transform,
        zoomIdentity.translate(tx, ty).scale(k)
      );
  }, [focusedCity, cityPositions]);

  // 外部控制方法
  const handleZoomIn = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;
    select(svgRef.current).transition().duration(350).call(
      zoomRef.current.scaleBy,
      1.35
    );
  }, []);

  const handleZoomOut = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;
    select(svgRef.current).transition().duration(350).call(
      zoomRef.current.scaleBy,
      1 / 1.35
    );
  }, []);

  const handleResetZoom = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;
    select(svgRef.current).transition().duration(600).call(
      zoomRef.current.transform,
      zoomIdentity
    );
  }, []);

  const handleFocusAsia = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;
    select(svgRef.current).transition().duration(800).call(
      zoomRef.current.transform,
      zoomIdentity.translate(-1020, -110).scale(2)
    );
  }, []);

  // 堆叠照片动态缩放阻尼（保证在地图放大时卡片尺寸依然舒适）
  const cardScale = Math.min(1.15, Math.max(0.75, 0.65 + currentTransform.k * 0.1));

  return (
    <div className="worldmap-container">
      {/* 顶部航海仪表状态栏 */}
      <div className="worldmap-hud">
        <div className="worldmap-hud-item">
          <span className="hud-indicator" />
          <span className="hud-title">GEO RADAR // 交互足迹相册</span>
        </div>
        <div className="worldmap-hud-stats">
          <span>{locale === "en" ? "4 COUNTRIES EXPLORED" : "4 个国家 / 地区"}</span>
          <span className="hud-sep">/</span>
          <span>{locale === "en" ? "5 STOPS" : "5 处足迹"}</span>
          <span className="hud-sep">/</span>
          <span className="hud-base">{locale === "en" ? "BASE: DURHAM, UK" : "常驻: 英国杜伦"}</span>
        </div>
      </div>

      {/* 缩放/平移视口包装器（支持协同滚轮监听，绝不劫持页面滑动） */}
      <div className="worldmap-canvas-wrap" onWheel={handleWheel}>
        {/* SVG 底图图层（通过 D3-Zoom 进行平移和缩放） */}
        <svg
          ref={svgRef}
          viewBox="0 0 960 480"
          className="worldmap-svg is-zoomable"
          preserveAspectRatio="xMidYMid meet"
          aria-label="Interactive Footprint Map"
        >
          <defs>
            {/* 航线荧光流动渐变 */}
            <linearGradient id="flightGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--lime)" stopOpacity="0.85" />
              <stop offset="50%" stopColor="var(--lime)" stopOpacity="0.3" />
              <stop offset="100%" stopColor="var(--lime)" stopOpacity="0.85" />
            </linearGradient>

            {/* 访问国家发光滤镜 */}
            <filter id="countryGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor="var(--lime)" floodOpacity="0.3" />
            </filter>
          </defs>

          {/* 可缩放主体容器 */}
          <g transform={currentTransform.toString()} className="worldmap-zoom-group">
            {/* 地球边缘外框 */}
            <path d={spherePath} className="geo-sphere" />

            {/* 经纬度网格线 */}
            <path d={graticulePath} className="geo-graticule" />

            {/* 国家底图图层 */}
            <g className="geo-countries">
              {countryPaths.map((c) => (
                <path
                  key={c.id}
                  d={c.d}
                  className={`geo-country ${c.isVisited ? "is-visited" : ""}`}
                  onMouseEnter={() => {
                    if (c.visitedInfo) {
                      setHoveredCountry(locale === "en" ? c.visitedInfo.nameEn : c.visitedInfo.nameZh);
                    }
                  }}
                  onMouseLeave={() => setHoveredCountry(null)}
                />
              ))}
            </g>

            {/* 航线大圆轨迹 */}
            <g className="geo-flights">
              {flightPaths.map((d, i) => (
                <path key={i} d={d} className="geo-flight-path" />
              ))}
            </g>

            {/* 城市脉冲雷达底标点 */}
            <g className="geo-pins">
              {cityPositions.map((city) => (
                <g key={city.img} transform={`translate(${city.x}, ${city.y})`} className="geo-pin">
                  <circle r="12" className="pin-radar" />
                  <circle r="5" className="pin-outer" />
                  <circle r="2" className="pin-center" />
                </g>
              ))}

              {/* 英国杜伦 Base 标点（彻底去除错位的 emoji 📍，纯净矢量雷达呈现） */}
              <g transform={`translate(${basePosition.x}, ${basePosition.y})`} className="geo-pin is-base">
                <circle r="12" className="pin-radar base-radar" />
                <circle r="6" className="base-ring" />
                <circle r="2.5" className="base-dot" />
                <text y="-9" className="pin-text-label">
                  DURHAM
                </text>
              </g>
            </g>
          </g>
        </svg>

        {/* 同步 HTML 叠放照片层（高德 / 苹果相册堆叠卡片，扇形展开） */}
        <div className="worldmap-html-overlay" aria-hidden="false">
          {cityPositions.map((city) => {
            // 计算当前经过 Zoom 矩阵变换后的真实绝对屏幕像素百分比
            const screenX = ((city.x * currentTransform.k + currentTransform.x) / 960) * 100;
            const screenY = ((city.y * currentTransform.k + currentTransform.y) / 480) * 100;
            const isHovered = activeStack === city.img;
            const emojis = CITY_EMOJIS[city.img] ?? ["📷", "✨", "🧭"];

            return (
              <div
                key={city.img}
                className={`photo-stack-anchor ${isHovered ? "is-active" : ""}`}
                style={{
                  left: `${screenX}%`,
                  top: `${screenY}%`,
                  transform: `scale(${cardScale})`,
                }}
                onMouseEnter={() => setActiveStack(city.img)}
                onMouseLeave={() => setActiveStack(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  onCityClick?.(city.img);
                }}
              >
                {/* 拍立得堆叠相册卡片组件（已移除生硬的下挂 pin 针，直接灵动悬浮在脉冲雷达上方） */}
                <div className="photo-stack" title={`${city.place} · 点击查看相册`}>
                  {/* 底片 1（往左微倾） */}
                  <div className="stack-card card-back-left">
                    <span className="card-washi washi-left" />
                    <div className="card-inner">
                      <span className="card-emoji">{emojis[2]}</span>
                    </div>
                  </div>

                  {/* 底片 2（往右微倾） */}
                  <div className="stack-card card-back-right">
                    <span className="card-washi washi-right" />
                    <div className="card-inner">
                      <span className="card-emoji">{emojis[1]}</span>
                    </div>
                  </div>

                  {/* 顶片 3（正对，主照片/插画） */}
                  <div className="stack-card card-front">
                    <span className="card-washi washi-center" />
                    <div className="card-inner">
                      {/* 如果有实际照片则优先渲染，否则使用拟物符号 */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/travel/${city.img}.jpg`}
                        alt={city.place}
                        className="card-photo"
                        onError={(e) => {
                          // 图片 404 时优雅降级为拟物印章
                          e.currentTarget.style.display = "none";
                          const fallback = e.currentTarget.parentElement?.querySelector(".card-emoji-fallback");
                          if (fallback) (fallback as HTMLElement).style.display = "flex";
                        }}
                      />
                      <span className="card-emoji-fallback">{emojis[0]}</span>
                    </div>

                    {/* 拍立得底部白色手写标题栏 */}
                    <div className="card-caption">
                      <span className="card-city-name">{city.place.split(" ")[0]}</span>
                      <span className="card-count-badge">3</span>
                    </div>
                  </div>

                  {/* 扇形展开时浮现的悬浮详情微卡片 */}
                  <div className="stack-popup-info">
                    <div className="popup-header">
                      <span className="popup-city">{city.place}</span>
                      <span className="popup-date">{dateLabel(city, locale)}</span>
                    </div>
                    <p className="popup-note">{locale === "en" ? (city.noteEn ?? city.note) : city.note}</p>
                    <div className="popup-hint">
                      {locale === "en" ? "Click to view photo story ↓" : "点击查看旅行照片 ↓"}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 协同手势缩放浮动提示（业界标杆 Google Maps / Mapbox 方案） */}
        <div className={`worldmap-wheel-hint ${showWheelHint ? "is-visible" : ""}`} aria-live="polite">
          <div className="wheel-hint-content">
            <span className="wheel-hint-icon">{isMac ? "⌘" : "Ctrl"}</span>
            <span className="wheel-hint-text">
              {locale === "en"
                ? (isMac ? "Use ⌘ + scroll to zoom the map" : "Use Ctrl + scroll to zoom the map")
                : (isMac ? "按住 ⌘ + 滚轮缩放地图" : "按住 Ctrl + 滚轮缩放地图")}
            </span>
          </div>
        </div>

        {/* 右上角交互控制盘（HUD Control Panel） */}
        <div className="worldmap-controls" role="toolbar" aria-label="Map Controls">
          <button
            type="button"
            className="ctrl-btn"
            onClick={handleZoomIn}
            title={locale === "en" ? "Zoom In (+)" : "放大地图 (+)"}
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            className="ctrl-btn"
            onClick={handleZoomOut}
            title={locale === "en" ? "Zoom Out (-)" : "缩小地图 (-)"}
            aria-label="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            className="ctrl-btn ctrl-reset"
            onClick={handleResetZoom}
            title={locale === "en" ? "Reset View" : "重置视角"}
            aria-label="Reset view"
          >
            ⟲
          </button>
          <button
            type="button"
            className="ctrl-btn ctrl-focus"
            onClick={handleFocusAsia}
            title={locale === "en" ? "Focus on Footprints" : "聚焦足迹区"}
            aria-label="Focus on Footprints"
          >
            <span className="ctrl-focus-dot" />
            <span>{locale === "en" ? "FOCUS" : "聚焦"}</span>
          </button>
        </div>

        {/* 悬停国家底栏提示 */}
        {hoveredCountry && (
          <div className="worldmap-country-badge">
            <span>EXPLORED REGION:</span>
            <b>{hoveredCountry}</b>
          </div>
        )}
      </div>

      {/* 地图图例与手势交互说明 */}
      <footer className="worldmap-legend">
        <div className="legend-item">
          <span className="legend-dot is-visited" />
          <span>{locale === "en" ? "Photo Stacks" : "悬浮拍立得相册"}</span>
        </div>
        <div className="legend-item">
          <span className="legend-line" />
          <span>{locale === "en" ? "Flight trajectory" : "大圆航线弧线"}</span>
        </div>
        <div className="legend-item">
          <span className="legend-base" />
          <span>{locale === "en" ? "Current base (Durham, UK)" : "当前常驻（英国杜伦）"}</span>
        </div>
        <div className="legend-tip">
          <span>
            {locale === "en"
              ? "🖱️ Ctrl + Scroll to zoom · Drag to pan · Click card for stories"
              : "🖱️ Ctrl + 滚轮缩放 · 拖拽平移 · 点击卡片查看故事"}
          </span>
        </div>
      </footer>
    </div>
  );
}
