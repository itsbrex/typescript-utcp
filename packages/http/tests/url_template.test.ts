// packages/http/tests/url_template.test.ts
import { test, expect, describe } from "bun:test";
import { buildUrlWithPathParams } from "../src/_url";

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

  test("a whole-URL template in the ${...} form substitutes raw too", () => {
    const args: Record<string, any> = { target: "https://h/a b" };
    expect(buildUrlWithPathParams("${target}", args)).toBe("https://h/a b");
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
