import { NgModule } from '@angular/core';
import { Route } from '@angular/router';
import * as ts from 'typescript';

const ROUTES_EXPRS_TXT = ['RouterModule.forRoot', 'RouterModule.forChild'];

const isNodeClassDeclaration = isNodeOfKind(ts.SyntaxKind.ClassDeclaration);
const isNodeSpreadElement = isNodeOfKind(ts.SyntaxKind.SpreadElement);
const isNodeIdentifier = isNodeOfKind(ts.SyntaxKind.Identifier);
const isNodePropertyAssignment = isNodeOfKind(ts.SyntaxKind.PropertyAssignment);
const isNodeCallExpression = isNodeOfKind(ts.SyntaxKind.CallExpression);
const isNodeObjectLiteralExpression = isNodeOfKind(ts.SyntaxKind.ObjectLiteralExpression);

const startTime = Date.now();

main()
  .then(() => Date.now())
  .then(endTime => console.log(`Done in ${endTime - startTime}ms`))
  .catch(e => {
    console.error(e);
    process.exit(1);
  });

async function main() {
  const fileName = __dirname + '/../test/test.module.ts';
  const program = ts.createProgram([fileName], { module: ts.ModuleKind.ES2015 });
  const checker = program.getTypeChecker();
  const diagnostics = program.getGlobalDiagnostics();
  const sourceFile = program.getSourceFile(fileName);
  const statements = sourceFile.statements;

  if (diagnostics.length) {
    diagnostics.forEach(e => console.log(String(e)));
    throw Error('Errors in TS program');
  }

  const classes = statements.filter(n => isNodeClassDeclaration(n) && isNodeExported(n));

  if (classes.length === 0) {
    throw Error('No exported classes found');
  }

  const isDecoratorNgModule = isDecoratorOfType('NgModule');
  const ngModules = classes.filter(e => e.decorators && e.decorators.some(isDecoratorNgModule));

  if (ngModules.length === 0) {
    throw Error('No exported NgModule class found');
  }

  if (ngModules.length > 1) {
    throw Error('More than 1 NgModule exported found');
  }

  const ngModuleStmt = ngModules[0];
  const ngModuleDecorators = ngModuleStmt.decorators && ngModuleStmt.decorators[0];

  if (!ngModuleDecorators) {
    throw Error('No decorators found in NgModule');
  }

  const ngModule = getNgModuleFromDecorator(ngModuleDecorators);

  if (!ngModule.imports) {
    console.log('No imports found in NgModule');
    return;
  }

  let imports = extractExpressionChildren(ngModule.imports);

  if (imports.length === 0) {
    console.log('No imports are found in NgModule. Only array literals are supported in NgModule.import');
    return;
  }

  // const spreadImports = imports.filter(isNodeSpreadElement)
  //   .reduce<ts.Node[]>((arr, i) => [...arr, ...resolveSpreadExpr(i as ts.SpreadElement, checker, program)], []);
  const spreadImports: ts.Node[] = [];

  imports = [...imports, ...spreadImports].filter(n => /*isNodeIdentifier(n) || */isNodeCallExpression(n));

  // Resolve here all Identifiers to it's root declarations
  const callExprs = imports as ts.CallExpression[];

  if (callExprs.length === 0) {
    console.log(`No calls are found in NgModule. Routes are always calls like '${ROUTES_EXPRS_TXT[0]}(...)'`);
    return;
  }

  const routerCalls = callExprs.filter(isRouterExpression);

  if (routerCalls.length === 0) {
    throw Error('No routes found in NgModule');
  }

  if (routerCalls.length > 1) {
    throw Error('More than 1 imports of routes found. Consider merging all routes in one RouterModule import');
  }

  const routes = resolveRoutesFromCall(routerCalls[0]);
  console.log('Routes', routes);
}

function isNodeExported(node: ts.Node) {
  return (node.flags & ts.NodeFlags.ExportContext) !== 0 || (node.parent && node.parent.kind === ts.SyntaxKind.SourceFile);
}

function isNodeOfKind(kind: ts.SyntaxKind) {
  return (node: ts.Node) => node && node.kind === kind;
}

function isDecoratorOfType(type: string) {
  return (decorator: ts.Decorator) => {
    const atToken = decorator.getChildAt(0);
    const node = decorator.getChildAt(1) as ts.CallExpression;

    return decorator.kind === ts.SyntaxKind.Decorator &&
      isNodeCallExpression(decorator.expression) &&
      (atToken && atToken.kind === ts.SyntaxKind.AtToken) &&
      (isNodeCallExpression(node)) &&
      (node.expression.getText() === type);
  };
}

function getNgModuleFromDecorator(decorator: ts.Decorator): {[P in keyof NgModule]: ts.Expression} {
  const node = decorator.getChildAt(1) as ts.CallExpression;

  if (node.arguments.length === 0) {
    throw Error('No arguments were passed to @NgModule decorator');
  }

  const arg = node.arguments[0];

  if (!arg) {
    throw Error('No arguments passed to NgModule decorator');
  }

  if (arg.kind === ts.SyntaxKind.ObjectLiteralExpression) {
    return getNgModuleFromObjectLiteral(arg as ts.ObjectLiteralExpression);
  }

  throw Error('Only object literals supported in @NgModule for now');
}

function getNgModuleFromObjectLiteral(obj: ts.ObjectLiteralExpression): {[P in keyof NgModule]: ts.Expression} {
  const propAssignmets = obj.properties.filter(isNodePropertyAssignment) as ts.PropertyAssignment[];

  if (propAssignmets.length === 0) {
    throw Error('No properties found in @NgModule object. Only property assignments supported');
  }

  const ngModule: { [k: string]: ts.Expression } = {};

  propAssignmets.forEach(prop => ngModule[prop.name.getText()] = prop.initializer);

  return ngModule;
}

function extractExpressionChildren(expr: ts.Expression): ts.Node[] {
  if (expr.kind === ts.SyntaxKind.ArrayLiteralExpression) {
    return (<ts.ArrayLiteralExpression>expr).elements;
  }

  return [];
}

function resolveSpreadExpr(spreadElem: ts.SpreadElement, checker: ts.TypeChecker, program: ts.Program): ts.Node[] {
  const symbol = checker.getSymbolAtLocation(spreadElem.expression);

  if (!symbol || !symbol.declarations) {
    throw Error('Failed to get symbol declarations of import identifier');
  }

  const importSpecifier = symbol.declarations[0] as ts.ImportSpecifier;
  const identifiers = (<any>importSpecifier.getSourceFile())['identifiers'] as Map<string, string>;

  let found = false, path = '';
  identifiers.forEach(key => {
    if (found) {
      found = false;
      path = key;
    }
    if (key === importSpecifier.name.getText()) {
      found = true;
    }
  });

  const file = program.getSourceFile(path);
  console.log(file);

  return [];
}

function isRouterExpression(expr: ts.CallExpression): boolean {
  if (expr.expression.kind === ts.SyntaxKind.PropertyAccessExpression) {
    const propAccess = expr.expression as ts.PropertyAccessExpression;

    if (propAccess.expression.getText() === 'RouterModule' &&
      (propAccess.name.getText() === 'forRoot' || propAccess.name.getText() === 'forChild')) {
      return true;
    }
  }

  return false;
}

function resolveRoutesFromCall(call: ts.CallExpression): Route[] {
  if (call.arguments.length === 0) {
    throw Error(`No configuration was provided to '${call.expression.getText()}'`);
  }

  const config = call.arguments[0] as ts.ArrayLiteralExpression;

  if (config.kind !== ts.SyntaxKind.ArrayLiteralExpression) {
    throw Error('Only array literals supported in router config');
  }

  const confObjects = config.elements.filter(isNodeObjectLiteralExpression) as ts.ObjectLiteralExpression[];

  if (confObjects.length === 0) {
    throw Error('No routes found in NgModule. Only object literals are supported');
  }

  const routes: Route[] = [];

  confObjects.forEach(conf => {
    const route: any = {};

    conf.properties
      .filter(isNodePropertyAssignment)
      .forEach((p: ts.PropertyAssignment) => {
        route[p.name.getText()] = getAsString(p.initializer);
      });

    routes.push(route);
  });

  return routes;
}

function getAsString(node: ts.Node) {
  return node.kind === ts.SyntaxKind.StringLiteral ? node.getText().replace(/'|"/g, '') : node.getText();
}

function getIdentifierValue(node: ts.Identifier): ts.Node | undefined {
  return undefined;
}
