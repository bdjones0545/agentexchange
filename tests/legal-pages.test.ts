import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe,it,expect } from 'vitest';
import { LegalPage } from '../src/routes/LegalPage';
import { legalPages, metaPixelPrivacySection, type LegalSlug } from '../src/content/legal';
import { META_PIXEL_ID, isPixelId } from '../src/lib/metaPixel';
describe('legal routes',()=>{
 it.each(Object.keys(legalPages) as LegalSlug[])('%s has distinct content and draft status',slug=>{
  const html=renderToStaticMarkup(createElement(LegalPage,{slug}));
  expect(html).toContain(legalPages[slug].title.replace('&','&amp;'));
  expect(html).toContain('Draft, pending legal review'); expect(html).toContain('2026-11-27'); expect(html).not.toContain('TODO');
 });
 it.each(['terms','privacy'] as LegalSlug[])('%s links the support address',slug=>{
  expect(renderToStaticMarkup(createElement(LegalPage,{slug}))).toContain('href="mailto:support@agentsexchange.ai"');
 });
});
describe('privacy policy and the Meta Pixel',()=>{
 it('describes the pixel exactly when it is switched on',()=>{
  const html=renderToStaticMarkup(createElement(LegalPage,{slug:'privacy'}));
  expect(html.includes('Meta Pixel')).toBe(isPixelId(META_PIXEL_ID));
 });
 it('says what Meta receives, where the pixel stays off and how to opt out',()=>{
  const [heading,body]=metaPixelPrivacySection;
  expect(heading).toBe('Advertising measurement');
  for(const fact of ['measure visits, sign-ups and briefs posted','device and browser','without your name, your email or the brief’s contents or budget','Signed-in pages','iPhone app','Global Privacy Control','Do Not Track','Ad preferences']) expect(body).toContain(fact);
 });
});
