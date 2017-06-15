import { NgModule } from '@angular/core';
import * as ts from 'typescript';

const startTime = Date.now();
const isNodeClassDeclaration = isNodeOfKind(ts.SyntaxKind.ClassDeclaration);
const isNodeSpreadElement = isNodeOfKind(ts.SyntaxKind.SpreadElement);
const isNodeIdentifier = isNodeOfKind(ts.SyntaxKind.Identifier);
const isNodePropertyAssignment = isNodeOfKind(ts.SyntaxKind.PropertyAssignment);

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
  const diagnostics = program.getGlobalDiagnostics();
  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile(fileName);
  const statements = sourceFile.statements;

  if (diagnostics.length) {
    program.getGlobalDiagnostics().forEach(e => console.log(String(e)));
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

  imports.forEach(i => console.log(ts.SyntaxKind[i.kind]));

  const spreadImports = imports.filter(isNodeSpreadElement)
    .reduce<ts.Node[]>((arr, i) => [...arr, ...resolveSpreadExpr(i as ts.SpreadElement, checker, program)], []);

  imports = [...imports, ...spreadImports].filter(isNodeIdentifier);

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
  const node = expr.getChildAt(1);

  if (node.kind === ts.SyntaxKind.SyntaxList) {
    return node.getChildren();
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
