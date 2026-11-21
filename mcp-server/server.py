import json
import os
import re
import secrets
import sys
from collections.abc import Callable
from datetime import datetime
from typing import TypeVar

from mcp.server import MCPServer
from mcp.server.auth.provider import AccessToken, TokenVerifier
from mcp.server.auth.settings import AuthSettings
from mcp.server.mcpserver.exceptions import ResourceNotFoundError, ToolError
from pydantic import AnyHttpUrl

import db
import rates
from db import SalonError
from rates import ExternalServiceError

T = TypeVar("T")

SERVER_URL = "http://127.0.0.1:8000"


# ---------- авторизация ----------

class StaticTokenVerifier(TokenVerifier):
    def __init__(self, token: str) -> None:
        self._token = token.encode()

    async def verify_token(self, token: str) -> AccessToken | None:
        if not secrets.compare_digest(token.encode(), self._token):
            return None
        return AccessToken(token=token, client_id="web", scopes=["user"])


def _load_token() -> str:
    token = os.environ.get("MCP_TOKEN", "")
    if not token:
        sys.exit("Не задана переменная MCP_TOKEN. Задайте длинный случайный токен перед запуском сервера.")
    return token


mcp = MCPServer(
    "Salon",
    token_verifier=StaticTokenVerifier(_load_token()),
    auth=AuthSettings(
        issuer_url=AnyHttpUrl(SERVER_URL),
        resource_server_url=AnyHttpUrl(f"{SERVER_URL}/mcp"),
        required_scopes=["user"],
    ),
)


# ---------- вспомогательные функции ----------

def _call(func: Callable[..., T], *args: object, **kwargs: object) -> T:
    try:
        return func(*args, **kwargs)
    except SalonError as error:
        raise ToolError(str(error)) from error


def _booking_line(booking: dict) -> str:
    line = (
        f"№{booking['id']}: {booking['client']} ({booking['phone']}), {booking['service']}, "
        f"мастер {booking['master']}, {booking['start_at']}–{booking['end_at'][11:]}, "
        f"статус {booking['status']}, {booking['price_rub']} ₽"
    )
    if booking["note"]:
        line += f", заметка: {booking['note']}"
    return line


def _log(tool: str, **args: object) -> None:
    shown = ", ".join(f"{key}={str(value)[:60]!r}" for key, value in args.items())
    print(f"[{datetime.now():%H:%M:%S}] ВЫЗОВ {tool}({shown})", flush=True)


def _json(data: object) -> str:
    return json.dumps(data, ensure_ascii=False)


# ---------- инструменты ----------

@mcp.tool()
def find_free_slots(master: str, date: str, service: str) -> str:
    """Показывает свободное время мастера на дату для выбранной услуги.

    master: имя мастера. date: дата в формате ГГГГ-ММ-ДД.
    service: название услуги из справочника. Возвращает время начала свободных окон.
    """
    _log("find_free_slots", master=master, date=date, service=service)
    slots = _call(db.find_free_slots, master, date, service)
    if not slots:
        return f"Свободных окон у мастера {master} на {date} для услуги «{service}» нет."
    return f"Свободные окна мастера {master} на {date} для услуги «{service}»: {', '.join(slots)}."


@mcp.tool()
def get_master_schedule(master: str, date: str) -> str:
    """Показывает занятость мастера на день: график работы и записи.

    master: имя мастера. date: дата в формате ГГГГ-ММ-ДД.
    """
    _log("get_master_schedule", master=master, date=date)
    schedule = _call(db.master_schedule, master, date)
    if not schedule["works"]:
        return f"Мастер {schedule['master']} не работает {schedule['date']}."
    head = f"Мастер {schedule['master']}, {schedule['date']}, график {schedule['hours']}."
    if not schedule["bookings"]:
        return f"{head} Записей нет."
    return head + "\n" + "\n".join(_booking_line(b) for b in schedule["bookings"])


@mcp.tool()
def search_bookings(client: str = "", phone: str = "", date: str = "", status: str = "") -> str:
    """Ищет записи по части имени клиента, телефону, дате или статусу.

    Все параметры необязательные и комбинируются. date: дата в формате ГГГГ-ММ-ДД.
    status: booked, completed, no_show или cancelled. Возвращает не больше 50 записей.
    """
    _log("search_bookings", client=client, phone=phone, date=date, status=status)
    found = _call(db.search_bookings, client, phone, date, status)
    if not found:
        return "Записей не найдено."
    text = "\n".join(_booking_line(b) for b in found)
    if len(found) >= db.MAX_ROWS:
        text += f"\nПоказаны первые {db.MAX_ROWS} записей. Уточните запрос."
    return text


@mcp.tool()
def create_booking(client_name: str, phone: str, master: str, service: str, start: str, note: str = "") -> str:
    """Записывает клиента к мастеру на услугу.

    client_name: имя клиента в именительном падеже, а не в форме из фразы запроса. phone: телефон, например +79991234567.
    master: имя мастера. service: название услуги из справочника.
    start: дата и время начала в формате ГГГГ-ММ-ДДTЧЧ:ММ. note: заметка, необязательно.
    Если время занято, отказ содержит свободные окна.
    """
    _log("create_booking", client_name=client_name, phone=phone, master=master, service=service, start=start)
    booking = _call(db.create_booking, client_name, phone, master, service, start, note)
    return "Запись создана. " + _booking_line(booking)


@mcp.tool()
def reschedule_booking(booking_id: int, new_start: str) -> str:
    """Переносит существующую запись на другое время у того же мастера.

    booking_id: номер записи. new_start: новое время в формате ГГГГ-ММ-ДДTЧЧ:ММ.
    """
    _log("reschedule_booking", booking_id=booking_id, new_start=new_start)
    booking = _call(db.reschedule_booking, booking_id, new_start)
    return "Запись перенесена. " + _booking_line(booking)


@mcp.tool()
def cancel_booking(booking_id: int) -> str:
    """Отменяет запись. Операция необратимая: отменённую запись вернуть нельзя.

    booking_id: номер записи.
    """
    _log("cancel_booking", booking_id=booking_id)
    booking = _call(db.cancel_booking, booking_id)
    return "Запись отменена. " + _booking_line(booking)


@mcp.tool()
def mark_visit(booking_id: int, status: str) -> str:
    """Отмечает итог визита по записи, когда время визита уже наступило.

    booking_id: номер записи. status: completed, если клиент пришёл,
    или no_show, если не пришёл. Изменить отметку потом нельзя.
    """
    _log("mark_visit", booking_id=booking_id, status=status)
    booking = _call(db.mark_visit, booking_id, status)
    return "Визит отмечен. " + _booking_line(booking)


@mcp.tool()
async def calc_visit_cost(services: list[str], currency: str = "RUB") -> str:
    """Считает стоимость и длительность визита по списку услуг.

    services: названия услуг из справочника. currency: трёхбуквенный код валюты;
    по умолчанию рубли. Для другой валюты курс берётся из внешнего сервиса.
    """
    _log("calc_visit_cost", services=services, currency=currency)
    cost = _call(db.visit_cost, services)
    lines = [f"{item['service']}: {item['price_rub']} ₽, {item['duration_min']} мин" for item in cost["items"]]
    text = "\n".join(lines) + f"\nИтого: {cost['total_rub']} ₽, {cost['total_min']} мин."

    currency = currency.strip().upper()
    if currency == "RUB":
        return text
    if not re.fullmatch(r"[A-Z]{3}", currency):
        raise ToolError("Код валюты состоит из трёх латинских букв. Исправьте код или используйте RUB.")
    try:
        table = await rates.get_rates("RUB")
    except ExternalServiceError as error:
        raise ToolError(str(error)) from error
    rate = table.get(currency)
    if rate is None:
        raise ToolError(f"Валюта {currency} не поддерживается сервисом курсов. Выберите другую или используйте RUB.")
    return text + f"\nВ валюте {currency}: {cost['total_rub'] * rate:.2f} (курс {rate} за 1 ₽)."


@mcp.tool()
def master_workload(date_from: str, date_to: str) -> str:
    """Показывает загрузку всех мастеров по дням за период в процентах.

    date_from и date_to: даты в формате ГГГГ-ММ-ДД, период не длиннее 31 дня.
    """
    _log("master_workload", date_from=date_from, date_to=date_to)
    rows = _call(db.master_workload, date_from, date_to)
    if not rows:
        names = ", ".join(master["name"] for master in db.list_masters())
        return f"В период {date_from} – {date_to} никто из мастеров ({names}) не работает."
    return "\n".join(
        f"{r['master']}, {r['date']}: {r['load_percent']}% ({r['booked_min']} из {r['work_min']} мин)"
        for r in rows
    )


# ---------- ресурсы ----------

@mcp.resource("salon://bookings")
def bookings_resource() -> str:
    return _json(db.list_bookings())


@mcp.resource("salon://bookings/{booking_id}")
def booking_resource(booking_id: str) -> str:
    try:
        return _json(db.get_booking(int(booking_id)))
    except (ValueError, SalonError) as error:
        raise ResourceNotFoundError(f"Запись {booking_id} не найдена.") from error


@mcp.resource("salon://services")
def services_resource() -> str:
    return _json(db.list_services())


@mcp.resource("salon://masters")
def masters_resource() -> str:
    return _json(db.list_masters())


# ---------- промпты ----------

@mcp.prompt()
def day_summary(date: str) -> str:
    """Сводка по дню"""
    return (
        f"Сделай сводку по салону на {date}: покажи записи каждого мастера, "
        "их загрузку в процентах и свободные окна. Используй инструменты, ничего не придумывай."
    )


@mcp.prompt()
def book_client(client_name: str, service: str, date: str) -> str:
    """Запись клиента на услугу"""
    return (
        f"Запиши клиента {client_name} на услугу «{service}» на {date}. "
        "Сначала найди мастеров, которые выполняют услугу, и свободные окна, "
        "предложи подходящее время и после моего согласия создай запись."
    )


@mcp.prompt()
def master_load_report(master: str, date_from: str, date_to: str) -> str:
    """Отчёт о загрузке мастера"""
    return (
        f"Составь отчёт о загрузке мастера {master} с {date_from} по {date_to}: "
        "загрузка по дням, самый загруженный день и дни со свободным временем."
    )


if __name__ == "__main__":
    db.init_db()
    try:
        mcp.run(transport="streamable-http")
    except KeyboardInterrupt:
        print("Сервер остановлен.")
