"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ApiRequestError } from "@/lib/api-client";
import {
  calendarDateLabel, calendarMonthDays, calendarMonthLabel, calendarToday,
  createCalendarNote, deleteCalendarNote, fetchCalendarNotes, isCalendarDate,
  shiftCalendarMonth, updateCalendarNote, type CalendarNote,
} from "@/lib/calendar-notes";

const fieldClass = "mt-2 min-h-[50px] w-full border border-[var(--line)] bg-[var(--background)] px-3 py-3 text-base leading-6 text-[var(--river-deep)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--river-deep)]";
const actionClass = "min-h-11 border border-[var(--line)] px-3 py-2 text-sm font-bold text-[var(--river-deep)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--river-deep)] disabled:cursor-not-allowed disabled:opacity-60";
const primaryClass = `${actionClass.replace("text-[var(--river-deep)]", "text-white")} border-[var(--river-deep)] bg-[var(--river-deep)]`;

type Draft = { id?: string; date: string; title: string; body: string; citySlug: string };

function failureMessage(error: unknown, action: string) {
  if (error instanceof ApiRequestError && error.statusCode === 401) return "Your session has expired. Log in again to access your private calendar.";
  if (error instanceof ApiRequestError && error.statusCode === 403) return "A traveler account is required to access this calendar.";
  if (error instanceof ApiRequestError && error.statusCode === 404) return "This note is no longer available. Refresh the notes before trying again.";
  return `Could not ${action}. Please try again.`;
}

// Account changes discard all private state, including in-flight response targets.
export function ProfileCalendar({ userId }: { userId: string }) {
  return <PrivateCalendar key={userId} />;
}

function PrivateCalendar() {
  const id = useId();
  const [selected, setSelected] = useState("");
  const [today, setToday] = useState("");
  const [month, setMonth] = useState("");
  const [result, setResult] = useState<{ month: string; notes: CalendarNote[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [invalid, setInvalid] = useState<"title" | "date" | "body" | "citySlug" | null>(null);
  const [notice, setNotice] = useState("");
  const [deleting, setDeleting] = useState<CalendarNote | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleInput = useRef<HTMLInputElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const deleteTrigger = useRef<HTMLButtonElement | null>(null);
  const alive = useRef(false);
  const mutationInFlight = useRef(false);

  useEffect(() => {
    alive.current = true;
    const current = calendarToday();
    setToday(current);
    setSelected(current);
    setMonth(current.slice(0, 7));
    const refreshToday = () => { if (!document.hidden) setToday(calendarToday()); };
    const interval = window.setInterval(refreshToday, 60000);
    document.addEventListener("visibilitychange", refreshToday);
    return () => {
      alive.current = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshToday);
    };
  }, []);

  useEffect(() => {
    if (!month) return;
    const controller = new AbortController();
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    void fetchCalendarNotes(month, controller.signal).then((notes) => {
      if (!cancelled) setResult({ month, notes });
    }).catch((cause: unknown) => {
      if (!cancelled) {
        setResult(null);
        setLoadError(failureMessage(cause, "load your notes"));
      }
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; controller.abort(); };
  }, [month, reload]);

  const hasDraft = draft !== null;
  const draftId = draft?.id;
  useEffect(() => {
    if (hasDraft) titleInput.current?.focus();
  }, [hasDraft, draftId]); // Changing fields must not steal focus back to the title.

  useEffect(() => {
    if (deleting) dialog.current?.showModal();
    else if (dialog.current?.open) {
      dialog.current.close();
      if (deleteTrigger.current?.isConnected) deleteTrigger.current.focus();
      else addButton.current?.focus();
    }
  }, [deleting]);

  const notes = result?.month === month ? result.notes : [];
  const selectedNotes = notes.filter((note) => note.date === selected);
  const canNavigate = !busy && !draft;

  function selectDate(date: string) {
    setSelected(date);
    setMonth(date.slice(0, 7));
    setNotice("");
    setError("");
  }

  function beginDraft(note?: CalendarNote) {
    setError(""); setInvalid(null); setNotice("");
    setDraft(note
      ? { id: note.id, date: note.date, title: note.title, body: note.body, citySlug: note.citySlug ?? "" }
      : { date: selected, title: "", body: "", citySlug: "" });
  }

  function cancelDraft() {
    setDraft(null); setError(""); setInvalid(null);
    addButton.current?.focus();
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || mutationInFlight.current) return;
    const values = { date: draft.date, title: draft.title.trim(), body: draft.body, citySlug: draft.citySlug.trim() || null };
    const invalidField = !isCalendarDate(values.date) ? "date"
      : !values.title || values.title.length > 160 ? "title"
      : values.body.length > 10000 ? "body"
      : values.citySlug && (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values.citySlug) || values.citySlug.length > 100) ? "citySlug" : null;
    if (invalidField) {
      setInvalid(invalidField);
      setError(invalidField === "date" ? "Choose a valid date." : invalidField === "title" ? "Enter a title of 1 to 160 characters." : invalidField === "body" ? "Keep the note within 10,000 characters." : "Use a city slug such as guangzhou, or leave it blank.");
      return;
    }
    mutationInFlight.current = true;
    setBusy(true); setError(""); setInvalid(null);
    try {
      const saved = draft.id ? await updateCalendarNote(draft.id, values) : await createCalendarNote(values);
      if (!alive.current) return;
      setDraft(null);
      setSelected(saved.date); setMonth(saved.date.slice(0, 7));
      setResult((previous) => previous ? { month: previous.month, notes: [...previous.notes.filter((note) => note.id !== saved.id), saved] } : previous);
      setReload((value) => value + 1);
      setNotice("Note saved.");
      addButton.current?.focus();
    } catch (cause) {
      if (alive.current) setError(failureMessage(cause, "save this note"));
    } finally {
      mutationInFlight.current = false;
      if (alive.current) setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleting || mutationInFlight.current) return;
    mutationInFlight.current = true;
    setBusy(true); setError("");
    try {
      await deleteCalendarNote(deleting.id);
      if (!alive.current) return;
      setResult((previous) => previous ? { ...previous, notes: previous.notes.filter((note) => note.id !== deleting.id) } : previous);
      setDeleting(null); setNotice("Note deleted.");
      setReload((value) => value + 1);
      addButton.current?.focus();
    } catch (cause) {
      if (alive.current) setError(failureMessage(cause, "delete this note"));
    } finally {
      mutationInFlight.current = false;
      if (alive.current) setBusy(false);
    }
  }

  if (!selected) return <p role="status" className="py-8 text-[var(--muted)]">Opening your calendar...</p>;

  return (
    <section aria-labelledby={`${id}-heading`} className="min-w-0">
      <header className="border-t border-[var(--line)] py-6">
        <h2 id={`${id}-heading`} className="font-[family:var(--font-display)] text-3xl text-[var(--river-deep)]">Calendar</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Private notes, saved to your account. Today follows Guangdong time (Asia/Shanghai).</p>
      </header>
      <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-12">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 aria-live="polite" className="mr-auto font-[family:var(--font-display)] text-2xl text-[var(--river-deep)]">{calendarMonthLabel(month)}</h3>
            <button type="button" disabled={!canNavigate} onClick={() => selectDate(calendarToday())} className={actionClass}>Today</button>
            <button type="button" aria-label="Previous month" disabled={!canNavigate || month === "0001-01"} onClick={() => selectDate(`${shiftCalendarMonth(month, -1)}-01`)} className={`${actionClass} min-w-11`}>Previous</button>
            <button type="button" aria-label="Next month" disabled={!canNavigate || month === "9999-12"} onClick={() => selectDate(`${shiftCalendarMonth(month, 1)}-01`)} className={`${actionClass} min-w-11`}>Next</button>
          </div>
          <label className="mt-4 block text-sm text-[var(--river-deep)]" htmlFor={`${id}-select-date`}>Choose date</label>
          <input id={`${id}-select-date`} type="date" min="0001-01-01" max="9999-12-31" value={selected} disabled={!canNavigate} onChange={(event) => { if (isCalendarDate(event.target.value)) selectDate(event.target.value); }} className={fieldClass} />
          <div className="mt-5 overflow-x-auto" aria-label="Month dates">
            <div className="grid min-w-[308px] grid-cols-7">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <span key={day} className="py-3 text-center text-xs text-[var(--muted)]">{day}</span>)}
              {calendarMonthDays(month).map((date, index) => date ? (
                <button key={date} type="button" aria-label={`${calendarDateLabel(date)}${date === today ? ", today" : ""}, ${notes.filter((note) => note.date === date).length} notes`} aria-pressed={selected === date} aria-current={date === today ? "date" : undefined} disabled={!canNavigate} onClick={() => selectDate(date)} className={`relative min-h-11 min-w-11 border border-[var(--line)] text-sm focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-[var(--river-deep)] disabled:cursor-not-allowed ${selected === date ? "bg-[var(--river-deep)] text-white" : "bg-[var(--paper)] text-[var(--river-deep)]"}`}>
                  {Number(date.slice(-2))}
                  {notes.some((note) => note.date === date) ? <span aria-hidden="true" className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-current" /> : null}
                </button>
              ) : <span key={`blank-${index}`} aria-hidden="true" />)}
            </div>
          </div>
          <p className="mt-2 text-xs text-[var(--muted)] min-[340px]:hidden">Swipe the calendar to see all days.</p>
          {draft ? <p className="mt-3 text-sm text-[var(--muted)]">Save or cancel your note before choosing another day.</p> : null}
        </div>
        <div className="min-w-0 border-t border-[var(--line)] pt-5" aria-busy={loading}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-[family:var(--font-display)] text-2xl text-[var(--river-deep)]">{calendarDateLabel(selected)}</h3>
            <button ref={addButton} type="button" disabled={busy || !!draft || loading || !!loadError} onClick={() => beginDraft()} className={primaryClass}>Add note</button>
          </div>
          <p role="status" className="mt-3 text-sm text-[var(--river-deep)]">{notice}</p>
          {loadError ? <div role="alert" className="mt-4"><p className="text-sm text-[var(--cinnabar)]">{loadError}</p><button type="button" onClick={() => setReload((value) => value + 1)} className={`${actionClass} mt-3`}>Retry loading</button></div> : null}
          {loading ? <p role="status" className="py-8 text-[var(--muted)]">Loading your notes...</p> : null}
          {!loading && !loadError && !selectedNotes.length && !draft ? <p className="py-8 text-sm text-[var(--muted)]">No notes for this day. Add one to start planning.</p> : null}
          {!loading && !loadError && !draft ? <ul className="mt-3 grid gap-6">{selectedNotes.map((note) => <li key={note.id} className="min-w-0 border-b border-[var(--line)] pb-5">
            <h4 className="break-words font-[family:var(--font-display)] text-xl text-[var(--river-deep)]">{note.title}</h4>
            {note.citySlug ? <p className="mt-2 break-words text-sm text-[var(--muted)]">City: {note.citySlug}</p> : null}
            <p className="mt-3 whitespace-pre-wrap break-words text-base leading-7 text-[var(--river-deep)]">{note.body}</p>
            <div className="mt-4 flex flex-wrap gap-2"><button type="button" aria-label={`Edit ${note.title}`} onClick={() => beginDraft(note)} className={actionClass}>Edit</button><button type="button" aria-label={`Delete ${note.title}`} onClick={(event) => { deleteTrigger.current = event.currentTarget; setError(""); setDeleting(note); }} className={actionClass}>Delete</button></div>
          </li>)}</ul> : null}
          {draft ? <form onSubmit={save} className="mt-5 grid gap-4" aria-label={draft.id ? "Edit private note" : "New private note"}>
            <h4 className="text-lg text-[var(--river-deep)]">{draft.id ? "Edit note" : "New note"}</h4>
            {(["title", "date", "citySlug"] as const).map((field) => <label key={field} className="block text-sm text-[var(--river-deep)]">
              {field === "citySlug" ? "City slug (optional)" : field === "title" ? "Title" : "Note date"}
              <input ref={field === "title" ? titleInput : undefined} type={field === "date" ? "date" : "text"} required={field !== "citySlug"} min={field === "date" ? "0001-01-01" : undefined} max={field === "date" ? "9999-12-31" : undefined} maxLength={field === "title" ? 160 : field === "citySlug" ? 100 : undefined} value={draft[field]} disabled={busy} onChange={(event) => { setInvalid(null); setDraft({ ...draft, [field]: event.target.value }); }} aria-invalid={invalid === field} aria-describedby={invalid === field ? `${id}-form-error` : undefined} className={fieldClass} />
            </label>)}
            <label className="block text-sm text-[var(--river-deep)]">Note<textarea value={draft.body} maxLength={10000} rows={5} disabled={busy} onChange={(event) => { setInvalid(null); setDraft({ ...draft, body: event.target.value }); }} aria-invalid={invalid === "body"} aria-describedby={invalid === "body" ? `${id}-form-error` : undefined} className={`${fieldClass} resize-y`} /></label>
            {error ? <p id={`${id}-form-error`} role="alert" className="text-sm text-[var(--cinnabar)]">{error}</p> : null}
            <div className="flex flex-wrap gap-2"><button type="submit" disabled={busy} className={primaryClass}>{busy ? "Saving..." : "Save note"}</button><button type="button" disabled={busy} onClick={cancelDraft} className={actionClass}>Cancel</button></div>
          </form> : null}
        </div>
      </div>
      <dialog ref={dialog} aria-labelledby={`${id}-delete-heading`} aria-describedby={`${id}-delete-body`} onCancel={(event) => { if (busy) event.preventDefault(); else { setDeleting(null); setError(""); } }} onClose={() => { if (!busy) { setDeleting(null); setError(""); } }} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto border border-[var(--line)] bg-[var(--paper)] p-6 text-[var(--river-deep)] backdrop:bg-[var(--night)]/50">
        <h3 id={`${id}-delete-heading`} className="font-[family:var(--font-display)] text-2xl">Delete note?</h3>
        <p id={`${id}-delete-body`} className="mt-3 break-words text-base leading-6">Delete “{deleting?.title}”? This cannot be undone.</p>
        {deleting && error ? <p role="alert" className="mt-3 text-sm text-[var(--cinnabar)]">{error}</p> : null}
        <div className="mt-5 flex flex-wrap gap-2"><button autoFocus type="button" disabled={busy} onClick={() => { setDeleting(null); setError(""); }} className={actionClass}>Keep note</button><button type="button" disabled={busy} onClick={() => void confirmDelete()} className={primaryClass}>{busy ? "Deleting..." : "Delete note"}</button></div>
      </dialog>
    </section>
  );
}
