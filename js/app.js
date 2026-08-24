const App = (() => {
  let currentRole = null;

  function init() {
    Auth.initDB().then(() => {
      Auth.seedUsers();
      bindLogin();
      if (Auth.isAuthenticated()) {
        const session = Auth.getSession();
        showRoleView(session.role);
      }
    });
  }

  function bindLogin() {
    const form = document.getElementById('login-form');
    const tabs = document.querySelectorAll('.role-tab');
    const adminFields = document.getElementById('admin-fields');
    let selectedRole = 'soldier';

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        selectedRole = tab.dataset.role;
        if (selectedRole === 'admin') {
          adminFields.classList.remove('hidden');
          document.getElementById('username').placeholder = 'Enter Command Officer ID';
          document.getElementById('password').placeholder = 'Enter Encrypted Master Passphrase';
        } else {
          adminFields.classList.add('hidden');
          document.getElementById('username').placeholder = 'Enter Service ID';
          document.getElementById('password').placeholder = 'Enter Tactical Key';
        }
      });
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('.btn-login');
      btn.classList.add('loading');
      btn.disabled = true;

      const username = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value;
      const commandCode = document.getElementById('command-code').value.trim();

      await new Promise(r => setTimeout(r, 600));

      const result = await Auth.login(username, password, selectedRole, commandCode);
      btn.classList.remove('loading');
      btn.disabled = false;

      if (result.success) {
        showToast('Authentication successful', 'success');
        showRoleView(result.session.role);
      } else {
        showToast(result.error, 'error');
        form.classList.add('shake');
        setTimeout(() => form.classList.remove('shake'), 300);
      }
    });
  }

  function showRoleView(role) {
    currentRole = role;
    document.getElementById('login-view').classList.remove('active');
    document.getElementById('soldier-view').classList.remove('active');
    document.getElementById('admin-view').classList.remove('active');

    if (role === 'soldier') {
      document.getElementById('soldier-view').classList.add('active');
      initSoldierView();
    } else if (role === 'admin') {
      document.getElementById('admin-view').classList.add('active');
      initAdminView();
    }
  }

  function initSoldierView() {
    const session = Auth.getSession();
    if (session) {
      document.getElementById('soldier-name').textContent = session.serviceId;
    }
    TacticalMap.initSoldierMap('soldier-map');
    setTimeout(() => TacticalMap.simulateSoldiers(), 800);
    bindSoldierEvents();
    initSerialForSoldier();
  }

  function initAdminView() {
    const session = Auth.getSession();
    if (session) {
      document.getElementById('admin-name').textContent = session.serviceId;
    }
    TacticalMap.initAdminMap('admin-map');
    setTimeout(() => TacticalMap.simulateSoldiers(), 800);
    bindAdminEvents();
    bindAIEvents();
    initDBView();
  }

  function bindSoldierEvents() {
    document.getElementById('logout-soldier').addEventListener('click', doLogout);
    document.getElementById('sos-btn').addEventListener('click', triggerSOS);
    document.getElementById('connect-lora').addEventListener('click', async () => {
      if (Serial.isConnected()) {
        showToast('LoRa already connected', 'success');
        return;
      }
      const ok = await Serial.connect(
        (line) => handleSerialLine(line, 'soldier'),
        () => showToast('LoRa disconnected', 'error')
      );
      if (ok) {
        showToast('LoRa link established', 'success');
        document.getElementById('radio-status').textContent = 'LINK';
      } else {
        showToast('LoRa connection failed', 'error');
      }
    });
    document.getElementById('send-soldier-msg').addEventListener('click', () => {
      const input = document.getElementById('soldier-msg-input');
      const text = input.value.trim();
      if (!text) return;
      const bytes = Proto.packMessage(Proto.MESSAGE_TYPES.MESSAGE, text);
      const sent = Serial.sendBytes(bytes);
      appendSoldierMessage(text, 'outgoing');
      input.value = '';
      if (sent) showToast('Message sent via LoRa', 'success');
    });
    document.getElementById('soldier-msg-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('send-soldier-msg').click();
    });
  }

  function bindAdminEvents() {
    document.getElementById('logout-admin').addEventListener('click', doLogout);
    document.getElementById('toggle-indoor').addEventListener('click', () => {
      showToast('Indoor BLE mode toggled', 'success');
    });
    document.getElementById('toggle-outdoor').addEventListener('click', () => {
      showToast('Outdoor GPS mode toggled', 'success');
    });
    document.getElementById('backup-db').addEventListener('click', () => {
      DB.backup().then(() => showToast('Database backed up', 'success'));
    });
    document.getElementById('wipe-db').addEventListener('click', () => {
      if (confirm('Wipe all encrypted logs? This cannot be undone.')) {
        DB.clear('logs').then(() => {
          document.getElementById('db-logs').innerHTML = '';
          document.getElementById('db-logs').classList.add('hidden');
          document.getElementById('db-status').textContent = 'Wiped';
          showToast('Database wiped', 'success');
        });
      }
    });
    document.getElementById('view-db').addEventListener('click', () => {
      const logs = document.getElementById('db-logs');
      logs.classList.toggle('hidden');
      if (!logs.classList.contains('hidden') && !logs.children.length) {
        DB.getAll('logs').then(entries => {
          logs.innerHTML = entries.slice(0, 20).map(e =>
            `<div class="log-entry"><span class="log-time">${new Date(e.timestamp).toLocaleTimeString()}</span><span class="log-type info">${e.type || 'LOG'}</span> ${e.message || 'Entry'}</div>`
          ).join('') || '<div class="empty-state">No logs yet</div>';
        });
      }
    });
    document.getElementById('broadcast-redeploy').addEventListener('click', () => {
      showToast('Squad redeployment broadcast sent', 'success');
      document.getElementById('emergency-badge').textContent = 'REDEPLOY';
    });
    document.getElementById('clear-emergency').addEventListener('click', () => {
      document.getElementById('emergency-feed').innerHTML = '<div class="empty-state">No active emergencies</div>';
      document.getElementById('emergency-badge').textContent = 'NO ALERTS';
      showToast('Emergency marked resolved', 'success');
    });
    document.getElementById('set-freq').addEventListener('click', () => {
      const freq = document.getElementById('base-freq').value;
      showToast(`Frequency shifted to ${freq} MHz`, 'success');
    });
  }

  function bindAIEvents() {
    const input = document.getElementById('ai-input');
    const sendBtn = document.getElementById('ai-send');
    sendBtn.addEventListener('click', async () => {
      const text = input.value.trim();
      if (!text || isGenerating) return;
      isGenerating = true;
      const chat = document.getElementById('ai-chat');
      appendAIChat(text, 'user');
      input.value = '';
      const thinkingBubble = appendAIChat('Analyzing mission parameters...', 'ai', true);
      const response = await AIBot.query(text);
      thinkingBubble.remove();
      appendAIChat(response, 'ai');
      isGenerating = false;
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendBtn.click();
    });
    document.querySelectorAll('.chip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        input.value = btn.dataset.prompt;
        sendBtn.click();
      });
    });
  }

  function initDBView() {
    const dbStatus = document.getElementById('db-status');
    dbStatus.textContent = 'Locked';
    dbStatus.style.background = 'rgba(16, 185, 129, 0.12)';
    dbStatus.style.color = 'var(--alert-green)';
  }

  function handleSerialLine(line, view) {
    try {
      const parsed = JSON.parse(line);
      if (parsed.lat && parsed.lng) {
        TacticalMap.updateSoldier(parsed.id || 'UNK', parsed.lat, parsed.lng, parsed.id || 'Unknown');
        if (parsed.id === Auth.getSession()?.serviceId) {
          document.getElementById('gps-coords').textContent = `${parsed.lat.toFixed(5)}, ${parsed.lng.toFixed(5)}`;
        }
      }
      if (parsed.rssi !== undefined) {
        document.getElementById('ble-rssi').textContent = `${parsed.rssi} dBm`;
      }
    } catch {
      if (view === 'soldier') {
        appendSoldierMessage(line, 'incoming');
      }
    }
  }

  function initSerialForSoldier() {
    Serial.onConnect = () => console.log('Serial connected');
    Serial.onDisconnect = () => {
      document.getElementById('radio-status').textContent = 'Disconnected';
    };
  }

  function appendSoldierMessage(text, type) {
    const feed = document.getElementById('soldier-msg-feed');
    const div = document.createElement('div');
    div.className = `msg-${type}`;
    div.textContent = text;
    feed.appendChild(div);
    feed.scrollTop = feed.scrollHeight;
  }

  function appendAIChat(text, type, isLoading = false) {
    const chat = document.getElementById('ai-chat');
    const div = document.createElement('div');
    div.className = `chat-bubble ${type}`;
    const span = document.createElement('span');
    span.className = 'bubble-text';
    span.textContent = text;
    div.appendChild(span);
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
    return div;
  }

  async function triggerSOS() {
    const session = Auth.getSession();
    const lat = 28.6139 + (Math.random() - 0.5) * 0.02;
    const lng = 77.2090 + (Math.random() - 0.5) * 0.02;
    const sosBytes = Proto.packSOS(0x01, lat, lng, 0xFF, 'EMERGENCY SOS');
    Serial.sendBytes(sosBytes);
    TacticalMap.addMarkerToMap(lat, lng, '#d32f2f', 'SOS');
    await DB.add('emergencies', {
      soldierId: session?.serviceId || 'UNK',
      lat, lng,
      message: 'SOS triggered',
      resolved: false
    });
    showToast('SOS broadcast sent', 'error');
  }

  async function doLogout() {
    Serial.disconnect();
    await Auth.logout();
    document.getElementById('soldier-view').classList.remove('active');
    document.getElementById('admin-view').classList.remove('active');
    document.getElementById('login-view').classList.add('active');
    showToast('Disconnected', 'success');
  }

  function showToast(message, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'toastOut 0.3s ease-out forwards';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', App.init);
