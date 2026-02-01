import { z } from 'zod';

export const SearchSchema = z.object({
  q: z.string().optional().default(''),
  username: z.string().optional().default(''),
  lead: z.enum(['all', 'lead', 'nonlead']).optional().default('all'),
  sort: z.enum(['new', 'old']).optional().default('new'),
  from: z.string().optional().default(''),
  to: z.string().optional().default(''),
  page: z.coerce.number().int().min(1).optional().default(1),
});

export type SearchValues = z.infer<typeof SearchSchema>;

export interface CommentItem {
  id: string;
  text: string;
  ownerUsername: string | null;
  likesCount: number | null;
  isLead: boolean | null;
  leadReason: string | null;
  timestamp: string | null;
  createdAt: string | null;
  reel?: {
    account?: {
      username: string;
    } | null;
  } | null;
}

export interface CommentsResponse {
  page: number;
  pageSize: number;
  total: number;
  items: CommentItem[];
}
