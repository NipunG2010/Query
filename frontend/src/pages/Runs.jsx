import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { fmtTime } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";

export default function Runs() {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const r = await api.listRuns({ limit: 200 });
    setRuns(r);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  return (
    <div>
      <PageHeader
        overline="// RUN LOG"
        title={
          <>
            Execution <span className="text-terminal-amber">Ledger</span>
          </>
        }
        subtitle="Every scheduled and manual poll, with dedup counts and validation metrics."
      />
      <div className="p-8">
        {loading ? (
          <div className="font-mono text-[12px] text-terminal-zincDim">loading...</div>
        ) : runs.length === 0 ? (
          <EmptyState
            testId="empty-runs"
            title="No runs recorded"
            description="Runs will appear here once the scheduler starts polling your queries."
          />
        ) : (
          <div className="border border-terminal-border">
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-6 px-5 py-3 border-b border-terminal-border font-mono text-[10px] uppercase tracking-[0.2em] text-terminal-zincDim bg-terminal-surface">
              <span>Query</span>
              <span>Started</span>
              <span>Total</span>
              <span>New</span>
              <span>Match</span>
              <span>Status</span>
            </div>
            {runs.map((r) => (
              <div
                key={r.id}
                data-testid={`runlog-${r.id}`}
                className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] items-center gap-6 px-5 py-3 border-b border-terminal-border last:border-b-0 hover:bg-terminal-surface transition-colors"
              >
                <Link
                  to={`/queries/${r.query_id}`}
                  className="text-white text-[13px] truncate hover:text-terminal-amber"
                  data-testid={`runlog-link-${r.id}`}
                >
                  {r.query_name || r.query_id}
                </Link>
                <span className="font-mono text-[11px] text-terminal-zinc">
                  {fmtTime(r.started_at)}
                </span>
                <span className="font-mono text-[12px] text-white tabular-nums text-right w-14">
                  {r.total_results}
                </span>
                <span className="font-mono text-[12px] text-terminal-amber tabular-nums text-right w-14">
                  {r.new_results}
                </span>
                <span className="font-mono text-[12px] text-terminal-green tabular-nums text-right w-14">
                  {r.valid_new_results}
                </span>
                <span
                  className={`font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border ${
                    r.status === "success"
                      ? "border-terminal-green/40 text-terminal-green"
                      : r.status === "error"
                      ? "border-terminal-red/40 text-terminal-red"
                      : "border-terminal-amber/40 text-terminal-amber"
                  }`}
                >
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
