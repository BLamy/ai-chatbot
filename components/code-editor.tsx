'use client';

import { EditorView } from '@codemirror/view';
import { EditorState, Transaction } from '@codemirror/state';
import { python } from '@codemirror/lang-python';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import { basicSetup } from 'codemirror';
import React, { memo, useEffect, useRef, useMemo } from 'react';
import type { Suggestion } from '@/lib/db/schema';

export type CodeLanguage = 'python' | 'javascript' | 'typescript';

type EditorProps = {
  content: string;
  onSaveContent: (updatedContent: string, debounce: boolean) => void;
  status: 'streaming' | 'idle';
  isCurrentVersion: boolean;
  currentVersionIndex: number;
  suggestions: Array<Suggestion>;
  language?: CodeLanguage;
};

function detectLanguage(content: string): CodeLanguage {
  // Simple language detection based on content
  if (
    content.includes('def ') ||
    content.includes('import ') ||
    content.includes('print(')
  ) {
    return 'python';
  }

  // Check for TypeScript-specific syntax
  if (
    content.includes(': ') ||
    content.includes('interface ') ||
    (content.includes('<') && content.includes('>'))
  ) {
    return 'typescript';
  }

  // Default to JavaScript
  return 'javascript';
}

function getLanguageExtension(language: CodeLanguage) {
  switch (language) {
    case 'python':
      return python();
    case 'typescript':
      return javascript({ typescript: true });
    case 'javascript':
    default:
      return javascript();
  }
}

function PureCodeEditor({
  content,
  onSaveContent,
  status,
  language,
}: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorView | null>(null);

  const detectedLanguage = useMemo(() => {
    return language || detectLanguage(content);
  }, [content, language]);

  useEffect(() => {
    if (containerRef.current && !editorRef.current) {
      const startState = EditorState.create({
        doc: content,
        extensions: [
          basicSetup,
          getLanguageExtension(detectedLanguage),
          oneDark,
        ],
      });

      editorRef.current = new EditorView({
        state: startState,
        parent: containerRef.current,
      });
    }

    return () => {
      if (editorRef.current) {
        editorRef.current.destroy();
        editorRef.current = null;
      }
    };
    // NOTE: we only want to run this effect once
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (editorRef.current) {
      const updateListener = EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const transaction = update.transactions.find(
            (tr) => !tr.annotation(Transaction.remote),
          );

          if (transaction) {
            const newContent = update.state.doc.toString();
            onSaveContent(newContent, true);
          }
        }
      });

      const currentSelection = editorRef.current.state.selection;

      const newState = EditorState.create({
        doc: editorRef.current.state.doc,
        extensions: [
          basicSetup,
          getLanguageExtension(detectedLanguage),
          oneDark,
          updateListener,
        ],
        selection: currentSelection,
      });

      editorRef.current.setState(newState);
    }
  }, [onSaveContent, detectedLanguage]);

  useEffect(() => {
    if (editorRef.current && content) {
      const currentContent = editorRef.current.state.doc.toString();

      if (status === 'streaming' || currentContent !== content) {
        const transaction = editorRef.current.state.update({
          changes: {
            from: 0,
            to: currentContent.length,
            insert: content,
          },
          annotations: [Transaction.remote.of(true)],
        });

        editorRef.current.dispatch(transaction);
      }
    }
  }, [content, status]);

  return (
    <div
      className="relative not-prose w-full pb-[calc(80dvh)] text-sm"
      ref={containerRef}
    />
  );
}

function areEqual(prevProps: EditorProps, nextProps: EditorProps) {
  if (prevProps.suggestions !== nextProps.suggestions) return false;
  if (prevProps.currentVersionIndex !== nextProps.currentVersionIndex)
    return false;
  if (prevProps.isCurrentVersion !== nextProps.isCurrentVersion) return false;
  if (prevProps.status === 'streaming' && nextProps.status === 'streaming')
    return false;
  if (prevProps.content !== nextProps.content) return false;
  if (prevProps.language !== nextProps.language) return false;

  return true;
}

export const CodeEditor = memo(PureCodeEditor, areEqual);
