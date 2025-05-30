export function richTextToPlainText(data: ReadonlyArray<{ plain_text: string }> | undefined): string {
  if (!Array.isArray(data) || data.length === 0) return '';
  return data.map((text) => text.plain_text).join('');
}