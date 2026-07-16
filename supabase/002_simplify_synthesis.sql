-- Run this in the Supabase Dashboard -> SQL Editor.
-- Replaces the summary/disagreement split with a single full article field.

alter table public.stories rename column summary to article;
alter table public.stories drop column disagreement;
