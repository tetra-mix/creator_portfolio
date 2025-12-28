let current: string[] = [];

export function setBookContent(newContent: string[]): void {
  current = Array.isArray(newContent) ? newContent.slice() : [];
}

export function getBookContent(): string[] {
  return current;
}
