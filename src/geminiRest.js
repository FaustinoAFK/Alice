// Cliente HTTP para Gemini API - Alternativa estavel ao WebSocket
// Usa chamadas REST tradicionais em vez de conexao persistente

export const GEMINI_REST_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

export const buildGeminiRestUrl = (apiKey) => `${GEMINI_REST_URL}?key=${encodeURIComponent(apiKey)}`;

export const buildRestRequestBody = ({ turns, systemInstruction = null, tools = null }) => {
  const body = {
    contents: turns,
    generationConfig: {
      responseModalities: ['TEXT'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: 'Puck'
          }
        }
      }
    }
  };

  if (systemInstruction) {
    body.systemInstruction = systemInstruction;
  }

  if (tools) {
    body.tools = tools;
  }

  return body;
};

export const buildRestTurns = ({ 
  userText = null, 
  audioBase64 = null,
  previousTurns = [],
  toolResponses = []
}) => {
  const turns = [...previousTurns];

  // Adiciona respostas de ferramentas se houver
  if (toolResponses.length > 0) {
    turns.push({
      role: 'user',
      parts: toolResponses.map(resp => ({
        functionResponse: {
          name: resp.name,
          response: { result: resp.result }
        }
      }))
    });
  }

  // Adiciona mensagem do usuario
  if (userText || audioBase64) {
    const parts = [];
    if (userText) {
      parts.push({ text: userText });
    }
    if (audioBase64) {
      parts.push({
        inlineData: {
          mimeType: 'audio/pcm;rate=16000',
          data: audioBase64
        }
      });
    }
    turns.push({
      role: 'user',
      parts
    });
  }

  return turns;
};

export const parseRestResponse = async (response) => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message || 
      `Erro HTTP ${response.status}: ${response.statusText}`
    );
  }

  const data = await response.json();
  
  // Extrai texto da resposta
  const candidates = data.candidates || [];
  if (candidates.length === 0) {
    return {
      text: '',
      toolCalls: [],
      finishReason: 'STOP'
    };
  }

  const candidate = candidates[0];
  const parts = candidate.content?.parts || [];
  
  const textParts = parts.filter(p => p.text).map(p => p.text).join('');
  const toolCalls = parts
    .filter(p => p.functionCall)
    .map(p => p.functionCall);

  return {
    text: textParts,
    toolCalls,
    finishReason: candidate.finishReason || 'STOP'
  };
};

export class GeminiRestClient {
  constructor({ apiKey, onStatus = () => {}, onError = () => {} }) {
    this.apiKey = apiKey;
    this.onStatus = onStatus;
    this.onError = onError;
    this.baseUrl = buildGeminiRestUrl(apiKey);
    this.conversationHistory = [];
    this.isProcessing = false;
    this.systemInstruction = null;
    this.tools = null;
  }

  setSystemInstruction(instruction) {
    this.systemInstruction = instruction;
  }

  setTools(tools) {
    this.tools = tools;
  }

  async sendText(text) {
    if (this.isProcessing) {
      throw new Error('Ja existe uma requisicao em andamento.');
    }

    this.isProcessing = true;
    this.onStatus('sending');

    try {
      const turns = buildRestTurns({
        userText: text,
        previousTurns: this.conversationHistory
      });

      const requestBody = buildRestRequestBody({
        turns,
        systemInstruction: this.systemInstruction,
        tools: this.tools
      });

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      const result = await parseRestResponse(response);
      
      // Atualiza historico
      this.conversationHistory = [
        ...turns,
        {
          role: 'model',
          parts: [
            ...(result.text ? [{ text: result.text }] : []),
            ...result.toolCalls.map(tc => ({ functionCall: tc }))
          ]
        }
      ];

      // Mantem apenas ultimas 10 trocas para nao crescer demais
      if (this.conversationHistory.length > 20) {
        this.conversationHistory = this.conversationHistory.slice(-20);
      }

      this.onStatus('idle');
      return result;
    } catch (error) {
      this.onError(error);
      this.onStatus('error');
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  async sendToolResponse(toolResponses) {
    if (this.isProcessing) {
      throw new Error('Ja existe uma requisicao em andamento.');
    }

    this.isProcessing = true;
    this.onStatus('sending');

    try {
      const turns = buildRestTurns({
        toolResponses,
        previousTurns: this.conversationHistory
      });

      const requestBody = buildRestRequestBody({
        turns,
        systemInstruction: this.systemInstruction,
        tools: this.tools
      });

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      const result = await parseRestResponse(response);
      
      // Atualiza historico
      this.conversationHistory = [
        ...turns,
        {
          role: 'model',
          parts: [
            ...(result.text ? [{ text: result.text }] : []),
            ...result.toolCalls.map(tc => ({ functionCall: tc }))
          ]
        }
      ];

      this.onStatus('idle');
      return result;
    } catch (error) {
      this.onError(error);
      this.onStatus('error');
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  clearHistory() {
    this.conversationHistory = [];
  }

  getHistory() {
    return [...this.conversationHistory];
  }
}

// Funcao utilitaria para chamada rapida
export const geminiRestChat = async ({ 
  apiKey, 
  message, 
  history = [],
  systemInstruction = null,
  tools = null
}) => {
  const client = new GeminiRestClient({ 
    apiKey,
    onStatus: () => {},
    onError: () => {}
  });
  
  client.setSystemInstruction(systemInstruction);
  client.setTools(tools);
  client.conversationHistory = history;
  
  return client.sendText(message);
};
