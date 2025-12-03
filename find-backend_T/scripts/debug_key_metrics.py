# DB 데이터 접근 확인용 스크립트

import asyncio
import json
import sys
from pathlib import Path

import httpx

# 프로젝트 루트 경로를 sys.path에 추가
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.database import SessionLocal  # noqa: E402
from app import models  # noqa: E402
from app.services.key_metrics_service import fetch_company_key_metrics  # noqa: E402


async def main() -> None:
    ticker = sys.argv[1] if len(sys.argv) > 1 else "AAPL"
    period = sys.argv[2] if len(sys.argv) > 2 else "annual"
    
    print(f"\n{'='*60}")
    print(f"🔍 Key Metrics DB 접근 테스트: {ticker} ({period})")
    print(f"{'='*60}\n")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        with SessionLocal() as db:
            # --- 1. DB에서 직접 쿼리 (원시 데이터 확인) ---
            print("📊 [1단계] DB에서 직접 쿼리 (원시 데이터)")
            print("-" * 60)
            raw_records = (
                db.query(models.CompanyKeyMetrics)
                .filter_by(ticker=ticker, period=period)
                .order_by(models.CompanyKeyMetrics.report_date.desc())
                .limit(5)
                .all()
            )
            
            print(f"✅ 조회된 레코드 수: {len(raw_records)}")
            
            if raw_records:
                print("\n📋 DB 원시 데이터 (최신 3개):")
                for i, record in enumerate(raw_records[:3], 1):
                    print(f"\n  [{i}] {record.report_date} (연도: {record.report_year})")
                    print(f"      PER: {record.pe_ratio}")
                    print(f"      PBR: {record.price_to_book_ratio}")
                    print(f"      ROE: {record.return_on_equity}")
                    print(f"      ROA: {record.return_on_assets}")
                    print(f"      생성일: {record.created_at}")
            else:
                print("⚠️  DB에 데이터가 없습니다.")
            
            # --- 2. 서비스 함수를 통한 접근 (가공된 데이터 확인) ---
            print(f"\n{'='*60}")
            print("📊 [2단계] 서비스 함수를 통한 접근 (가공된 데이터)")
            print("-" * 60)
            
            try:
                service_result = await fetch_company_key_metrics(
                    ticker=ticker, 
                    db=db, 
                    client=client, 
                    period=period, 
                    limit=5
                )
                
                print(f"✅ 서비스 함수 실행 성공")
                print(f"\n📋 반환된 데이터 구조:")
                print(f"  - records 개수: {len(service_result.get('records', []))}")
                print(f"  - insights: {'있음' if service_result.get('insights') else '없음'}")
                print(f"  - summary: {'있음' if service_result.get('summary') else '없음'}")
                
                if service_result.get('records'):
                    print(f"\n📋 records 데이터 (최신 3개):")
                    for i, record in enumerate(service_result['records'][:3], 1):
                        print(f"\n  [{i}] {record.get('report_date')} (연도: {record.get('report_year')})")
                        print(f"      PER: {record.get('pe_ratio')}")
                        print(f"      PBR: {record.get('price_to_book_ratio')}")
                        print(f"      ROE: {record.get('return_on_equity')}")
                        print(f"      ROA: {record.get('return_on_assets')}")
                
                if service_result.get('insights'):
                    insights = service_result['insights']
                    print(f"\n📊 Insights:")
                    print(f"  - 현재 PER: {insights.get('current_pe')}")
                    print(f"  - 이전 PER: {insights.get('previous_pe')}")
                    print(f"  - 평균 PER: {insights.get('average_pe')}")
                    print(f"  - 이전 대비 변화율: {insights.get('change_vs_previous_percent')}%")
                    print(f"  - 평균 대비 변화율: {insights.get('change_vs_average_percent')}%")
                
                if service_result.get('summary'):
                    print(f"\n📝 Summary:")
                    print(f"  {service_result['summary']}")
                
                # --- 3. JSON 전체 출력 (선택사항) ---
                print(f"\n{'='*60}")
                print("📋 [3단계] 전체 JSON 데이터 (디버깅용)")
                print("-" * 60)
                print(json.dumps(service_result, indent=2, ensure_ascii=False, default=str))
                
            except Exception as e:
                print(f"❌ 서비스 함수 실행 실패: {e}")
                import traceback
                traceback.print_exc()
            
            print(f"\n{'='*60}\n")


if __name__ == "__main__":
    asyncio.run(main())

