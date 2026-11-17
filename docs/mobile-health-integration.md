# MindEase native health integration

The Next.js application cannot read Health Connect or HealthKit directly. Phone health data must be
read by a signed native application after the user grants operating-system permission.

## Shared sync contract

1. Sign the user into the native app with the same MindEase email/password account.
2. Request only the health permissions the user enables.
3. Read daily aggregates on the device.
4. Send records to Payload's `health-records` collection using the authenticated user's JWT.
5. Set `source` to `health-connect` or `healthkit`. The collection hook always replaces `owner` with
   the authenticated user, so clients cannot write data for another account.
6. Store the last successful sync time on-device and request only newer records during later syncs.

Supported values are `recordedOn`, `steps`, `activeMinutes`, `sleepMinutes`, `restingHeartRate`, and
`hrv`. Do not upload raw location, workout routes, or second-by-second sensor samples.

## Android: Health Connect

- Use an Android app targeting the current Health Connect SDK.
- Declare read permissions only for enabled record types, such as steps, sleep sessions, resting
  heart rate, heart-rate variability, and exercise sessions.
- Show MindEase's consent explanation before launching the system permission dialog.
- Check Health Connect availability and installation status; never represent an unavailable service
  as connected.
- Read daily aggregates in the user's local time zone, then sync them as `health-connect` records.
- Provide a visible disconnect action that stops future reads. Revoking data already uploaded is a
  separate delete operation in MindEase's Privacy Center.

## iOS: HealthKit

- Use a signed iOS app with the HealthKit capability and the required usage-description strings.
- Request read authorization for only the selected HealthKit quantity/category types.
- HealthKit does not reveal whether read access was denied for an individual type. Treat empty data
  as unavailable, not as zero.
- Aggregate by the user's calendar and time zone, then sync as `healthkit` records.
- Apple review requires the app's health-data use to be clear and prohibits using health data for
  advertising.

## Safety and privacy

- Health sync must be opt-in and disabled by default.
- Never use wellness scores as a diagnosis or emergency decision.
- Encrypt transport, keep records account-scoped, and let users export and delete their data.
- Record permission and sync failures without logging health values.
