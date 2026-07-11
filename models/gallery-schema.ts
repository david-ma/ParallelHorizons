import { util, models } from 'thalia/models'
import { mysqlTable, text, int, boolean } from 'drizzle-orm/mysql-core'
import type { MySqlTableWithColumns } from 'drizzle-orm/mysql-core'

const users = models.users

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
