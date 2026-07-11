import { util, models } from 'thalia/models'
import { mysqlTable, text, int, boolean } from 'drizzle-orm/mysql-core'
import type { MySqlTableWithColumns } from 'drizzle-orm/mysql-core'

const users = models.users

export const photoFolders: MySqlTableWithColumns<any> = mysqlTable('photo_folders', {
  ...util.baseTableConfig,
  ownerUserId: int('owner_user_id')
    .notNull()
    .references(() => users.id),
  parentId: int('parent_id'),
  name: util.vc('name').notNull(),
  sortOrder: int('sort_order').notNull().default(0),
})

export const galleries: MySqlTableWithColumns<any> = mysqlTable('galleries', {
  ...util.baseTableConfig,
  slug: util.vc('slug').notNull().unique(),
  ownerUserId: int('owner_user_id')
    .notNull()
    .references(() => users.id),
  title: util.vc('title').notNull(),
  description: text('description'),
  floorplanJson: text('floorplan_json'),
  isPublished: boolean('is_published').notNull().default(false),
})

export const photos: MySqlTableWithColumns<any> = mysqlTable('photos', {
  ...util.baseTableConfig,
  ownerUserId: int('owner_user_id')
    .notNull()
    .references(() => users.id),
  /** D4 folder tree — null = library root (unsorted) */
  folderId: int('folder_id'),
  title: util.vc('title'),
  artist: util.vc('artist'),
  year: util.vc('year'),
  caption: text('caption'),
  filename: util.vc('filename'),
  url: util.vc('url').notNull(),
  thumbnailUrl: util.vc('thumbnail_url'),
  smugmugAlbumKey: util.vc('smugmug_album_key'),
  smugmugImageKey: util.vc('smugmug_image_key'),
  adapterName: util.vc('adapter_name'),
  archivedMd5: util.vc('archived_md5'),
})
