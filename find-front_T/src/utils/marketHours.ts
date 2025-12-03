/**
 * 미국 주식 시장 거래 시간 유틸리티
 */

export interface MarketStatus {
  isOpen: boolean
  message: string
  nextOpen?: Date
  nextClose?: Date
}

/**
 * 미국 시장이 현재 열려있는지 확인
 * 
 * 미국 동부 시간 (EST/EDT):
 * - 장 시작: 9:30 AM
 * - 장 마감: 4:00 PM
 * 
 * 한국 시간 (KST):
 * - 하계 (3월-11월): 22:30 ~ 05:00 (다음날)
 * - 동계 (11월-3월): 23:30 ~ 06:00 (다음날)
 */
export function isUSMarketOpen(): MarketStatus {
  const now = new Date()
  const koreaHour = now.getHours()
  const koreaMinute = now.getMinutes()
  const koreaDay = now.getDay() // 0=일, 1=월, ..., 6=토

  // 주말 체크 (토요일, 일요일)
  if (koreaDay === 0 || koreaDay === 6) {
    return {
      isOpen: false,
      message: '주말 (장 마감)',
    }
  }

  // DST(Daylight Saving Time) 간단 추정
  // 3월 두 번째 일요일 ~ 11월 첫 번째 일요일: 하계
  const month = now.getMonth() + 1 // 1~12
  const isDST = month >= 3 && month <= 10 // 대략적인 하계 시간

  let openHour: number, openMinute: number
  let closeHour: number, closeMinute: number

  if (isDST) {
    // 하계: 22:30 ~ 05:00 (다음날)
    openHour = 22
    openMinute = 30
    closeHour = 5
    closeMinute = 0
  } else {
    // 동계: 23:30 ~ 06:00 (다음날)
    openHour = 23
    openMinute = 30
    closeHour = 6
    closeMinute = 0
  }

  // 현재 시간을 분 단위로 변환
  const currentMinutes = koreaHour * 60 + koreaMinute
  const openMinutes = openHour * 60 + openMinute
  const closeMinutes = closeHour * 60 + closeMinute

  // 장 시간 체크 (자정을 넘어가는 경우 처리)
  let isOpen = false
  if (openHour > closeHour) {
    // 자정 넘어가는 경우 (예: 22:30 ~ 05:00)
    isOpen = currentMinutes >= openMinutes || currentMinutes < closeMinutes
  } else {
    // 같은 날 안에 있는 경우
    isOpen = currentMinutes >= openMinutes && currentMinutes < closeMinutes
  }

  return {
    isOpen,
    message: isOpen ? '장 중 (실시간 업데이트)' : '장 마감',
  }
}

/**
 * 다음 시장 오픈 시간까지 남은 시간 (밀리초)
 */
export function getTimeUntilMarketOpen(): number {
  const status = isUSMarketOpen()
  if (status.isOpen) return 0

  const now = new Date()
  const month = now.getMonth() + 1
  const isDST = month >= 3 && month <= 10

  const openHour = isDST ? 22 : 23
  const openMinute = 30

  // 오늘 또는 내일의 장 오픈 시간
  const nextOpen = new Date(now)
  nextOpen.setHours(openHour, openMinute, 0, 0)

  // 이미 지나간 시간이면 내일로
  if (nextOpen <= now) {
    nextOpen.setDate(nextOpen.getDate() + 1)
  }

  // 주말이면 월요일로
  const day = nextOpen.getDay()
  if (day === 0) nextOpen.setDate(nextOpen.getDate() + 1) // 일요일 → 월요일
  if (day === 6) nextOpen.setDate(nextOpen.getDate() + 2) // 토요일 → 월요일

  return nextOpen.getTime() - now.getTime()
}

/**
 * 다음 시장 마감 시간까지 남은 시간 (밀리초)
 */
export function getTimeUntilMarketClose(): number {
  const status = isUSMarketOpen()
  if (!status.isOpen) return 0

  const now = new Date()
  const month = now.getMonth() + 1
  const isDST = month >= 3 && month <= 10

  const closeHour = isDST ? 5 : 6
  const closeMinute = 0

  // 오늘 또는 내일의 장 마감 시간
  const nextClose = new Date(now)
  nextClose.setHours(closeHour, closeMinute, 0, 0)

  // 장 마감이 다음날 새벽이므로, 현재가 자정 이전이면 다음날로
  const currentHour = now.getHours()
  if (currentHour >= (isDST ? 22 : 23)) {
    nextClose.setDate(nextClose.getDate() + 1)
  }

  return nextClose.getTime() - now.getTime()
}

/**
 * 밀리초를 "X시간 Y분" 형식으로 변환
 */
export function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return '0분'

  const totalMinutes = Math.floor(ms / (1000 * 60))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours > 0 && minutes > 0) {
    return `${hours}시간 ${minutes}분`
  } else if (hours > 0) {
    return `${hours}시간`
  } else {
    return `${minutes}분`
  }
}

/**
 * 마켓 상태와 카운트다운 메시지
 */
export function getMarketStatusMessage(): string {
  const status = isUSMarketOpen()
  
  if (status.isOpen) {
    const msUntilClose = getTimeUntilMarketClose()
    const timeStr = formatTimeRemaining(msUntilClose)
    return `장 중 · 마감 ${timeStr} 전`
  } else {
    const msUntilOpen = getTimeUntilMarketOpen()
    const timeStr = formatTimeRemaining(msUntilOpen)
    return `장 마감 · 개장 ${timeStr} 전`
  }
}

