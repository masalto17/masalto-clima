"use client";

import { useEffect, useRef, useState } from "react";

interface HeroVideoBackgroundProps {
  src?: string;
  poster?: string;
  /** Opacidad del overlay oscuro (0–1). Default 0.85 */
  overlay?: number;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Fondo de video hero con fallback a poster estático.
 * - Respeta prefers-reduced-motion y connection.saveData.
 * - Pausa el video cuando la pestaña pierde foco.
 * - Muestra el poster primero para evitar layout shift.
 */
export default function HeroVideoBackground({
  src = "/hero/hero-clima.mp4",
  poster = "/hero/hero-clima-poster.jpg",
  overlay = 0.72,
  className = "",
  children,
}: HeroVideoBackgroundProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showVideo, setShowVideo] = useState(false);

  // Detectar si conviene mostrar video
  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const nav = navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } };
    const saveData = nav.connection?.saveData === true;
    const slowConnection = nav.connection?.effectiveType === "2g";

    if (!prefersReduced && !saveData && !slowConnection) {
      setShowVideo(true);
    }
  }, []);

  // Pausar/reanudar con visibilidad de la pestaña
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    function handleVisibility() {
      if (!video) return;
      if (document.hidden) {
        video.pause();
      } else {
        video.play().catch(() => {});
      }
    }

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [showVideo]);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Poster como fondo base (siempre visible como fallback) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={poster}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* Video (solo si el dispositivo lo permite) */}
      {showVideo && (
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          poster={poster}
          className="absolute inset-0 h-full w-full object-cover"
          aria-hidden="true"
        >
          <source src={src} type="video/mp4" />
        </video>
      )}

      {/* Overlay oscuro */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: `rgba(0, 0, 0, ${overlay})` }}
        aria-hidden="true"
      />

      {/* Contenido encima */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
