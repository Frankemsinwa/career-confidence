-- Create a table for public user profiles
create table profiles (
  id uuid references auth.users not null primary key,
  updated_at timestamp with time zone,
  full_name text,
  avatar_url text
);

-- Set up Row Level Security (RLS)
-- See https://supabase.com/docs/guides/auth/row-level-security
alter table profiles
  enable row level security;

create policy "Public profiles are viewable by everyone." on profiles
  for select using (true);

create policy "Users can insert their own profile." on profiles
  for insert with check (auth.uid() = id);

create policy "Users can update own profile." on profiles
  for update using (auth.uid() = id);

-- This trigger automatically creates a profile for new users
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- Create a table for interview attempts
create table interview_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  question text not null,
  user_answer text,
  evaluation jsonb,
  settings jsonb,
  communication_analysis jsonb,
  recording_duration_seconds integer,
  practice_mode text
);

-- Set up Row Level Security for interview_attempts
alter table interview_attempts
  enable row level security;

create policy "Users can view their own interview attempts." on interview_attempts
  for select using (auth.uid() = user_id);

create policy "Users can insert their own interview attempts." on interview_attempts
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own interview attempts." on interview_attempts
  for update using (auth.uid() = user_id);

create policy "Users can delete their own interview attempts." on interview_attempts
  for delete using (auth.uid() = user_id);


-- Create a table for presentation attempts
create table presentation_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  settings jsonb,
  transcript text,
  analysis jsonb,
  actual_duration_seconds integer,
  practice_mode text
);

-- Set up Row Level Security for presentation_attempts
alter table presentation_attempts
  enable row level security;

create policy "Users can view their own presentation attempts." on presentation_attempts
  for select using (auth.uid() = user_id);

create policy "Users can insert their own presentation attempts." on presentation_attempts
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own presentation attempts." on presentation_attempts
  for update using (auth.uid() = user_id);

create policy "Users can delete their own presentation attempts." on presentation_attempts
  for delete using (auth.uid() = user_id);
