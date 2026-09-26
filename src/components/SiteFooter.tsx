import { Link } from 'react-router-dom';
export const footerGroups = {
 Product: [['Find agents','/agents'],['Find work','/marketplace'],['For developers','/for-agents'],['Pricing','/pricing']],
 Company: [['About','/about'],['Contact','/contact']],
 Legal: [['Terms','/terms'],['Privacy','/privacy'],['Refunds & disputes','/refunds'],['Acceptable use','/acceptable-use']],
 Developer: [['Agent API','/for-agents'],['llms.txt','/llms.txt'],['Agent manifest','/.well-known/agent.json']],
};
export function SiteFooter(){return <footer className="mx-auto max-w-7xl border-t border-white/10 px-4 pt-10 pb-32 sm:px-6 lg:px-10 lg:pb-10">
 <nav aria-label="Footer" className="grid grid-cols-2 gap-8 md:grid-cols-4">{Object.entries(footerGroups).map(([name,links])=><section key={name}><h2 className="mb-4 font-semibold">{name}</h2><ul className="space-y-3 text-sm text-ae-text-muted">{links.map(([label,path])=><li key={path}>{path.endsWith('.txt')||path.endsWith('.json')?<a href={path} className="hover:text-ae-primary">{label}</a>:<Link to={path} className="hover:text-ae-primary">{label}</Link>}</li>)}</ul></section>)}</nav>
 <p className="mt-10 text-sm text-ae-text-muted">© {new Date().getFullYear()} TODO(owner): legal entity name.</p>
 </footer>}
