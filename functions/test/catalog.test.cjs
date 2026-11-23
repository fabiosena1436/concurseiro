const {test} = require('node:test');
const assert = require('node:assert/strict');
const {facets, filterKey, validQuestion, validPaper} = require('../lib/catalog.js');

test('combined paper filters find the published edition and ignore case', () => {
  const paper = {status: 'published', title: 'Prova para Professor de Matemática', banca: 'Vunesp', tipo: 'Estadual', orgao: 'Secretaria de Educação', cargo: 'Professor', escolaridade: 'Superior', year: 2024, materias: ['Português', 'Matemática']};
  const keys = facets(paper, 'paper');
  assert.ok(keys.includes(filterKey('published', {banca: 'vunesp', cargo: 'PROFESSOR', subject: 'Matemática', year: 2024})));
  assert.ok(keys.includes(filterKey('published', {banca: 'vunesp', search: 'MATEMATICA', subject: 'Matemática'})));
  assert.ok(!keys.includes(filterKey('draft', {banca: 'vunesp'})));
  assert.ok(!keys.includes(filterKey('published', {subject: 'Direito'})));
});

test('combined question filters preserve the paper link', () => {
  const question = {status: 'published', banca: 'FGV', subject: 'Direito', topic: 'Constitucional', year: 2025, paperId: 'paper-1', cargo: 'Analista'};
  const keys = facets(question, 'question');
  assert.ok(keys.includes(filterKey('published', {banca: 'FGV', subject: 'direito', paperId: 'paper-1'})));
  assert.ok(!keys.includes(filterKey('published', {paperId: 'paper-2'})));
});

test('paper search index remains bounded with five subjects', () => {
  const paper = {status: 'published', title: 'Prova um dois tres quatro cinco seis sete oito', banca: 'Banca', tipo: 'Estadual', orgao: 'Orgão', cargo: 'Analista', escolaridade: 'Superior', year: 2025, materias: ['Português', 'Matemática', 'Direito', 'Informática', 'História']};
  const keys = facets(paper, 'paper');
  assert.ok(keys.length < 40000);
  assert.ok(Buffer.byteLength(JSON.stringify(keys)) < 900000);
});

test('publishing requires a confirmed answer and no unresolved warnings', () => {
  const question = {paperId: 'paper-1', status: 'draft', format: 'multiple', text: 'Quanto é 2 + 2?', sourceText: 'Quanto é 2 + 2?', options: ['3', '4'], subject: 'Matemática', topic: 'Aritmética', explanation: 'A soma é quatro.', correctAnswer: null, warnings: ['Gabarito incerto']};
  assert.doesNotThrow(() => validQuestion(question, false));
  assert.throws(() => validQuestion({...question, status: 'published'}, true), /Revise texto/);
  assert.doesNotThrow(() => validQuestion({...question, status: 'published', correctAnswer: 1, warnings: []}, true));
});

test('paper metadata requires a valid year and PDF path', () => {
  const paper = {title: 'Prova A', year: 2024, banca: 'FGV', concurso: 'Concurso A', orgao: 'Órgão A', tipo: 'Federal', cargo: 'Analista', escolaridade: 'Superior', materias: ['Direito'], pdfPath: 'papers/paper-1/exam-version-1.pdf'};
  assert.doesNotThrow(() => validPaper(paper));
  assert.throws(() => validPaper({...paper, year: 1800}), /dados obrigatórios/);
  assert.throws(() => validPaper({...paper, pdfPath: 'outro/arquivo.pdf'}), /Caminho do PDF/);
});
