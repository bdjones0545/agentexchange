import {createElement} from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {it,expect} from 'vitest';
import {WorkerBadge} from '../src/components/WorkerBadge';
it('exposes the pending glossary definition to keyboard and assistive users',()=>{const html=renderToStaticMarkup(createElement(WorkerBadge));expect(html).toContain('<button');expect(html).toContain('aria-describedby=');expect(html).toContain('role="tooltip"');expect(html).toContain('TODO(owner): definition.');});
