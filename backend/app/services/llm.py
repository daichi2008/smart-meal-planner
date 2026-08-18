import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class LLMService:
    """Thin OpenAI-compatible client. Works with OpenAI or any compatible gateway."""

    def __init__(self) -> None:
        self.api_key = settings.LLM_API_KEY
        self.base_url = settings.LLM_BASE_URL.rstrip("/")
        self.model = settings.LLM_MODEL

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)

    async def complete(
        self,
        system_prompt: str,
        user_prompt: str,
        *,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        json_mode: bool = False,
    ) -> str:
        if not self.is_configured:
            raise RuntimeError("LLM_API_KEY is not configured")

        payload: dict = {
            "model": self.model,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "reasoning_effort": "none",
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                f"{self.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json=payload,
            )
            if resp.status_code >= 400:
                error_message = self._friendly_error(resp)
                raise RuntimeError(error_message)
            data = resp.json()
            return data["choices"][0]["message"]["content"].strip()

    @staticmethod
    def _friendly_error(resp: httpx.Response) -> str:
        code = None
        message = ""
        try:
            body = resp.json()
            error = body.get("error", {})
            code = error.get("code")
            message = error.get("message", "")
        except Exception:
            pass

        if resp.status_code == 401:
            return "مفتاح الذكاء الاصطناعي غير صالح (401). تأكد من LLM_API_KEY في backend/.env."
        if resp.status_code == 429 or code in {"insufficient_quota", "rate_limit_exceeded"}:
            return (
                "حساب الذكاء الاصطناعي لا يملك رصيداً كافياً أو تجاوز حد الاستخدام (429). "
                "أضف رصيداً في لوحة تحكم المزود أو جرّب مفتاحاً آخر."
            )
        if resp.status_code >= 500:
            return "خدمة الذكاء الاصطناعي غير متاحة حالياً (خطأ خادم). حاول لاحقاً."
        return f"خطأ من مزود الذكاء الاصطناعي ({resp.status_code}): {message or 'غير معروف'}"


llm_service = LLMService()
