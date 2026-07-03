#!/bin/bash
# Import Data Pump du schema UCUSTOI0, execute une seule fois par l'image
# gvenzl/oracle-xe au tout premier demarrage (volume de donnees vide).
# Ne touche jamais a l'installation Oracle locale de l'utilisateur : lit
# uniquement le fichier .dmp monte en lecture seule dans le conteneur.
set -e

echo "=== Import Data Pump du schema UCUSTOI0 ==="

# Le dossier du .dmp est monte en lecture seule ; le log doit etre ecrit
# ailleurs, dans le volume Oracle (en ecriture).
mkdir -p /opt/oracle/oradata/dpdump_logs

sqlplus -s / as sysdba <<SQL
ALTER SESSION SET CONTAINER=XEPDB1;
CREATE OR REPLACE DIRECTORY IMPORT_DIR AS '/dumps';
CREATE OR REPLACE DIRECTORY LOG_DIR AS '/opt/oracle/oradata/dpdump_logs';
CREATE TABLESPACE UCUSTOI0 DATAFILE '/opt/oracle/oradata/XE/XEPDB1/ucustoi0.dbf' SIZE 200M AUTOEXTEND ON NEXT 200M MAXSIZE UNLIMITED;
EXIT;
SQL

# impdp peut retourner un code non-zero meme quand l'essentiel a ete importe
# avec succes (quelques objets mineurs en echec) ; on ne bloque pas le
# demarrage du conteneur pour autant, l'erreur reste visible dans le log.
impdp system/${ORACLE_PASSWORD}@//localhost:1521/XEPDB1 \
  directory=IMPORT_DIR \
  dumpfile=ucustoi0.dmp \
  logfile=LOG_DIR:import_ucustoi0.log \
  schemas=UCUSTOI0 || true

echo "=== Import UCUSTOI0 termine (voir log ci-dessus pour le detail) ==="

# Le .dmp recree UCUSTOI0 avec le mot de passe d'origine de l'environnement
# source (pas "123456"). On le force ici pour matcher application.properties
# et custodix-ai/.env, sans jamais modifier ces fichiers.
sqlplus -s / as sysdba <<SQL
ALTER SESSION SET CONTAINER=XEPDB1;
ALTER USER UCUSTOI0 IDENTIFIED BY "123456";
ALTER USER UCUSTOI0 ACCOUNT UNLOCK;
EXIT;
SQL

echo "=== Mot de passe UCUSTOI0 aligne sur la config de l'application ==="
