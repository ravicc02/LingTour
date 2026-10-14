"use client";

import { useEffect, useRef, useState } from "react";
import { Reveal } from "@/components/ui/Reveal";
import { AUTH_PROMPTS } from "@/lib/auth-prompts";
import { useLocale } from "@/lib/locale-context";
import { apiClient, ApiRequestError } from "@/lib/api-client";
import type { CommunityPostMedia } from "@/lib/api-data";

/** 单帖媒体上限，与 API 的 COMMUNITY_POST_MEDIA_LIMIT 对齐。 */
const FIELD_KIT_MEDIA_LIMIT = 9;

/**
 * One picker for both community media kinds. A live photo (实况图) is just a
 * file the traveller picked, so this input accepts photos and live clips at
 * once; the media type is derived from the file itself, never from which
 * control was used.
 */
const COMMUNITY_MEDIA_ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,video/x-m4v";

type FieldKitProps<TChannel extends string> = {
  isOpen: boolean;
  onClose: () => void;
  isLoggedIn?: boolean;
  onRequireLogin?: () => void;
  onPublish: (draft: {
    title: string;
    note: string;
    channel: TChannel;
    media?: CommunityPostMedia[];
  }) => void | Promise<void>;
  initialBrief?: {
    title: string;
    channel: TChannel;
    prompt: string;
  };
  initialDraft?: {
    title?: string;
    note?: string;
    channel?: TChannel;
    media?: CommunityPostMedia[];
  };
  channels: readonly ["All", ...TChannel[]];
  compact?: boolean;
};

export function FieldKit<TChannel extends string>({
  isOpen,
  onClose,
  isLoggedIn = false,
  onRequireLogin,
  onPublish,
  initialBrief,
  initialDraft,
  channels,
  compact = false,
}: FieldKitProps<TChannel>) {
  const { t } = useLocale();
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [activeChannel, setActiveChannel] = useState<TChannel>(channels[1]);
  const [media, setMedia] = useState<CommunityPostMedia[]>([]);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const submittingRef = useRef(false);
  const locked = !isLoggedIn;

  submittingRef.current = submitting;

  useEffect(() => {
    if (initialBrief) {
      setActiveChannel(initialBrief.channel);
    }
  }, [initialBrief]);

  useEffect(() => {
    if (!isOpen) return;
    if (initialBrief?.channel) {
      setActiveChannel(initialBrief.channel);
    }
    if (initialDraft?.channel && channels.includes(initialDraft.channel)) {
      setActiveChannel(initialDraft.channel);
    }
    setTitle(initialDraft?.title ?? "");
    setNote(initialDraft?.note ?? "");
    setMedia(initialDraft?.media ?? []);
    setError(null);
    setSubmitting(false);
  }, [channels, initialBrief, initialDraft, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (!submittingRef.current) onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.offsetParent !== null);
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previous;
      previouslyFocused?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const uploadOne = async (file: File): Promise<CommunityPostMedia> => {
    const formData = new FormData();
    formData.append("file", file);
    const data = await apiClient<{ url: string }>("/public/community/upload", {
      method: "POST",
      body: formData,
    });
    return {
      // A live photo is a media image variant; browsers hand it over as a
      // `video/*` container, which is the only thing that distinguishes it
      // from a photo here.
      type: file.type.startsWith("video/") ? "live" : "image",
      url: data.url,
    };
  };

  const handleMediaUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (locked) {
      const message = AUTH_PROMPTS.connectGoogleToUpload;
      setError(message);
      onRequireLogin?.();
      event.currentTarget.value = "";
      return;
    }

    const files = Array.from(event.target.files ?? []);
    event.currentTarget.value = "";
    if (!files.length) return;

    const room = FIELD_KIT_MEDIA_LIMIT - media.length;
    if (room <= 0) {
      setError(`Up to ${FIELD_KIT_MEDIA_LIMIT} photos per note.`);
      return;
    }
    const accepted = files.slice(0, room);
    if (accepted.length < files.length) {
      setError(`Up to ${FIELD_KIT_MEDIA_LIMIT} photos per note.`);
    }

    setMediaUploading(true);
    setError(null);
    const uploaded: CommunityPostMedia[] = [];
    try {
      // Serial on purpose: the community upload endpoints are throttled to
      // 10 requests per minute per user, and parallel bursts would trip it.
      for (const file of accepted) {
        uploaded.push(await uploadOne(file));
      }
      setMedia((current) => [...current, ...uploaded].slice(0, FIELD_KIT_MEDIA_LIMIT));
    } catch (uploadError) {
      if (uploadError instanceof ApiRequestError && uploadError.statusCode === 401) {
        setError(AUTH_PROMPTS.connectGoogleToUpload);
        onRequireLogin?.();
        return;
      }
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : t("community.error.imageUploadFailed"),
      );
    } finally {
      setMediaUploading(false);
    }
  };

  const canPublish = Boolean(
    !locked && (title.trim() || note.trim() || media.length) && !mediaUploading,
  );

  const handlePublish = async () => {
    if (!canPublish || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      await onPublish({
        title,
        note,
        channel: activeChannel,
        media: media.length ? media : undefined,
      });
      setTitle("");
      setNote("");
      setMedia([]);
    } catch (publishError) {
      setError(
        publishError instanceof Error
          ? publishError.message
          : t("community.error.dispatchFailed"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto overscroll-contain p-3 sm:p-6">
      <button
        type="button"
        aria-label="Close field note kit"
        aria-hidden="true"
        tabIndex={-1}
        className="absolute inset-0 bg-[var(--night)]/50 backdrop-blur-[2px]"
        onClick={() => {
          if (!submitting) onClose();
        }}
      />

      <Reveal delay={0} className={`relative z-10 my-auto w-full ${compact ? "max-w-2xl" : "max-w-[42rem]"}`}>
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="field-kit-title"
          className="relative flex max-h-[calc(100dvh-1.5rem)] w-full flex-col overflow-hidden border border-[var(--line)] journal-paper scrapbook-shadow sm:max-h-[calc(100dvh-3rem)]"
        >
          {!compact ? (
            <div className="pointer-events-none absolute bottom-0 left-6 top-0 hidden w-8 flex-col justify-around py-8 opacity-20 sm:flex">
              {Array.from({ length: 12 }).map((_, index) => (
                <div
                  key={index}
                  className="h-3 w-8 rounded-full border-2 border-[var(--river-deep)]"
                />
              ))}
            </div>
          ) : null}

          <div
            className={`min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain ${
              compact
                ? "p-5 sm:p-7"
                : "p-5 sm:p-10 sm:pl-20"
            }`}
          >
            <div
              className={`flex items-center justify-between border-b-2 border-[var(--line)] ${
                compact ? "mb-5 pb-4" : "mb-8 pb-6"
              }`}
            >
              <div>
                <h2
                  id="field-kit-title"
                  className={`font-[family:var(--font-display)] text-[var(--river-deep)] ${
                    compact ? "text-2xl" : "text-3xl"
                  }`}
                >
                  Field Note Kit
                </h2>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                disabled={submitting}
                aria-label="Close field note kit"
                className="flex h-11 w-11 items-center justify-center border border-[var(--line)] text-xl text-[var(--muted)] transition-colors hover:border-[var(--cinnabar)] hover:text-[var(--cinnabar)] disabled:opacity-40"
              >
                ×
              </button>
            </div>

            {locked ? (
              <div className="mb-6 rounded-[var(--radius-sm)] border border-[var(--cinnabar)]/25 bg-[var(--cinnabar)]/8 px-4 py-3">
                <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-[var(--cinnabar)]">
                  {AUTH_PROMPTS.connectGoogleToUpload}
                </p>
              </div>
            ) : null}

            {initialBrief ? (
              <div
                className={`border border-[var(--gold)]/20 bg-[var(--gold)]/10 ${
                  compact ? "mb-5 rounded-[var(--radius-sm)] p-4" : "mb-8 rounded-[var(--radius-sm)] p-5 rotate-[-1deg]"
                }`}
              >
                <p className="text-[12px] font-bold uppercase tracking-widest text-[var(--gold)]">
                  Active Brief
                </p>
                <p
                  className={`mt-1 font-[family:var(--font-display)] text-[var(--river-deep)] ${
                    compact ? "text-lg" : "text-xl"
                  }`}
                >
                  {initialBrief.title}
                </p>
                <p className="mt-2 text-sm italic leading-relaxed text-[var(--muted)]">
                  &ldquo;{initialBrief.prompt}&rdquo;
                </p>
              </div>
            ) : null}

            <div className={compact ? "grid gap-5" : "space-y-8"}>
              <div>
                <label className="mb-2 block text-[12px] font-bold uppercase tracking-widest text-[var(--muted)]">
                  Category
                </label>
                <div className="flex flex-wrap gap-2">
                  {channels
                    .filter((channel): channel is TChannel => channel !== "All")
                    .map((channel) => (
                  <button
                        type="button"
                        disabled={locked}
                        key={channel}
                        onClick={() => setActiveChannel(channel)}
                        aria-pressed={activeChannel === channel}
                        className={`min-h-11 rounded-full px-4 py-2 text-xs font-bold transition-colors ${
                          locked
                            ? "cursor-not-allowed bg-[var(--paper)]/40 text-[var(--muted)] opacity-50"
                            : activeChannel === channel
                            ? "scale-105 bg-[var(--river-deep)] text-white shadow-md"
                            : "bg-[var(--paper)]/70 text-[var(--muted)] hover:bg-[var(--paper)]"
                        }`}
                      >
                        {channel}
                      </button>
                    ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-[12px] font-bold uppercase tracking-widest text-[var(--muted)]">
                  Note title
                </label>
                <input
                  type="text"
                  value={title}
                  disabled={locked}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={t("community.fieldKit.titlePlaceholder")}
                  className={`w-full border-b border-[var(--line)] bg-transparent py-2 font-[family:var(--font-display)] outline-none transition-colors focus:border-[var(--gold)] placeholder:opacity-30 ${
                    locked ? "cursor-not-allowed opacity-50" : ""
                  } ${compact ? "text-xl" : "text-2xl"}`}
                />
              </div>

              <div>
                <label className="mb-2 block text-[12px] font-bold uppercase tracking-widest text-[var(--muted)]">
                  Observation Detail
                </label>
                <textarea
                  rows={compact ? 4 : 5}
                  value={note}
                  disabled={locked}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder={t("community.fieldKit.notePlaceholder")}
                  className={`w-full resize-none rounded-[var(--radius-sm)] border border-dashed border-[var(--line)] bg-transparent p-4 leading-relaxed outline-none transition-colors focus:border-[var(--gold)] placeholder:opacity-30 handwritten ${
                    locked ? "cursor-not-allowed opacity-50" : ""
                  } ${compact ? "text-base" : "text-lg"}`}
                />
              </div>

              <div>
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <label className="block text-[12px] font-bold uppercase tracking-widest text-[var(--muted)]">
                    Photos &amp; live moments (optional)
                  </label>
                  <span className="font-mono text-[12px] uppercase tracking-[0.16em] text-[var(--muted)]">
                    {media.length}/{FIELD_KIT_MEDIA_LIMIT}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {media.map((item, index) => (
                    <div
                      key={`${item.url}-${index}`}
                      className={`group relative overflow-hidden rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--paper)] ${
                        compact ? "aspect-square" : "aspect-square"
                      }`}
                    >
                      {item.type === "live" ? (
                        <video
                          src={item.url}
                          muted
                          loop
                          playsInline
                          preload="metadata"
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      ) : (
                        <img
                          src={item.url}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setMedia((current) =>
                            current.filter((_, i) => i !== index),
                          )
                        }
                        disabled={locked || submitting}
                        aria-label={`Remove media ${index + 1}`}
                        className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--night)]/60 text-xs text-white transition-colors hover:bg-[var(--cinnabar)]"
                      >
                        ×
                      </button>
                    </div>
                  ))}

                  {media.length < FIELD_KIT_MEDIA_LIMIT ? (
                    <>
                      <label
                        className={`group flex flex-col items-center justify-center overflow-hidden rounded-[var(--radius-sm)] border border-dashed border-[var(--line)] bg-[var(--paper)]/40 transition-colors ${
                          locked
                            ? "cursor-not-allowed opacity-50"
                            : "cursor-pointer hover:border-[var(--gold)]"
                        } aspect-square`}
                      >
                        <span className="text-2xl text-[var(--muted)] group-hover:text-[var(--gold)]">
                          +
                        </span>
                        <span className="mt-1 px-2 text-center text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--muted)] group-hover:text-[var(--gold)]">
                          Add photos
                        </span>
                        <input
                          type="file"
                          className="hidden"
                          accept={COMMUNITY_MEDIA_ACCEPT}
                          multiple
                          disabled={locked || mediaUploading}
                          onChange={handleMediaUpload}
                        />
                      </label>
                    </>
                  ) : null}
                </div>
                <p className="mt-2 text-[11px] leading-5 text-[var(--muted)]">
                  {mediaUploading ? "Uploading…" : "Photos up to 10MB each."}
                </p>
              </div>

              {error ? (
                <div
                  role="alert"
                  aria-live="assertive"
                  className="rounded-[var(--radius-sm)] border border-[var(--cinnabar)]/25 bg-[var(--cinnabar)]/8 px-4 py-3"
                >
                  <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-[var(--cinnabar)]">
                    {error}
                  </p>
                </div>
              ) : null}

              <div className={compact ? "pt-2" : "pt-6"}>
                <button
                  type="button"
                  onClick={handlePublish}
                  disabled={locked || !canPublish || submitting}
                  className={`w-full bg-[var(--night)] font-bold tracking-widest text-white transition-colors active:scale-[0.99] disabled:opacity-30 disabled:hover:bg-[var(--night)] ${
                    compact ? "py-4 text-base" : "py-5 text-lg"
                  } hover:bg-[var(--cinnabar)]`}
                >
                  {submitting ? "POSTING..." : mediaUploading ? "UPLOADING MEDIA..." : "POST NOTE"}
                </button>
                <p className="mt-4 text-center text-[12px] font-bold uppercase tracking-widest text-[var(--muted)]">
                  Publish as a text note, a photo set, or with live moments
                </p>
              </div>
            </div>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
