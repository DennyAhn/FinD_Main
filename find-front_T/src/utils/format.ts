/**
 * 숫자 포맷팅 유틸리티
 */

export const formatCurrency = (value: number, currency: string = 'USD'): string => {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency,
  }).format(value)
}

export const formatNumber = (value: number): string => {
  return new Intl.NumberFormat('ko-KR').format(value)
}

export const formatPercent = (value: number, decimals: number = 2): string => {
  return `${value.toFixed(decimals)}%`
}

export const formatDate = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d)
}

