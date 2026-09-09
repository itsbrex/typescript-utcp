// packages/http/tests/url_template.test.ts
import { test, expect, describe } from "bun:test";
import { buildUrlWithPathParams } from "../src/_url";
import { DefaultVariableSubstitutor } from "@utcp/sdk";
import type { UtcpClientConfig } from "@utcp/sdk";

describe("buildUrlWithPathParams", () => {
  test("encodes embedded path parameters", () => {
    const args: Record<string, any> = { owner: "a/b", repo: "x y" };
    const url = buildUrlWithPathParams("https://api.example.com/repos/{owner}/{repo}", args);
    expect(url).toBe("https://api.example.com/repos/a%2Fb/x%20y");
    expect(args).toEqual({}); // consumed, so they are not re-sent as query params
  });

  test("supports the ${param} form and repeated parameters", () => {
    const args: Record<string, any> = { v: "1" };
    expect(buildUrlWithPathParams("https://h/${v}/{v}", args)).toBe("https://h/1/1");
  });

  test("a whole-URL template substitutes raw", () => {
    // The tool that motivated this: `url: "{url}"` with the full URL as the
    // argument. Encoding turned `https://` into `https%3A%2F%2F`, and the
    // scheme check downstream rejected every request the tool could make.
    const args: Record<string, any> = { url: "https://staging.example.com/api/health?x=1" };
    const url = buildUrlWithPathParams("{url}", args);
    expect(url).toBe("https://staging.example.com/api/health?x=1");
    expect(args).toEqual({});
  });

  test("the ${url} form is NOT the opt-in — that syntax belongs to the variable layer", () => {
    // Through the default client, `${url}` never reaches this function: the
    // variable substitutor consumes `${...}` first. If a protocol is driven
    // directly, the generic (encoding) path applies — no raw substitution.
    const args: Record<string, any> = { url: "https://h/x" };
    expect(buildUrlWithPathParams("${url}", args)).toBe("https%3A%2F%2Fh%2Fx");
  });

  test("the opt-in is the NAME `url`: other single-placeholder templates keep encoding", () => {
    // A legacy template like `{endpoint}` must not silently become a
    // caller-controlled destination on a library upgrade — raw substitution
    // is only for the explicit `{url}` contract.
    const args: Record<string, any> = { endpoint: "https://h/x" };
    expect(buildUrlWithPathParams("{endpoint}", args)).toBe("https%3A%2F%2Fh%2Fx");
  });

  test("whole-URL substitution still requires the argument", () => {
    expect(() => buildUrlWithPathParams("{url}", {})).toThrow("Missing required path parameter: url");
  });

  test("a template with surrounding text is NOT whole-URL: encoding stays", () => {
    const args: Record<string, any> = { url: "https://h/x" };
    // Anything around the placeholder means it is a segment, not the URL.
    expect(buildUrlWithPathParams("https://proxy/{url}", args)).toBe(
      "https://proxy/https%3A%2F%2Fh%2Fx",
    );
  });

  test("missing embedded parameters still throw", () => {
    expect(() => buildUrlWithPathParams("https://h/{a}/{b}", { a: "1" } as Record<string, any>)).toThrow(
      "Missing required path parameter: b",
    );
  });
});

describe("layering with the client's variable substitutor", () => {
  // The client substitutes `${...}` (config variables) into call templates
  // BEFORE any protocol expands `{...}` (path params). These two tests pin
  // that seam: the `{url}` opt-in survives the variable pass untouched and
  // reaches buildUrlWithPathParams, while a `${url}` written in a template
  // is consumed by the variable layer and never gets there.
  const config = {
    variables: { url: "https://from-config-vars.example" },
    load_variables_from: null,
  } as unknown as UtcpClientConfig;

  test("`{url}` passes through variable substitution untouched", async () => {
    const substitutor = new DefaultVariableSubstitutor();
    const template = { url: "{url}", http_method: "GET" };
    const substituted = await substitutor.substitute(template, config);
    expect(substituted.url).toBe("{url}");
    // ...and then the protocol's expansion applies the raw opt-in.
    const args: Record<string, any> = { url: "https://caller.example/health" };
    expect(buildUrlWithPathParams(substituted.url, args)).toBe("https://caller.example/health");
  });

  test("`${url}` is consumed by the variable layer, not the protocol", async () => {
    const substitutor = new DefaultVariableSubstitutor();
    const template = { url: "${url}", http_method: "GET" };
    const substituted = await substitutor.substitute(template, config);
    expect(substituted.url).toBe("https://from-config-vars.example");
  });
});
