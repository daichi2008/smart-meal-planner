'use client'

import { useEffect, useState } from 'react'

import { api } from '@/lib/api'
import type { FridgeItem } from '@/lib/types'
import { useI18n } from '@/lib/i18n'
import { Button, Card, Field, Input, Select } from '@/components/ui'

export function FridgeManager({
  onItemsChange,
}: {
  onItemsChange: (items: FridgeItem[]) => void
}) {
  const { t } = useI18n()
  const [items, setItems] = useState<FridgeItem[]>([])
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unit, setUnit] = useState('')
  const [category, setCategory] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const CATEGORIES = [
    { value: '', label: t('catOther') },
    { value: 'خضار', label: t('catVeg') },
    { value: 'فواكه', label: t('catFruit') },
    { value: 'لحوم', label: t('catMeat') },
    { value: 'ألبان', label: t('catDairy') },
    { value: 'حبوب', label: t('catGrains') },
    { value: 'بهارات', label: t('catSpices') },
    { value: 'أخرى', label: t('catOther') },
  ]

  useEffect(() => {
    let active = true
    api
      .get<FridgeItem[]>('/fridge/items')
      .then((data) => {
        if (!active) return
        setItems(data)
        onItemsChange(data)
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : t('loading'))
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [onItemsChange, t])

  async function addItem(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setError(null)
    try {
      const item = await api.post<FridgeItem>('/fridge/items', {
        name: name.trim(),
        quantity: parseFloat(quantity) || 1,
        unit: unit.trim() || null,
        category: category || null,
      })
      const next = [item, ...items]
      setItems(next)
      onItemsChange(next)
      setName('')
      setQuantity('1')
      setUnit('')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loading'))
    }
  }

  async function deleteItem(id: string) {
    setError(null)
    try {
      await api.delete(`/fridge/items/${id}`)
      const next = items.filter((i) => i.id !== id)
      setItems(next)
      onItemsChange(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loading'))
    }
  }

  async function removeExpired() {
    const expired = items.filter((i) => i.expires_at && new Date(i.expires_at) < new Date())
    for (const item of expired) {
      await api.delete(`/fridge/items/${item.id}`)
    }
    if (expired.length) {
      const next = items.filter((i) => !expired.includes(i))
      setItems(next)
      onItemsChange(next)
    }
  }

  function iconFor(cat: string | null) {
    switch (cat) {
      case 'خضار':
        return '🥬'
      case 'فواكه':
        return '🍎'
      case 'لحوم':
        return '🍗'
      case 'ألبان':
        return '🥛'
      case 'حبوب':
        return '🌾'
      case 'بهارات':
        return '🌶️'
      default:
        return '📦'
    }
  }

  const hasExpired = items.some((i) => i.expires_at && new Date(i.expires_at) < new Date())

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 text-lg dark:bg-emerald-500/15">🧊</span>
          <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">{t('fridgeTitle')}</h2>
        </div>
        {hasExpired && (
          <Button variant="danger" onClick={removeExpired}>
            {t('removeExpired')}
          </Button>
        )}
      </div>

      <form onSubmit={addItem} className="mt-5 space-y-3">
        <Field label={t('fieldName')}>
          <Input
            id="item-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('fieldNamePlaceholder')}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('fieldQty')}>
            <Input
              id="item-qty"
              type="number"
              min="0.1"
              step="0.1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              aria-label={t('fieldQty')}
            />
          </Field>
          <Field label={t('fieldUnit')}>
            <Input
              id="item-unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="kg / g / ml"
              aria-label={t('fieldUnit')}
            />
          </Field>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Field label={t('fieldCategory')}>
              <Select
                id="item-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                aria-label={t('fieldCategory')}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Button type="submit" disabled={!name.trim()} className="min-w-28">
            {t('addItem')}
          </Button>
        </div>
      </form>

      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="mt-5">
        {loading ? (
          <p className="py-6 text-center text-sm text-gray-400 dark:text-slate-500">{t('loading')}</p>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 py-10 text-center dark:border-slate-700">
            <p className="text-3xl">🥕</p>
            <p className="mt-2 font-medium text-gray-500 dark:text-slate-400">{t('fridgeEmpty')}</p>
            <p className="mt-1 text-sm text-gray-400 dark:text-slate-500">{t('fridgeEmptyHint')}</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-slate-800">
            {items.map((item) => (
              <li key={item.id} className="group flex items-center justify-between py-2.5">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-50 text-sm dark:bg-emerald-500/15">
                    {iconFor(item.category)}
                  </span>
                  <div>
                    <p className="font-medium text-gray-800 dark:text-slate-100">{item.name}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">
                      {item.quantity} {item.unit ?? ''} · {item.category ?? t('general')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => deleteItem(item.id)}
                  className="rounded-lg px-2.5 py-1 text-sm text-gray-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:text-slate-500 dark:hover:bg-red-500/15 dark:hover:text-red-400"
                  aria-label={`${t('delete')} ${item.name}`}
                >
                  {t('delete')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}
