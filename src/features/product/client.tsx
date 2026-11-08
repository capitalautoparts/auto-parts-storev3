import { useEffect } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { ProductDocument } from './ProductDocument.tsx';
import { parseProductDocument, PRODUCT_BOOTSTRAP_ID, type ProductDocument as DocumentData } from '../../../server/product-document.ts';

function EnhancedDocument({ document }: { document: DocumentData }) {
  useEffect(() => {
    // This root owns only its initial document. Native history changes must
    // load their actual document instead of retaining this SKU's content.
    const navigate = () => {
      if (window.location.pathname !== document.path) window.location.reload();
    };
    window.addEventListener('popstate', navigate);
    let disposed = false;
    let unmount: (() => void) | undefined;
    if (document.status === 200) {
      void import('./actions.tsx').then(({ mountProductActions }) => {
        const node = window.document.getElementById('product-actions');
        if (!disposed && node) unmount = mountProductActions(node, document.product);
      }).catch(() => { /* The readable document and native catalog link remain. */ });
    }
    return () => { disposed = true; window.removeEventListener('popstate', navigate); unmount?.(); };
  }, [document]);
  return <ProductDocument document={document} />;
}

export function hydrateProductDocument(root: HTMLElement) {
  const nodes = window.document.querySelectorAll<HTMLScriptElement>(`#${PRODUCT_BOOTSTRAP_ID}`);
  const script = nodes[0];
  const document = nodes.length === 1 && script?.type === 'application/json'
    ? parseProductDocument(script.textContent ?? '', window.location.pathname) : null;
  if (!document) {
    // Do not erase verified server content or turn an invalid seed into a
    // request. Recovery is a normal fresh navigation through the HTTP gate.
    const note = window.document.createElement('p');
    note.setAttribute('role', 'status');
    note.textContent = 'Interactive product controls are unavailable. Reload this page or browse the catalog.';
    root.append(note);
    return;
  }
  hydrateRoot(root, <EnhancedDocument document={document} />);
}
