import './Error.css'

interface ErrorProps {
  message?: string
  onRetry?: () => void
}

export default function Error({ message = '오류가 발생했습니다.', onRetry }: ErrorProps) {
  return (
    <div className="error">
      <p className="error-message">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="error-retry">
          다시 시도
        </button>
      )}
    </div>
  )
}

