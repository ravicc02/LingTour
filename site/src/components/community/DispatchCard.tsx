"use client";

type DispatchCardProps = {
  stampCount: number;
  onDispatch: () => void;
  isLoggedIn: boolean;
  onLogin: () => void;
};

export function DispatchCard({ stampCount, onDispatch, isLoggedIn, onLogin }: DispatchCardProps) {
  return (
    <div className="group flex h-full w-full flex-col bg-[var(--night)] p-6 sm:p-8 scrapbook-shadow text-white rotate-1 transition-transform hover:rotate-0">
      <div className="flex items-center justify-between border-b border-white/15 pb-4 mb-6">
        <p className="font-mono text-[12px] uppercase tracking-[0.3em] text-[var(--gold-light)]">
          Field notes
        </p>
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-6 h-6 rounded-full border border-[var(--gold-light)] text-[var(--gold-light)]">
            <span className="text-[12px] font-bold">{stampCount}</span>
          </div>
          <span className="text-[11px] uppercase tracking-widest text-white/70">Posted</span>
        </div>
      </div>

      <h3 className="font-[family:var(--font-display)] text-3xl italic text-white">
        Share a find
      </h3>

      <p className="mt-4 text-sm leading-relaxed text-white/70 handwritten">
        Noticed something the guidebook missed? Write it down while it is fresh —
        the next traveller will thank you.
      </p>

      <div className="mt-auto flex flex-col gap-4 pt-8">
        {isLoggedIn ? (
          <button
            type="button"
            onClick={onDispatch}
            className="min-h-12 w-full bg-[var(--paper)] py-4 text-sm font-bold uppercase tracking-[0.14em] text-[var(--night)] transition-colors hover:bg-white"
          >
            Write a note
          </button>
        ) : (
          <button
            type="button"
            onClick={onLogin}
            className="min-h-12 w-full bg-[var(--cinnabar)] py-4 text-sm font-bold uppercase tracking-[0.14em] text-white transition-colors hover:bg-[var(--cinnabar-deep)]"
          >
            Sign in to share
          </button>
        )}
      </div>

      <div className="mt-6 pt-4 border-t border-white/15 text-center">
        <p className="font-mono text-[11px] text-white/40 uppercase tracking-[0.2em]">
          Culvoy community desk
        </p>
      </div>
    </div>
  );
}
