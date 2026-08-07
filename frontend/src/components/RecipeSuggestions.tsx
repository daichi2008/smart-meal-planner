'use client'

import { useState } from 'react'

import { api } from '@/lib/api'
import type { FridgeItem, Recipe, RecipeSuggestionResponse } from '@/lib/types'
import { useI18n } from '@/lib/i18n'
import { RecipeCard } from '@/components/RecipeCard'
import { Button, Card, Input, Spinner } from '@/components/ui'

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

  return (
    <Card className="p-6">
      <h2 className="text-lg font-bold text-gray-900">✨ {t('suggestionsTitle')}</h2>
      <p className="mt-1 text-sm text-gray-500">
        {items.length > 0
          ? t('suggestionsHint', { n: items.length })
          : t('suggestionsEmpty')}
      </p>

      <form onSubmit={suggest} className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500" htmlFor="calories">
            {t('dailyGoal')}
          </label>
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
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500" htmlFor="meal">
            {t('mealType')}
          </label>
          <select
            id="meal"
            value={mealType}
            onChange={(e) => setMealType(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          >
            {MEAL_TYPES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-gray-500">{t('recipeCount')}</label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setCount(n)}
                className={`h-9 w-9 rounded-lg text-sm font-semibold transition-colors ${
                  count === n
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
          className="w-full bg-emerald-600 text-white hover:bg-emerald-700 sm:col-span-2"
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
        <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</p>
      )}

      {recipes.length > 0 && (
        <div className="mt-6 space-y-4">
          {recipes.map((recipe, index) => (
            <RecipeCard key={`${recipe.title}-${index}`} recipe={recipe} />
          ))}
        </div>
      )}
    </Card>
  )
}
