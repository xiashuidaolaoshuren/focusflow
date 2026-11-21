import { cn } from '@/lib/utils'

/** The rail-with-two-blocks mark from the prototype. Decorative next to the wordmark. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={cn('size-5', className)}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M5 2v16"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <rect
        x="8"
        y="3"
        width="9"
        height="5"
        rx="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect x="8" y="11" width="9" height="6" rx="1.5" fill="currentColor" />
    </svg>
  )
}
