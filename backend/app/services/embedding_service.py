from __future__ import annotations

from typing import Literal

import httpx
from fastapi import HTTPException, status

from ..config import settings


EmbeddingTextType = Literal["query", "document"]


class EmbeddingService:
    batch_size = 10

    @classmethod
    async def embed_text(cls, text: str, text_type: EmbeddingTextType = "document") -> list[float]:
        embeddings = await cls.embed_texts([text], text_type=text_type)
        return embeddings[0]

    @classmethod
    async def embed_texts(
        cls,
        texts: list[str],
        text_type: EmbeddingTextType = "document",
    ) -> list[list[float]]:
        if not settings.dashscope_api_key:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="DashScope API key is not configured",
            )

        if not texts:
            return []

        embeddings: list[list[float]] = []
        for index in range(0, len(texts), cls.batch_size):
            batch = texts[index : index + cls.batch_size]
            payload = {
                "model": settings.dashscope_embedding_model,
                "input": {
                    "texts": batch,
                },
                "parameters": {
                    "dimension": settings.dashscope_embedding_dimensions,
                    "text_type": text_type,
                    "output_type": "dense",
                },
            }

            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    settings.dashscope_embedding_url,
                    headers={
                        "Authorization": f"Bearer {settings.dashscope_api_key}",
                        "Content-Type": "application/json",
                        "Accept": "application/json",
                    },
                    json=payload,
                )

            if response.status_code >= 400:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Upstream embedding error: {response.text}",
                )

            data = response.json()
            if "output" in data and "embeddings" in data["output"]:
                batch_data = data["output"]["embeddings"]
            else:
                batch_data = sorted(data.get("data", []), key=lambda item: item.get("index", 0))

            try:
                current_embeddings = [item["embedding"] for item in batch_data]
            except (KeyError, TypeError) as exc:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Unexpected embedding response: {data}",
                ) from exc

            if len(current_embeddings) != len(batch):
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Embedding count does not match input batch size",
                )

            embeddings.extend(current_embeddings)

        return embeddings
