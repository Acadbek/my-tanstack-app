import { pgTable, text, serial, timestamp, boolean, integer, jsonb, varchar, date } from 'drizzle-orm/pg-core';

export const todos = pgTable('todos', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================
// Multi-Tenant B2B SaaS Tables
// ============================================

export const organizations = pgTable('organizations', {
  id: serial('id').primaryKey(),
  clerkOrgId: varchar('clerk_org_id', { length: 255 }).unique(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  
  plan: varchar('plan', { length: 50 }).default('trial'),
  status: varchar('status', { length: 50 }).default('active'),
  trialEndsAt: timestamp('trial_ends_at'),
  subscriptionEndsAt: timestamp('subscription_ends_at'),
  
  maxUsers: integer('max_users').default(5),
  maxAnalysesPerMonth: integer('max_analyses_per_month').default(100),
  analysesUsedThisMonth: integer('analyses_used_this_month').default(0),
  
  settings: jsonb('settings').$type<Record<string, any>>().default({}),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  clerkUserId: varchar('clerk_user_id', { length: 255 }).notNull().unique(),
  organizationId: integer('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  
  email: varchar('email', { length: 255 }).notNull(),
  firstName: varchar('first_name', { length: 255 }),
  lastName: varchar('last_name', { length: 255 }),
  avatarUrl: text('avatar_url'),
  
  role: varchar('role', { length: 50 }).default('member'),
  status: varchar('status', { length: 50 }).default('active'),
  lastLoginAt: timestamp('last_login_at'),
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const invitations = pgTable('invitations', {
  id: serial('id').primaryKey(),
  organizationId: integer('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  invitedByUserId: integer('invited_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  
  email: varchar('email', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).default('member'),
  token: varchar('token', { length: 255 }).notNull().unique(),
  
  status: varchar('status', { length: 50 }).default('pending'),
  expiresAt: timestamp('expires_at').notNull(),
  acceptedAt: timestamp('accepted_at'),
  
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  organizationId: integer('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  
  action: varchar('action', { length: 100 }).notNull(),
  resourceType: varchar('resource_type', { length: 50 }),
  resourceId: integer('resource_id'),
  
  details: jsonb('details').default('{}'),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  
  createdAt: timestamp('created_at').defaultNow(),
});

export const apiKeys = pgTable('api_keys', {
  id: serial('id').primaryKey(),
  organizationId: integer('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  createdByUserId: integer('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  
  name: varchar('name', { length: 255 }).notNull(),
  keyHash: varchar('key_hash', { length: 255 }).notNull().unique(),
  keyPrefix: varchar('key_prefix', { length: 20 }).notNull(),
  
  scopes: jsonb('scopes').default('[]'),
  status: varchar('status', { length: 50 }).default('active'),
  lastUsedAt: timestamp('last_used_at'),
  expiresAt: timestamp('expires_at'),
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const usageRecords = pgTable('usage_records', {
  id: serial('id').primaryKey(),
  organizationId: integer('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  
  resourceType: varchar('resource_type', { length: 50 }).notNull(),
  quantity: integer('quantity').default(1),
  
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================
// Instagram Analysis Tables (Updated)
// ============================================

export const scrapeSessions = pgTable('scrape_sessions', {
  id: serial('id').primaryKey(),
  sessionType: varchar('session_type', { length: 50 }).notNull(),
  input: text('input').notNull(),
  hashtag: varchar('hashtag', { length: 255 }),
  accountId: integer('account_id').references(() => instagramAccounts.id),
  organizationId: integer('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  createdByUserId: integer('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  totalReelsScraped: integer('total_reels_scraped').default(0),
  scrapedAt: timestamp('scraped_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  imageUrl: text('image_url').notNull(),
  caption: text('caption'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const analysisJobs = pgTable('analysis_jobs', {
  id: serial('id').primaryKey(),
  jobType: varchar('job_type', { length: 50 }).notNull(),
  inputData: jsonb('input_data').notNull(),
  organizationId: integer('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  createdByUserId: integer('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  status: varchar('status', { length: 50 }).default('pending'),
  resultData: jsonb('result_data'),
  errorMessage: text('error_message'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const comments = pgTable('comments', {
  id: serial('id').primaryKey(),
  postId: integer('post_id').references(() => posts.id),
  username: text('username').notNull(),
  text: text('text').notNull(),

  sentiment: text('sentiment').default('neutral'),
  isLead: boolean('is_lead').default(false),
  aiReply: text('ai_reply'),

  status: text('status').default('pending'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const instagramAccounts = pgTable('instagram_accounts', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 255 }).notNull().unique(),
  fullName: text('full_name'),
  organizationId: integer('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  lastAnalyzedAt: timestamp('last_analyzed_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const instagramReels = pgTable('instagram_reels', {
  id: serial('id').primaryKey(),
  reelId: varchar('reel_id', { length: 255 }).notNull().unique(),
  shortCode: varchar('short_code', { length: 255 }).notNull(),
  accountId: integer('account_id').references(() => instagramAccounts.id),
  
  videoUrl: text('video_url').notNull(),
  thumbnailUrl: text('thumbnail_url'),
  caption: text('caption'),
  
  likesCount: integer('likes_count').default(0),
  commentsCount: integer('comments_count').default(0),
  viewsCount: integer('views_count').default(0),
  duration: integer('duration'),
  
  timestamp: timestamp('timestamp'),
  scrapedAt: timestamp('scraped_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const reelComments = pgTable('reel_comments', {
  id: serial('id').primaryKey(),
  reelId: integer('reel_id').references(() => instagramReels.id),
  commentId: varchar('comment_id', { length: 255 }).notNull(),
  
  text: text('text').notNull(),
  ownerUsername: varchar('owner_username', { length: 255 }),
  likesCount: integer('likes_count').default(0),
  timestamp: timestamp('timestamp'),
  
  createdAt: timestamp('created_at').defaultNow(),
});

export const videoAnalyses = pgTable('video_analyses', {
  id: serial('id').primaryKey(),
  reelId: integer('reel_id').references(() => instagramReels.id).notNull().unique(),
  
  hook: jsonb('hook').notNull(),
  problemSolved: text('problem_solved'),
  callToAction: text('call_to_action'),
  contentStructure: text('content_structure'),
  audienceInsights: jsonb('audience_insights'),
  viralFactors: jsonb('viral_factors'),
  suggestedRemix: text('suggested_remix'),
  
  analyzedAt: timestamp('analyzed_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const commentInsights = pgTable('comment_insights', {
  id: serial('id').primaryKey(),
  reelId: integer('reel_id').references(() => instagramReels.id).notNull().unique(),
  
  totalComments: integer('total_comments').default(0),
  summary: text('summary'),
  merchantSummary: text('merchant_summary'),
  dmTemplate: text('dm_template'),
  
  priceLeads: jsonb('price_leads'),
  groups: jsonb('groups'),
  
  analyzedAt: timestamp('analyzed_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const accountAnalyses = pgTable('account_analyses', {
  id: serial('id').primaryKey(),
  accountId: integer('account_id').references(() => instagramAccounts.id).notNull(),
  
  totalPosts: integer('total_posts').default(0),
  totalComments: integer('total_comments').default(0),
  
  summary: text('summary'),
  dmTemplate: text('dm_template'),
  topRequests: jsonb('top_requests'),
  hotLeads: jsonb('hot_leads'),
  
  analyzedAt: timestamp('analyzed_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
});