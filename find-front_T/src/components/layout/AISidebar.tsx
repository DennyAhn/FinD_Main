import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { chatApi } from '@/services/api/chat'
import type { ChatMessage } from '@/types'
import WidgetRenderer from '../widgets/WidgetRenderer'
import './AISidebar.css'

export default function AISidebar() {
  const { ticker } = useParams<{ ticker?: string }>()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const quickQuestions = [
    { text: '최근 실적 요약해줘', icon: '📄' },
    { text: '경쟁사랑 ROE 비교해줘', icon: '📊' },
    { text: '애널리스트 의견은?', icon: '🔍' },
  ]

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async (message?: string) => {
    const messageToSend = message || input
    if (!messageToSend.trim() || loading) return

    const userMessage: ChatMessage = {
      role: 'user',
      content: messageToSend,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const response = await chatApi.sendMessage(messageToSend)

      console.log('API Response:', response)
      console.log('Widgets:', response.widgets)

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.response,
        widgets: response.widgets,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      console.error('Chat error:', error)
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: '오류가 발생했습니다. 다시 시도해주세요.',
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  const [width, setWidth] = useState(400)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)

  const startResizing = useCallback(() => {
    setIsResizing(true)
  }, [])

  const stopResizing = useCallback(() => {
    setIsResizing(false)
  }, [])

  const resize = useCallback(
    (mouseMoveEvent: MouseEvent) => {
      if (isResizing) {
        const newWidth = window.innerWidth - mouseMoveEvent.clientX
        if (newWidth > 280 && newWidth < 800) {
          setWidth(newWidth)
        }
      }
    },
    [isResizing]
  )

  useEffect(() => {
    window.addEventListener('mousemove', resize)
    window.addEventListener('mouseup', stopResizing)
    return () => {
      window.removeEventListener('mousemove', resize)
      window.removeEventListener('mouseup', stopResizing)
    }
  }, [resize, stopResizing])

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed)
  }

  return (
    <aside
      className={`ai-sidebar ${isCollapsed ? 'collapsed' : ''}`}
      style={{ width: isCollapsed ? '60px' : `${width}px` }}
      ref={sidebarRef}
    >
      {/* Resize Handle (Left Border) */}
      {!isCollapsed && (
        <div
          className="resize-handle"
          onMouseDown={startResizing}
        />
      )}

      <div className="ai-sidebar-header">
        <div className="ai-sidebar-title">
          {!isCollapsed && <span>StarAI</span>}
          <button onClick={toggleCollapse} className="ai-sidebar-toggle">
            {isCollapsed ? '◀' : '▶'}
          </button>
        </div>
        {!isCollapsed && <button className="ai-sidebar-menu">⋯</button>}
      </div>

      {!isCollapsed && (
        <>
          <div className="ai-sidebar-content">
            <div className="quick-questions">
              <h3 className="quick-questions-title">빠른 질문</h3>
              <div className="quick-questions-list">
                {quickQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    className="quick-question-btn"
                    onClick={() => handleSend(q.text)}
                    disabled={loading}
                  >
                    <span className="quick-question-icon">{q.icon}</span>
                    <span>{q.text}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="ai-chat-messages">
              {messages.map((msg, idx) => (
                <div key={idx} className={`ai-chat-message ${msg.role}`}>
                  <div className="ai-chat-message-content">{msg.content}</div>
                  {/* [NEW] 위젯 렌더링 */}
                  {msg.widgets && msg.widgets.length > 0 && (
                    <div className="ai-chat-widgets" style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px', border: '1px dashed red', padding: '8px' }}>
                      {msg.widgets.map((widget, wIdx) => (
                        <WidgetRenderer key={wIdx} widget={widget} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="ai-chat-message assistant">
                  <div className="ai-chat-message-content">답변을 생성하는 중...</div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="ai-sidebar-footer">
            <div className="ai-input-container">
              <button className="ai-input-attach">📎</button>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="무엇이든 물어보세요"
                className="ai-input"
                disabled={loading}
              />
              <button className="ai-input-menu">⋯</button>
              <button
                onClick={() => handleSend()}
                className="ai-input-send"
                disabled={loading}
              >
                ↑
              </button>
            </div>
            {ticker && (
              <p className="ai-input-hint">
                현재 보고 있는 종목을 자동으로 인식합니다
              </p>
            )}
          </div>
        </>
      )}
    </aside>
  )
}

