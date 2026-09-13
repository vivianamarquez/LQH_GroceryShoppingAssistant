export type LqhStatus = 'unchecked' | 'waiting' | 'responded' | 'failed' | 'unknown';

export function createLqhStatus() {
  let status: LqhStatus = 'unchecked';
  let pending = 0;
  let expiry: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();
  const update = (next: LqhStatus) => {
    status = next;
    listeners.forEach(listener => listener());
  };

  return {
    getSnapshot: () => status,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    start() {
      pending++;
      clearTimeout(expiry);
      update('waiting');
      let finished = false;
      return (outcome: 'responded' | 'failed' | 'cancelled') => {
        if (finished) return;
        finished = true;
        pending--;
        if (pending) return;
        update(outcome === 'cancelled' ? 'unknown' : outcome);
        if (outcome === 'responded') {
          expiry = setTimeout(() => update('unknown'), 60_000);
        }
      };
    },
  };
}

export const lqhStatus = createLqhStatus();
