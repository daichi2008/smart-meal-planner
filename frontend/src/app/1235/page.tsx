'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { API_BASE } from '@/lib/api'
import { Badge, Button, Card, Input, Spinner } from '@/components/ui'

interface Summary {
  total_users: number
  total_subscriptions: number
  active_subscriptions: number
  total_saved_recipes: number
  total_meals: number
  recent_suggestions_7d: number
}

interface UserRow {
  email: string
  full_name: string | null
  plan: string
  is_active: boolean
  created_at: string
  fridge_count: number
  meals_count: number
  saved_count: number
}

interface SubRow {
  email: string
  amount_usd: number | null
  status: string
  cancel_at_period_end: boolean
  current_period_end: string | null
  created_at: string
}

interface ActivityRow {
  email: string
  title: string
  meal_type?: string | null
  calories?: number | null
  eaten_on?: string
  created_at: string
}

interface AdminOverview {
  generated_at: string
  summary: Summary
  users: UserRow[]
  subscriptions: SubRow[]
  recent_meals: ActivityRow[]
  recent_saves: ActivityRow[]
}

const MAX_ATTEMPTS = 5
const LOCKOUT_SECONDS = 60

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString()
}

function planBadge(plan: string) {
  if (plan === 'pro') return <Badge className="bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">pro</Badge>
  if (plan === 'weekly') return <Badge className="bg-teal-50 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300">weekly</Badge>
  return <Badge className="bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400">free</Badge>
}

function statusBadge(status: string) {
  const active = ['active', 'trialing', 'past_due'].includes(status)
  return (
    <Badge
      className={
        active
          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
          : 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400'
      }
    >
      {status}
    </Badge>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <p className="text-sm text-gray-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-slate-100">{value}</p>
    </Card>
  )
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400 dark:border-slate-800 dark:text-slate-500">
            {headers.map((h) => (
              <th key={h} className="px-4 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-slate-800">{children}</tbody>
      </table>
    </Card>
  )
}

export default function AdminPage() {
  const [code, setCode] = useState('')
  const [data, setData] = useState<AdminOverview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [attempts, setAttempts] = useState(0)
  const [lockout, setLockout] = useState(0)
  const lockoutRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (lockout > 0) {
      lockoutRef.current = setInterval(() => {
        setLockout((prev) => {
          if (prev <= 1) {
            if (lockoutRef.current) clearInterval(lockoutRef.current)
            setAttempts(0)
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => {
        if (lockoutRef.current) clearInterval(lockoutRef.current)
      }
    }
  }, [lockout > 0])

  const load = useCallback(
    async (candidate: string) => {
      if (lockout > 0) {
        setError(`Locked out. Try again in ${lockout}s.`)
        return
      }

      setLoading(true)
      setError('')
      try {
        const res = await fetch(`${API_BASE}/admin/overview`, {
          headers: { 'X-Admin-Code': candidate },
          cache: 'no-store',
        })
        if (!res.ok) {
          if (res.status === 429) {
            setLockout(LOCKOUT_SECONDS)
            throw new Error('Too many attempts. Locked for 60 seconds.')
          }
          if (res.status === 403) {
            const newAttempts = attempts + 1
            setAttempts(newAttempts)
            if (newAttempts >= MAX_ATTEMPTS) {
              setLockout(LOCKOUT_SECONDS)
              throw new Error('Too many incorrect attempts. Locked for 60 seconds.')
            }
            throw new Error(`Incorrect code. ${MAX_ATTEMPTS - newAttempts} attempts remaining.`)
          }
          const body = await res.json().catch(() => null)
          throw new Error(typeof body?.detail === 'string' ? body.detail : 'Request failed')
        }
        const json = (await res.json()) as AdminOverview
        setAttempts(0)
        setData(json)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Request failed')
      } finally {
        setLoading(false)
      }
    },
    [attempts, lockout],
  )

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    load(code.trim())
  }

  if (data) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-slate-100">Developer Dashboard</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
              Generated {fmtDate(data.generated_at)} · {data.users.length} users
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => load(code)} disabled={loading}>
              {loading ? <Spinner /> : 'Refresh'}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setData(null)
                setCode('')
              }}
            >
              Sign out
            </Button>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Users" value={data.summary.total_users} />
          <Stat label="Subscriptions" value={data.summary.total_subscriptions} />
          <Stat label="Active subs" value={data.summary.active_subscriptions} />
          <Stat label="Saved recipes" value={data.summary.total_saved_recipes} />
          <Stat label="Meals logged" value={data.summary.total_meals} />
          <Stat label="Suggestions (7d)" value={data.summary.recent_suggestions_7d} />
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-slate-100">Users</h2>
            <Table headers={['Email', 'Name', 'Plan', 'Fridge', 'Meals', 'Saved', 'Registered']}>
              {data.users.map((u) => (
                <tr key={u.email} className="text-gray-700 dark:text-slate-300">
                  <td className="px-4 py-2">{u.email}</td>
                  <td className="px-4 py-2">{u.full_name ?? '—'}</td>
                  <td className="px-4 py-2">{planBadge(u.plan)}</td>
                  <td className="px-4 py-2">{u.fridge_count}</td>
                  <td className="px-4 py-2">{u.meals_count}</td>
                  <td className="px-4 py-2">{u.saved_count}</td>
                  <td className="px-4 py-2">{fmtDate(u.created_at)}</td>
                </tr>
              ))}
              {data.users.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-400">
                    No users yet
                  </td>
                </tr>
              )}
            </Table>
          </div>

          <div>
            <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-slate-100">Subscriptions</h2>
            <Table headers={['Email', 'Amount', 'Status', 'Cancel at end', 'Period end', 'Created']}>
              {data.subscriptions.map((s, i) => (
                <tr key={i} className="text-gray-700 dark:text-slate-300">
                  <td className="px-4 py-2">{s.email}</td>
                  <td className="px-4 py-2">{s.amount_usd != null ? `$${s.amount_usd.toFixed(2)}` : '—'}</td>
                  <td className="px-4 py-2">{statusBadge(s.status)}</td>
                  <td className="px-4 py-2">{s.cancel_at_period_end ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-2">{fmtDate(s.current_period_end)}</td>
                  <td className="px-4 py-2">{fmtDate(s.created_at)}</td>
                </tr>
              ))}
              {data.subscriptions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                    No subscriptions yet
                  </td>
                </tr>
              )}
            </Table>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-slate-100">Recent meals</h2>
              <Table headers={['Email', 'Meal', 'Type', 'Cal']}>
                {data.recent_meals.map((m, i) => (
                  <tr key={i} className="text-gray-700 dark:text-slate-300">
                    <td className="px-4 py-2">{m.email}</td>
                    <td className="px-4 py-2">{m.title}</td>
                    <td className="px-4 py-2">{m.meal_type ?? '—'}</td>
                    <td className="px-4 py-2">{m.calories ?? '—'}</td>
                  </tr>
                ))}
                {data.recent_meals.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                      No meals logged
                    </td>
                  </tr>
                )}
              </Table>
            </div>
            <div>
              <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-slate-100">Recent saves</h2>
              <Table headers={['Email', 'Recipe', 'Saved']}>
                {data.recent_saves.map((s, i) => (
                  <tr key={i} className="text-gray-700 dark:text-slate-300">
                    <td className="px-4 py-2">{s.email}</td>
                    <td className="px-4 py-2">{s.title}</td>
                    <td className="px-4 py-2">{fmtDate(s.created_at)}</td>
                  </tr>
                ))}
                {data.recent_saves.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-gray-400">
                      No saved recipes
                    </td>
                  </tr>
                )}
              </Table>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md items-center justify-center px-4 py-16">
      <Card className="w-full p-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Developer Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">Enter the access code to continue.</p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <Input
            type="password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Access code"
            autoFocus
            maxLength={64}
            disabled={lockout > 0}
          />
          {lockout > 0 && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              Locked out. Try again in {lockout}s.
            </p>
          )}
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading || !code.trim() || lockout > 0}>
            {loading ? <Spinner className="mx-auto" /> : 'Unlock'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
