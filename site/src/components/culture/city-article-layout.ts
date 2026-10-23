import type {
  Element,
  ElementContent,
  Properties,
  Root,
  RootContent,
} from "hast";
import { markdownUrl } from "./markdown-url";
import styles from "./CityArticle.module.css";

type Chapter = { heading: Element; nodes: RootContent[] };

function element(
  tagName: string,
  properties: Properties,
  children: ElementContent[],
): Element {
  return { type: "element", tagName, properties, children };
}
function children(nodes: RootContent[]): ElementContent[] {
  return nodes.filter(
    (node): node is ElementContent => node.type !== "doctype",
  );
}
function plainText(node: ElementContent): string {
  if (node.type === "text") return node.value;
  return node.type === "element" ? node.children.map(plainText).join("") : "";
}
function standaloneImage(node: RootContent): Element | undefined {
  if (node.type !== "element") return;
  const meaningful = node.children.filter(
    (child) => child.type !== "text" || child.value.trim(),
  );
  const image =
    node.tagName === "img"
      ? node
      : node.tagName === "p" &&
          meaningful.length === 1 &&
          meaningful[0].type === "element" &&
          meaningful[0].tagName === "img"
        ? meaningful[0]
        : undefined;
  const source = image?.properties.src;
  return typeof source === "string" && markdownUrl(source, "src")
    ? image
    : undefined;
}
function body(nodes: RootContent[], isLead = false): Element {
  const copy: RootContent[] = [];
  const images: Element[] = [];
  for (const node of nodes) {
    const image = standaloneImage(node);
    if (image) images.push(element("figure", { dataCityMedia: true }, [image]));
    else copy.push(node);
  }
  return element(
    "div",
    {
      className: [
        styles.chapterBody,
        images.length ? styles.withMedia : "",
        isLead ? styles.lead : "",
      ].filter(Boolean),
    },
    [
      element("div", { className: [styles.chapterCopy] }, children(copy)),
      ...(images.length
        ? [
            element(
              "aside",
              {
                className: [
                  styles.chapterMedia,
                  images.length > 1 ? styles.mediaGrid : "",
                ].filter(Boolean),
                ariaLabel: "Chapter photographs",
              },
              images,
            ),
          ]
        : []),
    ],
  );
}

/** Runs AFTER rehype-sanitize. All layout properties below are generated here. */
export function rehypeCityArticle() {
  return (tree: Root) => {
    const lead: RootContent[] = [];
    const chapters: Chapter[] = [];
    for (const node of tree.children) {
      if (
        node.type === "element" &&
        (node.tagName === "h1" || node.tagName === "h2")
      ) {
        chapters.push({ heading: node, nodes: [] });
      } else if (chapters.length) {
        chapters[chapters.length - 1].nodes.push(node);
      } else lead.push(node);
    }
    const article: ElementContent[] = [];
    if (lead.some((node) => node.type !== "text" || node.value.trim()))
      article.push(body(lead, true));
    chapters.forEach((chapter, index) => {
      const id = `culture-chapter-${index + 1}`;
      const headingId = `${id}-heading`;
      chapter.heading.properties.id = headingId;
      article.push(
        element(
          "section",
          {
            id,
            className: [styles.chapter],
            dataCityChapter: true,
            tabIndex: -1,
            ariaLabelledBy: [headingId],
          },
          [
            element("header", { className: [styles.chapterHeading] }, [
              chapter.heading,
            ]),
            body(chapter.nodes),
          ],
        ),
      );
    });
    const navigation: ElementContent[] =
      chapters.length > 1
        ? [
            element(
              "nav",
              {
                className: [styles.contents, "bg-grain"],
                ariaLabel: "On this page",
                dataCityContents: true,
              },
              [
                element("p", { className: [styles.contentsTitle] }, [
                  { type: "text", value: "On this page" },
                ]),
                element(
                  "ol",
                  { className: [styles.contentsList] },
                  chapters.map((chapter, index) => {
                    const title = chapter.heading.children
                      .map(plainText)
                      .join("")
                      .trim();
                    return element("li", {}, [
                      element(
                        "a",
                        {
                          href: `#culture-chapter-${index + 1}`,
                          title,
                          dataCityToc: true,
                          dataCityFirst: index === 0,
                        },
                        [{ type: "text", value: title }],
                      ),
                    ]);
                  }),
                ),
              ],
            ),
          ]
        : [];
    tree.children = [
      ...navigation,
      element(
        "div",
        { className: [styles.articleContent], dataCityArticleContent: true },
        article,
      ),
    ];
  };
}
