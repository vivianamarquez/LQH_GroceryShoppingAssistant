'use client';

import { useSyncExternalStore } from 'react';
import { lqhStatus } from '@/lib/lqh-status';

const states = {
  unchecked: ['Not checked', 'bg-slate-400', 'No LQH request has been made on this page yet.'],
  waiting: ['Waiting', 'bg-amber-500 motion-safe:animate-pulse', 'A request is in progress. LQH may be starting; its warm/cold state is not confirmed.'],
  responded: ['Responded recently', 'bg-emerald-500', 'LQH responded successfully within the last minute. This is not a live readiness check.'],
  failed: ['Request failed', 'bg-red-500', 'The last LQH request failed. See the request’s error message for details.'],
  unknown: ['Status unknown', 'bg-slate-400', 'No recent response to confirm readiness. The app does not send background checks.'],
};

export function LqhStatusIndicator() {
  const status = useSyncExternalStore(lqhStatus.subscribe, lqhStatus.getSnapshot, () => 'unchecked' as const);
  const [label, color, description] = states[status];

  return (
    <output
      aria-live="polite"
      aria-atomic="true"
      title={description}
      className="ml-auto flex shrink-0 items-center gap-2 whitespace-nowrap text-xs text-muted-foreground"
    >
      <span aria-hidden="true" className={`size-1.5 rounded-full ${color}`} />
      <span><span className="font-medium">LQH</span> · {label}</span>
      <span className="sr-only">. {description}</span>
    </output>
  );
}
