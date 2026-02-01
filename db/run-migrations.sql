-- Run all migrations in order
\i db/migrations/001_create_instagram_analysis_tables.sql
\i db/migrations/002_add_multi_tenant_auth.sql
\i db/migrations/003_add_ai_usage_tracking.sql

-- Create default organization for development
INSERT INTO organizations (name, slug, plan, status, max_users, max_analyses_per_month, ai_token_budget_monthly)
VALUES ('Default Organization', 'default', 'professional', 'active', 100, 10000, 10000000)
ON CONFLICT (slug) DO NOTHING;

-- Verify tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
