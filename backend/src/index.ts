import express from 'express';
import cors from 'cors';
import path from 'path';
import { config } from './config';
import jobsRouter from './routes/jobs';
import agentRouter from './routes/agent';
import { startWorker } from './jobs/worker';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api/jobs', jobsRouter);
app.use('/api/agent', agentRouter);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Serve frontend static build
const frontendDist = path.resolve(__dirname, '../../frontend/dist');
app.use(express.static(frontendDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

app.listen(config.port, () => {
  console.log(`[server] Listening on http://localhost:${config.port}`);
  startWorker();
});
