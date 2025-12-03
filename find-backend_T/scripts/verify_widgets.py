import asyncio
import httpx

async def verify_widgets(ticker="AAPL"):
    async with httpx.AsyncClient(base_url="http://localhost:8000") as client:
        print(f"--- Verifying Widgets for {ticker} ---")
        
        # 1. Analyst Consensus
        try:
            resp = await client.get(f"/api/v1/company/widgets/analyst-consensus/{ticker}")
            if resp.status_code == 200:
                print("[SUCCESS] Analyst Consensus Widget:")
                print(resp.json())
            else:
                print(f"[FAILURE] Analyst Consensus Widget: {resp.status_code} - {resp.text}")
        except Exception as e:
            print(f"[ERROR] Analyst Consensus: {e}")

        # 2. Metrics Grid
        try:
            resp = await client.get(f"/api/v1/company/widgets/metrics-grid/{ticker}")
            if resp.status_code == 200:
                print("[SUCCESS] Metrics Grid Widget:")
                print(resp.json())
            else:
                print(f"[FAILURE] Metrics Grid Widget: {resp.status_code} - {resp.text}")
        except Exception as e:
            print(f"[ERROR] Metrics Grid: {e}")

if __name__ == "__main__":
    asyncio.run(verify_widgets())
