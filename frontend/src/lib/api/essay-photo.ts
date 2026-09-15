import type { EssayType } from "@/types/essay";

type EssayPhotoPayload = {
  photo: File;
  essayType: EssayType;
  theme: string;
  title?: string;
};

/** Monta o multipart usando os mesmos nomes de campos do endpoint FastAPI. */
export function buildEssayPhotoFormData({
  photo,
  essayType,
  theme,
  title,
}: EssayPhotoPayload): FormData {
  const formData = new FormData();
  formData.append("photo", photo);
  formData.append("essay_type", essayType);
  formData.append("theme", theme.trim());

  const normalizedTitle = title?.trim();
  if (normalizedTitle) formData.append("title", normalizedTitle);

  return formData;
}
