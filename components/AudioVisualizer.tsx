import React, { useEffect, useRef } from 'react';
import { useLive } from '../hooks/useLive';

const AudioVisualizer: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { volume, isConnected } = useLive();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      // Base circle
      ctx.beginPath();
      ctx.arc(centerX, centerY, 30, 0, 2 * Math.PI);
      ctx.fillStyle = isConnected ? '#3b82f6' : '#52525b';
      ctx.fill();

      if (isConnected) {
        // Pulse effect based on volume
        // Volume is 0-1 (approx)
        // We want a ripple effect
        const radius = 30 + (volume * 50); // Scale up to 80px

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.strokeStyle = `rgba(59, 130, 246, ${Math.max(0, 0.8 - volume)})`; // Fade out as it gets bigger
        ctx.lineWidth = 2;
        ctx.stroke();

        // Second ripple
        const radius2 = 30 + (volume * 30);
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius2, 0, 2 * Math.PI);
        ctx.strokeStyle = `rgba(168, 85, 247, ${Math.max(0, 0.6 - volume)})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [volume, isConnected]);

  return (
    <div className="flex justify-center items-center p-4">
      <canvas
        ref={canvasRef}
        width={200}
        height={150}
        className="w-[200px] h-[150px]"
      />
    </div>
  );
};

export default AudioVisualizer;