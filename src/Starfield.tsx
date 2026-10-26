import { useEffect, useRef } from 'react';

export default function Starfield({ bright = false }: { bright?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const ctx = element.getContext('2d');
    if (!ctx) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0, width = 0, height = 0;
    const stars = Array.from({ length: bright ? 120 : 85 }, (_, i) => ({
      x: ((i * 137 + 31) % 997) / 997, y: ((i * 211 + 57) % 991) / 991,
      size: i % 13 === 0 ? 1.9 : .6 + (i % 4) * .23, speed: 1 + (i % 5) * .45, phase: i * 1.7,
    }));
    function draw(now: number) {
      if (!ctx || !element) return;
      const time = reduced.matches ? 0 : now / 1000;
      ctx.clearRect(0, 0, width, height);
      for (const star of stars) {
        const x = (star.x * width + time * star.speed * 2) % width;
        const y = (star.y * height + time * star.speed * .7) % height;
        ctx.globalAlpha = (bright ? .48 : .3) + .22 * Math.sin(time * .8 + star.phase);
        ctx.fillStyle = star.size > 1.5 ? '#e4ca90' : '#b4d2d4';
        ctx.beginPath(); ctx.arc(x, y, star.size, 0, Math.PI * 2); ctx.fill();
        if (star.size > 1.5) {
          ctx.fillRect(x - 4, y - .4, 8, .8); ctx.fillRect(x - .4, y - 4, .8, 8);
        }
      }
      if (!reduced.matches) {
        const phase = (time % 13) / 1.8;
        if (phase < 1) {
          const x = width * (.15 + phase * .6), y = height * (.12 + phase * .3);
          const trail = ctx.createLinearGradient(x - 75, y - 38, x, y);
          trail.addColorStop(0, 'transparent'); trail.addColorStop(1, '#e6dbb5');
          ctx.globalAlpha = Math.sin(phase * Math.PI) * .65; ctx.strokeStyle = trail; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(x - 75, y - 38); ctx.lineTo(x, y); ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      if (!reduced.matches && !document.hidden) frame = requestAnimationFrame(draw);
    }
    function restart() { cancelAnimationFrame(frame); draw(performance.now()); }
    const resize = new ResizeObserver(() => {
      const rect = element.getBoundingClientRect(); width = rect.width; height = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      element.width = Math.round(width * dpr); element.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); restart();
    });
    resize.observe(element);
    reduced.addEventListener('change', restart);
    document.addEventListener('visibilitychange', restart);
    return () => { cancelAnimationFrame(frame); resize.disconnect(); reduced.removeEventListener('change', restart); document.removeEventListener('visibilitychange', restart); };
  }, [bright]);
  return <canvas ref={canvas} className={`starfield ${bright ? 'bonus-starfield' : ''}`} aria-hidden="true" />;
}
