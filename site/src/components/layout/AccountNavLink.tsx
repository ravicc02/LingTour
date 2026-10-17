"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LocalUser, readStoredUser } from "@/lib/auth-client";
import { useLocale } from "@/lib/locale-context";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function AccountNavLink({
  onNavigate,
  hideWhenAuthenticated = false,
}: {
  onNavigate?: () => void;
  hideWhenAuthenticated?: boolean;
}) {
  const { t } = useLocale();
  const [user, setUser] = useState<LocalUser | null>(null);

  useEffect(() => {
    function syncUser() {
      setUser(readStoredUser());
    }

    syncUser();
    window.addEventListener("storage", syncUser);
    window.addEventListener("culvoy-auth", syncUser);
    window.addEventListener("pageshow", syncUser);

    return () => {
      window.removeEventListener("storage", syncUser);
      window.removeEventListener("culvoy-auth", syncUser);
      window.removeEventListener("pageshow", syncUser);
    };
  }, []);

  if (!user) {
    return (
      <Link
        href="/login?next=%2Fprofile%3Ftab%3Dnotes"
        onClick={onNavigate}
        className="ml-2 inline-flex min-h-11 min-w-[6.4rem] shrink-0 items-center justify-center whitespace-nowrap rounded-full border border-[var(--gold)]/75 bg-white/30 px-4 py-2 text-[12px] uppercase leading-5 tracking-[0.2em] text-[var(--river-deep)] transition-colors hover:border-[var(--river-deep)] hover:bg-[var(--river-deep)] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[var(--gold)]"
        aria-label="Log in to open your traveler profile"
      >
        {t("common.nav.login")}
      </Link>
    );
  }

  if (hideWhenAuthenticated && user) return null;

  return (
    <div className="ml-2" suppressHydrationWarning>
      <Link
        href="/profile?tab=notes"
        onClick={onNavigate}
        className="relative z-20 inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--paper)] text-[var(--river-deep)] transition-colors hover:border-[var(--river-deep)] hover:bg-[var(--river-deep)] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--gold)]"
        aria-label="Open your traveler profile"
      >
        {user.avatarUrl ? (
          <span aria-hidden="true" className="h-10 w-10 overflow-hidden rounded-full">
            <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
          </span>
        ) : (
          <span aria-hidden="true" className="font-[family:var(--font-display)] text-sm">
            {getInitials(user.name)}
          </span>
        )}
      </Link>
    </div>
  );
}
