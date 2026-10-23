"use client";

import Link from "next/link";
import { useState } from "react";
import {
  requestPasswordReset,
  resetPasswordWithCode,
} from "@/lib/auth-client";

const fieldClass =
  "min-h-12 w-full border-b border-[var(--line)] bg-transparent px-0 py-3 text-base text-[var(--river-deep)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--river-deep)] lg:text-sm";
const labelClass =
  "grid gap-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]";

/**
 * Two steps: ask for a reset code, then redeem it with a new password. The
 * send response is deliberately non-committal — the API answers identically
 * for unknown addresses, so the copy never claims the account exists.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSendCode(event: React.FormEvent) {
    event.preventDefault();
    const target = email.trim();
    if (!target) return;
    setSending(true);
    setError(null);
    setNotice(null);
    try {
      await requestPasswordReset(target);
      setCodeSent(true);
      setNotice(
        `If ${target} has a Culvoy account, a reset code is on its way. It expires in 10 minutes.`,
      );
    } catch {
      setError(
        "We could not send a reset code right now. Please try again in a moment.",
      );
    } finally {
      setSending(false);
    }
  }

  async function handleReset(event: React.FormEvent) {
    event.preventDefault();
    const target = email.trim();
    if (!target || code.trim().length !== 6 || newPassword.length < 8) {
      setError("Enter the 6-digit code and a password of at least 8 characters.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await resetPasswordWithCode({
        email: target,
        code: code.trim(),
        newPassword,
      });
      setDone(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "That code is invalid or has expired. Request a new one and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div data-polish-form data-polish-reset className="grid min-h-[100dvh] place-items-center bg-[var(--paper-deep)] bg-grain px-6 py-14 text-[var(--river-deep)]">
      <div className="w-full max-w-md">
        <h1 className="font-[Georgia,'Times_New_Roman',serif] text-[clamp(2.5rem,4vw,3.5rem)] leading-[1] tracking-[-0.04em]">
          Reset your password
        </h1>
        <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
          We will email a 6-digit code. Enter it with a new password to finish.
        </p>

        {error ? (
          <div
            className="mt-7 border-y border-[var(--cinnabar)]/45 py-3 text-sm leading-6 text-[var(--cinnabar)]"
            role="alert"
          >
            {error}
          </div>
        ) : null}
        {notice && !done ? (
          <div
            className="mt-7 border-y border-[var(--line)] py-3 text-sm leading-6 text-[var(--muted)]"
            role="status"
          >
            {notice}
          </div>
        ) : null}

        {done ? (
          <div
            className="mt-9 border-y border-[var(--gold)]/40 py-5 text-sm leading-6"
            role="status"
          >
            <p className="font-semibold text-[var(--river-deep)]">
              Password updated.
            </p>
            <p className="mt-2 text-[var(--muted)]">
              You can now sign in with your new password.
            </p>
          </div>
        ) : (
          <>
            <form
              className="mt-9 grid gap-6"
              onSubmit={handleSendCode}
              aria-busy={sending}
            >
              <label className={labelClass}>
                Email address
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  inputMode="email"
                  className={fieldClass}
                  required
                />
              </label>
              <button
                type="submit"
                disabled={sending || !email.trim()}
                className="min-h-12 w-full border border-[var(--line)] px-6 py-3 font-mono text-[12px] font-bold uppercase tracking-[0.18em] text-[var(--river-deep)] transition-colors hover:border-[var(--river-deep)] disabled:opacity-50"
              >
                {sending
                  ? "Sending…"
                  : codeSent
                    ? "Send a new code"
                    : "Email me a reset code"}
              </button>
            </form>

            {codeSent ? (
              <form
                className="mt-8 grid gap-6"
                onSubmit={handleReset}
                aria-busy={submitting}
              >
                <label className={labelClass}>
                  Verification code
                  <input
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    autoComplete="one-time-code"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    className={fieldClass}
                    placeholder="6-digit code"
                    required
                  />
                </label>
                <label className={labelClass}>
                  New password
                  <input
                    type="password"
                    minLength={8}
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    className={fieldClass}
                    required
                  />
                </label>
                <button
                  type="submit"
                  disabled={submitting}
                  className="min-h-12 w-full bg-[var(--river-deep)] px-6 py-3 font-mono text-[12px] font-bold uppercase tracking-[0.18em] text-white transition-[background-color,transform] duration-300 hover:bg-[var(--cinnabar)] active:translate-y-px disabled:opacity-50"
                >
                  {submitting ? "Saving…" : "Set new password"}
                </button>
              </form>
            ) : null}
          </>
        )}

        <p className="mt-8 text-sm text-[var(--muted)]">
          <Link
            href="/login"
            className="font-semibold text-[var(--cinnabar)] underline decoration-[var(--cinnabar)]/45 underline-offset-4"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}