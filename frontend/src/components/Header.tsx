import { Link, useLocation } from 'react-router-dom';
import { Globe, Plus } from 'lucide-react';

export default function Header() {
  const { pathname } = useLocation();
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-semibold text-gray-900 hover:text-indigo-600 transition-colors">
          <Globe className="w-5 h-5 text-indigo-600" />
          Static Localization Agent
        </Link>
        {pathname !== '/new' && (
          <Link
            to="/new"
            className="flex items-center gap-1.5 bg-indigo-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Job
          </Link>
        )}
      </div>
    </header>
  );
}
