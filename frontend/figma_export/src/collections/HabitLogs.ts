import type { Access, CollectionConfig } from 'payload'

const owned: Access = ({ req }) => {
  if (req.user?.collection === 'admins') return true
  if (req.user?.collection !== 'users') return false
  return { owner: { equals: req.user.id } }
}

export const HabitLogs: CollectionConfig = {
  slug: 'habit-logs',
  admin: {
    group: 'MindEase Beta',
    useAsTitle: 'completedOn',
  },
  access: {
    create: ({ req }) => req.user?.collection === 'users',
    delete: owned,
    read: owned,
    update: owned,
  },
  hooks: {
    beforeValidate: [
      ({ data, operation, req }) => {
        if (operation === 'create' && req.user?.collection === 'users') {
          return { ...data, owner: req.user.id }
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'owner',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      access: {
        create: ({ req }) => req.user?.collection === 'users',
        update: () => false,
      },
    },
    {
      name: 'habitKind',
      type: 'select',
      required: true,
      index: true,
      options: ['sleep', 'activity', 'breathing', 'hydration', 'journal'],
    },
    {
      name: 'completedOn',
      type: 'text',
      required: true,
      index: true,
      maxLength: 10,
    },
  ],
  versions: false,
}
