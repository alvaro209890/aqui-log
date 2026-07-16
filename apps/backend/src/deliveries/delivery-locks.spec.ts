import {
  offerAcceptLockKey,
  OFFER_ACCEPT_LOCK_TTL_SECONDS,
} from './delivery-locks';

describe('delivery-locks', () => {
  it('builds stable redis key for offer accept', () => {
    expect(offerAcceptLockKey('abc-123')).toBe('lock:offer:accept:abc-123');
    expect(OFFER_ACCEPT_LOCK_TTL_SECONDS).toBeGreaterThan(0);
  });
});
