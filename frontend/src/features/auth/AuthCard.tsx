import type { ReactNode } from 'react'

import { BrandMark } from '@/components/brand/BrandMark'

export function AuthCard({
  title,
  children,
  alternate,
}: {
  title: string
  children: ReactNode
  alternate: ReactNode
}) {
  return (
    <div className="w-full rounded-lg border border-border bg-card p-8 text-card-foreground">
      <div className="grid gap-5">
        <div className="flex items-center gap-2">
          <BrandMark className="size-6" />
          <span className="font-display text-lg leading-7 font-medium tracking-[-0.01em]">
            FocusFlow
          </span>
        </div>
        <h1 className="font-display text-xl leading-9 font-medium tracking-[-0.01em]">
          {title}
        </h1>
        {children}
        <p className="text-center text-sm text-muted-foreground">
          {alternate}
        </p>
      </div>
    </div>
  )
}
