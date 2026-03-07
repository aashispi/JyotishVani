-- Run this in Supabase SQL Editor

-- Enable pgvector
create extension if not exists vector;

-- Main chunks table
create table if not exists jyotish_chunks (
  id          bigserial   primary key,
  content     text        not null,
  metadata    jsonb       default '{}',
  embedding   vector(768),
  created_at  timestamptz default now()
);

-- Fast cosine similarity index
create index if not exists jyotish_chunks_embedding_idx
  on jyotish_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Full-text search index
create index if not exists jyotish_chunks_fts_idx
  on jyotish_chunks
  using gin (to_tsvector('english', content));

-- RPC function called by the chat API
create or replace function match_jyotish_chunks(
  query_embedding  vector(768),
  match_threshold  float   default 0.68,
  match_count      int     default 8,
  filter_sources   text[]  default null
)
returns table (
  id         bigint,
  content    text,
  metadata   jsonb,
  similarity float
)
language sql stable
as $$
  select
    id,
    content,
    metadata,
    1 - (embedding <=> query_embedding) as similarity
  from jyotish_chunks
  where
    1 - (embedding <=> query_embedding) > match_threshold
    and (filter_sources is null or metadata->>'source' = any(filter_sources))
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- Conversation history
create table if not exists chat_sessions (
  id         uuid        primary key default gen_random_uuid(),
  messages   jsonb       default '[]',
  language   text        default 'en',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table jyotish_chunks enable row level security;
alter table chat_sessions  enable row level security;

-- Policies
create policy "Allow public read on chunks"
  on jyotish_chunks for select using (true);

create policy "Allow service insert on chunks"
  on jyotish_chunks for insert with check (true);

create policy "Allow service manage sessions"
  on chat_sessions for all using (true) with check (true);
