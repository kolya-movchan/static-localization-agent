import { Link } from 'react-router-dom';
import { FolderOpen, Clock, CheckCircle2, XCircle, ChevronRight } from 'lucide-react';
import type { Job } from '../types';
import StatusBadge from './StatusBadge';

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function ProgressBar({ total, processed, failed }: { total: number; processed: number; failed: number }) {
  if (total === 0) return null;
  const successPct = ((processed - failed) / total) * 100;
  const failPct = (failed / total) * 100;
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{processed}/{total} processed</span>
        {failed > 0 && <span className="text-red-500">{failed} failed</span>}
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden flex">
        <div className="bg-green-500 transition-all duration-300" style={{ width: `${successPct}%` }} />
        <div className="bg-red-400 transition-all duration-300" style={{ width: `${failPct}%` }} />
      </div>
    </div>
  );
}

export default function JobCard({ job }: { job: Job }) {
  const inputLabel = job.input_type === 'folder' ? 'Folder' : 'File';

  return (
    <Link
      to={`/jobs/${job.id}`}
      className="block bg-white border border-gray-200 rounded-xl p-5 hover:border-indigo-300 hover:shadow-sm transition-all group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <StatusBadge status={job.status} />
            <span className="text-xs text-gray-400 font-mono">{job.id.slice(0, 8)}</span>
          </div>

          <p className="text-sm text-gray-600 truncate">
            <span className="font-medium text-gray-400 text-xs uppercase tracking-wide mr-1">{inputLabel}</span>
            {job.input_url}
          </p>

          <div className="flex flex-wrap gap-1.5 mt-2">
            {job.languages.map(lang => (
              <span key={lang} className="bg-indigo-50 text-indigo-700 text-xs font-medium px-2 py-0.5 rounded">
                {lang}
              </span>
            ))}
          </div>

          {job.total_images > 0 && (
            <ProgressBar total={job.total_images} processed={job.processed_images} failed={job.failed_images} />
          )}
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-500 transition-colors" />
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <Clock className="w-3 h-3" />
            {formatDate(job.created_at)}
          </div>
          {job.parent_folder_url && (
            <a
              href={job.parent_folder_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 font-medium"
            >
              <FolderOpen className="w-3 h-3" />
              Drive
            </a>
          )}
        </div>
      </div>

      {job.status === 'completed' && (
        <div className="mt-3 flex items-center gap-1 text-xs text-green-600">
          <CheckCircle2 className="w-3.5 h-3.5" />
          {job.processed_images - job.failed_images} images localized successfully
        </div>
      )}
      {job.status === 'failed' && (
        <div className="mt-3 flex items-center gap-1 text-xs text-red-500">
          <XCircle className="w-3.5 h-3.5" />
          Job failed
        </div>
      )}
    </Link>
  );
}
