import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Bot, User, Loader2 } from 'lucide-react';
import type { ChatMessage } from '../types';
import { api } from '../api/client';

const WELCOME: ChatMessage = {
  role: 'model',
  content: "Hi! I'm your Localization Agent. Share a Google Drive file or folder URL and I'll help you set up an image localization job. What would you like to localize?",
};

export default function AgentChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setLoading(true);

    try {
      // Send all messages except the initial welcome (it's the system context)
      const history = next.filter((_, i) => i > 0);
      const res = await api.agentChat(history);

      setMessages(prev => [...prev, { role: 'model', content: res.message }]);

      if (res.jobId) {
        setTimeout(() => navigate(`/jobs/${res.jobId}`), 1500);
      }
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { role: 'model', content: 'Something went wrong. Please try again.' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-[560px] bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
              msg.role === 'model' ? 'bg-indigo-100' : 'bg-gray-100'
            }`}>
              {msg.role === 'model'
                ? <Bot className="w-4 h-4 text-indigo-600" />
                : <User className="w-4 h-4 text-gray-600" />
              }
            </div>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
              msg.role === 'model'
                ? 'bg-gray-50 text-gray-800 rounded-tl-sm'
                : 'bg-indigo-600 text-white rounded-tr-sm'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center">
              <Bot className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="bg-gray-50 rounded-2xl rounded-tl-sm px-4 py-2.5">
              <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-gray-100 p-3 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="Type a message..."
          disabled={loading}
          className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
        />
        <button
          onClick={send}
          disabled={!input.trim() || loading}
          className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
