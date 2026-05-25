import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { queries, touch } from '../db/database';
import { addClient, removeClient } from '../jobs/sse';

const router = Router();

// POST /api/jobs
router.post('/', (req: Request, res: Response) => {
  const { input_type, input_url, languages, comments } = req.body as {
    input_type?: string;
    input_url?: string;
    languages?: string[];
    comments?: string;
  };

  if (!input_type || !input_url || !languages?.length) {
    res.status(400).json({ error: 'input_type, input_url, and languages are required' });
    return;
  }

  if (!['file', 'folder'].includes(input_type)) {
    res.status(400).json({ error: 'input_type must be "file" or "folder"' });
    return;
  }

  const id = uuidv4();
  queries.createJob.run(id, input_type, input_url, JSON.stringify(languages), comments ?? null);

  const job = queries.getJob.get(id);
  res.status(201).json(job);
});

// GET /api/jobs
router.get('/', (_req: Request, res: Response) => {
  const jobs = queries.listJobs.all();
  res.json(jobs.map(j => ({ ...j, languages: JSON.parse(j.languages) })));
});

// GET /api/jobs/:id
router.get('/:id', (req: Request, res: Response) => {
  const job = queries.getJob.get(req.params.id);
  if (!job) { res.status(404).json({ error: 'Job not found' }); return; }

  const items = queries.getJobItems.all(job.id);
  res.json({ ...job, languages: JSON.parse(job.languages), items });
});

// DELETE /api/jobs/:id
router.delete('/:id', (req: Request, res: Response) => {
  const job = queries.getJob.get(req.params.id);
  if (!job) { res.status(404).json({ error: 'Job not found' }); return; }
  queries.deleteJob.run(req.params.id);
  res.status(204).send();
});

// GET /api/jobs/:id/stream  (SSE)
router.get('/:id/stream', (req: Request, res: Response) => {
  const { id } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Send current state immediately
  const job = queries.getJob.get(id);
  if (job) {
    const items = queries.getJobItems.all(id);
    res.write(`data: ${JSON.stringify({ type: 'snapshot', job: { ...job, languages: JSON.parse(job.languages) }, items })}\n\n`);
  }

  addClient(id, res);

  const keepalive = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { clearInterval(keepalive); }
  }, 20_000);

  req.on('close', () => {
    clearInterval(keepalive);
    removeClient(id, res);
  });
});

export default router;
