// Bundled into vendor/codemirror/cm.bundle.js (ESM). Everything the editor + docs need from CodeMirror 6.
export { EditorState, Compartment, StateEffect, StateField, Prec, Annotation } from '@codemirror/state';
export { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection,
  dropCursor, rectangularSelection, crosshairCursor, highlightSpecialChars, placeholder, tooltips, hoverTooltip,
  gutter, GutterMarker, Decoration, ViewPlugin, WidgetType } from '@codemirror/view';
export { defaultKeymap, history, historyKeymap, indentWithTab, undo, redo, toggleComment } from '@codemirror/commands';
export { searchKeymap, highlightSelectionMatches, openSearchPanel, selectNextOccurrence } from '@codemirror/search';
export { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap, completeFromList, snippetCompletion } from '@codemirror/autocomplete';
export { lintGutter, linter, lintKeymap, setDiagnostics } from '@codemirror/lint';
export { syntaxHighlighting, defaultHighlightStyle, HighlightStyle, indentOnInput, bracketMatching, foldGutter,
  foldKeymap, StreamLanguage, LanguageSupport, syntaxTree, indentUnit } from '@codemirror/language';
export { tags } from '@lezer/highlight';
export { oneDark } from '@codemirror/theme-one-dark';
export { javascript, javascriptLanguage, esLint } from '@codemirror/lang-javascript';
export { html } from '@codemirror/lang-html';
export { css } from '@codemirror/lang-css';
export { json, jsonParseLinter } from '@codemirror/lang-json';
export { markdown } from '@codemirror/lang-markdown';
export { rust } from '@codemirror/lang-rust';
import { shader } from '@codemirror/legacy-modes/mode/clike';
import { toml } from '@codemirror/legacy-modes/mode/toml';
import { StreamLanguage } from '@codemirror/language';
export const glsl = () => StreamLanguage.define(shader);
export const tomlLang = () => StreamLanguage.define(toml);
