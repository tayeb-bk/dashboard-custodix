import os
import sys
import re
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.rag_service import RagService

rag = RagService()

# Force reset du cache pour re-tester
rag.sql_cache = {}

tests = [
    "Donne-moi le taux de doublons",
    "Montre-moi les fichiers reçus le 05/06/2025",
    "Combien de widgets y a-t-il dans la réception ?",
]

for q in tests:
    print(f"\n==========================================")
    print(f"QUESTION: '{q}'")
    res = rag.generate_sql(q)
    # Vérifier que le résultat n'a pas de backticks
    has_backtick = "`" in res
    print(f"RESULT: {res}")
    print(f"Backtick residuel: {'[ERREUR] OUI' if has_backtick else '[OK] NON'}")
