import { isValidMindMapData, normalizeMindMapData } from './mindMapData';

const STORAGE_KEY = 'mappa-data';

export const saveToStorage = (nodes, edges, storageKey = STORAGE_KEY) => {
  try {
    const data = JSON.stringify(normalizeMindMapData({ nodes, edges }));
    localStorage.setItem(storageKey || STORAGE_KEY, data);
  } catch (error) {
    console.error('Falha ao salvar no localStorage:', error);
  }
};

export const loadFromStorage = (storageKey = STORAGE_KEY) => {
  try {
    const dataString = localStorage.getItem(storageKey || STORAGE_KEY);
    if (!dataString) return null;
    const data = JSON.parse(dataString);
    return isValidMindMapData(data) ? normalizeMindMapData(data) : null;
  } catch (error) {
    console.error('Falha ao ler do localStorage:', error);
    return null;
  }
};
