/**
 * Drizzle schema for gallery — Thalia security tables + galleries.
 *
 *   bun drizzle-kit generate --name=<label>
 *   bun drizzle-kit migrate
 */
import { models } from 'thalia/models'
import type { MySqlTableWithColumns } from 'drizzle-orm/mysql-core'
import { mailTable } from 'thalia/mail'
import { galleries, photos, photoFolders } from './gallery-schema.js'

const users = models.users
const sessions = models.sessions
const audits = models.audits
const mail = mailTable as unknown as MySqlTableWithColumns<any>

export { users, sessions, audits, mail, galleries, photos, photoFolders }
