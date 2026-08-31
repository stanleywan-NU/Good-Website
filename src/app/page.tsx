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
const MIN_CARD_SCALE = 0.85;
// The shrink is a proper time-based animation, not tied to scroll
// distance: it triggers once (crossing the scroll threshold) and then
// plays out over this duration on its own, even if scrolling pauses or
// stops partway through.
const SHRINK_DURATION = 650;

// Custom cursor: a small rounded-square dot, themed to the current fg
// color, that trails the pointer with a bit of lag, grows slightly near
// a card/border/button, and shrinks by half (of whatever its current
// size is — not a fixed absolute size) on click. A short comet-style
// trail of fading dots follows behind it, in the same fg color, like a
// laser pointer.
const CURSOR_SIZE = 22;
const CURSOR_CLICK_SCALE = 0.5;
const CURSOR_LERP = 0.22;
// Growing (hover, or releasing a click) eases at this rate — smooth and
// deliberate. Shrinking on click eases faster (SCALE_LERP_DOWN): a real
// click is often just a quick tap-and-release, and easing the shrink at
// the same slow rate as the grow barely moved within that short a window,
// which read as "not shrinking" even though it technically was.
const SCALE_LERP_UP = 0.18;
const SCALE_LERP_DOWN = 0.3;
// Total reach is TRAIL_COUNT * TRAIL_SAMPLE_STEP_MS of history either way,
// so doubling the count while halving the step keeps the same length but
// halves the gap between any two adjacent dots at a given cursor speed —
// smoother for free, no length traded away.
const TRAIL_COUNT = 24;
// Each trail dot shows the cursor's actual recorded position this many ms
// ago (dot i = (i+1) * this), sampled/interpolated from a short history
// buffer — not a chain of dots each easing toward the one ahead. Chain-lerp
// lags each link by an amount that depends on *acceleration*, not just
// speed (a chain that hasn't caught up from resting whips out into huge,
// widening gaps the instant the cursor starts moving or speeds up — the
// "scattered" look), and no amount of size/opacity tapering fully hides
// that, short of making the dots impractically huge. Sampling true past
// positions instead means the gap between any two dots is always exactly
// how far the cursor actually travelled in this many ms — a small, steady
// amount at any speed, with no whip. It also means the whole tail
// naturally collapses onto the cursor within TRAIL_COUNT * this many ms of
// it stopping, with no separate "idle" state needed to make that happen.
const TRAIL_SAMPLE_STEP_MS = 9;
// Safety net only: while clicking, the main dot's own click-shrink can
// expose a trail dot sitting right under/behind it as a visibly merged
// blob (two overlapping rounded-square shapes, not a clean single dot) —
// worst right after a click on a *hovered* (already grown to 1.4×) target,
// since a trail dot can still be near-full-size there while the cursor
// itself has just shrunk out from under it. A hard cutoff (not a partial
// fade) for anything within this radius is what actually keeps a click
// looking like one solid shape — a partial ratio still let a sliver of
// the dot show through and read as choppy. Doesn't otherwise drive the
// hold/fade behavior above.
const TRAIL_CLICK_SAFE_DISTANCE = 32;

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

const PEAKS = [8, 14, 11, 18, 24, 16, 11, 9, 12, 20, 26, 32, 27, 21, 14, 10, 13, 8];

export default function Home() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [progress, setProgress] = useState(0);
  const [shrinkT, setShrinkT] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const toggleBtnRef = useRef<HTMLButtonElement>(null);
  const isTransitioningRef = useRef(false);
  const cursorRef = useRef<HTMLDivElement>(null);
  const trailRefs = useRef<HTMLDivElement[]>([]);

  const isDark = theme === "dark";
  const bg = isDark ? RUST : CREAM;
  const fg = isDark ? CREAM : RUST;
  const cardScale = 1 - shrinkT * (1 - MIN_CARD_SCALE);

  // The shrink-on-scroll effect resizes every card's real flex-basis, which
  // changes the track's total scrollWidth. A one-shot flip (even debounced
  // until scrolling paused) applied the whole resize as one large, sudden
  // width change, and doing that mid-gesture is what fought the browser's
  // own scroll physics and read as a stutter/reversal. Tying it directly to
  // scroll distance instead fixed that, but meant the shrink froze the
  // instant scrolling paused and its speed depended entirely on how fast
  // the user happened to scroll.
  //
  // This runs it as its own rAF-driven animation instead: crossing the
  // scroll threshold starts a fixed-duration, eased transition from the
  // current value to the target (0 or 1), which keeps playing every frame
  // regardless of whether scrolling continues, pauses, or stops — the
  // scroll gesture only ever triggers it, never drives it frame-by-frame,
  // so there's no per-event width jump for scroll physics to fight.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    let target = 0;
    let current = 0;
    let raf: number | null = null;
    let anim: { from: number; to: number; start: number } | null = null;

    const step = (now: number) => {
      if (!anim) {
        raf = null;
        return;
      }
      const t = Math.max(0, Math.min(1, (now - anim.start) / SHRINK_DURATION));
      current = anim.from + (anim.to - anim.from) * easeInOutCubic(t);
      setShrinkT(current);
      if (t < 1) {
        raf = requestAnimationFrame(step);
      } else {
        anim = null;
        raf = null;
      }
    };

    const handleScroll = () => {
      const max = el.scrollWidth - el.clientWidth;
      const p = max > 0 ? el.scrollLeft / max : 0;
      setProgress(p);

      const nextTarget = el.scrollLeft > 6 ? 1 : 0;
      if (nextTarget !== target) {
        target = nextTarget;
        anim = { from: current, to: target, start: performance.now() };
        if (raf === null) {
          raf = requestAnimationFrame(step);
        }
      }
    };

    el.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => {
      el.removeEventListener("scroll", handleScroll);
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, []);

  // Wheel/trackpad scrolling only drives the track natively when the
  // cursor is directly over it. We only want to step in for wheel events
  // elsewhere on the page (the fixed nav/toggle chrome up top) where
  // there's nothing scrollable to catch them — when the track itself is
  // under the cursor, leave it alone entirely so it keeps the browser's
  // own smooth, momentum-based native scrolling. Manually driving
  // scrollLeft on every event (the previous version did this for *all*
  // wheel events, not just the outside-the-track case) is what caused the
  // choppiness. It also picked deltaY over deltaX any time deltaY was
  // merely nonzero, which real trackpad swipes almost always have a tiny
  // bit of as incidental jitter — that's what briefly scrolled the wrong
  // way. Preferring whichever delta is actually dominant fixes that.
  useEffect(() => {
    const rootEl = rootRef.current;
    const trackEl = trackRef.current;
    if (!rootEl || !trackEl) return;
    const handleWheel = (e: WheelEvent) => {
      if (e.target instanceof Node && trackEl.contains(e.target)) return;
      e.preventDefault();
      trackEl.scrollLeft +=
        Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    };
    rootEl.addEventListener("wheel", handleWheel, { passive: false });
    return () => rootEl.removeEventListener("wheel", handleWheel);
  }, []);

  // Custom cursor: position is tracked in refs and written straight to the
  // DOM every frame, not through React state — state/re-renders on every
  // mousemove would be needlessly expensive for something this
  // high-frequency. The lerp (current position easing toward the real
  // pointer position each frame) is what gives it the slight trailing lag
  // rather than snapping 1:1 to the mouse.
  //
  // The cursor is always a flat fg-colored dot (no mix-blend-mode, no
  // shape-merge filter — that liquid-glass approach didn't read well in
  // practice). Instead it drags a short comet-style trail behind it: each
  // dot shows the cursor's actual recorded position from a fixed time ago
  // (see TRAIL_SAMPLE_STEP_MS above), not a chain of dots each easing
  // toward the one ahead of it — that reads as one smooth, steady tail at
  // any cursor speed instead of whipping into scattered gaps the instant
  // the cursor accelerates. Touching a [data-cursor-melt] element
  // (actually inside its box, not just near it) grows the cursor, and
  // clicking shrinks it to half of whatever its *current* size is (so it
  // shrinks the same proportionally whether it was already grown from
  // contact or not), rather than snapping to one fixed absolute size
  // regardless of state.
  useEffect(() => {
    const cursorEl = cursorRef.current;
    const trailEls = trailRefs.current;
    if (!cursorEl || trailEls.length !== TRAIL_COUNT) return;

    // Queried once: the set of melt targets doesn't change at runtime.
    const meltTargets = Array.from(document.querySelectorAll("[data-cursor-melt]"));

    const targetPos = { x: -100, y: -100 };
    const currentPos = { x: -100, y: -100 };
    // Recent actual cursor positions, oldest first — each trail dot's
    // position is sampled/interpolated from this, not chain-lerped.
    const history: { x: number; y: number; t: number }[] = [];
    const HISTORY_MAX_AGE = TRAIL_COUNT * TRAIL_SAMPLE_STEP_MS + 50;
    // Max opacity per trail dot (matches the tapering used for its size in
    // the JSX below) — falls off steeply (not a flattened taper) so the
    // tail reads as thick and solid right behind the cursor, fading to a
    // thin, faint point, rather than a uniform ribbon.
    const trailBaseOpacity = Array.from({ length: TRAIL_COUNT }, (_, i) => {
      const t = i / TRAIL_COUNT;
      return (1 - t) * 0.85;
    });
    let hasEntered = false;
    let isDown = false;
    let currentScale = 1;
    let raf: number;

    const handleMouseMove = (e: MouseEvent) => {
      targetPos.x = e.clientX;
      targetPos.y = e.clientY;
      hasEntered = true;
    };
    const handleMouseDown = () => {
      isDown = true;
    };
    const handleMouseUp = () => {
      isDown = false;
    };
    const handleMouseLeave = () => {
      targetPos.x = -100;
      targetPos.y = -100;
    };

    // Estimates where the cursor was at time `t` by linearly interpolating
    // between the two recorded samples straddling it — smooth even though
    // the samples themselves land on frame boundaries.
    const sampleHistoryAt = (t: number) => {
      if (history.length === 0) return currentPos;
      if (t <= history[0].t) return history[0];
      for (let k = 1; k < history.length; k++) {
        if (history[k].t >= t) {
          const a = history[k - 1];
          const b = history[k];
          const span = b.t - a.t || 1;
          const frac = (t - a.t) / span;
          return { x: a.x + (b.x - a.x) * frac, y: a.y + (b.y - a.y) * frac };
        }
      }
      return history[history.length - 1];
    };

    const loop = () => {
      currentPos.x += (targetPos.x - currentPos.x) * CURSOR_LERP;
      currentPos.y += (targetPos.y - currentPos.y) * CURSOR_LERP;

      // Hard containment check, not distance/proximity — it should grow
      // exactly when the cursor is actually inside a target's box, never
      // before. (Proximity-based growth was a leftover from the earlier
      // goo-merge design, which needed an "approaching" lead-in; without
      // that, growing before actual contact just reads as a glitch.)
      let isOverTarget = false;
      for (const el of meltTargets) {
        const rect = el.getBoundingClientRect();
        if (
          currentPos.x >= rect.left &&
          currentPos.x <= rect.right &&
          currentPos.y >= rect.top &&
          currentPos.y <= rect.bottom
        ) {
          isOverTarget = true;
          break;
        }
      }
      const baseScale = isOverTarget ? 1.4 : 1;
      const targetScale = isDown ? baseScale * CURSOR_CLICK_SCALE : baseScale;
      // Eased toward the target instead of applied directly — snapping
      // straight to it read as an abrupt jump rather than a resize. Shrink
      // and grow ease at different rates (see the constants above).
      const scaleLerp = targetScale < currentScale ? SCALE_LERP_DOWN : SCALE_LERP_UP;
      currentScale += (targetScale - currentScale) * scaleLerp;
      cursorEl.style.transform = `translate(${currentPos.x}px, ${currentPos.y}px) translate(-50%, -50%) scale(${currentScale})`;

      const now = performance.now();
      if (hasEntered) {
        history.push({ x: currentPos.x, y: currentPos.y, t: now });
      }
      while (history.length && now - history[0].t > HISTORY_MAX_AGE) {
        history.shift();
      }

      for (let i = 0; i < TRAIL_COUNT; i++) {
        const delay = (i + 1) * TRAIL_SAMPLE_STEP_MS;
        const p = sampleHistoryAt(now - delay);
        trailEls[i].style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;

        const distFromCursor = Math.hypot(p.x - currentPos.x, p.y - currentPos.y);
        const opacity = isDown && distFromCursor <= TRAIL_CLICK_SAFE_DISTANCE ? 0 : trailBaseOpacity[i];
        trailEls[i].style.opacity = String(opacity);
      }

      raf = requestAnimationFrame(loop);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mouseleave", handleMouseLeave);
    raf = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mouseleave", handleMouseLeave);
      cancelAnimationFrame(raf);
    };
  }, []);

  // A small side-to-side wobble on click for every [data-cursor-melt]
  // box/button (cards, the theme toggle) — one delegated listener rather
  // than a handler on each element, since the tag set is already how the
  // cursor effect above finds its own targets. Runs via the Web Animations
  // API with composite: "add" so it layers on top of the CSS hover-scale
  // transform (translateX on top of scale) instead of replacing it, which
  // a plain style/transform write would do. Fires on mousedown, not click,
  // to land at the same instant as the cursor's own click-shrink.
  useEffect(() => {
    const SHAKE_KEYFRAMES: Keyframe[] = [
      { transform: "translateX(0px)" },
      { transform: "translateX(-6px)" },
      { transform: "translateX(5px)" },
      { transform: "translateX(-4px)" },
      { transform: "translateX(3px)" },
      { transform: "translateX(-2px)" },
      { transform: "translateX(1px)" },
      { transform: "translateX(0px)" },
    ];
    const handleMouseDown = (e: MouseEvent) => {
      if (!(e.target instanceof Element)) return;
      const el = e.target.closest("[data-cursor-melt]");
      if (!(el instanceof HTMLElement)) return;
      el.animate(SHAKE_KEYFRAMES, { duration: 350, easing: "ease-out", composite: "add" });
    };
    window.addEventListener("mousedown", handleMouseDown);
    return () => window.removeEventListener("mousedown", handleMouseDown);
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
    "h-full w-full flex flex-col rounded-3xl border-[3px] p-10 transition-transform duration-200 ease-out hover:scale-[1.035]";

  // Real layout shrink (flexBasis), not just a cosmetic transform: scaling
  // a fixed-width slot visually without changing its actual width leaves
  // the original full-size gap between neighbors once it's smaller. The
  // vertical shrink stays a transform (scaleY) since there's no "next row"
  // for that to leave a gap against — it's a single horizontal row.
  // No CSS transition here on purpose: cardScale already updates every
  // scroll event, directly off scrollLeft, so the DOM value should match
  // the current scroll position exactly — a transition would just lag
  // behind a value that's already changing continuously.
  const slotStyle = (baseWidth: number): React.CSSProperties => ({
    flexBasis: baseWidth * cardScale,
    transform: `scaleY(${cardScale})`,
  });

  return (
    <div
      ref={rootRef}
      className="relative h-screen w-full overflow-hidden font-sans"
      style={{ backgroundColor: bg, color: fg }}
    >
      <div className="absolute top-6 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2.5">
        <button
          ref={toggleBtnRef}
          onClick={toggleTheme}
          data-cursor-melt
          className="flex h-9 w-9 items-center justify-center rounded-xl border-[3px] p-0 transition-transform duration-200 hover:scale-[1.12]"
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
        className="hscroll-track absolute inset-x-0 bottom-0 z-[1] flex items-stretch overflow-x-auto overflow-y-hidden overscroll-x-none px-12 pb-14"
        style={{
          top: 100,
          gap: LARGE_GAP + shrinkT * (SMALL_GAP - LARGE_GAP),
        }}
      >
        <div className="my-4 shrink-0" style={slotStyle(720)}>
          <div data-cursor-melt className={`${cardBox} justify-center gap-5`} style={{ borderColor: fg }}>
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
          <div data-cursor-melt className={`${cardBox} justify-between gap-6`} style={{ borderColor: fg }}>
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
          <div data-cursor-melt className={`${cardBox} justify-between gap-6`} style={{ borderColor: fg }}>
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
          <div data-cursor-melt className={`${cardBox} justify-between gap-6 border-dashed opacity-60`} style={{ borderColor: fg }}>
            <div className="flex flex-1 items-center justify-center text-[13px]">[ More case studies soon ]</div>
            <div className="flex flex-col gap-1">
              <span className="text-[22px] font-bold">Coming Soon</span>
              <span className="text-sm">&nbsp;</span>
            </div>
          </div>
        </div>

        <div className="my-4 shrink-0" style={slotStyle(420)}>
          <div data-cursor-melt className={`${cardBox} justify-center gap-4`} style={{ borderColor: fg }}>
            <span className="text-[22px] font-bold">About</span>
            <p className="m-0 text-[15px] leading-relaxed opacity-85">
              Product designer &amp; content strategist, currently splitting time between Rising Team and BorderX Lab&apos;s BeyondStyle.
            </p>
            <span className="text-[13px] opacity-50">[ Full bio coming soon ]</span>
          </div>
        </div>

        <div className="my-4 shrink-0" style={slotStyle(380)}>
          <div data-cursor-melt className={`${cardBox} justify-center gap-4`} style={{ borderColor: fg }}>
            <span className="text-[22px] font-bold">Let&apos;s Talk</span>
            <a href="#" className="text-base font-medium underline underline-offset-4" style={{ color: fg }}>
              [ Your email ]
            </a>
          </div>
        </div>
      </div>

      {Array.from({ length: TRAIL_COUNT }).map((_, i) => {
        const t = i / TRAIL_COUNT;
        // A real taper — thick and solid right behind the cursor, shrinking
        // down to a thin point — rather than a flat ribbon of same-sized
        // dots. History-sampled positions (see TRAIL_SAMPLE_STEP_MS above)
        // are what actually keep this gap-free at any cursor speed; the
        // taper is purely a shape choice now, not something smoothness
        // depends on.
        const size = CURSOR_SIZE * (1 - t * 0.65);
        const opacity = (1 - t) * 0.85;
        return (
          <div
            key={i}
            ref={(el) => {
              if (el) trailRefs.current[i] = el;
            }}
            className="pointer-events-none fixed top-0 left-0 z-[9998] rounded-lg"
            style={{
              width: size,
              height: size,
              backgroundColor: fg,
              opacity,
              willChange: "transform",
            }}
          />
        );
      })}

      <div
        ref={cursorRef}
        className="pointer-events-none fixed top-0 left-0 z-[9999] rounded-lg"
        style={{
          width: CURSOR_SIZE,
          height: CURSOR_SIZE,
          backgroundColor: fg,
          willChange: "transform",
        }}
      />
    </div>
  );
}
