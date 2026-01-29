import { ClerkProvider } from '@clerk/clerk-react'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

export default function AppClerkProvider({
  children,
}: {
  children: React.ReactNode
}) {
  if (!PUBLISHABLE_KEY) {
    console.warn('⚠️ Clerk Publishable Key not found. Authentication features will not work.')
    return <>{children}</>
  }

  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
      {children}
    </ClerkProvider>
  )
}
