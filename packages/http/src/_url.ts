// packages/http/src/_url.ts

/**
 * Substitute path parameters into a URL template.
 *
 * Accepts both the `{param}` form from the UTCP spec and the `${param}` form
 * this package's README documents. Every occurrence of a parameter is
 * replaced (a template may repeat one), values are URL-encoded to prevent
 * path injection, and consumed parameters are removed from `args` so they are
 * not also sent as query parameters. Throws when a parameter is missing.
 *
 * ONE exception to the encoding rule: a template that is exactly `{url}`
 * declares that the caller's argument IS the whole URL, and that argument is
 * substituted raw — encoding it would corrupt the scheme (`https://` →
 * `https%3A%2F%2F`) and no request could ever be made. The raw value still
 * passes through the same request-time security validation as an
 * author-written URL. The exception is deliberately keyed to the placeholder
 * NAME, not the template's shape: writing `{url}` as the entire template is
 * an explicit opt-in to a caller-controlled destination, and any other
 * single-placeholder template (`{endpoint}`, `{path}`) keeps today's encoded
 * behavior rather than silently gaining that power on a library upgrade.
 *
 * The `{url}` form only — never `${url}`. The `${...}` syntax belongs to the
 * client's VARIABLE layer: `DefaultVariableSubstitutor` resolves `${name}`
 * (and `$name`) against configured variables before any protocol sees the
 * template, so a `${url}` written in a call template is consumed there and
 * cannot reach this function through the default client.
 */
export function buildUrlWithPathParams(urlTemplate: string, args: Record<string, any>): string {
  // The whole-URL opt-in described above: exactly `{url}`.
  if (urlTemplate === '{url}') {
    if (!Object.prototype.hasOwnProperty.call(args, 'url')) {
      throw new Error('Missing required path parameter: url');
    }
    const value = String(args['url']);
    delete args['url'];
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
