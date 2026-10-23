"use client";

import Link from "next/link";

type Action = {
  label: string;
  href?: string;
  onClick?: () => void;
  variant: "primary" | "secondary";
};

type Props = {
  actions: Action[];
};

export function MobileStickyActions({ actions }: Props) {
  return (
    <div data-mobile-actions className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--line)] bg-[rgba(248,244,236,0.94)] shadow-lift backdrop-blur-xl md:hidden">
      <div className="flex items-center gap-3 px-[max(1rem,env(safe-area-inset-left))] pt-3 pr-[max(1rem,env(safe-area-inset-right))] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {actions.map((action) =>
          action.href ? (
            <Link
              key={action.label}
              href={action.href}
              className={`flex-1 px-4 py-3 text-center text-sm font-medium transition ${
                action.variant === "primary"
                  ? "btn-primary-compact"
                  : "btn-paper-compact"
              }`}
            >
              {action.label}
            </Link>
          ) : (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              className={`flex-1 px-4 py-3 text-center text-sm font-medium transition ${
                action.variant === "primary"
                  ? "btn-primary-compact"
                  : "btn-paper-compact"
              }`}
            >
              {action.label}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
