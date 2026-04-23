import { createWorker, PSM } from 'tesseract.js';

let sharedWorkerPromise = null;

export const normalizeOcrText = (text) =>
  String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const tokenizeOcrTarget = (targetText) =>
  normalizeOcrText(targetText)
    .split(' ')
    .filter((token) => token.length > 1);

const mergeBoxes = (boxes) => ({
  x0: Math.min(...boxes.map((box) => box.x0)),
  y0: Math.min(...boxes.map((box) => box.y0)),
  x1: Math.max(...boxes.map((box) => box.x1)),
  y1: Math.max(...boxes.map((box) => box.y1)),
});

const buildLocatedTextMatch = (words, targetText, bbox) => ({
  text: targetText,
  bbox,
  normalizedX: Math.round((((bbox.x0 + bbox.x1) / 2) / Math.max(1, words.canvasWidth)) * 1000),
  normalizedY: Math.round((((bbox.y0 + bbox.y1) / 2) / Math.max(1, words.canvasHeight)) * 1000),
});

const prepareWordEntries = (words, canvasWidth, canvasHeight) =>
  (Array.isArray(words) ? words : [])
    .map((word, index) => ({
      index,
      text: normalizeOcrText(word?.text),
      bbox: word?.bbox,
      canvasWidth,
      canvasHeight,
    }))
    .filter(
      (word) =>
        word.text &&
        word.bbox &&
        Number.isFinite(word.bbox.x0) &&
        Number.isFinite(word.bbox.y0) &&
        Number.isFinite(word.bbox.x1) &&
        Number.isFinite(word.bbox.y1),
    );

export const findOcrTextMatch = (words, targetText, canvasWidth, canvasHeight) => {
  const target = normalizeOcrText(targetText);
  if (!target) {
    return null;
  }

  const entries = prepareWordEntries(words, canvasWidth, canvasHeight);
  if (entries.length === 0) {
    return null;
  }

  for (let startIndex = 0; startIndex < entries.length; startIndex += 1) {
    let phrase = '';
    const matched = [];

    for (let endIndex = startIndex; endIndex < entries.length; endIndex += 1) {
      phrase = phrase ? `${phrase} ${entries[endIndex].text}` : entries[endIndex].text;
      matched.push(entries[endIndex]);

      if (phrase === target || (phrase.length >= target.length && phrase.includes(target))) {
        return buildLocatedTextMatch(
          {
            canvasWidth,
            canvasHeight,
          },
          targetText,
          mergeBoxes(matched.map((entry) => entry.bbox)),
        );
      }

      if (phrase.length > target.length + 20) {
        break;
      }
    }
  }

  const tokens = tokenizeOcrTarget(targetText);
  if (tokens.length === 0) {
    return null;
  }

  const matchedEntries = [];
  for (const token of tokens) {
    const matched = entries.find((entry) => entry.text.includes(token) || token.includes(entry.text));
    if (!matched) {
      return null;
    }

    matchedEntries.push(matched);
  }

  return buildLocatedTextMatch(
    {
      canvasWidth,
      canvasHeight,
    },
    targetText,
    mergeBoxes(matchedEntries.map((entry) => entry.bbox)),
  );
};

export const createTesseractOcrEngine = ({ logger = () => {}, languages = ['por', 'eng'] } = {}) => {
  let workerPromise = null;

  const getWorker = async () => {
    if (!workerPromise) {
      workerPromise = createWorker(languages, 1, { logger }).then(async (worker) => {
        await worker.setParameters({
          tessedit_pageseg_mode: PSM.SPARSE_TEXT,
        });
        return worker;
      });
    }

    return workerPromise;
  };

  return {
    async recognize(image) {
      const worker = await getWorker();
      return worker.recognize(image);
    },
    async terminate() {
      if (!workerPromise) {
        return;
      }

      const worker = await workerPromise;
      await worker.terminate();
      workerPromise = null;
    },
  };
};

const getSharedOcrEngine = () => {
  if (!sharedWorkerPromise) {
    sharedWorkerPromise = Promise.resolve(createTesseractOcrEngine());
  }

  return sharedWorkerPromise;
};

export const locateTextInCanvas = async (canvas, targetText, ocrEngine = null) => {
  const canvasWidth = Number(canvas?.width || 0);
  const canvasHeight = Number(canvas?.height || 0);
  if (!canvas || !canvasWidth || !canvasHeight) {
    return null;
  }

  const engine = ocrEngine || (await getSharedOcrEngine());
  const result = await engine.recognize(canvas);
  return findOcrTextMatch(result?.data?.words || [], targetText, canvasWidth, canvasHeight);
};
