const Proto = (() => {
  const MESSAGE_TYPES = {
    TELEMETRY: 0x01,
    MESSAGE: 0x02,
    SOS: 0x03,
    CONFIG: 0x04,
    ACK: 0x05,
    HEARTBEAT: 0x06
  };

  function packTelemetry(roleId, lat, lng, beaconId, status) {
    const buffer = new ArrayBuffer(12);
    const view = new DataView(buffer);
    view.setUint8(0, roleId & 0xFF);
    view.setFloat32(1, lat, true);
    view.setFloat32(5, lng, true);
    view.setUint16(9, beaconId & 0xFFFF, true);
    view.setUint8(11, status & 0xFF);
    return new Uint8Array(buffer);
  }

  function unpackTelemetry(bytes) {
    if (bytes.length < 12) return null;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return {
      roleId: view.getUint8(0),
      lat: view.getFloat32(1, true),
      lng: view.getFloat32(5, true),
      beaconId: view.getUint16(9, true),
      status: view.getUint8(11)
    };
  }

  function packMessage(type, payload) {
    if (typeof payload === 'string') {
      const encoder = new TextEncoder();
      const strBytes = encoder.encode(payload);
      const buffer = new ArrayBuffer(2 + strBytes.length);
      const view = new DataView(buffer);
      view.setUint8(0, type);
      view.setUint8(1, strBytes.length);
      const arr = new Uint8Array(buffer);
      arr.set(strBytes, 2);
      return arr;
    }
    if (payload instanceof Uint8Array) {
      const buffer = new ArrayBuffer(2 + payload.length);
      const view = new DataView(buffer);
      view.setUint8(0, type);
      view.setUint8(1, payload.length);
      const arr = new Uint8Array(buffer);
      arr.set(payload, 2);
      return arr;
    }
    return null;
  }

  function unpackMessage(bytes) {
    if (bytes.length < 2) return null;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const type = view.getUint8(0);
    const len = view.getUint8(1);
    const payload = new Uint8Array(bytes.buffer, bytes.byteOffset + 2, len);
    return {
      type,
      payload: new TextDecoder().decode(payload),
      raw: payload
    };
  }

  function packSOS(roleId, lat, lng, priority, message) {
    const encoder = new TextEncoder();
    const msgBytes = encoder.encode(message || 'SOS');
    const buffer = new ArrayBuffer(3 + 4 + 4 + msgBytes.length);
    const view = new DataView(buffer);
    view.setUint8(0, roleId);
    view.setFloat32(1, lat, true);
    view.setFloat32(5, lng, true);
    view.setUint8(9, priority);
    view.setUint8(10, msgBytes.length);
    const arr = new Uint8Array(buffer);
    arr.set(msgBytes, 11);
    return arr;
  }

  function unpackSOS(bytes) {
    if (bytes.length < 11) return null;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const msgLen = view.getUint8(10);
    const msgBytes = new Uint8Array(bytes.buffer, bytes.byteOffset + 11, msgLen);
    return {
      roleId: view.getUint8(0),
      lat: view.getFloat32(1, true),
      lng: view.getFloat32(5, true),
      priority: view.getUint8(9),
      message: new TextDecoder().decode(msgBytes)
    };
  }

  function encodeHex(bytes) {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function decodeHex(hex) {
    const clean = hex.replace(/\s+/g, '');
    if (clean.length % 2 !== 0) return null;
    const bytes = new Uint8Array(clean.length / 2);
    for (let i = 0; i < clean.length; i += 2) {
      bytes[i / 2] = parseInt(clean.substr(i, 2), 16);
    }
    return bytes;
  }

  return {
    MESSAGE_TYPES,
    packTelemetry,
    unpackTelemetry,
    packMessage,
    unpackMessage,
    packSOS,
    unpackSOS,
    encodeHex,
    decodeHex
  };
})();
