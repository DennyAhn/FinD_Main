import asyncio
import httpx
import sys
import os

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
async def verify_chat_agent():
    base_url = "http://localhost:8000"
    username = "testuser_verify"
    password = "testpassword123"
    
    async with httpx.AsyncClient(base_url=base_url) as client:
        print("--- Verifying Chat Agent ---")
        
        # 1. Try to Login
        print(f"Attempting to login as {username}...")
        login_data = {"username": username, "password": password}
        response = await client.post("/api/v1/auth/login", data=login_data)
        
        token = None
        if response.status_code == 200:
            print("✅ Login successful")
            token = response.json()["access_token"]
        else:
            print(f"Login failed ({response.status_code}). Attempting to signup...")
            # 2. Try to Signup
            signup_data = {
                "username": username,
                "password": password,
                "name": "Test User",
                "age": 30,
                "email": "test@example.com"
            }
            response = await client.post("/api/v1/auth/signup", json=signup_data)
            if response.status_code == 200:
                print("✅ Signup successful. Logging in...")
                response = await client.post("/api/v1/auth/login", data=login_data)
                if response.status_code == 200:
                    token = response.json()["access_token"]
                    print("✅ Login successful after signup")
                else:
                    print(f"❌ Login failed after signup: {response.text}")
                    return
            else:
                print(f"❌ Signup failed: {response.text}")
                # If signup failed because user exists but login failed, maybe password changed?
                # Can't recover easily.
                return

        if not token:
            print("❌ Could not obtain token. Aborting.")
            return

        # 3. Verify Chat Agent
        headers = {"Authorization": f"Bearer {token}"}
        payload = {"message": "엔비디아 PER 알려줘"}
        
        print(f"Sending chat request: {payload}")
        try:
            # Increase timeout because agent might be slow (tools)
            response = await client.post("/api/v1/agent/chat", json=payload, headers=headers, timeout=60.0)
            
            if response.status_code != 200:
                print(f"❌ API Error: {response.status_code} - {response.text}")
                return

            data = response.json()
            print("✅ Response received")
            
            if "widgets" in data and data["widgets"]:
                print(f"✅ Widgets found: {len(data['widgets'])}")
                for w in data["widgets"]:
                    print(f"  - Type: {w.get('type')}")
                    if w.get('type') == 'comprehensive_valuation':
                        print(f"    - Ticker: {w.get('ticker')}")
                        print(f"    - Score: {w.get('score')}")
            else:
                print("❌ No widgets found in response")
                print(f"Response keys: {data.keys()}")
                if "widgets" in data:
                    print(f"Widgets value: {data['widgets']}")

        except Exception as e:
            print(f"❌ Request failed: {e}")

if __name__ == "__main__":
    asyncio.run(verify_chat_agent())
