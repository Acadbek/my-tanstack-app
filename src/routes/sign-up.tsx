import { createFileRoute } from '@tanstack/react-router'
import { SignUp } from '@clerk/tanstack-start'
import { z } from 'zod'

const SearchSchema = z.object({
  token: z.string().optional(),
})

export const Route = createFileRoute('/sign-up')({
  component: SignUpPage,
  validateSearch: SearchSchema,
})

function SignUpPage() {
  const { token } = Route.useSearch()

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-black flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            {token ? 'Accept Invitation' : 'Create Account'}
          </h1>
          <p className="text-zinc-400">
            {token
              ? 'Sign up to join your team'
              : 'Get started with your free trial'}
          </p>
        </div>
        <SignUp
          appearance={{
            elements: {
              rootBox: 'mx-auto',
              card: 'bg-zinc-900 border border-zinc-800 shadow-xl',
            },
          }}
          routing="path"
          path="/sign-up"
          signInUrl="/sign-in"
          afterSignUpUrl={token ? `/accept-invite?token=${token}` : '/onboarding'}
        />
      </div>
    </div>
  )
}
