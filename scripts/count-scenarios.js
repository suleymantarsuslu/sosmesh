#!/usr/bin/env node
/**
 * @cucumber/gherkin AST parser ile senaryo sayısını ve yapısını doğrular.
 * Kullanım: node scripts/count-scenarios.js docs/tests/m0-acceptance.feature
 */

/* eslint-disable import/no-unresolved */

const fs = require('fs');
const path = require('path');

async function parseFeature(filePath) {
  // @cucumber/gherkin dinamik import gerektirir
  const Gherkin = await import('@cucumber/gherkin');
  const Messages = await import('@cucumber/messages');

  const builder = new Gherkin.AstBuilder(Messages.IdGenerator.uuid());
  const matcher = new Gherkin.GherkinClassicTokenMatcher();
  const parser = new Gherkin.Parser(builder, matcher);

  const content = fs.readFileSync(filePath, 'utf-8');
  const gherkinDocument = parser.parse(content);

  if (!gherkinDocument.feature) {
    console.error('Feature tanımı bulunamadı.');
    process.exit(1);
  }

  const feature = gherkinDocument.feature;
  const scenarios = feature.children.filter((child) => child.scenario);

  console.log(`\n=== @cucumber/gherkin AST Parse Sonucu ===`);
  console.log(`Feature: ${feature.name}`);
  console.log(`Toplam Senaryo: ${scenarios.length}`);

  const tagCounts = {};
  scenarios.forEach((child) => {
    const scenario = child.scenario;
    const tags = scenario.tags.map((t) => t.name);
    tags.forEach((tag) => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });

  console.log(`\n=== Etiket Dağılımı ===`);
  Object.keys(tagCounts)
    .sort()
    .forEach((tag) => {
      console.log(`${tag}: ${tagCounts[tag]}`);
    });

  // Negatif senaryo sayısı
  const negativeCount = scenarios.filter((child) =>
    child.scenario.tags.some((t) => t.name === '@negative')
  ).length;
  console.log(`\n@negative senaryo sayısı: ${negativeCount}`);

  // U1-U5 dağılımı
  ['@U1', '@U2', '@U3', '@U4', '@U5'].forEach((tag) => {
    const count = scenarios.filter((child) =>
      child.scenario.tags.some((t) => t.name === tag)
    ).length;
    console.log(`${tag} senaryo sayısı: ${count}`);
  });

  console.log(`\n=== AST Parse Başarılı ===\n`);
}

const filePath = process.argv[2] || 'docs/tests/m0-acceptance.feature';
parseFeature(path.resolve(filePath)).catch((err) => {
  console.error('Parse hatası:', err.message);
  process.exit(1);
});
