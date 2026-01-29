import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useEffect, useState } from 'react'
import { z } from 'zod'
import { getAuth } from '@clerk/tanstack-start/server'
import { acceptInvitation } from '@/lib/organization'

const SearchSchema = z.object({
  token: z.string(),
})

const acceptInviteServerFn = createServerFn({ method: 'POST' })
  .inputValidator((d: unknown) => z.object({ token: z.string() }).parse(d))
  .handler(async ({ data, request }) => {
    const auth = await getAuth(request)
    if (!auth?.userId) {
      throw new Error('Unauthorized')
    }

    const { clerkClient } = await import('@clerk/tanstack-start/server')
    const clerkUser = await clerkClient(request).users.getUser(auth.userId)
    const userEmail = clerkUser.emailAddresses[0]?.emailAddress

    if (!userEmail) {
      throw new Error('User email not found')
    }

    const result = await acceptInvitation(data.token, auth.userId, userEmail)
    return result
  })

export const Route = createFileRoute('/accept-invite')({
  component: AcceptInvitePage,
  validateSearch: SearchSchema,
})

function AcceptInvitePage() {
  const { token } = Route.useSearch()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const acceptInvite = async () => {
      try {
        await acceptInviteServerFn({ data: { token } })
        setStatus('success')
        setTimeout(() => {
          navigate({ to: '/' })
        }, 2000)
      } catch (err) {
        setStatus('error')
        setError(err instanceof Error ? err.message : 'Failed to accept invitation')
      }
    }

    acceptInvite()
  }, [token, navigate])

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-black flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-xl text-center">
          {status === 'loading' && (
            <>
              <div className="w-16 h-16 mx-auto mb-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <h2 className="text-2xl font-bold text-white mb-2">Accepting Invitation</h2>
              <p className="text-zinc-400">Please wait while we set up your account...</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-16 h-16 mx-auto mb-6 bg-green-500/20 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-green-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Welcome to the Team!</h2>
              <p className="text-zinc-400">Redirecting you to the dashboard...</p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-16 h-16 mx-auto mb-6 bg-red-500/20 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-red-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Invitation Error</h2>
              <p className="text-red-400 mb-6">{error}</p>
              <button
                onClick={() => navigate({ to: '/sign-in' })}
                className="px-6 py-3 bg-zinc-800 text-white rounded-xl hover:bg-zinc-700 transition-colors"
              >
                Go to Sign In
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
