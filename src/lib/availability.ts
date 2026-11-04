import type { Part } from './api.ts';

// Status is authoritative. A missing count is not proof that stock is unavailable,
// and ERP's default lead time must not turn unknown stock into a shipping promise.
export function availabilitySummary(part: Pick<Part, 'availability' | 'leadTimeDays'>) {
  switch (part.availability) {
    case 'in_stock': return { label: 'In Stock', tone: 'positive', confirmedStock: true } as const;
    case 'low_stock': return { label: 'Low Stock', tone: 'positive', confirmedStock: true } as const;
    case 'out_of_stock': return { label: 'Out of Stock', tone: 'negative', confirmedStock: false } as const;
    case 'available':
    case 'special_order':
    case 'backorder': {
      const days = part.leadTimeDays;
      const estimate = typeof days === 'number' && Number.isFinite(days) && days > 0
        ? ` · estimated lead time ${days} ${days === 1 ? 'day' : 'days'}` : '';
      return { label: `${part.availability === 'backorder' ? 'Backorder' : 'Special order'}${estimate}`, tone: 'neutral', confirmedStock: false } as const;
    }
    default: return { label: 'Availability unconfirmed', tone: 'neutral', confirmedStock: false } as const;
  }
}
