import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes import router as ai_router

app = FastAPI(title="Custodix AI", description="Microservice Text-to-SQL avec RAG et Llama 3")

# Gérer les accès externes (CORS - très permissif pour le DEV)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Enregistrement des routes
app.include_router(ai_router, prefix="/api", tags=["AI Agent"])

if __name__ == "__main__":
    print("Démarrage du Serveur Custodix AI sur le port 8000...")
    uvicorn.run(app, host="0.0.0.0", port=8000)
