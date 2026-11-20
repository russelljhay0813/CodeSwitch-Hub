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

revoke update on table public.notifications from authenticated;
grant update (read_at) on table public.notifications to authenticated;
