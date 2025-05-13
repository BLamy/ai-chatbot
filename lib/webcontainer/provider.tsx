'use client';

import { WebContainer } from '@webcontainer/api';
import React, { createContext, useContext, useState } from 'react';
import { WORK_DIR_NAME, DEFAULT_NODE_MODULES } from './constants';

interface WebContainerContext {
  loaded: boolean;
}

export const webcontainerContext: WebContainerContext = {
  loaded: false,
};

// Create a singleton promise for the WebContainer instance
let webcontainerInstance: Promise<WebContainer> | null = null;

/**
 * Get or create a WebContainer instance
 * We use a singleton pattern to ensure we only create one instance
 */
export function getWebContainer(): Promise<WebContainer> {
  if (typeof window === 'undefined') {
    // Return a dummy promise for SSR
    return new Promise(() => {
      /* noop for SSR */
    });
  }

  if (!webcontainerInstance) {
    webcontainerInstance = WebContainer.boot({
      workdirName: WORK_DIR_NAME,
    }).then(async (webcontainer) => {
      console.log('WebContainer booted, mounting files...');
      // Mount default files
      await webcontainer.mount(DEFAULT_NODE_MODULES);

      // Install TypeScript and ts-node
      console.log('Installing TypeScript dependencies...');
      try {
        const installProcess = await webcontainer.spawn('npm', [
          'install',
          'typescript',
          'ts-node',
          '--no-package-lock',
        ]);
        const installExitCode = await installProcess.exit;

        if (installExitCode !== 0) {
          console.error('Failed to install TypeScript dependencies');
        } else {
          console.log('TypeScript dependencies installed successfully');
        }
      } catch (error) {
        console.error('Error installing TypeScript dependencies:', error);
      }

      webcontainerContext.loaded = true;
      return webcontainer;
    });
  }

  return webcontainerInstance;
}

/**
 * Compiles TypeScript code to JavaScript using TSC
 * @param webcontainer WebContainer instance
 * @param tsCode TypeScript code to compile
 * @param filename Original TypeScript filename
 * @returns The JavaScript filename if successful, undefined if failed
 */
export async function compileTsWithTsc(
  webcontainer: WebContainer,
  tsCode: string,
  tsFilename: string,
): Promise<string | undefined> {
  try {
    console.log('Compiling TypeScript with tsc...');

    // Generate a JavaScript output filename
    const jsFilename = tsFilename.replace(/\.ts$/, '.js');

    // Write TypeScript code to file
    await webcontainer.fs.writeFile(tsFilename, tsCode);

    // Create a minimal tsconfig.json
    const tsconfig = {
      compilerOptions: {
        target: 'ES2020',
        module: 'CommonJS',
        esModuleInterop: true,
        skipLibCheck: true,
        noImplicitAny: false,
      },
    };

    await webcontainer.fs.writeFile('tsconfig.json', JSON.stringify(tsconfig));

    // Run tsc to compile the TypeScript file with all the options
    const tscProcess = await webcontainer.spawn('npx', [
      'tsc',
      tsFilename,
      '--outDir',
      '.',
      '--target',
      'ES2020',
      '--module',
      'CommonJS',
      '--esModuleInterop',
      '--skipLibCheck',
      '--noImplicitAny',
      'false',
    ]);

    // Capture compilation errors
    const errorChunks: string[] = [];
    tscProcess.output.pipeTo(
      new WritableStream({
        write(chunk) {
          errorChunks.push(chunk);
        },
      }),
    );

    const exitCode = await tscProcess.exit;

    if (exitCode !== 0) {
      const errorMessage = errorChunks.join('');
      console.error('TypeScript compilation failed:', errorMessage);

      // Return the JS filename anyway - we'll try to execute
      // because sometimes tsc reports errors but still generates usable JS
      try {
        await webcontainer.fs.readFile(jsFilename);
        console.log('JS file found despite errors, trying to run it anyway');
        return jsFilename;
      } catch (e) {
        return undefined;
      }
    }

    // Check if the compiled JS file exists
    try {
      await webcontainer.fs.readFile(jsFilename);
      console.log('TypeScript compilation successful:', jsFilename);
      return jsFilename;
    } catch (err) {
      console.error('Compiled JS file not found:', jsFilename);
      return undefined;
    }
  } catch (err) {
    console.error('Error during TypeScript compilation:', err);
    return undefined;
  }
}

/**
 * Execute TypeScript code with proper compilation
 */
export async function executeTypeScript(
  code: string,
): Promise<{ output: string; error?: string }> {
  try {
    console.log('Executing TypeScript with proper tsc compilation...');
    const webcontainer = await getWebContainer();

    // Create a TypeScript file with a unique name
    const timestamp = Date.now();
    const tsFilename = `code-${timestamp}.ts`;

    // Log TypeScript code for debugging
    console.log('TypeScript code to compile:');
    console.log('-------------------');
    console.log(code);
    console.log('-------------------');

    // Compile TypeScript to JavaScript
    const jsFilename = await compileTsWithTsc(webcontainer, code, tsFilename);

    if (!jsFilename) {
      return {
        output: '',
        error:
          'TypeScript compilation failed - could not generate JavaScript file',
      };
    }

    // Log the compiled JavaScript for debugging
    try {
      const jsCode = await webcontainer.fs.readFile(jsFilename, 'utf-8');
      console.log('Compiled JavaScript:');
      console.log('-------------------');
      console.log(jsCode);
      console.log('-------------------');
    } catch (err) {
      console.error('Could not read compiled JavaScript file:', err);
    }

    // Execute the compiled JavaScript
    console.log('Executing compiled JavaScript:', jsFilename);
    const process = await webcontainer.spawn('node', [jsFilename], {
      env: { NODE_DISABLE_COLORS: '1' },
    });

    // Capture stdout
    const outputChunks: string[] = [];
    process.output.pipeTo(
      new WritableStream({
        write(chunk) {
          outputChunks.push(chunk);
        },
      }),
    );

    // Wait for process to complete
    const exitCode = await process.exit;

    // Cleanup files
    await webcontainer.fs.rm(tsFilename).catch(() => {});
    await webcontainer.fs.rm(jsFilename).catch(() => {});

    // Get output
    const stdout = outputChunks.join('');

    if (exitCode !== 0) {
      return {
        output: stdout || '',
        error: 'Execution failed',
      };
    }

    return {
      output: stdout || 'Code executed successfully (no output)',
      error: undefined,
    };
  } catch (err) {
    console.error('Failed to execute TypeScript:', err);
    return {
      output: '',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Execute JavaScript/TypeScript code in the WebContainer
 * @param code The code to execute
 * @param language The language of the code (javascript/typescript)
 * @returns Promise with the execution result
 */
export async function executeJsCode(
  code: string,
): Promise<{ output: string; error?: string }> {
  // For JavaScript, execute directly with Node
  try {
    const webcontainer = await getWebContainer();

    // Create a JavaScript file with a unique name
    const timestamp = Date.now();
    const jsFilename = `code-${timestamp}.js`;

    // Write JavaScript code to file
    await webcontainer.fs.writeFile(jsFilename, code);

    // Execute with Node.js
    console.log('Executing JavaScript code...');
    const process = await webcontainer.spawn('node', [jsFilename], {
      env: { NODE_DISABLE_COLORS: '1' },
    });

    // Capture stdout
    const outputChunks: string[] = [];
    process.output.pipeTo(
      new WritableStream({
        write(chunk) {
          outputChunks.push(chunk);
        },
      }),
    );

    // Wait for process to complete
    const exitCode = await process.exit;

    // Cleanup
    await webcontainer.fs.rm(jsFilename).catch(() => {});

    // Get output
    const stdout = outputChunks.join('');

    if (exitCode !== 0) {
      return {
        output: stdout || '',
        error: 'Execution failed',
      };
    }

    return {
      output: stdout || 'Code executed successfully (no output)',
      error: undefined,
    };
  } catch (err) {
    console.error('Failed to execute JavaScript:', err);
    return {
      output: '',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
interface WebContainerContextType {
  loaded: boolean;
}

const WebContainerContext = createContext<WebContainerContextType>({
  loaded: false,
});

export const WebContainerProvider = ({
  children,
}: { children: React.ReactNode }) => {
  const [loaded, setLoaded] = useState(false);

  // Initialize WebContainer when the provider mounts
  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    // Set up WebContainer
    getWebContainer().then(() => {
      setLoaded(true);
    });
  }, []);

  return (
    <WebContainerContext.Provider value={{ loaded }}>
      {children}
    </WebContainerContext.Provider>
  );
};

export const useWebContainer = () => {
  return useContext(WebContainerContext);
};

export default WebContainerProvider;
