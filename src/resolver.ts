import { Route } from '@angular/router';
import { dirname, join } from 'path';
import * as ts from 'typescript';

import {
  extractIdentifierExpressionChildren,
  getAsString,
  getIdentifierAsVariable,
  getLazyInfoFromStr,
  getNgModuleFromDecorator,
  getVariableValue,
  isDecoratorOfType,
  isNodeCallExpression,
  isNodeClassDeclaration,
  isNodeExported,
  isNodeObjectLiteralExpression,
  isNodePropertyAssignment,
  isRouterExpression,
  resolveAsIdentifier,
  resolveImportSpecifierSymbol,
} from './util';

export class NgRouterResolver {

  static fromModule(fileName: string, moduleName?: string): Route[] {
    return new this(fileName).resolve(moduleName);
  }

  private program = ts.createProgram([this.fileName], { module: ts.ModuleKind.ES2015 });
  private checker = this.program.getTypeChecker();
  private sourceFile = this.program.getSourceFile(this.fileName);
  private ngModuleName = '';

  constructor(private fileName: string) {
    this.checkDiagnostics();
  }

  resolve(moduleName?: string): Route[] {
    const ngModuleClass = this.getNgModuleClass(moduleName);
    const routeCalls = this.getCallsFromClass(ngModuleClass)
      .filter(isRouterExpression);

    if (routeCalls.length === 0) {
      console.log(`No routes found in ${this.getNgModuleString()}`);
      return [];
    }

    if (routeCalls.length > 1) {
      throw Error(`More than 1 imports of routes found in ${this.getNgModuleString()}.
      Consider merging all routes in one RouterModule import`);
    }

    return this.resolveRoutesFromCall(routeCalls[0]);
  }

  private getNgModuleString(): string {
    return `NgModule ${this.ngModuleName}@${this.fileName}`;
  }

  private checkDiagnostics() {
    const diagnostics = this.program.getGlobalDiagnostics();

    if (diagnostics.length) {
      diagnostics.forEach(e => console.log(String(e)));
      throw Error('Errors in TS program');
    }
  }

  private getNgModuleClass(moduleName?: string): ts.ClassDeclaration {
    const sourceFile = this.program.getSourceFile(this.fileName);

    if (!sourceFile) {
      throw Error(`File ${this.fileName} not found`);
    }

    const classes = sourceFile.statements.filter(n => isNodeClassDeclaration(n) && isNodeExported(n)) as ts.ClassDeclaration[];

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
        throw Error(`NgModule with name '${moduleName}' was expected in ${this.fileName}`);
      }
    }

    if (ngModuleClass.name) {
      this.ngModuleName = ngModuleClass.name.getText();
    }

    return ngModuleClass;
  }

  private getCallsFromClass(cls: ts.ClassDeclaration): ts.CallExpression[] {
    const className = cls.name ? cls.name.getText() : 'Anonymous';
    const ngModuleDecorators = cls.decorators && cls.decorators[0];

    if (!ngModuleDecorators || !isDecoratorOfType('NgModule')(ngModuleDecorators)) {
      throw Error(`No decorators found in class '${className}'`);
    }

    const ngModule = getNgModuleFromDecorator(ngModuleDecorators);

    if (!ngModule.imports) {
      console.log(`No imports found in NgModule '${className}'`);
      return [];
    }

    let imports = extractIdentifierExpressionChildren(ngModule.imports, this.checker);

    if (imports.length === 0) {
      console.log(`No imports are found in NgModule '${className}'`);
      return [];
    }

    // Resolve here all Identifiers to it's root declarations
    return imports
      .reduce((arr, n) => {
        if (n.kind === ts.SyntaxKind.Identifier) {
          return [...arr, ...this.resolveImportIdentifier(n as ts.Identifier)];
        }
        return [...arr, n];
      }, <ts.Node[]>[])
      .filter(isNodeCallExpression) as ts.CallExpression[];
  }

  private resolveImportIdentifier(identifier: ts.Identifier): ts.Node[] {
    const resolveSymbol = (symbol: ts.Symbol): ts.Node[] => {
      const valDeclaration = symbol.valueDeclaration;
      const declarations = symbol.declarations;

      if (valDeclaration) {
        if (valDeclaration.kind === ts.SyntaxKind.VariableDeclaration) {
          return [getVariableValue(valDeclaration as ts.VariableDeclaration)];
        }
        if (valDeclaration.kind === ts.SyntaxKind.ClassDeclaration) {
          return this.getCallsFromClass(valDeclaration as ts.ClassDeclaration);
        }
      }

      if (declarations) {
        return declarations
          .reduce((arr, d) => d.kind === ts.SyntaxKind.ImportSpecifier
            ? [...arr, ...resolveSymbol(resolveImportSpecifierSymbol(d as ts.ImportSpecifier, this.checker))]
            : [...arr, d], <ts.Node[]>[]);
      }

      return [];
    }

    return resolveSymbol(this.checker.getSymbolAtLocation(identifier)) || [identifier];
  }

  private resolveRoutesFromCall(call: ts.CallExpression): Route[] {
    if (call.arguments.length === 0) {
      throw Error(`No configuration was provided to '${call.expression.getText()}'`);
    }

    let config = call.arguments[0];

    if (config.kind === ts.SyntaxKind.Identifier) {
      config = getIdentifierAsVariable(config as ts.Identifier, this.checker);
    }

    if (config.kind !== ts.SyntaxKind.ArrayLiteralExpression) {
      throw Error('Only array literals supported in router config');
    }

    return this.getRoutesFromArray(config as ts.ArrayLiteralExpression);
  }

  private getRoutesFromArray(array: ts.ArrayLiteralExpression): Route[] {
    const confObjects = array.elements
      .reduce((arr, n) => {
        if (n.kind === ts.SyntaxKind.SpreadElement) {
          let expr = (<ts.SpreadElement>n).expression;
          if (expr.kind === ts.SyntaxKind.Identifier) {
            expr = resolveAsIdentifier(getVariableValue, expr, this.checker);
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
          route[name] = this.getRouteValue(name, p.initializer);
        });

      routes.push(route);
    });

    return routes;
  }

  private getRouteValue(name: string, expr: ts.Node): any {
    switch (name) {
      case 'children': {
        if (expr.kind === ts.SyntaxKind.Identifier) {
          expr = resolveAsIdentifier(getVariableValue, expr, this.checker);
        }
        if (expr.kind !== ts.SyntaxKind.ArrayLiteralExpression) {
          throw Error('Only array literals are supported for child routes');
        }
        return this.getRoutesFromArray(expr as ts.ArrayLiteralExpression);
      }
      case 'loadChildren': {
        const { path, moduleName } = getLazyInfoFromStr(getAsString(expr));
        const lazyFile = join(dirname(this.fileName), path);
        return NgRouterResolver.fromModule(lazyFile, moduleName);
      }
      default:
        return getAsString(expr);
    }
  }

}
