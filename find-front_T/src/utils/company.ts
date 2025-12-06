import type { Company } from '@/types'

/**
 * 회사 로고 URL을 반환합니다.
 * DB에 저장된 logo_url이 있으면 사용하고, 없으면 Clearbit API를 사용합니다.
 */
export function getCompanyLogoUrl(company: Company): string {
  if (company.logo_url) {
    return company.logo_url
  }
  
  if (company.website) {
    const domain = company.website
      .replace('https://', '')
      .replace('http://', '')
      .split('/')[0]
    return `https://logo.clearbit.com/${domain}`
  }
  
  // 기본 플레이스홀더 SVG
  return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%236b7280"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>'
}

/**
 * 회사의 한글명을 반환합니다.
 * 백엔드에서 제공하는 k_name 필드를 사용합니다.
 */
export function getCompanyKoreanName(company: Company): string | undefined {
  return company.k_name
}

/**
 * 회사의 표시 이름을 반환합니다.
 * 한글명이 있으면 한글명을, 없으면 영문명을 반환합니다.
 */
export function getCompanyDisplayName(company: Company): string {
  return company.k_name || company.companyName
}

/**
 * 티커 기반 브랜드 컬러를 반환합니다.
 * 주요 기업은 하드코딩된 색상을 사용하고, 나머지는 티커 기반 일관된 랜덤 색상을 생성합니다.
 */
export function getBrandColor(ticker: string): string {
  // 주요 기업 브랜드 컬러 (하드코딩)
  const brandColors: Record<string, string> = {
    'NVDA': '#76b900', // NVIDIA - 초록
    'TSLA': '#e31937', // Tesla - 빨강
    'AAPL': '#a8a8a8', // Apple - 회색
    'MSFT': '#00a4ef', // Microsoft - 파랑
    'GOOGL': '#4285f4', // Google - 파랑
    'AMZN': '#ff9900', // Amazon - 주황
    'META': '#0081fb', // Meta - 파랑
    'NFLX': '#e50914', // Netflix - 빨강
    'AMD': '#ed1c24', // AMD - 빨강
    'INTC': '#0071c5', // Intel - 파랑
  }
  
  // 하드코딩된 색상이 있으면 반환
  if (brandColors[ticker]) {
    return brandColors[ticker]
  }
  
  // 티커 문자열을 해시하여 일관된 색상 생성
  let hash = 0
  for (let i = 0; i < ticker.length; i++) {
    hash = ticker.charCodeAt(i) + ((hash << 5) - hash)
  }
  
  // HSL 색공간을 사용하여 밝고 세련된 색상 생성
  // Hue: 0-360 (색상), Saturation: 60-80% (채도), Lightness: 50-70% (밝기)
  const hue = Math.abs(hash) % 360
  const saturation = 60 + (Math.abs(hash) % 20) // 60-80%
  const lightness = 50 + (Math.abs(hash) % 20) // 50-70%
  
  // HSL을 RGB로 변환
  const hslToRgb = (h: number, s: number, l: number): string => {
    s /= 100
    l /= 100
    const c = (1 - Math.abs(2 * l - 1)) * s
    const x = c * (1 - Math.abs((h / 60) % 2 - 1))
    const m = l - c / 2
    let r = 0, g = 0, b = 0
    
    if (0 <= h && h < 60) {
      r = c; g = x; b = 0
    } else if (60 <= h && h < 120) {
      r = x; g = c; b = 0
    } else if (120 <= h && h < 180) {
      r = 0; g = c; b = x
    } else if (180 <= h && h < 240) {
      r = 0; g = x; b = c
    } else if (240 <= h && h < 300) {
      r = x; g = 0; b = c
    } else if (300 <= h && h < 360) {
      r = c; g = 0; b = x
    }
    
    r = Math.round((r + m) * 255)
    g = Math.round((g + m) * 255)
    b = Math.round((b + m) * 255)
    
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
  }
  
  return hslToRgb(hue, saturation, lightness)
}

