# B2B SaaS Multi-Tenant Architecture

This document explains the B2B invite-only SaaS model implementation with Clerk authentication and Neon database.

## Architecture Overview

### Multi-Tenancy Model
- **Organizations**: Each company/team is an organization
- **Users**: Users belong to one organization
- **Invitations**: Invite-only system for onboarding
- **Row-Level Security**: All data is scoped to organizations

### Key Features
- ✅ Clerk authentication integration
- ✅ Invite-only registration
- ✅ Role-based access control (Owner, Admin, Member, Viewer)
- ✅ Usage tracking and limits
- ✅ Audit logging
- ✅ API key management
- ✅ Trial and subscription management

## Database Schema

### Core Tables

#### `organizations`
- Represents companies/teams
- Tracks subscription plan, status, and usage limits
- Fields: `id`, `name`, `slug`, `plan`, `status`, `max_users`, `max_analyses_per_month`, etc.

#### `users`
- Linked to Clerk via `clerk_user_id`
- Belongs to one organization
- Has a role: `owner`, `admin`, `member`, or `viewer`
- Fields: `id`, `clerk_user_id`, `organization_id`, `email`, `role`, `status`, etc.

#### `invitations`
- Invite-only system
- Each invitation has a unique token and expiration
- Status: `pending`, `accepted`, `expired`, `revoked`

#### `audit_logs`
- Tracks all important actions
- Used for compliance and security

#### `api_keys`
- For programmatic access
- Scoped to organizations

#### `usage_records`
- Tracks usage for billing
- Monthly aggregation

### Updated Tables
All existing tables now have `organization_id` for multi-tenancy:
- `instagram_accounts`
- `scrape_sessions`
- `analysis_jobs`

## Setup Instructions

### 1. Environment Variables

Create `.env.local` with:

```bash
# Database (Neon)
VITE_DATABASE_URL=postgresql://...
VITE_DATABASE_URL_POOLER=postgresql://...

# Clerk Authentication
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# AI Providers
APIFY_API_TOKEN=...
AI_PROVIDER=gemini
GEMINI_API_KEY=...

# App Config
VITE_APP_URL=http://localhost:3000
NODE_ENV=development
```

### 2. Run Migrations

```bash
# Generate migration
pnpm db:generate

# Apply migration
pnpm db:migrate

# Or push directly to dev
pnpm db:push
```

### 3. Clerk Setup

1. Go to [dashboard.clerk.com](https://dashboard.clerk.com)
2. Create a new application
3. Copy the publishable and secret keys
4. Configure:
   - Enable email/password authentication
   - Set up email templates for invitations
   - Configure redirect URLs

### 4. Install Dependencies

```bash
pnpm install
```

## User Roles & Permissions

### Owner
- Full access to everything
- Can manage organization settings
- Can delete organization
- Cannot be removed

### Admin
- Can invite and remove users
- Can manage user roles
- Can create and delete analyses
- Can view all data

### Member
- Can create analyses
- Can view all analyses
- Cannot manage users

### Viewer
- Read-only access
- Can view analyses
- Cannot create or delete

## Usage Flow

### 1. Organization Creation (First User)

```typescript
import { createOrganization } from '@/lib/organization'

const { organization, owner } = await createOrganization({
  name: 'Acme Inc',
  slug: 'acme-inc',
  ownerClerkUserId: clerkUser.id,
  ownerEmail: clerkUser.email,
  ownerFirstName: clerkUser.firstName,
  ownerLastName: clerkUser.lastName,
})
```

### 2. Inviting Users

```typescript
import { createInvitation } from '@/lib/organization'

const invitation = await createInvitation({
  organizationId: org.id,
  email: 'user@example.com',
  role: 'member',
  invitedByUserId: currentUser.id,
})

// Send invitation email with token
const inviteUrl = `${APP_URL}/accept-invite?token=${invitation.token}`
```

### 3. Accepting Invitation

```typescript
import { acceptInvitation } from '@/lib/organization'

const { user, organization } = await acceptInvitation(
  token,
  clerkUserId,
  userEmail
)
```

### 4. Checking Authentication

```typescript
import { requireAuth, requireRole } from '@/lib/auth'

// In server functions
export const protectedAction = createServerFn({ method: 'POST' })
  .handler(async ({ request }) => {
    const user = await requireAuth(request)
    // user is authenticated and has organization
    
    // Or require specific role
    const admin = await requireRole(['owner', 'admin'], request)
  })
```

### 5. Enforcing Usage Limits

```typescript
import { checkUsageLimit, incrementUsage } from '@/lib/organization'

// Before creating analysis
const canCreate = await checkUsageLimit(organizationId)
if (!canCreate) {
  throw new Error('Monthly analysis limit reached')
}

// After successful analysis
await incrementUsage(organizationId, userId)
```

## API Reference

### Authentication (`src/lib/auth.ts`)

- `getAuthUser(request?)`: Get current authenticated user
- `requireAuth(request?)`: Require authentication (throws if not authenticated)
- `requireRole(roles, request?)`: Require specific role
- `hasPermission(user, action)`: Check if user has permission
- `canInviteUsers(user)`: Check if user can invite
- `canManageOrganization(user)`: Check if user can manage org

### Organization Management (`src/lib/organization.ts`)

- `createOrganization(input)`: Create new organization
- `createInvitation(input)`: Create invitation
- `acceptInvitation(token, clerkUserId, email)`: Accept invitation
- `revokeInvitation(id, userId)`: Revoke invitation
- `removeUserFromOrganization(userId, removedBy)`: Remove user
- `updateUserRole(userId, newRole, updatedBy)`: Update user role
- `checkUsageLimit(orgId)`: Check if org can create more analyses
- `incrementUsage(orgId, userId)`: Increment usage counter
- `logAudit(input)`: Log audit event
- `getOrganizationStats(orgId)`: Get org statistics

## Subscription Plans

### Trial (Default)
- 14 days free
- 5 users max
- 100 analyses per month

### Starter
- $49/month
- 10 users
- 500 analyses per month

### Professional
- $149/month
- 25 users
- 2000 analyses per month

### Enterprise
- Custom pricing
- Unlimited users
- Unlimited analyses

## Security Considerations

1. **Row-Level Security**: All queries must filter by `organization_id`
2. **Role Validation**: Always check user role before sensitive operations
3. **Invitation Tokens**: Use secure random tokens with expiration
4. **API Keys**: Hash API keys before storing
5. **Audit Logging**: Log all important actions for compliance

## Migration from Single-Tenant

If you have existing data:

1. Create a default organization
2. Assign all existing data to this organization
3. Create user records for existing Clerk users
4. Update all queries to include organization context

```sql
-- Example migration
UPDATE instagram_accounts SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE scrape_sessions SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE analysis_jobs SET organization_id = 1 WHERE organization_id IS NULL;
```

## Testing

### Test Organization Creation
```bash
# Create test organization via API or UI
# Verify user is created with 'owner' role
# Check trial period is set correctly
```

### Test Invitation Flow
```bash
# Create invitation
# Verify token is generated
# Accept invitation with new Clerk user
# Verify user is added to organization
```

### Test Usage Limits
```bash
# Create analyses up to limit
# Verify next analysis is blocked
# Check usage counter increments correctly
```

## Troubleshooting

### User not found after Clerk sign-in
- Ensure user accepted an invitation or created an organization
- Check `users` table for matching `clerk_user_id`

### Organization not found
- Verify user has `organization_id` set
- Check organization status is 'active'

### Permission denied errors
- Verify user role has required permissions
- Check `hasPermission()` function logic

### Usage limit errors
- Check `analyses_used_this_month` counter
- Verify monthly reset is working
- Consider upgrading plan

## Next Steps

1. ✅ Database schema and migrations created
2. ✅ Authentication utilities implemented
3. ✅ Organization management functions ready
4. 🔄 UI components for auth and onboarding (in progress)
5. ⏳ Protected routes and middleware
6. ⏳ Team management dashboard
7. ⏳ Usage tracking UI
8. ⏳ Billing integration (Stripe)

## Support

For questions or issues:
- Check the audit logs for debugging
- Review Clerk dashboard for auth issues
- Monitor Neon database for performance
- Check usage records for billing questions
