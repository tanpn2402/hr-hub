import { useEffect } from 'react';

/** Points the head element at `value` (creating it when missing); returns a function that restores the previous state. */
function setHeadElement(selector: string, create: () => HTMLElement, attribute: string, value: string) {
  let element = document.head.querySelector<HTMLElement>(selector);
  const created = !element;
  if (!element) {
    element = create();
    document.head.appendChild(element);
  }
  const previous = element.getAttribute(attribute);
  element.setAttribute(attribute, value);

  return () => {
    if (created) element.remove();
    else if (previous === null) element.removeAttribute(attribute);
    else element.setAttribute(attribute, previous);
  };
}

/** Browser tab title, favicon and meta description while a web app is open; HR Hub's own are restored afterwards. */
export function useDocumentHead(head: { title?: string; description?: string | null; iconUrl?: string | null }) {
  const { title, description, iconUrl } = head;

  useEffect(() => {
    if (!title) return;
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);

  useEffect(() => {
    if (!description) return;
    return setHeadElement(
      'meta[name="description"]',
      () => Object.assign(document.createElement('meta'), { name: 'description' }),
      'content',
      description,
    );
  }, [description]);

  useEffect(() => {
    if (!iconUrl) return;
    const restoreHref = setHeadElement(
      'link[rel="icon"]',
      () => Object.assign(document.createElement('link'), { rel: 'icon' }),
      'href',
      iconUrl,
    );
    // HR Hub's favicon declares type="image/svg+xml"; the app's may be PNG/ICO, so let the browser sniff it.
    const restoreType = setHeadElement('link[rel="icon"]', () => document.createElement('link'), 'type', '');
    return () => {
      restoreType();
      restoreHref();
    };
  }, [iconUrl]);
}
