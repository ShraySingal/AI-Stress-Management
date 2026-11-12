export type Mood = 'Very Happy' | 'Calm' | 'Neutral' | 'Anxious' | 'Sad'

export type BetaHabit = {
  name: string
  kind: 'sleep' | 'activity' | 'breathing' | 'hydration' | 'journal'
  done: boolean
  streak: number
}

export type BetaData = {
  authenticated: boolean
  todayKey: string
  user: {
    name: string
    email: string
    goal: string
    trustedContact: string
    preferences: {
      notifications: boolean
      largeText: boolean
      darkMode: boolean
      reminder: string
      showMoodHistory: boolean
      wearableData: boolean
      chatHistory: boolean
    }
    habits: BetaHabit[]
    completedRecommendations: string[]
  } | null
  checkIns: Array<{
    mood: Mood
    stress: number
    sleep: number
    energy: number
    tags: string[]
    note: string
    createdAt: string
  }>
  latestAssessment: {
    stressScore: number
    outlookScore: number
    factors: string[]
  } | null
  healthRecords: Array<{
    source: 'manual' | 'health-connect' | 'healthkit'
    recordedOn: string
    steps: number | null
    activeMinutes: number | null
    sleepMinutes: number | null
    restingHeartRate: number | null
    hrv: number | null
  }>
  habitLogs: Array<{
    id: string | number
    habitKind: BetaHabit['kind']
    completedOn: string
  }>
}

export type ActionResult = {
  ok: boolean
  message?: string
  data?: BetaData
}
