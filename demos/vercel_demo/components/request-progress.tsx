'use client';

import { useEffect, useState } from 'react';

export function RequestProgress({ message, onCancel }: { message: string; onCancel?: () => void }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="mt-3 flex flex-wrap items-start justify-between gap-2 text-xs leading-5 text-muted-foreground">
      <output className="min-w-0 flex-1" aria-live="polite">{message}</output>
      <span role="timer" aria-live="off" className="shrink-0 tabular-nums">
        {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')} elapsed
      </span>
      {onCancel && <button className="shrink-0 underline underline-offset-4" onClick={onCancel}>Cancel</button>}
    </div>
  );
}
