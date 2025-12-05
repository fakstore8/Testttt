// script.js

// ==========================================================
// 1. CORE UTILITIES AND DATA (Menggantikan Hooks & Types)
// ==========================================================
const USERS_KEY = 'qris_users';
const CURRENT_USER_KEY = 'qris_current_user';
const TOPUP_KEY = 'qris_topup_transactions';
const WITHDRAWAL_KEY = 'qris_withdrawal_transactions';
const ADMIN_FEE_PERCENTAGE = 2.5;

const EWALLETS = [
    { id: 'dana', name: 'Dana', color: 'bg-blue-500' },
    { id: 'ovo', name: 'OVO', color: 'bg-purple-500' },
    { id: 'gopay', name: 'GoPay', color: 'bg-green-500' },
    { id: 'shopeepay', name: 'ShopeePay', color: 'bg-orange-500' },
    { id: 'linkaja', name: 'LinkAja', color: 'bg-red-500' },
];
const PRESET_AMOUNTS = [10000, 25000, 50000, 100000, 250000, 500000];


// --- Currency & Date Format ---
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(amount);
};

const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
        day: 'numeric', month: 'long', year: 'numeric',
    });
};

// --- Local Storage Accessors ---
const getUsers = () => JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
const saveUsers = (users) => localStorage.setItem(USERS_KEY, JSON.stringify(users));
const getCurrentUser = () => JSON.parse(localStorage.getItem(CURRENT_USER_KEY) || 'null');
const saveCurrentUser = (user) => localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));

const getWithdrawals = () => JSON.parse(localStorage.getItem(WITHDRAWAL_KEY) || '[]');
const saveWithdrawals = (transactions) => localStorage.setItem(WITHDRAWAL_KEY, JSON.stringify(transactions));

const getTopUps = () => JSON.parse(localStorage.getItem(TOPUP_KEY) || '[]');
const saveTopUps = (transactions) => localStorage.setItem(TOPUP_KEY, JSON.stringify(transactions));


// --- Toast (Menggantikan useToast) ---
const toast = ({ title, description, variant = 'success' }) => {
    const container = document.getElementById('toast-container');
    const toastEl = document.createElement('div');
    toastEl.className = `toast ${variant === 'destructive' ? 'toast-destructive' : 'toast-success'}`;
    toastEl.innerHTML = `
        <p class="font-semibold">${title}</p>
        <p class="text-sm">${description}</p>
    `;
    container.appendChild(toastEl);
    
    // Show
    setTimeout(() => toastEl.classList.add('show'), 10);
    
    // Hide and remove
    setTimeout(() => {
        toastEl.classList.remove('show');
        toastEl.addEventListener('transitionend', () => toastEl.remove());
    }, 3000);
};

// ==========================================================
// 2. AUTH LOGIC (Menggantikan useAuth.tsx)
// ==========================================================
const Auth = {
    // Memuat user saat inisialisasi modul
    user: getCurrentUser(),

    // [UTAMA] Menggantikan loginWithGoogle & Auto Register
    loginWithGoogle: async (name, email) => {
        let users = getUsers();
        let foundUser = users.find(u => u.email === email);
        
        if (!foundUser) {
            // Auto Register logic
            foundUser = {
                id: crypto.randomUUID(),
                name,
                email,
                password: '', 
                balance: 0,
                createdAt: new Date().toISOString(),
            };
            users.push(foundUser);
            saveUsers(users);
        }
        
        Auth.user = foundUser;
        saveCurrentUser(Auth.user);
        return Auth.user;
    },

    // Digunakan di Login.tsx untuk simulasi login Google
    login: async (email, password) => {
        // Simulasi login sukses jika menggunakan creds Google simulasi
        const isSuccess = email === 'user@gmail.com' && password === 'google-oauth';
        if (isSuccess) {
            // Panggil loginWithGoogle untuk mengelola state dan auto-register/login
            return Auth.loginWithGoogle('Google User', 'user@gmail.com');
        }
        return false;
    },

    logout: () => {
        Auth.user = null;
        localStorage.removeItem(CURRENT_USER_KEY);
        router(); // Reroute setelah logout
    },

    updateBalance: (newBalance) => {
        if (Auth.user) {
            const updatedUser = { ...Auth.user, balance: newBalance };
            Auth.user = updatedUser;
            saveCurrentUser(updatedUser);
            
            // Update juga di list users
            const users = getUsers();
            const updatedUsers = users.map(u => 
                u.id === Auth.user.id ? updatedUser : u
            );
            saveUsers(updatedUsers);
            return updatedUser;
        }
    }
};

// ==========================================================
// 3. TRANSACTION LOGIC (Menggantikan useTransactions.tsx)
// ==========================================================
const Transactions = {
    createWithdrawal: (data, adminFeePercentage) => {
        const numAmount = data.amount;
        const adminFee = Math.round(numAmount * (adminFeePercentage / 100));
        const netAmount = numAmount - adminFee;

        const newWithdrawal = {
            ...data,
            id: crypto.randomUUID(),
            adminFee,
            netAmount,
            status: 'pending',
            createdAt: new Date().toISOString(),
        };
        
        const currentWithdrawals = getWithdrawals();
        saveWithdrawals([...currentWithdrawals, newWithdrawal]);
        return newWithdrawal;
    },

    createTopUp: (data) => {
        const newTopUp = {
            ...data,
            id: crypto.randomUUID(),
            referenceNumber: `TU${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
            status: 'pending',
            createdAt: new Date().toISOString(),
        };

        const currentTopUps = getTopUps();
        saveTopUps([...currentTopUps, newTopUp]);
        return newTopUp;
    },
    
    // Digunakan di Payment.tsx
    completeTopUp: (transactionId, amount) => {
        const topUps = getTopUps();
        const topUpIndex = topUps.findIndex(t => t.id === transactionId);

        if (topUpIndex !== -1) {
            topUps[topUpIndex].status = 'confirmed';
            saveTopUps(topUps);
            
            // Update saldo
            Auth.updateBalance(Auth.user.balance + amount);
            return topUps[topUpIndex];
        }
        return null;
    }
};

// ==========================================================
// 4. UI COMPONENTS (Menggantikan React Components)
// ==========================================================

const GlassCard = (content, className = '') => `
    <div class="glass-card rounded-2xl p-6 md:p-8 ${className}">
        ${content}
    </div>
`;

const Button = (text, onClickFn, className = '', type = 'button', disabled = false) => {
    // Jika onClickFn adalah string, kita anggap itu nama fungsi global
    const onClickAttr = typeof onClickFn === 'string' ? `onclick="${onClickFn}(event)"` : '';
    
    return `
        <button 
            type="${type}"
            ${onClickAttr}
            class="px-4 py-2 rounded-xl text-center transition-colors font-medium ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}"
            ${disabled ? 'disabled' : ''}
        >
            ${text}
        </button>
    `;
};

const Icon = (name, className = '') => `<span class="${className}">${lucide.icons[name] ? lucide.icons[name].toSvg() : ''}</span>`;

const Layout = (title, content) => {
    const user = Auth.user;
    const hash = window.location.hash.slice(1);
    const isProfile = hash === 'profile';
    const isTopUp = hash === 'topup';
    const isWithdraw = hash === 'withdraw';
    
    return `
        <header class="shadow-sm bg-white/80 backdrop-blur-sm sticky top-0 z-10">
            <nav class="container mx-auto px-4 py-4 flex justify-between items-center max-w-4xl">
                <h1 class="text-xl font-bold gradient-text">QRISPAY</h1>
                ${user ? `
                    <a href="#profile" class="text-gray-600 hover:text-primary transition-colors flex items-center">
                        ${Icon('User', 'w-5 h-5 mr-1')}
                        ${user.name.split(' ')[0]}
                    </a>
                ` : ''}
            </nav>
        </header>
        <main class="py-12">
            <div class="container mx-auto px-4 max-w-4xl">
                <h1 class="text-3xl font-bold mb-8">${title}</h1>
                ${content}
            </div>
        </main>
        
        ${user ? `
            <nav class="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-sm border-t border-gray-200 z-10 md:hidden">
                <div class="flex justify-around items-center h-16 max-w-md mx-auto">
                    <a href="#topup" class="flex flex-col items-center text-xs p-1 ${isTopUp ? 'text-primary' : 'text-gray-500'}">
                        ${Icon('QrCode', 'w-6 h-6')}
                        <span>Top Up</span>
                    </a>
                    <a href="#withdraw" class="flex flex-col items-center text-xs p-1 ${isWithdraw ? 'text-primary' : 'text-gray-500'}">
                        ${Icon('Wallet', 'w-6 h-6')}
                        <span>Tarik Dana</span>
                    </a>
                    <a href="#profile" class="flex flex-col items-center text-xs p-1 ${isProfile ? 'text-primary' : 'text-gray-500'}">
                        ${Icon('User', 'w-6 h-6')}
                        <span>Profil</span>
                    </a>
                </div>
            </nav>
        ` : ''}
    `;
};


// ==========================================================
// 5. PAGES (Rendering Functions)
// ==========================================================

const renderLogin = () => {
    if (Auth.user) {
        window.location.hash = '#profile';
        return;
    }
    
    window.handleGoogleLogin = async () => {
        // Simulasi Google Login
        const result = await Auth.login('user@gmail.com', 'google-oauth');
        if (result) {
            toast({ title: 'Berhasil', description: 'Selamat datang kembali!' });
            window.location.hash = '#profile';
        } else {
            toast({ title: 'Login Gagal', description: 'Gagal masuk dengan Google.', variant: 'destructive' });
        }
    };

    const content = `
        <div class="flex items-center justify-center min-h-[calc(100vh-100px)]">
            ${GlassCard(`
                <div class="text-center mb-8">
                    ${Icon('Wallet', 'w-10 h-10 text-primary mx-auto mb-2')}
                    <h2 class="text-2xl font-bold">Masuk ke Akun Anda</h2>
                    <p class="text-muted-foreground">Gunakan Google untuk mengakses dashboard.</p>
                </div>
                <div class="space-y-4">
                    ${Button(`
                        ${Icon('Chrome', 'w-5 h-5 mr-2')}
                        Masuk dengan Google (Simulasi)
                    `, 'handleGoogleLogin', 'w-full bg-white hover:bg-gray-50 text-gray-900 border border-gray-300 flex items-center justify-center')}
                </div>
                <div class="mt-6 text-center">
                    <p class="text-muted-foreground">
                        Belum punya akun?
                        <a href="#register" class="text-primary hover:underline font-medium">
                            Daftar
                        </a>
                    </p>
                </div>
            `, 'max-w-md w-full')}
        </div>
    `;
    document.getElementById('app').innerHTML = Layout('Masuk', content);
    lucide.createIcons();
};

const renderRegister = () => {
    if (Auth.user) {
        window.location.hash = '#profile';
        return;
    }

    window.handleGoogleLogin = async () => {
        // Simulasi data dari Google
        const googleUser = { email: 'simulasi@gmail.com', name: 'User Simulasi Google' };
        
        const user = await Auth.loginWithGoogle(googleUser.name, googleUser.email); // Auto register/login
        
        if (user) {
            toast({ title: 'Berhasil', description: 'Akun berhasil dibuat. Selamat datang!' });
            window.location.hash = '#profile';
        } else {
            toast({ title: 'Pendaftaran Gagal', description: 'Gagal mendaftar dengan Google.', variant: 'destructive' });
        }
    };

    const content = `
        <div class="flex items-center justify-center min-h-[calc(100vh-100px)]">
            ${GlassCard(`
                <div class="text-center mb-8">
                    ${Icon('Wallet', 'w-10 h-10 text-primary mx-auto mb-2')}
                    <h2 class="text-2xl font-bold">Gabung Sekarang</h2>
                    <p class="text-muted-foreground">Masuk/Daftar menggunakan Google untuk melanjutkan.</p>
                </div>
                <div id="googleSignInButton" class='w-full'> 
                    ${Button(`
                        ${Icon('Chrome', 'mr-2 w-5 h-5')}
                        Masuk/Daftar dengan Google (Simulasi)
                    `, 'handleGoogleLogin', 'w-full bg-white text-gray-800 border border-gray-300 hover:bg-gray-100 transition-colors flex items-center justify-center')}
                </div>
                <div class="mt-6 text-center">
                    <p class="text-muted-foreground">
                        Sudah punya akun?
                        <a href="#login" class="text-primary hover:underline font-medium">
                            Masuk
                        </a>
                    </p>
                </div>
            `, 'max-w-md w-full')}
        </div>
    `;
    document.getElementById('app').innerHTML = Layout('Daftar', content);
    lucide.createIcons();
};

const renderProfile = () => {
    if (!Auth.user) {
        window.location.hash = '#login';
        return;
    }
    const user = Auth.user;

    // Logout diakses langsung dari Auth object
    window.handleLogout = Auth.logout;

    const content = `
        <div class="max-w-2xl mx-auto">
            ${GlassCard(`
                <div class="text-center mb-8">
                    <div class="mx-auto w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        ${Icon('User', 'w-12 h-12 text-primary')}
                    </div>
                    <h3 class="text-2xl font-bold">${user.name}</h3>
                    <p class="text-muted-foreground">${user.email}</p>
                </div>

                <div class="space-y-4">
                    <div class="flex items-center gap-4 p-4 rounded-xl bg-muted/50">
                        <div class="p-2 rounded-lg bg-primary/10">
                            ${Icon('Wallet', 'w-5 h-5 text-primary')}
                        </div>
                        <div>
                            <p class="text-sm text-muted-foreground">Saldo</p>
                            <p class="font-medium text-xl gradient-text">${formatCurrency(user.balance)}</p>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div class="p-4 rounded-xl bg-muted/50">
                            <p class="text-sm text-muted-foreground flex items-center mb-1">
                                ${Icon('Mail', 'w-4 h-4 mr-1')}
                                Email
                            </p>
                            <p class="font-medium truncate">${user.email}</p>
                        </div>
                        <div class="p-4 rounded-xl bg-muted/50">
                            <p class="text-sm text-muted-foreground flex items-center mb-1">
                                ${Icon('Calendar', 'w-4 h-4 mr-1')}
                                Bergabung Sejak
                            </p>
                            <p class="font-medium">${formatDate(user.createdAt)}</p>
                        </div>
                    </div>
                </div>

                <div class="mt-8 pt-6 border-t border-border">
                    ${Button(`
                        ${Icon('LogOut', 'w-4 h-4 mr-2')}
                        Keluar dari Akun
                    `, 'handleLogout', 'w-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center')}
                </div>
            `)}
        </div>
    `;
    document.getElementById('app').innerHTML = Layout('Profil Saya', content);
    lucide.createIcons();
};

const renderWithdraw = () => {
    if (!Auth.user) {
        window.location.hash = '#login';
        return;
    }
    // Menggunakan IIFE (Immediately Invoked Function Expression) untuk menampung state lokal
    (() => {
        const user = Auth.user;
        let state = {
            eWallet: '',
            eWalletNumber: '',
            recipientName: user.name,
            amount: 0,
            isSubmitted: false,
        };

        const calculateFees = (amount) => {
            const numAmount = parseInt(amount) || 0;
            const adminFee = Math.round(numAmount * (ADMIN_FEE_PERCENTAGE / 100));
            const netAmount = numAmount - adminFee;
            return { numAmount, adminFee, netAmount };
        };

        const updateView = (newState) => {
            state = { ...state, ...newState };
            document.getElementById('app').innerHTML = Layout('Tarik Saldo', WithdrawContent());
            lucide.createIcons();
            
            if (!state.isSubmitted) {
                const form = document.getElementById('withdrawForm');
                if (form) form.onsubmit = handleSubmit;
                
                // Re-attach listeners and set values
                document.getElementById('eWallet').onchange = (e) => updateView({ eWallet: e.target.value });
                document.getElementById('eWalletNumber').oninput = (e) => updateView({ eWalletNumber: e.target.value });
                document.getElementById('recipientName').oninput = (e) => updateView({ recipientName: e.target.value });
                document.getElementById('amount').oninput = (e) => updateView({ amount: e.target.value });
                
                document.getElementById('eWallet').value = state.eWallet;
                document.getElementById('eWalletNumber').value = state.eWalletNumber;
                document.getElementById('recipientName').value = state.recipientName;
                document.getElementById('amount').value = state.amount;
            }
        };
        
        const handleSubmit = (e) => {
            e.preventDefault();
            const { numAmount } = calculateFees(state.amount);

            // Validasi
            if (!state.eWallet) {
                toast({ title: 'Gagal', description: 'Pilih E-Wallet tujuan.', variant: 'destructive' });
                return;
            }
            if (state.eWalletNumber.length < 10) {
                toast({ title: 'Gagal', description: 'Nomor E-Wallet minimal 10 digit.', variant: 'destructive' });
                return;
            }
            if (numAmount < 10000) {
                toast({ title: 'Gagal', description: 'Minimal penarikan adalah Rp 10.000.', variant: 'destructive' });
                return;
            }
            if (numAmount > user.balance) {
                toast({ title: 'Gagal', description: 'Saldo tidak mencukupi.', variant: 'destructive' });
                return;
            }

            try {
                // 1. Buat Transaksi
                Transactions.createWithdrawal({
                    userId: user.id,
                    amount: numAmount,
                    eWallet: state.eWallet,
                    eWalletNumber: state.eWalletNumber,
                    recipientName: state.recipientName,
                }, ADMIN_FEE_PERCENTAGE);
                
                // 2. Update Saldo (diku