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
            
        print(f"✅ {len(documents)} tables extraites avec succès depuis Oracle !")
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
    print("✅ Index Chroma RAG créé avec succès dans ./chroma_index !")

if __name__ == "__main__":
    docs = fetch_oracle_schema()
    create_chroma_index(docs)
