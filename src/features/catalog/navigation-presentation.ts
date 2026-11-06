import { parseCatalogBackground } from './navigation-state.ts';
import type { CatalogBackground, TreeDisclosure } from './navigation-state.ts';

export function captureCatalogPresentation(container: HTMLElement, href: string, disclosure: TreeDisclosure | undefined,
  active: HTMLElement | null): CatalogBackground | null {
  const control = active && container.contains(active) ? active : null;
  const focusKey = control?.id || (control?.tagName === 'A' ? `link:${control.getAttribute('href')}` : undefined);
  const index = control?.tagName === 'A' && !control.id
    ? [...container.querySelectorAll<HTMLAnchorElement>('a[href]')].filter(link => link.getAttribute('href') === control.getAttribute('href') && link.dataset.catalogFocus === control.dataset.catalogFocus).indexOf(control as HTMLAnchorElement) : -1;
  return parseCatalogBackground({ version: 1, href, scroll: { x: container.scrollLeft, y: container.scrollTop },
    ...(focusKey ? { focusKey, focusControl: control?.dataset.catalogFocus, ...(index >= 0 ? { focusIndex: index } : {}) } : {}), disclosure });
}

/** False means the DOM is still mounting: caller observes mutations, without
 * saving partial scroll or stealing focus before pending branches settle. */
export function restoreCatalogPresentation(container: HTMLElement, presentation: CatalogBackground | undefined,
  resultsLoading: boolean, defaultTarget?: HTMLElement | null): boolean {
  if (resultsLoading || container.querySelector('[data-tree-loading]')) return false;
  if (presentation) {
    let focus: HTMLElement | null = null;
    if (presentation.focusKey?.startsWith('link:')) {
      focus = [...container.querySelectorAll<HTMLAnchorElement>('a[href]')].filter(link =>
        `link:${link.getAttribute('href')}` === presentation.focusKey
          && (!presentation.focusControl || link.dataset.catalogFocus === presentation.focusControl))[presentation.focusIndex ?? 0] ?? null;
    } else if (presentation.focusKey) focus = container.ownerDocument.getElementById(presentation.focusKey);
    if (focus && (focus.closest('[hidden]') || !container.contains(focus))) focus = null;
    (focus ?? container).focus({ preventScroll: true });
    container.scrollTo(presentation.scroll.x, presentation.scroll.y);
  } else if (defaultTarget) {
    defaultTarget.focus({ preventScroll: true }); defaultTarget.scrollIntoView({ block: 'start' });
  } else return false;
  return true;
}
