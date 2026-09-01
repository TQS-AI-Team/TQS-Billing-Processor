// Pulls named function declarations (and simple const arrow helpers) out of
// public/index.html so tests can exercise the SHIPPED code rather than a copy.
import { readFileSync } from 'node:fs';

const SRC = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');

function grabFunction(name){
  const at = SRC.indexOf(`function ${name}(`);
  if(at === -1) throw new Error(`function ${name} not found in public/index.html`);
  let i = SRC.indexOf('{', at), depth = 0;
  for(; i < SRC.length; i++){
    const c = SRC[i];
    if(c === '{') depth++;
    else if(c === '}'){ depth--; if(depth === 0) return SRC.slice(at, i + 1); }
  }
  throw new Error(`unbalanced braces reading ${name}`);
}

function grabConstLine(name){
  const re = new RegExp(`^const ${name}\\s*=.*$`, 'm');
  const m = SRC.match(re);
  if(!m) throw new Error(`const ${name} not found in public/index.html`);
  return m[0];
}

// Builds a module-like scope containing the requested helpers plus whatever
// globals the caller supplies (DB, document stubs, ...).
export function loadHelpers({ functions = [], consts = [], globals = {} } = {}){
  const body = [
    ...consts.map(grabConstLine),
    ...functions.map(grabFunction),
    `return {${[...functions, ...consts].join(',')}};`,
  ].join('\n');
  const names = Object.keys(globals);
  return new Function(...names, body)(...names.map(n => globals[n]));
}
