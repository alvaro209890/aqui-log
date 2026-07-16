/** Acquire lock key helpers for delivery offer concurrency. */
export function offerAcceptLockKey(offerId: string): string {
  return `lock:offer:accept:${offerId}`;
}

export const OFFER_ACCEPT_LOCK_TTL_SECONDS = 5;
