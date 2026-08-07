'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { useAuth } from '@/hooks/useAuth'
import { useI18n } from '@/lib/i18n'
import { api } from '@/lib/api'
import type { FridgeItem, User } from '@/lib/types'
import { FridgeManager } from '@/components/FridgeManager'
import { RecipeSuggestions } from '@/components/RecipeSuggestions'
import { Button, Card, Input } from '@/components/ui'

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardInner />
    </Suspense>
  )
}

function DashboardInner() {
  const { user, loading, refreshUser } = useAuth()
  const { t } = useI18n()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [items, setItems] = useState<FridgeItem[]>([])
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [upgradeNotice, setUpgradeNotice] = useState(false)

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user, router])

  useEffect(() => {
    if (searchParams.get('upgraded') !== '1') return
    let active = true
    refreshUser().finally(() => {
      if (active) setUpgradeNotice(true)
    })
    return () => {
      active = false
    }
  }, [searchParams, refreshUser])

  if (loading || !user) {
    return <div className="py-24 text-center text-gray-400">{t('dashLoading')}</div>
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('dashGreeting')} {user.full_name ?? user.email.split('@')[0]} 👋
          </h1>
          <p className="mt-1 text-sm text-gray-500">{t('dashSubtitle')}</p>
        </div>
        <Button
          onClick={() => setSettingsOpen(!settingsOpen)}
          className="bg-white text-gray-700 shadow-sm hover:bg-gray-100"
        >
          ⚙️ {t('dashSettings')}
        </Button>
      </div>

      {upgradeNotice && (
        <div className="mb-6 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-sm font-medium text-emerald-800">
            🎉 {t('upgradeNotice')}
          </p>
          <button
            onClick={() => setUpgradeNotice(false)}
            className="text-sm text-emerald-600 hover:text-emerald-800"
          >
            {t('close')}
          </button>
        </div>
      )}

      {settingsOpen && <SettingsForm user={user} onSaved={refreshUser} />}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <FridgeManager onItemsChange={setItems} />
        </div>
        <div className="lg:col-span-3">
          <RecipeSuggestions items={items} defaultCalorieTarget={user.calorie_target} />
        </div>
      </div>
    </div>
  )
}

function SettingsForm({ user, onSaved }: { user: User; onSaved: () => Promise<void> }) {
  const { t } = useI18n()
  const [calories, setCalories] = useState(user.calorie_target ? String(user.calorie_target) : '')
  const [preferences, setPreferences] = useState(user.dietary_preferences ?? '')
  const [saving, setSaving] = useState(false)

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await api.patch<User>('/users/me', {
        calorie_target: calories ? parseFloat(calories) : null,
        dietary_preferences: preferences.trim() || null,
      })
      await onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="mb-6 p-6">
      <h2 className="text-lg font-bold text-gray-900">🎯 {t('settingsTitle')}</h2>
      <form onSubmit={saveSettings} className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="cal">
            {t('settingsCalories')}
          </label>
          <Input
            id="cal"
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
          <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="pref">
            {t('settingsPrefs')}
          </label>
          <Input
            id="pref"
            value={preferences}
            onChange={(e) => setPreferences(e.target.value)}
            placeholder={t('settingsPrefsPlaceholder')}
          />
        </div>
        <div className="sm:col-span-2">
          <Button
            type="submit"
            disabled={saving}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {saving ? t('settingsSaving') : t('settingsSave')}
          </Button>
        </div>
      </form>
    </Card>
  )
}
