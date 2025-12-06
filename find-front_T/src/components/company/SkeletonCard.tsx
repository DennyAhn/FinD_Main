import '@/pages/Dashboard/Dashboard.css'

export default function SkeletonCard() {
    return (
        <div className="dashboard-card skeleton-card">
            {/* 카드 헤더: 로고 + 기업명 스켈레톤 */}
            <div className="card-header">
                <div className="card-logo-wrapper">
                    <div className="card-logo skeleton-shimmer"></div>
                </div>
                <div className="card-company-info">
                    <div className="skeleton-line skeleton-shimmer" style={{ width: '70%', height: '20px', marginBottom: '8px' }}></div>
                    <div className="skeleton-line skeleton-shimmer" style={{ width: '50%', height: '14px' }}></div>
                </div>
            </div>

            {/* 카드 본문: 주가 정보 스켈레톤 */}
            <div className="card-quote">
                <div className="skeleton-line skeleton-shimmer" style={{ width: '60%', height: '28px', marginBottom: '8px' }}></div>
                <div className="skeleton-line skeleton-shimmer" style={{ width: '45%', height: '16px' }}></div>
            </div>
        </div>
    )
}
