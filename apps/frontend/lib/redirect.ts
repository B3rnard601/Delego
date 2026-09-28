/**
 * Post-login redirect sanitisation (#760).
 *
 * Both redirect conventions in the app put a caller-controlled path in the
 * URL — the middleware's `?returnTo=` and `loginRedirectUrl`'s `?next=` — so
 * whatever consumes them must not navigate there blindly. An attacker who can
 * get a user to open `/login?returnTo=https://evil.example` would otherwise
 * land them on a phishing page wearing the app's own login flow.
 *
 * Anything that is not an unambiguously in-app absolute path becomes
 * [`DEFAULT_REDIRECT`], so this is safe to call on untrusted input.
 */
export const DEFAULT_REDIRECT = "/dashboard";

/** Control characters and spaces browsers ignore when resolving a URL. */
const IGNORED_BY_URL_PARSER = /[\x00-\x20]/g;

export function sanitizeRedirectUrl(url: string | null | undefined): string {
  if (typeof url !== "string") return DEFAULT_REDIRECT;

  // Strip what the parser would ignore before deciding, not after, so
  // "/ /evil" and a newline-prefixed absolute URL cannot slip through.
  const candidate = url.replace(IGNORED_BY_URL_PARSER, "");

  // Must be an absolute in-app path.
  if (!candidate.startsWith("/")) return DEFAULT_REDIRECT;

  // "//host" is protocol-relative: it leaves the origin.
  if (candidate.startsWith("//")) return DEFAULT_REDIRECT;

  // Some browsers normalise a backslash to "/", which can turn an apparently
  // relative path into a protocol-relative one.
  if (candidate.includes("\\")) return DEFAULT_REDIRECT;

  return candidate;
}
