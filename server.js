const express = require('express');
const fs = require('fs');
const path = require('path');

const crypto = require('crypto');
const QRCode = require('qrcode');

const TEMPO_PIX = 35; // segundos que o QR Code fica na tela

const app = express();
const DB_FILE = path.join(__dirname, 'db.json');

// ---- "Banco de dados" em JSON ----
const lerDB = () => JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
const salvarDB = db => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
const proximoId = lista => Math.max(0, ...lista.map(i => i.id)) + 1;
const semSenha = ({ senha, ...u }) => u;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---- Cadastro ----
app.post('/api/cadastro', (req, res) => {
    const { nome, email, senha, tipo } = req.body;
    if (!nome || !email || !senha || !['cliente', 'barbeiro'].includes(tipo))
        return res.status(400).json({ erro: 'Preencha todos os campos.' });

    const db = lerDB();
    const emailNorm = email.trim().toLowerCase();
    if (db.usuarios.some(u => u.email === emailNorm))
        return res.status(409).json({ erro: 'E-mail já cadastrado.' });

    const user = { id: proximoId(db.usuarios), nome: nome.trim(), email: emailNorm, senha, tipo };
    db.usuarios.push(user);

    // barbeiro novo já nasce com um horário padrão
    if (tipo === 'barbeiro') {
        db.horarios[user.id] = {
            dias: [1, 2, 3, 4, 5, 6],
            slots: [
                '09:00', '09:30',
                '10:00', '10:30',
                '11:00', '11:30',
                '12:00', '12:30',
                '13:00', '13:30',
                '14:00', '14:30',
                '15:00', '15:30',
                '16:00', '16:30',
                '17:00', '17:30'
            ]
        };
    }
    salvarDB(db);
    res.status(201).json(semSenha(user));
});

// ---- Login ----
app.post('/api/login', (req, res) => {
    const { email, senha } = req.body;
    const user = lerDB().usuarios.find(u => u.email === (email || '').trim().toLowerCase() && u.senha === senha);
    if (!user) return res.status(401).json({ erro: 'E-mail ou senha inválidos.' });
    res.json(semSenha(user));
});

// ---- Listas ----
app.get('/api/barbeiros', (req, res) =>
    res.json(lerDB().usuarios.filter(u => u.tipo === 'barbeiro').map(semSenha)));

app.get('/api/servicos', (req, res) => res.json(lerDB().servicos));

// ---- Monta os horários de um barbeiro em um dia ----
function montarSlots(db, barbeiroId, data) {
    const h = db.horarios[barbeiroId];
    if (!h) return [];
    const diaSemana = new Date(data + 'T12:00:00').getDay();
    if (!h.dias.includes(diaSemana)) return [];

    const agora = new Date();
    const hojeStr = agora.toLocaleDateString('sv-SE');      // YYYY-MM-DD
    const horaAgora = agora.toTimeString().slice(0, 5);     // HH:MM

    return [...h.slots].sort().map(hora => {
        const ag = db.agendamentos.find(a =>
            a.barbeiroId === barbeiroId && a.data === data && a.hora === hora && a.status !== 'cancelado');
        const passou = data < hojeStr || (data === hojeStr && hora <= horaAgora);
        return { hora, livre: !ag && !passou, agendamento: ag || null };
    });
}

const enriquecer = (db, a) => ({
    ...a,
    clienteNome: db.usuarios.find(u => u.id === a.clienteId)?.nome,
    barbeiroNome: db.usuarios.find(u => u.id === a.barbeiroId)?.nome,
    servico: db.servicos.find(s => s.id === a.servicoId)?.nome,
    preco: db.servicos.find(s => s.id === a.servicoId)?.preco,
    pagamento: a.pagamento || { metodo: 'pix', status: 'pendente' }
});

// ---- Disponibilidade (cliente vê só livre/ocupado) ----
app.get('/api/disponibilidade', (req, res) => {
    const { barbeiroId, data } = req.query;
    if (!barbeiroId || !data) return res.status(400).json({ erro: 'Informe barbeiro e data.' });
    const slots = montarSlots(lerDB(), Number(barbeiroId), data);
    res.json(slots.map(({ hora, livre }) => ({ hora, livre })));
});

// ---- Agenda do dia (barbeiro vê quem marcou) ----
app.get('/api/agenda', (req, res) => {
    const { barbeiroId, data } = req.query;
    const db = lerDB();
    const slots = montarSlots(db, Number(barbeiroId), data);
    res.json(slots.map(s => ({ ...s, agendamento: s.agendamento ? enriquecer(db, s.agendamento) : null })));
});

// ---- Criar agendamento ----
app.post('/api/agendamentos', (req, res) => {
    const { clienteId, barbeiroId, servicoId, data, hora } = req.body;
    if (!clienteId || !barbeiroId || !servicoId || !data || !hora)
        return res.status(400).json({ erro: 'Dados incompletos.' });

    const db = lerDB();
    const slot = montarSlots(db, Number(barbeiroId), data).find(s => s.hora === hora);
    if (!slot || !slot.livre) return res.status(409).json({ erro: 'Horário indisponível.' });

    const novo = {
        id: proximoId(db.agendamentos),
        clienteId: Number(clienteId), barbeiroId: Number(barbeiroId), servicoId: Number(servicoId),
        data, hora, status: 'pendente',
        pagamento: { metodo: 'pix', status: 'pendente' }
    };
    db.agendamentos.push(novo);
    salvarDB(db);
    res.status(201).json(enriquecer(db, novo));
});

// ---- Listar agendamentos (por cliente ou por barbeiro) ----
app.get('/api/agendamentos', (req, res) => {
    const { clienteId, barbeiroId } = req.query;
    const db = lerDB();
    let lista = db.agendamentos;
    if (clienteId) lista = lista.filter(a => a.clienteId === Number(clienteId));
    if (barbeiroId) lista = lista.filter(a => a.barbeiroId === Number(barbeiroId));
    lista.sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora));
    res.json(lista.map(a => enriquecer(db, a)));
});

// ---- Confirmar / cancelar ----
app.patch('/api/agendamentos/:id', (req, res) => {
    const { status } = req.body;
    if (!['confirmado', 'cancelado'].includes(status))
        return res.status(400).json({ erro: 'Status inválido.' });
    const db = lerDB();
    const ag = db.agendamentos.find(a => a.id === Number(req.params.id));
    if (!ag) return res.status(404).json({ erro: 'Agendamento não encontrado.' });
    ag.status = status;
    salvarDB(db);
    res.json(enriquecer(db, ag));
});

// ---- Horários de atendimento do barbeiro ----
app.get('/api/horarios/:barbeiroId', (req, res) =>
    res.json(lerDB().horarios[req.params.barbeiroId] || { dias: [], slots: [] }));

app.put('/api/horarios/:barbeiroId', (req, res) => {
    const { dias, slots } = req.body;
    if (!Array.isArray(dias) || !Array.isArray(slots))
        return res.status(400).json({ erro: 'Dados inválidos.' });
    const db = lerDB();
    db.horarios[req.params.barbeiroId] = { dias, slots };
    salvarDB(db);
    res.json(db.horarios[req.params.barbeiroId]);
});

// ---- Pix simulado ----
// Código "copia e cola" fictício (o CRC é falso, serve só para a demonstração)
function gerarCodigoPix(valor) {
    const txid = crypto.randomBytes(8).toString('hex').toUpperCase();
    const v = valor.toFixed(2);
    return '00020126370014BR.GOV.BCB.PIX0115barbertime-demo' +
        '52040000530398654' + String(v.length).padStart(2, '0') + v +
        '5802BR5910BARBERTIME6009SAO PAULO' +
        '62200516' + txid + '6304ABCD';
}

// Gera (ou recupera) o QR Code do agendamento
app.post('/api/agendamentos/:id/pix', async (req, res) => {
    const db = lerDB();
    const ag = db.agendamentos.find(a => a.id === Number(req.params.id));
    if (!ag) return res.status(404).json({ erro: 'Agendamento não encontrado.' });
    if (ag.status === 'cancelado') return res.status(409).json({ erro: 'Agendamento cancelado.' });

    ag.pagamento = ag.pagamento || { metodo: 'pix', status: 'pendente' };
    if (ag.pagamento.status === 'pago') return res.json({ pago: true });

    const valor = db.servicos.find(s => s.id === ag.servicoId).preco;
    const idade = ag.pagamento.pixGeradoEm ? (Date.now() - ag.pagamento.pixGeradoEm) / 1000 : Infinity;

    // gera um QR novo se não existe ou se o anterior já passou do tempo (cliente abandonou a tela)
    if (idade > TEMPO_PIX + 10) {
        ag.pagamento.status = 'pendente';
        ag.pagamento.codigo = gerarCodigoPix(valor);
        ag.pagamento.pixGeradoEm = Date.now();
        salvarDB(db);
    }

    const restante = Math.max(0, TEMPO_PIX - (Date.now() - ag.pagamento.pixGeradoEm) / 1000);
    const qr = await QRCode.toDataURL(ag.pagamento.codigo, { width: 260, margin: 2 });
    res.json({ pago: false, codigo: ag.pagamento.codigo, qr, valor, restante, total: TEMPO_PIX });
});

// Aprova o pagamento (só depois dos 35 s)
app.post('/api/agendamentos/:id/pagar', (req, res) => {
    const db = lerDB();
    const ag = db.agendamentos.find(a => a.id === Number(req.params.id));
    if (!ag || !ag.pagamento?.pixGeradoEm) return res.status(404).json({ erro: 'Pix não encontrado.' });
    if (ag.pagamento.status === 'pago') return res.json(enriquecer(db, ag));
    if (ag.status === 'cancelado') return res.status(409).json({ erro: 'Agendamento cancelado.' });

    const restante = TEMPO_PIX - (Date.now() - ag.pagamento.pixGeradoEm) / 1000;
    if (restante > 1) return res.status(409).json({ erro: 'Pagamento ainda em processamento.', restante: Math.ceil(restante) });

    ag.pagamento.status = 'pago';
    ag.pagamento.pagoEm = new Date().toISOString();
    salvarDB(db);
    res.json(enriquecer(db, ag));
});

const PORT = 3000;
app.listen(PORT, () => console.log(`BarberTime rodando em http://localhost:${PORT}`));