const MAX_CHUNK = 14000;
const MAX_PAPER = 180000;

export function splitPaperText(input: string): string[] {
  const text = input.trim();
  if (text.length < 20) throw new Error('Cole o texto da prova antes de importar.');
  if (text.length > MAX_PAPER) throw new Error('O texto excede 180 mil caracteres. Divida a prova em duas importações.');
  const paragraphs = text.split(/(?=\n\s*(?:QUEST(?:Ã|A)O\s*\d{1,3}|\d{1,3}\s*[.)-]\s))/i);
  const chunks: string[] = [];
  let current = '';
  let questionCount = 0;
  for (const paragraph of paragraphs) {
    if (paragraph.length > MAX_CHUNK) {
      throw new Error('Há um trecho com mais de 14 mil caracteres sem início de questão identificado. Separe esse trecho manualmente para evitar cortar uma questão ao meio.');
    }
    const beginsQuestion = /^\n\s*(?:QUEST(?:Ã|A)O\s*\d{1,3}|\d{1,3}\s*[.)-]\s)/i.test(paragraph);
    if ((current.length + paragraph.length > MAX_CHUNK || questionCount >= 20) && current.trim()) {
      chunks.push(current.trim());
      current = '';
      questionCount = 0;
    }
    current += paragraph;
    if (beginsQuestion) questionCount++;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}
