/**
 * Load UploadThing client for browser → UT → /uploadPhoto → SmugMug.
 */
import { genUploader } from 'https://esm.sh/uploadthing@7/client'

const url = typeof window !== 'undefined' ? `${window.location.origin}/api/uploadthing` : ''
const { uploadFiles } = genUploader({ url })
window.uploadFilesToUploadThing = uploadFiles
