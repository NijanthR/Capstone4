import asyncio
import httpx
from app.agents.search import search_semantic_scholar

async def main():
    async with httpx.AsyncClient() as client:
        res = await search_semantic_scholar("machine learning", client)
        print("S2 Results:", len(res) if res else 0)

asyncio.run(main())
