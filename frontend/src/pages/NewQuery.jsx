import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Save, ChevronLeft, Lightbulb } from "lucide-react";
import { api } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { toast } from "sonner";

const EXAMPLE_QUERY = `("for founders" OR "founder community" OR "startup founders" OR "saas founders" OR "founder network" OR "founders club" OR "operator community") ("apply" OR "apply to join" OR "request access" OR "join" OR "membership" OR "waitlist" OR "invite-only" OR "private") ("community" OR "network" OR "circle" OR "collective" OR "group") (inurl:join OR inurl:apply OR inurl:waitlist OR inurl:membership OR inurl:community) -site:linkedin.com -site:instagram.com -site:facebook.com -site:twitter.com -site:x.com -site:youtube.com -site:medium.com -site:reddit.com -site:airtable.com`;

export default function NewQuery() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    query: "",
    keywords: "apply, join, waitlist, invite, membership, request access",
    negative_keywords: "software, tool, crm, platform, template, pricing",
    interval_minutes: 15,
    num_results: 30,
    enabled: true,
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.query.trim()) {
      toast.error("Name and query are required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        query: form.query,
        keywords: form.keywords
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        negative_keywords: form.negative_keywords
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        interval_minutes: parseInt(form.interval_minutes) || 15,
        num_results: parseInt(form.num_results) || 30,
        enabled: !!form.enabled,
      };
      const q = await api.createQuery(payload);
      toast.success("Query deployed · running first scan");
      // Kick off a first run immediately
      api.runQuery(q.id).catch(() => {});
      navigate(`/queries/${q.id}`);
    } catch (e) {
      toast.error("Failed to create query");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        overline="// NEW QUERY"
        title={
          <>
            Deploy a <span className="text-terminal-amber">Signal</span>
          </>
        }
        subtitle="Configure a Google search query with advanced operators and filter rules. The scheduler will poll SerpAPI on your interval and alert on new URLs."
        actions={
          <button
            onClick={() => navigate(-1)}
            data-testid="back-btn"
            className="h-10 px-3 border border-terminal-border text-terminal-zinc hover:text-white font-mono text-[11px] uppercase tracking-wider inline-flex items-center gap-2"
          >
            <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2} />
            Back
          </button>
        }
      />

      <form onSubmit={submit} className="p-8 max-w-4xl grid gap-6">
        <Field label="// QUERY NAME" hint="Short identifier">
          <input
            type="text"
            data-testid="field-name"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. Founder communities accepting applications"
            className="w-full h-11 bg-transparent border border-terminal-border px-3 text-white font-mono text-[13px] outline-none focus:border-terminal-amber focus:ring-1 focus:ring-terminal-amber"
          />
        </Field>

        <Field
          label="// GOOGLE QUERY"
          hint="Supports OR, inurl:, site:, -site:, -term, quoted phrases"
          action={
            <button
              type="button"
              onClick={() => set("query", EXAMPLE_QUERY)}
              data-testid="paste-example-btn"
              className="font-mono text-[10px] uppercase tracking-wider text-terminal-amber inline-flex items-center gap-1.5 hover:text-yellow-300"
            >
              <Lightbulb className="w-3 h-3" strokeWidth={2} /> Paste example
            </button>
          }
        >
          <textarea
            data-testid="field-query"
            value={form.query}
            onChange={(e) => set("query", e.target.value)}
            rows={8}
            placeholder={EXAMPLE_QUERY}
            className="w-full bg-terminal-surface border border-terminal-border p-3 text-terminal-amber font-mono text-[12px] leading-relaxed outline-none focus:border-terminal-amber focus:ring-1 focus:ring-terminal-amber whitespace-pre-wrap resize-y"
          />
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Field label="// KEYWORDS" hint="Comma-separated. Title/snippet must match at least one.">
            <input
              type="text"
              data-testid="field-keywords"
              value={form.keywords}
              onChange={(e) => set("keywords", e.target.value)}
              placeholder="apply, join, waitlist"
              className="w-full h-11 bg-transparent border border-terminal-border px-3 text-white font-mono text-[13px] outline-none focus:border-terminal-amber focus:ring-1 focus:ring-terminal-amber"
            />
          </Field>
          <Field label="// NEGATIVE KEYWORDS" hint="Any match here marks as not matching.">
            <input
              type="text"
              data-testid="field-negative"
              value={form.negative_keywords}
              onChange={(e) => set("negative_keywords", e.target.value)}
              placeholder="software, tool, crm"
              className="w-full h-11 bg-transparent border border-terminal-border px-3 text-white font-mono text-[13px] outline-none focus:border-terminal-amber focus:ring-1 focus:ring-terminal-amber"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Field label="// INTERVAL" hint="Minutes between polls">
            <select
              data-testid="field-interval"
              value={form.interval_minutes}
              onChange={(e) => set("interval_minutes", e.target.value)}
              className="w-full h-11 bg-terminal-surface border border-terminal-border px-3 text-white font-mono text-[13px] outline-none focus:border-terminal-amber focus:ring-1 focus:ring-terminal-amber"
            >
              <option value={5}>Every 5 minutes</option>
              <option value={10}>Every 10 minutes</option>
              <option value={15}>Every 15 minutes</option>
              <option value={30}>Every 30 minutes</option>
              <option value={60}>Every hour</option>
              <option value={180}>Every 3 hours</option>
              <option value={720}>Every 12 hours</option>
              <option value={1440}>Daily</option>
            </select>
          </Field>
          <Field label="// RESULTS PER RUN" hint="10–100">
            <input
              type="number"
              min="10"
              max="100"
              data-testid="field-num-results"
              value={form.num_results}
              onChange={(e) => set("num_results", e.target.value)}
              className="w-full h-11 bg-transparent border border-terminal-border px-3 text-white font-mono text-[13px] outline-none focus:border-terminal-amber focus:ring-1 focus:ring-terminal-amber"
            />
          </Field>
          <Field label="// STATE" hint="Auto-run on schedule">
            <label className="flex items-center gap-3 h-11 px-3 border border-terminal-border cursor-pointer select-none">
              <input
                type="checkbox"
                data-testid="field-enabled"
                checked={form.enabled}
                onChange={(e) => set("enabled", e.target.checked)}
                className="accent-[#f59e0b] w-4 h-4"
              />
              <span className="font-mono text-[12px] uppercase tracking-wider">
                {form.enabled ? "Active" : "Paused"}
              </span>
            </label>
          </Field>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            data-testid="submit-query-btn"
            className="h-11 px-6 bg-terminal-amber hover:bg-yellow-400 text-terminal-base font-mono text-[11px] uppercase tracking-wider inline-flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" strokeWidth={2} />
            {saving ? "Deploying..." : "Deploy Query"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, hint, action, children }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-terminal-amber">
            {label}
          </div>
          {hint && (
            <div className="font-mono text-[10.5px] text-terminal-zincDim mt-1">
              {hint}
            </div>
          )}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}
