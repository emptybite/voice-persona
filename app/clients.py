from __future__ import annotations

from typing import Any
from collections.abc import Callable

import httpx


class HttpServiceClient:
    def __init__(self, base_url: str, timeout: float, headers_factory: Callable[[], dict[str, str]] | None = None):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.headers_factory = headers_factory

    def _headers(self) -> dict[str, str]:
        return dict(self.headers_factory()) if self.headers_factory else {}

    async def post_json(self, endpoint: str, payload: dict[str, Any]) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(f"{self.base_url}{endpoint}", json=payload, headers=self._headers())
            resp.raise_for_status()
            return resp.json()

    async def post_multipart(self, endpoint: str, files: dict[str, Any], data: dict[str, Any]) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(f"{self.base_url}{endpoint}", files=files, data=data, headers=self._headers())
            resp.raise_for_status()
            return resp.json()

    async def post_bytes(self, endpoint: str, payload: dict[str, Any]) -> tuple[bytes, str]:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(f"{self.base_url}{endpoint}", json=payload, headers=self._headers())
            resp.raise_for_status()
            content_type = resp.headers.get("content-type", "")
            return resp.content, content_type
