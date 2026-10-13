from typing import Annotated, Any, Literal

from fastapi import Query
from sqlalchemy import asc, desc

SortOrder = Annotated[Literal["asc", "desc"], Query()]


def sort_clauses(column: Any, sort_order: str, tie_breaker: Any) -> list[Any]:
    """Order by one column, keeping NULLs last, plus a stable tie-breaker for paging."""
    direction = desc if sort_order == "desc" else asc
    return [direction(column).nulls_last(), tie_breaker]
