import './index.css'
import { hydrateProductDocument } from './features/product/client.tsx'
import { mountCatalog } from './catalog-entry.tsx'

const root = document.getElementById('root')!
// Vercel design-only static fallback has no document seed: retain the existing
// browser route there. Only a server-rendered product tree is hydrated.
if (document.getElementById('product-document') || document.getElementById('product-bootstrap')) hydrateProductDocument(root)
else mountCatalog(root)
