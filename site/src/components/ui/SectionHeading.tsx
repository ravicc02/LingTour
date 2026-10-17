type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  className?: string;
};

export function SectionHeading({
  title,
  align = "left",
  className = "",
}: SectionHeadingProps) {
  const alignment = align === "center" ? "mx-auto text-center" : "";

  return (
    <div className={["space-y-3", alignment, className].filter(Boolean).join(" ")}>

      <h2 className="font-[family:var(--font-display)] text-3xl text-[var(--deep-blue)] md:text-4xl">
        {title}
      </h2>

    </div>
  );
}
