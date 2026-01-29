import { db } from '@/db/index'
import { organizations, users, invitations, auditLogs, usageRecords } from '@/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import type { AuthUser } from './auth'

export interface CreateOrganizationInput {
  name: string
  slug: string
  ownerClerkUserId: string
  ownerEmail: string
  ownerFirstName?: string
  ownerLastName?: string
}

export interface CreateInvitationInput {
  organizationId: number
  email: string
  role: 'admin' | 'member' | 'viewer'
  invitedByUserId: number
}

export async function createOrganization(input: CreateOrganizationInput) {
  const trialEndsAt = new Date()
  trialEndsAt.setDate(trialEndsAt.getDate() + 14)

  const [org] = await db
    .insert(organizations)
    .values({
      name: input.name,
      slug: input.slug,
      plan: 'trial',
      status: 'active',
      trialEndsAt,
      maxUsers: 5,
      maxAnalysesPerMonth: 100,
      analysesUsedThisMonth: 0,
    })
    .returning()

  const [owner] = await db
    .insert(users)
    .values({
      clerkUserId: input.ownerClerkUserId,
      organizationId: org.id,
      email: input.ownerEmail,
      firstName: input.ownerFirstName || null,
      lastName: input.ownerLastName || null,
      role: 'owner',
      status: 'active',
    })
    .returning()

  await logAudit({
    organizationId: org.id,
    userId: owner.id,
    action: 'organization.created',
    resourceType: 'organization',
    resourceId: org.id,
    details: { name: org.name, slug: org.slug },
  })

  return { organization: org, owner }
}

export async function createInvitation(input: CreateInvitationInput) {
  const token = nanoid(32)
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7)

  const existingInvite = await db.query.invitations.findFirst({
    where: and(
      eq(invitations.organizationId, input.organizationId),
      eq(invitations.email, input.email),
      eq(invitations.status, 'pending')
    ),
  })

  if (existingInvite) {
    throw new Error('An invitation for this email already exists')
  }

  const [invitation] = await db
    .insert(invitations)
    .values({
      organizationId: input.organizationId,
      invitedByUserId: input.invitedByUserId,
      email: input.email,
      role: input.role,
      token,
      status: 'pending',
      expiresAt,
    })
    .returning()

  await logAudit({
    organizationId: input.organizationId,
    userId: input.invitedByUserId,
    action: 'user.invited',
    resourceType: 'invitation',
    resourceId: invitation.id,
    details: { email: input.email, role: input.role },
  })

  return invitation
}

export async function acceptInvitation(token: string, clerkUserId: string, userEmail: string) {
  const invitation = await db.query.invitations.findFirst({
    where: and(eq(invitations.token, token), eq(invitations.status, 'pending')),
    with: {
      organization: true,
    },
  })

  if (!invitation) {
    throw new Error('Invitation not found or already used')
  }

  if (invitation.email.toLowerCase() !== userEmail.toLowerCase()) {
    throw new Error('This invitation was sent to a different email address')
  }

  if (new Date() > invitation.expiresAt) {
    await db
      .update(invitations)
      .set({ status: 'expired', updatedAt: new Date() })
      .where(eq(invitations.id, invitation.id))
    throw new Error('This invitation has expired')
  }

  const existingUser = await db.query.users.findFirst({
    where: eq(users.clerkUserId, clerkUserId),
  })

  if (existingUser) {
    throw new Error('User already belongs to an organization')
  }

  const [newUser] = await db
    .insert(users)
    .values({
      clerkUserId,
      organizationId: invitation.organizationId,
      email: invitation.email,
      role: invitation.role,
      status: 'active',
    })
    .returning()

  await db
    .update(invitations)
    .set({ status: 'accepted', acceptedAt: new Date(), updatedAt: new Date() })
    .where(eq(invitations.id, invitation.id))

  if (!invitation.organizationId) {
    throw new Error('Invitation is missing organization ID')
  }

  await logAudit({
    organizationId: invitation.organizationId,
    userId: newUser.id,
    action: 'user.joined',
    resourceType: 'user',
    resourceId: newUser.id,
    details: { email: newUser.email, role: newUser.role },
  })

  return { user: newUser, organization: invitation.organization }
}

export async function revokeInvitation(invitationId: number, revokedByUserId: number) {
  const invitation = await db.query.invitations.findFirst({
    where: eq(invitations.id, invitationId),
  })

  if (!invitation) {
    throw new Error('Invitation not found')
  }

  await db
    .update(invitations)
    .set({ status: 'revoked', updatedAt: new Date() })
    .where(eq(invitations.id, invitationId))

  if (invitation.organizationId) {
    await logAudit({
      organizationId: invitation.organizationId,
      userId: revokedByUserId,
      action: 'invitation.revoked',
      resourceType: 'invitation',
      resourceId: invitationId,
      details: { email: invitation.email },
    })
  }
}

export async function removeUserFromOrganization(userId: number, removedByUserId: number) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  })

  if (!user) {
    throw new Error('User not found')
  }

  if (user.role === 'owner') {
    throw new Error('Cannot remove organization owner')
  }

  if (user.organizationId) {
    await logAudit({
      organizationId: user.organizationId,
      userId: removedByUserId,
      action: 'user.removed',
      resourceType: 'user',
      resourceId: userId,
      details: { email: user.email, role: user.role },
    })
  }

  await db.delete(users).where(eq(users.id, userId))
}

export async function updateUserRole(
  userId: number,
  newRole: 'admin' | 'member' | 'viewer',
  updatedByUserId: number
) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  })

  if (!user) {
    throw new Error('User not found')
  }

  if (user.role === 'owner') {
    throw new Error('Cannot change owner role')
  }

  await db.update(users).set({ role: newRole, updatedAt: new Date() }).where(eq(users.id, userId))

  if (user.organizationId) {
    await logAudit({
      organizationId: user.organizationId,
      userId: updatedByUserId,
      action: 'user.role_updated',
      resourceType: 'user',
      resourceId: userId,
      details: { email: user.email, oldRole: user.role, newRole },
    })
  }
}

export async function checkUsageLimit(organizationId: number): Promise<boolean> {
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
  })

  if (!org) {
    throw new Error('Organization not found')
  }

  return (org.analysesUsedThisMonth || 0) < (org.maxAnalysesPerMonth || 100)
}

export async function incrementUsage(organizationId: number, userId: number) {
  await db
    .update(organizations)
    .set({
      analysesUsedThisMonth: sql`${organizations.analysesUsedThisMonth} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, organizationId))

  const now = new Date()
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  await db.insert(usageRecords).values({
    organizationId,
    userId,
    resourceType: 'analysis',
    quantity: 1,
    periodStart: periodStart.toISOString().split('T')[0],
    periodEnd: periodEnd.toISOString().split('T')[0],
  })
}

interface LogAuditInput {
  organizationId: number
  userId: number
  action: string
  resourceType?: string
  resourceId?: number
  details?: Record<string, any>
  ipAddress?: string
  userAgent?: string
}

export async function logAudit(input: LogAuditInput) {
  await db.insert(auditLogs).values({
    organizationId: input.organizationId,
    userId: input.userId,
    action: input.action,
    resourceType: input.resourceType || null,
    resourceId: input.resourceId || null,
    details: input.details || {},
    ipAddress: input.ipAddress || null,
    userAgent: input.userAgent || null,
  })
}

export async function getOrganizationStats(organizationId: number) {
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
  })

  if (!org) {
    throw new Error('Organization not found')
  }

  const totalUsers = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(eq(users.organizationId, organizationId))

  const pendingInvitations = await db
    .select({ count: sql<number>`count(*)` })
    .from(invitations)
    .where(and(eq(invitations.organizationId, organizationId), eq(invitations.status, 'pending')))

  return {
    organization: org,
    totalUsers: totalUsers[0]?.count || 0,
    pendingInvitations: pendingInvitations[0]?.count || 0,
    usagePercentage: ((org.analysesUsedThisMonth || 0) / (org.maxAnalysesPerMonth || 100)) * 100,
  }
}
