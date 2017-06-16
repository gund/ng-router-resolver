# ng-router-resolver

> Resolve routes from Angular Module

_Now in POC stage, PRs are welcome!_

This project is aimed to be used as a cli/programmatic tool with Angular projects
to statically analyze routes in `NgModules` and do some useful stuff with it.

As a use case you might want to generate some rules for ServiceWorker based on routes
to add some offline/cache capabilities to any Angular application.

## Current State

Currently it is in POC stage.

It parses given Angular TS module and collects top level routes.

## Next Steps

- ~~Collect children routes~~ [DONE]
- Collect lazy routes from other modules
- Support Identifiers in routes configuration (currently only object literals are supported)
- Support Spread operators in routes configuration
- Organize internal code structure to transition from POC to some stable version

## License

MIT © [Alex Malkevich](malkevich.alex@gmail.com)
