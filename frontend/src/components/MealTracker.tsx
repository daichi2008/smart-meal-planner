'use client'

import { useCallback, useEffect, useState } from 'react'

import { api } from '@/lib/api'
import type { MealLog, MealSummary, UserStats } from '@/lib/types'
import { useI18n } from '@/lib/i18n'
import { onMealsChanged } from '@/lib/mealsBus'
import { Button, Card, Field, Input, Select, Spinner } from '@/components/ui'

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const

const MEAL_ICONS: Record<string, string> = {
  breakfast: '🍳',
  lunch: '🍲',
  dinner: '🍽️',
  snack: '🥨',
}

export function MealTracker() {
  const { t, lang } = useI18n()
  const [summary, setSummary] = useState<MealSummary | null>(null)
  const [meals, setMeals] = useState<MealLog[]>([])
  const [stats, setStats] = useState<UserStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [calories, setCalories] = useState('')
  const [mealType, setMealType] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(() => {
    Promise.all([
      api.get<MealLog[]>('/meals'),
      api.get<MealSummary>('/meals/summary?days=7'),
      api.get<UserStats>('/users/me/stats'),
    ])
      .then(([mealList, summaryData, statsData]) => {
        setMeals(mealList)
        setSummary(summaryData)
        setStats(statsData)
        setError(null)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : t('mealsError'))
      })
      .finally(() => setLoading(false))
  }, [t])

  useEffect(() => {
    load()
    return onMealsChanged(load)
  }, [load])

  async function addMeal(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await api.post<MealLog>('/meals', {
        title: title.trim(),
        calories: calories ? parseFloat(calories) : null,
        meal_type: mealType || null,
      })
      setTitle('')
      setCalories('')
      setMealType('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('mealsError'))
    } finally {
      setSubmitting(false)
    }
  }

  async function removeMeal(id: string) {
    setError(null)
    try {
      await api.delete(`/meals/${id}`)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('mealsError'))
    }
  }

  const target = summary?.target ?? null
  const consumed = summary?.consumed_today ?? 0
  const pct = target && target > 0 ? Math.min(100, (consumed / target) * 100) : 0
  const over = target != null && consumed > target
  const remaining = summary?.remaining_today

  const mealLabel = (m: string | null): string => {
    if (m && (MEAL_TYPES as readonly string[]).includes(m)) return t(m as (typeof MEAL_TYPES)[number])
    return t('general')
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-orange-400 to-rose-500 text-lg shadow-md shadow-orange-400/25">
          🍽️
        </span>
        <div>
          <h2 className="text-lg font-bold text-gray-900">{t('trackerTitle')}</h2>
          <p className="mt-0.5 text-sm text-gray-500">{t('trackerHint')}</p>
        </div>
        <span className="ms-auto hidden text-sm font-semibold text-gray-400 sm:block">
          {new Intl.DateTimeFormat(lang === 'ar' ? 'ar' : 'en', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          }).format(new Date())}
        </span>
      </div>

      {error && (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-gray-400">
          <Spinner /> <span>{t('loading')}</span>
        </div>
      ) : (
        <>
          <div className="mt-5 rounded-2xl bg-gray-50/80 p-4">
            {target ? (
              <>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-3xl font-bold tracking-tight text-gray-900">
                      {Math.round(consumed).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US')}
                    </p>
                    <p className="text-sm text-gray-500">
                      {t('consumed')} · {t('target')}: {target.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US')}
                    </p>
                  </div>
                  <p
                    className={`text-sm font-semibold ${
                      over ? 'text-red-600' : remaining != null && remaining < 300 ? 'text-amber-600' : 'text-emerald-600'
                    }`}
                  >
                    {over
                      ? t('overGoal')
                      : remaining != null
                        ? `${t('remaining')}: ${Math.round(remaining).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US')}`
                        : ''}
                  </p>
                </div>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-gray-200">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      over
                        ? 'bg-gradient-to-r from-red-500 to-red-600'
                        : pct >= 90
                          ? 'bg-gradient-to-r from-amber-400 to-orange-500'
                          : 'bg-gradient-to-r from-emerald-500 to-teal-500'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-500">🎯 {t('targetNotSet')}</p>
            )}
          </div>

          <form onSubmit={addMeal} className="mt-5 grid gap-3 sm:grid-cols-2">
            <Field label={t('logTitle')}>
              <Input
                id="meal-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('logTitlePlaceholder')}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('logCalories')}>
                <Input
                  id="meal-cal"
                  type="number"
                  min="0"
                  dir="ltr"
                  value={calories}
                  onChange={(e) => setCalories(e.target.value)}
                  aria-label={t('logCalories')}
                />
              </Field>
              <Field label={t('logType')}>
                <Select
                  id="meal-type"
                  value={mealType}
                  onChange={(e) => setMealType(e.target.value)}
                  aria-label={t('logType')}
                >
                  <option value="">{t('allMeals')}</option>
                  {MEAL_TYPES.map((m) => (
                    <option key={m} value={m}>
                      {t(m)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Button type="submit" disabled={submitting || !title.trim()} className="sm:col-span-2">
              {submitting ? t('loggingMeal') : `+ ${t('logBtn')}`}
            </Button>
          </form>

          <div className="mt-5">
            {meals.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 py-8 text-center">
                <p className="text-2xl">🫙</p>
                <p className="mt-2 font-medium text-gray-500">{t('todayEmpty')}</p>
                <p className="mt-1 px-6 text-sm text-gray-400">{t('todayEmptyHint')}</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {meals.map((meal) => (
                  <li key={meal.id} className="group flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 place-items-center rounded-lg bg-orange-50 text-base">
                        {MEAL_ICONS[meal.meal_type ?? ''] ?? '🍽️'}
                      </span>
                      <div>
                        <p className="font-medium text-gray-800">{meal.title}</p>
                        <p className="text-xs text-gray-400">
                          {mealLabel(meal.meal_type)}
                          {meal.calories != null ? ` · ${Math.round(meal.calories)} ${t('caloriesShort')}` : ''}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeMeal(meal.id)}
                      className="rounded-lg px-2.5 py-1 text-sm text-gray-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                      aria-label={t('deleteMeal')}
                    >
                      {t('delete')}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {summary && (
            <div className="mt-6 border-t border-gray-100 pt-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-800">{t('weekTitle')}</h3>
                <p className="text-xs text-gray-500">
                  {t('weekAverage')}:{' '}
                  <span className="font-semibold text-gray-700">
                    {Math.round(summary.average_calories).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US')}
                  </span>
                </p>
              </div>
              <div className="mt-3 flex h-28 items-end gap-1.5">
                {summary.days.map((d) => {
                  const dayDate = new Date(d.date + 'T00:00:00')
                  const isToday = d.date === new Date().toISOString().slice(0, 10)
                  const max = Math.max(...summary.days.map((x) => x.calories), 1)
                  const height = d.calories > 0 ? Math.max(8, (d.calories / max) * 100) : 4
                  return (
                    <div key={d.date} className="group relative flex-1" title={`${d.date}: ${Math.round(d.calories)} kcal`}>
                      <div
                        className={`w-full rounded-t-lg transition-all ${
                          isToday
                            ? 'bg-gradient-to-t from-emerald-600 to-teal-400'
                            : d.calories > 0
                              ? 'bg-gradient-to-t from-emerald-500 to-emerald-300'
                              : 'bg-gray-200'
                        }`}
                        style={{ height: `${height}%` }}
                      />
                      <p className={`mt-1 text-center text-[10px] ${isToday ? 'font-bold text-emerald-700' : 'text-gray-400'}`}>
                        {dayDate.getDate()}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {stats && (
            <div className="mt-6 border-t border-gray-100 pt-5">
              <h3 className="text-sm font-bold text-gray-800">{t('statsTitle')}</h3>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { icon: '🧊', value: stats.fridge_count, label: t('statFridge') },
                  { icon: '📚', value: stats.saved_count, label: t('statSaved') },
                  { icon: '🔥', value: stats.streak_days, label: t('statStreak') },
                  { icon: '✨', value: stats.suggestions_used_today, label: t('statSuggestions') },
                ].map((s) => (
                  <div key={s.label} className="rounded-2xl bg-gray-50/80 p-3 text-center">
                    <p className="text-lg">{s.icon}</p>
                    <p className="mt-1 text-xl font-bold tracking-tight text-gray-900">{s.value}</p>
                    <p className="text-[11px] leading-tight text-gray-500">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  )
}
