import type { LucideIcon } from 'lucide-react'
import { ArrowUpRight, ShoppingCart, Wallet, Store } from 'lucide-react'

export type PackFamilyId = 'vendeur' | 'consommateur' | 'personnel' | 'marchand'

export interface PackFamily {
  id: PackFamilyId
  icon: LucideIcon
  forLegal?: boolean
}

export const PACK_FAMILIES: PackFamily[] = [
  { id: 'vendeur', icon: ArrowUpRight },
  { id: 'consommateur', icon: ShoppingCart },
  { id: 'personnel', icon: Wallet },
  { id: 'marchand', icon: Store, forLegal: true },
]
