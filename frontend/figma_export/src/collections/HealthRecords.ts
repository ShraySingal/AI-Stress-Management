import type { Access, CollectionConfig } from 'payload'

const owned: Access = ({ req }) => {
  if (req.user?.collection === 'admins') return true
  if (req.user?.collection !== 'users') return false
  return { owner: { equals: req.user.id } }
}

export const HealthRecords: CollectionConfig = {
  slug: 'health-records',
  admin: {
    group: 'MindEase Beta',
    useAsTitle: 'recordedOn',
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
      name: 'source',
      type: 'select',
      required: true,
      options: [
        { label: 'Manual entry', value: 'manual' },
        { label: 'Android Health Connect', value: 'health-connect' },
        { label: 'Apple HealthKit', value: 'healthkit' },
      ],
    },
    { name: 'recordedOn', type: 'date', required: true, index: true },
    { name: 'steps', type: 'number', min: 0, max: 200000 },
    { name: 'activeMinutes', type: 'number', min: 0, max: 1440 },
    { name: 'sleepMinutes', type: 'number', min: 0, max: 1440 },
    { name: 'restingHeartRate', type: 'number', min: 20, max: 250 },
    { name: 'hrv', type: 'number', min: 1, max: 500 },
  ],
  versions: false,
}
