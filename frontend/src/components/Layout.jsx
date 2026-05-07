import { NavLink, Outlet, Link } from "react-router-dom";
import { Radar, Radio, Target, Activity, Plus, Crosshair } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { fmtRelative } from "@/lib/format";

const navItems = [
  { to: "/", label: "Console", icon: Radar, end: true },
  { to: "/queries", label: "Queries", icon: Target },
  { to: "/runs", label: "Runs", icon: Activity },
];

export default function Layout() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const s = await api.stats();
        if (alive) setStats(s);
      } catch (e) {
        // ignore
      }
    };
    load();
    const t = setInterval(load, 10000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  return (
    <div className="min-h-screen bg-terminal-base text-white flex">
      {/* Sidebar */}
      <aside
        data-testid="sidebar"
        className="w-60 shrink-0 border-r border-terminal-border bg-terminal-base flex flex-col sticky top-0 h-screen"
      >
        <div className="h-14 flex items-center px-5 border-b border-terminal-border">
          <Link to="/" data-testid="brand-link" className="flex items-center gap-2.5">
            <div className="relative">
              <Crosshair className="w-5 h-5 text-terminal-amber" strokeWidth={1.75} />
              <span className="absolute -right-0.5 -top-0.5 w-1.5 h-1.5 rounded-full bg-terminal-amber animate-pulse-amber" />
            </div>
            <span className="font-mono text-[15px] font-semibold tracking-tight">
              RADAR
              <span className="text-terminal-amber">.</span>
            </span>
          </Link>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              data-testid={`nav-${label.toLowerCase()}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 h-9 text-[13px] transition-colors border-l-2 ${
                  isActive
                    ? "border-terminal-amber text-white bg-terminal-surfaceHover"
                    : "border-transparent text-terminal-zinc hover:text-white hover:bg-terminal-surface"
                }`
              }
            >
              <Icon className="w-4 h-4" strokeWidth={1.75} />
              <span className="font-mono uppercase tracking-wider text-[11px]">
                {label}
              </span>
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-terminal-border space-y-2">
          <Link
            to="/queries/new"
            data-testid="sidebar-new-query-btn"
            className="flex items-center justify-between gap-2 h-9 px-3 bg-terminal-amber text-terminal-base font-mono text-[11px] uppercase tracking-wider hover:bg-yellow-400 transition-colors"
          >
            <span>New Query</span>
            <Plus className="w-4 h-4" strokeWidth={2} />
          </Link>
          <div className="font-mono text-[10px] text-terminal-zincDim leading-relaxed px-1">
            <div className="flex justify-between">
              <span>SCHED</span>
              <span className="text-terminal-green flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-terminal-green animate-pulse-amber" />
                ONLINE
              </span>
            </div>
            <div className="flex justify-between">
              <span>LAST</span>
              <span className="text-terminal-zinc">
                {stats?.last_run_at ? fmtRelative(stats.last_run_at) : "—"}
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 flex flex-col">
        <header
          data-testid="top-header"
          className="h-14 border-b border-terminal-border bg-terminal-base/80 backdrop-blur-xl sticky top-0 z-10 flex items-center justify-between px-8"
        >
          <div className="flex items-center gap-3">
            <Radio className="w-4 h-4 text-terminal-amber" strokeWidth={1.75} />
            <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-terminal-zinc">
              Signals Console
            </span>
          </div>
          <div className="flex items-center gap-6 font-mono text-[11px] text-terminal-zinc">
            <Pill label="QRYS" value={stats?.total_queries ?? "—"} />
            <Pill label="URLS" value={stats?.total_discoveries ?? "—"} />
            <Pill label="24H" value={stats?.new_last_24h ?? "—"} accent />
          </div>
        </header>
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function Pill({ label, value, accent }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-terminal-zincDim">{label}</span>
      <span
        className={`${
          accent ? "text-terminal-amber" : "text-white"
        } tabular-nums`}
      >
        {value}
      </span>
    </div>
  );
}
