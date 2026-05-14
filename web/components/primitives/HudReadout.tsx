export function HudReadout({
  label,
  value,
  tone = "gold",
  minWidth,
}: {
  label: string;
  value: string | number;
  tone?: "gold" | "red" | "green";
  minWidth?: number;
}) {
  return (
    <div className="hud" style={{ minWidth }}>
      <div className="hud-label">{label}</div>
      <div className={"hud-value " + (tone === "red" ? "red" : tone === "green" ? "green" : "")}>
        {value}
      </div>
    </div>
  );
}
