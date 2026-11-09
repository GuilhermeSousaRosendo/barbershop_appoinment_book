const $ = s => document.querySelector(s);
const load = (k, d) => JSON.parse(localStorage.getItem(k)) ?? d;
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

// ---- Dados iniciais (barbeiros de exemplo) ----
if (!localStorage.getItem('users')) {
    save('users', [
        { nome: 'João Silva', email: 'joao@barber.com', senha: '123', tipo: 'barbeiro' },
        { nome: 'Carlos Souza', email: 'carlos@barber.com', senha: '123', tipo: 'barbeiro' }
    ]);
}
if (!localStorage.getItem('agendamentos')) save('agendamentos', []);

let sessao = load('sessao', null);

// ---- Controle de telas ----
function mostrarTela() {
    ['auth', 'client', 'barber'].forEach(id => $('#' + id).hidden = true);
    $('#userbox').hidden = !sessao;
    if (!sessao) return $('#auth').hidden = false;

    $('#username').textContent = `${sessao.nome} (${sessao.tipo})`;
    if (sessao.tipo === 'cliente') { $('#client').hidden = false; iniciarCliente(); }
    else { $('#barber').hidden = false; renderBarbeiro(); }
}

// ---- Abas login/cadastro ----
$('#tabLogin').onclick = () => alternarAba(true);
$('#tabCadastro').onclick = () => alternarAba(false);
function alternarAba(login) {
    $('#formLogin').hidden = !login;
    $('#formCadastro').hidden = login;
    $('#tabLogin').classList.toggle('active', login);
    $('#tabCadastro').classList.toggle('active', !login);
    $('#msg').textContent = '';
}

// ---- Cadastro ----
$('#formCadastro').onsubmit = e => {
    e.preventDefault();
    const users = load('users', []);
    const email = $('#cadEmail').value.trim().toLowerCase();
    if (users.some(u => u.email === email)) return $('#msg').textContent = 'E-mail já cadastrado.';
    users.push({ nome: $('#cadNome').value, email, senha: $('#cadSenha').value, tipo: $('#cadTipo').value });
    save('users', users);
    e.target.reset();
    alternarAba(true);
    $('#msg').textContent = 'Conta criada! Faça login.';
};

// ---- Login ----
$('#formLogin').onsubmit = e => {
    e.preventDefault();
    const email = $('#loginEmail').value.trim().toLowerCase();
    const user = load('users', []).find(u => u.email === email && u.senha === $('#loginSenha').value);
    if (!user) return $('#msg').textContent = 'E-mail ou senha inválidos.';
    sessao = user; save('sessao', sessao);
    e.target.reset(); $('#msg').textContent = '';
    mostrarTela();
};

// ---- Logout ----
$('#btnLogout').onclick = () => { sessao = null; localStorage.removeItem('sessao'); mostrarTela(); };

// Stubs (implementados nos próximos passos)
function iniciarCliente() { }
function renderBarbeiro() { }

mostrarTela();