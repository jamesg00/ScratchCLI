import { useEffect, useRef } from "react";

type Star = {
  x: number;
  y: number;
  r: number;
  speedX: number;
  speedY: number;
  alpha: number;
  twinkle: number;
};

export function CometStars() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frame = 0;
    let running = true;
    let stars: Star[] = [];
    let width = 0;
    let height = 0;

    const spawnStar = (fromEdge = false): Star => {
      const edge = Math.floor(Math.random() * 4);
      const base = {
        r: 0.45 + Math.random() * 1.35,
        speedX: -0.04 - Math.random() * 0.22,
        speedY: -0.01 - Math.random() * 0.08,
        alpha: 0.35 + Math.random() * 0.65,
        twinkle: Math.random() * Math.PI * 2,
      };
      if (!fromEdge) {
        return {
          ...base,
          x: Math.random() * width,
          y: Math.random() * height,
        };
      }
      if (edge === 0)
        return { ...base, x: width + 12, y: Math.random() * height };
      if (edge === 1)
        return { ...base, x: Math.random() * width, y: height + 12 };
      if (edge === 2) return { ...base, x: -12, y: Math.random() * height };
      return { ...base, x: Math.random() * width, y: -12 };
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.max(90, Math.floor((width * height) / 14000));
      stars = Array.from({ length: count }, () => spawnStar(false));
    };

    const draw = () => {
      if (!running) return;
      frame = window.requestAnimationFrame(draw);
      ctx.clearRect(0, 0, width, height);

      for (const star of stars) {
        star.x += star.speedX;
        star.y += star.speedY;
        star.twinkle += 0.02 + star.r * 0.003;

        if (
          star.x < -18 ||
          star.y < -18 ||
          star.x > width + 18 ||
          star.y > height + 18
        ) {
          Object.assign(star, spawnStar(true));
        }

        const pulse = 0.78 + (Math.sin(star.twinkle) + 1) * 0.18;
        const alpha = Math.min(1, star.alpha * pulse);
        ctx.beginPath();
        ctx.fillStyle = `rgba(235, 245, 255, ${alpha})`;
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fill();

        if (star.r > 1.15) {
          ctx.beginPath();
          ctx.fillStyle = `rgba(120, 190, 255, ${alpha * 0.22})`;
          ctx.arc(star.x, star.y, star.r * 2.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    resize();
    frame = window.requestAnimationFrame(draw);
    window.addEventListener("resize", resize);

    return () => {
      running = false;
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="comet-stars" aria-hidden="true" />;
}
