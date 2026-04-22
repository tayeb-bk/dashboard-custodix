from pydantic import BaseModel

class AskRequest(BaseModel):
    question: str
    
class AskResponse(BaseModel):
    sql_query: str

class FormatRequest(BaseModel):
    question: str
    query: str
    results: list

class FormatResponse(BaseModel):
    answer: str
