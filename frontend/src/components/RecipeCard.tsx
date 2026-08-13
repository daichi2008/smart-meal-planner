'use client'

import { useState } from 'react'

import { api } from '@/lib/api'
import type { Recipe } from '@/lib/types'
import { useI18n } from '@/lib/i18n'
import { Badge, Button } from '@/components/ui'

export function RecipeCard({
  recipe,
  onDelete,
  onLog,
  logged,
}: {
  recipe: Recipe
  onDelete?: () => void
  onLog?: () => void
  logged?: boolean
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
    <div className="card card-hover overflow-hidden p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold tracking-tight text-gray-900">{recipe.title}</h3>
          {recipe.summary && (
            <p className="mt-1 text-sm leading-relaxed text-gray-600">{recipe.summary}</p>
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
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="chip">
            <span className="me-1 font-semibold text-gray-900">{t('protein')}</span>
            {Math.round(recipe.macros.protein)}g
          </span>
          <span className="chip">
            <span className="me-1 font-semibold text-gray-900">{t('carbs')}</span>
            {Math.round(recipe.macros.carbs)}g
          </span>
          <span className="chip">
            <span className="me-1 font-semibold text-gray-900">{t('fat')}</span>
            {Math.round(recipe.macros.fat)}g
          </span>
        </div>
      )}

      {recipe.tags && recipe.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {recipe.tags.map((tag) => (
            <Badge key={tag} className="bg-gray-100 text-gray-600">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {recipe.missing_ingredients && recipe.missing_ingredients.length > 0 && (
        <p className="mt-3 rounded-xl bg-amber-50 px-3.5 py-2 text-sm text-amber-700">
          {t('missingIngredients')} {recipe.missing_ingredients.join(', ')}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={() => setExpanded(!expanded)}>
          {expanded ? t('hideSteps') : t('showSteps')}
        </Button>
        {onLog && (
          <Button
            onClick={onLog}
            disabled={logged}
            className={logged ? 'bg-orange-100 text-orange-700 hover:bg-orange-100' : 'bg-orange-500 text-white hover:bg-orange-600'}
          >
            {logged ? `✓ ${t('loggedRecipe')}` : t('logRecipeBtn')}
          </Button>
        )}
        {onDelete ? (
          <Button variant="danger" onClick={onDelete}>
            {t('delete')}
          </Button>
        ) : (
          <Button
            onClick={save}
            disabled={saving || saved}
            className={`${
              saved
                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
                : 'bg-gray-900 text-white hover:bg-gray-700'
            }`}
          >
            {saving ? t('saving') : saved ? `✓ ${t('saved')}` : t('save')}
          </Button>
        )}
      </div>

      {expanded && (
        <div className="mt-5 space-y-5 border-t border-gray-100 pt-5">
          <div>
            <h4 className="text-sm font-bold text-gray-800">{t('ingredientsTitle')}</h4>
            <ul className="mt-2 space-y-1.5 text-sm text-gray-600">
              {recipe.ingredients.map((ing) => (
                <li key={ing} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                  {ing}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-bold text-gray-800">{t('stepsTitle')}</h4>
            <ol className="mt-2 space-y-2 text-sm text-gray-600">
              {recipe.steps.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </div>
          {recipe.tip && (
            <p className="rounded-xl bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
              💡 {recipe.tip}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
