/* Minutas novas: retificação, alteração de prenome e alteração de sobrenome.
   Tudo no navegador, nada é gravado. Sem papel timbrado; terminam com a certificação de quem atende. */
(function () {
  'use strict';
  const B = window.MinutasBase;
  if (!B) {
    // Página nova com arquivo antigo em cache: avisa em vez de deixar a aba vazia.
    document.querySelectorAll('.minuta-nova').forEach((s) => {
      s.innerHTML = '<p class="erros">O site foi atualizado e o navegador ainda está com a versão antiga. Aperte <b>Ctrl+F5</b> para recarregar.</p>';
    });
    return;
  }
  const $ = (sel, raiz = document) => raiz.querySelector(sel);
  const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
  const up = (s) => (s || '').toLocaleUpperCase('pt-BR');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const limpo = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const dataBR = (iso) => (iso ? iso.split('-').reverse().join('/') : '');
  function idade(iso) {
    if (!iso) return null;
    const [a, m, d] = iso.split('-').map(Number);
    const h = new Date();
    let i = h.getFullYear() - a;
    if (h.getMonth() + 1 < m || (h.getMonth() + 1 === m && h.getDate() < d)) i--;
    return i;
  }
  // Menoridade: até 16 representado, de 16 a 18 assistido (CC, art. 1.634, VII); casamento emancipa (CC, art. 5º, par. único, II).
  const JA_CASOU = ['casado', 'divorciado', 'viuvo', 'separado'];
  function situacaoMenor(p) {
    const i = idade(p.nascimento);
    return { i, menor: i !== null && i < 18, assistido: i !== null && i >= 16 && i < 18, emancipado: JA_CASOU.includes(p.estadoCivil), convivente: p.estadoCivil === 'convivente' };
  }
  function diasDesde(iso) {
    if (!iso) return null;
    return Math.floor((Date.now() - new Date(iso + 'T12:00:00').getTime()) / 86400000);
  }

  // =====================================================================
  // Peças de formulário reutilizáveis
  // =====================================================================
  const ESTADOS_CIVIS = [
    ['solteiro', 'solteiro(a)', 'solteiro', 'solteira'],
    ['casado', 'casado(a)', 'casado', 'casada'],
    ['divorciado', 'divorciado(a)', 'divorciado', 'divorciada'],
    ['viuvo', 'viúvo(a)', 'viúvo', 'viúva'],
    ['separado', 'separado(a) judicialmente', 'separado judicialmente', 'separada judicialmente'],
    ['convivente', 'convivente em união estável', 'convivente em união estável', 'convivente em união estável'],
  ];
  const CARGOS = ['Escrevente', 'Escrevente Substituto', 'Oficial Substituto', 'Oficial'];

  // Bloco de qualificação de uma pessoa. "completo" inclui nascimento, naturalidade e filiação.
  function blocoPessoa(raiz, prefixo, { titulo, completo = true, telefone = true, sexo = true } = {}) {
    const n = (c) => `${prefixo}_${c}`;
    raiz.insertAdjacentHTML('beforeend', `
      ${titulo ? `<h3>${titulo}</h3>` : ''}
      <div class="grade g2">
        <label>Nome completo <input data-c="nome"></label>
        ${sexo ? `<label>Sexo (só para a concordância do texto)
          <select data-c="sexo"><option value="" selected>Selecione</option><option value="M">Masculino</option><option value="F">Feminino</option></select></label>` : ''}
      </div>
      <div class="grade g4">
        <label>Nacionalidade <input data-c="nacionalidade" value="brasileira"></label>
        <label>Estado civil <select data-c="estadoCivil"><option value="" selected>Selecione</option>
          ${ESTADOS_CIVIS.map((e) => `<option value="${e[0]}">${e[1]}</option>`).join('')}</select></label>
        <label>Profissão <input data-c="profissao"></label>
        <label>CPF <input data-c="cpf" inputmode="numeric" maxlength="14" placeholder="000.000.000-00"></label>
      </div>
      <div class="grade g4">
        <label>RG nº <input data-c="rg"></label>
        <label>Órgão emissor <input data-c="rgOrgao" value="SSP/SP"></label>
        ${completo ? `<label>Data de nascimento <input type="date" data-c="nascimento"></label>
        <label>Naturalidade (cidade/UF) <input data-c="naturalidade" placeholder="ex.: Caraguatatuba/SP"></label>` : ''}
      </div>
      ${completo ? `<div class="grade g2">
        <label>Nome do pai <input data-c="pai"></label>
        <label>Nome da mãe <input data-c="mae"></label>
      </div>` : ''}
      <div class="grade g-end1">
        <label>CEP <input data-c="cep" inputmode="numeric" maxlength="9" placeholder="00000-000"><small data-c="cepStatus" class="dica"></small></label>
        <label>Número <input data-c="numero"></label>
        <label>Complemento <input data-c="complemento" placeholder="opcional"></label>
        ${telefone ? '<label>Telefone <input data-c="telefone" inputmode="tel"></label>' : '<span></span>'}
      </div>
      <div class="grade g-end2">
        <label>Rua / logradouro <input data-c="logradouro"></label>
        <label>Bairro <input data-c="bairro"></label>
        <label>Cidade <input data-c="cidade"></label>
        <label>UF <input data-c="uf" maxlength="2"></label>
      </div>`);
    const el = (c) => raiz.querySelector(`[data-c="${c}"][data-p="${prefixo}"]`) || null;
    // marca os campos deste bloco
    raiz.querySelectorAll('[data-c]:not([data-p])').forEach((e) => { e.dataset.p = prefixo; e.name = n(e.dataset.c); });
    const cpf = el('cpf');
    cpf.addEventListener('input', () => { cpf.value = B.mascaraCPF(cpf.value); cpf.classList.remove('invalido'); });
    cpf.addEventListener('blur', () => { if (cpf.value && !B.cpfValido(cpf.value)) cpf.classList.add('invalido'); });
    const cep = el('cep'), status = el('cepStatus');
    let ultimo = null;
    cep.addEventListener('input', async () => {
      cep.value = B.mascaraCEP(cep.value);
      const d = cep.value.replace(/\D/g, '');
      if (d.length !== 8) { status.textContent = ''; return; }
      if (d === ultimo) return;
      ultimo = d; status.textContent = 'Buscando endereço…';
      try {
        const j = await fetch(`https://viacep.com.br/ws/${d}/json/`, { referrerPolicy: 'no-referrer', cache: 'no-store' }).then((r) => r.json());
        if (j.erro) throw new Error();
        el('logradouro').value = j.logradouro || ''; el('bairro').value = j.bairro || '';
        el('cidade').value = j.localidade || ''; el('uf').value = j.uf || '';
        status.textContent = j.logradouro ? 'Endereço preenchido. Falta o número.' : 'CEP geral da cidade: digite rua e bairro.';
        (j.logradouro ? el('numero') : el('logradouro')).focus();
      } catch (e) { ultimo = null; status.textContent = 'CEP não encontrado. Preencha o endereço à mão.'; }
    });
    const v = (c) => (el(c) ? limpo(el(c).value) : '');
    return {
      el,
      ler() {
        return {
          nome: up(v('nome')), sexo: v('sexo'), nacionalidade: v('nacionalidade'), estadoCivil: v('estadoCivil'),
          profissao: v('profissao'), cpf: v('cpf'), rg: v('rg'), rgOrgao: v('rgOrgao'), nascimento: v('nascimento'),
          naturalidade: v('naturalidade'), pai: up(v('pai')), mae: up(v('mae')), telefone: v('telefone'),
          logradouro: v('logradouro'), numero: v('numero'), complemento: v('complemento'), bairro: v('bairro'),
          cidade: v('cidade'), uf: up(v('uf')),
        };
      },
      limpar() { ultimo = null; status.textContent = ''; },
      // exigidos: lista de campos obrigatórios
      validar(erros, rotulo, exigidos) {
        exigidos.forEach((c) => {
          const e = el(c);
          if (e && !limpo(e.value)) { erros.push(`${rotulo}: ${e.closest('label') ? e.closest('label').firstChild.textContent.trim() : c}`); e.classList.add('invalido'); }
        });
        if (v('cpf') && !B.cpfValido(v('cpf'))) { erros.push(`${rotulo}: CPF inválido (confira os números)`); el('cpf').classList.add('invalido'); }
        const nasc = v('nascimento');
        if (nasc && (+nasc.slice(0, 4) < 1900 || new Date(nasc + 'T12:00:00') > new Date())) { erros.push(`${rotulo}: data de nascimento inválida`); el('nascimento').classList.add('invalido'); }
      },
    };
  }

  // Concordância de gênero
  const gx = (sexo, m, f) => (sexo === 'F' ? f : sexo === 'M' ? m : `${m}(a)`);
  function estadoCivilTexto(cod, sexo) {
    const e = ESTADOS_CIVIS.find((x) => x[0] === cod);
    if (!e) return '';
    return sexo === 'F' ? e[3] : sexo === 'M' ? e[2] : e[1];
  }
  function enderecoTexto(x) {
    let s = x.logradouro;
    if (!s) return '';
    if (x.numero) s += `, ${x.numero}`;
    if (x.complemento) s += `, ${x.complemento}`;
    if (x.bairro) s += ` - ${x.bairro}`;
    if (x.cidade) s += `, ${x.cidade}`;
    if (x.uf) s += ` - ${x.uf}`;
    return s;
  }
  // Qualificação em texto corrido, no padrão dos modelos do cartório.
  function qualificacao(x, { completo = true } = {}) {
    const g = (m, f) => gx(x.sexo, m, f);
    const partes = [];
    if (x.nacionalidade) partes.push(`nacionalidade ${x.nacionalidade}`);
    const ec = estadoCivilTexto(x.estadoCivil, x.sexo); if (ec) partes.push(ec);
    if (x.profissao) partes.push(x.profissao);
    if (x.rg) partes.push(`${g('portador', 'portadora')} da cédula de identidade RG nº ${x.rg}${x.rgOrgao ? ` ${x.rgOrgao}` : ''}`);
    if (x.cpf) partes.push(`${g('inscrito', 'inscrita')} no CPF/MF sob o nº ${x.cpf}`);
    if (completo && x.naturalidade) partes.push(`natural de ${x.naturalidade}`);
    if (completo && x.nascimento) partes.push(`${g('nascido', 'nascida')} aos ${dataBR(x.nascimento)}`);
    if (completo && (x.pai || x.mae)) partes.push(`${g('filho', 'filha')} de ${[x.pai, x.mae].filter(Boolean).join(' e ')}`);
    const end = enderecoTexto(x); if (end) partes.push(`${g('residente e domiciliado', 'residente e domiciliada')} à ${end}`);
    if (x.telefone) partes.push(`telefone ${x.telefone}`);
    return partes.join(', ');
  }

  // Cartório de destino (estado, cidade e cartório, com pesquisa) + texto do destinatário.
  function blocoDestino(raiz, id) {
    raiz.insertAdjacentHTML('beforeend', `
      <fieldset>
        <legend>Cartório onde está o registro (destino)</legend>
        <div class="grade g-destino">
          <label>Estado <select id="${id}Uf"></select></label>
          <div class="rotulo">Cidade <div class="combo" id="${id}Cidade"></div></div>
          <div class="rotulo">Cartório <div class="combo" id="${id}Cartorio"></div></div>
        </div>
        <label>Endereçamento (como sai no documento – pode corrigir)
          <textarea id="${id}Dest" rows="2"></textarea></label>
      </fieldset>`);
    const selUF = $(`#${id}Uf`), dest = $(`#${id}Dest`);
    let cidade = null;
    const comboCart = B.criarCombo($(`#${id}Cartorio`), { vazio: 'Escolha a cidade primeiro', aoEscolher: (it) => montar(it) });
    const comboCid = B.criarCombo($(`#${id}Cidade`), { vazio: 'Selecione', aoEscolher: (it) => { cidade = it ? it.valor : null; cartorios(); } });
    function cidades() {
      const base = B.base(); if (!base) return;
      cidade = null;
      comboCid.definirItens(Object.keys(base.uf[selUF.value] || {}).map((c) => ({ valor: c, rotulo: c })), 'Selecione');
    }
    function cartorios() {
      dest.value = '';
      if (!cidade) { comboCart.definirItens([], 'Escolha a cidade primeiro'); return; }
      const lista = B.base().uf[selUF.value][cidade];
      const itens = lista.map(([cns, resumo, nome]) => ({ valor: cns, rotulo: `${cns} - ${cidade}${resumo ? ` - ${resumo}` : ''}`, detalhe: nome, resumo, nome }));
      itens.push(B.OUTRO);
      comboCart.definirItens(itens, 'Selecione');
      if (lista.length === 1) comboCart.escolherValor(lista[0][0]);
    }
    function montar(it) {
      if (!it) { dest.value = ''; return; }
      if (it.valor === 'outro') { dest.value = 'ILMO(A). SR(A). OFICIAL DE REGISTRO CIVIL DAS PESSOAS NATURAIS DE '; dest.focus(); return; }
      const uf = selUF.value, cid = up(cidade);
      const sozinho = B.base().uf[uf][cidade].length === 1;
      let alvo;
      if (it.resumo) alvo = `${cid}/${uf} – ${up(it.resumo)}`;
      else if (sozinho) alvo = `${cid}/${uf}`;
      else alvo = `${cid}/${uf} – ${up(it.nome)}`;
      dest.value = `ILMO(A). SR(A). OFICIAL DE REGISTRO CIVIL DAS PESSOAS NATURAIS DE ${alvo}`;
    }
    selUF.addEventListener('change', cidades);
    B.quandoCarregarBase((base) => {
      if (selUF.options.length) return;
      Object.keys(base.uf).forEach((uf) => selUF.add(new Option(uf, uf, uf === 'SP', uf === 'SP')));
      cidades();
    });
    return {
      texto: () => up(limpo(dest.value)),
      cidade: () => cidade,
      limpar() { selUF.value = 'SP'; cidades(); comboCart.definirItens([], 'Escolha a cidade primeiro'); dest.value = ''; },
      temDados: () => !!(cidade || dest.value.trim()),
      el: dest,
    };
  }

  // Local, data e quem certifica (nome + cargo).
  function blocoFechamento(raiz, id) {
    raiz.insertAdjacentHTML('beforeend', `
      <fieldset>
        <legend>Local, data e certificação</legend>
        <div class="grade g2">
          <label>Cidade <input id="${id}Local" value="CARAGUATATUBA"></label>
          <label>Data <input type="date" id="${id}Data"></label>
        </div>
        <div class="grade g-cert">
          <label>Escrevente <input id="${id}Esc"></label>
          <label>Cargo <select id="${id}Cargo"><option value="" selected>Selecione</option>
            ${CARGOS.map((c) => `<option>${c}</option>`).join('')}</select></label>
          <label>Selo (opcional) <input id="${id}Selo" placeholder="em branco = linha para preencher à mão"></label>
        </div>
      </fieldset>`);
    const data = $(`#${id}Data`); data.value = B.hojeISO();
    return {
      ler: () => ({ local: up(limpo($(`#${id}Local`).value)), data: data.value, escrevente: limpo($(`#${id}Esc`).value), cargo: $(`#${id}Cargo`).value, selo: up(limpo($(`#${id}Selo`).value)) }),
      validar(erros) {
        [[`#${id}Local`, 'Cidade da assinatura'], [`#${id}Data`, 'Data'], [`#${id}Esc`, 'Escrevente'], [`#${id}Cargo`, 'Cargo de quem certifica']].forEach(([s, r]) => {
          if (!limpo($(s).value)) { erros.push(r); $(s).classList.add('invalido'); }
        });
      },
      reiniciarData() { data.value = B.hojeISO(); $(`#${id}Local`).value = 'CARAGUATATUBA'; },
    };
  }

  function botoes(raiz, id) {
    raiz.insertAdjacentHTML('beforeend', `
      <div id="${id}Erros" class="erros" role="alert" hidden></div>
      <div class="acoes">
        <button type="button" class="sec" data-acao="ver">Pré-visualizar</button>
        <button type="button" class="pri" data-acao="pdf">Baixar PDF</button>
        <button type="button" class="sec" data-acao="word">Baixar Word (editável)</button>
        <button type="button" class="perigo" data-acao="limpar">Nova minuta (limpar)</button>
      </div>`);
  }
  function mostrarErros(raiz, id, erros) {
    const c = $(`#${id}Erros`);
    if (!erros.length) { c.hidden = true; return false; }
    c.innerHTML = '<b>Falta preencher ou corrigir:</b><ul>' + erros.map((e) => `<li>${esc(e)}</li>`).join('') + '</ul>';
    c.hidden = false;
    const p = raiz.querySelector('.invalido'); if (p) p.focus();
    return true;
  }

  // =====================================================================
  // Documento genérico → PDF (pdfmake) e Word (docx)
  // Blocos: {p:[runs], al, ind, esqBloco, antes, depois, tam, neg} | {ass:{nome, linhas, larg, centro}} | {lado:[ass, ass]} | {grupo:[...]}
  // run: 'texto' (os nomes da lista NOMES saem em negrito sozinhos) ou {t, b}
  // =====================================================================
  const R = (t, b) => ({ t, b: !!b });
  const LARG_UTIL = 475; // largura útil do A4 com as margens usadas (pt)
  const MARGENS = { esq: 65, dir: 55, cima: 42, baixo: 40 };
  const RECUO = 70; // recuo da primeira linha, como nos modelos do cartório
  let NOMES = [];
  // Quebra o texto e põe em negrito os nomes conhecidos (requerente, registrados, pais...).
  function partes(rs) {
    const nomes = [...new Set(NOMES.filter((n) => n && n.length > 2))].sort((a, b) => b.length - a.length);
    const re = nomes.length ? new RegExp('(' + nomes.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'g') : null;
    const out = [];
    rs.forEach((r) => {
      if (typeof r !== 'string') { out.push(r); return; }
      if (!re) { out.push({ t: r, b: false }); return; }
      r.split(re).forEach((s, i) => { if (s) out.push({ t: s, b: i % 2 === 1 }); });
    });
    return out;
  }

  const TEXTO_TIMBRADO = 'OFICIAL DE REGISTRO CIVIL DAS PESSOAS NATURAIS E DE INTERDIÇÕES E TUTELAS DA SEDE DA COMARCA DE CARAGUATATUBA, ESTADO DE SÃO PAULO';
  const RODAPE_TIMBRADO = 'Av. Pernambuco, 150 – Jardim Primavera, Caraguatatuba – SP, CEP 11660-640 – Telefone: (12) 3883-9224';
  let TIMB = null;
  async function carregarTimbrado() {
    if (TIMB) return TIMB;
    const [logo, oficial] = await Promise.all(['logo', 'oficial'].map((n) => fetch(`img/${n}.png`).then((r) => r.arrayBuffer())));
    const paraUrl = (buf) => {
      const b = new Uint8Array(buf); let bin = '';
      for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
      return 'data:image/png;base64,' + btoa(bin);
    };
    TIMB = { logo, oficial, logoUrl: paraUrl(logo), oficialUrl: paraUrl(oficial) };
    return TIMB;
  }

  function pdfDoc(titulo, blocos, opts = {}) {
    const runs = (rs, neg) => partes(rs).map((r) => ({ text: r.t, bold: !!(neg || r.b) }));
    const assin = (a) => {
      const larg = a.larg || 320, al = a.centro ? 'center' : 'left';
      const st = [
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: larg, y2: 0, lineWidth: 0.8 }], margin: [0, a.antes || 26, 0, 2] },
        { text: runs(a.nome, a.neg), fontSize: a.tam || 10, alignment: al },
        ...(a.linhas || []).map((l) => ({ text: runs(l), fontSize: (a.tam || 10) - 0.5, alignment: al })),
      ];
      if (a.centro) return { columns: [{ width: '*', text: '' }, { width: larg, stack: st }, { width: '*', text: '' }], unbreakable: true };
      return { stack: st, unbreakable: true };
    };
    const render = (b) => {
      if (b.grupo) return { stack: b.grupo.map(render), unbreakable: true };
      if (b.espaco) return { text: '', margin: [0, b.espaco, 0, 0] };
      if (b.ass) return assin(b.ass);
      if (b.lado) return { columns: b.lado.map(assin), columnGap: 20, unbreakable: true };
      return {
        text: runs(b.p, b.neg), alignment: { j: 'justify', c: 'center', e: 'left', d: 'right' }[b.al || 'j'],
        leadingIndent: b.ind || 0, margin: [b.esqBloco || 0, b.antes || 0, 0, b.depois == null ? 4 : b.depois], fontSize: b.tam || 10.5,
        lineHeight: b.lh || 1.15,
      };
    };
    const doc = {
      pageSize: 'A4', pageMargins: [MARGENS.esq, MARGENS.cima, MARGENS.dir, MARGENS.baixo],
      info: { title: titulo, creator: 'Minutas do Registro Civil' },
      defaultStyle: { font: 'Roboto', fontSize: 11, lineHeight: 1.2 }, content: blocos.map(render),
    };
    if (opts.timbrado && TIMB) {
      // mesmo papel timbrado da declaração de pobreza
      doc.pageMargins = [MARGENS.esq, 110, MARGENS.dir, 62];
      doc.header = () => [
        { margin: [40, 18, 40, 0], columnGap: 16, columns: [
          { image: TIMB.logoUrl, width: 120 },
          { stack: [
            { text: TEXTO_TIMBRADO, alignment: 'center', fontSize: 8.5, bold: true, margin: [0, 8, 0, 6] },
            { image: TIMB.oficialUrl, width: 170, alignment: 'center' },
          ] },
        ] },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.8, lineColor: '#555' }], margin: [40, 8, 40, 0] },
      ];
      doc.footer = () => ({ margin: [40, 18, 40, 0], stack: [
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.8, lineColor: '#555' }], margin: [0, 0, 0, 6] },
        { text: RODAPE_TIMBRADO, alignment: 'center', fontSize: 8, color: '#444' },
      ] });
    }
    return doc;
  }

  function wordDoc(titulo, blocos, opts = {}) {
    const X = window.docx;
    const { Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType, TableLayoutType } = X;
    const pt = (n) => Math.round(n * 20);
    const F = 'Arial';
    const SB = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
    const sem = { top: SB, bottom: SB, left: SB, right: SB, insideHorizontal: SB, insideVertical: SB };
    const runs = (rs, tam, neg) => partes(rs).map((r) => new TextRun({ text: r.t, bold: !!(neg || r.b), font: F, size: Math.round(tam * 2) }));
    const AL = { j: AlignmentType.JUSTIFIED, c: AlignmentType.CENTER, e: AlignmentType.LEFT, d: AlignmentType.RIGHT };
    const assin = (a, total) => {
      const larg = a.larg || 320, tam = a.tam || 10;
      const esq = a.centro ? Math.max(0, (total - larg) / 2) : 0;
      const ind = { left: pt(esq), right: pt(Math.max(0, total - esq - larg)) };
      const al = a.centro ? AlignmentType.CENTER : AlignmentType.LEFT;
      return [
        new Paragraph({ children: [new TextRun({ text: '', font: F })], spacing: { before: pt(a.antes || 26), after: pt(2) }, indent: ind, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000' } } }),
        new Paragraph({ children: runs(a.nome, tam, a.neg), spacing: { after: 0 }, alignment: al }),
        ...(a.linhas || []).map((l) => new Paragraph({ children: runs(l, tam - 0.5), spacing: { after: 0 }, alignment: al })),
      ];
    };
    const filhos = [];
    const lista = [];
    blocos.forEach((b) => { if (b.grupo) lista.push(...b.grupo); else lista.push(b); });
    lista.forEach((b) => {
      if (b.espaco) { filhos.push(new Paragraph({ children: [], spacing: { before: pt(b.espaco), after: 0 } })); return; }
      if (b.ass) { filhos.push(...assin(b.ass, LARG_UTIL)); return; }
      if (b.lado) {
        const col = (LARG_UTIL - 20) / 2;
        filhos.push(new Table({
          width: { size: pt(LARG_UTIL), type: WidthType.DXA }, columnWidths: [pt(col + 20), pt(col)], layout: TableLayoutType.FIXED, borders: sem,
          rows: [new TableRow({ cantSplit: true, children: b.lado.map((a, i) => new TableCell({
            width: { size: pt(i === 0 ? col + 20 : col), type: WidthType.DXA }, borders: sem,
            margins: { left: 0, right: pt(i === 0 ? 20 : 0), top: 0, bottom: 0 },
            children: assin(Object.assign({}, a, { centro: false, larg: Math.min(a.larg || col, col) }), col),
          })) })],
        }));
        return;
      }
      const tam = b.tam || 10.5;
      filhos.push(new Paragraph({
        children: runs(b.p, tam, b.neg), alignment: AL[b.al || 'j'],
        indent: { firstLine: pt(b.ind || 0), left: pt(b.esqBloco || 0) },
        spacing: { before: pt(b.antes || 0), after: pt(b.depois == null ? 4 : b.depois), line: Math.round((b.lh || 1.15) * 240) },
      }));
    });
    const secao = { properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: pt(MARGENS.cima), bottom: pt(MARGENS.baixo), left: pt(MARGENS.esq), right: pt(MARGENS.dir) } } }, children: filhos };
    if (opts.timbrado && TIMB) {
      const { Header, Footer, ImageRun, VerticalAlign } = X;
      const LARG = LARG_UTIL;
      secao.properties.page.margin = { top: pt(105), bottom: pt(60), left: pt(MARGENS.esq), right: pt(MARGENS.dir), header: pt(18), footer: pt(20) };
      secao.headers = { default: new Header({ children: [
        new Table({ width: { size: pt(LARG), type: WidthType.DXA }, columnWidths: [pt(136), pt(LARG - 136)], layout: TableLayoutType.FIXED, borders: sem,
          rows: [new TableRow({ children: [
            new TableCell({ width: { size: pt(136), type: WidthType.DXA }, borders: sem, verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ children: [new ImageRun({ data: TIMB.logo, transformation: { width: 150, height: 65 } })] })] }),
            new TableCell({ width: { size: pt(LARG - 136), type: WidthType.DXA }, borders: sem, verticalAlign: VerticalAlign.CENTER, children: [
              new Paragraph({ children: [new TextRun({ text: TEXTO_TIMBRADO, bold: true, font: F, size: 16 })], alignment: AlignmentType.CENTER, spacing: { after: pt(4) } }),
              new Paragraph({ children: [new ImageRun({ data: TIMB.oficial, transformation: { width: 210, height: 29 } })], alignment: AlignmentType.CENTER, spacing: { after: 0 } }),
            ] }),
          ] })] }),
        new Paragraph({ children: [], spacing: { before: 0, after: 0 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '555555' } } }),
      ] }) };
      secao.footers = { default: new Footer({ children: [
        new Paragraph({ children: [new TextRun({ text: RODAPE_TIMBRADO, font: F, size: 16, color: '444444' })], alignment: AlignmentType.CENTER,
          border: { top: { style: BorderStyle.SINGLE, size: 6, color: '555555', space: 4 } } }),
      ] }) };
    }
    return new X.Document({
      creator: 'Minutas do Registro Civil', title: titulo,
      styles: { default: { document: { run: { font: F, size: 22 } } } },
      sections: [secao],
    });
  }

  // Peças de texto comuns
  const titulo = (t) => ({ p: [t], al: 'e', antes: 8, depois: 2 });           // "I – REQUERENTE:" (sem negrito)
  const enderecamento = (t) => ({ p: [t], al: 'j', neg: true, depois: 12 });  // endereçamento em negrito
  // Texto de caixa editável → parágrafos. Linhas que começam com espaço/tab saem recuadas como item.
  function paragrafosDe(texto, { esqItem = 40, tamItem, recuo = RECUO } = {}) {
    return texto.split(/\r?\n/).filter((l) => l.trim()).map((l) => (/^[\t ]{2,}|^\t/.test(l)
      ? { p: [l.trim()], esqBloco: esqItem, depois: 4, tam: tamItem }
      : { p: [l.trim()], ind: recuo }));
  }

  // Final comum: local/data centralizados, assinatura(s) centralizada(s) e certificação.
  function fechamentoBlocos(f, assinaturas, { docsOriginais = false } = {}) {
    const bl = [{ p: [`${f.local}, ${B.dataExtenso(f.data)}.`], al: 'c', antes: 10, depois: 0 }];
    assinaturas.forEach((a) => bl.push(a));
    // A certificação e a assinatura de quem certifica ficam sempre juntas na mesma página.
    bl.push({ grupo: [
      { p: [R('CERTIFICO E DOU FÉ', true), ' que a assinatura supra foi lançada em minha presença.' + (docsOriginais ? ' Certifico ainda que todos os documentos anexados foram extraídos dos originais.' : '')], antes: 14, depois: 0, tam: 9.5 },
      { ass: { nome: [`${f.escrevente} – ${f.cargo}`], linhas: [[`SELO: ${f.selo || '______________________________'}`]], larg: 300, antes: 24, tam: 9.5, centro: true } },
    ] });
    return bl;
  }
  const assinaturaCentro = (nome, linhas) => ({ ass: { nome: [nome], linhas: linhas || [], larg: 320, centro: true, neg: true } });

  function nomeArquivo(prefixo, nome, ext) {
    const b = (nome || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return `${prefixo}-${b || 'minuta'}${ext ? '.' + ext : ''}`;
  }
  async function entregar(acao, r) {
    NOMES = r.nomes || [];
    const opts = { timbrado: !!r.timbrado };
    if (opts.timbrado) await carregarTimbrado();
    if (acao === 'word') {
      const blob = await window.docx.Packer.toBlob(wordDoc(r.titulo, r.blocos, opts));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = r.arquivo + '.docx';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      return;
    }
    const pdf = pdfMake.createPdf(pdfDoc(r.titulo, r.blocos, opts));
    if (acao === 'pdf') pdf.download(r.arquivo + '.pdf');
    else pdf.getBlob((blob) => B.mostrarPdf(blob));
  }

  // Caixa "texto que vai sair (pode editar)": montada sozinha; depois de editada, não é mais trocada.
  function blocoTexto(raiz, id, legenda) {
    raiz.insertAdjacentHTML('beforeend', `
      <fieldset class="texto-editavel"><legend>${legenda}</legend>
        <p class="dica">O texto é montado sozinho com os dados preenchidos. Pode editar à vontade: depois de editado, o site não troca mais.
          Linhas que começam com espaço saem recuadas, como item. Os nomes saem em negrito no documento.</p>
        <textarea id="${id}" rows="9"></textarea>
        <div class="acoes-crc"><button type="button" class="sec mini" id="${id}Refazer">Refazer texto automático</button>
          <span class="dica" id="${id}Estado"></span></div>
      </fieldset>`);
    const ta = $(`#${id}`), estado = $(`#${id}Estado`);
    let editado = false;
    const marcar = () => { estado.textContent = editado ? 'Texto editado à mão (não é mais atualizado sozinho).' : 'Atualizando sozinho.'; };
    ta.addEventListener('input', () => { editado = true; marcar(); });
    marcar();
    return {
      ta,
      atualizar(t) { if (!editado) ta.value = t; },
      refazer(t) { editado = false; ta.value = t; marcar(); },
      reset() { editado = false; ta.value = ''; marcar(); },
      ler: () => ta.value,
    };
  }

  // Monta uma aba: chama "montar" para criar os campos e liga os botões.
  function criarAba({ nome, raiz, id, montar, gerar, limparExtra, camposZerar, textoAuto }) {
    const ctx = montar(raiz);
    botoes(raiz, id);
    let nomeGerado = null;
    // texto automático: recalcula a cada mudança nos campos (menos na própria caixa de texto)
    if (ctx.texto && textoAuto) {
      let t = null;
      const recalcular = () => { clearTimeout(t); t = setTimeout(() => ctx.texto.atualizar(textoAuto(ctx)), 150); };
      raiz.addEventListener('input', (e) => { if (e.target !== ctx.texto.ta) recalcular(); });
      raiz.addEventListener('change', (e) => { if (e.target !== ctx.texto.ta) recalcular(); });
      raiz.addEventListener('click', (e) => { if (e.target.closest('.combo-lista, .remover, #retAdd')) recalcular(); });
      $(`#${ctx.texto.ta.id}Refazer`).addEventListener('click', () => ctx.texto.refazer(textoAuto(ctx)));
      ctx.recalcular = recalcular;
    }
    raiz.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-acao]'); if (!b || !raiz.contains(b)) return;
      const acao = b.dataset.acao;
      if (acao === 'limpar') { if (confirm('Apagar o que foi preenchido nesta minuta?')) { limpar(); window.scrollTo(0, 0); } return; }
      raiz.querySelectorAll('.invalido').forEach((x) => x.classList.remove('invalido'));
      // garante o texto automático atualizado (se não foi editado à mão) antes de gerar
      if (ctx.texto && textoAuto) ctx.texto.atualizar(textoAuto(ctx));
      const erros = [];
      const r = gerar(ctx, erros);
      if (mostrarErros(raiz, id, erros) || !r) return;
      try {
        await entregar(acao === 'ver' ? 'ver' : acao, r);
        nomeGerado = r.chave;
      } catch (err) { console.error(err); alert('Não foi possível gerar o documento. Tente de novo.'); }
    });
    // Minuta nova: se o requerente mudar depois de gerar, zera livro/folha/termo e o tipo de assento.
    if (ctx.campoChave) {
      ctx.campoChave.addEventListener('change', () => {
        if (nomeGerado !== null && up(limpo(ctx.campoChave.value)) !== nomeGerado) {
          nomeGerado = null;
          (camposZerar ? camposZerar(ctx) : []).forEach((el) => { el.value = ''; el.dispatchEvent(new Event('change')); });
          if (ctx.texto) ctx.texto.reset();
          const av = $(`#${id}AvisoNova`); if (av) av.hidden = false;
        }
      });
    }
    function limpar() {
      raiz.querySelectorAll('input, textarea, select').forEach((el) => {
        if (el.closest('.combo')) return;
        if (el.type === 'checkbox' || el.type === 'radio') el.checked = el.defaultChecked;
        else if (el.tagName === 'SELECT') { const d = [...el.options].find((o) => o.defaultSelected); el.value = d ? d.value : (el.options[0] ? el.options[0].value : ''); }
        else el.value = el.defaultValue;
        el.classList.remove('invalido');
      });
      raiz.querySelectorAll('.dica[data-c="cepStatus"]').forEach((s) => { s.textContent = ''; });
      $(`#${id}Erros`).hidden = true;
      const av = $(`#${id}AvisoNova`); if (av) av.hidden = true;
      nomeGerado = null;
      if (limparExtra) limparExtra(ctx);
      if (ctx.texto) ctx.texto.reset();
      if (B.abaAtual() === nome) B.esconderPrevia();
    }
    B.registrarAba({
      nome, limpar,
      temDados: () => [...raiz.querySelectorAll('input:not([type=date]):not([type=checkbox]), textarea')].some((el) => !el.closest('.combo') && el.value.trim() && el.value !== el.defaultValue) || (ctx.destino && ctx.destino.temDados()),
    });
    return ctx;
  }

  const ASSENTOS = [
    ['A', 'Nascimento', 'NASCIMENTO', 'A'], ['B', 'Casamento', 'CASAMENTO', 'B'], ['B AUX', 'Casamento religioso com efeito civil', 'CASAMENTO', 'B-Auxiliar'],
    ['C', 'Óbito', 'ÓBITO', 'C'], ['C AUX', 'Natimorto', 'NATIMORTO', 'C-Auxiliar'],
  ];
  const LIVROS = ['A', 'B', 'B-Auxiliar', 'C', 'C-Auxiliar', 'E'];

  // =====================================================================
  // 1) RETIFICAÇÃO (seções; complementação de dados e/ou correção)
  // =====================================================================
  const CAMPOS_RET = ['Nome do(a) registrado(a)', 'Nome do pai', 'Nome da mãe', 'Nome dos avós paternos', 'Nome dos avós maternos',
    'Data de nascimento', 'Local de nascimento', 'Naturalidade', 'Nome do contraente', 'Nome da contraente', 'Filiação do contraente',
    'Filiação da contraente', 'Nome do(a) falecido(a)', 'Outro'];
  const MOTIVOS_RET = {
    semdoc: (s) => `Considerando que ${gx(s, 'o', 'a')} requerente não pôde ser devidamente ${gx(s, 'identificado', 'identificada')}, por não estar ${gx(s, 'munido', 'munida')} de documento oficial de identificação, segue a qualificação das testemunhas, nos termos da legislação aplicável.`,
    rogo: (s, rogo) => `Por não saber ou não poder ${gx(s, 'o', 'a')} requerente assinar, assina a seu rogo ${rogo || '________________________________'}, na presença das testemunhas abaixo qualificadas.`,
    digital: (s) => `Por não saber ${gx(s, 'o', 'a')} requerente assinar, foi colhida sua impressão digital, na presença das testemunhas abaixo qualificadas.`,
    docinvalido: (s) => `Considerando que o documento de identificação apresentado ${gx(s, 'pelo', 'pela')} requerente não está em condições de uso, segue a qualificação das testemunhas, nos termos da legislação aplicável.`,
    outro: () => '',
  };
  const FUNDAMENTOS = {
    97: ['nos termos do artigo 97 da Lei nº 6.015/1973', 'no artigo 97 da Lei nº 6.015/1973'],
    '97e110': ['nos termos dos artigos 97 e 110 da Lei nº 6.015/1973', 'nos artigos 97 e 110 da Lei nº 6.015/1973'],
    110: ['nos termos do artigo 110 da Lei nº 6.015/1973', 'no artigo 110 da Lei nº 6.015/1973'],
  };

  // Caixa de complementação de dados de uma pessoa do assento.
  function blocoComplemento(raiz, k) {
    raiz.insertAdjacentHTML('beforeend', `
      <div class="complemento" data-k="${k}">
        <h3 data-titulo></h3>
        <div class="grade g4">
          <label>Sexo <select data-f="sexo"><option value="" selected>Não incluir</option><option value="M">Masculino</option><option value="F">Feminino</option></select></label>
          <label>Data de nascimento <input type="date" data-f="nascimento"></label>
          <label>Nacionalidade <input data-f="nacionalidade" placeholder="ex.: Brasileira"></label>
          <label>Naturalidade <input data-f="naturalidade" placeholder="ex.: São Paulo/SP"></label>
        </div>
        <div class="grade g2">
          <label>Nome do pai <input data-f="pai"></label>
          <label>Nome da mãe <input data-f="mae"></label>
        </div>
        <div class="grade g4">
          <label>Registrado(a) em (cartório) <input data-f="regCart" placeholder="ex.: São Paulo – 28º Subdistrito – Jardim Paulista – SP"></label>
          <label>Livro A nº <input data-f="regLivro"></label>
          <label>Folha <input data-f="regFolha"></label>
          <label>Termo <input data-f="regTermo"></label>
        </div>
        <label>Constar o nome completo (se for o caso) <input data-f="nomeCompleto"></label>
      </div>`);
    const caixa = raiz.querySelector(`.complemento[data-k="${k}"]`);
    const f = (n) => caixa.querySelector(`[data-f="${n}"]`);
    return {
      caixa,
      titulo(t) { caixa.querySelector('[data-titulo]').textContent = t; },
      ler: () => {
        const o = {}; ['sexo', 'nascimento', 'nacionalidade', 'naturalidade', 'pai', 'mae', 'regCart', 'regLivro', 'regFolha', 'regTermo', 'nomeCompleto'].forEach((n) => { o[n] = limpo(f(n).value); });
        o.pai = up(o.pai); o.mae = up(o.mae); o.nomeCompleto = up(o.nomeCompleto); return o;
      },
    };
  }
  // "Sexo: Feminino; Nome dos genitores: X e Y; Data de nascimento: ...; Nacionalidade: ...; Naturalidade: ..., e registrada em ..., conforme o Lº A-12, fls. 134, T-7712; bem como constar seu nome completo: NOME."
  function textoComplemento(d) {
    const p = [];
    if (d.sexo) p.push(`Sexo: ${d.sexo === 'F' ? 'Feminino' : 'Masculino'}`);
    const gen = [d.pai, d.mae].filter(Boolean);
    if (gen.length) p.push(`Nome ${gen.length > 1 ? 'dos genitores' : 'do genitor'}: ${gen.join(' e ')}`);
    if (d.nascimento) p.push(`Data de nascimento: ${dataBR(d.nascimento)}`);
    if (d.nacionalidade) p.push(`Nacionalidade: ${d.nacionalidade}`);
    let nat = d.naturalidade ? `Naturalidade: ${d.naturalidade}` : '';
    if (d.regCart || d.regLivro) {
      const reg = `${gx(d.sexo, 'registrado', 'registrada')}${d.regCart ? ` em ${d.regCart}` : ''}${d.regLivro ? `, conforme o Lº A-${d.regLivro}${d.regFolha ? `, fls. ${d.regFolha}` : ''}${d.regTermo ? `, T-${d.regTermo}` : ''}` : ''}`;
      nat = nat ? `${nat}, e ${reg}` : reg.charAt(0).toUpperCase() + reg.slice(1);
    }
    if (nat) p.push(nat);
    let s = p.join('; ');
    if (d.nomeCompleto) s += `${s ? '; bem como ' : ''}constar seu nome completo: ${d.nomeCompleto}`;
    return s ? s + '.' : '';
  }

  // Mensagem sobre o representado conforme o motivo (erro = impede gerar).
  function avisoRep(motivo, p) {
    if (motivo !== 'menor') return null;
    const sm = situacaoMenor(p);
    if (sm.i === null) return null;
    if (!sm.menor) return { erro: true, texto: `O(a) representado(a) tem ${sm.i} anos: não é menor de idade. Para maior incapaz, escolha curatela; se for por procuração, escolha "Procurador(a)".` };
    if (sm.emancipado) return { erro: true, texto: 'Menor casado(a) ou que já foi casado(a) não é representado: o casamento faz cessar a incapacidade (Código Civil, art. 5º, parágrafo único, II). Ele(a) mesmo(a) pode requerer – escolha "O próprio registrado".' };
    const extra = sm.convivente ? ' Atenção: a união estável não está entre as hipóteses que fazem cessar a incapacidade do menor no art. 5º, parágrafo único, do Código Civil – confira o estado civil.' : '';
    if (sm.assistido) return { erro: false, texto: `Menor com ${sm.i} anos: de 16 a 18 anos os pais assistem (Código Civil, art. 1.634, VII). O texto sai como "assistente" e o menor também assina.${extra}` };
    return { erro: false, texto: `Menor com ${sm.i} anos: representado(a) pelo pai ou pela mãe (Código Civil, art. 1.634, VII).${extra}` };
  }

  const ret = criarAba({
    nome: 'retificacao', raiz: $('#abaRetificacao'), id: 'ret',
    montar(raiz) {
      raiz.insertAdjacentHTML('beforeend', '<p class="aviso" id="retAvisoNova" hidden>Minuta nova: o requerente mudou, então o tipo de assento, o livro, a folha, o termo e o texto foram zerados.</p>');
      const destino = blocoDestino(raiz, 'retD');
      raiz.insertAdjacentHTML('beforeend', `
        <fieldset><legend>Quem requer</legend>
          <div class="opcoes">
            <label class="opcao"><input type="radio" name="retQuem" value="proprio" checked> O próprio registrado</label>
            <label class="opcao"><input type="radio" name="retQuem" value="representante"> Representante legal (pai/mãe de registrado menor)</label>
            <label class="opcao"><input type="radio" name="retQuem" value="procurador"> Procurador(a)</label>
          </div>
          <div id="retReq"></div>
          <div id="retRepres" hidden>
            <div class="grade g2" id="retRepMotivoBox">
              <label>Motivo da representação <select id="retRepMotivo"><option value="" selected>Selecione</option>
                <option value="menor">Menor de idade (pai ou mãe)</option><option value="tutela">Tutela (tutor/tutora)</option>
                <option value="curatela">Curatela (curador/curadora)</option><option value="outro">Outro (escrever)</option></select></label>
              <label id="retRepGrauLbl" hidden>Quem representa <select id="retRepGrau"><option value="mãe" selected>Mãe</option><option value="pai">Pai</option></select></label>
              <label id="retRepDocLbl" hidden>Termo / processo <input id="retRepDoc" placeholder="ex.: termo de curatela – processo nº 0000000-00.2025.8.26.0126"></label>
              <label id="retRepOutroLbl" hidden>Qualidade (escreva) <input id="retRepOutro" placeholder="ex.: guardiã judicial"></label>
            </div>
            <p class="aviso" id="retRepAviso" hidden></p>
            <label id="retProcLbl">Procuração (onde e quando foi feita) <input id="retProcTxt" placeholder="ex.: lavrada no 1º Tabelião de Notas de X, livro 10, fls. 20, em 01/02/2026"></label>
            <div id="retRepQual"></div>
          </div>
        </fieldset>
        <fieldset><legend>Modelo</legend>
          <div class="opcoes">
            <label class="opcao"><input type="radio" name="retModelo" value="simples" checked> Requerente com documento</label>
            <label class="opcao"><input type="radio" name="retModelo" value="testemunhas"> Com testemunhas</label>
          </div>
          <div id="retTest" hidden>
            <label>Motivo das testemunhas <select id="retMotivoTipo">
              <option value="semdoc" selected>Requerente sem documento de identificação</option>
              <option value="rogo">Requerente não sabe ou não pode assinar (a rogo)</option>
              <option value="digital">Requerente não sabe assinar (impressão digital)</option>
              <option value="docinvalido">Documento sem condições de uso</option>
              <option value="outro">Outro (escrever)</option></select></label>
            <label id="retRogoLbl" hidden>Nome de quem assina a rogo (opcional) <input id="retRogo"></label>
            <label>Texto do motivo (pode editar) <textarea id="retMotivo" rows="3"></textarea></label>
            <div id="retT1"></div><div id="retT2"></div>
          </div>
        </fieldset>
        <fieldset><legend>Assento a retificar</legend>
          <div class="grade g4">
            <label>Tipo de assento <select id="retTipo"><option value="" selected>Selecione</option>
              ${ASSENTOS.map((a) => `<option value="${a[0]}">${a[1]}</option>`).join('')}</select></label>
            <label>Livro <select id="retLivroLetra">${LIVROS.map((l) => `<option>${l}</option>`).join('')}</select></label>
            <label>Livro nº <input id="retLivro" inputmode="numeric"></label>
            <label>Folha <input id="retFolha" inputmode="numeric"></label>
          </div>
          <div class="grade g4">
            <label>Termo nº <input id="retTermo" inputmode="numeric"></label>
            <label id="retN1Lbl">Nome do(a) registrado(a) <input id="retN1"></label>
            <label id="retN2Lbl" hidden>Nome do 2º contraente <input id="retN2"></label>
            <span></span>
          </div>
        </fieldset>
        <fieldset><legend>O que retificar</legend>
          <label class="opcao"><input type="checkbox" id="retUsaComp"> Complementação de dados (incluir dados que não constam)</label>
          <div id="retComp" hidden></div>
          <label class="opcao" style="margin-top:8px"><input type="checkbox" id="retUsaCorr" checked> Correção (onde consta / deve constar)</label>
          <div id="retCorrBox">
            <div id="retCorrecoes"></div>
            <button type="button" class="sec mini" id="retAdd">+ adicionar correção</button>
          </div>
          <div class="grade g2" style="margin-top:12px">
            <label>Fundamento <select id="retFundTipo">
              <option value="97">art. 97 da Lei nº 6.015/1973</option>
              <option value="97e110" selected>arts. 97 e 110 da Lei nº 6.015/1973</option>
              <option value="110">art. 110 da Lei nº 6.015/1973</option></select></label>
            <label class="opcao" style="align-self:end"><input type="checkbox" id="retIsento"> Erro imputável ao cartório – sai "ISENTO"</label>
          </div>
        </fieldset>`);
      const req = blocoPessoa($('#retReq'), 'retR', { titulo: 'Qualificação de quem assina o requerimento' });
      const repr = blocoPessoa($('#retRepQual'), 'retRp', { titulo: 'Qualificação do(a) representado(a) / outorgante (em nome de quem se pede)' });
      const t1 = blocoPessoa($('#retT1'), 'retT1', { titulo: 'Testemunha 1', completo: false });
      const t2 = blocoPessoa($('#retT2'), 'retT2', { titulo: 'Testemunha 2', completo: false });
      const comp = [blocoComplemento($('#retComp'), 1), blocoComplemento($('#retComp'), 2)];
      const texto = blocoTexto(raiz, 'retTexto', 'II – Requerimento: texto que vai sair no documento (pode editar)');
      const fech = blocoFechamento(raiz, 'retF');
      // linhas de correção
      const caixa = $('#retCorrecoes');
      function addLinha() {
        const d = document.createElement('div');
        d.className = 'correcao';
        d.innerHTML = `<div class="grade g-corr">
          <label>Campo <select data-k="campo">${CAMPOS_RET.map((c) => `<option>${c}</option>`).join('')}</select></label>
          <label>Onde consta <input data-k="consta"></label>
          <label>Deve constar <input data-k="deve"></label>
          <button type="button" class="remover" title="Remover esta correção" aria-label="Remover">×</button></div>
          <label class="outro-campo" hidden>Qual campo? <input data-k="outro"></label>`;
        caixa.appendChild(d);
        const sel = d.querySelector('[data-k=campo]');
        sel.addEventListener('change', () => { d.querySelector('.outro-campo').hidden = sel.value !== 'Outro'; });
        d.querySelector('.remover').addEventListener('click', () => { if (caixa.children.length > 1) d.remove(); });
      }
      addLinha();
      $('#retAdd').addEventListener('click', addLinha);
      const quem = () => raiz.querySelector('[name=retQuem]:checked').value;
      raiz.querySelectorAll('[name=retQuem]').forEach((r) => r.addEventListener('change', () => {
        $('#retRepres').hidden = quem() === 'proprio';
        $('#retProcLbl').hidden = quem() !== 'procurador';
        $('#retRepMotivoBox').hidden = quem() !== 'representante';
        checarRep();
      }));
      // Confere idade e estado civil do representado conforme o motivo.
      function checarRep() {
        const m = $('#retRepMotivo').value, av = $('#retRepAviso');
        $('#retRepGrauLbl').hidden = m !== 'menor';
        $('#retRepDocLbl').hidden = !['tutela', 'curatela'].includes(m);
        $('#retRepOutroLbl').hidden = m !== 'outro';
        const msg = quem() === 'representante' ? avisoRep(m, repr.ler()) : null;
        av.hidden = !msg; if (msg) { av.textContent = msg.texto; av.className = msg.erro ? 'erros' : 'aviso'; }
      }
      $('#retRepMotivo').addEventListener('change', checarRep);
      [repr.el('nascimento'), repr.el('estadoCivil')].forEach((x) => x.addEventListener('change', checarRep));
      const modelo = () => raiz.querySelector('[name=retModelo]:checked').value;
      let motivoEditado = false;
      function motivo(forcar) {
        const t = $('#retMotivoTipo').value;
        $('#retRogoLbl').hidden = t !== 'rogo';
        if (forcar || !motivoEditado) { $('#retMotivo').value = MOTIVOS_RET[t](req.ler().sexo, up(limpo($('#retRogo').value))); motivoEditado = false; }
      }
      raiz.querySelectorAll('[name=retModelo]').forEach((r) => r.addEventListener('change', () => { $('#retTest').hidden = modelo() !== 'testemunhas'; motivo(false); }));
      $('#retMotivoTipo').addEventListener('change', () => motivo(true));
      $('#retRogo').addEventListener('input', () => motivo(false));
      req.el('sexo').addEventListener('change', () => motivo(false));
      $('#retMotivo').addEventListener('input', () => { motivoEditado = true; });
      motivo(true);
      function ajustarTipo() {
        const t = $('#retTipo').value, cas = t.startsWith('B');
        $('#retN1Lbl').firstChild.textContent = cas ? 'Nome do 1º contraente ' : t.startsWith('C') ? 'Nome do(a) falecido(a) ' : 'Nome do(a) registrado(a) ';
        $('#retN2Lbl').hidden = !cas;
        const a = ASSENTOS.find((x) => x[0] === t); if (a) $('#retLivroLetra').value = a[3];
        comp[1].caixa.hidden = !cas;
        comp[0].titulo(cas ? 'Dados complementares do(a) 1º contraente' : t.startsWith('C') ? 'Dados complementares do(a) falecido(a)' : 'Dados complementares do(a) registrado(a)');
        comp[1].titulo('Dados complementares do(a) 2º contraente');
      }
      $('#retTipo').addEventListener('change', ajustarTipo);
      ajustarTipo();
      $('#retUsaComp').addEventListener('change', () => { $('#retComp').hidden = !$('#retUsaComp').checked; });
      $('#retUsaCorr').addEventListener('change', () => { $('#retCorrBox').hidden = !$('#retUsaCorr').checked; });
      return { destino, req, repr, t1, t2, comp, fech, texto, checarRep, quem, modelo, addLinha, caixa, motivo, ajustarTipo, campoChave: req.el('nome'), resetMotivo: () => { motivoEditado = false; } };
    },
    textoAuto(ctx) {
      const tipo = $('#retTipo').value;
      const a = ASSENTOS.find((x) => x[0] === tipo);
      const assento = a ? a[2] : '[TIPO DE ASSENTO]';
      const n1 = up(limpo($('#retN1').value)) || '[NOME]', n2 = up(limpo($('#retN2').value)) || '[NOME]';
      const nomes = tipo.startsWith('B') ? `${n1} e ${n2}` : n1;
      const livro = `Livro ${$('#retLivroLetra').value}-${limpo($('#retLivro').value) || '__'}, fls. ${limpo($('#retFolha').value) || '__'}, termo nº ${limpo($('#retTermo').value) || '__'}`;
      const fund = FUNDAMENTOS[$('#retFundTipo').value][0];
      const linhas = [`Venho, através deste, requerer a retificação, ${fund}, do assento de ${assento} de ${nomes}, para constar:`];
      if ($('#retUsaComp').checked) {
        const quantos = tipo.startsWith('B') ? 2 : 1;
        for (let i = 0; i < quantos; i++) {
          const d = ctx.comp[i].ler(), t = textoComplemento(d);
          if (!t) continue;
          const s = d.sexo;
          const quemE = tipo.startsWith('B') ? `${i === 0 ? gx(s, 'do primeiro', 'da primeira') : gx(s, 'do segundo', 'da segunda')} ${gx(s, 'contraente', 'contraente')}`
            : tipo.startsWith('C') ? gx(s, 'do falecido', 'da falecida') : gx(s, 'do registrado', 'da registrada');
          linhas.push(`Os dados complementares ${quemE}:`);
          linhas.push(`\t${t}`);
        }
      }
      if ($('#retUsaCorr').checked) {
        const corr = [...ctx.caixa.children].map((d) => {
          const g = (k) => d.querySelector(`[data-k=${k}]`);
          return { campo: g('campo').value === 'Outro' ? limpo(g('outro').value) : g('campo').value, consta: up(limpo(g('consta').value)), deve: up(limpo(g('deve').value)) };
        }).filter((c) => c.consta || c.deve);
        if (corr.length) {
          linhas.push(corr.length > 1 ? 'As seguintes correções:' : 'A seguinte correção:');
          corr.forEach((c, i) => linhas.push(`\t${c.campo || '[campo]'}: onde consta “${c.consta || '___'}”, deve constar “${c.deve || '___'}”${i === corr.length - 1 ? '.' : ';'}`));
        }
      }
      linhas.push('Tudo conforme cópias comprobatórias em anexo.');
      linhas.push(`Diante do exposto, requer que seja feita a retificação junto ao termo de ${assento} lavrado no ${livro}. Certifico ainda que os documentos em anexo conferem com o original.`);
      return linhas.join('\n');
    },
    camposZerar: () => [$('#retTipo'), $('#retLivro'), $('#retFolha'), $('#retTermo')],
    limparExtra(ctx) {
      ctx.destino.limpar(); ctx.req.limpar(); ctx.repr.limpar(); ctx.t1.limpar(); ctx.t2.limpar(); ctx.fech.reiniciarData();
      ctx.caixa.innerHTML = ''; ctx.addLinha();
      $('#retRepres').hidden = true; $('#retTest').hidden = true; $('#retComp').hidden = true; $('#retCorrBox').hidden = false;
      ctx.ajustarTipo(); ctx.resetMotivo(); ctx.motivo(true);
    },
    gerar(ctx, erros) {
      const dest = ctx.destino.texto();
      if (!dest) { erros.push('Cartório de destino'); ctx.destino.el.classList.add('invalido'); }
      const q = ctx.quem(), comTest = ctx.modelo() === 'testemunhas';
      ctx.req.validar(erros, 'Requerente', ['nome', 'sexo', 'nacionalidade', 'estadoCivil', 'logradouro', 'numero'].concat(comTest ? [] : ['cpf']));
      if (q !== 'proprio') ctx.repr.validar(erros, 'Representado(a)', ['nome', 'sexo', 'nacionalidade', 'estadoCivil', 'nascimento', 'logradouro', 'numero']);
      if (q === 'representante') {
        const m = $('#retRepMotivo').value;
        if (!m) { erros.push('Motivo da representação'); $('#retRepMotivo').classList.add('invalido'); }
        if (m === 'outro' && !limpo($('#retRepOutro').value)) { erros.push('Qualidade de quem representa'); $('#retRepOutro').classList.add('invalido'); }
        const a = avisoRep(m, ctx.repr.ler());
        if (a && a.erro) erros.push(a.texto);
      }
      [['#retTipo', 'Tipo de assento'], ['#retLivro', 'Livro nº'], ['#retFolha', 'Folha'], ['#retTermo', 'Termo nº'], ['#retN1', 'Nome que consta no registro']].forEach(([s, r]) => {
        if (!limpo($(s).value)) { erros.push(r); $(s).classList.add('invalido'); }
      });
      const tipo = $('#retTipo').value;
      if (tipo.startsWith('B') && !limpo($('#retN2').value)) { erros.push('Nome do 2º contraente'); $('#retN2').classList.add('invalido'); }
      if (!$('#retUsaComp').checked && !$('#retUsaCorr').checked) erros.push('Escolha o que retificar: complementação de dados e/ou correção');
      const texto = ctx.texto.ler();
      if (!limpo(texto)) { erros.push('Texto do requerimento'); ctx.texto.ta.classList.add('invalido'); }
      if (/\[(NOME|TIPO DE ASSENTO|campo)\]|“___”|-__,|fls\. __/.test(texto)) erros.push('O texto do requerimento ainda tem partes em branco (___ ou [ ]): preencha os campos ou corrija o texto');
      if (comTest) {
        ctx.t1.validar(erros, 'Testemunha 1', ['nome', 'cpf', 'logradouro', 'numero']);
        ctx.t2.validar(erros, 'Testemunha 2', ['nome', 'cpf', 'logradouro', 'numero']);
        if (!limpo($('#retMotivo').value)) { erros.push('Texto do motivo das testemunhas'); $('#retMotivo').classList.add('invalido'); }
      }
      ctx.fech.validar(erros);
      if (erros.length) return null;

      const r = ctx.req.ler(), f = ctx.fech.ler(), s = r.sexo;
      const rp = ctx.repr.ler();
      let qualidade = '';
      const sm = situacaoMenor(rp), motivoRep = $('#retRepMotivo').value, grau = $('#retRepGrau').value;
      const docRep = limpo($('#retRepDoc').value), outroRep = limpo($('#retRepOutro').value);
      const cap = (x) => x.charAt(0).toUpperCase() + x.slice(1);
      let rotuloAss = '';
      if (q === 'representante') {
        if (motivoRep === 'menor') {
          const papel = sm.assistido ? 'assistente' : 'representante legal';
          qualidade = `, na qualidade de ${grau} e ${papel} de ${rp.nome}, menor de idade, ${qualificacao(rp)}`;
          rotuloAss = `${cap(grau)} e ${papel} de ${rp.nome}`;
        } else if (motivoRep === 'tutela' || motivoRep === 'curatela') {
          const papel = motivoRep === 'tutela' ? gx(s, 'tutor', 'tutora') : gx(s, 'curador', 'curadora');
          qualidade = `, na qualidade de ${papel} de ${rp.nome}, ${qualificacao(rp)}${docRep ? `, conforme ${docRep}` : ''}`;
          rotuloAss = `${cap(papel)} de ${rp.nome}`;
        } else {
          qualidade = `, na qualidade de ${outroRep} de ${rp.nome}, ${qualificacao(rp)}`;
          rotuloAss = `${cap(outroRep)} de ${rp.nome}`;
        }
      }
      if (q === 'procurador') qualidade = `, na qualidade de ${gx(s, 'procurador', 'procuradora')} de ${rp.nome}, ${qualificacao(rp)}${limpo($('#retProcTxt').value) ? `, conforme procuração ${limpo($('#retProcTxt').value)}` : ''}`;
      const blocos = [
        enderecamento(dest),
        titulo('I – REQUERENTE:'),
        { p: [`${r.nome}, ${qualificacao(r)}${qualidade}.`], ind: RECUO },
        titulo('II – REQUERIMENTO:'),
        ...paragrafosDe(texto),
      ];
      let n = 'III';
      const nomesT = [];
      if (comTest) {
        const [a, b] = [ctx.t1.ler(), ctx.t2.ler()];
        nomesT.push(a.nome, b.nome);
        blocos.push(titulo('III – TESTEMUNHAS:'), { p: [limpo($('#retMotivo').value)], ind: RECUO, tam: 10 });
        [a, b].forEach((t) => blocos.push({ p: [`${t.nome}, ${qualificacao(t, { completo: false })}.`], ind: RECUO, tam: 10, depois: 3 }));
        n = 'IV';
      }
      blocos.push(titulo(`${n} – FUNDAMENTO JURÍDICO:`), { p: [`O presente requerimento está fundamentado ${FUNDAMENTOS[$('#retFundTipo').value][1]}.`], ind: RECUO });
      blocos.push({ p: ['Termos em que, pede deferimento.'], ind: RECUO, antes: 4 });
      if ($('#retIsento').checked) blocos.push({ p: [R('ISENTO', true), ' – erro imputável ao cartório (art. 110, § 5º, da Lei nº 6.015/1973).'], tam: 10, antes: 4 });
      const linhaQual = q === 'representante' ? [[rotuloAss]] : q === 'procurador' ? [[`${gx(s, 'Procurador', 'Procuradora')} de ${rp.nome}`]] : [];
      const assin = [assinaturaCentro(r.nome, linhaQual)];
      // De 16 a 18 anos o menor é assistido: ele também assina.
      if (q === 'representante' && motivoRep === 'menor' && sm.assistido) assin.push(assinaturaCentro(rp.nome, [[gx(rp.sexo, 'Menor assistido', 'Menor assistida')]]));
      if (comTest) {
        const [a, b] = [ctx.t1.ler(), ctx.t2.ler()];
        assin.push({ lado: [{ nome: [R('TESTEMUNHA 1: ', true), R(a.nome, true)], linhas: [[`CPF: ${a.cpf}`]], larg: 215 }, { nome: [R('TESTEMUNHA 2: ', true), R(b.nome, true)], linhas: [[`CPF: ${b.cpf}`]], larg: 215 }] });
      }
      const comps = ctx.comp.map((c) => c.ler());
      return {
        titulo: 'Requerimento de retificação', arquivo: nomeArquivo('retificacao', r.nome), chave: r.nome,
        nomes: [r.nome, r.pai, r.mae, rp.nome, rp.pai, rp.mae, up(limpo($('#retN1').value)), up(limpo($('#retN2').value)), ...nomesT,
          ...comps.flatMap((c) => [c.pai, c.mae, c.nomeCompleto])],
        blocos: blocos.concat(fechamentoBlocos(f, assin)),
      };
    },
  });

  // =====================================================================
  // 2) ALTERAÇÃO DE PRENOME (art. 56) – seções I a IV
  // =====================================================================
  const pre = criarAba({
    nome: 'prenome', raiz: $('#abaPrenome'), id: 'pre',
    montar(raiz) {
      raiz.insertAdjacentHTML('beforeend', `
        <p class="aviso">Só para maiores de 18 anos, e o pedido é sempre pessoal (sem representante ou procurador). A alteração imotivada de prenome pela via extrajudicial só pode ser feita uma vez (art. 56, § 1º, da Lei nº 6.015/1973).</p>
        <p class="aviso" id="preAvisoNova" hidden>Minuta nova: o requerente mudou, então o livro, a folha, o termo e o texto foram zerados.</p>
        <p class="erros" id="preMenor" hidden></p>`);
      const destino = blocoDestino(raiz, 'preD');
      raiz.insertAdjacentHTML('beforeend', '<fieldset><legend>Requerente</legend><div id="preReq"></div></fieldset>');
      const req = blocoPessoa($('#preReq'), 'preR', {});
      raiz.insertAdjacentHTML('beforeend', `
        <fieldset><legend>Registro de nascimento</legend>
          <div class="grade g4">
            <label>Livro A nº <input id="preLivro" inputmode="numeric"></label>
            <label>Folha <input id="preFolha" inputmode="numeric"></label>
            <label>Termo nº <input id="preTermo" inputmode="numeric"></label>
            <span></span>
          </div>
        </fieldset>
        <fieldset><legend>Novo prenome</legend>
          <div class="grade g2">
            <label>Prenome atual <input id="prePrenAtual" placeholder="ex.: MARIA APARECIDA"></label>
            <label>Prenome pretendido <input id="prePrenNovo"></label>
          </div>
          <label>Nome completo que passará a usar (pode corrigir) <input id="preNomeNovo"></label>
          <p class="dica">O site troca só o prenome e mantém os sobrenomes do nome atual.</p>
        </fieldset>
        <fieldset><legend>Documentos (constam da averbação)</legend>
          <div class="grade g-doc">
            <label>ICN (Identificação Civil Nacional) <select id="preIcn"><option value="nao" selected>Não possui</option><option value="sim">Possui</option></select></label>
            <label>Nº da ICN <input id="preIcnN"></label>
            <label>RG de outro estado <select id="preRgUf"><option value="nao" selected>Não possui</option><option value="sim">Possui</option></select></label>
            <label>Nº e UF desse RG <input id="preRgUfN" placeholder="ex.: 1234567 SSP/MG"></label>
            <label>Passaporte <select id="prePass"><option value="nao" selected>Não possui</option><option value="sim">Possui</option></select></label>
            <label>Nº do passaporte <input id="prePassN"></label>
            <label>Título de eleitor nº <input id="preTitulo" inputmode="numeric"></label>
          </div>
          <label class="opcao"><input type="checkbox" id="preDocsOrig" checked> Na certificação, incluir "Certifico ainda que todos os documentos anexados foram extraídos dos originais."</label>
        </fieldset>`);
      const texto = blocoTexto(raiz, 'preTexto', 'II – Requerimento: texto que vai sair no documento (pode editar)');
      const fech = blocoFechamento(raiz, 'preF');
      let nomeEditado = false;
      function sugerir() {
        if (nomeEditado) return;
        const atual = up(limpo(req.el('nome').value)), pa = up(limpo($('#prePrenAtual').value)), pn = up(limpo($('#prePrenNovo').value));
        if (!pn) { $('#preNomeNovo').value = ''; return; }
        const sobren = pa && atual.startsWith(pa + ' ') ? atual.slice(pa.length + 1) : atual.split(' ').slice(1).join(' ');
        $('#preNomeNovo').value = limpo(`${pn} ${sobren}`);
      }
      [req.el('nome'), $('#prePrenAtual'), $('#prePrenNovo')].forEach((e) => e.addEventListener('input', sugerir));
      req.el('nome').addEventListener('change', () => {
        if (!limpo($('#prePrenAtual').value)) $('#prePrenAtual').value = up(limpo(req.el('nome').value)).split(' ')[0] || '';
      });
      $('#preNomeNovo').addEventListener('input', () => { nomeEditado = true; });
      req.el('nascimento').addEventListener('change', () => {
        const i = idade(req.el('nascimento').value);
        const m = $('#preMenor');
        if (i !== null && i < 18) { m.textContent = `O requerente tem ${i} anos. A alteração de prenome pelo art. 56 só pode ser pedida depois de atingida a maioridade civil.`; m.hidden = false; } else m.hidden = true;
      });
      [['#preIcn', '#preIcnN'], ['#preRgUf', '#preRgUfN'], ['#prePass', '#prePassN']].forEach(([s, n]) => {
        const sync = () => { $(n).disabled = $(s).value !== 'sim'; if ($(n).disabled) $(n).value = ''; };
        $(s).addEventListener('change', sync); sync();
      });
      return { destino, req, fech, texto, campoChave: req.el('nome'), resetNome: () => { nomeEditado = false; } };
    },
    textoAuto(ctx) {
      const r = ctx.req.ler(), g = (m, f) => gx(r.sexo, m, f);
      return `Com fulcro no disposto pelo artigo 56 da Lei nº 6.015/1973, ${g('o', 'a')} requerente acima ${g('indicado', 'indicada')}, ${g('registrado', 'registrada')} conforme o Livro A-${limpo($('#preLivro').value) || '__'}, fls. ${limpo($('#preFolha').value) || '__'}, termo nº ${limpo($('#preTermo').value) || '__'}, vem, respeitosamente, requerer a V. Sa. a instauração de procedimento para alteração de prenome, substituindo o prenome ${up(limpo($('#prePrenAtual').value)) || '[PRENOME ATUAL]'} por ${up(limpo($('#prePrenNovo').value)) || '[PRENOME NOVO]'}, de modo que passe a ser ${g('identificado', 'identificada')} como: ${up(limpo($('#preNomeNovo').value)) || '[NOME NOVO]'}.`;
    },
    camposZerar: () => [$('#preLivro'), $('#preFolha'), $('#preTermo')],
    limparExtra(ctx) {
      ctx.destino.limpar(); ctx.req.limpar(); ctx.fech.reiniciarData(); ctx.resetNome();
      $('#preMenor').hidden = true;
      ['#preIcnN', '#preRgUfN', '#prePassN'].forEach((s) => { $(s).disabled = true; });
    },
    gerar(ctx, erros) {
      const dest = ctx.destino.texto();
      if (!dest) { erros.push('Cartório de destino'); ctx.destino.el.classList.add('invalido'); }
      ctx.req.validar(erros, 'Requerente', ['nome', 'sexo', 'nacionalidade', 'estadoCivil', 'profissao', 'rg', 'cpf', 'nascimento', 'naturalidade', 'logradouro', 'numero']);
      const r = ctx.req.ler();
      if (!r.pai && !r.mae) { erros.push('Requerente: filiação (pai e/ou mãe)'); ctx.req.el('mae').classList.add('invalido'); }
      const i = idade(r.nascimento);
      if (i !== null && i < 18) erros.push(`Requerente com ${i} anos: a alteração de prenome (art. 56) só é possível para maiores de 18 anos`);
      [['#preLivro', 'Livro nº'], ['#preFolha', 'Folha'], ['#preTermo', 'Termo nº'], ['#prePrenAtual', 'Prenome atual'], ['#prePrenNovo', 'Prenome pretendido'], ['#preNomeNovo', 'Nome completo que passará a usar']].forEach(([s, rt]) => {
        if (!limpo($(s).value)) { erros.push(rt); $(s).classList.add('invalido'); }
      });
      [['#preIcn', '#preIcnN', 'Nº da ICN'], ['#preRgUf', '#preRgUfN', 'Nº e UF do RG de outro estado'], ['#prePass', '#prePassN', 'Nº do passaporte']].forEach(([s, n, rt]) => {
        if ($(s).value === 'sim' && !limpo($(n).value)) { erros.push(rt); $(n).classList.add('invalido'); }
      });
      const texto = ctx.texto.ler();
      if (!limpo(texto)) { erros.push('Texto do requerimento'); ctx.texto.ta.classList.add('invalido'); }
      if (/\[[A-Z ]+\]|-__,|fls\. __/.test(texto)) erros.push('O texto do requerimento ainda tem partes em branco: preencha os campos ou corrija o texto');
      ctx.fech.validar(erros);
      if (erros.length) return null;
      const f = ctx.fech.ler(), g = (m, fe) => gx(r.sexo, m, fe);
      const docs = [
        $('#preIcn').value === 'sim' ? `possui Identificação Civil Nacional (ICN) nº ${limpo($('#preIcnN').value)}` : 'não possui Identificação Civil Nacional (ICN)',
        $('#preRgUf').value === 'sim' ? `possui cédula de identidade RG emitida em outra unidade da Federação, nº ${limpo($('#preRgUfN').value)}` : 'não possui cédula de identidade RG emitida em outra unidade da Federação',
        $('#prePass').value === 'sim' ? `possui passaporte nº ${limpo($('#prePassN').value)}` : 'não possui passaporte',
      ];
      const titEl = limpo($('#preTitulo').value);
      const blocos = [
        enderecamento(dest),
        titulo('I – REQUERENTE:'),
        { p: [`${r.nome}, ${qualificacao(r)}.`], ind: RECUO },
        titulo('II – REQUERIMENTO:'),
        ...paragrafosDe(texto),
        titulo('III – DECLARAÇÕES SOB AS PENAS DA LEI:'),
        { p: [`${g('O', 'A')} requerente declara que:`], ind: RECUO, depois: 2 },
        { p: ['a) a alteração ora requerida está de acordo com seu nome atual e que responde civil e criminalmente pela veracidade desta afirmação. Declara, ainda, que não é parte em ação judicial em trâmite sobre alteração de prenome ou, em caso de ação judicial com o referido escopo, que a mesma já foi devidamente arquivada, conforme certidão anexa;'], esqBloco: 40, depois: 2 },
        { p: [`b) ${docs.join('; ')}${titEl ? `; e seu título de eleitor é o de nº ${titEl}` : ''};`], esqBloco: 40, depois: 2 },
        { p: ['c) está ciente de que não será admitida outra alteração de prenome por este procedimento diretamente perante Oficial de Registro Civil das Pessoas Naturais, resguardada a via judicial;'], esqBloco: 40, depois: 2 },
        { p: ['d) está ciente de que deverá promover a alteração nos demais registros que lhe digam respeito, direta ou indiretamente, e nos respectivos documentos de identificação.'], esqBloco: 40 },
        titulo('IV – FUNDAMENTO JURÍDICO:'),
        { p: ['O presente requerimento está fundamentado no artigo 56 da Lei nº 6.015/1973.'], ind: RECUO },
        { p: ['Por ser verdade, firmo o presente termo.'], ind: RECUO, antes: 4 },
      ];
      return {
        titulo: 'Requerimento de alteração de prenome', arquivo: nomeArquivo('alteracao-prenome', r.nome), chave: r.nome,
        nomes: [r.nome, r.pai, r.mae, up(limpo($('#prePrenAtual').value)), up(limpo($('#prePrenNovo').value)), up(limpo($('#preNomeNovo').value))],
        blocos: blocos.concat(fechamentoBlocos(f, [assinaturaCentro(r.nome)], { docsOriginais: $('#preDocsOrig').checked })),
      };
    },
  });

  // =====================================================================
  // 3) ALTERAÇÃO DE SOBRENOME (art. 57) – seções I a IV
  // =====================================================================
  const HIPOTESES = {
    I: { rot: 'I – inclusão de sobrenome familiar', inciso: 'inciso I' },
    II: { rot: 'II – inclusão ou exclusão de sobrenome do cônjuge (casamento em vigor)', inciso: 'inciso II' },
    III: { rot: 'III – exclusão de sobrenome do ex-cônjuge (após a dissolução)', inciso: 'inciso III' },
    IV: { rot: 'IV – alteração das relações de filiação', inciso: 'inciso IV' },
    UE: { rot: '§ 2º – união estável registrada (inclusão ou exclusão do sobrenome do companheiro)', inciso: '§ 2º' },
  };
  const sob = criarAba({
    nome: 'sobrenome', raiz: $('#abaSobrenome'), id: 'sob',
    montar(raiz) {
      raiz.insertAdjacentHTML('beforeend', `
        <p class="aviso">As certidões apresentadas devem ter sido expedidas há no máximo 90 dias (art. 515-I, § 3º, do Código Nacional de Normas – Prov. CNJ 149/2023).</p>
        <p class="aviso" id="sobAvisoNova" hidden>Minuta nova: o requerente mudou, então o livro, a folha, o termo e o texto foram zerados.</p>`);
      const destino = blocoDestino(raiz, 'sobD');
      raiz.insertAdjacentHTML('beforeend', `
        <fieldset><legend>Hipótese</legend>
          <label>Hipótese do art. 57 <select id="sobHip"><option value="" selected>Selecione</option>
            ${Object.entries(HIPOTESES).map(([k, h]) => `<option value="${k}">${h.rot}</option>`).join('')}</select></label>
          <p class="dica" id="sobHipDica"></p>
        </fieldset>
        <fieldset><legend>Requerente</legend><div id="sobReq"></div>
          <p class="aviso" id="sobMenorAviso" hidden></p>
          <div id="sobMenorBox" hidden>
            <label>Quem representa <select id="sobRepQual"><option value="pai">Pai</option><option value="mae" selected>Mãe</option></select></label>
            <div id="sobRep"></div>
          </div>
          <div id="sobProcBox">
            <label class="opcao"><input type="checkbox" id="sobProc"> Requerente representado(a) por procurador(a) (escritura pública)</label>
            <div id="sobProcCampos" hidden>
              <div class="grade g2">
                <label>Nome do(a) procurador(a) <input id="sobProcNome"></label>
                <label>CPF do(a) procurador(a) <input id="sobProcCpf" inputmode="numeric" maxlength="14"></label>
              </div>
              <div class="grade g4">
                <label>Tabelionato <input id="sobProcTab" placeholder="ex.: 1º Tabelião de Notas de X"></label>
                <label>Livro <input id="sobProcLivro"></label>
                <label>Folhas <input id="sobProcFls"></label>
                <label>Data da escritura <input type="date" id="sobProcData"></label>
              </div>
              <p class="erros" id="sobProcVelha" hidden></p>
            </div>
          </div>
        </fieldset>
        <fieldset id="sobCasBox" hidden><legend id="sobCasLeg">Casamento</legend>
          <div class="grade g2">
            <label id="sobConjLbl">Nome do cônjuge <input id="sobConj"></label>
            <label>Local (cidade/UF) <input id="sobCasLocal"></label>
          </div>
          <div class="grade g4">
            <label>Data <input type="date" id="sobCasData"></label>
            <label id="sobCasLivroLbl">Livro B nº <input id="sobCasLivro"></label>
            <label>Folha <input id="sobCasFolha"></label>
            <label>Termo nº <input id="sobCasTermo"></label>
          </div>
          <label id="sobDissLbl" hidden>Forma da dissolução <select id="sobDiss">
            <option value="divórcio" selected>Divórcio</option><option value="falecimento do cônjuge">Falecimento do cônjuge (viuvez)</option>
            <option value="separação judicial">Separação judicial</option><option value="anulação do casamento">Anulação do casamento</option></select></label>
        </fieldset>
        <fieldset id="sobNascBox" hidden><legend>Registro de nascimento do(a) requerente</legend>
          <div class="grade g4">
            <label>Livro A nº <input id="sobNascLivro"></label>
            <label>Folha <input id="sobNascFolha"></label>
            <label>Termo nº <input id="sobNascTermo"></label>
            <span></span>
          </div>
          <label id="sobOrigemLbl">Origem do sobrenome / motivo (opcional) <input id="sobOrigem" placeholder="ex.: sobrenome da avó materna / reconhecimento de paternidade averbado em 2026"></label>
        </fieldset>
        <fieldset><legend>Alteração</legend>
          <div class="grade g2">
            <label>Incluir ou excluir <select id="sobOp"><option value="" selected>Selecione</option><option value="incluir">Incluir</option><option value="excluir">Excluir</option></select></label>
            <label>Sobrenome(s) a incluir/excluir <input id="sobSob"></label>
          </div>
          <label class="opcao" id="sobSolteiroLbl" hidden><input type="checkbox" id="sobSolteiro"> Voltar a usar o nome de solteiro(a)</label>
          <label>Nome completo que passará a usar (pode corrigir) <input id="sobNomeNovo"></label>
          <p class="aviso" id="sobAvisoAsc" hidden>Atenção: na inclusão do sobrenome do cônjuge, deve permanecer ao menos um sobrenome que ligue a pessoa a uma de suas linhas de ascendência (art. 515-L, § 1º, do Código Nacional de Normas).</p>
        </fieldset>`);
      const req = blocoPessoa($('#sobReq'), 'sobR', {});
      const rep = blocoPessoa($('#sobRep'), 'sobP', { titulo: 'Qualificação do(a) representante', completo: false });
      const texto = blocoTexto(raiz, 'sobTexto', 'II – Requerimento: texto que vai sair no documento (pode editar)');
      const fech = blocoFechamento(raiz, 'sobF');
      const hip = () => $('#sobHip').value;
      function atualizar() {
        const h = hip();
        const cas = ['II', 'III', 'UE'].includes(h);
        $('#sobCasBox').hidden = !cas;
        $('#sobNascBox').hidden = !['I', 'IV'].includes(h);
        $('#sobDissLbl').hidden = h !== 'III';
        $('#sobCasLeg').textContent = h === 'UE' ? 'União estável (registro no Livro E)' : h === 'III' ? 'Casamento dissolvido' : 'Casamento';
        $('#sobConjLbl').firstChild.textContent = h === 'UE' ? 'Nome do(a) companheiro(a) ' : h === 'III' ? 'Nome do(a) ex-cônjuge ' : 'Nome do cônjuge ';
        $('#sobCasLivroLbl').firstChild.textContent = h === 'UE' ? 'Livro E nº ' : 'Livro B nº ';
        $('#sobOrigemLbl').firstChild.textContent = h === 'IV' ? 'Alteração de filiação que motiva o pedido ' : 'Origem do sobrenome (opcional) ';
        if (h === 'I') $('#sobOp').value = 'incluir';
        if (h === 'III') $('#sobOp').value = 'excluir';
        $('#sobOp').disabled = h === 'I' || h === 'III';
        $('#sobSolteiroLbl').hidden = !(['II', 'III', 'UE'].includes(h) && $('#sobOp').value === 'excluir');
        $('#sobHipDica').textContent = h === 'II' ? 'A inclusão ou exclusão do sobrenome do cônjuge independe da anuência dele (art. 515-L do Código Nacional de Normas).' : '';
        sugerir(); verificarAsc();
      }
      let nomeEditado = false;
      function sugerir() {
        if (nomeEditado) return;
        const atual = up(limpo(req.el('nome').value)), s = up(limpo($('#sobSob').value)), op = $('#sobOp').value;
        if (!atual || !s || !op) { $('#sobNomeNovo').value = ''; return; }
        if (op === 'incluir') $('#sobNomeNovo').value = `${atual} ${s}`;
        else {
          const tira = s.split(' ').filter((w) => w.length > 0);
          let pal = atual.split(' ');
          tira.forEach((w) => { const k = pal.lastIndexOf(w); if (k > 0) pal.splice(k, 1); });
          pal = pal.filter((w, k, a) => !(['DE', 'DA', 'DO', 'DAS', 'DOS', 'E'].includes(w) && (k === a.length - 1 || ['DE', 'DA', 'DO', 'DAS', 'DOS', 'E'].includes(a[k + 1]))));
          $('#sobNomeNovo').value = pal.join(' ');
        }
        verificarAsc();
      }
      function verificarAsc() {
        const h = hip(), op = $('#sobOp').value;
        const atual = up(limpo(req.el('nome').value)).split(' ').slice(1).filter((w) => w.length > 2);
        const novo = up(limpo($('#sobNomeNovo').value)).split(' ');
        $('#sobAvisoAsc').hidden = !(['II', 'UE'].includes(h) && op === 'incluir' && atual.length && novo.length > 1 && !atual.some((w) => novo.includes(w)));
      }
      $('#sobHip').addEventListener('change', atualizar);
      $('#sobOp').addEventListener('change', atualizar);
      [req.el('nome'), $('#sobSob')].forEach((e) => e.addEventListener('input', sugerir));
      $('#sobNomeNovo').addEventListener('input', () => { nomeEditado = true; verificarAsc(); });
      function verIdade() {
        const sm = situacaoMenor(req.ler());
        const menor = sm.menor && !sm.emancipado;
        const m = $('#sobMenorAviso');
        m.hidden = !(sm.menor);
        if (sm.menor) m.textContent = sm.emancipado
          ? 'Requerente menor, mas casado(a) ou que já foi casado(a): o casamento faz cessar a incapacidade (Código Civil, art. 5º, parágrafo único, II), então ele(a) mesmo(a) assina, sem representante.'
          : sm.assistido ? `Requerente com ${sm.i} anos: de 16 a 18 anos é assistido(a) pelo pai ou pela mãe (Código Civil, art. 1.634, VII); os dois assinam.`
            : `Requerente com ${sm.i} anos: representado(a) pelo pai ou pela mãe (Código Civil, art. 1.634, VII), que assina.`;
        $('#sobMenorBox').hidden = !menor;
        $('#sobProcBox').hidden = menor;
        if (menor) { $('#sobProc').checked = false; $('#sobProcCampos').hidden = true; }
      }
      [req.el('nascimento'), req.el('estadoCivil')].forEach((x) => x.addEventListener('change', verIdade));
      $('#sobProc').addEventListener('change', () => { $('#sobProcCampos').hidden = !$('#sobProc').checked; });
      $('#sobProcCpf').addEventListener('input', () => { $('#sobProcCpf').value = B.mascaraCPF($('#sobProcCpf').value); });
      $('#sobProcData').addEventListener('change', () => {
        const d = diasDesde($('#sobProcData').value), m = $('#sobProcVelha');
        if (d !== null && d > 90) { m.textContent = `A escritura foi lavrada há ${d} dias. A representação por procurador exige escritura pública lavrada há menos de 90 dias (art. 515-O do Código Nacional de Normas).`; m.hidden = false; } else m.hidden = true;
      });
      return { destino, req, rep, fech, texto, hip, atualizar, verIdade, campoChave: req.el('nome'), resetNome: () => { nomeEditado = false; } };
    },
    textoAuto(ctx) {
      const h = ctx.hip(), H = HIPOTESES[h];
      const r = ctx.req.ler(), g = (m, fe) => gx(r.sexo, m, fe);
      if (!H) return '';
      const op = $('#sobOp').value, sobn = up(limpo($('#sobSob').value)) || '[SOBRENOME]', novo = up(limpo($('#sobNomeNovo').value)) || '[NOME NOVO]';
      const conj = up(limpo($('#sobConj').value)) || '[NOME]', local = limpo($('#sobCasLocal').value) || '__', data = dataBR($('#sobCasData').value) || '__';
      const ref = `Livro ${h === 'UE' ? 'E' : 'B'}-${limpo($('#sobCasLivro').value) || '__'}, fls. ${limpo($('#sobCasFolha').value) || '__'}, termo nº ${limpo($('#sobCasTermo').value) || '__'}`;
      const refNasc = `Livro A-${limpo($('#sobNascLivro').value) || '__'}, fls. ${limpo($('#sobNascFolha').value) || '__'}, termo nº ${limpo($('#sobNascTermo').value) || '__'}`;
      const acao = `com vistas a ${op === 'excluir' ? 'EXCLUIR' : 'INCLUIR'} o(s) sobrenome(s) `;
      const solteiro = op === 'excluir' && $('#sobSolteiro').checked ? `, retornando ao uso do nome de ${g('solteiro', 'solteira')}` : '';
      let contexto;
      if (h === 'II') contexto = `${g('o', 'a')} requerente, ${g('casado', 'casada')} com ${conj}, cujo casamento realizou-se em ${local} aos ${data}, conforme ${ref}`;
      else if (h === 'UE') contexto = `${g('o', 'a')} requerente, convivente em união estável com ${conj}, registrada em ${local} aos ${data}, conforme ${ref}`;
      else if (h === 'III') contexto = `${g('o', 'a')} requerente, cujo casamento com ${conj}, realizado em ${local} aos ${data}, conforme ${ref}, foi dissolvido por ${$('#sobDiss').value}`;
      else if (h === 'I') contexto = `${g('o', 'a')} requerente, ${g('registrado', 'registrada')} conforme ${refNasc}${limpo($('#sobOrigem').value) ? ` (${limpo($('#sobOrigem').value)})` : ''}`;
      else contexto = `${g('o', 'a')} requerente, ${g('registrado', 'registrada')} conforme ${refNasc}, em razão de alteração das relações de filiação (${limpo($('#sobOrigem').value) || '___'})`;
      const extra = h === 'III' ? ', adquirido(s) em razão do casamento' : h === 'I' ? ' familiar(es)' : '';
      return `Com fulcro no disposto pelo artigo 57, ${H.inciso}, da Lei nº 6.015/1973, ${contexto}, vem, respeitosamente, requerer a V. Sa. a instauração de procedimento para alteração de nome, ${acao}${sobn}${extra}${solteiro}, passando a ser ${g('identificado', 'identificada')} como: ${novo}.`;
    },
    camposZerar: () => [$('#sobCasLivro'), $('#sobCasFolha'), $('#sobCasTermo'), $('#sobNascLivro'), $('#sobNascFolha'), $('#sobNascTermo')],
    limparExtra(ctx) {
      ctx.destino.limpar(); ctx.req.limpar(); ctx.rep.limpar(); ctx.fech.reiniciarData(); ctx.resetNome();
      $('#sobOp').disabled = false; $('#sobProcCampos').hidden = true; $('#sobProcVelha').hidden = true;
      ctx.atualizar(); ctx.verIdade();
    },
    gerar(ctx, erros) {
      const dest = ctx.destino.texto();
      if (!dest) { erros.push('Cartório de destino'); ctx.destino.el.classList.add('invalido'); }
      const h = ctx.hip();
      if (!h) { erros.push('Hipótese do art. 57'); $('#sobHip').classList.add('invalido'); }
      ctx.req.validar(erros, 'Requerente', ['nome', 'sexo', 'nacionalidade', 'estadoCivil', 'nascimento', 'logradouro', 'numero']);
      const r = ctx.req.ler();
      const smR = situacaoMenor(r), menor = smR.menor && !smR.emancipado;
      if (!menor) ctx.req.validar(erros, 'Requerente', ['cpf', 'rg']);
      if (menor) ctx.rep.validar(erros, 'Representante', ['nome', 'sexo', 'cpf', 'rg']);
      const proc = !menor && $('#sobProc').checked;
      if (proc) [['#sobProcNome', 'Nome do(a) procurador(a)'], ['#sobProcTab', 'Tabelionato da procuração'], ['#sobProcData', 'Data da escritura']].forEach(([s, rt]) => {
        if (!limpo($(s).value)) { erros.push(rt); $(s).classList.add('invalido'); }
      });
      [['#sobOp', 'Incluir ou excluir'], ['#sobSob', 'Sobrenome(s) a incluir/excluir'], ['#sobNomeNovo', 'Nome completo que passará a usar']].forEach(([s, rt]) => {
        if (!limpo($(s).value)) { erros.push(rt); $(s).classList.add('invalido'); }
      });
      const texto = ctx.texto.ler();
      if (!limpo(texto)) { erros.push('Texto do requerimento'); ctx.texto.ta.classList.add('invalido'); }
      if (/\[[A-Z ]+\]|-__,|fls\. __| aos __|em __ |\(___\)/.test(texto)) erros.push('O texto do requerimento ainda tem partes em branco: preencha os campos (livro, folha, termo, datas…) ou corrija o texto');
      ctx.fech.validar(erros);
      if (erros.length) return null;

      const f = ctx.fech.ler(), g = (m, fe) => gx(r.sexo, m, fe);
      const H = HIPOTESES[h];
      let qual = `${r.nome}, ${qualificacao(r)}`;
      const nomesExtra = [];
      if (menor) {
        const p = ctx.rep.ler(), qualRep = $('#sobRepQual').value === 'pai' ? 'seu pai' : 'sua mãe';
        qual += `, menor de idade, neste ato ${smR.assistido ? g('assistido', 'assistida') : g('representado', 'representada')} por ${qualRep}, ${p.nome}, ${qualificacao(p, { completo: false })}`;
        nomesExtra.push(p.nome);
      }
      if (proc) {
        const pn = up(limpo($('#sobProcNome').value)), pc = limpo($('#sobProcCpf').value);
        qual += `, neste ato ${g('representado', 'representada')} por seu(sua) procurador(a) ${pn}${pc ? `, inscrito(a) no CPF/MF sob o nº ${pc}` : ''}, conforme procuração lavrada no ${limpo($('#sobProcTab').value)}${limpo($('#sobProcLivro').value) ? `, Livro ${limpo($('#sobProcLivro').value)}` : ''}${limpo($('#sobProcFls').value) ? `, fls. ${limpo($('#sobProcFls').value)}` : ''}, em ${dataBR($('#sobProcData').value)}`;
        nomesExtra.push(pn);
      }
      const blocos = [
        enderecamento(dest),
        titulo('I – REQUERENTE:'),
        { p: [`${qual}.`], ind: RECUO },
        titulo('II – REQUERIMENTO:'),
        ...paragrafosDe(texto),
        titulo('III – DECLARAÇÕES SOB AS PENAS DA LEI:'),
        { p: [`${g('O', 'A')} requerente declara que a alteração ora requerida está de acordo com seu nome atual e que responde civil e criminalmente pela veracidade desta afirmação. Declara, ainda, que não é parte em ação judicial em trâmite sobre alteração de sobrenome ou, em caso de ação judicial com o referido escopo, que a mesma já foi devidamente arquivada, conforme certidão anexa.`], ind: RECUO },
        titulo('IV – FUNDAMENTO JURÍDICO:'),
        { p: [`O presente requerimento está fundamentado no artigo 57, ${H.inciso}, da Lei nº 6.015/1973.`], ind: RECUO },
      ];
      let ass;
      const assExtra = [];
      if (menor) {
        const p = ctx.rep.ler();
        ass = assinaturaCentro(p.nome, [[`${smR.assistido ? 'Assistente' : 'Representante legal'} de ${r.nome}`]]);
        if (smR.assistido) assExtra.push(assinaturaCentro(r.nome, [[g('Menor assistido', 'Menor assistida')]]));
      }
      else if (proc) ass = assinaturaCentro(up(limpo($('#sobProcNome').value)), [[`Procurador(a) de ${r.nome}`]]);
      else ass = assinaturaCentro(r.nome);
      return {
        titulo: 'Requerimento de alteração de sobrenome', arquivo: nomeArquivo('alteracao-sobrenome', r.nome), chave: r.nome,
        nomes: [r.nome, r.pai, r.mae, up(limpo($('#sobConj').value)), up(limpo($('#sobSob').value)), up(limpo($('#sobNomeNovo').value)), ...nomesExtra],
        blocos: blocos.concat(fechamentoBlocos(f, [ass, ...assExtra])),
      };
    },
  });


  // =====================================================================
  // 4) NOTA DEVOLUTIVA – fundamentos buscados nas normas do registro civil (texto oficial da base)
  // =====================================================================
  const semAc = (x) => (x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const PARADAS = new Set('a o e de da do das dos em no na nos nas para por com sem que os as um uma ao aos se ou sua seu'.split(' '));
  let NORMAS = null, carregandoNormas = null;
  function carregarNormas() {
    if (NORMAS) return Promise.resolve(NORMAS);
    if (!carregandoNormas) carregandoNormas = fetch('dados/normas-rcpn.json?v=20261113e').then((r) => r.json()).then((j) => {
      j.itens.forEach((it) => { it.k = semAc(`${it.d} ${it.t}`); });
      NORMAS = j; return j;
    });
    return carregandoNormas;
  }
  function buscarNormas(q, filtro) {
    const toks = semAc(q).split(/[^a-z0-9.]+/).filter((t) => t && !PARADAS.has(t));
    if (!toks.length) return [];
    const itens = NORMAS.itens.filter((it) => !filtro || it.n === filtro);
    // número de dispositivo digitado (ex.: "155", "art 32", "item 155.1")
    const num = (q.match(/\b(\d+(?:\.\d+)*)\b/) || [])[1];
    const df = {};
    toks.forEach((t) => { df[t] = itens.reduce((n, it) => n + (it.k.includes(t) ? 1 : 0), 0); });
    const N = itens.length;
    return itens.map((it) => {
      let sc = 0, achou = 0;
      toks.forEach((t) => {
        if (!df[t]) return;
        let c = 0, i = -1; while ((i = it.k.indexOf(t, i + 1)) !== -1 && c < 8) c++;
        if (c) { achou++; sc += Math.log(1 + c) * Math.log(1 + N / df[t]); }
      });
      if (num && new RegExp(`(art\\.?|item)\\s*${num.replace(/\./g, '\\.')}\\b`).test(semAc(it.d))) sc += 50;
      sc *= achou / toks.length;
      return { it, sc };
    }).filter((x) => x.sc > 0).sort((a, b) => b.sc - a.sc).slice(0, 15).map((x) => x.it);
  }
  // Divide o dispositivo em partes citáveis (subitens 155.1, 155.1.1 / parágrafos § 1º, parágrafo único).
  function partesDe(it) {
    const t = it.t;
    const mItem = it.d.match(/item\s+(\d+)/i);
    let cortes = [];
    if (mItem) {
      const re = new RegExp(`(?:^|\\s)(${mItem[1]}(?:\\.\\d+)*)\\.?\\s(?=[A-ZÀ-Ú“"])`, 'g'); let m;
      while ((m = re.exec(t))) cortes.push({ pos: m.index + (m[0].startsWith(' ') ? 1 : 0), rot: m[1] });
    } else {
      const re = /(?:^|\s)(§\s*\d+º?|Parágrafo único)/g; let m;
      cortes.push({ pos: 0, rot: '' });
      while ((m = re.exec(t))) cortes.push({ pos: m.index + (m[0].startsWith(' ') ? 1 : 0), rot: m[1].replace(/\s+/g, ' ') });
    }
    cortes = cortes.filter((c, i, a) => i === 0 || c.pos > a[i - 1].pos);
    if (!cortes.length) return [{ rot: '', texto: t }];
    return cortes.map((c, i) => ({ rot: c.rot, texto: t.slice(c.pos, i + 1 < cortes.length ? cortes[i + 1].pos : t.length).trim() }));
  }
  function nomeNorma(n) { return (NORMAS && NORMAS.normas[n]) || n; }
  // "conforme o art. 32, § 1º, da Lei nº 6.015/1973 (...)" / "conforme as Normas de Serviço..., item 155.1.1"
  function citacao(it, rots) {
    const n = nomeNorma(it.n);
    if (/^item/i.test(it.d)) {
      const itens = rots.filter(Boolean);
      const alvo = itens.length ? (itens.length > 1 ? `itens ${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}` : `item ${itens[0]}`) : it.d;
      return { frase: `conforme as ${n}, ${alvo}, ${itens.length > 1 ? 'os quais dispõem' : 'o qual dispõe'}:`, curta: `${n}, ${alvo}` };
    }
    const art = it.d.replace(/^art\.?\s*/i, 'art. ');
    const pars = rots.filter(Boolean);
    const alvo = pars.length ? `${art}, ${pars.join(' e ')},` : art;
    const artigoDe = /^(Lei|Decreto|Código Civil)/.test(n) ? `da ${n}` : `do ${n}`;
    return { frase: `conforme o ${alvo} ${artigoDe}, que dispõe:`.replace(/,,/g, ','), curta: `${alvo.replace(/,$/, '')} ${artigoDe}` };
  }
  function diasUteisApos(inicioISO, dias, semExp) {
    const d = new Date(inicioISO + 'T12:00:00'); let c = 0;
    while (c < dias) {
      d.setDate(d.getDate() + 1);
      const iso = d.toISOString().slice(0, 10);
      if (d.getDay() !== 0 && d.getDay() !== 6 && !semExp.has(iso)) c++;
    }
    return d.toISOString().slice(0, 10);
  }
  function diasCorridosApos(inicioISO, dias) { const d = new Date(inicioISO + 'T12:00:00'); d.setDate(d.getDate() + dias); return d.toISOString().slice(0, 10); }
  // Feriados nacionais fixos + Sexta-feira Santa (calculada pela Páscoa), no formato dd/mm/aaaa.
  function pascoa(a) {
    const b = a % 19, c = Math.floor(a / 100), d = a % 100, e = Math.floor(c / 4), f = c % 4, g = Math.floor((c + 8) / 25), h = Math.floor((c - g + 1) / 3);
    const i = (19 * b + c - e - h + 15) % 30, k = Math.floor(d / 4), l = d % 4, m = (32 + 2 * f + 2 * k - i - l) % 7, n = Math.floor((b + 11 * i + 22 * m) / 451);
    const mes = Math.floor((i + m - 7 * n + 114) / 31), dia = ((i + m - 7 * n + 114) % 31) + 1;
    return new Date(a, mes - 1, dia, 12);
  }
  function feriadosEntre(ini, fim) {
    const out = [];
    for (let a = ini.getFullYear(); a <= fim.getFullYear(); a++) {
      const lista = ['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25'].map((md) => new Date(`${a}-${md}T12:00:00`));
      const sexta = pascoa(a); sexta.setDate(sexta.getDate() - 2); lista.push(sexta);
      lista.forEach((d) => { if (d > ini && d <= fim) out.push(d); });
    }
    return out.sort((x, y) => x - y).map((d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`);
  }
  function lerDatas(txt) {
    const s2 = new Set();
    (txt || '').split(/[,;\s]+/).forEach((x) => { const m = x.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if (m) s2.add(`${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`); });
    return s2;
  }

  const nota = criarAba({
    nome: 'nota', raiz: $('#abaNota'), id: 'not',
    montar(raiz) {
      raiz.insertAdjacentHTML('beforeend', `
        <p class="aviso">Os fundamentos vêm do texto oficial das normas do registro civil (base conferida em <span id="notVerif">…</span>). O site só busca e cita: quem escolhe o dispositivo é você.</p>
        <p class="aviso" id="notAvisoNova" hidden>Minuta nova: o requerente mudou, então o texto foi refeito.</p>
        <fieldset><legend>Dados da nota</legend>
          <label>Documento apresentado <textarea id="notDoc" rows="2" placeholder="ex.: CERTIDÕES DE ASSENTO DE NASCIMENTO DE REGISTROS LAVRADOS NO EXTERIOR"></textarea></label>
          <div class="grade g2">
            <label>Requerente (nome) <input id="notReq"></label>
            <label>Qualidade do requerente (opcional) <input id="notQual" placeholder="ex.: GENITORA"></label>
          </div>
          <div class="grade g2">
            <label>Ato pretendido <input id="notAto" placeholder="ex.: Transcrição de nascimento dos filhos"></label>
            <label>Data da apresentação <input type="date" id="notDataAp"></label>
          </div>
        </fieldset>
        <fieldset><legend>Exigências</legend>
          <div id="notExigs"></div>
          <button type="button" class="sec mini" id="notAdd">+ adicionar exigência</button>
        </fieldset>
        <fieldset><legend>Prazo para cumprimento (opcional)</legend>
          <label class="opcao"><input type="checkbox" id="notPrazoUsa"> Incluir prazo na nota</label>
          <div id="notPrazoBox" hidden>
            <p class="dica">A base não traz um prazo próprio do registro civil para o cumprimento de exigências: informe o prazo que o cartório adota.</p>
            <div class="grade g4">
              <label>Data do protocolo <input type="date" id="notProt"></label>
              <label>Quantidade de dias <input id="notDias" inputmode="numeric"></label>
              <label>Contagem <select id="notTipoDias"><option value="uteis" selected>dias úteis</option><option value="corridos">dias corridos</option></select></label>
              <label>Vencimento <input id="notVenc" readonly></label>
            </div>
            <label>Dias sem expediente (feriados locais), separados por vírgula <input id="notSemExp" placeholder="ex.: 20/11/2026, 08/12/2026"></label>
          </div>
        </fieldset>`);
      const texto = blocoTexto(raiz, 'notTexto', 'Razões da devolução: texto que vai sair no documento (pode editar)');
      raiz.insertAdjacentHTML('beforeend', `
        <fieldset><legend>Local, data e assinatura</legend>
          <div class="grade g4">
            <label>Cidade <input id="notLocal" value="Caraguatatuba"></label>
            <label>Data <input type="date" id="notData"></label>
            <label>Nome de quem assina <input id="notEsc"></label>
            <label>Cargo <select id="notCargo"><option value="" selected>Selecione</option>${CARGOS.map((c) => `<option>${c}</option>`).join('')}</select></label>
          </div>
        </fieldset>`);
      $('#notData').value = B.hojeISO(); $('#notDataAp').value = B.hojeISO();
      const caixa = $('#notExigs');
      const opcoesNorma = () => `<option value="">Todas as normas</option>` + Object.entries(NORMAS ? NORMAS.normas : {}).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('');
      function addExig() {
        const d = document.createElement('div');
        d.className = 'exig';
        d.innerHTML = `
          <div class="exig-cab"><h3></h3><button type="button" class="remover" title="Remover esta exigência" aria-label="Remover">×</button></div>
          <label>O que foi constatado <textarea data-k="razao" rows="2" placeholder="ex.: não foram apresentadas as certidões traduzidas por tradutor público juramentado inscrito em junta comercial brasileira"></textarea></label>
          <div class="grade g-busca">
            <label>Buscar fundamento nas normas <input data-k="busca" placeholder="ex.: tradutor juramentado traslado / item 155 / art. 32"></label>
            <label>Norma <select data-k="filtro">${opcoesNorma()}</select></label>
          </div>
          <div class="resultados" data-k="res"></div>
          <div class="fundamento" data-k="fund" hidden></div>
          <label>O que deve ser apresentado ou providenciado <textarea data-k="prov" rows="2" placeholder="ex.: Apresentar a tradução das certidões feita por tradutor público inscrito na Junta Comercial."></textarea></label>`;
        caixa.appendChild(d);
        d.dados = { it: null, rots: [] };
        numerar();
        const busca = d.querySelector('[data-k=busca]'), filtro = d.querySelector('[data-k=filtro]'), res = d.querySelector('[data-k=res]');
        let t = null;
        const procurar = () => {
          clearTimeout(t);
          t = setTimeout(async () => {
            if (!busca.value.trim()) { res.innerHTML = ''; return; }
            res.innerHTML = '<p class="dica">Buscando…</p>';
            await carregarNormas();
            if (filtro.options.length <= 1) filtro.innerHTML = opcoesNorma();
            const achados = buscarNormas(busca.value, filtro.value);
            res.innerHTML = achados.length ? achados.map((it, i) => `
              <div class="res-item">
                <div><b>${esc(nomeNorma(it.n).split(' (')[0])} – ${esc(it.d)}</b> <a href="${esc(it.u)}" target="_blank" rel="noopener noreferrer">texto oficial</a></div>
                <div class="res-texto">${esc(it.t.slice(0, 320))}${it.t.length > 320 ? '…' : ''}</div>
                <button type="button" class="sec mini" data-usar="${i}">Usar este</button>
              </div>`).join('') : '<p class="dica">Nada encontrado. Tente outras palavras ou escolha outra norma.</p>';
            res.querySelectorAll('[data-usar]').forEach((b) => b.addEventListener('click', () => escolher(d, achados[+b.dataset.usar])));
          }, 250);
        };
        busca.addEventListener('input', procurar);
        filtro.addEventListener('change', procurar);
        d.querySelector('.remover').addEventListener('click', () => { if (caixa.children.length > 1) { d.remove(); numerar(); ctxRecalc(); } });
      }
      function escolher(d, it) {
        const partes = partesDe(it);
        d.dados = { it, partes, rots: [] };
        const f = d.querySelector('[data-k=fund]');
        f.hidden = false;
        f.innerHTML = `
          <div><b>Fundamento escolhido:</b> ${esc(nomeNorma(it.n))} – ${esc(it.d)}
            (<a href="${esc(it.u)}" target="_blank" rel="noopener noreferrer">texto oficial</a>, conferido em ${esc(B.dataExtenso ? it.v.split('-').reverse().join('/') : it.v)})
            <button type="button" class="sec mini" data-trocar>Trocar</button></div>
          <p class="dica">${partes.length > 1 ? 'Marque o(s) trecho(s) que vão ser citados na nota:' : 'Este trecho vai ser citado na nota:'}</p>
          ${partes.map((p2, i) => `<label class="opcao trecho"><input type="checkbox" data-parte="${i}" ${partes.length === 1 ? 'checked' : ''}> <span><b>${esc(p2.rot || (i === 0 ? 'caput' : ''))}</b> ${esc(p2.texto)}</span></label>`).join('')}`;
        d.querySelector('[data-k=res]').innerHTML = '';
        f.querySelector('[data-trocar]').addEventListener('click', () => { d.dados = { it: null, rots: [] }; f.hidden = true; f.innerHTML = ''; ctxRecalc(); });
        f.querySelectorAll('[data-parte]').forEach((cb) => cb.addEventListener('change', ctxRecalc));
        ctxRecalc();
      }
      function numerar() { [...caixa.children].forEach((d, i) => { d.querySelector('h3').textContent = `Exigência ${i + 1}`; }); }
      let ctxRecalc = () => {};
      addExig();
      $('#notAdd').addEventListener('click', addExig);
      // Feriados nacionais (e Sexta-feira Santa) entram sozinhos nos dias sem expediente; o campo continua editável.
      let semExpEditado = false;
      $('#notSemExp').addEventListener('input', () => { semExpEditado = true; });
      function preencherFeriados() {
        if (semExpEditado || !$('#notProt').value) return;
        const ini = new Date($('#notProt').value + 'T12:00:00'), fim = new Date(ini); fim.setDate(fim.getDate() + 180);
        $('#notSemExp').value = feriadosEntre(ini, fim).join(', ');
      }
      $('#notPrazoUsa').addEventListener('change', () => {
        $('#notPrazoBox').hidden = !$('#notPrazoUsa').checked;
        if (!$('#notProt').value) $('#notProt').value = $('#notDataAp').value;
        preencherFeriados();
      });
      $('#notProt').addEventListener('change', preencherFeriados);
      // carrega as normas quando a aba é aberta
      document.querySelector('.aba[data-minuta=nota]').addEventListener('click', () => carregarNormas().then((j) => {
        $('#notVerif').textContent = j.verificado_em.split('-').reverse().join('/');
        caixa.querySelectorAll('[data-k=filtro]').forEach((f) => { if (f.options.length <= 1) f.innerHTML = opcoesNorma(); });
      }));
      return { texto, caixa, addExig, numerar, campoChave: $('#notReq'), setRecalc: (f) => { ctxRecalc = f; }, resetFeriados: () => { semExpEditado = false; } };
    },
    textoAuto(ctx) {
      const exigs = [...ctx.caixa.children].map((d) => {
        const sel = d.dados.it ? [...d.querySelectorAll('[data-parte]')].filter((c) => c.checked).map((c) => d.dados.partes[+c.dataset.parte]) : [];
        return { razao: limpo(d.querySelector('[data-k=razao]').value).replace(/\.$/, ''), prov: limpo(d.querySelector('[data-k=prov]').value), it: d.dados.it, sel };
      });
      const doc = limpo($('#notDoc').value) || '[DOCUMENTO]', ato = limpo($('#notAto').value);
      const linhas = [];
      const intro = `Em ${dataBR($('#notDataAp').value) || '__/__/____'}, foi apresentado nesta Serventia: ${doc}${ato ? `, para ${ato.charAt(0).toLowerCase() + ato.slice(1)}` : ''}`;
      const varias = exigs.length > 1;
      linhas.push(varias ? `${intro}, sendo necessário o cumprimento das seguintes exigências:` : `${intro}.`);
      exigs.forEach((e, i) => {
        const pre = varias ? `${i + 1}. ` : '';
        const razao = e.razao || '[O QUE FOI CONSTATADO]';
        if (e.it && e.sel.length) {
          const c = citacao(e.it, e.sel.map((p2) => p2.rot));
          linhas.push(`${pre}${razao}, ${c.frase}`);
          e.sel.forEach((p2) => linhas.push(`\t“${p2.texto}”`));
        } else linhas.push(`${pre}${razao}.`);
        if (e.prov) linhas.push(e.prov);
      });
      if ($('#notPrazoUsa').checked) {
        const n = parseInt($('#notDias').value, 10), prot = $('#notProt').value;
        if (n > 0 && prot) {
          const uteis = $('#notTipoDias').value === 'uteis';
          const venc = uteis ? diasUteisApos(prot, n, lerDatas($('#notSemExp').value)) : diasCorridosApos(prot, n);
          $('#notVenc').value = dataBR(venc);
          linhas.push(`Prazo para cumprimento das exigências: ${n} ${uteis ? (n === 1 ? 'dia útil' : 'dias úteis') : (n === 1 ? 'dia corrido' : 'dias corridos')}, contados do protocolo em ${dataBR(prot)}, com vencimento em ${dataBR(venc)}.`);
        } else { $('#notVenc').value = ''; linhas.push('Prazo para cumprimento das exigências: [INFORME O PRAZO].'); }
      }
      return linhas.join('\n');
    },
    limparExtra(ctx) {
      ctx.caixa.innerHTML = ''; ctx.addExig();
      $('#notData').value = B.hojeISO(); $('#notDataAp').value = B.hojeISO(); $('#notLocal').value = 'Caraguatatuba';
      $('#notPrazoBox').hidden = true; ctx.resetFeriados();
    },
    gerar(ctx, erros) {
      [['#notDoc', 'Documento apresentado'], ['#notReq', 'Requerente'], ['#notAto', 'Ato pretendido'], ['#notDataAp', 'Data da apresentação'], ['#notData', 'Data da nota'], ['#notEsc', 'Nome de quem assina'], ['#notCargo', 'Cargo']].forEach(([s2, r]) => {
        if (!limpo($(s2).value)) { erros.push(r); $(s2).classList.add('invalido'); }
      });
      const semFund = [];
      [...ctx.caixa.children].forEach((d, i) => {
        if (!limpo(d.querySelector('[data-k=razao]').value)) { erros.push(`Exigência ${i + 1}: o que foi constatado`); d.querySelector('[data-k=razao]').classList.add('invalido'); }
        const marcados = d.dados.it ? [...d.querySelectorAll('[data-parte]')].some((c) => c.checked) : false;
        if (d.dados.it && !marcados) erros.push(`Exigência ${i + 1}: marque o trecho da norma que vai ser citado`);
        if (!d.dados.it) semFund.push(i + 1);
      });
      const texto = ctx.texto.ler();
      if (!limpo(texto)) { erros.push('Texto das razões da devolução'); ctx.texto.ta.classList.add('invalido'); }
      if (/\[[A-ZÀ-Ú ]+\]|__\/__/.test(texto)) erros.push('O texto ainda tem partes em branco ([…] ou __/__): preencha os campos ou corrija o texto');
      if (erros.length) return null;
      if (semFund.length && !confirm(`A(s) exigência(s) ${semFund.join(', ')} está(ão) sem fundamento nas normas. Gerar assim mesmo?`)) { erros.push('Escolha um fundamento para cada exigência (ou confirme que pode ir sem).'); return null; }
      const req = up(limpo($('#notReq').value)), qual = up(limpo($('#notQual').value));
      const blocos = [
        { p: [R('NOTA DEVOLUTIVA', true)], al: 'c', tam: 12, depois: 14 },
        { p: [R('DOCUMENTO APRESENTADO: ', true), up(limpo($('#notDoc').value))], al: 'j', depois: 8 },
        { p: [R('Requerente: ', true), req, qual ? ` (${qual})` : ''], al: 'e', depois: 8 },
        { p: [R('Ato pretendido: ', true), limpo($('#notAto').value)], al: 'e', depois: 10 },
        { p: [R('RAZÕES DA DEVOLUÇÃO:', true)], al: 'e', depois: 4 },
        ...paragrafosDe(texto, { esqItem: 150, tamItem: 9.5, recuo: 40 }),
        { p: [`${limpo($('#notLocal').value)}, ${dataBR($('#notData').value)}`], al: 'c', antes: 14, depois: 0 },
        { ass: { nome: [limpo($('#notEsc').value)], linhas: [[R($('#notCargo').value, true)]], larg: 260, centro: true, antes: 34, tam: 10.5 } },
      ];
      return { titulo: 'Nota devolutiva', arquivo: nomeArquivo('nota-devolutiva', req), chave: req, nomes: [req], timbrado: true, blocos };
    },
  });
  // recalcula o texto quando muda o trecho escolhido ou remove exigência
  nota.setRecalc(() => nota.recalcular && nota.recalcular());

  window.MinutasNovas = { ret, pre, sob, nota }; // para testes no navegador
})();
