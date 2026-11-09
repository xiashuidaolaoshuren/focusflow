import { useEffect, useRef } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { Loader2Icon } from 'lucide-react'

import {
  registerSchema,
  type RegisterFormValues,
} from '@/components/form/schemas'
import { Alert, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { AuthCard } from '@/features/auth/AuthCard'
import { useRegister } from '@/features/auth/hooks'

export function RegisterForm() {
  const { mutate, isPending, isError, error } = useRegister()
  const errorAlertRef = useRef<HTMLDivElement>(null)
  const hasRegisterError = isError && error instanceof Error

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    mode: 'onBlur',
    defaultValues: { email: '', username: '', password: '' },
  })

  useEffect(() => {
    if (hasRegisterError) {
      errorAlertRef.current?.focus()
    }
  }, [hasRegisterError])

  const apiError = isError ? error : undefined
  const passwordError = errors.password?.message

  return (
    <AuthCard
      title="Create account"
      alternate={
        <>
          Have an account?{' '}
          <Link
            to="/login"
            className="text-primary underline-offset-2 hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      {hasRegisterError ? (
        <Alert ref={errorAlertRef} variant="destructive" tabIndex={-1}>
          <AlertTitle>{error.message}</AlertTitle>
        </Alert>
      ) : null}
      <form
        className="grid gap-4"
        aria-label="Create account"
        noValidate
        onSubmit={handleSubmit((values) => mutate(values))}
      >
        <Field
          label="Email"
          name="email"
          required
          error={errors.email?.message}
          apiError={apiError}
        >
          {(control) => (
            <Input
              {...register('email')}
              {...control}
              type="email"
              autoComplete="email"
            />
          )}
        </Field>
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
          error={passwordError}
          description={passwordError ? undefined : 'At least 8 characters'}
          apiError={apiError}
        >
          {(control) => (
            <Input
              {...register('password')}
              {...control}
              type="password"
              autoComplete="new-password"
            />
          )}
        </Field>
        <Button type="submit" size="lg" className="w-full" disabled={isPending}>
          {isPending ? (
            <Loader2Icon className="animate-spin" aria-hidden="true" />
          ) : null}
          Create account
        </Button>
      </form>
    </AuthCard>
  )
}
