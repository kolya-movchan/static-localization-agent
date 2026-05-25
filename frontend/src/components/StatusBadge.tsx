import type { JobStatus, ItemStatus } from '../types';

const styles: Record<string, string> = {
  pending:    'bg-gray-100 text-gray-600',
  running:    'bg-blue-100 text-blue-700',
  processing: 'bg-blue-100 text-blue-700',
  completed:  'bg-green-100 text-green-700',
  success:    'bg-green-100 text-green-700',
  failed:     'bg-red-100 text-red-700',
  error:      'bg-red-100 text-red-700',
};

export default function StatusBadge({ status }: { status: JobStatus | ItemStatus }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status === 'running' || status === 'processing' ? (
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5 animate-pulse" />
      ) : null}
      {status}
    </span>
  );
}
