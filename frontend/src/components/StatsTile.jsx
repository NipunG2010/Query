export default function StatsTile({ label, value, sub, accent, testId }) {
  return (
    <div
      data-testid={testId}
      className="border border-terminal-border bg-terminal-surface p-5 hover:border-terminal-borderHi transition-colors"
    >
      <div className="overline">{label}</div>
      <div
        className={`font-mono mt-3 text-4xl tabular-nums tracking-tight ${
          accent ? "text-terminal-amber" : "text-white"
        }`}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-2 font-mono text-[11px] text-terminal-zinc">
          {sub}
        </div>
      )}
    </div>
  );
}
