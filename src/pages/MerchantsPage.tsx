import { useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useQuery } from '@tanstack/react-query'
import { MapPin, Phone, Search, Store } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Section, SectionHeader } from '@/components/ui/Section'
import { EmptyState } from '@/components/ui/EmptyState'
import { get } from '@/lib/api'

interface Merchant {
  id: string
  name: string
  activity: string | null
  city: string | null
  address: string | null
  phone: string | null
  description: string | null
}

export default function MerchantsPage() {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [city, setCity] = useState('')
  const query = useQuery({ queryKey: ['public-merchants'], queryFn: () => get<Merchant[]>('/merchants'), staleTime: 60_000 })

  const cities = useMemo(
    () => [...new Set((query.data ?? []).map((merchant) => merchant.city).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, 'fr')),
    [query.data],
  )

  const visible = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('fr')
    return (query.data ?? []).filter((merchant) => {
      if (city && merchant.city !== city) return false
      if (!needle) return true
      return [merchant.name, merchant.activity, merchant.city, merchant.address, merchant.description]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase('fr').includes(needle))
    })
  }, [query.data, search, city])

  return (
    <>
      <Helmet>
        <title>{t('merchants.title')} — CECT Togo</title>
      </Helmet>

      <Section>
        <SectionHeader title={t('merchants.title')} subtitle={t('merchants.subtitle')} />

        <div className="mx-auto mb-8 flex max-w-5xl flex-wrap gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
          <div className="relative min-w-0 flex-1 basis-64">
            <Search size={16} aria-hidden className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('merchants.search')}
              className="min-h-[44px] w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>
          <select
            value={city}
            onChange={(event) => setCity(event.target.value)}
            className="min-h-[44px] min-w-44 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm"
          >
            <option value="">{t('merchants.allCities')}</option>
            {cities.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>

        {query.isPending && (
          <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((item) => <div key={item} className="h-52 animate-pulse rounded-3xl bg-[var(--color-surface-alt)]" />)}
          </div>
        )}

        {query.isError && (
          <div className="mx-auto max-w-3xl rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center text-sm text-[var(--color-text-muted)]">
            {t('merchants.error')}
          </div>
        )}

        {query.data && visible.length === 0 && (
          <div className="mx-auto max-w-3xl rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
            <EmptyState title={t('merchants.emptyTitle')} description={t('merchants.emptyDescription')} />
          </div>
        )}

        <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((merchant) => (
            <article key={merchant.id} className="group flex flex-col rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                <Store size={22} aria-hidden />
              </span>
              <h2 className="mt-4 text-lg font-extrabold tracking-tight text-[var(--color-text)]">{merchant.name}</h2>
              {merchant.activity && <p className="mt-1 text-sm font-semibold text-[var(--color-primary)]">{merchant.activity}</p>}
              {merchant.description && <p className="mt-3 line-clamp-4 text-sm leading-6 text-[var(--color-text-muted)]">{merchant.description}</p>}
              <div className="mt-auto space-y-2 pt-5 text-sm text-[var(--color-text-muted)]">
                {(merchant.address || merchant.city) && (
                  <p className="flex items-start gap-2">
                    <MapPin size={15} className="mt-0.5 shrink-0 text-[var(--color-primary)]" aria-hidden />
                    <span>{[merchant.address, merchant.city].filter(Boolean).join(' · ')}</span>
                  </p>
                )}
                {merchant.phone && (
                  <p className="flex items-center gap-2">
                    <Phone size={15} className="shrink-0 text-[var(--color-primary)]" aria-hidden />
                    <a href={`tel:${merchant.phone}`} className="font-semibold hover:text-[var(--color-primary)]">{merchant.phone}</a>
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>
      </Section>
    </>
  )
}
