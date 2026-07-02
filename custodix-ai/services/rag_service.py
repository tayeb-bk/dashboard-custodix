import os
import re
from langchain_community.llms import Ollama
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_core.documents import Document

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
- PRIORITY_ : Niveau de priorité du fichier
- FILE_ID_ : Identifiant du fichier physique lié
- RECONCILING_ID_ : Identifiant de réconciliation (si applicable)
- GROUPE_IDENTIFIER_ : Identifiant du groupe de fichiers
- TOTALSPLITCOUNT_ : Nombre total de segments si le fichier a été découpé
- COMPLETECOUNT_ : Nombre de segments effectivement reçus/complétés

2. Table UCUSTOI0.FLOW_FILEOUT (Expédition des fichiers) :
- ID_ : Identifiant unique
- FILEIN_ID_ : Identifiant du fichier reçu lié (FLOW_FILEIN.ID_)
- FILE_ID_ : Identifiant du fichier physique
- DESTINATIONINFO_ID_ : Identifiant de destination
- ACKEXPECTED_ : 1 si acquittement attendu, 0 sinon
- USEDADDRESS_ : Adresse de livraison

3. Table UCUSTOI0.FLOW_FLOW (Traitement logique des flux) :
- ID_ : Identifiant unique du flux
- STATUS_ : Statut du flux. Valeurs RÉELLES uniquement (JAMAIS en inventer d'autres) : Sent, Processed, Blocked, NoContractFound, Init, WaitToBeSent, Initial, InTechnicalError, InitiationError, SentAndWaitingAck, SubWorkflowInProcess, SubWorkflowInTechnicalError, InProcess, Initiated, Acked, WaitProcessing, InitiationFailed, InBusinessError, Nacked, Rejected, PutInQueueFailed, MarkedForSuspension, Canceled, WaitAction
- TYPE_ : Nom de classe technique interne (ex: com.vermeg.xchanger.ref.flow.FileOut) - PAS un statut métier, ne jamais l'utiliser pour filtrer par "statut"
- FLOWTYPE_NAME_ : Nom du type de flux métier (ex: FT_MT502, GENERALI_MT535_FT)
- CREATIONDATE_ : Date de création
- UPDATEDATE_ : Date de mise à jour
- BUSINESSDAY_ : Jour ouvré métier associé au flux
- SENDER_IDENTIFIER_ : Identifiant émetteur
- RECEIVER_IDENTIFIER_ : Identifiant destinataire
- ROUTE_ROUTEID_ : Identifiant de la route
- AMOUNT1_, AMOUNT2_, AMOUNT3_, AMOUNT4_ : Montants financiers associés au flux
- COMMENT_ : Commentaire libre sur le flux (souvent renseigné en cas d'anomalie)
- LASTERROR_ID_ : Identifiant de la dernière erreur rencontrée (non-null si le flux a eu une erreur)
- BLOCKINGORIGIN_ : Origine du blocage si le flux est bloqué
- ALERTTOGROUP_ / ALERTTOUSER_ : Groupe/utilisateur destinataire d'une alerte sur ce flux
- APPREFERENCE_ : Référence applicative métier
- ACTUALSTEP_ / NEXTSTEP_ : Étape actuelle / étape suivante du traitement
- CREATORUSERID_ / UPDATORUSERID_ : Utilisateur ayant créé/modifié le flux
- ELEMENTSCOUNT_ : Nombre d'éléments contenus dans le flux

4. Table UCUSTOI0.FLOW_INCOMINGACKNOWLEGEMENT (Acquittements réseau) :
- ID_ : Identifiant unique
- ACKEDFILEOUT_ID_ : Identifiant du fichier expédié (FLOW_FILEOUT.ID_)
- FILEOUTSENDINGDATE_ : Date/heure d'acquittement (JAMAIS ACK_DATE) - ATTENTION : colonne stockée en VARCHAR2 et non en DATE/TIMESTAMP, être prudent avec les comparaisons/arithmétiques de date dessus
- ACKNOWLEDGEMENTTYPE_ : Type d'accusé (ex: ACK, NACK)
- ACKNOWLEDGEMENTCATEGORY_NAME_ : Catégorie de l'accusé
- ERRORCODE_ : Code d'erreur si accusé négatif
- ERRORREASON_ : Motif de l'erreur si accusé négatif"""

_SQL_PROMPT = """Tu es Custodix AI, un expert de base de données Oracle 21c.
Génère UNIQUEMENT une requête SQL Oracle valide pour répondre à la question.
Ta réponse doit être UNIQUEMENT un bloc markdown SQL, sans aucune explication ni point-virgule (;).
N'ajoute JAMAIS de clause WITH/CTE, de sous-requête ou de calcul qui n'est pas réellement utilisé
dans le SELECT final — les exemples ci-dessous sont des modèles de style à adapter à la question
posée, pas des blocs à recopier ou combiner entre eux sans raison. Reste strictement au minimum
nécessaire pour répondre à la question posée.

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
- CRITIQUE : une colonne n'existe que dans SA table (voir schémas certifiés ci-dessous). Si la question combine un attribut de FLOW_FILEIN (ex: PASSEDCONTRACTIDENTIFIER_, WORKFLOWID_) avec un attribut de FLOW_FLOW (ex: STATUS_) ou d'une autre table, tu DOIS faire un JOIN entre les tables — ne jamais supposer qu'une colonne existe sur une table où elle n'est pas listée.
- CRITIQUE (jointure FLOW_FLOW) : FLOW_FLOW.ID_ NE correspond PAS toujours à FLOW_FILEIN.ID_. Pour un statut lié à la RÉCEPTION (ex: contexte d'intégration), le lien direct FLOW_FLOW.ID_ = FLOW_FILEIN.ID_ est correct. Mais pour un statut lié à l'EXPÉDITION/l'envoi (ex: Blocked, Sent, WaitToBeSent, SentAndWaitingAck, Acked), ce lien direct ne renvoie AUCUN résultat : il faut obligatoirement passer par FLOW_FILEOUT comme intermédiaire : FLOW_FILEIN fi JOIN FLOW_FILEOUT fo ON fo.FILEIN_ID_ = fi.ID_ JOIN FLOW_FLOW ff ON ff.ID_ = fo.ID_. En cas de doute sur quel chemin utiliser, préfère le chemin via FLOW_FILEOUT pour les questions de statut/blocage/expédition.

SYNTAXE DATES ORACLE (CRITIQUE) :
- Filtrer par jour actuel (aujourd'hui) : TRUNC(SENDINGDATE_) = TRUNC(SYSDATE)
- Si l'utilisateur demande "par jour", "les latences moyennes" (sans mentionner de date précise), ne restreins pas à une date fixe, ou utilise TRUNC(SYSDATE) pour aujourd'hui.
- Filtrer par un jour précis (seulement si spécifié dans la question, par exemple le 5 juin 2025) : TRUNC(SENDINGDATE_) = TO_DATE('05-06-2025', 'DD-MM-YYYY')
- Filtrer par heure : EXTRACT(HOUR FROM SENDINGDATE_) BETWEEN 14 AND 16
- INTERDIT : DATE_TRUNC() (PostgreSQL), DATE 'YYYY-MM-DD' (invalide Oracle)

{schemas}

EXEMPLES PERTINENTS POUR CETTE QUESTION (sélectionnés parmi une banque plus large selon leur similarité avec la question posée) :
{examples}

Question de l'utilisateur : {question}
Génère la requête SQL dans un bloc markdown complet (```sql ... ```) :"""

# ============================================================
# BANQUE D'EXEMPLES SQL - Etape 2 du RAG.
# Chaque exemple est indexé par similarité (Mode 3, séparé du Mode 2
# documentaire) : seuls les 2-3 exemples les plus proches de la question
# posée sont injectés dans le prompt, au lieu d'une liste fixe toujours
# identique. Chaque requête porte un commentaire SQL expliquant son rôle.
# ============================================================
_SQL_EXAMPLES = [
    {
        "category": "comptage_date",
        "question": "Fichiers reçus aujourd'hui",
        "sql": "-- Compte les fichiers reçus le jour même (TRUNC ne garde que la partie date)\n"
               "SELECT ID_, INITIATIONFILE_, SENDINGDATE_ FROM UCUSTOI0.FLOW_FILEIN WHERE TRUNC(SENDINGDATE_) = TRUNC(SYSDATE)"
    },
    {
        "category": "classement_top_n",
        "question": "Contrats avec le plus de violations SLA",
        "sql": "-- Classe les contrats par nombre de violations SLA (T2 traitement > 15s OU T3 acquittement > 120s)\n"
               "SELECT fi.PASSEDCONTRACTIDENTIFIER_, COUNT(*) AS TOTAL_VIOLATIONS\n"
               "FROM UCUSTOI0.FLOW_FILEIN fi\n"
               "LEFT JOIN UCUSTOI0.FLOW_FLOW ff ON ff.ID_ = fi.ID_\n"
               "LEFT JOIN UCUSTOI0.FLOW_FILEOUT fo ON fo.FILEIN_ID_ = fi.ID_\n"
               "LEFT JOIN UCUSTOI0.FLOW_INCOMINGACKNOWLEGEMENT ack ON ack.ACKEDFILEOUT_ID_ = fo.ID_\n"
               "WHERE ((ff.UPDATEDATE_ - ff.CREATIONDATE_) * 86400 > 15)\n"
               "   OR (fo.ACKEXPECTED_ = 1 AND (ack.FILEOUTSENDINGDATE_ - fi.SENDINGDATE_) * 86400 > 120)\n"
               "GROUP BY fi.PASSEDCONTRACTIDENTIFIER_\n"
               "ORDER BY TOTAL_VIOLATIONS DESC"
    },
    {
        "category": "taux_pourcentage",
        "question": "Taux de doublons aujourd'hui",
        "sql": "-- Compte les fichiers marqués comme doublons (DUPLICATED_ID_ non nul) reçus le jour même\n"
               "SELECT COUNT(*) FROM UCUSTOI0.FLOW_FILEIN WHERE DUPLICATED_ID_ IS NOT NULL AND TRUNC(SENDINGDATE_) = TRUNC(SYSDATE)"
    },
    {
        "category": "agregation_horaire",
        "question": "Pics horaires aujourd'hui",
        "sql": "-- Regroupe les fichiers du jour par heure de réception pour repérer les pics d'activité\n"
               "SELECT EXTRACT(HOUR FROM SENDINGDATE_) AS HEURE, COUNT(*) AS TOTAL FROM UCUSTOI0.FLOW_FILEIN "
               "WHERE TRUNC(SENDINGDATE_) = TRUNC(SYSDATE) GROUP BY EXTRACT(HOUR FROM SENDINGDATE_) ORDER BY TOTAL DESC"
    },
    {
        "category": "comptage_filtre_statut",
        "question": "Flux en erreur globaux",
        "sql": "-- Compte tous les flux dans un statut d'erreur technique ou de rejet, sans filtre de date\n"
               "SELECT COUNT(*) FROM UCUSTOI0.FLOW_FLOW WHERE STATUS_ IN ('InTechnicalError', 'Rejected', 'Blocked')"
    },
    {
        "category": "agregat_par_contrat",
        "question": "Taille moyenne des fichiers par contrat",
        "sql": "-- Calcule la taille moyenne des fichiers (FILESIZE_ en octets) regroupée par contrat SLA\n"
               "SELECT PASSEDCONTRACTIDENTIFIER_, AVG(FILESIZE_) FROM UCUSTOI0.FLOW_FILEIN GROUP BY PASSEDCONTRACTIDENTIFIER_"
    },
    {
        "category": "classement_top_n",
        "question": "Top 5 des contrats avec le plus de fichiers reçus",
        "sql": "-- Classe les contrats par volume total de fichiers reçus, du plus actif au moins actif\n"
               "SELECT PASSEDCONTRACTIDENTIFIER_, COUNT(*) AS TOTAL\n"
               "FROM UCUSTOI0.FLOW_FILEIN\n"
               "WHERE PASSEDCONTRACTIDENTIFIER_ IS NOT NULL\n"
               "GROUP BY PASSEDCONTRACTIDENTIFIER_\n"
               "ORDER BY TOTAL DESC\n"
               "FETCH FIRST 5 ROWS ONLY"
    },
    {
        "category": "classement_top_n",
        "question": "Quelles sont les routes avec le plus de flux",
        "sql": "-- Classe les routes (couple émetteur/destinataire) par volume total de flux traités\n"
               "SELECT SENDER_IDENTIFIER_, RECEIVER_IDENTIFIER_, COUNT(*) AS TOTAL\n"
               "FROM UCUSTOI0.FLOW_FLOW\n"
               "GROUP BY SENDER_IDENTIFIER_, RECEIVER_IDENTIFIER_\n"
               "ORDER BY TOTAL DESC\n"
               "FETCH FIRST 5 ROWS ONLY"
    },
    {
        "category": "filtre_statut_reel",
        "question": "Quels flux sont actuellement bloqués",
        "sql": "-- Filtre uniquement les flux dans le vrai statut métier 'Blocked' (valeur réelle certifiée)\n"
               "SELECT ID_, FLOWTYPE_NAME_, BLOCKINGORIGIN_ FROM UCUSTOI0.FLOW_FLOW WHERE STATUS_ = 'Blocked'"
    },
    {
        "category": "filtre_periode",
        "question": "Combien de fichiers reçus cette semaine",
        "sql": "-- Compte les fichiers reçus depuis le début de la semaine calendaire en cours (TRUNC avec 'IW')\n"
               "SELECT COUNT(*) FROM UCUSTOI0.FLOW_FILEIN WHERE SENDINGDATE_ >= TRUNC(SYSDATE, 'IW')"
    },
    {
        "category": "investigation_par_id",
        "question": "Pourquoi le flux numéro 12345 est-il bloqué",
        "sql": "-- Récupère le statut et les colonnes d'investigation (origine du blocage, commentaire, dernière erreur) pour UN flux précis\n"
               "SELECT STATUS_, BLOCKINGORIGIN_, COMMENT_, LASTERROR_ID_ FROM UCUSTOI0.FLOW_FLOW WHERE ID_ = 12345"
    },
    {
        "category": "ack_manquants",
        "question": "Combien de fichiers attendent encore un accusé de réception",
        "sql": "-- Compte les livraisons pour lesquelles un accusé était attendu (ACKEXPECTED_=1) mais jamais reçu\n"
               "SELECT COUNT(*)\n"
               "FROM UCUSTOI0.FLOW_FILEOUT fo\n"
               "WHERE fo.ACKEXPECTED_ = 1\n"
               "  AND NOT EXISTS (\n"
               "      SELECT 1 FROM UCUSTOI0.FLOW_INCOMINGACKNOWLEGEMENT ack\n"
               "      WHERE ack.ACKEDFILEOUT_ID_ = fo.ID_\n"
               "  )"
    },
    {
        "category": "classement_top_n_multi_table",
        "question": "Top 5 des contrats avec le plus de flux bloqués",
        "sql": "-- IMPORTANT (vérifié empiriquement) : les statuts d'EXPÉDITION comme 'Blocked' ne se\n"
               "-- rejoignent PAS directement via FLOW_FLOW.ID_ = FLOW_FILEIN.ID_ (ce chemin ne capture\n"
               "-- que les flux de type réception et renvoie 0 ligne pour ces statuts). Il faut passer\n"
               "-- par FLOW_FILEOUT : FLOW_FILEIN -> FLOW_FILEOUT (FILEIN_ID_) -> FLOW_FLOW (ID_=ID_).\n"
               "SELECT fi.PASSEDCONTRACTIDENTIFIER_, COUNT(*) AS TOTAL_BLOQUES\n"
               "FROM UCUSTOI0.FLOW_FILEIN fi\n"
               "JOIN UCUSTOI0.FLOW_FILEOUT fo ON fo.FILEIN_ID_ = fi.ID_\n"
               "JOIN UCUSTOI0.FLOW_FLOW ff ON ff.ID_ = fo.ID_\n"
               "WHERE ff.STATUS_ = 'Blocked' AND fi.PASSEDCONTRACTIDENTIFIER_ IS NOT NULL\n"
               "GROUP BY fi.PASSEDCONTRACTIDENTIFIER_\n"
               "ORDER BY TOTAL_BLOQUES DESC\n"
               "FETCH FIRST 5 ROWS ONLY"
    },
]

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

# Mots-clés typiques d'une question de données (SQL), pour éviter un appel LLM
# de classification quand l'intention est déjà évidente. Raccourci additif :
# si aucun mot-clé ne correspond, on retombe sur la classification LLM existante.
_SQL_INTENT_KEYWORDS = {
    "combien", "top", "liste", "lister", "quels sont", "quelles sont",
    "montre", "affiche", "taux de", "moyenne", "classement",
    "nombre de", "compte", "total",
    "aujourd'hui", "aujourd hui", "hier", "cette semaine", "ce mois",
    "reçus", "reçu", "recus", "recu", "bloqués", "bloqué", "bloques", "bloque"
}


class RagService:
    def __init__(self):
        print("Initialisation du Service RAG...")
        self.llm = Ollama(model="llama3", temperature=0)
        # Modèle léger utilisé uniquement pour les étapes rapides (classification
        # d'intention, mise en forme de la réponse humaine) — jamais pour la
        # génération SQL, qui reste sur le modèle complet ci-dessus.
        self.llm_fast = Ollama(model="llama3.2:1b", temperature=0)
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

        # Index Chroma dédié à la banque d'exemples SQL (Mode 3 - Étape 2 du RAG).
        # Totalement séparé de self.vectorstore (Mode 2, documentation) : jamais mélangés.
        sql_examples_dir = "./chroma_sql_examples"
        try:
            if os.path.exists(sql_examples_dir):
                print("Chargement de l'index Chroma des exemples SQL...")
                self.sql_examples_store = Chroma(persist_directory=sql_examples_dir, embedding_function=self.embeddings)
            else:
                print("Construction de l'index Chroma des exemples SQL (première initialisation)...")
                example_docs = [
                    Document(page_content=ex["question"], metadata={"example_index": i})
                    for i, ex in enumerate(_SQL_EXAMPLES)
                ]
                self.sql_examples_store = Chroma.from_documents(
                    documents=example_docs,
                    embedding=self.embeddings,
                    persist_directory=sql_examples_dir
                )
            self.sql_examples_retriever = self.sql_examples_store.as_retriever(search_kwargs={"k": 3})
            self.sql_examples_loaded = True
        except Exception as e:
            print(f"ATTENTION: Impossible de construire l'index des exemples SQL ({e}). Repli sur tous les exemples.")
            self.sql_examples_loaded = False

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

        # 2. Détection SQL par mots-clés évidents (rapide, sans LLM). Si aucun
        # mot-clé ne correspond, on ne devine pas et on retombe sur le LLM ci-dessous.
        if any(keyword in q_lower for keyword in _SQL_INTENT_KEYWORDS):
            return "SQL"

        # 3. Classification binaire SQL vs DOC par LLM. IMPORTANT : reste sur le
        # modèle complet (self.llm), PAS le modèle léger — testé en conditions
        # réelles, llama3.2:1b se trompe sur des cas pourtant évidents (ex:
        # "Fichiers reçus aujourd'hui" classé à tort en DOC). Cette décision est
        # trop critique pour l'exactitude de la réponse pour risquer un modèle faible ;
        # le raccourci par mots-clés ci-dessus reste le principal gain de vitesse ici.
        intent_prompt = f"""Détermine si la question suivante nécessite d'écrire une requête SQL pour chercher des données réelles de la base de données (chiffres, fichiers, volumes, statistiques, doublons, dates), ou s'il s'agit d'une question d'explication générale sur le dashboard, le rôle d'un widget, ou la définition d'un terme.

Réponds UNIQUEMENT par l'un de ces deux mots : SQL ou DOC

Question : {question}
Réponse :"""
        raw = self.llm.invoke(intent_prompt).strip().upper()
        if "SQL" in raw:
            return "SQL"
        return "DOC"

    # ----------------------------------------------------------
    # SÉLECTION DES EXEMPLES SQL PERTINENTS (Mode 3, Étape 2 du RAG)
    # Recherche par similarité dans la banque d'exemples, complètement
    # séparée de l'index documentaire (Mode 2).
    # ----------------------------------------------------------
    def _get_relevant_examples(self, question: str, k: int = 3) -> str:
        if not self.sql_examples_loaded:
            # Filet de sécurité : si l'index n'a pas pu être construit, on retombe
            # sur l'ensemble de la banque plutôt que de laisser le prompt sans exemple.
            examples = _SQL_EXAMPLES
        else:
            docs = self.sql_examples_retriever.invoke(question)
            examples = [_SQL_EXAMPLES[doc.metadata["example_index"]] for doc in docs]
            if not examples:
                examples = _SQL_EXAMPLES[:k]

        return "\n\n".join(f"- {ex['question']} :\n  {ex['sql']}" for ex in examples)

    # ----------------------------------------------------------
    # GÉNÉRATION SQL
    # Construit et exécute le prompt SQL dédié
    # ----------------------------------------------------------
    def _generate_sql_query(self, question: str) -> str:
        """Appelle le LLM avec le prompt SQL dédié + schémas certifiés + exemples pertinents."""
        examples_block = self._get_relevant_examples(question)
        # On n'ajoute PAS de ```sql dans le prompt pour que le LLM génère le bloc complet lui-même
        full_prompt = _SQL_PROMPT.format(schemas=_CERTIFIED_SCHEMAS, examples=examples_block, question=question)
        response = self.llm.invoke(full_prompt)

        # Extraire le bloc SQL d'un markdown ```sql...```
        sql_match = re.search(r"```[sS][qQ][lL]?(.*?)```", response, re.DOTALL)
        if sql_match:
            sql = sql_match.group(1).replace(";", "").strip()
            return self._strip_leading_sql_comments(sql)

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

    @staticmethod
    def _strip_leading_sql_comments(sql: str) -> str:
        """Retire les lignes de commentaire SQL (--) et lignes vides en tête, pour garantir
        que la requête commence toujours directement par un vrai mot-clé (ex: SELECT) — la
        validation Spring l'exige. Nécessaire depuis que la banque d'exemples inclut des
        commentaires explicatifs : le LLM reproduit parfois ce style dans sa propre réponse."""
        lines = sql.split("\n")
        while lines and (lines[0].strip().startswith("--") or lines[0].strip() == ""):
            lines.pop(0)
        return "\n".join(lines).strip()

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
    def format_answer(self, question: str, query: str, results: list, total_count: int = None) -> str:
        import json, hashlib
        cache_string = f"{question.strip().lower()}_{json.dumps(results, sort_keys=True)}_{total_count}"
        cache_key = hashlib.md5(cache_string.encode()).hexdigest()

        if cache_key in self.format_cache:
            print(f"[CACHE HIT] Réponse humaine pour : '{question}'")
            return self.format_cache[cache_key]

        # Résultat vide : réponse déterministe, sans appel LLM. On ne laisse pas le
        # modèle improviser sur un résultat vide (risque de réponse confuse), et ça
        # évite un appel LLM inutile (réponse instantanée).
        if not results:
            final_response = "Aucune donnée trouvée pour cette période ou ce critère."
            self.format_cache[cache_key] = final_response
            return final_response

        # Si l'échantillon est tronqué, on ne fait JAMAIS confiance au LLM pour compter
        # (il ne voit qu'un extrait et se trompe systématiquement sur le total réel).
        # Le total est calculé en Python (fiable), le LLM ne fournit que la phrase
        # descriptive, sans aucun chiffre.
        is_truncated = total_count is not None and total_count > len(results)

        if is_truncated:
            prompt = f"""Tu es l'agent IA Custodix. L'utilisateur a demandé : "{question}"
Voici un échantillon de {len(results)} lignes (sur {total_count} au total) en JSON : {results}

Rédige une courte phrase descriptive en français sur la NATURE de ces résultats (de quoi ils parlent, quels types de valeurs/problèmes reviennent). N'INDIQUE AUCUN NOMBRE ni quantité dans ta phrase (le total sera ajouté automatiquement avant ta phrase, séparément).
Ne donne AUCUNE explication technique, ne parle pas de la requête SQL ou JSON.
Phrase descriptive (sans aucun chiffre) :"""
            descriptive = self.llm_fast.invoke(prompt).strip()
            final_response = f"{total_count} résultat(s) trouvé(s) au total. {descriptive}"
        else:
            prompt = f"""Tu es l'agent IA Custodix. L'utilisateur a demandé : "{question}"
La base de données Oracle a répondu (données brutes JSON) : {results}

Rédige une phrase humaine unique, claire et professionnelle en français pour donner la réponse à l'utilisateur.
Ne donne AUCUNE explication technique, ne parle pas de la requête SQL ou JSON.
Si la réponse est une liste complexe, introduis-la simplement (ex: 'Voici la liste demandée :').
Réponse humaine :"""
            final_response = self.llm_fast.invoke(prompt).strip()

        self.format_cache[cache_key] = final_response
        return final_response
