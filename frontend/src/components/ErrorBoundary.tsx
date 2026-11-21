import { Component, type ErrorInfo, type ReactNode } from 'react'
import { RefreshCwIcon, TriangleAlertIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'

type ErrorBoundaryProps = {
  children: ReactNode
}

type ErrorBoundaryState = {
  hasError: boolean
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled application error', error, info.componentStack)
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div className="grid min-h-svh place-items-center bg-background px-6 py-16 text-center text-foreground">
        <div className="grid max-w-[420px] justify-items-center gap-3">
          <TriangleAlertIcon
            className="size-6 text-muted-foreground"
            aria-hidden="true"
          />
          <p className="text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">
            Error FF-500
          </p>
          <h1 className="font-display text-xl leading-9 font-medium tracking-[-0.01em]">
            Something went wrong
          </h1>
          <p className="text-sm text-muted-foreground">
            Your Daily plan is safe.
          </p>
          <Button type="button" onClick={() => window.location.reload()}>
            <RefreshCwIcon />
            Reload
          </Button>
        </div>
      </div>
    )
  }
}
