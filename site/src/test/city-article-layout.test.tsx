import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { MarkdownRenderer } from "@/components/culture/MarkdownRenderer";

const article = `Opening context with a [source][guide].

## Tea practice

Tea remains an everyday habit.

![Tea vessels](/uploads/tea.jpg "A tea table")

> Keep the rounds unhurried.

**Tea method** — Small vessels, many rounds.

## Old city

Walk the market lanes.

![Street](/uploads/street.jpg)

| Stop | Time |
| --- | --- |
| Market | Morning |

- [x] Bring water
- [ ] Take a walk

[guide]: https://example.com/guide
`;

const showDescriptor = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  "showModal",
);
const closeDescriptor = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  "close",
);
beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = false;
      fireEvent(this, new Event("close"));
    },
  });
});
afterAll(() => {
  if (showDescriptor)
    Object.defineProperty(
      HTMLDialogElement.prototype,
      "showModal",
      showDescriptor,
    );
  else Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
  if (closeDescriptor)
    Object.defineProperty(
      HTMLDialogElement.prototype,
      "close",
      closeDescriptor,
    );
  else Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
});
afterEach(cleanup);

describe("city article reading layout", () => {
  it("groups existing chapter text and photographs without dropping quotes, facts or reference links", () => {
    const { container } = render(
      <MarkdownRenderer content={article} layout="city" />,
    );
    const navigation = within(
      screen.getByRole("navigation", { name: "On this page" }),
    );
    expect(
      navigation.getByRole("link", { name: "Tea practice" }),
    ).toHaveAttribute("href", "#culture-chapter-1");
    expect(navigation.getByRole("link", { name: "Old city" })).toHaveAttribute(
      "href",
      "#culture-chapter-2",
    );
    expect(
      navigation.getByRole("link", { name: "Tea practice" }),
    ).toHaveAttribute("aria-current", "location");
    const tea = screen.getByRole("region", { name: "Tea practice" });
    expect(
      within(tea).getByText("Tea remains an everyday habit."),
    ).toBeInTheDocument();
    expect(
      within(tea).getByText("Keep the rounds unhurried."),
    ).toBeInTheDocument();
    expect(within(tea).getByText("Tea method")).toBeInTheDocument();
    expect(tea.querySelector("aside img")).toHaveAttribute(
      "src",
      "/uploads/tea.jpg",
    );
    expect(screen.getByRole("link", { name: "source" })).toHaveAttribute(
      "href",
      "https://example.com/guide",
    );
    expect(
      screen.getByRole("region", { name: "Article table" }),
    ).toHaveTextContent("Morning");
    expect(
      screen.getByRole("checkbox", { name: "Completed item" }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Incomplete item" }),
    ).toBeDisabled();
    expect(container.querySelectorAll("[data-city-chapter]")).toHaveLength(2);
  });

  it("gives duplicate and formatted titles unique safe anchors", () => {
    const { container } = render(
      <MarkdownRenderer
        content={"## Same *title*\n\nFirst.\n\n## Same *title*\n\nSecond."}
        layout="city"
      />,
    );
    const links = within(
      screen.getByRole("navigation", { name: "On this page" }),
    ).getAllByRole("link", { name: "Same title" });
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "#culture-chapter-1",
      "#culture-chapter-2",
    ]);
    expect(
      container.querySelectorAll("#culture-chapter-1-heading"),
    ).toHaveLength(1);
    expect(
      container.querySelectorAll("#culture-chapter-2-heading"),
    ).toHaveLength(1);
  });

  it("does not fabricate a contents rail or media column for a short text-only article", () => {
    const { container } = render(
      <MarkdownRenderer
        content={"## A short note\n\nA real paragraph."}
        layout="city"
      />,
    );
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(container.querySelector("aside")).toBeNull();
    expect(screen.getByText("A real paragraph.")).toBeInTheDocument();
  });

  it("retains content without headings and handles empty draft text", () => {
    const { container, rerender } = render(
      <MarkdownRenderer content="An unsectioned note." layout="city" />,
    );
    expect(screen.getByText("An unsectioned note.")).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    rerender(<MarkdownRenderer content="" layout="city" />);
    expect(
      container.querySelector("[data-city-article-content]"),
    ).toBeEmptyDOMElement();
  });

  it("keeps linked inline images as links instead of nesting interactive controls", () => {
    render(
      <MarkdownRenderer
        content={
          "## Field note\n\n[![Linked city](/uploads/city.jpg)](/culture/chaozhou)"
        }
        layout="city"
      />,
    );
    expect(screen.getByRole("link", { name: "Linked city" })).toHaveAttribute(
      "href",
      "/culture/chaozhou",
    );
    expect(
      screen.queryByRole("button", { name: /Enlarge/ }),
    ).not.toBeInTheDocument();
  });

  it("sanitizes content before adding the trusted reading layout", () => {
    const { container } = render(
      <MarkdownRenderer
        content={
          '## Safe chapter\n\n<script>alert(1)</script><iframe src="/secret"></iframe><svg onload="alert(1)"></svg>\n\n<h2 id="location" onclick="alert(1)">Second chapter</h2>\n\n<a data-city-toc="true" href="javascript:alert(1)">Unsafe link</a>\n\n![Unsafe](//evil.example/a.jpg)\n\n<img src="data:text/html,bad" onerror="alert(1)">'
        }
        layout="city"
      />,
    );
    expect(
      container.querySelector(
        "script,iframe,svg,[onclick],[onerror],#location",
      ),
    ).toBeNull();
    expect(screen.getByText("Unsafe link")).not.toHaveAttribute("href");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(container.querySelectorAll("[data-city-toc]")).toHaveLength(2);
  });

  it("opens the full photograph, locks background scroll and restores focus on close", () => {
    render(
      <MarkdownRenderer
        content={"## Tea\n\n![Tea vessels](/uploads/tea.jpg)"}
        layout="city"
      />,
    );
    const trigger = screen.getByRole("button", {
      name: "Enlarge image: Tea vessels",
    });
    trigger.focus();
    const previousOverflow = document.body.style.overflow;
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Image: Tea vessels" });
    expect(dialog).toHaveAttribute("open");
    expect(
      within(dialog).getByRole("img", { name: "Tea vessels" }),
    ).toHaveAttribute("src", "/uploads/tea.jpg");
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Close image" }),
    );
    expect(dialog).not.toHaveAttribute("open");
    expect(document.body.style.overflow).toBe(previousOverflow);
    expect(trigger).toHaveFocus();
  });
});
