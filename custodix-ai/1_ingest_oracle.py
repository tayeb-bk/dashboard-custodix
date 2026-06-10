import os
import oracledb
from dotenv import load_dotenv
from langchain_community.vectorstores import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_core.documents import Document

load_dotenv()

def fetch_oracle_schema():
    print("Connexion à Oracle...")
    try:
        connection = oracledb.connect(
            user=os.environ.get("DB_USER"),
            password=os.environ.get("DB_PASSWORD"),
            dsn=os.environ.get("DB_DSN")
        )
        cursor = connection.cursor()
        
        print("Extraction dynamique des tables et colonnes...")
        cursor.execute("""
            SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE 
            FROM ALL_TAB_COLUMNS 
            WHERE OWNER = :owner
            AND TABLE_NAME NOT LIKE 'HT_%'
            AND TABLE_NAME NOT LIKE 'REV_%'
            ORDER BY TABLE_NAME
        """, owner=os.environ.get("DB_USER"))
        
        rows = cursor.fetchall()
        
        tables_dict = {}
        for row in rows:
            table_name = row[0]
            col_name = row[1]
            col_type = row[2]
            
            if table_name not in tables_dict:
                tables_dict[table_name] = []
            tables_dict[table_name].append(f"- {col_name} ({col_type})")
            
        cursor.close()
        connection.close()
        
        documents = []
        for table_name, columns in tables_dict.items():
            content = f"Table {table_name} contient les colonnes :\n" + "\n".join(columns[:100]) # On limite pour éviter de surcharger Chroma
            doc = Document(page_content=content, metadata={"table_name": table_name})
            documents.append(doc)
            
        print(f"[OK] {len(documents)} tables extraites avec succes depuis Oracle !")
        return documents
        
    except Exception as e:
        print(f"Erreur lors de la lecture sur Oracle : {e}")
        return []

def create_chroma_index(documents):
    if not documents:
        print("Aucun document à indexer.")
        return
        
    print("Chargement du modèle d'embedding (HuggingFace)...")
    embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
    
    print("Création de la base Vectorielle ChromaDB...")
    # Chroma gère lui-même la persistance sur disque si persist_directory est fourni
    vectorstore = Chroma.from_documents(
        documents=documents, 
        embedding=embeddings, 
        persist_directory="./chroma_index"
    )
    print("[OK] Index Chroma RAG cree avec succes dans ./chroma_index !")

def fetch_local_documentation():
    documents = []
    docs_dir = "./docs"
    if os.path.exists(docs_dir):
        print(f"Chargement de la documentation locale depuis {docs_dir}...")
        for filename in os.listdir(docs_dir):
            if filename.endswith(".txt") or filename.endswith(".md"):
                file_path = os.path.join(docs_dir, filename)
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()
                
                # Document complet pour les questions globales (ex: compter les widgets de la page)
                doc_full = Document(
                    page_content=content,
                    metadata={"source": filename, "chunk": "full", "table_name": "N/A (Documentation)"}
                )
                documents.append(doc_full)
                
                # Découpage par double retour à la ligne pour avoir des paragraphes précis
                paragraphs = content.split("\n\n")
                for i, para in enumerate(paragraphs):
                    para = para.strip()
                    if len(para) > 10:
                        doc = Document(
                            page_content=para,
                            metadata={"source": filename, "chunk": f"part_{i}", "table_name": "N/A (Documentation)"}
                        )
                        documents.append(doc)
        print(f"[OK] {len(documents)} fragments de documentation charges !")
    else:
        print("Dossier ./docs introuvable.")
    return documents

if __name__ == "__main__":
    docs_db = fetch_oracle_schema()
    docs_local = fetch_local_documentation()
    all_docs = docs_db + docs_local
    create_chroma_index(all_docs)
