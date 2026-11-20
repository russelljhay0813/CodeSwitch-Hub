create extension if not exists pgcrypto;

create type public.profile_role as enum ('user', 'admin');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  full_name text not null default '',
  avatar_url text,
  cover_url text,
  bio text not null default '',
  role public.profile_role not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null default '',
  image_url text,
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(body) > 0 or image_url is not null)
);

create table public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.comment_replies (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.videos (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null default '',
  category text not null default 'Other',
  video_url text not null,
  thumbnail_url text,
  views bigint not null default 0 check (views >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.video_likes (
  video_id uuid not null references public.videos(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (video_id, user_id)
);

create table public.video_comments (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.communities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  name text not null,
  description text not null default '',
  category text not null default 'General',
  is_private boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.community_members (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  member_role text not null default 'member' check (member_role in ('owner', 'moderator', 'member')),
  created_at timestamptz not null default now(),
  primary key (community_id, user_id)
);

create table public.community_posts (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid references public.profiles(id) on delete set null,
  title text not null,
  description text not null default '',
  category text not null default 'General',
  difficulty text not null default 'Beginner' check (difficulty in ('Beginner', 'Intermediate', 'Advanced')),
  thumbnail_url text,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.course_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  position integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  unique (course_id, position)
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.course_modules(id) on delete cascade,
  title text not null,
  content text not null default '',
  video_url text,
  materials jsonb not null default '[]'::jsonb,
  position integer not null check (position >= 0),
  duration_minutes integer not null default 0 check (duration_minutes >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (module_id, position)
);

create table public.enrollments (
  course_id uuid not null references public.courses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (course_id, user_id)
);

create table public.lesson_progress (
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (lesson_id, user_id)
);

create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now()
);

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  prompt text not null,
  options jsonb not null default '[]'::jsonb,
  position integer not null check (position >= 0),
  unique (quiz_id, position)
);

create table public.quiz_answer_keys (
  question_id uuid primary key references public.quiz_questions(id) on delete cascade,
  answer_index integer not null check (answer_index >= 0)
);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  answers jsonb not null default '[]'::jsonb,
  score numeric(5,2) not null default 0 check (score >= 0 and score <= 100),
  completed_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null,
  entity_id uuid,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  content_type text not null check (content_type in ('post', 'comment', 'video', 'community')),
  content_id uuid not null,
  reason text not null,
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index posts_feed_idx on public.posts (created_at desc) where visibility = 'public';
create index posts_author_idx on public.posts (author_id, created_at desc);
create index comments_post_idx on public.comments (post_id, created_at);
create index videos_feed_idx on public.videos (created_at desc);
create index community_posts_feed_idx on public.community_posts (community_id, created_at desc);
create index lessons_module_idx on public.lessons (module_id, position);
create index notifications_inbox_idx on public.notifications (user_id, created_at desc);
create index reports_queue_idx on public.reports (status, created_at desc);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username, full_name)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'username', ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create or replace function public.prevent_profile_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role and not (select public.is_admin()) then
    raise exception 'Only administrators can change profile roles';
  end if;
  return new;
end;
$$;

create or replace function public.add_community_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.community_members (community_id, user_id, member_role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;

create or replace function public.queue_notification(
  recipient_id uuid,
  actor_id uuid,
  notification_type text,
  related_entity_id uuid,
  notification_message text
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, actor_id, type, entity_id, message)
  select recipient_id, actor_id, notification_type, related_entity_id, notification_message
  where recipient_id is not null and recipient_id <> actor_id;
$$;

revoke all on function public.queue_notification(uuid, uuid, text, uuid, text) from public, anon, authenticated;

create or replace function public.notify_post_like()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare recipient uuid;
begin
  select author_id into recipient from public.posts where id = new.post_id;
  perform public.queue_notification(recipient, new.user_id, 'post_like', new.post_id, 'Someone liked your post');
  return new;
end;
$$;

create or replace function public.notify_post_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare recipient uuid;
begin
  select author_id into recipient from public.posts where id = new.post_id;
  perform public.queue_notification(recipient, new.author_id, 'post_comment', new.post_id, 'Someone commented on your post');
  return new;
end;
$$;

create or replace function public.notify_comment_reply()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare recipient uuid;
begin
  select author_id into recipient from public.comments where id = new.comment_id;
  perform public.queue_notification(recipient, new.author_id, 'comment_reply', new.comment_id, 'Someone replied to your comment');
  return new;
end;
$$;

create or replace function public.notify_video_like()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare recipient uuid;
begin
  select author_id into recipient from public.videos where id = new.video_id;
  perform public.queue_notification(recipient, new.user_id, 'video_like', new.video_id, 'Someone liked your video');
  return new;
end;
$$;

create or replace function public.notify_video_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare recipient uuid;
begin
  select author_id into recipient from public.videos where id = new.video_id;
  perform public.queue_notification(recipient, new.author_id, 'video_comment', new.video_id, 'Someone commented on your video');
  return new;
end;
$$;

create or replace function public.notify_course_enrollment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare recipient uuid;
begin
  select instructor_id into recipient from public.courses where id = new.course_id;
  perform public.queue_notification(recipient, new.user_id, 'course_enrollment', new.course_id, 'Someone enrolled in your course');
  return new;
end;
$$;

create or replace function public.notify_community_post()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (user_id, actor_id, type, entity_id, message)
  select member.user_id, new.author_id, 'community_post', new.id, 'New post in a community you joined'
  from public.community_members as member
  where member.community_id = new.community_id and member.user_id <> new.author_id;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create trigger prevent_profile_role_escalation
  before update on public.profiles
  for each row execute procedure public.prevent_profile_role_escalation();

create trigger on_community_created
  after insert on public.communities
  for each row execute procedure public.add_community_owner();

create trigger on_post_liked
  after insert on public.post_likes
  for each row execute procedure public.notify_post_like();

create trigger on_post_commented
  after insert on public.comments
  for each row execute procedure public.notify_post_comment();

create trigger on_comment_replied
  after insert on public.comment_replies
  for each row execute procedure public.notify_comment_reply();

create trigger on_video_liked
  after insert on public.video_likes
  for each row execute procedure public.notify_video_like();

create trigger on_video_commented
  after insert on public.video_comments
  for each row execute procedure public.notify_video_comment();

create trigger on_course_enrolled
  after insert on public.enrollments
  for each row execute procedure public.notify_course_enrollment();

create trigger on_community_post_created
  after insert on public.community_posts
  for each row execute procedure public.notify_community_post();

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.comments enable row level security;
alter table public.comment_replies enable row level security;
alter table public.videos enable row level security;
alter table public.video_likes enable row level security;
alter table public.video_comments enable row level security;
alter table public.communities enable row level security;
alter table public.community_members enable row level security;
alter table public.community_posts enable row level security;
alter table public.courses enable row level security;
alter table public.course_modules enable row level security;
alter table public.lessons enable row level security;
alter table public.enrollments enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_answer_keys enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.notifications enable row level security;
alter table public.reports enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on table
  public.profiles,
  public.posts,
  public.post_likes,
  public.comments,
  public.comment_replies,
  public.videos,
  public.video_likes,
  public.video_comments,
  public.communities,
  public.community_members,
  public.community_posts,
  public.courses,
  public.course_modules,
  public.lessons,
  public.enrollments,
  public.lesson_progress,
  public.quizzes,
  public.quiz_questions,
  public.quiz_answer_keys,
  public.quiz_attempts,
  public.notifications,
  public.reports
to authenticated;

create policy "Profiles are visible to signed-in members" on public.profiles
  for select to authenticated using (true);
create policy "Members update their own profile" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "Admins manage profiles" on public.profiles
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "Public posts are visible to members" on public.posts
  for select to authenticated using (visibility = 'public' or author_id = (select auth.uid()) or (select public.is_admin()));
create policy "Members create their own posts" on public.posts
  for insert to authenticated with check (author_id = (select auth.uid()));
create policy "Authors update their posts" on public.posts
  for update to authenticated using (author_id = (select auth.uid()) or (select public.is_admin()))
  with check (author_id = (select auth.uid()) or (select public.is_admin()));
create policy "Authors and admins delete posts" on public.posts
  for delete to authenticated using (author_id = (select auth.uid()) or (select public.is_admin()));

create policy "Post likes are visible to members" on public.post_likes for select to authenticated using (true);
create policy "Members like visible posts as themselves" on public.post_likes for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.posts p where p.id = post_id and (p.visibility = 'public' or p.author_id = (select auth.uid()))
  ));
create policy "Members remove their own likes" on public.post_likes for delete to authenticated using (user_id = (select auth.uid()));

create policy "Comments are visible with their post" on public.comments for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id and (p.visibility = 'public' or p.author_id = (select auth.uid()))));
create policy "Members comment on visible posts as themselves" on public.comments for insert to authenticated
  with check (author_id = (select auth.uid()) and exists (
    select 1 from public.posts p where p.id = comments.post_id and (p.visibility = 'public' or p.author_id = (select auth.uid()))
  ));
create policy "Authors update comments" on public.comments for update to authenticated using (author_id = (select auth.uid()) or (select public.is_admin()))
  with check ((author_id = (select auth.uid()) or (select public.is_admin())) and exists (
    select 1 from public.posts p where p.id = comments.post_id and (p.visibility = 'public' or p.author_id = (select auth.uid()) or (select public.is_admin()))
  ));
create policy "Authors and admins delete comments" on public.comments for delete to authenticated using (author_id = (select auth.uid()) or (select public.is_admin()));

create policy "Replies are visible with their post" on public.comment_replies for select to authenticated
  using (exists (
    select 1 from public.comments c join public.posts p on p.id = c.post_id
    where c.id = comment_replies.comment_id and (p.visibility = 'public' or p.author_id = (select auth.uid()) or c.author_id = (select auth.uid()))
  ));
create policy "Members reply to visible comments as themselves" on public.comment_replies for insert to authenticated
  with check (author_id = (select auth.uid()) and exists (
    select 1 from public.comments c join public.posts p on p.id = c.post_id
    where c.id = comment_replies.comment_id and (p.visibility = 'public' or p.author_id = (select auth.uid()) or c.author_id = (select auth.uid()))
  ));
create policy "Authors update replies" on public.comment_replies for update to authenticated using (author_id = (select auth.uid()) or (select public.is_admin()))
  with check ((author_id = (select auth.uid()) or (select public.is_admin())) and exists (
    select 1 from public.comments c join public.posts p on p.id = c.post_id
    where c.id = comment_replies.comment_id and (p.visibility = 'public' or p.author_id = (select auth.uid()) or c.author_id = (select auth.uid()) or (select public.is_admin()))
  ));
create policy "Authors and admins delete replies" on public.comment_replies for delete to authenticated using (author_id = (select auth.uid()) or (select public.is_admin()));

create policy "Videos are visible to members" on public.videos for select to authenticated using (true);
create policy "Members upload their own videos" on public.videos for insert to authenticated with check (author_id = (select auth.uid()));
create policy "Authors update videos" on public.videos for update to authenticated using (author_id = (select auth.uid()) or (select public.is_admin()))
  with check (author_id = (select auth.uid()) or (select public.is_admin()));
create policy "Authors and admins delete videos" on public.videos for delete to authenticated using (author_id = (select auth.uid()) or (select public.is_admin()));

create policy "Video likes are visible to members" on public.video_likes for select to authenticated using (true);
create policy "Members like videos as themselves" on public.video_likes for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Members remove their own video likes" on public.video_likes for delete to authenticated using (user_id = (select auth.uid()));

create policy "Video comments are visible to members" on public.video_comments for select to authenticated using (true);
create policy "Members comment on videos as themselves" on public.video_comments for insert to authenticated with check (author_id = (select auth.uid()));
create policy "Authors update video comments" on public.video_comments for update to authenticated using (author_id = (select auth.uid()) or (select public.is_admin()))
  with check (author_id = (select auth.uid()) or (select public.is_admin()));
create policy "Authors and admins delete video comments" on public.video_comments for delete to authenticated using (author_id = (select auth.uid()) or (select public.is_admin()));

create policy "Public communities are visible to members" on public.communities for select to authenticated
  using (not is_private or owner_id = (select auth.uid()) or (select public.is_admin()));
create policy "Members create communities as owner" on public.communities for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "Owners and admins update communities" on public.communities for update to authenticated using (owner_id = (select auth.uid()) or (select public.is_admin()))
  with check (owner_id = (select auth.uid()) or (select public.is_admin()));
create policy "Owners and admins delete communities" on public.communities for delete to authenticated using (owner_id = (select auth.uid()) or (select public.is_admin()));

create policy "Community members are visible to members" on public.community_members for select to authenticated using (true);
create policy "Members join as themselves" on public.community_members for insert to authenticated with check (user_id = (select auth.uid()) and member_role = 'member');
create policy "Members leave or owners manage memberships" on public.community_members for delete to authenticated
  using (user_id = (select auth.uid()) or exists (select 1 from public.communities c where c.id = community_id and c.owner_id = (select auth.uid())) or (select public.is_admin()));
create policy "Owners and admins update memberships" on public.community_members for update to authenticated
  using (exists (select 1 from public.communities c where c.id = community_id and c.owner_id = (select auth.uid())) or (select public.is_admin()))
  with check (exists (select 1 from public.communities c where c.id = community_id and c.owner_id = (select auth.uid())) or (select public.is_admin()));

create policy "Community posts visible to community members" on public.community_posts for select to authenticated
  using (exists (select 1 from public.community_members m where m.community_id = community_posts.community_id and m.user_id = (select auth.uid())) or (select public.is_admin()));
create policy "Community members post as themselves" on public.community_posts for insert to authenticated
  with check (author_id = (select auth.uid()) and exists (select 1 from public.community_members m where m.community_id = community_posts.community_id and m.user_id = (select auth.uid())));
create policy "Authors and admins update community posts" on public.community_posts for update to authenticated
  using (author_id = (select auth.uid()) or (select public.is_admin()))
  with check ((author_id = (select auth.uid()) or (select public.is_admin())) and (
    (select public.is_admin()) or exists (
      select 1 from public.community_members m
      where m.community_id = community_posts.community_id and m.user_id = (select auth.uid())
    )
  ));
create policy "Authors and admins delete community posts" on public.community_posts for delete to authenticated
  using (author_id = (select auth.uid()) or (select public.is_admin()));

create policy "Published courses and admin courses are visible" on public.courses for select to authenticated
  using (published or instructor_id = (select auth.uid()) or (select public.is_admin()));
create policy "Instructors create courses" on public.courses for insert to authenticated with check (instructor_id = (select auth.uid()) or (select public.is_admin()));
create policy "Instructors and admins manage courses" on public.courses for update to authenticated
  using (instructor_id = (select auth.uid()) or (select public.is_admin())) with check (instructor_id = (select auth.uid()) or (select public.is_admin()));
create policy "Instructors and admins delete courses" on public.courses for delete to authenticated
  using (instructor_id = (select auth.uid()) or (select public.is_admin()));

create policy "Modules visible for accessible courses" on public.course_modules for select to authenticated
  using (exists (select 1 from public.courses c where c.id = course_id and (c.published or c.instructor_id = (select auth.uid()) or (select public.is_admin()))));
create policy "Instructors manage modules" on public.course_modules for all to authenticated
  using (exists (select 1 from public.courses c where c.id = course_id and (c.instructor_id = (select auth.uid()) or (select public.is_admin()))))
  with check (exists (select 1 from public.courses c where c.id = course_id and (c.instructor_id = (select auth.uid()) or (select public.is_admin()))));

create policy "Lessons visible for accessible courses" on public.lessons for select to authenticated
  using (exists (select 1 from public.course_modules m join public.courses c on c.id = m.course_id where m.id = module_id and (c.published or c.instructor_id = (select auth.uid()) or (select public.is_admin()))));
create policy "Instructors manage lessons" on public.lessons for all to authenticated
  using (exists (select 1 from public.course_modules m join public.courses c on c.id = m.course_id where m.id = module_id and (c.instructor_id = (select auth.uid()) or (select public.is_admin()))))
  with check (exists (select 1 from public.course_modules m join public.courses c on c.id = m.course_id where m.id = module_id and (c.instructor_id = (select auth.uid()) or (select public.is_admin()))));

create policy "Members view their enrollments" on public.enrollments for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "Members enroll in published courses" on public.enrollments for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.courses c where c.id = enrollments.course_id and c.published
  ));
create policy "Admins update enrollments" on public.enrollments for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Members withdraw from their enrollment" on public.enrollments for delete to authenticated using (user_id = (select auth.uid()));

create policy "Members view their lesson progress" on public.lesson_progress for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "Enrolled members track their progress" on public.lesson_progress for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.lessons l
    join public.course_modules m on m.id = l.module_id
    join public.enrollments e on e.course_id = m.course_id
    where l.id = lesson_progress.lesson_id and e.user_id = (select auth.uid())
  ));
create policy "Enrolled members update their progress" on public.lesson_progress for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and exists (
    select 1 from public.lessons l
    join public.course_modules m on m.id = l.module_id
    join public.enrollments e on e.course_id = m.course_id
    where l.id = lesson_progress.lesson_id and e.user_id = (select auth.uid())
  ));
create policy "Members clear their progress" on public.lesson_progress for delete to authenticated using (user_id = (select auth.uid()));

create policy "Quizzes visible for accessible lessons" on public.quizzes for select to authenticated
  using (exists (select 1 from public.lessons l join public.course_modules m on m.id = l.module_id join public.courses c on c.id = m.course_id where l.id = lesson_id and (c.published or c.instructor_id = (select auth.uid()) or (select public.is_admin()))));
create policy "Instructors manage quizzes" on public.quizzes for all to authenticated
  using (exists (select 1 from public.lessons l join public.course_modules m on m.id = l.module_id join public.courses c on c.id = m.course_id where l.id = lesson_id and (c.instructor_id = (select auth.uid()) or (select public.is_admin()))))
  with check (exists (select 1 from public.lessons l join public.course_modules m on m.id = l.module_id join public.courses c on c.id = m.course_id where l.id = lesson_id and (c.instructor_id = (select auth.uid()) or (select public.is_admin()))));

create policy "Quiz questions visible for accessible courses" on public.quiz_questions for select to authenticated
  using (exists (select 1 from public.quizzes q join public.lessons l on l.id = q.lesson_id join public.course_modules m on m.id = l.module_id join public.courses c on c.id = m.course_id where q.id = quiz_id and (c.published or c.instructor_id = (select auth.uid()) or (select public.is_admin()))));
create policy "Instructors manage quiz questions" on public.quiz_questions for all to authenticated
  using (exists (select 1 from public.quizzes q join public.lessons l on l.id = q.lesson_id join public.course_modules m on m.id = l.module_id join public.courses c on c.id = m.course_id where q.id = quiz_id and (c.instructor_id = (select auth.uid()) or (select public.is_admin()))))
  with check (exists (select 1 from public.quizzes q join public.lessons l on l.id = q.lesson_id join public.course_modules m on m.id = l.module_id join public.courses c on c.id = m.course_id where q.id = quiz_id and (c.instructor_id = (select auth.uid()) or (select public.is_admin()))));

create policy "Only course instructors and admins see quiz answers" on public.quiz_answer_keys for select to authenticated
  using (exists (select 1 from public.quiz_questions qq join public.quizzes q on q.id = qq.quiz_id join public.lessons l on l.id = q.lesson_id join public.course_modules m on m.id = l.module_id join public.courses c on c.id = m.course_id where qq.id = question_id and (c.instructor_id = (select auth.uid()) or (select public.is_admin()))));
create policy "Only course instructors and admins manage quiz answers" on public.quiz_answer_keys for all to authenticated
  using (exists (select 1 from public.quiz_questions qq join public.quizzes q on q.id = qq.quiz_id join public.lessons l on l.id = q.lesson_id join public.course_modules m on m.id = l.module_id join public.courses c on c.id = m.course_id where qq.id = question_id and (c.instructor_id = (select auth.uid()) or (select public.is_admin()))))
  with check (exists (select 1 from public.quiz_questions qq join public.quizzes q on q.id = qq.quiz_id join public.lessons l on l.id = q.lesson_id join public.course_modules m on m.id = l.module_id join public.courses c on c.id = m.course_id where qq.id = question_id and (c.instructor_id = (select auth.uid()) or (select public.is_admin()))));

create policy "Members view their quiz attempts" on public.quiz_attempts for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "Members submit only zero-score attempts pending server validation" on public.quiz_attempts for insert to authenticated
  with check (user_id = (select auth.uid()) and score = 0);

create policy "Members view their notifications" on public.notifications for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "Members mark their notifications read" on public.notifications for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke update on table public.notifications from authenticated;
grant update (read_at) on table public.notifications to authenticated;
create policy "Admins create notifications" on public.notifications for insert to authenticated with check ((select public.is_admin()));
create policy "Members clear their notifications" on public.notifications for delete to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "Members view reports they filed" on public.reports for select to authenticated using (reporter_id = (select auth.uid()) or (select public.is_admin()));
create policy "Members file reports as themselves" on public.reports for insert to authenticated with check (reporter_id = (select auth.uid()));
create policy "Admins manage reports" on public.reports for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('post-images', 'post-images', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('video-files', 'video-files', true, 524288000, array['video/mp4', 'video/webm', 'video/quicktime']),
  ('course-materials', 'course-materials', false, 52428800, array['application/pdf', 'image/jpeg', 'image/png', 'video/mp4'])
on conflict (id) do nothing;

create policy "Public media is readable" on storage.objects for select to authenticated
  using (bucket_id in ('avatars', 'post-images', 'video-files'));
create policy "Members upload into their own folder" on storage.objects for insert to authenticated
  with check (bucket_id in ('avatars', 'post-images', 'video-files', 'course-materials') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Members update their own stored files" on storage.objects for update to authenticated
  using ((storage.foldername(name))[1] = (select auth.uid())::text)
  with check ((storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Members delete their own stored files" on storage.objects for delete to authenticated
  using ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin()));
