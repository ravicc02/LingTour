"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "@/lib/locale-context";

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export interface UseApiQueryOptions {
  /** Keep previous data while new request is in-flight (default: true) */
  keepPreviousData?: boolean;
  /** Number of retry attempts on failure (default: 2) */
  retryCount?: number;
  /** Base delay in ms between retries, doubles each attempt (default: 1000) */
  retryDelay?: number;
  /** When false, skip the fetch entirely (default: true) */
  enabled?: boolean;
  /** When false, keep supplied initial data through hydration without re-fetching it. */
  revalidateOnMount?: boolean;
}

type Fetcher<T> = () => Promise<T>;

/**
 * Generic async query hook for API data fetching.
 *
 * Returns `{ data, loading, error, refetch }` so every page
 * can render loading / error / success states uniformly.
 *
 * Supports stale-while-revalidate (keepPreviousData), automatic
 * retry with exponential backoff, and conditional fetching (enabled).
 */
export function useApiQuery<T>(
  fetcher: Fetcher<T>,
  deps: unknown[] = [],
  options: UseApiQueryOptions & { initialData?: T | null } = {},
): AsyncState<T> {
  const {
    keepPreviousData = true,
    retryCount = 2,
    retryDelay = 1000,
    enabled = true,
    revalidateOnMount = true,
  } = options;
  const initialData = (options as { initialData?: T | null }).initialData ?? null;
  const hasInitialData =
    initialData !== null &&
    !(Array.isArray(initialData) && initialData.length === 0);
  const skipInitialRevalidation = hasInitialData && !revalidateOnMount;

  const [data, setData] = useState<T | null>(initialData);
  const [loading, setLoading] = useState(enabled && !hasInitialData);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const mountedRef = useRef(true);
  const fetcherRef = useRef(fetcher);
  const initialDepsRef = useRef(deps);

  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  const refetch = useCallback(() => {
    setVersion((value) => value + 1);
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    if (!enabled) {
      setLoading(false);
      return;
    }

    const dependenciesChanged =
      deps.length !== initialDepsRef.current.length ||
      deps.some((dependency, index) => !Object.is(dependency, initialDepsRef.current[index]));

    if (version === 0 && skipInitialRevalidation && !dependenciesChanged) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    if (!keepPreviousData) {
      setData(null);
    }
    setLoading(true);
    setError(null);

    const attemptFetch = async (attempt: number): Promise<void> => {
      try {
        const result = await fetcherRef.current();
        if (!cancelled && mountedRef.current) {
          setData(result);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (cancelled || !mountedRef.current) return;

        if (attempt < retryCount) {
          const delay = retryDelay * Math.pow(2, attempt);
          await new Promise<void>((resolve) => {
            setTimeout(resolve, delay);
          });
          if (!cancelled && mountedRef.current) {
            return attemptFetch(attempt + 1);
          }
        } else if (!cancelled && mountedRef.current) {
          setError(err instanceof Error ? err.message : "An error occurred");
          setLoading(false);
        }
      }
    };

    attemptFetch(0);

    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, enabled, keepPreviousData, retryCount, retryDelay, ...deps]);

  return { data, loading, error, refetch };
}

// Shared loading/error components

/**
 * Lightweight loading state used while data is in-flight.
 *
 * Default copy is intentionally restrained ("Opening the file…") to fit the
 * journal aesthetic. Callers can still override `text` for context-specific
 * wording.
 */
export function LoadingSpinner({
  text,
}: {
  text?: string;
}) {
  const { t } = useLocale();
  const displayText = text ?? t("common.state.loadingFile");

  return (
    <div data-ui-state="loading" role="status" aria-live="polite" className="flex min-h-[40vh] items-center justify-center">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--cinnabar)]" />
        {displayText ? (
          <p className="mt-4 text-sm text-[var(--muted)] handwritten">{displayText}</p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Friendly error state. Defaults shape the wording around "we couldn't reach
 * the archive". Callers can pass a more specific `message` when useful.
 */
export function ErrorState({
  message,
  onRetry,
  title,
}: {
  message?: string;
  onRetry?: () => void;
  title?: string;
}) {
  const { t } = useLocale();
  const displayTitle = title ?? t("common.state.errorTitle");
  const displayMessage = message ?? t("common.state.errorMessage");

  return (
    <div data-ui-state="error" className="flex min-h-[40vh] items-center justify-center px-6">
      <div className="max-w-md text-center">
        <p className="font-mono text-[12px] uppercase tracking-[0.4em] text-[var(--cinnabar)]">
          ! {displayTitle}
        </p>
        <p className="mt-4 text-base leading-relaxed text-[var(--muted)] handwritten">
          {displayMessage}
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-8 border border-[var(--line)] px-6 py-3 text-xs font-bold uppercase tracking-widest text-[var(--ink)] transition hover:bg-[var(--night)] hover:text-white"
          >
            {t("common.btn.tryAgain")}
          </button>
        )}
      </div>
    </div>
  );
}
