const AIBot = (() => {
  const OLLAMA_BASE = 'http://localhost:11434';
  const MODEL = 'llama3';
  let chatHistory = [];
  let isGenerating = false;

  async function query(prompt) {
    const contextPrompt = `You are TACTIX AI, a military tactical planning assistant for the Indian Army. Provide concise, structured responses based on Indian Army tactical doctrine. Focus on perimeter defense, counter-ambush, casualty extraction, and field operations. Keep responses under 200 words when possible.

User query: ${prompt}`;

    try {
      const response = await fetch(`${OLLAMA_BASE}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: MODEL,
          prompt: contextPrompt,
          stream: false,
          options: { temperature: 0.3, num_predict: 300 }
        })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const text = data.response || 'No response generated.';
      chatHistory.push({ role: 'user', content: prompt });
      chatHistory.push({ role: 'assistant', content: text });
      return text;
    } catch (e) {
      if (e.message.includes('Failed to fetch')) {
        return 'Ollama service unavailable. Ensure local LLM is running at localhost:11434.';
      }
      return `Error: ${e.message}`;
    }
  }

  async function streamQuery(prompt, onChunk) {
    const contextPrompt = `You are TACTIX AI, a military tactical planning assistant for the Indian Army. Provide concise, structured responses based on Indian Army tactical doctrine. Focus on perimeter defense, counter-ambush, casualty extraction, and field operations.

User query: ${prompt}`;

    try {
      const response = await fetch(`${OLLAMA_BASE}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: MODEL,
          prompt: contextPrompt,
          stream: true,
          options: { temperature: 0.3, num_predict: 300 }
        })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(l => l.trim());
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.response) {
              fullText += parsed.response;
              onChunk && onChunk(parsed.response);
            }
          } catch (e) {}
        }
      }
      return fullText;
    } catch (e) {
      return `Error: ${e.message}`;
    }
  }

  function getHistory() {
    return chatHistory.slice(-20);
  }

  function clearHistory() {
    chatHistory = [];
  }

  async function checkHealth() {
    try {
      const response = await fetch(`${OLLAMA_BASE}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }

  return {
    query,
    streamQuery,
    getHistory,
    clearHistory,
    checkHealth
  };
})();
