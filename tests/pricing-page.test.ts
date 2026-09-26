import {createElement} from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {MemoryRouter} from 'react-router-dom';import {it,expect} from 'vitest';
import {PricingPage} from '../src/routes/PricingPage';
it('renders the ledger-backed $200 example and the release constraints',()=>{const html=renderToStaticMarkup(createElement(MemoryRouter,null,createElement(PricingPage)));for(const text of ['$200','$206','$170','3%','15%','hold','Only the party that opened it','Early access'])expect(html).toContain(text);expect(html).toContain('href="/refunds"');});
