const Serial = (() => {
  let port = null;
  let reader = null;
  let writer = null;
  let readableStream = null;
  let writableStream = null;
  let connected = false;
  let onMessage = null;
  let onDisconnect = null;
  let onConnect = null;

  async function connect(onMsg, onDisc) {
    onMessage = onMsg || onMessage;
    onDisconnect = onDisc || onDisconnect;
    try {
      port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200, dataBits: 8, stopBits: 1, parity: 'none' });
      connected = true;
      if (onConnect) onConnect();
      readableStream = port.readable;
      writableStream = port.writable.getWriter();
      reader = readableStream.getReader();
      readLoop();
      return true;
    } catch (e) {
      console.error('Serial connect error:', e);
      return false;
    }
  }

  async function readLoop() {
    const decoder = new TextDecoderStream();
    const inputDone = port.readable.pipeTo(decoder.writable);
    const reader = decoder.readable.getReader();
    let buffer = '';
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && onMessage) {
            onMessage(trimmed);
          }
        }
      }
    } catch (e) {
      console.error('Read loop error:', e);
    } finally {
      reader.releaseLock();
      disconnect();
      if (onDisconnect) onDisconnect();
    }
  }

  async function send(data) {
    if (!writableStream || !connected) return false;
    try {
      const writer = writableStream;
      await writer.write(new TextEncoder().encode(data + '\n'));
      return true;
    } catch (e) {
      console.error('Send error:', e);
      return false;
    }
  }

  async function sendBytes(bytes) {
    if (!writableStream || !connected) return false;
    try {
      await writableStream.write(bytes);
      return true;
    } catch (e) {
      console.error('Send bytes error:', e);
      return false;
    }
  }

  function disconnect() {
    connected = false;
    if (reader) {
      try { reader.cancel(); } catch (e) {}
      reader = null;
    }
    if (port) {
      try { port.close(); } catch (e) {}
      port = null;
    }
    writableStream = null;
    readableStream = null;
  }

  function isConnected() {
    return connected;
  }

  async function scanBLE(onFound) {
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: ['battery_service'] }],
        optionalServices: ['heart_rate', '0000ffe0-0000-1000-8000-00805f9b34fb']
      });
      const server = await device.gatt.connect();
      const services = await server.getPrimaryServices();
      for (const service of services) {
        const chars = await service.getCharacteristics();
        for (const char of chars) {
          if (char.properties.read) {
            const val = await char.readValue();
            onFound && onFound({
              name: device.name,
              rssi: device.name ? '--' : '--',
              value: new TextDecoder().decode(val)
            });
          }
        }
      }
    } catch (e) {
      console.error('BLE scan error:', e);
    }
  }

  return {
    connect,
    disconnect,
    send,
    sendBytes,
    isConnected,
    scanBLE,
    set onConnect(fn) { onConnect = fn; },
    set onMessage(fn) { onMessage = fn; },
    set onDisconnect(fn) { onDisconnect = fn; }
  };
})();
