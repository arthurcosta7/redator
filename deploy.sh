#!/bin/bash
# deploy.sh — Script de deploy na VPS
#
# Uso:
#   chmod +x deploy.sh   (apenas na primeira vez)
#   ./deploy.sh

set -e  # Para na primeira falha

echo ""
echo "═══════════════════════════════════════"
echo "  Deploy Redator"
echo "═══════════════════════════════════════"
echo ""

# ─── 1. Atualiza o código ────────────────────────────────────
echo "→ Atualizando código..."
git pull origin main

# ─── 2. Constrói as imagens ──────────────────────────────────
echo "→ Construindo imagens Docker..."
docker compose -f docker-compose.prod.yml build --no-cache

# ─── 3. Sobe os serviços de infraestrutura primeiro ─────────
echo "→ Subindo banco e cache..."
docker compose -f docker-compose.prod.yml up -d postgres redis

echo "→ Aguardando banco ficar pronto..."
sleep 5

# ─── 4. Roda as migrations ───────────────────────────────────
echo "→ Rodando migrations..."
docker compose -f docker-compose.prod.yml run --rm backend alembic upgrade head

# ─── 5. Sobe o backend ───────────────────────────────────────
echo "→ Subindo backend..."
docker compose -f docker-compose.prod.yml up -d backend

# ─── 6. Remove imagens antigas ───────────────────────────────
echo "→ Limpando imagens antigas..."
docker image prune -f

echo ""
echo "✓ Deploy concluído!"
echo ""
echo "Verifique o status com:"
echo "  docker compose -f docker-compose.prod.yml ps"
echo "  docker compose -f docker-compose.prod.yml logs -f backend"
echo ""
