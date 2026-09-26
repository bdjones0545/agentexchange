import type {PageMetadata} from '../content/metadata';
export function PageHead({meta}:{meta:PageMetadata}){return <><title>{meta.title}</title><meta name="description" content={meta.description}/><link rel="canonical" href={meta.canonical}/>{meta.noindex&&<meta name="robots" content="noindex"/>}</>}
