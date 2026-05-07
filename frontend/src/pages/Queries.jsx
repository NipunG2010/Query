import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Play, Trash2, Power } from "lucide-react";
import { api } from "@/lib/api";
import { fmtRelative } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { toast } from "sonner";

export default function Queries() {
  const [queries, setQueries] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const q = await api.listQueries();
    setQueries(q);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = async (q) => {
    await api.updateQuery(q.id, { enabled: !q.enabled });
    toast.success(!q.enabled ? "Query enabled" : "Query paused");
    load();
  };

  const run = async (q) => {
    await api.runQuery(q.id);
    toast.success(`Run started · ${q.name}`);
    setTimeout(load, 2000);
  };

  const del = async (q) => {
    if (!window.confirm(`Delete "${q.name}" and all its discoveries?`)) return;
    await api.deleteQuery(q.id);
    toast.success("Query deleted");
    load();
  };

  return (
    <div>
      <PageHeader
        overline="// QUERIES"
        title={
          <>
            Monitored <span className="text-terminal-amber">Signals</span>
          </>
        }
        subtitle="Long-tail Google queries polled on a cron. Each query maintains its own discovery ledger and validation filters."
        actions={
          <Link
            to="/queries/new"
            data-testid="queries-new-btn"
            className="h-10 px-4 bg-terminal-amber hover:bg-yellow-400 text-terminal-base font-mono text-[11px] uppercase tracking-wider inline-flex items-center gap-2"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2.25} />
            New Query
          </Link>
        }
      />

      <div className="p-8">
        {loading ? (
          <div className="font-mono text-[12px] text-terminal-zincDim">loading...</div>
        ) : queries.length === 0 ? (
          <EmptyState
            testId="empty-queries"
            title="No queries defined"
            description="Your monitoring ledger is empty. Create a query with keyword filters to begin hunting."
            action={
              <Link
                to="/queries/new"
                data-testid="empty-queries-new"
                className="h-10 px-4 bg-terminal-amber text-terminal-base font-mono text-[11px] uppercase tracking-wider inline-flex items-center gap-2 hover:bg-yellow-400"
              >
                <Plus className="w-3.5 h-3.5" strokeWidth={2.25} /> Create your first query
              </Link>
            }
          />
        ) : (
          <div className="border border-terminal-border">
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-6 px-5 py-3 border-b border-terminal-border font-mono text-[10px] uppercase tracking-[0.2em] text-terminal-zincDim bg-terminal-surface">
              <span>Query</span>
              <span>Interval</span>
              <span>Hits</span>
              <span>Last Run</span>
              <span>Status</span>
              <span className="text-right">Actions</span>
            </div>
            {queries.map((q) => (
              <div
                key={q.id}
                data-testid={`query-row-${q.id}`}
                className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] items-center gap-6 px-5 py-4 border-b border-terminal-border hover:bg-terminal-surface last:border-b-0 transition-colors"
              >
                <Link to={`/queries/${q.id}`} className="min-w-0" data-testid={`query-link-${q.id}`}>
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        q.enabled ? "bg-terminal-green animate-pulse-amber" : "bg-terminal-zincDim"
                      }`}
                    />
                    <span className="text-white font-medium text-[14px] truncate hover:text-terminal-amber">
                      {q.name}
                    </span>
                  </div>
                  <div
                    className="mt-1 font-mono text-[11px] text-terminal-zincDim truncate"
                    title={q.query}
                  >
                    {q.query}
                  </div>
                </Link>
                <span className="font-mono text-[12px] text-terminal-zinc tabular-nums">
                  {q.interval_minutes}m
                </span>
                <span className="font-mono text-[12px] text-white tabular-nums">
                  {q.total_discoveries}
                </span>
                <span className="font-mono text-[11px] text-terminal-zinc">
                  {fmtRelative(q.last_run_at)}
                </span>
                <span
                  className={`font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border ${
                    q.enabled
                      ? "border-terminal-green/50 text-terminal-green bg-terminal-green/10"
                      : "border-terminal-border text-terminal-zincDim"
                  }`}
                >
                  {q.enabled ? "ACTIVE" : "PAUSED"}
                </span>
                <div className="flex items-center gap-1 justify-end">
                  <IconBtn
                    testId={`run-${q.id}`}
                    onClick={() => run(q)}
                    icon={Play}
                    hover="amber"
                    title="Run now"
                  />
                  <IconBtn
                    testId={`toggle-${q.id}`}
                    onClick={() => toggle(q)}
                    icon={Power}
                    hover="green"
                    title={q.enabled ? "Pause" : "Enable"}
                  />
                  <IconBtn
                    testId={`delete-${q.id}`}
                    onClick={() => del(q)}
                    icon={Trash2}
                    hover="red"
                    title="Delete"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function IconBtn({ icon: Icon, onClick, hover, title, testId }) {
  const hoverCls =
    hover === "amber"
      ? "hover:border-terminal-amber hover:text-terminal-amber"
      : hover === "green"
      ? "hover:border-terminal-green hover:text-terminal-green"
      : "hover:border-terminal-red hover:text-terminal-red";
  return (
    <button
      onClick={onClick}
      title={title}
      data-testid={testId}
      className={`h-8 w-8 flex items-center justify-center border border-terminal-border text-terminal-zinc ${hoverCls}`}
    >
      <Icon className="w-3.5 h-3.5" strokeWidth={2} />
    </button>
  );
}
