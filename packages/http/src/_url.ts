// packages/http/src/_url.ts

/**
 * Substitute path parameters into a URL template.
 *
 * Accepts both the `{param}` form from the UTCP spec and the `${param}` form
 * this package's README documents. Every occurrence of a parameter is
 * replaced (a template may repeat one), values are URL-encoded to prevent
 * path injection, and consumed parameters are removed from `args` so they are
 * not also sent as query parameters. Throws when a parameter is missing.
 */
export function buildUrlWithPathParams(urlTemplate: string, args: Record<string, any>): string {
  // A template that IS a single placeholder — `{url}` / `${url}` — names the
  // WHOLE URL, not a path segment of one. Percent-encoding it corrupts the
  // scheme (`https://` becomes `https%3A%2F%2F`), after which no request can
  // ever be made: the security validation downstream rejects the mangled
  // string. Substitute raw instead — that same validation then sees a real
  // URL and gets to police it properly. Templates that EMBED placeholders
  // keep per-segment encoding below, which is what prevents path injection.
  const wholeUrl = urlTemplate.match(/^\$?\{([^}]+)\}$/);
  if (wholeUrl) {
    const paramName = wholeUrl[1];
    if (!Object.prototype.hasOwnProperty.call(args, paramName)) {
      throw new Error(`Missing required path parameter: ${paramName}`);
    }
    const value = String(args[paramName]);
    delete args[paramName];
    return value;
  }

  let url = urlTemplate;
  const placeholders = urlTemplate.match(/\$?\{([^}]+)\}/g) || [];
  const paramNames = Array.from(new Set(
    placeholders.map(p => (p.startsWith('${') ? p.slice(2, -1) : p.slice(1, -1)))
  ));

  for (const paramName of paramNames) {
    // Own properties only: `in` would accept inherited names such as
    // `constructor` and substitute a stringified function.
    if (!Object.prototype.hasOwnProperty.call(args, paramName)) {
      throw new Error(`Missing required path parameter: ${paramName}`);
    }
    // `${x}` goes first so that replacing `{x}` never leaves a stray `$`.
    const value = encodeURIComponent(String(args[paramName]));
    url = url.split('${' + paramName + '}').join(value).split('{' + paramName + '}').join(value);
    delete args[paramName];
  }

  const remainingParams = url.match(/\$?\{([^}]+)\}/g);
  if (remainingParams && remainingParams.length > 0) {
    throw new Error(`Missing required path parameters in URL template: ${remainingParams.join(', ')}`);
  }

  return url;
}
