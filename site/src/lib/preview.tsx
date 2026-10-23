"use client";

import { useEffect, useMemo, useState } from "react";

type PreviewType =
  | "city"
  | "route"
  | "product"
  | "event"
  | "collection"
  | "service"
  | "interpreter"
  | "faq"
  | "home";

type PreviewEnvelope<T> = {
  channel: "culvoy-preview";
  key: string;
  type: PreviewType;
  source?: string;
  data: T;
  timestamp: number;
};

type PreviewReadyEnvelope = {
  channel: "culvoy-preview-ready";
  key: string;
  type: PreviewType;
};

const STORAGE_PREFIX = "culvoy-preview:";


function readStoredPreview<T>(key: string): PreviewEnvelope<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(`${STORAGE_PREFIX}${key}`);
    if (!raw) return null;
    return JSON.parse(raw) as PreviewEnvelope<T>;
  } catch {
    return null;
  }
}

function persistPreview<T>(key: string, envelope: PreviewEnvelope<T>) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(envelope));
  } catch {
    // Ignore storage failures in preview mode.
  }
}

export function usePreviewBridge<T>(expectedType: PreviewType) {
  const [previewContext, setPreviewContext] = useState({
    key: "",
    source: "",
    enabled: false,
  });

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const key = searchParams.get("previewKey") || "";
    // P2-M: the preview bridge only ever talks to the admin app. The
    // ?previewSource query value is untrusted input, so it is matched
    // against this hard-coded allowlist instead of being used verbatim.
    // event.origin itself is browser-guaranteed and cannot be spoofed;
    // Explicit localhost and loopback origins support local admin development.
    const PREVIEW_SOURCE_ALLOWLIST = [
      "https://admin.culvoy.com",
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ];
    const requestedSource = searchParams.get("previewSource") || "";
    const source = PREVIEW_SOURCE_ALLOWLIST.includes(requestedSource)
      ? requestedSource
      : "";
    setPreviewContext({
      key,
      source,
      enabled: searchParams.get("preview") === "1" && key.length > 0,
    });
  }, []);

  const previewKey = previewContext.key;
  const previewSource = previewContext.source;
  const previewEnabled = previewContext.enabled;

  const initialPreview = useMemo(() => {
    if (!previewEnabled) return null;
    const stored = readStoredPreview<T>(previewKey);
    if (!stored || stored.type !== expectedType) return null;
    return stored;
  }, [expectedType, previewEnabled, previewKey]);

  const [previewData, setPreviewData] = useState<T | null>(initialPreview?.data ?? null);

  useEffect(() => {
    if (!previewEnabled) {
      setPreviewData(null);
      return;
    }

    const stored = readStoredPreview<T>(previewKey);
    if (stored && stored.type === expectedType) {
      setPreviewData(stored.data);
    }

    const trustedSender =
      window.parent !== window ? window.parent : window.opener;
    if (trustedSender && previewSource) {
      const ready: PreviewReadyEnvelope = {
        channel: "culvoy-preview-ready",
        key: previewKey,
        type: expectedType,
      };
      trustedSender.postMessage(ready, previewSource);
    }

    const handleMessage = (event: MessageEvent) => {
      if (!trustedSender || event.source !== trustedSender) return;
      const payload = event.data as PreviewEnvelope<T> | undefined;
      if (!payload || payload.channel !== "culvoy-preview") return;
      if (payload.type !== expectedType || payload.key !== previewKey) return;
      if (!previewSource || event.origin !== previewSource) return;
      if (payload.source && payload.source !== previewSource) return;

      persistPreview(previewKey, payload);
      setPreviewData(payload.data);
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [expectedType, previewEnabled, previewKey, previewSource]);

  return {
    previewEnabled,
    previewKey,
    previewData,
  };
}
