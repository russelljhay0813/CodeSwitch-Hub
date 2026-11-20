import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowRight, Bell, BookOpen, Check, CheckCircle2, Clock3,
  Compass, Eye, GraduationCap, Heart, Home, Image, LayoutDashboard, LockKeyhole,
  LogOut, Menu, MessageCircle, MoreHorizontal, Play, Plus, Search, Send, Settings,
  Shield, Sparkles, Upload, Users, Video, X,
} from 'lucide-react'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import {
  completeLesson, createCommunity, createCommunityPost, createComment, createPost, createStorageId, createVideoComment,
  deletePost, enrollInCourse, fetchAdminOverview, fetchComments, fetchCommunityPosts,
  fetchCommunities, fetchCourseLessons, fetchCourses, fetchDashboardStats, fetchLessonProgress,
  fetchNotifications, fetchPosts, fetchProfile, fetchReports, fetchVideoComments, fetchVideos, markAllNotificationsRead,
  markNotificationRead, toggleCommunityMembership, togglePostLike, toggleVideoLike,
  updatePost, updateProfile, updateReport, uploadVideo,
} from './lib/data'

const navigation = [
  { heading: 'MENU', links: [
    { title: 'Overview', path: '/', icon: LayoutDashboard },
    { title: 'My feed', path: '/feed', icon: Home },
    { title: 'Video hub', path: '/videos', icon: Play },
    { title: 'Learning', path: '/learning', icon: BookOpen },
    { title: 'Communities', path: '/communities', icon: Users },
  ] },
  { heading: 'PERSONAL', links: [
    { title: 'My profile', path: '/profile', icon: Users },
    { title: 'Notifications', path: '/notifications', icon: Bell },
    { title: 'Settings', path: '/settings', icon: Settings },
  ] },
]

function useRemoteData(loader, dependencies = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const refresh = () => setRevision(value => value + 1)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    loader().then(result => {
      if (active) setData(result)
    }).catch(reason => {
      if (active) setError(reason.message || 'The request could not be completed.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  // The caller supplies stable dependencies for its loader.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies, revision])

  return { data, loading, error, refresh }
}

function Avatar({ profile, size = 'h-10 w-10' }) {
  const label = profile?.full_name?.trim()?.[0] || profile?.username?.trim()?.[0] || '?'
  return profile?.avatar_url
    ? <img src={profile.avatar_url} alt="" className={`${size} shrink-0 rounded-full object-cover`} />
    : <span aria-label={profile?.full_name || 'Member'} className={`${size} grid shrink-0 place-items-center rounded-full bg-[#e8ece8] text-sm font-semibold text-[#52665d]`}>{label.toUpperCase()}</span>
}

function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [authLoading, setAuthLoading] = useState(Boolean(isSupabaseConfigured))
  const [profileError, setProfileError] = useState('')
  const [toast, setToast] = useState('')
  const [mobileMenu, setMobileMenu] = useState(false)
  const [query, setQuery] = useState('')
  const [composer, setComposer] = useState('')
  const [unreadCount, setUnreadCount] = useState(0)
  const notify = useCallback(message => {
    setToast(message)
    window.setTimeout(() => setToast(''), 3200)
  }, [])

  useEffect(() => {
    if (!supabase) return undefined
    let active = true
    const loadSession = async () => {
      const { data, error } = await supabase.auth.getSession()
      if (!active) return
      if (error) setProfileError(`Could not restore your session: ${error.message}`)
      setSession(data?.session ?? null)
      setAuthLoading(false)
    }
    void loadSession()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setProfile(null)
      setProfileError('')
      setAuthLoading(false)
    })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session?.user?.id) {
      setProfile(null)
      return
    }
    let active = true
    fetchProfile(session.user.id).then(result => {
      if (active) { setProfile(result); setProfileError('') }
    }).catch(error => {
      if (active) setProfileError(`Could not load your profile. Check the Supabase schema and access policies. ${error.message}`)
    })
    return () => { active = false }
  }, [session?.user?.id])

  const loadUnreadCount = useCallback(async () => {
    if (!session?.user?.id) return
    const { count, error } = await supabase.from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', session.user.id).is('read_at', null)
    if (error) throw error
    setUnreadCount(count ?? 0)
  }, [session?.user?.id])
  useEffect(() => {
    if (session?.user?.id) loadUnreadCount().catch(error => notify(`Could not load notifications: ${error.message}`))
  }, [session?.user?.id, loadUnreadCount, notify])

  if (!isSupabaseConfigured) return <ConnectionSetup />
  if (authLoading) return <LoadingPage label="Checking your Supabase session…" />
  if (!session) return <AuthPage notify={notify} toast={toast} />
  if (profileError && !profile) return <div className="grid min-h-screen place-items-center bg-canvas p-5"><div className="max-w-xl"><ErrorBanner message={profileError}/><p className="text-sm text-slate-600">Confirm that <code>supabase/schema.sql</code> has been applied and that the signed-in user can read their profile.</p></div></div>
  if (!profile && !profileError) return <LoadingPage label="Loading your profile…" />

  const isAdmin = profile?.role === 'admin'
  const groups = isAdmin
    ? [...navigation, { heading: 'ADMIN', links: [{ title: 'Admin panel', path: '/admin', icon: Shield }] }]
    : navigation
  const pageTitle = groups.flatMap(group => group.links).find(item => item.path === location.pathname)?.title || 'Overview'
  const run = async (task, successMessage, refresh) => {
    try {
      await task()
      if (refresh) refresh()
      if (successMessage) notify(successMessage)
      return true
    } catch (error) {
      notify(error.message || 'The request could not be completed.')
      return false
    }
  }
  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) notify(`Could not sign out: ${error.message}`)
  }

  return <div className="min-h-screen bg-canvas">
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-[252px] flex-col bg-ink px-5 pb-5 pt-6 text-white transition-transform duration-300 md:translate-x-0 ${mobileMenu ? 'translate-x-0' : '-translate-x-full'}`}>
      <Link to="/" onClick={() => setMobileMenu(false)} className="mb-9 flex items-center gap-3 px-2">
        <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-gold text-ink"><Sparkles size={21}/></span>
        <span><span className="block font-display text-[20px] font-extrabold tracking-tight">Gather</span><span className="text-[10px] tracking-[.19em] text-slate-400">KOLEHIYO NG LUNGSOD NG LIPA</span></span>
      </Link>
      <button onClick={() => setComposer('post')} className="mb-7 flex h-11 items-center justify-center gap-2 rounded-xl bg-gold text-sm font-bold text-ink transition hover:bg-[#f5ca70]"><Plus size={18}/> Create a post</button>
      <div className="soft-scroll flex-1 overflow-y-auto">
        {groups.map(group => <div key={group.heading} className="mb-7">
          <div className="mb-3 px-3 text-[10px] font-bold tracking-[.18em] text-slate-500">{group.heading}</div>
          <nav className="space-y-1">
            {group.links.map(item => <Link key={item.path} to={item.path} onClick={() => setMobileMenu(false)} className={`side-link flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium ${location.pathname === item.path ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/[.06] hover:text-white'}`}>
              <item.icon size={17} strokeWidth={1.8}/>{item.title}
              {item.title === 'Notifications' && unreadCount > 0 && <span className="ml-auto rounded-full bg-gold px-2 py-0.5 text-[10px] font-bold text-ink">{unreadCount}</span>}
            </Link>)}
          </nav>
        </div>)}
      </div>
      <Link to="/profile" className="flex items-center gap-3 rounded-xl p-2 hover:bg-white/[.06]">
        <Avatar profile={profile} size="h-9 w-9"/><span className="min-w-0 flex-1 truncate text-[12px] font-semibold">{profile.full_name || profile.username}</span>
      </Link>
    </aside>
    {mobileMenu && <button aria-label="Close navigation" onClick={() => setMobileMenu(false)} className="fixed inset-0 z-30 bg-black/35 md:hidden"/>}

    <div className="min-h-screen md:pl-[252px]">
      <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-[#eaecf0] bg-white/95 px-4 backdrop-blur md:px-8">
        <div className="flex items-center gap-3">
          <button onClick={() => setMobileMenu(!mobileMenu)} aria-label="Toggle navigation" className="grid h-9 w-9 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 md:hidden"><Menu size={20}/></button>
          <div><div className="text-[11px] text-slate-400">Pages <span className="mx-1.5">/</span><span className="text-slate-500">{pageTitle}</span></div><div className="font-display text-[16px] font-bold text-[#202638]">{pageTitle}</div></div>
        </div>
        <div className="flex items-center gap-3 md:gap-5">
          <label className="hidden h-10 w-[230px] items-center gap-2.5 rounded-xl border border-[#eff0f3] bg-[#f7f8fa] px-3 sm:flex"><Search size={16} className="text-slate-400"/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search..." className="w-full bg-transparent text-[12px] outline-none placeholder:text-slate-400"/></label>
          <Link to="/notifications" aria-label="Notifications" className="relative grid h-9 w-9 place-items-center rounded-xl text-slate-500 hover:bg-slate-100"><Bell size={18}/>{unreadCount > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#e77b67]"/>}</Link>
          <Link to="/profile" aria-label="Your profile"><Avatar profile={profile} size="h-9 w-9"/></Link>
        </div>
      </header>

      <main className="mx-auto max-w-[1480px] px-4 pb-24 pt-6 sm:px-6 lg:px-9 lg:pt-8">
        {profileError && <ErrorBanner message={profileError}/>}
        <Routes>
          <Route path="/" element={<Dashboard userId={session.user.id} profile={profile} openComposer={setComposer} run={run}/>}/>
          <Route path="/feed" element={<Feed userId={session.user.id} query={query} openComposer={setComposer} run={run}/>}/>
          <Route path="/videos" element={<VideoHub userId={session.user.id} query={query} openComposer={setComposer} run={run}/>}/>
          <Route path="/learning" element={<LearningHub userId={session.user.id} query={query} run={run}/>}/>
          <Route path="/communities" element={<Communities userId={session.user.id} query={query} run={run}/>}/>
          <Route path="/profile" element={<ProfilePage userId={session.user.id} profile={profile} run={run}/>}/>
          <Route path="/notifications" element={<Notifications userId={session.user.id} onRead={loadUnreadCount} run={run}/>}/>
          <Route path="/settings" element={<SettingsPage userId={session.user.id} profile={profile} email={session.user.email} onSignOut={handleSignOut} run={run}/>}/>
          <Route path="/admin" element={isAdmin ? <AdminDashboard/> : <AccessDenied/>}/>
          <Route path="*" element={<Navigate to="/" replace/>}/>
        </Routes>
      </main>
      <div className="mobile-nav-shadow fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-slate-100 bg-white px-2 pb-[env(safe-area-inset-bottom)] pt-2 md:hidden">
        {['/', '/feed', '/videos', '/learning', '/communities'].map((path, index) => {
          const Icon = [LayoutDashboard, Home, Play, BookOpen, Users][index]
          return <Link key={path} to={path} aria-label={path === '/' ? 'Overview' : path.slice(1)} className={`grid h-11 place-items-center ${location.pathname === path ? 'text-[#a97820]' : 'text-slate-400'}`}><Icon size={20}/></Link>
        })}
      </div>
    </div>
    {composer === 'post' && <PostComposer userId={session.user.id} close={() => setComposer('')} notify={notify}/>}
    {composer === 'video' && <VideoComposer userId={session.user.id} close={() => setComposer('')} notify={notify}/>}
    {toast && <div role="status" className="fixed bottom-6 left-1/2 z-50 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-xl bg-ink px-4 py-3 text-[13px] font-medium text-white shadow-xl"><CheckCircle2 size={17} className="shrink-0 text-[#8bca9a]"/>{toast}</div>}
  </div>
}

function ConnectionSetup() {
  return <div className="grid min-h-screen place-items-center bg-canvas p-5"><div className="max-w-[560px] rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9"><div className="mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-[#fff4df] text-[#ad7e2a]"><LockKeyhole size={22}/></div><h1 className="font-display text-2xl font-bold">Connect your Supabase project</h1><p className="mt-3 text-sm leading-6 text-slate-600">Gather uses live Supabase data only. Add your project URL and publishable key to enable sign-in and load the app. No demo users or sample content will be shown.</p><ol className="mt-5 list-decimal space-y-2 pl-5 text-sm text-slate-600"><li>Copy <code>.env.example</code> to <code>.env.local</code>.</li><li>Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>.</li><li>Run <code>supabase/schema.sql</code> in your Supabase SQL editor.</li><li>Restart the Vite server and create an account.</li></ol><p className="mt-5 text-xs text-slate-500">See the project README for setup details. Your Supabase secret/service-role key must never be used in the browser.</p></div></div>
}

function AuthPage({ notify, toast }) {
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async event => {
    event.preventDefault()
    setBusy(true); setError('')
    try {
      if (mode === 'signup') {
        const { error: authError } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } })
        if (authError) throw authError
        notify('Check your email to confirm your account.')
      } else if (mode === 'reset') {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/settings` })
        if (authError) throw authError
        notify('Password reset instructions were sent.')
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
        if (authError) throw authError
      }
    } catch (reason) { setError(reason.message || 'Authentication failed.') }
    finally { setBusy(false) }
  }
  return <div className="grid min-h-screen bg-white md:grid-cols-2">
    <section className="relative hidden flex-col justify-between overflow-hidden bg-ink p-12 text-white md:flex"><div className="font-display text-xl font-extrabold">Gather</div><div className="relative z-10 max-w-md"><div className="mb-4 text-[10px] font-bold tracking-[.2em] text-gold">A PLACE TO GROW TOGETHER</div><h1 className="font-display text-4xl font-bold leading-tight">Find your people.<br/>Follow your curiosity.</h1><p className="mt-4 text-sm leading-7 text-slate-300">Sign in to discover conversations, courses, videos, and communities from your Gather project.</p></div><div className="absolute -bottom-28 -right-24 h-[360px] w-[360px] rounded-full border border-white/10"/><span className="text-[10px] text-slate-500">A little progress, every day.</span></section>
    <section className="flex items-center justify-center px-6 py-12"><form onSubmit={submit} className="w-full max-w-[400px]">
      <div className="mb-2 text-[10px] font-bold tracking-[.18em] text-[#b7893c]">{mode === 'signup' ? 'CREATE YOUR ACCOUNT' : 'SUPABASE AUTH'}</div><h2 className="font-display text-[27px] font-bold">{mode === 'signup' ? 'Join Gather' : mode === 'reset' ? 'Reset password' : 'Welcome back'}</h2><p className="mt-2 text-[12px] text-slate-500">Your account is authenticated by your connected Supabase project.</p>
      {mode === 'signup' && <label className="mt-6 block text-[11px] font-semibold text-slate-600">Full name<input required value={name} onChange={e=>setName(e.target.value)} autoComplete="name" className="mt-2 block w-full rounded-xl border border-slate-200 px-3 py-3 text-[12px] font-normal outline-none focus:border-[#d7b86d]"/></label>}
      <label className="mt-5 block text-[11px] font-semibold text-slate-600">Email<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" className="mt-2 block w-full rounded-xl border border-slate-200 px-3 py-3 text-[12px] font-normal outline-none focus:border-[#d7b86d]"/></label>
      {mode !== 'reset' && <label className="mt-4 block text-[11px] font-semibold text-slate-600">Password<input required minLength={8} type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} className="mt-2 block w-full rounded-xl border border-slate-200 px-3 py-3 text-[12px] font-normal outline-none focus:border-[#d7b86d]"/></label>}
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-[11px] text-red-700">{error}</p>}
      <button disabled={busy} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-ink py-3 text-[12px] font-bold text-white disabled:opacity-60">{busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Send reset link' : 'Sign in'}<ArrowRight size={15}/></button>
      <div className="mt-5 flex flex-wrap justify-between gap-3 text-[11px]"><button type="button" onClick={()=>setMode(mode === 'login' ? 'signup' : 'login')} className="font-semibold text-[#a97820]">{mode === 'signup' ? 'Already registered? Sign in' : 'Create an account'}</button>{mode !== 'reset' ? <button type="button" onClick={()=>setMode('reset')} className="text-slate-500">Forgot password?</button> : <button type="button" onClick={()=>setMode('login')} className="text-slate-500">Back to sign in</button>}</div>
      {toast && <p role="status" className="mt-4 rounded-xl bg-[#eef5ef] px-4 py-3 text-[11px] text-[#4c7658]">{toast}</p>}
    </form></section>
  </div>
}

function LoadingPage({ label }) {
  return <div className="grid min-h-screen place-items-center bg-canvas text-sm text-slate-500">{label}</div>
}
function ErrorBanner({ message }) {
  return <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><strong>Supabase request failed.</strong> {message}</div>
}
function EmptyState({ title, text, action, onAction }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center"><div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-[#f5f6f8] text-slate-400"><Search size={19}/></div><div className="font-display text-[14px] font-bold">{title}</div><p className="mt-1 text-[11px] text-slate-500">{text}</p>{action && <button onClick={onAction} className="mt-4 rounded-lg bg-ink px-4 py-2 text-[11px] font-semibold text-white">{action}</button>}</div>
}
function SectionTitle({ eyebrow, title, action, onAction }) {
  return <div className="mb-5 flex items-end justify-between"><div>{eyebrow && <div className="mb-1.5 text-[10px] font-bold tracking-[.17em] text-[#b7893c]">{eyebrow}</div>}<h2 className="font-display text-[20px] font-bold tracking-tight text-[#202638]">{title}</h2></div>{action && <button onClick={onAction} className="flex items-center gap-1 text-[12px] font-semibold text-slate-500 hover:text-[#a97820]">{action}<ArrowRight size={14}/></button>}</div>
}
function QueryState({ loading, error, empty, children }) {
  if (loading) return <LoadingPage label="Loading from Supabase…"/>
  if (error) return <ErrorBanner message={error}/>
  if (empty) return empty
  return children
}

function Dashboard({ userId, profile, openComposer, run }) {
  const navigate = useNavigate()
  const load = useCallback(async () => {
    const [stats, posts, courses, videos] = await Promise.all([
      fetchDashboardStats(userId), fetchPosts(userId, { limit: 3 }), fetchCourses(userId), fetchVideos(userId),
    ])
    return { stats, posts, courses: courses.filter(course => course.enrolled).slice(0, 3), videos: videos.slice(0, 2) }
  }, [userId])
  const { data, loading, error, refresh } = useRemoteData(load, [load])
  return <div className="space-y-8">
    <section className="relative overflow-hidden rounded-[24px] bg-[#18213a] px-6 py-7 text-white sm:px-9 sm:py-9"><div className="relative z-10 max-w-[620px]"><div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[.07] px-3 py-1 text-[10px] font-semibold text-[#f3c76e]"><Sparkles size={12}/> YOUR SPACE TO GROW</div><h1 className="mb-2 font-display text-[27px] font-bold sm:text-[33px]">Welcome, {profile.full_name || profile.username || 'member'}</h1><p className="max-w-[430px] text-[13px] leading-6 text-slate-300">Your activity, courses, videos, and community updates from Supabase.</p><div className="mt-5 flex flex-wrap gap-2.5"><button onClick={()=>openComposer('post')} className="flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-[12px] font-bold text-ink"><Plus size={16}/> Create a post</button><Link to="/learning" className="flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2.5 text-[12px] font-semibold text-white"><BookOpen size={15}/> Browse courses</Link></div></div><div className="absolute -right-10 -bottom-36 h-[330px] w-[330px] rounded-full bg-[#eab54d]/[.07]"/></section>
    <QueryState loading={loading} error={error}>{data && <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[['Posts',data.stats.posts,MessageCircle],['Videos',data.stats.videos,Video],['Enrolled courses',data.stats.enrollments,BookOpen],['Lessons completed',data.stats.completedLessons,Check]].map(([label,count,Icon])=><div key={label} className="rounded-2xl border border-[#eceef1] bg-white p-4 sm:p-5"><div className="mb-4 grid h-9 w-9 place-items-center rounded-xl bg-[#fff4df] text-[#b98227]"><Icon size={17}/></div><div className="font-display text-[23px] font-bold">{count}</div><div className="mt-1 text-[11px] text-slate-500">{label}</div></div>)}</section>}</QueryState>
    <div className="grid gap-7 xl:grid-cols-[1.55fr_1fr]">
      <div><SectionTitle eyebrow="YOUR LEARNING" title="Enrolled courses" action="Browse courses" onAction={()=>navigate('/learning')}/>
        <QueryState loading={loading} error={error} empty={!data?.courses.length && <EmptyState title="You haven't enrolled in any courses yet." text="Explore the learning hub to find a course."/>}>{data?.courses.map(course=><CourseSummary key={course.id} course={course}/>)}</QueryState>
        <div className="mt-7"><SectionTitle eyebrow="YOUR COMMUNITY" title="Recent posts" action="Open feed" onAction={()=>navigate('/feed')}/>
          <QueryState loading={loading} error={error} empty={!data?.posts.length && <EmptyState title="No posts yet." text="Be the first to share your thoughts!" action="Create a post" onAction={()=>openComposer('post')}/>}>{data?.posts.map(post=><PostCard key={post.id} post={post} userId={userId} run={run} refresh={refresh}/>)}</QueryState>
        </div>
      </div>
      <div><SectionTitle eyebrow="RECENTLY UPLOADED" title="Videos" action="Browse videos" onAction={()=>location.assign('/videos')}/>
        <QueryState loading={loading} error={error} empty={!data?.videos.length && <EmptyState title="No videos available yet." text="Videos uploaded by members will appear here."/>}>{data?.videos.map(video=><MiniVideo key={video.id} video={video}/>)}</QueryState>
        <div className="mt-7 rounded-2xl border border-[#eceef1] bg-white p-5"><div className="mb-4 text-[10px] font-bold tracking-[.15em] text-[#b7893c]">QUICK ACTIONS</div><div className="grid grid-cols-2 gap-2"><button onClick={()=>openComposer('post')} className="quick-action"><Plus size={16}/>Create a post</button><button onClick={()=>openComposer('video')} className="quick-action"><Upload size={16}/>Upload a video</button><Link to="/learning" className="quick-action"><BookOpen size={16}/>Explore courses</Link><Link to="/communities" className="quick-action"><Users size={16}/>Find communities</Link></div></div>
      </div>
    </div>
  </div>
}

function CourseSummary({ course }) {
  return <Link to="/learning" className="mb-3 flex items-center gap-4 rounded-2xl border border-[#eceef1] bg-white p-4 hover:shadow-sm">{course.thumbnail_url ? <img src={course.thumbnail_url} alt="" className="h-[72px] w-[86px] rounded-xl object-cover"/> : <div className="grid h-[72px] w-[86px] place-items-center rounded-xl bg-[#f4eee1] text-[#af8945]"><BookOpen size={22}/></div>}<div className="min-w-0 flex-1"><div className="text-[9px] font-bold tracking-[.14em] text-[#b7893c]">{course.category}</div><div className="mt-1 truncate font-display text-[13px] font-bold">{course.title}</div><div className="mt-1 text-[10px] text-slate-500">{course.lessonCount} lessons</div></div></Link>
}

function Feed({ userId, query, openComposer, run }) {
  const [filter, setFilter] = useState('Newest')
  const load = useCallback(() => fetchPosts(userId), [userId])
  const { data, loading, error, refresh } = useRemoteData(load, [load])
  const filtered = (data ?? []).filter(post => `${post.body} ${post.author?.full_name} ${post.author?.username}`.toLowerCase().includes(query.toLowerCase()))
  const displayed = filter === 'Popular' ? [...filtered].sort((a, b) => b.likes - a.likes) : filtered
  return <div className="mx-auto w-full max-w-[720px]"><div className="mb-6"><div className="mb-1 text-[10px] font-bold tracking-[.17em] text-[#b7893c]">A PLACE TO SHARE</div><h1 className="font-display text-[26px] font-bold">Your feed</h1><p className="mt-1 text-[12px] text-slate-500">Posts loaded from your Supabase project.</p></div><button onClick={()=>openComposer('post')} className="mb-5 flex w-full items-center gap-3 rounded-2xl border border-[#eceef1] bg-white p-4 text-left"><span className="grid h-10 w-10 place-items-center rounded-full bg-[#f7f8fa] text-slate-400"><Plus size={17}/></span><span className="flex-1 rounded-xl bg-[#f7f8fa] px-4 py-3 text-[12px] text-slate-400">Write a post…</span><Image size={18} className="text-[#76a08a]"/></button><div className="mb-4 flex gap-2">{['Newest','Popular'].map(item=><button key={item} onClick={()=>setFilter(item)} className={`rounded-full px-4 py-2 text-[11px] font-semibold ${filter===item?'bg-ink text-white':'bg-white text-slate-500'}`}>{item}</button>)}</div>
    <QueryState loading={loading} error={error} empty={!displayed.length && <EmptyState title={query ? 'No matching posts.' : 'No posts yet.'} text={query ? 'Try another search.' : 'Be the first to share your thoughts!'} action="Create a post" onAction={()=>openComposer('post')}/>}>{displayed.map(post=><PostCard key={post.id} post={post} userId={userId} run={run} refresh={refresh}/>)}</QueryState>
  </div>
}

function PostCard({ post, userId, run, refresh }) {
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState([])
  const [comment, setComment] = useState('')
  const [editText, setEditText] = useState(post.body)
  const [editing, setEditing] = useState(false)
  const [commentsError, setCommentsError] = useState('')
  const mine = post.author_id === userId
  const toggleComments = async () => {
    if (showComments) { setShowComments(false); return }
    setShowComments(true); setCommentsError('')
    try { setComments(await fetchComments(post.id)) } catch (error) { setCommentsError(error.message) }
  }
  const submitComment = async () => {
    if (!comment.trim()) return
    const saved = await run(() => createComment(post.id, userId, comment), 'Comment posted.')
    if (!saved) return
    setComment('')
    try { setComments(await fetchComments(post.id)); refresh() } catch (error) { setCommentsError(error.message) }
  }
  const remove = () => {
    if (window.confirm('Delete this post? This cannot be undone.')) run(() => deletePost(post.id, userId), 'Post deleted.', refresh)
  }
  const saveEdit = async () => {
    if (!editText.trim()) return
    if (await run(() => updatePost(post.id, userId, editText), 'Post updated.', refresh)) setEditing(false)
  }
  const toggleLike = () => run(() => togglePostLike(post.id, userId, post.liked), post.liked ? 'Like removed.' : 'Post liked.', refresh)
  return <article className="mb-4 rounded-2xl border border-[#eceef1] bg-white p-4 sm:p-5">
    <div className="flex items-start gap-3"><Avatar profile={post.author}/><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-1.5"><span className="text-[13px] font-bold">{post.author?.full_name || post.author?.username || 'Member'}</span><span className="text-[11px] text-slate-400">{post.author?.username ? `@${post.author.username}` : ''}</span><time className="ml-auto text-[10px] text-slate-400">{new Date(post.created_at).toLocaleString()}</time></div><div className="mt-1 text-[10px] text-slate-400">{post.visibility}</div></div>{mine&&<details className="relative"><summary aria-label="Post options" className="list-none cursor-pointer text-slate-400"><MoreHorizontal size={19}/></summary><div className="absolute right-0 z-10 mt-2 w-32 rounded-xl border border-slate-100 bg-white p-1 shadow-lg"><button onClick={()=>setEditing(true)} className="w-full rounded-lg px-3 py-2 text-left text-[11px] hover:bg-slate-50">Edit post</button><button onClick={remove} className="w-full rounded-lg px-3 py-2 text-left text-[11px] text-red-600 hover:bg-red-50">Delete post</button></div></details>}</div>
    {editing ? <div className="mt-3"><textarea value={editText} onChange={e=>setEditText(e.target.value)} rows="4" className="w-full resize-none rounded-xl bg-[#f7f8fa] p-3 text-[12px] outline-none"/><div className="mt-2 flex justify-end gap-2"><button onClick={()=>setEditing(false)} className="px-3 py-2 text-[10px]">Cancel</button><button onClick={saveEdit} className="rounded-lg bg-ink px-3 py-2 text-[10px] font-semibold text-white">Save edit</button></div></div> : <p className="my-3 whitespace-pre-wrap text-[12px] leading-[1.8] text-[#515666]">{post.body}</p>}
    {post.image_url && <img src={post.image_url} alt="Post attachment" className="max-h-[380px] w-full rounded-xl object-cover"/>}
    <div className="mt-3 flex items-center justify-between border-b border-[#f0f1f3] pb-3 text-[10px] text-slate-400"><span>{post.likes} likes</span><button onClick={toggleComments}>{post.commentsCount} comments</button></div>
    <div className="flex gap-1 pt-2"><button onClick={toggleLike} className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-[11px] font-semibold hover:bg-slate-50 ${post.liked?'text-[#d87866]':'text-slate-500'}`}><Heart size={15} fill={post.liked?'currentColor':'none'}/>{post.liked?'Liked':'Like'}</button><button onClick={toggleComments} className="flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-[11px] font-semibold text-slate-500 hover:bg-slate-50"><MessageCircle size={15}/>Comment</button></div>
    {showComments&&<div className="mt-2 border-t border-slate-100 pt-3">{commentsError&&<ErrorBanner message={commentsError}/>}<div className="space-y-3">{comments.map(item=><div key={item.id} className="flex gap-2"><Avatar profile={item.author} size="h-7 w-7"/><p className="flex-1 rounded-xl bg-[#f6f7f9] px-3 py-2 text-[11px]"><strong>{item.author?.full_name || item.author?.username || 'Member'}</strong> {item.body}</p></div>)}</div><div className="mt-3 flex gap-2"><input value={comment} onChange={e=>setComment(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submitComment()} placeholder="Write a comment…" className="flex-1 rounded-xl bg-[#f6f7f9] px-3 py-2 text-[11px] outline-none"/><button onClick={submitComment} className="rounded-lg bg-ink px-3 text-white"><Send size={14}/></button></div></div>}
  </article>
}

function PostComposer({ userId, close, notify }) {
  const [body, setBody] = useState('')
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    if (!body.trim() && !file) { notify('Write a post or attach an image.'); return }
    setBusy(true)
    try { await createPost({ userId, body, imageFile: file }); notify('Post published to Supabase.'); close() }
    catch (error) { notify(`Could not create post: ${error.message}`) }
    finally { setBusy(false) }
  }
  return <Modal title="Create a post" close={close}><textarea autoFocus value={body} onChange={e=>setBody(e.target.value)} rows="5" placeholder="Share your thoughts…" className="w-full resize-none rounded-xl bg-[#f7f8fa] p-4 text-[13px] outline-none"/><label className="mt-3 flex cursor-pointer items-center gap-2 rounded-xl border border-slate-100 p-3 text-[11px] font-semibold text-slate-600"><Image size={16}/>Attach image<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={e=>setFile(e.target.files?.[0] ?? null)}/><span className="ml-auto text-slate-400">{file?.name}</span></label><div className="mt-5 flex justify-end gap-2"><button onClick={close} className="px-4 py-2 text-[11px] text-slate-500">Cancel</button><button disabled={busy} onClick={submit} className="rounded-xl bg-ink px-5 py-2.5 text-[11px] font-bold text-white disabled:opacity-60">{busy?'Publishing…':'Publish'}</button></div></Modal>
}

function VideoHub({ userId, query, openComposer, run }) {
  const [category, setCategory] = useState('All')
  const load = useCallback(() => fetchVideos(userId), [userId])
  const { data, loading, error, refresh } = useRemoteData(load, [load])
  const categories = ['All', ...new Set((data ?? []).map(video => video.category))]
  const videos = (data ?? []).filter(video => `${video.title} ${video.description} ${video.category} ${video.author?.full_name}`.toLowerCase().includes(query.toLowerCase())).filter(video => category === 'All' || video.category === category)
  return <div><div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><div className="mb-1 text-[10px] font-bold tracking-[.17em] text-[#b7893c]">WATCH. LEARN. SHARE.</div><h1 className="font-display text-[26px] font-bold">Video hub</h1><p className="mt-1 text-[12px] text-slate-500">Videos uploaded to your Supabase project.</p></div><button onClick={()=>openComposer('video')} className="flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-[12px] font-semibold text-white"><Upload size={15}/> Upload a video</button></div>
    {categories.length > 1&&<div className="mb-5 flex flex-wrap gap-2">{categories.map(item=><button key={item} onClick={()=>setCategory(item)} className={`rounded-full px-4 py-2 text-[11px] font-semibold ${category===item?'bg-[#e8bd62] text-ink':'border border-slate-200 bg-white text-slate-500'}`}>{item}</button>)}</div>}
    <QueryState loading={loading} error={error} empty={!videos.length&&<EmptyState title={query?'No matching videos.':'No videos available yet.'} text="Uploaded videos from your Supabase project will appear here." action="Upload a video" onAction={()=>openComposer('video')}/>}>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{videos.map(video=><VideoCard key={video.id} video={video} userId={userId} run={run} refresh={refresh}/>)}</div>
    </QueryState>
  </div>
}
function VideoCard({ video, userId, run, refresh }) {
  const [playing, setPlaying] = useState(false)
  const [comments, setComments] = useState([])
  const [showComments, setShowComments] = useState(false)
  const [comment, setComment] = useState('')
  const loadComments = async () => {
    if (showComments) { setShowComments(false); return }
    try { setComments(await fetchVideoComments(video.id)); setShowComments(true) }
    catch (error) { run(async () => { throw error }) }
  }
  const submitComment = async () => {
    if (!comment.trim()) return
    const saved = await run(() => createVideoComment(video.id, userId, comment), 'Comment posted.')
    if (!saved) return
    setComment('')
    try { setComments(await fetchVideoComments(video.id)) } catch (error) { run(async () => { throw error }) }
    refresh()
  }
  return <article className="overflow-hidden rounded-2xl border border-[#eceef1] bg-white"><div className="relative aspect-video bg-slate-100">{playing?<video src={video.video_url} controls autoPlay className="h-full w-full"/>:video.thumbnail_url?<button onClick={()=>setPlaying(true)} className="h-full w-full"><img src={video.thumbnail_url} alt="" className="h-full w-full object-cover"/><span className="absolute inset-0 grid place-items-center text-white"><span className="grid h-11 w-11 place-items-center rounded-full bg-black/60"><Play size={18} fill="currentColor"/></span></span></button>:<button onClick={()=>setPlaying(true)} className="grid h-full w-full place-items-center text-slate-500"><Play size={28}/></button>}</div><div className="p-4"><div className="flex items-start gap-3"><Avatar profile={video.author} size="h-9 w-9"/><div className="min-w-0 flex-1"><h2 className="line-clamp-2 text-[13px] font-bold">{video.title}</h2><p className="mt-1 text-[10px] text-slate-500">{video.author?.full_name || video.author?.username} · {video.category}</p><p className="mt-1 flex items-center gap-1 text-[10px] text-slate-400"><Eye size={12}/>{video.views} views · {new Date(video.created_at).toLocaleDateString()}</p></div></div><div className="mt-3 flex border-t border-slate-100 pt-2"><button onClick={()=>run(()=>toggleVideoLike(video.id,userId,video.liked),video.liked?'Like removed.':'Video liked.',refresh)} className="flex flex-1 items-center justify-center gap-2 py-2 text-[11px] font-semibold text-slate-500"><Heart size={15} fill={video.liked?'currentColor':'none'} className={video.liked?'text-[#d87866]':''}/>{video.liked?'Liked':'Like'} · {video.likes}</button><button onClick={loadComments} className="flex flex-1 items-center justify-center gap-2 py-2 text-[11px] font-semibold text-slate-500"><MessageCircle size={15}/>Comments · {video.commentsCount}</button></div>{showComments&&<div className="border-t border-slate-100 pt-3"><div className="space-y-2">{comments.map(item=><div key={item.id} className="flex gap-2"><Avatar profile={item.author} size="h-7 w-7"/><p className="flex-1 rounded-xl bg-[#f6f7f9] px-3 py-2 text-[11px]"><strong>{item.author?.full_name || item.author?.username}</strong> {item.body}</p></div>)}</div><div className="mt-3 flex gap-2"><input value={comment} onChange={e=>setComment(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submitComment()} placeholder="Write a comment…" className="flex-1 rounded-xl bg-[#f6f7f9] px-3 py-2 text-[11px] outline-none"/><button onClick={submitComment} className="rounded-lg bg-ink px-3 text-white"><Send size={14}/></button></div></div>}</div></article>
}
function MiniVideo({ video }) {
  return <Link to="/videos" className="mb-3 flex gap-3 rounded-xl p-2 text-left hover:bg-white"><div className="grid h-[76px] w-[118px] shrink-0 place-items-center overflow-hidden rounded-xl bg-[#f1f2f4] text-slate-400">{video.thumbnail_url?<img src={video.thumbnail_url} alt="" className="h-full w-full object-cover"/>:<Play size={18}/>}</div><div className="min-w-0 pt-1"><div className="line-clamp-2 text-[12px] font-bold">{video.title}</div><div className="mt-1 text-[10px] text-slate-500">{video.author?.full_name || video.author?.username}</div><div className="mt-1 text-[10px] text-slate-400">{video.views} views</div></div></Link>
}
function VideoComposer({ userId, close, notify }) {
  const [file, setFile] = useState(null)
  const [thumbnail, setThumbnail] = useState(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    if (!file || !title.trim() || !category.trim()) { notify('Choose a video and provide its title and category.'); return }
    setBusy(true)
    try { await uploadVideo({ userId, file, title, description, category, thumbnailFile: thumbnail }); notify('Video uploaded to Supabase Storage.'); close() }
    catch (error) { notify(`Could not upload video: ${error.message}`) }
    finally { setBusy(false) }
  }
  return <Modal title="Upload a video" close={close}><div className="space-y-3"><Field label="Title" value={title} onChange={setTitle}/><Field label="Category" value={category} onChange={setCategory}/><label className="block text-[11px] font-semibold text-slate-600">Description<textarea value={description} onChange={e=>setDescription(e.target.value)} rows="3" className="mt-2 block w-full rounded-xl border border-slate-200 px-3 py-3 text-[12px] font-normal outline-none"/></label><FileField label="Video file" accept="video/mp4,video/webm,video/quicktime" file={file} setFile={setFile}/><FileField label="Thumbnail (optional)" accept="image/jpeg,image/png,image/webp" file={thumbnail} setFile={setThumbnail}/></div><div className="mt-5 flex justify-end gap-2"><button onClick={close} className="px-4 py-2 text-[11px] text-slate-500">Cancel</button><button disabled={busy} onClick={submit} className="rounded-xl bg-ink px-5 py-2.5 text-[11px] font-bold text-white disabled:opacity-60">{busy?'Uploading…':'Upload'}</button></div></Modal>
}

function LearningHub({ userId, query, run }) {
  const [selected, setSelected] = useState(null)
  const load = useCallback(() => fetchCourses(userId), [userId])
  const { data: courses, loading, error, refresh } = useRemoteData(load, [load])
  const visible = (courses ?? []).filter(course => `${course.title} ${course.description} ${course.category} ${course.difficulty}`.toLowerCase().includes(query.toLowerCase()))
  return <div><div className="mb-7"><div className="mb-1 text-[10px] font-bold tracking-[.17em] text-[#b7893c]">YOUR NEXT CHAPTER</div><h1 className="font-display text-[26px] font-bold">Learning hub</h1><p className="mt-1 text-[12px] text-slate-500">Published courses from your Supabase database.</p></div>
    <QueryState loading={loading} error={error} empty={!visible.length&&<EmptyState title={query?'No matching courses.':'No published courses yet.'} text="Published courses will appear here when they are added to Supabase."/>}>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{visible.map(course=><article key={course.id} className="overflow-hidden rounded-2xl border border-[#eceef1] bg-white">
        {course.thumbnail_url?<img src={course.thumbnail_url} alt="" className="h-[150px] w-full object-cover"/>:<div className="grid h-[150px] place-items-center bg-[#f4eee1] text-[#af8945]"><BookOpen size={28}/></div>}
        <div className="p-4"><div className="text-[9px] font-bold tracking-[.14em] text-[#b7893c]">{course.category} · {course.difficulty}</div><h2 className="mt-1 font-display text-[15px] font-bold">{course.title}</h2><p className="mt-2 line-clamp-3 text-[11px] leading-5 text-slate-500">{course.description}</p><div className="mt-3 flex items-center gap-1 text-[10px] text-slate-400"><Play size={12}/>{course.lessonCount} lessons</div>
          <div className="mt-4 flex gap-2">{course.enrolled?<button onClick={()=>setSelected(course)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-[11px] font-bold">Open course</button>:<button onClick={()=>run(()=>enrollInCourse(course.id,userId),'You are enrolled.',refresh)} className="flex-1 rounded-xl bg-ink py-2.5 text-[11px] font-bold text-white">Enroll</button>}{course.enrolled&&<span className="self-center text-[10px] text-[#559381]">Enrolled</span>}</div>
        </div></article>)}</div>
    </QueryState>
    {selected&&<CourseViewer course={selected} userId={userId} close={()=>setSelected(null)} run={run}/>}
  </div>
}

function CourseViewer({ course, userId, close, run }) {
  const load = useCallback(async () => {
    const [modules, progress] = await Promise.all([fetchCourseLessons(course.id), fetchLessonProgress(userId)])
    return { modules, complete: new Set(progress.map(item=>item.lesson_id)) }
  }, [course.id, userId])
  const { data, loading, error, refresh } = useRemoteData(load, [load])
  return <Modal title={course.title} close={close} wide><QueryState loading={loading} error={error} empty={!data?.modules.length&&<EmptyState title="No lessons published." text="The instructor has not added lessons to this course yet."/>}>
    {data?.modules.map(module=><section key={module.id} className="mb-5"><h3 className="mb-2 font-display text-sm font-bold">{module.title}</h3>{module.lessons.map(lesson=><div key={lesson.id} className="mb-2 flex items-center gap-3 rounded-xl bg-[#f7f8fa] p-3"><div className="min-w-0 flex-1"><div className="text-[12px] font-semibold">{lesson.title}</div><div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">{lesson.duration_minutes} min{lesson.video_url&&<a href={lesson.video_url} target="_blank" rel="noreferrer" className="text-[#a97820]">Open lesson video</a>}{lesson.materials?.map((material,index)=><a key={index} href={material.url} target="_blank" rel="noreferrer" className="text-[#a97820]">{material.name || 'Material'}</a>)}</div></div>{data.complete.has(lesson.id)?<Check size={17} className="text-[#559381]"/>:<button onClick={()=>run(()=>completeLesson(lesson.id,userId),'Lesson marked complete.',refresh)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px]">Mark complete</button>}</div>)}</section>)}
  </QueryState></Modal>
}

function Communities({ userId, query, run }) {
  const [creating, setCreating] = useState(false)
  const [selected, setSelected] = useState(null)
  const load = useCallback(() => fetchCommunities(userId), [userId])
  const { data, loading, error, refresh } = useRemoteData(load, [load])
  const communities = (data ?? []).filter(community=>`${community.name} ${community.description} ${community.category}`.toLowerCase().includes(query.toLowerCase()))
  return <div><div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><div className="mb-1 text-[10px] font-bold tracking-[.17em] text-[#b7893c]">FIND YOUR PEOPLE</div><h1 className="font-display text-[26px] font-bold">Communities</h1><p className="mt-1 text-[12px] text-slate-500">Communities loaded from Supabase.</p></div><button onClick={()=>setCreating(true)} className="flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-[12px] font-semibold text-white"><Plus size={15}/> Create community</button></div>
    <QueryState loading={loading} error={error} empty={!communities.length&&<EmptyState title={query?'No matching communities.':'No public communities yet.'} text="Create a community or check back later." action="Create community" onAction={()=>setCreating(true)}/>}>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{communities.map(community=><article key={community.id} className="rounded-2xl border border-[#eceef1] bg-white p-5"><div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-[#e8ece8] text-[#64796c]"><Users size={22}/></div><div className="text-[9px] font-bold tracking-[.15em] text-[#b7893c]">{community.category}</div><h2 className="mt-1 font-display text-[16px] font-bold">{community.name}</h2><div className="mt-1 flex items-center gap-1 text-[10px] text-slate-400"><Users size={12}/>{community.memberCount} members</div><p className="mb-4 mt-3 min-h-[54px] text-[11px] leading-5 text-slate-500">{community.description}</p><div className="flex justify-between border-t border-slate-100 pt-3"><button onClick={()=>setSelected(community)} className="text-[10px] font-semibold text-slate-500">View discussions</button><button onClick={()=>run(()=>toggleCommunityMembership(community.id,userId,community.joined),community.joined?'You left the community.':'You joined the community.',refresh)} className={`rounded-lg px-3 py-2 text-[10px] font-bold ${community.joined?'bg-[#f2f3f5] text-slate-600':'bg-ink text-white'}`}>{community.joined?'Leave':'Join'}</button></div></article>)}</div>
    </QueryState>
    {creating&&<CommunityComposer userId={userId} close={()=>setCreating(false)} onCreated={refresh} notify={run}/>}
    {selected&&<CommunityViewer community={selected} userId={userId} close={()=>setSelected(null)} run={run}/>}
  </div>
}

function CommunityComposer({ userId, close, onCreated, notify }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const submit = async () => {
    if (!name.trim() || !category.trim()) { await notify(async()=>{throw new Error('Community name and category are required.')}); return }
    const saved=await notify(()=>createCommunity({userId,name,description,category}),'Community created.')
    if(!saved)return
    onCreated()
    close()
  }
  return <Modal title="Create a community" close={close}><div className="space-y-3"><Field label="Name" value={name} onChange={setName}/><Field label="Category" value={category} onChange={setCategory}/><label className="block text-[11px] font-semibold text-slate-600">Description<textarea value={description} onChange={e=>setDescription(e.target.value)} rows="3" className="mt-2 block w-full rounded-xl border border-slate-200 px-3 py-3 text-[12px] font-normal outline-none"/></label></div><div className="mt-5 flex justify-end gap-2"><button onClick={close} className="px-4 py-2 text-[11px] text-slate-500">Cancel</button><button onClick={submit} className="rounded-xl bg-ink px-5 py-2.5 text-[11px] font-bold text-white">Create</button></div></Modal>
}

function CommunityViewer({ community, userId, close, run }) {
  const [body, setBody] = useState('')
  const load = useCallback(()=>fetchCommunityPosts(community.id),[community.id])
  const { data: posts, loading, error, refresh } = useRemoteData(load,[load])
  const submit = async () => {
    if (!body.trim()) return
    await run(()=>createCommunityPost(community.id,userId,body),'Community post published.')
    setBody(''); refresh()
  }
  return <Modal title={community.name} close={close} wide>
    {community.joined&&<div className="mb-5 flex gap-2"><input value={body} onChange={e=>setBody(e.target.value)} placeholder="Start a discussion…" className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-[11px]"/><button onClick={submit} className="rounded-lg bg-ink px-3 text-white"><Send size={14}/></button></div>}
    <QueryState loading={loading} error={error} empty={!posts?.length&&<EmptyState title="No community posts yet." text="When members start discussions, they will appear here."/>}>{posts?.map(post=><div key={post.id} className="mb-3 rounded-xl bg-[#f7f8fa] p-3"><div className="flex items-center gap-2"><Avatar profile={post.author} size="h-7 w-7"/><span className="text-[11px] font-semibold">{post.author?.full_name || post.author?.username}</span><time className="ml-auto text-[10px] text-slate-400">{new Date(post.created_at).toLocaleString()}</time></div><p className="mt-2 whitespace-pre-wrap text-[12px]">{post.body}</p></div>)}</QueryState>
  </Modal>
}

function ProfilePage({ userId, profile, run }) {
  const load = useCallback(async()=>{
    const [posts,videos,courses,communities] = await Promise.all([
      fetchPosts(userId,{ownOnly:true}),fetchVideos(userId),fetchCourses(userId),fetchCommunities(userId),
    ])
    return {posts,videos:videos.filter(item=>item.author_id===userId),courses:courses.filter(item=>item.enrolled),communities:communities.filter(item=>item.joined)}
  },[userId])
  const {data,loading,error,refresh}=useRemoteData(load,[load])
  return <div className="mx-auto max-w-[900px]"><div className="overflow-hidden rounded-2xl border border-[#eceef1] bg-white"><div className="relative h-[170px] bg-gradient-to-r from-[#303e5a] via-[#758a82] to-[#d4b676] sm:h-[210px]">{profile.cover_url&&<img src={profile.cover_url} alt="" className="h-full w-full object-cover"/>}<Link to="/settings" className="absolute right-4 top-4 rounded-lg bg-white/90 px-3 py-2 text-[11px] font-semibold text-slate-700">Edit profile</Link></div><div className="px-5 pb-5 sm:px-8"><div className="-mt-12 flex items-end justify-between"><Avatar profile={profile} size="h-24 w-24 border-4 border-white text-2xl"/><div className="mb-1 flex gap-5 text-center">{[['Posts',data?.posts.length],['Videos',data?.videos.length],['Courses',data?.courses.length],['Communities',data?.communities.length]].map(([label,count])=><div key={label}><div className="font-display text-[16px] font-bold">{loading?'—':count}</div><div className="text-[10px] text-slate-500">{label}</div></div>)}</div></div><h1 className="mt-3 font-display text-[22px] font-bold">{profile.full_name}</h1><p className="text-[12px] text-slate-400">{profile.username ? `@${profile.username}` : profile.id}</p><p className="mt-3 max-w-[550px] whitespace-pre-wrap text-[12px] leading-6 text-slate-600">{profile.bio}</p></div></div>
    {error&&<ErrorBanner message={error}/>}
    <div className="mt-6"><SectionTitle title="Your posts"/>{!loading&&!error&&!data?.posts.length?<EmptyState title="No posts yet." text="Your posts will appear here."/>:data?.posts.map(post=><PostCard key={post.id} post={post} userId={userId} run={run} refresh={refresh}/>)}</div>
  </div>
}

function Notifications({ userId, onRead, run }) {
  const load=useCallback(()=>fetchNotifications(userId),[userId])
  const {data,loading,error,refresh}=useRemoteData(load,[load])
  const readOne=async id=>{await run(()=>markNotificationRead(id,userId),'Notification marked as read.',refresh);onRead()}
  const readAll=async()=>{await run(()=>markAllNotificationsRead(userId),'All notifications marked as read.',refresh);onRead()}
  return <div className="mx-auto max-w-[800px]"><div className="mb-6 flex items-end justify-between"><div><div className="mb-1 text-[10px] font-bold tracking-[.17em] text-[#b7893c]">STAY IN THE LOOP</div><h1 className="font-display text-[26px] font-bold">Notifications</h1></div>{data?.some(item=>!item.read_at)&&<button onClick={readAll} className="text-[11px] font-semibold text-[#a97820]">Mark all as read</button>}</div>
    <QueryState loading={loading} error={error} empty={!data?.length&&<EmptyState title="No notifications yet." text="Notifications created by activity in your Supabase project will appear here."/>}><div className="overflow-hidden rounded-2xl border border-[#eceef1] bg-white">{data?.map(item=><div key={item.id} className={`flex gap-3 border-b border-[#f0f1f3] p-4 last:border-0 ${!item.read_at?'bg-[#fffdf8]':''}`}><div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#e9eef8] text-[#7088bc]"><Bell size={17}/></div><div className="flex-1"><div className="text-[12px] font-bold">{item.message}</div><div className="mt-1 text-[10px] text-slate-400">{item.type} · {new Date(item.created_at).toLocaleString()}</div></div>{!item.read_at&&<button aria-label="Mark as read" onClick={()=>readOne(item.id)} className="h-2 w-2 self-start rounded-full bg-[#e8b44e]"/>}</div>)}</div></QueryState>
  </div>
}

function SettingsPage({ userId, profile, email, onSignOut, run }) {
  const [name,setName]=useState(profile.full_name || '')
  const [bio,setBio]=useState(profile.bio || '')
  const [password,setPassword]=useState('')
  const [confirm,setConfirm]=useState('')
  const [avatarFile,setAvatarFile]=useState(null)
  const save = async()=>{
    await run(async()=>{
      if(avatarFile){
        const ext=avatarFile.name.split('.').pop()?.toLowerCase()||'jpg'
        const path=`${userId}/${createStorageId()}.${ext}`
        const {error:uploadError}=await supabase.storage.from('avatars').upload(path,avatarFile,{contentType:avatarFile.type})
        if(uploadError)throw uploadError
        const avatarUrl=supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
        const {error}=await updateProfile(userId,{full_name:name,bio,avatar_url:avatarUrl})
        if(error)throw error
      }else await updateProfile(userId,{full_name:name,bio})
    },'Profile updated.')
  }
  const changePassword=async()=>{
    if(password.length<8){await run(async()=>{throw new Error('Password must contain at least 8 characters.')});return}
    if(password!==confirm){await run(async()=>{throw new Error('Passwords do not match.')});return}
    const saved=await run(async()=>{const {error}=await supabase.auth.updateUser({password});if(error)throw error},'Password updated.')
    if(saved){setPassword('');setConfirm('')}
  }
  return <div className="mx-auto max-w-[850px]"><div className="mb-7"><div className="mb-1 text-[10px] font-bold tracking-[.17em] text-[#b7893c]">ACCOUNT SETTINGS</div><h1 className="font-display text-[26px] font-bold">Settings</h1></div>
    <section className="rounded-2xl border border-[#eceef1] bg-white p-5 sm:p-6"><h2 className="font-display text-[15px] font-bold">Personal information</h2><p className="mt-1 text-[11px] text-slate-500">Saved directly to your Supabase profile.</p><div className="my-5 flex items-center gap-4"><Avatar profile={profile} size="h-14 w-14"/><label className="cursor-pointer rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-semibold">Choose avatar<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e=>setAvatarFile(e.target.files?.[0]??null)}/></label>{avatarFile&&<span className="text-[10px] text-slate-500">{avatarFile.name}</span>}</div><div className="grid gap-4 sm:grid-cols-2"><Field label="Full name" value={name} onChange={setName}/><Field label="Account email" value={email||''} onChange={()=>{}} disabled/></div><label className="mt-4 block text-[11px] font-semibold text-slate-600">Bio<textarea value={bio} onChange={e=>setBio(e.target.value)} rows="3" className="mt-2 block w-full rounded-lg border border-slate-200 px-3 py-2.5 text-[12px] font-normal outline-none"/></label><button onClick={save} className="mt-4 rounded-lg bg-ink px-4 py-2.5 text-[11px] font-bold text-white">Save profile</button></section>
    <section className="mt-4 rounded-2xl border border-[#eceef1] bg-white p-5 sm:p-6"><h2 className="font-display text-[14px] font-bold">Password and security</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><Field label="New password" type="password" value={password} onChange={setPassword}/><Field label="Confirm password" type="password" value={confirm} onChange={setConfirm}/></div><button onClick={changePassword} className="mt-4 rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-semibold">Update password</button></section>
    <section className="mt-4 flex items-center justify-between rounded-2xl border border-[#eceef1] bg-white p-5"><div><h2 className="font-display text-[14px] font-bold">Sign out</h2><p className="mt-1 text-[11px] text-slate-500">End your Supabase session on this device.</p></div><button onClick={onSignOut} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-semibold"><LogOut size={14}/>Sign out</button></section>
  </div>
}

function AdminDashboard() {
  const overview=useCallback(()=>fetchAdminOverview(),[])
  const reports=useCallback(()=>fetchReports(),[])
  const {data:stats,loading,error}=useRemoteData(overview,[overview])
  const {data:items,loading:reportLoading,error:reportError,refresh}=useRemoteData(reports,[reports])
  return <div><div className="mb-7"><div className="mb-1 text-[10px] font-bold tracking-[.17em] text-[#b7893c]">PLATFORM MANAGEMENT</div><h1 className="font-display text-[26px] font-bold">Admin dashboard</h1><p className="mt-1 text-[12px] text-slate-500">Counts and reports queried from Supabase.</p></div>
    <QueryState loading={loading} error={error}>{stats&&<div className="mb-7 grid grid-cols-2 gap-3 lg:grid-cols-5">{Object.entries(stats).map(([label,count])=><div key={label} className="rounded-2xl border border-slate-100 bg-white p-5"><div className="text-[11px] capitalize text-slate-500">{label}</div><div className="mt-2 font-display text-[23px] font-bold">{count}</div></div>)}</div>}</QueryState>
    <SectionTitle title="User reports"/>
    <QueryState loading={reportLoading} error={reportError} empty={!items?.length&&<EmptyState title="No reports yet." text="Reports submitted by members will be listed here."/>}>
      <div className="overflow-hidden rounded-2xl border border-[#eceef1] bg-white">{items?.map(report=><div key={report.id} className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4 last:border-0"><div className="min-w-0 flex-1"><div className="text-[11px] font-semibold capitalize">{report.content_type} · {report.status}</div><p className="mt-1 text-[11px] text-slate-500">{report.reason}</p><time className="mt-1 block text-[10px] text-slate-400">{new Date(report.created_at).toLocaleString()}</time></div><select aria-label="Report status" value={report.status} onChange={e=>run(()=>updateReport(report.id,e.target.value),'Report updated.',refresh)} className="rounded-lg border border-slate-200 px-2 py-2 text-[10px]"><option value="open">Open</option><option value="reviewing">Reviewing</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option></select></div>)}</div>
    </QueryState>
  </div>
}

function AccessDenied() {
  return <div className="mx-auto max-w-[520px] rounded-2xl border border-slate-200 bg-white p-8 text-center"><div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-[#fcebe7] text-[#bd6c55]"><Shield size={22}/></div><h1 className="font-display text-xl font-bold">Admin access required</h1><p className="mt-2 text-sm text-slate-500">Your Supabase profile does not have the admin role.</p><Link to="/" className="mt-5 inline-block rounded-lg bg-ink px-4 py-2.5 text-xs font-semibold text-white">Back to Gather</Link></div>
}

function Modal({ title, close, wide = false, children }) {
  return <div className="modal-backdrop fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onMouseDown={event=>event.target===event.currentTarget&&close()}><section role="dialog" aria-modal="true" aria-label={title} className={`max-h-[90vh] w-full overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6 ${wide?'max-w-[720px]':'max-w-[520px]'}`}><div className="mb-5 flex items-start justify-between"><h2 className="font-display text-[17px] font-bold">{title}</h2><button aria-label="Close dialog" onClick={close} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X size={18}/></button></div>{children}</section></div>
}
function Field({ label, value, onChange, type = 'text', disabled = false }) {
  return <label className="block text-[11px] font-semibold text-slate-600">{label}<input type={type} value={value} disabled={disabled} onChange={event=>onChange(event.target.value)} className="mt-2 block w-full rounded-lg border border-slate-200 px-3 py-2.5 text-[12px] font-normal outline-none focus:border-[#d7b86d] disabled:bg-slate-50 disabled:text-slate-500"/></label>
}
function FileField({ label, accept, file, setFile }) {
  return <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 p-4 text-[11px] font-semibold text-slate-600"><Upload size={15}/>{label}<input type="file" accept={accept} className="hidden" onChange={event=>setFile(event.target.files?.[0]??null)}/><span className="ml-auto truncate text-[10px] font-normal text-slate-400">{file?.name||'Choose file'}</span></label>
}

export default App
