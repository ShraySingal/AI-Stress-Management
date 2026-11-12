'use server'

import config from '@payload-config'
import { getPayload } from 'payload'
import { currentAppUser, loginAppUser, logoutAppUser } from '@/lib/app-auth'
import type { ActionResult, BetaData, BetaHabit, Mood } from '@/lib/mindease-types'

const MOODS: Mood[] = ['Very Happy', 'Calm', 'Neutral', 'Anxious', 'Sad']
const TAGS = ['Study', 'Work', 'Family', 'Health', 'Social', 'Rest'] as const
const HABIT_KINDS = ['sleep', 'activity', 'breathing', 'hydration', 'journal'] as const

const defaultHabits: BetaHabit[] = [
  { name: 'Sleep routine', kind: 'sleep', done: false, streak: 0 },
  { name: 'Physical activity', kind: 'activity', done: false, streak: 0 },
  { name: 'Mindful breathing', kind: 'breathing', done: false, streak: 0 },
  { name: 'Hydration', kind: 'hydration', done: false, streak: 0 },
  { name: 'Journaling', kind: 'journal', done: false, streak: 0 },
]

const text = (value: unknown, max: number) =>
  typeof value === 'string' ? value.trim().slice(0, max) : ''

function messageFrom(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  if (/email|password|login|credentials/i.test(message)) {
    return 'Check your email and password, then try again.'
  }
  return 'Something went wrong. Please try again.'
}

export async function loadBetaData(): Promise<BetaData> {
  const todayKey = new Date().toISOString().slice(0, 10)
  const user = await currentAppUser()
  if (!user)
    return {
      authenticated: false,
      todayKey,
      user: null,
      checkIns: [],
      latestAssessment: null,
      healthRecords: [],
      habitLogs: [],
    }

  const payload = await getPayload({ config })
  const [checkIns, assessments, healthRecords, habitLogs] = await Promise.all([
    payload.find({
      collection: 'check-ins',
      limit: 30,
      sort: '-createdAt',
      user,
      overrideAccess: false,
    }),
    payload.find({
      collection: 'assessments',
      limit: 1,
      sort: '-createdAt',
      user,
      overrideAccess: false,
    }),
    payload.find({
      collection: 'health-records',
      limit: 30,
      sort: '-recordedOn',
      user,
      overrideAccess: false,
    }),
    payload.find({
      collection: 'habit-logs',
      limit: 180,
      sort: '-completedOn',
      user,
      overrideAccess: false,
    }),
  ])

  const preferences = user.preferences ?? {}
  return {
    authenticated: true,
    todayKey,
    user: {
      name: user.name,
      email: user.email,
      goal: user.goal || 'Build a calmer daily routine',
      trustedContact: user.trustedContact || 'Add a trusted contact',
      preferences: {
        notifications: preferences.notifications !== false,
        largeText: preferences.largeText === true,
        darkMode: preferences.darkMode === true,
        reminder: preferences.reminder || '20:30',
        showMoodHistory: preferences.showMoodHistory !== false,
        wearableData: preferences.wearableData === true,
        chatHistory: preferences.chatHistory === true,
      },
      habits: (user.habits?.length ? user.habits : defaultHabits).map((habit) => ({
        name: habit.name,
        kind: habit.kind,
        done: habit.done === true,
        streak: habit.streak || 0,
      })),
      completedRecommendations: user.completedRecommendations?.map((item) => item.title) ?? [],
    },
    checkIns: checkIns.docs.map((entry) => ({
      mood: entry.mood,
      stress: entry.stress,
      sleep: entry.sleep,
      energy: entry.energy,
      tags: entry.tags ?? [],
      note: entry.note ?? '',
      createdAt: entry.createdAt,
    })),
    latestAssessment: assessments.docs[0]
      ? {
          stressScore: assessments.docs[0].stressScore,
          outlookScore: assessments.docs[0].outlookScore,
          factors: assessments.docs[0].factors?.map((item) => item.label) ?? [],
        }
      : null,
    healthRecords: healthRecords.docs.map((record) => ({
      source: record.source,
      recordedOn: record.recordedOn,
      steps: record.steps ?? null,
      activeMinutes: record.activeMinutes ?? null,
      sleepMinutes: record.sleepMinutes ?? null,
      restingHeartRate: record.restingHeartRate ?? null,
      hrv: record.hrv ?? null,
    })),
    habitLogs: habitLogs.docs.map((log) => ({
      id: log.id,
      habitKind: log.habitKind,
      completedOn: log.completedOn,
    })),
  }
}

export async function signInAction(input: {
  email: string
  password: string
}): Promise<ActionResult> {
  try {
    const email = text(input.email, 200).toLowerCase()
    const password = typeof input.password === 'string' ? input.password : ''
    if (!email.includes('@') || !password) {
      return { ok: false, message: 'Enter a valid email and password.' }
    }
    await loginAppUser(email, password)
    return { ok: true }
  } catch (error) {
    return { ok: false, message: messageFrom(error) }
  }
}

export async function signUpAction(input: {
  name: string
  email: string
  password: string
}): Promise<ActionResult> {
  try {
    const name = text(input.name, 80)
    const email = text(input.email, 200).toLowerCase()
    const password = typeof input.password === 'string' ? input.password : ''
    if (name.length < 2) return { ok: false, message: 'Enter your name.' }
    if (!email.includes('@')) return { ok: false, message: 'Enter a valid email address.' }
    if (password.length < 8)
      return { ok: false, message: 'Use at least 8 characters for your password.' }

    const payload = await getPayload({ config })
    await payload.create({
      collection: 'users',
      data: {
        name,
        email,
        password,
        habits: defaultHabits,
      },
      overrideAccess: false,
    })
    await loginAppUser(email, password)
    return { ok: true }
  } catch (error) {
    const duplicate = error instanceof Error && /unique|already|duplicate/i.test(error.message)
    return {
      ok: false,
      message: duplicate ? 'An account with this email already exists.' : messageFrom(error),
    }
  }
}

export async function signOutAction(): Promise<ActionResult> {
  await logoutAppUser()
  return { ok: true }
}

export async function saveCheckInAction(input: {
  mood: Mood
  stress: number
  sleep: number
  energy: number
  tags: string[]
  note: string
}): Promise<ActionResult> {
  const user = await currentAppUser()
  if (!user) return { ok: false, message: 'Please sign in again.' }
  if (!MOODS.includes(input.mood)) return { ok: false, message: 'Choose a valid mood.' }

  const stress = Math.round(Number(input.stress))
  const sleep = Math.round(Number(input.sleep))
  const energy = Math.round(Number(input.energy))
  if (stress < 1 || stress > 10 || sleep < 0 || sleep > 3 || energy < 0 || energy > 3) {
    return { ok: false, message: 'One or more check-in values are invalid.' }
  }

  const payload = await getPayload({ config })
  const startOfToday = new Date()
  startOfToday.setUTCHours(0, 0, 0, 0)
  const startOfTomorrow = new Date(startOfToday)
  startOfTomorrow.setUTCDate(startOfTomorrow.getUTCDate() + 1)
  const existing = await payload.find({
    collection: 'check-ins',
    limit: 1,
    where: {
      and: [
        { owner: { equals: user.id } },
        {
          createdAt: {
            greater_than_equal: startOfToday.toISOString(),
            less_than: startOfTomorrow.toISOString(),
          },
        },
      ],
    },
    user,
    overrideAccess: false,
  })
  if (existing.docs.length) {
    return { ok: false, message: 'Today’s check-in is already complete.' }
  }
  await payload.create({
    collection: 'check-ins',
    data: {
      owner: user.id,
      mood: input.mood,
      stress,
      sleep,
      energy,
      tags: Array.isArray(input.tags)
        ? input.tags
            .filter((tag): tag is (typeof TAGS)[number] =>
              TAGS.includes(tag as (typeof TAGS)[number]),
            )
            .slice(0, 6)
        : [],
      note: text(input.note, 2000),
    },
    user,
    overrideAccess: false,
  })
  return { ok: true }
}

export async function saveAssessmentAction(input: {
  answers: number[]
  outlookScore: number
  factors: string[]
}): Promise<ActionResult> {
  const user = await currentAppUser()
  if (!user) return { ok: false, message: 'Please sign in again.' }
  if (!Array.isArray(input.answers) || input.answers.length !== 5) {
    return { ok: false, message: 'Complete all five assessment questions.' }
  }
  const answers = input.answers.map((answer) =>
    Math.max(1, Math.min(10, Math.round(Number(answer)))),
  )
  const stressScore = Math.round(
    (answers[0] + (11 - answers[1]) + (11 - answers[2]) + (11 - answers[3]) + (11 - answers[4])) /
      5,
  )
  const payload = await getPayload({ config })
  await payload.create({
    collection: 'assessments',
    data: {
      owner: user.id,
      answers: answers.map((value) => ({ value })),
      stressScore,
      outlookScore: Math.max(0, Math.min(100, Math.round(Number(input.outlookScore)))),
      factors: (Array.isArray(input.factors) ? input.factors : [])
        .slice(0, 8)
        .map((label) => ({ label: text(label, 100) })),
    },
    user,
    overrideAccess: false,
  })
  return { ok: true }
}

export async function updateProfileAction(input: {
  name: string
  goal: string
  trustedContact: string
  preferences: BetaData['user'] extends infer U
    ? U extends { preferences: infer P }
      ? P
      : never
    : never
  habits: BetaHabit[]
  completedRecommendations: string[]
}): Promise<ActionResult> {
  const user = await currentAppUser()
  if (!user) return { ok: false, message: 'Please sign in again.' }

  const habits = (Array.isArray(input.habits) ? input.habits : [])
    .slice(0, 10)
    .filter((habit) => HABIT_KINDS.includes(habit.kind))
    .map((habit) => ({
      name: text(habit.name, 60),
      kind: habit.kind,
      done: habit.done === true,
      streak: Math.max(0, Math.min(3650, Math.round(Number(habit.streak) || 0))),
    }))

  const payload = await getPayload({ config })
  await payload.update({
    collection: 'users',
    id: user.id,
    data: {
      name: text(input.name, 80) || user.name,
      goal: text(input.goal, 120),
      trustedContact: text(input.trustedContact, 120),
      preferences: {
        notifications: input.preferences?.notifications === true,
        largeText: input.preferences?.largeText === true,
        darkMode: input.preferences?.darkMode === true,
        reminder: /^\d{2}:\d{2}$/.test(input.preferences?.reminder ?? '')
          ? input.preferences.reminder
          : '20:30',
        showMoodHistory: input.preferences?.showMoodHistory === true,
        wearableData: input.preferences?.wearableData === true,
        chatHistory: input.preferences?.chatHistory === true,
      },
      habits,
      completedRecommendations: (Array.isArray(input.completedRecommendations)
        ? input.completedRecommendations
        : []
      )
        .slice(0, 20)
        .map((title) => ({ title: text(title, 120) })),
    },
    user,
    overrideAccess: false,
  })
  return { ok: true }
}

export async function deleteWellnessDataAction(): Promise<ActionResult> {
  const user = await currentAppUser()
  if (!user) return { ok: false, message: 'Please sign in again.' }
  const payload = await getPayload({ config })
  await Promise.all([
    payload.delete({
      collection: 'check-ins',
      where: { owner: { equals: user.id } },
      user,
      overrideAccess: false,
    }),
    payload.delete({
      collection: 'assessments',
      where: { owner: { equals: user.id } },
      user,
      overrideAccess: false,
    }),
    payload.delete({
      collection: 'health-records',
      where: { owner: { equals: user.id } },
      user,
      overrideAccess: false,
    }),
    payload.delete({
      collection: 'habit-logs',
      where: { owner: { equals: user.id } },
      user,
      overrideAccess: false,
    }),
  ])
  return { ok: true }
}

export async function setHabitCompletionAction(input: {
  habitKind: BetaHabit['kind']
  completed: boolean
  completedOn: string
}): Promise<ActionResult> {
  try {
    const user = await currentAppUser()
    if (!user) return { ok: false, message: 'Please sign in again.' }
    if (!HABIT_KINDS.includes(input.habitKind)) {
      return { ok: false, message: 'Choose a valid habit.' }
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.completedOn)) {
      return { ok: false, message: 'The completion date is invalid.' }
    }

    const payload = await getPayload({ config })
    const existing = await payload.find({
      collection: 'habit-logs',
      limit: 10,
      where: {
        and: [
          { owner: { equals: user.id } },
          { habitKind: { equals: input.habitKind } },
          { completedOn: { equals: input.completedOn } },
        ],
      },
      user,
      overrideAccess: false,
    })

    if (input.completed && !existing.docs.length) {
      await payload.create({
        collection: 'habit-logs',
        data: {
          owner: user.id,
          habitKind: input.habitKind,
          completedOn: input.completedOn,
        },
        user,
        overrideAccess: false,
      })
    } else if (!input.completed && existing.docs.length) {
      await payload.delete({
        collection: 'habit-logs',
        where: {
          id: { in: existing.docs.map((doc) => doc.id) },
        },
        user,
        overrideAccess: false,
      })
    }
    return { ok: true }
  } catch {
    return { ok: false, message: 'Habit progress could not be saved. Please try again.' }
  }
}

export async function saveHealthRecordAction(input: {
  recordedOn: string
  steps?: number
  activeMinutes?: number
  sleepMinutes?: number
  restingHeartRate?: number
  hrv?: number
}): Promise<ActionResult> {
  try {
    const user = await currentAppUser()
    if (!user) return { ok: false, message: 'Please sign in again.' }
    const recordedOn = new Date(input.recordedOn)
    if (Number.isNaN(recordedOn.getTime())) {
      return { ok: false, message: 'Choose a valid date.' }
    }

    const value = (inputValue: number | undefined, min: number, max: number) => {
      if (inputValue === undefined || inputValue === null) return null
      const parsed = Math.round(Number(inputValue))
      return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null
    }
    const data = {
      owner: user.id,
      source: 'manual' as const,
      recordedOn: recordedOn.toISOString(),
      steps: value(input.steps, 0, 200000),
      activeMinutes: value(input.activeMinutes, 0, 1440),
      sleepMinutes: value(input.sleepMinutes, 0, 1440),
      restingHeartRate: value(input.restingHeartRate, 20, 250),
      hrv: value(input.hrv, 1, 500),
    }
    if (
      data.steps === null &&
      data.activeMinutes === null &&
      data.sleepMinutes === null &&
      data.restingHeartRate === null &&
      data.hrv === null
    ) {
      return { ok: false, message: 'Enter at least one health value.' }
    }

    const payload = await getPayload({ config })
    await payload.create({
      collection: 'health-records',
      data,
      user,
      overrideAccess: false,
    })
    return { ok: true }
  } catch {
    return { ok: false, message: 'Your health entry could not be saved. Please try again.' }
  }
}
