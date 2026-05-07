import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Play, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { fmtRelative } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import StatsTile from "@/components/StatsTile";
import DiscoveryRow from "@/components/DiscoveryRow";
import EmptyState from "@/components/EmptyState";

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [queries, setQueries] = useState([]);
  const [discoveries, setDiscoveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    const [s, q, d] = await Promise.all([
      api.stats(),
      api.listQueries(),
      api.listDiscoveries({ limit: 20 }),
    ]);
    setStats(s);
    setQueries(q);
    setDiscoveries(d);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <div>
      <PageHeader
        overline="// CONSOLE"
        title={
          <>
            Live <span className="text-terminal-amber">Signals</span>
          </>
        }
        subtitle="Detect newly-indexed pages matching your long-tail queries before anyone else. Polled continuously, deduplicated, filtered."
        actions={
          <>
            <button
              onClick={refresh}
              data-testid="refresh-btn"
              className="h-10 px-4 border border-terminal-border hover:border-terminal-amber hover:text-terminal-amber text-terminal-zinc font-mono text-[11px] uppercase tracking-wider inline-flex items-center gap-2"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
                strokeWidth={2}
              />
              Refresh
            </button>
            <Link
              to="/queries/new"
              data-testid="new-query-cta"
              className="h-10 px-4 bg-terminal-amber hover:bg-yellow-400 text-terminal-base font-mono text-[11px] uppercase tracking-wider inline-flex items-center gap-2"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={2.25} />
              New Query
            </Link>
          </>
        }
      />

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 border-b border-terminal-border">
        <StatsTile
          testId="stat-queries"
          label="// MONITORED QUERIES"
          value={stats?.total_queries ?? "—"}
          sub={`${stats?.enabled_queries ?? 0} active`}
        />
        <div className="border-l border-terminal-border">
          <StatsTile
            testId="stat-urls"
            label="// URLS DISCOVERED"
            value={stats?.total_discoveries ?? "—"}
            sub={stats?.last_run_at ? `last run ${fmtRelative(stats.last_run_at)}` : "awaiting run"}
          />
        </div>
        <div className="border-l border-terminal-border">
          <StatsTile
            testId="stat-new-24h"
            label="// NEW · 24H"
            value={stats?.new_last_24h ?? "—"}
            accent
            sub="newly indexed pages"
          />
        </div>
        <div className="border-l border-terminal-border">
          <StatsTile
            testId="stat-hit-rate"
            label="// HIT RATE"
            value={stats ? `${Math.round(stats.hit_rate * 100)}%` : "—"}
            sub={`${stats?.validated_total ?? 0} validated`}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px]">
        {/* Feed */}
        <section className="border-r border-terminal-border min-h-[400px]">
          <div className="flex items-center justify-between px-5 py-4 border-b border-terminal-border">
            <div className="overline">// DISCOVERY FEED</div>
            <Link
              to="/queries"
              className="font-mono text-[11px] uppercase tracking-wider text-terminal-zinc hover:text-terminal-amber"
              data-testid="feed-view-all"
            >
              view all →
            </Link>
          </div>
          {loading ? (
            <div className="p-8 font-mono text-[12px] text-terminal-zincDim">
              connecting to signal stream...
            </div>
          ) : discoveries.length === 0 ? (
            <div className="p-5">
              <EmptyState
                testId="empty-discoveries"
                title="No signals yet"
                description="Create a query and run it to start populating the discovery feed."
                action={
                  <Link
                    to="/queries/new"
                    data-testid="empty-new-query"
                    className="h-10 px-4 bg-terminal-amber text-terminal-base font-mono text-[11px] uppercase tracking-wider inline-flex items-center gap-2 hover:bg-yellow-400"
                  >
                    <Plus className="w-3.5 h-3.5" strokeWidth={2.25} /> Create Query
                  </Link>
                }
              />
            </div>
          ) : (
            <div>
              {discoveries.map((d) => (
                <DiscoveryRow key={d.id} d={d} onChange={load} showQuery />
              ))}
            </div>
          )}
        </section>

        {/* Query rail */}
        <aside className="min-h-[400px]">
          <div className="flex items-center justify-between px-5 py-4 border-b border-terminal-border">
            <div className="overline">// ACTIVE QUERIES</div>
            <span className="font-mono text-[11px] text-terminal-zincDim">
              {queries.length}
            </span>
          </div>
          {queries.length === 0 ? (
            <div className="p-5 font-mono text-[12px] text-terminal-zincDim">
              no queries configured
            </div>
          ) : (
            <div>
              {queries.map((q) => (
                <QueryRail key={q.id} q={q} onRun={load} />
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function QueryRail({ q, onRun }) {
  const [busy, setBusy] = useState(false);
  const handleRun = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);
    try {
      await api.runQuery(q.id);
      setTimeout(onRun, 1500);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Link
      to={`/queries/${q.id}`}
      data-testid={`rail-query-${q.id}`}
      className="block px-5 py-4 border-b border-terminal-border hover:bg-terminal-surface transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                q.enabled ? "bg-terminal-green" : "bg-terminal-zincDim"
              }`}
            />
            <span className="font-medium text-[13px] text-white truncate">
              {q.name}
            </span>
          </div>
          <div className="mt-1.5 font-mono text-[10.5px] uppercase tracking-wider text-terminal-zincDim flex items-center gap-3">
            <span>every {q.interval_minutes}m</span>
            <span>· {q.total_discoveries ?? 0} hits</span>
          </div>
        </div>
        <button
          onClick={handleRun}
          data-testid={`rail-run-${q.id}`}
          disabled={busy}
          className="h-7 w-7 flex items-center justify-center border border-terminal-border hover:border-terminal-amber hover:text-terminal-amber text-terminal-zinc shrink-0"
          title="Run now"
        >
          <Play className={`w-3 h-3 ${busy ? "animate-pulse" : ""}`} strokeWidth={2} />
        </button>
      </div>
    </Link>
  );
}
