'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getRevivalJobs, getRevivalStats, triggerRevival, type RevivalJob } from '@/lib/api-client';

const statusBadge: Record<string, string> = {
  queued: 'bg-signal-medium/20 text-signal-medium',
  processing: 'bg-brand-primary/20 text-brand-primary',
  completed: 'bg-signal-low/20 text-signal-low',
  failed: 'bg-signal-critical/20 text-signal-critical',
};

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="bg-geo-slate border border-geo-steel rounded-xl px-5 py-3 flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-geo-mist">{label}</span>
      <span className={`font-mono text-2xl font-bold ${accent ?? 'text-geo-white'}`}>{value}</span>
    </div>
  );
}

export default function ArchiveRevivalPage() {
  const isAuthenticated = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({ mine_id: '', priority: 5 });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) router.replace('/');
  }, [isAuthenticated, router]);

  const { data: jobsData, isLoading: jobsLoading } = useQuery({
    queryKey: ['revival-jobs'],
    queryFn: () => getRevivalJobs({ pageSize: 100 }),
    enabled: isAuthenticated,
    refetchInterval: 15_000,
  });

  const { data: stats } = useQuery({
    queryKey: ['revival-stats'],
    queryFn: () => getRevivalStats(),
    enabled: isAuthenticated,
    refetchInterval: 15_000,
  });

  if (!isAuthenticated) return null;

  const jobs: RevivalJob[] = jobsData?.data ?? [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);
    try {
      await triggerRevival({
        mine_id: form.mine_id || undefined,
        priority: form.priority,
      });
      await queryClient.invalidateQueries({ queryKey: ['revival-jobs'] });
      await queryClient.invalidateQueries({ queryKey: ['revival-stats'] });
      setForm({ mine_id: '', priority: 5 });
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 3000);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to trigger revival');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-full overflow-hidden flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-geo-steel flex-shrink-0 bg-geo-obsidian">
        <h1 className="font-display font-bold text-xl text-geo-white">Archive Revival Engine</h1>
        <p className="text-xs text-geo-mist mt-0.5">Queue and monitor historical archive processing jobs</p>
      </div>

      {/* Stats bar */}
      <div className="px-6 py-3 border-b border-geo-steel bg-geo-obsidian flex-shrink-0">
        <div className="flex gap-4">
          <StatCard label="Queued" value={stats?.queued ?? '—'} accent="text-signal-medium" />
          <StatCard label="Processing" value={stats?.processing ?? '—'} accent="text-brand-primary" />
          <StatCard label="Completed" value={stats?.completed ?? '—'} accent="text-signal-low" />
          <StatCard label="Failed" value={stats?.failed ?? '—'} accent="text-signal-critical" />
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: job list */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-semibold text-sm text-geo-white">Revival Jobs</h2>
            <span className="text-[10px] text-geo-mist">{jobsData?.total ?? 0} total</span>
          </div>

          {jobsLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2">
              <p className="text-geo-mist text-sm">No revival jobs yet.</p>
              <p className="text-[11px] text-geo-steel">Use the form to trigger your first job.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="bg-geo-slate border border-geo-steel rounded-xl px-4 py-3 flex items-start gap-4"
                >
                  {/* Priority pill */}
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-geo-graphite flex items-center justify-center">
                    <span className="font-mono text-xs font-bold text-copper-light">{job.priority}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                          statusBadge[job.status] ?? 'bg-geo-graphite text-geo-mist'
                        }`}
                      >
                        {job.status}
                      </span>
                      {job.mine_name && (
                        <span className="text-[11px] font-medium text-geo-cloud">{job.mine_name}</span>
                      )}
                    </div>
                    <p className="text-xs text-geo-cloud truncate">
                      {job.document_title ?? job.document_id ?? 'No document linked'}
                    </p>
                    {job.error_message && (
                      <p className="text-[10px] text-signal-critical mt-1 truncate">{job.error_message}</p>
                    )}
                  </div>

                  <div className="flex-shrink-0 text-right">
                    <p className="text-[10px] text-geo-mist">
                      {new Date(job.created_at).toLocaleDateString()}
                    </p>
                    {job.completed_at && (
                      <p className="text-[10px] text-signal-low mt-0.5">
                        Done {new Date(job.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                    {job.started_at && !job.completed_at && (
                      <p className="text-[10px] text-brand-primary mt-0.5">Running…</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Trigger form */}
        <aside className="w-72 flex-shrink-0 bg-geo-slate border-l border-geo-steel flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-geo-steel flex-shrink-0">
            <h3 className="font-display font-semibold text-sm text-geo-white">Trigger New Job</h3>
            <p className="text-[10px] text-geo-mist mt-0.5">Queue an archive revival process</p>
          </div>

          <form onSubmit={handleSubmit} className="px-5 py-4 flex flex-col gap-5 flex-1">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-geo-mist">
                Mine ID
              </label>
              <input
                type="text"
                placeholder="mine-uuid (optional)"
                value={form.mine_id}
                onChange={(e) => setForm((f) => ({ ...f, mine_id: e.target.value }))}
                className="h-9 px-3 bg-geo-graphite border border-geo-steel rounded-lg text-xs text-geo-cloud placeholder-geo-mist focus:outline-none focus:border-brand-primary transition-colors"
              />
              <p className="text-[10px] text-geo-steel">Link this job to a specific mine</p>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-geo-mist">
                  Priority
                </label>
                <span className="font-mono text-sm font-bold text-copper-light">{form.priority}</span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) }))}
                className="w-full accent-copper-light cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-geo-steel">
                <span>Low (1)</span>
                <span>High (10)</span>
              </div>
            </div>

            <div className="mt-auto space-y-2">
              {submitError && (
                <p className="text-[11px] text-signal-critical bg-signal-critical/10 border border-signal-critical/30 rounded-lg px-3 py-2">
                  {submitError}
                </p>
              )}
              {submitSuccess && (
                <p className="text-[11px] text-signal-low bg-signal-low/10 border border-signal-low/30 rounded-lg px-3 py-2">
                  Job queued successfully.
                </p>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="w-full h-10 bg-brand-primary hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors"
              >
                {submitting ? 'Queueing…' : 'Trigger Revival'}
              </button>
            </div>
          </form>
        </aside>
      </div>
    </div>
  );
}
