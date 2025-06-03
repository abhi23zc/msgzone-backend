export function htmlToWhatsapp(html) {
  if (typeof html !== 'string') return '';
  
  // Step 1: Basic HTML tag conversion
  let text = html
    // Bold/Strong
    .replace(/<(strong|b)>(.*?)<\/\1>/gi, '*$2*')
    // Italic/Emphasis
    .replace(/<(em|i)>(.*?)<\/\1>/gi, '_$2_')
    // Strikethrough
    .replace(/<(del|s)>(.*?)<\/\1>/gi, '~$2~')
    // Monospace/Code
    .replace(/<(code|pre)>(.*?)<\/\1>/gi, '```$2```')
    // Line breaks
    .replace(/<br\s*\/?>/gi, '\n')
    // Paragraphs and divs
    .replace(/<(p|div)>(.*?)<\/\1>/gi, '\n$2\n')
    // List items
    .replace(/<li>(.*?)<\/li>/gi, '\n• $1');

  // Step 2: Remove all remaining HTML tags
  text = text.replace(/<[^>]*>/g, '');

  // Step 3: Clean up whitespace and formatting
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
    .replace(/(\*\*|__)/g, '*') // Fix double markers
    .trim();
}