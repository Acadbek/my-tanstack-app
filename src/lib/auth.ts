import { getAuth } from '@clerk/tanstack-start/server'
import { db } from '@/db/index'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'

export type UserRole = 'owner' | 'admin' | 'member' | 'viewer'

export interface AuthUser {
  id: number
  clerkUserId: string
  email: string
  firstName: string | null
  lastName: string | null
  avatarUrl: string | null
  role: UserRole
  organizationId: number
  organization: {
    id: number
    name: string
    slug: string
    plan: string
    status: string
  }
}

export async function getAuthUser(request?: Request): Promise<AuthUser | null> {
  try {
    if (!request) return null
    const auth = await getAuth(request)
    if (!auth?.userId) return null

    const dbUser = await db.query.users.findFirst({
      where: eq(users.clerkUserId, auth.userId),
    })

    if (!dbUser || !dbUser.organizationId) return null

    const org = await db.query.organizations.findFirst({
      where: eq(users.id, dbUser.organizationId),
    })

    if (!org) return null

    return {
      id: dbUser.id,
      clerkUserId: dbUser.clerkUserId,
      email: dbUser.email,
      firstName: dbUser.firstName,
      lastName: dbUser.lastName,
      avatarUrl: dbUser.avatarUrl,
      role: dbUser.role as UserRole,
      organizationId: dbUser.organizationId,
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        plan: org.plan!,
        status: org.status!,
      },
    }
  } catch (error) {
    console.error('Error getting auth user:', error)
    return null
  }
}

export async function requireAuth(request?: Request): Promise<AuthUser> {
  const user = await getAuthUser(request)
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user
}

export async function requireRole(allowedRoles: UserRole[], request?: Request): Promise<AuthUser> {
  const user = await requireAuth(request)
  if (!allowedRoles.includes(user.role)) {
    throw new Error('Forbidden: Insufficient permissions')
  }
  return user
}

export async function updateUserLastLogin(clerkUserId: string) {
  const existingUser = await db.query.users.findFirst({
    where: eq(users.clerkUserId, clerkUserId),
  })

  if (existingUser) {
    await db
      .update(users)
      .set({
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.clerkUserId, clerkUserId))

    return existingUser
  }

  return null
}

export function hasPermission(user: AuthUser, action: string): boolean {
  const permissions: Record<UserRole, string[]> = {
    owner: ['*'],
    admin: [
      'user.invite',
      'user.remove',
      'user.update',
      'analysis.create',
      'analysis.read',
      'analysis.delete',
      'settings.update',
    ],
    member: ['analysis.create', 'analysis.read'],
    viewer: ['analysis.read'],
  }

  const userPermissions = permissions[user.role] || []
  return userPermissions.includes('*') || userPermissions.includes(action)
}

export function canInviteUsers(user: AuthUser): boolean {
  return ['owner', 'admin'].includes(user.role)
}

export function canManageOrganization(user: AuthUser): boolean {
  return user.role === 'owner'
}

export function canDeleteAnalysis(user: AuthUser): boolean {
  return ['owner', 'admin'].includes(user.role)
}
