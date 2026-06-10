import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { io } from 'socket.io-client';
import { SceneManager } from './core/SceneManager.js';
import { LightManager } from './core/LightManager.js';
import * as Auth from './auth.js';

const MOVE_SPEED = 6;
const BOUNDS = 9;
const SEND_INTERVAL = 50;
const SPEECH_DURATION = 5000;
const JUMP_DURATION = 600;
const JUMP_HEIGHT = 1.2;
const GROUND_Y = 0.5;
const PUSH_SLIDE_MS = 500;
const DEFAULT_CAMERA = { x: 0, y: 12, z: 16, targetX: 0, targetY: 0, targetZ: 0 };

function getPlayerRadius(size = 1) {
  return size * 0.55;
}

function getPlayerHalfHeight(size = 1) {
  return size * 0.5;
}

function createPlayerGeometry(shape, size) {
  const s = size || 1;
  switch (shape) {
    case 'sphere':
      return new THREE.SphereGeometry(s * 0.55, 16, 16);
    case 'diamond':
      return new THREE.OctahedronGeometry(s * 0.65, 0);
    case 'cylinder':
      return new THREE.CylinderGeometry(s * 0.45, s * 0.45, s, 16);
    default:
      return new THREE.BoxGeometry(s, s, s);
  }
}

function hexToNumber(hex) {
  return parseInt(hex.replace('#', ''), 16);
}

class PlayerMesh {
  constructor(playerData, scene, isLocal = false) {
    this.id = playerData.id;
    this.isLocal = isLocal;
    this.target = { ...playerData };
    this.current = { ...playerData };
    this.jumpTime = 0;
    this.pushTime = 0;
    this.standingOnId = null;
    this.pushSlide = null;
    this.slideJustFinished = false;
    this.speechTimeout = null;
    this.scene = scene;

    this.mesh = this._buildMesh(playerData, isLocal);
    this.mesh.position.set(playerData.x, playerData.y, playerData.z);
    this.mesh.rotation.y = playerData.rotY;
    scene.add(this.mesh);

    this.label = document.createElement('div');
    this.label.className = 'player-label';
    this.label.textContent = playerData.name;
    document.body.appendChild(this.label);

    this.speechBubble = document.createElement('div');
    this.speechBubble.className = 'speech-bubble hidden';
    document.body.appendChild(this.speechBubble);
  }

  _buildMesh(playerData, isLocal) {
    const geometry = createPlayerGeometry(playerData.shape, playerData.size);
    const material = new THREE.MeshStandardMaterial({
      color: playerData.color,
      emissive: playerData.color,
      emissiveIntensity: isLocal ? 0.25 : 0.1,
      metalness: 0.2,
      roughness: 0.4,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  applyCustomization(data) {
    const { color, shape, size, name } = data;
    if (name) this.label.textContent = name;

    const nextShape = shape ?? this.target.shape ?? 'cube';
    const nextSize = size ?? this.target.size ?? 1;
    const shapeChanged = nextShape !== (this.target.shape ?? 'cube');
    const sizeChanged = Math.abs(nextSize - (this.target.size ?? 1)) > 0.01;

    if (shapeChanged || sizeChanged) {
      const pos = this.mesh.position.clone();
      const rotY = this.mesh.rotation.y;
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
      this.mesh = this._buildMesh(
        {
          shape: nextShape,
          size: nextSize,
          color: color ?? this.target.color,
        },
        this.isLocal,
      );
      this.mesh.position.copy(pos);
      this.mesh.rotation.y = rotY;
      this.scene.add(this.mesh);
      this.target.shape = nextShape;
      this.target.size = nextSize;
    }

    if (color !== undefined) {
      this.mesh.material.color.setHex(color);
      this.mesh.material.emissive.setHex(color);
      this.target.color = color;
    }
  }

  getJumpOffset() {
    if (this.jumpTime <= 0) return 0;
    const t = this.jumpTime / JUMP_DURATION;
    return Math.sin(t * Math.PI) * JUMP_HEIGHT;
  }

  getVisualY() {
    return this.current.y + this.getJumpOffset();
  }

  getTopY() {
    return this.getVisualY() + getPlayerHalfHeight(this.target.size || 1);
  }

  getBottomY() {
    return this.getVisualY() - getPlayerHalfHeight(this.target.size || 1);
  }

  isPushSliding() {
    return this.pushSlide !== null;
  }

  startPushSlide(fromX, fromZ, toX, toZ) {
    this.pushSlide = {
      fromX,
      fromZ,
      toX,
      toZ,
      start: performance.now(),
      duration: PUSH_SLIDE_MS,
    };
    this.target.x = toX;
    this.target.z = toZ;
  }

  updatePushSlide() {
    if (!this.pushSlide) return false;

    const { fromX, fromZ, toX, toZ, start, duration } = this.pushSlide;
    const t = Math.min(1, (performance.now() - start) / duration);
    const eased = 1 - (1 - t) ** 3;
    this.current.x = fromX + (toX - fromX) * eased;
    this.current.z = fromZ + (toZ - fromZ) * eased;

    if (t >= 1) {
      this.current.x = toX;
      this.current.z = toZ;
      this.pushSlide = null;
      this.slideJustFinished = true;
    }

    return true;
  }

  updatePosition(camera, dtMs = 16) {
    if (!this.updatePushSlide()) {
      const lerp = this.isLocal ? 1 : 0.15;
      this.current.x += (this.target.x - this.current.x) * lerp;
      this.current.z += (this.target.z - this.current.z) * lerp;
    }

    this.current.y += (this.target.y - this.current.y) * (this.isLocal ? 1 : 0.15);
    this.current.rotY += (this.target.rotY - this.current.rotY) * (this.isLocal ? 1 : 0.15);

    if (this.jumpTime > 0) {
      this.jumpTime -= dtMs;
      if (this.jumpTime < 0) this.jumpTime = 0;
    }

    const y = this.getVisualY();
    const size = this.target.size || 1;
    this.mesh.position.set(this.current.x, y, this.current.z);
    this.mesh.rotation.y = this.current.rotY;

    if (this.pushTime > 0) {
      const scale = 1 + Math.sin((this.pushTime / 250) * Math.PI) * 0.2;
      this.mesh.scale.setScalar(scale);
      this.pushTime -= dtMs;
      if (this.pushTime <= 0) this.mesh.scale.setScalar(1);
    }

    const headY = y + size * 0.6 + 0.5;
    this._positionOverlay(this.label, headY, camera);

    if (!this.speechBubble.classList.contains('hidden')) {
      this._positionOverlay(this.speechBubble, headY + 0.9, camera);
    }
  }

  _positionOverlay(el, worldY, camera) {
    const screenPos = new THREE.Vector3(this.current.x, worldY, this.current.z);
    screenPos.project(camera);
    const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
    const yPos = (-screenPos.y * 0.5 + 0.5) * window.innerHeight;
    const visible = screenPos.z < 1 && screenPos.z > -1;
    el.style.display = visible ? 'block' : 'none';
    el.style.left = `${x}px`;
    el.style.top = `${yPos}px`;
  }

  showSpeech(text) {
    this.speechBubble.textContent = text;
    this.speechBubble.classList.remove('hidden');
    clearTimeout(this.speechTimeout);
    this.speechTimeout = setTimeout(() => {
      this.speechBubble.classList.add('hidden');
    }, SPEECH_DURATION);
  }

  setTarget(data) {
    Object.assign(this.target, data);
  }

  playJump() {
    this.jumpTime = JUMP_DURATION;
  }

  playPush() {
    this.pushTime = 250;
  }

  dispose(scene) {
    scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.label.remove();
    this.speechBubble.remove();
    clearTimeout(this.speechTimeout);
  }
}

class CubikiGame {
  constructor() {
    this.socket = null;
    this.myId = null;
    this.players = new Map();
    this.keys = {};
    this.lastSend = 0;
    this.localState = { x: 0, z: 0, y: 0.5, rotY: 0 };
    this.profile = { name: 'Игрок', color: 0x4ecdc4, shape: 'cube', size: 1 };
    this.selectedShape = 'cube';
    this.roomCode = 'lobby';
    this.roomsRefreshTimer = null;
    this.authMode = 'guest';
    this.account = null;
    this.ownedShapes = ['cube', 'sphere', 'diamond', 'cylinder'];

    this.joinScreen = document.getElementById('join-screen');
    this.hud = document.getElementById('hud');
    this.nameInput = document.getElementById('player-name');
    this.roomInput = document.getElementById('room-code');
    this.roomsListEl = document.getElementById('rooms-list');
    this.roomBadge = document.getElementById('room-badge');
    this.colorInput = document.getElementById('player-color');
    this.sizeInput = document.getElementById('player-size');
    this.sizeValue = document.getElementById('size-value');
    this.joinBtn = document.getElementById('join-btn');
    this.playersList = document.getElementById('players-list');
    this.statusEl = document.getElementById('status');
    this.chatMessages = document.getElementById('chat-messages');
    this.chatInput = document.getElementById('chat-input');
    this.chatSend = document.getElementById('chat-send');
    this.cameraResetBtn = document.getElementById('camera-reset-btn');
    this.customizeBtn = document.getElementById('customize-btn');
    this.customizePanel = document.getElementById('customize-panel');
    this.ingameColor = document.getElementById('ingame-color');
    this.ingameShape = document.getElementById('ingame-shape');
    this.ingameSize = document.getElementById('ingame-size');
    this.applyCustomize = document.getElementById('apply-customize');
    this.mobileControls = document.getElementById('mobile-controls');
    this.networkUrls = document.getElementById('network-urls');
    this.authGuestPanel = document.getElementById('auth-guest-panel');
    this.authLoginPanel = document.getElementById('auth-login-panel');
    this.authRegisterPanel = document.getElementById('auth-register-panel');
    this.loginUsername = document.getElementById('login-username');
    this.loginPassword = document.getElementById('login-password');
    this.loginBtn = document.getElementById('login-btn');
    this.loginError = document.getElementById('login-error');
    this.registerUsername = document.getElementById('register-username');
    this.registerPassword = document.getElementById('register-password');
    this.registerDisplay = document.getElementById('register-display');
    this.registerBtn = document.getElementById('register-btn');
    this.registerError = document.getElementById('register-error');
    this.accountBar = document.getElementById('account-bar');
    this.accountName = document.getElementById('account-name');
    this.accountCoins = document.getElementById('account-coins');
    this.shopBtn = document.getElementById('shop-btn');
    this.logoutBtn = document.getElementById('logout-btn');
    this.shopModal = document.getElementById('shop-modal');
    this.shopItemsEl = document.getElementById('shop-items');
    this.shopCoinsEl = document.getElementById('shop-coins');
    this.shopCloseBtn = document.getElementById('shop-close');
    this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    const urlRoom = new URLSearchParams(window.location.search).get('room');
    if (urlRoom) this.roomInput.value = urlRoom;

    this.setupAuthUi();
    this.restoreSession();
    this.loadNetworkUrls();
    this.loadRoomsList();
    this.roomsRefreshTimer = setInterval(() => this.loadRoomsList(), 3000);
    this.setupTouchControls();

    this.joinBtn.addEventListener('click', () => this.join());
    this.nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.join();
      e.stopPropagation();
    });
    this.nameInput.addEventListener('focus', () => { this.keys = {}; });
    this.chatInput.addEventListener('focus', () => { this.keys = {}; });

    this.sizeInput.addEventListener('input', () => {
      this.sizeValue.textContent = Number(this.sizeInput.value).toFixed(1);
    });

    document.querySelectorAll('.shape-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        document.querySelectorAll('.shape-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedShape = btn.dataset.shape;
      });
    });

    this.chatSend.addEventListener('click', () => this.sendChat());
    this.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.sendChat();
      }
      e.stopPropagation();
    });
    this.cameraResetBtn.addEventListener('click', () => this.resetCamera());

    this.customizeBtn.addEventListener('click', () => {
      this.customizePanel.classList.toggle('hidden');
    });
    this.applyCustomize.addEventListener('click', () => this.applyIngameCustomize());

    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => {
      if (this.isTyping()) return;
      this.keys[e.code] = false;
    });
    window.addEventListener('resize', () => this.onResize());
  }

  isTyping() {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
  }

  onKeyDown(e) {
    if (this.isTyping()) return;

    if (e.code === 'KeyT' && !e.repeat) {
      e.preventDefault();
      this.chatInput.focus();
      return;
    }

    this.keys[e.code] = true;
    if (['Space', 'KeyE'].includes(e.code)) e.preventDefault();
  }

  getRoomCode() {
    const raw = this.roomInput?.value ?? this.roomCode ?? '';
    return String(raw).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 16) || 'lobby';
  }

  setupAuthUi() {
    document.querySelectorAll('.auth-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        this.authMode = tab.dataset.auth;
        document.querySelectorAll('.auth-tab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        this.authGuestPanel.classList.toggle('hidden', this.authMode !== 'guest');
        this.authLoginPanel.classList.toggle('hidden', this.authMode !== 'login');
        this.authRegisterPanel.classList.toggle('hidden', this.authMode !== 'register');
      });
    });

    this.loginBtn.addEventListener('click', () => this.handleLogin());
    this.registerBtn.addEventListener('click', () => this.handleRegister());
    this.logoutBtn.addEventListener('click', () => this.handleLogout());
    this.shopBtn.addEventListener('click', () => this.openShop());
    this.shopCloseBtn.addEventListener('click', () => this.shopModal.classList.add('hidden'));
  }

  async restoreSession() {
    const user = await Auth.fetchMe();
    if (user) this.applyAccount(user);
  }

  applyAccount(user) {
    this.account = user;
    this.ownedShapes = user.ownedShapes || ['cube'];
    this.authMode = 'account';
    this.nameInput.value = user.displayName;
    this.colorInput.value = `#${Number(user.profile.color).toString(16).padStart(6, '0')}`;
    this.sizeInput.value = user.profile.size;
    this.sizeValue.textContent = Number(user.profile.size).toFixed(1);
    this.selectedShape = user.profile.shape;
    document.querySelectorAll('.shape-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.shape === user.profile.shape);
      btn.disabled = !this.ownedShapes.includes(btn.dataset.shape);
      btn.classList.toggle('locked', !this.ownedShapes.includes(btn.dataset.shape));
    });
    this.accountBar.classList.remove('hidden');
    this.accountName.textContent = user.displayName;
    this.accountCoins.textContent = `🪙 ${user.coins}`;
    this.authGuestPanel.classList.add('hidden');
    this.authLoginPanel.classList.add('hidden');
    this.authRegisterPanel.classList.add('hidden');
    document.querySelectorAll('.auth-tab').forEach((t) => t.classList.add('hidden'));
  }

  clearAccountUi() {
    this.account = null;
    this.ownedShapes = ['cube', 'sphere', 'diamond', 'cylinder'];
    this.accountBar.classList.add('hidden');
    document.querySelectorAll('.auth-tab').forEach((t) => t.classList.remove('hidden'));
    document.querySelectorAll('.shape-btn').forEach((btn) => {
      btn.disabled = false;
      btn.classList.remove('locked');
    });
    this.authMode = 'guest';
    document.querySelector('.auth-tab[data-auth="guest"]')?.click();
  }

  showAuthError(el, message) {
    el.textContent = message;
    el.classList.remove('hidden');
  }

  async handleLogin() {
    this.loginError.classList.add('hidden');
    try {
      const user = await Auth.login(this.loginUsername.value, this.loginPassword.value);
      this.applyAccount(user);
    } catch (err) {
      this.showAuthError(this.loginError, err.message);
    }
  }

  async handleRegister() {
    this.registerError.classList.add('hidden');
    try {
      const user = await Auth.register(
        this.registerUsername.value,
        this.registerPassword.value,
        this.registerDisplay.value,
      );
      this.applyAccount(user);
    } catch (err) {
      this.showAuthError(this.registerError, err.message);
    }
  }

  handleLogout() {
    Auth.logout();
    this.clearAccountUi();
  }

  async openShop() {
    if (!this.account) return;
    try {
      const data = await Auth.fetchShop();
      this.account = data.user || this.account;
      this.shopCoinsEl.textContent = this.account?.coins ?? 0;
      this.accountCoins.textContent = `🪙 ${this.account.coins}`;
      this.shopItemsEl.innerHTML = (data.items || [])
        .map((item) => {
          const owned = this.account.ownedShapes?.includes(item.value);
          return `
            <div class="shop-item">
              <div>
                <strong>${this.escapeHtml(item.name)}</strong>
                <span class="shop-price">${item.price} 🪙</span>
              </div>
              <button type="button" class="buy-btn" data-id="${item.id}" ${owned ? 'disabled' : ''}>
                ${owned ? 'Куплено' : 'Купить'}
              </button>
            </div>`;
        })
        .join('');
      this.shopItemsEl.querySelectorAll('.buy-btn').forEach((btn) => {
        btn.addEventListener('click', () => this.handleBuy(btn.dataset.id));
      });
      this.shopModal.classList.remove('hidden');
    } catch (err) {
      alert(err.message);
    }
  }

  async handleBuy(itemId) {
    try {
      const { user } = await Auth.buyItem(itemId);
      this.applyAccount(user);
      this.openShop();
    } catch (err) {
      alert(err.message);
    }
  }

  loadRoomsList() {
    fetch('/api/rooms')
      .then((r) => r.json())
      .then((data) => {
        if (!this.roomsListEl) return;
        const rooms = data.rooms || [];
        const selected = this.getRoomCode();

        if (rooms.length === 0) {
          this.roomsListEl.innerHTML = '<p class="rooms-empty">Пока нет активных комнат. Создайте свою!</p>';
          return;
        }

        this.roomsListEl.innerHTML = rooms
          .map((room) => `
            <button type="button" class="room-item${room.id === selected ? ' active' : ''}" data-room="${room.id}">
              <span class="room-item-name">${this.escapeHtml(room.name)}</span>
              <span class="room-item-count">${room.players} игр.</span>
            </button>
          `)
          .join('');

        this.roomsListEl.querySelectorAll('.room-item').forEach((btn) => {
          btn.addEventListener('click', () => {
            this.roomInput.value = btn.dataset.room;
            this.loadRoomsList();
          });
        });
      })
      .catch(() => {
        if (this.roomsListEl) {
          this.roomsListEl.innerHTML = '<p class="rooms-empty">Не удалось загрузить комнаты</p>';
        }
      });
  }

  loadNetworkUrls() {
    fetch('/api/info')
      .then((r) => r.json())
      .then((data) => {
        if (!this.networkUrls || !data.urls?.length) return;
        this.networkUrls.innerHTML = `<strong>С телефона откройте:</strong><br>${
          data.urls.map((u) => `<a href="${u}">${u}</a>`).join('<br>')
        }`;
      })
      .catch(() => {});
  }

  setupTouchControls() {
    const bindButton = (el) => {
      const key = el.dataset.key;
      if (!key) return;

      const press = (e) => {
        e.preventDefault();
        this.keys[key] = true;
      };
      const release = (e) => {
        e.preventDefault();
        this.keys[key] = false;
      };

      el.addEventListener('touchstart', press, { passive: false });
      el.addEventListener('touchend', release, { passive: false });
      el.addEventListener('touchcancel', release, { passive: false });
      el.addEventListener('mousedown', press);
      el.addEventListener('mouseup', release);
      el.addEventListener('mouseleave', release);
    };

    document.querySelectorAll('.touch-btn, .touch-action').forEach(bindButton);
  }

  getJoinProfile() {
    const shape = this.account && !this.ownedShapes.includes(this.selectedShape)
      ? 'cube'
      : this.selectedShape;
    return {
      name: (this.account?.displayName || this.nameInput.value.trim()) || 'Игрок',
      color: hexToNumber(this.colorInput.value),
      shape,
      size: Number(this.sizeInput.value),
    };
  }

  join() {
    if (this.account && !this.ownedShapes.includes(this.selectedShape)) {
      alert('Эта форма не куплена. Откройте магазин.');
      return;
    }
    this.profile = this.getJoinProfile();
    this.roomCode = this.getRoomCode();
    if (this.roomsRefreshTimer) {
      clearInterval(this.roomsRefreshTimer);
      this.roomsRefreshTimer = null;
    }
    this.joinScreen.classList.add('hidden');
    this.hud.classList.remove('hidden');
    this.ingameColor.value = this.colorInput.value;
    this.ingameShape.value = this.profile.shape;
    this.ingameSize.value = this.profile.size;
    if (this.isTouchDevice) {
      this.mobileControls.classList.remove('hidden');
    }
    this.initScene();
    this.connectSocket();
  }

  applyIngameCustomize() {
    this.profile = {
      ...this.profile,
      color: hexToNumber(this.ingameColor.value),
      shape: this.ingameShape.value,
      size: Number(this.ingameSize.value),
    };
    this.socket?.emit('setProfile', this.profile);
    const me = this.players.get(this.myId);
    if (me) me.applyCustomization(this.profile);
    this.updatePlayersList();
    this.customizePanel.classList.add('hidden');
  }

  sendChat() {
    const text = this.chatInput.value.trim();
    if (!text || !this.socket?.connected) return;

    this.addChatMessage({ name: this.profile.name, color: this.profile.color, text });
    const me = this.players.get(this.myId);
    if (me) me.showSpeech(text);

    this.socket.emit('chatMessage', text);
    this.chatInput.value = '';
  }

  addChatMessage({ name, color, text, system = false }) {
    const msg = document.createElement('div');
    msg.className = system ? 'chat-msg system' : 'chat-msg';
    if (system) {
      msg.textContent = text;
    } else {
      const safeColor = Number(color) || 0xffffff;
      const colorHex = `#${safeColor.toString(16).padStart(6, '0')}`;
      msg.innerHTML = `<span class="author" style="color:${colorHex}">${this.escapeHtml(name)}:</span> ${this.escapeHtml(text)}`;
    }
    this.chatMessages.appendChild(msg);
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  initScene() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    document.body.appendChild(this.renderer.domElement);

    this.sceneManager = new SceneManager();
    this.scene = this.sceneManager.create();

    new THREE.TextureLoader().load(
      'https://threejs.org/examples/textures/2294472375_24a3b8ef46_o.jpg',
      (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        this.scene.background = texture;
      },
    );

    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200);
    this.camera.position.set(0, 12, 16);
    this.camera.lookAt(0, 0, 0);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI / 2.1;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 30;
    this.controls.target.set(DEFAULT_CAMERA.targetX, DEFAULT_CAMERA.targetY, DEFAULT_CAMERA.targetZ);
    this.controls.enablePan = !this.isTouchDevice;

    new LightManager(this.scene).createAll();

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      new THREE.MeshStandardMaterial({ color: 0x1a0a2e, roughness: 0.8 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.01;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const grid = new THREE.GridHelper(20, 20, 0x4ecdc4, 0x2a1a4a);
    grid.position.y = 0;
    this.scene.add(grid);

    this.animate();
  }

  connectSocket() {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
    }

    const roomCode = this.getRoomCode();
    this.roomCode = roomCode;

    const token = Auth.getToken();
    this.socket = io(window.location.origin, {
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 15,
      query: { room: roomCode },
      auth: { token: token || '' },
    });

    this.socket.on('connect', () => {
      const code = this.roomCode || this.getRoomCode() || 'lobby';
      this.roomCode = code;
      this.statusEl.textContent = 'Подключение к комнате...';
      this.statusEl.className = 'connected';
      this.socket.emit('joinRoom', { code, profile: this.profile });
    });

    this.socket.on('connect_error', () => {
      this.statusEl.textContent = 'Ошибка подключения';
      this.statusEl.className = 'disconnected';
    });

    this.socket.on('disconnect', () => {
      this.myId = null;
      this.statusEl.textContent = 'Отключено';
      this.statusEl.className = 'disconnected';
    });

    this.socket.on('accountUpdated', (data) => {
      if (this.account) {
        this.account.coins = data.coins;
        this.account.ownedShapes = data.ownedShapes;
        this.ownedShapes = data.ownedShapes;
        this.accountCoins.textContent = `🪙 ${data.coins}`;
      }
    });

    this.socket.on('profileError', ({ error }) => {
      this.addChatMessage({ system: true, text: error });
    });

    this.socket.on('init', (data) => {
      const { id, players = {} } = data;
      const roomId = data.roomId || players[id]?.roomId || this.roomCode || 'lobby';

      if (data.account && this.account) {
        this.account.coins = data.account.coins;
        this.account.ownedShapes = data.account.ownedShapes;
        this.ownedShapes = data.account.ownedShapes;
        this.accountCoins.textContent = `🪙 ${data.account.coins}`;
      }

      this.myId = id;
      this.roomCode = roomId;
      if (this.scene) {
        this.players.forEach((p) => p.dispose(this.scene));
      }
      this.players.clear();

      for (const p of Object.values(players)) {
        this.addPlayer(p);
      }
      const me = players[id];
      if (me) {
        this.localState = { x: me.x, z: me.z, y: me.y, rotY: me.rotY };
      }
      const localPlayer = this.players.get(this.myId);
      if (localPlayer) {
        localPlayer.applyCustomization({ ...this.profile, id: this.myId });
      }
      this.socket.emit('setProfile', this.profile);
      this.updateRoomBadge();
      this.updatePlayersList();
      this.statusEl.textContent = 'Подключено';
      this.addChatMessage({ system: true, text: `Вы вошли в комнату «${this.roomCode}». Нажмите T для чата.` });
    });

    this.socket.on('playerJoined', (p) => {
      this.addPlayer(p);
      this.updatePlayersList();
      this.addChatMessage({ system: true, text: `${p.name} вошёл в игру` });
    });

    this.socket.on('playerLeft', (id) => {
      const player = this.players.get(id);
      if (player) {
        this.addChatMessage({ system: true, text: `${player.label.textContent} вышел` });
        player.dispose(this.scene);
        this.players.delete(id);
        this.updatePlayersList();
      }
    });

    this.socket.on('playerMoved', ({ id, x, z, y, rotY }) => {
      const player = this.players.get(id);
      if (player && id !== this.myId && !player.isPushSliding()) {
        player.setTarget({ x, z, y, rotY });
      }
    });

    this.socket.on('playerUpdated', (p) => {
      const player = this.players.get(p.id);
      if (player) {
        player.applyCustomization(p);
      }
      this.updatePlayersList();
    });

    this.socket.on('playerAction', ({ id, action }) => {
      const player = this.players.get(id);
      if (!player) return;
      if (action === 'jump') player.playJump();
      if (action === 'push') player.playPush();
    });

    this.socket.on('playersPushed', ({ players }) => {
      this.applyPushResults(players);
    });

    this.socket.on('chatMessage', (data) => {
      this.addChatMessage(data);
      const player = this.players.get(data.id);
      if (player) player.showSpeech(data.text);
    });
  }

  addPlayer(data) {
    if (this.players.has(data.id)) return;
    const isLocal = data.id === this.myId;
    const playerData = isLocal ? { ...data, ...this.profile, id: data.id } : data;
    const player = new PlayerMesh(playerData, this.scene, isLocal);
    this.players.set(data.id, player);
  }

  applyPushResults(results) {
    for (const data of results) {
      const player = this.players.get(data.id);
      if (!player) continue;

      const fromX = data.fromX ?? player.current.x;
      const fromZ = data.fromZ ?? player.current.z;
      player.startPushSlide(fromX, fromZ, data.x, data.z);

      if (data.y !== undefined) player.target.y = data.y;
      if (data.rotY !== undefined) player.target.rotY = data.rotY;
    }
  }

  resetCamera() {
    if (!this.camera || !this.controls) return;
    this.camera.position.set(DEFAULT_CAMERA.x, DEFAULT_CAMERA.y, DEFAULT_CAMERA.z);
    this.controls.target.set(DEFAULT_CAMERA.targetX, DEFAULT_CAMERA.targetY, DEFAULT_CAMERA.targetZ);
    this.controls.update();
  }

  updateLocalHeight(me) {
    const size = me.target.size || 1;

    if (me.standingOnId) {
      const platform = this.players.get(me.standingOnId);
      if (!platform) {
        me.standingOnId = null;
        me.target.y = GROUND_Y;
      } else {
        const dx = this.localState.x - platform.current.x;
        const dz = this.localState.z - platform.current.z;
        const maxDist = getPlayerRadius(size) + getPlayerRadius(platform.target.size || 1) - 0.05;
        if (Math.hypot(dx, dz) > maxDist) {
          me.standingOnId = null;
          me.target.y = GROUND_Y;
        } else {
          me.target.y = platform.getTopY() + getPlayerHalfHeight(size);
        }
      }
    } else if (me.jumpTime <= 0) {
      me.target.y = GROUND_Y;
    }

    if (me.jumpTime > 0 && me.jumpTime < JUMP_DURATION * 0.55) {
      const bottomY = me.getBottomY();
      let landed = false;

      for (const [id, other] of this.players) {
        if (id === this.myId) continue;

        const dx = this.localState.x - other.current.x;
        const dz = this.localState.z - other.current.z;
        const dist = Math.hypot(dx, dz);
        const maxDist = getPlayerRadius(size) + getPlayerRadius(other.target.size || 1);

        if (dist <= maxDist) {
          const topY = other.getTopY();
          if (bottomY <= topY + 0.2 && bottomY >= topY - 0.45) {
            me.jumpTime = 0;
            me.standingOnId = id;
            me.target.y = topY + getPlayerHalfHeight(size);
            landed = true;
            break;
          }
        }
      }

      if (!landed && me.jumpTime <= 0 && !me.standingOnId) {
        me.target.y = GROUND_Y;
      }
    }

    this.localState.y = me.target.y;
  }

  resolveCollisions(me, x, z) {
    const mySize = me.target.size || 1;
    const myRadius = getPlayerRadius(mySize);
    let resolvedX = x;
    let resolvedZ = z;

    for (const [id, other] of this.players) {
      if (id === this.myId || id === me.standingOnId) continue;

      const otherRadius = getPlayerRadius(other.target.size || 1);
      const minDist = myRadius + otherRadius;
      let dx = resolvedX - other.current.x;
      let dz = resolvedZ - other.current.z;
      let dist = Math.hypot(dx, dz);

      if (dist < minDist) {
        if (dist < 0.001) {
          const angle = Math.random() * Math.PI * 2;
          dx = Math.cos(angle);
          dz = Math.sin(angle);
          dist = 1;
        }
        const push = (minDist - dist) / dist;
        resolvedX += dx * push;
        resolvedZ += dz * push;
      }
    }

    return { x: resolvedX, z: resolvedZ };
  }

  updateRoomBadge() {
    if (this.roomBadge) {
      const room = this.roomCode || this.getRoomCode() || 'lobby';
      this.roomBadge.textContent = `Комната: ${room}`;
    }
  }

  updatePlayersList() {
    const items = [...this.players.values()]
      .map((p) => {
        const color = `#${p.mesh.material.color.getHexString()}`;
        const you = p.id === this.myId ? ' (вы)' : '';
        return `<li><span class="player-dot" style="background:${color}"></span>${p.label.textContent}${you}</li>`;
      })
      .join('');
    this.playersList.innerHTML = `<h3>Игроки (${this.players.size})</h3><ul>${items}</ul>`;
  }

  handleInput(dt) {
    if (this.isTyping()) return;

    const me = this.players.get(this.myId);
    if (!me || !this.socket?.connected) return;

    const sliding = me.isPushSliding();

    if (sliding) {
      this.localState.x = me.current.x;
      this.localState.z = me.current.z;
    } else {
      let dx = 0;
      let dz = 0;
      if (this.keys.KeyW || this.keys.ArrowUp) dz -= 1;
      if (this.keys.KeyS || this.keys.ArrowDown) dz += 1;
      if (this.keys.KeyA || this.keys.ArrowLeft) dx -= 1;
      if (this.keys.KeyD || this.keys.ArrowRight) dx += 1;

      if (dx !== 0 || dz !== 0) {
        const len = Math.hypot(dx, dz);
        dx /= len;
        dz /= len;
        this.localState.x += dx * MOVE_SPEED * dt;
        this.localState.z += dz * MOVE_SPEED * dt;
        this.localState.rotY = Math.atan2(dx, dz);
      }

      const collided = this.resolveCollisions(me, this.localState.x, this.localState.z);
      this.localState.x = Math.max(-BOUNDS, Math.min(BOUNDS, collided.x));
      this.localState.z = Math.max(-BOUNDS, Math.min(BOUNDS, collided.z));
      me.setTarget({ x: this.localState.x, z: this.localState.z, rotY: this.localState.rotY });
    }

    if (this.keys.Space && !this._jumpPressed) {
      this._jumpPressed = true;
      me.standingOnId = null;
      me.playJump();
      this.socket.emit('playerAction', 'jump');
    }
    if (!this.keys.Space) this._jumpPressed = false;

    if (this.keys.KeyE && !this._pushPressed) {
      this._pushPressed = true;
      me.playPush();
      this.socket.emit('playerPush');
    }
    if (!this.keys.KeyE) this._pushPressed = false;

    const now = performance.now();
    if (!sliding && now - this.lastSend > SEND_INTERVAL) {
      this.lastSend = now;
      this.socket.emit('playerMove', this.localState);
    }
  }

  onResize() {
    if (!this.camera || !this.renderer) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    const dt = 1 / 60;

    this.handleInput(dt);

    const dtMs = dt * 1000;
    const me = this.players.get(this.myId);

    for (const [id, player] of this.players) {
      if (id !== this.myId) player.updatePosition(this.camera, dtMs);
    }

    if (me) {
      this.updateLocalHeight(me);
      if (!me.isPushSliding()) {
        me.setTarget({ x: this.localState.x, z: this.localState.z, y: this.localState.y, rotY: this.localState.rotY });
      } else {
        me.setTarget({ y: this.localState.y, rotY: this.localState.rotY });
      }
      me.updatePosition(this.camera, dtMs);

      if (me.slideJustFinished) {
        me.slideJustFinished = false;
        this.localState.x = me.current.x;
        this.localState.z = me.current.z;
        this.lastSend = performance.now();
        this.socket.emit('playerMove', this.localState);
      }
    }

    if (this.controls) this.controls.update();
    if (this.renderer) {
      this.renderer.render(this.scene, this.camera);
    }
  }
}

new CubikiGame();
