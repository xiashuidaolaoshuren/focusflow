import { useEffect, useRef } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { CircleAlertIcon, Loader2Icon } from 'lucide-react'

import { loginSchema, type LoginFormValues } from '@/components/form/schemas'
import { Alert, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { AuthCard } from '@/features/auth/AuthCard'
import { useLogin } from '@/features/auth/hooks'

export function LoginForm() {
  const { mutate, isPending, isError, error } = useLogin()
  const errorAlertRef = useRef<HTMLDivElement>(null)
  const hasLoginError = isError && error instanceof Error

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
    defaultValues: { username: '', password: '' },
  })

  useEffect(() => {
    if (hasLoginError) {
      errorAlertRef.current?.focus()
    }
  }, [hasLoginError])

  const apiError = isError ? error : undefined

  return (
    <AuthCard
      title="Sign in"
      alternate={
        <>
          New to FocusFlow?{' '}
          <Link
            to="/register"
            className="text-primary underline-offset-2 hover:underline"
          >
            Create account
          </Link>
        </>
      }
    >
      {hasLoginError ? (
        <Alert ref={errorAlertRef} variant="destructive" tabIndex={-1}>
          <CircleAlertIcon aria-hidden="true" />
          <AlertTitle>{error.message}</AlertTitle>
        </Alert>
      ) : null}
      <form
        className="grid gap-4"
        aria-label="Sign in"
        noValidate
        onSubmit={handleSubmit((values) => mutate(values))}
      >
        <Field
          label="Username"
          name="username"
          required
          error={errors.username?.message}
          apiError={apiError}
        >
          {(control) => (
            <Input
              {...register('username')}
              {...control}
              autoComplete="username"
            />
          )}
        </Field>
        <Field
          label="Password"
          name="password"
          required
          error={errors.password?.message}
          apiError={apiError}
        >
          {(control) => (
            <Input
              {...register('password')}
              {...control}
              type="password"
              autoComplete="current-password"
            />
          )}
        </Field>
        <Button type="submit" size="lg" className="w-full" disabled={isPending}>
          {isPending ? (
            <Loader2Icon className="animate-spin" aria-hidden="true" />
          ) : null}
          Sign in
        </Button>
      </form>
    </AuthCard>
  )
}
