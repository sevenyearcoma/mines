"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { bridge } from "@/game/bridge";
import type { Difficulty } from "@/lib/engine";
import type { SoloProgressSnapshot } from "@/lib/solo/progress";
import {
  clearSoloProgress,
  loadSoloProgress,
  saveSoloProgress,
} from "@/lib/solo/progressStorage";
import { useAuth } from "./AuthProvider";

export function SoloProgressSync() {
  const { user, guest } = useAuth();
  const owner = useMemo(
    () => ({ userId: user?.id ?? null, guestId: guest?.id ?? null }),
    [guest?.id, user?.id],
  );
  const ownerRef = useRef(owner);
  const pendingSnapshotRef = useRef<SoloProgressSnapshot | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const requestSeqRef = useRef(0);
  const writeChainRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    ownerRef.current = owner;
  }, [owner]);

  const enqueueWrite = useCallback((op: () => Promise<void>) => {
    const run = () => op().catch((err) => {
      console.warn("[SoloProgress] write failed:", err);
    });
    const next = writeChainRef.current.then(run, run);
    writeChainRef.current = next;
    return next;
  }, []);

  const flushSave = useCallback(async () => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const snapshot = pendingSnapshotRef.current;
    pendingSnapshotRef.current = null;
    if (!snapshot) {
      await writeChainRef.current;
      return;
    }
    const owner = ownerRef.current;
    await enqueueWrite(() => saveSoloProgress(owner, snapshot));
  }, [enqueueWrite]);

  useEffect(() => {
    const onSnapshot = (snapshot: SoloProgressSnapshot) => {
      pendingSnapshotRef.current = snapshot;
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      void flushSave();
    };

    const onClear = ({ difficulty }: { difficulty: Difficulty }) => {
      pendingSnapshotRef.current = null;
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      const owner = ownerRef.current;
      void enqueueWrite(() => clearSoloProgress(owner, difficulty));
    };

    const onDifficulty = async (difficulty: Difficulty) => {
      const seq = ++requestSeqRef.current;
      await flushSave();
      const saved = await loadSoloProgress(ownerRef.current, difficulty);
      if (seq !== requestSeqRef.current) return;
      if (saved) bridge.emit("cmd:loadProgress", saved);
      else bridge.emit("cmd:setDifficulty", difficulty);
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") void flushSave();
    };
    const onPageHide = () => {
      void flushSave();
    };

    bridge.on("progress:snapshot", onSnapshot);
    bridge.on("progress:clear", onClear);
    bridge.on("solo:difficultyRequested", onDifficulty);
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      bridge.off("progress:snapshot", onSnapshot);
      bridge.off("progress:clear", onClear);
      bridge.off("solo:difficultyRequested", onDifficulty);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [flushSave]);

  return null;
}
