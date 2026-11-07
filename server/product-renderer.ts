import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { ProductDocument } from '../src/features/product/ProductDocument.tsx';
import type { ProductDocument as DocumentData } from './product-document.ts';

export function renderProductDocument(document: DocumentData): string {
  return renderToString(createElement(ProductDocument, { document }));
}
