import React, { useEffect, useRef } from 'react';

export const AuthCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let animId: number;
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    const paint = () => {
      const r = cv.getBoundingClientRect();
      if (cv.width !== Math.round(r.width) || cv.height !== Math.round(r.height)) {
        cv.width = Math.round(r.width);
        cv.height = Math.round(r.height);
      }
      ctx.clearRect(0, 0, r.width, r.height);

      ctx.strokeStyle = 'rgba(255,255,255,.055)';
      ctx.lineWidth = 1;
      for (let x = 0; x < r.width; x += 46) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, r.height);
        ctx.stroke();
      }
      for (let y = 0; y < r.height; y += 46) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(r.width, y);
        ctx.stroke();
      }

      ctx.strokeStyle = 'rgba(31,157,98,.28)';
      ctx.lineWidth = 9;
      ctx.lineCap = 'round';
      const seg = [
        [0.1, 0.25, 0.75, 0.25],
        [0.46, 0.05, 0.46, 0.95],
        [0.2, 0.72, 0.9, 0.72],
      ];
      seg.forEach((s) => {
        ctx.beginPath();
        ctx.moveTo(s[0] * r.width, s[1] * r.height);
        ctx.lineTo(s[2] * r.width, s[3] * r.height);
        ctx.stroke();
      });

      const tt = performance.now() / 1000;
      seg.forEach((s, i) => {
        const fr = (tt * 0.22 + i * 0.31) % 1;
        ctx.beginPath();
        ctx.arc(
          s[0] * r.width + (s[2] - s[0]) * r.width * fr,
          s[1] * r.height + (s[3] - s[1]) * r.height * fr,
          5,
          0,
          Math.PI * 2
        );
        ctx.fillStyle = '#1F9D62';
        ctx.fill();
      });

      animId = requestAnimationFrame(paint);
    };

    animId = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(animId);
  }, []);

  return <canvas ref={canvasRef} id="authCanvas" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.55 }} />;
};
