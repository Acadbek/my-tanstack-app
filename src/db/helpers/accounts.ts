import { db } from '../index';
import { instagramAccounts } from '../schema';
import { eq } from 'drizzle-orm';

export async function saveInstagramAccount(username: string, fullName?: string) {
  const existing = await db
    .select()
    .from(instagramAccounts)
    .where(eq(instagramAccounts.username, username))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(instagramAccounts)
      .set({
        fullName: fullName || existing[0].fullName,
        lastAnalyzedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(instagramAccounts.id, existing[0].id));
    return existing[0].id;
  }

  const result = await db
    .insert(instagramAccounts)
    .values({
      username,
      fullName,
      lastAnalyzedAt: new Date(),
    })
    .returning({ id: instagramAccounts.id });

  return result[0].id;
}
