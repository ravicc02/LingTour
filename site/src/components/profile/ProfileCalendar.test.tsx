import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileCalendar } from "@/components/profile/ProfileCalendar";
import { ApiRequestError } from "@/lib/api-client";
import type { CalendarNote } from "@/lib/calendar-notes";

const api = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() }));
vi.mock("@/lib/calendar-notes", async (original) => ({
  ...await original<typeof import("@/lib/calendar-notes")>(),
  calendarToday: () => "2026-10-08",
  fetchCalendarNotes: api.list,
  createCalendarNote: api.create,
  updateCalendarNote: api.update,
  deleteCalendarNote: api.remove,
}));
const note: CalendarNote = { id: "note-1", userId: "traveler-1", date: "2026-10-08", title: "Tea house visit", body: "Ask about opening hours.", citySlug: "chaozhou", createdAt: "2026-10-08T00:00:00Z", updatedAt: "2026-10-08T00:00:00Z" };

beforeEach(() => {
  api.list.mockReset().mockResolvedValue([]);
  api.create.mockReset().mockResolvedValue(note);
  api.update.mockReset().mockResolvedValue(note);
  api.remove.mockReset().mockResolvedValue(undefined);
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); this.querySelector<HTMLButtonElement>("button")?.focus(); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); this.dispatchEvent(new Event("close")); };
});
afterEach(cleanup);

async function ready() {
  await waitFor(() => expect(screen.queryByText("Loading your notes...")).not.toBeInTheDocument());
}

function fillDraft(title = "Tea house visit") {
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: title } });
  fireEvent.change(screen.getByLabelText("Note"), { target: { value: "Ask about opening hours." } });
  fireEvent.change(screen.getByLabelText("City slug (optional)"), { target: { value: "chaozhou" } });
}

describe("Profile private calendar regression", () => {
  it("contains the seven 44px day columns on compact phones without squeezing touch targets", async () => {
    render(<ProfileCalendar userId="traveler-1" />);
    await ready();
    const firstDay = screen.getByRole("button", { name: "1 October 2026, 0 notes" });
    expect(firstDay).toHaveClass("min-h-11", "min-w-11");
    expect(firstDay.parentElement).toHaveClass("grid-cols-7", "min-w-[308px]");
    expect(firstDay.parentElement?.parentElement).toHaveClass("overflow-x-auto");
    expect(screen.getByText("Swipe the calendar to see all days.")).toHaveClass("min-[340px]:hidden");
    expect(screen.getByLabelText("Choose date")).toHaveClass("text-base");
    expect(screen.getByRole("button", { name: "Add note" })).toHaveClass("text-white", "bg-[var(--river-deep)]");
    expect(screen.getByRole("button", { name: "Add note" })).not.toHaveClass("text-[var(--river-deep)]");
  });

  it("defaults to today, selects empty dates and navigates months without jumping to a note", async () => {
    api.list.mockResolvedValue([note]);
    render(<ProfileCalendar userId="traveler-1" />);
    await ready();
    expect(screen.getByRole("heading", { name: "October 2026" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "8 October 2026, today, 1 notes" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "9 October 2026, 0 notes" }));
    expect(screen.getByText(/No notes for this day/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    await ready();
    expect(api.list).toHaveBeenLastCalledWith("2026-11", expect.any(AbortSignal));
    expect(screen.getByRole("heading", { name: "November 2026" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    await ready();
    expect(screen.getByLabelText("Choose date")).toHaveValue("2026-10-08");
  });

  it("reports loading errors, supports retry and does not pretend an error is an empty calendar", async () => {
    api.list.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([note]);
    render(<ProfileCalendar userId="traveler-1" />);
    await screen.findByRole("button", { name: "Retry loading" });
    expect(screen.getByRole("alert")).toHaveTextContent("Could not load your notes");
    expect(screen.queryByText(/No notes for this day/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry loading" }));
    await screen.findByRole("heading", { name: note.title });
  });

  it("saves through the API, re-fetches, survives component refresh and supports same-day notes", async () => {
    render(<ProfileCalendar userId="traveler-1" />);
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Add note" }));
    expect(screen.getByLabelText("Title")).toHaveFocus();
    fillDraft();
    api.list.mockResolvedValue([note, { ...note, id: "note-2", title: "Evening plans" }]);
    fireEvent.click(screen.getByRole("button", { name: "Save note" }));
    await screen.findByText("Note saved.");
    expect(api.create).toHaveBeenCalledWith({ date: "2026-10-08", title: note.title, body: note.body, citySlug: "chaozhou" });
    await screen.findByRole("heading", { name: "Evening plans" });
    cleanup();
    render(<ProfileCalendar userId="traveler-1" />);
    await screen.findByRole("heading", { name: note.title });
    expect(screen.getByRole("heading", { name: "Evening plans" })).toBeInTheDocument();
  });

  it("retains failed drafts for retry, locks date navigation and links field errors", async () => {
    api.create.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(note);
    render(<ProfileCalendar userId="traveler-1" />);
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Add note" }));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "   " } });
    fireEvent.submit(screen.getByRole("form", { name: "New private note" }));
    expect(screen.getByLabelText("Title")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Title")).toHaveAttribute("aria-describedby");
    expect(api.create).not.toHaveBeenCalled();
    fillDraft();
    expect(screen.getByRole("button", { name: "Next month" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Save note" }));
    await screen.findByText("Could not save this note. Please try again.");
    expect(screen.getByLabelText("Title")).toHaveValue(note.title);
    fireEvent.click(screen.getByRole("button", { name: "Save note" }));
    await screen.findByText("Note saved.");
    expect(api.create).toHaveBeenCalledTimes(2);
  });

  it("edits only the chosen note, supports moving date and clearing optional city", async () => {
    api.list.mockResolvedValue([note]);
    api.update.mockResolvedValue({ ...note, date: "2026-11-03", citySlug: null });
    render(<ProfileCalendar userId="traveler-1" />);
    await screen.findByRole("heading", { name: note.title });
    fireEvent.click(screen.getByRole("button", { name: `Edit ${note.title}` }));
    fireEvent.change(screen.getByLabelText("Note date"), { target: { value: "2026-11-03" } });
    fireEvent.change(screen.getByLabelText("City slug (optional)"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save note" }));
    await screen.findByText("Note saved.");
    expect(api.update).toHaveBeenCalledWith(note.id, { date: "2026-11-03", title: note.title, body: note.body, citySlug: null });
    expect(screen.getByLabelText("Choose date")).toHaveValue("2026-11-03");
  });

  it("requires deletion confirmation, keeps note on cancel and retries API deletion failures", async () => {
    api.list.mockResolvedValue([note]);
    api.remove.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(undefined);
    render(<ProfileCalendar userId="traveler-1" />);
    await screen.findByRole("heading", { name: note.title });
    const trigger = screen.getByRole("button", { name: `Delete ${note.title}` });
    fireEvent.click(trigger);
    let modal = screen.getByRole("dialog");
    expect(within(modal).getByRole("button", { name: "Keep note" })).toHaveFocus();
    expect(api.remove).not.toHaveBeenCalled();
    fireEvent.click(within(modal).getByRole("button", { name: "Keep note" }));
    expect(trigger).toHaveFocus();
    expect(api.remove).not.toHaveBeenCalled();
    fireEvent.click(trigger);
    modal = screen.getByRole("dialog");
    fireEvent.click(within(modal).getByRole("button", { name: "Delete note" }));
    await within(modal).findByText("Could not delete this note. Please try again.");
    api.list.mockResolvedValue([]);
    fireEvent.click(within(modal).getByRole("button", { name: "Delete note" }));
    await screen.findByText("Note deleted.");
    expect(api.remove).toHaveBeenCalledWith(note.id);
    await waitFor(() => expect(screen.queryByRole("heading", { name: note.title })).not.toBeInTheDocument());
  });

  it("announces expired sessions and never uses localStorage to hold private notes", async () => {
    const storage = vi.spyOn(Storage.prototype, "setItem");
    api.list.mockRejectedValue(new ApiRequestError({ statusCode: 401, message: "expired" }));
    render(<ProfileCalendar userId="traveler-1" />);
    await screen.findByText(/Your session has expired/);
    expect(storage).not.toHaveBeenCalled();
    storage.mockRestore();
  });

  it("isolates stale month responses and clears private state on account change", async () => {
    let resolveOld!: (notes: CalendarNote[]) => void;
    api.list.mockImplementationOnce(() => new Promise<CalendarNote[]>((resolve) => { resolveOld = resolve; })).mockResolvedValue([]);
    const view = render(<ProfileCalendar userId="traveler-1" />);
    await waitFor(() => expect(api.list).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    await ready();
    resolveOld([note]);
    await waitFor(() => expect(screen.getByRole("heading", { name: "November 2026" })).toBeInTheDocument());
    expect(screen.queryByRole("heading", { name: note.title })).not.toBeInTheDocument();
    view.rerender(<ProfileCalendar userId="traveler-2" />);
    await ready();
    expect(screen.getByLabelText("Choose date")).toHaveValue("2026-10-08");
    expect(screen.queryByRole("heading", { name: note.title })).not.toBeInTheDocument();
  });
});
