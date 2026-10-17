"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FAVORITES_EVENT,
  pushFavorite,
  readFavorites,
  writeFavorites,
  type FavoriteType,
} from "@/lib/favorites";

type FavoriteButtonProps = {
  id: string;
  type: FavoriteType;
  title: string;
  image?: string;
  variant?: "light" | "dark";
};

export function FavoriteButton({ id, type, title, image, variant = "light" }: FavoriteButtonProps) {
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const isDark = variant === "dark";

  useEffect(() => {
    function syncSaved() {
      setSaved(readFavorites().some((item) => item.id === id && item.type === type));
    }

    syncSaved();
    window.addEventListener("storage", syncSaved);
    window.addEventListener(FAVORITES_EVENT, syncSaved);

    return () => {
      window.removeEventListener("storage", syncSaved);
      window.removeEventListener(FAVORITES_EVENT, syncSaved);
    };
  }, [id, type]);

  const handleClick = useCallback(async () => {
    // A rapid double-click would otherwise fire two conflicting pushes; the
    // local list is optimistic, so guard the sync instead of the UI.
    if (pendingRef.current) return;
    const favorites = readFavorites();
    const exists = favorites.some((item) => item.id === id && item.type === type);
    const next = exists
      ? favorites.filter((item) => !(item.id === id && item.type === type))
      : [...favorites, { id, type, title, image }];
    writeFavorites(next);

    // Signed-out visitors keep a local-only list; the account merges on sign-in.
    pendingRef.current = true;
    setPending(true);
    try {
      await pushFavorite(exists ? "remove" : "add", { id, type, title, image });
    } catch (error) {
      // The local list already holds the change, so the visitor's own device is
      // correct; only the account sync failed. Surface it instead of swallowing
      // it, and let the next sign-in merge reconcile.
      console.warn("Favorite sync failed; kept the change locally.", error);
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }, [id, type, title, image]);

  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? `Remove ${title} from saved items` : `Save ${title}`}
      aria-busy={pending || undefined}
      data-favorite-button="true"
      data-react-favorite="true"
      data-favorite-id={id}
      data-favorite-type={type}
      data-favorite-title={title}
      className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-2 border px-3 py-2 text-xs font-semibold transition sm:px-4 ${
        isDark
          ? "btn-ghost-dark"
          : "border-[var(--line)] bg-white/82 text-[var(--ink)] hover:border-[var(--cinnabar)] hover:text-[var(--cinnabar)]"
      }`}
      onClick={handleClick}
    >
      <svg aria-hidden="true" className="block h-4 w-4 shrink-0" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"}>
        <path
          d="M12 20.5L10.8 19.4C6.6 15.6 4 13.2 4 10.2C4 7.8 5.9 6 8.3 6C9.6 6 10.9 6.6 11.7 7.6H12.3C13.1 6.6 14.4 6 15.7 6C18.1 6 20 7.8 20 10.2C20 13.2 17.4 15.6 13.2 19.4L12 20.5Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span data-favorite-label className="hidden sm:inline">
        {saved ? "Saved" : "Save"}
      </span>
    </button>
  );
}
