"""
text_sanitizer.py — Sanitização de textos enviados pelo usuário

Previne:
- XSS: Remove tags HTML e scripts
- Caracteres de controle maliciosos
- Injeção via templates (SSTI)
"""
import re

import bleach


def sanitize_essay_text(text: str) -> str:
    """
    Sanitiza o texto de uma redação.

    Remove tags HTML, scripts e caracteres de controle.
    Preserva quebras de linha legítimas.
    """
    if not text:
        return ""

    # Remove tags HTML (bleach é seguro para isso)
    cleaned = bleach.clean(text, tags=[], strip=True)

    # Remove caracteres de controle (exceto \n e \t)
    cleaned = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", cleaned)

    # Remove sequências que poderiam ser templates maliciosos
    # Ex: {{7*7}}, ${7*7}, #{7*7}
    cleaned = re.sub(r"[{$#]\{.*?\}", "", cleaned)

    # Normaliza espaços: remove espaços duplicados em linhas
    lines = cleaned.splitlines()
    normalized = []
    for line in lines:
        # Remove espaços extras dentro da linha mas preserva a linha vazia
        normalized_line = re.sub(r" {2,}", " ", line.strip())
        normalized.append(normalized_line)

    return "\n".join(normalized).strip()


def sanitize_short_text(text: str, max_length: int = 500) -> str:
    """
    Sanitiza textos curtos (título, tema, nome).

    Mais restritivo — não permite nem quebras de linha.
    """
    if not text:
        return ""

    # Remove tags HTML
    cleaned = bleach.clean(text, tags=[], strip=True)

    # Remove quebras de linha e caracteres de controle
    cleaned = re.sub(r"[\x00-\x1f\x7f]", " ", cleaned)

    # Remove espaços extras
    cleaned = " ".join(cleaned.split())

    return cleaned[:max_length].strip()
