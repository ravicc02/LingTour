"use client";

import type { FieldBrief } from "@/lib/api-data";

type BriefCardProps = {
  brief: FieldBrief;
  onSelect: (brief: FieldBrief) => void;
  index: number;
};

export function BriefCard({ brief, onSelect, index }: BriefCardProps) {
  // Rotate slightly based on index to look like scattered notes
  const rotations = ["rotate-1", "-rotate-2", "rotate-2", "-rotate-1"];
  const rotation = rotations[index % rotations.length];

  return (
    <button
      onClick={() => onSelect(brief)}
      className={`group flex h-full w-full flex-col border border-[var(--line)] bg-[var(--paper)] p-6 text-left scrapbook-shadow transition-[transform,border-color] duration-300 hover:z-10 hover:scale-[1.03] hover:border-[var(--gold)]/40 sm:p-8 ${rotation}`}
    >
      <div className="flex items-start justify-between border-b border-[var(--line)]/50 pb-4 mb-4">
        <div>
          <p className="font-mono text-[12px] uppercase tracking-widest text-[var(--cinnabar)]">
            Active Brief
          </p>
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--cinnabar)] mt-2">
            {brief.channel}
          </p>
        </div>
        <div className="h-6 w-6 rounded-full border border-[var(--line)] flex items-center justify-center text-[var(--muted)] group-hover:text-[var(--cinnabar)] group-hover:border-[var(--cinnabar)] transition-colors">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </div>
      </div>

      <p className="font-[family:var(--font-display)] text-2xl text-[var(--river-deep)] group-hover:text-[var(--cinnabar)] transition-colors">
        {brief.title}
      </p>

      <p className="mt-4 text-sm leading-relaxed text-[var(--muted)] handwritten line-clamp-3">
        {brief.prompt}
      </p>

      <div className="mt-auto flex flex-wrap gap-2 pt-6">
        {brief.location && (
          <span className="rounded-full bg-[var(--paper)] px-3 py-1 text-[12px] uppercase tracking-widest text-[var(--muted)]">
            @{brief.location}
          </span>
        )}
        {brief.route && (
          <span className="rounded-full bg-[var(--paper)] px-3 py-1 text-[12px] uppercase tracking-widest text-[var(--muted)]">
            #{brief.route}
          </span>
        )}
      </div>
    </button>
  );
}
