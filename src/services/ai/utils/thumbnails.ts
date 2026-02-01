/**
 * Thumbnail Utilities
 * 
 * Fetch and process thumbnail images
 */

import type { InlineImage } from '../types';

export async function fetchThumbnailAsBase64(url: string): Promise<string | undefined> {
  try {
    const response = await fetch(url);
    if (!response.ok) return undefined;

    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer).toString('base64');
  } catch {
    return undefined;
  }
}

export async function fetchThumbnailInlineImage(url: string): Promise<InlineImage | undefined> {
  try {
    const response = await fetch(url);
    if (!response.ok) return undefined;

    const mimeType = response.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg';
    const buffer = await response.arrayBuffer();
    const data = Buffer.from(buffer).toString('base64');

    return { data, mimeType };
  } catch {
    return undefined;
  }
}
