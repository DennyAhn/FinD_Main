"""
기존 company_profiles 데이터에 logo_url 업데이트
"""
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import httpx
import asyncio
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app import models
from app.config import FMP_API_KEY, FMP_BASE_URL

async def update_logo_urls():
    """모든 company_profiles의 logo_url을 업데이트"""
    
    db: Session = SessionLocal()
    
    try:
        # logo_url이 NULL인 모든 회사 조회
        companies = db.query(models.CompanyProfile).filter(
            models.CompanyProfile.logo_url.is_(None)
        ).all()
        
        if not companies:
            print("✅ 업데이트할 회사가 없습니다. (모든 logo_url이 이미 설정됨)")
            return
        
        print(f"📊 총 {len(companies)}개 회사의 logo_url을 업데이트합니다...\n")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            updated_count = 0
            failed_count = 0
            
            for idx, company in enumerate(companies, 1):
                ticker = company.ticker
                print(f"[{idx}/{len(companies)}] {ticker} ({company.companyName})... ", end='')
                
                try:
                    # FMP API에서 프로필 조회
                    url = f"{FMP_BASE_URL}/profile/{ticker}?apikey={FMP_API_KEY}"
                    response = await client.get(url)
                    
                    if response.status_code == 200:
                        data = response.json()
                        if data and len(data) > 0:
                            profile = data[0]
                            
                            # 1순위: FMP image
                            logo_url = profile.get('image')
                            
                            # 2순위: Clearbit (website 기반)
                            if not logo_url and company.website:
                                domain = company.website.replace('https://', '').replace('http://', '').split('/')[0]
                                logo_url = f"https://logo.clearbit.com/{domain}"
                            
                            if logo_url:
                                company.logo_url = logo_url
                                db.commit()
                                print(f"✅ {logo_url[:60]}...")
                                updated_count += 1
                            else:
                                print("⚠️  로고 URL을 찾을 수 없음")
                                failed_count += 1
                        else:
                            print("⚠️  API 응답 데이터 없음")
                            failed_count += 1
                    else:
                        print(f"❌ API 오류 ({response.status_code})")
                        failed_count += 1
                
                except Exception as e:
                    print(f"❌ 오류: {e}")
                    failed_count += 1
                
                # API Rate Limit 방지
                await asyncio.sleep(0.2)
        
        print(f"\n{'='*60}")
        print(f"✅ 업데이트 완료: {updated_count}개")
        print(f"❌ 실패: {failed_count}개")
        print(f"{'='*60}")
        
    except Exception as e:
        print(f"\n오류 발생: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("="*60)
    print("Company Profiles Logo URL 업데이트 스크립트")
    print("="*60)
    asyncio.run(update_logo_urls())

