import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { LocaleProvider, useLocale } from "../locale-context";
import { dictionary } from "@/translations";
import type { ReactNode } from "react";

function Wrapper({ children }: { children: ReactNode }) {
  return <LocaleProvider>{children}</LocaleProvider>;
}

describe("LocaleProvider", () => {
  it("resolves a known copy key to its English string", () => {
    const { result } = renderHook(() => useLocale(), { wrapper: Wrapper });
    expect(result.current.t("common.nav.routes")).toBe("Routes");
  });

  it("returns a readable marker for an unknown key instead of throwing", () => {
    const { result } = renderHook(() => useLocale(), { wrapper: Wrapper });
    expect(result.current.t("does.not.exist")).toBe("Missing copy: does.not.exist");
  });

  it("works without a provider, so server-rendered leaves still get copy", () => {
    const { result } = renderHook(() => useLocale());
    expect(result.current.t("common.nav.shop")).toBe("Shop");
  });

  it("ships a single English copy deck with no Chinese strings left behind", () => {
    const values = Object.values(dictionary).filter(
      (v): v is string => typeof v === "string",
    );
    expect(values.length).toBeGreaterThan(100);
    const withHan = values.filter((v) => /[一-鿿]/.test(v));
    expect(withHan).toEqual([]);
  });
});
