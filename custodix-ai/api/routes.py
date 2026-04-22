from fastapi import APIRouter, Depends
from schemas.models import AskRequest, AskResponse, FormatRequest, FormatResponse
from services.rag_service import RagService

router = APIRouter()

# On instancie le service de RAG (chargement lourd une seule fois au boot)
rag_service = RagService()

@router.post("/generate-sql", response_model=AskResponse)
def generate_sql_endpoint(req: AskRequest):
    """
    Reçoit une question en langage naturel, interroge la mémoire FAISS et retourne du SQL via Llama3.
    """
    sql_generated = rag_service.generate_sql(req.question)
    return AskResponse(sql_query=sql_generated)

@router.post("/format-answer", response_model=FormatResponse)
def format_answer_endpoint(req: FormatRequest):
    """
    Reçoit les résultats finaux de la DB (Oracle) et fait parler Llama 3 pour créer une vraie réponse naturelle pour l'utilisateur.
    """
    final_answer = rag_service.format_answer(req.question, req.query, req.results)
    return FormatResponse(answer=final_answer)
