import type { Access, CollectionConfig } from 'payload'

const owned: Access = ({ req }) => {
  if (req.user?.collection === 'admins') return true
  if (req.user?.collection !== 'users') return false
  return { owner: { equals: req.user.id } }
}

export const Assessments: CollectionConfig = {
  slug: 'assessments',
  admin: {
    group: 'MindEase Beta',
    useAsTitle: 'createdAt',
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
      name: 'answers',
      type: 'array',
      required: true,
      minRows: 5,
      maxRows: 5,
      fields: [{ name: 'value', type: 'number', required: true, min: 1, max: 10 }],
    },
    { name: 'stressScore', type: 'number', required: true, min: 1, max: 10 },
    { name: 'outlookScore', type: 'number', required: true, min: 0, max: 100 },
    {
      name: 'factors',
      type: 'array',
      maxRows: 8,
      fields: [{ name: 'label', type: 'text', required: true, maxLength: 100 }],
    },
  ],
  versions: false,
}
