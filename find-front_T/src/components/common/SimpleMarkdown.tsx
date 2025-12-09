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

  // 인라인 스타일 파서 (**강조**)
  const renderInline = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const content = part.slice(2, -2);
        return (
          <strong
            key={index}
            style={{
              color: '#4cc9f0', // Cyan Point Color
              fontWeight: '700',
            }}
          >
            {content}
          </strong>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div style={{ lineHeight: '1.7', fontSize: '15px', color: '#e0e0e0' }}>
      {lines.map((line, index) => {
        const trimmed = line.trim();
        
        // [Header 3] ### 제목 (최대한 관대한 파싱)
        // "###" 문자가 포함되어 있고, 그 뒤에 뭔가 텍스트가 있으면 헤더로 인식
        if (trimmed.includes('###')) {
          // ### 이후의 모든 텍스트 추출
          const title = trimmed.replace(/^#+\s*/, '').trim();
          
          // [DEBUG]
          console.log('[Header Detected]', title);
          
          // 이모지 포함 여부 OR 키워드 기반 감지 (인사이트, Insights 등)
          const hasEmoji = /[\u{1F300}-\u{1F9FF}]|💡|🔍|📊|⚡|✨|🎯|📈/u.test(title);
          const isKeywordInsight = /인사이트|Insights|분석|Analysis|요약|Summary/i.test(title);
          const shouldHighlight = hasEmoji || isKeywordInsight;

          if (shouldHighlight) {
              // 이모지 추출 (더 강력한 정규식)
              const emojiMatch = title.match(/[\u{1F300}-\u{1F9FF}]|💡|🔍|📊|⚡|✨|🎯|📈/u);
              const emoji = emojiMatch ? emojiMatch[0] : '💡'; // 이모지 없으면 기본값 💡
              const textOnly = title.replace(/[\u{1F300}-\u{1F9FF}]|💡|🔍|📊|⚡|✨|🎯|📈/gu, '').trim();

              return (
                  <div 
                    key={index}
                    style={{
                        margin: '20px 0 16px 0',
                        padding: '14px 18px',
                        background: 'linear-gradient(135deg, rgba(76, 201, 240, 0.15) 0%, rgba(76, 201, 240, 0.05) 100%)',
                        borderLeft: '4px solid #4cc9f0',
                        borderRadius: '0 10px 10px 0',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
                    }}
                  >
                      {emoji && (
                          <span style={{ fontSize: '24px', lineHeight: 1 }}>{emoji}</span>
                      )}
                      <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '600', color: '#fff', letterSpacing: '0.3px' }}>
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
                fontSize: '18px',
                fontWeight: '600',
                color: '#ffffff',
                margin: '24px 0 12px 0',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span 
                style={{
                  display: 'inline-block',
                  width: '4px',
                  height: '18px',
                  backgroundColor: '#4cc9f0',
                  borderRadius: '2px'
                }} 
              />
              {title}
            </h3>
          );
        }

        // [List Item] - 내용
        if (trimmed.startsWith('- ')) {
          return (
            <div 
              key={index} 
              style={{ 
                display: 'flex', 
                alignItems: 'flex-start',
                gap: '10px', 
                marginBottom: '8px',
                paddingLeft: '4px' 
              }}
            >
              <span style={{ 
                  color: '#888', 
                  fontSize: '6px', 
                  marginTop: '10px',
                  flexShrink: 0
              }}>●</span>
              <span style={{ flex: 1 }}>{renderInline(trimmed.replace('- ', ''))}</span>
            </div>
          );
        }

        // [Blockquote] > 인용
        if (trimmed.startsWith('> ')) {
            return (
              <div 
                key={index}
                style={{
                    borderLeft: '3px solid #666',
                    paddingLeft: '12px',
                    margin: '8px 0',
                    color: '#aaa',
                    fontStyle: 'italic',
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    padding: '8px 12px',
                    borderRadius: '0 4px 4px 0'
                }}
              >
                {renderInline(trimmed.replace('> ', ''))}
              </div>
            )
        }

        // [Empty Line]
        if (trimmed === '') {
          return <div key={index} style={{ height: '8px' }} />;
        }

        // [Paragraph] 일반 텍스트
        return (
          <div key={index} style={{ marginBottom: '4px' }}>
            {renderInline(line)}
          </div>
        );
      })}
    </div>
  );
}
