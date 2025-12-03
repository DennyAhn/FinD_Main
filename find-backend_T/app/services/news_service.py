# app/services/news_service.py
import httpx, json
from sqlalchemy.orm import Session
from app.config import FMP_API_KEY
from app import models
from app.mcp.decorators import register_tool

FMP_BASE_URL = "https://financialmodelingprep.com/api/v3"

@register_tool
async def search_summarized_news(ticker: str, db: Session) -> list:
    """
    특정 티커(ticker)와 연관된 요약 뉴스 목록을 조회합니다.
    """
    db_news = db.query(models.NewsArticle)\
                .filter(models.NewsArticle.symbols.like(f"%{ticker}%"))\
                .order_by(models.NewsArticle.publishedDate.desc())\
                .limit(10).all()
    return [{"title": n.title, "summary": n.summary, "url": n.url, "publishedDate": n.publishedDate.isoformat()} for n in db_news]

async def fetch_and_store_latest_news(db: Session, client: httpx.AsyncClient):
    print("[Celery Task] 최신 뉴스 수집 시작...")
    url = f"{FMP_BASE_URL}/stock_news?limit=100&apikey={FMP_API_KEY}"
    try:
        response = await client.get(url)
        response.raise_for_status()
        data = response.json()
        count = 0
        for item in data:
            exists = db.query(models.NewsArticle).filter_by(url=item.get("url")).first()
            if not exists:
                # title과 summary가 None이거나 빈 문자열인 경우 처리
                title = item.get("title") or ""
                summary = item.get("text") or ""
                
                new_article = models.NewsArticle(
                    url=item.get("url"),
                    title=title,
                    publishedDate=item.get("publishedDate"),
                    symbols=item.get("symbols"),
                    summary=summary
                )
                db.add(new_article)
                count += 1
        db.commit()
        print(f"[Celery Task] 뉴스 {count}건 신규 저장 완료.")
    except Exception as e:
        db.rollback()
        print(f"[Celery Task] 뉴스 수집 중 에러: {e}") 

