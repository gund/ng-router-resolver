import { readFileSync } from 'fs';
import { join } from 'path';

const { version, name, homepage } = require('../package.json');

export function renderVersion(): string {
  return `v${version}`;
}

export function renderHelp(): string {
  const helpStr = readFileSync(join(__dirname, 'help.md'), 'utf-8');

  return helpStr
    .replace('__NAME__', name)
    .replace('__VERSION__', version)
    .replace('__WIKI__', homepage);
}
