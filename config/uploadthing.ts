/**
 * UploadThing file router — temporary staging before SmugMug (D3).
 */
import { createUploadthing, type FileRouter } from 'uploadthing/server'

const f = createUploadthing()

export const uploadthingRouter = {
  smugmugImage: f({
    image: {
      maxFileSize: '16MB',
      maxFileCount: 8,
    },
  })
    .middleware(() => ({ tag: 'temporary' as const }))
    .onUploadComplete(({ metadata }) => {
      if (metadata?.tag) console.log('[uploadthing] tagged temporary:', metadata.tag)
    }),
} satisfies FileRouter

export type UploadthingRouter = typeof uploadthingRouter
