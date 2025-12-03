import asyncio
import httpx
import sys
import os
from dotenv import load_dotenv

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load env directly to be sure
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))
FMP_API_KEY = os.getenv("FMP_API_KEY")

async def check_fmp_quote():
    ticker = "NVDA"
    url = f"https://financialmodelingprep.com/api/v3/quote/{ticker}?apikey={FMP_API_KEY}"
    
    print(f"--- Checking FMP Quote for {ticker} ---")
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url)
            if response.status_code == 200:
                data = response.json()
                if data and isinstance(data, list):
                    quote = data[0]
                    print(f"✅ Quote received:")
                    print(f"  - Price: {quote.get('price')}")
                    print(f"  - Market Cap: {quote.get('marketCap')}")
                    cap = quote.get('marketCap')
                    if cap:
                        print(f"  - Formatted: ${cap/1e12:.2f}T")
                else:
                    print("❌ Empty response or not a list")
            else:
                print(f"❌ API Error: {response.status_code}")
        except Exception as e:
            print(f"❌ Request failed: {e}")

if __name__ == "__main__":
    asyncio.run(check_fmp_quote())
