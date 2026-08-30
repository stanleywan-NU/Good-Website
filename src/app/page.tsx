"use client";

import { useEffect, useRef, useState } from "react";

const CREAM = "#efe1c4";
const RUST = "#a8592f";
const REVEAL_DURATION = 750;
const REVEAL_FEATHER = 180;
const REVEAL_MAX_RADIUS = 2200;
const REVEAL_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

const PEAKS = [8, 14, 11, 18, 24, 16, 11, 9, 12, 20, 26, 32, 27, 21, 14, 10, 13, 8];

type Overlay = { x: number; y: number; color: string } | null;

function revealMask(radius: number, x: number, y: number) {
  return `radial-gradient(circle at ${x}px ${y}px, black 0px, black ${radius}px, transparent ${radius + REVEAL_FEATHER}px, transparent 100%)`;
}

export default function Home() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [progress, setProgress] = useState(0);
  const [isScrolled, setIsScrolled] = useState(false);
  const [overlay, setOverlay] = useState<Overlay>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const toggleBtnRef = useRef<HTMLButtonElement>(null);

  const isDark = theme === "dark";
  const bg = isDark ? RUST : CREAM;
  const fg = isDark ? CREAM : RUST;
  const cardScale = isScrolled ? 0.78 : 1;

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const handleScroll = () => {
      const max = el.scrollWidth - el.clientWidth;
      const p = max > 0 ? el.scrollLeft / max : 0;
      setProgress(p);
      setIsScrolled(el.scrollLeft > 6);
    };
    el.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  // Runs after React has committed the overlay div to the DOM, so the ref is
  // guaranteed to be attached — no reliance on requestAnimationFrame timing.
  // Uses a mask-image radial-gradient (cheap to render) rather than a blurred,
  // clip-path-animated element: animating filter:blur on a large element was
  // expensive enough to stall the first frames, which read as a pause-then-jump.
  useEffect(() => {
    if (!overlay) return;
    const el = overlayRef.current;
    if (!el) return;
    const from = revealMask(0, overlay.x, overlay.y);
    const to = revealMask(REVEAL_MAX_RADIUS, overlay.x, overlay.y);
    const anim = el.animate(
      [
        { maskImage: from, WebkitMaskImage: from },
        { maskImage: to, WebkitMaskImage: to },
      ] as Keyframe[],
      {
        duration: REVEAL_DURATION,
        easing: REVEAL_EASING,
        fill: "forwards",
      }
    );
    return () => anim.cancel();
  }, [overlay]);

  function toggleTheme() {
    const rootRect = rootRef.current?.getBoundingClientRect();
    const btnRect = toggleBtnRef.current?.getBoundingClientRect();
    const x = btnRect && rootRect ? btnRect.left + btnRect.width / 2 - rootRect.left : 0;
    const y = btnRect && rootRect ? btnRect.top + btnRect.height / 2 - rootRect.top : 0;
    const nextTheme = theme === "light" ? "dark" : "light";
    const nextColor = nextTheme === "dark" ? RUST : CREAM;

    setOverlay({ x, y, color: nextColor });

    setTimeout(() => {
      setTheme(nextTheme);
      setOverlay(null);
    }, REVEAL_DURATION);
  }

  const activeCount = Math.round(
    Math.max(0, Math.min(1, progress)) * PEAKS.length
  );

  const cardBox =
    "h-full w-full flex flex-col border-[3px] p-10 transition-transform duration-200 ease-out hover:scale-[1.035]";

  return (
    <div
      ref={rootRef}
      className="relative h-screen w-full overflow-hidden font-sans"
      style={{ backgroundColor: bg, color: fg }}
    >
      {overlay && (
        <div
          ref={overlayRef}
          className="pointer-events-none absolute z-0"
          style={{
            inset: 0,
            backgroundColor: overlay.color,
            WebkitMaskImage: revealMask(0, overlay.x, overlay.y),
            maskImage: revealMask(0, overlay.x, overlay.y),
          }}
        />
      )}

      <div
        className="absolute top-8 left-12 z-10 inline-block cursor-default text-lg font-bold tracking-tight transition-transform duration-200 hover:scale-[1.07]"
      >
        Stanley Wan
      </div>

      <div className="absolute top-6 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2.5">
        <button
          ref={toggleBtnRef}
          onClick={toggleTheme}
          className="flex h-9 w-9 items-center justify-center border-[3px] p-0 transition-transform duration-200 hover:scale-[1.12]"
          style={{ borderColor: fg, backgroundColor: bg, color: fg }}
        >
          {isDark ? (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={fg} strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
            </svg>
          ) : (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={fg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>
        <div className="flex h-[34px] w-[220px] items-center justify-center gap-[3px]">
          {PEAKS.map((peak, i) => {
            const active = i < activeCount;
            return (
              <div
                key={i}
                className="w-1 rounded-sm transition-[height] duration-150 ease-out"
                style={{
                  height: active ? peak : 6,
                  backgroundColor: fg,
                  opacity: active ? 1 : 0.35,
                }}
              />
            );
          })}
        </div>
      </div>

      <div
        ref={trackRef}
        className="hscroll-track absolute inset-x-0 bottom-0 z-[1] flex items-stretch gap-2.5 overflow-x-auto overflow-y-hidden px-12 pb-14"
        style={{ top: 100 }}
      >
        <div
          className="shrink-0 transition-transform duration-500"
          style={{ flexBasis: 720, transform: `scale(${cardScale})`, transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}
        >
          <div className={`${cardBox} justify-center gap-5`} style={{ borderColor: fg }}>
            <span className="text-sm font-medium opacity-70">Product Design &amp; Content Strategy</span>
            <h1 className="m-0 text-[68px] leading-[0.98] font-bold tracking-tight">Stanley Wan</h1>
            <p className="m-0 max-w-[460px] text-[17px] leading-snug opacity-85">
              Building at Rising Team and BorderX Lab&apos;s BeyondStyle.
            </p>
            <div className="mt-2 flex items-center gap-2 text-sm font-medium opacity-60">
              Scroll for work
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={fg} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="M13 6l6 6-6 6" />
              </svg>
            </div>
          </div>
        </div>

        <div
          className="shrink-0 transition-transform duration-500"
          style={{ flexBasis: 520, transform: `scale(${cardScale})`, transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}
        >
          <div className={`${cardBox} justify-between gap-6`} style={{ borderColor: fg }}>
            <div className="flex flex-1 items-center justify-center">
              <svg width="72" height="72" viewBox="0 0 64 64" fill="none">
                <path d="M10 48V32M26 48V20M42 48V28M58 48V12" stroke={fg} strokeWidth="4" strokeLinecap="round" />
              </svg>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[22px] font-bold">Rising Team</span>
              <span className="text-sm opacity-70">Product Design</span>
            </div>
          </div>
        </div>

        <div
          className="shrink-0 transition-transform duration-500"
          style={{ flexBasis: 520, transform: `scale(${cardScale})`, transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}
        >
          <div className={`${cardBox} justify-between gap-6`} style={{ borderColor: fg }}>
            <div className="flex flex-1 items-center justify-center">
              <svg width="72" height="72" viewBox="0 0 64 64" fill="none">
                <path d="M22 10h20l6 10-18 34-18-34z" stroke={fg} strokeWidth="4" strokeLinejoin="round" />
                <path d="M28 10l4 8 4-8" stroke={fg} strokeWidth="4" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[22px] font-bold">BorderX Lab — BeyondStyle</span>
              <span className="text-sm opacity-70">Content Strategy &amp; GEO</span>
            </div>
          </div>
        </div>

        <div
          className="shrink-0 transition-transform duration-500"
          style={{ flexBasis: 420, transform: `scale(${cardScale})`, transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}
        >
          <div className={`${cardBox} justify-between gap-6 border-dashed opacity-60`} style={{ borderColor: fg }}>
            <div className="flex flex-1 items-center justify-center text-[13px]">[ More case studies soon ]</div>
            <div className="flex flex-col gap-1">
              <span className="text-[22px] font-bold">Coming Soon</span>
              <span className="text-sm">&nbsp;</span>
            </div>
          </div>
        </div>

        <div
          className="shrink-0 transition-transform duration-500"
          style={{ flexBasis: 420, transform: `scale(${cardScale})`, transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}
        >
          <div className={`${cardBox} justify-center gap-4`} style={{ borderColor: fg }}>
            <span className="text-[22px] font-bold">About</span>
            <p className="m-0 text-[15px] leading-relaxed opacity-85">
              Product designer &amp; content strategist, currently splitting time between Rising Team and BorderX Lab&apos;s BeyondStyle.
            </p>
            <span className="text-[13px] opacity-50">[ Full bio coming soon ]</span>
          </div>
        </div>

        <div
          className="shrink-0 transition-transform duration-500"
          style={{ flexBasis: 380, transform: `scale(${cardScale})`, transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}
        >
          <div className={`${cardBox} justify-center gap-4`} style={{ borderColor: fg }}>
            <span className="text-[22px] font-bold">Let&apos;s Talk</span>
            <a href="#" className="text-base font-medium underline underline-offset-4" style={{ color: fg }}>
              [ Your email ]
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
