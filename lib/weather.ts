/* ============================================================
 * 杜伦 (Durham, UK) 实时天气数据客户端
 *
 * 采用 Open-Meteo 免费气象接口（无需 API Key、支持 CORS、零配额限制）：
 * 坐标：54.7761 N, -1.5759 W (Durham, UK)
 * 客户端 15 分钟 TTL 内存缓存，避免频繁请求；网络异常时优雅降级。
 * ============================================================ */

export type DurhamWeather = {
  temp: number; // 摄氏度
  isDay: boolean; // 是否白昼
  code: number; // WMO 天气代码
  descZh: string;
  descEn: string;
  isRain: boolean;
  isSnow: boolean;
};

const TTL = 15 * 60 * 1000; // 15 分钟
let cachedWeather: { ts: number; data: DurhamWeather } | null = null;
let inflightPromise: Promise<DurhamWeather | null> | null = null;

function parseWmoCode(code: number): { descZh: string; descEn: string; isRain: boolean; isSnow: boolean } {
  // WMO 天气代码映射
  if (code === 0) return { descZh: "晴空", descEn: "Clear", isRain: false, isSnow: false };
  if (code <= 3) return { descZh: "多云", descEn: "Cloudy", isRain: false, isSnow: false };
  if (code === 45 || code === 48) return { descZh: "薄雾", descEn: "Fog", isRain: false, isSnow: false };
  if (code >= 51 && code <= 67) return { descZh: "细雨", descEn: "Rain", isRain: true, isSnow: false };
  if (code >= 71 && code <= 77) return { descZh: "飘雪", descEn: "Snow", isRain: false, isSnow: true };
  if (code >= 80 && code <= 82) return { descZh: "阵雨", descEn: "Showers", isRain: true, isSnow: false };
  if (code >= 85 && code <= 86) return { descZh: "阵雪", descEn: "Snow Showers", isRain: false, isSnow: true };
  if (code >= 95) return { descZh: "雷雨", descEn: "Thunderstorm", isRain: true, isSnow: false };
  return { descZh: "多云", descEn: "Overcast", isRain: false, isSnow: false };
}

export async function fetchDurhamWeather(): Promise<DurhamWeather | null> {
  if (typeof window === "undefined") return null;

  if (cachedWeather && Date.now() - cachedWeather.ts < TTL) {
    return cachedWeather.data;
  }

  if (inflightPromise) return inflightPromise;

  inflightPromise = (async () => {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 6000);
      const url = "https://api.open-meteo.com/v1/forecast?latitude=54.7761&longitude=-1.5759&current=temperature_2m,weather_code,is_day";
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(timer);

      if (!res.ok) return null;
      const json = await res.json();
      const curr = json.current;
      if (!curr) return null;

      const code = Number(curr.weather_code ?? 0);
      const temp = Math.round(Number(curr.temperature_2m ?? 12));
      const isDay = Boolean(curr.is_day ?? 1);
      const { descZh, descEn, isRain, isSnow } = parseWmoCode(code);

      const data: DurhamWeather = {
        temp,
        isDay,
        code,
        descZh,
        descEn,
        isRain,
        isSnow,
      };

      cachedWeather = { ts: Date.now(), data };
      return data;
    } catch {
      return null;
    } finally {
      inflightPromise = null;
    }
  })();

  return inflightPromise;
}
