/**
 * Upload image bytes to SmugMug and return URLs + keys for gallery `photos` rows.
 */
import {
  SmugMugClient,
  normalizeSmugMugAlbumUri,
  smugmugBundleAuthorization,
  parseSmugMugMultipartUploadResponse,
  parseSmugMugVerbosityAlbumImage,
  requestHttpsUtf8,
} from 'thalia/images'
import type { SmugMugCredentials } from './load-secrets.js'
import { resolveSmugMugPhotoUrls } from './smugmug-urls.js'

export type SmugMugStoredPhoto = {
  url: string
  thumbnailUrl: string
  smugmugImageKey: string
  smugmugAlbumKey: string
  filename: string
  archivedMd5?: string
}

function mimeFromFilename(filename: string): string {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.gif')) return 'image/gif'
  if (lower.endsWith('.webp')) return 'image/webp'
  return 'image/jpeg'
}

export async function uploadBytesToSmugMugAlbum(
  creds: SmugMugCredentials,
  albumKey: string,
  bytes: Buffer,
  meta: { filename: string; title?: string; caption?: string; keywords?: string }
): Promise<SmugMugStoredPhoto> {
  const client = new SmugMugClient(creds)
  const host = 'upload.smugmug.com'
  const uploadPath = '/'
  const targetUrl = `https://${host}${uploadPath}`
  const method = 'POST'
  const params = client.signRequest(method, targetUrl)
  const boundary = '----WebKitFormBoundary' + Math.random().toString(16).slice(2, 10)
  const filename = meta.filename || 'image.jpg'
  const mimeType = mimeFromFilename(filename)
  const formData = SmugMugClient.createMultipartFormDataFromBytes(
    { buffer: bytes, originalFilename: filename, mimetype: mimeType },
    boundary
  )

  const { statusCode, bodyUtf8 } = await requestHttpsUtf8({
    hostname: host,
    port: 443,
    path: uploadPath,
    method,
    headers: {
      Authorization: smugmugBundleAuthorization(targetUrl, params),
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': formData.length,
      'X-Smug-AlbumUri': normalizeSmugMugAlbumUri(albumKey),
      'X-Smug-Caption': meta.caption ?? '',
      'X-Smug-FileName': filename,
      'X-Smug-Keywords': meta.keywords ?? '',
      'X-Smug-ResponseType': 'JSON',
      'X-Smug-Title': meta.title ?? filename,
      'X-Smug-Version': 'v2',
    },
    body: formData,
    log: { service: 'smugmug', website: 'gallery', operation: 'upload_multipart', filename },
  })

  const ack = parseSmugMugMultipartUploadResponse(statusCode, bodyUtf8)
  const albumImageUri = ack.Image.AlbumImageUri
  const verbosityResponse = await client.smugmugApiCall(albumImageUri, 'GET', 'gallery')
  const albumImage = parseSmugMugVerbosityAlbumImage(verbosityResponse)

  const imageKeyRaw = albumImage.ImageKey ?? albumImage.Key
  const imageKey = typeof imageKeyRaw === 'string' ? imageKeyRaw : ''
  const { url, thumbnailUrl } = resolveSmugMugPhotoUrls(albumImage, ack.Image.URL)

  return {
    url,
    thumbnailUrl,
    smugmugImageKey: imageKey,
    smugmugAlbumKey: albumKey.replace(/!.*$/, ''),
    filename,
    archivedMd5: typeof albumImage.ArchivedMD5 === 'string' ? albumImage.ArchivedMD5 : undefined,
  }
}
