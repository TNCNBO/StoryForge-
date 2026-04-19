export function countWords(text: string): number {
  return text.replace(/\s/g, '').length
}

export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
}
