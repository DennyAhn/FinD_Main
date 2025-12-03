import { Widget, GaugeChart, SparklineCard, DonutChart, MarkdownText, ComprehensiveValuationWidget } from '@/types'
import { SparklineCardWidget, DonutChartWidget, GaugeChartWidget, MarkdownTextWidget, ComprehensiveValuationCard } from '.'

interface WidgetRendererProps {
    widget: Widget
}

export default function WidgetRenderer({ widget }: WidgetRendererProps) {
    switch (widget.type) {
        case 'sparkline_card':
            return <SparklineCardWidget widget={widget as SparklineCard} />
        case 'donut_chart':
            return <DonutChartWidget widget={widget as DonutChart} />
        case 'gauge_chart':
            return <GaugeChartWidget widget={widget as GaugeChart} />
        case 'markdown_text':
            return <MarkdownTextWidget widget={widget as MarkdownText} />
        case 'comprehensive_valuation':
            return <ComprehensiveValuationCard widget={widget as ComprehensiveValuationWidget} />
        case 'data_table':
            return <div>Table Widget (Coming Soon)</div>
        default:
            return null
    }
}
