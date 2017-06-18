import { NgModule } from '@angular/core';
import * as ts from 'typescript';

export const isNodeClassDeclaration = isNodeOfKind(ts.SyntaxKind.ClassDeclaration);
export const isNodeSpreadElement = isNodeOfKind(ts.SyntaxKind.SpreadElement);
export const isNodeIdentifier = isNodeOfKind(ts.SyntaxKind.Identifier);
export const isNodePropertyAssignment = isNodeOfKind(ts.SyntaxKind.PropertyAssignment);
export const isNodeCallExpression = isNodeOfKind(ts.SyntaxKind.CallExpression);
export const isNodeObjectLiteralExpression = isNodeOfKind(ts.SyntaxKind.ObjectLiteralExpression);

export function isNodeOfKind(kind: ts.SyntaxKind) {
  return (node: ts.Node) => node && node.kind === kind;
}

export function isNodeExported(node: ts.Node) {
  return (node.flags & ts.NodeFlags.ExportContext) !== 0 || (node.parent && node.parent.kind === ts.SyntaxKind.SourceFile);
}

export function isDecoratorOfType(type: string) {
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

export function isRouterExpression(expr: ts.CallExpression): boolean {
  if (expr.expression.kind === ts.SyntaxKind.PropertyAccessExpression) {
    const propAccess = expr.expression as ts.PropertyAccessExpression;

    if (propAccess.expression.getText() === 'RouterModule' &&
      (propAccess.name.getText() === 'forRoot' || propAccess.name.getText() === 'forChild')) {
      return true;
    }
  }

  return false;
}

export function getNgModuleFromDecorator(decorator: ts.Decorator): {[P in keyof NgModule]: ts.Expression} {
  const node = decorator.getChildAt(1) as ts.CallExpression;
  const arg = node.arguments[0];

  if (!arg) {
    throw Error('No arguments passed to NgModule decorator');
  }

  if (arg.kind === ts.SyntaxKind.ObjectLiteralExpression) {
    return getNgModuleFromObjectLiteral(arg as ts.ObjectLiteralExpression);
  }

  throw Error('Only object literals supported in NgModule');
}

export function getNgModuleFromObjectLiteral(obj: ts.ObjectLiteralExpression): {[P in keyof NgModule]: ts.Expression} {
  const propAssignmets = obj.properties.filter(isNodePropertyAssignment) as ts.PropertyAssignment[];

  if (propAssignmets.length === 0) {
    throw Error('No properties found in NgModule object. Only property assignments supported');
  }

  const ngModule: { [k: string]: ts.Expression } = {};

  propAssignmets.forEach(prop => ngModule[prop.name.getText()] = prop.initializer);

  return ngModule;
}

export function extractExpressionChildren(expr: ts.Expression): ts.Node[] {
  if (expr.kind === ts.SyntaxKind.ArrayLiteralExpression) {
    return (<ts.ArrayLiteralExpression>expr).elements;
  }
  return [];
}

export function resolveAsIdentifier<T>(resFn: (node: ts.Node) => T, node: ts.Node, checker: ts.TypeChecker): T {
  if (node.kind === ts.SyntaxKind.Identifier) {
    return resolveAsIdentifier(resFn, getIdentifierDeclaration(node as ts.Identifier, checker), checker);
  } else {
    return resFn(node);
  }
}

export function getIdentifierAsVariable(node: ts.Identifier, checker: ts.TypeChecker): ts.Expression {
  const declaration = getIdentifierDeclaration(node, checker);

  if (declaration.kind !== ts.SyntaxKind.VariableDeclaration) {
    throw Error(`Expected '${node.getText()}' to be variable but got ${ts.SyntaxKind[declaration.kind]}`);
  }

  return getVariableValue(declaration as ts.VariableDeclaration);
}

export function extractIdentifierExpressionChildren(expr: ts.Node, checker: ts.TypeChecker) {
  return resolveAsIdentifier(extractExpressionChildren, expr, checker);
}

export function getIdentifierDeclaration(node: ts.Identifier, checker: ts.TypeChecker): ts.Declaration {
  return resolveSymbol(checker.getSymbolAtLocation(node));

  function resolveSymbol(symbol: ts.Symbol): ts.Declaration {
    const declaration = symbol.valueDeclaration || symbol.declarations && symbol.declarations[0];

    if (!declaration) {
      throw Error(`Identifier '${node.getText()}' has no value declaration`);
    }

    if (declaration.kind === ts.SyntaxKind.ImportSpecifier) {
      const symbol = resolveImportSpecifierSymbol(declaration as ts.ImportSpecifier, checker);

      if (!symbol) {
        throw Error(`Identifier '${node.getText()}' is resolved from external module`);
      }

      return resolveSymbol(symbol);
    }

    return declaration;
  }
}

export function resolveImportSpecifierSymbol(importSpecifier: ts.ImportSpecifier, checker: ts.TypeChecker): ts.Symbol | undefined {
  const namedImports = importSpecifier.parent;

  if (!namedImports || namedImports.kind !== ts.SyntaxKind.NamedImports) {
    throw Error(`Only named imports are supported (import '${importSpecifier.name.getText()}')`);
  }

  const importClause = namedImports.parent;

  if (!importClause || importClause.kind !== ts.SyntaxKind.ImportClause) {
    throw Error(`Failed to get import clause of '${importSpecifier.name.getText()}'`);
  }

  const importDeclaration = importClause.parent;

  if (!importDeclaration || importDeclaration.kind !== ts.SyntaxKind.ImportDeclaration) {
    throw Error(`Failed to get import declaration of '${importSpecifier.name.getText()}'`);
  }

  const moduleSymbol = checker.getSymbolAtLocation(importDeclaration.moduleSpecifier);

  if (!moduleSymbol) {
    return undefined;
  }

  const symbol = checker.tryGetMemberInModuleExports(importSpecifier.name.getText(), moduleSymbol);

  if (!symbol) {
    throw Error(`Failed to get exported member '${importSpecifier.name.getText()}' from '${importDeclaration.moduleSpecifier.getText()}'`);
  }

  return symbol;
}

export function getVariableValue(variable: ts.VariableDeclaration): ts.Expression {
  if (!variable.initializer) {
    throw Error(`Variable '${variable.name.getText()}' does not have initial value`);
  }
  return variable.initializer;
}

export function getAsString(node: ts.Node) {
  return node.kind === ts.SyntaxKind.StringLiteral ? node.getText().replace(/'|"/g, '') : node.getText();
}

export function getLazyInfoFromStr(str: string) {
  let [path, moduleName] = str.split('#');

  if (!path || !moduleName) {
    throw Error(`Invalid lazy-load string '${str}'`);
  }

  if (!path.endsWith('.ts')) {
    path += '.ts';
  }

  return { path, moduleName };
}
