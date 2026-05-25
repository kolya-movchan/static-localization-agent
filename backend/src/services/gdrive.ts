import { google, drive_v3 } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { config } from '../config';

// ─── Service account (for Shared Drives / Google Workspace) ──────────────────

interface ServiceAccountKey {
  client_email: string;
  [key: string]: unknown;
}

let _saKey: ServiceAccountKey | null = null;
function loadSAKey(): ServiceAccountKey {
  if (!_saKey) {
    _saKey = JSON.parse(
      fs.readFileSync(config.gdrive.serviceAccountPath, 'utf-8')
    ) as ServiceAccountKey;
  }
  return _saKey;
}

export function getServiceAccountEmail(): string {
  return loadSAKey().client_email;
}

// ─── OAuth2 (for personal Drive) ─────────────────────────────────────────────

export function getOAuth2Client() {
  return new google.auth.OAuth2(
    config.gdrive.oauthClientId,
    config.gdrive.oauthClientSecret,
    config.gdrive.oauthRedirectUri
  );
}

export function loadOAuth2Tokens(): boolean {
  if (!fs.existsSync(config.gdrive.tokenPath)) return false;
  try {
    const tokens = JSON.parse(fs.readFileSync(config.gdrive.tokenPath, 'utf-8'));
    const client = getOAuth2Client();
    client.setCredentials(tokens);
    // auto-refresh hook
    client.on('tokens', (t) => saveOAuth2Tokens({ ...tokens, ...t }));
    return true;
  } catch {
    return false;
  }
}

export function saveOAuth2Tokens(tokens: object): void {
  const dir = path.dirname(config.gdrive.tokenPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(config.gdrive.tokenPath, JSON.stringify(tokens, null, 2));
}

export function isOAuth2Connected(): boolean {
  return fs.existsSync(config.gdrive.tokenPath);
}

export function generateAuthUrl(): string {
  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/drive'],
  });
}

export async function exchangeCodeForTokens(code: string): Promise<void> {
  const client = getOAuth2Client();
  const { tokens } = await client.getToken(code);
  saveOAuth2Tokens(tokens);
}

// ─── Auth mode detection ──────────────────────────────────────────────────────

function getAuthMode(): 'oauth2' | 'service_account' {
  return config.gdrive.authMode;
}

function getAuthClient() {
  if (getAuthMode() === 'oauth2') {
    const client = getOAuth2Client();
    if (!fs.existsSync(config.gdrive.tokenPath)) {
      throw new Error('Google Drive not connected. Visit the app and click "Connect Google Drive" to authorize.');
    }
    const tokens = JSON.parse(fs.readFileSync(config.gdrive.tokenPath, 'utf-8'));
    client.setCredentials(tokens);
    client.on('tokens', (t) => saveOAuth2Tokens({ ...tokens, ...t }));
    return client;
  }
  return new google.auth.GoogleAuth({
    credentials: loadSAKey(),
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
}

function getDriveClient(): drive_v3.Drive {
  return google.drive({ version: 'v3', auth: getAuthClient() as Parameters<typeof google.drive>[0]['auth'] });
}

// ─── Drive operations ─────────────────────────────────────────────────────────

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
}

export function extractFileId(url: string): string {
  const fileMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) return fileMatch[1];
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch) return idMatch[1];
  if (/^[a-zA-Z0-9_-]{25,}$/.test(url)) return url;
  throw new Error(`Cannot extract file ID from URL: ${url}`);
}

export function extractFolderId(url: string): string {
  const folderMatch = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch) return folderMatch[1];
  return extractFileId(url);
}

export async function getFileInfo(fileId: string): Promise<DriveFile> {
  const drive = getDriveClient();
  const res = await drive.files.get({
    fileId,
    fields: 'id,name,mimeType,parents',
    supportsAllDrives: true,
  });
  const f = res.data;
  return {
    id: f.id!,
    name: f.name!,
    mimeType: f.mimeType!,
    parents: f.parents ?? [],
  };
}

export async function listFolderImages(folderId: string): Promise<DriveFile[]> {
  const drive = getDriveClient();
  const results: DriveFile[] = [];
  let pageToken: string | undefined;

  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType)',
      pageSize: 100,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    for (const f of res.data.files ?? []) {
      results.push({ id: f.id!, name: f.name!, mimeType: f.mimeType! });
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return results;
}

export async function downloadFile(fileId: string): Promise<Buffer> {
  const drive = getDriveClient();
  const res = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'arraybuffer' }
  );
  return Buffer.from(res.data as ArrayBuffer);
}

export async function getOrCreateLocaleFolder(
  parentFolderId: string,
  language: string
): Promise<{ id: string; url: string }> {
  const drive = getDriveClient();

  const searchRes = await drive.files.list({
    q: `'${parentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and name = '${language}' and trashed = false`,
    fields: 'files(id, name)',
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  if (searchRes.data.files && searchRes.data.files.length > 0) {
    const id = searchRes.data.files[0].id!;
    return { id, url: `https://drive.google.com/drive/folders/${id}` };
  }

  const createRes = await drive.files.create({
    requestBody: {
      name: language,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId],
    },
    fields: 'id',
    supportsAllDrives: true,
  });

  const id = createRes.data.id!;
  return { id, url: `https://drive.google.com/drive/folders/${id}` };
}

export async function uploadFile(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  folderId: string
): Promise<{ id: string; url: string }> {
  const drive = getDriveClient();
  const { Readable } = await import('stream');

  const res = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: Readable.from(buffer),
    },
    fields: 'id, webViewLink',
    supportsAllDrives: true,
  });

  const id = res.data.id!;
  const url = res.data.webViewLink ?? `https://drive.google.com/file/d/${id}/view`;
  return { id, url };
}
