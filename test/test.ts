import { join } from 'path';

import { NgRouterResolver } from '../src/resolver';

const startTime = Date.now();

main()
  .then(() => Date.now())
  .then(endTime => console.log(`Done in ${endTime - startTime}ms`))
  .catch(e => {
    console.error(e);
    process.exit(1);
  });

async function main() {
  const file = join(__dirname, '../../test/test.module.ts');
  NgRouterResolver.fromModule(file).forEach(r => console.log(r));
}
