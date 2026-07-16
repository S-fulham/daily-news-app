export type Category = 'general' | 'sports' | 'politics' | 'media';

export const ALL_CATEGORIES: { key: Category; label: string }[] = [
  { key: 'general', label: 'General' },
  { key: 'sports', label: 'Sports' },
  { key: 'politics', label: 'Politics' },
  { key: 'media', label: 'Media' },
];

export type Headline = {
  title: string;
  source: string;
  lede: string;
  url: string;
};

export type Story = {
  id: string;
  story_date: string;
  category: Category;
  rank: number;
  article: string;
  outlet_count: number;
  article_count: number;
  headlines: Headline[];
  generated_at: string;
};

export type Profile = {
  id: string;
  email: string | null;
  subscription_status: string;
  unlocked_categories: Category[];
};
