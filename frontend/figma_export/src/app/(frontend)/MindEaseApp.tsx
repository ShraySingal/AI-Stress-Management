'use client'

import {
  CSSProperties,
  Dispatch,
  ReactNode,
  SetStateAction,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react'
import type { BetaData, BetaHabit } from '@/lib/mindease-types'
import {
  deleteWellnessDataAction,
  saveAssessmentAction,
  saveCheckInAction,
  saveHealthRecordAction,
  setHabitCompletionAction,
  signInAction,
  signOutAction,
  signUpAction,
  updateProfileAction,
} from './actions'
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Bell,
  BookHeart,
  Brain,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  CloudSun,
  Download,
  Droplets,
  Dumbbell,
  Eye,
  EyeOff,
  Footprints,
  Heart,
  HeartHandshake,
  Home,
  Leaf,
  Lock,
  LogOut,
  MessageCircle,
  Moon,
  MoreHorizontal,
  Pause,
  Phone,
  Play,
  Plus,
  RefreshCw,
  Send,
  Settings,
  Shield,
  Sparkles,
  Sun,
  Target,
  Trash2,
  User,
  Watch,
  Wind,
  X,
  Zap,
} from 'lucide-react'

type Screen =
  | 'splash'
  | 'onboarding'
  | 'signin'
  | 'home'
  | 'checkin'
  | 'assessment'
  | 'prediction'
  | 'insights'
  | 'chat'
  | 'breathing'
  | 'recommendations'
  | 'habits'
  | 'wearables'
  | 'support'
  | 'privacy'
  | 'profile'

type Mood = 'Very Happy' | 'Calm' | 'Neutral' | 'Anxious' | 'Sad'
type Habit = BetaHabit & { icon: typeof Moon }
type Message = { from: 'user' | 'assistant'; text: string }
type PrivacySettings = { mood: boolean; wearable: boolean; chat: boolean }
type ProfileSettings = {
  name: string
  notifications: boolean
  largeText: boolean
  reminder: string
  goal: string
}
type HealthRecord = BetaData['healthRecords'][number]
type HabitLog = BetaData['habitLogs'][number]

const INITIAL_CHAT_MESSAGES: Message[] = [
  {
    from: 'assistant',
    text: 'Hi Alex. I’m here to support you. I noticed you logged feeling anxious today. What would feel most helpful right now?',
  },
]

const DEFAULT_PROFILE_SETTINGS: ProfileSettings = {
  name: 'Alex Kumar',
  notifications: true,
  largeText: false,
  reminder: '20:30',
  goal: 'Build a calmer daily routine',
}

const moodIcons: Record<Mood, string> = {
  'Very Happy': '😊',
  Calm: '😌',
  Neutral: '😐',
  Anxious: '😟',
  Sad: '😔',
}

const screensWithNav: Screen[] = ['home', 'checkin', 'insights', 'chat', 'profile']
const navItems: { screen: Screen; label: string; icon: typeof Home }[] = [
  { screen: 'home', label: 'Home', icon: Home },
  { screen: 'checkin', label: 'Check-In', icon: Heart },
  { screen: 'insights', label: 'Insights', icon: BarChart3 },
  { screen: 'chat', label: 'AI Support', icon: MessageCircle },
  { screen: 'profile', label: 'Profile', icon: User },
]

const cx = (...classes: (string | false | undefined)[]) => classes.filter(Boolean).join(' ')
const riskCategory = (value: number) => (value >= 75 ? 'High' : value >= 45 ? 'Moderate' : 'Low')
const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'ME'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}
const getRecentDayKeys = (todayKey: string, count: number) => {
  const today = new Date(`${todayKey}T00:00:00.000Z`)
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(today)
    date.setUTCDate(today.getUTCDate() - (count - index - 1))
    return date.toISOString().slice(0, 10)
  })
}
const getHabitStreak = (logs: HabitLog[], kind: BetaHabit['kind'], todayKey: string) => {
  const completed = new Set(
    logs.filter((log) => log.habitKind === kind).map((log) => log.completedOn),
  )
  let cursor = new Date(`${todayKey}T00:00:00.000Z`)
  if (!completed.has(todayKey)) cursor.setUTCDate(cursor.getUTCDate() - 1)
  let streak = 0
  while (completed.has(cursor.toISOString().slice(0, 10))) {
    streak += 1
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }
  return streak
}

function Button({
  children,
  onClick,
  variant = 'primary',
  className,
  disabled,
  type = 'button',
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  className?: string
  disabled?: boolean
  type?: 'button' | 'submit'
}) {
  return (
    <button
      type={type}
      className={cx('button', `button-${variant}`, className)}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

function Card({
  children,
  className,
  onClick,
}: {
  children: ReactNode
  className?: string
  onClick?: () => void
}) {
  return (
    <div
      className={cx('card', onClick && 'card-clickable', className)}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onClick()
              }
            }
          : undefined
      }
    >
      {children}
    </div>
  )
}

function Header({
  title,
  subtitle,
  back,
  action,
}: {
  title: string
  subtitle?: string
  back?: () => void
  action?: ReactNode
}) {
  return (
    <div className="page-header">
      <div className="header-side">
        {back ? (
          <button className="icon-button" onClick={back} aria-label="Go back">
            <ArrowLeft size={20} />
          </button>
        ) : null}
      </div>
      <div className="header-copy">
        <div className="title-md" role="heading" aria-level={1}>
          {title}
        </div>
        {subtitle ? <div className="caption">{subtitle}</div> : null}
      </div>
      <div className="header-side header-action">{action}</div>
    </div>
  )
}

function ProgressRing({
  value,
  size = 132,
  label = 'Moderate',
}: {
  value: number
  size?: number
  label?: string
}) {
  const r = 43
  const circumference = 2 * Math.PI * r
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" aria-label={`${value} out of 100, ${label}`}>
        <circle className="ring-track" cx="50" cy="50" r={r} />
        <circle
          className="ring-value"
          cx="50"
          cy="50"
          r={r}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - value / 100)}
        />
      </svg>
      <div className="ring-copy">
        <strong>{value}</strong>
        <span>/100</span>
        <small>{label}</small>
      </div>
    </div>
  )
}

function LineChart({
  values,
  labels,
  compact = false,
}: {
  values: number[]
  labels: string[]
  compact?: boolean
}) {
  const width = 320
  const height = compact ? 92 : 150
  const pad = compact ? 10 : 28
  const max = Math.max(...values, 80)
  const points = values
    .map((value, i) => {
      const x = pad + (i * (width - pad * 2)) / Math.max(values.length - 1, 1)
      const y = height - pad - (value / max) * (height - pad * 1.5)
      return `${x},${y}`
    })
    .join(' ')
  return (
    <div className={cx('chart-wrap', compact && 'chart-compact')}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Stress trend line chart">
        <title>Stress trend over time</title>
        {!compact &&
          [25, 50, 75].map((line) => (
            <line
              key={line}
              x1="28"
              x2="310"
              y1={height - 28 - line}
              y2={height - 28 - line}
              className="grid-line"
            />
          ))}
        <polyline points={points} className="chart-area" />
        <polyline points={points} className="chart-line" />
        {values.map((value, i) => {
          const [x, y] = points.split(' ')[i].split(',')
          return <circle key={`${value}-${i}`} cx={x} cy={y} r="3.5" className="chart-dot" />
        })}
      </svg>
      <div className="chart-labels">
        {labels.map((label, index) => (
          <span key={`${label}-${index}`}>{label}</span>
        ))}
      </div>
    </div>
  )
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: () => void
  label: string
}) {
  return (
    <button
      className={cx('toggle', checked && 'active')}
      onClick={onChange}
      aria-label={label}
      aria-pressed={checked}
    >
      <span />
    </button>
  )
}

function Toast({ message }: { message: string }) {
  return (
    <div className="toast" role="status" aria-live="polite">
      <Check size={16} />
      {message}
    </div>
  )
}

function Splash() {
  return (
    <div className="splash">
      <div className="brand-mark large">
        <span />
        <span />
        <span />
        <span />
        <div />
      </div>
      <div className="display">MindEase</div>
      <div className="splash-subtitle">Understand your feelings. Find your balance.</div>
      <div className="loading-dots">
        <span />
        <span />
        <span />
      </div>
    </div>
  )
}

function Onboarding({ onDone }: { onDone: () => void }) {
  const [slide, setSlide] = useState(0)
  const slides = [
    {
      icon: Heart,
      eyebrow: 'Daily awareness',
      title: 'Understand your emotions',
      text: 'Build self-awareness through thoughtful daily mood check-ins that take less than two minutes.',
      art: 'mood-art',
    },
    {
      icon: Brain,
      eyebrow: 'Intelligent insights',
      title: 'Discover stress patterns',
      text: 'See how sleep, activity, workload, and mood may connect to your wellbeing over time.',
      art: 'insight-art',
    },
    {
      icon: Leaf,
      eyebrow: 'Personal growth',
      title: 'Build healthier habits',
      text: 'Turn your patterns into small, personalized actions that support a more balanced day.',
      art: 'habit-art',
    },
  ]
  const item = slides[slide]
  const Icon = item.icon
  return (
    <div className="onboarding">
      <div className="onboarding-top">
        <div className="mini-brand">
          <Sparkles size={18} /> MindEase
        </div>
        <button className="text-button" onClick={onDone}>
          Skip
        </button>
      </div>
      <div className={cx('onboarding-art', item.art)}>
        <div className="orb orb-one" />
        <div className="orb orb-two" />
        <div className="art-card">
          <Icon size={48} strokeWidth={1.6} />
          <div className="art-lines">
            <span />
            <span />
            <span />
          </div>
        </div>
      </div>
      <div className="onboarding-copy">
        <div className="eyebrow">{item.eyebrow}</div>
        <div className="title-xl">{item.title}</div>
        <div className="body">{item.text}</div>
      </div>
      <div className="onboarding-bottom">
        <div className="dots">
          {slides.map((_, i) => (
            <span key={i} className={cx(i === slide && 'active')} />
          ))}
        </div>
        <Button onClick={() => (slide < 2 ? setSlide(slide + 1) : onDone())}>
          {slide === 2 ? 'Get Started' : 'Next'} <ChevronRight size={18} />
        </Button>
      </div>
    </div>
  )
}

function SignIn({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [show, setShow] = useState(false)
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [feedback, setFeedback] = useState('')
  const [pending, startTransition] = useTransition()
  const submit = () => {
    if (!email.trim() || !email.includes('@')) {
      setFeedback('Enter a valid email address to continue.')
      return
    }
    if (password.length < 8) {
      setFeedback('Use at least 8 characters for your password.')
      return
    }
    if (mode === 'signup' && name.trim().length < 2) {
      setFeedback('Enter your name to create an account.')
      return
    }
    startTransition(async () => {
      setFeedback('')
      try {
        const result =
          mode === 'signup'
            ? await signUpAction({ name, email, password })
            : await signInAction({ email, password })
        if (!result.ok) {
          setFeedback(result.message || 'Unable to continue.')
          return
        }
        onAuthenticated()
      } catch {
        setFeedback('The server took too long to respond. Please try again.')
      }
    })
  }
  return (
    <div className="auth-page">
      <div className="auth-brand">
        <div className="brand-mark">
          <span />
          <span />
          <span />
          <span />
          <div />
        </div>
        <div>
          <div className="title-lg">
            {mode === 'signup' ? 'Create your account' : 'Welcome to MindEase'}
          </div>
          <div className="body-sm">
            {mode === 'signup' ? 'Start a private wellness space.' : 'Your calmer days start here.'}
          </div>
        </div>
      </div>
      <form
        className="auth-form"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        {mode === 'signup' && (
          <>
            <label className="field-label" htmlFor="signup-name">
              Name
            </label>
            <input
              id="signup-name"
              className="input"
              autoComplete="name"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </>
        )}
        <label className="field-label" htmlFor="signin-email">
          Email
        </label>
        <input
          id="signin-email"
          className="input"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={feedback.includes('email')}
        />
        <label className="field-label" htmlFor="signin-password">
          Password
        </label>
        <div className="input-with-action">
          <input
            id="signin-password"
            className="input"
            type={show ? 'text' : 'password'}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={feedback.includes('password')}
          />
          <button
            type="button"
            onClick={() => setShow(!show)}
            aria-label={show ? 'Hide password' : 'Show password'}
          >
            {show ? <EyeOff size={19} /> : <Eye size={19} />}
          </button>
        </div>
        {mode === 'signin' && (
          <button
            type="button"
            className="forgot"
            onClick={() =>
              setFeedback(
                'Password reset is not available in this beta. Contact the beta administrator for help.',
              )
            }
          >
            Forgot password?
          </button>
        )}
        {feedback && (
          <div className="auth-feedback" role="status">
            {feedback}
          </div>
        )}
        <Button type="submit" className="full" disabled={pending}>
          {pending ? 'Please wait…' : mode === 'signup' ? 'Create Account' : 'Sign In'}
        </Button>
        <div className="auth-footer">
          {mode === 'signup' ? 'Already have an account?' : 'New to MindEase?'}{' '}
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin')
              setFeedback('')
            }}
          >
            {mode === 'signup' ? 'Sign in' : 'Create account'}
          </button>
        </div>
      </form>
      <div className="demo-note">
        <Shield size={15} /> Private beta · Your entries are tied to your account.
      </div>
    </div>
  )
}

function HomeScreen({
  navigate,
  name,
  mood,
  stress,
  prediction,
  habitsDone,
  health,
  stressHistory = [],
  hasWellnessData,
  checkedInToday,
  hasAssessment,
}: {
  navigate: (screen: Screen) => void
  name: string
  mood: Mood
  stress: number
  prediction: number
  habitsDone: number
  health?: HealthRecord
  stressHistory?: number[]
  hasWellnessData: boolean
  checkedInToday: boolean
  hasAssessment: boolean
}) {
  const [todayLabel, setTodayLabel] = useState('TODAY')
  const sleepHours = health?.sleepMinutes ? Math.floor(health.sleepMinutes / 60) : null
  const sleepRemainder = health?.sleepMinutes ? health.sleepMinutes % 60 : null
  const trendValues = stressHistory.length ? stressHistory : [stress]
  const initials = getInitials(name)
  useEffect(() => {
    setTodayLabel(
      new Intl.DateTimeFormat(undefined, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
        .format(new Date())
        .toUpperCase(),
    )
  }, [])
  return (
    <div className="page home-page">
      <div className="home-top">
        <div>
          <div className="caption">{todayLabel}</div>
          <div className="title-lg">Good morning, {name.split(' ')[0] || 'Alex'}.</div>
        </div>
        <button className="avatar" onClick={() => navigate('profile')} aria-label="Open profile">
          {initials}
          <span />
        </button>
      </div>
      {checkedInToday ? (
        <Card className="daily-complete-card">
          <div className="daily-complete-icon">
            <Check size={22} />
          </div>
          <div className="grow">
            <div className="eyebrow">TODAY&apos;S CHECK-IN</div>
            <div className="title-md">You&apos;re all checked in</div>
            <div className="body-sm">Come back tomorrow for your next daily check-in.</div>
          </div>
          <button className="text-button" onClick={() => navigate('insights')}>
            View insights
          </button>
        </Card>
      ) : (
        <Card className="hero-card">
          <div className="hero-copy">
            <div className="eyebrow light">DAILY CHECK-IN</div>
            <div className="title-lg">How are you feeling today?</div>
            <div className="body-sm light">A small pause can make a meaningful difference.</div>
            <Button variant="secondary" onClick={() => navigate('checkin')}>
              <Heart size={17} /> Check In
            </Button>
          </div>
          <div className="hero-flower">
            <span />
            <span />
            <span />
            <span />
            <div />
          </div>
        </Card>
      )}
      <div className="section-heading">
        <div>
          <div className="title-sm">Your wellness outlook</div>
          <div className="caption">
            {hasWellnessData ? 'Based on your saved entries' : 'Complete a check-in to begin'}
          </div>
        </div>
        {hasWellnessData && (
          <button className="text-button" onClick={() => navigate('prediction')}>
            Details
          </button>
        )}
      </div>
      {hasWellnessData ? (
        <Card className="outlook-card" onClick={() => navigate('prediction')}>
          <ProgressRing value={prediction} size={122} label={riskCategory(prediction)} />
          <div className="outlook-copy">
            <div className="caption">TOMORROW&apos;S OUTLOOK</div>
            <div className="title-md">
              {prediction}% {riskCategory(prediction).toLowerCase()} risk
            </div>
            <div className="body-sm">Calculated from your latest wellbeing entries.</div>
            <div className="trend-pill">
              <Activity size={14} /> Latest stress: {stress}/100
            </div>
          </div>
          <ChevronRight size={18} className="card-chevron" />
        </Card>
      ) : (
        <Card className="outlook-empty">
          <div className="outlook-empty-icon">
            <Brain size={24} />
          </div>
          <div className="grow">
            <div className="title-sm">No outlook yet</div>
            <div className="body-sm">
              MindEase needs your first check-in before it can calculate a wellness outlook.
            </div>
          </div>
          <Button onClick={() => navigate('checkin')}>Start check-in</Button>
        </Card>
      )}
      <div className="stat-grid">
        <Card>
          <div className="stat-icon mood">{hasWellnessData ? moodIcons[mood] : '—'}</div>
          <div className="caption">MOOD</div>
          <div className="title-sm">{hasWellnessData ? mood : 'Not logged'}</div>
          <div className="microcopy">{hasWellnessData ? 'Latest check-in' : 'Check in to add'}</div>
        </Card>
        <Card>
          <div className="stat-icon sleep">
            <Moon size={18} />
          </div>
          <div className="caption">SLEEP</div>
          <div className="title-sm">
            {sleepHours === null ? 'Not logged' : `${sleepHours}h ${sleepRemainder}m`}
          </div>
          <div className="microcopy amber">
            {health ? 'Latest health entry' : 'Add health data'}
          </div>
        </Card>
        <Card>
          <div className="stat-icon steps">
            <Footprints size={18} />
          </div>
          <div className="caption">ACTIVITY</div>
          <div className="title-sm">
            {health?.steps === null || health?.steps === undefined
              ? 'Not logged'
              : health.steps.toLocaleString('en-US')}
          </div>
          <div className="microcopy">
            {health?.activeMinutes
              ? `${health.activeMinutes} active min`
              : `${habitsDone}/5 habits done`}
          </div>
        </Card>
      </div>
      <div className="section-heading">
        <div className="title-sm">Recommended for you</div>
        <button className="text-button" onClick={() => navigate('recommendations')}>
          See all
        </button>
      </div>
      <Card className="recommendation-feature">
        <div className="recommend-icon">
          <Wind size={23} />
        </div>
        <div className="grow">
          <div className="title-sm">Reset with calm breathing</div>
          <div className="body-sm">A short guided pause for a busy morning.</div>
          <div className="duration">
            <Clock3 size={13} /> 5 min
          </div>
        </div>
        <button
          className="round-play"
          onClick={() => navigate('breathing')}
          aria-label="Start breathing"
        >
          <Play size={18} fill="currentColor" />
        </button>
      </Card>
      {hasWellnessData && (
        <>
          <div className="section-heading">
            <div>
              <div className="title-sm">Stress trend</div>
              <div className="caption">Your saved check-ins</div>
            </div>
            <button className="text-button" onClick={() => navigate('insights')}>
              Explore
            </button>
          </div>
          <Card>
            <LineChart
              compact
              values={trendValues}
              labels={trendValues.map((_, index) =>
                index === trendValues.length - 1 ? 'Now' : `${index + 1}`,
              )}
            />
          </Card>
        </>
      )}
      <div className="section-heading">
        <div className="title-sm">Quick actions</div>
      </div>
      <div className="quick-grid">
        {[
          {
            label: hasAssessment ? 'Stress result' : 'Assessment',
            icon: Brain,
            to: (hasAssessment ? 'prediction' : 'assessment') as Screen,
          },
          { label: 'Breathing', icon: Wind, to: 'breathing' as Screen },
          { label: 'Habits', icon: Target, to: 'habits' as Screen },
          { label: 'Health data', icon: Watch, to: 'wearables' as Screen },
        ].map((item) => (
          <button key={item.label} className="quick-action" onClick={() => navigate(item.to)}>
            <span>
              <item.icon size={21} />
            </span>
            {item.label}
          </button>
        ))}
      </div>
      <button className="support-banner" onClick={() => navigate('support')}>
        <HeartHandshake size={20} />
        <span>
          <strong>Need support?</strong>
          <small>Help and resources are always available.</small>
        </span>
        <ChevronRight size={18} />
      </button>
    </div>
  )
}

function CheckInScreen({
  initialMood,
  onSave,
  navigate,
  completedToday,
  assessmentCompleted,
}: {
  initialMood: Mood
  onSave: (data: {
    mood: Mood
    stress: number
    sleep: number
    energy: number
    tags: string[]
    note: string
  }) => void
  navigate: (s: Screen) => void
  completedToday: boolean
  assessmentCompleted: boolean
}) {
  const [mood, setMood] = useState<Mood | null>(initialMood)
  const [stress, setStress] = useState(6)
  const [sleep, setSleep] = useState(2)
  const [energy, setEnergy] = useState(2)
  const [tags, setTags] = useState<string[]>(['Study'])
  const [note, setNote] = useState('')
  const [checkInTime, setCheckInTime] = useState('TODAY')
  useEffect(() => {
    setCheckInTime(
      new Intl.DateTimeFormat(undefined, {
        weekday: 'long',
        hour: 'numeric',
        minute: '2-digit',
      })
        .format(new Date())
        .toUpperCase(),
    )
  }, [])
  const toggleTag = (tag: string) =>
    setTags(tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag])
  if (completedToday) {
    const nextActions = [
      {
        title: assessmentCompleted ? 'Stress result' : 'Stress assessment',
        description: assessmentCompleted
          ? 'Review your latest saved assessment'
          : 'Review your current stress level',
        icon: Brain,
        screen: (assessmentCompleted ? 'prediction' : 'assessment') as Screen,
      },
      {
        title: 'Guided breathing',
        description: 'Take a one, three, or five minute pause',
        icon: Wind,
        screen: 'breathing' as Screen,
      },
      {
        title: 'Habits & sleep routine',
        description: 'Track habits, bedtime routine, and real streaks',
        icon: Target,
        screen: 'habits' as Screen,
      },
      {
        title: 'Recommendations',
        description: 'Continue your personalized action plan',
        icon: Sparkles,
        screen: 'recommendations' as Screen,
      },
      {
        title: 'Health & activity',
        description: 'Preview the future phone health update',
        icon: Watch,
        screen: 'wearables' as Screen,
      },
      {
        title: 'AI support',
        description: 'Open the private guided companion',
        icon: MessageCircle,
        screen: 'chat' as Screen,
      },
    ]
    return (
      <div className="page">
        <Header title="Daily Check-In" subtitle="Today’s entry is saved" />
        <div className="daily-checkin-complete">
          <Card className="checkin-success-card">
            <div className="completion-icon">
              <Check size={27} />
            </div>
            <div>
              <div className="title-md">You&apos;re checked in for today</div>
              <div className="body-sm">
                Your daily entry is saved. You can continue with any activity below.
              </div>
            </div>
          </Card>
          <div className="section-heading">
            <div>
              <div className="title-sm">Continue your wellness plan</div>
              <div className="caption">CHOOSE WHAT FEELS USEFUL NOW</div>
            </div>
          </div>
          <div className="daily-followup-grid">
            {nextActions.map((action) => (
              <button key={action.title} onClick={() => navigate(action.screen)}>
                <span>
                  <action.icon size={21} />
                </span>
                <strong>{action.title}</strong>
                <small>{action.description}</small>
                <ChevronRight size={16} />
              </button>
            ))}
          </div>
          <Button variant="secondary" className="full" onClick={() => navigate('home')}>
            Return home
          </Button>
        </div>
      </div>
    )
  }
  return (
    <div className="page">
      <Header title="Daily Check-In" subtitle="A moment just for you" />
      <div className="checkin-intro">
        <div className="eyebrow">{checkInTime}</div>
        <div className="title-lg">How are you feeling?</div>
        <div className="body-sm">There&apos;s no right or wrong answer.</div>
      </div>
      <div className="mood-row">
        {(Object.keys(moodIcons) as Mood[]).map((item) => (
          <button
            key={item}
            className={cx('mood-option', mood === item && 'selected')}
            onClick={() => setMood(item)}
            aria-pressed={mood === item}
          >
            <span>{moodIcons[item]}</span>
            <small>{item === 'Very Happy' ? 'Happy' : item}</small>
          </button>
        ))}
      </div>
      {mood && (
        <div className="form-stack reveal">
          <Card>
            <div className="field-heading">
              <span>Stress level</span>
              <strong>{stress}/10</strong>
            </div>
            <input
              className="range"
              type="range"
              min="1"
              max="10"
              value={stress}
              onChange={(e) => setStress(Number(e.target.value))}
              aria-label="Stress level from 1 to 10"
              aria-valuetext={`${stress} out of 10`}
            />
            <div className="range-labels">
              <span>Low</span>
              <span>High</span>
            </div>
          </Card>
          <Card>
            <div className="field-heading">
              <span>How did you sleep?</span>
            </div>
            <div className="rating-row">
              {['Poor', 'Okay', 'Good', 'Great'].map((label, i) => (
                <button
                  key={label}
                  className={cx(sleep === i && 'selected')}
                  onClick={() => setSleep(i)}
                  aria-pressed={sleep === i}
                >
                  {label}
                </button>
              ))}
            </div>
          </Card>
          <Card>
            <div className="field-heading">
              <span>Energy today</span>
              <strong>{['Very low', 'Low', 'Steady', 'High'][energy]}</strong>
            </div>
            <input
              className="range green"
              type="range"
              min="0"
              max="3"
              value={energy}
              onChange={(e) => setEnergy(Number(e.target.value))}
              aria-label="Energy level"
            />
          </Card>
          <div>
            <div className="field-heading">
              <span>What&apos;s shaping your day?</span>
              <small>Select all that apply</small>
            </div>
            <div className="tag-wrap">
              {['Study', 'Work', 'Family', 'Health', 'Social', 'Rest'].map((tag) => (
                <button
                  key={tag}
                  className={cx('tag', tags.includes(tag) && 'selected')}
                  onClick={() => toggleTag(tag)}
                  aria-pressed={tags.includes(tag)}
                >
                  {tags.includes(tag) && <Check size={14} />}
                  {tag}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="field-label" htmlFor="journal-note">
              Private journal note <span>Optional</span>
            </label>
            <textarea
              id="journal-note"
              className="textarea"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Anything else on your mind?"
              rows={4}
            />
            <div className="privacy-hint">
              <Lock size={13} /> Private to your signed-in account
            </div>
          </div>
          <Button
            className="full large-button"
            onClick={() => onSave({ mood, stress, sleep, energy, tags, note })}
          >
            <Check size={18} /> Save Check-In
          </Button>
          <Button variant="ghost" className="full" onClick={() => navigate('assessment')}>
            Take full stress assessment
          </Button>
        </div>
      )}
    </div>
  )
}

function AssessmentScreen({
  onSubmit,
  back,
}: {
  onSubmit: (answers: number[]) => void
  back: () => void
}) {
  const questions = [
    { q: 'How stressed do you feel today?', low: 'Very calm', high: 'Very stressed' },
    { q: 'How well did you sleep?', low: 'Very poorly', high: 'Restfully' },
    { q: 'How energetic do you feel?', low: 'Drained', high: 'Energized' },
    { q: 'How manageable was your workload?', low: 'Overwhelming', high: 'Manageable' },
    { q: 'How well could you concentrate today?', low: 'Not at all', high: 'Very well' },
  ]
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState([6, 4, 4, 3, 5])
  const q = questions[step]
  const update = (value: number) => setAnswers(answers.map((a, i) => (i === step ? value : a)))
  return (
    <div className="page assessment-page">
      <Header
        title="Stress Assessment"
        subtitle={`Question ${step + 1} of ${questions.length}`}
        back={step ? () => setStep(step - 1) : back}
      />
      <div className="progress-bar">
        <span style={{ width: `${((step + 1) / questions.length) * 100}%` }} />
      </div>
      <div className="assessment-content">
        <div className="question-number">0{step + 1}</div>
        <div className="title-lg">{q.q}</div>
        <div className="body">Choose the answer that feels closest to your experience.</div>
        <Card className="assessment-slider">
          <div className="assessment-value">{answers[step]}</div>
          <input
            className="range"
            type="range"
            min="1"
            max="10"
            value={answers[step]}
            onChange={(e) => update(Number(e.target.value))}
            aria-label={q.q}
            aria-valuetext={`${answers[step]} out of 10`}
          />
          <div className="range-labels">
            <span>{q.low}</span>
            <span>{q.high}</span>
          </div>
        </Card>
        <div className="radio-grid">
          {[1, 3, 5, 7, 10].map((n) => (
            <button
              key={n}
              className={cx(answers[step] === n && 'selected')}
              onClick={() => update(n)}
              aria-label={`Select ${n} out of 10`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      <div className="sticky-actions">
        {step > 0 && (
          <Button variant="secondary" onClick={() => setStep(step - 1)}>
            Back
          </Button>
        )}
        <Button className="grow" onClick={() => (step < 4 ? setStep(step + 1) : onSubmit(answers))}>
          {step < 4 ? 'Next question' : 'View my result'} <ChevronRight size={18} />
        </Button>
      </div>
    </div>
  )
}

function PredictionScreen({
  score,
  factors,
  back,
  navigate,
  checkInDays,
  historyScores,
}: {
  score: number
  factors: string[]
  back: () => void
  navigate: (s: Screen) => void
  checkInDays: number
  historyScores: number[]
}) {
  const [expanded, setExpanded] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [tomorrowLabel, setTomorrowLabel] = useState('Tomorrow')
  const category = riskCategory(score)
  useEffect(() => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    setTomorrowLabel(
      `Tomorrow, ${new Intl.DateTimeFormat(undefined, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }).format(tomorrow)}`,
    )
  }, [])
  return (
    <div className="page prediction-page">
      <Header
        title="Stress Outlook"
        subtitle={tomorrowLabel}
        back={back}
        action={
          <button
            className="icon-button"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Prediction options"
            aria-expanded={menuOpen}
          >
            <MoreHorizontal size={20} />
          </button>
        }
      />
      {menuOpen && (
        <div className="header-menu">
          <button
            onClick={() => {
              setExpanded(true)
              setMenuOpen(false)
            }}
          >
            View scoring explanation
          </button>
          <button onClick={() => navigate('assessment')}>Retake assessment</button>
        </div>
      )}
      <div className="prediction-hero">
        <div className="eyebrow">TOMORROW&apos;S ESTIMATE</div>
        <ProgressRing value={score} size={176} label={category} />
        <div className="title-md">{category} wellness risk</div>
        <div className="body-sm">
          A few small actions today may help tomorrow feel more manageable.
        </div>
      </div>
      <div className="disclaimer">
        <CircleHelp size={17} />
        <span>
          <strong>Transparent wellness estimate.</strong> This score uses rule-based calculations,
          not a trained ML model or medical prediction.
        </span>
      </div>
      <div className="section-heading">
        <div className="title-sm">7-day stress history</div>
        <div className="caption">
          {checkInDays >= 7 ? 'Saved check-ins' : 'BUILDING YOUR HISTORY'}
        </div>
      </div>
      {checkInDays >= 7 ? (
        <Card className="timeline-card">
          {historyScores
            .slice(0, 7)
            .reverse()
            .map((value, index, values) => (
              <div
                key={`${value}-${index}`}
                className={cx('timeline-day', index === values.length - 1 && 'active')}
              >
                <span>{index === values.length - 1 ? 'Today' : `Day ${index + 1}`}</span>
                <div className="timeline-bar">
                  <i style={{ height: `${value}%` }} />
                </div>
                <strong>{value}</strong>
              </div>
            ))}
        </Card>
      ) : (
        <Card className="history-progress-card">
          <div className="history-progress-copy">
            <strong>{checkInDays} of 7 days</strong>
            <span>Check in once per day to unlock your seven-day stress history.</span>
          </div>
          <div className="progress-bar">
            <span style={{ width: `${Math.min(100, (checkInDays / 7) * 100)}%` }} />
          </div>
          <div className="history-day-dots">
            {[0, 1, 2, 3, 4, 5, 6].map((day) => (
              <i key={day} className={day < checkInDays ? 'done' : ''}>
                {day + 1}
              </i>
            ))}
          </div>
        </Card>
      )}
      <div className="section-heading">
        <div className="title-sm">What may be contributing</div>
      </div>
      <div className="factor-list">
        {factors.map((factor, i) => {
          const icons = [Moon, CloudSun, BookHeart, Footprints]
          const Icon = icons[i % icons.length]
          return (
            <Card key={factor} className="factor-card">
              <span>
                <Icon size={19} />
              </span>
              <div className="grow">
                <div className="title-sm">{factor}</div>
                <div className="body-sm">
                  {
                    [
                      'Your latest sleep rating is below your preferred level',
                      'Your recent mood entries have shifted',
                      'Your latest check-in reports higher stress',
                      'No recent physical activity was recorded',
                    ][i % 4]
                  }
                </div>
              </div>
              <span className="impact">{i < 2 ? 'High' : 'Medium'}</span>
            </Card>
          )
        })}
      </div>
      <button className="explain-card" onClick={() => setExpanded(!expanded)}>
        <span>
          <Sparkles size={18} /> Why am I seeing this?
        </span>
        <ChevronDown size={18} className={cx(expanded && 'rotate')} />
        {expanded && (
          <p>
            This calculation starts at 27 points, adds 4 × the reported stress level, up to 15
            points for reduced sleep, up to 12 for low energy, a mood adjustment from −6 to +7, and
            either −3 or +4 points for physical activity. The result is limited to 28–88. It is
            transparent rule-based logic—not a trained or clinically validated model.
          </p>
        )}
      </button>
      <div className="section-heading">
        <div>
          <div className="title-sm">Your next 24 hours</div>
          <div className="caption">A gentle action plan</div>
        </div>
      </div>
      <Card className="plan-card">
        {[
          ['Now', 'Take 5 slow breaths', Wind],
          ['4:30 PM', 'Walk for 10 minutes', Footprints],
          ['10:30 PM', 'Begin bedtime wind-down', Moon],
        ].map(([time, label, Icon]) => (
          <button
            key={label as string}
            onClick={() =>
              label === 'Take 5 slow breaths' ? navigate('breathing') : navigate('recommendations')
            }
          >
            <span className="plan-icon">
              <Icon size={18} />
            </span>
            <span className="grow">
              <small>{time as string}</small>
              <strong>{label as string}</strong>
            </span>
            <ChevronRight size={17} />
          </button>
        ))}
      </Card>
      <div className="prediction-next">
        <div className="caption">NEXT IN YOUR WELLNESS PLAN</div>
        <Button className="full" onClick={() => navigate('recommendations')}>
          <Sparkles size={17} /> View personalized recommendations
        </Button>
      </div>
    </div>
  )
}

function InsightsScreen({
  mood,
  history,
  healthRecords = [],
  habitLogs,
  todayKey,
}: {
  mood: Mood
  history: { mood: Mood; stress: number; time: string }[]
  healthRecords?: HealthRecord[]
  habitLogs: HabitLog[]
  todayKey: string
}) {
  const [range, setRange] = useState<'Week' | 'Month'>('Week')
  const weekly = history
    .slice(0, 7)
    .reverse()
    .map((entry) => entry.stress * 10)
  const monthly = history
    .slice(0, 30)
    .reverse()
    .map((entry) => entry.stress * 10)
  const values = range === 'Week' ? weekly : monthly
  const visibleHistory = range === 'Week' ? history.slice(0, 7) : history.slice(0, 30)
  const visibleHealth = range === 'Week' ? healthRecords.slice(0, 7) : healthRecords.slice(0, 30)
  const sleepBars = visibleHealth
    .slice()
    .reverse()
    .map((record) => Math.min(100, Math.round(((record.sleepMinutes || 0) / 600) * 100)))
  const sleepValues = visibleHealth
    .map((record) => record.sleepMinutes)
    .filter((value): value is number => value !== null)
  const averageSleep = sleepValues.length
    ? Math.round(sleepValues.reduce((sum, value) => sum + value, 0) / sleepValues.length)
    : null
  const calmCount = visibleHistory.filter(
    (entry) => entry.mood === 'Calm' || entry.mood === 'Very Happy',
  ).length
  const anxiousCount = visibleHistory.filter(
    (entry) => entry.mood === 'Anxious' || entry.mood === 'Sad',
  ).length
  const entries = visibleHistory.length
  const moodMix = {
    calm: entries ? Math.round((calmCount / entries) * 100) : 0,
    anxious: entries ? Math.round((anxiousCount / entries) * 100) : 0,
    other: entries ? Math.round(((entries - calmCount - anxiousCount) / entries) * 100) : 0,
    entries,
  }
  const habitDayKeys = getRecentDayKeys(todayKey, range === 'Week' ? 7 : 28)
  const visibleHabitLogs = habitLogs.filter((log) => habitDayKeys.includes(log.completedOn))
  const habitCompletionCount = new Set(
    visibleHabitLogs.map((log) => `${log.completedOn}:${log.habitKind}`),
  ).size
  const habitPossible = habitDayKeys.length * 5
  const dailyHabitCounts = habitDayKeys.map(
    (dayKey) =>
      new Set(
        visibleHabitLogs.filter((log) => log.completedOn === dayKey).map((log) => log.habitKind),
      ).size,
  )
  const habitChart =
    range === 'Week'
      ? dailyHabitCounts.map((count, index) => ({
          key: habitDayKeys[index],
          label: new Intl.DateTimeFormat('en-US', {
            weekday: 'narrow',
            timeZone: 'UTC',
          }).format(new Date(`${habitDayKeys[index]}T00:00:00.000Z`)),
          level: count,
        }))
      : [0, 1, 2, 3].map((week) => ({
          key: `week-${week + 1}`,
          label: `W${week + 1}`,
          level: Math.round(
            (dailyHabitCounts.slice(week * 7, week * 7 + 7).reduce((sum, count) => sum + count, 0) /
              35) *
              5,
          ),
        }))
  return (
    <div className="page">
      <Header title="Your Insights" subtitle="Your private wellness analytics" />
      <div className="segmented">
        <button
          className={cx(range === 'Week' && 'active')}
          onClick={() => setRange('Week')}
          aria-pressed={range === 'Week'}
        >
          Week
        </button>
        <button
          className={cx(range === 'Month' && 'active')}
          onClick={() => setRange('Month')}
          aria-pressed={range === 'Month'}
        >
          Month
        </button>
      </div>
      <div className="analytics-demo-note">
        <BarChart3 size={15} />
        <span>Charts use only your saved entries and are not clinical measurements.</span>
      </div>
      <Card className="insight-highlight">
        <div className="sparkle-box">
          <Sparkles size={21} />
        </div>
        <div>
          <div className="eyebrow">PERSONAL OBSERVATION</div>
          <div className="body-sm">
            You have <strong>{history.length} saved check-ins</strong>. More entries will make your
            personal patterns easier to understand.
          </div>
        </div>
      </Card>
      <div className="section-heading">
        <div>
          <div className="title-sm">Stress trend</div>
          <div className="caption">{range === 'Week' ? 'Last 7 entries' : 'Last 30 entries'}</div>
        </div>
        <div className="legend">
          <span />
          Stress score
        </div>
      </div>
      <Card>
        <LineChart
          values={values}
          labels={values.map((_, index) => (index === values.length - 1 ? 'Now' : `${index + 1}`))}
        />
      </Card>
      <div className="chart-two-grid">
        <Card>
          <div className="title-sm">Mood mix</div>
          <div
            className="donut-chart"
            style={
              {
                '--calm-end': `${moodMix.calm}%`,
                '--anxious-end': `${moodMix.calm + moodMix.anxious}%`,
              } as CSSProperties
            }
          >
            <div>
              <strong>{moodMix.entries}</strong>
              <span>entries</span>
            </div>
          </div>
          <div className="donut-legend">
            <span>
              <i className="calm" />
              Calm {moodMix.calm}%
            </span>
            <span>
              <i className="anxious" />
              Anxious {moodMix.anxious}%
            </span>
            <span>
              <i className="neutral" />
              Other {moodMix.other}%
            </span>
          </div>
        </Card>
        <Card>
          <div className="title-sm">Sleep duration</div>
          <div className="bar-chart">
            {sleepBars.map((h, i) => (
              <span
                key={i}
                style={{ height: `${h}%` }}
                className={i === sleepBars.length - 1 ? 'active' : ''}
              />
            ))}
          </div>
          <div className="metric-summary">
            <strong>
              {averageSleep === null
                ? 'No data'
                : `${Math.floor(averageSleep / 60)}h ${averageSleep % 60}m`}
            </strong>
            <span>average from saved health entries</span>
          </div>
        </Card>
      </div>
      <div className="section-heading">
        <div>
          <div className="title-sm">{range === 'Week' ? 'Weekly' : 'Monthly'} habits</div>
          <div className="caption">
            {habitCompletionCount} of {habitPossible} possible completions
          </div>
        </div>
        <strong className="positive">
          {habitPossible ? Math.round((habitCompletionCount / habitPossible) * 100) : 0}%
        </strong>
      </div>
      <Card className="habit-week">
        {habitChart.map((item) => (
          <div key={item.key}>
            <span>{item.label}</span>
            <i>
              {[0, 1, 2, 3, 4].map((segment) => (
                <b key={segment} className={segment < item.level ? 'done' : ''} />
              ))}
            </i>
          </div>
        ))}
      </Card>
      <div className="section-heading">
        <div className="title-sm">Recent check-ins</div>
      </div>
      <Card className="recent-list">
        {history.map((entry, i) => (
          <div key={i}>
            <span className="recent-emoji">{moodIcons[entry.mood]}</span>
            <span className="grow">
              <strong>{i === 0 ? entry.mood : ['Calm', 'Neutral', 'Anxious'][i % 3]}</strong>
              <small>{entry.time}</small>
            </span>
            <span className="score-badge">{entry.stress}/10</span>
          </div>
        ))}
        {!history.length && (
          <div className="empty-state">No check-ins yet. Your first entry will appear here.</div>
        )}
      </Card>
    </div>
  )
}

function ChatScreen({
  stress,
  navigate,
  messages,
  setMessages,
}: {
  stress: number
  navigate: (s: Screen) => void
  messages: Message[]
  setMessages: Dispatch<SetStateAction<Message[]>>
}) {
  const [text, setText] = useState('')
  const [typing, setTyping] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const responseTimer = useRef<number | null>(null)
  const safeMessages = Array.isArray(messages) ? messages : INITIAL_CHAT_MESSAGES
  const respond = (prompt: string) => {
    if (!prompt.trim()) return
    if (responseTimer.current) window.clearTimeout(responseTimer.current)
    setMessages((current) => [
      ...(Array.isArray(current) ? current : INITIAL_CHAT_MESSAGES),
      { from: 'user', text: prompt },
    ])
    setText('')
    setTyping(true)
    responseTimer.current = window.setTimeout(() => {
      const lower = prompt.toLowerCase()
      let answer = `Your current stress check-in is ${stress}/10. Based on your current check-in, a short pause and one manageable next step may help. Would you like to try breathing or make a simple plan?`
      if (lower.includes('sleep'))
        answer =
          'A consistent wind-down may help. Try dimming screens 30 minutes before bed and keeping tomorrow’s wake time steady.'
      if (lower.includes('relax'))
        answer =
          'Let’s keep it simple: soften your shoulders, place both feet on the floor, and take five slow breaths. I can guide you through a one-minute exercise.'
      if (lower.includes('plan'))
        answer =
          'Here’s a gentle plan: choose one priority, take a 10-minute walk after lunch, pause for five breaths at 4 PM, and start winding down at 10:30 PM.'
      if (lower.includes('why') || lower.includes('stressed'))
        answer =
          'I can’t know for certain, but your saved entries suggest reduced sleep and study workload may be contributing. That’s a pattern to explore, not a diagnosis.'
      setMessages((current) => [
        ...(Array.isArray(current) ? current : INITIAL_CHAT_MESSAGES),
        { from: 'assistant', text: answer },
      ])
      setTyping(false)
      responseTimer.current = null
    }, 850)
  }
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [safeMessages, typing])
  useEffect(() => {
    return () => {
      if (responseTimer.current) window.clearTimeout(responseTimer.current)
    }
  }, [])
  return (
    <div className="chat-page">
      <Header
        title="MindEase Assistant"
        subtitle="A gentle space to pause and reflect"
        action={<span className="assistant-beta-pill">NEXT BETA</span>}
      />
      <div className="chat-safety">
        <Shield size={14} /> Supportive guidance, not medical advice
      </div>
      <div className="chat-scroll" ref={scrollRef}>
        <section className="assistant-beta-banner" aria-labelledby="assistant-beta-title">
          <span className="assistant-beta-icon" aria-hidden="true">
            <Sparkles size={23} />
          </span>
          <div>
            <span className="assistant-beta-kicker">COMING IN THE NEXT BETA</span>
            <h2 id="assistant-beta-title">A kinder companion is on the way</h2>
            <p>
              We’re thoughtfully building MindEase Assistant to offer more personal, supportive
              check-ins. For now, explore this guided preview and help shape what comes next.
            </p>
          </div>
        </section>
        <div className="assistant-profile">
          <div>
            <Sparkles size={22} />
          </div>
          <span>
            <strong>Guided preview</strong>
            <small>Private, scripted wellness guidance</small>
          </span>
        </div>
        {safeMessages.map((message, i) => (
          <div key={i} className={cx('message-row', message.from)}>
            {message.from === 'assistant' && (
              <span className="bot-avatar">
                <Sparkles size={14} />
              </span>
            )}
            <div className="bubble">
              {message.text}
              <small>Now</small>
            </div>
          </div>
        ))}
        {typing && (
          <div className="message-row assistant" role="status" aria-live="polite">
            <span className="bot-avatar">
              <Sparkles size={14} />
            </span>
            <div className="typing" aria-label="MindEase Assistant is typing">
              <i />
              <i />
              <i />
            </div>
          </div>
        )}
        <div className="prompt-label">SUGGESTED</div>
        <div className="prompt-list">
          {[
            'Why have I been feeling stressed?',
            'Help me relax.',
            'How can I improve my sleep?',
            'Give me a plan for today.',
          ].map((p) => (
            <button key={p} onClick={() => respond(p)}>
              {p}
              <ChevronRight size={15} />
            </button>
          ))}
        </div>
      </div>
      <div className="chat-compose">
        <button
          className="breath-shortcut"
          onClick={() => navigate('breathing')}
          aria-label="Open breathing exercise"
        >
          <Wind size={19} />
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && respond(text)}
          placeholder="Share what’s on your mind..."
          aria-label="Message MindEase Assistant"
        />
        <button
          className="send-button"
          onClick={() => respond(text)}
          disabled={!text.trim()}
          aria-label="Send message"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  )
}

function BreathingScreen({ back, onComplete }: { back: () => void; onComplete: () => void }) {
  const [duration, setDuration] = useState(1)
  const [remaining, setRemaining] = useState(60)
  const [running, setRunning] = useState(false)
  const [finished, setFinished] = useState(false)
  const total = duration * 60
  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          setRunning(false)
          setFinished(true)
          onComplete()
          return 0
        }
        return r - 1
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [running, onComplete])
  const elapsed = total - remaining
  const cycle = elapsed % 12
  const phase = cycle < 4 ? 'Inhale' : cycle < 6 ? 'Hold' : 'Exhale'
  const choose = (n: number) => {
    setDuration(n)
    setRemaining(n * 60)
    setRunning(false)
    setFinished(false)
  }
  return (
    <div className="breathing-page">
      <Header title="Breathing Space" subtitle="Be here, just for a moment" back={back} />
      {!finished ? (
        <>
          <div className="duration-picker">
            {[1, 3, 5].map((n) => (
              <button
                key={n}
                className={cx(duration === n && 'active')}
                onClick={() => choose(n)}
                disabled={running}
              >
                {n} min
              </button>
            ))}
          </div>
          <div className="breathing-stage">
            <div className={cx('breathing-halo', running && phase.toLowerCase())}>
              <div className="breathing-circle">
                <Wind size={29} />
                <strong>{running ? phase : 'Ready'}</strong>
                <span>
                  {running
                    ? phase === 'Inhale'
                      ? 'Breathe in slowly'
                      : phase === 'Hold'
                        ? 'Rest here gently'
                        : 'Let it all go'
                    : 'Find a comfortable position'}
                </span>
              </div>
            </div>
          </div>
          <div className="breath-progress">
            <div className="progress-bar">
              <span style={{ width: `${(elapsed / total) * 100}%` }} />
            </div>
            <span>
              {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')} remaining
            </span>
          </div>
          <div className="breath-controls">
            <Button onClick={() => setRunning(!running)}>
              {running ? (
                <>
                  <Pause size={18} /> Pause
                </>
              ) : (
                <>
                  <Play size={18} fill="currentColor" /> {elapsed ? 'Resume' : 'Start'}
                </>
              )}
            </Button>
            {elapsed > 0 && (
              <Button
                variant="ghost"
                onClick={() => {
                  setRunning(false)
                  setFinished(true)
                  onComplete()
                }}
              >
                End session
              </Button>
            )}
          </div>
        </>
      ) : (
        <div className="completion-state">
          <div className="completion-icon">
            <Check size={34} />
          </div>
          <div className="title-lg">A calmer moment, completed.</div>
          <div className="body">
            You took time to reset. Notice how your body and thoughts feel right now.
          </div>
          <Card>
            <div>
              <Clock3 size={19} />
              <span>Session length</span>
              <strong>{Math.max(1, Math.ceil(elapsed / 60))} min</strong>
            </div>
            <div>
              <Wind size={19} />
              <span>Breathing cycles</span>
              <strong>{Math.max(1, Math.floor(elapsed / 12))}</strong>
            </div>
          </Card>
          <Button className="full" onClick={back}>
            Return to MindEase
          </Button>
        </div>
      )}
    </div>
  )
}

function RecommendationsScreen({
  completed,
  toggle,
  navigate,
  back,
  mood,
  prediction,
  factors,
  hasWellnessData,
}: {
  completed: string[]
  toggle: (s: string) => void
  navigate: (s: Screen) => void
  back: () => void
  mood: Mood
  prediction: number
  factors: string[]
  hasWellnessData: boolean
}) {
  const recs = [
    [
      'Five-minute breathing exercise',
      'Settle your nervous system with a guided rhythm.',
      '5 min',
      Wind,
      'breathing' as Screen,
    ],
    [
      'Prepare for a consistent bedtime',
      'Start winding down at the same time tonight.',
      '10 min',
      Moon,
      'habits' as Screen,
    ],
    [
      'Take a short walk',
      'Gentle movement can create a useful mental reset.',
      '10 min',
      Footprints,
      'habits' as Screen,
    ],
    [
      'Break a large task into steps',
      'Choose one small action you can finish now.',
      '5 min',
      Target,
      (hasWellnessData ? 'prediction' : 'assessment') as Screen,
    ],
    [
      'Write a quick mood journal',
      'Name what you feel without needing to fix it.',
      '3 min',
      BookHeart,
      'checkin' as Screen,
    ],
  ] as const
  const priority = hasWellnessData
    ? factors.includes('Reduced sleep')
      ? 'Prepare for a consistent bedtime'
      : mood === 'Anxious'
        ? 'Five-minute breathing exercise'
        : 'Take a short walk'
    : null
  return (
    <div className="page">
      <Header
        title="For You"
        subtitle={`${completed.length} of ${recs.length} completed today`}
        back={back}
      />
      <div className="recommend-context">
        <span>
          <Sparkles size={17} />
        </span>
        <div>
          <strong>
            {hasWellnessData ? 'Personalized action plan' : 'Starter wellness actions'}
          </strong>
          <small>
            {hasWellnessData
              ? `Prioritized from your ${mood.toLowerCase()} mood and ${prediction}/100 rule-based outlook.`
              : 'Complete a check-in to prioritize these suggestions for you.'}
          </small>
        </div>
      </div>
      <div className="recommend-progress">
        <div>
          <strong>{Math.round((completed.length / recs.length) * 100)}%</strong>
          <span>Daily progress</span>
        </div>
        <div className="progress-bar">
          <span style={{ width: `${(completed.length / recs.length) * 100}%` }} />
        </div>
      </div>
      <div className="recommend-list">
        {recs.map(([title, text, time, Icon, screen]) => (
          <Card
            key={title}
            className={cx(
              'recommend-card',
              completed.includes(title) && 'completed',
              title === priority && 'priority',
            )}
          >
            <div className="recommend-icon">
              <Icon size={22} />
            </div>
            <div className="grow">
              <div className="recommend-title-row">
                <div className="title-sm">{title}</div>
                {title === priority && <span>Top match</span>}
              </div>
              <div className="body-sm">{text}</div>
              <div className="duration">
                <Clock3 size={13} />
                {time}
              </div>
              <div className="rec-actions">
                <Button variant="secondary" onClick={() => navigate(screen)}>
                  {completed.includes(title) ? 'Do again' : 'Start'}
                </Button>
                <button className="complete-button" onClick={() => toggle(title)}>
                  {completed.includes(title) ? (
                    <>
                      <Check size={15} /> Completed
                    </>
                  ) : (
                    'Mark complete'
                  )}
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

function HabitsScreen({
  habits,
  toggle,
  back,
  logs,
  todayKey,
}: {
  habits: Habit[]
  toggle: (i: number) => void
  back: () => void
  logs: HabitLog[]
  todayKey: string
}) {
  const done = habits.filter((h) => h.done).length
  const dayKeys = getRecentDayKeys(todayKey, 7)
  const dailyCounts = dayKeys.map(
    (dayKey) =>
      new Set(logs.filter((log) => log.completedOn === dayKey).map((log) => log.habitKind)).size,
  )
  const todayLabel = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${todayKey}T00:00:00.000Z`))
  return (
    <div className="page">
      <Header title="Daily Habits" subtitle="Small steps, steady progress" back={back} />
      <Card className="habit-summary">
        <div className="habit-ring">
          <strong>
            {done}/{habits.length}
          </strong>
          <span>today</span>
        </div>
        <div>
          <div className="title-md">
            {done >= 3 ? 'You’re building momentum' : 'A gentle start'}
          </div>
          <div className="body-sm">
            {Math.round((done / habits.length) * 100)}% of today&apos;s wellness habits complete.
          </div>
        </div>
      </Card>
      <div className="section-heading">
        <div className="title-sm">Today&apos;s habits</div>
        <div className="caption">{todayLabel}</div>
      </div>
      <div className="habit-list">
        {habits.map((habit, i) => (
          <Card
            key={habit.name}
            className={cx('habit-item', habit.done && 'done')}
            onClick={() => toggle(i)}
          >
            <span className="habit-check" aria-hidden="true">
              {habit.done && <Check size={17} />}
            </span>
            <span className="habit-icon">
              <habit.icon size={20} />
            </span>
            <span className="grow">
              <strong>{habit.name}</strong>
              <small>{habit.done ? 'Completed today' : 'Tap when complete'}</small>
            </span>
            <span className="streak">
              <Zap size={13} />
              {habit.streak} days
            </span>
          </Card>
        ))}
      </div>
      <div className="section-heading">
        <div>
          <div className="title-sm">This week</div>
          <div className="caption">Your saved daily completions</div>
        </div>
      </div>
      <Card className="weekly-bars">
        {dailyCounts.map((count, index) => (
          <div key={dayKeys[index]}>
            <span>
              <i style={{ height: `${count * 20}%` }} />
            </span>
            <small>
              {new Intl.DateTimeFormat('en-US', {
                weekday: 'narrow',
                timeZone: 'UTC',
              }).format(new Date(`${dayKeys[index]}T00:00:00.000Z`))}
            </small>
          </div>
        ))}
      </Card>
    </div>
  )
}

function WearablesScreen({
  back,
  toast,
  records = [],
  onSave,
}: {
  back: () => void
  toast: (m: string) => void
  records?: HealthRecord[]
  onSave: (record: {
    recordedOn: string
    steps?: number
    activeMinutes?: number
    sleepMinutes?: number
    restingHeartRate?: number
    hrv?: number
  }) => Promise<boolean>
}) {
  const latest = records[0]
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    recordedOn: '',
    steps: '',
    activeMinutes: '',
    sleepHours: '',
    restingHeartRate: '',
    hrv: '',
  })
  useEffect(() => {
    const now = new Date()
    const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10)
    setForm((current) => ({ ...current, recordedOn: localDate }))
  }, [])
  const save = async () => {
    setSaving(true)
    const success = await onSave({
      recordedOn: form.recordedOn,
      steps: form.steps ? Number(form.steps) : undefined,
      activeMinutes: form.activeMinutes ? Number(form.activeMinutes) : undefined,
      sleepMinutes: form.sleepHours ? Math.round(Number(form.sleepHours) * 60) : undefined,
      restingHeartRate: form.restingHeartRate ? Number(form.restingHeartRate) : undefined,
      hrv: form.hrv ? Number(form.hrv) : undefined,
    })
    setSaving(false)
    if (success) {
      setForm((current) => ({
        ...current,
        steps: '',
        activeMinutes: '',
        sleepHours: '',
        restingHeartRate: '',
        hrv: '',
      }))
      toast('Health entry saved')
    }
  }
  const metrics = latest
    ? ([
        ['Steps', latest.steps?.toLocaleString('en-US') || '—', Footprints],
        ['Active minutes', latest.activeMinutes ? `${latest.activeMinutes} min` : '—', Dumbbell],
        [
          'Sleep',
          latest.sleepMinutes
            ? `${Math.floor(latest.sleepMinutes / 60)}h ${latest.sleepMinutes % 60}m`
            : '—',
          Moon,
        ],
        [
          'Resting heart rate',
          latest.restingHeartRate ? `${latest.restingHeartRate} bpm` : '—',
          Heart,
        ],
        ['HRV', latest.hrv ? `${latest.hrv} ms` : '—', Activity],
      ] as const)
    : []
  return (
    <div className="page">
      <Header title="Health & Activity" subtitle="Your movement, sleep, and recovery" back={back} />
      <div className="future-scope-banner" role="note">
        <span className="future-scope-icon">
          <Sparkles size={20} />
        </span>
        <div>
          <div className="eyebrow">FUTURE SCOPE · UPCOMING UPDATE</div>
          <div className="title-sm">Automatic phone health integration is planned</div>
          <div className="body-sm">
            Health Connect and Apple Health syncing are part of the MindEase project roadmap and are
            not included in the current beta.
          </div>
        </div>
      </div>
      <Card className="health-consent-card">
        <Shield size={23} />
        <div>
          <div className="title-sm">You control what is shared</div>
          <div className="body-sm">
            MindEase stores only the values you submit. Native health access requires separate,
            explicit Android or iOS permission.
          </div>
        </div>
      </Card>
      <div className="section-heading">
        <div>
          <div className="title-sm">Phone health services</div>
          <div className="caption">NATIVE APP REQUIRED</div>
        </div>
      </div>
      <div className="health-source-grid">
        <Card>
          <span className="metric-icon">
            <Activity size={20} />
          </span>
          <strong>Android Health Connect</strong>
          <small>Android client planned</small>
          <p>Can provide permitted steps, sleep, heart rate, and exercise sessions.</p>
        </Card>
        <Card>
          <span className="metric-icon">
            <Watch size={20} />
          </span>
          <strong>Apple Health</strong>
          <small>iOS client planned</small>
          <p>Requires a signed iOS app with HealthKit capabilities and review.</p>
        </Card>
      </div>
      <div className="section-heading">
        <div>
          <div className="title-sm">Add today&apos;s data</div>
          <div className="caption">AVAILABLE NOW</div>
        </div>
      </div>
      <Card className="health-entry-form">
        <label className="field-label">
          Date
          <input
            className="input"
            type="date"
            value={form.recordedOn}
            onChange={(event) => setForm({ ...form, recordedOn: event.target.value })}
          />
        </label>
        <div className="health-form-grid">
          {[
            ['Steps', 'steps', 'e.g. 6500'],
            ['Active minutes', 'activeMinutes', 'e.g. 35'],
            ['Sleep hours', 'sleepHours', 'e.g. 7.5'],
            ['Resting heart rate', 'restingHeartRate', 'e.g. 68'],
            ['HRV (ms)', 'hrv', 'e.g. 45'],
          ].map(([label, key, placeholder]) => (
            <label className="field-label" key={key}>
              {label}
              <input
                className="input"
                type="number"
                min="0"
                inputMode="decimal"
                placeholder={placeholder}
                value={form[key as keyof typeof form]}
                onChange={(event) => setForm({ ...form, [key]: event.target.value })}
              />
            </label>
          ))}
        </div>
        <Button className="full" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save health entry'}
        </Button>
      </Card>
      <div className="section-heading">
        <div className="title-sm">Latest readings</div>
        <div className="caption">
          {latest
            ? new Intl.DateTimeFormat('en-US', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                timeZone: 'UTC',
              }).format(new Date(latest.recordedOn))
            : 'No data yet'}
        </div>
      </div>
      <div className="metrics-grid">
        {metrics.map(([label, value, Icon]) => (
          <Card key={label}>
            <span className="metric-icon">
              <Icon size={20} />
            </span>
            <span className="caption">{label.toUpperCase()}</span>
            <strong>{value}</strong>
          </Card>
        ))}
        {!metrics.length && (
          <Card className="empty-state">
            Add your first health entry to start building activity insights.
          </Card>
        )}
      </div>
    </div>
  )
}

function SupportScreen({
  back,
  navigate,
  toast,
  contact,
  setContact,
}: {
  back: () => void
  navigate: (s: Screen) => void
  toast: (m: string) => void
  contact: string
  setContact: (value: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draftContact, setDraftContact] = useState(contact)
  const [confirm, setConfirm] = useState<string | null>(null)
  const [grounding, setGrounding] = useState(false)
  const saveContact = () => {
    if (!draftContact.trim()) {
      toast('Enter a trusted contact before saving')
      return
    }
    setContact(draftContact.trim())
    setEditing(false)
    toast('Trusted contact updated')
  }
  return (
    <div className="page support-page">
      <Header title="Need Support?" subtitle="You don’t have to handle it alone" back={back} />
      <Card className="support-intro">
        <HeartHandshake size={27} />
        <div>
          <div className="title-md">Help is available</div>
          <div className="body-sm">
            Choose an option that feels right. Calling actions open your phone dialer for
            confirmation.
          </div>
        </div>
      </Card>
      <div className="section-heading">
        <div className="title-sm">Immediate options</div>
      </div>
      <div className="support-actions">
        <button onClick={() => setConfirm('trusted contact')}>
          <span>
            <User size={21} />
          </span>
          <div>
            <strong>Contact Trusted Person</strong>
            <small>{contact}</small>
          </div>
          <ChevronRight size={18} />
        </button>
        <button className="emergency" onClick={() => setConfirm('Emergency Services at 112')}>
          <span>
            <Phone size={21} />
          </span>
          <div>
            <strong>Call Emergency Services</strong>
            <small>India emergency number: 112</small>
          </div>
          <ChevronRight size={18} />
        </button>
        <button onClick={() => navigate('breathing')}>
          <span>
            <Wind size={21} />
          </span>
          <div>
            <strong>Breathing Exercise</strong>
            <small>Follow a calming rhythm</small>
          </div>
          <ChevronRight size={18} />
        </button>
        <button onClick={() => setGrounding(true)}>
          <span>
            <Leaf size={21} />
          </span>
          <div>
            <strong>5–4–3–2–1 Grounding</strong>
            <small>Reconnect with the present moment</small>
          </div>
          <ChevronRight size={18} />
        </button>
      </div>
      <Card className="trusted-card">
        <div className="title-sm">Trusted contact</div>
        {editing ? (
          <div className="edit-contact">
            <input
              className="input"
              value={draftContact}
              onChange={(e) => setDraftContact(e.target.value)}
              aria-label="Trusted contact name and relationship"
            />
            <Button onClick={saveContact}>Save</Button>
            <Button
              variant="ghost"
              onClick={() => {
                setDraftContact(contact)
                setEditing(false)
              }}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <div className="trusted-row">
            <span className="avatar small">PS</span>
            <span className="grow">
              <strong>{contact}</strong>
              <small>Trusted contact</small>
            </span>
            <Button variant="ghost" onClick={() => setEditing(true)}>
              Edit
            </Button>
          </div>
        )}
      </Card>
      <div className="resource-note">
        <strong>Support resources</strong>
        <p>
          If you are in immediate danger or may hurt yourself, contact local emergency services now.
          For non-emergency support, reach out to a trusted person or qualified mental health
          professional.
        </p>
      </div>
      {confirm && (
        <div className="modal-backdrop">
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="support-dialog-title"
          >
            <div className="modal-icon">
              <Phone size={24} />
            </div>
            <div className="title-md" id="support-dialog-title">
              Confirm support action
            </div>
            <div className="body">
              Would you like to open the calling action for {confirm}? MindEase cannot confirm that
              a call or message is completed.
            </div>
            <div className="modal-actions">
              <Button variant="secondary" onClick={() => setConfirm(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (confirm.includes('112')) window.location.href = 'tel:112'
                  setConfirm(null)
                  toast(
                    confirm.includes('112')
                      ? 'Opening your phone dialer'
                      : 'Add a phone number to your trusted contact before calling',
                  )
                }}
              >
                Continue
              </Button>
            </div>
          </div>
        </div>
      )}
      {grounding && (
        <div className="modal-backdrop">
          <div
            className="modal grounding-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="grounding-dialog-title"
          >
            <div className="modal-icon">
              <Leaf size={24} />
            </div>
            <div className="title-md" id="grounding-dialog-title">
              5–4–3–2–1 Grounding
            </div>
            <div className="grounding-list">
              <span>
                <strong>5</strong> things you can see
              </span>
              <span>
                <strong>4</strong> things you can feel
              </span>
              <span>
                <strong>3</strong> things you can hear
              </span>
              <span>
                <strong>2</strong> things you can smell
              </span>
              <span>
                <strong>1</strong> thing you can taste
              </span>
            </div>
            <Button
              className="full"
              onClick={() => {
                setGrounding(false)
                toast('Grounding exercise completed')
              }}
            >
              I’m finished
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function PrivacyScreen({
  back,
  toast,
  settings,
  setSettings,
  onDelete,
  exportData,
}: {
  back: () => void
  toast: (m: string) => void
  settings: PrivacySettings
  setSettings: Dispatch<SetStateAction<PrivacySettings>>
  onDelete: () => void
  exportData: object
}) {
  const [confirm, setConfirm] = useState(false)
  const download = () => {
    const blob = new Blob(
      [JSON.stringify({ ...exportData, generatedAt: new Date().toISOString() }, null, 2)],
      { type: 'application/json' },
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'mindease-data.json'
    a.click()
    URL.revokeObjectURL(url)
    toast('Your data export is ready')
  }
  return (
    <div className="page">
      <Header title="Privacy Center" subtitle="You’re in control" back={back} />
      <Card className="privacy-hero">
        <Shield size={28} />
        <div>
          <div className="title-md">Your data, your choices</div>
          <div className="body-sm">
            Your check-ins and assessments are stored privately with your account.
          </div>
        </div>
      </Card>
      <div className="section-heading">
        <div className="title-sm">Data permissions</div>
      </div>
      <Card className="settings-list">
        {[
          ['Mood history visibility', 'Allow history in Insights', 'mood'],
          ['Health data', 'Use saved activity and sleep entries', 'wearable'],
          ['Chat history', 'Keep guided conversation on this device', 'chat'],
        ].map(([title, desc, key]) => (
          <div key={key}>
            <span className="grow">
              <strong>{title}</strong>
              <small>{desc}</small>
            </span>
            <Toggle
              checked={settings[key as keyof typeof settings]}
              onChange={() =>
                setSettings((current) => ({
                  ...current,
                  [key]: !current[key as keyof PrivacySettings],
                }))
              }
              label={title}
            />
          </div>
        ))}
      </Card>
      <div className="section-heading">
        <div className="title-sm">Your wellness data</div>
      </div>
      <Card className="privacy-actions">
        <button onClick={download}>
          <span>
            <Download size={19} />
          </span>
          <div>
            <strong>Download My Data</strong>
            <small>Generate a portable JSON file</small>
          </div>
          <ChevronRight size={18} />
        </button>
        <button className="danger-row" onClick={() => setConfirm(true)}>
          <span>
            <Trash2 size={19} />
          </span>
          <div>
            <strong>Delete My Data</strong>
            <small>Delete stored check-ins and assessments</small>
          </div>
          <ChevronRight size={18} />
        </button>
      </Card>
      <div className="privacy-copy">
        <Lock size={16} />
        <p>
          MindEase limits access to your signed-in account. Chat stays in the browser in this beta,
          while check-ins, assessments, habits, and preferences are stored securely. MindEase is not
          a medical service.
        </p>
      </div>
      {confirm && (
        <div className="modal-backdrop">
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
          >
            <div className="modal-icon danger">
              <Trash2 size={24} />
            </div>
            <div className="title-md" id="delete-dialog-title">
              Delete wellness data?
            </div>
            <div className="body">
              This permanently deletes your stored check-ins and assessments and resets wellness
              progress on this device. Your account remains active.
            </div>
            <div className="modal-actions">
              <Button variant="secondary" onClick={() => setConfirm(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  setConfirm(false)
                  onDelete()
                  toast('Wellness data deleted')
                }}
              >
                Delete data
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ProfileScreen({
  dark,
  setDark,
  navigate,
  onSignOut,
  toast,
  email,
  settings = DEFAULT_PROFILE_SETTINGS,
  setSettings,
}: {
  dark: boolean
  setDark: (b: boolean) => void
  navigate: (s: Screen) => void
  onSignOut: () => void
  toast: (m: string) => void
  email: string
  settings?: ProfileSettings
  setSettings: Dispatch<SetStateAction<ProfileSettings>>
}) {
  const [editing, setEditing] = useState(false)
  const [nameDraft, setNameDraft] = useState(settings.name)
  const [goalOpen, setGoalOpen] = useState(false)
  const [goalDraft, setGoalDraft] = useState(settings.goal)
  const initials = getInitials(settings.name)
  const saveName = () => {
    if (!nameDraft.trim()) {
      toast('Profile name cannot be empty')
      return
    }
    setSettings((current) => ({ ...current, name: nameDraft.trim() }))
    setEditing(false)
    toast('Profile updated')
  }
  return (
    <div className="page">
      <Header
        title="Profile & Settings"
        subtitle="Personalize your experience"
        action={
          <button
            className="icon-button"
            aria-label="Jump to settings"
            onClick={() =>
              document.querySelector('.settings-section')?.scrollIntoView({ behavior: 'smooth' })
            }
          >
            <Settings size={20} />
          </button>
        }
      />
      <div className="profile-card">
        <div className="profile-avatar" aria-label={`${settings.name} initials`}>
          {initials}
        </div>
        <div>
          {editing ? (
            <input
              className="profile-name-input"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              aria-label="Profile name"
            />
          ) : (
            <div className="title-md">{settings.name}</div>
          )}
          <div className="body-sm">{email}</div>
          <span>Personal wellness account</span>
        </div>
        {editing ? (
          <div className="profile-edit-actions">
            <button onClick={saveName}>Save</button>
            <button
              onClick={() => {
                setNameDraft(settings.name)
                setEditing(false)
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)}>Edit</button>
        )}
      </div>
      <button className="goal-card" onClick={() => setGoalOpen(true)}>
        <Target size={21} />
        <div className="grow">
          <small>WELLNESS GOAL</small>
          <strong>{settings.goal}</strong>
        </div>
        <ChevronRight size={18} />
      </button>
      <div className="settings-section">
        <div className="section-label">PREFERENCES</div>
        <Card className="settings-list">
          <div>
            <span className="setting-icon">
              <Bell size={19} />
            </span>
            <span className="grow">
              <strong>Notifications</strong>
              <small>Daily check-in reminders</small>
            </span>
            <Toggle
              checked={settings.notifications}
              onChange={() =>
                setSettings((current) => ({ ...current, notifications: !current.notifications }))
              }
              label="Notifications"
            />
          </div>
          <div>
            <span className="setting-icon">
              <Clock3 size={19} />
            </span>
            <span className="grow">
              <strong>Reminder time</strong>
              <small>Daily wellness check-in</small>
            </span>
            <input
              type="time"
              value={settings.reminder}
              onChange={(e) => setSettings((current) => ({ ...current, reminder: e.target.value }))}
              aria-label="Daily reminder time"
            />
          </div>
          <div>
            <span className="setting-icon">{dark ? <Moon size={19} /> : <Sun size={19} />}</span>
            <span className="grow">
              <strong>Appearance</strong>
              <small>{dark ? 'Dark' : 'Light'} theme</small>
            </span>
            <div className="theme-choice" aria-label="Theme selection">
              <button
                className={cx(!dark && 'active')}
                onClick={() => setDark(false)}
                aria-label="Use light theme"
                aria-pressed={!dark}
              >
                <Sun size={15} />
              </button>
              <button
                className={cx(dark && 'active')}
                onClick={() => setDark(true)}
                aria-label="Use dark theme"
                aria-pressed={dark}
              >
                <Moon size={15} />
              </button>
            </div>
          </div>
          <div>
            <span className="setting-icon">
              <Eye size={19} />
            </span>
            <span className="grow">
              <strong>Larger text</strong>
              <small>Accessibility preference</small>
            </span>
            <Toggle
              checked={settings.largeText}
              onChange={() => {
                setSettings((current) => ({ ...current, largeText: !current.largeText }))
                toast('Text size preference updated')
              }}
              label="Larger text"
            />
          </div>
        </Card>
      </div>
      <div className="settings-section">
        <div className="section-label">MORE</div>
        <Card className="link-list">
          {[
            ['Recommendations', 'recommendations', Sparkles],
            ['Habits & streaks', 'habits', Target],
            ['Wearables & health data', 'wearables', Watch],
            ['Privacy Center', 'privacy', Shield],
            ['Emergency support', 'support', HeartHandshake],
          ].map(([label, to, Icon]) => (
            <button key={label as string} onClick={() => navigate(to as Screen)}>
              <span>
                <Icon size={19} />
              </span>
              <strong>{label as string}</strong>
              <ChevronRight size={18} />
            </button>
          ))}
        </Card>
      </div>
      <button className="signout" onClick={onSignOut}>
        <LogOut size={18} />
        Sign Out
      </button>
      <div className="app-version">MindEase Beta · Version 1.1</div>
      {goalOpen && (
        <div className="modal-backdrop">
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="goal-dialog-title"
          >
            <div className="modal-icon">
              <Target size={24} />
            </div>
            <div className="title-md" id="goal-dialog-title">
              Personal wellness goal
            </div>
            <div className="body">Choose a goal for your wellness plan.</div>
            <div className="goal-options">
              {[
                'Build a calmer daily routine',
                'Improve sleep consistency',
                'Move more during the day',
                'Make time for mindful breaks',
              ].map((goal) => (
                <button
                  key={goal}
                  className={cx(goalDraft === goal && 'selected')}
                  onClick={() => setGoalDraft(goal)}
                >
                  <span>{goal}</span>
                  {goalDraft === goal && <Check size={16} />}
                </button>
              ))}
            </div>
            <div className="modal-actions">
              <Button
                variant="secondary"
                onClick={() => {
                  setGoalDraft(settings.goal)
                  setGoalOpen(false)
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setSettings((current) => ({ ...current, goal: goalDraft }))
                  setGoalOpen(false)
                  toast('Wellness goal updated')
                }}
              >
                Save goal
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function BottomNav({ screen, navigate }: { screen: Screen; navigate: (s: Screen) => void }) {
  return (
    <nav className="bottom-nav" aria-label="Primary navigation">
      {navItems.map((item) => (
        <button
          key={item.screen}
          className={cx(screen === item.screen && 'active')}
          onClick={() => navigate(item.screen)}
          aria-current={screen === item.screen ? 'page' : undefined}
        >
          <item.icon size={21} strokeWidth={screen === item.screen ? 2.5 : 1.8} />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  )
}

const habitIcons: Record<BetaHabit['kind'], typeof Moon> = {
  sleep: Moon,
  activity: Footprints,
  breathing: Wind,
  hydration: Droplets,
  journal: BookHeart,
}

const DEFAULT_HABITS: Habit[] = [
  { name: 'Sleep routine', kind: 'sleep', icon: Moon, done: false, streak: 0 },
  { name: 'Physical activity', kind: 'activity', icon: Footprints, done: false, streak: 0 },
  { name: 'Mindful breathing', kind: 'breathing', icon: Wind, done: false, streak: 0 },
  { name: 'Hydration', kind: 'hydration', icon: Droplets, done: false, streak: 0 },
  { name: 'Journaling', kind: 'journal', icon: BookHeart, done: false, streak: 0 },
]

export default function App({ initialData }: { initialData: BetaData }) {
  const initialCheckIns = initialData.checkIns ?? []
  const initialHealthRecords = initialData.healthRecords ?? []
  const initialHabitLogs = initialData.habitLogs ?? []
  const todayKey = initialData.todayKey || '1970-01-01'
  const latestCheckIn = initialCheckIns[0]
  const initialPreferences = initialData.user?.preferences
  const [checkedInToday, setCheckedInToday] = useState(
    Boolean(
      todayKey !== '1970-01-01' &&
      initialCheckIns.some((entry) => entry.createdAt.slice(0, 10) === todayKey),
    ),
  )
  const [checkInDays, setCheckInDays] = useState(
    new Set(initialCheckIns.map((entry) => entry.createdAt.slice(0, 10))).size,
  )
  const [hasWellnessData, setHasWellnessData] = useState(
    initialCheckIns.length > 0 || Boolean(initialData.latestAssessment),
  )
  const [hasAssessment, setHasAssessment] = useState(Boolean(initialData.latestAssessment))
  const [authenticated, setAuthenticated] = useState(initialData.authenticated)
  const [screen, setScreen] = useState<Screen>(initialData.authenticated ? 'home' : 'splash')
  const [navHistory, setNavHistory] = useState<Screen[]>([])
  const [mood, setMood] = useState<Mood>(latestCheckIn?.mood || 'Neutral')
  const [stress, setStress] = useState(
    latestCheckIn?.stress || initialData.latestAssessment?.stressScore || 5,
  )
  const [sleepQuality, setSleepQuality] = useState(latestCheckIn?.sleep ?? 2)
  const [energy, setEnergy] = useState(latestCheckIn?.energy ?? 2)
  const [history, setHistory] = useState<{ mood: Mood; stress: number; time: string }[]>(
    initialCheckIns.map((entry) => ({
      mood: entry.mood,
      stress: entry.stress,
      time: new Date(entry.createdAt).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'UTC',
      }),
    })),
  )
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>(initialHabitLogs)
  const [habits, setHabits] = useState<Habit[]>(() => {
    const source = initialData.user?.habits?.length ? initialData.user.habits : DEFAULT_HABITS
    return source.map((habit) => ({
      ...habit,
      icon: habitIcons[habit.kind],
      done: initialHabitLogs.some(
        (log) => log.habitKind === habit.kind && log.completedOn === todayKey,
      ),
      streak: getHabitStreak(initialHabitLogs, habit.kind, todayKey),
    }))
  })
  const [completed, setCompleted] = useState<string[]>(
    initialData.user?.completedRecommendations || [],
  )
  const [dark, setDark] = useState(initialPreferences?.darkMode === true)
  const [messages, setMessages] = useState<Message[]>([...INITIAL_CHAT_MESSAGES])
  const [healthRecords, setHealthRecords] = useState<HealthRecord[]>(initialHealthRecords)
  const [trustedContact, setTrustedContact] = useState(
    initialData.user?.trustedContact || 'Add a trusted contact',
  )
  const [privacy, setPrivacy] = useState<PrivacySettings>({
    mood: initialPreferences?.showMoodHistory !== false,
    wearable: initialPreferences?.wearableData === true,
    chat: initialPreferences?.chatHistory === true,
  })
  const [profile, setProfile] = useState<ProfileSettings>({
    name: initialData.user?.name || DEFAULT_PROFILE_SETTINGS.name,
    notifications: initialPreferences?.notifications !== false,
    largeText: initialPreferences?.largeText === true,
    reminder: initialPreferences?.reminder || '20:30',
    goal: initialData.user?.goal || DEFAULT_PROFILE_SETTINGS.goal,
  })
  const safeProfile: ProfileSettings =
    profile && typeof profile === 'object'
      ? { ...DEFAULT_PROFILE_SETTINGS, ...profile }
      : DEFAULT_PROFILE_SETTINGS
  const [toast, setToast] = useState('')
  const toastTimer = useRef<number | null>(null)
  const profileSyncReady = useRef(false)

  useEffect(() => {
    if (screen === 'splash') {
      const id = window.setTimeout(() => setScreen('onboarding'), 1700)
      return () => window.clearTimeout(id)
    }
  }, [screen])
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])
  useEffect(() => {
    document.documentElement.classList.toggle('large-text', safeProfile.largeText)
  }, [safeProfile.largeText])
  useEffect(() => {
    if (!privacy.chat) {
      setMessages([
        {
          from: 'assistant',
          text: 'Chat history is off. Messages remain only in this browser session.',
        },
      ])
    }
  }, [privacy.chat])
  useEffect(() => {
    profileSyncReady.current = false
    if (!authenticated) return
    const id = window.setTimeout(() => {
      profileSyncReady.current = true
    }, 1200)
    return () => window.clearTimeout(id)
  }, [authenticated])
  useEffect(() => {
    if (!authenticated || !profileSyncReady.current) return
    const id = window.setTimeout(() => {
      void updateProfileAction({
        name: safeProfile.name,
        goal: safeProfile.goal,
        trustedContact,
        preferences: {
          notifications: safeProfile.notifications,
          largeText: safeProfile.largeText,
          darkMode: dark,
          reminder: safeProfile.reminder,
          showMoodHistory: privacy.mood,
          wearableData: privacy.wearable,
          chatHistory: privacy.chat,
        },
        habits: habits.map(({ name, kind, done, streak }) => ({ name, kind, done, streak })),
        completedRecommendations: completed,
      }).catch(() => {
        notify('Your preference change could not be synced. Please try again.')
      })
    }, 650)
    return () => window.clearTimeout(id)
  }, [authenticated, completed, dark, habits, privacy, profile, trustedContact])
  const notify = (message: string) => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    setToast(message)
    toastTimer.current = window.setTimeout(() => setToast(''), 2400)
  }
  const navigate = (next: Screen, options?: { backTo?: Screen }) => {
    if (next === screen) return
    if (screensWithNav.includes(next)) {
      setNavHistory([])
    } else {
      setNavHistory((current) => [...current, options?.backTo || screen].slice(-20))
    }
    setScreen(next)
    window.scrollTo(0, 0)
  }
  const back = () => {
    const previous = navHistory[navHistory.length - 1] || 'home'
    setNavHistory((current) => current.slice(0, -1))
    setScreen(previous)
    window.scrollTo(0, 0)
  }
  const moodWeight = { 'Very Happy': -6, Calm: -4, Neutral: 0, Anxious: 7, Sad: 5 }[mood]
  const activityWeight = habits.find((habit) => habit.name === 'Physical activity')?.done ? -3 : 4
  const prediction = useMemo(
    () =>
      Math.min(
        88,
        Math.max(
          28,
          Math.round(
            27 +
              stress * 4 +
              (3 - sleepQuality) * 5 +
              (3 - energy) * 4 +
              moodWeight +
              activityWeight,
          ),
        ),
      ),
    [stress, sleepQuality, energy, moodWeight, activityWeight],
  )
  const factors = useMemo(() => {
    const list = []
    if (sleepQuality < 3) list.push('Reduced sleep')
    if (mood === 'Anxious' || mood === 'Sad') list.push('Recent mood changes')
    if (stress >= 6) list.push('Increased workload')
    if (!habits.find((h) => h.name === 'Physical activity')?.done)
      list.push('Reduced physical activity')
    return list.length ? list : ['Changing daily routine']
  }, [sleepQuality, mood, stress, habits])

  const saveCheckIn = async (data: {
    mood: Mood
    stress: number
    sleep: number
    energy: number
    tags: string[]
    note: string
  }) => {
    let result
    try {
      result = await saveCheckInAction(data)
    } catch {
      notify('The server took too long to respond. Please try again.')
      return
    }
    if (!result.ok) {
      notify(result.message || 'Unable to save your check-in.')
      return
    }
    setMood(data.mood)
    setStress(data.stress)
    setSleepQuality(data.sleep)
    setEnergy(data.energy)
    setHasWellnessData(true)
    setCheckedInToday(true)
    setCheckInDays((current) => current + 1)
    setHistory((current) => [
      { mood: data.mood, stress: data.stress, time: 'Just now' },
      ...current,
    ])
    notify('Check-in saved securely. Your outlook was recalculated.')
    navigate('prediction', { backTo: 'home' })
  }
  const submitAssessment = async (answers: number[]) => {
    const calculated = Math.round(
      (answers[0] + (11 - answers[1]) + (11 - answers[2]) + (11 - answers[3]) + (11 - answers[4])) /
        5,
    )
    let result
    try {
      result = await saveAssessmentAction({ answers, outlookScore: prediction, factors })
    } catch {
      notify('The server took too long to respond. Please try again.')
      return
    }
    if (!result.ok) {
      notify(result.message || 'Unable to save your assessment.')
      return
    }
    setStress(calculated)
    setHasWellnessData(true)
    setHasAssessment(true)
    notify(`Assessment saved: ${calculated}/10 stress score`)
    navigate('prediction', { backTo: 'home' })
  }
  const toggleHabit = async (index: number) => {
    const habit = habits[index]
    if (!habit) return
    const completed = !habit.done
    let result
    try {
      result = await setHabitCompletionAction({
        habitKind: habit.kind,
        completed,
        completedOn: todayKey,
      })
    } catch {
      notify('The server took too long to save your habit. Please try again.')
      return
    }
    if (!result.ok) {
      notify(result.message || 'Unable to save habit progress.')
      return
    }
    const nextLogs = completed
      ? [
          ...habitLogs,
          {
            id: `local-${habit.kind}-${todayKey}`,
            habitKind: habit.kind,
            completedOn: todayKey,
          },
        ]
      : habitLogs.filter((log) => !(log.habitKind === habit.kind && log.completedOn === todayKey))
    setHabitLogs(nextLogs)
    setHabits((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              done: completed,
              streak: getHabitStreak(nextLogs, item.kind, todayKey),
            }
          : item,
      ),
    )
    notify(completed ? 'Habit completed for today' : 'Habit completion removed')
  }
  const completeBreathing = () => {
    setCompleted((current) =>
      current.includes('Five-minute breathing exercise')
        ? current
        : [...current, 'Five-minute breathing exercise'],
    )
    const breathingIndex = habits.findIndex((habit) => habit.kind === 'breathing')
    if (breathingIndex >= 0 && !habits[breathingIndex].done) void toggleHabit(breathingIndex)
  }
  const saveHealthRecord = async (record: {
    recordedOn: string
    steps?: number
    activeMinutes?: number
    sleepMinutes?: number
    restingHeartRate?: number
    hrv?: number
  }) => {
    let result
    try {
      result = await saveHealthRecordAction(record)
    } catch {
      notify('The server took too long to respond. Please try again.')
      return false
    }
    if (!result.ok) {
      notify(result.message || 'Unable to save your health entry.')
      return false
    }
    setHealthRecords((current) => [
      {
        source: 'manual',
        recordedOn: new Date(record.recordedOn).toISOString(),
        steps: record.steps ?? null,
        activeMinutes: record.activeMinutes ?? null,
        sleepMinutes: record.sleepMinutes ?? null,
        restingHeartRate: record.restingHeartRate ?? null,
        hrv: record.hrv ?? null,
      },
      ...current,
    ])
    setPrivacy((current) => ({ ...current, wearable: true }))
    return true
  }
  const deleteWellnessData = async () => {
    let result
    try {
      result = await deleteWellnessDataAction()
    } catch {
      notify('The server took too long to respond. Please try again.')
      return
    }
    if (!result.ok) {
      notify(result.message || 'Unable to delete your wellness data.')
      return
    }
    setMood('Neutral')
    setStress(5)
    setSleepQuality(2)
    setEnergy(2)
    setHistory([])
    setHasWellnessData(false)
    setHasAssessment(false)
    setCheckedInToday(false)
    setCheckInDays(0)
    setHabits((current) => current.map((habit) => ({ ...habit, done: false, streak: 0 })))
    setHabitLogs([])
    setCompleted([])
    setMessages([
      { from: 'assistant', text: 'Your chat history was cleared. How can I support you now?' },
    ])
    setHealthRecords([])
    setTrustedContact('Add a trusted contact')
    setProfile({
      name: 'MindEase User',
      notifications: false,
      largeText: false,
      reminder: '20:30',
      goal: 'Choose a new wellness goal',
    })
    setDark(false)
    notify('Your stored check-ins and assessments were deleted')
  }
  const signOut = async () => {
    try {
      await signOutAction()
    } catch {
      notify('Unable to sign out right now. Please try again.')
      return
    }
    setAuthenticated(false)
    setNavHistory([])
    setScreen('signin')
    notify('Signed out securely')
  }
  let content: ReactNode
  if (screen === 'splash') content = <Splash />
  else if (screen === 'onboarding') content = <Onboarding onDone={() => navigate('signin')} />
  else if (screen === 'signin')
    content = <SignIn onAuthenticated={() => window.location.reload()} />
  else if (screen === 'home')
    content = (
      <HomeScreen
        navigate={navigate}
        name={safeProfile.name}
        mood={mood}
        stress={stress * 10}
        prediction={prediction}
        habitsDone={habits.filter((h) => h.done).length}
        health={healthRecords[0]}
        hasWellnessData={hasWellnessData}
        checkedInToday={checkedInToday}
        hasAssessment={hasAssessment}
        stressHistory={history
          .slice(0, 7)
          .reverse()
          .map((entry) => entry.stress * 10)}
      />
    )
  else if (screen === 'checkin')
    content = (
      <CheckInScreen
        initialMood={mood}
        onSave={saveCheckIn}
        navigate={navigate}
        completedToday={checkedInToday}
        assessmentCompleted={hasAssessment}
      />
    )
  else if (screen === 'assessment')
    content = <AssessmentScreen onSubmit={submitAssessment} back={back} />
  else if (screen === 'prediction')
    content = (
      <PredictionScreen
        score={prediction}
        factors={factors}
        back={back}
        navigate={navigate}
        checkInDays={checkInDays}
        historyScores={history.map((entry) => entry.stress * 10)}
      />
    )
  else if (screen === 'insights')
    content = (
      <InsightsScreen
        mood={mood}
        history={privacy.mood ? history : []}
        healthRecords={healthRecords}
        habitLogs={habitLogs}
        todayKey={todayKey}
      />
    )
  else if (screen === 'chat')
    content = (
      <ChatScreen
        stress={stress}
        navigate={navigate}
        messages={messages}
        setMessages={setMessages}
      />
    )
  else if (screen === 'breathing')
    content = <BreathingScreen back={back} onComplete={completeBreathing} />
  else if (screen === 'recommendations')
    content = (
      <RecommendationsScreen
        completed={completed}
        toggle={(s) => {
          setCompleted((c) => (c.includes(s) ? c.filter((x) => x !== s) : [...c, s]))
          notify('Recommendation progress updated')
        }}
        navigate={navigate}
        back={back}
        mood={mood}
        prediction={prediction}
        factors={factors}
        hasWellnessData={hasWellnessData}
      />
    )
  else if (screen === 'habits')
    content = (
      <HabitsScreen
        habits={habits}
        toggle={toggleHabit}
        back={back}
        logs={habitLogs}
        todayKey={todayKey}
      />
    )
  else if (screen === 'wearables')
    content = (
      <WearablesScreen
        back={back}
        toast={notify}
        records={healthRecords}
        onSave={saveHealthRecord}
      />
    )
  else if (screen === 'support')
    content = (
      <SupportScreen
        back={back}
        navigate={navigate}
        toast={notify}
        contact={trustedContact}
        setContact={setTrustedContact}
      />
    )
  else if (screen === 'privacy')
    content = (
      <PrivacyScreen
        back={back}
        toast={notify}
        settings={privacy}
        setSettings={setPrivacy}
        onDelete={deleteWellnessData}
        exportData={{
          profile: safeProfile,
          privacy,
          habits: habits.map(({ icon: _icon, ...habit }) => habit),
          checkIns: history,
          healthRecords,
          habitLogs,
          completedRecommendations: completed,
        }}
      />
    )
  else
    content = (
      <ProfileScreen
        dark={dark}
        setDark={setDark}
        navigate={navigate}
        onSignOut={signOut}
        toast={notify}
        email={initialData.user?.email || ''}
        settings={safeProfile}
        setSettings={setProfile}
      />
    )

  const showNav = screensWithNav.includes(screen)
  return (
    <div className={cx('app-canvas', dark && 'dark-mode')}>
      <div className={cx('phone-shell', showNav && 'has-nav')}>
        {content}
        {showNav && <BottomNav screen={screen} navigate={navigate} />}
        {toast && <Toast message={toast} />}
      </div>
    </div>
  )
}
