#!/bin/sh
# Demarre le serveur Ollama puis telecharge les modeles utilises par
# custodix-ai (une seule fois : ollama pull ne re-telecharge pas un
# modele deja present dans le volume /root/.ollama).
set -e

ollama serve &
SERVE_PID=$!

echo "En attente du serveur Ollama..."
until ollama list >/dev/null 2>&1; do
  sleep 1
done

echo "Telechargement des modeles (ignore si deja presents)..."
ollama pull llama3
ollama pull llama3.2:1b

echo "=== Modeles Ollama prets ==="
wait $SERVE_PID
