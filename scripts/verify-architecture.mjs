import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = path.resolve('packages/engine/src');
const files = directory => fs.readdirSync(directory, {withFileTypes: true}).flatMap(entry =>
  entry.isDirectory() ? files(path.join(directory, entry.name)) : entry.name.endsWith('.ts') ? [path.join(directory, entry.name)] : []);
const violations = [];
for (const file of files(root)) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const relative = path.relative(root, file);
  for (const diagnostic of source.parseDiagnostics) violations.push(`${relative}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')}`);
  const add = (node, message) => violations.push(`${relative}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}: ${message}`);
  let classes = 0;
  for (const node of source.statements) {
    if (ts.isClassDeclaration(node)) classes++;
    if ((ts.isFunctionDeclaration(node) || ts.isVariableStatement(node)) && node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword))
      add(node, 'export runtime behavior through classes');
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) &&
      /^(core|scenes|di|events|configs|input|runtime|screen)\//.test(relative) &&
      /^(pixi\.js|three)(\/|$)/.test(node.moduleSpecifier.text) && !node.importClause?.isTypeOnly)
      add(node, 'renderer libraries belong in renderer adapters');
  }
  if (classes > 1) add(source, 'keep one runtime class per file');
  const visit = node => {
    if (node.kind === ts.SyntaxKind.AnyKeyword) add(node, 'decode unknown instead of any');
    if (ts.isNonNullExpression(node)) add(node, 'use a checked contract instead of non-null assertion');
    ts.forEachChild(node, visit);
  };
  visit(source);
}
assert.equal(violations.length, 0, '\n' + violations.join('\n'));
console.log('Engine architecture boundaries and TypeScript runtime style passed.');
