'use client';

import { useEffect, useRef, useState } from 'react';

import type { SamSegmentResult } from '../../ai/types';
import { segmentColor } from './format';

type Props = {
  src: string;
  alt: string;
  segments: SamSegmentResult[];
  showBoxes: boolean;
  showMasks: boolean;
  className?: string;
  imageTestId?: string;
  canvasTestId?: string;
};

function loadMask(dataUrl: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

/**
 * Photo with a canvas overlay that stays aligned to the rendered image (boxes use
 * normalized 0-1 coordinates from the masks endpoint, mask PNGs are box-sized).
 */
export function AnnotatedPhoto({
  src,
  alt,
  segments,
  showBoxes,
  showMasks,
  className = '',
  imageTestId,
  canvasTestId,
}: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [masks, setMasks] = useState<Record<string, HTMLImageElement | null>>({});

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const update = () => setSize({ width: img.clientWidth, height: img.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(img);
    return () => observer.disconnect();
  }, [src]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next: Record<string, HTMLImageElement | null> = {};
      for (const segment of segments) {
        if (segment.maskPng) next[segment.id] = await loadMask(segment.maskPng);
      }
      if (!cancelled) setMasks(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [segments]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.width === 0 || size.height === 0) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(size.width * ratio);
    canvas.height = Math.round(size.height * ratio);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, size.width, size.height);

    segments.forEach((segment, index) => {
      const color = segmentColor(index);
      const x = segment.box.x * size.width;
      const y = segment.box.y * size.height;
      const w = segment.box.w * size.width;
      const h = segment.box.h * size.height;
      const mask = masks[segment.id];
      if (showMasks && mask && w > 0 && h > 0) {
        const tint = document.createElement('canvas');
        tint.width = Math.max(1, Math.ceil(w));
        tint.height = Math.max(1, Math.ceil(h));
        const tctx = tint.getContext('2d');
        if (tctx) {
          tctx.drawImage(mask, 0, 0, tint.width, tint.height);
          tctx.globalCompositeOperation = 'source-in';
          tctx.fillStyle = color;
          tctx.fillRect(0, 0, tint.width, tint.height);
          ctx.save();
          ctx.globalAlpha = 0.55;
          ctx.drawImage(tint, x, y, w, h);
          ctx.restore();
        }
      }
    });

    if (showBoxes) {
      ctx.font = '600 12px system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      segments.forEach((segment, index) => {
        const color = segmentColor(index);
        const x = segment.box.x * size.width;
        const y = segment.box.y * size.height;
        const w = segment.box.w * size.width;
        const h = segment.box.h * size.height;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);
        const label =
          segment.confidence !== null && segment.confidence !== undefined
            ? `${segment.concept} ${Math.round(segment.confidence * 100)}%`
            : segment.concept;
        const textWidth = ctx.measureText(label).width + 10;
        const labelY = y >= 20 ? y - 20 : y;
        ctx.fillStyle = color;
        ctx.fillRect(x, labelY, textWidth, 20);
        ctx.fillStyle = '#fff';
        ctx.fillText(label, x + 5, labelY + 10);
      });
    }
  }, [segments, masks, showBoxes, showMasks, size]);

  return (
    <div className={`cd2-photo ${className}`.trim()}>
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        className="cd2-photo__img"
        data-testid={imageTestId}
        onLoad={(event) =>
          setSize({
            width: event.currentTarget.clientWidth,
            height: event.currentTarget.clientHeight,
          })
        }
      />
      {segments.length > 0 ? (
        <canvas
          ref={canvasRef}
          className="cd2-photo__overlay"
          style={{ width: size.width, height: size.height }}
          aria-hidden="true"
          data-testid={canvasTestId}
        />
      ) : null}
    </div>
  );
}
