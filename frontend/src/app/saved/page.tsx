'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useAuth } from '@/hooks/useAuth'
import { useI18n } from '@/lib/i18n'
import { api } from '@/lib/api'
import type { SavedRecipe } from '@/lib/types'
import { RecipeCard } from '@/components/RecipeCard'
import { Button, Card, Spinner } from '@/components/ui'

export default function SavedRecipesPage() {
  return (
    <Suspense fallback={null}>
      <SavedInner />
    </Suspense>
  )
}

function SavedInner() {
  const { user, loading } = useAuth()
  const { t } = useI18n()
  const router = useRouter()
  const [saved, setSaved] = useState<SavedRecipe[]>([])
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    api
      .get<SavedRecipe[]>('/recipes/saved')
      .then(setSaved)
      .catch((err) => setError(err instanceof Error ? err.message : t('loading')))
      .finally(() => setFetching(false))
  }, [t])

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user, router])

  useEffect(() => {
    if (user) load()
  }, [user, load])

  async function remove(id: string) {
    setError(null)
    try {
      await api.delete(`/recipes/saved/${id}`)
      setSaved((prev) => prev.filter((s) => s.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loading'))
    }
  }

  if (loading || !user) {
    return <div className="py-24 text-center text-gray-400 dark:text-slate-500">{t('dashLoading')}</div>
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">📚 {t('savedTitle')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">{t('savedSubtitle')}</p>
        </div>
        <Button
          onClick={() => router.push('/dashboard')}
          className="bg-white text-gray-700 shadow-sm hover:bg-gray-100 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          {t('savedBack')}
        </Button>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">{error}</p>
      )}

      {fetching ? (
        <div className="flex items-center justify-center py-16 text-gray-400 dark:text-slate-500">
          <Spinner /> <span className="ms-2">{t('loading')}</span>
        </div>
      ) : saved.length === 0 ? (
        <Card className="border border-dashed border-gray-300 p-12 text-center dark:border-slate-700">
          <p className="text-lg text-gray-600 dark:text-slate-400">🍽️ {t('savedEmpty')}</p>
          <p className="mt-2 text-sm text-gray-400 dark:text-slate-500">{t('savedEmptyHint')}</p>
          <Button
            onClick={() => router.push('/dashboard')}
            className="mt-6 bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {t('savedGoDashboard')}
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {saved.map((s) => (
            <RecipeCard key={s.id} recipe={s.recipe} onDelete={() => remove(s.id)} />
          ))}
        </div>
      )}
    </div>
  )
}
