/** Shared URL policy for sanitized Markdown and generated reading layouts. */
export function markdownUrl(url: string, key: string) {
  const value = url.trim();
  if (!value || /[\s\\]/.test(value) || value.startsWith("//"))
    return undefined;
  if (
    Array.from(value).some(
      (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127,
    )
  )
    return undefined;
  const scheme = /^([a-z][a-z\d+.-]*):/i.exec(value)?.[1]?.toLowerCase();
  if (
    !scheme ||
    scheme === "https" ||
    scheme === "http" ||
    (key === "href" && scheme === "mailto")
  )
    return value;
  return undefined;
}
