"""대화 메모리 관리용 서비스 모듈."""
# app/services/memory_service.py
from sqlalchemy.orm import Session
from app import models
from app.mcp.decorators import register_tool

@register_tool
async def get_chat_history(user_id: int, db: Session, limit: int = 5) -> list:
    """
    지정된 사용자(user_id)의 최근 대화 이력을 limit 개수만큼 조회합니다.
    """
    db_history = db.query(models.ChatHistory)\
                   .filter(models.ChatHistory.user_id == user_id)\
                   .order_by(models.ChatHistory.created_at.desc())\
                   .limit(limit * 2) \
                   .all()
    return [{"role": msg.role, "content": msg.content} for msg in reversed(db_history)]

