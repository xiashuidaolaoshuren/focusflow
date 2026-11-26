import { Link, useLocation } from 'react-router-dom'
import { CompassIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  const { pathname } = useLocation()

  return (
    <div className="grid min-h-[70dvh] place-items-center px-6 py-16 text-center text-foreground">
      <div className="grid max-w-[420px] justify-items-center gap-3">
        <CompassIcon
          className="size-6 text-muted-foreground"
          aria-hidden="true"
        />
        <p className="text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">
          404
        </p>
        <h1 className="font-display text-xl leading-9 font-medium tracking-[-0.01em]">
          Page not found
        </h1>
        <p className="font-mono text-[13px] text-muted-foreground">
          {pathname}
        </p>
        <Button render={<Link to="/today" />}>Go to Today</Button>
      </div>
    </div>
  )
}
