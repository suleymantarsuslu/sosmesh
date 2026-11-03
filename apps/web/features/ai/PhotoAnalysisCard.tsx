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

    const displayWidth = imgRef.current.width;
    const displayHeight = imgRef.current.height;
    
    // Ensure we have valid dimensions
    if (displayWidth === 0 || displayHeight === 0) return;
    
    canvas.width = displayWidth;
    canvas.height = displayHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!samVision?.segments || samVision.segments.length === 0) return;

    // Draw all elements
    const drawPromises: Promise<void>[] = [];
    
    samVision.segments.forEach((segment, idx) => {
      const color = getColor(idx);
      
      // Scale normalized coordinates to display size
      const boxX = segment.box.x * displayWidth;
      const boxY = segment.box.y * displayHeight;
      const boxW = segment.box.w * displayWidth;
      const boxH = segment.box.h * displayHeight;

      if (showMasks && segment.maskPng) {
        drawPromises.push(drawMaskPng(ctx, segment.maskPng, boxX, boxY, boxW, boxH, color));
      }

      if (showBoxes) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.strokeRect(boxX, boxY, boxW, boxH);

        ctx.fillStyle = color;
        ctx.font = '14px system-ui, sans-serif';
        const label = `${segment.concept}${
          segment.confidence ? ` (${(segment.confidence * 100).toFixed(0)}%)` : ''
        }`;
        const metrics = ctx.measureText(label);
        ctx.fillRect(boxX, boxY - 20, metrics.width + 8, 20);
        ctx.fillStyle = '#fff';
        ctx.fillText(label, boxX + 4, boxY - 5);
      }
    });
  }, [imageLoaded, showMasks, showBoxes, samVision]);

  const drawMaskPng = (
    ctx: CanvasRenderingContext2D,
    maskPngDataUrl: string,
    boxX: number,
    boxY: number,
    boxW: number,
    boxH: number,
    color: string
  ): Promise<void> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        ctx.save();
        ctx.globalAlpha = 0.45;
        
        // Draw mask with color tint
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(img, boxX, boxY, boxW, boxH);
        
        // Apply color tint
        ctx.globalCompositeOperation = 'source-in';
        ctx.fillStyle = color;
        ctx.fillRect(boxX, boxY, boxW, boxH);
        
        ctx.restore();
        resolve();
      };
      img.onerror = () => resolve(); // Resolve even on error to not block
      img.src = maskPngDataUrl;
    });
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
          {samVision && samVision.segments.length > 0 && (
            <canvas
              ref={canvasRef}
              className="ai-photo-overlay"
              data-testid="ai-photo-canvas"
            />
          )}
        </div>

        {samVision && samVision.segments.length > 0 && (
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

        {samVision && samVision.segments.length > 0 && (
          <div className="ai-field">
            <strong>{t('web.ai.samSegmentation')}</strong>
            <div className="ai-sam-results" data-testid="ai-sam-results">
              <ul className="ai-list">
                {samVision.segments.map((segment) => (
                  <li key={segment.id}>
                    {segment.concept}
                    {segment.confidence && ` (${t('web.ai.confidence')}: ${(segment.confidence * 100).toFixed(0)}%)`}
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
