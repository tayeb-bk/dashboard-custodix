from fastapi import APIRouter
from schemas.models import AskRequest, AskResponse, FormatRequest, FormatResponse, FixSqlRequest, FixSqlResponse
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
    final_answer = rag_service.format_answer(req.question, req.query, req.results, req.total_count)
    return FormatResponse(answer=final_answer)

@router.post("/fix-sql", response_model=FixSqlResponse)
def fix_sql_endpoint(req: FixSqlRequest):
    """
    Reçoit une requête SQL qui a échoué à l'exécution (avec le message d'erreur Oracle exact)
    et tente une seule correction, avec le même contexte (schéma certifié + exemples) que
    la génération initiale.
    """
    fixed_sql = rag_service.fix_sql_query(req.question, req.sql, req.error)
    return FixSqlResponse(sql_query=fixed_sql)
