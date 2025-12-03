import asyncio
import sys
import os

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.mcp import service
from app.database import SessionLocal
from app import models
import httpx

async def main():
    db = SessionLocal()
    # Create a dummy user if not exists
    user = db.query(models.User).filter(models.User.username == "testuser").first()
    if not user:
        user = models.User(username="testuser", name="Test", age=30, email="test@example.com", hashed_password="hash")
        db.add(user)
        db.commit()
        db.refresh(user)
    
    async with httpx.AsyncClient() as client:
        print("--- Testing run_mcp_agent ---")
        try:
            result = await service.run_mcp_agent(
                user_message="AAPL 밸류에이션 분석해줘",
                current_user=user,
                db=db,
                httpx_client=client
            )
            print("Result type:", type(result))
            if isinstance(result, dict):
                print("Content length:", len(result.get("content", "")))
                print("Widgets count:", len(result.get("widgets", [])))
                print("Widgets:", result.get("widgets"))
            else:
                print("Result:", result)
        except Exception as e:
            print("Error:", e)
            import traceback
            traceback.print_exc()
        finally:
            db.close()

if __name__ == "__main__":
    asyncio.run(main())
