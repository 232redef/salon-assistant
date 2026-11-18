import asyncio
import json
import os
import re
import sys
from datetime import date, timedelta

import httpx2
from mcp import Client
from mcp.client.streamable_http import streamable_http_client

URL = os.environ.get("MCP_URL", "http://127.0.0.1:8000/mcp")
TOKEN = os.environ.get("MCP_TOKEN", "")

EXPECTED_TOOLS = {
    "find_free_slots", "get_master_schedule", "search_bookings", "create_booking",
    "reschedule_booking", "cancel_booking", "mark_visit", "calc_visit_cost", "master_workload",
}
EXPECTED_PROMPTS = {"day_summary", "book_client", "master_load_report"}
TEST_CLIENT = "Проверка check.py"
TEST_PHONE = "+79990000000"

failures: list[str] = []


def report(ok: bool, name: str, detail: str = "") -> None:
    mark = "[OK]   " if ok else "[СБОЙ] "
    print(f"{mark}{name}" + (f"  ({detail})" if detail else ""))
    if not ok:
        failures.append(name)


def short(text: str, limit: int = 90) -> str:
    return text.replace("\n", " | ")[:limit]


def future_workday(days: int) -> date:
    day = date.today() + timedelta(days=days)
    while day.weekday() == 6:
        day += timedelta(days=1)
    return day


async def call(session: Client, tool: str, /, **args: object) -> tuple[bool, str]:
    try:
        result = await session.call_tool(tool, args)
    except Exception as error:
        return True, f"{type(error).__name__}: {error}"
    text = "\n".join(
        block.text for block in result.content if getattr(block, "type", "") == "text"
    )
    is_error = getattr(result, "is_error", None)
    if is_error is None:
        is_error = getattr(result, "isError", False)
    return bool(is_error), text


async def read_json(client: Client, uri: str):
    result = await client.read_resource(uri)
    return json.loads(result.contents[0].text)


async def check_auth() -> None:
    payload = {
        "jsonrpc": "2.0", "id": 1, "method": "initialize",
        "params": {"protocolVersion": "2025-03-26", "capabilities": {},
                   "clientInfo": {"name": "check", "version": "1"}},
    }
    base = {"Content-Type": "application/json", "Accept": "application/json, text/event-stream"}
    async with httpx2.AsyncClient(timeout=10) as http:
        for label, extra in (("без токена", {}), ("с неверным токеном", {"Authorization": "Bearer wrong-token"})):
            response = await http.post(URL, json=payload, headers={**base, **extra})
            report(response.status_code == 401, f"Запрос {label} получает 401", f"получен {response.status_code}")


async def cleanup(client: Client) -> None:
    _, text = await call(client, "search_bookings", client="check.py", status="booked")
    for booking_id in re.findall(r"№(\d+):", text):
        await call(client, "cancel_booking", booking_id=int(booking_id))


async def check_catalog(client: Client) -> None:
    tools = {tool.name for tool in (await client.list_tools()).tools}
    missing = EXPECTED_TOOLS - tools
    report(not missing and 6 <= len(tools) <= 9, "Инструментов от 6 до 9, все нужные на месте",
           f"найдено {len(tools)}" + (f", нет: {', '.join(sorted(missing))}" if missing else ""))

    prompts = {prompt.name for prompt in (await client.list_prompts()).prompts}
    report(EXPECTED_PROMPTS <= prompts, "Промпты на месте", f"найдено {len(prompts)}")
    result = await client.get_prompt("day_summary", {"date": "2026-11-16"})
    message = result.messages[0].content
    report("2026-11-16" in getattr(message, "text", ""), "Промпт с аргументом подставляет значение")

    resources = {str(resource.uri) for resource in (await client.list_resources()).resources}
    report({"salon://bookings", "salon://services"} <= resources, "Ресурсы-списки на месте",
           f"найдено {len(resources)}")

    services = await read_json(client, "salon://services")
    report(isinstance(services, list) and len(services) > 0, "Ресурс услуг не пуст", f"{len(services)} услуг")
    masters = await read_json(client, "salon://masters")
    report(isinstance(masters, list) and len(masters) > 0, "Ресурс мастеров не пуст", f"{len(masters)} мастеров")
    bookings = await read_json(client, "salon://bookings")
    report(isinstance(bookings, list), "Ресурс записей возвращает список", f"{len(bookings)} записей")


async def check_read_tools(client: Client, day: str) -> None:
    err, text = await call(client, "find_free_slots", master="Анна", date=day, service="Женская стрижка")
    report(not err and ("Свободные окна" in text or "нет" in text), "Поиск свободных окон", short(text))
    err, text = await call(client, "get_master_schedule", master="Анна", date=day)
    report(not err and "Анна" in text, "Расписание мастера", short(text))
    err, text = await call(client, "search_bookings", client="Несуществующий клиент")
    report(not err and "не найдено" in text, "Пустой поиск возвращает текст, а не пустой список", short(text))
    err, text = await call(client, "calc_visit_cost", services=["Маникюр", "Педикюр"])
    report(not err and "Итого" in text, "Расчёт стоимости визита", short(text))
    err, text = await call(client, "master_workload", date_from=day, date_to=day)
    report(not err and text != "", "Загрузка мастеров", short(text))


async def check_external(client: Client) -> None:
    err, text = await call(client, "calc_visit_cost", services=["Маникюр"], currency="USD")
    if not err:
        report("USD" in text, "Внешний сервис: курс получен", short(text))
    else:
        report("курсов валют" in text, "Внешний сервис: отказ превращён в понятный текст", short(text))


async def check_refusals(client: Client, day: str) -> None:
    base = dict(client_name=TEST_CLIENT, phone=TEST_PHONE, service="Макияж", start=f"{day}T10:00")
    err, text = await call(client, "create_booking", master="Несуществующая", **base)
    report(err and "не найден" in text, "Неизвестный мастер даёт отказ со списком", short(text))
    err, text = await call(client, "create_booking", master="Мария", **base)
    report(err and "не выполняет" in text, "Мастер без нужной услуги даёт отказ", short(text))
    err, text = await call(client, "create_booking", master="Ольга", **{**base, "start": "2020-01-01T10:00"})
    report(err and "прошлое" in text, "Запись в прошлое отклоняется", short(text))
    err, text = await call(client, "create_booking", master="Ольга", **{**base, "start": "завтра"})
    report(err and "формат" in text, "Неверный формат времени отклоняется", short(text))
    err, text = await call(client, "create_booking", master="Ольга", **{**base, "client_name": "А" * 101})
    report(err and "длинное" in text, "Слишком длинное имя отклоняется", short(text))
    err, text = await call(client, "create_booking", master="Ольга", **{**base, "note": "x" * 501})
    report(err and "длинная" in text, "Слишком длинная заметка отклоняется", short(text))


async def check_booking_cycle(client: Client, day: str) -> None:
    args = dict(client_name=TEST_CLIENT, phone=TEST_PHONE, master="Ольга", service="Макияж", start=f"{day}T10:00")
    err, text = await call(client, "create_booking", **args)
    created = re.search(r"№(\d+)", text)
    report(not err and "Запись создана" in text and created is not None, "Запись создаётся", short(text))
    if created is None:
        return
    booking_id = int(created.group(1))

    card = await read_json(client, f"salon://bookings/{booking_id}")
    report(card.get("id") == booking_id, "Ресурс-шаблон возвращает карточку записи", f"запись {booking_id}")

    err, text = await call(client, "create_booking", **args)
    report(err and "занята" in text, "Повторная запись на то же время отклоняется с подсказкой", short(text))

    err, text = await call(client, "reschedule_booking", booking_id=booking_id, new_start=f"{day}T12:00")
    report(not err and "перенесена" in text and f"{day}T12:00" in text, "Перенос записи", short(text))

    err, text = await call(client, "mark_visit", booking_id=booking_id, status="completed")
    report(err and "не начался" in text, "Отметка визита до его начала отклоняется", short(text))

    err, text = await call(client, "cancel_booking", booking_id=booking_id)
    report(not err and "отменена" in text, "Отмена записи", short(text))
    err, text = await call(client, "cancel_booking", booking_id=booking_id)
    report(err and "уже отменена" in text, "Повторная отмена отклоняется", short(text))


async def main() -> int:
    if not TOKEN:
        print("Не задана переменная MCP_TOKEN. Задайте тот же токен, с которым запущен сервер.")
        return 2
    print(f"Проверка сервера {URL}\n")

    try:
        await check_auth()
    except Exception as error:
        print(f"Сервер не отвечает: {error}\nЗапустите его командой python server.py и повторите проверку.")
        return 2

    day = future_workday(30).isoformat()
    http_client = httpx2.AsyncClient(headers={"Authorization": f"Bearer {TOKEN}"}, timeout=30)
    async with http_client:
        transport = streamable_http_client(URL, http_client=http_client)
        async with Client(transport) as client:
            await cleanup(client)
            try:
                await check_catalog(client)
                await check_read_tools(client, day)
                await check_external(client)
                await check_refusals(client, day)
                await check_booking_cycle(client, day)
            finally:
                await cleanup(client)

    print()
    if failures:
        print(f"Сбоев: {len(failures)}")
        return 1
    print("Все проверки пройдены.")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
