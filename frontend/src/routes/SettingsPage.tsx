import { SettingsForm } from '@/features/preferences/SettingsForm'

export function SettingsPage() {
  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Typical day
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      </header>
      <SettingsForm />
    </section>
  )
}
