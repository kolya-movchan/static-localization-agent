import { Router, Request, Response } from 'express';
import {
  generateAuthUrl,
  exchangeCodeForTokens,
  isOAuth2Connected,
  getServiceAccountEmail,
} from '../services/gdrive';
import { config } from '../config';

const router = Router();

// GET /api/auth/status
router.get('/status', (_req: Request, res: Response) => {
  const mode = config.gdrive.authMode;
  if (mode === 'oauth2') {
    res.json({ mode, connected: isOAuth2Connected() });
  } else {
    try {
      res.json({ mode, connected: true, serviceAccountEmail: getServiceAccountEmail() });
    } catch {
      res.json({ mode, connected: false });
    }
  }
});

// GET /api/auth/google  — start OAuth2 flow
router.get('/google', (_req: Request, res: Response) => {
  if (config.gdrive.authMode !== 'oauth2') {
    res.status(400).json({ error: 'Auth mode is not oauth2. Set GOOGLE_AUTH_MODE=oauth2 in .env' });
    return;
  }
  res.redirect(generateAuthUrl());
});

// GET /api/auth/google/callback
router.get('/google/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string | undefined;
  if (!code) {
    res.status(400).send('Missing code parameter');
    return;
  }
  try {
    await exchangeCodeForTokens(code);
    res.redirect('/?connected=1');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).send(`OAuth2 error: ${msg}`);
  }
});

// DELETE /api/auth/google  — disconnect (remove tokens)
router.delete('/google', (_req: Request, res: Response) => {
  const fs = require('fs') as typeof import('fs');
  try {
    if (fs.existsSync(config.gdrive.tokenPath)) {
      fs.unlinkSync(config.gdrive.tokenPath);
    }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to remove tokens' });
  }
});

export default router;
