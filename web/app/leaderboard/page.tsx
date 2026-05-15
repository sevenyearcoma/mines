"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { todayUtcDate } from "@/lib/engine";
import {
  buildPickerCodes,
  countryName,
  flagEmoji,
  isIso2,
} from "@/lib/leaderboard/country";
import {
  useLeaderboard,
  useSeenCountries,
  type LeaderboardEntry,
  type LeaderboardScope,
  type LeaderboardTab,
} from "@/lib/leaderboard/useLeaderboard";
import { fmtTime } from "@/lib/format";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { MascotScene } from "@/components/mascot/MascotScene";

const TABS: { id: LeaderboardTab; label: string; sublabel: string }[] = [
  { id: "daily", label: "Daily", sublabel: "fastest today" },
  { id: "best_time", label: "Best time", sublabel: "intermediate solo" },
  { id: "wins", label: "Wins", sublabel: "all-time" },
];

export default function LeaderboardPage() {
  const { user, profile } = useAuth();
  const dateUtc = useMemo(() => todayUtcDate(), []);

  const [tab, setTab] = useState<LeaderboardTab>("daily");
  const [scope, setScope] = useState<LeaderboardScope>("global");
  // Country the scope filter applies to. Initialized from profile when ready,
  // then user-controllable via the picker.
  const [country, setCountry] = useState<string | null>(null);

  useEffect(() => {
    if (isIso2(profile?.country)) setCountry(profile!.country);
  }, [profile?.country]);

  const { codes: seenCodes } = useSeenCountries();
  const pickerCodes = useMemo(
    () => buildPickerCodes(seenCodes, country),
    [seenCodes, country],
  );

  const { entries, loading, error } = useLeaderboard({
    tab,
    scope,
    country,
    dateUtc,
  });

  // Persist a user's country change back to their profile so the daily-detect
  // doesn't keep overwriting it on next session.
  const onChangeCountry = async (next: string) => {
    setCountry(next);
    if (!user) return;
    const supabase = getBrowserSupabase();
    await supabase
      .from("profiles")
      .update({ country: next })
      .eq("id", user.id);
  };

  return (
    <main
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: 22,
        padding: "32px 28px 48px",
        maxWidth: 920,
        width: "100%",
        margin: "0 auto",
      }}
    >
      <MascotScene pose="point" caption="who's running the table tonight" />
      <header style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
        <div
          className="disp"
          style={{ fontSize: 42, fontStyle: "italic", letterSpacing: "-0.02em" }}
        >
          Leaderboard
        </div>
        <div
          className="mono upper"
          style={{ fontSize: 10, color: "var(--ink-mute)", letterSpacing: "0.3em" }}
        >
          {tab === "daily" ? `daily · ${dateUtc}` : "all-time"}
        </div>
      </header>

      <section
        style={{
          display: "flex",
          gap: 14,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <TabBar tab={tab} onChange={setTab} />
        <div style={{ flex: 1 }} />
        <ScopeToggle
          scope={scope}
          onChange={setScope}
          country={country}
          hasCountry={isIso2(country)}
        />
        {scope === "region" && (
          <CountryPicker
            codes={pickerCodes}
            value={country}
            onChange={onChangeCountry}
          />
        )}
      </section>

      <section>
        {error && (
          <div
            className="panel"
            style={{
              padding: 14,
              color: "var(--red-glow, #ff8a8a)",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
            }}
          >
            failed to load — {error}
          </div>
        )}
        {!error && (
          <LeaderboardList
            entries={entries}
            loading={loading}
            tab={tab}
            youUserId={user?.id ?? null}
            emptyHint={emptyHint(tab, scope, country)}
          />
        )}
      </section>

      {!isIso2(profile?.country) && user && (
        <div
          className="panel"
          style={{
            padding: 14,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div>
            <div
              className="mono upper"
              style={{ fontSize: 10, color: "var(--ink-mute)", letterSpacing: "0.18em" }}
            >
              region not set
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 4 }}>
              pick a country so you show up on your regional board.
            </div>
          </div>
          <CountryPicker
            codes={pickerCodes}
            value={country}
            onChange={onChangeCountry}
            placeholder="pick country…"
          />
        </div>
      )}
    </main>
  );
}

function TabBar({
  tab,
  onChange,
}: {
  tab: LeaderboardTab;
  onChange: (t: LeaderboardTab) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 2,
        padding: 3,
        background: "rgba(0,0,0,.4)",
        border: "1px solid var(--line-soft)",
        borderRadius: 6,
      }}
    >
      {TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className="mono upper"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            fontSize: 10,
            letterSpacing: "0.14em",
            padding: "8px 12px",
            background:
              tab === t.id
                ? "linear-gradient(180deg, var(--gold-glow), var(--gold))"
                : "transparent",
            color: tab === t.id ? "#2a1d04" : "var(--ink-2)",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontWeight: 700,
            boxShadow: tab === t.id ? "0 1px 0 rgba(0,0,0,.4)" : "none",
            textAlign: "left",
            lineHeight: 1.1,
          }}
        >
          <span>{t.label}</span>
          <span
            style={{
              fontSize: 8,
              opacity: 0.7,
              marginTop: 3,
              letterSpacing: "0.18em",
            }}
          >
            {t.sublabel}
          </span>
        </button>
      ))}
    </div>
  );
}

function ScopeToggle({
  scope,
  onChange,
  country,
  hasCountry,
}: {
  scope: LeaderboardScope;
  onChange: (s: LeaderboardScope) => void;
  country: string | null;
  hasCountry: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 2,
        padding: 3,
        background: "rgba(0,0,0,.4)",
        border: "1px solid var(--line-soft)",
        borderRadius: 6,
      }}
    >
      <ScopeChip active={scope === "global"} onClick={() => onChange("global")}>
        🌐 Global
      </ScopeChip>
      <ScopeChip
        active={scope === "region"}
        onClick={() => onChange("region")}
        disabled={!hasCountry && scope !== "region"}
        title={!hasCountry ? "pick a country first" : undefined}
      >
        {hasCountry && country ? `${flagEmoji(country)} ` : ""}
        {hasCountry && country ? countryName(country) : "Regional"}
      </ScopeChip>
    </div>
  );
}

function ScopeChip({
  active,
  onClick,
  disabled,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      title={title}
      className="mono upper"
      style={{
        fontSize: 10,
        letterSpacing: "0.16em",
        padding: "8px 14px",
        background: active
          ? "linear-gradient(180deg, var(--gold-glow), var(--gold))"
          : "transparent",
        color: active
          ? "#2a1d04"
          : disabled
          ? "rgba(200,200,200,0.32)"
          : "var(--ink-2)",
        border: "none",
        borderRadius: 4,
        cursor: disabled ? "not-allowed" : "pointer",
        fontWeight: 700,
        boxShadow: active ? "0 1px 0 rgba(0,0,0,.4)" : "none",
      }}
    >
      {children}
    </button>
  );
}

function CountryPicker({
  codes,
  value,
  onChange,
  placeholder,
}: {
  codes: string[];
  value: string | null;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      className="mono"
      style={{
        fontSize: 12,
        padding: "8px 10px",
        background: "rgba(0,0,0,0.4)",
        color: "var(--ink)",
        border: "1px solid var(--line-soft)",
        borderRadius: 6,
        minWidth: 200,
        // Tells the browser to render the native popout (and form controls
        // in general) using its dark-mode palette — without this the open
        // dropdown shows up white in light-mode browsers.
        colorScheme: "dark",
      }}
    >
      <option value="" disabled style={{ background: "#0e1318", color: "var(--ink)" }}>
        {placeholder ?? "select country"}
      </option>
      {codes.map((code) => (
        <option
          key={code}
          value={code}
          style={{ background: "#0e1318", color: "var(--ink)" }}
        >
          {flagEmoji(code)} {countryName(code)}
        </option>
      ))}
    </select>
  );
}

function LeaderboardList({
  entries,
  loading,
  tab,
  youUserId,
  emptyHint,
}: {
  entries: LeaderboardEntry[];
  loading: boolean;
  tab: LeaderboardTab;
  youUserId: string | null;
  emptyHint: string;
}) {
  if (loading && entries.length === 0) {
    return (
      <div
        className="mono upper"
        style={{
          fontSize: 10,
          letterSpacing: "0.2em",
          padding: 22,
          color: "var(--ink-mute)",
          textAlign: "center",
        }}
      >
        loading…
      </div>
    );
  }
  if (entries.length === 0) {
    return (
      <div
        className="panel"
        style={{
          padding: 22,
          color: "var(--ink-mute)",
          fontSize: 13,
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          alignItems: "center",
        }}
      >
        <div>{emptyHint}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link
            href="/daily"
            className="btn btn-gold sparkle"
            style={{ fontSize: 12, padding: "8px 14px" }}
          >
            play the daily →
          </Link>
          <Link
            href="/play"
            className="btn btn-ghost"
            style={{ fontSize: 12, padding: "8px 14px" }}
          >
            solo sprint →
          </Link>
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {entries.map((e) => (
        <LeaderboardRow
          key={`${tab}-${e.user_id}-${e.rank}`}
          entry={e}
          tab={tab}
          isYou={e.user_id === youUserId}
        />
      ))}
    </div>
  );
}

function LeaderboardRow({
  entry,
  tab,
  isYou,
}: {
  entry: LeaderboardEntry;
  tab: LeaderboardTab;
  isYou: boolean;
}) {
  const valueText =
    tab === "wins"
      ? entry.value.toString()
      : fmtTime(Math.floor(entry.value / 1000));
  const valueLabel = tab === "wins" ? "wins" : "time";
  const rankColor =
    entry.rank === 1
      ? "var(--gold)"
      : entry.rank === 2
      ? "var(--ink)"
      : entry.rank === 3
      ? "#c08a4a"
      : "var(--ink-mute)";
  const watchable = entry.demoId && entry.demoKind;
  return (
    <div
      className="panel"
      style={{
        padding: "12px 16px",
        display: "grid",
        gridTemplateColumns: "44px 1fr auto auto auto",
        gap: 14,
        alignItems: "center",
        borderColor: isYou ? "var(--gold-deep)" : undefined,
        background: isYou ? "rgba(227,178,72,0.08)" : undefined,
      }}
    >
      <span
        className="disp"
        style={{
          fontSize: 22,
          fontWeight: 800,
          color: rankColor,
          textAlign: "center",
          lineHeight: 1,
        }}
      >
        {entry.rank}
      </span>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: 18,
            color: isYou ? "var(--gold)" : "var(--ink)",
          }}
        >
          {entry.country && (
            <span title={countryName(entry.country)}>
              {flagEmoji(entry.country)}
            </span>
          )}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {entry.username}
          </span>
          {isYou && (
            <span
              className="mono upper"
              style={{
                fontSize: 9,
                letterSpacing: "0.18em",
                color: "var(--gold)",
                padding: "1px 6px",
                border: "1px solid var(--gold-deep)",
                borderRadius: 4,
              }}
            >
              you
            </span>
          )}
        </div>
        {entry.context && (
          <div
            className="mono"
            style={{ fontSize: 10, color: "var(--ink-mute)" }}
          >
            {entry.context}
          </div>
        )}
      </div>
      <div
        className="mono upper"
        style={{ fontSize: 9, color: "var(--ink-mute)", letterSpacing: "0.18em" }}
      >
        {valueLabel}
      </div>
      <div
        className="disp"
        style={{ fontSize: 20, fontWeight: 800, color: isYou ? "var(--gold)" : "var(--ink)" }}
      >
        {valueText}
      </div>
      {watchable ? (
        <Link
          href={`/demo/${entry.demoKind}/${entry.demoId}`}
          className="mono upper"
          style={{
            fontSize: 10,
            letterSpacing: "0.18em",
            color: "var(--gold)",
            textDecoration: "none",
            padding: "6px 10px",
            border: "1px solid var(--gold-deep)",
            borderRadius: 4,
          }}
        >
          ▶ demo
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}

function emptyHint(
  tab: LeaderboardTab,
  scope: LeaderboardScope,
  country: string | null,
): string {
  const where =
    scope === "region" && country
      ? ` from ${countryName(country)}`
      : "";
  if (tab === "daily")
    return `no winners${where} on today's daily yet — be the first.`;
  if (tab === "best_time")
    return `no intermediate solo wins${where} yet.`;
  return `no recorded wins${where} yet.`;
}
