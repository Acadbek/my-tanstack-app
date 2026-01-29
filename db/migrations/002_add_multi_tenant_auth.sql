-- Multi-Tenant B2B SaaS Schema with Clerk Integration
-- This migration adds organizations, users, invitations, and multi-tenancy support

-- Organizations (Companies/Teams)
CREATE TABLE IF NOT EXISTS organizations (
    id SERIAL PRIMARY KEY,
    clerk_org_id VARCHAR(255) UNIQUE, -- Clerk organization ID (optional, for Clerk Organizations feature)
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    
    -- Subscription & Billing
    plan VARCHAR(50) DEFAULT 'trial', -- 'trial', 'starter', 'professional', 'enterprise'
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'suspended', 'cancelled'
    trial_ends_at TIMESTAMP,
    subscription_ends_at TIMESTAMP,
    
    -- Limits
    max_users INTEGER DEFAULT 5,
    max_analyses_per_month INTEGER DEFAULT 100,
    analyses_used_this_month INTEGER DEFAULT 0,
    
    -- Metadata
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_organizations_clerk_org_id ON organizations(clerk_org_id);
CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_status ON organizations(status);

-- Users (linked to Clerk)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    clerk_user_id VARCHAR(255) NOT NULL UNIQUE, -- Clerk user ID
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- User Info (synced from Clerk)
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    avatar_url TEXT,
    
    -- Role & Permissions
    role VARCHAR(50) DEFAULT 'member', -- 'owner', 'admin', 'member', 'viewer'
    
    -- Status
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'suspended', 'invited'
    last_login_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_clerk_user_id ON users(clerk_user_id);
CREATE INDEX idx_users_organization ON users(organization_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);

-- Invitations (Invite-only system)
CREATE TABLE IF NOT EXISTS invitations (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    invited_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    -- Invitation Details
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'member',
    token VARCHAR(255) NOT NULL UNIQUE,
    
    -- Status
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'accepted', 'expired', 'revoked'
    expires_at TIMESTAMP NOT NULL,
    accepted_at TIMESTAMP,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_invitations_organization ON invitations(organization_id);
CREATE INDEX idx_invitations_email ON invitations(email);
CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_invitations_status ON invitations(status);

-- Add organization_id to existing tables for multi-tenancy
ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE scrape_sessions ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE scrape_sessions ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE analysis_jobs ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE analysis_jobs ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- Create indexes for organization_id on existing tables
CREATE INDEX IF NOT EXISTS idx_instagram_accounts_organization ON instagram_accounts(organization_id);
CREATE INDEX IF NOT EXISTS idx_scrape_sessions_organization ON scrape_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_scrape_sessions_created_by ON scrape_sessions(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_organization ON analysis_jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_created_by ON analysis_jobs(created_by_user_id);

-- Audit Log (track important actions)
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    -- Action Details
    action VARCHAR(100) NOT NULL, -- 'user.invited', 'analysis.created', 'settings.updated', etc.
    resource_type VARCHAR(50), -- 'user', 'invitation', 'analysis', etc.
    resource_id INTEGER,
    
    -- Metadata
    details JSONB DEFAULT '{}',
    ip_address VARCHAR(45),
    user_agent TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_organization ON audit_logs(organization_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- API Keys (for programmatic access)
CREATE TABLE IF NOT EXISTS api_keys (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    -- Key Details
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) NOT NULL UNIQUE, -- Hashed API key
    key_prefix VARCHAR(20) NOT NULL, -- First few chars for identification (e.g., 'sk_live_abc...')
    
    -- Permissions
    scopes JSONB DEFAULT '[]', -- ['read:analyses', 'write:analyses', etc.]
    
    -- Status
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'revoked'
    last_used_at TIMESTAMP,
    expires_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_api_keys_organization ON api_keys(organization_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_status ON api_keys(status);

-- Usage Tracking (for billing and limits)
CREATE TABLE IF NOT EXISTS usage_records (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    -- Usage Details
    resource_type VARCHAR(50) NOT NULL, -- 'analysis', 'api_call', 'storage', etc.
    quantity INTEGER DEFAULT 1,
    
    -- Billing Period
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_usage_records_organization ON usage_records(organization_id);
CREATE INDEX idx_usage_records_period ON usage_records(period_start, period_end);
CREATE INDEX idx_usage_records_resource_type ON usage_records(resource_type);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_invitations_updated_at BEFORE UPDATE ON invitations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON api_keys FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to reset monthly usage counter
CREATE OR REPLACE FUNCTION reset_monthly_usage()
RETURNS void AS $$
BEGIN
    UPDATE organizations SET analyses_used_this_month = 0;
END;
$$ language 'plpgsql';

-- Comments for documentation
COMMENT ON TABLE organizations IS 'Organizations (companies/teams) in the B2B SaaS model';
COMMENT ON TABLE users IS 'Users linked to Clerk authentication';
COMMENT ON TABLE invitations IS 'Invite-only system for onboarding new users';
COMMENT ON TABLE audit_logs IS 'Audit trail for compliance and security';
COMMENT ON TABLE api_keys IS 'API keys for programmatic access';
COMMENT ON TABLE usage_records IS 'Usage tracking for billing and limits';
