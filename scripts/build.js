const package = require('../package.json');
const { writeFileSync } = require('fs');

delete package.scripts;
delete package.devDependencies;

['main', 'typings'].forEach(path => package[path] = fixDistPath(package[path]));

writeFileSync('./dist/package.json', JSON.stringify(package, null, '  '));

function fixDistPath(path) {
  return path.replace('dist', '');
}
