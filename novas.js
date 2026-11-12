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
  // Blocos: {p:[runs], al, ind, antes, depois, tam} | {ass:{nome:[runs], linhas:[[runs]], esq, larg}} | {lado:[ass, ass]} | {espaco}
  // run: 'texto' ou {t:'texto', b:true}
  // =====================================================================
  const R = (t, b) => ({ t, b: !!b });
  const LARG_UTIL = 475; // largura útil do A4 com as margens usadas (pt)
  const MARGENS = { esq: 65, dir: 55, cima: 42, baixo: 40 };

  function pdfDoc(titulo, blocos) {
    const runs = (rs) => rs.map((r) => (typeof r === 'string' ? r : { text: r.t, bold: r.b }));
    const assin = (a) => {
      const st = [
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: a.larg || 320, y2: 0, lineWidth: 0.8 }], margin: [0, a.antes || 26, 0, 2] },
        { text: runs(a.nome), fontSize: a.tam || 10 },
        ...(a.linhas || []).map((l) => ({ text: runs(l), fontSize: (a.tam || 10) - 0.5 })),
      ];
      return a.esq ? { columns: [{ width: a.esq, text: '' }, { stack: st }], unbreakable: true } : { stack: st, unbreakable: true };
    };
    const render = (b) => {
      if (b.grupo) return { stack: b.grupo.map(render), unbreakable: true };
      if (b.espaco) return { text: '', margin: [0, b.espaco, 0, 0] };
      if (b.ass) return assin(b.ass);
      if (b.lado) return { columns: b.lado.map(assin), columnGap: 20, unbreakable: true };
      return {
        text: runs(b.p), alignment: { j: 'justify', c: 'center', e: 'left', d: 'right' }[b.al || 'j'],
        leadingIndent: b.ind || 0, margin: [b.esqBloco || 0, b.antes || 0, 0, b.depois == null ? 4 : b.depois], fontSize: b.tam || 10.5,
        lineHeight: b.lh || 1.15,
      };
    };
    const content = blocos.map(render);
    return {
      pageSize: 'A4', pageMargins: [MARGENS.esq, MARGENS.cima, MARGENS.dir, MARGENS.baixo],
      info: { title: titulo, creator: 'Minutas do Registro Civil' },
      defaultStyle: { font: 'Roboto', fontSize: 11, lineHeight: 1.2 }, content,
    };
  }

  function wordDoc(titulo, blocos) {
    const X = window.docx;
    const { Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType, TableLayoutType } = X;
    const pt = (n) => Math.round(n * 20);
    const F = 'Arial';
    const SB = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
    const sem = { top: SB, bottom: SB, left: SB, right: SB, insideHorizontal: SB, insideVertical: SB };
    const runs = (rs, tam) => rs.map((r) => new TextRun({ text: typeof r === 'string' ? r : r.t, bold: typeof r === 'string' ? false : r.b, font: F, size: Math.round(tam * 2) }));
    const AL = { j: AlignmentType.JUSTIFIED, c: AlignmentType.CENTER, e: AlignmentType.LEFT, d: AlignmentType.RIGHT };
    const assin = (a, total) => {
      const esq = a.esq || 0, larg = a.larg || 320, tam = a.tam || 10;
      const ind = { left: pt(esq), right: pt(Math.max(0, total - esq - larg)) };
      return [
        new Paragraph({ children: [new TextRun({ text: '', font: F })], spacing: { before: pt(a.antes || 26), after: pt(2) }, indent: ind, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000' } } }),
        new Paragraph({ children: runs(a.nome, tam), spacing: { after: 0 }, indent: { left: pt(esq) } }),
        ...(a.linhas || []).map((l) => new Paragraph({ children: runs(l, tam - 0.5), spacing: { after: 0 }, indent: { left: pt(esq) } })),
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
            children: assin(Object.assign({}, a, { esq: 0, larg: Math.min(a.larg || col, col) }), col),
          })) })],
        }));
        return;
      }
      const tam = b.tam || 10.5;
      filhos.push(new Paragraph({
        children: runs(b.p, tam), alignment: AL[b.al || 'j'],
        indent: { firstLine: pt(b.ind || 0), left: pt(b.esqBloco || 0) },
        spacing: { before: pt(b.antes || 0), after: pt(b.depois == null ? 4 : b.depois), line: Math.round((b.lh || 1.15) * 240) },
      }));
    });
    return new X.Document({
      creator: 'Minutas do Registro Civil', title: titulo,
      styles: { default: { document: { run: { font: F, size: 22 } } } },
      sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: pt(MARGENS.cima), bottom: pt(MARGENS.baixo), left: pt(MARGENS.esq), right: pt(MARGENS.dir) } } }, children: filhos }],
    });
  }

  // Final comum: local/data, assinatura(s) e certificação.
  function fechamentoBlocos(f, assinaturas, { docsOriginais = false } = {}) {
    const bl = [{ p: [`${f.local}, ${B.dataExtenso(f.data)}.`], al: 'e', antes: 8, depois: 0 }];
    assinaturas.forEach((a) => bl.push(a));
    // A certificação e a assinatura de quem certifica ficam sempre juntas na mesma página.
    bl.push({ grupo: [
      { p: [R('CERTIFICO E DOU FÉ', true), ' que a assinatura supra foi lançada em minha presença.' + (docsOriginais ? ' Certifico ainda que todos os documentos anexados foram extraídos dos originais.' : '')], antes: 12, depois: 0, tam: 9.5 },
      { ass: { nome: [R(`${f.escrevente} – ${f.cargo}`, true)], linhas: [[`SELO: ${f.selo || '______________________________'}`]], larg: 300, antes: 24, tam: 9.5 } },
    ] });
    return bl;
  }

  function nomeArquivo(prefixo, nome, ext) {
    const b = (nome || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return `${prefixo}-${b || 'minuta'}.${ext}`;
  }
  async function entregar(acao, titulo, blocos, arquivo) {
    if (acao === 'word') {
      const blob = await window.docx.Packer.toBlob(wordDoc(titulo, blocos));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = arquivo + '.docx';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      return;
    }
    const pdf = pdfMake.createPdf(pdfDoc(titulo, blocos));
    if (acao === 'pdf') pdf.download(arquivo + '.pdf');
    else pdf.getBlob((blob) => B.mostrarPdf(blob));
  }

  // Monta uma aba: chama "montar" para criar os campos e liga os botões.
  function criarAba({ nome, raiz, id, montar, gerar, limparExtra, camposZerar }) {
    const ctx = montar(raiz);
    botoes(raiz, id);
    let nomeGerado = null;
    raiz.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-acao]'); if (!b || !raiz.contains(b)) return;
      const acao = b.dataset.acao;
      if (acao === 'limpar') { if (confirm('Apagar o que foi preenchido nesta minuta?')) { limpar(); window.scrollTo(0, 0); } return; }
      raiz.querySelectorAll('.invalido').forEach((x) => x.classList.remove('invalido'));
      const erros = [];
      const r = gerar(ctx, erros);
      if (mostrarErros(raiz, id, erros) || !r) return;
      try {
        await entregar(acao === 'ver' ? 'ver' : acao, r.titulo, r.blocos, r.arquivo);
        nomeGerado = r.chave;
      } catch (err) { console.error(err); alert('Não foi possível gerar o documento. Tente de novo.'); }
    });
    // Minuta nova: se o requerente mudar depois de gerar, zera livro/folha/termo e o tipo de assento.
    if (ctx.campoChave) {
      ctx.campoChave.addEventListener('change', () => {
        if (nomeGerado !== null && up(limpo(ctx.campoChave.value)) !== nomeGerado) {
          nomeGerado = null;
          (camposZerar ? camposZerar(ctx) : []).forEach((el) => { el.value = ''; el.dispatchEvent(new Event('change')); });
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
      if (B.abaAtual() === nome) B.esconderPrevia();
    }
    B.registrarAba({
      nome, limpar,
      temDados: () => [...raiz.querySelectorAll('input:not([type=date]):not([type=checkbox]), textarea')].some((el) => !el.closest('.combo') && el.value.trim() && el.value !== el.defaultValue) || (ctx.destino && ctx.destino.temDados()),
    });
    return ctx;
  }

  const ASSENTOS = [
    ['A', 'Nascimento (Livro A)', 'NASCIMENTO'], ['B', 'Casamento (Livro B)', 'CASAMENTO'], ['B AUX', 'Casamento religioso (Livro B Auxiliar)', 'CASAMENTO'],
    ['C', 'Óbito (Livro C)', 'ÓBITO'], ['C AUX', 'Natimorto (Livro C Auxiliar)', 'NATIMORTO'],
  ];
  const livroTxt = (tipo, n) => `${tipo.replace(' AUX', '-Auxiliar')}-${n}`;

  // =====================================================================
  // 1) RETIFICAÇÃO
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

  const ret = criarAba({
    nome: 'retificacao', raiz: $('#abaRetificacao'), id: 'ret',
    montar(raiz) {
      raiz.insertAdjacentHTML('beforeend', '<p class="aviso" id="retAvisoNova" hidden>Minuta nova: o requerente mudou, então o tipo de assento, o livro, a folha e o termo foram zerados. Escolha de novo.</p>');
      const destino = blocoDestino(raiz, 'retD');
      raiz.insertAdjacentHTML('beforeend', `
        <fieldset><legend>Quem requer</legend>
          <div class="opcoes">
            <label class="opcao"><input type="radio" name="retQuem" value="proprio" checked> O próprio registrado</label>
            <label class="opcao"><input type="radio" name="retQuem" value="representante"> Representante legal (pai/mãe de registrado menor)</label>
            <label class="opcao"><input type="radio" name="retQuem" value="procurador"> Procurador(a)</label>
          </div>
          <div class="grade g2" id="retRepres" hidden>
            <label>Nome do(a) representado(a) <input id="retRepNome"></label>
            <label id="retProcLbl">Procuração (onde e quando foi feita) <input id="retProcTxt" placeholder="ex.: lavrada no 1º Tabelião de Notas de X, livro 10, fls. 20, em 01/02/2026"></label>
          </div>
          <div id="retReq"></div>
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
            <label>Texto que sai no documento (pode editar) <textarea id="retMotivo" rows="3"></textarea></label>
            <div id="retT1"></div><div id="retT2"></div>
          </div>
        </fieldset>
        <fieldset><legend>Assento a retificar</legend>
          <div class="grade g4">
            <label>Tipo de assento <select id="retTipo"><option value="" selected>Selecione</option>
              ${ASSENTOS.map((a) => `<option value="${a[0]}">${a[1]}</option>`).join('')}</select></label>
            <label>Livro nº <input id="retLivro" inputmode="numeric"></label>
            <label>Folha <input id="retFolha" inputmode="numeric"></label>
            <label>Termo nº <input id="retTermo" inputmode="numeric"></label>
          </div>
          <div class="grade g2">
            <label id="retN1Lbl">Nome do(a) registrado(a) <input id="retN1"></label>
            <label id="retN2Lbl" hidden>Nome do 2º contraente <input id="retN2"></label>
          </div>
        </fieldset>
        <fieldset><legend>O que corrigir</legend>
          <div id="retCorrecoes"></div>
          <button type="button" class="sec mini" id="retAdd">+ adicionar correção</button>
          <div class="grade g2" style="margin-top:12px">
            <label>Fundamento <select id="retFundTipo">
              <option value="97e110" selected>arts. 97 e 110 da Lei nº 6.015/1973</option>
              <option value="97">art. 97 da Lei nº 6.015/1973</option>
              <option value="110">art. 110 da Lei nº 6.015/1973</option></select></label>
            <label>Texto do fundamento (pode editar) <input id="retFund" value="nos termos dos arts. 97 e 110 da Lei nº 6.015/1973"></label>
          </div>
          <label class="opcao"><input type="checkbox" id="retIsento"> Erro imputável ao cartório – sai "ISENTO" no documento</label>
        </fieldset>`);
      const req = blocoPessoa($('#retReq'), 'retR', { titulo: 'Qualificação de quem assina o requerimento' });
      const t1 = blocoPessoa($('#retT1'), 'retT1', { titulo: 'Testemunha 1', completo: false });
      const t2 = blocoPessoa($('#retT2'), 'retT2', { titulo: 'Testemunha 2', completo: false });
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
      // quem requer / modelo / tipo de assento / motivo / fundamento
      const quem = () => raiz.querySelector('[name=retQuem]:checked').value;
      raiz.querySelectorAll('[name=retQuem]').forEach((r) => r.addEventListener('change', () => {
        $('#retRepres').hidden = quem() === 'proprio';
        $('#retProcLbl').hidden = quem() !== 'procurador';
      }));
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
      $('#retTipo').addEventListener('change', () => {
        const t = $('#retTipo').value, cas = t.startsWith('B');
        $('#retN1Lbl').firstChild.textContent = cas ? 'Nome do 1º contraente ' : t.startsWith('C') ? 'Nome do(a) falecido(a) ' : 'Nome do(a) registrado(a) ';
        $('#retN2Lbl').hidden = !cas;
      });
      $('#retFundTipo').addEventListener('change', () => {
        $('#retFund').value = { '97e110': 'nos termos dos arts. 97 e 110 da Lei nº 6.015/1973', 97: 'nos termos do art. 97 da Lei nº 6.015/1973', 110: 'nos termos do art. 110 da Lei nº 6.015/1973' }[$('#retFundTipo').value];
      });
      return { destino, req, t1, t2, fech, quem, modelo, addLinha, caixa, motivo, campoChave: req.el('nome'), resetMotivo: () => { motivoEditado = false; } };
    },
    camposZerar: () => [$('#retTipo'), $('#retLivro'), $('#retFolha'), $('#retTermo')],
    limparExtra(ctx) {
      ctx.destino.limpar(); ctx.req.limpar(); ctx.t1.limpar(); ctx.t2.limpar(); ctx.fech.reiniciarData();
      ctx.caixa.innerHTML = ''; ctx.addLinha();
      $('#retRepres').hidden = true; $('#retTest').hidden = true; $('#retN2Lbl').hidden = true;
      $('#retN1Lbl').firstChild.textContent = 'Nome do(a) registrado(a) ';
      ctx.resetMotivo(); ctx.motivo(true);
    },
    gerar(ctx, erros) {
      const dest = ctx.destino.texto();
      if (!dest) { erros.push('Cartório de destino'); ctx.destino.el.classList.add('invalido'); }
      const q = ctx.quem(), comTest = ctx.modelo() === 'testemunhas';
      ctx.req.validar(erros, 'Requerente', ['nome', 'sexo', 'nacionalidade', 'estadoCivil', 'logradouro', 'numero'].concat(comTest ? [] : ['cpf']));
      if (q !== 'proprio' && !limpo($('#retRepNome').value)) { erros.push('Nome do(a) representado(a)'); $('#retRepNome').classList.add('invalido'); }
      [['#retTipo', 'Tipo de assento'], ['#retLivro', 'Livro nº'], ['#retFolha', 'Folha'], ['#retTermo', 'Termo nº'], ['#retN1', 'Nome que consta no registro']].forEach(([s, r]) => {
        if (!limpo($(s).value)) { erros.push(r); $(s).classList.add('invalido'); }
      });
      const tipo = $('#retTipo').value;
      if (tipo.startsWith('B') && !limpo($('#retN2').value)) { erros.push('Nome do 2º contraente'); $('#retN2').classList.add('invalido'); }
      const corr = [...ctx.caixa.children].map((d) => {
        const g = (k) => d.querySelector(`[data-k=${k}]`);
        const campo = g('campo').value === 'Outro' ? limpo(g('outro').value) : g('campo').value;
        if (!limpo(g('consta').value)) { g('consta').classList.add('invalido'); }
        if (!limpo(g('deve').value)) { g('deve').classList.add('invalido'); }
        if (g('campo').value === 'Outro' && !campo) g('outro').classList.add('invalido');
        return { campo, consta: limpo(g('consta').value), deve: limpo(g('deve').value) };
      });
      if (corr.some((c) => !c.campo || !c.consta || !c.deve)) erros.push('Correções: preencha o campo, "onde consta" e "deve constar" de cada linha');
      if (comTest) {
        ctx.t1.validar(erros, 'Testemunha 1', ['nome', 'cpf', 'logradouro', 'numero']);
        ctx.t2.validar(erros, 'Testemunha 2', ['nome', 'cpf', 'logradouro', 'numero']);
        if (!limpo($('#retMotivo').value)) { erros.push('Texto do motivo das testemunhas'); $('#retMotivo').classList.add('invalido'); }
      }
      ctx.fech.validar(erros);
      if (erros.length) return null;

      const r = ctx.req.ler(), f = ctx.fech.ler(), s = r.sexo;
      const assento = ASSENTOS.find((a) => a[0] === tipo)[2];
      const nomes = tipo.startsWith('B') ? `${up($('#retN1').value)} e ${up($('#retN2').value)}` : up(limpo($('#retN1').value));
      const rep = up(limpo($('#retRepNome').value));
      let qualidade = '';
      if (q === 'representante') qualidade = `, na qualidade de representante legal de ${rep}`;
      if (q === 'procurador') qualidade = `, na qualidade de ${gx(s, 'procurador', 'procuradora')} de ${rep}${limpo($('#retProcTxt').value) ? `, conforme procuração ${limpo($('#retProcTxt').value)}` : ''}`;
      const blocos = [
        { p: [R(dest, true)], al: 'e', depois: 16, tam: 11 },
        { p: [R(r.nome, true), `, ${qualificacao(r)}${qualidade}, vem, por meio deste, requerer a retificação, ${limpo($('#retFund').value)}, do assento de ${assento} de `, R(nomes, true),
          `, lavrado no Livro ${livroTxt(tipo, limpo($('#retLivro').value))}, fls. ${limpo($('#retFolha').value)}, termo nº ${limpo($('#retTermo').value)}, para que conste:`], ind: 40 },
      ];
      const letras = 'abcdefghijklmnopqrstuvwxyz';
      corr.forEach((c, i) => blocos.push({ p: [`${letras[i] || i + 1}) ${c.campo}: onde consta “`, R(up(c.consta), true), '”, deve constar “', R(up(c.deve), true), `”${i === corr.length - 1 ? '.' : ';'}`], esqBloco: 40, depois: 3 }));
      blocos.push({ p: [`Tudo conforme os documentos comprobatórios anexos. Certifico que os documentos apresentados ${gx(s, 'pelo', 'pela')} requerente são originais.`], ind: 40, antes: 6 });
      if (comTest) {
        blocos.push({ p: [limpo($('#retMotivo').value)], ind: 40, tam: 10 });
        [ctx.t1.ler(), ctx.t2.ler()].forEach((t) => blocos.push({ p: [R(t.nome, true), `, ${qualificacao(t, { completo: false })}.`], ind: 40, tam: 10, depois: 3 }));
      }
      blocos.push({ p: ['Termos em que, pede deferimento.'], ind: 40, antes: 4 });
      if ($('#retIsento').checked) blocos.push({ p: [R('ISENTO', true), ' – erro imputável ao cartório (art. 110, § 5º, da Lei nº 6.015/1973).'], tam: 10, antes: 4 });
      const assReq = { ass: { nome: [R(r.nome, true)], linhas: q === 'proprio' ? [] : [[q === 'representante' ? `Representante legal de ${rep}` : `${gx(s, 'Procurador', 'Procuradora')} de ${rep}`]], esq: 40, larg: 340 } };
      const assin = [assReq];
      if (comTest) {
        const [a, b] = [ctx.t1.ler(), ctx.t2.ler()];
        assin.push({ lado: [{ nome: [R('TESTEMUNHA 1: ', true), R(a.nome, true)], linhas: [[`CPF: ${a.cpf}`]], larg: 215 }, { nome: [R('TESTEMUNHA 2: ', true), R(b.nome, true)], linhas: [[`CPF: ${b.cpf}`]], larg: 215 }] });
      }
      return {
        titulo: 'Requerimento de retificação', arquivo: nomeArquivo('retificacao', r.nome), chave: r.nome,
        blocos: blocos.concat(fechamentoBlocos(f, assin)),
      };
    },
  });

  // =====================================================================
  // 2) ALTERAÇÃO DE PRENOME (art. 56)
  // =====================================================================
  const pre = criarAba({
    nome: 'prenome', raiz: $('#abaPrenome'), id: 'pre',
    montar(raiz) {
      raiz.insertAdjacentHTML('beforeend', `
        <p class="aviso">Só para maiores de 18 anos, e o pedido é sempre pessoal (sem representante ou procurador). A alteração imotivada de prenome pela via extrajudicial só pode ser feita uma vez (art. 56, § 1º, da Lei nº 6.015/1973).</p>
        <p class="aviso" id="preAvisoNova" hidden>Minuta nova: o requerente mudou, então o livro, a folha e o termo foram zerados.</p>
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
      const fech = blocoFechamento(raiz, 'preF');
      // nome novo automático
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
      // aviso de menor
      req.el('nascimento').addEventListener('change', () => {
        const i = idade(req.el('nascimento').value);
        const m = $('#preMenor');
        if (i !== null && i < 18) { m.textContent = `O requerente tem ${i} anos. A alteração de prenome pelo art. 56 só pode ser pedida depois de atingida a maioridade civil.`; m.hidden = false; } else m.hidden = true;
      });
      [['#preIcn', '#preIcnN'], ['#preRgUf', '#preRgUfN'], ['#prePass', '#prePassN']].forEach(([s, n]) => {
        const sync = () => { $(n).disabled = $(s).value !== 'sim'; if ($(n).disabled) $(n).value = ''; };
        $(s).addEventListener('change', sync); sync();
      });
      return { destino, req, fech, campoChave: req.el('nome'), resetNome: () => { nomeEditado = false; } };
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
      ctx.fech.validar(erros);
      if (erros.length) return null;
      const f = ctx.fech.ler(), s = r.sexo, g = (m, fe) => gx(s, m, fe);
      const docs = [
        $('#preIcn').value === 'sim' ? `possui Identificação Civil Nacional (ICN) nº ${limpo($('#preIcnN').value)}` : 'não possui Identificação Civil Nacional (ICN)',
        $('#preRgUf').value === 'sim' ? `possui cédula de identidade RG emitida em outra unidade da Federação, nº ${limpo($('#preRgUfN').value)}` : 'não possui cédula de identidade RG emitida em outra unidade da Federação',
        $('#prePass').value === 'sim' ? `possui passaporte nº ${limpo($('#prePassN').value)}` : 'não possui passaporte',
      ];
      const titulo = limpo($('#preTitulo').value);
      const blocos = [
        { p: [R('Requerimento de alteração de prenome – art. 56 da Lei nº 6.015/1973', true)], al: 'c', depois: 12 },
        { p: [R(dest, true)], al: 'e', depois: 14 },
        { p: [R('I – REQUERENTE:', true)], al: 'e', depois: 2 },
        { p: [R(r.nome, true), `, ${qualificacao(r)}.`] },
        { p: [R('II – REQUERIMENTO:', true)], al: 'e', antes: 6, depois: 2 },
        { p: [`Com fulcro no disposto pelo artigo 56 da Lei nº 6.015/1973, ${g('o', 'a')} requerente acima ${g('indicado', 'indicada')}, ${g('registrado', 'registrada')} conforme o Livro A-${limpo($('#preLivro').value)}, fls. ${limpo($('#preFolha').value)}, termo nº ${limpo($('#preTermo').value)}, vem, respeitosamente, requerer a V. Sa. a INSTAURAÇÃO DE PROCEDIMENTO PARA ALTERAÇÃO DE PRENOME, substituindo o prenome `, R(up(limpo($('#prePrenAtual').value)), true), ' por ', R(up(limpo($('#prePrenNovo').value)), true), `, de modo que passe a ser ${g('identificado', 'identificada')} como: `, R(up(limpo($('#preNomeNovo').value)), true), '.'] },
        { p: [R('III – DECLARAÇÕES SOB AS PENAS DA LEI:', true)], al: 'e', antes: 6, depois: 2 },
        { p: [`${g('O', 'A')} requerente DECLARA que:`], depois: 2 },
        { p: ['a) a alteração ora requerida está de acordo com seu nome atual e que responde civil e criminalmente pela veracidade desta afirmação. Declara, ainda, que não é parte em ação judicial em trâmite sobre alteração de prenome ou, em caso de ação judicial com o referido escopo, que a mesma já foi devidamente arquivada, conforme certidão anexa;'], esqBloco: 20, depois: 2 },
        { p: [`b) ${docs.join('; ')}${titulo ? `; e seu título de eleitor é o de nº ${titulo}` : ''};`], esqBloco: 20, depois: 2 },
        { p: [`c) está ${g('ciente', 'ciente')} de que não será admitida outra alteração de prenome por este procedimento diretamente perante Oficial de Registro Civil das Pessoas Naturais, resguardada a via judicial;`], esqBloco: 20, depois: 2 },
        { p: ['d) está ciente de que deverá promover a alteração nos demais registros que lhe digam respeito, direta ou indiretamente, e nos respectivos documentos de identificação.'], esqBloco: 20 },
        { p: [R('IV – FUNDAMENTO JURÍDICO:', true)], al: 'e', antes: 6, depois: 2 },
        { p: ['O presente requerimento está fundamentado no artigo 56 da Lei nº 6.015/1973.'] },
        { p: ['Por ser verdade, firmo o presente termo.'], antes: 4 },
      ];
      return {
        titulo: 'Requerimento de alteração de prenome', arquivo: nomeArquivo('alteracao-prenome', r.nome), chave: r.nome,
        blocos: blocos.concat(fechamentoBlocos(f, [{ ass: { nome: [R(r.nome, true)], linhas: [[`Assinatura ${g('do', 'da')} requerente`]], larg: 340 } }], { docsOriginais: $('#preDocsOrig').checked })),
      };
    },
  });

  // =====================================================================
  // 3) ALTERAÇÃO DE SOBRENOME (art. 57)
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
        <p class="aviso" id="sobAvisoNova" hidden>Minuta nova: o requerente mudou, então o livro, a folha e o termo foram zerados.</p>`);
      const destino = blocoDestino(raiz, 'sobD');
      raiz.insertAdjacentHTML('beforeend', `
        <fieldset><legend>Hipótese</legend>
          <label>Hipótese do art. 57 <select id="sobHip"><option value="" selected>Selecione</option>
            ${Object.entries(HIPOTESES).map(([k, h]) => `<option value="${k}">${h.rot}</option>`).join('')}</select></label>
          <p class="dica" id="sobHipDica"></p>
        </fieldset>
        <fieldset><legend>Requerente</legend><div id="sobReq"></div>
          <div id="sobMenorBox" hidden>
            <p class="aviso">Requerente menor de 18 anos: o requerimento sai em nome do menor, representado por pai ou mãe, que assina.</p>
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
        // Inclusão do sobrenome do cônjuge: avisa se o nome novo não mantém nenhum sobrenome do nome atual.
        const h = hip(), op = $('#sobOp').value;
        const atual = up(limpo(req.el('nome').value)).split(' ').slice(1).filter((w) => w.length > 2);
        const novo = up(limpo($('#sobNomeNovo').value)).split(' ');
        $('#sobAvisoAsc').hidden = !(['II', 'UE'].includes(h) && op === 'incluir' && atual.length && novo.length > 1 && !atual.some((w) => novo.includes(w)));
      }
      $('#sobHip').addEventListener('change', atualizar);
      $('#sobOp').addEventListener('change', atualizar);
      [req.el('nome'), $('#sobSob')].forEach((e) => e.addEventListener('input', sugerir));
      $('#sobNomeNovo').addEventListener('input', () => { nomeEditado = true; verificarAsc(); });
      // menor de 18 → representante; procurador só para maior
      function verIdade() {
        const i = idade(req.el('nascimento').value);
        const menor = i !== null && i < 18;
        $('#sobMenorBox').hidden = !menor;
        $('#sobProcBox').hidden = menor;
        if (menor) { $('#sobProc').checked = false; $('#sobProcCampos').hidden = true; }
      }
      req.el('nascimento').addEventListener('change', verIdade);
      $('#sobProc').addEventListener('change', () => { $('#sobProcCampos').hidden = !$('#sobProc').checked; });
      $('#sobProcCpf').addEventListener('input', () => { $('#sobProcCpf').value = B.mascaraCPF($('#sobProcCpf').value); });
      $('#sobProcData').addEventListener('change', () => {
        const d = diasDesde($('#sobProcData').value), m = $('#sobProcVelha');
        if (d !== null && d > 90) { m.textContent = `A escritura foi lavrada há ${d} dias. A representação por procurador exige escritura pública lavrada há menos de 90 dias (art. 515-O do Código Nacional de Normas).`; m.hidden = false; } else m.hidden = true;
      });
      return { destino, req, rep, fech, hip, atualizar, verIdade, campoChave: req.el('nome'), resetNome: () => { nomeEditado = false; } };
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
      const i = idade(r.nascimento), menor = i !== null && i < 18;
      if (!menor) ctx.req.validar(erros, 'Requerente', ['cpf', 'rg']);
      if (menor) ctx.rep.validar(erros, 'Representante', ['nome', 'sexo', 'cpf', 'rg']);
      const proc = !menor && $('#sobProc').checked;
      if (proc) [['#sobProcNome', 'Nome do(a) procurador(a)'], ['#sobProcTab', 'Tabelionato da procuração'], ['#sobProcData', 'Data da escritura']].forEach(([s, rt]) => {
        if (!limpo($(s).value)) { erros.push(rt); $(s).classList.add('invalido'); }
      });
      const cas = ['II', 'III', 'UE'].includes(h), nasc = ['I', 'IV'].includes(h);
      if (cas) [['#sobConj', 'Nome do cônjuge/companheiro'], ['#sobCasLocal', 'Local do casamento/união'], ['#sobCasData', 'Data do casamento/união'], ['#sobCasLivro', 'Livro'], ['#sobCasFolha', 'Folha'], ['#sobCasTermo', 'Termo']].forEach(([s, rt]) => {
        if (!limpo($(s).value)) { erros.push(rt); $(s).classList.add('invalido'); }
      });
      if (nasc) [['#sobNascLivro', 'Livro A'], ['#sobNascFolha', 'Folha'], ['#sobNascTermo', 'Termo']].forEach(([s, rt]) => {
        if (!limpo($(s).value)) { erros.push(`Registro de nascimento: ${rt}`); $(s).classList.add('invalido'); }
      });
      if (h === 'IV' && !limpo($('#sobOrigem').value)) { erros.push('Alteração de filiação que motiva o pedido'); $('#sobOrigem').classList.add('invalido'); }
      [['#sobOp', 'Incluir ou excluir'], ['#sobSob', 'Sobrenome(s) a incluir/excluir'], ['#sobNomeNovo', 'Nome completo que passará a usar']].forEach(([s, rt]) => {
        if (!limpo($(s).value)) { erros.push(rt); $(s).classList.add('invalido'); }
      });
      ctx.fech.validar(erros);
      if (erros.length) return null;

      const f = ctx.fech.ler(), s = r.sexo, g = (m, fe) => gx(s, m, fe);
      const op = $('#sobOp').value, sobn = up(limpo($('#sobSob').value)), novo = up(limpo($('#sobNomeNovo').value));
      const H = HIPOTESES[h];
      // Qualificação + representação
      const qual = [R(r.nome, true), `, ${qualificacao(r)}`];
      if (menor) {
        const p = ctx.rep.ler(), qualRep = $('#sobRepQual').value === 'pai' ? 'seu pai' : 'sua mãe';
        qual.push(`, menor, neste ato ${g('representado', 'representada')} por ${qualRep}, `, R(p.nome, true), `, ${qualificacao(p, { completo: false })}`);
      }
      if (proc) {
        const pn = up(limpo($('#sobProcNome').value)), pc = limpo($('#sobProcCpf').value);
        qual.push(`, neste ato ${g('representado', 'representada')} por seu(sua) procurador(a) `, R(pn, true), pc ? `, inscrito(a) no CPF/MF sob o nº ${pc}` : '',
          `, conforme procuração lavrada no ${limpo($('#sobProcTab').value)}${limpo($('#sobProcLivro').value) ? `, Livro ${limpo($('#sobProcLivro').value)}` : ''}${limpo($('#sobProcFls').value) ? `, fls. ${limpo($('#sobProcFls').value)}` : ''}, em ${dataBR($('#sobProcData').value)}`);
      }
      qual.push('.');
      // Texto do requerimento
      const conj = up(limpo($('#sobConj').value)), local = limpo($('#sobCasLocal').value), data = dataBR($('#sobCasData').value);
      const ref = `Livro ${h === 'UE' ? 'E' : 'B'}-${limpo($('#sobCasLivro').value)}, fls. ${limpo($('#sobCasFolha').value)}, termo nº ${limpo($('#sobCasTermo').value)}`;
      const refNasc = `Livro A-${limpo($('#sobNascLivro').value)}, fls. ${limpo($('#sobNascFolha').value)}, termo nº ${limpo($('#sobNascTermo').value)}`;
      const acao = `com vistas a ${op === 'incluir' ? 'INCLUIR' : 'EXCLUIR'} o(s) sobrenome(s) `;
      const solteiro = op === 'excluir' && $('#sobSolteiro').checked ? `, retornando ao uso do nome de ${g('solteiro', 'solteira')}` : '';
      let contexto;
      if (h === 'II') contexto = `${g('o', 'a')} requerente, ${g('casado', 'casada')} com ${conj}, cujo casamento realizou-se em ${local} aos ${data}, conforme ${ref}`;
      else if (h === 'UE') contexto = `${g('o', 'a')} requerente, ${g('convivente', 'convivente')} em união estável com ${conj}, registrada em ${local} aos ${data}, conforme ${ref}`;
      else if (h === 'III') contexto = `${g('o', 'a')} requerente, cujo casamento com ${conj}, realizado em ${local} aos ${data}, conforme ${ref}, foi dissolvido por ${$('#sobDiss').value}`;
      else if (h === 'I') contexto = `${g('o', 'a')} requerente, ${g('registrado', 'registrada')} conforme ${refNasc}${limpo($('#sobOrigem').value) ? ` (${limpo($('#sobOrigem').value)})` : ''}`;
      else contexto = `${g('o', 'a')} requerente, ${g('registrado', 'registrada')} conforme ${refNasc}, em razão de alteração das relações de filiação (${limpo($('#sobOrigem').value)})`;
      const extra = h === 'III' ? ', adquirido(s) em razão do casamento' : h === 'I' ? ' familiar(es)' : '';
      const blocos = [
        { p: [R('Requerimento de inclusão/exclusão de sobrenome – art. 57 da Lei nº 6.015/1973', true)], al: 'c', depois: 12 },
        { p: [R(dest, true)], al: 'e', depois: 14 },
        { p: [R('– REQUERENTE:', true)], al: 'e', depois: 2 },
        { p: qual },
        { p: [R('– REQUERIMENTO:', true)], al: 'e', antes: 6, depois: 2 },
        { p: [`Com fulcro no disposto pelo artigo 57, ${H.inciso}, da Lei nº 6.015/1973, ${contexto}, vem, respeitosamente, requerer a V. Sa. a INSTAURAÇÃO DE PROCEDIMENTO PARA ALTERAÇÃO DE NOME, ${acao}`, R(sobn, true), `${extra}${solteiro}, passando a ser ${g('identificado', 'identificada')} como: `, R(novo, true), '.'] },
        { p: [R('– DECLARAÇÕES SOB AS PENAS DA LEI:', true)], al: 'e', antes: 6, depois: 2 },
        { p: [`${g('O', 'A')} REQUERENTE DECLARA que a alteração ora requerida está de acordo com seu nome atual e que responde civil e criminalmente pela veracidade desta afirmação. Declara, ainda, que não é parte em ação judicial em trâmite sobre alteração de sobrenome ou, em caso de ação judicial com o referido escopo, que a mesma já foi devidamente arquivada, conforme certidão anexa.`] },
        { p: [R('– FUNDAMENTO JURÍDICO:', true)], al: 'e', antes: 6, depois: 2 },
        { p: [`O presente requerimento está fundamentado no artigo 57, ${H.inciso}, da Lei nº 6.015/1973.`] },
      ];
      let ass;
      if (menor) { const p = ctx.rep.ler(); ass = { ass: { nome: [R(p.nome, true)], linhas: [[`Representante legal de ${r.nome}`]], larg: 340 } }; }
      else if (proc) ass = { ass: { nome: [R(up(limpo($('#sobProcNome').value)), true)], linhas: [[`Procurador(a) de ${r.nome}`]], larg: 340 } };
      else ass = { ass: { nome: [R(r.nome, true)], larg: 340 } };
      return {
        titulo: 'Requerimento de alteração de sobrenome', arquivo: nomeArquivo('alteracao-sobrenome', r.nome), chave: r.nome,
        blocos: blocos.concat(fechamentoBlocos(f, [ass])),
      };
    },
  });

  window.MinutasNovas = { ret, pre, sob }; // para testes no navegador
})();
