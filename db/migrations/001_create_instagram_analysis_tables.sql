-- Instagram Analysis Database Schema
-- This schema stores all analyzed Instagram data for easy dashboard retrieval

-- Instagram Accounts
CREATE TABLE IF NOT EXISTS instagram_accounts (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    full_name TEXT,
    last_analyzed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_instagram_accounts_username ON instagram_accounts(username);

-- Scrape Sessions (track each analysis session)
CREATE TABLE IF NOT EXISTS scrape_sessions (
    id SERIAL PRIMARY KEY,
    session_type VARCHAR(50) NOT NULL, -- 'url', 'hashtag', 'username'
    input TEXT NOT NULL,
    hashtag VARCHAR(255),
    account_id INTEGER REFERENCES instagram_accounts(id),
    total_reels_scraped INTEGER DEFAULT 0,
    scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_scrape_sessions_type ON scrape_sessions(session_type);
CREATE INDEX idx_scrape_sessions_account ON scrape_sessions(account_id);

-- Instagram Reels
CREATE TABLE IF NOT EXISTS instagram_reels (
    id SERIAL PRIMARY KEY,
    reel_id VARCHAR(255) NOT NULL UNIQUE,
    short_code VARCHAR(255) NOT NULL,
    account_id INTEGER REFERENCES instagram_accounts(id),
    
    video_url TEXT NOT NULL,
    thumbnail_url TEXT,
    caption TEXT,
    
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    views_count INTEGER DEFAULT 0,
    duration INTEGER,
    
    timestamp TIMESTAMP,
    scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_instagram_reels_reel_id ON instagram_reels(reel_id);
CREATE INDEX idx_instagram_reels_account ON instagram_reels(account_id);
CREATE INDEX idx_instagram_reels_views ON instagram_reels(views_count);

-- Reel Comments
CREATE TABLE IF NOT EXISTS reel_comments (
    id SERIAL PRIMARY KEY,
    reel_id INTEGER REFERENCES instagram_reels(id) ON DELETE CASCADE,
    comment_id VARCHAR(255) NOT NULL,
    
    text TEXT NOT NULL,
    owner_username VARCHAR(255),
    likes_count INTEGER DEFAULT 0,
    timestamp TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reel_comments_reel ON reel_comments(reel_id);
CREATE INDEX idx_reel_comments_owner ON reel_comments(owner_username);

-- Video Analyses (AI analysis of video content)
CREATE TABLE IF NOT EXISTS video_analyses (
    id SERIAL PRIMARY KEY,
    reel_id INTEGER REFERENCES instagram_reels(id) ON DELETE CASCADE UNIQUE,
    
    hook JSONB NOT NULL,
    problem_solved TEXT,
    call_to_action TEXT,
    content_structure TEXT,
    audience_insights JSONB,
    viral_factors JSONB,
    suggested_remix TEXT,
    
    analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_video_analyses_reel ON video_analyses(reel_id);

-- Comment Insights (AI analysis of comments)
CREATE TABLE IF NOT EXISTS comment_insights (
    id SERIAL PRIMARY KEY,
    reel_id INTEGER REFERENCES instagram_reels(id) ON DELETE CASCADE UNIQUE,
    
    total_comments INTEGER DEFAULT 0,
    summary TEXT,
    merchant_summary TEXT,
    dm_template TEXT,
    
    price_leads JSONB,
    groups JSONB,
    
    analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_comment_insights_reel ON comment_insights(reel_id);

-- Account Analyses (aggregated analysis across multiple posts)
CREATE TABLE IF NOT EXISTS account_analyses (
    id SERIAL PRIMARY KEY,
    account_id INTEGER REFERENCES instagram_accounts(id) ON DELETE CASCADE,
    
    total_posts INTEGER DEFAULT 0,
    total_comments INTEGER DEFAULT 0,
    
    summary TEXT,
    dm_template TEXT,
    top_requests JSONB,
    hot_leads JSONB,
    
    analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_account_analyses_account ON account_analyses(account_id);
CREATE INDEX idx_account_analyses_analyzed_at ON account_analyses(analyzed_at);

-- Analysis Jobs (track background analysis tasks)
CREATE TABLE IF NOT EXISTS analysis_jobs (
    id SERIAL PRIMARY KEY,
    job_type VARCHAR(50) NOT NULL, -- 'video_analysis', 'comment_analysis', 'account_analysis'
    input_data JSONB NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
    result_data JSONB,
    error_message TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_analysis_jobs_status ON analysis_jobs(status);
CREATE INDEX idx_analysis_jobs_type ON analysis_jobs(job_type);
