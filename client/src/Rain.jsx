import { useEffect, useRef } from 'react';

// Falling binary background. Decorative only; static when the user prefers reduced motion.
export default function Rain({ dim }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current, x = c.getContext('2d'), size = 16;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let drops = [], raf, frame = 0;
    const fit = () => {
      c.width = innerWidth; c.height = innerHeight;
      drops = Array.from({ length: Math.ceil(c.width / size) }, () => Math.floor(Math.random() * c.height / size));
      x.fillStyle = '#050a07'; x.fillRect(0, 0, c.width, c.height);
    };
    const step = () => {
      x.fillStyle = 'rgba(5,10,7,0.09)'; x.fillRect(0, 0, c.width, c.height);
      x.font = `${size}px monospace`;
      drops.forEach((d, i) => {
        x.fillStyle = Math.random() < 0.04 ? '#d6ffe6' : '#2fd978';
        x.fillText(Math.random() < 0.5 ? '0' : '1', i * size, d * size);
        drops[i] = d * size > c.height && Math.random() > 0.97 ? 0 : d + 1;
      });
    };
    const loop = () => { if (++frame % 3 === 0) step(); raf = requestAnimationFrame(loop); };
    fit();
    if (reduce) for (let i = 0; i < 140; i++) step(); else loop();
    addEventListener('resize', fit);
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', fit); };
  }, []);
  return <canvas ref={ref} className={'rain' + (dim ? ' dim' : '')} aria-hidden="true" />;
}
