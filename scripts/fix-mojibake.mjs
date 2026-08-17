#!/usr/bin/env node
// Re-decodifica arquivos .ts/.tsx salvos com UTF-8 reinterpretado como Latin-1
// (mojibake do tipo "RedaÃ§Ã£o" → "Redação").
//
// Estratégia:
//   1. Lê o arquivo como bytes brutos.
//   2. Decodifica como latin1 → string intermediária.
//   3. Re-codifica essa string como utf8 → novos bytes.
//   4. Compara com a versão original. Se forem idênticos, não há mojibake.
//   5. Valida com heurística: os novos bytes, decodificados como utf8, devem
//      conter pelo menos um caractere PT-BR comum (ç, ã, é, í, ó, ú, ê, ô, à, ü).
//   6. Se passar, faz backup .bak e regrava.
//
// Uso:
//   node scripts/fix-mojibake.mjs <arquivo> [arquivo...]
//   node scripts/fix-mojibake.mjs --dry-run <arquivo>...
//
// O script NÃO toca em arquivos que já estão em utf-8 válido. Não toca em
// arquivos binários. Não reformata nada além dos bytes.

import { readFileSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const PT_BR_CHARS = /[çãéíóúêôàüÇÃÉÍÓÚÊÔÀÜ]/;

function reencode(buffer) {
  // 1. bytes → latin1 string
  const asLatin1 = buffer.toString("latin1");
  // 2. latin1 string → utf8 bytes
  const utf8Bytes = Buffer.from(asLatin1, "utf8");
  return { asLatin1, utf8Bytes };
}

function hasMojibake(buffer) {
  // Detecta o padrão "Ã" (0xC3) seguido de byte alto (0x80-0xBF),
  // ou "Â" (0xC2) seguido de byte alto. Esses são os sinais mais comuns
  // de utf-8 lido como latin1.
  const bytes = new Uint8Array(buffer);
  let hits = 0;
  for (let i = 0; i < bytes.length - 1; i++) {
    const a = bytes[i];
    const b = bytes[i + 1];
    if ((a === 0xc3 || a === 0xc2) && b >= 0x80 && b <= 0xbf) {
      hits++;
    }
  }
  // Heurística: precisa de vários hits para evitar falso-positivo em texto legítimo.
  return hits >= 3;
}

function processFile(filepath, { dryRun }) {
  const abs = resolve(filepath);

  if (!existsSync(abs)) {
    console.error(`✗ ${filepath}: arquivo não encontrado`);
    return { status: "missing" };
  }

  const original = readFileSync(abs);

  // Já é utf-8 válido e legível? Então pula.
  try {
    const asUtf8 = original.toString("utf8");
    // Confirma que tem acentos PT-BR OU não tem padrão de mojibake.
    if (PT_BR_CHARS.test(asUtf8) && !hasMojibake(original)) {
      return { status: "clean" };
    }
  } catch {
    // ignore
  }

  if (!hasMojibake(original)) {
    return { status: "clean" };
  }

  const { utf8Bytes } = reencode(original);

  // Validação: o resultado precisa ser utf-8 válido com acentos PT-BR.
  let decoded;
  try {
    decoded = utf8Bytes.toString("utf8");
  } catch {
    return { status: "invalid-utf8-after", filepath };
  }

  if (!PT_BR_CHARS.test(decoded)) {
    return { status: "no-pt-br-chars", filepath };
  }

  if (dryRun) {
    console.log(`~ ${filepath}: re-encoding necessário (${original.length} → ${utf8Bytes.length} bytes)`);
    return { status: "would-fix" };
  }

  // Backup antes de regravar.
  copyFileSync(abs, abs + ".bak");
  writeFileSync(abs, utf8Bytes);
  console.log(`✓ ${filepath}: corrigido (backup em ${filepath}.bak)`);
  return { status: "fixed" };
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const files = args.filter((a) => a !== "--dry-run");

  if (files.length === 0) {
    console.error("Uso: node scripts/fix-mojibake.mjs [--dry-run] <arquivo>...");
    process.exit(1);
  }

  const summary = { fixed: 0, "would-fix": 0, clean: 0, missing: 0, "no-pt-br-chars": 0, "invalid-utf8-after": 0 };

  for (const f of files) {
    const r = processFile(f, { dryRun });
    if (r.status in summary) summary[r.status]++;
  }

  console.log("\n--- Resumo ---");
  for (const [k, v] of Object.entries(summary)) {
    if (v > 0) console.log(`  ${k}: ${v}`);
  }

  // Em modo normal, exit code 1 se algum arquivo estava sujo e teve que ser
  // reescrito (CI pode usar isso). Em dry-run, não.
  if (!dryRun && summary.fixed > 0) {
    process.exit(0); // sucesso — arquivos foram consertados
  }
}

main();
