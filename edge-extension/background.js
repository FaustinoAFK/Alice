import { createRecentRequestTracker, parseSseMessages } from './captureEvents.js';

const BRIDGE_PAGE_STATE_URL = 'http://127.0.0.1:38947/v1/page-state';
const BRIDGE_CAPTURE_REQUEST_URL = 'http://127.0.0.1:38947/v1/capture-request';
const BRIDGE_CAPTURE_EVENTS_URL = 'http://127.0.0.1:38947/v1/capture-events';
const CAPTURE_ALARM_NAME = 'alice-web-knowledge-capture';
const CAPTURE_PERIOD_MINUTES = 0.05;
const CAPTURE_REQUEST_POLL_MS = 3000;
const CAPTURE_EVENTS_RECONNECT_MS = 1000;

let pendingCapturePollTimer = null;
let captureEventsReconnectTimer = null;
let captureEventsAbortController = null;
let captureEventsConnected = false;

const recentRequestTracker = createRecentRequestTracker(100);

const shouldSkipUrl = (url = '') =>
  !url ||
  url.startsWith('edge://') ||
  url.startsWith('chrome://') ||
  url.startsWith('about:') ||
  url.startsWith('file://');

function collectPageKnowledge() {
  const MAX_SECTION_CONTENT = 1800;
  const MAX_VISIBLE_TEXT_CHARS = 9000;
  const MAX_LINKS = 60;
  const MAX_INTERACTIVE_LABELS = 60;

  const normalize = (value = '') =>
    String(value || '')
      .replace(/\s+/g, ' ')
      .trim();

  const truncate = (value = '', maxLength = MAX_SECTION_CONTENT) => {
    const normalized = normalize(value);
    if (normalized.length <= maxLength) {
      return normalized;
    }

    return `${normalized.slice(0, maxLength - 1).trim()}...`;
  };

  const absoluteUrl = (value) => {
    try {
      return new URL(value, window.location.href).toString();
    } catch {
      return '';
    }
  };

  const isVisible = (node) => {
    if (!node || !(node instanceof Element)) {
      return false;
    }

    const style = window.getComputedStyle(node);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.opacity === '0' ||
      node.closest('[hidden], [aria-hidden="true"]')
    ) {
      return false;
    }

    const rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

  const elementLabel = (node) =>
    normalize(
      node?.getAttribute?.('aria-label') ||
        node?.getAttribute?.('title') ||
        node?.getAttribute?.('alt') ||
        node?.getAttribute?.('placeholder') ||
        node?.textContent ||
        node?.value ||
        '',
    );

  const uniqueBy = (items, keyGetter) => {
    const seen = new Set();
    return items.filter((item) => {
      const key = keyGetter(item);
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  };

  const sections = [];
  const pushSection = (kind, heading, content) => {
    const normalizedContent = truncate(content);
    const normalizedHeading = normalize(heading);
    if (!normalizedHeading && !normalizedContent) {
      return;
    }

    sections.push({
      id: `section-${sections.length + 1}`,
      kind,
      heading: normalizedHeading,
      content: normalizedContent,
    });
  };

  const pushVisibleTextChunks = (text) => {
    const normalized = truncate(text, MAX_VISIBLE_TEXT_CHARS);
    if (!normalized) {
      return;
    }

    const sentences = normalized
      .split(/(?<=[.!?])\s+/)
      .map((item) => item.trim())
      .filter(Boolean);

    let chunk = '';
    for (const sentence of sentences) {
      const next = `${chunk} ${sentence}`.trim();
      if (next.length > MAX_SECTION_CONTENT) {
        pushSection('visible_text', '', chunk);
        chunk = sentence;
      } else {
        chunk = next;
      }
    }

    if (chunk) {
      pushSection('visible_text', '', chunk);
    }
  };

  const mainRoot =
    document.querySelector('main') ||
    document.querySelector('article') ||
    document.querySelector('[role="main"]') ||
    document.body;

  const metaDescription =
    document.querySelector("meta[name='description']")?.getAttribute('content') || '';
  const canonicalUrl = document.querySelector("link[rel='canonical']")?.getAttribute('href') || '';
  const openGraphTitle = document.querySelector("meta[property='og:title']")?.getAttribute('content') || '';
  const openGraphDescription =
    document.querySelector("meta[property='og:description']")?.getAttribute('content') || '';

  pushSection(
    'page_overview',
    document.title || openGraphTitle || 'Pagina atual',
    [
      metaDescription || openGraphDescription,
      canonicalUrl ? `Canonical: ${absoluteUrl(canonicalUrl)}` : '',
      `URL: ${window.location.href}`,
      `Idioma: ${document.documentElement?.lang || 'nao informado'}`,
    ]
      .filter(Boolean)
      .join(' | '),
  );

  const visibleText = normalize(mainRoot?.innerText || document.body?.innerText || '');
  pushVisibleTextChunks(visibleText);

  [...mainRoot.querySelectorAll('h1, h2, h3, h4, h5, h6')]
    .filter(isVisible)
    .slice(0, 24)
    .forEach((node) => {
      const relatedText = [];
      let sibling = node.nextElementSibling;
      while (sibling && relatedText.length < 3) {
        if (isVisible(sibling) && /^(P|UL|OL|DIV|SECTION|ARTICLE)$/i.test(sibling.tagName)) {
          const text = normalize(sibling.innerText || sibling.textContent || '');
          if (text) {
            relatedText.push(text);
          }
        }
        sibling = sibling.nextElementSibling;
      }

      pushSection(node.tagName.toLowerCase(), node.textContent || '', relatedText.join(' '));
    });

  [...mainRoot.querySelectorAll('p, blockquote, pre')]
    .filter(isVisible)
    .slice(0, 30)
    .forEach((node) => {
      pushSection(node.tagName.toLowerCase(), '', node.textContent || '');
    });

  [...mainRoot.querySelectorAll('ul, ol')]
    .filter(isVisible)
    .slice(0, 10)
    .forEach((list) => {
      const items = [...list.querySelectorAll('li')]
        .map((item) => normalize(item.textContent || ''))
        .filter(Boolean)
        .slice(0, 8);
      if (items.length > 0) {
        pushSection('list', '', items.join(' | '));
      }
    });

  [...mainRoot.querySelectorAll('table')]
    .filter(isVisible)
    .slice(0, 6)
    .forEach((table) => {
      const rows = [...table.querySelectorAll('tr')]
        .map((row) =>
          [...row.querySelectorAll('th, td')]
            .map((cell) => normalize(cell.textContent || ''))
            .filter(Boolean)
            .join(' | '),
        )
        .filter(Boolean)
        .slice(0, 6);
      if (rows.length > 0) {
        pushSection('table', '', rows.join(' || '));
      }
    });

  [...mainRoot.querySelectorAll('form')]
    .filter(isVisible)
    .slice(0, 8)
    .forEach((form, index) => {
      const fields = [...form.querySelectorAll('input, textarea, select, button')]
        .filter(isVisible)
        .map((field) => {
          const name = field.getAttribute('name') || field.getAttribute('id') || '';
          const type = field.getAttribute('type') || field.tagName.toLowerCase();
          const label = elementLabel(field);
          return normalize([type, name, label].filter(Boolean).join(': '));
        })
        .filter(Boolean)
        .slice(0, 20);

      if (fields.length > 0) {
        pushSection('form', `Formulario ${index + 1}`, fields.join(' | '));
      }
    });

  [...mainRoot.querySelectorAll('[role="dialog"], dialog, aside, nav')]
    .filter(isVisible)
    .slice(0, 8)
    .forEach((node) => {
      const label = elementLabel(node) || node.tagName.toLowerCase();
      pushSection('page_region', label, node.innerText || node.textContent || '');
    });

  [...mainRoot.querySelectorAll('img')]
    .filter(isVisible)
    .slice(0, 20)
    .forEach((image) => {
      const alt = elementLabel(image);
      const src = absoluteUrl(image.getAttribute('src') || image.currentSrc || '');
      if (alt || src) {
        pushSection('image', alt || 'Imagem', src);
      }
    });

  const links = uniqueBy(
    [...mainRoot.querySelectorAll('a[href]')]
      .filter(isVisible)
      .map((link) => {
        const url = absoluteUrl(link.getAttribute('href'));
        const text = normalize(
          link.textContent ||
            link.getAttribute('aria-label') ||
            link.getAttribute('title') ||
            link.querySelector('img')?.getAttribute('alt') ||
            url,
        );
        return { text, url };
      })
      .filter((link) => link.text && link.url),
    (link) => `${link.text}\n${link.url}`,
  ).slice(0, MAX_LINKS);

  const interactiveLabels = uniqueBy(
    [
      ...mainRoot.querySelectorAll(
        'button, label, input, textarea, select, summary, [role="button"], [role="link"], [role="menuitem"], [tabindex]',
      ),
    ]
      .filter(isVisible)
      .map((node) => {
        const tag = node.tagName.toLowerCase();
        const type = node.getAttribute('type');
        const label = elementLabel(node);
        return normalize([tag, type, label].filter(Boolean).join(': '));
      }),
    (label) => label,
  )
    .filter(Boolean)
    .slice(0, MAX_INTERACTIVE_LABELS);

  return {
    navigationContext: {
      url: window.location.href,
      domain: window.location.hostname,
      title: document.title || '',
      selectionText: normalize(window.getSelection?.().toString() || ''),
      timestamp: Date.now(),
    },
    snapshot: {
      url: window.location.href,
      title: document.title || '',
      metaDescription: metaDescription || openGraphDescription,
      documentLanguage: document.documentElement?.lang || '',
      selectedText: normalize(window.getSelection?.().toString() || ''),
      interactiveLabels,
      sections,
      links,
      timestamp: Date.now(),
    },
  };
}

const postPageState = async (pageState) => {
  await fetch(BRIDGE_PAGE_STATE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(pageState),
  });
};

const queryActiveTab = async () => {
  const tabs = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });
  return tabs[0] || null;
};

const fetchPendingCaptureRequest = async () => {
  try {
    const response = await fetch(BRIDGE_CAPTURE_REQUEST_URL, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });
    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    return payload?.pendingRequest || null;
  } catch {
    return null;
  }
};

const captureActiveTabState = async ({
  requestId = null,
  transport = 'passive_extension',
} = {}) => {
  const activeTab = await queryActiveTab();
  if (!activeTab?.id || shouldSkipUrl(activeTab.url)) {
    return false;
  }

  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: collectPageKnowledge,
    });

    if (result?.result) {
      await postPageState({
        ...result.result,
        requestId: requestId || undefined,
        transport,
      });
      return true;
    }
  } catch {
    // Ignore capture failures for restricted or transient pages.
  }

  return false;
};

const handleCaptureRequest = async (request, transport) => {
  const requestId = String(request?.requestId || request?.request_id || '').trim();
  if (!requestId || !recentRequestTracker.begin(requestId)) {
    return false;
  }

  try {
    const ok = await captureActiveTabState({
      requestId,
      transport,
    });

    if (ok) {
      recentRequestTracker.complete(requestId);
      return true;
    }

    recentRequestTracker.fail(requestId);
    return false;
  } catch {
    recentRequestTracker.fail(requestId);
    return false;
  }
};

const processPendingCaptureRequest = async () => {
  const pendingRequest = await fetchPendingCaptureRequest();
  if (!pendingRequest?.requestId) {
    return false;
  }

  return handleCaptureRequest(pendingRequest, 'polling_fallback');
};

const runCaptureCycle = async ({
  allowPassiveCapture = false,
  allowPendingCaptureFallback = true,
} = {}) => {
  if (allowPendingCaptureFallback && !captureEventsConnected) {
    const resolvedPendingRequest = await processPendingCaptureRequest();
    if (resolvedPendingRequest) {
      return;
    }
  }

  if (allowPassiveCapture) {
    await captureActiveTabState({
      transport: 'passive_extension',
    });
  }
};

const schedulePendingCapturePolling = () => {
  if (pendingCapturePollTimer) {
    return;
  }

  const tick = async () => {
    pendingCapturePollTimer = null;
    await runCaptureCycle({
      allowPassiveCapture: false,
      allowPendingCaptureFallback: true,
    });
    schedulePendingCapturePolling();
  };

  pendingCapturePollTimer = setTimeout(() => {
    void tick();
  }, CAPTURE_REQUEST_POLL_MS);
};

const scheduleCaptureEventsReconnect = () => {
  if (captureEventsReconnectTimer) {
    return;
  }

  captureEventsReconnectTimer = setTimeout(() => {
    captureEventsReconnectTimer = null;
    void startCaptureEventsListener();
  }, CAPTURE_EVENTS_RECONNECT_MS);
};

const consumeCaptureEventsStream = async () => {
  captureEventsAbortController = new AbortController();
  let remainder = '';

  try {
    const response = await fetch(BRIDGE_CAPTURE_EVENTS_URL, {
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
      },
      cache: 'no-store',
      signal: captureEventsAbortController.signal,
    });
    if (!response.ok || !response.body) {
      throw new Error('capture_event_stream_unavailable');
    }

    captureEventsConnected = true;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        remainder = '';
        break;
      }

      remainder += decoder.decode(value, { stream: true });
      const parsed = parseSseMessages(remainder);
      remainder = parsed.remainder;

      for (const message of parsed.messages) {
        if (message.event === 'capture_request') {
          await handleCaptureRequest(message.data, 'reactive_sse');
        }
      }
    }
  } catch {
    // The reconnect scheduler below will restore the listener.
  } finally {
    captureEventsConnected = false;
    captureEventsAbortController = null;
    scheduleCaptureEventsReconnect();
  }
};

const startCaptureEventsListener = async () => {
  if (captureEventsAbortController) {
    return;
  }

  await consumeCaptureEventsStream();
};

const ensureCaptureInfra = () => {
  chrome.alarms.create(CAPTURE_ALARM_NAME, {
    periodInMinutes: CAPTURE_PERIOD_MINUTES,
  });
  schedulePendingCapturePolling();
  void startCaptureEventsListener();
};

chrome.runtime.onInstalled.addListener(() => {
  ensureCaptureInfra();
});

chrome.runtime.onStartup.addListener(() => {
  ensureCaptureInfra();
  void runCaptureCycle({ allowPassiveCapture: true });
});

chrome.tabs.onActivated.addListener(() => {
  void runCaptureCycle({ allowPassiveCapture: true });
});

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if ((changeInfo.status === 'complete' || changeInfo.url) && !shouldSkipUrl(tab.url)) {
    void runCaptureCycle({ allowPassiveCapture: true });
  }
});

chrome.windows.onFocusChanged.addListener(() => {
  void runCaptureCycle({ allowPassiveCapture: true });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === CAPTURE_ALARM_NAME) {
    void runCaptureCycle({ allowPassiveCapture: true });
  }
});

ensureCaptureInfra();
