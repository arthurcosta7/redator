"""
ocr_service.py — Serviço de OCR (extração de texto de imagens)

Usa Google Cloud Vision API para extrair texto de fotos de redações.

Segurança:
- A imagem é enviada diretamente para a API (não salva em disco)
- O texto extraído é sanitizado antes de usar
- Tamanho máximo validado antes de enviar para a API
"""
import re

from app.core.logging import get_logger

logger = get_logger(__name__)


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
        try:
            from google.cloud import vision

            # Cria cliente da Google Vision
            client = vision.ImageAnnotatorClient()

            # Cria objeto Image com os bytes
            image = vision.Image(content=image_bytes)

            # Solicita detecção de documento (melhor para textos longos/manuscritos)
            response = client.document_text_detection(image=image)

            if response.error.message:
                raise Exception(f"Google Vision API error: {response.error.message}")

            # Pega o texto completo detectado
            full_text = response.full_text_annotation.text

            if not full_text:
                return ""

            # Sanitiza e normaliza o texto extraído
            return self._sanitize_extracted_text(full_text)

        except ImportError:
            # Fallback se google-cloud-vision não estiver disponível
            logger.warning("google_vision_nao_disponivel_usando_fallback")
            return await self._fallback_ocr(image_bytes)

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
            result = result[:max_chars]
            logger.warning("texto_ocr_truncado", original_length=len(result))

        return result.strip()

    async def _fallback_ocr(self, image_bytes: bytes) -> str:
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
            return self._sanitize_extracted_text(text)

        except ImportError:
            raise Exception(
                "Serviço de OCR não está configurado. "
                "Configure as credenciais do Google Cloud Vision."
            )
        except Exception as e:
            raise Exception(f"Erro no processamento da imagem: {str(e)}")
