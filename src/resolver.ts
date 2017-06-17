import { NgModule } from '@angular/core';
import { Route } from '@angular/router';
import * as ts from 'typescript';
import { dirname, join } from 'path';

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
  getRoutesFromFile(fileName).forEach(r => console.log(r));
}

function getRoutesFromFile(fileName: string, moduleName?: string): Route[] {
  const program = ts.createProgram([fileName], { module: ts.ModuleKind.ES2015 });
  const checker = program.getTypeChecker();
  const diagnostics = program.getGlobalDiagnostics();
  const sourceFile = program.getSourceFile(fileName);
  const statements = sourceFile.statements;

  if (diagnostics.length) {
    diagnostics.forEach(e => console.log(String(e)));
    throw Error('Errors in TS program');
  }

  const classes = statements.filter(n => isNodeClassDeclaration(n) && isNodeExported(n)) as ts.ClassDeclaration[];

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

  const ngModuleClass = ngModules[0];

  // Check if NgModule is same as expected by moduleName
  if (moduleName) {
    if (!ngModuleClass.name || ngModuleClass.name.getText() !== moduleName) {
      throw Error(`NgModule with name '${moduleName}' was expected in ${fileName}`);
    }
  }

  const ngModuleDecorators = ngModuleClass.decorators && ngModuleClass.decorators[0];

  if (!ngModuleDecorators) {
    throw Error('No decorators found in NgModule');
  }

  const ngModule = getNgModuleFromDecorator(ngModuleDecorators);

  if (!ngModule.imports) {
    console.log('No imports found in NgModule');
    return [];
  }

  let imports = resolveAsIdentifier(extractExpressionChildren, ngModule.imports, checker);

  if (imports.length === 0) {
    console.log('No imports are found in NgModule. Only array literals are supported in NgModule.import');
    return [];
  }

  // const spreadImports = imports.filter(isNodeSpreadElement)
  //   .reduce<ts.Node[]>((arr, i) => [...arr, ...resolveSpreadExpr(i as ts.SpreadElement, checker, program)], []);
  const spreadImports: ts.Node[] = [];

  imports = [...imports, ...spreadImports].filter(n => /*isNodeIdentifier(n) || */isNodeCallExpression(n));

  // Resolve here all Identifiers to it's root declarations
  const callExprs = imports as ts.CallExpression[];

  if (callExprs.length === 0) {
    console.log(`No calls are found in NgModule. Routes are always calls like '${ROUTES_EXPRS_TXT[0]}(...)'`);
    return [];
  }

  const routerCalls = callExprs.filter(isRouterExpression);

  if (routerCalls.length === 0) {
    throw Error('No routes found in NgModule');
  }

  if (routerCalls.length > 1) {
    throw Error('More than 1 imports of routes found. Consider merging all routes in one RouterModule import');
  }

  const routes = resolveRoutesFromCall(routerCalls[0], fileName, checker);

  return routes;
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

function resolveAsIdentifier<T>(resFn: (node: ts.Node) => T, node: ts.Node, checker: ts.TypeChecker): T {
  if (node.kind === ts.SyntaxKind.Identifier) {
    return resolveAsIdentifier(resFn, getIdentifierDeclaration(node as ts.Identifier, checker), checker);
  } else {
    return resFn(node);
  }
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

function resolveRoutesFromCall(call: ts.CallExpression, currentFile: string, checker: ts.TypeChecker): Route[] {
  if (call.arguments.length === 0) {
    throw Error(`No configuration was provided to '${call.expression.getText()}'`);
  }

  let config = call.arguments[0];

  if (config.kind === ts.SyntaxKind.Identifier) {
    config = getIdentifierAsVariable(config as ts.Identifier, checker);
  }

  if (config.kind !== ts.SyntaxKind.ArrayLiteralExpression) {
    throw Error('Only array literals supported in router config');
  }

  return getRoutesFromArray(config as ts.ArrayLiteralExpression, currentFile, checker);
}

function getRoutesFromArray(array: ts.ArrayLiteralExpression, currentFile: string, checker: ts.TypeChecker): Route[] {
  const confObjects = array.elements
    .reduce((arr, n) => {
      if (n.kind === ts.SyntaxKind.SpreadElement) {
        let expr = (<ts.SpreadElement>n).expression;
        if (expr.kind === ts.SyntaxKind.Identifier) {
          expr = resolveAsIdentifier(getVariableValue, expr, checker);
        }

        let newArray: ts.Expression[] = [];
        if (expr.kind === ts.SyntaxKind.ArrayLiteralExpression) {
          newArray = (<ts.ArrayLiteralExpression>expr).elements;
        }

        return [...arr, ...newArray];
      }
      return [...arr, n];
    }, <ts.Expression[]>[])
    .filter(isNodeObjectLiteralExpression) as ts.ObjectLiteralExpression[];

  if (confObjects.length === 0) {
    throw Error('No routes found in NgModule');
  }

  const routes: Route[] = [];

  confObjects.forEach(conf => {
    const route: any = {};

    conf.properties
      .filter(isNodePropertyAssignment)
      .forEach((p: ts.PropertyAssignment) => {
        const name = p.name.getText();
        route[name] = getRouteValue(name, p.initializer, currentFile, checker);
      });

    routes.push(route);
  });

  return routes;
}

function getRouteValue(name: string, expr: ts.Node, currentFile: string, checker: ts.TypeChecker): any {
  switch (name) {
    case 'children': {
      if (expr.kind !== ts.SyntaxKind.ArrayLiteralExpression) {
        throw Error('Only array literals are supported for child routes');
      }
      return getRoutesFromArray(expr as ts.ArrayLiteralExpression, currentFile, checker);
    }
    case 'loadChildren': {
      const { path, moduleName } = getLazyInfoFromStr(getAsString(expr));
      const lazyFile = join(dirname(currentFile), path);
      return getRoutesFromFile(lazyFile, moduleName);
    }
    default:
      return getAsString(expr);
  }
}

function getAsString(node: ts.Node) {
  return node.kind === ts.SyntaxKind.StringLiteral ? node.getText().replace(/'|"/g, '') : node.getText();
}

function getLazyInfoFromStr(str: string) {
  let [path, moduleName] = str.split('#');

  if (!path || !moduleName) {
    throw Error(`Invalid lazy-load string '${str}'`);
  }

  if (!path.endsWith('.ts')) {
    path += '.ts';
  }

  return { path, moduleName };
}

function getIdentifierDeclaration(node: ts.Identifier, checker: ts.TypeChecker): ts.Declaration {
  const symbol = checker.getSymbolAtLocation(node);
  const declaration = symbol.valueDeclaration;

  if (!declaration) {
    throw Error(`Identifier '${node.getText()}' has no value declaration`);
  }

  return declaration;
}

function getVariableValue(variable: ts.VariableDeclaration): ts.Expression {
  if (!variable.initializer) {
    throw Error(`Variable '${variable.name.getText()}' does not have initial value`);
  }
  return variable.initializer;
}

function getIdentifierAsVariable(node: ts.Identifier, checker: ts.TypeChecker): ts.Expression {
  const declaration = getIdentifierDeclaration(node, checker);

  if (declaration.kind !== ts.SyntaxKind.VariableDeclaration) {
    throw Error(`Expected '${node.getText()}' to be variable but got ${ts.SyntaxKind[declaration.kind]}`);
  }

  return getVariableValue(declaration as ts.VariableDeclaration);
}
