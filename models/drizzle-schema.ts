/**
 * Drizzle schema for gallery — Thalia security tables + galleries.
 *
 *   bun drizzle-kit push
 */
import { models } from 'thalia/models'
import type { MySqlTableWithColumns } from 'drizzle-orm/mysql-core'
import { mailTable } from 'thalia/mail'
import { galleries } from './gallery-schema.js'

const users = models.users
const sessions = models.sessions
const audits = models.audits
const mail = mailTable as unknown as MySqlTableWithColumns<any>

export { users, sessions, audits, mail, galleries }
