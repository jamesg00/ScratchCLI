import { useEffect, useRef } from "react";

const GLYPHS = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789<>*+|:=";

type Drop = {
  x: number;
  y: number;
  speed: number;
  length: number;
};

export function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frame = 0;
    let drops: Drop[] = [];
    let cell = 16;
    let running = true;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = window.innerWidth;
      const height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cell = Math.max(14, Math.round(width / 70));
      const columns = Math.ceil(width / cell) + 1;
      drops = Array.from({ length: columns }, (_, index) => ({
        x: index * cell,
        y: Math.random() * height,
        speed: 0.6 + Math.random() * 1.8,
        length: 8 + Math.floor(Math.random() * 18),
      }));
    };

    const draw = () => {
      if (!running) return;
      frame = window.requestAnimationFrame(draw);
      const width = window.innerWidth;
      const height = window.innerHeight;
      ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
      ctx.fillRect(0, 0, width, height);
      ctx.font = `${cell}px "Cascadia Code", "Consolas", monospace`;

      for (const drop of drops) {
        for (let i = 0; i < drop.length; i += 1) {
          const gy = drop.y - i * cell;
          if (gy < -cell || gy > height + cell) continue;
          const ch = GLYPHS[Math.floor(Math.random() * GLYPHS.length)] ?? "0";
          const alpha = Math.max(0.12, 1 - i / drop.length);
          ctx.fillStyle =
            i === 0
              ? `rgba(180, 255, 200, ${alpha})`
              : `rgba(40, 220, 90, ${alpha * 0.85})`;
          ctx.fillText(ch, drop.x, gy);
        }
        drop.y += drop.speed * cell * 0.18;
        if (drop.y - drop.length * cell > height) {
          drop.y = -Math.random() * height * 0.3;
          drop.speed = 0.6 + Math.random() * 1.8;
          drop.length = 8 + Math.floor(Math.random() * 18);
        }
      }
    };

    resize();
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
    frame = window.requestAnimationFrame(draw);
    window.addEventListener("resize", resize);

    return () => {
      running = false;
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="matrix-rain" aria-hidden="true" />;
}
