import {
  getDocument,
  GlobalWorkerOptions,
  type PDFDocumentProxy,
} from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = workerSrc;

export const MAX_PDF_SIZE_BYTES = 20 * 1024 * 1024;
export const MAX_PDF_PAGES = 80;
export const MAX_PDF_TEXT_CHARACTERS = 120_000;

export interface PdfExtractionResult {
  text: string;
  pageCount: number;
  pagesWithText: number;
}

export interface PdfExtractionProgress {
  currentPage: number;
  totalPages: number;
}

const isPdfFile = (file: File): boolean => {
  const fileName = file.name.toLowerCase();
  return file.type === 'application/pdf' || fileName.endsWith('.pdf');
};

/**
 * Extracts selectable text from a PDF in the browser.
 *
 * The file is never persisted by this helper. Only the extracted text is sent
 * to the generation endpoint after the user submits the form.
 */
export const extractTextFromPdf = async (
  file: File,
  onProgress?: (progress: PdfExtractionProgress) => void,
): Promise<PdfExtractionResult> => {
  if (!isPdfFile(file)) {
    throw new Error('Selecione um arquivo no formato PDF.');
  }

  if (file.size === 0) {
    throw new Error('O PDF selecionado está vazio.');
  }

  if (file.size > MAX_PDF_SIZE_BYTES) {
    throw new Error('O PDF deve ter no máximo 20 MB. Para arquivos maiores, divida o material em partes.');
  }

  let pdf: PDFDocumentProxy | undefined;

  try {
    const fileData = new Uint8Array(await file.arrayBuffer());
    pdf = await getDocument({ data: fileData }).promise;

    if (pdf.numPages > MAX_PDF_PAGES) {
      throw new Error(`O PDF tem ${pdf.numPages} páginas. No momento, o limite é de ${MAX_PDF_PAGES} páginas por material.`);
    }

    const pageTexts: string[] = [];
    let pagesWithText = 0;

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      onProgress?.({ currentPage: pageNumber, totalPages: pdf.numPages });

      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item) => ('str' in item ? item.str : ''))
        .filter(Boolean)
        .join(' ')
        .replace(/[ \t]+/g, ' ')
        .trim();

      if (pageText) {
        pagesWithText += 1;
        pageTexts.push(`Página ${pageNumber}\n${pageText}`);
      }

      const extractedCharacters = pageTexts.join('\n\n').length;
      if (extractedCharacters > MAX_PDF_TEXT_CHARACTERS) {
        throw new Error('O texto extraído ultrapassa o limite de 120 mil caracteres. Divida o PDF em partes menores para manter as questões fiéis ao material.');
      }
    }

    const text = pageTexts.join('\n\n').trim();

    if (!text) {
      throw new Error('Não foi possível encontrar texto selecionável neste PDF. Se ele for escaneado, envie uma versão com OCR ou um PDF com texto pesquisável.');
    }

    return {
      text,
      pageCount: pdf.numPages,
      pagesWithText,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }

    throw new Error('Não foi possível ler este PDF. Tente abrir o arquivo e salvá-lo novamente antes de enviá-lo.');
  } finally {
    await pdf?.destroy();
  }
};

export const formatPdfSize = (sizeInBytes: number): string => {
  if (sizeInBytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(sizeInBytes / 1024))} KB`;
  }

  return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
};
