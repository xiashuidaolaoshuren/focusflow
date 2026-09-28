import { SchedulingPreferencesForm } from '@/features/preferences/SchedulingPreferencesForm'

export function SettingsPage() {
  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        Scheduling preferences
      </h1>
      <SchedulingPreferencesForm />
    </section>
  )
}
