"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const PRO_KEY = "mines.pro";

type ProContextValue = {
  isPro: boolean;
  setPro: (next: boolean) => void;
  toggle: () => void;
};

const ProContext = createContext<ProContextValue | null>(null);

function readPro(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(PRO_KEY);
    // Default ON for the showcase so first-time visitors see all the toys.
    // Users who explicitly turn it off get persisted "0".
    if (raw === null) return true;
    return raw !== "0";
  } catch {
    return true;
  }
}

function writePro(next: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PRO_KEY, next ? "1" : "0");
  } catch {
    // ignore — quota or disabled
  }
}

export function ProProvider({ children }: { children: React.ReactNode }) {
  // SSR-safe default: pretend Pro is on so the server-rendered HTML matches
  // the most common client-hydrated state. Real value reconciles on mount.
  const [isPro, setIsProState] = useState<boolean>(true);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setIsProState(readPro());
    setHydrated(true);
  }, []);

  const setPro = useCallback((next: boolean) => {
    setIsProState(next);
    writePro(next);
  }, []);

  const toggle = useCallback(() => {
    setIsProState((prev) => {
      const next = !prev;
      writePro(next);
      return next;
    });
  }, []);

  const value = useMemo<ProContextValue>(
    () => ({ isPro: hydrated ? isPro : true, setPro, toggle }),
    [isPro, hydrated, setPro, toggle],
  );

  return <ProContext.Provider value={value}>{children}</ProContext.Provider>;
}

export function useProMode(): ProContextValue {
  const ctx = useContext(ProContext);
  if (!ctx) throw new Error("useProMode must be used inside <ProProvider>");
  return ctx;
}
