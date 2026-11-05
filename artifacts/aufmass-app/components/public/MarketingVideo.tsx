"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  webm: string;
  mp4: string;
  poster: string;
  width: number;
  height: number;
  className?: string;
};

// Dekoratives Homepage-Video. Spielt erst, wenn bekannt ist, dass keine
// reduzierte Bewegung gewünscht ist; bei prefers-reduced-motion nur Poster.
export function MarketingVideo({ webm, mp4, poster, width, height, className = "" }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const [allowMotion, setAllowMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setAllowMotion(!mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (allowMotion) {
      v.muted = true;
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [allowMotion]);

  return (
    <div className={`relative ${className}`} aria-hidden="true">
      <video
        ref={ref}
        className="block h-auto w-full"
        width={width}
        height={height}
        poster={poster}
        muted
        autoPlay={allowMotion}
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
        tabIndex={-1}
        style={{ aspectRatio: `${width} / ${height}` }}
      >
        <source src={webm} type="video/webm" />
        <source src={mp4} type="video/mp4" />
      </video>
      {!allowMotion && (
        <img
          src={poster}
          alt=""
          width={width}
          height={height}
          className="absolute inset-0 block h-full w-full object-contain"
        />
      )}
    </div>
  );
}
