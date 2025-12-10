/**
 * 미국 주식 시장 거래 시간 유틸리티
 */

import { timeApi } from '@/services/api/time'

export interface MarketStatus {
  isOpen: boolean
  message: string
  nextOpen?: Date
  nextClose?: Date
}

// 서버 시간과의 오프셋 (밀리초)
let serverTimeOffset = 0

/**
 * 서버 시간과 동기화합니다.
 * 앱 시작 시 호출하여 클라이언트와 서버 시간 차이를 계산합니다.
 */
export async function syncServerTime(): Promise<void> {
  try {
    const clientTimeBefore = Date.now()
    const serverTime = await timeApi.getServerTime()
    const clientTimeAfter = Date.now()

    // 네트워크 지연을 고려한 평균 시간
    const networkDelay = (clientTimeAfter - clientTimeBefore) / 2
    const estimatedServerTime = serverTime.timestamp + networkDelay

    // 서버 시간과 클라이언트 시간의 차이 계산
    serverTimeOffset = estimatedServerTime - clientTimeBefore

    console.log(`[시간 동기화 성공] 서버 시간 오프셋: ${serverTimeOffset}ms`)

    // 성공 시 30분마다 자동으로 재동기화
    setTimeout(() => {
      syncServerTime().catch(console.error)
    }, 30 * 60 * 1000) // 30분
  } catch (error) {
    console.warn('[시간 동기화 실패] 클라이언트 시간 사용, 재시도 예정:', error)
    serverTimeOffset = 0

    // 실패 시 1분 후 재시도 (서버 재시작 감지 개선)
    // 서버가 꺼져있을 때는 더 자주 체크하여 빠르게 복구
    setTimeout(() => {
      syncServerTime().catch(console.error)
    }, 1 * 60 * 1000) // 1분 (기존 5분에서 개선)
  }
}

/**
 * 서버 시간을 기준으로 한 현재 시간을 반환합니다.
 */
function getSyncedTime(): Date {
  return new Date(Date.now() + serverTimeOffset)
}

/**
 * 미국 동부 시간대에서 DST(Daylight Saving Time) 적용 여부 확인
 * DST: 3월 두 번째 일요일 2:00 AM ~ 11월 첫 번째 일요일 2:00 AM
 */
function isDST(date: Date): boolean {
  const year = date.getFullYear()
  const month = date.getMonth() // 0-11

  // 3월 이전 또는 11월 이후는 DST 아님
  if (month < 2 || month > 10) return false

  // 4월~10월은 확실히 DST
  if (month > 2 && month < 10) return true

  // 3월: 두 번째 일요일 이후부터 DST
  if (month === 2) {
    const firstDay = new Date(year, 2, 1)
    const firstSunday = firstDay.getDay() === 0 ? 1 : 8 - firstDay.getDay()
    const secondSunday = firstSunday + 7
    return date.getDate() >= secondSunday
  }

  // 11월: 첫 번째 일요일 이전까지만 DST
  if (month === 10) {
    const firstDay = new Date(year, 10, 1)
    const firstSunday = firstDay.getDay() === 0 ? 1 : 8 - firstDay.getDay()
    return date.getDate() < firstSunday
  }

  return false
}

/**
 * 한국 시간을 미국 동부 시간으로 변환
 * Intl API를 사용하여 정확한 시간대 변환
 */
function getEasternTime(koreaDate: Date): { hour: number; minute: number; day: number } {
  // Intl API를 사용하여 동부 시간으로 변환
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
    weekday: 'short'
  })

  const parts = formatter.formatToParts(koreaDate)
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10)
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10)
  const weekday = parts.find(p => p.type === 'weekday')?.value || ''

  // 요일을 숫자로 변환 (0=일, 1=월, ..., 6=토)
  const dayMap: Record<string, number> = {
    'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
  }
  const day = dayMap[weekday] ?? 0

  // 디버깅용 로그 (개발 환경에서만)
  if (import.meta.env.DEV) {
    console.log('[시간 변환]', {
      koreaTime: koreaDate.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      easternTime: `${hour}:${minute.toString().padStart(2, '0')}`,
      day: ['일', '월', '화', '수', '목', '금', '토'][day],
      weekday
    })
  }

  return { hour, minute, day }
}

/**
 * 미국 시장이 현재 열려있는지 확인
 * 
 * 미국 동부 시간 (EST/EDT):
 * - 장 시작: 9:30 AM (동부 시간)
 * - 장 마감: 4:00 PM (동부 시간)
 * - 주말: 토요일, 일요일 마감
 */
export function isUSMarketOpen(): MarketStatus {
  const now = getSyncedTime()

  // Intl API를 사용하여 미국 동부 시간으로 직접 변환
  const easternFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
    weekday: 'short'
  })

  const easternParts = easternFormatter.formatToParts(now)
  const easternHour = parseInt(easternParts.find(p => p.type === 'hour')?.value || '0', 10)
  const easternMinute = parseInt(easternParts.find(p => p.type === 'minute')?.value || '0', 10)
  const easternWeekday = easternParts.find(p => p.type === 'weekday')?.value || ''

  // 요일 체크 (주말 체크)
  const dayMap: Record<string, number> = {
    'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
  }
  const easternDay = dayMap[easternWeekday] ?? 0

  // 주말 체크 (미국 동부 시간 기준)
  if (easternDay === 0 || easternDay === 6) {
    return {
      isOpen: false,
      message: '주말 (장 마감)',
    }
  }

  // 장 시간 체크 (미국 동부 시간 기준: 9:30 AM ~ 4:00 PM)
  const currentMinutes = easternHour * 60 + easternMinute
  const openMinutes = 9 * 60 + 30 // 9:30 AM
  const closeMinutes = 16 * 60 // 4:00 PM

  const isOpen = currentMinutes >= openMinutes && currentMinutes < closeMinutes

  // 디버깅용 로그 (항상 출력하여 문제 진단)
  const koreaTime = now.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
  const utcTime = now.toISOString()
  const clientTime = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
  const serverTimeOffsetMs = serverTimeOffset
  
  console.log('[미국 장 상태 체크]', {
    clientTime,
    serverTimeOffset: `${serverTimeOffsetMs}ms`,
    syncedTime: koreaTime,
    utcTime,
    easternTime: `${easternHour}:${easternMinute.toString().padStart(2, '0')} (America/New_York)`,
    easternWeekday,
    currentMinutes,
    openMinutes: 570, // 9:30 AM
    closeMinutes: 960, // 4:00 PM
    isOpen,
    reason: isOpen ? '장 중' : (easternDay === 0 || easternDay === 6 ? '주말' : '장 마감 시간')
  })

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

  const now = getSyncedTime()
  const { hour: easternHour, minute: easternMinute, day: easternDay } = getEasternTime(now)

  // 다음 평일 9:30 AM (미국 동부 시간) 찾기
  let daysToAdd = 0

  // 현재 시간이 장 오픈 시간 이후이거나 주말이면 다음 평일로
  const currentMinutes = easternHour * 60 + easternMinute
  if (currentMinutes >= 16 * 60 || easternDay === 0 || easternDay === 6) {
    if (easternDay === 6) {
      // 토요일 → 월요일
      daysToAdd = 2
    } else if (easternDay === 0) {
      // 일요일 → 월요일
      daysToAdd = 1
    } else {
      // 평일이지만 장 마감 → 다음날
      daysToAdd = 1
    }
  }

  // 다음 개장 시간 계산 (미국 동부 시간 9:30 AM)
  // 현재 시간에서 daysToAdd만큼 더한 후, 동부 시간이 9:30 AM이 되도록 설정
  let nextOpen = new Date(now)
  nextOpen.setDate(nextOpen.getDate() + daysToAdd)

  // 동부 시간이 9:30 AM이 되도록 한국 시간 계산
  // Intl API를 사용하여 역변환
  let attempts = 0
  while (attempts < 10) {
    const testFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    })

    const testParts = testFormatter.formatToParts(nextOpen)
    const testHour = parseInt(testParts.find(p => p.type === 'hour')?.value || '0', 10)
    const testMinute = parseInt(testParts.find(p => p.type === 'minute')?.value || '0', 10)

    if (testHour === 9 && testMinute === 30) {
      break
    } else if (testHour < 9 || (testHour === 9 && testMinute < 30)) {
      // 아직 오픈 시간 전이면 시간 추가
      nextOpen.setHours(nextOpen.getHours() + 1)
    } else {
      // 이미 지났으면 하루 추가
      nextOpen.setDate(nextOpen.getDate() + 1)
      nextOpen.setHours(0, 0, 0, 0)
    }
    attempts++
  }

  // 정확히 9:30 AM이 되도록 조정
  // 한국 시간에서 동부 시간 9:30 AM을 역산
  const targetEasternHour = 9
  const targetEasternMinute = 30

  // Formatter 정의
  const easternFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false
  })

  // 여러 시간을 시도하여 동부 시간이 9:30 AM이 되는 한국 시간 찾기
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const testTime = new Date(nextOpen)
      testTime.setHours(hour, minute, 0, 0)

      const testParts = easternFormatter.formatToParts(testTime)
      const testHour = parseInt(testParts.find((p: any) => p.type === 'hour')?.value || '0', 10)
      const testMinute = parseInt(testParts.find((p: any) => p.type === 'minute')?.value || '0', 10)

      if (testHour === targetEasternHour && testMinute === targetEasternMinute) {
        nextOpen = testTime
        break
      }
    }
  }

  return Math.max(0, nextOpen.getTime() - now.getTime())
}

/**
 * 다음 시장 마감 시간까지 남은 시간 (밀리초)
 */
export function getTimeUntilMarketClose(): number {
  const status = isUSMarketOpen()
  if (!status.isOpen) return 0

  const now = getSyncedTime()

  // Intl API를 사용하여 미국 동부 시간으로 변환
  const easternFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false
  })

  // 현재 동부 시간 확인
  const currentParts = easternFormatter.formatToParts(now)
  const currentEasternHour = parseInt(currentParts.find(p => p.type === 'hour')?.value || '0', 10)
  const currentEasternMinute = parseInt(currentParts.find(p => p.type === 'minute')?.value || '0', 10)

  // 목표: 동부 시간 4:00 PM (16:00)
  const targetEasternHour = 16
  const targetEasternMinute = 0

  // 현재 동부 시간이 4:00 PM 이후인지 확인
  const currentEasternMinutes = currentEasternHour * 60 + currentEasternMinute
  const targetEasternMinutes = targetEasternHour * 60 + targetEasternMinute

  // 오늘 4:00 PM을 찾기 위해 한국 시간을 조정
  // 동부 시간 4:00 PM은 한국 시간으로 다음날 새벽이므로
  // 현재 시간에서 24시간 범위 내에서 찾기
  let nextClose = new Date(now)
  nextClose.setHours(0, 0, 0, 0) // 오늘 자정으로 초기화

  let found = false
  // 최대 48시간 범위에서 검색 (오늘 + 내일)
  for (let hoursOffset = 0; hoursOffset < 48 && !found; hoursOffset++) {
    const testTime = new Date(nextClose)
    testTime.setHours(testTime.getHours() + hoursOffset)

    // 현재 시간보다 미래여야 함
    if (testTime <= now) continue

    const testParts = easternFormatter.formatToParts(testTime)
    const testHour = parseInt(testParts.find(p => p.type === 'hour')?.value || '0', 10)
    const testMinute = parseInt(testParts.find(p => p.type === 'minute')?.value || '0', 10)

    if (testHour === targetEasternHour && testMinute === targetEasternMinute) {
      nextClose = testTime
      found = true
    }
  }

  // 디버깅용 로그
  if (import.meta.env.DEV) {
    const closeParts = easternFormatter.formatToParts(nextClose)
    const closeHour = parseInt(closeParts.find(p => p.type === 'hour')?.value || '0', 10)
    const closeMinute = parseInt(closeParts.find(p => p.type === 'minute')?.value || '0', 10)
    const hoursRemaining = Math.floor((nextClose.getTime() - now.getTime()) / (1000 * 60 * 60))
    const minutesRemaining = Math.floor(((nextClose.getTime() - now.getTime()) % (1000 * 60 * 60)) / (1000 * 60))

    console.log('[마감 시간 계산]', {
      현재동부시간: `${currentEasternHour}:${currentEasternMinute.toString().padStart(2, '0')}`,
      목표동부시간: `${targetEasternHour}:${targetEasternMinute.toString().padStart(2, '0')}`,
      계산된마감동부시간: `${closeHour}:${closeMinute.toString().padStart(2, '0')}`,
      남은시간: `${hoursRemaining}시간 ${minutesRemaining}분`
    })
  }

  return Math.max(0, nextClose.getTime() - now.getTime())
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

