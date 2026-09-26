-- UniTute phase 4: uploads and text extraction.
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.

-- Course-level notes box, and an "extracted" status between uploading and generating.
alter table public.courses add column notes text not null default '';
alter table public.courses drop constraint courses_status_check;
alter table public.courses add constraint courses_status_check
  check (status in ('draft', 'extracting', 'extracted', 'generating', 'ready', 'failed'));

-- Per-file extraction state.
alter table public.source_files
  add column kind text not null default 'pdf' check (kind in ('pdf', 'pptx', 'docx')),
  add column size_bytes bigint,
  add column status text not null default 'pending' check (status in ('pending', 'extracting', 'done', 'failed')),
  add column error text,
  add column char_count int;

create index on public.source_files (course_id, week);

-- Private bucket for original uploads, 50 MB per file (the free-plan maximum).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'source-files',
  'source-files',
  false,
  52428800,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
);

-- Files live at <user id>/<course id>/<file id>.<ext>; each user can only touch their own folder.
-- The extraction job reads them with the secret key, which bypasses these policies.
create policy "upload own source files" on storage.objects for insert to authenticated
  with check (bucket_id = 'source-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "read own source files" on storage.objects for select to authenticated
  using (bucket_id = 'source-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "delete own source files" on storage.objects for delete to authenticated
  using (bucket_id = 'source-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
-- Retrying an upload overwrites the earlier attempt.
create policy "replace own source files" on storage.objects for update to authenticated
  using (bucket_id = 'source-files' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'source-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
