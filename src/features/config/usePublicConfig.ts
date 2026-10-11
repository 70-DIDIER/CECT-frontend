import { useQuery } from '@tanstack/react-query'
import { get } from '@/lib/api'

export interface PublicConfig {
  currency: string
  test_mode: boolean
  membership_fees: { natural_person: number; legal_person: number }
  rates_xof_per_yem: { purchase: number; sale: number; transfer: number }
  legal_forms: string[]
  rccm_required: boolean
  nif_required: boolean
  payment_methods: { code: string; label: string; channel: 'mobile_money' | 'manual'; countries: string[] }[]
  content: {
    key_figures: { key: string; value: string; label_fr: string; label_en: string }[]
    faq: { id: string; question_fr: string; answer_fr: string; question_en?: string | null; answer_en?: string | null; published: boolean }[]
    news: { id: string; slug: string; title_fr: string; title_en?: string | null; excerpt_fr: string; excerpt_en?: string | null; content_fr: string; content_en?: string | null; date: string; category: string; published: boolean }[]
    partners: { id: string; name: string; category: string; city: string; address?: string | null; phone?: string | null; description_fr?: string | null; description_en?: string | null; published: boolean }[]
  }
}

export function usePublicConfig() {
  return useQuery({ queryKey: ['public-config'], queryFn: () => get<PublicConfig>('/config'), staleTime: 5 * 60_000 })
}
