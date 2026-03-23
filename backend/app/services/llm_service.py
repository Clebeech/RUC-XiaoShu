from __future__ import annotations

import base64

import httpx
from fastapi import HTTPException, status

from ..config import settings


class LLMService:
    @classmethod
    async def answer(cls, prompt: str, system_prompt: str, model_name: str | None = None) -> str:
        if not settings.dashscope_api_key:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="DashScope API key is not configured",
            )

        resolved_model = model_name or settings.dashscope_model
        payload = {
            "model": resolved_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.3,
            "max_tokens": 2000,
        }
        return await cls._post_chat(payload)

    @classmethod
    async def image_answer(
        cls,
        question: str,
        image_bytes: bytes,
        mime_type: str,
        model_name: str | None = None,
    ) -> str:
        if not settings.dashscope_api_key:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="DashScope API key is not configured",
            )

        resolved_model = model_name or settings.dashscope_multimodal_model
        data_url = cls._to_data_url(image_bytes, mime_type)
        payload = {
            "model": resolved_model,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": data_url,
                            },
                        },
                        {
                            "type": "text",
                            "text": question,
                        },
                    ],
                }
            ],
            "temperature": 0.3,
            "max_tokens": 2000,
        }
        return await cls._post_chat(payload)

    @classmethod
    async def extract_image_context(
        cls,
        image_bytes: bytes,
        mime_type: str,
        question: str,
        model_name: str | None = None,
    ) -> str:
        if not settings.dashscope_api_key:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="DashScope API key is not configured",
            )

        resolved_model = model_name or settings.dashscope_multimodal_model
        data_url = cls._to_data_url(image_bytes, mime_type)
        prompt = (
            "请读取这张图片中的文字和关键信息，并为后续知识库检索生成一段简洁、客观的描述。\n"
            "要求：\n"
            "1. 优先提取课程名称、教师、课程属性、年级、专业、学分、班级等关键信息。\n"
            "2. 如果图片中出现 OCR 可疑字符，请给出最可能的规范写法。\n"
            "3. 不要回答用户问题，只做信息抽取。\n"
            f"4. 用户问题是：{question}\n"
        )
        payload = {
            "model": resolved_model,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": data_url,
                            },
                        },
                        {
                            "type": "text",
                            "text": prompt,
                        },
                    ],
                }
            ],
            "temperature": 0.1,
            "max_tokens": 1200,
        }
        return await cls._post_chat(payload)

    @classmethod
    async def transcribe_audio(
        cls,
        audio_bytes: bytes,
        audio_format: str,
        prompt: str = "请将这段音频准确转写为中文文本，只输出转写结果。",
        model_name: str | None = None,
    ) -> str:
        if not settings.dashscope_api_key:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="DashScope API key is not configured",
            )

        resolved_model = model_name or settings.dashscope_audio_model
        data_url = cls._to_data_url(audio_bytes, f"audio/{audio_format}")
        payload = {
            "model": resolved_model,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "input_audio",
                            "input_audio": {
                                "data": data_url,
                                "format": audio_format,
                            },
                        },
                        {
                            "type": "text",
                            "text": prompt,
                        },
                    ],
                }
            ],
            "modalities": ["text"],
            "stream": True,
            "stream_options": {"include_usage": True},
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                f"{settings.dashscope_base_url}/chat/completions",
                headers=cls._headers(),
                json=payload,
            ) as response:
                if response.status_code >= 400:
                    detail = await response.aread()
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail=f"Upstream audio model error: {detail.decode('utf-8', errors='ignore')}",
                    )

                parts: list[str] = []
                async for line in response.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    data = line[len("data:") :].strip()
                    if not data or data == "[DONE]":
                        continue
                    try:
                        event = httpx.Response(200, content=data).json()
                    except ValueError:
                        continue
                    choices = event.get("choices") or []
                    if not choices:
                        continue
                    delta = choices[0].get("delta") or {}
                    content = delta.get("content")
                    if content:
                        parts.append(content)

        transcript = "".join(parts).strip()
        if not transcript:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Audio transcription returned empty content",
            )
        return transcript

    @classmethod
    async def _post_chat(cls, payload: dict) -> str:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{settings.dashscope_base_url}/chat/completions",
                headers=cls._headers(),
                json=payload,
            )

        if response.status_code >= 400:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Upstream LLM error: {response.text}",
            )

        data = response.json()
        try:
            return data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Unexpected LLM response: {data}",
            ) from exc

    @staticmethod
    def _to_data_url(payload: bytes, mime_type: str) -> str:
        encoded = base64.b64encode(payload).decode("utf-8")
        return f"data:{mime_type};base64,{encoded}"

    @staticmethod
    def _headers() -> dict[str, str]:
        return {
            "Authorization": f"Bearer {settings.dashscope_api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
