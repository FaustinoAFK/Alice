export const parseSseMessages = (buffer = '') => {
  const normalizedBuffer = String(buffer || '').replace(/\r\n/g, '\n');
  const frames = normalizedBuffer.split('\n\n');
  const remainder = frames.pop() || '';
  const messages = [];

  for (const frame of frames) {
    const trimmedFrame = frame.trim();
    if (!trimmedFrame) {
      continue;
    }

    let event = 'message';
    const dataLines = [];

    for (const line of trimmedFrame.split('\n')) {
      if (line.startsWith('event:')) {
        event = line.slice('event:'.length).trim() || 'message';
        continue;
      }

      if (line.startsWith('data:')) {
        dataLines.push(line.slice('data:'.length).trim());
      }
    }

    if (dataLines.length === 0) {
      continue;
    }

    const rawData = dataLines.join('\n');
    let data = rawData;

    try {
      data = JSON.parse(rawData);
    } catch {
      // Keep the raw payload when the event data is not JSON.
    }

    messages.push({
      event,
      data,
      rawData,
    });
  }

  return {
    messages,
    remainder,
  };
};

export const createRecentRequestTracker = (limit = 100) => {
  const normalizedLimit = Math.max(1, Math.round(Number(limit) || 100));
  const inFlight = new Set();
  const completedOrder = [];
  const completedSet = new Set();

  const trimCompleted = () => {
    while (completedOrder.length > normalizedLimit) {
      const oldest = completedOrder.shift();
      if (oldest) {
        completedSet.delete(oldest);
      }
    }
  };

  return {
    isTracked(requestId) {
      const normalizedRequestId = String(requestId || '').trim();
      return Boolean(
        normalizedRequestId &&
          (inFlight.has(normalizedRequestId) || completedSet.has(normalizedRequestId)),
      );
    },
    begin(requestId) {
      const normalizedRequestId = String(requestId || '').trim();
      if (!normalizedRequestId || inFlight.has(normalizedRequestId) || completedSet.has(normalizedRequestId)) {
        return false;
      }

      inFlight.add(normalizedRequestId);
      return true;
    },
    complete(requestId) {
      const normalizedRequestId = String(requestId || '').trim();
      if (!normalizedRequestId) {
        return;
      }

      inFlight.delete(normalizedRequestId);
      completedSet.add(normalizedRequestId);
      completedOrder.push(normalizedRequestId);
      trimCompleted();
    },
    fail(requestId) {
      const normalizedRequestId = String(requestId || '').trim();
      if (!normalizedRequestId) {
        return;
      }

      inFlight.delete(normalizedRequestId);
    },
  };
};
