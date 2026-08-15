const SUPABASE_URL = 'https://xdmddrmfkghmjiilkqpq.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_2_nw6MHQ3dlACwMSV3CUZg_nM3B5XRE';
const ACCOUNT_WORKER_URL = 'https://ai-sound-upload.buidoihn1990.workers.dev';

const authState = {
  session: null,
  user: null,
  permission: null
};

const authOpenBtn = document.getElementById('authOpenBtn');
const authUserChip = document.getElementById('authUserChip');
const authUserEmail = document.getElementById('authUserEmail');
const authRoleBadge = document.getElementById('authRoleBadge');
const authLogoutBtn = document.getElementById('authLogoutBtn');
const authModal = document.getElementById('authModal');
const authCloseBtn = document.getElementById('authCloseBtn');
const authModeLogin = document.getElementById('authModeLogin');
const authModeSignup = document.getElementById('authModeSignup');
const authForm = document.getElementById('authForm');
const authEmail = document.getElementById('authEmail');
const authPassword = document.getElementById('authPassword');
const authSubmitBtn = document.getElementById('authSubmitBtn');
const authMessage = document.getElementById('authMessage');

let authMode = 'login';
let supabaseClient = null;

function emitAuthState() {
  document.dispatchEvent(new CustomEvent('ai-auth-changed', {
    detail: {
      session: authState.session,
      user: authState.user,
      permission: authState.permission,
      authenticated: Boolean(authState.user),
      canUpload: Boolean(authState.permission?.canUpload)
    }
  }));
}

function setAuthMessage(message = '', type = '') {
  if (!authMessage) return;
  authMessage.textContent = message;
  authMessage.className = `auth-message${type ? ` ${type}` : ''}`;
}

function setAuthMode(mode) {
  authMode = mode === 'signup' ? 'signup' : 'login';
  authModeLogin?.classList.toggle('active', authMode === 'login');
  authModeSignup?.classList.toggle('active', authMode === 'signup');
  if (authSubmitBtn) authSubmitBtn.textContent = authMode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản';
  setAuthMessage('');
}

function openAuthModal(mode = 'login') {
  setAuthMode(mode);
  authModal?.classList.add('show');
  authModal?.setAttribute('aria-hidden', 'false');
  setTimeout(() => authEmail?.focus(), 60);
}

function closeAuthModal() {
  authModal?.classList.remove('show');
  authModal?.setAttribute('aria-hidden', 'true');
  setAuthMessage('');
}

function renderAuthUI() {
  const user = authState.user;
  const permission = authState.permission;

  if (user) {
    authOpenBtn?.classList.add('hidden');
    authUserChip?.classList.add('show');
    if (authUserEmail) authUserEmail.textContent = user.email || 'Tài khoản';
    if (authRoleBadge) {
      authRoleBadge.textContent = permission?.canUpload
        ? (permission.role === 'admin' ? 'Admin' : 'Uploader')
        : 'Listener';
      authRoleBadge.classList.toggle('allowed', Boolean(permission?.canUpload));
    }
  } else {
    authOpenBtn?.classList.remove('hidden');
    authUserChip?.classList.remove('show');
    if (authUserEmail) authUserEmail.textContent = '';
    if (authRoleBadge) {
      authRoleBadge.textContent = 'Listener';
      authRoleBadge.classList.remove('allowed');
    }
  }
}

async function fetchPermission(session = authState.session) {
  if (!session?.access_token) {
    authState.permission = null;
    renderAuthUI();
    emitAuthState();
    return null;
  }

  try {
    const response = await fetch(`${ACCOUNT_WORKER_URL}/me`, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${session.access_token}`
      }
    });

    if (!response.ok) {
      authState.permission = {
        canUpload: false,
        role: 'listener',
        workerReady: false,
        status: response.status
      };
    } else {
      const data = await response.json();
      authState.permission = {
        canUpload: Boolean(data.canUpload),
        role: data.role || 'listener',
        workerReady: true,
        userId: data.user?.id || authState.user?.id || null,
        email: data.user?.email || authState.user?.email || ''
      };
    }
  } catch {
    authState.permission = {
      canUpload: false,
      role: 'listener',
      workerReady: false
    };
  }

  renderAuthUI();
  emitAuthState();
  return authState.permission;
}

async function syncSession(session) {
  authState.session = session || null;
  authState.user = session?.user || null;
  authState.permission = null;
  renderAuthUI();
  emitAuthState();
  if (session?.access_token) await fetchPermission(session);
}

async function getSession() {
  if (!supabaseClient) return null;
  const { data } = await supabaseClient.auth.getSession();
  return data?.session || null;
}

async function getAccessToken() {
  const session = await getSession();
  return session?.access_token || null;
}

async function initAuth() {
  if (!window.supabase?.createClient) {
    setAuthMessage('Không tải được thư viện đăng nhập.', 'error');
    return;
  }

  supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );

  const { data } = await supabaseClient.auth.getSession();
  await syncSession(data?.session || null);

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    setTimeout(() => syncSession(session), 0);
  });
}

authOpenBtn?.addEventListener('click', () => openAuthModal('login'));
authCloseBtn?.addEventListener('click', closeAuthModal);
authModeLogin?.addEventListener('click', () => setAuthMode('login'));
authModeSignup?.addEventListener('click', () => setAuthMode('signup'));
authModal?.addEventListener('click', (event) => {
  if (event.target === authModal) closeAuthModal();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && authModal?.classList.contains('show')) closeAuthModal();
});

authLogoutBtn?.addEventListener('click', async () => {
  if (!supabaseClient) return;
  await supabaseClient.auth.signOut();
  closeAuthModal();
});

authForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!supabaseClient) return setAuthMessage('Hệ thống đăng nhập chưa sẵn sàng.', 'error');

  const email = authEmail?.value.trim() || '';
  const password = authPassword?.value || '';

  if (!email) return setAuthMessage('Hãy nhập email.', 'error');
  if (password.length < 6) return setAuthMessage('Mật khẩu cần ít nhất 6 ký tự.', 'error');

  authSubmitBtn.disabled = true;
  authSubmitBtn.textContent = authMode === 'login' ? 'Đang đăng nhập...' : 'Đang tạo tài khoản...';
  setAuthMessage('');

  try {
    if (authMode === 'signup') {
      const redirectTo = `${window.location.origin}${window.location.pathname}`;
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: redirectTo }
      });

      if (error) throw error;

      if (data?.session) {
        setAuthMessage('Tạo tài khoản thành công.', 'success');
        setTimeout(closeAuthModal, 500);
      } else {
        setAuthMessage('Đã tạo tài khoản. Hãy kiểm tra email để xác nhận rồi đăng nhập.', 'success');
      }
    } else {
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setAuthMessage('Đăng nhập thành công.', 'success');
      setTimeout(closeAuthModal, 350);
    }
  } catch (error) {
    setAuthMessage(error?.message || 'Không thể đăng nhập. Hãy thử lại.', 'error');
  } finally {
    authSubmitBtn.disabled = false;
    authSubmitBtn.textContent = authMode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản';
  }
});

window.aiSoundAuth = {
  open: openAuthModal,
  close: closeAuthModal,
  getSession,
  getAccessToken,
  refreshPermission: fetchPermission,
  getState: () => ({ ...authState })
};

initAuth();
