import { db } from '../index';
import { scrapeSessions } from '../schema';

export async function saveScrapeSession(
  sessionType: 'url' | 'hashtag' | 'username',
  input: string,
  hashtag?: string,
  accountId?: number,
  totalReelsScraped?: number,
) {
  const result = await db
    .insert(scrapeSessions)
    .values({
      sessionType,
      input,
      hashtag,
      accountId,
      totalReelsScraped: totalReelsScraped || 0,
    })
    .returning({ id: scrapeSessions.id });

  return result[0].id;
}
