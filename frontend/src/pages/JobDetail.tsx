import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, FolderOpen, ExternalLink, RefreshCw, CheckCircle2, XCircle, Clock } from 'lucide-react';
import type { Job, JobItem } from '../types';
import { api } from '../api/client';
import StatusBadge from '../components/StatusBadge';

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function ProgressBar({ total, processed, failed }: { total: number; processed: number; failed: number }) {
  if (total === 0) return <div className="h-2 bg-gray-100 rounded-full" />;
  const successPct = ((processed - failed) / total) * 100;
  const failPct = (failed / total) * 100;
  return (
    <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex">
      <div className="bg-green-500 transition-all duration-500" style={{ width: `${successPct}%` }} />
      <div className="bg-red-400 transition-all duration-500" style={{ width: `${failPct}%` }} />
    </div>
  );
}

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [items, setItems] = useState<JobItem[]>([]);
  const [loading, setLoading] = useState(true);
  const esRef = useRef<EventSource | null>(null);

  // Initial load
  useEffect(() => {
    if (!id) return;
    api.getJob(id).then(data => {
      setJob(data);
      setItems(data.items ?? []);
      setLoading(false);
    });
  }, [id]);

  // SSE live updates
  useEffect(() => {
    if (!id) return;
    const es = api.streamJob(id);
    esRef.current = es;

    es.onmessage = (e) => {
      const msg = JSON.parse(e.data) as Record<string, unknown>;

      if (msg.type === 'snapshot') {
        setJob(msg.job as Job);
        setItems(msg.items as JobItem[]);
        return;
      }

      // Refresh job on any terminal event
      if (msg.type === 'job_done' || msg.type === 'job_error') {
        api.getJob(id!).then(data => { setJob(data); setItems(data.items ?? []); });
        return;
      }

      // Item updates
      if (msg.type === 'item_done' || msg.type === 'item_error' || msg.type === 'item_start') {
        setItems(prev => prev.map(item => {
          if (item.id !== msg.itemId) return item;
          if (msg.type === 'item_start') return { ...item, status: 'processing' as const };
          if (msg.type === 'item_done') return {
            ...item,
            status: 'success' as const,
            model_used: msg.modelUsed as string,
            output_file_url: msg.outputFileUrl as string,
            output_folder_url: msg.outputFolderUrl as string,
          };
          if (msg.type === 'item_error') return { ...item, status: 'error' as const, error_message: msg.error as string };
          return item;
        }));

        // Refresh job counts
        setJob(prev => {
          if (!prev) return prev;
          if (msg.type === 'item_done' || msg.type === 'item_error') {
            return {
              ...prev,
              processed_images: prev.processed_images + 1,
              failed_images: msg.type === 'item_error' ? prev.failed_images + 1 : prev.failed_images,
            };
          }
          return prev;
        });
      }

      if (msg.type === 'job_counts') {
        setJob(prev => prev ? { ...prev, total_images: msg.total as number } : prev);
      }
    };

    return () => { es.close(); };
  }, [id]);

  if (loading || !job) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400">
        <RefreshCw className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  const successCount = job.processed_images - job.failed_images;

  // Group items by image name
  const imageGroups = items.reduce<Record<string, JobItem[]>>((acc, item) => {
    if (!acc[item.image_name]) acc[item.image_name] = [];
    acc[item.image_name].push(item);
    return acc;
  }, {});

  return (
    <div className="max-w-4xl mx-auto">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </Link>

      {/* Job header */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <StatusBadge status={job.status} />
              <span className="text-xs text-gray-400 font-mono">{job.id}</span>
            </div>

            <p className="text-sm text-gray-600 break-all mb-3">
              <span className="text-xs text-gray-400 uppercase font-semibold mr-1">{job.input_type}</span>
              {job.input_url}
            </p>

            <div className="flex flex-wrap gap-1.5 mb-4">
              {job.languages.map(lang => (
                <span key={lang} className="bg-indigo-50 text-indigo-700 text-xs font-medium px-2 py-0.5 rounded">
                  {lang}
                </span>
              ))}
            </div>

            {job.total_images > 0 && (
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                  <span>{job.processed_images} / {job.total_images} processed</span>
                  <span>{successCount} success · {job.failed_images} failed</span>
                </div>
                <ProgressBar total={job.total_images} processed={job.processed_images} failed={job.failed_images} />
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            {job.parent_folder_url && (
              <a
                href={job.parent_folder_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors"
              >
                <FolderOpen className="w-4 h-4" />
                Open Folder
              </a>
            )}
          </div>
        </div>

        <div className="flex gap-4 mt-4 pt-4 border-t border-gray-100 text-xs text-gray-400">
          <div className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Created {formatDate(job.created_at)}</div>
          {job.completed_at && <div className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Completed {formatDate(job.completed_at)}</div>}
        </div>

        {job.error_message && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <p className="text-xs font-medium text-red-700 mb-0.5">Error</p>
              <p className="text-xs text-red-600 font-mono break-all">{job.error_message}</p>
            </div>
          </div>
        )}
        {job.comments && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-500"><span className="font-medium">Instructions:</span> {job.comments}</p>
          </div>
        )}
      </div>

      {/* Items grouped by image */}
      {Object.keys(imageGroups).length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Images</h2>
          <div className="space-y-3">
            {Object.entries(imageGroups).map(([imageName, imageItems]) => (
              <div key={imageName} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                  <p className="text-sm font-medium text-gray-700 truncate">{imageName}</p>
                </div>
                <div className="divide-y divide-gray-100">
                  {imageItems.map(item => (
                    <div key={item.id} className="px-4 py-3 flex items-center gap-3">
                      <StatusBadge status={item.status} />
                      <span className="text-xs font-medium text-gray-600 w-10">{item.language}</span>

                      {item.status === 'success' && item.output_file_url && (
                        <a
                          href={item.output_file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 font-medium ml-auto"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          View file
                        </a>
                      )}
                      {item.status === 'success' && item.output_folder_url && (
                        <a
                          href={item.output_folder_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 font-medium"
                        >
                          <FolderOpen className="w-3.5 h-3.5" />
                          Folder
                        </a>
                      )}
                      {item.status === 'success' && item.model_used && (
                        <span className="text-xs text-gray-300 font-mono ml-auto">{item.model_used.replace('models/', '')}</span>
                      )}

                      {item.status === 'error' && item.error_message && (
                        <div className="ml-auto flex items-center gap-1 text-xs text-red-500">
                          <XCircle className="w-3.5 h-3.5" />
                          <span className="truncate max-w-xs">{item.error_message}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
