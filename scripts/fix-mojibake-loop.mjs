#!/usr/bin/env node
// Re-decodifica arquivos .ts/.tsx que passaram por N ciclos de
// UTF-8 → Latin-1 → UTF-8. Detecta N dinamicamente e aplica o número
// certo de conversões latin1→utf8.
//
// Detecção: conta matches de padrão mojibake (Ã, Â seguidos de byte alto).
// Critério de parada: matches = 0 E regex de acentos PT-BR presente.
//
// Uso:
//   node scripts/fix-mojibake-loop.mjs <arquivo> [arquivo...]
//   node scripts/fix-mojibake-loop.mjs --dry-run <arquivo>...

import { readFileSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const PT_BR_CHARS = /[çãéíóúêôàüÇÃÉÍÓÚÊÔÀÜ]/;
// Padrão mojibake: Ã (0xC3) ou Â (0xC2) seguido de byte 0x80-0xBF.
function countMojibakeMatches(buffer) {
  const bytes = new Uint8Array(buffer);
  let hits = 0;
  for (let i = 0; i < bytes.length - 1; i++) {
    const a = bytes[i];
    const b = bytes[i + 1];
    if ((a === 0xc3 || a === 0xc2) && b >= 0x80 && b <= 0xbf) {
      hits++;
    }
  }
  return hits;
}

function reencodeOne(buffer) {
  const asLatin1 = buffer.toString("latin1");
  return Buffer.from(asLatin1, "utf8");
}

const MAX_ITERATIONS = 8;

function processFile(filepath, { dryRun }) {
  const abs = resolve(filepath);
  if (!existsSync(abs)) {
    return { status: "missing" };
  }

  const original = readFileSync(abs);
  const startMatches = countMojibakeMatches(original);
  const startHasPtBr = PT_BR_CHARS.test(original.toString("utf8"));

  // Já está limpo? Verifica 2 condições: sem mojibake E com acentos OU
  // ASCII puro (que é caso comum em arquivos que não usam PT-BR).
  if (startMatches === 0 && (startHasPtBr || !/[\x80-\xff]/.test(original.toString("utf8")))) {
    return { status: "clean", cycles: 0, startMatches };
  }

  if (startMatches === 0) {
    // Sem mojibake mas também sem acentos — pode ser que o arquivo não use PT-BR.
    return { status: "no-pt-br", cycles: 0, startMatches };
  }

  let current = original;
  let prevMatches = startMatches;
  const path = [];
  for (let i = 1; i <= MAX_ITERATIONS; i++) {
    const next = reencodeOne(current);
    const m = countMojibakeMatches(next);
    path.push({ cycle: i, before: prevMatches, after: m });
    if (m === 0) {
      // Convergência: arquivo está limpo. Validar com PT-BR.
      const decoded = next.toString("utf8");
      if (!PT_BR_CHARS.test(decoded) && /[\x80-\xff]/.test(decoded)) {
        // Tem bytes altos mas nenhum acento PT-BR. Suspeito. Para e reporta.
        return { status: "suspicious-clean", cycles: i, path, startMatches };
      }
      if (dryRun) {
        return { status: "would-fix", cycles: i, startMatches, path };
      }
      copyFileSync(abs, abs + ".bak");
      writeFileSync(abs, next);
      return { status: "fixed", cycles: i, startMatches, path };
    }
    if (m >= prevMatches) {
      // Não está convergindo. Algo muito errado. Para.
      return { status: "non-convergent", cycles: i, path, startMatches };
    }
    current = next;
    prevMatches = m;
  }
  return { status: "max-iterations", cycles: MAX_ITERATIONS, path, startMatches };
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const files = args.filter((a) => a !== "--dry-run");
  if (files.length === 0) {
    console.error("Uso: node scripts/fix-mojibake-loop.mjs [--dry-run] <arquivo>...");
    process.exit(1);
  }

  for (const f of files) {
    const r = processFile(f, { dryRun });
    if (r.status === "fixed") {
      console.log(`✓ ${f}: corrigido em ${r.cycles} ciclos (mojibake inicial: ${r.startMatches}) — backup em ${f}.bak`);
    } else if (r.status === "would-fix") {
      console.log(`~ ${f}: precisaria ${r.cycles} ciclos (mojibake inicial: ${r.startMatches})`);
    } else if (r.status === "clean") {
      console.log(`· ${f}: já estava limpo`);
    } else if (r.status === "no-pt-br") {
      console.log(`? ${f}: sem mojibake e sem acentos PT-BR (pode ser ASCII puro)`);
    } else if (r.status === "suspicious-clean") {
      console.log(`! ${f}: convergiu em ${r.cycles} ciclos mas não detectei acentos PT-BR — ver manualmente`);
    } else if (r.status === "non-convergent") {
      console.log(`✗ ${f}: não convergiu após ${r.cycles} ciclos (debug: ${JSON.stringify(r.path)})`);
    } else if (r.status === "max-iterations") {
      console.log(`✗ ${f}: atingiu MAX_ITERATIONS=${MAX_ITERATIONS} sem convergir`);
    } else if (r.status === "missing") {
      console.log(`✗ ${f}: arquivo não encontrado`);
    }
  }
}

main();
