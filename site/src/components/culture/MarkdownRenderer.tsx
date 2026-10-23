"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import Markdown, { type Components, type ExtraProps } from "react-markdown";
import type { Element } from "hast";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { ArticleImage } from "./ArticleImage";
import { rehypeCityArticle } from "./city-article-layout";
import { markdownUrl } from "./markdown-url";
import styles from "./MarkdownRenderer.module.css";
import cityStyles from "./CityArticle.module.css";

export { markdownUrl } from "./markdown-url";

const schema = {
  ...defaultSchema,
  tagNames: [
    "p",
    "br",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "strong",
    "em",
    "del",
    "u",
    "blockquote",
    "ul",
    "ol",
    "li",
    "hr",
    "a",
    "img",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
    "pre",
    "code",
    "input",
  ],
  attributes: {
    a: ["href", "title"],
    img: ["src", "alt", "title", "width", "height"],
    ol: ["start"],
    li: [["className", "task-list-item"]],
    ul: [["className", "contains-task-list"]],
    input: [["type", "checkbox"], "checked", "disabled"],
    th: ["align"],
    td: ["align"],
  },
  protocols: { href: ["http", "https", "mailto"], src: ["http", "https"] },
};

const ReadingPosition = createContext<string | null>(null);

function ArticleLink({
  node,
  href,
  children,
  ...props
}: ComponentProps<"a"> & ExtraProps) {
  const active = useContext(ReadingPosition);
  const isContents = Boolean(node?.properties.dataCityToc);
  const current =
    isContents &&
    (active ? href === `#${active}` : node?.properties.dataCityFirst);
  return (
    <a {...props} href={href} aria-current={current ? "location" : undefined}>
      {children}
    </a>
  );
}
function ArticleFigure({
  node,
  children,
  ...props
}: ComponentProps<"figure"> & ExtraProps) {
  if (!node?.properties.dataCityMedia)
    return <figure {...props}>{children}</figure>;
  const image = node.children.find(
    (child): child is Element =>
      child.type === "element" && child.tagName === "img",
  );
  const source = image?.properties.src;
  if (typeof source !== "string" || !markdownUrl(source, "src")) return null;
  const properties = image!.properties;
  return (
    <figure className={cityStyles.articleFigure}>
      <ArticleImage
        src={source}
        alt={typeof properties.alt === "string" ? properties.alt : ""}
        title={
          typeof properties.title === "string" ? properties.title : undefined
        }
        width={
          typeof properties.width === "number" ||
          typeof properties.width === "string"
            ? properties.width
            : undefined
        }
        height={
          typeof properties.height === "number" ||
          typeof properties.height === "string"
            ? properties.height
            : undefined
        }
      />
    </figure>
  );
}

const components: Components = {
  h1: ({ children, id }) => <h2 id={id}>{children}</h2>,
  p: ({ node, children, ...props }) =>
    node?.children.length === 1 &&
    node.children[0]?.type === "element" &&
    node.children[0].tagName === "img" ? (
      <figure>{children}</figure>
    ) : (
      <p {...props}>{children}</p>
    ),
  img: ({ src, alt, title, width, height }) =>
    typeof src === "string" && src ? (
      <img
        src={src}
        alt={alt ?? ""}
        title={title}
        width={width}
        height={height}
        loading="lazy"
        decoding="async"
      />
    ) : null,
  figure: ArticleFigure,
  a: ArticleLink,
  table: ({ children }) => (
    <div
      className={styles.tableScroll}
      role="region"
      aria-label="Article table"
      tabIndex={0}
    >
      <table>{children}</table>
    </div>
  ),
  input: ({ checked }) => (
    <input
      type="checkbox"
      checked={Boolean(checked)}
      disabled
      aria-label={checked ? "Completed item" : "Incomplete item"}
    />
  ),
};

export function MarkdownRenderer({
  content,
  layout = "default",
}: {
  content: string;
  layout?: "default" | "city";
}) {
  const root = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    if (
      layout !== "city" ||
      !root.current ||
      typeof IntersectionObserver === "undefined"
    )
      return;
    const chapters = Array.from(
      root.current.querySelectorAll<HTMLElement>("[data-city-chapter]"),
    );
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        const current = chapters.find((chapter) => visible.has(chapter.id));
        if (current) setActive(current.id);
      },
      { rootMargin: "-108px 0px -45% 0px" },
    );
    chapters.forEach((chapter) => observer.observe(chapter));
    return () => observer.disconnect();
  }, [content, layout]);

  const article = useMemo(
    () => (
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          rehypeRaw,
          [rehypeSanitize, schema],
          ...(layout === "city" ? [rehypeCityArticle] : []),
        ]}
        urlTransform={markdownUrl}
        components={components}
      >
        {content}
      </Markdown>
    ),
    [content, layout],
  );
  return (
    <ReadingPosition.Provider value={active}>
      <div
        ref={root}
        className={`${styles.prose} ${layout === "city" ? cityStyles.editorial : ""}`}
        data-markdown-article
      >
        {article}
      </div>
    </ReadingPosition.Provider>
  );
}
