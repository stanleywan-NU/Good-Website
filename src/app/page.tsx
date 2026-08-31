"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

const CREAM = "#efe1c4";
const RUST = "#a8592f";
const REVEAL_DURATION = 750;
const REVEAL_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

// Card hover grows each box by this factor (see `cardBox`'s hover:scale-*
// class below — keep the two in sync). The widest card is 720px, so at a
// 1.035 scale it grows ~12.6px on each side; the gap has to clear that or
// the widest card touches its neighbor on hover while narrower ones don't
// (an inconsistency, not a design choice). 20px/18px below are chosen with
// that headroom in mind, not just "a bit more."
const CARD_HOVER_SCALE = 1.035;
const LARGE_GAP = 20;
const SMALL_GAP = 18;

const PEAKS = [8, 14, 11, 18, 24, 16, 11, 9, 12, 20, 26, 32, 27, 21, 14, 10, 13, 8];

export default function Home() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [progress, setProgress] = useState(0);
  const [isScrolled, setIsScrolled] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const toggleBtnRef = useRef<HTMLButtonElement>(null);
  const isTransitioningRef = useRef(false);

  const isDark = theme === "dark";
  const bg = isDark ? RUST : CREAM;
  const fg = isDark ? CREAM : RUST;
  const cardScale = isScrolled ? 0.85 : 1;

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

  // Uses the real View Transition API: it snapshots the page before and
  // after the theme flips, then lets us mask the "after" snapshot with a
  // growing soft-edged circle. That's why colors change progressively as
  // the boundary sweeps past — the whole page (text, borders, everything)
  // already exists in its new colors underneath, just masked out beyond
  // the reveal radius. An overlay-div approach can't do this: it can only
  // animate a flat background color, so foreground content has to snap to
  // its new color all at once instead of changing as the sweep passes it.
  //
  // The mask-image formula itself lives in globals.css as a static rule
  // referencing --reveal-x/--reveal-y/--reveal-radius (the last registered
  // via @property so it's a real animatable <length>). We only ever animate
  // that one numeric custom property here — the browser recomputes the
  // gradient natively every frame. The earlier version animated between two
  // full gradient() strings via the Web Animations API, which browsers
  // don't reliably tween smoothly; that mismatch was the actual source of
  // the choppiness, not the transition type or the blur.
  function toggleTheme() {
    if (isTransitioningRef.current) return;

    const btnRect = toggleBtnRef.current?.getBoundingClientRect();
    const x = btnRect ? btnRect.left + btnRect.width / 2 : window.innerWidth / 2;
    const y = btnRect ? btnRect.top + btnRect.height / 2 : 0;
    const nextTheme = theme === "light" ? "dark" : "light";

    const root = document.documentElement;
    root.style.setProperty("--reveal-x", `${x}px`);
    root.style.setProperty("--reveal-y", `${y}px`);
    root.style.setProperty("--reveal-radius", "0px");

    if (typeof document.startViewTransition !== "function") {
      setTheme(nextTheme);
      return;
    }

    const maxRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    isTransitioningRef.current = true;
    // Safety net: if `finished` never settles (e.g. the tab is backgrounded
    // mid-transition, which the spec can leave hanging), don't let the
    // toggle stay locked forever.
    const unlockTimer = setTimeout(() => {
      isTransitioningRef.current = false;
    }, REVEAL_DURATION + 1000);

    const transition = document.startViewTransition(() => {
      flushSync(() => {
        setTheme(nextTheme);
      });
    });

    transition.finished.finally(() => {
      clearTimeout(unlockTimer);
      isTransitioningRef.current = false;
      root.style.removeProperty("--reveal-x");
      root.style.removeProperty("--reveal-y");
      root.style.removeProperty("--reveal-radius");
    });

    transition.ready
      .then(() => {
        root.animate(
          [{ "--reveal-radius": "0px" }, { "--reveal-radius": `${maxRadius}px` }],
          {
            duration: REVEAL_DURATION,
            easing: REVEAL_EASING,
            pseudoElement: "::view-transition-new(root)",
            fill: "forwards",
          }
        );
      })
      .catch(() => {
        // Transition was skipped/aborted (e.g. tab hidden mid-flight) —
        // isTransitioningRef is still cleared via transition.finished above.
      });
  }

  const activeCount = Math.round(
    Math.max(0, Math.min(1, progress)) * PEAKS.length
  );

  const cardBox =
    "h-full w-full flex flex-col border-[3px] p-10 transition-transform duration-200 ease-out hover:scale-[1.035]";

  // Real layout shrink (flexBasis), not just a cosmetic transform: scaling
  // a fixed-width slot visually without changing its actual width leaves
  // the original full-size gap between neighbors once it's smaller. The
  // vertical shrink stays a transform (scaleY) since there's no "next row"
  // for that to leave a gap against — it's a single horizontal row.
  const slotStyle = (baseWidth: number): React.CSSProperties => ({
    flexBasis: baseWidth * cardScale,
    transform: `scaleY(${cardScale})`,
    transition: `flex-basis 0.5s ${REVEAL_EASING}, transform 0.5s ${REVEAL_EASING}`,
  });

  return (
    <div
      ref={rootRef}
      className="relative h-screen w-full overflow-hidden font-sans"
      style={{ backgroundColor: bg, color: fg }}
    >
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
        className="hscroll-track absolute inset-x-0 bottom-0 z-[1] flex items-stretch overflow-x-auto overflow-y-hidden px-12 pb-14"
        style={{
          top: 100,
          gap: isScrolled ? SMALL_GAP : LARGE_GAP,
          transition: `gap 0.5s ${REVEAL_EASING}`,
        }}
      >
        <div className="my-4 shrink-0" style={slotStyle(720)}>
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

        <div className="my-4 shrink-0" style={slotStyle(520)}>
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

        <div className="my-4 shrink-0" style={slotStyle(520)}>
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

        <div className="my-4 shrink-0" style={slotStyle(420)}>
          <div className={`${cardBox} justify-between gap-6 border-dashed opacity-60`} style={{ borderColor: fg }}>
            <div className="flex flex-1 items-center justify-center text-[13px]">[ More case studies soon ]</div>
            <div className="flex flex-col gap-1">
              <span className="text-[22px] font-bold">Coming Soon</span>
              <span className="text-sm">&nbsp;</span>
            </div>
          </div>
        </div>

        <div className="my-4 shrink-0" style={slotStyle(420)}>
          <div className={`${cardBox} justify-center gap-4`} style={{ borderColor: fg }}>
            <span className="text-[22px] font-bold">About</span>
            <p className="m-0 text-[15px] leading-relaxed opacity-85">
              Product designer &amp; content strategist, currently splitting time between Rising Team and BorderX Lab&apos;s BeyondStyle.
            </p>
            <span className="text-[13px] opacity-50">[ Full bio coming soon ]</span>
          </div>
        </div>

        <div className="my-4 shrink-0" style={slotStyle(380)}>
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
