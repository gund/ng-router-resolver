# ng-router-resolver

> Resolve routes from Angular Module statically

This project is aimed to be used as a cli/programmatic tool with Angular projects
to statically analyze routes in `NgModules` and do some useful stuff with it.

As a use case you might want to generate some rules for ServiceWorker based on routes
to add some offline/cache capabilities to any Angular application.

## Installation

```bash
$ npm install --save-dev ng-router-resolver
```

## Usage

It parses given Angular TS module and collects all routes including lazy-routes.

It does not run your Angular app on the server but statically analyzes your code via AST.

### Programmatic

```ts
import { NgRouterResolver } from '../src/resolver';

const routes = NgRouterResolver.fromModule('./src/app/app.module.ts');
```

It will return an array of type same as `Route` from `@angular/route` package.

### CLI

**TBD**

Syntax will be something like this:

```bash
$ ng-router-resolver src/app/app.module.ts                    // Prints json into stdout
$ ng-router-resolver src/app/app.module.ts --out routes.json  // Prints json into specified file
```

## Next Steps

- ~~Collect children routes~~ [DONE]
- ~~Collect lazy routes from other modules~~ [DONE]
- ~~Support Identifiers in routes configuration~~ [DONE]
- ~~Support Spread operators in routes configuration~~ [DONE]
- ~~Collect routes from other impoted modules~~ [DONE]
- ~~Organize internal code structure to transition from POC to some stable version~~ [DONE]
- Create a CLI for resolving routes and dumping them as JSON structure into file
- Add unit tests with coverage at least 75%
- Integrate with TravisCI and Codecov
- Integrate semantic-release to enable CD

## License

MIT © [Alex Malkevich](malkevich.alex@gmail.com)
