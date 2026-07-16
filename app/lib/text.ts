export function getExcerpt(text: string, sentenceCount = 2): string {
  const sentences = text.match(/[^.!?]+[.!?]+/g);
  if (!sentences || sentences.length === 0) return text;
  return sentences.slice(0, sentenceCount).join(' ').trim();
}
