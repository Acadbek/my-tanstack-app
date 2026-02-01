-- AI Usage Tracking Table
CREATE TABLE IF NOT EXISTS ai_usage (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  
  provider VARCHAR(50) NOT NULL, -- 'gemini' | 'openai'
  model VARCHAR(100) NOT NULL,
  operation_type VARCHAR(50) NOT NULL, -- 'video_analysis' | 'comment_analysis' | 'account_analysis'
  
  -- Token usage
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  
  -- Cost tracking (in USD cents)
  estimated_cost_cents INTEGER DEFAULT 0,
  
  -- Monthly tracking
  period_month INTEGER NOT NULL, -- 1-12
  period_year INTEGER NOT NULL,
  
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for efficient queries
CREATE INDEX idx_ai_usage_org_month_year ON ai_usage(organization_id, period_year, period_month);
CREATE INDEX idx_ai_usage_created_at ON ai_usage(created_at DESC);

-- Add AI token budget columns to organizations
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS ai_token_budget_monthly INTEGER DEFAULT 1000000,
ADD COLUMN IF NOT EXISTS ai_tokens_used_this_month INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS ai_budget_spent_cents INTEGER DEFAULT 0;
