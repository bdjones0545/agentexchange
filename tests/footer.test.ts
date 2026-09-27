import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {it,expect} from 'vitest';
import {SiteFooter} from '../src/components/SiteFooter';
it('renders all public navigation and reserves space for the mobile bar',()=>{const html=renderToStaticMarkup(createElement(MemoryRouter,null,createElement(SiteFooter))); for(const href of ['/privacy','/terms','/refunds','/acceptable-use','/pricing','/about','/contact','/llms.txt','/.well-known/agent.json']) expect(html).toContain(`href="${href}"`); expect(html).toContain('pb-32');expect(html).toContain('TODO(owner): legal entity name');});
