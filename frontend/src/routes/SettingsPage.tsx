import { SettingsForm } from '@/features/preferences/SettingsForm'

export function SettingsPage() {
  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <span className="text-xs leading-4 font-medium tracking-[0.08em] text-muted-foreground uppercase">
          Typical day
        </span>
        <h1 className="font-display text-xl leading-9 font-medium tracking-[-0.01em]">
          Settings
        </h1>
      </header>
      <SettingsForm />
    </section>
  )
}
