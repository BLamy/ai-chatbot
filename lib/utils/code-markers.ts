import { CodeLanguage } from '@/components/code-editor';

/**
 * CodeBlockInfo contains the cleaned code and the detected language
 */
export interface CodeBlockInfo {
  cleanedCode: string;
  language: CodeLanguage;
}

/**
 * Parse code content to extract language information from markdown code block markers
 * and remove the markers
 *
 * @param code The code content that might contain markdown code block markers
 * @returns Object with cleaned code and detected language
 */
export function parseCodeBlockMarkers(code: string): CodeBlockInfo {
  // Default to JavaScript if no language is detected
  let language: CodeLanguage = 'javascript';
  let cleanedCode = code;

  // Check if the code has markdown code block markers
  const codeBlockRegex = /^\s*```(\w*)\s*\n/;
  const match = code.match(codeBlockRegex);

  if (match) {
    // Extract the language and code content
    const langTag = match[1].toLowerCase().trim();
    cleanedCode = code.split('\n').slice(1, -1).join('\n');
    // Determine the language from the markdown tag
    if (langTag === 'python' || langTag === 'py') {
      language = 'python';
    } else if (langTag === 'typescript' || langTag === 'ts') {
      language = 'typescript';
    } else if (langTag === 'javascript' || langTag === 'js') {
      language = 'javascript';
    } else {
      // If no recognized language tag, use content-based detection
      language = detectLanguageFromContent(cleanedCode);
    }
  } else {
    // If no code block markers, detect based on content
    language = detectLanguageFromContent(code);
  }

  return { cleanedCode, language };
}

/**
 * Detect the language of code based on its content
 *
 * @param content The code content to analyze
 * @returns The detected language
 */
function detectLanguageFromContent(content: string): CodeLanguage {
  // Python detection
  if (
    content.includes('def ') ||
    content.includes('import ') ||
    content.includes('print(') ||
    content.includes('if __name__ == "__main__"')
  ) {
    return 'python';
  }

  // TypeScript detection
  if (
    content.includes(': string') ||
    content.includes(': number') ||
    content.includes(': boolean') ||
    content.includes('interface ') ||
    content.includes('type ') ||
    (content.includes('<') &&
      content.includes('>') &&
      content.includes('extends'))
  ) {
    return 'typescript';
  }

  // Default to JavaScript
  return 'javascript';
}
