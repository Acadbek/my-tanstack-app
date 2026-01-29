# Instagram Analysis Database Structure

## Overview
Barcha Instagram analiz natijalari database'ga saqlanadi - reellar, commentlar, AI tahlillari va account ma'lumotlari. Bu keyinchalik dashboard orqali oson get qilish uchun perfect formatda tuzilgan.

## Database Tables

### 1. `instagram_accounts`
Instagram accountlarni saqlaydi.

**Columns:**
- `id` - Primary key
- `username` - Unique username (masalan: "fashionuz")
- `full_name` - To'liq ism
- `last_analyzed_at` - Oxirgi analiz vaqti
- `created_at`, `updated_at` - Timestamps

**Usage:**
```sql
SELECT * FROM instagram_accounts WHERE username = 'fashionuz';
```

### 2. `scrape_sessions`
Har bir analiz sessionini track qiladi.

**Columns:**
- `id` - Primary key
- `session_type` - 'url', 'hashtag', yoki 'username'
- `input` - User kiritgan input
- `hashtag` - Agar hashtag bo'lsa
- `account_id` - Agar username bo'lsa
- `total_reels_scraped` - Nechta reel scrape qilingan
- `scraped_at` - Qachon scrape qilingan

**Usage:**
```sql
-- Oxirgi 10 ta sessionni ko'rish
SELECT * FROM scrape_sessions ORDER BY scraped_at DESC LIMIT 10;

-- Username bo'yicha sessionlar
SELECT * FROM scrape_sessions WHERE session_type = 'username';
```

### 3. `instagram_reels`
Barcha scrape qilingan reellar.

**Columns:**
- `id` - Database primary key
- `reel_id` - Instagram reel ID (unique)
- `short_code` - Instagram short code
- `account_id` - Qaysi accountga tegishli
- `video_url`, `thumbnail_url` - Media URLs
- `caption` - Post caption
- `likes_count`, `comments_count`, `views_count` - Statistika
- `duration` - Video uzunligi (soniyalarda)
- `timestamp` - Instagram'da qachon post qilingan
- `scraped_at` - Qachon scrape qilingan

**Usage:**
```sql
-- Eng ko'p ko'rilgan reellar
SELECT * FROM instagram_reels ORDER BY views_count DESC LIMIT 20;

-- Ma'lum account reellari
SELECT * FROM instagram_reels WHERE account_id = 1;

-- Oxirgi scrape qilingan reellar
SELECT * FROM instagram_reels ORDER BY scraped_at DESC LIMIT 10;
```

### 4. `reel_comments`
Har bir reelning commentlari.

**Columns:**
- `id` - Primary key
- `reel_id` - Qaysi reelga tegishli (foreign key)
- `comment_id` - Instagram comment ID
- `text` - Comment matni
- `owner_username` - Kim yozgan
- `likes_count` - Comment likelari
- `timestamp` - Qachon yozilgan

**Usage:**
```sql
-- Reel commentlarini olish
SELECT * FROM reel_comments WHERE reel_id = 1;

-- Ma'lum user commentlari
SELECT * FROM reel_comments WHERE owner_username = 'john_doe';

-- Eng ko'p like olgan commentlar
SELECT * FROM reel_comments ORDER BY likes_count DESC LIMIT 50;
```

### 5. `video_analyses`
AI video tahlillari (hook, viral factors, remix suggestions).

**Columns:**
- `id` - Primary key
- `reel_id` - Qaysi reel tahlil qilingan (unique)
- `hook` - JSONB: {visualElements, audioElements, textOverlay, emotionalTrigger}
- `problem_solved` - Qanday muammo yechilgan
- `call_to_action` - CTA nima
- `content_structure` - Kontent strukturasi
- `audience_insights` - JSONB: {painPoints, commonQuestions, objections, desires}
- `viral_factors` - JSONB: Array of viral omillar
- `suggested_remix` - Remix tavsiyasi
- `analyzed_at` - Qachon tahlil qilingan

**Usage:**
```sql
-- Reel tahlilini olish
SELECT * FROM video_analyses WHERE reel_id = 1;

-- Barcha viral factorlarni ko'rish
SELECT reel_id, viral_factors FROM video_analyses;

-- Hook'lardagi emotional triggerlar
SELECT reel_id, hook->>'emotionalTrigger' as trigger 
FROM video_analyses;
```

### 6. `comment_insights`
Comment tahlillari (price leads, groups, DM templates).

**Columns:**
- `id` - Primary key
- `reel_id` - Qaysi reel (unique)
- `total_comments` - Jami commentlar soni
- `summary` - Umumiy xulosa
- `merchant_summary` - Merchant uchun tavsiyalar
- `dm_template` - DM shablon
- `price_leads` - JSONB: Array of {ownerUsername, commentText, reason}
- `groups` - JSONB: Array of {label, count, examples}
- `analyzed_at` - Qachon tahlil qilingan

**Usage:**
```sql
-- Comment insightlarni olish
SELECT * FROM comment_insights WHERE reel_id = 1;

-- Barcha price leadlar
SELECT reel_id, price_leads FROM comment_insights;

-- DM templatelar
SELECT reel_id, dm_template FROM comment_insights;
```

### 7. `account_analyses`
Account-level aggregated tahlillar (username mode).

**Columns:**
- `id` - Primary key
- `account_id` - Qaysi account
- `total_posts` - Nechta post tahlil qilingan
- `total_comments` - Jami commentlar
- `summary` - Umumiy xulosa
- `dm_template` - Universal DM shablon
- `top_requests` - JSONB: Array of {topic, count, examples, requesters}
- `hot_leads` - JSONB: Array of {ownerUsername, commentText, reason}
- `analyzed_at` - Qachon tahlil qilingan

**Usage:**
```sql
-- Account tahlilini olish
SELECT * FROM account_analyses WHERE account_id = 1;

-- Oxirgi account tahlillari
SELECT * FROM account_analyses ORDER BY analyzed_at DESC LIMIT 10;

-- Top requestlar
SELECT account_id, top_requests FROM account_analyses;
```

### 8. `analysis_jobs`
Background analysis tasklarni track qilish (future use).

**Columns:**
- `id` - Primary key
- `job_type` - 'video_analysis', 'comment_analysis', 'account_analysis'
- `input_data` - JSONB: Input ma'lumotlar
- `status` - 'pending', 'running', 'completed', 'failed'
- `result_data` - JSONB: Natija
- `error_message` - Agar xato bo'lsa
- `started_at`, `completed_at` - Vaqtlar

## Dashboard Query Examples

### 1. Oxirgi tahlillar
```sql
SELECT 
  s.id,
  s.session_type,
  s.input,
  s.total_reels_scraped,
  s.scraped_at,
  a.username
FROM scrape_sessions s
LEFT JOIN instagram_accounts a ON s.account_id = a.id
ORDER BY s.scraped_at DESC
LIMIT 20;
```

### 2. Account statistikasi
```sql
SELECT 
  a.username,
  COUNT(DISTINCT r.id) as total_reels,
  SUM(r.views_count) as total_views,
  SUM(r.likes_count) as total_likes,
  COUNT(DISTINCT c.id) as total_comments
FROM instagram_accounts a
LEFT JOIN instagram_reels r ON r.account_id = a.id
LEFT JOIN reel_comments c ON c.reel_id = r.id
WHERE a.username = 'fashionuz'
GROUP BY a.id, a.username;
```

### 3. Top performing reels
```sql
SELECT 
  r.reel_id,
  r.video_url,
  r.caption,
  r.views_count,
  r.likes_count,
  r.comments_count,
  a.username,
  va.viral_factors
FROM instagram_reels r
JOIN instagram_accounts a ON r.account_id = a.id
LEFT JOIN video_analyses va ON va.reel_id = r.id
ORDER BY r.views_count DESC
LIMIT 10;
```

### 4. Barcha hot leads
```sql
SELECT 
  a.username as account,
  aa.hot_leads,
  aa.analyzed_at
FROM account_analyses aa
JOIN instagram_accounts a ON aa.account_id = a.id
ORDER BY aa.analyzed_at DESC;
```

### 5. Comment groups bo'yicha statistika
```sql
SELECT 
  r.reel_id,
  ci.groups,
  ci.total_comments,
  r.views_count
FROM comment_insights ci
JOIN instagram_reels r ON ci.reel_id = r.id
WHERE ci.total_comments > 10
ORDER BY r.views_count DESC;
```

## Migration

Database yaratish uchun:

```bash
# Migration faylni run qiling
psql -U your_username -d your_database -f db/migrations/001_create_instagram_analysis_tables.sql
```

## TypeScript Types

Barcha database types `src/db/schema.ts` faylida Drizzle ORM bilan aniqlangan.

Helper functions `src/db/db-helpers.ts` faylida:
- `saveInstagramAccount()` - Account saqlash
- `saveInstagramReel()` - Reel saqlash
- `saveReelComments()` - Commentlarni saqlash
- `saveVideoAnalysis()` - Video tahlilni saqlash
- `saveCommentInsights()` - Comment insightlarni saqlash
- `saveAccountAnalysis()` - Account tahlilni saqlash
- `saveCompleteAnalysis()` - Hammasi birdan
- `saveAccountAnalysisComplete()` - Account mode uchun

## Automatic Saving

Har bir analiz avtomatik database'ga saqlanadi:
- ✅ URL orqali analiz → `saveCompleteAnalysis()`
- ✅ Hashtag orqali analiz → `saveCompleteAnalysis()` (har bir reel uchun)
- ✅ Username orqali analiz → `saveAccountAnalysisComplete()`

Barcha ma'lumotlar perfect formatda saqlanadi va dashboard orqali oson get qilish mumkin! 🚀
