const {test} = require('node:test');
const assert = require('node:assert/strict');
const {officialUrl, linksInMessage, extractOfficialResults} = require('../lib/discovery');

test('official URL filter accepts government and university hosts only', () => {
  assert.equal(officialUrl('https://www.gov.br/gestao/provas?utm_source=chat#parte'), 'https://www.gov.br/gestao/provas');
  assert.equal(officialUrl('https://concursos.ufmg.edu.br/provas'), 'https://concursos.ufmg.edu.br/provas');
  assert.equal(officialUrl('https://pciconcursos.com.br/provas'), null);
  assert.equal(officialUrl('https://gov.br.evil.example/provas'), null);
  assert.equal(officialUrl('http://www.gov.br/provas'), null);
});

test('Telegram link parser deduplicates URLs and removes trailing punctuation', () => {
  assert.deepEqual(linksInMessage('Veja https://www.gov.br/prova.pdf. Outra: https://www.gov.br/prova.pdf!'), ['https://www.gov.br/prova.pdf']);
});

test('web search stores only official results', () => {
  const result = extractOfficialResults({results: [
    {url: 'https://www.gov.br/gestao/provas', title: 'CNU'},
    {url: 'https://www.gov.br/gestao/provas#secao', title: 'CNU repetido'},
    {url: 'https://pciconcursos.com.br/provas', title: 'PCI'},
  ]});
  assert.deepEqual(result, [{url: 'https://www.gov.br/gestao/provas', title: 'CNU'}]);
});
