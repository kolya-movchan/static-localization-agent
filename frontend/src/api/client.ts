import type { Job, ChatMessage } from '../types';

const BASE = '/api';

async function handleRes<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  async listJobs(): Promise<Job[]> {
    return handleRes(await fetch(`${BASE}/jobs`));
  },

  async getJob(id: string): Promise<Job> {
    return handleRes(await fetch(`${BASE}/jobs/${id}`));
  },

  async createJob(payload: {
    input_type: string;
    input_url: string;
    languages: string[];
    comments?: string;
  }): Promise<Job> {
    return handleRes(
      await fetch(`${BASE}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    );
  },

  async deleteJob(id: string): Promise<void> {
    await fetch(`${BASE}/jobs/${id}`, { method: 'DELETE' });
  },

  async agentChat(messages: ChatMessage[]): Promise<{
    message: string;
    jobId?: string;
    job?: Job;
  }> {
    return handleRes(
      await fetch(`${BASE}/agent/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
      })
    );
  },

  streamJob(id: string): EventSource {
    return new EventSource(`${BASE}/jobs/${id}/stream`);
  },
};
