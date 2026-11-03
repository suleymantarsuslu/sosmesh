'use client';

import { useState, useRef, useEffect } from 'react';
import { useOperatorPreferences } from '../../components/operator/OperatorPreferencesProvider';
import { SparkVisionView, SamVisionView, SamSegmentResult } from './types';

type Props = {
  sparkVision: SparkVisionView | null;
  samVision: SamVisionView | null;
};

export function PhotoAnalysisCard({ sparkVision, samVision }: Props) {
  const { t } = useOperatorPreferences();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [showMasks, setShowMasks] = useState(true);
  const [showBoxes, setShowBoxes] = useState(true);
  const [imageLoaded, setImageLoaded] = useState(false);

  const attachmentId = sparkVision?.attachmentId || samVision?.attachmentId;

  useEffect(() => {
    if (!imageLoaded || !canvasRef.current || !imgRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = imgRef.current.naturalWidth;
    canvas.height = imgRef.current.naturalHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!samVision?.results || samVision.results.length === 0) return;

    samVision.results.forEach((result, idx) => {
      const color = getColor(idx);

      if (showBoxes && result.boundingBox) {
        const { x1, y1, x2, y2 } = result.boundingBox;
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

        ctx.fillStyle = color;
        ctx.font = '14px system-ui, sans-serif';
        const label = `${result.concept}${
          result.confidence ? ` (${(result.confidence * 100).toFixed(0)}%)` : ''
        }`;
        const metrics = ctx.measureText(label);
        ctx.fillRect(x1, y1 - 20, metrics.width + 8, 20);
        ctx.fillStyle = '#fff';
        ctx.fillText(label, x1 + 4, y1 - 5);
      }

      if (showMasks && result.mask) {
        drawMask(ctx, result, color);
      }
    });
  }, [imageLoaded, showMasks, showBoxes, samVision]);

  const drawMask = (
    ctx: CanvasRenderingContext2D,
    result: SamSegmentResult,
    color: string
  ) => {
    if (!result.mask || !result.boundingBox) return;

    const maskData = decodeMask(result.mask.data, result.mask.width, result.mask.height);
    if (!maskData) return;

    const imageData = ctx.createImageData(result.mask.width, result.mask.height);
    const rgb = hexToRgb(color);

    for (let i = 0; i < maskData.length; i++) {
      if (maskData[i]) {
        const idx = i * 4;
        imageData.data[idx] = rgb.r;
        imageData.data[idx + 1] = rgb.g;
        imageData.data[idx + 2] = rgb.b;
        imageData.data[idx + 3] = 100;
      }
    }

    ctx.putImageData(imageData, result.mask.x, result.mask.y);
  };

  const decodeMask = (data: string, width: number, height: number): Uint8Array | null => {
    try {
      if (data[0] !== '!') return null;
      const base85 = data.slice(1);
      const decoded = decodeBase85(base85);
      return decodeRLE(decoded, width * height);
    } catch {
      return null;
    }
  };

  const decodeBase85 = (str: string): Uint8Array => {
    const result: number[] = [];
    for (let i = 0; i < str.length; i += 5) {
      let acc = 0;
      for (let j = 0; j < 5 && i + j < str.length; j++) {
        acc = acc * 85 + (str.charCodeAt(i + j) - 33);
      }
      for (let k = 3; k >= 0; k--) {
        result.push((acc >> (k * 8)) & 0xff);
      }
    }
    return new Uint8Array(result);
  };

  const decodeRLE = (data: Uint8Array, totalPixels: number): Uint8Array => {
    const output = new Uint8Array(totalPixels);
    let outIdx = 0;
    let inIdx = 0;

    while (inIdx < data.length && outIdx < totalPixels) {
      const count = data[inIdx++];
      const value = data[inIdx++] || 0;
      for (let i = 0; i < count && outIdx < totalPixels; i++) {
        output[outIdx++] = value;
      }
    }

    return output;
  };

  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 255, g: 0, b: 0 };
  };

  const getColor = (idx: number): string => {
    const colors = ['#ff3366', '#3366ff', '#33ff66', '#ff9933', '#9933ff', '#33ffff'];
    return colors[idx % colors.length];
  };

  if (!attachmentId) {
    return (
      <div className="ai-card" role="status">
        <p>{t('web.ai.noPhotoAnalysis')}</p>
      </div>
    );
  }

  return (
    <section
      className="ai-card ai-photo-card"
      aria-labelledby="ai-photo-title"
      data-testid="ai-photo-card"
    >
      <header className="ai-card__header">
        <h3 id="ai-photo-title">{t('web.ai.photoAnalysisTitle')}</h3>
      </header>

      <div className="ai-card__body">
        <div className="ai-photo-container">
          <img
            ref={imgRef}
            src={`/api/operator/attachments/${attachmentId}/image`}
            alt="Incident photo"
            className="ai-photo"
            onLoad={() => setImageLoaded(true)}
            data-testid="ai-photo-image"
          />
          {samVision && samVision.results.length > 0 && (
            <canvas
              ref={canvasRef}
              className="ai-photo-overlay"
              data-testid="ai-photo-canvas"
            />
          )}
        </div>

        {samVision && samVision.results.length > 0 && (
          <div className="ai-photo-controls">
            <label className="ai-toggle">
              <input
                type="checkbox"
                checked={showBoxes}
                onChange={(e) => setShowBoxes(e.target.checked)}
                data-testid="ai-toggle-boxes"
              />
              {t('web.ai.toggleBoxes')}
            </label>
            <label className="ai-toggle">
              <input
                type="checkbox"
                checked={showMasks}
                onChange={(e) => setShowMasks(e.target.checked)}
                data-testid="ai-toggle-masks"
              />
              {t('web.ai.toggleMasks')}
            </label>
          </div>
        )}

        {sparkVision && (
          <div className="ai-field">
            <strong>{t('web.ai.sparkSummary')}</strong>
            <div className="ai-spark-summary" data-testid="ai-spark-summary">
              <p className="ai-text">{sparkVision.summary.description}</p>

              {sparkVision.summary.visibleObjects.length > 0 && (
                <div>
                  <strong>{t('web.ai.visibleObjects')}:</strong>
                  <div className="ai-chips">
                    {sparkVision.summary.visibleObjects.map((obj, idx) => (
                      <span key={idx} className="ai-chip">
                        {obj}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {sparkVision.summary.estimatedPersonCount !== null && (
                <p>
                  <strong>{t('web.ai.estimatedPersons')}:</strong>{' '}
                  {sparkVision.summary.estimatedPersonCount}
                </p>
              )}

              {sparkVision.summary.hazardsVisible.length > 0 && (
                <div>
                  <strong>{t('web.ai.hazardsVisible')}:</strong>
                  <div className="ai-chips">
                    {sparkVision.summary.hazardsVisible.map((hazard, idx) => (
                      <span key={idx} className="ai-chip ai-chip--hazard">
                        {hazard}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {sparkVision.summary.uncertainty && (
                <p className="ai-warning" role="note">
                  {sparkVision.summary.uncertainty}
                </p>
              )}
            </div>
            <div className="ai-meta">
              <small>
                {t('web.ai.modelVersion')}: {sparkVision.model}
              </small>
            </div>
          </div>
        )}

        {samVision && samVision.results.length > 0 && (
          <div className="ai-field">
            <strong>{t('web.ai.samSegmentation')}</strong>
            <div className="ai-sam-results" data-testid="ai-sam-results">
              <ul className="ai-list">
                {samVision.results.map((result) => (
                  <li key={result.id}>
                    {result.concept}
                    {result.confidence && ` (${t('web.ai.confidence')}: ${(result.confidence * 100).toFixed(0)}%)`}
                  </li>
                ))}
              </ul>
            </div>
            <div className="ai-meta">
              <small>
                {t('web.ai.modelVersion')}: {samVision.model}
              </small>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
