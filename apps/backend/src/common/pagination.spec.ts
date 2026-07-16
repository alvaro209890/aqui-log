import { parsePagination, toPageResult } from './pagination';

describe('pagination helpers', () => {
  it('parses page and limit with bounds', () => {
    expect(parsePagination('2', '10')).toEqual({
      page: 2,
      limit: 10,
      skip: 10,
    });
    expect(parsePagination(undefined, '999').limit).toBe(100);
    expect(parsePagination('0', '0').page).toBe(1);
  });

  it('builds page result', () => {
    const result = toPageResult([1, 2], 25, 2, 10);
    expect(result.totalPages).toBe(3);
    expect(result.items).toEqual([1, 2]);
  });
});
