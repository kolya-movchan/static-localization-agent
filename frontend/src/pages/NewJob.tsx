import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Sparkles, FormInput, Loader2 } from 'lucide-react';
import { api } from '../api/client';
import AgentChat from '../components/AgentChat';

const COMMON_LOCALES = ['EN', 'UA', 'DE', 'FR', 'ES', 'PL', 'IT', 'RU'];

type Tab = 'form' | 'chat';

export default function NewJob() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('chat');

  // Form state
  const [inputUrl, setInputUrl] = useState('');
  const [selectedLangs, setSelectedLangs] = useState<string[]>([]);
  const [customLang, setCustomLang] = useState('');
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleLang(lang: string) {
    setSelectedLangs(prev =>
      prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang]
    );
  }

  function addCustomLang() {
    const l = customLang.trim().toUpperCase();
    if (l && !selectedLangs.includes(l)) {
      setSelectedLangs(prev => [...prev, l]);
    }
    setCustomLang('');
  }

  function detectInputType(url: string): 'file' | 'folder' {
    return url.includes('/folders/') ? 'folder' : 'file';
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!inputUrl.trim() || selectedLangs.length === 0) return;
    setError(null);
    setSubmitting(true);
    try {
      const job = await api.createJob({
        input_type: detectInputType(inputUrl),
        input_url: inputUrl.trim(),
        languages: selectedLangs,
        comments: comments.trim() || undefined,
      });
      navigate(`/jobs/${job.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create job');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-1">New Localization Job</h1>
      <p className="text-sm text-gray-500 mb-6">Localize images from a Google Drive file or folder using AI.</p>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit mb-6">
        <button
          onClick={() => setTab('chat')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === 'chat' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          AI Chat
        </button>
        <button
          onClick={() => setTab('form')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === 'form' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <FormInput className="w-3.5 h-3.5" />
          Form
        </button>
      </div>

      {tab === 'chat' ? (
        <AgentChat />
      ) : (
        <form onSubmit={submit} className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
          {/* URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Google Drive URL
            </label>
            <input
              type="url"
              value={inputUrl}
              onChange={e => setInputUrl(e.target.value)}
              placeholder="https://drive.google.com/file/d/... or /folders/..."
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            {inputUrl && (
              <p className="mt-1 text-xs text-gray-400">
                Detected as: <span className="font-medium text-gray-600">{detectInputType(inputUrl)}</span>
              </p>
            )}
          </div>

          {/* Languages */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Target Languages
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {COMMON_LOCALES.map(lang => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => toggleLang(lang)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium border transition-colors ${
                    selectedLangs.includes(lang)
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-400'
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={customLang}
                onChange={e => setCustomLang(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomLang())}
                placeholder="Custom (e.g. PT)"
                maxLength={5}
                className="w-28 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={addCustomLang}
                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Add
              </button>
            </div>
            {selectedLangs.length > 0 && (
              <p className="mt-2 text-xs text-gray-500">
                Selected: {selectedLangs.join(', ')}
              </p>
            )}
          </div>

          {/* Comments */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Additional Instructions <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={comments}
              onChange={e => setComments(e.target.value)}
              placeholder="Any special instructions for the AI translator..."
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!inputUrl.trim() || selectedLangs.length === 0 || submitting}
            className="w-full bg-indigo-600 text-white font-medium py-2.5 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Start Localization
          </button>
        </form>
      )}
    </div>
  );
}
