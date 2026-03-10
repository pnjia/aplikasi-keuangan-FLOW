/* ============================================================
   FLOW — Aplikasi Keuangan UMKM (Frontend Prototype)
   Standalone tanpa backend. Data disimpan di localStorage.
   ============================================================ */

// ==================== UTILITIES ====================
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
function formatRupiah(n) {
  if (n == null) return 'Rp 0';
  return 'Rp ' + Number(n).toLocaleString('id-ID', { minimumFractionDigits: 0 });
}
function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}
function isoDate(d) {
  return d ? new Date(d).toISOString().slice(0, 10) : '';
}
function escapeHtml(str) {
  if (!str) return '';
  var div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}
function today() { return new Date().toISOString().slice(0, 10); }
function monthStart() { var d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); }
function monthEnd() { var d = new Date(); d.setMonth(d.getMonth() + 1, 0); return d.toISOString().slice(0, 10); }

// ==================== DATA STORE ====================
var Store = {
  _key: 'flow_app_data',
  _data: null,

  load: function () {
    var raw = localStorage.getItem(this._key);
    if (raw) {
      try { this._data = JSON.parse(raw); } catch (e) { this._data = null; }
    }
    if (!this._data) {
      this._data = this._seed();
      this.save();
    }
    return this._data;
  },
  save: function () {
    localStorage.setItem(this._key, JSON.stringify(this._data));
  },
  get: function (table) { return this._data[table] || []; },
  add: function (table, item) {
    if (!item.id) item.id = uuid();
    if (!item.created_at) item.created_at = new Date().toISOString();
    this._data[table].push(item);
    this.save();
    return item;
  },
  update: function (table, id, changes) {
    var arr = this._data[table];
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].id === id) {
        for (var k in changes) arr[i][k] = changes[k];
        arr[i].updated_at = new Date().toISOString();
        this.save();
        return arr[i];
      }
    }
    return null;
  },
  find: function (table, id) {
    var arr = this._data[table] || [];
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].id === id) return arr[i];
    }
    return null;
  },
  where: function (table, filter) {
    return (this._data[table] || []).filter(function (r) {
      for (var k in filter) { if (r[k] !== filter[k]) return false; }
      return true;
    });
  },
  remove: function (table, id) {
    this._data[table] = (this._data[table] || []).filter(function (r) { return r.id !== id; });
    this.save();
  },
  reset: function () {
    this._data = this._seed();
    this.save();
  },

  _seed: function () {
    return {
      users: [],
      companies: [],
      company_roles: [],
      contacts: [],
      accounts: [],
      invoices: [],
      invoice_items: [],
      journal_entries: [],
      journal_lines: []
    };
  }
};

// ==================== SESSION ====================
var Session = {
  _key: 'flow_session',
  get: function () {
    var raw = localStorage.getItem(this._key);
    return raw ? JSON.parse(raw) : null;
  },
  set: function (data) {
    localStorage.setItem(this._key, JSON.stringify(data));
  },
  clear: function () {
    localStorage.removeItem(this._key);
  },
  user: function () {
    var s = this.get();
    return s ? Store.find('users', s.user_id) : null;
  },
  companyId: function () {
    var s = this.get();
    return s ? s.company_id : null;
  },
  role: function () {
    var s = this.get();
    return s ? s.role : null;
  }
};

// ==================== TOAST ====================
function showToast(msg, type) {
  type = type || 'success';
  var container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  var t = document.createElement('div');
  t.className = 'toast toast-' + type;
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(function () { t.remove(); }, 3000);
}

// ==================== ROUTER ====================
var Router = {
  routes: {},
  register: function (path, handler) { this.routes[path] = handler; },
  navigate: function (path) { window.location.hash = '#' + path; },
  current: function () { return window.location.hash.slice(1) || '/login'; },
  start: function () {
    var self = this;
    window.addEventListener('hashchange', function () { self._resolve(); });
    this._resolve();
  },
  _resolve: function () {
    var path = this.current();
    // Check auth
    var session = Session.get();
    var publicPages = ['/login', '/register'];
    if (!session && publicPages.indexOf(path) === -1) {
      this.navigate('/login');
      return;
    }
    if (session && (path === '/login' || path === '/register')) {
      var companyId = Session.companyId();
      this.navigate(companyId ? '/dashboard' : '/onboarding');
      return;
    }
    // Try exact match
    if (this.routes[path]) { this.routes[path](); return; }
    // Try parameterized route /invoices/:id
    for (var route in this.routes) {
      var paramMatch = route.match(/^(.+)\/:id$/);
      if (paramMatch) {
        var base = paramMatch[1];
        if (path.indexOf(base + '/') === 0) {
          var id = path.slice(base.length + 1);
          this.routes[route](id);
          return;
        }
      }
    }
    // 404
    document.getElementById('app').innerHTML = '<div class="auth-wrapper"><div class="auth-card"><h1>404</h1><p class="subtitle">Halaman tidak ditemukan</p><button class="btn btn-primary btn-block" onclick="Router.navigate(\'/dashboard\')">Kembali ke Dashboard</button></div></div>';
  }
};

// ==================== DEFAULT ACCOUNTS ====================
function seedDefaultAccounts(companyId, userId) {
  var defaults = [
    { code: '1000', name: 'Kas & Bank', type: 'ASSET', parent: null },
    { code: '1001', name: 'Kas Kecil', type: 'ASSET', parent: '1000' },
    { code: '1002', name: 'Rekening Bank BCA', type: 'ASSET', parent: '1000' },
    { code: '1100', name: 'Piutang Usaha', type: 'ASSET', parent: null },
    { code: '2000', name: 'Hutang Usaha', type: 'LIABILITY', parent: null },
    { code: '3000', name: 'Modal Pemilik', type: 'EQUITY', parent: null },
    { code: '4000', name: 'Pendapatan Usaha', type: 'REVENUE', parent: null },
    { code: '5000', name: 'Beban Operasional', type: 'EXPENSE', parent: null },
    { code: '5001', name: 'Beban Gaji', type: 'EXPENSE', parent: '5000' },
    { code: '5002', name: 'Beban Sewa', type: 'EXPENSE', parent: '5000' },
    { code: '5003', name: 'Beban Listrik & Air', type: 'EXPENSE', parent: '5000' }
  ];
  var idMap = {};
  defaults.forEach(function (a) {
    var item = Store.add('accounts', {
      company_id: companyId,
      parent_account_id: null,
      account_code: a.code,
      account_name: a.name,
      account_type: a.type,
      created_by: userId
    });
    idMap[a.code] = item.id;
  });
  // Set parents
  defaults.forEach(function (a) {
    if (a.parent && idMap[a.parent]) {
      var item = Store.find('accounts', idMap[a.code]);
      if (item) item.parent_account_id = idMap[a.parent];
    }
  });
  Store.save();
}

// ==================== LAYOUT HELPERS ====================
function renderAuthPage(content) {
  document.getElementById('app').innerHTML = '<div class="auth-wrapper">' + content + '</div>';
}

function renderAppPage(title, content) {
  var session = Session.get();
  var user = Session.user();
  var role = Session.role();
  var company = Store.find('companies', Session.companyId());
  var companyName = company ? escapeHtml(company.name) : '';

  var menuItems = [
    { section: 'UTAMA' },
    { icon: '📊', label: 'Dashboard', path: '/dashboard', roles: ['OWNER', 'ADMIN', 'KASIR'] },
    { section: 'TRANSAKSI' },
    { icon: '📄', label: 'Tagihan (Invoice)', path: '/invoices', roles: ['OWNER', 'ADMIN', 'KASIR'] },
    { icon: '📒', label: 'Jurnal Umum', path: '/journal', roles: ['OWNER', 'ADMIN'] },
    { section: 'MASTER DATA' },
    { icon: '📇', label: 'Kontak', path: '/contacts', roles: ['OWNER', 'ADMIN'] },
    { icon: '📊', label: 'Bagan Akun', path: '/accounts', roles: ['OWNER', 'ADMIN'] },
    { section: 'LAPORAN' },
    { icon: '📈', label: 'Laporan Keuangan', path: '/reports', roles: ['OWNER', 'ADMIN'] },
    { section: 'PENGATURAN' },
    { icon: '🏢', label: 'Perusahaan', path: '/companies', roles: ['OWNER'] },
    { icon: '👥', label: 'Manajemen Tim', path: '/employees', roles: ['OWNER'] }
  ];

  var currentPath = Router.current();
  var menuHtml = '';
  menuItems.forEach(function (m) {
    if (m.section) {
      menuHtml += '<div class="sidebar-section">' + m.section + '</div>';
    } else if (m.roles.indexOf(role) !== -1) {
      var active = currentPath === m.path || (m.path !== '/dashboard' && currentPath.indexOf(m.path) === 0);
      menuHtml += '<button class="sidebar-link' + (active ? ' active' : '') + '" onclick="Router.navigate(\'' + m.path + '\')">' +
        '<span class="icon">' + m.icon + '</span>' + m.label + '</button>';
    }
  });

  document.getElementById('app').innerHTML =
    '<div class="app-layout">' +
      '<div class="mobile-overlay" onclick="toggleSidebar()"></div>' +
      '<aside class="sidebar" id="sidebar">' +
        '<div class="sidebar-brand"><span class="icon">💰</span> FLOW</div>' +
        '<nav class="sidebar-menu">' + menuHtml + '</nav>' +
        '<div class="sidebar-footer">' +
          '<div class="user-name">' + escapeHtml(user ? user.full_name : '') + '</div>' +
          '<div class="user-role"><span class="role-badge role-' + (role || '').toLowerCase() + '">' + (role || '') + '</span></div>' +
          '<button onclick="doLogout()">🚪 Keluar</button>' +
        '</div>' +
      '</aside>' +
      '<div class="main-content">' +
        '<header class="topbar">' +
          '<div style="display:flex;align-items:center;gap:.75rem">' +
            '<button class="mobile-toggle" onclick="toggleSidebar()">☰</button>' +
            '<h2>' + title + '</h2>' +
          '</div>' +
          '<span class="company-badge">🏢 ' + companyName + '</span>' +
        '</header>' +
        '<div class="page-content">' + content + '</div>' +
      '</div>' +
    '</div>';
}

function toggleSidebar() {
  var sb = document.getElementById('sidebar');
  var ov = document.querySelector('.mobile-overlay');
  if (sb) sb.classList.toggle('open');
  if (ov) ov.classList.toggle('show');
}

function doLogout() {
  Session.clear();
  Router.navigate('/login');
  showToast('Berhasil keluar', 'info');
}

// ==================== PAGE: LOGIN ====================
Router.register('/login', function () {
  renderAuthPage(
    '<div class="auth-card">' +
      '<div class="logo">💰</div>' +
      '<h1>FLOW</h1>' +
      '<p class="subtitle">Masuk ke Aplikasi Keuangan UMKM</p>' +
      '<div id="login-error"></div>' +
      '<div class="form-group"><label>Email</label><input type="email" id="login-email" placeholder="email@contoh.com" /></div>' +
      '<div class="form-group"><label>Kata Sandi</label><input type="password" id="login-pass" placeholder="Masukkan kata sandi" /></div>' +
      '<button class="btn btn-primary btn-block" onclick="handleLogin()">Masuk</button>' +
      '<p style="text-align:center;margin-top:1rem;font-size:.88rem">Belum punya akun? <button class="link-btn" onclick="Router.navigate(\'/register\')">Daftar sekarang</button></p>' +
    '</div>'
  );
  var emailEl = document.getElementById('login-email');
  if (emailEl) emailEl.focus();
});

function handleLogin() {
  var email = document.getElementById('login-email').value.trim();
  var pass = document.getElementById('login-pass').value;
  if (!email || !pass) {
    document.getElementById('login-error').innerHTML = '<div class="alert alert-danger">⚠️ Email dan kata sandi wajib diisi</div>';
    return;
  }
  var users = Store.get('users');
  var user = null;
  for (var i = 0; i < users.length; i++) {
    if (users[i].email === email && users[i].password_hash === pass) {
      user = users[i]; break;
    }
  }
  if (!user) {
    document.getElementById('login-error').innerHTML = '<div class="alert alert-danger">⚠️ Email atau kata sandi salah</div>';
    return;
  }
  // Find company role
  var roles = Store.where('company_roles', { user_id: user.id });
  if (roles.length > 0) {
    Session.set({ user_id: user.id, company_id: roles[0].company_id, role: roles[0].role_name });
    showToast('Selamat datang, ' + user.full_name + '!');
    Router.navigate('/dashboard');
  } else {
    Session.set({ user_id: user.id, company_id: null, role: 'OWNER' });
    Router.navigate('/onboarding');
  }
}

// ==================== PAGE: REGISTER ====================
Router.register('/register', function () {
  renderAuthPage(
    '<div class="auth-card">' +
      '<div class="logo">💰</div>' +
      '<h1>Daftar Akun</h1>' +
      '<p class="subtitle">Buat akun baru untuk memulai</p>' +
      '<div id="reg-error"></div>' +
      '<div class="form-group"><label>Nama Lengkap</label><input type="text" id="reg-name" placeholder="Nama lengkap Anda" /></div>' +
      '<div class="form-group"><label>Email</label><input type="email" id="reg-email" placeholder="email@contoh.com" /></div>' +
      '<div class="form-group"><label>Kata Sandi</label><input type="password" id="reg-pass" placeholder="Minimal 6 karakter" /></div>' +
      '<div class="form-group"><label>Konfirmasi Kata Sandi</label><input type="password" id="reg-pass2" placeholder="Ulangi kata sandi" /></div>' +
      '<button class="btn btn-primary btn-block" onclick="handleRegister()">Daftar</button>' +
      '<p style="text-align:center;margin-top:1rem;font-size:.88rem">Sudah punya akun? <button class="link-btn" onclick="Router.navigate(\'/login\')">Masuk</button></p>' +
    '</div>'
  );
});

function handleRegister() {
  var name = document.getElementById('reg-name').value.trim();
  var email = document.getElementById('reg-email').value.trim();
  var pass = document.getElementById('reg-pass').value;
  var pass2 = document.getElementById('reg-pass2').value;
  if (!name || !email || !pass) {
    document.getElementById('reg-error').innerHTML = '<div class="alert alert-danger">⚠️ Semua field wajib diisi</div>';
    return;
  }
  if (pass.length < 6) {
    document.getElementById('reg-error').innerHTML = '<div class="alert alert-danger">⚠️ Kata sandi minimal 6 karakter</div>';
    return;
  }
  if (pass !== pass2) {
    document.getElementById('reg-error').innerHTML = '<div class="alert alert-danger">⚠️ Konfirmasi kata sandi tidak cocok</div>';
    return;
  }
  var existing = Store.get('users').filter(function (u) { return u.email === email; });
  if (existing.length > 0) {
    document.getElementById('reg-error').innerHTML = '<div class="alert alert-danger">⚠️ Email sudah terdaftar</div>';
    return;
  }
  var user = Store.add('users', { full_name: name, email: email, password_hash: pass });
  Session.set({ user_id: user.id, company_id: null, role: 'OWNER' });
  showToast('Registrasi berhasil! Silakan buat profil perusahaan.');
  Router.navigate('/onboarding');
}

// ==================== PAGE: ONBOARDING ====================
Router.register('/onboarding', function () {
  document.getElementById('app').innerHTML =
    '<div class="onboard-wrapper">' +
      '<div class="onboard-card">' +
        '<h1>🏢 Buat Profil Perusahaan</h1>' +
        '<p class="subtitle">Langkah selanjutnya: isi profil bisnis Anda untuk mulai menggunakan aplikasi.</p>' +
        '<div id="onboard-error"></div>' +
        '<div class="form-group"><label>Nama Bisnis / Perusahaan</label><input type="text" id="co-name" placeholder="contoh: Toko Makmur Jaya" /></div>' +
        '<div class="form-group"><label>Alamat</label><textarea id="co-addr" placeholder="Alamat lengkap bisnis"></textarea></div>' +
        '<div class="form-group"><label>Nomor NPWP (opsional)</label><input type="text" id="co-tax" placeholder="contoh: 12.345.678.9-012.000" /></div>' +
        '<button class="btn btn-primary btn-block" onclick="handleOnboarding()">Simpan & Mulai</button>' +
      '</div>' +
    '</div>';
});

function handleOnboarding() {
  var name = document.getElementById('co-name').value.trim();
  var addr = document.getElementById('co-addr').value.trim();
  var tax = document.getElementById('co-tax').value.trim();
  if (!name) {
    document.getElementById('onboard-error').innerHTML = '<div class="alert alert-danger">⚠️ Nama bisnis wajib diisi</div>';
    return;
  }
  var userId = Session.get().user_id;
  // @Transactional simulation: create company + role atomically
  var company = Store.add('companies', {
    owner_id: userId,
    name: name,
    address: addr,
    tax_number: tax || null,
    created_by: userId
  });
  Store.add('company_roles', {
    company_id: company.id,
    user_id: userId,
    role_name: 'OWNER'
  });
  // Seed default chart of accounts
  seedDefaultAccounts(company.id, userId);
  Session.set({ user_id: userId, company_id: company.id, role: 'OWNER' });
  showToast('Perusahaan berhasil dibuat! Selamat datang di FLOW.');
  Router.navigate('/dashboard');
}

// ==================== PAGE: DASHBOARD ====================
Router.register('/dashboard', function () {
  var cid = Session.companyId();
  var invoices = Store.where('invoices', { company_id: cid });
  var contacts = Store.where('contacts', { company_id: cid });
  var accounts = Store.where('accounts', { company_id: cid });
  var journalEntries = Store.where('journal_entries', { company_id: cid });

  var totalUnpaid = 0, countUnpaid = 0, totalPaid = 0, totalRevenue = 0;
  invoices.forEach(function (inv) {
    if (inv.status === 'SENT' || inv.status === 'DRAFT') { totalUnpaid += Number(inv.total_amount || 0); countUnpaid++; }
    if (inv.status === 'PAID') totalPaid += Number(inv.total_amount || 0);
  });

  // Calculate cash from journal lines
  var cashAccountIds = accounts.filter(function (a) { return a.account_type === 'ASSET' && (a.account_code === '1001' || a.account_code === '1002'); }).map(function (a) { return a.id; });
  var journalLines = Store.get('journal_lines');
  var cashBalance = 0;
  journalLines.forEach(function (jl) {
    if (cashAccountIds.indexOf(jl.account_id) !== -1) {
      cashBalance += Number(jl.debit_amount || 0) - Number(jl.credit_amount || 0);
    }
  });

  // Revenue from journal
  var revenueAccountIds = accounts.filter(function (a) { return a.account_type === 'REVENUE'; }).map(function (a) { return a.id; });
  journalLines.forEach(function (jl) {
    if (revenueAccountIds.indexOf(jl.account_id) !== -1) {
      totalRevenue += Number(jl.credit_amount || 0) - Number(jl.debit_amount || 0);
    }
  });

  var recentInvoices = invoices.slice().sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); }).slice(0, 5);

  var invoiceRows = '';
  if (recentInvoices.length === 0) {
    invoiceRows = '<tr><td colspan="5" class="text-center text-muted" style="padding:2rem">Belum ada tagihan</td></tr>';
  } else {
    recentInvoices.forEach(function (inv) {
      var contact = Store.find('contacts', inv.contact_id);
      var statusClass = 'status-' + (inv.status || 'draft').toLowerCase();
      var statusLabel = { DRAFT: 'Draft', SENT: 'Belum Lunas', PAID: 'Lunas', CANCELLED: 'Batal' }[inv.status] || inv.status;
      invoiceRows += '<tr onclick="Router.navigate(\'/invoices/' + inv.id + '\')" style="cursor:pointer">' +
        '<td><strong>' + escapeHtml(inv.invoice_number) + '</strong></td>' +
        '<td>' + escapeHtml(contact ? contact.name : '-') + '</td>' +
        '<td>' + formatDate(inv.issue_date) + '</td>' +
        '<td class="text-right">' + formatRupiah(inv.total_amount) + '</td>' +
        '<td><span class="status ' + statusClass + '">' + statusLabel + '</span></td>' +
        '</tr>';
    });
  }

  renderAppPage('Dashboard',
    '<div class="metrics-grid">' +
      '<div class="metric-card"><div class="metric-icon blue">💰</div><div class="metric-info"><div class="label">Saldo Kas</div><div class="value">' + formatRupiah(cashBalance) + '</div><div class="sub">Total di akun Kas & Bank</div></div></div>' +
      '<div class="metric-card"><div class="metric-icon green">📈</div><div class="metric-info"><div class="label">Pendapatan</div><div class="value">' + formatRupiah(totalRevenue) + '</div><div class="sub">Total pendapatan tercatat</div></div></div>' +
      '<div class="metric-card"><div class="metric-icon amber">📄</div><div class="metric-info"><div class="label">Tagihan Belum Lunas</div><div class="value">' + formatRupiah(totalUnpaid) + '</div><div class="sub">' + countUnpaid + ' tagihan menunggu</div></div></div>' +
      '<div class="metric-card"><div class="metric-icon purple">📇</div><div class="metric-info"><div class="label">Total Kontak</div><div class="value">' + contacts.length + '</div><div class="sub">Pelanggan & Vendor</div></div></div>' +
    '</div>' +
    '<div class="card">' +
      '<div class="card-header"><h3>📄 Tagihan Terbaru</h3><button class="btn btn-primary btn-sm" onclick="Router.navigate(\'/invoices\')">Lihat Semua</button></div>' +
      '<div class="table-wrap"><table class="data-table"><thead><tr><th>No. Invoice</th><th>Pelanggan</th><th>Tanggal</th><th class="text-right">Total</th><th>Status</th></tr></thead><tbody>' + invoiceRows + '</tbody></table></div>' +
    '</div>'
  );
});

// ==================== PAGE: CONTACTS ====================
Router.register('/contacts', function () {
  var cid = Session.companyId();
  var contacts = Store.where('contacts', { company_id: cid });

  var rows = '';
  if (contacts.length === 0) {
    rows = '<tr><td colspan="5" class="text-center text-muted" style="padding:2rem">Belum ada kontak. Tambahkan pelanggan atau vendor pertama Anda.</td></tr>';
  } else {
    contacts.forEach(function (c) {
      var typeBadge = c.type === 'CUSTOMER' ? '<span class="status status-sent">Pelanggan</span>' : '<span class="status status-unpaid">Vendor</span>';
      rows += '<tr>' +
        '<td><strong>' + escapeHtml(c.name) + '</strong></td>' +
        '<td>' + typeBadge + '</td>' +
        '<td>' + escapeHtml(c.email || '-') + '</td>' +
        '<td>' + escapeHtml(c.phone || '-') + '</td>' +
        '<td class="actions"><button class="btn btn-outline btn-sm" onclick="editContact(\'' + c.id + '\')">✏️ Edit</button> <button class="btn btn-danger btn-sm" onclick="deleteContact(\'' + c.id + '\')">🗑️</button></td>' +
        '</tr>';
    });
  }

  renderAppPage('Kontak',
    '<div class="card">' +
      '<div class="card-header"><h3>📇 Daftar Kontak</h3><button class="btn btn-primary btn-sm" onclick="showContactModal()">+ Tambah Kontak</button></div>' +
      '<div class="table-wrap"><table class="data-table"><thead><tr><th>Nama</th><th>Tipe</th><th>Email</th><th>Telepon</th><th>Aksi</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
    '</div>' +
    '<div id="contact-modal"></div>'
  );
});

function showContactModal(contactId) {
  var c = contactId ? Store.find('contacts', contactId) : null;
  var title = c ? 'Edit Kontak' : 'Tambah Kontak Baru';
  document.getElementById('contact-modal').innerHTML =
    '<div class="modal-overlay" onclick="closeContactModal(event)">' +
      '<div class="modal" onclick="event.stopPropagation()">' +
        '<div class="modal-header"><h3>' + title + '</h3><button class="modal-close" onclick="closeContactModal()">&times;</button></div>' +
        '<div class="modal-body">' +
          '<div class="form-group"><label>Nama</label><input type="text" id="ct-name" value="' + escapeHtml(c ? c.name : '') + '" placeholder="Nama kontak" /></div>' +
          '<div class="form-group"><label>Tipe</label><select id="ct-type"><option value="CUSTOMER"' + (c && c.type === 'CUSTOMER' ? ' selected' : '') + '>Pelanggan (Customer)</option><option value="VENDOR"' + (c && c.type === 'VENDOR' ? ' selected' : '') + '>Vendor</option></select></div>' +
          '<div class="form-row">' +
            '<div class="form-group"><label>Email</label><input type="email" id="ct-email" value="' + escapeHtml(c ? c.email || '' : '') + '" placeholder="email@contoh.com" /></div>' +
            '<div class="form-group"><label>Telepon</label><input type="text" id="ct-phone" value="' + escapeHtml(c ? c.phone || '' : '') + '" placeholder="08xx" /></div>' +
          '</div>' +
        '</div>' +
        '<div class="modal-footer"><button class="btn btn-outline" onclick="closeContactModal()">Batal</button><button class="btn btn-primary" onclick="saveContact(\'' + (contactId || '') + '\')">Simpan</button></div>' +
      '</div>' +
    '</div>';
}
function editContact(id) { showContactModal(id); }
function closeContactModal(e) { if (!e || e.target.classList.contains('modal-overlay')) document.getElementById('contact-modal').innerHTML = ''; }
function saveContact(id) {
  var name = document.getElementById('ct-name').value.trim();
  var type = document.getElementById('ct-type').value;
  var email = document.getElementById('ct-email').value.trim();
  var phone = document.getElementById('ct-phone').value.trim();
  if (!name) { showToast('Nama kontak wajib diisi', 'error'); return; }
  if (id) {
    Store.update('contacts', id, { name: name, type: type, email: email, phone: phone });
    showToast('Kontak berhasil diperbarui');
  } else {
    Store.add('contacts', { company_id: Session.companyId(), name: name, type: type, email: email, phone: phone, created_by: Session.get().user_id });
    showToast('Kontak berhasil ditambahkan');
  }
  Router.navigate('/contacts');
}
function deleteContact(id) {
  if (confirm('Yakin ingin menghapus kontak ini?')) {
    Store.remove('contacts', id);
    showToast('Kontak dihapus');
    Router.navigate('/contacts');
  }
}

// ==================== PAGE: ACCOUNTS (Chart of Accounts) ====================
Router.register('/accounts', function () {
  var cid = Session.companyId();
  var accounts = Store.where('accounts', { company_id: cid }).sort(function (a, b) { return a.account_code.localeCompare(b.account_code); });

  var typeLabels = { ASSET: 'Aset', LIABILITY: 'Liabilitas', EQUITY: 'Ekuitas', REVENUE: 'Pendapatan', EXPENSE: 'Beban' };
  var typeColors = { ASSET: 'status-sent', LIABILITY: 'status-unpaid', EQUITY: 'status-paid', REVENUE: 'status-paid', EXPENSE: 'status-cancelled' };

  var rows = '';
  if (accounts.length === 0) {
    rows = '<tr><td colspan="4" class="text-center text-muted" style="padding:2rem">Belum ada akun</td></tr>';
  } else {
    accounts.forEach(function (a) {
      var isChild = !!a.parent_account_id;
      var indent = isChild ? 'style="padding-left:2.5rem"' : '';
      rows += '<tr>' +
        '<td ' + indent + '><strong class="font-mono">' + escapeHtml(a.account_code) + '</strong></td>' +
        '<td>' + (isChild ? '↳ ' : '') + escapeHtml(a.account_name) + '</td>' +
        '<td><span class="status ' + (typeColors[a.account_type] || '') + '">' + (typeLabels[a.account_type] || a.account_type) + '</span></td>' +
        '<td class="actions"><button class="btn btn-outline btn-sm" onclick="editAccount(\'' + a.id + '\')">✏️</button> <button class="btn btn-danger btn-sm" onclick="deleteAccount(\'' + a.id + '\')">🗑️</button></td>' +
        '</tr>';
    });
  }

  renderAppPage('Bagan Akun',
    '<div class="card">' +
      '<div class="card-header"><h3>📊 Bagan Akun (Chart of Accounts)</h3><button class="btn btn-primary btn-sm" onclick="showAccountModal()">+ Tambah Akun</button></div>' +
      '<div class="table-wrap"><table class="data-table"><thead><tr><th>Kode</th><th>Nama Akun</th><th>Tipe</th><th>Aksi</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
    '</div>' +
    '<div id="account-modal"></div>'
  );
});

function showAccountModal(accountId) {
  var a = accountId ? Store.find('accounts', accountId) : null;
  var title = a ? 'Edit Akun' : 'Tambah Akun Baru';
  var cid = Session.companyId();
  var parents = Store.where('accounts', { company_id: cid }).filter(function (x) { return !x.parent_account_id; });
  var parentOpts = '<option value="">— Tidak ada (Akun Induk) —</option>';
  parents.forEach(function (p) {
    var sel = (a && a.parent_account_id === p.id) ? ' selected' : '';
    parentOpts += '<option value="' + p.id + '"' + sel + '>' + escapeHtml(p.account_code + ' - ' + p.account_name) + '</option>';
  });

  document.getElementById('account-modal').innerHTML =
    '<div class="modal-overlay" onclick="closeAccountModal(event)">' +
      '<div class="modal" onclick="event.stopPropagation()">' +
        '<div class="modal-header"><h3>' + title + '</h3><button class="modal-close" onclick="closeAccountModal()">&times;</button></div>' +
        '<div class="modal-body">' +
          '<div class="form-row">' +
            '<div class="form-group"><label>Kode Akun</label><input type="text" id="ac-code" value="' + escapeHtml(a ? a.account_code : '') + '" placeholder="contoh: 1003" /></div>' +
            '<div class="form-group"><label>Tipe Akun</label><select id="ac-type"><option value="ASSET"' + (a && a.account_type === 'ASSET' ? ' selected' : '') + '>Aset</option><option value="LIABILITY"' + (a && a.account_type === 'LIABILITY' ? ' selected' : '') + '>Liabilitas</option><option value="EQUITY"' + (a && a.account_type === 'EQUITY' ? ' selected' : '') + '>Ekuitas</option><option value="REVENUE"' + (a && a.account_type === 'REVENUE' ? ' selected' : '') + '>Pendapatan</option><option value="EXPENSE"' + (a && a.account_type === 'EXPENSE' ? ' selected' : '') + '>Beban</option></select></div>' +
          '</div>' +
          '<div class="form-group"><label>Nama Akun</label><input type="text" id="ac-name" value="' + escapeHtml(a ? a.account_name : '') + '" placeholder="contoh: Kas Kecil" /></div>' +
          '<div class="form-group"><label>Akun Induk (opsional)</label><select id="ac-parent">' + parentOpts + '</select></div>' +
        '</div>' +
        '<div class="modal-footer"><button class="btn btn-outline" onclick="closeAccountModal()">Batal</button><button class="btn btn-primary" onclick="saveAccount(\'' + (accountId || '') + '\')">Simpan</button></div>' +
      '</div>' +
    '</div>';
}
function editAccount(id) { showAccountModal(id); }
function closeAccountModal(e) { if (!e || e.target.classList.contains('modal-overlay')) document.getElementById('account-modal').innerHTML = ''; }
function saveAccount(id) {
  var code = document.getElementById('ac-code').value.trim();
  var name = document.getElementById('ac-name').value.trim();
  var type = document.getElementById('ac-type').value;
  var parent = document.getElementById('ac-parent').value || null;
  if (!code || !name) { showToast('Kode dan nama akun wajib diisi', 'error'); return; }
  if (id) {
    Store.update('accounts', id, { account_code: code, account_name: name, account_type: type, parent_account_id: parent });
    showToast('Akun berhasil diperbarui');
  } else {
    Store.add('accounts', { company_id: Session.companyId(), account_code: code, account_name: name, account_type: type, parent_account_id: parent, created_by: Session.get().user_id });
    showToast('Akun berhasil ditambahkan');
  }
  Router.navigate('/accounts');
}
function deleteAccount(id) {
  if (confirm('Yakin ingin menghapus akun ini?')) {
    Store.remove('accounts', id);
    showToast('Akun dihapus');
    Router.navigate('/accounts');
  }
}

// ==================== PAGE: INVOICES ====================
Router.register('/invoices', function () {
  var cid = Session.companyId();
  var invoices = Store.where('invoices', { company_id: cid }).sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });

  var rows = '';
  if (invoices.length === 0) {
    rows = '<tr><td colspan="6" class="text-center text-muted" style="padding:2rem">Belum ada tagihan. Buat tagihan pertama Anda!</td></tr>';
  } else {
    invoices.forEach(function (inv) {
      var contact = Store.find('contacts', inv.contact_id);
      var statusClass = 'status-' + (inv.status || 'draft').toLowerCase();
      var statusLabels = { DRAFT: 'Draft', SENT: 'Belum Lunas', PAID: 'Lunas', CANCELLED: 'Batal' };
      rows += '<tr onclick="Router.navigate(\'/invoices/' + inv.id + '\')" style="cursor:pointer">' +
        '<td><strong>' + escapeHtml(inv.invoice_number) + '</strong></td>' +
        '<td>' + escapeHtml(contact ? contact.name : '-') + '</td>' +
        '<td>' + formatDate(inv.issue_date) + '</td>' +
        '<td>' + formatDate(inv.due_date) + '</td>' +
        '<td class="text-right font-mono">' + formatRupiah(inv.total_amount) + '</td>' +
        '<td><span class="status ' + statusClass + '">' + (statusLabels[inv.status] || inv.status) + '</span></td>' +
        '</tr>';
    });
  }

  renderAppPage('Tagihan (Invoice)',
    '<div class="card">' +
      '<div class="card-header"><h3>📄 Daftar Tagihan</h3><button class="btn btn-primary btn-sm" onclick="Router.navigate(\'/invoices/new\')">+ Buat Tagihan Baru</button></div>' +
      '<div class="table-wrap"><table class="data-table"><thead><tr><th>No. Invoice</th><th>Pelanggan</th><th>Tanggal</th><th>Jatuh Tempo</th><th class="text-right">Total</th><th>Status</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
    '</div>'
  );
});

// ==================== PAGE: CREATE INVOICE ====================
Router.register('/invoices/new', function () {
  var cid = Session.companyId();
  var customers = Store.where('contacts', { company_id: cid }).filter(function (c) { return c.type === 'CUSTOMER'; });

  var customerOpts = '<option value="">— Pilih Pelanggan —</option>';
  customers.forEach(function (c) {
    customerOpts += '<option value="' + c.id + '">' + escapeHtml(c.name) + '</option>';
  });

  // Generate invoice number
  var invoices = Store.where('invoices', { company_id: cid });
  var nextNum = 'INV-' + String(invoices.length + 1).padStart(4, '0');

  renderAppPage('Buat Tagihan Baru',
    '<div class="card">' +
      '<h3 style="margin-bottom:1rem">📄 Formulir Tagihan Baru</h3>' +
      (customers.length === 0 ? '<div class="alert alert-warning">⚠️ Belum ada kontak pelanggan. <button class="link-btn" onclick="Router.navigate(\'/contacts\')">Tambahkan kontak</button> terlebih dahulu.</div>' : '') +
      '<div class="form-row">' +
        '<div class="form-group"><label>No. Invoice</label><input type="text" id="inv-number" value="' + nextNum + '" /></div>' +
        '<div class="form-group"><label>Pelanggan</label><select id="inv-contact">' + customerOpts + '</select></div>' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="form-group"><label>Tanggal Terbit</label><input type="date" id="inv-date" value="' + today() + '" /></div>' +
        '<div class="form-group"><label>Jatuh Tempo</label><input type="date" id="inv-due" value="' + isoDate(new Date(Date.now() + 30 * 86400000)) + '" /></div>' +
      '</div>' +
      '<hr class="divider" />' +
      '<h4 style="margin-bottom:.75rem">Detail Barang / Jasa</h4>' +
      '<div class="item-row" style="font-size:.78rem;font-weight:600;color:var(--gray-500)">' +
        '<div>Deskripsi</div><div>Jumlah</div><div>Harga Satuan</div><div>Subtotal</div><div></div>' +
      '</div>' +
      '<div id="inv-items"></div>' +
      '<button class="btn btn-outline btn-sm" onclick="addInvoiceItem()" style="margin-top:.25rem">+ Tambah Baris</button>' +
      '<hr class="divider" />' +
      '<div style="text-align:right;font-size:1.1rem;font-weight:700" id="inv-total">Total: Rp 0</div>' +
      '<div class="btn-group" style="margin-top:1rem;justify-content:flex-end">' +
        '<button class="btn btn-outline" onclick="Router.navigate(\'/invoices\')">Batal</button>' +
        '<button class="btn btn-primary" onclick="saveInvoice(\'DRAFT\')">Simpan sebagai Draft</button>' +
        '<button class="btn btn-success" onclick="saveInvoice(\'SENT\')">Simpan & Kirim</button>' +
      '</div>' +
    '</div>'
  );
  addInvoiceItem();
});

var invoiceItemCount = 0;
function addInvoiceItem() {
  invoiceItemCount++;
  var idx = invoiceItemCount;
  var container = document.getElementById('inv-items');
  var row = document.createElement('div');
  row.className = 'item-row';
  row.id = 'item-' + idx;
  row.innerHTML =
    '<div class="form-group"><input type="text" id="item-desc-' + idx + '" placeholder="Nama barang/jasa" /></div>' +
    '<div class="form-group"><input type="number" id="item-qty-' + idx + '" value="1" min="0" step="any" onchange="calcInvoiceTotal()" oninput="calcInvoiceTotal()" /></div>' +
    '<div class="form-group"><input type="number" id="item-price-' + idx + '" value="0" min="0" step="any" onchange="calcInvoiceTotal()" oninput="calcInvoiceTotal()" /></div>' +
    '<div class="form-group"><input type="text" id="item-sub-' + idx + '" value="Rp 0" readonly style="background:var(--gray-50)" /></div>' +
    '<button class="remove-item" onclick="removeInvoiceItem(' + idx + ')" title="Hapus baris">✕</button>';
  container.appendChild(row);
}
function removeInvoiceItem(idx) {
  var row = document.getElementById('item-' + idx);
  if (row) row.remove();
  calcInvoiceTotal();
}
function calcInvoiceTotal() {
  var container = document.getElementById('inv-items');
  if (!container) return;
  var rows = container.querySelectorAll('.item-row');
  var total = 0;
  rows.forEach(function (row) {
    var id = row.id.replace('item-', '');
    var qty = parseFloat(document.getElementById('item-qty-' + id).value) || 0;
    var price = parseFloat(document.getElementById('item-price-' + id).value) || 0;
    var sub = qty * price;
    total += sub;
    document.getElementById('item-sub-' + id).value = formatRupiah(sub);
  });
  document.getElementById('inv-total').textContent = 'Total: ' + formatRupiah(total);
}

function saveInvoice(status) {
  var number = document.getElementById('inv-number').value.trim();
  var contactId = document.getElementById('inv-contact').value;
  var date = document.getElementById('inv-date').value;
  var due = document.getElementById('inv-due').value;
  if (!number || !contactId || !date) {
    showToast('No. Invoice, pelanggan, dan tanggal wajib diisi', 'error');
    return;
  }
  // Collect items
  var container = document.getElementById('inv-items');
  var rows = container.querySelectorAll('.item-row');
  var items = [];
  var total = 0;
  rows.forEach(function (row) {
    var id = row.id.replace('item-', '');
    var desc = document.getElementById('item-desc-' + id).value.trim();
    var qty = parseFloat(document.getElementById('item-qty-' + id).value) || 0;
    var price = parseFloat(document.getElementById('item-price-' + id).value) || 0;
    if (desc && qty > 0) {
      var sub = qty * price;
      items.push({ description: desc, quantity: qty, unit_price: price, subtotal: sub });
      total += sub;
    }
  });
  if (items.length === 0) {
    showToast('Tambahkan minimal satu item barang/jasa', 'error');
    return;
  }
  // Server-side recalculation simulation
  total = 0;
  items.forEach(function (it) { it.subtotal = it.quantity * it.unit_price; total += it.subtotal; });

  var cid = Session.companyId();
  var uid = Session.get().user_id;
  var invoice = Store.add('invoices', {
    company_id: cid,
    contact_id: contactId,
    invoice_number: number,
    issue_date: date,
    due_date: due || null,
    total_amount: total,
    status: status,
    created_by: uid
  });
  items.forEach(function (it) {
    Store.add('invoice_items', {
      invoice_id: invoice.id,
      description: it.description,
      quantity: it.quantity,
      unit_price: it.unit_price,
      subtotal: it.subtotal,
      created_by: uid
    });
  });

  // If status SENT, also create journal entry for Piutang
  if (status === 'SENT') {
    createInvoiceJournal(invoice, total, cid, uid);
  }

  showToast('Tagihan berhasil disimpan!');
  Router.navigate('/invoices/' + invoice.id);
}

function createInvoiceJournal(invoice, total, cid, uid) {
  var accounts = Store.where('accounts', { company_id: cid });
  var piutangAcc = accounts.find(function (a) { return a.account_code === '1100'; });
  var revenueAcc = accounts.find(function (a) { return a.account_code === '4000'; });
  if (!piutangAcc || !revenueAcc) return;

  var je = Store.add('journal_entries', {
    company_id: cid,
    transaction_date: invoice.issue_date,
    reference_number: invoice.invoice_number,
    description: 'Tagihan kepada pelanggan - ' + invoice.invoice_number,
    created_by: uid
  });
  Store.add('journal_lines', { journal_entry_id: je.id, account_id: piutangAcc.id, debit_amount: total, credit_amount: 0, created_by: uid });
  Store.add('journal_lines', { journal_entry_id: je.id, account_id: revenueAcc.id, debit_amount: 0, credit_amount: total, created_by: uid });
}

// ==================== PAGE: INVOICE DETAIL ====================
Router.register('/invoices/:id', function (id) {
  if (id === 'new') { Router.routes['/invoices/new'](); return; }

  var inv = Store.find('invoices', id);
  if (!inv) { showToast('Tagihan tidak ditemukan', 'error'); Router.navigate('/invoices'); return; }

  var contact = Store.find('contacts', inv.contact_id);
  var items = Store.where('invoice_items', { invoice_id: inv.id });
  var statusLabels = { DRAFT: 'Draft', SENT: 'Belum Lunas', PAID: 'Lunas', CANCELLED: 'Batal' };
  var statusClass = 'status-' + (inv.status || 'draft').toLowerCase();

  var itemRows = '';
  items.forEach(function (it) {
    itemRows += '<tr><td>' + escapeHtml(it.description) + '</td><td class="text-right">' + it.quantity + '</td><td class="text-right">' + formatRupiah(it.unit_price) + '</td><td class="text-right font-mono">' + formatRupiah(it.subtotal) + '</td></tr>';
  });

  var payBtn = '';
  if (inv.status === 'SENT' || inv.status === 'DRAFT') {
    payBtn = '<button class="btn btn-success" onclick="showPaymentModal(\'' + inv.id + '\')">💵 Terima Pembayaran</button>';
  }
  var sendBtn = '';
  if (inv.status === 'DRAFT') {
    sendBtn = '<button class="btn btn-primary" onclick="sendInvoice(\'' + inv.id + '\')">📤 Kirim Tagihan</button>';
  }

  renderAppPage('Detail Tagihan',
    '<div class="card">' +
      '<div class="card-header">' +
        '<div><h3>' + escapeHtml(inv.invoice_number) + '</h3><span class="status ' + statusClass + '" style="margin-top:.25rem;display:inline-block">' + (statusLabels[inv.status] || inv.status) + '</span></div>' +
        '<div class="btn-group">' + sendBtn + payBtn + '</div>' +
      '</div>' +
      '<div class="detail-grid">' +
        '<div class="detail-item"><div class="label">Pelanggan</div><div class="value">' + escapeHtml(contact ? contact.name : '-') + '</div></div>' +
        '<div class="detail-item"><div class="label">No. Invoice</div><div class="value font-mono">' + escapeHtml(inv.invoice_number) + '</div></div>' +
        '<div class="detail-item"><div class="label">Tanggal Terbit</div><div class="value">' + formatDate(inv.issue_date) + '</div></div>' +
        '<div class="detail-item"><div class="label">Jatuh Tempo</div><div class="value">' + formatDate(inv.due_date) + '</div></div>' +
      '</div>' +
      '<hr class="divider" />' +
      '<h4 style="margin-bottom:.5rem">Detail Barang / Jasa</h4>' +
      '<div class="table-wrap"><table class="data-table"><thead><tr><th>Deskripsi</th><th class="text-right">Jumlah</th><th class="text-right">Harga Satuan</th><th class="text-right">Subtotal</th></tr></thead><tbody>' + itemRows + '</tbody></table></div>' +
      '<div style="text-align:right;font-size:1.15rem;font-weight:700;margin-top:1rem;padding-top:.75rem;border-top:2px solid var(--gray-900)">Total: ' + formatRupiah(inv.total_amount) + '</div>' +
    '</div>' +
    '<div style="margin-top:1rem"><button class="btn btn-outline" onclick="Router.navigate(\'/invoices\')">← Kembali ke Daftar Tagihan</button></div>' +
    '<div id="payment-modal"></div>'
  );
});

function sendInvoice(id) {
  var inv = Store.find('invoices', id);
  if (!inv) return;
  Store.update('invoices', id, { status: 'SENT' });
  // Create journal for piutang
  var cid = Session.companyId();
  var uid = Session.get().user_id;
  createInvoiceJournal(inv, inv.total_amount, cid, uid);
  showToast('Tagihan berhasil dikirim! Jurnal piutang dibuat otomatis.');
  Router.navigate('/invoices/' + id);
}

function showPaymentModal(invoiceId) {
  var inv = Store.find('invoices', invoiceId);
  var cid = Session.companyId();
  var cashAccounts = Store.where('accounts', { company_id: cid }).filter(function (a) {
    return a.account_type === 'ASSET' && a.account_code !== '1100';
  });

  var accOpts = '<option value="">— Pilih Akun Tujuan —</option>';
  cashAccounts.forEach(function (a) {
    accOpts += '<option value="' + a.id + '">' + escapeHtml(a.account_code + ' - ' + a.account_name) + '</option>';
  });

  document.getElementById('payment-modal').innerHTML =
    '<div class="modal-overlay" onclick="closePaymentModal(event)">' +
      '<div class="modal" onclick="event.stopPropagation()">' +
        '<div class="modal-header"><h3>💵 Terima Pembayaran</h3><button class="modal-close" onclick="closePaymentModal()">&times;</button></div>' +
        '<div class="modal-body">' +
          '<div class="alert alert-info">📄 Tagihan <strong>' + escapeHtml(inv.invoice_number) + '</strong> — Total: <strong>' + formatRupiah(inv.total_amount) + '</strong></div>' +
          '<div class="form-group"><label>Nominal Pembayaran</label><input type="number" id="pay-amount" value="' + inv.total_amount + '" min="0" step="any" /></div>' +
          '<div class="form-group"><label>Akun Penerima (Kas/Bank)</label><select id="pay-account">' + accOpts + '</select></div>' +
          '<div class="form-group"><label>Tanggal Pembayaran</label><input type="date" id="pay-date" value="' + today() + '" /></div>' +
        '</div>' +
        '<div class="modal-footer"><button class="btn btn-outline" onclick="closePaymentModal()">Batal</button><button class="btn btn-success" onclick="processPayment(\'' + invoiceId + '\')">Proses Pembayaran</button></div>' +
      '</div>' +
    '</div>';
}
function closePaymentModal(e) { if (!e || e.target.classList.contains('modal-overlay')) document.getElementById('payment-modal').innerHTML = ''; }

function processPayment(invoiceId) {
  var amount = parseFloat(document.getElementById('pay-amount').value) || 0;
  var accountId = document.getElementById('pay-account').value;
  var payDate = document.getElementById('pay-date').value;
  if (!accountId) { showToast('Pilih akun penerima pembayaran', 'error'); return; }
  if (amount <= 0) { showToast('Nominal pembayaran harus lebih dari 0', 'error'); return; }

  var inv = Store.find('invoices', invoiceId);
  var cid = Session.companyId();
  var uid = Session.get().user_id;

  // @Transactional simulation — 3 operations:
  // 1. Update invoice status to PAID
  Store.update('invoices', invoiceId, { status: 'PAID' });

  // 2. Create journal entry
  var je = Store.add('journal_entries', {
    company_id: cid,
    transaction_date: payDate,
    reference_number: inv.invoice_number,
    description: 'Pembayaran tagihan ' + inv.invoice_number,
    created_by: uid
  });

  // 3. Create journal lines (Double Entry)
  var accounts = Store.where('accounts', { company_id: cid });
  var piutangAcc = accounts.find(function (a) { return a.account_code === '1100'; });

  // DEBIT: Kas/Bank (uang masuk)
  Store.add('journal_lines', {
    journal_entry_id: je.id,
    account_id: accountId,
    debit_amount: amount,
    credit_amount: 0,
    created_by: uid
  });
  // CREDIT: Piutang Usaha (piutang berkurang)
  if (piutangAcc) {
    Store.add('journal_lines', {
      journal_entry_id: je.id,
      account_id: piutangAcc.id,
      debit_amount: 0,
      credit_amount: amount,
      created_by: uid
    });
  }

  showToast('Pembayaran berhasil! Jurnal ganda dibuat otomatis (Debit Kas, Kredit Piutang).');
  Router.navigate('/invoices/' + invoiceId);
}

// ==================== PAGE: JOURNAL ====================
Router.register('/journal', function () {
  var cid = Session.companyId();
  var entries = Store.where('journal_entries', { company_id: cid }).sort(function (a, b) { return new Date(b.transaction_date) - new Date(a.transaction_date); });
  var accounts = Store.where('accounts', { company_id: cid });
  var accountMap = {};
  accounts.forEach(function (a) { accountMap[a.id] = a; });

  var rows = '';
  if (entries.length === 0) {
    rows = '<tr><td colspan="6" class="text-center text-muted" style="padding:2rem">Belum ada jurnal. Jurnal dibuat otomatis saat tagihan dikirim atau pembayaran diterima.</td></tr>';
  } else {
    entries.forEach(function (je) {
      var lines = Store.where('journal_lines', { journal_entry_id: je.id });
      var isFirst = true;
      lines.forEach(function (jl) {
        var acc = accountMap[jl.account_id];
        rows += '<tr>' +
          (isFirst ? '<td rowspan="' + lines.length + '">' + formatDate(je.transaction_date) + '</td><td rowspan="' + lines.length + '" class="font-mono">' + escapeHtml(je.reference_number) + '</td><td rowspan="' + lines.length + '">' + escapeHtml(je.description) + '</td>' : '') +
          '<td>' + (acc ? escapeHtml(acc.account_code + ' ' + acc.account_name) : '-') + '</td>' +
          '<td class="text-right font-mono">' + (jl.debit_amount > 0 ? formatRupiah(jl.debit_amount) : '') + '</td>' +
          '<td class="text-right font-mono">' + (jl.credit_amount > 0 ? formatRupiah(jl.credit_amount) : '') + '</td>' +
          '</tr>';
        isFirst = false;
      });
    });
  }

  renderAppPage('Jurnal Umum',
    '<div class="card">' +
      '<div class="card-header"><h3>📒 Jurnal Umum (General Journal)</h3><button class="btn btn-primary btn-sm" onclick="showManualJournalModal()">+ Jurnal Manual</button></div>' +
      '<div class="alert alert-info">ℹ️ Jurnal dibuat otomatis saat tagihan dikirim (Debit Piutang, Kredit Pendapatan) dan saat pembayaran diterima (Debit Kas, Kredit Piutang).</div>' +
      '<div class="table-wrap"><table class="data-table"><thead><tr><th>Tanggal</th><th>Referensi</th><th>Keterangan</th><th>Akun</th><th class="text-right">Debit</th><th class="text-right">Kredit</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
    '</div>' +
    '<div id="journal-modal"></div>'
  );
});

function showManualJournalModal() {
  var cid = Session.companyId();
  var accounts = Store.where('accounts', { company_id: cid }).sort(function (a, b) { return a.account_code.localeCompare(b.account_code); });
  var accOpts = '<option value="">— Pilih Akun —</option>';
  accounts.forEach(function (a) {
    accOpts += '<option value="' + a.id + '">' + escapeHtml(a.account_code + ' - ' + a.account_name) + '</option>';
  });
  window._journalAccOpts = accOpts;

  document.getElementById('journal-modal').innerHTML =
    '<div class="modal-overlay" onclick="closeJournalModal(event)">' +
      '<div class="modal" style="max-width:650px" onclick="event.stopPropagation()">' +
        '<div class="modal-header"><h3>📒 Buat Jurnal Manual</h3><button class="modal-close" onclick="closeJournalModal()">&times;</button></div>' +
        '<div class="modal-body">' +
          '<div class="form-row">' +
            '<div class="form-group"><label>Tanggal</label><input type="date" id="mj-date" value="' + today() + '" /></div>' +
            '<div class="form-group"><label>No. Referensi</label><input type="text" id="mj-ref" placeholder="contoh: JU-001" /></div>' +
          '</div>' +
          '<div class="form-group"><label>Keterangan</label><input type="text" id="mj-desc" placeholder="Keterangan transaksi" /></div>' +
          '<hr class="divider" />' +
          '<h4 style="margin-bottom:.5rem">Baris Jurnal</h4>' +
          '<div id="mj-lines"></div>' +
          '<button class="btn btn-outline btn-sm" onclick="addJournalLine()" style="margin-top:.25rem">+ Tambah Baris</button>' +
          '<div style="display:flex;justify-content:space-between;margin-top:.75rem;font-weight:600;font-size:.9rem">' +
            '<span>Total Debit: <span id="mj-total-d">Rp 0</span></span>' +
            '<span>Total Kredit: <span id="mj-total-c">Rp 0</span></span>' +
          '</div>' +
        '</div>' +
        '<div class="modal-footer"><button class="btn btn-outline" onclick="closeJournalModal()">Batal</button><button class="btn btn-primary" onclick="saveManualJournal()">Simpan Jurnal</button></div>' +
      '</div>' +
    '</div>';
  addJournalLine();
  addJournalLine();
}
var mjLineCount = 0;
function addJournalLine() {
  mjLineCount++;
  var idx = mjLineCount;
  var container = document.getElementById('mj-lines');
  var row = document.createElement('div');
  row.className = 'item-row';
  row.id = 'mj-line-' + idx;
  row.style.gridTemplateColumns = '2fr 1fr 1fr auto';
  row.innerHTML =
    '<div class="form-group"><label style="font-size:.72rem">Akun</label><select id="mj-acc-' + idx + '">' + window._journalAccOpts + '</select></div>' +
    '<div class="form-group"><label style="font-size:.72rem">Debit</label><input type="number" id="mj-d-' + idx + '" value="0" min="0" step="any" oninput="calcJournalTotals()" /></div>' +
    '<div class="form-group"><label style="font-size:.72rem">Kredit</label><input type="number" id="mj-c-' + idx + '" value="0" min="0" step="any" oninput="calcJournalTotals()" /></div>' +
    '<button class="remove-item" onclick="removeJournalLine(' + idx + ')" title="Hapus">✕</button>';
  container.appendChild(row);
}
function removeJournalLine(idx) { var r = document.getElementById('mj-line-' + idx); if (r) r.remove(); calcJournalTotals(); }
function calcJournalTotals() {
  var container = document.getElementById('mj-lines');
  if (!container) return;
  var rows = container.querySelectorAll('.item-row');
  var totalD = 0, totalC = 0;
  rows.forEach(function (row) {
    var id = row.id.replace('mj-line-', '');
    totalD += parseFloat(document.getElementById('mj-d-' + id).value) || 0;
    totalC += parseFloat(document.getElementById('mj-c-' + id).value) || 0;
  });
  document.getElementById('mj-total-d').textContent = formatRupiah(totalD);
  document.getElementById('mj-total-c').textContent = formatRupiah(totalC);
}
function closeJournalModal(e) { if (!e || e.target.classList.contains('modal-overlay')) document.getElementById('journal-modal').innerHTML = ''; }
function saveManualJournal() {
  var date = document.getElementById('mj-date').value;
  var ref = document.getElementById('mj-ref').value.trim();
  var desc = document.getElementById('mj-desc').value.trim();
  if (!date || !desc) { showToast('Tanggal dan keterangan wajib diisi', 'error'); return; }
  var container = document.getElementById('mj-lines');
  var rows = container.querySelectorAll('.item-row');
  var lines = [];
  var totalD = 0, totalC = 0;
  rows.forEach(function (row) {
    var id = row.id.replace('mj-line-', '');
    var accId = document.getElementById('mj-acc-' + id).value;
    var d = parseFloat(document.getElementById('mj-d-' + id).value) || 0;
    var c = parseFloat(document.getElementById('mj-c-' + id).value) || 0;
    if (accId && (d > 0 || c > 0)) {
      lines.push({ account_id: accId, debit_amount: d, credit_amount: c });
      totalD += d; totalC += c;
    }
  });
  if (lines.length < 2) { showToast('Minimal 2 baris jurnal', 'error'); return; }
  if (Math.abs(totalD - totalC) > 0.01) { showToast('Total Debit dan Kredit harus seimbang! (Debit: ' + formatRupiah(totalD) + ', Kredit: ' + formatRupiah(totalC) + ')', 'error'); return; }

  var cid = Session.companyId();
  var uid = Session.get().user_id;
  var je = Store.add('journal_entries', { company_id: cid, transaction_date: date, reference_number: ref || '-', description: desc, created_by: uid });
  lines.forEach(function (l) {
    Store.add('journal_lines', { journal_entry_id: je.id, account_id: l.account_id, debit_amount: l.debit_amount, credit_amount: l.credit_amount, created_by: uid });
  });
  showToast('Jurnal berhasil disimpan!');
  Router.navigate('/journal');
}

// ==================== PAGE: REPORTS ====================
Router.register('/reports', function () {
  var cid = Session.companyId();
  renderAppPage('Laporan Keuangan',
    '<div class="tabs" id="report-tabs">' +
      '<button class="tab-btn active" onclick="showReport(\'trial-balance\',this)">Neraca Saldo</button>' +
      '<button class="tab-btn" onclick="showReport(\'profit-loss\',this)">Laba Rugi</button>' +
      '<button class="tab-btn" onclick="showReport(\'balance-sheet\',this)">Neraca</button>' +
      '<button class="tab-btn" onclick="showReport(\'cash-flow\',this)">Arus Kas</button>' +
    '</div>' +
    '<div class="report-header">' +
      '<div class="date-range">' +
        '<label>Dari:</label><input type="date" id="rpt-start" value="' + monthStart() + '" onchange="refreshReport()" />' +
        '<label>Sampai:</label><input type="date" id="rpt-end" value="' + monthEnd() + '" onchange="refreshReport()" />' +
      '</div>' +
    '</div>' +
    '<div class="card" id="report-content"></div>'
  );
  showReport('trial-balance');
});

var currentReport = 'trial-balance';
function showReport(type, btn) {
  currentReport = type;
  if (btn) {
    document.querySelectorAll('#report-tabs .tab-btn').forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
  }
  refreshReport();
}
function refreshReport() {
  var fn = {
    'trial-balance': renderTrialBalance,
    'profit-loss': renderProfitLoss,
    'balance-sheet': renderBalanceSheet,
    'cash-flow': renderCashFlow
  }[currentReport];
  if (fn) fn();
}

function getFilteredJournalLines() {
  var cid = Session.companyId();
  var startEl = document.getElementById('rpt-start');
  var endEl = document.getElementById('rpt-end');
  var start = startEl ? startEl.value : '2000-01-01';
  var end = endEl ? endEl.value : '2099-12-31';
  var entries = Store.where('journal_entries', { company_id: cid });
  var filteredEntryIds = entries.filter(function (je) {
    return je.transaction_date >= start && je.transaction_date <= end;
  }).map(function (je) { return je.id; });
  return Store.get('journal_lines').filter(function (jl) { return filteredEntryIds.indexOf(jl.journal_entry_id) !== -1; });
}

function renderTrialBalance() {
  var cid = Session.companyId();
  var accounts = Store.where('accounts', { company_id: cid }).sort(function (a, b) { return a.account_code.localeCompare(b.account_code); });
  var lines = getFilteredJournalLines();

  var balances = {};
  lines.forEach(function (jl) {
    if (!balances[jl.account_id]) balances[jl.account_id] = { debit: 0, credit: 0 };
    balances[jl.account_id].debit += Number(jl.debit_amount || 0);
    balances[jl.account_id].credit += Number(jl.credit_amount || 0);
  });

  var totalD = 0, totalC = 0;
  var rows = '';
  accounts.forEach(function (a) {
    var b = balances[a.id];
    if (!b) return;
    totalD += b.debit;
    totalC += b.credit;
    rows += '<tr><td class="font-mono">' + escapeHtml(a.account_code) + '</td><td>' + escapeHtml(a.account_name) + '</td><td class="text-right font-mono">' + formatRupiah(b.debit) + '</td><td class="text-right font-mono">' + formatRupiah(b.credit) + '</td></tr>';
  });
  if (!rows) rows = '<tr><td colspan="4" class="text-center text-muted" style="padding:2rem">Tidak ada data dalam periode ini</td></tr>';

  document.getElementById('report-content').innerHTML =
    '<h3 style="margin-bottom:1rem">📋 Neraca Saldo (Trial Balance)</h3>' +
    '<div class="table-wrap"><table class="report-table"><thead><tr><th>Kode</th><th>Nama Akun</th><th class="text-right">Debit</th><th class="text-right">Kredit</th></tr></thead><tbody>' +
    rows +
    '<tr class="total-row"><td colspan="2">TOTAL</td><td class="text-right font-mono">' + formatRupiah(totalD) + '</td><td class="text-right font-mono">' + formatRupiah(totalC) + '</td></tr>' +
    '</tbody></table></div>' +
    (Math.abs(totalD - totalC) < 0.01 ? '<div class="alert alert-success mt-1">✅ Seimbang! Total Debit = Total Kredit</div>' : '<div class="alert alert-danger mt-1">⚠️ Tidak seimbang! Selisih: ' + formatRupiah(Math.abs(totalD - totalC)) + '</div>');
}

function renderProfitLoss() {
  var cid = Session.companyId();
  var accounts = Store.where('accounts', { company_id: cid });
  var lines = getFilteredJournalLines();

  var balances = {};
  lines.forEach(function (jl) {
    if (!balances[jl.account_id]) balances[jl.account_id] = 0;
    balances[jl.account_id] += Number(jl.credit_amount || 0) - Number(jl.debit_amount || 0);
  });

  var revenueAccs = accounts.filter(function (a) { return a.account_type === 'REVENUE'; });
  var expenseAccs = accounts.filter(function (a) { return a.account_type === 'EXPENSE'; });

  var totalRevenue = 0, totalExpense = 0;
  var revenueRows = '', expenseRows = '';
  revenueAccs.forEach(function (a) {
    var val = balances[a.id] || 0;
    if (val === 0) return;
    totalRevenue += val;
    revenueRows += '<tr><td class="indent">' + escapeHtml(a.account_name) + '</td><td class="text-right font-mono">' + formatRupiah(val) + '</td></tr>';
  });
  expenseAccs.forEach(function (a) {
    var val = -(balances[a.id] || 0);
    if (val === 0) return;
    totalExpense += val;
    expenseRows += '<tr><td class="indent">' + escapeHtml(a.account_name) + '</td><td class="text-right font-mono">' + formatRupiah(val) + '</td></tr>';
  });

  var netIncome = totalRevenue - totalExpense;

  document.getElementById('report-content').innerHTML =
    '<h3 style="margin-bottom:1rem">📈 Laporan Laba Rugi (Profit & Loss)</h3>' +
    '<div class="table-wrap"><table class="report-table"><tbody>' +
    '<tr class="section-header"><td colspan="2">PENDAPATAN</td></tr>' +
    (revenueRows || '<tr><td class="indent text-muted" colspan="2">Tidak ada data</td></tr>') +
    '<tr class="total-row"><td>Total Pendapatan</td><td class="text-right font-mono">' + formatRupiah(totalRevenue) + '</td></tr>' +
    '<tr class="section-header"><td colspan="2">BEBAN</td></tr>' +
    (expenseRows || '<tr><td class="indent text-muted" colspan="2">Tidak ada data</td></tr>') +
    '<tr class="total-row"><td>Total Beban</td><td class="text-right font-mono">' + formatRupiah(totalExpense) + '</td></tr>' +
    '<tr class="total-row" style="font-size:1.05rem"><td>' + (netIncome >= 0 ? '✅ LABA BERSIH' : '❌ RUGI BERSIH') + '</td><td class="text-right font-mono ' + (netIncome >= 0 ? 'text-success' : 'text-danger') + '">' + formatRupiah(Math.abs(netIncome)) + '</td></tr>' +
    '</tbody></table></div>';
}

function renderBalanceSheet() {
  var cid = Session.companyId();
  var accounts = Store.where('accounts', { company_id: cid });
  var lines = getFilteredJournalLines();

  var balances = {};
  lines.forEach(function (jl) {
    if (!balances[jl.account_id]) balances[jl.account_id] = 0;
    balances[jl.account_id] += Number(jl.debit_amount || 0) - Number(jl.credit_amount || 0);
  });

  var assetAccs = accounts.filter(function (a) { return a.account_type === 'ASSET'; });
  var liabilityAccs = accounts.filter(function (a) { return a.account_type === 'LIABILITY'; });
  var equityAccs = accounts.filter(function (a) { return a.account_type === 'EQUITY'; });

  var totalAsset = 0, totalLiability = 0, totalEquity = 0;

  function renderGroup(accs) {
    var html = '';
    accs.forEach(function (a) {
      var val = balances[a.id] || 0;
      if (a.account_type !== 'ASSET') val = -val;
      if (val === 0) return;
      if (a.account_type === 'ASSET') totalAsset += val;
      else if (a.account_type === 'LIABILITY') totalLiability += val;
      else totalEquity += val;
      html += '<tr><td class="indent">' + escapeHtml(a.account_name) + '</td><td class="text-right font-mono">' + formatRupiah(val) + '</td></tr>';
    });
    return html || '<tr><td class="indent text-muted" colspan="2">Tidak ada data</td></tr>';
  }

  // Calculate net income for retained earnings
  var revenueAccs = accounts.filter(function (a) { return a.account_type === 'REVENUE'; });
  var expenseAccs = accounts.filter(function (a) { return a.account_type === 'EXPENSE'; });
  var netIncome = 0;
  revenueAccs.forEach(function (a) { netIncome += -(balances[a.id] || 0); });
  expenseAccs.forEach(function (a) { netIncome -= (balances[a.id] || 0); });

  document.getElementById('report-content').innerHTML =
    '<h3 style="margin-bottom:1rem">📊 Neraca (Balance Sheet)</h3>' +
    '<div class="table-wrap"><table class="report-table"><tbody>' +
    '<tr class="section-header"><td colspan="2">ASET</td></tr>' + renderGroup(assetAccs) +
    '<tr class="total-row"><td>Total Aset</td><td class="text-right font-mono">' + formatRupiah(totalAsset) + '</td></tr>' +
    '<tr class="section-header"><td colspan="2">LIABILITAS</td></tr>' + renderGroup(liabilityAccs) +
    '<tr class="total-row"><td>Total Liabilitas</td><td class="text-right font-mono">' + formatRupiah(totalLiability) + '</td></tr>' +
    '<tr class="section-header"><td colspan="2">EKUITAS</td></tr>' + renderGroup(equityAccs) +
    (netIncome !== 0 ? '<tr><td class="indent">Laba Ditahan (Periode Ini)</td><td class="text-right font-mono">' + formatRupiah(netIncome) + '</td></tr>' : '') +
    '<tr class="total-row"><td>Total Ekuitas</td><td class="text-right font-mono">' + formatRupiah(totalEquity + netIncome) + '</td></tr>' +
    '<tr class="total-row" style="font-size:1.05rem"><td>TOTAL LIABILITAS + EKUITAS</td><td class="text-right font-mono">' + formatRupiah(totalLiability + totalEquity + netIncome) + '</td></tr>' +
    '</tbody></table></div>';
}

function renderCashFlow() {
  var cid = Session.companyId();
  var accounts = Store.where('accounts', { company_id: cid });
  var cashAccounts = accounts.filter(function (a) { return a.account_type === 'ASSET' && (a.account_code.indexOf('100') === 0); });

  var entries = Store.where('journal_entries', { company_id: cid });
  var startEl = document.getElementById('rpt-start');
  var endEl = document.getElementById('rpt-end');
  var start = startEl ? startEl.value : '2000-01-01';
  var end = endEl ? endEl.value : '2099-12-31';

  var cashIds = cashAccounts.map(function (a) { return a.id; });

  var movements = [];
  entries.filter(function (je) {
    return je.transaction_date >= start && je.transaction_date <= end;
  }).sort(function (a, b) { return new Date(a.transaction_date) - new Date(b.transaction_date); }).forEach(function (je) {
    var lines = Store.where('journal_lines', { journal_entry_id: je.id });
    lines.forEach(function (jl) {
      if (cashIds.indexOf(jl.account_id) !== -1) {
        var acc = Store.find('accounts', jl.account_id);
        movements.push({
          date: je.transaction_date,
          ref: je.reference_number,
          desc: je.description,
          account: acc ? acc.account_name : '-',
          inflow: jl.debit_amount || 0,
          outflow: jl.credit_amount || 0
        });
      }
    });
  });

  var totalIn = 0, totalOut = 0;
  var rows = '';
  if (movements.length === 0) {
    rows = '<tr><td colspan="5" class="text-center text-muted" style="padding:2rem">Tidak ada pergerakan kas dalam periode ini</td></tr>';
  } else {
    movements.forEach(function (m) {
      totalIn += m.inflow;
      totalOut += m.outflow;
      rows += '<tr><td>' + formatDate(m.date) + '</td><td>' + escapeHtml(m.desc) + '</td><td>' + escapeHtml(m.account) + '</td><td class="text-right font-mono text-success">' + (m.inflow > 0 ? formatRupiah(m.inflow) : '') + '</td><td class="text-right font-mono text-danger">' + (m.outflow > 0 ? formatRupiah(m.outflow) : '') + '</td></tr>';
    });
  }

  document.getElementById('report-content').innerHTML =
    '<h3 style="margin-bottom:1rem">💵 Arus Kas (Cash Flow)</h3>' +
    '<div class="table-wrap"><table class="report-table"><thead><tr><th>Tanggal</th><th>Keterangan</th><th>Akun</th><th class="text-right">Masuk (Debit)</th><th class="text-right">Keluar (Kredit)</th></tr></thead><tbody>' +
    rows +
    '<tr class="total-row"><td colspan="3">TOTAL</td><td class="text-right font-mono text-success">' + formatRupiah(totalIn) + '</td><td class="text-right font-mono text-danger">' + formatRupiah(totalOut) + '</td></tr>' +
    '<tr class="total-row" style="font-size:1.05rem"><td colspan="3">ARUS KAS BERSIH</td><td colspan="2" class="text-right font-mono">' + formatRupiah(totalIn - totalOut) + '</td></tr>' +
    '</tbody></table></div>';
}

// ==================== PAGE: COMPANIES ====================
Router.register('/companies', function () {
  var userId = Session.get().user_id;
  var roles = Store.where('company_roles', { user_id: userId });
  var companies = roles.map(function (r) {
    var c = Store.find('companies', r.company_id);
    return c ? Object.assign({}, c, { role: r.role_name }) : null;
  }).filter(Boolean);

  var currentCid = Session.companyId();
  var rows = '';
  companies.forEach(function (c) {
    var isCurrent = c.id === currentCid;
    rows += '<tr>' +
      '<td><strong>' + escapeHtml(c.name) + '</strong>' + (isCurrent ? ' <span class="status status-paid">Aktif</span>' : '') + '</td>' +
      '<td>' + escapeHtml(c.address || '-') + '</td>' +
      '<td>' + escapeHtml(c.tax_number || '-') + '</td>' +
      '<td><span class="role-badge role-' + c.role.toLowerCase() + '">' + c.role + '</span></td>' +
      '<td>' + (!isCurrent ? '<button class="btn btn-primary btn-sm" onclick="switchCompany(\'' + c.id + '\',\'' + c.role + '\')">Aktifkan</button>' : '') + '</td>' +
      '</tr>';
  });

  renderAppPage('Perusahaan',
    '<div class="card">' +
      '<div class="card-header"><h3>🏢 Daftar Perusahaan</h3><button class="btn btn-primary btn-sm" onclick="showNewCompanyModal()">+ Tambah Perusahaan</button></div>' +
      '<div class="table-wrap"><table class="data-table"><thead><tr><th>Nama</th><th>Alamat</th><th>NPWP</th><th>Peran</th><th>Aksi</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
    '</div>' +
    '<div id="company-modal"></div>'
  );
});

function switchCompany(cid, role) {
  Session.set({ user_id: Session.get().user_id, company_id: cid, role: role });
  showToast('Perusahaan aktif berhasil diganti');
  Router.navigate('/dashboard');
}

function showNewCompanyModal() {
  document.getElementById('company-modal').innerHTML =
    '<div class="modal-overlay" onclick="closeCompanyModal(event)">' +
      '<div class="modal" onclick="event.stopPropagation()">' +
        '<div class="modal-header"><h3>🏢 Tambah Perusahaan Baru</h3><button class="modal-close" onclick="closeCompanyModal()">&times;</button></div>' +
        '<div class="modal-body">' +
          '<div class="form-group"><label>Nama Bisnis</label><input type="text" id="nc-name" placeholder="Nama perusahaan" /></div>' +
          '<div class="form-group"><label>Alamat</label><textarea id="nc-addr" placeholder="Alamat lengkap"></textarea></div>' +
          '<div class="form-group"><label>NPWP (opsional)</label><input type="text" id="nc-tax" placeholder="Nomor NPWP" /></div>' +
        '</div>' +
        '<div class="modal-footer"><button class="btn btn-outline" onclick="closeCompanyModal()">Batal</button><button class="btn btn-primary" onclick="saveNewCompany()">Simpan</button></div>' +
      '</div>' +
    '</div>';
}
function closeCompanyModal(e) { if (!e || e.target.classList.contains('modal-overlay')) document.getElementById('company-modal').innerHTML = ''; }
function saveNewCompany() {
  var name = document.getElementById('nc-name').value.trim();
  var addr = document.getElementById('nc-addr').value.trim();
  var tax = document.getElementById('nc-tax').value.trim();
  if (!name) { showToast('Nama bisnis wajib diisi', 'error'); return; }
  var uid = Session.get().user_id;
  var company = Store.add('companies', { owner_id: uid, name: name, address: addr, tax_number: tax || null, created_by: uid });
  Store.add('company_roles', { company_id: company.id, user_id: uid, role_name: 'OWNER' });
  seedDefaultAccounts(company.id, uid);
  showToast('Perusahaan berhasil ditambahkan');
  Router.navigate('/companies');
}

// ==================== PAGE: EMPLOYEES ====================
Router.register('/employees', function () {
  var cid = Session.companyId();
  var roles = Store.where('company_roles', { company_id: cid });

  var rows = '';
  roles.forEach(function (r) {
    var user = Store.find('users', r.user_id);
    if (!user) return;
    rows += '<tr>' +
      '<td><strong>' + escapeHtml(user.full_name) + '</strong></td>' +
      '<td>' + escapeHtml(user.email) + '</td>' +
      '<td><span class="role-badge role-' + r.role_name.toLowerCase() + '">' + r.role_name + '</span></td>' +
      '<td>' + formatDate(r.created_at) + '</td>' +
      '<td class="actions">' + (r.role_name !== 'OWNER' ? '<button class="btn btn-danger btn-sm" onclick="removeEmployee(\'' + r.id + '\')">🗑️ Hapus</button>' : '<span class="text-muted" style="font-size:.8rem">Pemilik</span>') + '</td>' +
      '</tr>';
  });

  renderAppPage('Manajemen Tim',
    '<div class="card">' +
      '<div class="card-header"><h3>👥 Daftar Karyawan</h3><button class="btn btn-primary btn-sm" onclick="showEmployeeModal()">+ Tambah Karyawan</button></div>' +
      '<div class="alert alert-info">ℹ️ Karyawan akan login dengan email & kata sandi yang Anda berikan. Hak akses ditentukan oleh peran (ADMIN / KASIR).</div>' +
      '<div class="table-wrap"><table class="data-table"><thead><tr><th>Nama</th><th>Email</th><th>Peran</th><th>Bergabung</th><th>Aksi</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
    '</div>' +
    '<div id="employee-modal"></div>'
  );
});

function showEmployeeModal() {
  document.getElementById('employee-modal').innerHTML =
    '<div class="modal-overlay" onclick="closeEmployeeModal(event)">' +
      '<div class="modal" onclick="event.stopPropagation()">' +
        '<div class="modal-header"><h3>👤 Tambah Karyawan Baru</h3><button class="modal-close" onclick="closeEmployeeModal()">&times;</button></div>' +
        '<div class="modal-body">' +
          '<div class="form-group"><label>Nama Lengkap</label><input type="text" id="emp-name" placeholder="Nama karyawan" /></div>' +
          '<div class="form-group"><label>Email</label><input type="email" id="emp-email" placeholder="email@contoh.com" /></div>' +
          '<div class="form-group"><label>Kata Sandi Sementara</label><input type="text" id="emp-pass" placeholder="Minimal 6 karakter" /></div>' +
          '<div class="form-group"><label>Peran</label><select id="emp-role"><option value="ADMIN">ADMIN — Akses penuh kecuali kelola tim</option><option value="KASIR">KASIR — Hanya transaksi & invoice</option></select></div>' +
        '</div>' +
        '<div class="modal-footer"><button class="btn btn-outline" onclick="closeEmployeeModal()">Batal</button><button class="btn btn-primary" onclick="saveEmployee()">Simpan</button></div>' +
      '</div>' +
    '</div>';
}
function closeEmployeeModal(e) { if (!e || e.target.classList.contains('modal-overlay')) document.getElementById('employee-modal').innerHTML = ''; }
function saveEmployee() {
  var name = document.getElementById('emp-name').value.trim();
  var email = document.getElementById('emp-email').value.trim();
  var pass = document.getElementById('emp-pass').value;
  var role = document.getElementById('emp-role').value;
  if (!name || !email || !pass) { showToast('Semua field wajib diisi', 'error'); return; }
  if (pass.length < 6) { showToast('Kata sandi minimal 6 karakter', 'error'); return; }
  var existing = Store.get('users').filter(function (u) { return u.email === email; });
  var user;
  if (existing.length > 0) {
    user = existing[0];
    // Check if already in this company
    var alreadyHere = Store.where('company_roles', { company_id: Session.companyId(), user_id: user.id });
    if (alreadyHere.length > 0) { showToast('Karyawan sudah ada di perusahaan ini', 'error'); return; }
  } else {
    user = Store.add('users', { full_name: name, email: email, password_hash: pass });
  }
  Store.add('company_roles', { company_id: Session.companyId(), user_id: user.id, role_name: role });
  showToast('Karyawan berhasil ditambahkan! Mereka bisa login dengan email: ' + email);
  Router.navigate('/employees');
}
function removeEmployee(roleId) {
  if (confirm('Yakin ingin menghapus karyawan ini dari perusahaan?')) {
    Store.remove('company_roles', roleId);
    showToast('Karyawan dihapus dari perusahaan');
    Router.navigate('/employees');
  }
}

// ==================== INITIALIZE ====================
Store.load();
Router.start();
