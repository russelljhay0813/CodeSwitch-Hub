import { supabase } from './supabase'

let storageIdCounter = 0

export function createStorageId() {
  const cryptoApi = globalThis.crypto
  if (cryptoApi?.getRandomValues) {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(16))
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
  }
  storageIdCounter += 1
  return `${Date.now().toString(36)}-${storageIdCounter.toString(36)}-${Math.random().toString(36).slice(2)}`
}

function unwrap(result) {
  if (result.error) throw result.error
  return result.data
}

export async function fetchProfile(userId) {
  return unwrap(await supabase.from('profiles').select('*').eq('id', userId).single())
}

function shapePost(row, userId) {
  return {
    ...row,
    author: row.profiles,
    likes: row.post_likes?.length ?? 0,
    liked: row.post_likes?.some(like => like.user_id === userId) ?? false,
    commentsCount: row.comments?.[0]?.count ?? 0,
  }
}

export async function fetchPosts(userId, { ownOnly = false, limit = 30 } = {}) {
  let query = supabase.from('posts')
    .select('*, profiles!posts_author_id_fkey(id, username, full_name, avatar_url), post_likes(user_id), comments(count)')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (ownOnly) query = query.eq('author_id', userId)
  else query = query.eq('visibility', 'public')
  return unwrap(await query).map(row => shapePost(row, userId))
}

export async function createPost({ userId, body, imageFile }) {
  let imageUrl = null
  if (imageFile) {
    const extension = imageFile.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${userId}/${createStorageId()}.${extension}`
    unwrap(await supabase.storage.from('post-images').upload(path, imageFile, { contentType: imageFile.type }))
    imageUrl = supabase.storage.from('post-images').getPublicUrl(path).data.publicUrl
  }
  return unwrap(await supabase.from('posts')
    .insert({ author_id: userId, body: body.trim(), image_url: imageUrl })
    .select('id').single())
}

export async function updatePost(postId, userId, body) {
  return unwrap(await supabase.from('posts')
    .update({ body: body.trim() })
    .eq('id', postId).eq('author_id', userId).select('id').single())
}

export async function deletePost(postId, userId) {
  return unwrap(await supabase.from('posts')
    .delete().eq('id', postId).eq('author_id', userId).select('id').single())
}

export async function togglePostLike(postId, userId, liked) {
  if (liked) return unwrap(await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', userId))
  return unwrap(await supabase.from('post_likes').insert({ post_id: postId, user_id: userId }))
}

export async function fetchComments(postId) {
  const rows = unwrap(await supabase.from('comments')
    .select('*, profiles!comments_author_id_fkey(id, full_name, username, avatar_url)')
    .eq('post_id', postId).order('created_at'))
  return rows.map(row => ({ ...row, author: row.profiles }))
}

export async function createComment(postId, userId, body) {
  return unwrap(await supabase.from('comments')
    .insert({ post_id: postId, author_id: userId, body: body.trim() }).select('id').single())
}

export async function fetchVideos(userId) {
  const rows = unwrap(await supabase.from('videos')
    .select('*, profiles!videos_author_id_fkey(id, full_name, username, avatar_url), video_likes(user_id), video_comments(count)')
    .order('created_at', { ascending: false }))
  return rows.map(row => ({
    ...row,
    author: row.profiles,
    likes: row.video_likes?.length ?? 0,
    liked: row.video_likes?.some(like => like.user_id === userId) ?? false,
    commentsCount: row.video_comments?.[0]?.count ?? 0,
  }))
}

export async function uploadVideo({ userId, file, title, description, category, thumbnailFile }) {
  const extension = file.name.split('.').pop()?.toLowerCase() || 'mp4'
  const path = `${userId}/${createStorageId()}.${extension}`
  unwrap(await supabase.storage.from('video-files').upload(path, file, { contentType: file.type }))
  const videoUrl = supabase.storage.from('video-files').getPublicUrl(path).data.publicUrl
  let thumbnailUrl = null
  if (thumbnailFile) {
    const imageExtension = thumbnailFile.name.split('.').pop()?.toLowerCase() || 'jpg'
    const imagePath = `${userId}/${createStorageId()}.${imageExtension}`
    unwrap(await supabase.storage.from('post-images').upload(imagePath, thumbnailFile, { contentType: thumbnailFile.type }))
    thumbnailUrl = supabase.storage.from('post-images').getPublicUrl(imagePath).data.publicUrl
  }
  return unwrap(await supabase.from('videos').insert({
    author_id: userId, title: title.trim(), description: description.trim(), category,
    video_url: videoUrl, thumbnail_url: thumbnailUrl,
  }).select('id').single())
}

export async function toggleVideoLike(videoId, userId, liked) {
  if (liked) return unwrap(await supabase.from('video_likes').delete().eq('video_id', videoId).eq('user_id', userId))
  return unwrap(await supabase.from('video_likes').insert({ video_id: videoId, user_id: userId }))
}

export async function fetchVideoComments(videoId) {
  const rows = unwrap(await supabase.from('video_comments')
    .select('*, profiles!video_comments_author_id_fkey(id, full_name, username, avatar_url)')
    .eq('video_id', videoId).order('created_at'))
  return rows.map(row => ({ ...row, author: row.profiles }))
}

export async function createVideoComment(videoId, userId, body) {
  return unwrap(await supabase.from('video_comments')
    .insert({ video_id: videoId, author_id: userId, body: body.trim() }).select('id').single())
}

export async function fetchCourses(userId) {
  const rows = unwrap(await supabase.from('courses')
    .select('*, course_modules(id, lessons(id, duration_minutes)), enrollments(user_id, completed_at)')
    .eq('published', true).order('created_at', { ascending: false }))
  return rows.map(course => {
    const enrollment = course.enrollments?.find(item => item.user_id === userId)
    return {
      ...course,
      enrolled: Boolean(enrollment),
      lessonCount: course.course_modules?.reduce((total, module) => total + (module.lessons?.length ?? 0), 0) ?? 0,
    }
  })
}

export async function enrollInCourse(courseId, userId) {
  return unwrap(await supabase.from('enrollments').insert({ course_id: courseId, user_id: userId }).select().single())
}

export async function fetchCourseLessons(courseId) {
  const modules = unwrap(await supabase.from('course_modules')
    .select('id, title, position, lessons(id, title, content, video_url, materials, position, duration_minutes)')
    .eq('course_id', courseId).order('position'))
  return modules.map(module => ({ ...module, lessons: (module.lessons ?? []).sort((a, b) => a.position - b.position) }))
}

export async function completeLesson(lessonId, userId) {
  return unwrap(await supabase.from('lesson_progress')
    .upsert({ lesson_id: lessonId, user_id: userId }, { onConflict: 'lesson_id,user_id' }).select().single())
}

export async function fetchLessonProgress(userId) {
  return unwrap(await supabase.from('lesson_progress').select('lesson_id').eq('user_id', userId))
}

export async function fetchCommunities(userId) {
  const rows = unwrap(await supabase.from('communities')
    .select('*, community_members(user_id)')
    .eq('is_private', false).order('created_at', { ascending: false }))
  return rows.map(row => ({
    ...row,
    memberCount: row.community_members?.length ?? 0,
    joined: row.community_members?.some(member => member.user_id === userId) ?? false,
  }))
}

export async function toggleCommunityMembership(communityId, userId, joined) {
  if (joined) return unwrap(await supabase.from('community_members').delete()
    .eq('community_id', communityId).eq('user_id', userId))
  return unwrap(await supabase.from('community_members')
    .insert({ community_id: communityId, user_id: userId }))
}

export async function createCommunity({ userId, name, description, category }) {
  return unwrap(await supabase.from('communities')
    .insert({ owner_id: userId, name: name.trim(), description: description.trim(), category: category.trim() })
    .select('id').single())
}

export async function fetchCommunityPosts(communityId) {
  const rows = unwrap(await supabase.from('community_posts')
    .select('*, profiles!community_posts_author_id_fkey(id, full_name, username, avatar_url)')
    .eq('community_id', communityId).order('created_at', { ascending: false }))
  return rows.map(row => ({ ...row, author: row.profiles }))
}

export async function createCommunityPost(communityId, userId, body) {
  return unwrap(await supabase.from('community_posts')
    .insert({ community_id: communityId, author_id: userId, body: body.trim() }).select('id').single())
}

export async function fetchNotifications(userId) {
  return unwrap(await supabase.from('notifications').select('*')
    .eq('user_id', userId).order('created_at', { ascending: false }).limit(50))
}

export async function markNotificationRead(notificationId, userId) {
  return unwrap(await supabase.from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId).eq('user_id', userId).select('id').single())
}

export async function markAllNotificationsRead(userId) {
  return unwrap(await supabase.from('notifications')
    .update({ read_at: new Date().toISOString() }).eq('user_id', userId).is('read_at', null))
}

export async function fetchDashboardStats(userId) {
  const count = async (table, column, value) => {
    let query = supabase.from(table).select(column, { count: 'exact', head: true })
    if (value) query = query.eq(value.column, value.value)
    const { count: total, error } = await query
    if (error) throw error
    return total ?? 0
  }
  const [posts, videos, enrollments, completedLessons] = await Promise.all([
    count('posts', 'id', { column: 'author_id', value: userId }),
    count('videos', 'id', { column: 'author_id', value: userId }),
    count('enrollments', 'course_id', { column: 'user_id', value: userId }),
    count('lesson_progress', 'lesson_id', { column: 'user_id', value: userId }),
  ])
  return { posts, videos, enrollments, completedLessons }
}

export async function updateProfile(userId, values) {
  return unwrap(await supabase.from('profiles').update(values).eq('id', userId).select().single())
}

export async function fetchAdminOverview() {
  const count = async table => {
    const { count: total, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
    if (error) throw error
    return total ?? 0
  }
  const [members, posts, videos, courses, communities] = await Promise.all([
    count('profiles'), count('posts'), count('videos'), count('courses'), count('communities'),
  ])
  return { members, posts, videos, courses, communities }
}

export async function fetchReports() {
  return unwrap(await supabase.from('reports').select('*').order('created_at', { ascending: false }).limit(100))
}

export async function updateReport(reportId, status) {
  return unwrap(await supabase.from('reports').update({ status }).eq('id', reportId).select().single())
}
