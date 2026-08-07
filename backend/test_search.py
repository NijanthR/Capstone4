import asyncio
import httpx
from app.agents.search import search_semantic_scholar, search_crossref
async def main():
    async with httpx.AsyncClient() as client:
        s = await search_semantic_scholar("machine learning", client)
        c = await search_crossref("machine learning", client)
        print("Semantic Scholar results count:", len(s))
        print("CrossRef results count:", len(c))
asyncio.run(main())
