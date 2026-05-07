import { Crosshair } from "lucide-react";

export default function EmptyState({ title, description, action, testId }) {
  return (
    <div
      data-testid={testId}
      className="border border-dashed border-terminal-border p-12 flex flex-col items-center justify-center text-center"
    >
      <Crosshair className="w-8 h-8 text-terminal-amber opacity-60" strokeWidth={1.25} />
      <h3 className="mt-5 font-mono uppercase tracking-[0.2em] text-[11px] text-terminal-amber">
        {title}
      </h3>
      {description && (
        <p className="mt-2 text-terminal-zinc text-[13px] max-w-md leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
