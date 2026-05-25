import { useState, useEffect } from 'react';
import { HardDrive, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface AuthStatus {
  mode: 'oauth2' | 'service_account';
  connected: boolean;
  serviceAccountEmail?: string;
}

export default function DriveStatus() {
  const [status, setStatus] = useState<AuthStatus | null>(null);

  useEffect(() => {
    fetch('/api/auth/status')
      .then(r => r.json())
      .then(setStatus)
      .catch(() => null);
  }, []);

  if (!status) {
    return <Loader2 className="w-4 h-4 text-gray-300 animate-spin" />;
  }

  if (status.connected) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-green-600">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Drive connected
      </div>
    );
  }

  // OAuth2 not connected
  if (status.mode === 'oauth2') {
    return (
      <a
        href="/api/auth/google"
        className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors"
      >
        <AlertCircle className="w-3.5 h-3.5" />
        Connect Google Drive
      </a>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-red-500">
      <HardDrive className="w-3.5 h-3.5" />
      Drive not configured
    </div>
  );
}
