import { fireEvent, render, screen, cleanup, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomeAtlasHero } from "@/components/home/HomeAtlasHero";
import { GuangdongMapSection } from "@/components/home/GuangdongMapSection";
import { CityTicket } from "@/components/home/CityTicket";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { RoutesMegaMenu } from "@/components/layout/RoutesMegaMenu";
import { renderCityTicket } from "@/lib/city-ticket-export";

vi.mock("@/lib/motion", () => ({ gsap: {}, useGSAP: vi.fn(), motionMedia: {}, motionDuration: {}, motionEase: {} }));
vi.mock("@/components/ui/Reveal", () => ({ Reveal: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("@/components/layout/AccountNavLink", () => ({ AccountNavLink: () => <a href="/login">Login</a> }));
vi.mock("@/lib/api-data", () => ({ fetchRoutes: vi.fn(async () => []), fetchRouteRegions: vi.fn(async () => []) }));
vi.mock("@/lib/city-ticket-export", () => ({ renderCityTicket: vi.fn(async () => new Blob(["png"], { type: "image/png" })) }));

afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });
const cities = [
  { slug: "chaozhou" as const, name: "Chaozhou", adcode: 445100, label: "Chaoshan", summary: "Real city summary", image: "/uploads/city.jpg", gallery: [], tags: [] },
  { slug: "zhanjiang" as const, name: "Zhanjiang", adcode: 440800, label: "Coast", summary: "Coastal city", image: "/uploads/coast.jpg", gallery: [], tags: [] },
];

describe("home discovery batch", () => {
  it("renders only the current brand and three exact public destinations in hero", () => {
    render(<HomeAtlasHero image="/editorial/coast.jpg" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Culvoy");
    for (const [name, href] of [["Cultural Information", "/culture"], ["Route Planning", "/routes"], ["Interpretation", "/interpreting"]]) expect(screen.getByRole("link", { name })).toHaveAttribute("href", href);
    expect(screen.queryByText(/Deeply|Arranged|Scroll to explore/)).not.toBeInTheDocument();
  });
  it("keeps header and footer terminology aligned with existing URLs", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    render(<><SiteHeader /><SiteFooter /></>);
    expect(screen.getAllByRole("link", { name: "Cultural Information" })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Interpretation" }).every((link) => link.getAttribute("href") === "/interpreting")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(screen.getByRole("dialog", { name: "Mobile navigation" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("supports keyboard route menu toggle and Escape dismissal", () => {
    render(<RoutesMegaMenu active={false} />);
    const toggle = screen.getByRole("button", { name: "Open route regions" });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(toggle).toHaveFocus();
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });
  it("filters actual cities and has no invented city on empty matches/catalogue", () => {
    render(<GuangdongMapSection cities={cities} />);
    fireEvent.click(screen.getByRole("button", { name: "Zhanjiang" }));
    expect(screen.getByRole("link", { name: /Route Planning/ })).toHaveAttribute("href", "/routes?citySlug=zhanjiang");
    expect(screen.getByRole("link", { name: /Interpretation/ })).toHaveAttribute("href", "/interpreting?citySlug=zhanjiang");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Beijing" } });
    expect(screen.getByText("No matching cities")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Know more/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.getByRole("button", { name: "Chaozhou" })).toBeInTheDocument();
    cleanup(); render(<GuangdongMapSection cities={[]} />);
    expect(screen.getByText("City content unavailable")).toBeInTheDocument();
    expect(screen.queryByText("Zhanjiang")).not.toBeInTheDocument();
  });
  it("allows anonymous preview and PNG download with optional fields", async () => {
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:ticket"), revokeObjectURL: vi.fn() }));
    render(<CityTicket cities={cities} />);
    fireEvent.change(screen.getByLabelText("City"), { target: { value: "chaozhou" } });
    fireEvent.click(screen.getByRole("button", { name: "Preview ticket" }));
    const download = await screen.findByRole("link", { name: /Download PNG/ });
    expect(download).toHaveAttribute("download", "culvoy-chaozhou-ticket.png");
    expect(renderCityTicket).toHaveBeenCalledWith(cities[0], { nickname: "", date: "", quote: "" }, expect.any(AbortSignal));
    fireEvent.change(screen.getByLabelText(/Nickname/), { target: { value: "New nickname" } });
    expect(screen.queryByRole("link", { name: /Download PNG/ })).not.toBeInTheDocument();
  });
  it("reports image failure with retry, never fake photo or ticket", async () => {
    vi.mocked(renderCityTicket).mockRejectedValueOnce(new Error("City photograph unavailable."));
    render(<CityTicket cities={cities} />);
    fireEvent.change(screen.getByLabelText("City"), { target: { value: "chaozhou" } });
    fireEvent.click(screen.getByRole("button", { name: "Preview ticket" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("City photograph unavailable."));
    expect(screen.getByRole("button", { name: "Preview ticket" })).not.toBeDisabled();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
