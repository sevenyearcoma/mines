"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getBrowserSupabase } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types/db";
import { detectCountryFromBrowser, isIso2 } from "@/lib/leaderboard/country";
import { capture, identify, resetAnalytics } from "@/lib/analytics/posthog";

export type GuestIdentity = { id: string; name: string };

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  guest: GuestIdentity | null;
  isGuest: boolean;
  displayName: string | null;
  loading: boolean;
  signInAsGuest: (name: string) => GuestIdentity;
  // Picks a random adjective+noun name and creates a guest identity without
  // bouncing through the sign-in form. Used by routes that allow guests so
  // first-time visitors skip the "sit at the table" gate.
  signInAsAutoGuest: () => GuestIdentity;
  signOut: () => Promise<void>;
};

const GUEST_ADJECTIVES = [
  "lucky", "bold", "sly", "calm", "swift", "shady", "sharp", "quick",
  "wild", "smooth", "lone", "high", "ace", "neon",
];
const GUEST_NOUNS = [
  "dealer", "shark", "fox", "card", "chip", "queen", "king", "joker",
  "spade", "heart", "club", "diamond", "tower", "bandit",
];

function randomGuestName(): string {
  const adj = GUEST_ADJECTIVES[Math.floor(Math.random() * GUEST_ADJECTIVES.length)];
  const noun = GUEST_NOUNS[Math.floor(Math.random() * GUEST_NOUNS.length)];
  const tag = Math.floor(Math.random() * 90) + 10; // 10..99
  return `${adj}-${noun}-${tag}`;
}

const GUEST_KEY = "mines.guest";

function readGuest(): GuestIdentity | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(GUEST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GuestIdentity>;
    if (typeof parsed.id !== "string" || typeof parsed.name !== "string") return null;
    return { id: parsed.id, name: parsed.name };
  } catch {
    return null;
  }
}

function writeGuest(g: GuestIdentity) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(GUEST_KEY, JSON.stringify(g));
  } catch {
    // quota / disabled storage — best effort.
  }
}

function clearGuest() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(GUEST_KEY);
  } catch {
    // best effort.
  }
}

function newGuestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = getBrowserSupabase();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [guest, setGuest] = useState<GuestIdentity | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setGuest(readGuest());
  }, []);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      if (cancelled) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(
      (event: string, s: Session | null) => {
        setSession(s);
        if (event === "SIGNED_IN" && s?.user) {
          // A real sign-in supersedes any guest identity.
          clearGuest();
          setGuest(null);
          identify(s.user.id, {
            email: s.user.email,
            provider: s.user.app_metadata?.provider,
          });
          capture("user_signed_in", {
            user_id: s.user.id,
            provider: s.user.app_metadata?.provider,
          });
        } else if (event === "SIGNED_OUT") {
          capture("user_signed_out");
          resetAnalytics();
        }
      },
    );

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    supabase
      .from("profiles")
      .select("*")
      .eq("id", uid)
      .maybeSingle()
      .then(async ({ data }: { data: unknown }) => {
        if (cancelled) return;
        const p = (data as Profile | null) ?? null;
        setProfile(p);
        if (p && !isIso2(p.country)) {
          const detected = detectCountryFromBrowser();
          if (detected) {
            const { data: updated } = await supabase
              .from("profiles")
              .update({ country: detected })
              .eq("id", uid)
              .select()
              .maybeSingle();
            if (!cancelled && updated) setProfile(updated as Profile);
          }
        }
      });
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, supabase]);

  const signInAsGuest = useCallback((name: string): GuestIdentity => {
    const trimmed = name.trim().slice(0, 20) || "guest";
    const next: GuestIdentity = { id: newGuestId(), name: trimmed };
    writeGuest(next);
    setGuest(next);
    capture("guest_signed_in", { name: trimmed });
    return next;
  }, []);

  const signInAsAutoGuest = useCallback((): GuestIdentity => {
    const next: GuestIdentity = { id: newGuestId(), name: randomGuestName() };
    writeGuest(next);
    setGuest(next);
    capture("guest_signed_in", { name: next.name, auto: true });
    return next;
  }, []);

  const signOut = useCallback(async () => {
    clearGuest();
    setGuest(null);
    await supabase.auth.signOut();
  }, [supabase]);

  const user = session?.user ?? null;
  const isGuest = !user && guest !== null;
  const displayName =
    profile?.username ??
    user?.email?.split("@")[0] ??
    guest?.name ??
    null;

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      profile,
      guest: user ? null : guest,
      isGuest,
      displayName,
      loading,
      signInAsGuest,
      signInAsAutoGuest,
      signOut,
    }),
    [session, user, profile, guest, isGuest, displayName, loading, signInAsGuest, signInAsAutoGuest, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
