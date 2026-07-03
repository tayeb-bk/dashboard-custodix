from typing import Optional
from pydantic import BaseModel

class AskRequest(BaseModel):
    question: str

class AskResponse(BaseModel):
    sql_query: str

class FormatRequest(BaseModel):
    question: str
    query: str
    results: list
    total_count: Optional[int] = None

class FormatResponse(BaseModel):
    answer: str

class FixSqlRequest(BaseModel):
    question: str
    sql: str
    error: str

class FixSqlResponse(BaseModel):
    sql_query: str
