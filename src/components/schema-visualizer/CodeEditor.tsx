'use client';

import React from 'react';
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/themes/prism-tomorrow.css';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function CodeEditor({ value, onChange, placeholder, className = '' }: CodeEditorProps) {
  return (
    <div className={`w-full h-full overflow-auto scrollbar-hide ${className}`}>
      <Editor
        value={value}
        onValueChange={onChange}
        highlight={(code) => highlight(code, languages.typescript, 'typescript')}
        placeholder={placeholder}
        padding={16}
        className="font-mono text-sm leading-6 w-full"
        style={{
          fontFamily: 'var(--font-geist-mono), monospace',
          fontSize: '14px',
          lineHeight: '1.5',
          outline: 'none',
          minHeight: '100%',
        }}
        textareaClassName="outline-none resize-none"
      />
    </div>
  );
}