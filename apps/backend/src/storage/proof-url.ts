/** Pure helper for unit tests and shared policy checks. */
export function assertAllowed(
  url: string,
  publicBase: string,
  extraHosts: string[],
  allowExample: boolean,
): boolean {
  if (allowExample && url.startsWith('https://example.com/')) return true;
  try {
    const u = new URL(url);
    const base = new URL(publicBase);
    if (
      u.origin === base.origin &&
      u.pathname.startsWith(`${base.pathname}/storage/files/`)
    ) {
      return true;
    }
    return extraHosts.includes(u.hostname);
  } catch {
    return false;
  }
}
