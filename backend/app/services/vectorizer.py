from __future__ import annotations

import math
import re


class SimpleVectorizer:
    dimension = 384

    @classmethod
    def embed(cls, text: str) -> list[float]:
        tokens = [token for token in re.sub(r"[^\w\s\u4e00-\u9fff]", " ", text.lower()).split() if token]
        vector = [0.0] * cls.dimension
        frequencies: dict[str, float] = {}

        for index, token in enumerate(tokens):
            weight = 1 + (1 / (index + 1)) * 0.1
            frequencies[token] = frequencies.get(token, 0.0) + weight

        for token, frequency in frequencies.items():
            for salt, scale in enumerate((1.0, 0.8, 0.6)):
                hashed = cls._stable_hash(f"{token}:{salt}")
                vector[abs(hashed) % cls.dimension] += frequency * scale

        magnitude = math.sqrt(sum(value * value for value in vector))
        if magnitude == 0:
            return vector

        return [value / magnitude for value in vector]

    @staticmethod
    def cosine_similarity(a: list[float], b: list[float]) -> float:
        if len(a) != len(b):
            return 0.0

        dot = sum(x * y for x, y in zip(a, b))
        norm_a = math.sqrt(sum(x * x for x in a))
        norm_b = math.sqrt(sum(y * y for y in b))
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return max(0.0, dot / (norm_a * norm_b))

    @staticmethod
    def _stable_hash(value: str) -> int:
        result = 0
        for char in value:
            result = ((result << 5) - result) + ord(char)
            result &= 0xFFFFFFFF
        if result >= 2**31:
            result -= 2**32
        return result
