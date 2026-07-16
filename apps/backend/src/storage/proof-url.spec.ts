import { assertAllowed } from './proof-url';

describe('proof url policy helper', () => {
  it('allows storage path under public base', () => {
    expect(
      assertAllowed(
        'http://localhost:3001/api/v1/storage/files/proof-abc.jpg',
        'http://localhost:3001/api/v1',
        [],
        false,
      ),
    ).toBe(true);
  });

  it('rejects example.com by default', () => {
    expect(
      assertAllowed(
        'https://example.com/x.jpg',
        'http://localhost:3001/api/v1',
        [],
        false,
      ),
    ).toBe(false);
  });

  it('allows example.com when flag on', () => {
    expect(
      assertAllowed(
        'https://example.com/x.jpg',
        'http://localhost:3001/api/v1',
        [],
        true,
      ),
    ).toBe(true);
  });
});
