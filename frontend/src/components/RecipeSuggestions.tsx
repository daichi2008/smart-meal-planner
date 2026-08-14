'use client'

import { useState } from 'react'

import { api } from '@/lib/api'
import type { FridgeItem, Recipe, RecipeSuggestionResponse } from '@/lib/types'
import { useI18n } from '@/lib/i18n'
import { notifyMealsChanged } from '@/lib/mealsBus'
import { RecipeCard } from '@/components/RecipeCard'
import { Button, Card, Field, Input, Select, Spinner } from '@/components/ui'

export function RecipeSuggestions({
  items,
  defaultCalorieTarget,
}: {
  items: FridgeItem[]
  defaultCalorieTarget: number | null
}) {
  const { t, lang } = useI18n()
  const [calories, setCalories] = useState(
    defaultCalorieTarget ? String(defaultCalorieTarget) : ''
  )
  const [mealType, setMealType] = useState('')
  const [count, setCount] = useState(3)
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loggedIds, setLoggedIds] = useState<Set<string>>(new Set())

  const MEAL_TYPES = [
    { value: '', label: t('allMeals') },
    { value: 'breakfast', label: t('breakfast') },
    { value: 'lunch', label: t('lunch') },
    { value: 'dinner', label: t('dinner') },
    { value: 'snack', label: t('snack') },
  ]

  async function suggest(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setRecipes([])
    setLoading(true)
    try {
      const res = await api.post<RecipeSuggestionResponse>('/recipes/suggest', {
        calorie_target: calories ? parseFloat(calories) : null,
        meal_type: mealType || null,
        count,
        language: lang,
      })
      setRecipes(res.recipes)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('generateError'))
    } finally {
      setLoading(false)
    }
  }

  async function logRecipe(recipe: Recipe) {
    setError(null)
    try {
      await api.post('/meals', {
        title: recipe.title,
        calories: recipe.calories_per_serving,
        meal_type: mealType || null,
        data: recipe,
      })
      setLoggedIds((prev) => new Set(prev).add(recipe.title))
      notifyMealsChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('generateError'))
    }
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-lg text-white shadow-md shadow-emerald-500/25">
          ✨
        </span>
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">{t('suggestionsTitle')}</h2>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-slate-400">
            {items.length > 0
              ? t('suggestionsHint', { n: items.length })
              : t('suggestionsEmpty')}
          </p>
        </div>
      </div>

      <form onSubmit={suggest} className="mt-5 grid gap-3 sm:grid-cols-2">
        <Field label={t('dailyGoal')}>
          <Input
            id="calories"
            type="number"
            min="500"
            max="8000"
            dir="ltr"
            value={calories}
            onChange={(e) => setCalories(e.target.value)}
            placeholder="2000"
          />
        </Field>
        <Field label={t('mealType')}>
          <Select
            id="meal"
            value={mealType}
            onChange={(e) => setMealType(e.target.value)}
          >
            {MEAL_TYPES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <p className="label">{t('recipeCount')}</p>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setCount(n)}
                className={`h-10 w-10 rounded-xl text-sm font-semibold transition-all ${
                  count === n
                    ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/25'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <Button
          type="submit"
          disabled={loading || items.length === 0}
          className="w-full py-3 sm:col-span-2"
        >
          {loading ? (
            <>
              <Spinner /> {t('generating')}
            </>
          ) : (
            `${t('suggestBtn')} ✨`
          )}
        </Button>
      </form>

      {error && (
        <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">{error}</p>
      )}

      {recipes.length > 0 && (
        <div className="mt-6 space-y-4">
          {recipes.map((recipe, index) => (
            <RecipeCard
              key={`${recipe.title}-${index}`}
              recipe={recipe}
              logged={loggedIds.has(recipe.title)}
              onLog={() => logRecipe(recipe)}
            />
          ))}
        </div>
      )}
    </Card>
  )
}
