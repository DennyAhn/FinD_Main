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
 * 회사의 표시 이름을 반환합니다.
 * 한글명이 있으면 한글명을, 없으면 영문명을 반환합니다.
 */
export function getCompanyDisplayName(company: Company): string {
  return company.k_name || company.companyName
}

