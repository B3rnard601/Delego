import { describe, it, expect } from "vitest";
import { DEFAULT_REDIRECT, sanitizeRedirectUrl } from "./redirect";

describe("sanitizeRedirectUrl", () => {
  it("keeps in-app absolute paths, including query and hash", () => {
    expect(sanitizeRedirectUrl("/wallet")).toBe("/wallet");
    expect(sanitizeRedirectUrl("/delegations/new?step=2")).toBe(
      "/delegations/new?step=2"
    );
    expect(sanitizeRedirectUrl("/orders#recent")).toBe("/orders#recent");
  });

  it.each([
    "https://malicious.example",
    "http://malicious.example",
    "//malicious.example",
    "/\\malicious.example",
    "/path\\..\\evil",
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "dashboard",
    "",
  ])("rejects %j", (input) => {
    expect(sanitizeRedirectUrl(input)).toBe(DEFAULT_REDIRECT);
  });

  it("rejects missing values", () => {
    expect(sanitizeRedirectUrl(null)).toBe(DEFAULT_REDIRECT);
    expect(sanitizeRedirectUrl(undefined)).toBe(DEFAULT_REDIRECT);
  });

  it("rejects external urls hidden behind whitespace or control characters", () => {
    expect(sanitizeRedirectUrl("  //malicious.example")).toBe(DEFAULT_REDIRECT);
    expect(sanitizeRedirectUrl("/ /malicious.example")).toBe(DEFAULT_REDIRECT);
    expect(sanitizeRedirectUrl("\n\thttps://malicious.example")).toBe(
      DEFAULT_REDIRECT
    );
  });

  it("never returns a value that leaves the origin", () => {
    for (const input of ["//evil", "https://evil", "/ok", null, "/\\evil"]) {
      const result = sanitizeRedirectUrl(input);
      expect(result.startsWith("/")).toBe(true);
      expect(result.startsWith("//")).toBe(false);
    }
  });
});
