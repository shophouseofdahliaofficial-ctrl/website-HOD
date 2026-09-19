import { photobookApi } from '@/lib/api/photobook';
import { generatePhotobookPrintPdfFromProjectJson } from '@/lib/photobook/offscreenPrint';
import type { PhotobookProjectJson } from '@/lib/photobook/projectTypes';

export async function finalizePhotobookProjectsAfterPayment(projectIds: string[]): Promise<void> {
  const uniqueIds = [...new Set(projectIds.filter(Boolean))];
  for (const projectId of uniqueIds) {
    try {
      const project = await photobookApi.getProject(projectId);
      if (project.generatedPdfUrl) continue;

      const json = project.projectJson as PhotobookProjectJson;
      const pdf = await generatePhotobookPrintPdfFromProjectJson(json);
      await photobookApi.finalizeWithPdf(projectId, pdf);
    } catch (err) {
      console.error('[photobook] Failed to finalize project after payment:', projectId, err);
    }
  }
}

export function collectPhotobookProjectIdsFromCart(
  items: Array<{ customizations?: { photobookProject?: { projectId?: string } } }>,
): string[] {
  return items
    .map((it) => it.customizations?.photobookProject?.projectId)
    .filter((id): id is string => !!id);
}
