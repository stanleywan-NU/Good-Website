"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import Image from "next/image";

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
const PASTEL_PINK = "#eaa4c9";
const PASTEL_PINK_DARK = "#c23d84";
const PASTEL_OLIVE = "#cde29c";
const PASTEL_OLIVE_DARK = "#8aac39";
const PASTEL_PERIWINKLE = "#b7b0e8";
const PASTEL_PERIWINKLE_DARK = "#5546b9";
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

// Opening sequence, played once on load: a blank cream screen, then the
// dot grid fades in, then a small square pops into place centered on it —
// a springy bounce in size, not a position shake — then swims up to the
// top, stopping there, and only then grows into the toggle/progress
// "command center" chrome, which is otherwise invisible until that lands.
// Its button/progress bar pop in right after, then the card row pops in a
// beat later. The dot grid treats the square like the real cursor for the
// pop-in and the swim, scattering dots away from it (see introRepelRef) —
// with more clearance than the cursor's own hover radius, since a wide gap
// reads better around something this size moving this slowly.
//
// INTRO_SQUARE_POP_DURATION must match the keyframes' own duration in
// globals.css (.intro-square-pop) — CSS keyframes can't read a JS constant,
// so this is the one place that pairing has to be kept in sync by hand.
// Every duration below is deliberately tight — the whole sequence, start
// to the cards fully settled, adds up to ~2000ms.
const INTRO_DOTS_FADE_DELAY = 100;
const INTRO_DOTS_FADE_DURATION = 250;
// Another pause once the dots have finished fading in before the square
// appears — otherwise the two read as one continuous beat instead of two
// distinct ones.
const INTRO_PRE_SQUARE_DELAY = 350;
const INTRO_SQUARE_POP_DURATION = 300;
// How long the square (with its "s.") sits still after popping in, before
// it starts swimming up.
const INTRO_SQUARE_HOLD = 800;
const INTRO_TRAVEL_DURATION = 550;
const INTRO_TRAVEL_HOLD = 80;
const INTRO_EXPAND_DURATION = 220;
const INTRO_SQUARE_SIZE = 56;
// Less than rounded-3xl's 24px — at this size, 24px still reads as
// noticeably rounded without going all the way to a circle. Transitions
// up to 24px alongside width/height so it lands on the chrome box's
// actual rounded-3xl by the time it's that size.
const INTRO_SQUARE_RADIUS = 18;
const INTRO_CHROME_RADIUS = 24;
// Sizes below match the chrome box's own fixed-content natural size
// (button + 220px progress row + padding + border) — if that content ever
// changes, these should be re-measured.
const INTRO_CHROME_WIDTH = 274;
const INTRO_CHROME_HEIGHT = 118;
const INTRO_CHROME_TOP = 24;
const INTRO_CHROME_POP_DURATION = 250;
const INTRO_POP_EASING = "cubic-bezier(0.34, 1.56, 0.64, 1)";
const INTRO_CARDS_DELAY = 100;
const INTRO_CARDS_POP_DURATION = 300;
// Repel radius/force the dot grid uses while reacting to the intro square
// specifically — wider and a bit stronger than the cursor's own
// MOUSE_RADIUS/REPEL_FORCE below, for more visible clearance around it.
const INTRO_REPEL_RADIUS = 160;
const INTRO_REPEL_FORCE = 34;

// Card hover grows each box by this factor (see `cardBox`'s hover:scale-*
// class below — keep the two in sync). The widest card is 720px, so at a
// 1.035 scale it grows ~12.6px on each side; the gap has to clear that or
// the widest card touches its neighbor on hover while narrower ones don't
// (an inconsistency, not a design choice). 20px/18px below are chosen with
// that headroom in mind, not just "a bit more."
const CARD_HOVER_SCALE = 1.035;
// The toggle button's own hover:scale-[1.12] class — kept in sync by hand,
// same reasoning as CARD_HOVER_SCALE above. Used by the press-shrink effect
// to know what "still hovering" should release back to.
const TOGGLE_HOVER_SCALE = 1.12;
const LARGE_GAP = 20;
const SMALL_GAP = 18;
const MIN_CARD_SCALE = 0.85;
// The shrink is a proper time-based animation, not tied to scroll
// distance: it triggers once (crossing the scroll threshold) and then
// plays out over this duration on its own, even if scrolling pauses or
// stops partway through.
const SHRINK_DURATION = 650;

// Click-to-expand: a card grows from wherever it's actually sitting (its
// captured on-screen rect at click time) and slides to a centered panel,
// pushing its neighbors aside as it goes. Implemented as a two-phase style
// flip (render at the captured starting rect first, then next tick flip to
// the target — same technique as the intro square's own rise) rather than
// reparenting the element anywhere, so the *same* DOM node just switches
// from static/relative to fixed positioning: nothing to clone, no content
// duplication, and the cursor-melt hover-grow logic (which re-reads
// getBoundingClientRect() every frame) keeps tracking it correctly through
// the whole animation without any special-casing.
const EXPAND_DURATION = 1500;
// Plain linear, not an eased curve. REVEAL_EASING's ease-out (fast start)
// read as an abrupt snap; a symmetric ease-in-out tried after that solved
// the sharp start but introduced a different problem — an S-curve spends
// most of its *visible* motion in the middle of the timeline with slow
// bookends at both ends, and top/left/width/height all share that same
// shape, so the size change (large, visually dominant) reads as "done"
// once it's through the fast middle section, while the *same* curve's
// slow tail on the position change is still crawling toward center —
// two properties moving in perfect mathematical lockstep can still read
// as sequential ("it expanded, *then* it moved") if the curve's shape
// makes one of them look finished before it actually is. Linear has no
// such illusion available: constant speed for the entire duration, so
// size and position finish looking exactly as done as each other at
// every instant, not just at t=0 and t=1.
const EXPAND_EASING = "linear";
// Pushed-aside cards use this *exact* duration and curve too, not a
// different one — that was tried (a faster, fast-starting ease on the
// push alone) to make the push read as more immediate, but it broke a
// stronger requirement: a fixed gap between the expanding edge and the
// card it's pushing has to *stay* fixed for the entire motion, not just
// arrive at the same final gap. Two elements only track each other in
// lockstep like that if they move under the identical timing function —
// different curves let one lead or lag the other mid-flight, opening and
// closing the gap over the course of the animation even though both
// still land correctly at t=1. See the mousedown/mouseup effect for how
// the push distance itself is derived (from the expanding card's own
// edge movement, not an independent target) — that's the other half of
// the same guarantee.
//
// The target is anchored to fixed points rather than a size ratio: top
// sits a little above the middle of the toggle/progress chrome rectangle,
// bottom sits close to the viewport's own bottom edge, sides close to
// full width.
const EXPAND_TOP = INTRO_CHROME_TOP + INTRO_CHROME_HEIGHT / 2 - 18;
const EXPAND_BOTTOM_MARGIN = 40;
const EXPAND_SIDE_MARGIN = 48;

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

// Shared by getExpandStyle (what the expanded card animates to) and the
// mousedown/mouseup effect (how far every other card needs to be pushed to
// clear it) — both need the exact same rectangle, so it's computed once
// here rather than duplicated.
function computeExpandTarget() {
  const targetWidth = window.innerWidth - EXPAND_SIDE_MARGIN * 2;
  const targetHeight = window.innerHeight - EXPAND_BOTTOM_MARGIN - EXPAND_TOP;
  return { targetLeft: EXPAND_SIDE_MARGIN, targetTop: EXPAND_TOP, targetWidth, targetHeight };
}

const PEAKS = [8, 14, 11, 18, 24, 16, 11, 9, 12, 20, 26, 32, 27, 21, 14, 10, 13, 8];

// Thin wrapper just to avoid repeating data-cursor-melt/data-card-index on
// all 6 cards. Defined at module scope, not inside Home() — a component
// defined inside another component's body is a brand-new function (and
// therefore a brand-new *type*, as far as React's reconciliation is
// concerned) on every single render of the parent. Home() re-renders
// constantly here (scroll-driven shrink, cursor tracking, the intro
// sequence, theme toggles), so every card was being fully unmounted and
// remounted — losing hover state, restarting CSS transitions — on nearly
// every render. That's the real explanation for the pervasive glitchiness,
// not anything specific to the expand animation's own logic.
function ExpandableCard({
  index,
  className,
  style,
  children,
}: {
  index: number;
  className: string;
  style: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <div data-cursor-melt data-card-index={index} className={className} style={style}>
      {children}
    </div>
  );
}

// The six slides that make up each carousel — the cover plus the rest of
// its outfits, in the order they actually run in.
const CAROUSEL_DECKS: { name: string; images: string[] }[] = [
  {
    name: "Sadie Sink",
    images: [
      "/sadie-sink-carousel-cover.jpg",
      "/sadie-sink-carousel-2.jpg",
      "/sadie-sink-carousel-3.jpg",
      "/sadie-sink-carousel-4.jpg",
      "/sadie-sink-carousel-5.jpg",
      "/sadie-sink-carousel-6.jpg",
    ],
  },
  {
    name: "Caitlin Clark",
    images: [
      "/caitlin-clark-carousel-cover.jpg",
      "/caitlin-clark-carousel-2.jpg",
      "/caitlin-clark-carousel-3.jpg",
      "/caitlin-clark-carousel-4.jpg",
      "/caitlin-clark-carousel-5.jpg",
      "/caitlin-clark-carousel-6.jpg",
    ],
  },
  {
    name: "LeBron James",
    images: [
      "/lebron-james-carousel-cover.jpg",
      "/lebron-james-carousel-2.jpg",
      "/lebron-james-carousel-3.jpg",
      "/lebron-james-carousel-4.jpg",
      "/lebron-james-carousel-5.jpg",
      "/lebron-james-carousel-6.jpg",
    ],
  },
  {
    name: "Inde Navarrette",
    images: [
      "/inde-navarrette-carousel-cover.jpg",
      "/inde-navarrette-carousel-2.jpg",
      "/inde-navarrette-carousel-3.jpg",
      "/inde-navarrette-carousel-4.jpg",
      "/inde-navarrette-carousel-5.jpg",
      "/inde-navarrette-carousel-6.jpg",
    ],
  },
  {
    name: "Mbappe",
    images: [
      "/mbappe-carousel-cover.jpg",
      "/mbappe-carousel-2.jpg",
      "/mbappe-carousel-3.jpg",
      "/mbappe-carousel-4.jpg",
      "/mbappe-carousel-5.jpg",
      "/mbappe-carousel-6.jpg",
      "/mbappe-carousel-7.jpg",
      "/mbappe-carousel-8.jpg",
      "/mbappe-carousel-9.jpg",
    ],
  },
];

// The Limitus process, oldest to newest — one slide per stage, each with a
// short title and a one-line caption, flipped through as a stack.
const LIMITUS_STEPS: { src: string; title: string; caption: string }[] = [
  {
    src: "/limitus/01-concept-sketch.jpg",
    title: "Concept sketch",
    caption: "Stability where a Wrist Widget is too loose, freedom where a post-surgery brace is too stiff.",
  },
  {
    src: "/limitus/02-measured-drawing.jpg",
    title: "Measured drawing",
    caption: "Dimensions and materials worked out: a neoprene body with velcro straps.",
  },
  {
    src: "/limitus/03-first-build.jpg",
    title: "First build",
    caption: "Cut and assembled from the parts of braces we bought.",
  },
  {
    src: "/limitus/04-prototype-1.jpg",
    title: "Prototype 1",
    caption: "Ulnar deviation support, compression, and slight resistance to supination.",
  },
  {
    src: "/limitus/05-revised-sketch.jpg",
    title: "Revised sketch",
    caption: "Updated with mentor feedback: the thumb loop came out.",
  },
  {
    src: "/limitus/06-prototype-2.jpg",
    title: "Prototype 2",
    caption: "Rebuilt from materials supplied by our mentor.",
  },
  {
    src: "/limitus/07-prototype-3-4.jpg",
    title: "Prototypes 3 & 4",
    caption: "One piece instead of a base plus wings, wider straps, D-rings overlapping the fabric.",
  },
  {
    src: "/limitus/08-final.jpg",
    title: "The final brace",
    caption: "Compresses the ulna and radius and limits supination.",
  },
];

// The Closet articles shown in the GEO panel. Each is a self-contained page
// served from /public/articles, so the links are ordinary public URLs.
// The intro card's expanded-only row of contact links. These started out
// as pre-cropped PNGs off the user's own small icon sheet, but at 55-66px
// source that sheet's icons carried a soft antialiased edge already, and
// feathering the cutout mask on top of that (to get a clean alpha channel
// at all) compounded it into visible blur at display size. Inline SVG
// paths sidestep the problem entirely — vector, sharp at any size — and
// `fill="currentColor"` picks up the ambient `color` for free, which is
// also what makes these track the name's own light/dark and covered/
// on-the-circle recoloring without any isDark branching of their own.
const INTRO_LINKS: { key: string; label: string; href: string; external: boolean }[] = [
  { key: "email", label: "Email", href: "mailto:stanleywan2007@gmail.com", external: false },
  { key: "github", label: "GitHub", href: "https://github.com/stanleywan-NU", external: true },
  { key: "linkedin", label: "LinkedIn", href: "https://www.linkedin.com/in/stanleywan2007", external: true },
  { key: "resume", label: "Resume", href: "/resume.pdf", external: true },
];

function IntroLinkIcon({ name }: { name: string }) {
  switch (name) {
    case "email":
      return (
        <svg viewBox="0 0 24 24" className="h-full w-full" fill="none">
          <rect x="2.5" y="5" width="19" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M3.5 6.5l8.5 7 8.5-7"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "github":
      return (
        <svg viewBox="0 0 24 24" className="h-full w-full" fill="currentColor">
          <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
        </svg>
      );
    case "linkedin":
      return (
        <svg viewBox="0 0 24 24" className="h-full w-full" fill="currentColor">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
      );
    case "resume":
      return (
        <svg viewBox="0 0 24 24" className="h-full w-full" fill="currentColor">
          <path d="M12 2a1 1 0 0 1 1 1v9.586l2.293-2.293a1 1 0 1 1 1.414 1.414l-4 4a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 1.414-1.414L11 12.586V3a1 1 0 0 1 1-1Z" />
          <path d="M3 15a1 1 0 0 1 1 1v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3a1 1 0 1 1 2 0v3a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3v-3a1 1 0 0 1 1-1Z" />
        </svg>
      );
    default:
      return null;
  }
}

const GEO_ARTICLES: { title: string; href: string; cover: string }[] = [
  {
    title: "LeBron James Still Treats The Tunnel Like A Runway",
    href: "/articles/lebron-james-tunnel-fits.html",
    cover: "/articles/lebron-james-tunnel-fits-cover.jpg",
  },
  {
    title: "Justin Bieber's Streetwear Rotation Has One Rule",
    href: "/articles/justin-bieber-streetwear.html",
    cover: "/articles/justin-bieber-streetwear-cover.jpg",
  },
  {
    title: "Inside the Year's Best Celebrity Couple Style Moments",
    href: "/articles/celebrity-couple-style-moments.html",
    cover: "/articles/celebrity-couple-style-moments-cover.jpg",
  },
];

// An iMessage-style photo stack: every slide is always mounted (never
// swapped out), each one positioned purely as a function of its own cyclic
// distance from `current` — so advancing is just one number changing, and
// the CSS transition on every layer does the rest. The card at distance 0
// sits flat on top; distances 1-2 fan out tilted and scaled slightly
// smaller behind it, like a fanned hand of cards; anything further back is
// parked invisibly at the same spot as distance 2, ready to fade back in
// once the deck cycles around to it. The one card whose distance just
// became "the maximum" (it was on top a moment ago) gets its own
// exaggerated exit — flung off to the side and rotated — which, combined
// with the next card sliding out of the fan into the flat top spot, is
// what actually reads as "shuffling through the deck" rather than a
// cross-fade. onAdvance stops propagation on mousedown/up the same way the
// TikTok link does, so tapping a deck doesn't also collapse the card.
function PhotoDeck({
  images,
  current,
  onAdvance,
  borderColor,
  layer,
  aspect = "3 / 4",
  fit = "cover",
  background,
}: {
  images: string[];
  current: number;
  onAdvance: () => void;
  borderColor: string;
  layer: number;
  aspect?: string;
  fit?: "cover" | "contain";
  background?: string;
}) {
  const total = images.length;
  return (
    <div
      className="relative isolate h-full shrink-0 cursor-pointer select-none"
      // `isolate` makes each deck its own stacking context, so a deck's
      // internal z-indexes (which scale with its slide count) can't fight
      // its neighbors'. `layer` then orders whole decks against each other:
      // earlier decks sit above later ones, so a swiped-away card — which
      // exits to the left — always slides *behind* the deck beside it.
      style={{ aspectRatio: aspect, zIndex: layer }}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onAdvance();
      }}
    >
      {images.map((src, i) => {
        const distance = (i - current + total) % total;
        const justLeft = distance === total - 1;
        const depth = Math.min(distance, 2);
        const tilt = depth % 2 === 0 ? 1 : -1;
        // Exits to the left, not the right: a transformed child still counts
        // toward its scroll container's overflow, and a parked card sitting
        // 72% off the right of the last deck was what left a blank stretch
        // after the final deck. Overflow to the left isn't scrollable.
        const transform = justLeft
          ? "translate(-72%, 6%) rotate(-16deg) scale(0.94)"
          : `translate(${depth === 0 ? 0 : tilt * 5}px, ${depth * 9}px) rotate(${depth === 0 ? 0 : tilt * 4}deg) scale(${1 - depth * 0.05})`;
        const visible = justLeft ? false : distance <= 2;
        return (
          <div
            key={src}
            className="absolute inset-0 overflow-hidden rounded-xl"
            style={{
              transform,
              opacity: visible ? 1 : 0,
              zIndex: distance === 0 ? total + 1 : justLeft ? total : total - distance,
              border: `3px solid ${borderColor}`,
              background,
              transition: "transform 450ms cubic-bezier(0.22,0.68,0,1), opacity 300ms ease",
              // Invisible (opacity 0) layers still catch clicks, and the
              // parked swiped-away card sits 72% off to the left — right
              // over the neighboring deck — so clicks on that deck were
              // landing here instead. Only the wrapper should take clicks.
              pointerEvents: "none",
            }}
          >
            {/* object-cover, not contain: the 3px border makes the inner
                box a hair off the images' 3:4, and contain left a sliver
                of the panel color showing at the top/bottom. Cover fills
                it flush and only trims ~1px off an edge. */}
            <Image src={src} alt="" fill className={fit === "contain" ? "object-contain" : "object-cover"} priority={i === 0} />
          </div>
        );
      })}
    </div>
  );
}

// Solstice's interactive: drag the sun across an arc and the interior render
// lights up on the side it's on and falls into shade on the other. It's an
// illustration of the idea (a sunny "active" half and a shaded "inactive"
// half), not a real shadow simulation.
function SolsticeSun({ fg, borderColor, gap }: { fg: string; borderColor: string; gap: number }) {
  const [t, setT] = useState(0.22);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const moveTo = (clientX: number) => {
    const el = svgRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = ((clientX - r.left) / r.width) * 240;
    setT(Math.min(1, Math.max(0, (x - 20) / 200)));
  };
  const angle = Math.PI * t;
  const sunX = 120 - 100 * Math.cos(angle);
  const sunY = 120 - 100 * Math.sin(angle);
  const light = `radial-gradient(ellipse 75% 90% at ${t * 100}% -10%, rgba(255,208,110,0.7), rgba(255,208,110,0) 72%)`;
  const shade = `linear-gradient(90deg, rgba(8,16,48,${0.62 * t}) 0%, rgba(8,16,48,0) 45%, rgba(8,16,48,0) 55%, rgba(8,16,48,${0.62 * (1 - t)}) 100%)`;
  const status =
    t < 0.35
      ? "The sun is low on the left, so the right side of the courtyard sits in shade."
      : t > 0.65
        ? "The sun is low on the right, so the left side of the courtyard sits in shade."
        : "The sun is overhead, so light drops straight through the open strips.";

  return (
    <div className="flex h-full w-full items-stretch" style={{ gap, paddingTop: 32 }}>
      <div
        className="relative min-w-0 flex-[3] self-center overflow-hidden rounded-xl"
        style={{ aspectRatio: "932 / 600", border: `3px solid ${borderColor}` }}
      >
        <Image
          src="/solstice/interior-render.jpg"
          alt="Interior render of the Solstice pavilion: bent wooden strips under a mesh canopy above a brick seating mound"
          fill
          className="object-cover"
          priority
        />
        <div className="pointer-events-none absolute inset-0" style={{ background: shade }} />
        <div className="pointer-events-none absolute inset-0" style={{ background: light }} />
      </div>
      <div className="flex min-w-0 flex-[2] flex-col justify-between self-stretch py-2">
        <div className="flex flex-col gap-2">
          <span className="text-5xl font-bold">Solstice</span>
          <span className="text-base">A pavilion for the Perloff Hall courtyard, UCLA AUD summer program.</span>
        </div>
        <div className="flex flex-col gap-3">
          <span className="text-xs font-semibold tracking-[0.14em] uppercase opacity-70">Move the sun</span>
          <div
            role="slider"
            tabIndex={0}
            aria-label="Sun position"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(t * 100)}
            className="w-full max-w-[280px] cursor-grab touch-none outline-none active:cursor-grabbing"
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
            onPointerDown={(e) => {
              dragging.current = true;
              e.currentTarget.setPointerCapture(e.pointerId);
              moveTo(e.clientX);
            }}
            onPointerMove={(e) => {
              if (dragging.current) moveTo(e.clientX);
            }}
            onPointerUp={() => {
              dragging.current = false;
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") setT((v) => Math.max(0, v - 0.05));
              if (e.key === "ArrowRight") setT((v) => Math.min(1, v + 0.05));
            }}
          >
            <svg ref={svgRef} viewBox="0 0 240 130" className="block w-full" fill="none">
              <path d="M20 120A100 100 0 0 1 220 120" stroke={fg} strokeWidth="3" strokeDasharray="2 9" strokeLinecap="round" opacity="0.5" />
              <line x1="8" y1="120" x2="232" y2="120" stroke={fg} strokeWidth="3" strokeLinecap="round" />
              <g transform={`translate(${sunX} ${sunY})`}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <line
                    key={i}
                    x1="0"
                    y1="-17"
                    x2="0"
                    y2="-23"
                    stroke={fg}
                    strokeWidth="3"
                    strokeLinecap="round"
                    transform={`rotate(${i * 45})`}
                  />
                ))}
                <circle r="11" fill="#ffc83d" stroke={fg} strokeWidth="3" />
              </g>
            </svg>
          </div>
          <span className="text-lg leading-snug">{status}</span>
          <span className="text-sm leading-snug opacity-80">
            Only six of the original fourteen bent strips remain so sunlight can get through, and a mesh over half the
            structure makes the shaded, quieter half.
          </span>
        </div>
      </div>
    </div>
  );
}

// Glodesk's interactive: the desk render with numbered pins; picking a pin
// (or its row) highlights it and shows what it is.
const GLODESK_PINS: { x: number; y: number; title: string; text: string }[] = [
  { x: 72.7, y: 35.6, title: "Control panel", text: "A control panel built right into the desk surface." },
  { x: 74.6, y: 41.7, title: "Ports", text: "Two ports set in beside the control panel." },
  { x: 89.2, y: 59.2, title: "Cup holder", text: "A cup holder on an arm at the desk's edge." },
  { x: 42, y: 80, title: "Under-glow", text: "A warm light strip along the underside." },
  { x: 71, y: 65.3, title: "Engraving", text: "A Northwestern N and an ornamental border engraved into the wood." },
];

function GlodeskTour({ fg, borderColor, gap }: { fg: string; borderColor: string; gap: number }) {
  const [active, setActive] = useState(0);
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  return (
    <div className="flex h-full w-full items-stretch" style={{ gap, paddingTop: 32 }}>
      <div
        className="relative min-w-0 flex-[3] self-center overflow-hidden rounded-xl"
        style={{ aspectRatio: "908 / 554", border: `3px solid ${borderColor}` }}
      >
        <Image
          src="/glodesk-hero.png"
          alt="Glodesk adjustable smart desk rendered in a lecture hall"
          fill
          className="object-cover"
          priority
        />
        {GLODESK_PINS.map((pin, i) => (
          <button
            key={pin.title}
            type="button"
            aria-label={`${i + 1}. ${pin.title}`}
            onMouseDown={stop}
            onMouseUp={stop}
            onClick={(e) => {
              e.stopPropagation();
              setActive(i);
            }}
            className="absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-sm font-bold"
            style={{
              left: `${pin.x}%`,
              top: `${pin.y}%`,
              border: "3px solid #111",
              backgroundColor: i === active ? "#111" : "#fff",
              color: i === active ? "#fff" : "#111",
              transition: "background-color 200ms, color 200ms",
            }}
          >
            {i === active && (
              <span className="absolute inset-0 animate-ping rounded-full" style={{ border: "3px solid #fff" }} />
            )}
            {i + 1}
          </button>
        ))}
      </div>
      <div className="flex min-w-0 flex-[2] flex-col justify-between self-stretch py-2">
        <div className="flex flex-col gap-2">
          <span className="text-5xl font-bold">Glodesk</span>
          <span className="text-base">Reimagining workspaces across Northwestern.</span>
        </div>
        <div className="flex flex-col gap-3">
          <span className="text-xs font-semibold tracking-[0.14em] uppercase opacity-70">Tap a pin</span>
          <div className="flex flex-col gap-1.5">
            {GLODESK_PINS.map((pin, i) => (
              <button
                key={pin.title}
                type="button"
                onMouseDown={stop}
                onMouseUp={stop}
                onClick={(e) => {
                  e.stopPropagation();
                  setActive(i);
                }}
                className="flex items-center gap-3 text-left text-lg font-bold"
                style={{ opacity: i === active ? 1 : 0.45, transition: "opacity 200ms", color: fg }}
              >
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs"
                  style={{
                    border: `2px solid ${fg}`,
                    backgroundColor: i === active ? fg : "transparent",
                    color: i === active ? "var(--background)" : fg,
                  }}
                >
                  {i + 1}
                </span>
                {pin.title}
              </button>
            ))}
          </div>
          <span className="text-lg leading-snug">{GLODESK_PINS[active].text}</span>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [progress, setProgress] = useState(0);
  const [shrinkT, setShrinkT] = useState(0);
  // Opening sequence state. `dotsVisible` fades the background dot grid in
  // from a blank page (see the canvas's own style below). `squareExpanded`
  // flips the intro square's width/height transition from small to the
  // chrome box's exact size — its *position* (top) isn't React-driven at
  // all; the travel effect below writes el.style.top directly every frame
  // (same reasoning as the custom cursor elsewhere: a value React never
  // mentions in its own style object is one it will never reset, so the
  // two can't fight). `introPhase` gates which real content is visible:
  // "blank" is the pre-dots pause, then the square appears and plays out
  // its own pop/swim/expand during "intro", then the chrome box (border/bg
  // only) snaps in the instant that finishes (no transition on its own
  // opacity — it's an exact geometric match, nothing to visibly animate
  // there), then its button/progress-bar pop in during "chrome", then the
  // cards during "boxes".
  const [dotsVisible, setDotsVisible] = useState(false);
  const [squareExpanded, setSquareExpanded] = useState(false);
  const [introPhase, setIntroPhase] = useState<"blank" | "intro" | "chrome" | "boxes">("blank");
  // True once the cards' own pop-in transition has fully finished. Until
  // then the track needs a real (if numerically identity) `transform` to
  // animate through; once true, that's cleared entirely (see the track's
  // style below) — any specified transform value, even a no-op one, gives
  // position:fixed descendants a new containing block, which would break
  // the click-to-expand cards' math (computed relative to the viewport).
  const [cardsSettled, setCardsSettled] = useState(false);

  // Click-to-expand state. `expandedIndex` is which of the 6 cards (if any)
  // is expanded. `expandRect` is that card's on-screen rect *at the moment
  // it was clicked* — both the starting point to grow from and, on
  // collapse, the point to shrink back to. `expandGrown` is the two-phase
  // flip: false renders the card pinned to expandRect (so switching to
  // position:fixed causes zero visual jump), then a tick later flips true
  // to trigger the transition out to the full target size — collapsing
  // just flips it back to false and waits out the same transition before
  // clearing the other two.
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [expandRect, setExpandRect] = useState<{ top: number; left: number; width: number; height: number } | null>(
    null
  );
  const [expandGrown, setExpandGrown] = useState(false);
  // A CSS transition only animates a property change that happens *after*
  // the transition rule is already in effect — if a single React commit
  // both introduces `transition: transform 1500ms ...` for the first time
  // AND changes the value being transitioned, the browser starts a phantom
  // transition on that very first value (e.g. none -> the pinned start
  // offset) which then gets instantly retargeted back near its own start
  // by the *next* commit two frames later, net effect: no visible motion.
  // This flag keeps `transition` at "none" for that first pin-in-place
  // commit and only turns it on once the pinned frame has actually
  // painted, so the later grow/shrink value changes are the *first* change
  // the transition ever sees.
  const [expandTransitionReady, setExpandTransitionReady] = useState(false);
  // Gates the expanded-only content (e.g. a project's hero image) so it
  // only appears once the box has fully finished growing, and disappears
  // the instant a collapse is requested — never visible while the box
  // itself is mid-resize, which is what was reading as "content squishing
  // along with the box."
  const [expandSettled, setExpandSettled] = useState(false);
  // Which slide is on top of each of the four BorderX photo decks.
  const [deckIndex, setDeckIndex] = useState<number[]>(() => CAROUSEL_DECKS.map(() => 0));
  const [limitusStep, setLimitusStep] = useState(0);
  const advanceDeck = (i: number) =>
    setDeckIndex((prev) => prev.map((v, idx) => (idx === i ? (v + 1) % CAROUSEL_DECKS[idx].images.length : v)));
  // How far each *other* card needs to slide, computed once at the moment
  // a card expands (see the mousedown/mouseup effect below) as exactly the
  // distance the expanding card's own nearest edge travels — so whatever
  // gap already existed between them stays exactly that gap the entire
  // time, not just once everything lands.
  const [pushOffsets, setPushOffsets] = useState<Record<number, number>>({});
  // Mirrors expandedIndex for the mousedown/mouseup listeners below, which
  // are set up once (empty deps) and would otherwise only ever see the
  // value from their first render.
  const expandedIndexRef = useRef<number | null>(null);
  useEffect(() => {
    expandedIndexRef.current = expandedIndex;
  }, [expandedIndex]);
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const toggleBtnRef = useRef<HTMLButtonElement>(null);
  // The currently in-flight theme reveal, if any — lets a new click skip it
  // early (see toggleTheme) instead of being blocked until it finishes on
  // its own, which read as a cooldown on rapid successive clicks.
  const activeTransitionRef = useRef<ReturnType<Document["startViewTransition"]> | null>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const fgRef = useRef<string>(INK);
  const introSquareRef = useRef<HTMLDivElement>(null);
  // Where the background dot grid should repel from during the intro —
  // the square's current center — instead of the real cursor. Read by the
  // dot-grid effect below; null once the intro is over, handing repulsion
  // back to the real mouse.
  const introRepelRef = useRef<{ x: number; y: number } | null>(null);
  // The custom cursor stays invisible until the whole sequence is done —
  // read by the cursor effect below instead of a React state, so showing
  // it doesn't need its own re-render.
  const introDoneRef = useRef(false);

  // Drives the entire opening sequence as one chain of absolute offsets
  // from mount. Deliberately ONE effect with no dependencies, not one per
  // phase: an earlier version split this up, keyed to `introPhase` so the
  // travel step could reach `introSquareRef` once the square existed — but
  // every phase change is itself triggered by a timer *inside* that same
  // effect, so each transition re-ran the effect and its cleanup canceled
  // whatever later timer hadn't fired yet (the cards were the last one in
  // the chain, so they silently never appeared). A single run scheduled
  // entirely up front has nothing to cancel itself.
  useEffect(() => {
    const squareAppearsAt = INTRO_DOTS_FADE_DELAY + INTRO_DOTS_FADE_DURATION + INTRO_PRE_SQUARE_DELAY;
    const travelStartsAt = squareAppearsAt + INTRO_SQUARE_POP_DURATION + INTRO_SQUARE_HOLD;
    const expandStartsAt = travelStartsAt + INTRO_TRAVEL_DURATION + INTRO_TRAVEL_HOLD;
    const chromeAt = expandStartsAt + INTRO_EXPAND_DURATION;
    const boxesAt = chromeAt + INTRO_CARDS_DELAY;

    let raf = 0;
    const startTop = window.innerHeight / 2 - INTRO_SQUARE_SIZE / 2;
    const centerX = window.innerWidth / 2;

    const startTravel = () => {
      const el = introSquareRef.current;
      if (!el) return;
      let travelStart = 0;
      const travel = (now: number) => {
        if (!travelStart) travelStart = now;
        const t = Math.min(1, (now - travelStart) / INTRO_TRAVEL_DURATION);
        const eased = easeInOutCubic(t);
        const top = startTop + (INTRO_CHROME_TOP - startTop) * eased;
        el.style.top = `${top}px`;
        introRepelRef.current = { x: centerX, y: top + INTRO_SQUARE_SIZE / 2 };
        if (t < 1) raf = requestAnimationFrame(travel);
      };
      raf = requestAnimationFrame(travel);
    };

    const timers = [
      window.setTimeout(() => setDotsVisible(true), INTRO_DOTS_FADE_DELAY),
      window.setTimeout(() => {
        // Set the instant the square itself appears (not deferred until its
        // pop-in finishes and travel starts) — dots should react to it the
        // second it's on screen, not a beat later.
        introRepelRef.current = { x: centerX, y: startTop + INTRO_SQUARE_SIZE / 2 };
        setIntroPhase("intro");
      }, squareAppearsAt),
      window.setTimeout(startTravel, travelStartsAt),
      window.setTimeout(() => setSquareExpanded(true), expandStartsAt),
      window.setTimeout(() => {
        setIntroPhase("chrome");
        introRepelRef.current = null;
      }, chromeAt),
      window.setTimeout(() => {
        setIntroPhase("boxes");
        introDoneRef.current = true;
      }, boxesAt),
      window.setTimeout(() => setCardsSettled(true), boxesAt + INTRO_CARDS_POP_DURATION),
    ];
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      cancelAnimationFrame(raf);
    };
  }, []);

  const chromeVisible = introPhase === "chrome" || introPhase === "boxes";
  const isDark = theme === "dark";
  const bg = isDark ? BG_DARK : BG_LIGHT;
  // Text/icon color for every box (dark ink in light mode, white in dark
  // mode) plus the cursor and background dot grid. Pastel box fills stay
  // fixed across themes, so this is what keeps their contents readable in
  // both — matching how the name box's own text already flipped.
  const fg = isDark ? WHITE : INK;
  // Name-box text specifically where it crosses the accent circle: white in
  // light mode, black in dark mode — the opposite of `fg`, not a shade of
  // it, so it reads as a deliberate cutout rather than a contrast tweak.
  const coveredColor = isDark ? BLACK : WHITE;
  // White-on-pale-yellow (light mode) is the low-contrast case here — dark
  // mode's black-on-gold already reads fine on its own. Same recipe as
  // pastelTextShadow below, just the other theme, for the same reason: a
  // soft dark shadow, not a color change, to keep it legible at a glance.
  const coveredTextShadow = isDark ? "none" : "0 1px 3px rgba(0,0,0,0.45)";
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
  const pastelPink = isDark ? PASTEL_PINK_DARK : PASTEL_PINK;
  const pastelYellow = isDark ? PASTEL_YELLOW_DARK : PASTEL_YELLOW;
  const pastelOlive = isDark ? PASTEL_OLIVE_DARK : PASTEL_OLIVE;
  const pastelPeriwinkle = isDark ? PASTEL_PERIWINKLE_DARK : PASTEL_PERIWINKLE;
  const cardScale = 1 - shrinkT * (1 - MIN_CARD_SCALE);
  // The live gap between cards in the row — same eased value driving the
  // track's own `gap` below, reused wherever something else needs to match
  // that exact spacing (see the BorderX card's two placeholder rectangles).
  const trackGap = LARGE_GAP + shrinkT * (SMALL_GAP - LARGE_GAP);

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
      // During the intro, dots repel from the traveling square instead of
      // the real cursor — same field, just a different source point (and a
      // wider, slightly stronger radius/force — see INTRO_REPEL_RADIUS).
      // Before the intro's fully done and neither is set, dots shouldn't
      // react to anything — falling back to the real mouse here (which is
      // always tracked, invisible cursor or not) is what let dots visibly
      // repel from wherever the real pointer was even before the square
      // ever appeared.
      const introRepel = introRepelRef.current;
      const repelFrom = introRepel ?? (introDoneRef.current ? mouse : null);
      const repelRadius = introRepel ? INTRO_REPEL_RADIUS : MOUSE_RADIUS;
      const repelForce = introRepel ? INTRO_REPEL_FORCE : REPEL_FORCE;
      for (const dot of dots) {
        let targetX = dot.baseX;
        let targetY = dot.baseY;
        if (repelFrom) {
          const dx = repelFrom.x - dot.baseX;
          const dy = repelFrom.y - dot.baseY;
          const dist = Math.hypot(dx, dy);
          if (dist < repelRadius) {
            const ratio = (repelRadius - dist) / repelRadius;
            const angle = Math.atan2(dy, dx);
            const push = ratio * repelForce;
            targetX -= Math.cos(angle) * push;
            targetY -= Math.sin(angle) * push;
          }
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
      // exactly when the cursor actually touches a target's box, never
      // before. (Proximity-based growth was a leftover from the earlier
      // goo-merge design, which needed an "approaching" lead-in; without
      // that, growing before actual contact just reads as a glitch.)
      //
      // Tests the cursor's own square footprint against the target's rect
      // (an AABB overlap, not a point-in-rect test against currentPos
      // alone) — the cursor is a visible CURSOR_SIZE square, not a single
      // pixel, so it should register contact the instant any part of that
      // square touches the target, same as it'd look to the eye, rather
      // than waiting for its exact center to cross the boundary.
      const half = CURSOR_SIZE / 2;
      let isOverTarget = false;
      for (const el of meltTargets) {
        const rect = el.getBoundingClientRect();
        if (
          currentPos.x + half >= rect.left &&
          currentPos.x - half <= rect.right &&
          currentPos.y + half >= rect.top &&
          currentPos.y - half <= rect.bottom
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

      const targetOpacity = isOutside || !introDoneRef.current ? 0 : 1;
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
  // Release used to always target scale(1) — the true base size — no
  // matter what, on the theory that handing back to CSS's own :hover
  // transition afterward (via the onfinish->cancel below) would reassert
  // the grown size if still hovering. In practice the 150ms release
  // animation plays down to base *first*, and only reaches the hover size
  // after that finishes and gets cancelled — a visible two-step landing
  // that read as "stuck small" if anything interrupted the handoff. Release
  // now checks :hover directly and animates straight to whichever size is
  // actually correct — the hover-grown size if the cursor's still over it,
  // base otherwise — so there's exactly one motion, not two.
  useEffect(() => {
    const PRESS_SCALE = 0.91;

    // Animates the standalone `scale` property, not `transform` — Tailwind
    // v4's hover:scale-* utilities set *that* property (a separate,
    // composable one in modern CSS, alongside translate/rotate/transform),
    // not transform. Animating transform instead (the original approach)
    // meant this was never actually overriding the CSS hover-scale at all;
    // the two composed multiplicatively — a mousedown while hovering (CSS
    // scale: 1.12) animating transform down to scale(0.91) rendered at
    // 1.12 * 0.91 ≈ 1.02, i.e. barely different from the hover size, which
    // is why presses read as unreliable/unreactive specifically while
    // hovering. Reads the element's *current* computed scale before
    // touching any animation on it — cancelling an existing animation
    // first would snap it back to the CSS-only value, losing whatever
    // mid-shrink (or mid-release) point it was actually showing.
    const animateScaleTo = (el: HTMLElement, target: number) => {
      const current = getComputedStyle(el).scale;
      for (const a of el.getAnimations()) a.cancel();
      return el.animate(
        [{ scale: current === "none" ? "1" : current }, { scale: `${target}` }],
        { duration: 150, easing: "ease-out", fill: "forwards" }
      );
    };

    let pressed: { el: HTMLElement } | null = null;
    // A card becomes a candidate to expand on mousedown, but only actually
    // opens on mouseup over that same element — a real "press and release",
    // not a press-and-drag-away. The rect is captured right here, before
    // animateScaleTo below has a chance to touch `scale`, so it's always the
    // card's true rest-size box — measuring it any later (e.g. from the
    // click handler this used to use) could catch it mid-press-shrink and
    // grow the expanded box from the wrong size/position.
    let expandCandidate: { el: HTMLElement; index: number; rect: DOMRect } | null = null;

    const handleMouseDown = (e: MouseEvent) => {
      if (!(e.target instanceof Element)) return;
      const el = e.target.closest("[data-cursor-melt]");
      if (!(el instanceof HTMLElement)) return;

      const cardIndexAttr = el.dataset.cardIndex;
      expandCandidate =
        cardIndexAttr !== undefined && expandedIndexRef.current === null
          ? { el, index: Number(cardIndexAttr), rect: el.getBoundingClientRect() }
          : null;

      animateScaleTo(el, PRESS_SCALE);
      pressed = { el };
    };
    const handleMouseUp = (e: MouseEvent) => {
      if (pressed) {
        const { el } = pressed;
        const hoverScale = el === toggleBtnRef.current ? TOGGLE_HOVER_SCALE : CARD_HOVER_SCALE;
        const target = el.matches(":hover") ? hoverScale : 1;
        const release = animateScaleTo(el, target);
        release.onfinish = () => release.cancel();
        pressed = null;
      }

      const upEl = e.target instanceof Element ? e.target.closest("[data-cursor-melt]") : null;
      const upIndexAttr = upEl instanceof HTMLElement ? upEl.dataset.cardIndex : undefined;

      if (upIndexAttr !== undefined && Number(upIndexAttr) === expandedIndexRef.current) {
        // Released on the card that's already expanded — collapse it.
        // expandSettled drops immediately (same tick) so any expanded-only
        // content disappears before the box starts shrinking, instead of
        // riding the shrink down with it.
        setExpandSettled(false);
        setExpandGrown(false);
        setPushOffsets({});
        window.setTimeout(() => {
          setExpandedIndex(null);
          setExpandRect(null);
          setExpandTransitionReady(false);
        }, EXPAND_DURATION);
      } else if (expandCandidate && upEl === expandCandidate.el) {
        const { el, index, rect } = expandCandidate;
        // The release animation just kicked off above (if this card was the
        // pressed one) targets a `scale` around 1 — belt-and-suspenders
        // cancel of it here too, since letting a leftover hover/press scale
        // keep easing on the same element while it's also mid-flight to its
        // new size is exactly the kind of thing that could visually read as
        // growing from the wrong spot. Cancelling (not also setting
        // `el.style.scale` directly) matters: an inline style sticks around
        // forever once set outside React's own style prop, which is exactly
        // what happened here before — it silently broke this card's hover
        // grow for good after its first expand, since an inline style beats
        // the CSS hover class no matter what. Cancelling an animation just
        // reverts to whatever the stylesheet already says, hover included.
        for (const a of el.getAnimations()) a.cancel();

        // Every other card slides by *exactly* the same distance the
        // expanding card's own nearest edge travels — not "just far enough
        // to clear it" — so the gap between that edge and the card it's
        // pushing is the same natural flex gap at every instant of the
        // animation, not just once it lands. (Both groups still move as
        // one rigid block, preserving whatever spacing already existed
        // between cards further down the line — nothing here needs to
        // touch their gaps at all, only shift the whole block by the same
        // fixed amount.)
        const target = computeExpandTarget();
        const leftPush = target.targetLeft - rect.left;
        const rightPush = target.targetLeft + target.targetWidth - (rect.left + rect.width);
        const offsets: Record<number, number> = {};
        document.querySelectorAll("[data-card-index]").forEach((otherEl) => {
          const otherIndex = Number((otherEl as HTMLElement).dataset.cardIndex);
          if (otherIndex === index) return;
          offsets[otherIndex] = otherIndex < index ? leftPush : rightPush;
        });
        setPushOffsets(offsets);

        setExpandRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
        setExpandedIndex(index);
        setExpandGrown(false);
        setExpandSettled(false);
        // This first commit pins the card at its real starting rect with
        // no transition (see the expandTransitionReady comment) — the
        // transition only turns on, and the size/position only changes to
        // the target, two frames later, once that pinned frame has had a
        // chance to actually paint.
        setExpandTransitionReady(false);
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            setExpandTransitionReady(true);
            setExpandGrown(true);
            window.setTimeout(() => setExpandSettled(true), EXPAND_DURATION);
          })
        );
      }
      expandCandidate = null;
    };

    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  // Click-to-expand open/close for the cards is driven by the native
  // mousedown/mouseup listeners above (see the state comment near
  // expandedIndex) — that's what lets opening measure the card's rect
  // before the press-shrink touches its scale, and lets it trigger
  // specifically on release rather than on the synthetic click event.
  // This is only for the other two ways to close: the backdrop and Escape.
  function collapseExpanded() {
    if (expandedIndex === null) return;
    setExpandSettled(false);
    setExpandGrown(false);
    setPushOffsets({});
    window.setTimeout(() => {
      setExpandedIndex(null);
      setExpandRect(null);
      setExpandTransitionReady(false);
    }, EXPAND_DURATION);
  }

  // Escape closes an expanded card the same way clicking the backdrop does.
  useEffect(() => {
    if (expandedIndex === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") collapseExpanded();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedIndex]);

  // The expanded card's own style: fixed at its captured rect (wherever
  // that actually is — even mostly off-screen, if it was clicked mid-
  // scroll) until expandGrown flips, then transitions to the same target
  // every time (see computeExpandTarget) — top/left/width/height all move
  // together on one shared duration+easing. Since each of those four
  // interpolates linearly (independently) from its own start to its own
  // end value, the box's *center* — left+width/2, top+height/2 — is
  // itself just a linear combination of two linear functions of time, so
  // it automatically traces a straight line from the start rect's center
  // to the target's center for free, without needing a separate
  // translate/scale calculation: this is plain layout, not a transform,
  // so nothing inside the card (text, the hero image) ever gets visually
  // stretched by a non-uniform scale — it just reflows crisply as the box
  // resizes, the same as a normal responsive resize.
  //
  // Animating these layout properties directly on a freshly-`fixed`
  // element was tried before and abandoned as unreliable — but the real
  // cause wasn't the properties or the fresh `position: fixed`, it was
  // `transition` being introduced in the very same commit as the first
  // value change (see expandTransitionReady above): that phantom
  // transition, not a browser limitation on animating layout props, is
  // what made it "skip straight to the end." With that actually fixed,
  // plain top/left/width/height is simpler and doesn't warp content, so
  // it's back.
  function getExpandStyle(index: number): React.CSSProperties {
    if (expandedIndex !== index || !expandRect) return {};
    const target = computeExpandTarget();
    const rect = expandGrown
      ? { top: target.targetTop, left: target.targetLeft, width: target.targetWidth, height: target.targetHeight }
      : expandRect;
    return {
      position: "fixed",
      zIndex: 50,
      margin: 0,
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      // cardBox still carries hover:scale-[1.035] — irrelevant most of the
      // time since a mouse can't "hover" a full-viewport-ish panel in any
      // meaningful sense, but the cursor is still sitting wherever it was
      // clicked, which is now *inside* the grown card, so that hover rule
      // stays matched and was quietly inflating the final size by another
      // 3.5% on top of the real target. An inline value wins over the
      // class either way, so pin it off for as long as this card is expanded.
      scale: 1,
      transition: expandTransitionReady
        ? `top ${EXPAND_DURATION}ms ${EXPAND_EASING}, left ${EXPAND_DURATION}ms ${EXPAND_EASING}, width ${EXPAND_DURATION}ms ${EXPAND_EASING}, height ${EXPAND_DURATION}ms ${EXPAND_EASING}`
        : "none",
    };
  }

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
    // A previous reveal blocked new clicks until it finished entirely
    // (~REVEAL_DURATION+), which read as a cooldown on rapid successive
    // presses. Skipping it instead — jumping it straight to its end state —
    // is what the View Transition API is actually for here: it's a real,
    // documented way to end one early so a new one can start immediately.
    if (activeTransitionRef.current) {
      activeTransitionRef.current.skipTransition();
    }

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

    const root = document.documentElement;
    root.style.setProperty("--reveal-x", `${x}px`);
    root.style.setProperty("--reveal-y", `${y}px`);
    root.style.setProperty("--reveal-radius", "0px");

    // The functional updater form, not `theme === "light" ? "dark" :
    // "light"` computed once up front — that read `theme` from this call's
    // own closure, captured at whatever render created it. Rapid clicks
    // firing faster than a re-render all shared that same stale snapshot,
    // so every one of them computed the *same* target instead of actually
    // toggling back and forth — e.g. four quick clicks landing on dark
    // instead of cycling back to light. The updater form always applies to
    // React's latest pending value regardless of timing.
    const flipTheme = () => setTheme((prev) => (prev === "light" ? "dark" : "light"));

    if (typeof document.startViewTransition !== "function") {
      flipTheme();
      return;
    }

    const maxRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    const transition = document.startViewTransition(() => {
      flushSync(flipTheme);
    });
    activeTransitionRef.current = transition;

    transition.finished.finally(() => {
      // Only clear if this is still the active one — a newer transition's
      // own finally may have already replaced it (or, after a skip, will
      // run before this stale one's cleanup does).
      if (activeTransitionRef.current === transition) {
        activeTransitionRef.current = null;
      }
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
        // Transition was skipped/aborted (e.g. tab hidden mid-flight, or a
        // newer click calling skipTransition() on this one) — cleanup still
        // runs via transition.finished above either way.
      });
  }

  const activeCount = Math.round(
    Math.max(0, Math.min(1, progress)) * PEAKS.length
  );

  // `isolate` (CSS `isolation: isolate`) gives every card its own stacking
  // context regardless of position/z-index, so each card's own internal
  // z-10/z-20 decorative layers (the name box's clip-path text, etc.) stay
  // scoped to that card no matter what happens to the track's — removing
  // the track's own z-index below was the fix for the expand overlay's
  // real stacking bug, and this is what keeps that change from letting
  // unrelated internal z-index values leak into the global stacking order.
  const cardBox =
    "isolate h-full w-full flex flex-col rounded-3xl border-[3px] p-10 transition-transform duration-200 ease-out hover:scale-[1.035]";

  // Real layout shrink (flexBasis), not just a cosmetic transform: scaling
  // a fixed-width slot visually without changing its actual width leaves
  // the original full-size gap between neighbors once it's smaller. The
  // vertical shrink stays a transform (scaleY) since there's no "next row"
  // for that to leave a gap against — it's a single horizontal row.
  // No CSS transition here on purpose: cardScale already updates every
  // scroll event, directly off scrollLeft, so the DOM value should match
  // the current scroll position exactly — a transition would just lag
  // behind a value that's already changing continuously.
  // `index` lets the expanded card's own slot drop its transform entirely
  // (rather than just leaving it at the numerically-identity scaleY(1)) —
  // any specified transform value, even a no-op one, gives a fixed-position
  // child a new containing block instead of the viewport, which would break
  // the click-to-expand math for that one card specifically. Its own real
  // layout footprint stays exactly as it was — it's not growing in the
  // flex row, it's a fixed-position overlay floating above it (see
  // getExpandStyle) — so there's nothing here for it to grow *into*.
  //
  // Every *other* slot slides sideways, away from whichever one is
  // expanded, while it's expanded — purely a cosmetic transform on top of
  // their normal flex layout, not a real reflow of the row. A real
  // flex-basis grow on the expanding slot was tried first, matched with
  // snapping the track's scrollLeft to keep earlier cards pushed too, and
  // that combination was the actual source of the reported glitchiness:
  // the scrollLeft snap is an instant DOM mutation racing the React state
  // update that turns the card into a fixed overlay, and any tiny
  // ordering slip between the two showed up as a visible jump. A plain
  // transform on the untouched siblings can't race anything — there's
  // only one thing changing.
  const slotStyle = (baseWidth: number, index: number): React.CSSProperties => {
    if (expandedIndex === index) {
      return { flexBasis: baseWidth * cardScale };
    }
    const pushX = expandedIndex !== null && expandGrown ? (pushOffsets[index] ?? 0) : 0;
    return {
      flexBasis: baseWidth * cardScale,
      transform: `translateX(${pushX}px) scaleY(${cardScale})`,
      transition: expandedIndex !== null ? `transform ${EXPAND_DURATION}ms ${EXPAND_EASING}` : undefined,
    };
  };

  // The scroll-shrink squash above is a non-uniform `scaleY` on a card's
  // slot wrapper, which visibly warps any content inside it (text reads as
  // flattened, images/logos as stretched) since a transform applies to
  // every descendant regardless of what it's showing. Any piece of a
  // card's own content that should stay visually crisp at every scroll
  // position — not just the logos — carries this inverse scale to cancel
  // it out exactly. No-op while *this* card is the expanded one, since its
  // slot carries no such transform then (see slotStyle).
  const unstretch = (index: number): React.CSSProperties => ({
    transform: expandedIndex === index ? undefined : `scaleY(${1 / cardScale})`,
  });

  // The intro heading is the one piece of text that can actually overflow
  // its box, rather than just look squashed: it's a fixed 76px regardless
  // of the card's own (real, layout) width, so shrinking that width on
  // scroll left it wrapping onto more lines than the box's fixed height
  // has room for, clipped by the card's overflow-hidden. Shrinking the
  // font-size by the same fraction as the card's width keeps it wrapping
  // the same way it always did, at every scroll position — and since that
  // shrinks both axes of each glyph equally while the ambient scaleY
  // squash above only touches one, cancelling that squash the same way
  // `unstretch` does nets out to the text simply being smaller, not warped.
  //
  // Expanding card 0 retires that squash-cancelling job and gives the
  // group a second one: sliding from dead-center (its normal resting spot)
  // up to a fixed perch near the top of the box, on release sliding back
  // down. It's absolutely positioned (not just left as a centered flex
  // child) specifically so `top`/`transform` are things a CSS transition
  // can actually animate — `justify-content` can't be. `expandGrown`, not
  // `expandedIndex`, gates the "up" position so the slide rides the same
  // 1500ms as the box's own grow/shrink, in step with it rather than
  // ahead of or behind it; `expandTransitionReady` gates the transition
  // itself for the same phantom-transition reason documented above
  // `expandTransitionReady`'s own declaration.
  const introExpanding = expandedIndex === 0;
  const introShiftUp = introExpanding && expandGrown;
  const introGroupStyle: React.CSSProperties = {
    // 40, matching p-10 — both ancestors (the card itself, and the z-20
    // overlay's own wrapper) carry p-10, but an absolutely positioned
    // child is positioned against its containing block's *padding box*,
    // whose edges sit right at the border, padding included in the box
    // but not offset from — so left/right/top: 0 here would land flush
    // with the border, skipping the padding it looks like it should
    // already account for. Repeating the 40 is what actually reproduces
    // it. The shifted-up top gets a further 44 (84 total) to clear the
    // chrome pill straddling the box's top border — more than the plain
    // 32 other cards' own (normal-flow, correctly-padded) expanded
    // content adds on top of *their* padding, since 40+32 alone still
    // landed the name half a line under the pill.
    position: "absolute",
    left: 40,
    right: 40,
    top: introShiftUp ? 84 : "50%",
    transform: introShiftUp
      ? "translateY(0)"
      : introExpanding
        ? "translateY(-50%)"
        : `translateY(-50%) scaleY(${1 / cardScale})`,
    transition: expandTransitionReady
      ? `top ${EXPAND_DURATION}ms ${EXPAND_EASING}, transform ${EXPAND_DURATION}ms ${EXPAND_EASING}`
      : "none",
  };
  const introLeadStyle: React.CSSProperties =
    introExpanding ? {} : { fontSize: 34 * cardScale };
  const introNameStyle: React.CSSProperties =
    introExpanding ? {} : { fontSize: 124 * cardScale };

  return (
    <div
      ref={rootRef}
      className="relative h-screen w-full overflow-hidden font-sans"
      style={{ backgroundColor: bg, color: fg }}
    >
      <canvas
        ref={bgCanvasRef}
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          opacity: dotsVisible ? 1 : 0,
          transition: `opacity ${INTRO_DOTS_FADE_DURATION}ms ease-out`,
        }}
      />

      {introPhase === "intro" && (
        <div
          ref={introSquareRef}
          aria-hidden
          className="intro-square-pop pointer-events-none absolute z-30 flex items-center justify-center overflow-hidden border-[3px]"
          style={{
            borderColor: borderOnBg,
            backgroundColor: bg,
            // Expressed as a vh-based calc (not a JS-measured value) so the
            // very first paint — before the travel effect below has run at
            // all — already matches the pixel top that effect computes for
            // the same centered position, with nothing for React to touch
            // afterward: from here on, only that effect's rAF loop ever
            // writes to this element's `top` (see introSquareRef there),
            // exactly like the custom cursor further down mutates its own
            // element directly rather than through React state.
            top: `calc(50vh - ${INTRO_SQUARE_SIZE / 2}px)`,
            left: "50%",
            width: squareExpanded ? INTRO_CHROME_WIDTH : INTRO_SQUARE_SIZE,
            height: squareExpanded ? INTRO_CHROME_HEIGHT : INTRO_SQUARE_SIZE,
            borderRadius: squareExpanded ? INTRO_CHROME_RADIUS : INTRO_SQUARE_RADIUS,
            transform: "translateX(-50%)",
            transition: [
              `width ${INTRO_EXPAND_DURATION}ms ${REVEAL_EASING}`,
              `height ${INTRO_EXPAND_DURATION}ms ${REVEAL_EASING}`,
              `border-radius ${INTRO_EXPAND_DURATION}ms ${REVEAL_EASING}`,
            ].join(", "),
          }}
        >
          {/* A little wordmark riding along with the square — visible while
              it's still small, faded out the instant it starts expanding
              into the chrome box (which has no room/reason for it once
              its real button and progress bar pop in). */}
          <span
            className="text-2xl leading-none font-bold"
            style={{
              color: fg,
              opacity: squareExpanded ? 0 : 1,
              transition: `opacity ${INTRO_EXPAND_DURATION}ms ${REVEAL_EASING}`,
            }}
          >
            s.
          </span>
        </div>
      )}

      <div
        // z-[60], not z-10: needs to stay above an expanded card (z-index
        // 50, see getExpandStyle) — the expanded panel's top edge sits
        // halfway through this chrome box on purpose (see EXPAND_TOP), so
        // without this the panel would grow out from *underneath* it.
        className="absolute top-6 left-1/2 z-[60] -translate-x-1/2 rounded-3xl border-[3px] px-6 py-4"
        style={{
          borderColor: borderOnBg,
          backgroundColor: bg,
          opacity: chromeVisible ? 1 : 0,
          pointerEvents: chromeVisible ? "auto" : "none",
        }}
      >
        {/* The chrome box above snaps in the instant the intro square lands
            (no transition on its own opacity) since the two are an exact
            geometric match — nothing to visibly animate there. This inner
            wrapper is what actually pops in, a beat later, once introPhase
            reaches "chrome". */}
        <div
          className="flex flex-col items-center gap-2.5"
          style={{
            opacity: chromeVisible ? 1 : 0,
            transform: chromeVisible ? "scale(1)" : "scale(0.6)",
            transition: `opacity ${INTRO_CHROME_POP_DURATION}ms ${INTRO_POP_EASING}, transform ${INTRO_CHROME_POP_DURATION}ms ${INTRO_POP_EASING}`,
          }}
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
      </div>

      <div
        ref={trackRef}
        // No z-index here (used to be z-[1]) — that, combined with the
        // position:absolute below, made this element establish its own
        // stacking context, which trapped the expanded card's z-index:50
        // inside it: that z-50 was only ever competing against the *other
        // cards*, never actually against the z-40 backdrop or z-[9999]
        // cursor at the real top level, so the expanded card was quietly
        // rendering *behind* the backdrop the whole time — the actual
        // cause of the reported glitchy/unclickable feel. Dropping this
        // still stacks correctly without it: an absolutely-positioned
        // element with no explicit z-index paints in plain DOM order
        // relative to its siblings here (after the canvas, before the
        // positive-z chrome/backdrop/cursor), which is exactly the order
        // already wanted.
        className="hscroll-track absolute inset-x-0 bottom-0 flex items-stretch overflow-x-auto overflow-y-hidden overscroll-x-none px-12 pb-14"
        style={{
          top: 100,
          gap: trackGap,
          opacity: introPhase === "boxes" ? 1 : 0,
          transform: cardsSettled
            ? undefined
            : introPhase === "boxes"
              ? "translateY(0) scale(1)"
              : "translateY(16px) scale(0.97)",
          transition: `opacity ${INTRO_CARDS_POP_DURATION}ms ${INTRO_POP_EASING}, transform ${INTRO_CARDS_POP_DURATION}ms ${INTRO_POP_EASING}`,
          pointerEvents: introPhase === "boxes" ? "auto" : "none",
        }}
      >
        <div className="my-4 shrink-0" style={slotStyle(720, 0)}>
          <ExpandableCard
            index={0}
            className={`${cardBox} relative justify-center overflow-hidden @container`}
            style={{ borderColor: borderOnBg, backgroundColor: bg, ...getExpandStyle(0) }}
          >
            {/* Decorative only — centered on the box's corner via right/
                bottom 0 plus a self-translate, so it stays anchored there
                regardless of size. Diameter is 170cqw (cqw, not a plain %,
                specifically so it shares the same reference box as the
                clip-path below — see the clipped layer's own comment).
                Once expanded and settled, `right` goes negative to nudge
                the whole circle a bit further right than its resting
                corner anchor — animated on the same clock as the box's
                own grow/shrink so it lands there right as the box does,
                rather than jumping. The clip-path's own center below has
                to be pushed the matching amount or the two-tone split
                would drift out of registration with the visible circle. */}
            <div
              aria-hidden
              className="pointer-events-none absolute bottom-0 aspect-square w-[170cqw] translate-x-1/2 translate-y-1/2 rounded-full"
              style={{
                backgroundColor: pastelYellow,
                right: introShiftUp ? "-8cqw" : 0,
                transition: expandTransitionReady ? `right ${EXPAND_DURATION}ms ${EXPAND_EASING}` : "none",
              }}
            />

            <div className="z-10 flex flex-col gap-3" style={introGroupStyle}>
              {!introExpanding && (
                <span
                  className="text-[34px] leading-none font-normal tracking-tight"
                  style={introLeadStyle}
                >
                  Hello, my name is
                </span>
              )}
              <h1
                className="m-0 text-[124px] leading-[0.88] font-bold tracking-tighter"
                style={introNameStyle}
              >
                Stanley Wan.
              </h1>
              {introExpanding && expandSettled && (
                <div className="intro-subtitle-fade-in mt-1 flex items-center gap-6">
                  {INTRO_LINKS.map((link) => (
                    <a
                      key={link.key}
                      href={link.href}
                      aria-label={link.label}
                      target={link.external ? "_blank" : undefined}
                      rel={link.external ? "noopener noreferrer" : undefined}
                      onMouseDown={(e) => e.stopPropagation()}
                      onMouseUp={(e) => e.stopPropagation()}
                      className="group relative block h-8 w-8 opacity-80 transition-opacity hover:opacity-100"
                    >
                      <IntroLinkIcon name={link.key} />
                      {link.key === "resume" && (
                        <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 rounded-md bg-black px-2.5 py-1.5 text-center text-xs leading-tight font-semibold whitespace-nowrap text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                          Download Resume
                        </span>
                      )}
                    </a>
                  ))}
                </div>
              )}
              {introExpanding && expandSettled && (
                <span
                  className="intro-subtitle-fade-in mt-14 block text-left leading-[0.95] tracking-tight font-normal"
                  style={{ fontSize: "clamp(36px, 5.5vw, 86px)" }}
                >
                  I am studying <span className="font-bold">Cognitive + Computer Science</span> at{" "}
                  <a
                    href="https://www.northwestern.edu/"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Northwestern University"
                    onMouseDown={(e) => e.stopPropagation()}
                    onMouseUp={(e) => e.stopPropagation()}
                    className="inline-block align-baseline no-underline"
                  >
                    <Image
                      src="/northwestern-thumb.jpg"
                      alt="N"
                      width={200}
                      height={200}
                      className="inline-block rounded-[0.12em]"
                      style={{ width: "0.82em", height: "0.82em", transform: "translateY(0.06em)" }}
                    />
                  </a>
                  orthwestern University
                </span>
              )}
            </div>

            {/* An exact duplicate of the text above, recolored (white in
                light mode, black in dark — the opposite of fg, not a shade
                of it) and clipped to the same circle geometry: 85cqw = half
                of the circle's own 170cqw diameter, centered at the same
                corner the circle div is, so it tracks the visible circle
                exactly regardless of the box's actual rendered size — its
                center-x has to shift in step with that div's own `right`
                nudge once expanded, on the same transition, or the
                two-tone split drifts out of registration with the circle
                mid-animation. Percentages in clip-path's circle() resolve
                against the box's *diagonal*, not its width, which is why
                this needs cqw at all rather than a plain percentage
                matching the circle above. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-center p-10"
              style={{
                clipPath: `circle(85cqw at ${introShiftUp ? "108%" : "100%"} 100%)`,
                transition: expandTransitionReady ? `clip-path ${EXPAND_DURATION}ms ${EXPAND_EASING}` : "none",
                color: coveredColor,
                textShadow: coveredTextShadow,
              }}
            >
              <div className="flex flex-col gap-3" style={introGroupStyle}>
                {!introExpanding && (
                  <span
                    className="text-[34px] leading-none font-normal tracking-tight"
                    style={introLeadStyle}
                  >
                    Hello, my name is
                  </span>
                )}
                <h1
                  className="m-0 text-[124px] leading-[0.88] font-bold tracking-tighter"
                  style={introNameStyle}
                >
                  Stanley Wan.
                </h1>
                {introExpanding && expandSettled && (
                  <div className="intro-subtitle-fade-in mt-1 flex items-center gap-6">
                    {INTRO_LINKS.map((link) => (
                      <span key={link.key} className="block h-8 w-8 opacity-80">
                        <IntroLinkIcon name={link.key} />
                      </span>
                    ))}
                  </div>
                )}
                {introExpanding && expandSettled && (
                  <span
                    className="intro-subtitle-fade-in mt-14 block text-left leading-[0.95] tracking-tight font-normal"
                    style={{ fontSize: "clamp(36px, 5.5vw, 86px)" }}
                  >
                    I am studying <span className="font-bold">Cognitive + Computer Science</span> at{" "}
                    <Image
                      src="/northwestern-thumb.jpg"
                      alt="N"
                      width={200}
                      height={200}
                      className="inline-block align-baseline rounded-[0.12em]"
                      style={{ width: "0.82em", height: "0.82em", transform: "translateY(0.06em)" }}
                    />
                    orthwestern University
                  </span>
                )}
              </div>
            </div>
          </ExpandableCard>
        </div>

        <div className="my-4 shrink-0" style={slotStyle(520, 1)}>
          <ExpandableCard
            index={1}
            className={`${cardBox} justify-between gap-6`}
            style={{ borderColor: borderOnBg, backgroundColor: pastelRed, color: fg, textShadow: pastelTextShadow, ...getExpandStyle(1) }}
          >
            <div className="flex flex-1 items-center justify-center">
              <Image
                src={isDark ? "/rising-team-logo-white.png" : "/rising-team-logo-black.png"}
                alt="Rising Team logo"
                width={144}
                height={144}
                className="h-[72px] w-[72px] object-contain"
                style={{ filter: pastelIconShadow, ...unstretch(1) }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[22px] font-bold" style={unstretch(1)}>
                Rising Team
              </span>
              <span className="text-sm" style={unstretch(1)}>
                Product Design
              </span>
            </div>
          </ExpandableCard>
        </div>

        <div className="my-4 shrink-0" style={slotStyle(520, 2)}>
          <ExpandableCard
            index={2}
            className={`${cardBox} justify-between gap-6`}
            style={{ borderColor: borderOnBg, backgroundColor: pastelBlue, color: fg, textShadow: pastelTextShadow, ...getExpandStyle(2) }}
          >
            <div className="flex min-h-0 flex-1 items-center justify-center">
              {expandedIndex === 2 && expandSettled ? (
                // Two equal placeholder panels, left and right — the gap
                // between them, their distance from the top edge, and
                // their distance from each side are all the same live
                // trackGap (the same gap the cards in the row use between
                // each other). The negative margins cancel cardBox's own
                // p-10 (40px) on the top/left/right — extending height by
                // the same 40px keeps the bottom edge anchored where it
                // was — so "distance from the edge" is measured from the
                // card's actual border, not from this padded content
                // slot. The bottom stays as the existing gap down to the
                // title block, left untouched since only the top and
                // sides were asked to match.
                <div
                  className="flex min-h-0 items-stretch"
                  style={{
                    height: "calc(100% + 40px)",
                    marginTop: -40,
                    marginLeft: -40,
                    marginRight: -40,
                    width: "calc(100% + 80px)",
                    gap: trackGap,
                    paddingTop: trackGap,
                    paddingLeft: trackGap,
                    paddingRight: trackGap,
                  }}
                >
                  <div
                    className="relative min-h-0 flex-1 overflow-hidden rounded-2xl"
                    style={{ border: `3px solid ${borderOnBg}` }}
                  >
                    <div className="flex h-full flex-col" style={{ padding: trackGap, gap: trackGap }}>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-5xl font-bold">Content</span>
                        {/* iOS-style app-icon shape (a "squircle" via a large
                          border-radius percentage) linking out to the
                          BeyondStyle TikTok — stopping propagation on
                          mousedown/up keeps this from also triggering the
                          card's own click-to-collapse, which listens on
                          window and would otherwise fire from the bubbled
                          event. The three layered copies of the same glyph,
                          offset and tinted cyan/pink under a plain white
                          one, are the standard way to reproduce TikTok's
                          own glitch-color logo treatment. */}
                      <a
                        href="https://www.tiktok.com/@beyondstyle.us"
                        target="_blank"
                        rel="noopener noreferrer"
                        onMouseDown={(e) => e.stopPropagation()}
                        onMouseUp={(e) => e.stopPropagation()}
                        aria-label="BeyondStyle on TikTok"
                        className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden"
                        style={{ borderRadius: "22%", backgroundColor: "#000" }}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          width="24"
                          height="24"
                          style={{ position: "absolute", transform: "translate(-1.2px, -1.2px)" }}
                        >
                          <path
                            fill="#25F4EE"
                            d="M16.6 5.82s.51.5 0 0A4.278 4.278 0 0 1 15.54 3h-3.09v12.4a2.592 2.592 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6c0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64c0 3.33 2.76 5.7 5.69 5.7c3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.24-1.48Z"
                          />
                        </svg>
                        <svg
                          viewBox="0 0 24 24"
                          width="24"
                          height="24"
                          style={{ position: "absolute", transform: "translate(1.2px, 1.2px)" }}
                        >
                          <path
                            fill="#FE2C55"
                            d="M16.6 5.82s.51.5 0 0A4.278 4.278 0 0 1 15.54 3h-3.09v12.4a2.592 2.592 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6c0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64c0 3.33 2.76 5.7 5.69 5.7c3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.24-1.48Z"
                          />
                        </svg>
                        <svg viewBox="0 0 24 24" width="24" height="24" style={{ position: "relative" }}>
                          <path
                            fill="#fff"
                            d="M16.6 5.82s.51.5 0 0A4.278 4.278 0 0 1 15.54 3h-3.09v12.4a2.592 2.592 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6c0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64c0 3.33 2.76 5.7 5.69 5.7c3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.24-1.48Z"
                          />
                        </svg>
                      </a>
                      </div>
                      {/* Four iMessage-style photo decks standing in for
                          the real gallery this panel will eventually
                          rotate through — a single row, scrolling
                          horizontally exactly like the colored boxes in
                          the main track (same overflow-x-auto/
                          overflow-y-hidden pattern), so it just keeps
                          growing sideways as more get added rather than
                          trying to force everything into the panel's own
                          height. min-h-0 is what lets a flex child
                          actually shrink to the space it's given instead
                          of growing to fit its content. Each deck is
                          pinned to the images' own 3:4 aspect ratio (via
                          height, since width is now the free axis) so
                          object-contain fills it exactly. */}
                      <div
                        className="no-scrollbar flex min-h-0 flex-1 overflow-x-auto overflow-y-hidden overscroll-x-none"
                        // The wrapper's padding insets this row from the
                        // panel's border, and a scroll container clips at
                        // its own edge — so scrolled decks were being cut
                        // along that invisible inset line. Negative margins
                        // stretch the row out to the border, and the same
                        // amount of padding puts the resting position back.
                        style={{
                          gap: trackGap + 12,
                          marginLeft: -trackGap,
                          marginRight: -trackGap,
                          paddingLeft: trackGap,
                          paddingRight: trackGap,
                        }}
                      >
                        {CAROUSEL_DECKS.map((deck, i) => (
                          <PhotoDeck
                            key={deck.name}
                            images={deck.images}
                            current={deckIndex[i]}
                            onAdvance={() => advanceDeck(i)}
                            borderColor={borderOnBg}
                            layer={CAROUSEL_DECKS.length - i}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div
                    className="relative min-h-0 flex-1 overflow-hidden rounded-2xl"
                    style={{ border: `3px solid ${borderOnBg}` }}
                  >
                    <div className="flex h-full flex-col" style={{ padding: trackGap, gap: trackGap }}>
                      <div className="flex shrink-0 items-center justify-end">
                        <span className="text-5xl font-bold">GEO</span>
                      </div>
                      {/* Article previews: a cover, the title and the
                          publication label, opening the full piece in a new
                          tab. Same single-row, hidden-scrollbar,
                          clipped-at-the-border setup as the Content decks
                          so the two halves read as one system. */}
                      <div
                        className="no-scrollbar flex min-h-0 flex-1 overflow-x-auto overflow-y-hidden overscroll-x-none"
                        style={{
                          gap: trackGap + 12,
                          marginLeft: -trackGap,
                          marginRight: -trackGap,
                          paddingLeft: trackGap,
                          paddingRight: trackGap,
                        }}
                      >
                        {GEO_ARTICLES.map((article) => (
                          <a
                            key={article.href}
                            href={article.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            onMouseDown={(e) => e.stopPropagation()}
                            onMouseUp={(e) => e.stopPropagation()}
                            className="relative block h-full shrink-0 overflow-hidden rounded-xl text-white"
                            style={{ aspectRatio: "3 / 4", border: `3px solid ${borderOnBg}` }}
                          >
                            <Image src={article.cover} alt="" fill className="object-cover" />
                            <div
                              className="absolute inset-x-0 bottom-0 flex flex-col gap-1 px-4 pt-16 pb-4"
                              style={{ background: "linear-gradient(to top, rgba(0,0,0,0.82), rgba(0,0,0,0))" }}
                            >
                              <span className="text-[11px] font-semibold tracking-[0.14em] uppercase opacity-80">
                                The Closet
                              </span>
                              <span className="text-lg leading-snug font-bold">{article.title}</span>
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <Image
                  src={isDark ? "/borderx-logo-white.png" : "/borderx-logo-black.png"}
                  alt="BorderX Lab logo"
                  width={144}
                  height={144}
                  className="h-[72px] w-[72px] object-contain"
                  style={{ filter: pastelIconShadow, ...unstretch(2) }}
                />
              )}
            </div>
            {expandedIndex !== 2 && (
              <div className="flex flex-col gap-1">
                <span className="text-[22px] font-bold" style={unstretch(2)}>
                  BorderX Lab — BeyondStyle
                </span>
                <span className="text-sm" style={unstretch(2)}>
                  Content Strategy &amp; GEO
                </span>
              </div>
            )}
          </ExpandableCard>
        </div>

        <div className="my-4 shrink-0" style={slotStyle(420, 3)}>
          <ExpandableCard
            index={3}
            className={`${cardBox} justify-between gap-6`}
            style={{ borderColor: borderOnBg, backgroundColor: pastelGreen, color: fg, textShadow: pastelTextShadow, ...getExpandStyle(3) }}
          >
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
              {expandedIndex === 3 && expandSettled ? (
                // The process as a stack you flip through, with the current
                // stage's title and caption beside it and a row of dots
                // (also clickable) showing how far along it is.
                <div className="flex h-full w-full items-stretch" style={{ gap: trackGap + 28, paddingTop: 32 }}>
                  <PhotoDeck
                    images={LIMITUS_STEPS.map((step) => step.src)}
                    current={limitusStep}
                    onAdvance={() => setLimitusStep((v) => (v + 1) % LIMITUS_STEPS.length)}
                    borderColor={borderOnBg}
                    layer={1}
                    aspect="4 / 5"
                    fit="contain"
                    background="#ffffff"
                  />
                  <div className="flex min-w-0 flex-1 flex-col justify-between py-2">
                    <div className="flex flex-col gap-2">
                      <span className="text-5xl font-bold">Limitus</span>
                      <span className="text-base">A wrist brace for TFCC tears — five prototypes in five months.</span>
                    </div>
                    <div className="flex flex-col gap-3">
                      <span className="text-xs font-semibold tracking-[0.14em] uppercase opacity-70">
                        Step {limitusStep + 1} of {LIMITUS_STEPS.length}
                      </span>
                      <span className="text-3xl leading-tight font-bold">{LIMITUS_STEPS[limitusStep].title}</span>
                      <span className="text-lg leading-snug">{LIMITUS_STEPS[limitusStep].caption}</span>
                      <div className="mt-2 flex gap-2">
                        {LIMITUS_STEPS.map((step, i) => (
                          <button
                            key={step.src}
                            type="button"
                            aria-label={`Go to step ${i + 1}: ${step.title}`}
                            onMouseDown={(e) => e.stopPropagation()}
                            onMouseUp={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              setLimitusStep(i);
                            }}
                            className="h-2.5 rounded-full transition-all duration-300"
                            style={{
                              width: i === limitusStep ? 28 : 10,
                              backgroundColor: fg,
                              opacity: i === limitusStep ? 1 : 0.3,
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <Image
                  src={isDark ? "/limitus/logo-white.svg" : "/limitus/logo-black.svg"}
                  alt="Limitus logo"
                  width={144}
                  height={144}
                  unoptimized
                  className="h-[72px] w-[72px] object-contain"
                  style={{ filter: pastelIconShadow, ...unstretch(3) }}
                />
              )}
            </div>
            {expandedIndex !== 3 && (
              <div className="flex flex-col gap-1">
                <span className="text-[22px] font-bold" style={unstretch(3)}>
                  Limitus
                </span>
                <span className="text-sm" style={unstretch(3)}>
                  Medical Device Design
                </span>
              </div>
            )}
          </ExpandableCard>
        </div>

        <div className="my-4 shrink-0" style={slotStyle(420, 4)}>
          <ExpandableCard
            index={4}
            className={`${cardBox} justify-between gap-6`}
            style={{ borderColor: borderOnBg, backgroundColor: pastelOlive, color: fg, textShadow: pastelTextShadow, ...getExpandStyle(4) }}
          >
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
              {expandedIndex === 4 && expandSettled ? (
                <SolsticeSun fg={fg} borderColor={borderOnBg} gap={trackGap + 28} />
              ) : (
                <span className="text-[13px]" style={unstretch(4)}>
                  [ UCLA AUD summer pavilion ]
                </span>
              )}
            </div>
            {expandedIndex !== 4 && (
              <div className="flex flex-col gap-1">
                <span className="text-[22px] font-bold" style={unstretch(4)}>
                  Solstice
                </span>
                <span className="text-sm" style={unstretch(4)}>
                  Architecture
                </span>
              </div>
            )}
          </ExpandableCard>
        </div>

        <div className="my-4 shrink-0" style={slotStyle(420, 5)}>
          <ExpandableCard
            index={5}
            className={`${cardBox} justify-between gap-6`}
            style={{ borderColor: borderOnBg, backgroundColor: pastelPeriwinkle, color: fg, textShadow: pastelTextShadow, ...getExpandStyle(5) }}
          >
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
              {expandedIndex === 5 && expandSettled ? (
                <GlodeskTour fg={fg} borderColor={borderOnBg} gap={trackGap + 28} />
              ) : (
                <span className="text-[13px]" style={unstretch(5)}>
                  [ Adjustable smart desk concept ]
                </span>
              )}
            </div>
            {expandedIndex !== 5 && (
              <div className="flex flex-col gap-1">
                <span className="text-[22px] font-bold" style={unstretch(5)}>
                  Glodesk
                </span>
                <span className="text-sm" style={unstretch(5)}>
                  Product Design
                </span>
              </div>
            )}
          </ExpandableCard>
        </div>

        <div className="my-4 shrink-0" style={slotStyle(420, 6)}>
          <ExpandableCard
            index={6}
            className={`${cardBox} justify-center gap-4`}
            style={{ borderColor: borderOnBg, backgroundColor: pastelOrange, color: fg, textShadow: pastelTextShadow, ...getExpandStyle(6) }}
          >
            <span className="text-[22px] font-bold" style={unstretch(6)}>
              About
            </span>
            <p className="m-0 text-[15px] leading-relaxed" style={unstretch(6)}>
              Product designer &amp; content strategist, currently splitting time between Rising Team and BorderX Lab&apos;s BeyondStyle.
            </p>
            <span className="text-[13px]" style={unstretch(6)}>
              [ Full bio coming soon ]
            </span>
          </ExpandableCard>
        </div>

        <div className="my-4 shrink-0" style={slotStyle(380, 7)}>
          <ExpandableCard
            index={7}
            className={`${cardBox} justify-center gap-4`}
            style={{ borderColor: borderOnBg, backgroundColor: pastelPink, color: fg, textShadow: pastelTextShadow, ...getExpandStyle(7) }}
          >
            <span className="text-[22px] font-bold" style={unstretch(7)}>
              Let&apos;s Talk
            </span>
            <a
              href="#"
              className="text-base font-medium underline underline-offset-4"
              style={{ color: fg, ...unstretch(7) }}
            >
              [ Your email ]
            </a>
          </ExpandableCard>
        </div>
      </div>

      {/* Invisible click-catcher covering everything else while a card is
          expanded — sits above the toggle chrome and the (now-gapped)
          track, below the expanded card itself. Clicking it collapses, same
          as clicking the expanded card again or pressing Escape. No visual
          dimming; it's purely there to make an outside click mean
          "collapse" instead of falling through to whatever's underneath. */}
      <div
        aria-hidden={expandedIndex === null}
        onClick={collapseExpanded}
        className="fixed inset-0 z-40"
        style={{
          pointerEvents: expandedIndex !== null ? "auto" : "none",
        }}
      />

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
