// Country helpers for leaderboard regional filtering.
//
// We store ISO 3166-1 alpha-2 codes ("US", "GB", "DE") on profile.country.
// Display name comes from Intl.DisplayNames, flag emoji is generated from
// the regional-indicator-symbol code points so we don't ship a flag asset.

// Most-populous + frequent gaming markets first; the rest sorted alphabetically.
// Not exhaustive — users in any country still get auto-detected; this list
// just powers the picker dropdown.
export const COUNTRY_CODES: string[] = [
  "US", "GB", "DE", "FR", "CA", "AU", "NL", "BR", "JP", "KR",
  "IN", "RU", "UA", "PL", "TR", "MX", "ES", "IT", "SE", "FI",
  "NO", "DK", "BE", "AT", "CH", "IE", "CZ", "PT", "GR", "RO",
  "HU", "BG", "HR", "SK", "SI", "EE", "LV", "LT", "IS", "LU",
  "AR", "CL", "CO", "PE", "VE", "ZA", "NG", "EG", "MA", "DZ",
  "SA", "AE", "IL", "IR", "IQ", "JO", "LB", "KZ", "UZ", "PK",
  "BD", "ID", "MY", "PH", "SG", "TH", "VN", "TW", "HK", "CN",
  "NZ",
];

export function isIso2(code: string | null | undefined): code is string {
  return typeof code === "string" && /^[A-Z]{2}$/.test(code);
}

// "US" → "🇺🇸". Works in every modern browser via the Regional Indicator
// Symbol block (U+1F1E6 .. U+1F1FF).
export function flagEmoji(iso2: string): string {
  if (!isIso2(iso2)) return "";
  const base = 0x1f1e6;
  const a = "A".charCodeAt(0);
  return (
    String.fromCodePoint(base + (iso2.charCodeAt(0) - a)) +
    String.fromCodePoint(base + (iso2.charCodeAt(1) - a))
  );
}

// "US" → "United States". Cached because Intl.DisplayNames construction isn't
// free and we render this in a tight list.
let displayNamesCache: Intl.DisplayNames | null = null;
function getDisplayNames(): Intl.DisplayNames {
  if (!displayNamesCache) {
    displayNamesCache = new Intl.DisplayNames(["en"], { type: "region" });
  }
  return displayNamesCache;
}

export function countryName(iso2: string | null | undefined): string {
  if (!isIso2(iso2)) return "Unknown";
  try {
    const name = getDisplayNames().of(iso2);
    return name ?? iso2;
  } catch {
    return iso2;
  }
}

// Best-effort guess of the user's country from the browser. Returns null if
// the browser doesn't expose a region tag. Caller decides whether to store.
export function detectCountryFromBrowser(): string | null {
  if (typeof navigator === "undefined") return null;
  const candidates: string[] = [];
  if (navigator.language) candidates.push(navigator.language);
  if (Array.isArray(navigator.languages)) {
    for (const l of navigator.languages) candidates.push(l);
  }
  for (const tag of candidates) {
    try {
      const loc = new Intl.Locale(tag);
      // `region` is the territory subtag (e.g. "US" in "en-US"). For tags
      // without a region (just "en"), this returns undefined.
      const region = loc.region;
      if (region && /^[A-Z]{2}$/.test(region)) return region;
    } catch {
      // skip malformed tags
    }
  }
  return null;
}

// Build a deduped, sorted list of codes for the picker — known list +
// anything we've seen in data + the user's own (so an exotic auto-detected
// country shows up immediately).
export function buildPickerCodes(
  seen: string[],
  pinned: string | null | undefined,
): string[] {
  const set = new Set<string>(COUNTRY_CODES);
  for (const c of seen) if (isIso2(c)) set.add(c);
  if (isIso2(pinned)) set.add(pinned);
  return [...set].sort((a, b) =>
    countryName(a).localeCompare(countryName(b)),
  );
}
