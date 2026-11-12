import type { Access, CollectionConfig } from 'payload'

const owned: Access = ({ req }) => {
  if (req.user?.collection === 'admins') return true
  if (req.user?.collection !== 'users') return false
  return { owner: { equals: req.user.id } }
}

export const CheckIns: CollectionConfig = {
  slug: 'check-ins',
  admin: {
    group: 'MindEase Beta',
    useAsTitle: 'mood',
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
      name: 'mood',
      type: 'select',
      required: true,
      options: ['Very Happy', 'Calm', 'Neutral', 'Anxious', 'Sad'],
    },
    { name: 'stress', type: 'number', required: true, min: 1, max: 10 },
    { name: 'sleep', type: 'number', required: true, min: 0, max: 3 },
    { name: 'energy', type: 'number', required: true, min: 0, max: 3 },
    {
      name: 'tags',
      type: 'select',
      hasMany: true,
      options: ['Study', 'Work', 'Family', 'Health', 'Social', 'Rest'],
    },
    { name: 'note', type: 'textarea', maxLength: 2000 },
  ],
  versions: false,
}
