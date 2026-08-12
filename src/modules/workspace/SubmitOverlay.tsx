import React from 'react';
import './SubmitOverlay.scss';

interface SubmitOverlayProps {
  visible: boolean;
  accent?: 'yellow' | 'pink';
  label?: string;
}

export default function SubmitOverlay({
  visible,
  accent = 'yellow',
  label = 'Traitement en cours…'
}: SubmitOverlayProps) {
  if (!visible) return null;

  return (
    <div className={`submit-overlay submit-overlay--${accent}`} role="status" aria-live="polite">
      <div className="submit-overlay__inner">
        <img src="/logo.png" alt="Lana Cash" className="submit-overlay__logo" />
        <div className="submit-overlay__bar">
          <div className="submit-overlay__bar-fill" />
        </div>
        <p className="submit-overlay__label">{label}</p>
      </div>
    </div>
  );
}
