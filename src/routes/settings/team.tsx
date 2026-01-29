import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { z } from 'zod'
import { requireRole } from '@/lib/auth'
import { createInvitation, getOrganizationStats } from '@/lib/organization'
import { db } from '@/db/index'
import { users, invitations } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

const getTeamDataServerFn = createServerFn({ method: 'GET' }).handler(async ({ request }) => {
  const user = await requireRole(['owner', 'admin'], request)

  const teamMembers = await db.query.users.findMany({
    where: eq(users.organizationId, user.organizationId),
  })

  const pendingInvites = await db.query.invitations.findMany({
    where: and(
      eq(invitations.organizationId, user.organizationId),
      eq(invitations.status, 'pending')
    ),
  })

  const stats = await getOrganizationStats(user.organizationId)

  return { teamMembers, pendingInvites, stats, currentUser: user }
})

const InviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member', 'viewer']),
})

const inviteUserServerFn = createServerFn({ method: 'POST' })
  .inputValidator((d: unknown) => InviteSchema.parse(d))
  .handler(async ({ data, request }) => {
    const user = await requireRole(['owner', 'admin'], request)

    const invitation = await createInvitation({
      organizationId: user.organizationId,
      email: data.email,
      role: data.role,
      invitedByUserId: user.id,
    })

    return invitation
  })

export const Route = createFileRoute('/settings/team')({
  component: TeamSettingsPage,
  loader: async ({ context }) => {
    return await getTeamDataServerFn()
  },
})

function TeamSettingsPage() {
  const data = Route.useLoaderData()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'member' | 'viewer'>('member')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      await inviteUserServerFn({ data: { email, role } })
      setSuccess(true)
      setEmail('')
      setRole('member')
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invitation')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-black text-white">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Team Management</h1>
          <p className="mt-2 text-zinc-400">Manage your team members and invitations</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3 mb-8">
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <div className="text-sm text-zinc-400">Team Members</div>
            <div className="mt-2 text-3xl font-bold">{data.stats.totalUsers}</div>
            <div className="mt-1 text-xs text-zinc-500">
              of {data.stats.organization.maxUsers} max
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <div className="text-sm text-zinc-400">Pending Invites</div>
            <div className="mt-2 text-3xl font-bold">{data.stats.pendingInvitations}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <div className="text-sm text-zinc-400">Usage This Month</div>
            <div className="mt-2 text-3xl font-bold">
              {data.stats.organization.analysesUsedThisMonth}
            </div>
            <div className="mt-1 text-xs text-zinc-500">
              of {data.stats.organization.maxAnalysesPerMonth} analyses
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">Invite Team Member</h2>
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-zinc-300 mb-2">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="colleague@example.com"
                  required
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="role" className="block text-sm font-medium text-zinc-300 mb-2">
                  Role
                </label>
                <select
                  id="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'admin' | 'member' | 'viewer')}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="viewer">Viewer</option>
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-200">
                Invitation sent successfully!
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium rounded-xl hover:from-blue-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? 'Sending...' : 'Send Invitation'}
            </button>
          </form>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-bold mb-4">Team Members</h2>
            <div className="space-y-3">
              {data.teamMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4 rounded-xl border border-white/10 bg-white/5"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                      {member.firstName?.[0] || member.email[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium">
                        {member.firstName && member.lastName
                          ? `${member.firstName} ${member.lastName}`
                          : member.email}
                      </div>
                      <div className="text-sm text-zinc-400">{member.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-sm font-medium">
                      {member.role}
                    </span>
                    {member.id !== data.currentUser.id && member.role !== 'owner' && (
                      <button className="text-zinc-400 hover:text-red-400 transition-colors">
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {data.pendingInvites.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-bold mb-4">Pending Invitations</h2>
              <div className="space-y-3">
                {data.pendingInvites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between p-4 rounded-xl border border-white/10 bg-white/5"
                  >
                    <div>
                      <div className="font-medium">{invite.email}</div>
                      <div className="text-sm text-zinc-400">
                        Invited {new Date(invite.createdAt!).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-300 text-sm font-medium">
                        {invite.role}
                      </span>
                      <button className="text-zinc-400 hover:text-red-400 transition-colors">
                        Revoke
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
