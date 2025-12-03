import { useState, useEffect, useRef } from 'react'
import { chatApi } from '@/services/api/chat'
import type { ChatMessage } from '@/types'
import WidgetRenderer from '@/components/widgets/WidgetRenderer'
import './Chat.css'

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || loading) return

    const userMessage: ChatMessage = {
      role: 'user',
      content: input,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const data = await chatApi.sendMessage(input)
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.response,
        widgets: data.widgets,
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

  return (
    <div className="chat">
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            <p>AI에게 금융 데이터에 대해 질문해보세요!</p>
            <p className="chat-examples">
              예: "애플의 PER을 알려줘", "엔비디아의 현금흐름은 어떤가요?"
            </p>
          </div>
        )}
        {messages.map((msg, idx) => (
          <div key={idx} className={`chat-message ${msg.role}`}>
            <div className="chat-message-content">
              {msg.content}
              {/* 위젯 렌더링 */}
              {msg.widgets && msg.widgets.length > 0 && (
                <div className="chat-widgets">
                  {msg.widgets.map((widget, wIdx) => (
                    <WidgetRenderer key={wIdx} widget={widget} />
                  ))}
                </div>
              )}
            </div>
            <div className="chat-message-time">
              {msg.timestamp.toLocaleTimeString('ko-KR')}
            </div>
          </div>
        ))}
        {loading && (
          <div className="chat-message assistant">
            <div className="chat-message-content">답변을 생성하는 중...</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="chat-input-container">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="메시지를 입력하세요..."
          className="chat-input"
          disabled={loading}
        />
        <button onClick={handleSend} className="chat-send" disabled={loading}>
          전송
        </button>
      </div>
    </div>
  )
}

