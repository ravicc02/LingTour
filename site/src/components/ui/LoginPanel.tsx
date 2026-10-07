"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { countryOptions } from "@/lib/country-list";
import { hydrateFavoritesFromServer } from "@/lib/favorites";
import { getGoogleIdentityApi, requestGoogleCredential } from "@/lib/google-identity";
import {
  registerWithPassword,
  sendEmailCode,
  signInWithGoogle,
  signInWithPassword,
  updateCurrentUserProfile,
  verifyEmailCode,
} from "@/lib/auth-client";

function safeNextPath(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/profile?tab=notes";
}

// Read `?next=` from the location at submit time instead of via useSearchParams().
// useSearchParams() suspends the whole panel during prerendering, so the server
// shipped an empty fallback and the form only existed after hydration — a blank
// login page on slow networks or when JavaScript fails.
function currentNextPath() {
  if (typeof window === "undefined") return safeNextPath(null);
  return safeNextPath(new URLSearchParams(window.location.search).get("next"));
}

const fieldClass = "min-h-12 w-full border-b border-[var(--line)] bg-transparent px-0 py-3 text-base text-[var(--river-deep)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--river-deep)] lg:text-sm";
const labelClass = "grid gap-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]";

type Mode = "login" | "signup";
type SignInMethod = "password" | "code";
type SelectOption = { value: string; label: string };

const travelStyleOptions: Array<SelectOption> = [
  { value: "Culture routes and food walks", label: "Culture routes and food walks" },
  { value: "Craft workshops and museums", label: "Craft workshops and museums" },
  { value: "Slow city walks and local life", label: "Slow city walks and local life" },
];

function SelectField({
  id,
  label,
  name,
  options,
  value,
  onChange,
}: {
  id: string;
  label: string;
  name: string;
  options: Array<SelectOption>;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <label id={`${id}-label`} htmlFor={`${id}-trigger`} className={labelClass}>
        {label}
      </label>
      <button
        ref={triggerRef}
        id={`${id}-trigger`}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${id}-label ${id}-trigger`}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={`${fieldClass} flex w-full items-center justify-between gap-3 text-left`}
      >
        <span className="truncate">{selectedOption?.label ?? "Select"}</span>
        <span aria-hidden="true" className="shrink-0 text-xs">▾</span>
      </button>
      <input type="hidden" name={name} value={value} />

      {open ? (
        <div
          role="listbox"
          aria-labelledby={`${id}-label`}
          tabIndex={-1}
          onKeyDown={(event) => {
            if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
            event.preventDefault();
            const optionButtons = Array.from(
              event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]'),
            );
            const currentIndex = optionButtons.findIndex((button) => button === document.activeElement);
            const nextIndex = event.key === "ArrowDown"
              ? Math.min(optionButtons.length - 1, currentIndex + 1)
              : Math.max(0, currentIndex - 1);
            optionButtons[nextIndex]?.focus();
          }}
          className="absolute z-50 mt-2 max-h-64 w-full overflow-y-auto overscroll-contain border border-[var(--line)] bg-[var(--paper)] shadow-panel"
        >
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
                className={`flex min-h-11 w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm transition-colors ${
                  selected
                    ? "bg-[var(--river-deep)] text-white"
                    : "text-[var(--river-deep)] hover:bg-[var(--paper-deep)]"
                }`}
              >
                <span className="truncate">{option.label}</span>
                {selected ? <span aria-hidden="true">✓</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function LoginPanel() {
  const router = useRouter();
  const countries = useMemo(() => countryOptions(), []);
  const [mode, setMode] = useState<Mode>("login");
  const [signInMethod, setSignInMethod] = useState<SignInMethod>("password");
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [country, setCountry] = useState("SG");
  const [travelStyle, setTravelStyle] = useState("Culture routes and food walks");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") || "").trim();
    setLoading(true); setError(null);
    try {
      if (signInMethod === "code") {
        const code = String(data.get("code") || "").trim();
        if (!email || !code) { setError("Enter your email and the 6-digit code."); return; }
        const name = String(data.get("name") || "").trim();
        await verifyEmailCode({ email, code, purpose: mode, name: mode === "signup" ? name : undefined });
      } else {
        const password = String(data.get("password") || "");
        if (!email || !password) { setError("Please enter your email and password."); return; }
        if (mode === "login") {
          await signInWithPassword(email, password);
        } else {
          const name = String(data.get("name") || "").trim();
          const selectedCountry = String(data.get("country") || country);
          const selectedTravelStyle = String(data.get("travelStyle") || travelStyle);
          await registerWithPassword({ name, email, password });
          await updateCurrentUserProfile({ country: selectedCountry, travelStyle: selectedTravelStyle });
        }
      }
      void hydrateFavoritesFromServer();
      router.replace(currentNextPath()); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "An unexpected error occurred."); }
    finally { setLoading(false); }
  }

  async function handleSendCode() {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    const email = String(data.get("email") || "").trim();
    if (!email) { setError("Please enter your email address."); return; }
    setSendingCode(true); setError(null); setDevCode(null);
    try {
      const result = await sendEmailCode(email, mode);
      setCodeSent(true);
      setDevCode(result.devCode ?? null);
    } catch {
      setError("We could not send a verification code right now. Please try again in a moment.");
    } finally {
      setSendingCode(false);
    }
  }

  async function googleLogin() {
    setLoading(true); setError(null);
    try {
      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      if (!clientId) throw new Error("Google sign-in is currently unavailable. Please use email sign-in.");
      if (!getGoogleIdentityApi()) throw new Error("Google Sign-In script not loaded.");
      await signInWithGoogle(await requestGoogleCredential(clientId));
      void hydrateFavoritesFromServer(); router.replace(currentNextPath()); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "An unexpected error occurred."); }
    finally { setLoading(false); }
  }

  const isLogin = mode === "login";
  const usingCode = signInMethod === "code";
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="grid min-h-[100dvh] bg-[var(--paper-deep)] bg-grain text-[var(--river-deep)] lg:grid-cols-[minmax(0,1.08fr)_minmax(25rem,0.92fr)]">
      <section className="relative isolate hidden min-h-[100dvh] overflow-hidden border-r border-[var(--line)] bg-[var(--night)] text-white lg:block">
        <img
          src="/editorial/guangzhou-arcade-street.jpg"
          alt="Historic arcade street in Guangzhou"
          className="absolute inset-0 h-full w-full object-cover object-center opacity-80"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(17,25,35,0.18),rgba(17,25,35,0.12)_45%,rgba(17,25,35,0.8))]" />
        <div className="relative flex min-h-[100dvh] flex-col justify-between px-[clamp(2.5rem,7vw,7rem)] py-12">
          <div className="leading-none">
            <p className="font-[Georgia,'Times_New_Roman',serif] text-[clamp(2.25rem,4vw,4.5rem)] tracking-[-0.05em]">Culvoy</p>
            <p className="mt-3 text-[12px] font-bold uppercase tracking-[0.28em] text-white/72">Guangdong</p>
          </div>
          <div className="w-14 self-center border-t border-[var(--cinnabar)]" aria-hidden="true" />
        </div>
      </section>

      <section className="flex min-h-[100dvh] items-center px-6 py-14 sm:px-10 lg:px-[clamp(3rem,7vw,7rem)]">
        <div className="w-full max-w-md">
          <h1 className="font-[Georgia,'Times_New_Roman',serif] text-[clamp(2.75rem,4vw,4.25rem)] leading-[1] tracking-[-0.04em] text-balance lg:whitespace-nowrap">
            {isLogin ? "Welcome back" : "Create your account"}
          </h1>
          {error ? (
            <div className="mt-7 border-y border-[var(--cinnabar)]/45 py-3 text-sm leading-6 text-[var(--cinnabar)]" role="alert">
              {error}
            </div>
          ) : null}

          <form ref={formRef} className="mt-9 grid gap-6" onSubmit={submit} aria-busy={loading}>
            {!isLogin ? (
              <>
                <label className={labelClass}>
                  Full name
                  <input name="name" autoComplete="name" className={fieldClass} required />
                </label>
                <SelectField
                  id="signup-country"
                  label="Country"
                  name="country"
                  options={countries.map((country) => ({ value: country.code, label: country.label }))}
                  value={country}
                  onChange={setCountry}
                />
              </>
            ) : null}

            <label className={labelClass}>
              Email address
              <input name="email" type="email" autoComplete="email" inputMode="email" className={fieldClass} required />
            </label>

            {usingCode ? (
              <label className={labelClass}>
                Verification code
                <span className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <input
                    name="code"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    autoComplete="one-time-code"
                    className={fieldClass}
                    placeholder="6-digit code"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => void handleSendCode()}
                    disabled={sendingCode}
                    className="min-h-12 border border-[var(--line)] bg-white/60 px-5 py-3 text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--river-deep)] transition-colors hover:border-[var(--river-deep)]/40 hover:bg-white disabled:opacity-50"
                  >
                    {sendingCode ? "Sending..." : codeSent ? "Send again" : "Send code"}
                  </button>
                </span>
              </label>
            ) : (
              <div className="grid gap-2">
                <label
                  htmlFor="login-password"
                  className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]"
                >
                  Password
                </label>
                <span className="relative block">
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={isLogin ? "current-password" : "new-password"}
                    minLength={isLogin ? 1 : 8}
                    className={`${fieldClass} pr-16`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="absolute right-0 top-1/2 min-h-11 min-w-11 -translate-y-1/2 text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)] transition-colors hover:text-[var(--cinnabar)]"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </span>
              </div>
            )}

            {usingCode && devCode ? (
              <div className="border-y border-[var(--gold)]/40 py-3 text-xs leading-5 text-[var(--muted)]" role="status">
                Development code: <span className="font-mono font-bold text-[var(--river-deep)]">{devCode}</span>
              </div>
            ) : null}

            {!isLogin ? (
              <SelectField
                id="signup-travel-style"
                label="Travel style"
                name="travelStyle"
                options={travelStyleOptions}
                value={travelStyle}
                onChange={setTravelStyle}
              />
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="min-h-12 w-full bg-[var(--river-deep)] px-6 py-3 font-mono text-[12px] font-bold uppercase tracking-[0.18em] text-white transition-[background-color,transform] duration-300 hover:bg-[var(--cinnabar)] active:translate-y-px disabled:opacity-50"
            >
              {loading
                ? "Processing..."
                : isLogin
                  ? usingCode
                    ? "Verify and log in"
                    : "Log in"
                  : "Create account"}
            </button>

            <button
              type="button"
              onClick={() => {
                setSignInMethod(usingCode ? "password" : "code");
                setCodeSent(false);
                setDevCode(null);
                setError(null);
              }}
              className="min-h-11 px-1 text-left text-sm text-[var(--muted)] transition-colors hover:text-[var(--river-deep)]"
            >
              {usingCode
                ? "Use your password instead"
                : "Email a code instead"}
            </button>

            {isLogin && process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ? (
              <button
                type="button"
                onClick={() => void googleLogin()}
                disabled={loading}
                className="min-h-12 w-full border border-[var(--line)] px-6 py-3 text-sm font-semibold text-[var(--river-deep)] transition-colors hover:border-[var(--river-deep)] hover:bg-white/50 disabled:opacity-50"
              >
                Continue with Google
              </button>
            ) : null}

            {/* Both rows use the same 44px inline-flex box so the two links sit on
                one baseline instead of drifting apart, and both share the same
                hover treatment (the switch action used to be red-only). */}
            <p className="flex flex-wrap items-center gap-x-7 gap-y-0 pt-1 text-sm text-[var(--muted)]">
              <span className="inline-flex min-h-11 items-center gap-1.5">
                <span>{isLogin ? "New to Culvoy?" : "Already have an account?"}</span>
                <button
                  type="button"
                  onClick={() => {
                    setMode(isLogin ? "signup" : "login");
                    setSignInMethod(isLogin ? "code" : "password");
                    setCodeSent(false);
                    setDevCode(null);
                    setError(null);
                  }}
                  className="inline-flex min-h-11 items-center px-0.5 font-semibold text-[var(--cinnabar)] underline decoration-[var(--cinnabar)]/45 underline-offset-4 transition-colors hover:text-[var(--river-deep)] hover:decoration-[var(--river-deep)]/55"
                >
                  {isLogin ? "Create account" : "Log in"}
                </button>
              </span>
              {isLogin ? (
                <Link
                  href="/forgot-password"
                  className="inline-flex min-h-11 items-center px-0.5 font-semibold text-[var(--river-deep)] underline decoration-[var(--line)] underline-offset-4 transition-colors hover:text-[var(--cinnabar)] hover:decoration-[var(--cinnabar)]/55"
                >
                  Forgot password?
                </Link>
              ) : null}
            </p>
          </form>
        </div>
      </section>
    </div>
  );
}
