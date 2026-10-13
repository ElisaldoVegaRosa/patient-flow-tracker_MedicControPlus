"""Operational input constraints; validation preserves the submitted text."""
from datetime import date
import re
from typing import Annotated
from pydantic import AfterValidator, StringConstraints


def nonblank(value: str) -> str:
    if not value.strip():
        raise ValueError("Escribe un valor que no esté vacío ni contenga solo espacios")
    return value


def text(minimum: int, maximum: int):
    return Annotated[str, StringConstraints(min_length=minimum, max_length=maximum), AfterValidator(nonblank)]


Name = text(1, 200)
Document = text(1, 100)
Location = text(1, 200)
Assignee = text(1, 200)
Diagnosis = text(2, 500)
ClinicalNote = text(3, 2000)
TaskTitle = text(3, 300)
TaskResult = text(3, 2000)
DischargeNote = text(1, 2000)


def birth_date(value: str) -> str:
    if not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", value):
        raise ValueError("Usa una fecha de nacimiento válida con formato AAAA-MM-DD")
    try:
        parsed = date.fromisoformat(value)
    except ValueError:
        raise ValueError("Usa una fecha de nacimiento válida") from None
    if parsed > date.today():
        raise ValueError("La fecha de nacimiento no puede ser futura")
    return value


BirthDate = Annotated[str, AfterValidator(birth_date)]
