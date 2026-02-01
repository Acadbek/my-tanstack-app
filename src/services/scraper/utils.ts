import { ApifyClient } from 'apify-client';

export const toAbsoluteInstagramUrl = (maybeUrl: string): string => {
  const trimmed = maybeUrl.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  if (trimmed.startsWith('/')) return `https://www.instagram.com${trimmed}`;
  return `https://www.instagram.com/${trimmed}`;
};

export const normalizeTimestamp = (ts: unknown): string | undefined => {
  if (!ts) return undefined;
  if (typeof ts === 'string') return ts;
  if (ts instanceof Date) return ts.toISOString();
  if (typeof ts === 'number') {
    const ms = ts > 1_000_000_000_000 ? ts : ts * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }
  return undefined;
};

export const listDatasetItemsPaged = async <T>(
  client: ApifyClient,
  datasetId: string,
  maxItems: number,
): Promise<T[]> => {
  const dataset = client.dataset(datasetId);
  const pageSize = 250;

  const all: T[] = [];
  for (let offset = 0; offset < maxItems; offset += pageSize) {
    const { items } = await dataset.listItems({
      offset,
      limit: Math.min(pageSize, maxItems - offset),
    });

    const chunk = items as T[];
    all.push(...chunk);

    if (chunk.length === 0) break;
    if (chunk.length < Math.min(pageSize, maxItems - offset)) break;
    if (all.length >= maxItems) break;
  }
  return all.slice(0, maxItems);
};

export const buildDirectUrls = (hashtag: string, accounts?: string[]): string[] => {
  const urls: string[] = [];
  if (hashtag) {
    urls.push(`https://www.instagram.com/explore/tags/${encodeURIComponent(hashtag)}`);
  }
  (accounts ?? [])
    .map((a) => a.trim())
    .filter(Boolean)
    .forEach((username) => {
      urls.push(`https://www.instagram.com/${username}/reels/`);
      urls.push(`https://www.instagram.com/${username}/`);
    });
  return Array.from(new Set(urls));
};
