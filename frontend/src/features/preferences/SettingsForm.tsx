import { useEffect, useMemo } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'

import { TimeField } from '@/components/form/TimeField'
import { settingsSchema, type SettingsFormValues } from '@/components/form/schemas'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { MiniRail } from '@/features/preferences/MiniRail'
import { toFormValues, toRequest, toTypicalInput } from '@/features/preferences/settingsModel'
import { typicalDay } from '@/features/preferences/typicalDay'
import {
  useSchedulingPreferences,
  useUpdateSchedulingPreferences,
} from '@/features/preferences/hooks'
import { buildRail } from '@/features/plans/railModel'
import { ApiError } from '@/lib/api'
import { formatDuration } from '@/lib/format'
import {
  DAY_OF_WEEK_LABELS,
  DAY_OF_WEEK_ORDER,
  type DayOfWeek,
} from '@/types/api'

const EMPTY_VALUES: SettingsFormValues = {
  workDayStart: '09:00',
  workDayEnd: '18:00',
  cadenceEnabled: true,
  targetFocusMinutes: '50',
  breakMinutes: '10',
  minSessionMinutes: '15',
  bufferMinutes: '0',
  peakStart: '',
  peakEnd: '',
  workingDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
  fixedBreaks: [],
}


function TypicalDayPreview({ values }: { values: SettingsFormValues }) {
  const input = useMemo(() => toTypicalInput(values), [values])
  const result = useMemo(() => (input == null ? null : typicalDay(input)), [input])

  return (
    <section aria-labelledby="settings-preview" className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-center gap-2">
        <h2 id="settings-preview" className="text-base font-semibold">
          Typical day
        </h2>
        <span className="ml-auto rounded-md border px-2 py-0.5 text-xs text-muted-foreground">
          Preview
        </span>
      </div>
      {result == null ? (
        <p className="text-sm text-muted-foreground">Preview unavailable</p>
      ) : (
        <>
          <MiniRail rail={buildRail(result.plan, null, 'mini')} />
          <div className="grid grid-cols-2 border-t pt-3">
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-lg">{formatDuration(result.focusMinutes)}</span>
              <span className="text-xs text-muted-foreground">Focus per day</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-lg">{result.sessions}</span>
              <span className="text-xs text-muted-foreground">Sessions</span>
            </div>
          </div>
        </>
      )}
    </section>
  )
}

export function SettingsForm() {
  const { preferences, isPending, isError, error: loadError } =
    useSchedulingPreferences()
  const saveMutation = useUpdateSchedulingPreferences()

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: EMPTY_VALUES,
  })
  const values = useWatch({ control: form.control }) as SettingsFormValues
  const breaks = useFieldArray({ control: form.control, name: 'fixedBreaks' })

  useEffect(() => {
    if (preferences != null) {
      form.reset(toFormValues(preferences))
    }
  }, [preferences, form])

  if (isPending) {
    return <p>Loading scheduling preferences…</p>
  }

  if (isError && loadError instanceof Error) {
    return <p role="alert">{loadError.message}</p>
  }

  const cadenceOn = values.cadenceEnabled !== false

  return (
    <form
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] items-start"
      onSubmit={form.handleSubmit((submitted) => saveMutation.mutate(toRequest(submitted)))}
    >
      <div className="flex flex-col gap-4">
        {saveMutation.isError &&
      saveMutation.error instanceof Error &&
      !(saveMutation.error instanceof ApiError && saveMutation.error.details) ? (
        <Alert variant="destructive" className="col-span-full">
          <AlertDescription>{saveMutation.error.message}</AlertDescription>
        </Alert>
      ) : null}
      {preferences?.persisted === false ? (
          <p className="text-sm text-muted-foreground">Defaults apply until saved</p>
        ) : null}

        <section aria-labelledby="settings-work-window" className="flex flex-col gap-4">
          <h2 id="settings-work-window" className="text-base font-semibold">
            Work window
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Start" name="workDayStart" error={form.formState.errors.workDayStart?.message} apiError={saveMutation.error}>
              {(control) => (
                <Controller
                  control={form.control}
                  name="workDayStart"
                  render={({ field }) => (
                    <TimeField {...control} value={field.value} onChange={field.onChange} />
                  )}
                />
              )}
            </Field>
            <Field label="End" name="workDayEnd" error={form.formState.errors.workDayEnd?.message} apiError={saveMutation.error}>
              {(control) => (
                <Controller
                  control={form.control}
                  name="workDayEnd"
                  render={({ field }) => (
                    <TimeField {...control} value={field.value} onChange={field.onChange} />
                  )}
                />
              )}
            </Field>
            <Field label="Trailing buffer" name="bufferMinutes" error={form.formState.errors.bufferMinutes?.message} apiError={saveMutation.error}>
              {(control) => (
                <Input {...form.register('bufferMinutes')} {...control} inputMode="numeric" />
              )}
            </Field>
          </div>
        </section>

        <section aria-labelledby="settings-cadence" className="flex flex-col gap-4">
          <h2 id="settings-cadence" className="text-base font-semibold">
            Focus cadence
          </h2>
          <Controller
            control={form.control}
            name="cadenceEnabled"
            render={({ field }) => (
              <label className="flex items-center gap-3 text-sm font-medium">
                <input
                  type="checkbox"
                  role="switch"
                  name="cadenceEnabled"
                  checked={field.value}
                  onChange={(event) => field.onChange(event.target.checked)}
                  className="size-5 accent-primary"
                />
                Enable focus cadence
              </label>
            )}
          />
          <div className="grid grid-cols-3 gap-3">
            {cadenceOn ? (
              <>
                <Field label="Focus session" name="targetFocusMinutes" error={form.formState.errors.targetFocusMinutes?.message} apiError={saveMutation.error}>
                  {(control) => (
                    <Input {...form.register('targetFocusMinutes')} {...control} inputMode="numeric" />
                  )}
                </Field>
                <Field label="Cadence break" name="breakMinutes" error={form.formState.errors.breakMinutes?.message} apiError={saveMutation.error}>
                  {(control) => (
                    <Input {...form.register('breakMinutes')} {...control} inputMode="numeric" />
                  )}
                </Field>
              </>
            ) : null}
            <Field label="Minimum session" name="minSessionMinutes" error={form.formState.errors.minSessionMinutes?.message} apiError={saveMutation.error}>
              {(control) => (
                <Input {...form.register('minSessionMinutes')} {...control} inputMode="numeric" />
              )}
            </Field>
          </div>
        </section>

        <section aria-labelledby="settings-peak" className="flex flex-col gap-4">
          <h2 id="settings-peak" className="text-base font-semibold">
            Peak window
          </h2>
          <p className="text-sm text-muted-foreground">
            The peak window is visual only and does not affect how tasks are scheduled.
          </p>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Start" name="peakStart" error={form.formState.errors.peakStart?.message} apiError={saveMutation.error}>
              {(control) => (
                <Controller
                  control={form.control}
                  name="peakStart"
                  render={({ field }) => (
                    <TimeField {...control} value={field.value} onChange={field.onChange} />
                  )}
                />
              )}
            </Field>
            <Field label="End" name="peakEnd" error={form.formState.errors.peakEnd?.message} apiError={saveMutation.error}>
              {(control) => (
                <Controller
                  control={form.control}
                  name="peakEnd"
                  render={({ field }) => (
                    <TimeField {...control} value={field.value} onChange={field.onChange} />
                  )}
                />
              )}
            </Field>
          </div>
        </section>

        <section aria-labelledby="settings-fixed-breaks" className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <h2 id="settings-fixed-breaks" className="text-base font-semibold">
              Fixed breaks
            </h2>
            <Button
              type="button"
              variant="outline"
              onClick={() => breaks.append({ label: '', startTime: '12:00', endTime: '13:00' })}
            >
              Add break
            </Button>
          </div>
          {breaks.fields.length === 0 ? (
            <p className="text-sm text-muted-foreground">No fixed breaks yet.</p>
          ) : (
            breaks.fields.map((item, index) => (
              <div key={item.id} className="grid grid-cols-[1fr_auto_auto_auto] items-end gap-3">
                <Field label="Label" name={`fixedBreaks.${index}.label`} error={form.formState.errors.fixedBreaks?.[index]?.label?.message} apiError={saveMutation.error}>
                  {(control) => (
                    <Input {...form.register(`fixedBreaks.${index}.label`)} {...control} />
                  )}
                </Field>
                <Field label="Start" name={`fixedBreaks.${index}.startTime`} error={form.formState.errors.fixedBreaks?.[index]?.startTime?.message} apiError={saveMutation.error}>
                  {(control) => (
                    <Controller
                      control={form.control}
                      name={`fixedBreaks.${index}.startTime`}
                      render={({ field }) => (
                        <TimeField {...control} value={field.value} onChange={field.onChange} />
                      )}
                    />
                  )}
                </Field>
                <Field label="End" name={`fixedBreaks.${index}.endTime`} error={form.formState.errors.fixedBreaks?.[index]?.endTime?.message} apiError={saveMutation.error}>
                  {(control) => (
                    <Controller
                      control={form.control}
                      name={`fixedBreaks.${index}.endTime`}
                      render={({ field }) => (
                        <TimeField {...control} value={field.value} onChange={field.onChange} />
                      )}
                    />
                  )}
                </Field>
                <Button
                  type="button"
                  variant="ghost"
                  aria-label={`Remove ${values.fixedBreaks?.[index]?.label || 'break'}`}
                  onClick={() => breaks.remove(index)}
                >
                  Remove
                </Button>
              </div>
            ))
          )}
        </section>
        <section aria-labelledby="settings-days" className="flex flex-col gap-4">
          <h2 id="settings-days" className="text-base font-semibold">
            Working days
          </h2>
          <p className="text-sm text-muted-foreground">
            Working days shape the horizon forecast. Daily plans can still be generated for any date.
          </p>
          <Controller
            control={form.control}
            name="workingDays"
            render={({ field }) => (
              <div className="grid grid-cols-4 gap-2">
                {DAY_OF_WEEK_ORDER.map((day: DayOfWeek) => (
                  <label key={day} className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      value={day}
                      checked={field.value.includes(day)}
                      onChange={(event) => {
                        const next = event.target.checked
                          ? [...field.value, day]
                          : field.value.filter((selected) => selected !== day)
                        field.onChange(DAY_OF_WEEK_ORDER.filter((d) => next.includes(d)))
                      }}
                      className="size-4 accent-primary"
                    />
                    {DAY_OF_WEEK_LABELS[day]}
                  </label>
                ))}
              </div>
            )}
          />
        </section>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={!form.formState.isDirty}
            onClick={() => {
              if (preferences != null) {
                form.reset(toFormValues(preferences))
              }
            }}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saveMutation.isPending}>
            Save
          </Button>
        </div>
      </div>

      <TypicalDayPreview values={values} />
    </form>
  )
}
