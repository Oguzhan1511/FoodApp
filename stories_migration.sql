-- 1. Create Stories Table
create table public.stories (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  image_url text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  expires_at timestamp with time zone default timezone('utc'::text, now() + interval '24 hours') not null
);

-- 2. Enable Row Level Security (RLS)
alter table public.stories enable row level security;

-- 3. Policies
create policy "Stories are public" on public.stories for select using (true);
create policy "Users can upload their own stories" on public.stories for insert with check (auth.uid() = user_id);

-- 4. Storage Bucket (Optional if 'posts' is used, but recommended)
-- You need to create a public bucket named 'stories' in Supabase Storage.
-- Policy for storage:
-- Give insert access to authenticated users for 'stories' bucket.
