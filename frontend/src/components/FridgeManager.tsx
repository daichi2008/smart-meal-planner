'use client'

import { useEffect, useState } from 'react'

import { api } from '@/lib/api'
import type { FridgeItem } from '@/lib/types'
import { useI18n } from '@/lib/i18n'
import { Button, Card, Input } from '@/components/ui'

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

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">🧊 {t('fridgeTitle')}</h2>
        {items.some((i) => i.expires_at && new Date(i.expires_at) < new Date()) && (
          <Button
            onClick={removeExpired}
            className="bg-amber-50 text-amber-700 hover:bg-amber-100"
          >
            {t('removeExpired')}
          </Button>
        )}
      </div>

      <form onSubmit={addItem} className="mt-4 space-y-3">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-gray-700" htmlFor="item-name">
            {t('fieldName')}
          </label>
          <Input
            id="item-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('fieldNamePlaceholder')}
            className="flex-1"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-700" htmlFor="item-qty">
              {t('fieldQty')}
            </label>
            <Input
              id="item-qty"
              type="number"
              min="0.1"
              step="0.1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              aria-label={t('fieldQty')}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-700" htmlFor="item-unit">
              {t('fieldUnit')}
            </label>
            <Input
              id="item-unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="kg / g / ml"
              aria-label={t('fieldUnit')}
            />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-gray-700" htmlFor="item-cat">
            {t('fieldCategory')}
          </label>
          <div className="flex items-center gap-2">
            <select
              id="item-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-emerald-500 focus:outline-none"
              aria-label={t('fieldCategory')}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <Button
              type="submit"
              disabled={!name.trim()}
              className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {t('addItem')}
            </Button>
          </div>
        </div>
      </form>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-5">
        {loading ? (
          <p className="py-6 text-center text-sm text-gray-400">{t('loading')}</p>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 py-8 text-center">
            <p className="text-gray-500">{t('fridgeEmpty')}</p>
            <p className="mt-1 text-sm text-gray-400">{t('fridgeEmptyHint')}</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-3">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-gray-100 text-sm">
                    {iconFor(item.category)}
                  </span>
                  <div>
                    <p className="font-medium text-gray-800">{item.name}</p>
                    <p className="text-xs text-gray-400">
                      {item.quantity} {item.unit ?? ''} · {item.category ?? t('general')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => deleteItem(item.id)}
                  className="rounded-lg px-2 py-1 text-sm text-red-400 transition-colors hover:bg-red-50 hover:text-red-600"
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
