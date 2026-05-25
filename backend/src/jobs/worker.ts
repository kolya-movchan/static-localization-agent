import { v4 as uuidv4 } from 'uuid';
import { queries, touch } from '../db/database';
import { config } from '../config';
import {
  extractFileId,
  extractFolderId,
  getFileInfo,
  listFolderImages,
  downloadFile,
  getOrCreateLocaleFolder,
  uploadFile,
  getServiceAccountEmail,
} from '../services/gdrive';
import { editImageWithFallback } from '../services/gemini';
import { broadcast } from './sse';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function log(jobId: string, msg: string) {
  console.log(`[worker][${jobId.slice(0, 8)}] ${msg}`);
}

// If the filename contains _En_ (case-insensitive), replace it with the properly-cased locale:
// e.g. "banner_En_9x16.png" + "UA" → "banner_Ua_9x16.png"
// If the pattern is not found, the original filename is returned unchanged.
function getLocalizedFilename(filename: string, language: string): string {
  const langCased =
    language.charAt(0).toUpperCase() + language.slice(1).toLowerCase();
  return filename.replace(/_En_/i, `_${langCased}_`);
}

async function processItem(
  jobId: string,
  itemId: string,
  imageId: string,
  imageName: string,
  imageMimeType: string,
  language: string,
  parentFolderId: string,
  comments: string
): Promise<void> {
  log(jobId, `Processing: ${imageName} → ${language}`);
  queries.setJobItemProcessing.run(touch(), itemId);
  broadcast(jobId, { type: 'item_start', itemId, imageName, language });

  try {
    log(jobId, `  Rate limit wait (${config.worker.rateLimitMs}ms)...`);
    await sleep(config.worker.rateLimitMs);

    log(jobId, `  Downloading ${imageName} (id: ${imageId})...`);
    const imageBuffer = await downloadFile(imageId);
    log(jobId, `  Downloaded ${imageBuffer.length} bytes`);

    log(jobId, `  Calling Gemini (primary: ${config.gemini.primaryModel})...`);
    const { buffer: localizedBuffer, modelUsed } = await editImageWithFallback(
      imageBuffer,
      imageMimeType,
      language,
      comments
    );
    log(jobId, `  Gemini done — model: ${modelUsed}, output: ${localizedBuffer.length} bytes`);

    log(jobId, `  Getting/creating locale folder "${language}" inside ${parentFolderId}...`);
    const folder = await getOrCreateLocaleFolder(parentFolderId, language);
    log(jobId, `  Folder: ${folder.url}`);

    const outputFilename = getLocalizedFilename(imageName, language);
    log(jobId, `  Uploading "${outputFilename}" to folder ${folder.id}...`);
    const { id: outputFileId, url: outputFileUrl } = await uploadFile(
      localizedBuffer,
      outputFilename,
      imageMimeType,
      folder.id
    );
    log(jobId, `  Uploaded → ${outputFileUrl}`);

    queries.updateJobItem.run(
      'success', modelUsed, null,
      outputFileId, outputFileUrl, folder.id, folder.url,
      touch(), itemId
    );
    queries.incrementProcessed.run(touch(), jobId);

    broadcast(jobId, {
      type: 'item_done',
      itemId, imageName, language,
      outputFileUrl, outputFolderUrl: folder.url,
      modelUsed,
    });

    log(jobId, `  ✓ Done: ${imageName} / ${language}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[worker][${jobId.slice(0, 8)}] ✗ Item failed (${imageName} / ${language}): ${msg}`);

    queries.updateJobItem.run(
      'error', null, msg,
      null, null, null, null,
      touch(), itemId
    );
    queries.incrementFailed.run(touch(), jobId);

    broadcast(jobId, { type: 'item_error', itemId, imageName, language, error: msg });
  }
}

async function processJob(jobId: string): Promise<void> {
  log(jobId, `Starting job`);
  queries.updateJob.run('running', touch(), jobId);
  broadcast(jobId, { type: 'job_start', jobId });

  const job = queries.getJob.get(jobId);
  if (!job) return;

  const languages: string[] = JSON.parse(job.languages);
  const comments = job.comments ?? '';

  try {
    let images: Array<{ id: string; name: string; mimeType: string }> = [];
    let parentFolderId: string;

    if (job.input_type === 'file') {
      const fileId = extractFileId(job.input_url);
      log(jobId, `Fetching file info for id: ${fileId}`);
      const info = await getFileInfo(fileId);
      log(jobId, `File: ${info.name} (${info.mimeType}), parent: ${info.parents?.[0]}`);
      images = [{ id: info.id, name: info.name, mimeType: info.mimeType }];
      parentFolderId = info.parents?.[0] ?? fileId;
    } else {
      parentFolderId = extractFolderId(job.input_url);
      log(jobId, `Listing images in folder: ${parentFolderId}`);
      images = await listFolderImages(parentFolderId);
      log(jobId, `Found ${images.length} image(s): ${images.map(i => i.name).join(', ') || '(none)'}`);
    }

    if (images.length === 0) {
      // Try to fetch the folder metadata to distinguish "no access" from "empty folder"
      let accessOk = false;
      try {
        await getFileInfo(parentFolderId);
        accessOk = true;
      } catch {
        accessOk = false;
      }

      const saEmail = getServiceAccountEmail();
      const reason = !accessOk
        ? `Service account cannot access folder "${parentFolderId}". Share the folder in Google Drive with:\n  ${saEmail}\nand give it Viewer (or Editor) access.`
        : `Folder is accessible but contains no image files. Make sure the folder has JPG/PNG/WEBP files directly inside it (not in subfolders).`;
      throw new Error(reason);
    }

    const parentFolderUrl = `https://drive.google.com/drive/folders/${parentFolderId}`;
    queries.setJobParentFolder.run(parentFolderId, parentFolderUrl, touch(), jobId);

    const totalImages = images.length * languages.length;
    log(jobId, `Total tasks: ${images.length} images × ${languages.length} language(s) = ${totalImages}`);
    queries.updateJobCounts.run(totalImages, 0, 0, touch(), jobId);
    broadcast(jobId, { type: 'job_counts', total: totalImages });

    // Create all job items up front
    const items: Array<{ id: string; imageId: string; imageName: string; mimeType: string; language: string }> = [];
    for (const img of images) {
      for (const lang of languages) {
        const itemId = uuidv4();
        queries.createJobItem.run(itemId, jobId, img.name, img.id, img.mimeType, lang);
        items.push({ id: itemId, imageId: img.id, imageName: img.name, mimeType: img.mimeType, language: lang });
      }
    }

    // Process items in parallel, up to itemConcurrency at a time
    const { itemConcurrency } = config.worker;
    let index = 0;
    async function runSlot() {
      while (index < items.length) {
        const item = items[index++];
        await processItem(
          jobId, item.id,
          item.imageId, item.imageName, item.mimeType,
          item.language, parentFolderId, comments
        );
      }
    }
    await Promise.all(Array.from({ length: Math.min(itemConcurrency, items.length) }, runSlot));

    const finalJob = queries.getJob.get(jobId)!;
    const successCount = finalJob.processed_images - finalJob.failed_images;
    // Only mark as fully failed if every single item failed; otherwise completed (with partial failures shown in items)
    const finalStatus = successCount === 0 && finalJob.failed_images > 0 ? 'failed' : 'completed';
    queries.completeJob.run(finalStatus, touch(), touch(), jobId);

    broadcast(jobId, {
      type: 'job_done',
      status: finalStatus,
      processed: finalJob.processed_images,
      failed: finalJob.failed_images,
      parentFolderUrl,
    });

    log(jobId, `${finalStatus.toUpperCase()} — ${successCount} ok, ${finalJob.failed_images} failed`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[worker][${jobId.slice(0, 8)}] FATAL: ${msg}`);
    queries.failJob.run(msg, touch(), touch(), jobId);
    broadcast(jobId, { type: 'job_error', error: msg });
  }
}

const activeJobs = new Set<string>();

export function startWorker(): void {
  const { concurrency, pollIntervalMs } = config.worker;
  console.log(`[worker] Started — concurrency: ${concurrency}, poll: ${pollIntervalMs}ms`);

  setInterval(() => {
    const slots = concurrency - activeJobs.size;
    if (slots <= 0) return;

    const pending = queries.getPendingJobs.all(slots);
    if (pending.length === 0) return;

    for (const job of pending) {
      if (activeJobs.has(job.id)) continue;
      activeJobs.add(job.id);
      processJob(job.id).finally(() => activeJobs.delete(job.id));
    }
  }, pollIntervalMs);
}
