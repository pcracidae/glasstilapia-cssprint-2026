// The Today card stack, animated like the Figma motion study
// (project files: motion/card_dots_timer.py and card-stack-swap.mp4).
//
// Three cards sit in a fanned stack. The front card's long page dot drains;
// when it runs out, the front card swings out to the left and tucks in at
// the back while the other two move up one place. Swiping left or right, or
// tapping a dot below the stack, swaps by hand and restarts the timer.

import { useEffect, useRef, useState, type ReactNode } from "react";

type Pose = { y: number; scale: number; rot: number; sa: number; sy: number; sb: number };

// Front, middle, back. From the Figma stack frame: cards are 362px wide in a
// 402px screen; y is the drop of each card's centre in px.
const POSES: Pose[] = [
  { y: 0, scale: 1, rot: 0, sa: 0.32, sy: 8, sb: 18 },
  { y: 10, scale: 338 / 362, rot: -3, sa: 0.15, sy: 3, sb: 8 },
  { y: 20.5, scale: 314 / 362, rot: 2, sa: 0.12, sy: 3, sb: 8 },
];

const SWAP_MS = 400; // 12 frames at 30 fps, as in the motion study
const DRAIN_MS = 4000; // how long each card stays in front
const SWING_PX = 80; // how far the leaving card swings out to the left

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const mix = (a: Pose, b: Pose, t: number): Pose => ({
  y: a.y + (b.y - a.y) * t,
  scale: a.scale + (b.scale - a.scale) * t,
  rot: a.rot + (b.rot - a.rot) * t,
  sa: a.sa + (b.sa - a.sa) * t,
  sy: a.sy + (b.sy - a.sy) * t,
  sb: a.sb + (b.sb - a.sb) * t,
});

export type StackCard = {
  className: string;
  dark?: boolean; // dots in dark brown on the yellow card
  render: () => ReactNode;
};

/** Page dots inside a card. The active pill drains from `fill` 1 to 0. */
function Dots({ active, fill }: { active: number; fill: number }) {
  return (
    <span className="dots">
      {[0, 1, 2].map((i) =>
        i === active ? (
          <i key={i} className="on"><b style={{ width: `${fill * 100}%` }} /></i>
        ) : (
          <i key={i} />
        ),
      )}
    </span>
  );
}

export function CardStack({ cards }: { cards: StackCard[] }) {
  const reduced = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  // order[0] is the front card.
  const [order, setOrder] = useState([0, 1, 2]);
  const [, setTick] = useState(0);
  const anim = useRef<{ start: number; dir: 1 | -1 } | null>(null);
  const drainStart = useRef(performance.now());
  const lastFrame = useRef(performance.now());
  const held = useRef(false);
  const startX = useRef<number | null>(null);
  const queue = useRef<(1 | -1)[]>([]);

  const begin = (dir: 1 | -1) => {
    if (anim.current) {
      queue.current.push(dir);
      return;
    }
    if (reduced) {
      setOrder((o) => (dir === 1 ? [o[1], o[2], o[0]] : [o[2], o[0], o[1]]));
      drainStart.current = performance.now();
      return;
    }
    // Going back plays the forward swap in reverse, from the new order.
    if (dir === -1) setOrder((o) => [o[2], o[0], o[1]]);
    anim.current = { start: performance.now(), dir };
  };

  useEffect(() => {
    let raf = 0;
    const frame = (now: number) => {
      const a = anim.current;
      if (a && now - a.start >= SWAP_MS) {
        anim.current = null;
        if (a.dir === 1) setOrder((o) => [o[1], o[2], o[0]]);
        drainStart.current = now;
        const next = queue.current.shift();
        if (next) begin(next);
      }
      // The timer pauses while a finger is on the stack or the tab is hidden.
      if (held.current || document.hidden) drainStart.current += now - lastFrame.current;
      lastFrame.current = now;
      if (!anim.current && !reduced && now - drainStart.current >= DRAIN_MS) begin(1);
      setTick((n) => (n + 1) % 1e6);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const now = performance.now();
  const a = anim.current;
  const raw = a ? Math.min(1, (now - a.start) / SWAP_MS) : null;
  const t = raw === null ? null : ease(a!.dir === 1 ? raw : 1 - raw);
  const drain = Math.max(0, 1 - (now - drainStart.current) / DRAIN_MS);

  // Pose, sideways swing and stacking for each slot in the current order.
  const slots = order.map((card, slot) => {
    if (t === null) return { card, pose: POSES[slot], dx: 0, z: 3 - slot, fill: slot === 0 ? (reduced ? 1 : drain) : 1 };
    if (slot === 0) {
      return { card, pose: mix(POSES[0], POSES[2], t), dx: -Math.sin(Math.PI * t) * SWING_PX, z: t < 0.5 ? 3 : 0, fill: 0 };
    }
    return { card, pose: mix(POSES[slot], POSES[slot - 1], t), dx: 0, z: 3 - slot, fill: 1 };
  });
  const front = t !== null && t >= 0.5 ? order[1] : order[0];

  const goTo = (target: number) => {
    const steps = (order.indexOf(target) + 3) % 3;
    if (steps === 1) begin(1);
    else if (steps === 2) begin(-1);
  };

  return (
    <div className="hero-wrap">
      <div
        className="card-stack"
        onPointerDown={(e) => { held.current = true; startX.current = e.clientX; }}
        onPointerUp={(e) => {
          held.current = false;
          if (startX.current === null) return;
          const dx = e.clientX - startX.current;
          startX.current = null;
          if (dx < -40) begin(1);
          else if (dx > 40) begin(-1);
        }}
        onPointerLeave={() => { held.current = false; startX.current = null; }}
        onPointerCancel={() => { held.current = false; startX.current = null; }}
      >
        {slots.map(({ card, pose, dx, z, fill }) => (
          <div
            key={card}
            className={`hero ${cards[card].className}`}
            aria-hidden={card !== front}
            style={{
              zIndex: z,
              transform: `translateX(${dx}px) translateY(${pose.y}px) rotate(${pose.rot}deg) scale(${pose.scale})`,
              boxShadow: `0 ${pose.sy}px ${pose.sb * 2}px rgba(0, 0, 0, ${pose.sa})`,
              pointerEvents: card === front && t === null ? "auto" : "none",
            }}
          >
            <Dots active={card} fill={fill} />
            {cards[card].render()}
          </div>
        ))}
      </div>
      <div className="stack-dots" role="tablist">
        {[0, 1, 2].map((i) => (
          <button key={i} role="tab" aria-selected={i === front} aria-label={`Card ${i + 1}`} className={i === front ? "on" : ""} onClick={() => goTo(i)} />
        ))}
      </div>
    </div>
  );
}
