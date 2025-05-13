import { Artifact } from '@/components/create-artifact';
import { CodeEditor, type CodeLanguage } from '@/components/code-editor';
import {
  CopyIcon,
  LogsIcon,
  MessageIcon,
  PlayIcon,
  RedoIcon,
  UndoIcon,
} from '@/components/icons';
import { toast } from 'sonner';
import { generateUUID } from '@/lib/utils';
import {
  Console,
  type ConsoleOutput,
  type ConsoleOutputContent,
} from '@/components/console';
import { parseCodeBlockMarkers } from '@/lib/utils/code-markers';

const OUTPUT_HANDLERS = {
  matplotlib: `
    import io
    import base64
    from matplotlib import pyplot as plt

    # Clear any existing plots
    plt.clf()
    plt.close('all')

    # Switch to agg backend
    plt.switch_backend('agg')

    def setup_matplotlib_output():
        def custom_show():
            if plt.gcf().get_size_inches().prod() * plt.gcf().dpi ** 2 > 25_000_000:
                print("Warning: Plot size too large, reducing quality")
                plt.gcf().set_dpi(100)

            png_buf = io.BytesIO()
            plt.savefig(png_buf, format='png')
            png_buf.seek(0)
            png_base64 = base64.b64encode(png_buf.read()).decode('utf-8')
            print(f'data:image/png;base64,{png_base64}')
            png_buf.close()

            plt.clf()
            plt.close('all')

        plt.show = custom_show
  `,
  basic: `
    # Basic output capture setup
  `,
};

function detectRequiredHandlers(code: string): string[] {
  const handlers: string[] = ['basic'];

  if (code.includes('matplotlib') || code.includes('plt.')) {
    handlers.push('matplotlib');
  }

  return handlers;
}

interface Metadata {
  outputs: Array<ConsoleOutput>;
  language: CodeLanguage;
}

// Direct executor function for JavaScript and TypeScript
async function executeJsOrTs(
  code: string,
  language: CodeLanguage,
): Promise<{
  output: string;
  error?: string;
}> {
  try {
    // Load the WebContainer module dynamically to avoid React hook issues
    const webcontainerModule = await import('@/lib/webcontainer/provider');
    if (language === 'typescript') {
      return await webcontainerModule.executeTypeScript(code);
    }
    return await webcontainerModule.executeJsCode(code);
  } catch (err) {
    console.error('Error executing JS/TS code:', err);
    return {
      output: '',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export const codeArtifact = new Artifact<'code', Metadata>({
  kind: 'code',
  description:
    'Useful for code generation; Supports execution of Python, JavaScript, and TypeScript code.',
  initialize: async ({ setMetadata }) => {
    // Parse the initial content to extract language and clean code
    setMetadata({
      outputs: [],
      language: 'javascript',
    });
  },
  onStreamPart: ({ streamPart, setArtifact, setMetadata }) => {
    if (streamPart.type === 'code-delta') {
      const rawContent = streamPart.content as string;

      // Parse content to extract language and clean code
      const { cleanedCode, language } = parseCodeBlockMarkers(rawContent);

      setArtifact((draftArtifact) => ({
        ...draftArtifact,
        // Store the cleaned code for display
        content: cleanedCode,
        isVisible:
          draftArtifact.status === 'streaming' &&
          cleanedCode.length > 300 &&
          cleanedCode.length < 310
            ? true
            : draftArtifact.isVisible,
        status: 'streaming',
      }));

      // Update language based on the parsed info
      setMetadata((metadata) => ({
        ...metadata,
        language,
      }));
    }
  },
  content: ({ metadata, setMetadata, content, ...props }) => {
    // Language should already be determined and stored in metadata
    const { cleanedCode, language } = parseCodeBlockMarkers(content || '');

    return (
      <>
        <div className="relative px-1">
          <div className="absolute top-2 right-3 z-10 text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground opacity-70">
            {language === 'python'
              ? 'Python'
              : language === 'typescript'
                ? 'TypeScript'
                : 'JavaScript'}
          </div>
          <CodeEditor {...props} content={cleanedCode} language={language} />
        </div>

        {metadata?.outputs && (
          <Console
            consoleOutputs={metadata.outputs}
            setConsoleOutputs={() => {
              setMetadata({
                ...metadata,
                outputs: [],
              });
            }}
          />
        )}
      </>
    );
  },
  actions: [
    {
      icon: <PlayIcon size={18} />,
      label: 'Run',
      description: ({ content }) => {
        const language = parseCodeBlockMarkers(content).language;
        if (language === 'python') return 'Execute Python code';
        if (language === 'javascript') return 'Execute JavaScript code';
        if (language === 'typescript') return 'Execute TypeScript code';
        return 'Execute code';
      },
      isDisabled: ({ content }) => {
        // Enable Run button for Python, JavaScript, and TypeScript
        const language = parseCodeBlockMarkers(content).language;
        return !['python', 'javascript', 'typescript'].includes(language);
      },
      onClick: async ({ content, setMetadata, metadata }) => {
        const runId = generateUUID();
        const outputContent: Array<ConsoleOutputContent> = [];
        const { cleanedCode, language } = parseCodeBlockMarkers(content);

        setMetadata((metadata) => ({
          ...metadata,
          outputs: [
            ...metadata.outputs,
            {
              id: runId,
              contents: [],
              status: 'in_progress',
            },
          ],
        }));

        try {
          // Execute JavaScript or TypeScript code with WebContainer
          if (language === 'javascript' || language === 'typescript') {
            setMetadata((metadata) => ({
              ...metadata,
              outputs: [
                ...metadata.outputs.filter((output) => output.id !== runId),
                {
                  id: runId,
                  contents: [
                    {
                      type: 'text',
                      value: 'Running JavaScript in WebContainer...',
                    },
                  ],
                  status: 'loading_packages',
                },
              ],
            }));

            // Execute with our direct function
            setMetadata((metadata) => ({
              ...metadata,
              outputs: [
                ...metadata.outputs.filter((output) => output.id !== runId),
                {
                  id: runId,
                  contents: [
                    {
                      type: 'text',
                      value: `Running ${language === 'typescript' ? 'TypeScript' : 'JavaScript'} code...`,
                    },
                  ],
                  status: 'loading_packages',
                },
              ],
            }));

            const { output, error } = await executeJsOrTs(
              cleanedCode,
              language,
            );

            const success = !error;

            setMetadata((metadata) => ({
              ...metadata,
              outputs: [
                ...metadata.outputs.filter((output) => output.id !== runId),
                {
                  id: runId,
                  contents: [
                    {
                      type: 'text',
                      value: error
                        ? `Error: ${error}`
                        : output || 'Code executed successfully with no output',
                    },
                  ],
                  status: success ? 'completed' : 'failed',
                },
              ],
            }));

            return;
          }

          // Execute Python code with Pyodide
          // @ts-expect-error - loadPyodide is not defined
          const currentPyodideInstance = await globalThis.loadPyodide({
            indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.23.4/full/',
          });

          currentPyodideInstance.setStdout({
            batched: (output: string) => {
              outputContent.push({
                type: output.startsWith('data:image/png;base64')
                  ? 'image'
                  : 'text',
                value: output,
              });
            },
          });

          await currentPyodideInstance.loadPackagesFromImports(content, {
            messageCallback: (message: string) => {
              setMetadata((metadata) => ({
                ...metadata,
                outputs: [
                  ...metadata.outputs.filter((output) => output.id !== runId),
                  {
                    id: runId,
                    contents: [{ type: 'text', value: message }],
                    status: 'loading_packages',
                  },
                ],
              }));
            },
          });

          const requiredHandlers = detectRequiredHandlers(content);
          for (const handler of requiredHandlers) {
            if (OUTPUT_HANDLERS[handler as keyof typeof OUTPUT_HANDLERS]) {
              await currentPyodideInstance.runPythonAsync(
                OUTPUT_HANDLERS[handler as keyof typeof OUTPUT_HANDLERS],
              );

              if (handler === 'matplotlib') {
                await currentPyodideInstance.runPythonAsync(
                  'setup_matplotlib_output()',
                );
              }
            }
          }
          await currentPyodideInstance.runPythonAsync(cleanedCode);

          setMetadata((metadata) => ({
            ...metadata,
            outputs: [
              ...metadata.outputs.filter((output) => output.id !== runId),
              {
                id: runId,
                contents: outputContent,
                status: 'completed',
              },
            ],
          }));
        } catch (error: any) {
          setMetadata((metadata) => ({
            ...metadata,
            outputs: [
              ...metadata.outputs.filter((output) => output.id !== runId),
              {
                id: runId,
                contents: [{ type: 'text', value: error.message }],
                status: 'failed',
              },
            ],
          }));
        }
      },
    },
    {
      icon: <UndoIcon size={18} />,
      description: 'View Previous version',
      onClick: ({ handleVersionChange }) => {
        handleVersionChange('prev');
      },
      isDisabled: ({ currentVersionIndex }) => {
        if (currentVersionIndex === 0) {
          return true;
        }

        return false;
      },
    },
    {
      icon: <RedoIcon size={18} />,
      description: 'View Next version',
      onClick: ({ handleVersionChange }) => {
        handleVersionChange('next');
      },
      isDisabled: ({ isCurrentVersion }) => {
        if (isCurrentVersion) {
          return true;
        }

        return false;
      },
    },
    {
      icon: <CopyIcon size={18} />,
      description: 'Copy code to clipboard',
      onClick: ({ content }) => {
        navigator.clipboard.writeText(content);
        toast.success('Copied to clipboard!');
      },
    },
  ],
  toolbar: [
    {
      icon: <MessageIcon />,
      description: 'Add comments',
      onClick: ({ appendMessage }) => {
        appendMessage({
          role: 'user',
          content: 'Add comments to the code snippet for understanding',
        });
      },
    },
    {
      icon: <LogsIcon />,
      description: 'Add logs',
      onClick: ({ appendMessage }) => {
        appendMessage({
          role: 'user',
          content: 'Add logs to the code snippet for debugging',
        });
      },
    },
  ],
});
