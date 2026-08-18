"""
ocr_service.py — Serviço de OCR (extração de texto de imagens)

Usa Google Cloud Vision API para extrair texto de fotos de redações.

Segurança:
- A imagem é enviada diretamente para a API (não salva em disco)
- O texto extraído é sanitizado antes de usar
- Tamanho máximo validado antes de enviar para a API
"""
import asyncio
import re

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)
_ocr_slots = asyncio.Semaphore(settings.OCR_MAX_CONCURRENCY)


class OCRService:
    """
    Serviço de extração de texto de imagens usando Google Cloud Vision.

    Como funciona:
    1. Recebe os bytes da imagem
    2. Envia para a Google Cloud Vision API
    3. Recebe o texto extraído
    4. Sanitiza e normaliza o texto
    5. Retorna o texto limpo
    """

    async def extract_text(self, image_bytes: bytes) -> str:
        """
        Extrai texto de uma imagem.

        Args:
            image_bytes: Conteúdo da imagem em bytes

        Returns:
            Texto extraído e sanitizado

        Raises:
            Exception: Se a API falhar ou não conseguir extrair texto
        """
        async with _ocr_slots:
            async with asyncio.timeout(settings.OCR_TIMEOUT_SECONDS):
                try:
                    full_text = await asyncio.to_thread(self._google_ocr_sync, image_bytes)
                except ImportError:
                    logger.warning("google_vision_nao_disponivel_usando_fallback")
                    full_text = await asyncio.to_thread(self._fallback_ocr_sync, image_bytes)

        return self._sanitize_extracted_text(full_text) if full_text else ""

    @staticmethod
    def _google_ocr_sync(image_bytes: bytes) -> str:
        """Executa o SDK síncrono fora do event loop do FastAPI."""
        from google.cloud import vision

        client = vision.ImageAnnotatorClient()
        response = client.document_text_detection(image=vision.Image(content=image_bytes))
        if response.error.message:
            raise RuntimeError("Google Vision não conseguiu processar a imagem")
        return str(response.full_text_annotation.text)

    def _sanitize_extracted_text(self, text: str) -> str:
        """
        Limpa e normaliza o texto extraído pelo OCR.

        OCR pode extrair:
        - Caracteres de controle indesejados
        - Espaços duplicados
        - Quebras de linha extras
        """
        if not text:
            return ""

        # Remove caracteres de controle (exceto \n e \t)
        text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)

        # Normaliza quebras de linha (remove linhas com apenas espaços)
        lines = text.splitlines()
        cleaned_lines = []

        for line in lines:
            stripped = line.strip()
            if stripped:
                cleaned_lines.append(stripped)

        # Reconstrói o texto com parágrafos (2 quebras de linha = novo parágrafo)
        result = "\n".join(cleaned_lines)

        # Remove espaços duplicados dentro de linhas
        result = re.sub(r" {2,}", " ", result)

        # Limita tamanho (segurança: não processa textos gigantes)
        max_chars = 15000  # ~3x o máximo de uma redação
        if len(result) > max_chars:
            original_length = len(result)
            result = result[:max_chars]
            logger.warning("texto_ocr_truncado", original_length=original_length)

        return result.strip()

    @staticmethod
    def _fallback_ocr_sync(image_bytes: bytes) -> str:
        """
        Fallback OCR usando Tesseract (open source, menos preciso).

        Usado quando Google Cloud Vision não está disponível.
        Requer: pip install pytesseract e Tesseract instalado no sistema.
        """
        try:
            import io

            import pytesseract
            from PIL import Image

            image = Image.open(io.BytesIO(image_bytes))

            # Configuração para português
            text = pytesseract.image_to_string(
                image,
                lang="por",  # Português
                config="--psm 3",  # Modo automático de segmentação
            )
            return str(text)

        except ImportError:
            raise Exception(
                "Serviço de OCR não está configurado. "
                "Configure as credenciais do Google Cloud Vision."
            )
        except Exception as e:
            raise Exception(f"Erro no processamento da imagem: {str(e)}")
