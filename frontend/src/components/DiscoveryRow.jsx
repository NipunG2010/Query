import { ExternalLink, Check, X, Zap } from "lucide-react";
import { fmtRelative, fmtDomain } from "@/lib/format";
import { api } from "@/lib/api";
import { toast } from "sonner";

const STATUS_STYLES = {
  new: "bg-terminal-amber/15 text-terminal-amber border-terminal-amber/40",
  validated: "bg-terminal-green/15 text-terminal-green border-terminal-green/40",
  ignored: "bg-terminal-border text-terminal-zincDim border-terminal-border",
};

export default function DiscoveryRow({ d, onChange, showQuery = false }) {
  const badge = STATUS_STYLES[d.status] || STATUS_STYLES.new;

  const setStatus = async (status) => {
    try {
      await api.updateDiscovery(d.id, status);
      toast.success(`Marked ${status}`);
      onChange?.();
    } catch (e) {
      toast.error("Update failed");
    }
  };

  return (
    <div
      data-testid={`discovery-row-${d.id}`}
      className="group grid grid-cols-[auto_1fr_auto] gap-4 px-5 py-4 border-b border-terminal-border hover:bg-terminal-surface transition-colors animate-fade-up"
    >
      <div className="flex flex-col items-start gap-2 w-28 pt-0.5">
        <span
          className={`px-1.5 py-0.5 border text-[10px] font-mono uppercase tracking-wider ${badge}`}
        >
          {d.status}
        </span>
        {d.valid ? (
          <span className="flex items-center gap-1 text-[10px] font-mono text-terminal-green uppercase tracking-wider">
            <Zap className="w-3 h-3" strokeWidth={2} /> match
          </span>
        ) : (
          <span className="text-[10px] font-mono text-terminal-zincDim uppercase tracking-wider">
            no match
          </span>
        )}
      </div>

      <div className="min-w-0">
        <a
          href={d.url}
          target="_blank"
          rel="noreferrer"
          data-testid={`discovery-link-${d.id}`}
          className="block text-[14px] text-white hover:text-terminal-amber truncate font-medium"
          title={d.title}
        >
          {d.title || d.url}
        </a>
        <p
          className="text-[12px] text-terminal-zinc mt-1 line-clamp-2"
          title={d.snippet}
        >
          {d.snippet || "—"}
        </p>
        <div className="mt-2 flex items-center gap-3 font-mono text-[10.5px] text-terminal-zincDim uppercase tracking-wider">
          <span className="text-terminal-amber normal-case tracking-normal">
            {fmtDomain(d.domain)}
          </span>
          <span>· {fmtRelative(d.first_seen_at)}</span>
          {showQuery && d.query_name && (
            <span className="normal-case tracking-normal text-terminal-zinc">
              ↳ {d.query_name}
            </span>
          )}
          {d.times_seen > 1 && <span>· ×{d.times_seen}</span>}
        </div>
      </div>

      <div className="flex items-start gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => setStatus("validated")}
          data-testid={`validate-btn-${d.id}`}
          className="h-7 w-7 flex items-center justify-center border border-terminal-border hover:border-terminal-green hover:text-terminal-green text-terminal-zinc"
          title="Validate"
        >
          <Check className="w-3.5 h-3.5" strokeWidth={2} />
        </button>
        <button
          onClick={() => setStatus("ignored")}
          data-testid={`ignore-btn-${d.id}`}
          className="h-7 w-7 flex items-center justify-center border border-terminal-border hover:border-terminal-red hover:text-terminal-red text-terminal-zinc"
          title="Ignore"
        >
          <X className="w-3.5 h-3.5" strokeWidth={2} />
        </button>
        <a
          href={d.url}
          target="_blank"
          rel="noreferrer"
          data-testid={`open-btn-${d.id}`}
          className="h-7 w-7 flex items-center justify-center border border-terminal-border hover:border-terminal-amber hover:text-terminal-amber text-terminal-zinc"
          title="Open"
        >
          <ExternalLink className="w-3.5 h-3.5" strokeWidth={2} />
        </a>
      </div>
    </div>
  );
}
