__NAME__ version __VERSION__
==================================

Usage: ng-router-resolver [options] <module-file>

<module-files>      Path to Angular module .ts file

Options:

-v, --version     Show version number
-h, --help        Show this help
-o, --out         Write routes as JSON into file, by default outputs to stdout

Description:

Provide file of Angular module and it will print out all resolved routes (including lazy).
If you want to write routes into file instead use --out option.

Examples:

# print all routes of app.module.ts
ng-router-resolver src/app/app.module.ts

# save all routes into app-routes.json
ng-router-resolver src/app/app.module.ts --out app-routes.json

For more information visit __WIKI__
