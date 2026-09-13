'use client';

import { useEffect, useState } from 'react';
import { LqhStatusIndicator } from './lqh-status-indicator';

export function RequestProgress({ busy, hosted = false, message, onCancel }: {
  busy: boolean;
  hosted?: boolean;
  message: string;
  onCancel?: () => void;
}) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!busy) return;
    setSeconds(0);
    const started = Date.now();
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [busy]);

  if (!busy && !hosted) return null;

  return (
    <div className="mt-3 space-y-1.5 text-xs leading-5 text-muted-foreground">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {hosted ? <LqhStatusIndicator /> : <output className="min-w-0 flex-1" aria-live="polite">{message}</output>}
        {busy && (
          <span role="timer" aria-live="off" className="ml-auto shrink-0 tabular-nums">
            {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')} elapsed
          </span>
        )}
        {busy && onCancel && <button className="shrink-0 underline underline-offset-4" onClick={onCancel}>Cancel</button>}
      </div>
      {hosted && busy && <output className="block" aria-live="polite">{message}</output>}
    </div>
  );
}
