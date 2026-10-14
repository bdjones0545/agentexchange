import { useEffect, useRef } from "react";

type Node = { x: number; y: number; vx: number; vy: number; r: number; agent: boolean };
type Packet = { from: number; to: number; t: number; speed: number };

const LINK_DISTANCE = 150;
const POINTER_RADIUS = 180;

/**
 * Decorative background: agents (mint) and owners (pale) drifting, linked when
 * close, with work packets travelling along the links. Pauses off screen, in
 * hidden tabs and for reduced motion (one still frame is drawn instead).
 */
export function NetworkCanvas({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 0;
    let height = 0;
    let nodes: Node[] = [];
    let packets: Packet[] = [];
    let frame = 0;
    let running = false;
    let visible = true;
    const pointer = { x: -9999, y: -9999 };

    const seed = () => {
      const count = Math.min(78, Math.max(26, Math.round((width * height) / 15000)));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.28,
        vy: (Math.random() - 0.5) * 0.28,
        r: 1.2 + Math.random() * 1.8,
        agent: Math.random() < 0.42,
      }));
      packets = [];
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const previous = { width, height };
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      // Keep the constellation through small resizes (mobile toolbars); only reseed when empty.
      if (nodes.length && previous.width && previous.height) {
        for (const n of nodes) {
          n.x *= width / previous.width;
          n.y *= height / previous.height;
        }
      } else seed();
      if (!running) draw();
    };

    const spawnPacket = () => {
      const from = Math.floor(Math.random() * nodes.length);
      const a = nodes[from];
      let best = -1;
      let bestDistance = Infinity;
      nodes.forEach((b, index) => {
        if (index === from) return;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < LINK_DISTANCE && d > 40 && d < bestDistance && Math.random() < 0.7) {
          best = index;
          bestDistance = d;
        }
      });
      if (best >= 0) packets.push({ from, to: best, t: 0, speed: 0.008 + Math.random() * 0.01 });
    };

    const draw = () => {
      context.clearRect(0, 0, width, height);

      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const a = nodes[i];
          const b = nodes[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d > LINK_DISTANCE) continue;
          const alpha = (1 - d / LINK_DISTANCE) * 0.22;
          context.strokeStyle = `rgba(120, 240, 188, ${alpha})`;
          context.lineWidth = 1;
          context.beginPath();
          context.moveTo(a.x, a.y);
          context.lineTo(b.x, b.y);
          context.stroke();
        }
        const n = nodes[i];
        const toPointer = Math.hypot(n.x - pointer.x, n.y - pointer.y);
        if (toPointer < POINTER_RADIUS) {
          context.strokeStyle = `rgba(103, 232, 249, ${(1 - toPointer / POINTER_RADIUS) * 0.35})`;
          context.beginPath();
          context.moveTo(n.x, n.y);
          context.lineTo(pointer.x, pointer.y);
          context.stroke();
        }
      }

      for (const packet of packets) {
        const a = nodes[packet.from];
        const b = nodes[packet.to];
        const x = a.x + (b.x - a.x) * packet.t;
        const y = a.y + (b.y - a.y) * packet.t;
        const glow = context.createRadialGradient(x, y, 0, x, y, 10);
        glow.addColorStop(0, "rgba(168, 246, 212, 0.9)");
        glow.addColorStop(1, "rgba(120, 240, 188, 0)");
        context.fillStyle = glow;
        context.beginPath();
        context.arc(x, y, 10, 0, Math.PI * 2);
        context.fill();
      }

      for (const n of nodes) {
        context.fillStyle = n.agent ? "rgba(120, 240, 188, 0.9)" : "rgba(237, 245, 242, 0.45)";
        context.beginPath();
        context.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        context.fill();
        if (n.agent) {
          context.strokeStyle = "rgba(120, 240, 188, 0.18)";
          context.beginPath();
          context.arc(n.x, n.y, n.r + 4, 0, Math.PI * 2);
          context.stroke();
        }
      }
    };

    const step = () => {
      for (const n of nodes) {
        const dx = n.x - pointer.x;
        const dy = n.y - pointer.y;
        const d = Math.hypot(dx, dy);
        if (d < POINTER_RADIUS && d > 0.1) {
          const push = (1 - d / POINTER_RADIUS) * 0.035;
          n.vx += (dx / d) * push;
          n.vy += (dy / d) * push;
        }
        n.vx *= 0.985;
        n.vy *= 0.985;
        const speed = Math.hypot(n.vx, n.vy);
        if (speed < 0.08) {
          n.vx += (Math.random() - 0.5) * 0.04;
          n.vy += (Math.random() - 0.5) * 0.04;
        }
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < -20) n.x = width + 20;
        if (n.x > width + 20) n.x = -20;
        if (n.y < -20) n.y = height + 20;
        if (n.y > height + 20) n.y = -20;
      }
      packets = packets.filter((packet) => {
        packet.t += packet.speed;
        return packet.t < 1 && Math.hypot(nodes[packet.from].x - nodes[packet.to].x, nodes[packet.from].y - nodes[packet.to].y) < LINK_DISTANCE * 1.2;
      });
      if (packets.length < 14 && Math.random() < 0.08) spawnPacket();
      draw();
      frame = requestAnimationFrame(step);
    };

    const start = () => {
      if (running || reduced || !visible || document.hidden) return;
      running = true;
      frame = requestAnimationFrame(step);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(frame);
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
    };
    const onPointerLeave = () => {
      pointer.x = -9999;
      pointer.y = -9999;
    };
    const onVisibility = () => (document.hidden ? stop() : start());

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
      else stop();
    });
    intersection.observe(canvas);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerleave", onPointerLeave);
    document.addEventListener("visibilitychange", onVisibility);
    resize();
    start();

    return () => {
      stop();
      resizeObserver.disconnect();
      intersection.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className={`pointer-events-none block size-full ${className}`} />;
}
