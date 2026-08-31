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
// size is — not a fixed absolute size) on click. A glowing comet-tail
// streak (drawn on a canvas, not discrete dots) follows behind it, like
// Yondu's arrow: solid and continuous at any cursor speed, lingering for
// a few seconds before fading out.
const CURSOR_SIZE = 22;
const CURSOR_CLICK_SCALE = 0.5;
const CURSOR_LERP = 0.22;
// Growing (hover, or releasing a click) eases at this rate — smooth and
// deliberate. Shrinking on click eases faster (SCALE_LERP_DOWN): a real
// click is often just a quick tap-and-release, and easing the shrink at
// the same slow rate as the grow barely moved within that short a window,
// which read as "not shrinking" even though it technically was.
const SCALE_LERP_UP = 0.18;
const SCALE_LERP_DOWN = 0.45;
// Total lifetime of a point in the trail, oldest to fully faded — the
// "stays for a few seconds, then fades" arc. Length during motion is a
// side effect of this (lifetime × cursor speed), not a separate knob.
const TRAIL_LIFETIME_MS = 2550;
// Exponent on the trail's remaining-life fraction. Above 1 (rather than
// the well-below-1 value tried first) so the fade starts noticeably
// early in the point's life instead of holding near-full brightness for
// almost the entire duration and only dropping right at the very end.
const TRAIL_FADE_SHAPE = 2;
const TRAIL_BASE_ALPHA = 0.5;
const TRAIL_MAX_WIDTH = CURSOR_SIZE * 0.7;
const TRAIL_MIN_WIDTH = CURSOR_SIZE * 0.3;
// Skip drawing a connecting segment between two history points this far
// apart — otherwise a big jump (cursor entering the viewport, a window
// resize) draws one spurious streak across the whole screen.
const TRAIL_TELEPORT_GUARD = 250;

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
  const trailCanvasRef = useRef<HTMLCanvasElement>(null);
  const fgRef = useRef(RUST);

  const isDark = theme === "dark";
  const bg = isDark ? RUST : CREAM;
  const fg = isDark ? CREAM : RUST;

  // The cursor/trail loop below is imperative (runs once, never re-reads
  // props), so the current fg color is mirrored into a ref it can read
  // fresh every frame — otherwise a theme change wouldn't recolor it.
  useEffect(() => {
    fgRef.current = fg;
  }, [fg]);
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
  // practice). Instead it drags a comet-tail streak behind it, drawn on a
  // canvas as a sequence of short line segments through its own recent
  // positions rather than a fixed chain of dot elements — a chain of
  // discrete, lerped dots always shows visible gaps at real cursor speeds
  // (a fixed lerp fraction lags further behind per dot the faster the
  // cursor moves), where a continuous stroke never can, at any speed.
  // Each segment's alpha/width is purely a function of its own age, so the
  // trail fades on its own timeline (a few seconds) regardless of whether
  // the cursor is currently moving — no separate "idle" state to track or
  // get out of sync. Touching a [data-cursor-melt] element (actually
  // inside its box, not just near it) grows the cursor, and clicking
  // shrinks it to half of whatever its *current* size is (so it shrinks
  // the same proportionally whether it was already grown from contact or
  // not), rather than snapping to one fixed absolute size regardless of
  // state.
  useEffect(() => {
    const cursorEl = cursorRef.current;
    const canvas = trailCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!cursorEl || !canvas || !ctx) return;

    // Queried once: the set of melt targets doesn't change at runtime.
    const meltTargets = Array.from(document.querySelectorAll("[data-cursor-melt]"));

    const targetPos = { x: -100, y: -100 };
    const currentPos = { x: -100, y: -100 };
    // Recent positions the trail is redrawn from every frame, oldest
    // first. Only starts recording once the real cursor has actually
    // entered the page, so the first frame doesn't draw a spurious streak
    // from the off-screen (-100, -100) starting position.
    const history: { x: number; y: number; t: number }[] = [];
    let hasEntered = false;
    let isDown = false;
    let currentScale = 1;
    let raf: number;

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resizeCanvas();

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
      while (history.length && now - history[0].t > TRAIL_LIFETIME_MS) {
        history.shift();
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // "butt", not "round": each history segment is stroked individually
      // (its alpha/width changes continuously along the trail), and a
      // round cap adds a semicircle at both ends of every segment — right
      // where two segments meet, their semicircles overlap and double up
      // the alpha there, showing as a distinct darker "bead" at every
      // sampled point instead of one smooth, evenly-colored line.
      ctx.lineCap = "butt";
      ctx.strokeStyle = fgRef.current;
      // While clicking, the shrunk cursor is smaller than the fresh (wide)
      // end of the trail would normally be drawn — skip anything within
      // its own radius so a held click never exposes the trail as a ring
      // around it.
      const clickGuardRadius = isDown ? (currentScale * CURSOR_SIZE) / 2 : 0;
      for (let i = 1; i < history.length; i++) {
        const a = history[i - 1];
        const b = history[i];
        if (Math.hypot(b.x - a.x, b.y - a.y) > TRAIL_TELEPORT_GUARD) continue;
        if (clickGuardRadius > 0 && Math.hypot(b.x - currentPos.x, b.y - currentPos.y) < clickGuardRadius) continue;

        const age = now - b.t;
        const remaining = Math.max(0, 1 - age / TRAIL_LIFETIME_MS);
        const shape = Math.pow(remaining, TRAIL_FADE_SHAPE);
        ctx.globalAlpha = TRAIL_BASE_ALPHA * shape;
        ctx.lineWidth = TRAIL_MIN_WIDTH + (TRAIL_MAX_WIDTH - TRAIL_MIN_WIDTH) * shape;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      raf = requestAnimationFrame(loop);
    };

    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mouseleave", handleMouseLeave);
    raf = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mouseleave", handleMouseLeave);
      cancelAnimationFrame(raf);
    };
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

      <canvas ref={trailCanvasRef} className="pointer-events-none fixed top-0 left-0 z-[9998]" />

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
