export const formatLargeNumber = (value: number | string, showKorean: boolean = false): string => {
  if (value === undefined || value === null) return '-';

  // 문자열인 경우 숫자 변환 (콤마 제거)
  const num = typeof value === 'string' 
    ? parseFloat(value.replace(/,/g, '')) 
    : value;

  if (isNaN(num)) return String(value);

  // 100만 미만은 일반적인 콤마 포맷
  if (Math.abs(num) < 1e6) {
    return new Intl.NumberFormat('en-US').format(num);
  }

  // USD 포맷팅 (M, B, T)
  let usdFormatted = '';
  if (Math.abs(num) >= 1e12) {
    usdFormatted = `$${(num / 1e12).toFixed(2)}T`;
  } else if (Math.abs(num) >= 1e9) {
    usdFormatted = `$${(num / 1e9).toFixed(1)}B`;
  } else {
    // 100만 단위 ($M)
    usdFormatted = `$${(num / 1e6).toFixed(0)}M`;
  }

  if (!showKorean) return usdFormatted;

  // KRW 환산 (환율 1460원 기준)
  const krwVal = num * 1460;
  let krwFormatted = '';
  
  if (Math.abs(krwVal) >= 1e12) {
    krwFormatted = `${(krwVal / 1e12).toFixed(1)}조원`;
  } else if (Math.abs(krwVal) >= 1e8) {
    krwFormatted = `${(krwVal / 1e8).toFixed(0)}억원`;
  } else {
    // 1억원 미만 (예: 5000만원)
    krwFormatted = `${(krwVal / 1e4).toFixed(0)}만원`;
  }

  return `${usdFormatted} (약 ${krwFormatted})`;
};
