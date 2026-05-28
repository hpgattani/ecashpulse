import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

interface ScratchCardProps {
  team: string;
  label?: string;
  onRevealed?: () => void;
}

export function ScratchCard({ team, label, onRevealed }: ScratchCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);
  const isDrawing = useRef(false);
  const revealedRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // Silver/gold gradient cover
    const grad = ctx.createLinearGradient(0, 0, rect.width, rect.height);
    grad.addColorStop(0, '#9ca3af');
    grad.addColorStop(0.5, '#d1d5db');
    grad.addColorStop(1, '#6b7280');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Hint text
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✨ Scratch to reveal ✨', rect.width / 2, rect.height / 2);

    ctx.globalCompositeOperation = 'destination-out';
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      const t = e.touches[0] || e.changedTouches[0];
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const scratch = (x: number, y: number) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fill();
    checkRevealed();
  };

  const checkRevealed = () => {
    if (revealedRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { width, height } = canvas;
    // Sample sparsely
    const img = ctx.getImageData(0, 0, width, height).data;
    let clear = 0;
    let total = 0;
    for (let i = 3; i < img.length; i += 4 * 80) {
      total++;
      if (img[i] === 0) clear++;
    }
    if (clear / total > 0.45) {
      revealedRef.current = true;
      setRevealed(true);
      // fade-out the cover
      canvas.style.transition = 'opacity 400ms ease';
      canvas.style.opacity = '0';
      onRevealed?.();
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-28 rounded-xl overflow-hidden border border-amber-500/40 bg-gradient-to-br from-amber-500/15 via-yellow-500/10 to-amber-600/15 select-none"
    >
      {/* Underlying reveal content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-3 text-center">
        {label && <span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</span>}
        <motion.div
          initial={false}
          animate={revealed ? { scale: [0.9, 1.08, 1] } : { scale: 1 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-2"
        >
          {revealed && <Sparkles className="w-4 h-4 text-amber-400" />}
          <h3 className="font-display text-xl font-bold text-foreground leading-tight">{team}</h3>
          {revealed && <Sparkles className="w-4 h-4 text-amber-400" />}
        </motion.div>
      </div>

      {/* Scratch canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full cursor-pointer touch-none"
        onMouseDown={(e) => { isDrawing.current = true; const p = getPos(e); scratch(p.x, p.y); }}
        onMouseMove={(e) => { if (!isDrawing.current) return; const p = getPos(e); scratch(p.x, p.y); }}
        onMouseUp={() => { isDrawing.current = false; }}
        onMouseLeave={() => { isDrawing.current = false; }}
        onTouchStart={(e) => { isDrawing.current = true; const p = getPos(e); scratch(p.x, p.y); }}
        onTouchMove={(e) => { e.preventDefault(); const p = getPos(e); scratch(p.x, p.y); }}
        onTouchEnd={() => { isDrawing.current = false; }}
      />
    </div>
  );
}
