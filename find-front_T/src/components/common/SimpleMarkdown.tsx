import React from 'react';

interface SimpleMarkdownProps {
  children: string;
}

/**
 * 트렌디한 금융 리포트 스타일의 마크다운 렌더러
 * 지원 문법:
 * - ### 헤더 (섹션 구분, 이모지 포함 시 카드 스타일)
 * - **강조** (수치 강조)
 * - - 리스트 (가독성)
 * - > 인용문 (요약)
 */
export default function SimpleMarkdown({ children }: SimpleMarkdownProps) {
  if (!children) return null;

  // [DEBUG] 원본 텍스트 확인
  console.log('[SimpleMarkdown] Original text:', children);

  // 1. 줄 단위로 분리
  const lines = children.split('\n');

  // 인라인 스타일 파서 (**강조** + 숫자 자동 강조 + 링크 자동 감지)
  const renderInline = (text: string) => {
    // Step 1: URL 링크 감지 및 변환
    const urlPattern = /(https?:\/\/[^\s]+)/g;
    const partsWithLinks = text.split(urlPattern);
    
    return partsWithLinks.map((part, linkIndex) => {
      // URL인 경우 하이퍼링크로 변환
      if (urlPattern.test(part)) {
        return (
          <a
            key={linkIndex}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#4cc9f0',
              textDecoration: 'underline',
              textDecorationColor: 'rgba(76, 201, 240, 0.5)',
              textUnderlineOffset: '2px',
              transition: 'all 0.2s ease',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#5dd9ff';
              e.currentTarget.style.textDecorationColor = 'rgba(93, 217, 255, 0.8)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#4cc9f0';
              e.currentTarget.style.textDecorationColor = 'rgba(76, 201, 240, 0.5)';
            }}
          >
            {part}
          </a>
        );
      }
      
      // Step 2: **bold** 파싱
      const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
      
      return boldParts.map((boldPart, boldIndex) => {
        if (boldPart.startsWith('**') && boldPart.endsWith('**')) {
          const content = boldPart.slice(2, -2);
          
          // 숫자/금액 패턴 감지 (더 강한 강조)
          const isFinancialData = /[\$₩€£¥]|%|\d+\.\d+[BMK]?|\d{1,3}(,\d{3})*/.test(content);
          
          return (
            <strong
              key={`${linkIndex}-${boldIndex}`}
              style={{
                color: isFinancialData ? '#5dd9ff' : '#4cc9f0',
                fontWeight: '700',
                letterSpacing: '0.3px',
                textShadow: isFinancialData ? '0 0 10px rgba(93, 217, 255, 0.4)' : 'none',
                padding: '1px 4px',
                borderRadius: '3px',
                background: isFinancialData ? 'rgba(76, 201, 240, 0.12)' : 'transparent',
                transition: 'all 0.2s ease'
              }}
            >
              {content}
            </strong>
          );
        }
        
        // Step 3: 일반 텍스트 내 숫자도 강조 (bold 아닌 숫자)
        const numberPattern = /([\$₩€£¥]?\d+\.?\d*[BMK%]?)/g;
        const numParts = boldPart.split(numberPattern);
        
        return numParts.map((numPart, numIndex) => {
          if (numberPattern.test(numPart)) {
            return (
              <span
                key={`${linkIndex}-${boldIndex}-${numIndex}`}
                style={{
                  color: '#6dd9ff',
                  fontWeight: '600',
                  letterSpacing: '0.2px',
                  textShadow: '0 0 6px rgba(109, 217, 255, 0.25)'
                }}
              >
                {numPart}
              </span>
            );
          }
          return <span key={`${linkIndex}-${boldIndex}-${numIndex}`}>{numPart}</span>;
        });
      });
    });
  };

  return (
    <div style={{ 
      lineHeight: '1.8', 
      fontSize: '15px', 
      color: '#e8e8e8',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    }}>
      {lines.map((line, index) => {
        const trimmed = line.trim();
        
        // [Header 3] ### 제목 (최대한 관대한 파싱)
        if (trimmed.includes('###')) {
          const title = trimmed.replace(/^#+\s*/, '').trim();
          
          // [DEBUG]
          console.log('[Header Detected]', title);
          
          // 이모지 포함 여부 OR 키워드 기반 감지
          const hasEmoji = /[\u{1F300}-\u{1F9FF}]|💡|🔍|📊|⚡|✨|🎯|📈/u.test(title);
          const isKeywordInsight = /인사이트|Insights|분석|Analysis|요약|Summary/i.test(title);
          const shouldHighlight = hasEmoji || isKeywordInsight;

          if (shouldHighlight) {
              const emojiMatch = title.match(/[\u{1F300}-\u{1F9FF}]|💡|🔍|📊|⚡|✨|🎯|📈/u);
              const emoji = emojiMatch ? emojiMatch[0] : '💡';
              const textOnly = title.replace(/[\u{1F300}-\u{1F9FF}]|💡|🔍|📊|⚡|✨|🎯|📈/gu, '').trim();

              return (
                  <div 
                    key={index}
                    style={{
                        margin: '24px 0 18px 0',
                        padding: '16px 20px',
                        background: 'linear-gradient(135deg, rgba(76, 201, 240, 0.18) 0%, rgba(76, 201, 240, 0.08) 100%)',
                        borderLeft: '5px solid #4cc9f0',
                        borderRadius: '0 12px 12px 0',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '14px',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(76, 201, 240, 0.1) inset',
                        transition: 'all 0.3s ease'
                    }}
                  >
                      {emoji && (
                          <span style={{ fontSize: '26px', lineHeight: 1, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}>
                            {emoji}
                          </span>
                      )}
                      <h3 style={{ 
                        margin: 0, 
                        fontSize: '17.5px', 
                        fontWeight: '650', 
                        color: '#ffffff', 
                        letterSpacing: '0.4px',
                        textShadow: '0 1px 2px rgba(0,0,0,0.2)'
                      }}>
                          {textOnly}
                      </h3>
                  </div>
              )
          }

          // 일반 헤더
          return (
            <h3
              key={index}
              style={{
                fontSize: '17px',
                fontWeight: '650',
                color: '#f5f5f5',
                margin: '26px 0 14px 0',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                paddingBottom: '8px',
                borderBottom: '1px solid rgba(76, 201, 240, 0.15)'
              }}
            >
              <span 
                style={{
                  display: 'inline-block',
                  width: '4px',
                  height: '20px',
                  background: 'linear-gradient(180deg, #4cc9f0 0%, #3a9fcf 100%)',
                  borderRadius: '2px',
                  boxShadow: '0 0 8px rgba(76, 201, 240, 0.4)'
                }} 
              />
              {title}
            </h3>
          );
        }

        // [List Item] ● 내용
        if (trimmed.startsWith('● ')) {
          return (
            <div 
              key={index} 
              style={{ 
                display: 'flex', 
                alignItems: 'flex-start',
                gap: '12px', 
                marginBottom: '10px',
                paddingLeft: '6px',
                transition: 'all 0.2s ease'
              }}
            >
              <span style={{ 
                  color: '#4cc9f0', 
                  fontSize: '8px', 
                  marginTop: '8px',
                  flexShrink: 0,
                  filter: 'drop-shadow(0 0 2px rgba(76, 201, 240, 0.6))'
              }}>●</span>
              <span style={{ 
                flex: 1, 
                fontSize: '15px',
                lineHeight: '1.7'
              }}>
                {renderInline(trimmed.replace('● ', ''))}
              </span>
            </div>
          );
        }

        // [List Item] - 내용 (기존 호환성)
        if (trimmed.startsWith('- ')) {
          return (
            <div 
              key={index} 
              style={{ 
                display: 'flex', 
                alignItems: 'flex-start',
                gap: '12px', 
                marginBottom: '10px',
                paddingLeft: '6px'
              }}
            >
              <span style={{ 
                  color: '#4cc9f0', 
                  fontSize: '8px', 
                  marginTop: '8px',
                  flexShrink: 0,
                  filter: 'drop-shadow(0 0 2px rgba(76, 201, 240, 0.6))'
              }}>●</span>
              <span style={{ 
                flex: 1,
                fontSize: '15px',
                lineHeight: '1.7'
              }}>
                {renderInline(trimmed.replace('- ', ''))}
              </span>
            </div>
          );
        }

        // [Blockquote] > 인용
        if (trimmed.startsWith('> ')) {
            return (
              <div 
                key={index}
                style={{
                    borderLeft: '4px solid rgba(76, 201, 240, 0.4)',
                    paddingLeft: '16px',
                    margin: '12px 0',
                    color: '#b8b8b8',
                    fontStyle: 'italic',
                    backgroundColor: 'rgba(76, 201, 240, 0.05)',
                    padding: '12px 16px',
                    borderRadius: '0 6px 6px 0',
                    fontSize: '14.5px',
                    lineHeight: '1.6'
                }}
              >
                {renderInline(trimmed.replace('> ', ''))}
              </div>
            )
        }

        // [Empty Line]
        if (trimmed === '') {
          return <div key={index} style={{ height: '10px' }} />;
        }

        // [Paragraph] 일반 텍스트
        return (
          <div key={index} style={{ 
            marginBottom: '6px',
            lineHeight: '1.75'
          }}>
            {renderInline(line)}
          </div>
        );
      })}
    </div>
  );
}
