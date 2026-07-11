import type { UploadFileProgress, UploadStage } from './photo-upload-client.js'

export const UPLOAD_LOADING_SRC = '/images/loading.gif'

export function uploadStageLabel(stage: UploadStage, error?: string): string {
  switch (stage) {
    case 'queued':
      return 'Waiting…'
    case 'cloud':
      return 'Uploading…'
    case 'processing':
      return 'Saving to library…'
    case 'error':
      return error?.trim() || 'Upload failed'
    default:
      return 'Uploading…'
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildLibraryPendingCard(item: UploadFileProgress): string {
  const label = uploadStageLabel(item.stage, item.error)
  const isError = item.stage === 'error'
  return `
    <div class="upload-placeholder${isError ? ' upload-error' : ''}" aria-busy="${isError ? 'false' : 'true'}">
      ${isError ? '' : `<img class="upload-loading" src="${UPLOAD_LOADING_SRC}" alt="" width="48" height="48">`}
      <p class="upload-stage">${escapeHtml(label)}</p>
    </div>
    <div class="library-card-body upload-pending-body">
      <p class="photo-title">${escapeHtml(item.title)}</p>
    </div>
  `
}

export function buildEditorPendingTile(item: UploadFileProgress): string {
  const label = uploadStageLabel(item.stage, item.error)
  const isError = item.stage === 'error'
  return `
    <div class="upload-placeholder${isError ? ' upload-error' : ''}" aria-busy="${isError ? 'false' : 'true'}">
      ${isError ? '' : `<img class="upload-loading" src="${UPLOAD_LOADING_SRC}" alt="" width="40" height="40">`}
      <p class="upload-stage">${escapeHtml(label)}</p>
    </div>
    <p class="photo-title">${escapeHtml(item.title)}</p>
  `
}
