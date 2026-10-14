"use client";

import { useState } from "react";
import { placeholderFor } from "@/lib/placeholders";
import { Reveal } from "@/components/ui/Reveal";
import { RelatedCommunityPosts } from "@/components/community/RelatedCommunityPosts";

export type InterpreterProfile = {
  id: string;
  level?: string;
  levelZh?: string;
  name: string;
  specialty: string;
  languages: string;
  image: string;
  needsPrefill: string;
  bestFor?: string;
};

type Props = {
  profiles: InterpreterProfile[];
  onSelectGuide: (profile: InterpreterProfile) => void;
};

export function InterpreterShowcase({ profiles, onSelectGuide }: Props) {
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  const handleSelect = (profile: InterpreterProfile) => {
    setSelectedProfileId(profile.id);
    onSelectGuide(profile);
    const el = document.getElementById("interpreting-booking");
    if (el) {
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      el.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start",
      });
    }
  };

  return (
    <section className="site-container py-beat">
      <div className="mb-8 opacity-60">
        <Reveal>
          <h2 className="font-[family:var(--font-display)] text-2xl leading-[1.05] tracking-[-0.02em] text-[var(--river-deep)] sm:text-3xl md:text-4xl">
            {"Meet the interpreters"}
          </h2>
        </Reveal>
      </div>

      <div className="scroll-fade-x-lg scrollbar-hide -mx-4 mt-10 flex snap-x snap-mandatory gap-6 overflow-x-auto px-4 pb-8 lg:mx-0 lg:grid lg:grid-cols-3 lg:gap-8 lg:overflow-visible lg:px-0">
        {profiles.map((profile, index) => {
          const isSelected = selectedProfileId === profile.id;

          return (
            <Reveal key={profile.id} delay={index * 100} className="flex h-full w-[82vw] max-w-[24rem] shrink-0 snap-start flex-col lg:w-auto lg:max-w-none lg:shrink lg:snap-none">
              <article
                className={[
                  "group relative flex h-full flex-1 flex-col overflow-hidden bg-[var(--paper)] bg-grain transition-all duration-500 scrapbook-shadow border border-[var(--line)]",
                  index % 2 === 0 ? "sm:rotate-1" : "sm:-rotate-1",
                  isSelected
                    ? "border-[var(--cinnabar)] ring-1 ring-[var(--cinnabar)]/20"
                    : "hover:-translate-y-1.5 hover:rotate-0",
                ].join(" ")}
              >
                <div className="relative aspect-[2/3] shrink-0 overflow-hidden bg-[var(--paper-deep)] border-b border-[var(--line)] lg:aspect-[4/5]">
                  <img
                    src={profile.image || placeholderFor("portrait")}
                    alt={`${profile.name}, Culvoy interpreter`}
                    onError={(event) => {
                      const image = event.currentTarget;
                      image.onerror = null;
                      image.src = placeholderFor("portrait");
                    }}
                    className={[
                      "absolute inset-0 h-full w-full object-cover object-center transition-all duration-1000",
                      isSelected
                        ? "scale-105 grayscale-0"
                        : "grayscale group-hover:scale-110 group-hover:grayscale-0",
                    ].join(" ")}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[var(--river-deep)]/80 via-transparent to-transparent opacity-60" />

                  {profile.level ? <div className="absolute top-4 left-4 z-10">
                    <span className="px-3 py-1 bg-[var(--river-deep)] text-sm text-white">{profile.level}</span>
                  </div> : null}

                  <div className="absolute bottom-6 left-6 right-6 z-10">
                    <p className="mb-1 line-clamp-2 text-[11px] font-bold uppercase leading-snug tracking-[0.16em] text-[var(--gold)] handwritten sm:text-[12px] sm:tracking-[0.2em]">
                      {profile.specialty}
                    </p>
                    <h3 className="font-[family:var(--font-display)] text-2xl leading-tight text-white sm:text-3xl">
                      {profile.name}
                    </h3>
                  </div>
                </div>

                <div className="flex flex-1 flex-col p-5 sm:p-8">
                  <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1">
                      <p className="text-xs leading-relaxed text-[var(--muted)] italic mb-2">
                        {profile.languages}
                      </p>
                      <p className="text-sm leading-6 text-[var(--muted)]">Preference only. Assignment is confirmed after review.</p>
                    </div>
                  </div>

                  {profile.bestFor ? (
                    <div className="mb-8 border border-[var(--gold)]/20 bg-[var(--paper-deep)]/40 p-4 italic">
                      <p className="text-[13px] leading-relaxed text-[var(--muted)] handwritten">
                        &ldquo;{profile.bestFor}&rdquo;
                      </p>
                    </div>
                  ) : null}

                  <button
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => handleSelect(profile)}
                    className={[
                      "btn-primary mt-auto w-full py-4 text-[12px] flex items-center justify-between group/btn",
                      isSelected ? "bg-[var(--cinnabar)]" : ""
                    ].join(" ")}
                  >
                    <span>{isSelected ? "Preferred interpreter" : "Add preference"}</span>
                    <span aria-hidden="true">-&gt;</span>
                  </button>
                </div>
              </article>
            </Reveal>
          );
        })}
      </div>
      {selectedProfileId ? <RelatedCommunityPosts interpreterId={selectedProfileId} title="Interpreter experiences" /> : null}
    </section>
  );
}
