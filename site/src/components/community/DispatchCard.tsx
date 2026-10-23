"use client";

type DispatchCardProps = {
  stampCount: number;
  onDispatch: () => void;
  isLoggedIn: boolean;
  onLogin: () => void;
};

export function DispatchCard({
  onDispatch,
  isLoggedIn,
  onLogin,
}: DispatchCardProps) {
  return (
    <div
      data-polish-compose
      data-community-compose
      className="flex w-full flex-col gap-4 border-y border-[var(--line)] py-5 sm:flex-row sm:items-center sm:justify-between"
    >
      <h3 className="font-[family:var(--font-display)] text-2xl text-[var(--river-deep)]">
        Create a Post
      </h3>

      <div className="shrink-0">
        {isLoggedIn ? (
          <button
            type="button"
            onClick={onDispatch}
            className="min-h-11 w-full bg-[var(--river-deep)] px-6 py-3 text-xs font-bold uppercase tracking-[0.14em] text-white transition-colors hover:bg-[var(--cinnabar-deep)] sm:w-auto"
          >
            Create post
          </button>
        ) : (
          <button
            type="button"
            onClick={onLogin}
            className="min-h-11 w-full bg-[var(--cinnabar)] px-6 py-3 text-xs font-bold uppercase tracking-[0.14em] text-white transition-colors hover:bg-[var(--cinnabar-deep)] sm:w-auto"
          >
            Log in to post
          </button>
        )}
      </div>
    </div>
  );
}
