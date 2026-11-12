import type { Access, CollectionConfig } from 'payload'

const isSelf: Access = ({ req }) => {
  if (req.user?.collection === 'admins') return true
  if (req.user?.collection !== 'users') return false
  return { id: { equals: req.user.id } }
}

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    hidden: true,
    useAsTitle: 'email',
  },
  auth: true,
  access: {
    create: () => true,
    delete: isSelf,
    read: isSelf,
    update: isSelf,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      maxLength: 80,
    },
    {
      name: 'goal',
      type: 'text',
      defaultValue: 'Build a calmer daily routine',
      maxLength: 120,
    },
    {
      name: 'preferences',
      type: 'group',
      fields: [
        { name: 'notifications', type: 'checkbox', defaultValue: true },
        { name: 'largeText', type: 'checkbox', defaultValue: false },
        { name: 'darkMode', type: 'checkbox', defaultValue: false },
        { name: 'reminder', type: 'text', defaultValue: '20:30', maxLength: 5 },
        { name: 'showMoodHistory', type: 'checkbox', defaultValue: true },
        { name: 'wearableData', type: 'checkbox', defaultValue: false },
        { name: 'chatHistory', type: 'checkbox', defaultValue: false },
      ],
    },
    {
      name: 'trustedContact',
      type: 'text',
      maxLength: 120,
    },
    {
      name: 'habits',
      type: 'array',
      maxRows: 10,
      fields: [
        { name: 'name', type: 'text', required: true, maxLength: 60 },
        {
          name: 'kind',
          type: 'select',
          required: true,
          options: ['sleep', 'activity', 'breathing', 'hydration', 'journal'],
        },
        { name: 'done', type: 'checkbox', defaultValue: false },
        { name: 'streak', type: 'number', defaultValue: 0, min: 0, max: 3650 },
      ],
    },
    {
      name: 'completedRecommendations',
      type: 'array',
      maxRows: 20,
      fields: [{ name: 'title', type: 'text', required: true, maxLength: 120 }],
    },
  ],
  versions: false,
}
