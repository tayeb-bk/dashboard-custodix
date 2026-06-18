import os
import re
from langchain_community.llms import Ollama
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma

# ============================================================
# SCHÉMAS CERTIFIÉS - Source de vérité injectée systématiquement
# dans chaque prompt SQL pour éviter l'hallucination de colonnes.
# ============================================================
_CERTIFIED_SCHEMAS = """TABLES ET COLONNES CERTIFIÉES (CRITIQUE - JAMAIS inventer d'autres colonnes) :

1. Table UCUSTOI0.FLOW_FILEIN (Réception des fichiers) :
- ID_ : Identifiant unique du fichier reçu
- SENDINGDATE_ : Date/heure de réception (JAMAIS RECEIPT_DATE, JAMAIS TIMESTAMP_, JAMAIS EVENT_DATE)
- INITIATIONFILE_ : Nom physique du fichier (JAMAIS FILENAME_)
- CHECKSUM_ : Empreinte numérique / signature du fichier
- PASSEDCONTRACTIDENTIFIER_ : Identifiant du contrat SLA
- WORKFLOWID_ : Identifiant du workflow applicatif
- CLIENT_IDENTIFIER_ : Identifiant du client émetteur (JAMAIS CLIENTID_)
- DUPLICATED_ID_ : Identifiant du doublon (null si original, non-null si doublon) (JAMAIS DUPLICATEDID_)
- MANUALFLOWINTEGRATION_ID_ : Identifiant de l'intégration manuelle (null si automatique) (JAMAIS MANUALFLOWINTEGRATIONID_)
- FILESIZE_ : Taille du fichier en octets

2. Table UCUSTOI0.FLOW_FILEOUT (Expédition des fichiers) :
- ID_ : Identifiant unique
- FILEIN_ID_ : Identifiant du fichier reçu lié (FLOW_FILEIN.ID_)
- FILE_ID_ : Identifiant du fichier physique
- DESTINATIONINFO_ID_ : Identifiant de destination
- ACKEXPECTED_ : 1 si acquittement attendu, 0 sinon
- USEDADDRESS_ : Adresse de livraison

3. Table UCUSTOI0.FLOW_FLOW (Traitement logique des flux) :
- ID_ : Identifiant unique du flux
- STATUS_ : Statut (valeurs : Processed, Sent, InTechnicalError, Rejected, Blocked)
- TYPE_ : Type de flux
- FLOWTYPE_NAME_ : Nom du type de flux
- CREATIONDATE_ : Date de création
- UPDATEDATE_ : Date de mise à jour
- SENDER_IDENTIFIER_ : Identifiant émetteur
- RECEIVER_IDENTIFIER_ : Identifiant destinataire
- ROUTE_ROUTEID_ : Identifiant de la route
- AMOUNT1_ : Montant financier

4. Table UCUSTOI0.FLOW_INCOMINGACKNOWLEGEMENT (Acquittements réseau) :
- ID_ : Identifiant unique
- ACKEDFILEOUT_ID_ : Identifiant du fichier expédié (FLOW_FILEOUT.ID_)
- FILEOUTSENDINGDATE_ : Date/heure d'acquittement (JAMAIS ACK_DATE)"""

_SQL_PROMPT = """Tu es Custodix AI, un expert de base de données Oracle 21c.
Génère UNIQUEMENT une requête SQL Oracle valide pour répondre à la question.
Ta réponse doit être UNIQUEMENT un bloc markdown SQL, sans aucune explication ni point-virgule (;).

RÈGLES DE CALCUL DE LATENCE & VIOLATION (SLA) :
- Latence T2 (Traitement logique) = (ff.UPDATEDATE_ - ff.CREATIONDATE_) * 86400 en secondes (tables UCUSTOI0.FLOW_FLOW ff)
- Latence T3 (Acquittement externe réseau) = (ack.FILEOUTSENDINGDATE_ - fi.SENDINGDATE_) * 86400 en secondes (tables UCUSTOI0.FLOW_FILEIN fi, UCUSTOI0.FLOW_INCOMINGACKNOWLEGEMENT ack)
- Une violation de SLA (Breach / Retard) survient si :
  - La latence T2 dépasse le seuil cible T2 (ex: T2 > 15 secondes)
  - OU la latence T3 dépasse le seuil cible T3 (ex: T3 > 120 secondes, soit 2 minutes) pour les flux où fo.ACKEXPECTED_ = 1 (table UCUSTOI0.FLOW_FILEOUT fo)

RÈGLES ORACLE :
- Schéma propriétaire : UCUSTOI0. Préfixe TOUJOURS les tables avec le schéma (ex: UCUSTOI0.FLOW_FILEIN).
- N'utilise `WHERE owner = 'UCUSTOI0'` QUE pour dba_tables ou dba_tab_columns.
- Les colonnes se terminent TOUJOURS par un underscore.
- Pour lister les colonnes d'une table : SELECT column_name FROM dba_tab_columns WHERE owner = 'UCUSTOI0' AND table_name = 'NOM'

SYNTAXE DATES ORACLE (CRITIQUE) :
- Filtrer par jour actuel (aujourd'hui) : TRUNC(SENDINGDATE_) = TRUNC(SYSDATE)
- Si l'utilisateur demande "par jour", "les latences moyennes" (sans mentionner de date précise), ne restreins pas à une date fixe, ou utilise TRUNC(SYSDATE) pour aujourd'hui.
- Filtrer par un jour précis (seulement si spécifié dans la question, par exemple le 5 juin 2025) : TRUNC(SENDINGDATE_) = TO_DATE('05-06-2025', 'DD-MM-YYYY')
- Filtrer par heure : EXTRACT(HOUR FROM SENDINGDATE_) BETWEEN 14 AND 16
- INTERDIT : DATE_TRUNC() (PostgreSQL), DATE 'YYYY-MM-DD' (invalide Oracle)

{schemas}

EXEMPLES :
- Fichiers reçus aujourd'hui : SELECT ID_, INITIATIONFILE_, SENDINGDATE_ FROM UCUSTOI0.FLOW_FILEIN WHERE TRUNC(SENDINGDATE_) = TRUNC(SYSDATE)
- Contrats avec le plus de violations (seuil T2=15s, T3=120s) :
  SELECT fi.PASSEDCONTRACTIDENTIFIER_, COUNT(*) AS TOTAL_VIOLATIONS
  FROM UCUSTOI0.FLOW_FILEIN fi
  LEFT JOIN UCUSTOI0.FLOW_FLOW ff ON ff.ID_ = fi.ID_
  LEFT JOIN UCUSTOI0.FLOW_FILEOUT fo ON fo.FILEIN_ID_ = fi.ID_
  LEFT JOIN UCUSTOI0.FLOW_INCOMINGACKNOWLEGEMENT ack ON ack.ACKEDFILEOUT_ID_ = fo.ID_
  WHERE ((ff.UPDATEDATE_ - ff.CREATIONDATE_) * 86400 > 15)
     OR (fo.ACKEXPECTED_ = 1 AND (ack.FILEOUTSENDINGDATE_ - fi.SENDINGDATE_) * 86400 > 120)
  GROUP BY fi.PASSEDCONTRACTIDENTIFIER_
  ORDER BY TOTAL_VIOLATIONS DESC
- Doublons aujourd'hui : SELECT COUNT(*) FROM UCUSTOI0.FLOW_FILEIN WHERE DUPLICATED_ID_ IS NOT NULL AND TRUNC(SENDINGDATE_) = TRUNC(SYSDATE)
- Pics horaires aujourd'hui : SELECT EXTRACT(HOUR FROM SENDINGDATE_) AS HEURE, COUNT(*) AS TOTAL FROM UCUSTOI0.FLOW_FILEIN WHERE TRUNC(SENDINGDATE_) = TRUNC(SYSDATE) GROUP BY EXTRACT(HOUR FROM SENDINGDATE_) ORDER BY TOTAL DESC
- Flux en erreur globaux : SELECT COUNT(*) FROM UCUSTOI0.FLOW_FLOW WHERE STATUS_ IN ('InTechnicalError', 'Rejected', 'Blocked')
- Latence moyenne par contrat : SELECT PASSEDCONTRACTIDENTIFIER_, AVG(FILESIZE_) FROM UCUSTOI0.FLOW_FILEIN GROUP BY PASSEDCONTRACTIDENTIFIER_

Question de l'utilisateur : {question}
Génère la requête SQL dans un bloc markdown complet (```sql ... ```) :"""

# ============================================================
# PROMPT DOC - Dédié à l'explication du dashboard
# ============================================================
_DOC_PROMPT = """Tu es Custodix AI, un expert du dashboard EAI Custodix.
Réponds à la question de l'utilisateur de manière claire, précise et professionnelle en français.
Base ta réponse uniquement sur la documentation fournie ci-dessous.
Ne génère aucune requête SQL. Ta réponse doit être uniquement du texte explicatif.

Documentation de référence :
{context}

Question de l'utilisateur : {question}
Réponse en français :"""


# Mots-clés qui déclenchent une détection de salutation sans appel LLM
_GREETING_KEYWORDS = {
    "bonjour", "salut", "bonsoir", "hello", "hi", "hey", "coucou",
    "bonne journée", "bonjour !", "salut !"
}


class RagService:
    def __init__(self):
        print("Initialisation du Service RAG...")
        self.llm = Ollama(model="llama3", temperature=0)
        self.embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

        # Cache pour éviter les appels LLM redondants
        self.sql_cache = {}
        self.format_cache = {}

        if os.path.exists("./chroma_index"):
            print("Chargement de Chroma Index...")
            self.vectorstore = Chroma(persist_directory="./chroma_index", embedding_function=self.embeddings)
            self.retriever = self.vectorstore.as_retriever(search_kwargs={"k": 5})
            self.index_loaded = True
        else:
            print("ATTENTION: L'index Chroma n'existe pas. Lancez 1_ingest_oracle.py d'abord.")
            self.index_loaded = False

    # ----------------------------------------------------------
    # ROUTEUR D'INTENTION
    # Détermine si la question est : GREETING, SQL ou DOC
    # ----------------------------------------------------------
    def _classify_intent(self, question: str) -> str:
        """Retourne 'GREETING', 'SQL' ou 'DOC'."""
        q_lower = question.strip().lower()

        # 1. Détection de salutation par dictionnaire Python (rapide, sans LLM)
        if q_lower in _GREETING_KEYWORDS:
            return "GREETING"

        # 2. Classification binaire SQL vs DOC par LLM
        intent_prompt = f"""Détermine si la question suivante nécessite d'écrire une requête SQL pour chercher des données réelles de la base de données (chiffres, fichiers, volumes, statistiques, doublons, dates), ou s'il s'agit d'une question d'explication générale sur le dashboard, le rôle d'un widget, ou la définition d'un terme.

Réponds UNIQUEMENT par l'un de ces deux mots : SQL ou DOC

Question : {question}
Réponse :"""
        raw = self.llm.invoke(intent_prompt).strip().upper()
        if "SQL" in raw:
            return "SQL"
        return "DOC"

    # ----------------------------------------------------------
    # GÉNÉRATION SQL
    # Construit et exécute le prompt SQL dédié
    # ----------------------------------------------------------
    def _generate_sql_query(self, question: str) -> str:
        """Appelle le LLM avec le prompt SQL dédié + schémas certifiés."""
        # On n'ajoute PAS de ```sql dans le prompt pour que le LLM génère le bloc complet lui-même
        full_prompt = _SQL_PROMPT.format(schemas=_CERTIFIED_SCHEMAS, question=question)
        response = self.llm.invoke(full_prompt)

        # Extraire le bloc SQL d'un markdown ```sql...```
        sql_match = re.search(r"```[sS][qQ][lL]?(.*?)```", response, re.DOTALL)
        if sql_match:
            sql = sql_match.group(1).replace(";", "").strip()
            return sql

        # Fallback : extraire le SELECT brut et supprimer tous les artefacts markdown résiduels
        sql_keywords = ["SELECT ", "FROM ", "WHERE "]
        if any(kw in response.upper() for kw in sql_keywords):
            start_idx = response.upper().find("SELECT ")
            if start_idx >= 0:
                sql = response[start_idx:].split(";")[0]
                # Supprimer les backticks résiduels (``` ou `)
                sql = re.sub(r"`+", "", sql).strip()
                return sql

        return None

    # ----------------------------------------------------------
    # GÉNÉRATION DOC
    # Récupère le contexte RAG + appelle le prompt DOC dédié
    # ----------------------------------------------------------
    def _generate_doc_answer(self, question: str) -> str:
        """Appelle le LLM avec le contexte RAG et le prompt DOC dédié."""
        docs = self.retriever.invoke(question)
        context = "\n\n".join([d.page_content for d in docs])
        full_prompt = _DOC_PROMPT.format(context=context, question=question)
        response = self.llm.invoke(full_prompt)
        # Nettoyer les éventuels blocs markdown
        clean = response.replace("```text", "").replace("```", "").strip()
        return clean

    # ----------------------------------------------------------
    # POINT D'ENTRÉE PRINCIPAL
    # ----------------------------------------------------------
    def generate_sql(self, question: str) -> str:
        cache_key = question.strip().lower()

        # Cache hit
        if cache_key in self.sql_cache:
            print(f"[CACHE HIT] '{question}'")
            return self.sql_cache[cache_key]

        if not self.index_loaded:
            return "Erreur : Index Chroma manquant. Lancez l'ingestion Oracle."

        # Étape 1 : Routage d'intention
        intent = self._classify_intent(question)
        print(f"[INTENT] '{question}' -> {intent}")

        if intent == "GREETING":
            result = "GREETINGS: Bonjour ! Je suis Custodix AI. Comment puis-je vous aider ?"

        elif intent == "SQL":
            sql = self._generate_sql_query(question)
            if sql:
                result = sql
            else:
                # Fallback : on bascule vers une réponse DOC si le LLM n'a rien produit de valide
                answer = self._generate_doc_answer(question)
                result = "GREETINGS: " + answer

        else:  # DOC
            answer = self._generate_doc_answer(question)
            result = "GREETINGS: " + answer

        self.sql_cache[cache_key] = result
        return result

    # ----------------------------------------------------------
    # FORMATEUR DE RÉPONSE HUMAINE (inchangé)
    # ----------------------------------------------------------
    def format_answer(self, question: str, query: str, results: list) -> str:
        import json, hashlib
        cache_string = f"{question.strip().lower()}_{json.dumps(results, sort_keys=True)}"
        cache_key = hashlib.md5(cache_string.encode()).hexdigest()

        if cache_key in self.format_cache:
            print(f"[CACHE HIT] Réponse humaine pour : '{question}'")
            return self.format_cache[cache_key]

        prompt = f"""Tu es l'agent IA Custodix. L'utilisateur a demandé : "{question}"
La base de données Oracle a répondu (données brutes JSON) : {results}

Rédige une phrase humaine unique, claire et professionnelle en français pour donner la réponse à l'utilisateur.
Ne donne AUCUNE explication technique, ne parle pas de la requête SQL ou JSON.
Si la réponse est une liste complexe, introduis-la simplement (ex: 'Voici la liste demandée :').
Réponse humaine :"""
        response = self.llm.invoke(prompt)
        final_response = response.strip()

        self.format_cache[cache_key] = final_response
        return final_response
