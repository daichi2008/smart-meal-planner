'use client'

import { useState } from 'react'

import { api } from '@/lib/api'
import type { Recipe, RecipeSuggestionResponse } from '@/lib/types'
import { useI18n } from '@/lib/i18n'
import { Badge, Button, Spinner } from '@/components/ui'

const PRESETS = [
  { key: 'vegetarian', labelKey: 'presetVegetarian' as const },
  { key: 'vegan', labelKey: 'presetVegan' as const },
  { key: 'gluten_free', labelKey: 'presetGlutenFree' as const },
  { key: 'lower_calorie', labelKey: 'presetLowerCalorie' as const },
  { key: 'higher_protein', labelKey: 'presetHigherProtein' as const },
  { key: 'spicier', labelKey: 'presetSpicier' as const },
  { key: 'dairy_free', labelKey: 'presetDairyFree' as const },
  { key: 'quick_version', labelKey: 'presetQuickVersion' as const },
  { key: 'budget_friendly', labelKey: 'presetBudgetFriendly' as const },
]

export function RecipeCard({
  recipe,
  onDelete,
  onLog,
  logged,
  isVariant = false,
}: {
  recipe: Recipe
  onDelete?: () => void
  onLog?: () => void
  logged?: boolean
  isVariant?: boolean
}) {
  const { t, lang } = useI18n()
  const [expanded, setExpanded] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  const [showVariantPanel, setShowVariantPanel] = useState(false)
  const [variantLoading, setVariantLoading] = useState(false)
  const [variantError, setVariantError] = useState<string | null>(null)
  const [variantRecipe, setVariantRecipe] = useState<Recipe | null>(null)
  const [customInput, setCustomInput] = useState('')
  const [loggedVariant, setLoggedVariant] = useState(false)

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

  async function generateVariant(variation: string) {
    setVariantLoading(true)
    setVariantError(null)
    setVariantRecipe(null)
    try {
      const res = await api.post<RecipeSuggestionResponse>('/recipes/variant', {
        recipe,
        variation,
        language: lang,
      })
      if (res.recipes.length > 0) {
        setVariantRecipe(res.recipes[0])
      }
    } catch (err) {
      setVariantError(err instanceof Error ? err.message : t('generateError'))
    } finally {
      setVariantLoading(false)
    }
  }

  function handlePreset(key: string) {
    generateVariant(key)
  }

  function handleCustom(e: React.FormEvent) {
    e.preventDefault()
    if (customInput.trim()) {
      generateVariant(customInput.trim())
    }
  }

  return (
    <div className="space-y-4">
      <div className="card card-hover overflow-hidden p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold tracking-tight text-gray-900 dark:text-slate-100">{recipe.title}</h3>
            {recipe.summary && (
              <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-slate-400">{recipe.summary}</p>
            )}
          </div>
          <div className="flex gap-2">
            {recipe.calories_per_serving && (
              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                🔥 {Math.round(recipe.calories_per_serving)} {t('caloriesShort')}
              </Badge>
            )}
            {recipe.prep_time_minutes && (
              <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                ⏱ {recipe.prep_time_minutes} {t('minutesShort')}
              </Badge>
            )}
          </div>
        </div>

        {recipe.macros && (
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="chip">
              <span className="me-1 font-semibold text-gray-900 dark:text-slate-100">{t('protein')}</span>
              {Math.round(recipe.macros.protein)}g
            </span>
            <span className="chip">
              <span className="me-1 font-semibold text-gray-900 dark:text-slate-100">{t('carbs')}</span>
              {Math.round(recipe.macros.carbs)}g
            </span>
            <span className="chip">
              <span className="me-1 font-semibold text-gray-900 dark:text-slate-100">{t('fat')}</span>
              {Math.round(recipe.macros.fat)}g
            </span>
          </div>
        )}

        {recipe.tags && recipe.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {recipe.tags.map((tag) => (
              <Badge key={tag} className="bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {recipe.missing_ingredients && recipe.missing_ingredients.length > 0 && (
          <p className="mt-3 rounded-xl bg-amber-50 px-3.5 py-2 text-sm text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
            {t('missingIngredients')} {recipe.missing_ingredients.join(', ')}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => setExpanded(!expanded)}>
            {expanded ? t('hideSteps') : t('showSteps')}
          </Button>
          {!isVariant && (
            <Button
              variant="secondary"
              onClick={() => setShowVariantPanel(!showVariantPanel)}
              className="text-purple-700 hover:bg-purple-50 dark:text-purple-300 dark:hover:bg-purple-500/10"
            >
              🔄 {t('variant')}
            </Button>
          )}
          {onLog && (
            <Button
              onClick={onLog}
              disabled={logged}
              className={logged ? 'bg-orange-100 text-orange-700 hover:bg-orange-100 dark:bg-orange-500/15 dark:text-orange-300 dark:hover:bg-orange-500/15' : 'bg-orange-500 text-white hover:bg-orange-600'}
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
                  ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/15'
                  : 'bg-gray-900 text-white hover:bg-gray-700'
              }`}
            >
              {saving ? t('saving') : saved ? `✓ ${t('saved')}` : t('save')}
            </Button>
          )}
        </div>

        {showVariantPanel && !isVariant && (
          <div className="mt-4 rounded-xl border border-purple-200 bg-purple-50 p-4 dark:border-purple-500/20 dark:bg-purple-500/5">
            <p className="mb-3 text-sm font-semibold text-purple-800 dark:text-purple-200">
              🔄 {t('variant')}
            </p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => handlePreset(p.key)}
                  disabled={variantLoading}
                  className="rounded-lg border border-purple-200 bg-white px-3 py-1.5 text-xs font-medium text-purple-700 transition hover:bg-purple-100 disabled:opacity-50 dark:border-purple-500/30 dark:bg-slate-800 dark:text-purple-200 dark:hover:bg-purple-500/15"
                >
                  {t(p.labelKey)}
                </button>
              ))}
            </div>
            <form onSubmit={handleCustom} className="mt-3 flex gap-2">
              <input
                type="text"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder={t('customVariationPlaceholder')}
                className="input flex-1 text-sm"
                disabled={variantLoading}
                maxLength={500}
              />
              <Button type="submit" disabled={variantLoading || !customInput.trim()} className="px-4 text-sm">
                {t('customVariation')}
              </Button>
            </form>
          </div>
        )}

        {expanded && (
          <div className="mt-5 space-y-5 border-t border-gray-100 pt-5 dark:border-slate-800">
            <div>
              <h4 className="text-sm font-bold text-gray-800 dark:text-slate-100">{t('ingredientsTitle')}</h4>
              <ul className="mt-2 space-y-1.5 text-sm text-gray-600 dark:text-slate-400">
                {recipe.ingredients.map((ing) => (
                  <li key={ing} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                    {ing}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-bold text-gray-800 dark:text-slate-100">{t('stepsTitle')}</h4>
              <ol className="mt-2 space-y-2 text-sm text-gray-600 dark:text-slate-400">
                {recipe.steps.map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                      {i + 1}
                    </span>
                    <span className="leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
            {recipe.tip && (
              <p className="rounded-xl bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">
                💡 {recipe.tip}
              </p>
            )}
          </div>
        )}
      </div>

      {variantLoading && (
        <div className="card flex items-center gap-3 border-purple-200 p-5 dark:border-purple-500/20">
          <Spinner />
          <span className="text-sm text-purple-700 dark:text-purple-300">{t('generatingVariant')}</span>
        </div>
      )}

      {variantError && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          {variantError}
        </p>
      )}

      {variantRecipe && (
        <div className="ms-4 border-e-4 border-purple-300 ps-4 dark:border-purple-500/30">
          <p className="mb-2 text-xs font-semibold text-purple-600 dark:text-purple-400">
            {t('variantOf', { title: recipe.title })}
          </p>
          <RecipeCard
            recipe={variantRecipe}
            isVariant
            logged={loggedVariant}
            onLog={() => {
              setLoggedVariant(true)
            }}
          />
        </div>
      )}
    </div>
  )
}
