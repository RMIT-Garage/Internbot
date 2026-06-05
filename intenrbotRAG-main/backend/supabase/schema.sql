create extension if not exists vector;

create table if not exists knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  feature text not null,
  title text not null,
  section text not null,
  content text not null,
  source_url text,
  status text not null default 'ready',
  created_at timestamptz not null default now()
);

create table if not exists knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references knowledge_documents(id) on delete cascade,
  feature text not null,
  title text not null,
  section text not null,
  text text not null,
  chunk_index integer not null,
  embedding vector(768) not null,
  source_url text,
  created_at timestamptz not null default now()
);

create index if not exists knowledge_chunks_feature_idx on knowledge_chunks(feature);
create index if not exists knowledge_chunks_embedding_idx on knowledge_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create or replace function match_knowledge_chunks(
  query_embedding vector(768),
  filter_feature text,
  match_count integer
)
returns table (
  title text,
  section text,
  text text,
  source_url text,
  similarity double precision
)
language sql
as $$
  select
    knowledge_chunks.title,
    knowledge_chunks.section,
    knowledge_chunks.text,
    knowledge_chunks.source_url,
    1 - (knowledge_chunks.embedding <=> query_embedding) as similarity
  from knowledge_chunks
  where knowledge_chunks.feature = filter_feature
  order by knowledge_chunks.embedding <=> query_embedding
  limit match_count;
$$;
