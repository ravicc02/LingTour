"use client";

type DispatchCardProps = {
  stampCount: number;
  onDispatch: () => void;
  isLoggedIn: boolean;
  onLogin: () => void;
};

export function DispatchCard({ onDispatch, isLoggedIn, onLogin }: DispatchCardProps) {
  return (
    <div className="group flex h-full w-full flex-col bg-[var(--night)] p-6 sm:p-8 scrapbook-shadow text-white rotate-1 transition-transform hover:rotate-0">
      <h3 className="font-[family:var(--font-display)] text-3xl italic text-white">
        Create a Post
      </h3>



      <div className="mt-auto flex flex-col gap-4 pt-8">
        {isLoggedIn ? (
          <button
            type="button"
            onClick={onDispatch}
            className="min-h-12 w-full bg-[var(--paper)] py-4 text-sm font-bold uppercase tracking-[0.14em] text-[var(--night)] transition-colors hover:bg-white"
          >
            Create post
          </button>
        ) : (
          <button
            type="button"
            onClick={onLogin}
            className="min-h-12 w-full bg-[var(--cinnabar)] py-4 text-sm font-bold uppercase tracking-[0.14em] text-white transition-colors hover:bg-[var(--cinnabar-deep)]"
          >
            Log in to post
          </button>
        )}
      </div>
    </div>
  );
}
