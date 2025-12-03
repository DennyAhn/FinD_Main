import { MarkdownText } from '@/types'
import './Widgets.css'

interface MarkdownTextProps {
    widget: MarkdownText
}

export default function MarkdownTextWidget({ widget }: MarkdownTextProps) {
    return (
        <div className="markdown-widget">
            <div style={{ whiteSpace: 'pre-wrap' }}>{widget.content}</div>
        </div>
    )
}
