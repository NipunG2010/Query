import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Play, Power, Trash2, RefreshCw, ChevronLeft, Filter } from "lucide-react";
import { api } from "@/lib/api";
import { fmtRelative, fmtTime } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import DiscoveryRow from "@/components/DiscoveryRow";
import EmptyState from "@/components/EmptyState";
import { toast } from "sonner";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "new", label: "New" },
  { id: "validated", label: "Validated" },
  { id: "ignored", label: "Ignored" },
  { id: "valid", label: "Matches only" },
];

export default function QueryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [q, setQ] = useState(null);
  const [discoveries, setDiscoveries] = useState([]);
  const [runs, setRuns] = useState([]);
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const params = { query_id: id, limit: 500 };
    if (filter === "new" || filter === "validated" || filter === "ignored") {
      params.status = filter;
    }
    if (filter === "valid") params.valid_only = true;
    const [qd, d, r] = await Promise.all([
      api.getQuery(id),
      api.listDiscoveries(params),
      api.listRuns({ query_id: id, limit: 15 }),
    ]);
    setQ(qd);
    setDiscoveries(d);
    setRuns(r);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, filter]);

  const run = async () => {
    setBusy(true);
    await api.runQuery(id);
    toast.success("Run started");
    setTimeout(() => {
      load();
      setBusy(false);
    }, 2500);
  };

  const toggle = async () => {
    await api.updateQuery(id, { enabled: !q.enabled });
    toast.success(!q.enabled ? "Enabled" : "Paused");
    load();
  };

  const del = async () => {
    if (!window.confirm(`Delete "${q.name}" and all its discoveries?`)) return;
    await api.deleteQuery(id);
    toast.success("Deleted");
    navigate("/queries");
  };

  if (!q) {
    return (
      <div className="p-8 font-mono text-[12px] text-terminal-zincDim">loading...</div>
    );
  }

  return (
    <div>
      <PageHeader
        overline={`// QUERY · ${q.enabled ? "ACTIVE" : "PAUSED"}`}
        title={q.name}
        subtitle={null}
        actions={
          <>
            <Link
              to="/queries"
              className="h-10 px-3 border border-terminal-border text-terminal-zinc hover:text-white font-mono text-[11px] uppercase tracking-wider inline-flex items-center gap-2"
              data-testid="back-queries"
            >
              <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2} />
              Queries
            </Link>
            <button
              onClick={run}
              disabled={busy}
              data-testid="run-now-btn"
              className="h-10 px-4 bg-terminal-amber hover:bg-yellow-400 text-terminal-base font-mono text-[11px] uppercase tracking-wider inline-flex items-center gap-2 disabled:opacity-50"
            >
              <Play className={`w-3.5 h-3.5 ${busy ? "animate-pulse" : ""}`} strokeWidth={2.25} />
              Run Now
            </button>
            <button
              onClick={toggle}
              data-testid="toggle-enabled-btn"
              className="h-10 px-3 border border-terminal-border text-terminal-zinc hover:text-terminal-green hover:border-terminal-green font-mono text-[11px] uppercase tracking-wider inline-flex items-center gap-2"
            >
              <Power className="w-3.5 h-3.5" strokeWidth={2} />
              {q.enabled ? "Pause" : "Enable"}
            </button>
            <button
              onClick={del}
              data-testid="delete-query-btn"
              className="h-10 w-10 border border-terminal-border text-terminal-zinc hover:text-terminal-red hover:border-terminal-red inline-flex items-center justify-center"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          </>
        }
      />

      {/* Meta strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 border-b border-terminal-border">
        <Meta label="INTERVAL" value={`${q.interval_minutes}m`} />
        <Meta label="DISCOVERIES" value={q.total_discoveries} accent />
        <Meta label="LAST RUN" value={fmtRelative(q.last_run_at)} />
        <Meta label="LAST STATUS" value={q.last_run_status || "—"} />
      </div>

      {/* Query string */}
      <div className="p-8 border-b border-terminal-border">
        <div className="overline mb-3">// QUERY STRING</div>
        <pre
          data-testid="query-string-display"
          className="bg-terminal-surface border border-terminal-border p-4 font-mono text-[11.5px] text-terminal-amber whitespace-pre-wrap break-words leading-relaxed"
        >
          {q.query}
        </pre>
        {(q.keywords.length > 0 || q.negative_keywords.length > 0) && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {q.keywords.length > 0 && (
              <div>
                <div className="overline mb-2">// KEYWORDS</div>
                <div className="flex flex-wrap gap-1.5">
                  {q.keywords.map((k) => (
                    <span key={k} className="border border-terminal-green/40 bg-terminal-green/10 text-terminal-green font-mono text-[10.5px] px-2 py-0.5">
                      {k}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {q.negative_keywords.length > 0 && (
              <div>
                <div className="overline mb-2">// NEGATIVE</div>
                <div className="flex flex-wrap gap-1.5">
                  {q.negative_keywords.map((k) => (
                    <span key={k} className="border border-terminal-red/40 bg-terminal-red/10 text-terminal-red font-mono text-[10.5px] px-2 py-0.5">
                      -{k}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Discoveries + runs */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px]">
        <section className="border-r border-terminal-border min-h-[400px]">
          <div className="flex items-center justify-between px-5 py-3 border-b border-terminal-border flex-wrap gap-2">
            <div className="overline flex items-center gap-2">
              <Filter className="w-3 h-3" strokeWidth={2} />
              DISCOVERIES · {discoveries.length}
            </div>
            <div className="flex items-center gap-1">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  data-testid={`filter-${f.id}`}
                  className={`h-7 px-2.5 font-mono text-[10px] uppercase tracking-wider border ${
                    filter === f.id
                      ? "border-terminal-amber text-terminal-amber bg-terminal-amber/10"
                      : "border-terminal-border text-terminal-zinc hover:text-white"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          {discoveries.length === 0 ? (
            <div className="p-5">
              <EmptyState
                testId="query-empty"
                title={filter === "all" ? "No discoveries yet" : `No ${filter} items`}
                description={filter === "all" ? "Trigger a run to start collecting results." : "Switch filter to see other items."}
                action={
                  filter === "all" && (
                    <button
                      onClick={run}
                      data-testid="empty-run-btn"
                      className="h-10 px-4 bg-terminal-amber text-terminal-base font-mono text-[11px] uppercase tracking-wider inline-flex items-center gap-2 hover:bg-yellow-400"
                    >
                      <Play className="w-3.5 h-3.5" strokeWidth={2.25} /> Run first scan
                    </button>
                  )
                }
              />
            </div>
          ) : (
            <div>
              {discoveries.map((d) => (
                <DiscoveryRow key={d.id} d={d} onChange={load} />
              ))}
            </div>
          )}
        </section>

        <aside>
          <div className="px-5 py-3 border-b border-terminal-border flex items-center justify-between">
            <div className="overline">// RUN HISTORY</div>
            <RefreshCw className="w-3 h-3 text-terminal-zincDim" strokeWidth={2} />
          </div>
          {runs.length === 0 ? (
            <div className="px-5 py-6 font-mono text-[11px] text-terminal-zincDim">
              no runs yet
            </div>
          ) : (
            <div>
              {runs.map((r) => (
                <div
                  key={r.id}
                  data-testid={`run-${r.id}`}
                  className="px-5 py-3 border-b border-terminal-border"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] text-terminal-zinc">
                      {fmtTime(r.started_at)}
                    </span>
                    <span
                      className={`font-mono text-[9.5px] uppercase tracking-wider px-1.5 py-0.5 border ${
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
                  <div className="mt-1 font-mono text-[10.5px] text-terminal-zincDim flex items-center gap-3">
                    <span>
                      <span className="text-white tabular-nums">{r.total_results}</span> total
                    </span>
                    <span>
                      <span className="text-terminal-amber tabular-nums">{r.new_results}</span> new
                    </span>
                    <span>
                      <span className="text-terminal-green tabular-nums">{r.valid_new_results}</span> match
                    </span>
                  </div>
                  {r.error && (
                    <div className="mt-1 font-mono text-[10px] text-terminal-red truncate" title={r.error}>
                      {r.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Meta({ label, value, accent }) {
  return (
    <div className="px-6 py-5 border-r border-terminal-border last:border-r-0">
      <div className="overline">// {label}</div>
      <div className={`mt-2 font-mono text-xl tabular-nums ${accent ? "text-terminal-amber" : "text-white"}`}>
        {value}
      </div>
    </div>
  );
}
