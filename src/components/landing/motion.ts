import { useEffect, useRef, useState, type PointerEvent, type RefObject } from "react";

// Every hook starts from the same value on the server and the client so the
// prerendered home page hydrates cleanly; motion begins only after mount.

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

/** True while the element is on screen. `once` keeps it true after the first sighting. */
export function useInView<T extends Element>(options: { once?: boolean; rootMargin?: string } = {}): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  const { once = false, rootMargin = "0px" } = options;
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      setInView(entry.isIntersecting);
      if (entry.isIntersecting && once) observer.disconnect();
    }, { rootMargin });
    observer.observe(node);
    return () => observer.disconnect();
  }, [once, rootMargin]);
  return [ref, inView];
}

/** Feeds the pointer position to `.ax-spotlight` as --mx/--my. */
export function trackSpotlight(event: PointerEvent<HTMLElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  event.currentTarget.style.setProperty("--mx", `${event.clientX - rect.left}px`);
  event.currentTarget.style.setProperty("--my", `${event.clientY - rect.top}px`);
}

/** Feeds a small 3D tilt to `.ax-tilt` as --rx/--ry. Mouse only. */
export function trackTilt(event: PointerEvent<HTMLElement>, strength = 6) {
  if (event.pointerType !== "mouse") return;
  const rect = event.currentTarget.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width - 0.5;
  const y = (event.clientY - rect.top) / rect.height - 0.5;
  event.currentTarget.style.setProperty("--rx", `${(-y * strength).toFixed(2)}deg`);
  event.currentTarget.style.setProperty("--ry", `${(x * strength).toFixed(2)}deg`);
}

export function resetTilt(event: PointerEvent<HTMLElement>) {
  event.currentTarget.style.setProperty("--rx", "0deg");
  event.currentTarget.style.setProperty("--ry", "0deg");
}

/** Eases a number toward `target` for counters that should roll rather than jump. */
export function useTweenedNumber(target: number, duration = 450) {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = performance.now();
    const origin = from.current;
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = origin + (target - origin) * eased;
      from.current = next;
      setValue(next);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
}
