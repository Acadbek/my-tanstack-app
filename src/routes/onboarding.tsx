import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { z } from 'zod'
import { getAuth } from '@clerk/tanstack-start/server'
import { createOrganization } from '@/lib/organization'

const CreateOrgSchema = z.object({
  name: z.string().min(2, 'Organization name must be at least 2 characters'),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
})

const createOrgServerFn = createServerFn({ method: 'POST' })
  .inputValidator((d: unknown) => CreateOrgSchema.parse(d))
  .handler(async ({ data, request }) => {
    const auth = await getAuth(request)
    if (!auth?.userId) {
      throw new Error('Unauthorized')
    }

    const { clerkClient } = await import('@clerk/tanstack-start/server')
    const clerkUser = await clerkClient(request).users.getUser(auth.userId)

    const result = await createOrganization({
      name: data.name,
      slug: data.slug,
      ownerClerkUserId: auth.userId,
      ownerEmail: clerkUser.emailAddresses[0]?.emailAddress || '',
      ownerFirstName: clerkUser.firstName || undefined,
      ownerLastName: clerkUser.lastName || undefined,
    })

    return result
  })

export const Route = createFileRoute('/onboarding')({
  component: OnboardingPage,
})

function OnboardingPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleNameChange = (value: string) => {
    setName(value)
    if (!slug || slug === generateSlug(name)) {
      setSlug(generateSlug(value))
    }
  }

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      await createOrgServerFn({ data: { name, slug } })
      navigate({ to: '/' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create organization')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-black flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Create Your Organization</h1>
          <p className="text-zinc-400">Set up your team workspace to get started</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-xl">
          <div className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-zinc-300 mb-2">
                Organization Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Acme Inc"
                required
                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="slug" className="block text-sm font-medium text-zinc-300 mb-2">
                URL Slug
              </label>
              <div className="flex items-center gap-2">
                <span className="text-zinc-500 text-sm">app.example.com/</span>
                <input
                  id="slug"
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="acme-inc"
                  required
                  pattern="[a-z0-9-]+"
                  className="flex-1 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <p className="mt-2 text-xs text-zinc-500">
                Only lowercase letters, numbers, and hyphens allowed
              </p>
            </div>

            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !name || !slug}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium rounded-xl hover:from-blue-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? 'Creating...' : 'Create Organization'}
            </button>
          </div>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-zinc-500">
            Your 14-day free trial starts now. No credit card required.
          </p>
        </div>
      </div>
    </div>
  )
}
