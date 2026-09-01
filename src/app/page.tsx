"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

// Page background (the empty space around/between boxes) — a warm cream in
// light mode, a warm near-black in dark mode.
const BG_LIGHT = "#f9f1de";
const BG_DARK = "#211d1a";
// Dark-mode value for both the box/button outline and the text-and-icon
// accent (see `borderOnBg`/`fg` below).
const WHITE = "#ffffff";
// Light-mode value for the box/button outline (see `borderOnBg` below).
const BLACK = "#000000";
// Light-mode value for the text-and-icon accent (see `fg` below).
const INK = "#2b2420";
// One pastel per box, in the order the boxes appear (name box excluded —
// it keeps the neutral bg-matching fill it always had). Each has a light-
// and dark-mode value — same hue, but deepened a bit in dark mode so the
// fill doesn't look washed-out pale against the dark page background (and,
// as a side effect, gives the white box text more natural contrast).
const PASTEL_BLUE = "#a8d8ea";
const PASTEL_BLUE_DARK = "#5aa9c9";
const PASTEL_RED = "#e57373";
const PASTEL_RED_DARK = "#c14f4f";
const PASTEL_GREEN = "#a8e0b8";
const PASTEL_GREEN_DARK = "#5fa878";
const PASTEL_ORANGE = "#ffcfa0";
const PASTEL_ORANGE_DARK = "#d99a4e";
const PASTEL_MAGENTA = "#e8b0e8";
const PASTEL_MAGENTA_DARK = "#b563b5";
// Decorative accent circle in the name box's bottom-right corner (not a
// box fill, so it's on its own rather than in the per-box order above).
const PASTEL_YELLOW = "#f5e6a3";
const PASTEL_YELLOW_DARK = "#cbab48";
// Unfilled progress-bar track — a fixed neutral gray rather than translucent
// white, so it stays visible against both the light cream and dark
// backgrounds (translucent white all but disappeared against light cream).
const PROGRESS_TRACK = "#a39c8e";
const REVEAL_DURATION = 1550;
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
// size is — not a fixed absolute size) on click.
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
// How fast the cursor fades in/out when the real pointer leaves/re-enters
// the document (e.g. exiting through the top into browser tabs/bookmarks,
// or through the bottom past the page edge). Deliberately slower than the
// scale eases above — this is a fade, not a snap.
const OPACITY_LERP = 0.15;

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
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const fgRef = useRef<string>(INK);

  const isDark = theme === "dark";
  const bg = isDark ? BG_DARK : BG_LIGHT;
  // Text/icon color for every box (dark ink in light mode, white in dark
  // mode) plus the cursor and background dot grid. Pastel box fills stay
  // fixed across themes, so this is what keeps their contents readable in
  // both — matching how the name box's own text already flipped.
  const fg = isDark ? WHITE : INK;
  // Every box/button outline: black in light mode, white in dark mode — the
  // fixed-fill pastel boxes would lose their black outline against a dark
  // page background otherwise, same reasoning as the bg-blended boxes.
  const borderOnBg = isDark ? WHITE : BLACK;
  // `fg` text/icons on the pastel boxes are white in dark mode, and even
  // with the deeper dark-mode pastel fills below, a soft dark shadow (not a
  // color change) keeps that white reading crisply against every one of
  // them.
  const pastelTextShadow = isDark ? "0 1px 3px rgba(0,0,0,0.45)" : "none";
  const pastelIconShadow = isDark ? "drop-shadow(0 1px 2px rgba(0,0,0,0.45))" : "none";
  const pastelBlue = isDark ? PASTEL_BLUE_DARK : PASTEL_BLUE;
  const pastelRed = isDark ? PASTEL_RED_DARK : PASTEL_RED;
  const pastelGreen = isDark ? PASTEL_GREEN_DARK : PASTEL_GREEN;
  const pastelOrange = isDark ? PASTEL_ORANGE_DARK : PASTEL_ORANGE;
  const pastelMagenta = isDark ? PASTEL_MAGENTA_DARK : PASTEL_MAGENTA;
  const pastelYellow = isDark ? PASTEL_YELLOW_DARK : PASTEL_YELLOW;
  const cardScale = 1 - shrinkT * (1 - MIN_CARD_SCALE);

  // The background dot grid reads color off a ref instead of the `fg`
  // prop directly so a theme toggle doesn't need to restart its rAF loop
  // (and lose every dot's current eased position) — it just picks up the
  // new color on the next frame.
  useEffect(() => {
    fgRef.current = fg;
  }, [fg]);

  // A dot-grid texture that fills the empty space behind the boxes (the
  // boxes themselves are opaque, so it's naturally hidden underneath
  // them — no per-box exclusion math needed). Each dot eases away from
  // the real cursor within a radius, then eases back to its grid slot
  // once the cursor moves off — same repel-and-settle approach as the
  // background texture on andrew-yuan.com.
  useEffect(() => {
    const canvas = bgCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const GRID_SPACING = 28;
    const DOT_RADIUS = 1.5;
    const DOT_OPACITY = 0.35;
    const MOUSE_RADIUS = 110;
    const REPEL_FORCE = 26;
    const EASE = 0.1;

    let width = 0;
    let height = 0;
    let dots: { baseX: number; baseY: number; x: number; y: number }[] = [];
    const mouse = { x: -1000, y: -1000 };
    let raf: number;

    const buildGrid = () => {
      const cols = Math.round(width / GRID_SPACING);
      const rows = Math.round(height / GRID_SPACING);
      const spanX = (cols - 1) * GRID_SPACING;
      const spanY = (rows - 1) * GRID_SPACING;
      const startX = (width - spanX) / 2;
      const startY = (height - spanY) / 2;
      dots = [];
      for (let x = startX; x <= width; x += GRID_SPACING) {
        for (let y = startY; y <= height; y += GRID_SPACING) {
          dots.push({ baseX: x, baseY: y, x, y });
        }
      }
    };

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildGrid();
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.globalAlpha = DOT_OPACITY;
      ctx.fillStyle = fgRef.current;
      for (const dot of dots) {
        const dx = mouse.x - dot.baseX;
        const dy = mouse.y - dot.baseY;
        const dist = Math.hypot(dx, dy);
        let targetX = dot.baseX;
        let targetY = dot.baseY;
        if (dist < MOUSE_RADIUS) {
          const ratio = (MOUSE_RADIUS - dist) / MOUSE_RADIUS;
          const angle = Math.atan2(dy, dx);
          const push = ratio * REPEL_FORCE;
          targetX -= Math.cos(angle) * push;
          targetY -= Math.sin(angle) * push;
        }
        dot.x += (targetX - dot.x) * EASE;
        dot.y += (targetY - dot.y) * EASE;
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, DOT_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(render);
    };

    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", handleMouseMove);
    resize();
    raf = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(raf);
    };
  }, []);

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
  // practice). Touching a [data-cursor-melt] element (actually inside its
  // box, not just near it) grows the cursor, and clicking shrinks it to
  // half of whatever its *current* size is (so it shrinks the same
  // proportionally whether it was already grown from contact or not),
  // rather than snapping to one fixed absolute size regardless of state.
  useEffect(() => {
    const cursorEl = cursorRef.current;
    if (!cursorEl) return;

    // Queried once: the set of melt targets doesn't change at runtime.
    const meltTargets = Array.from(document.querySelectorAll("[data-cursor-melt]"));

    const targetPos = { x: -100, y: -100 };
    const currentPos = { x: -100, y: -100 };
    let isDown = false;
    let currentScale = 1;
    let currentOpacity = 1;
    // True once the real pointer has left the document (top/bottom/either
    // side, e.g. into browser chrome) — drives a fade rather than moving
    // targetPos, which used to teleport the cursor to a fixed corner point
    // and made it visibly glide/shoot there every time.
    let isOutside = false;
    let raf: number;

    const handleMouseMove = (e: MouseEvent) => {
      targetPos.x = e.clientX;
      targetPos.y = e.clientY;
      isOutside = false;
    };
    const handleMouseDown = () => {
      isDown = true;
    };
    const handleMouseUp = () => {
      isDown = false;
    };
    const handleMouseLeave = () => {
      isOutside = true;
    };
    const handleMouseEnter = () => {
      isOutside = false;
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

      const targetOpacity = isOutside ? 0 : 1;
      currentOpacity += (targetOpacity - currentOpacity) * OPACITY_LERP;
      cursorEl.style.opacity = String(currentOpacity);

      raf = requestAnimationFrame(loop);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mouseleave", handleMouseLeave);
    document.addEventListener("mouseenter", handleMouseEnter);
    raf = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mouseleave", handleMouseLeave);
      document.removeEventListener("mouseenter", handleMouseEnter);
      cancelAnimationFrame(raf);
    };
  }, []);

  // A press-down shrink on click for every [data-cursor-melt] box/button
  // (cards, the theme toggle) — one delegated listener rather than a
  // handler on each element, reusing the same tag set the cursor effect
  // above uses to find its targets. It shrinks on mousedown and *holds*
  // there, expanding back only on mouseup, however long the press lasts.
  //
  // Every step animates to an absolute scale (not composite: "add" layered
  // on top of the CSS hover-scale, tried first) starting from whatever the
  // element's current rendered transform actually is, read fresh each time
  // via getComputedStyle. That's what guarantees release always lands at
  // *exactly* scale(1) — the true original size — rather than back at
  // whatever the hover-scale currently is (1.035x/1.12x while still
  // hovering), which "add" would do since it only ever adds *relative* to
  // the live CSS value instead of targeting an absolute one.
  useEffect(() => {
    const PRESS_SCALE = 0.91;

    // Reads the element's *current* rendered transform before touching
    // any animation on it — cancelling an existing animation first would
    // snap it back to the CSS-only value, losing whatever mid-shrink (or
    // mid-release) point it was actually showing.
    const animateScaleTo = (el: HTMLElement, target: number) => {
      const current = getComputedStyle(el).transform;
      for (const a of el.getAnimations()) a.cancel();
      return el.animate(
        [{ transform: current === "none" ? "scale(1)" : current }, { transform: `scale(${target})` }],
        { duration: 150, easing: "ease-out", fill: "forwards" }
      );
    };

    let pressed: { el: HTMLElement } | null = null;

    const handleMouseDown = (e: MouseEvent) => {
      if (!(e.target instanceof Element)) return;
      const el = e.target.closest("[data-cursor-melt]");
      if (!(el instanceof HTMLElement)) return;
      animateScaleTo(el, PRESS_SCALE);
      pressed = { el };
    };
    const handleMouseUp = () => {
      if (!pressed) return;
      const release = animateScaleTo(pressed.el, 1);
      release.onfinish = () => release.cancel();
      pressed = null;
    };

    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
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

    // document.startViewTransition (below) snapshots the button's *current*
    // rendered state synchronously, before its callback even runs. The
    // click-shrink effect's release animation is still playing at this
    // point (mouseup fires, then click, only a moment later) — if left
    // alone, the snapshot would freeze on the button still shrunk, and
    // since that snapshot is what's actually visible for the whole reveal
    // (the live DOM keeps animating underneath, unseen), the button would
    // look stuck shrunk for the entire transition instead of expanding
    // back. Cancelling it here jumps straight to its resting size so the
    // snapshot — and the "expand back" the user actually sees — is correct.
    if (toggleBtnRef.current) {
      for (const a of toggleBtnRef.current.getAnimations()) a.cancel();
    }

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
      <canvas ref={bgCanvasRef} className="pointer-events-none absolute inset-0 z-0" />

      <div
        className="absolute top-6 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2.5 rounded-3xl border-[3px] px-6 py-4"
        style={{ borderColor: borderOnBg, backgroundColor: bg }}
      >
        <button
          ref={toggleBtnRef}
          onClick={toggleTheme}
          data-cursor-melt
          className="flex h-9 w-9 items-center justify-center rounded-xl border-[3px] p-0 transition-transform duration-200 hover:scale-[1.12]"
          style={{ borderColor: borderOnBg, backgroundColor: bg, color: fg }}
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
                  backgroundColor: active ? borderOnBg : PROGRESS_TRACK,
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
          <div data-cursor-melt className={`${cardBox} relative justify-center overflow-hidden`} style={{ borderColor: borderOnBg, backgroundColor: bg }}>
            {/* Decorative only — centered exactly on the box's corner via
                right/bottom 0 plus a self-translate, so it stays anchored
                there regardless of size. Diameter is 100% of the box's own
                width, so its radius reaches about halfway across. Text
                sitting on top of it stays the normal fg color, same as
                everywhere else in the box. */}
            <div
              aria-hidden
              className="pointer-events-none absolute right-0 bottom-0 aspect-square w-full translate-x-1/2 translate-y-1/2 rounded-full"
              style={{ backgroundColor: pastelYellow }}
            />

            <div className="relative z-10 flex flex-col gap-5">
              <span className="text-sm font-medium">Product Design &amp; Content Strategy</span>
              <h1 className="m-0 text-[68px] leading-[0.98] font-bold tracking-tight">Stanley Wan</h1>
              <p className="m-0 max-w-[460px] text-[17px] leading-snug">
                Building at Rising Team and BorderX Lab&apos;s BeyondStyle.
              </p>
              <div className="mt-2 flex items-center gap-2 text-sm font-medium">
                Scroll for work
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={fg} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                  <path d="M13 6l6 6-6 6" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        <div className="my-4 shrink-0" style={slotStyle(520)}>
          <div data-cursor-melt className={`${cardBox} justify-between gap-6`} style={{ borderColor: borderOnBg, backgroundColor: pastelRed, color: fg, textShadow: pastelTextShadow }}>
            <div className="flex flex-1 items-center justify-center">
              <svg width="72" height="72" viewBox="0 0 64 64" fill="none" style={{ filter: pastelIconShadow }}>
                <path d="M10 48V32M26 48V20M42 48V28M58 48V12" stroke={fg} strokeWidth="4" strokeLinecap="round" />
              </svg>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[22px] font-bold">Rising Team</span>
              <span className="text-sm">Product Design</span>
            </div>
          </div>
        </div>

        <div className="my-4 shrink-0" style={slotStyle(520)}>
          <div data-cursor-melt className={`${cardBox} justify-between gap-6`} style={{ borderColor: borderOnBg, backgroundColor: pastelBlue, color: fg, textShadow: pastelTextShadow }}>
            <div className="flex flex-1 items-center justify-center">
              <svg width="72" height="72" viewBox="0 0 64 64" fill="none" style={{ filter: pastelIconShadow }}>
                <path d="M22 10h20l6 10-18 34-18-34z" stroke={fg} strokeWidth="4" strokeLinejoin="round" />
                <path d="M28 10l4 8 4-8" stroke={fg} strokeWidth="4" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[22px] font-bold">BorderX Lab — BeyondStyle</span>
              <span className="text-sm">Content Strategy &amp; GEO</span>
            </div>
          </div>
        </div>

        <div className="my-4 shrink-0" style={slotStyle(420)}>
          <div data-cursor-melt className={`${cardBox} justify-between gap-6 border-dashed opacity-60`} style={{ borderColor: borderOnBg, backgroundColor: pastelGreen, color: fg, textShadow: pastelTextShadow }}>
            <div className="flex flex-1 items-center justify-center text-[13px]">[ More case studies soon ]</div>
            <div className="flex flex-col gap-1">
              <span className="text-[22px] font-bold">Coming Soon</span>
              <span className="text-sm">&nbsp;</span>
            </div>
          </div>
        </div>

        <div className="my-4 shrink-0" style={slotStyle(420)}>
          <div data-cursor-melt className={`${cardBox} justify-center gap-4`} style={{ borderColor: borderOnBg, backgroundColor: pastelOrange, color: fg, textShadow: pastelTextShadow }}>
            <span className="text-[22px] font-bold">About</span>
            <p className="m-0 text-[15px] leading-relaxed">
              Product designer &amp; content strategist, currently splitting time between Rising Team and BorderX Lab&apos;s BeyondStyle.
            </p>
            <span className="text-[13px]">[ Full bio coming soon ]</span>
          </div>
        </div>

        <div className="my-4 shrink-0" style={slotStyle(380)}>
          <div data-cursor-melt className={`${cardBox} justify-center gap-4`} style={{ borderColor: borderOnBg, backgroundColor: pastelMagenta, color: fg, textShadow: pastelTextShadow }}>
            <span className="text-[22px] font-bold">Let&apos;s Talk</span>
            <a href="#" className="text-base font-medium underline underline-offset-4" style={{ color: fg }}>
              [ Your email ]
            </a>
          </div>
        </div>
      </div>

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
