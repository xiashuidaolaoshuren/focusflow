import type { ReactNode } from 'react'

type NavIconProps = { className?: string | undefined }

type Glyph = { paths: ReactNode }

/**
 * The prototype's one 16px outline family at a 1.5 stroke, so the sidebar and the approved
 * design share the same marks instead of a second icon set.
 */
function NavIcon({ className, paths }: NavIconProps & Glyph) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {paths}
    </svg>
  )
}

export function TodayNavIcon({ className }: NavIconProps) {
  return (
    <NavIcon
      className={className}
      paths={
        <>
          <path d="M4 1.5v13" />
          <rect x="6.5" y="2.5" width="7" height="4.5" rx="1" />
          <rect x="6.5" y="9" width="7" height="4.5" rx="1" />
        </>
      }
    />
  )
}

export function TasksNavIcon({ className }: NavIconProps) {
  return (
    <NavIcon
      className={className}
      paths={<path d="M6.5 4h7M6.5 8h7M6.5 12h7M2.5 4h1M2.5 8h1M2.5 12h1" />}
    />
  )
}

export function HorizonNavIcon({ className }: NavIconProps) {
  return (
    <NavIcon
      className={className}
      paths={
        <>
          <path d="M1.5 13.5h13" />
          <path d="M3 13.5V10M5.5 13.5V7.5M8 13.5V9M10.5 13.5V6M13 13.5V8.5" />
        </>
      }
    />
  )
}

export function PlansNavIcon({ className }: NavIconProps) {
  return (
    <NavIcon
      className={className}
      paths={
        <>
          <rect x="2.5" y="2" width="11" height="12" rx="1.5" />
          <path d="M5.5 5.5h5M5.5 8h5M5.5 10.5h3" />
        </>
      }
    />
  )
}

export function SettingsNavIcon({ className }: NavIconProps) {
  return (
    <NavIcon
      className={className}
      paths={
        <>
          <path d="M2 4.5h7M12 4.5h2M2 11.5h2M7 11.5h7" />
          <circle cx="10.5" cy="4.5" r="1.5" />
          <circle cx="5.5" cy="11.5" r="1.5" />
        </>
      }
    />
  )
}
