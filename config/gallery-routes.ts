import type { RoleRouteRule } from 'thalia/security'

/** Site-specific RBAC — merged with ThaliaSecurity default routes. */
export const galleryRoutes: RoleRouteRule[] = [
  { path: '/logon', permissions: { guest: ['read', 'create'], user: ['read', 'create'], admin: ['read', 'create'] } },
  { path: '/logout', permissions: { guest: ['read'], user: ['read'], admin: ['read'] } },
  { path: '/logoff', permissions: { guest: ['read'], user: ['read'], admin: ['read'] } },
  { path: '/setup', permissions: { guest: ['read', 'create'], user: ['read', 'create'], admin: ['read', 'create'] } },
  { path: '/newUser', permissions: { guest: ['read'], user: ['read'], admin: ['read'] } },
  { path: '/createNewUser', permissions: { guest: ['read', 'create'], user: ['create'], admin: ['create'] } },
  { path: '/forgotPassword', permissions: { guest: ['read', 'create'], user: ['read', 'create'], admin: ['read', 'create'] } },
  { path: '/resetPassword', permissions: { guest: ['read', 'create'], user: ['read', 'create'], admin: ['read', 'create'] } },

  { path: '/', permissions: { guest: ['read'], user: ['read'], admin: ['read'] } },
  { path: '/view', permissions: { guest: ['read'], user: ['read'], admin: ['read'] } },
  { path: '/api/floorplan', permissions: { guest: ['read'], user: ['read'], admin: ['read'] } },

  { path: '/dashboard', permissions: { user: ['read', 'create'], admin: ['read', 'create', 'update', 'delete'] } },
  { path: '/library', permissions: { user: ['read', 'create'], admin: ['read', 'create', 'update', 'delete'] } },
  { path: '/uploadPhoto', permissions: { user: ['read', 'create'], admin: ['read', 'create'] } },
  { path: '/photo-delete', permissions: { user: ['read', 'delete'], admin: ['read', 'delete'] } },
  { path: '/api/photos', permissions: { user: ['read'], admin: ['read'] } },
  { path: '/api/folders', permissions: { user: ['read'], admin: ['read'] } },
  { path: '/folder-create', permissions: { user: ['read', 'create'], admin: ['read', 'create', 'update'] } },
  { path: '/folder-update', permissions: { user: ['read', 'update'], admin: ['read', 'update', 'delete'] } },
  { path: '/folder-delete', permissions: { user: ['read', 'delete'], admin: ['read', 'delete'] } },
  { path: '/photos-bulk', permissions: { user: ['read', 'update', 'delete'], admin: ['read', 'update', 'delete'] } },
  { path: '/api/uploadthing', permissions: { guest: ['read', 'create'], user: ['read', 'create'], admin: ['read', 'create'] } },
  { path: '/api/uploadthing-cleanup', permissions: { admin: ['read', 'create'], user: [] } },
  // Thalia maps permission from URL action segment (empty → read), not HTTP method — see thalia/server/security/README.md
  { path: '/gallery-create', permissions: { user: ['read', 'create'], admin: ['read', 'create'] } },
  { path: '/gallery-publish', permissions: { user: ['read', 'update'], admin: ['read', 'update', 'delete'] } },
  { path: '/create', permissions: { user: ['read', 'create', 'update'], admin: ['read', 'create', 'update', 'delete'] } },
  { path: '/save-floorplan', permissions: { user: ['read', 'create', 'update'], admin: ['read', 'create', 'update', 'delete'] } },
  { path: '/profile', permissions: { user: ['read', 'update'], admin: ['read', 'update', 'delete', 'create'] } },

  { path: '/dev-spotlight-slider', permissions: { guest: ['read'], user: ['read'], admin: ['read'] } },
]
