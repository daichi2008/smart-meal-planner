'use client'

import { useState } from 'react'

import { api } from '@/lib/api'
import type { Recipe } from '@/lib/types'
import { useI18n } from '@/lib/i18n'
import { Badge, Button } from '@/components/ui'

export function RecipeCard({
  recipe,
  onDelete,
}: {
  recipe: Recipe
  onDelete?: () => void
}) {
  const { t } = useI18n()
  const [expanded, setExpanded] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      await api.post('/recipes/save', {
        title: recipe.title,
        summary: recipe.summary,
        data: recipe,
      })
      setSaved(true)
    } catch {
      // silently ignore
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-bold text-gray-900">{recipe.title}</h3>
          {recipe.summary && (
            <p className="mt-1 text-sm text-gray-600">{recipe.summary}</p>
          )}
        </div>
        <div className="flex gap-2">
          {recipe.calories_per_serving && (
            <Badge className="bg-emerald-100 text-emerald-700">
              🔥 {Math.round(recipe.calories_per_serving)} {t('caloriesShort')}
            </Badge>
          )}
          {recipe.prep_time_minutes && (
            <Badge className="bg-blue-100 text-blue-700">
              ⏱ {recipe.prep_time_minutes} {t('minutesShort')}
            </Badge>
          )}
        </div>
      </div>

      {recipe.macros && (
        <div className="mt-3 flex gap-2 text-xs">
          <span className="rounded-md bg-gray-200 px-2 py-1 text-gray-700">
            {t('protein')} {Math.round(recipe.macros.protein)}g
          </span>
          <span className="rounded-md bg-gray-200 px-2 py-1 text-gray-700">
            {t('carbs')} {Math.round(recipe.macros.carbs)}g
          </span>
          <span className="rounded-md bg-gray-200 px-2 py-1 text-gray-700">
            {t('fat')} {Math.round(recipe.macros.fat)}g
          </span>
        </div>
      )}

      {recipe.tags && recipe.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {recipe.tags.map((tag) => (
            <Badge key={tag} className="bg-gray-100 text-gray-600">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {recipe.missing_ingredients && recipe.missing_ingredients.length > 0 && (
        <p className="mt-3 text-sm text-amber-700">
          {t('missingIngredients')} {recipe.missing_ingredients.join(', ')}
        </p>
      )}

      <div className="mt-4 flex items-center gap-2">
        <Button
          onClick={() => setExpanded(!expanded)}
          className="bg-white text-gray-700 shadow-sm hover:bg-gray-100"
        >
          {expanded ? t('hideSteps') : t('showSteps')}
        </Button>
        {onDelete ? (
          <Button
            onClick={onDelete}
            className="bg-red-50 text-red-600 hover:bg-red-100"
          >
            {t('delete')}
          </Button>
        ) : (
          <Button
            onClick={save}
            disabled={saving || saved}
            className={`${
              saved
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-gray-900 text-white hover:bg-gray-700'
            }`}
          >
            {saving ? t('saving') : saved ? `✓ ${t('saved')}` : t('save')}
          </Button>
        )}
      </div>

      {expanded && (
        <div className="mt-4 space-y-4">
          <div>
            <h4 className="text-sm font-bold text-gray-800">{t('ingredientsTitle')}</h4>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-gray-600">
              {recipe.ingredients.map((ing) => (
                <li key={ing}>{ing}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-bold text-gray-800">{t('stepsTitle')}</h4>
            <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-gray-600">
              {recipe.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </div>
          {recipe.tip && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              💡 {recipe.tip}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
