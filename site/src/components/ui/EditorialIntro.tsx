import type { ReactNode } from "react";

type EditorialIntroProps = {
  eyebrow: string;
  title: string;
  description: ReactNode;
  tone?: "light" | "dark";
  actions?: ReactNode;
  className?: string;
};

export function EditorialIntro({
  title,
  tone = "light",
  actions,
  className = "",
}: EditorialIntroProps) {
  const isDark = tone === "dark";

  return (
    <div
      className={`ui-editorial-intro site-container ${actions ? "grid items-center gap-7 lg:grid-cols-[minmax(0,1fr)_auto]" : ""} ${className}`}
    >
      <div className="max-w-4xl">

        <h1
          className={`max-w-[16ch] font-[family:var(--font-display)] text-[2.35rem] leading-[1.08] sm:text-4xl md:text-5xl lg:text-6xl ${
            isDark ? "text-white" : "text-[var(--river-deep)]"
          }`}
        >
          {title}
        </h1>
      </div>

      {actions ? <div className="flex flex-col gap-3 sm:flex-row">{actions}</div> : null}

    </div>
  );
}
