import type { Response } from 'express';

const clients = new Map<string, Set<Response>>();

export function addClient(jobId: string, res: Response): void {
  if (!clients.has(jobId)) clients.set(jobId, new Set());
  clients.get(jobId)!.add(res);
}

export function removeClient(jobId: string, res: Response): void {
  clients.get(jobId)?.delete(res);
}

export function broadcast(jobId: string, data: object): void {
  const subs = clients.get(jobId);
  if (!subs || subs.size === 0) return;
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of subs) {
    try {
      res.write(payload);
    } catch {
      subs.delete(res);
    }
  }
}
