import { Routes } from '@angular/router';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import * as minimist from 'minimist';
import { dirname, join } from 'path';

import { NgRouterResolver } from '../resolver';
import { renderHelp, renderVersion } from './help';

main(process.argv.slice(2));

function main(argv: string[]) {
  const command = minimist(argv, {
    alias: {
      v: 'version',
      h: 'help',
      o: 'out',
    }
  });

  if (command['version']) {
    console.log(renderVersion());
  } else if (command['help']) {
    console.log(renderHelp());
  } else {
    runRouterResolver(command._[0], command['out']);
  }
}

function runRouterResolver(modulePath: string, outFile?: string) {
  if (!modulePath) {
    throw Error(`Expected to have a module path, got '${modulePath}'`);
  }

  const moduleFile = join(process.cwd(), modulePath);

  console.log(`Resolving routes from module '${moduleFile}'...`);
  const routes = NgRouterResolver.fromModule(moduleFile);
  console.log('OK');

  if (outFile) {
    renderToFile(routes, outFile);
  } else {
    renderToStdout(routes);
  }
}

function renderToFile(routes: Routes, file: string) {
  file = join(process.cwd(), file);
  console.log(`Writing to file '${file}'...`);
  ensureDirectoryExistence(file);
  writeFileSync(file, JSON.stringify(routes, null, '  ') + '\n');
  console.log('OK');
}

function renderToStdout(routes: any) {
  console.log('\nDumping to stdout:\n');
  console.log(renderToString(routes));
}

function renderToString(obj: any, depth = 0): string {
  const prefixStr = ' '.repeat(depth * 2);
  const prefixStrD1 = prefixStr + '  ';
  const innerNewLiner = `,\n${prefixStrD1}`;

  if (Array.isArray(obj)) {
    return `[\n${prefixStrD1}` +
      obj.map(o => renderToString(o, depth + 1)).join(innerNewLiner) +
      `\n${prefixStr}]`;
  } else if (typeof obj === 'object') {
    return `{\n${prefixStrD1}` +
      Object.keys(obj).map(key => key + ': ' + renderToString(obj[key], depth + 1)).join(innerNewLiner) +
      `\n${prefixStr}}`;
  }
  return typeof obj === 'string' ? `"${obj}"` : String(obj);
}

function ensureDirectoryExistence(filePath: string) {
  const dirn = dirname(filePath);

  if (existsSync(dirn)) {
    return true;
  }

  ensureDirectoryExistence(dirn);
  mkdirSync(dirn);
}
