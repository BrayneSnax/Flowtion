#!/usr/bin/env python3
"""Test Hermes 4 API integration"""

import asyncio
from openai import AsyncOpenAI
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent / "backend"
load_dotenv(ROOT_DIR / '.env')

NOUS_API_KEY = os.getenv('NOUS_API_KEY')
NOUS_API_BASE = "https://inference-api.nousresearch.com/v1"

async def test_hermes():
    print("Testing Hermes 4 API...")
    print(f"API Key: {NOUS_API_KEY[:10]}...")
    print(f"Base URL: {NOUS_API_BASE}")
    
    try:
        client = AsyncOpenAI(
            api_key=NOUS_API_KEY,
            base_url=NOUS_API_BASE
        )
        
        response = await client.chat.completions.create(
            model="Hermes-4-70B",
            messages=[
                {"role": "system", "content": "You are a warm, invitational assistant."},
                {"role": "user", "content": "I want to start exploring morning rituals"}
            ],
            temperature=0.8,
            max_tokens=150
        )
        
        print("\n✅ Success! Hermes 4 response:")
        print(response.choices[0].message.content)
        
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")

if __name__ == "__main__":
    asyncio.run(test_hermes())
