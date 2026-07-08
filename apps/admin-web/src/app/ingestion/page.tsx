'use client';

import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Sidebar } from '@/components/Sidebar';

interface IngestionJob {
  id: string;
  blob_name: string;
  source_reference: string | null;
  status: string;
  mine_id: string | null;
  record_id: string | null;
  error_messages: string[] | null;
  created_at: string;
  completed_at: string | null;
}

interface JobsResponse {
  data: IngestionJob[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
}

async function fetchJobs(page: number): Promise<JobsResponse> {
  const params = new URLSearchParams({ page: String(page), pageSize: '20' });
  const res = await fetch(`${process.env.NEXT_PUBLIC_MSIM_API_URL}/documents?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch jobs');
  return res.json() as Promise<JobsResponse>;
}

async function submitIngestion(file: File, sourceReference: string): Promise<{ jobId: string }> {
  const formData = new FormData();
  formData.append('file', file);
  if (sourceReference) formData.append('sourceReference', sourceReference);
  const res = await fetch(`${process.env.NEXT_PUBLIC_MSIM_API_URL}/documents/ingest`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error('Ingestion request failed');
  return res.json() as Promise<{ jobId: string }>;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-900/30 text-yellow-400',
  processing: 'bg-blue-900/30 text-blue-400',
  success: 'bg-signal-low/20 text-signal-low',
  partial: 'bg-orange-900/30 text-orange-400',
  failed: 'bg-signal-critical/20 text-signal-critical',
};

export default function IngestionPage() {
  const isAuthenticated = useAdminAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [sourceRef, setSourceRef] = useState('');
  const [page, setPage] = useState(1);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated === false) router.push('/');
  }, [isAuthenticated, router]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-ingestion-jobs', page],
    queryFn: () => fetchJobs(page),
    enabled: isAuthenticated === true,
    refetchInterval: 10000, // poll every 10s to reflect processing status
  });

  const mutation = useMutation({
    mutationFn: ({ file, ref }: { file: File; ref: string }) => submitIngestion(file, ref),
    onSuccess: (result) => {
      setUploadSuccess(`Job queued: ${result.jobId}`);
      setUploadError(null);
      setSourceRef('');
      if (fileRef.current) fileRef.current.value = '';
      void queryClient.invalidateQueries({ queryKey: ['admin-ingestion-jobs'] });
    },
    onError: (err: Error) => {
      setUploadError(err.message);
      setUploadSuccess(null);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) { setUploadError('Please select a file'); return; }
    setUploadError(null);
    setUploadSuccess(null);
    mutation.mutate({ file, ref: sourceRef });
  }

  if (isAuthenticated !== true) return null;

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 p-8 bg-geo-obsidian min-h-screen">
        <h2 className="text-2xl font-bold text-geo-white mb-6">Document Ingestion</h2>

        {/* Upload form */}
        <div className="bg-geo-slate rounded-xl border border-geo-steel p-6 mb-8 max-w-lg">
          <h3 className="font-semibold text-geo-white mb-4">Upload Document</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-geo-cloud mb-1">Document file (PDF, image)</label>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.tiff,.bmp"
                className="block w-full text-sm text-geo-cloud file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-amber-900/20 file:text-amber-400 hover:file:bg-amber-900/30 bg-geo-graphite placeholder-geo-mist"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-geo-cloud mb-1">Source reference (optional)</label>
              <input
                type="text"
                value={sourceRef}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSourceRef(e.target.value)}
                placeholder="e.g. BRGM Report 1952, Colonial Survey Archive"
                className="w-full border border-geo-steel rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-geo-graphite text-geo-cloud placeholder-geo-mist"
              />
            </div>
            {uploadError && <p className="text-signal-critical text-sm">{uploadError}</p>}
            {uploadSuccess && <p className="text-green-600 text-sm">{uploadSuccess}</p>}
            <button
              type="submit"
              disabled={mutation.isPending}
              className="bg-amber-500 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {mutation.isPending ? 'Submitting…' : 'Start Ingestion'}
            </button>
          </form>
        </div>

        {/* Jobs table */}
        <h3 className="font-semibold text-geo-white mb-3">Ingestion Jobs</h3>
        {isLoading && <p className="text-geo-mist">Loading…</p>}
        {data && (
          <>
            <p className="text-sm text-geo-mist mb-3">{data.total} jobs</p>
            <div className="bg-geo-slate rounded-xl border border-geo-steel overflow-hidden">
              <table className="min-w-full text-sm">
                <thead className="bg-geo-graphite border-b border-geo-steel">
                  <tr>
                    {['Blob', 'Source Reference', 'Status', 'Record ID', 'Errors', 'Submitted'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-geo-mist uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-geo-steel/30">
                  {data.data.map((job) => (
                    <tr key={job.id} className="hover:bg-geo-graphite/50">
                      <td className="px-4 py-3 text-geo-cloud font-mono text-xs max-w-xs truncate">{job.blob_name}</td>
                      <td className="px-4 py-3 text-geo-mist text-xs max-w-xs truncate">{job.source_reference ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[job.status] ?? 'bg-geo-graphite text-geo-mist'}`}>
                          {job.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-geo-mist font-mono text-xs">{job.record_id ? job.record_id.slice(0, 8) + '…' : '—'}</td>
                      <td className="px-4 py-3 text-signal-critical text-xs max-w-xs truncate">
                        {job.error_messages?.length ? job.error_messages[0] : '—'}
                      </td>
                      <td className="px-4 py-3 text-geo-mist text-xs whitespace-nowrap">
                        {new Date(job.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="text-sm px-3 py-1 border border-geo-steel rounded bg-geo-graphite text-geo-mist hover:text-geo-white hover:border-geo-mist transition-colors disabled:opacity-30">Previous</button>
              <button onClick={() => setPage((p) => p + 1)} disabled={!data.hasNext}
                className="text-sm px-3 py-1 border border-geo-steel rounded bg-geo-graphite text-geo-mist hover:text-geo-white hover:border-geo-mist transition-colors disabled:opacity-30">Next</button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
