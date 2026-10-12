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
// More languages for the desktop code editor example (PHP, Python, XML/SVG, SQL + legacy stream modes)
export { php } from '@codemirror/lang-php';
export { python } from '@codemirror/lang-python';
export { xml } from '@codemirror/lang-xml';
export { sql } from '@codemirror/lang-sql';
import { c, cpp, csharp, java, kotlin, scala, objectiveC, dart } from '@codemirror/legacy-modes/mode/clike';
import { go } from '@codemirror/legacy-modes/mode/go';
import { shell } from '@codemirror/legacy-modes/mode/shell';
import { ruby } from '@codemirror/legacy-modes/mode/ruby';
import { lua } from '@codemirror/legacy-modes/mode/lua';
import { swift } from '@codemirror/legacy-modes/mode/swift';
import { yaml } from '@codemirror/legacy-modes/mode/yaml';
import { perl } from '@codemirror/legacy-modes/mode/perl';
import { dockerFile } from '@codemirror/legacy-modes/mode/dockerfile';
import { diff } from '@codemirror/legacy-modes/mode/diff';
const S = (m) => () => StreamLanguage.define(m);
export const legacy = { c: S(c), cpp: S(cpp), csharp: S(csharp), java: S(java), kotlin: S(kotlin), scala: S(scala), objc: S(objectiveC), dart: S(dart),
  go: S(go), shell: S(shell), ruby: S(ruby), lua: S(lua), swift: S(swift), yaml: S(yaml), perl: S(perl), dockerfile: S(dockerFile), diff: S(diff) };
