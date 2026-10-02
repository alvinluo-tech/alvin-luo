"use client";

import { useState } from "react";

/* 封面图：外链（ibb.co / R2）可能失效，onError 自动回退到
   逐篇 satori OG 卡（/blog/{slug}/opengraph-image，构建期已生成）。
   回退后若再失败不会死循环（state 已为 true，src 不再变化）。 */
export default function CoverImage({
  src,
  fallback,
  alt,
  className,
}: {
  src?: string;
  fallback: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const finalSrc = !src || failed ? fallback : src;
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={finalSrc}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
