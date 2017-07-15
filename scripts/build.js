const copyfiles = require('copyfiles');
const package = require('../package.json');
const { writeFileSync } = require('fs');

delete package.scripts;
delete package.devDependencies;

['main', 'typings'].forEach(path => package[path] = fixDistPath(package[path]));

writeFileSync('dist/package.json', JSON.stringify(package, null, '  '));
console.log('package.json was written to dist');

copyfiles([
  'LICENCE',
  'README.md',
  'src/bin/help.md',
  'dist' // Destination folder
], {}, () => null);

copyfiles([
  'src/bin/help.md',
  'dist' // Destination folder
], { '--up': 1, up: 1 }, () => null);
console.log('Additional files were copied to dist');

function fixDistPath(path) {
  return path.replace('dist', '');
}
