import os
from langchain_community.llms import Ollama
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_core.prompts import PromptTemplate

class RagService:
    def __init__(self):
        print("Initialisation du Service RAG...")
        self.llm = Ollama(model="llama3")
        self.embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
        
        if os.path.exists("./chroma_index"):
            print("Chargement de Chroma Index...")
            self.vectorstore = Chroma(persist_directory="./chroma_index", embedding_function=self.embeddings)
            self.retriever = self.vectorstore.as_retriever(search_kwargs={"k": 3})
            self.index_loaded = True
        else:
            print("ATTENTION: L'index Chroma n'existe pas. Lancez 1_ingest_oracle.py d'abord.")
            self.index_loaded = False
            
        template = """Tu es Custodix AI, un assistant d'analyse Oracle 21c (Schéma UCUSTOI0).
Tu dois utiliser STRICTEMENT l'un de ces deux formats (jamais les deux en même temps) :

CAS 1 : SALUTATIONS ("bonjour", "salut")
Réponds uniquement avec un bloc texte :
```text
Bonjour, je suis Custodix AI. Comment puis-je vous aider ?
```

CAS 2 : REQUÊTE BASE DE DONNÉES (Statistiques, listes, métriques)
Génère OBLIGATOIREMENT un bloc sql contenant la requête, SANS point-virgule (;).
Exemple :
```sql
SELECT COUNT(*) FROM DBA_TABLES WHERE OWNER = 'UCUSTOI0'
```

RÈGLES ORACLE (TRÈS IMPORTANT) :
- Schéma propriétaire : UCUSTOI0
- Tables existantes : FLOW_FLOW, EAI_HEADER, FLOW_FLOWLOG.
- Toujours mettre le nom des tables en MAJUSCULE.
- Les colonnes se terminent en général par un underscore (ex: STATUS_, ID_, AMOUNT1_).
- Pour avoir le total de tables : SELECT COUNT(*) FROM dba_tables WHERE owner = 'UCUSTOI0'
- Pour lister ou compter les paramètres/colonnes d'une table : SELECT column_name, data_type FROM dba_tab_columns WHERE owner = 'UCUSTOI0' AND table_name = 'VOTRE_TABLE'
- Pour avoir les tables avec la plus grande taille ou le plus de lignes : SELECT table_name, num_rows FROM dba_tables WHERE owner = 'UCUSTOI0' ORDER BY num_rows DESC FETCH FIRST 20 ROWS ONLY

Tables trouvées dans le contexte :
{context}

Question de l'utilisateur : {question}

Réponse (Un seul bloc) :"""
        self.prompt = PromptTemplate(template=template, input_variables=["context", "question"])

    def generate_sql(self, question: str) -> str:
        if not self.index_loaded:
            return "Erreur : Index Chroma manquant. Lancez l'ingestion Oracle."
            
        docs = self.retriever.invoke(question)
        context_text = "\n\n".join([d.page_content for d in docs])
        print(f"Tables trouvées par RAG : {[d.metadata['table_name'] for d in docs]}")
        
        final_prompt = self.prompt.format(context=context_text, question=question)
        response = self.llm.invoke(final_prompt)
        
        import re
        
        # Recherche du bloc SQL prioritaire
        sql_match = re.search(r"```[sS][qQ][lL](.*?)```", response, re.DOTALL)
        if sql_match:
            sql = sql_match.group(1).replace(";", "").strip()
            return sql
            
        # Recherche du bloc Texte
        text_match = re.search(r"```[tT][eE][xX][tT](.*?)```", response, re.DOTALL)
        if text_match:
            clean_text = text_match.group(1).strip()
            return "GREETINGS: " + clean_text
            
        # Fallback de secours si Llama a raté son markdown
        if "SELECT " in response.upper():
            start_idx = response.upper().find("SELECT ")
            sql = response[start_idx:].split(";")[0].strip()
            return sql
            
        # Si rien d'autre, on considère que c'est un message textuel
        response_clean = response.replace("GREETINGS:", "").replace("```text", "").replace("```", "").strip()
        return "GREETINGS: " + response_clean

    def format_answer(self, question: str, query: str, results: list) -> str:
        prompt = f"""Tu es l'agent IA Custodix. L'utilisateur a demandé : "{question}"
La base de données Oracle a répondu (données brutes JSON) : {results}

Rédige une phrase humaine unique, claire et professionnelle en français pour donner la réponse à l'utilisateur. 
Ne donne AUCUNE explication technique, ne parle pas de la requête SQL ou JSON. 
Si la réponse est une liste complexe, introduis-la simplement (ex: 'Voici la liste demandée :').
Réponse humaine :"""
        response = self.llm.invoke(prompt)
        return response.strip()
