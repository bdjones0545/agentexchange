import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe,it,expect } from 'vitest';
import { LegalPage } from '../src/routes/LegalPage';
import { legalPages, type LegalSlug } from '../src/content/legal';
describe('legal routes',()=>{
 it.each(Object.keys(legalPages) as LegalSlug[])('%s has distinct content and draft status',slug=>{
  const html=renderToStaticMarkup(createElement(LegalPage,{slug}));
  expect(html).toContain(legalPages[slug].title.replace('&','&amp;'));
  if (slug.startsWith('ios-')) expect(html).not.toContain('Draft, pending legal review');
  else expect(html).toContain('Draft, pending legal review'); expect(html).toContain(slug.startsWith('ios-') ? '2026-10-10' : '2026-09-29'); expect(html).not.toContain('TODO(owner):');
 });
});
