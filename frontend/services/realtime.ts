import type { FirestoreError, Unsubscribe } from 'firebase/firestore';

type StartSubscription = (onError: (error: FirestoreError) => void) => Unsubscribe;

const MAX_RETRY_DELAY_MS = 30_000;

function getRetryDelay(attempt: number) {
  const baseDelay = Math.min(1000 * 2 ** attempt, MAX_RETRY_DELAY_MS);
  return baseDelay + Math.floor(Math.random() * 400);
}

export function subscribeWithRetry(
  startSubscription: StartSubscription,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  let active = true;
  let unsubscribe: Unsubscribe | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let retryAttempt = 0;

  const clearRetry = () => {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  };

  const start = () => {
    if (!active) return;

    try {
      unsubscribe = startSubscription((error) => {
        if (!active) return;
        onError(error);
        unsubscribe?.();
        unsubscribe = null;

        clearRetry();
        retryTimer = setTimeout(() => {
          retryAttempt += 1;
          start();
        }, getRetryDelay(retryAttempt));
      });
      retryAttempt = 0;
    } catch (error) {
      onError(error as FirestoreError);
      clearRetry();
      retryTimer = setTimeout(() => {
        retryAttempt += 1;
        start();
      }, getRetryDelay(retryAttempt));
    }
  };

  start();

  return () => {
    active = false;
    clearRetry();
    unsubscribe?.();
    unsubscribe = null;
  };
}
