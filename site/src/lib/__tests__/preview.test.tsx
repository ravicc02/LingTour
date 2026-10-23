import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePreviewBridge } from "../preview";

const KEY = "admin-preview:route:test";
// P2-M: the bridge only accepts origins on the hard-coded allowlist, so
// tests use a configured production or local admin origin.
const SOURCE = "https://admin.culvoy.com";

function setPreviewUrl(source = SOURCE) {
  window.history.replaceState(
    {},
    "",
    `/?preview=1&previewKey=${encodeURIComponent(KEY)}&previewSource=${encodeURIComponent(source)}`,
  );
}

describe("usePreviewBridge popup handshake", () => {
  afterEach(() => {
    window.sessionStorage.clear();
    Object.defineProperty(window, "opener", { configurable: true, value: null });
    window.history.replaceState({}, "", "/");
    vi.restoreAllMocks();
  });

  it("announces readiness to the configured opener origin", async () => {
    setPreviewUrl();
    const opener = { postMessage: vi.fn() };
    Object.defineProperty(window, "opener", { configurable: true, value: opener });

    renderHook(() => usePreviewBridge<{ title: string }>("route"));

    await waitFor(() => {
      expect(opener.postMessage).toHaveBeenCalledWith(
        {
          channel: "culvoy-preview-ready",
          key: KEY,
          type: "route",
        },
        SOURCE,
      );
    });
  });

  it("accepts a matching draft only from the opener window", async () => {
    setPreviewUrl();
    const opener = { postMessage: vi.fn() };
    Object.defineProperty(window, "opener", { configurable: true, value: opener });
    const { result } = renderHook(() =>
      usePreviewBridge<{ title: string }>("route"),
    );

    await waitFor(() => expect(result.current.previewEnabled).toBe(true));

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          origin: SOURCE,
          source: {} as Window,
          data: {
            channel: "culvoy-preview",
            key: KEY,
            type: "route",
            source: SOURCE,
            data: { title: "Wrong sender" },
            timestamp: 1,
          },
        }),
      );
    });
    expect(result.current.previewData).toBeNull();

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          origin: SOURCE,
          source: opener as unknown as Window,
          data: {
            channel: "culvoy-preview",
            key: KEY,
            type: "route",
            source: SOURCE,
            data: { title: "Unsaved popup draft" },
            timestamp: 2,
          },
        }),
      );
    });

    await waitFor(() => {
      expect(result.current.previewData).toEqual({
        title: "Unsaved popup draft",
      });
    });
    expect(window.sessionStorage.getItem(`culvoy-preview:${KEY}`)).toContain(
      "Unsaved popup draft",
    );
  });

  it.each(["http://localhost:5173", "http://127.0.0.1:5173"])(
    "accepts a city draft from the configured local admin origin %s",
    async (source) => {
      setPreviewUrl(source);
      const opener = { postMessage: vi.fn() };
      Object.defineProperty(window, "opener", { configurable: true, value: opener });
      const { result } = renderHook(() =>
        usePreviewBridge<{ contentMarkdown: string }>("city"),
      );
      await waitFor(() => expect(opener.postMessage).toHaveBeenCalledWith(
        { channel: "culvoy-preview-ready", key: KEY, type: "city" }, source,
      ));
      act(() => {
        window.dispatchEvent(new MessageEvent("message", {
          origin: source,
          source: opener as unknown as Window,
          data: {
            channel: "culvoy-preview", key: KEY, type: "city", source,
            data: { contentMarkdown: "## Unsaved city chapter" }, timestamp: 4,
          },
        }));
      });
      expect(result.current.previewData?.contentMarkdown).toBe("## Unsaved city chapter");
    },
  );

  it("rejects an unlisted local port and does not persist its draft", async () => {
    const source = "http://127.0.0.1:5186";
    setPreviewUrl(source);
    const opener = { postMessage: vi.fn() };
    Object.defineProperty(window, "opener", { configurable: true, value: opener });
    const { result } = renderHook(() => usePreviewBridge<{ title: string }>("city"));
    await waitFor(() => expect(result.current.previewEnabled).toBe(true));
    act(() => {
      window.dispatchEvent(new MessageEvent("message", {
        origin: source, source: opener as unknown as Window,
        data: {
          channel: "culvoy-preview", key: KEY, type: "city", source,
          data: { title: "Unlisted local draft" }, timestamp: 5,
        },
      }));
    });
    expect(opener.postMessage).not.toHaveBeenCalled();
    expect(result.current.previewData).toBeNull();
    expect(window.sessionStorage.getItem(`culvoy-preview:${KEY}`)).toBeNull();
  });

  it("ignores a previewSource outside the allowlist (P2-M)", async () => {
    const evil = "https://evil.example.com";
    window.history.replaceState(
      {},
      "",
      `/?preview=1&previewKey=${encodeURIComponent(KEY)}&previewSource=${encodeURIComponent(evil)}`,
    );
    const opener = { postMessage: vi.fn() };
    Object.defineProperty(window, "opener", { configurable: true, value: opener });
    const { result } = renderHook(() =>
      usePreviewBridge<{ title: string }>("route"),
    );

    await waitFor(() => expect(result.current.previewEnabled).toBe(true));

    // No readiness handshake towards the untrusted origin.
    expect(opener.postMessage).not.toHaveBeenCalled();

    // A draft posted from the untrusted origin must be dropped.
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          origin: evil,
          source: opener as unknown as Window,
          data: {
            channel: "culvoy-preview",
            key: KEY,
            type: "route",
            source: evil,
            data: { title: "Phished draft" },
            timestamp: 3,
          },
        }),
      );
    });
    expect(result.current.previewData).toBeNull();
    expect(window.sessionStorage.getItem(`culvoy-preview:${KEY}`)).toBeNull();
  });
});
