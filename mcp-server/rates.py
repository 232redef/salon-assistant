import os
import time

import httpx2

BASE_URL = os.environ.get("EXCHANGE_API_URL", "https://mocks.academy.sharapov.biz/er-api").rstrip("/")
TIMEOUT_SEC = 5.0
CACHE_TTL_SEC = 6 * 3600
USER_AGENT = "salon-assistant/1.0 (student practice)"

_cache: dict[str, tuple[float, dict[str, float]]] = {}


class ExternalServiceError(Exception):
    pass


def clear_cache() -> None:
    _cache.clear()


async def get_rates(base: str = "RUB") -> dict[str, float]:
    cached = _cache.get(base)
    if cached and time.monotonic() - cached[0] < CACHE_TTL_SEC:
        return cached[1]

    url = f"{BASE_URL}/v6/latest/{base}"
    try:
        async with httpx2.AsyncClient(timeout=TIMEOUT_SEC, headers={"User-Agent": USER_AGENT}) as client:
            response = await client.get(url)
            response.raise_for_status()
            data = response.json()
    except httpx2.TimeoutException:
        raise ExternalServiceError(
            "Сервис курсов валют не ответил вовремя. Повторите позже или назовите стоимость в рублях."
        )
    except httpx2.HTTPStatusError as error:
        raise ExternalServiceError(
            f"Сервис курсов валют вернул ошибку {error.response.status_code}. "
            "Повторите позже или назовите стоимость в рублях."
        )
    except httpx2.RequestError:
        raise ExternalServiceError(
            "Не удалось связаться с сервисом курсов валют. Повторите позже или назовите стоимость в рублях."
        )
    except ValueError:
        raise ExternalServiceError(
            "Сервис курсов валют вернул повреждённый ответ. Повторите позже или назовите стоимость в рублях."
        )

    table = data.get("rates") if isinstance(data, dict) else None
    if not isinstance(table, dict) or not table:
        raise ExternalServiceError(
            "Сервис курсов валют вернул ответ в неожиданном формате. Назовите стоимость в рублях."
        )

    _cache[base] = (time.monotonic(), table)
    return table
