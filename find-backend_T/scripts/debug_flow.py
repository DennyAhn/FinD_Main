import asyncio
import sys
import os
import json

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.mcp import service
from app.database import SessionLocal
from app import models
import httpx
from app.services.key_metrics_service import fetch_company_key_metrics

async def main():
    db = SessionLocal()
    user = db.query(models.User).filter(models.User.username == "testuser").first()
    
    async with httpx.AsyncClient() as client:
        print("\n--- 1. Testing Tool Direct Execution (fetch_company_key_metrics) ---")
        try:
            tool_result = await fetch_company_key_metrics(
                ticker="AAPL",
                db=db,
                client=client,
                period="annual"
            )
            print("Tool Result Type:", type(tool_result))
            if isinstance(tool_result, dict):
                print("Tool Result Keys:", tool_result.keys())
                widgets = tool_result.get("widgets", [])
                print(f"Widgets Found: {len(widgets)}")
                for w in widgets:
                    print(f" - Widget Type: {w.get('type')}")
            else:
                print("Tool Result:", tool_result)
        except Exception as e:
            print("Tool Execution Error:", e)
            import traceback
            traceback.print_exc()

        print("\n--- 2. Testing Service Execution (run_mcp_agent) ---")
        try:
            service_result = await service.run_mcp_agent(
                user_message="AAPL 밸류에이션 분석해줘",
                current_user=user,
                db=db,
                httpx_client=client
            )
            print("Service Result Type:", type(service_result))
            if isinstance(service_result, dict):
                print("Service Result Keys:", service_result.keys())
                widgets = service_result.get("widgets", [])
                print(f"Service Widgets Found: {len(widgets)}")
                if widgets:
                    print(json.dumps(widgets, indent=2, default=str))
            else:
                print("Service Result:", service_result)
        except Exception as e:
            print("Service Execution Error:", e)
            import traceback
            traceback.print_exc()
        finally:
            db.close()

if __name__ == "__main__":
    asyncio.run(main())
