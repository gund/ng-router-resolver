import { NgModule } from '@angular/core';
import * as ts from 'typescript';

const startTime = Date.now();

main()
  .then(() => Date.now())
  .then(endTime => console.log(`Done in ${endTime - startTime}ms`))
  .catch(e => {
    console.error(e);
    process.exit(1);
  });

async function main() {
  const fileName = __dirname + '/../src/app/app.module.ts';
  const program = ts.createProgram([fileName], { module: ts.ModuleKind.ES2015 });
  const diagnostics = program.getGlobalDiagnostics();
  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile(fileName);
  const statements = sourceFile.statements;

  if (diagnostics.length) {
    program.getGlobalDiagnostics().forEach(e => console.log(String(e)));
    throw Error('Errors in TS program');
  }

  const isNodeClassDeclaration = isNodeOfKind(ts.SyntaxKind.ClassDeclaration);
  const classes = statements.filter(n => isNodeClassDeclaration(n) && isNodeExported(n));

  if (classes.length === 0) {
    throw Error('No exported classes found');
  }

  const isDecoratorNgModule = isDecoratorOfType('NgModule');
  const ngModules = classes.filter(e => e.decorators.some(isDecoratorNgModule));

  if (ngModules.length === 0) {
    throw Error('No exported NgModule class found');
  }

  if (ngModules.length > 1) {
    throw Error('More than 1 NgModule exported found');
  }

  const ngModule = getNgModuleFromDecorator(ngModules.shift().decorators.shift());

  if (!ngModule.imports) {
    console.log('No imports found in NgModule');
    return;
  }

  let imports = extractExpressionChildren(ngModule.imports);

  if (imports.length === 0) {
    console.log('No imports are found in NgModule. Only array literals are supported in NgModule.import');
    return;
  }

  const spreadImports = imports.filter(isNodeOfKind(ts.SyntaxKind.SpreadElement))
    .reduce<ts.Node[]>((arr, i) => [...arr, ...resolveSpreadExpr(i as ts.SpreadElement, checker, program)], []);

  imports = [...imports, ...spreadImports].filter(isNodeOfKind(ts.SyntaxKind.Identifier));

  if (imports.length === 0) {
    console.log('No imports are found in NgModule. Only identifiers are supported (no spread operators yet)');
    return;
  }

  imports.forEach(i => {
    console.log('kind: ' + ts.SyntaxKind[i.kind]);
    console.log('text: ' + i.getText());
  });
}

function isNodeExported(node: ts.Node) {
  // tslint:disable-next-line:no-bitwise
  return (node.flags & ts.NodeFlags.ExportContext) !== 0 || (node.parent && node.parent.kind === ts.SyntaxKind.SourceFile);
}

function isNodeOfKind(kind: ts.SyntaxKind) {
  return (node: ts.Node) => node.kind === kind;
}

function isDecoratorOfType(type: string) {
  return (decorator: ts.Decorator) => {
    const atToken = decorator.getChildAt(0);
    const node = decorator.getChildAt(1) as ts.CallExpression;

    return decorator.kind === ts.SyntaxKind.Decorator &&
      (decorator.expression.kind === ts.SyntaxKind.CallExpression) &&
      (atToken && atToken.kind === ts.SyntaxKind.AtToken) &&
      (node && node.kind === ts.SyntaxKind.CallExpression) &&
      (node.expression.getText() === type);
  };
}

function getNgModuleFromDecorator(decorator: ts.Decorator): {[P in keyof NgModule]: ts.Expression} {
  const node = decorator.getChildAt(1) as ts.CallExpression;

  if (node.arguments.length === 0) {
    throw Error('No arguments were passed to @NgModule decorator');
  }

  const arg = node.arguments.shift();

  if (arg.kind === ts.SyntaxKind.ObjectLiteralExpression) {
    return getNgModuleFromObjectLiteral(arg as ts.ObjectLiteralExpression);
  }

  throw Error('Only object literals supported in @NgModule for now');
}

function getNgModuleFromObjectLiteral(obj: ts.ObjectLiteralExpression): {[P in keyof NgModule]: ts.Expression} {
  const isNodePropertyAssignment = isNodeOfKind(ts.SyntaxKind.PropertyAssignment);
  const propAssignmets = obj.properties.filter(isNodePropertyAssignment) as ts.PropertyAssignment[];

  if (propAssignmets.length === 0) {
    throw Error('No properties found in @NgModule object. Only property assignments supported');
  }

  const ngModule = {};

  propAssignmets.forEach(prop => ngModule[prop.name.getText()] = prop.initializer);

  return ngModule;
}

function extractExpressionChildren(expr: ts.Expression): ts.Node[] {
  const node = expr.getChildAt(1);

  if (node.kind === ts.SyntaxKind.SyntaxList) {
    return node.getChildren();
  }

  return [];
}

function resolveSpreadExpr(spreadElem: ts.SpreadElement, checker: ts.TypeChecker, program: ts.Program): ts.Node[] {
  const symbol = checker.getSymbolAtLocation(spreadElem.expression);
  const importSpecifier = symbol.declarations[0] as ts.ImportSpecifier;
  const identifiers = importSpecifier.getSourceFile()['identifiers'] as Map<string, string>;

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
