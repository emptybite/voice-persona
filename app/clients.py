from __future__ import annotations

from typing import Any

import httpx


class HttpServiceClient:
    def __init__(self, base_url: str, timeout: float):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    async def post_json(self, endpoint: str, payload: dict[str, Any]) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(f"{self.base_url}{endpoint}", json=payload)
            resp.raise_for_status()
            return resp.json()

    async def post_multipart(self, endpoint: str, files: dict[str, Any], data: dict[str, Any]) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(f"{self.base_url}{endpoint}", files=files, data=data)
            resp.raise_for_status()
            return resp.json()

    async def post_bytes(self, endpoint: str, payload: dict[str, Any]) -> tuple[bytes, str]:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(f"{self.base_url}{endpoint}", json=payload)
            resp.raise_for_status()
            content_type = resp.headers.get("content-type", "")
            return resp.content, content_type
