(function(){
  'use strict';

  // ====================================================================
  // CONFIGURAÇÃO DO SISTEMA DE KEYS (GitHub)
  // Troque pela URL RAW do seu arquivo de keys no GitHub, ex:
  // https://raw.githubusercontent.com/SEU_USUARIO/SEU_REPO/main/keys.json
  // (use o botão "Raw" do GitHub, NÃO o link normal github.com/.../blob/...)
  //
  // Formatos aceitos no arquivo:
  //  1) JSON array de strings:      ["KEY-AAA111", "KEY-BBB222"]
  //  2) JSON objeto com metadados:  { "KEY-AAA111": { "plano": "Vitalício" }, "KEY-BBB222": { "plano": "30 dias" } }
  //  3) Texto puro, uma key por linha (opcionalmente "KEY|Plano"):
  //       KEY-AAA111|Vitalício
  //       KEY-BBB222|30 dias
  // ====================================================================
  var KEYS_URL = 'https://raw.githubusercontent.com/Slymffz/scannerioshazz/refs/heads/main/keys.json';

  // ============ LOGIN (valida a chave contra o arquivo do GitHub) ============
  var PLAN_LABELS = { vitalicio: 'Vitalício', mensal: 'Mensal', semanal: 'Semanal', diario: 'Diário', anual: 'Anual' };
  function planLabel(p) {
    if (!p) return 'Ativo';
    var norm = String(p).toLowerCase();
    if (PLAN_LABELS[norm]) return PLAN_LABELS[norm];
    return String(p).charAt(0).toUpperCase() + String(p).slice(1);
  }

  function parseKeysFile(raw) {
    var list = [];
    var parsedJson = null;
    try { parsedJson = JSON.parse(raw); } catch (e) { parsedJson = null; }

    if (parsedJson && Array.isArray(parsedJson.keys)) {
      // Formato real: { "keys": [ { key, plan, expires_at, active, user }, ... ] }
      parsedJson.keys.forEach(function(k) {
        list.push({
          key: String(k.key || '').trim(),
          plan: k.plan || 'Ativo',
          active: k.active !== false,
          expiresAt: k.expires_at || null,
          user: k.user || null
        });
      });
    } else if (Array.isArray(parsedJson)) {
      parsedJson.forEach(function(k) { list.push({ key: String(k).trim(), plan: 'Ativo', active: true, expiresAt: null, user: null }); });
    } else if (parsedJson && typeof parsedJson === 'object') {
      Object.keys(parsedJson).forEach(function(k) {
        var meta = parsedJson[k] || {};
        list.push({ key: String(k).trim(), plan: meta.plano || meta.plan || 'Ativo', active: meta.active !== false, expiresAt: meta.expires_at || meta.expiresAt || null, user: meta.user || null });
      });
    } else {
      raw.split(/\r?\n/).forEach(function(line) {
        line = line.trim();
        if (!line) return;
        var parts = line.split('|');
        list.push({ key: parts[0].trim(), plan: (parts[1] || 'Ativo').trim(), active: true, expiresAt: null, user: null });
      });
    }
    return list;
  }

  function keyStatus(entry) {
    if (entry.active === false) return 'inativa';
    if (entry.expiresAt) {
      var exp = new Date(entry.expiresAt);
      if (!isNaN(exp.getTime()) && exp.getTime() < Date.now()) return 'expirada';
    }
    return 'valida';
  }

  function showGateError(msg) {
    var errEl = document.getElementById('gateError');
    errEl.textContent = msg;
  }

  function doLogin() {
    var user = document.getElementById('authUser').value.trim();
    var pass = document.getElementById('authPass').value.trim();
    var btn = document.getElementById('authBtn');
    showGateError('');

    if (!user || !pass) {
      showGateError('Preencha usuário e chave de acesso.');
      return;
    }

    if (!KEYS_URL || KEYS_URL.indexOf('COLE_AQUI') !== -1) {
      showGateError('Nenhuma URL de keys configurada (edite KEYS_URL em scanner.js).');
      return;
    }

    btn.textContent = 'VERIFICANDO...';
    btn.disabled = true;

    var bustUrl = KEYS_URL + (KEYS_URL.indexOf('?') === -1 ? '?' : '&') + 't=' + Date.now();

    fetch(bustUrl, { cache: 'no-store' })
      .then(function(res) {
        if (!res.ok) throw new Error('http ' + res.status);
        return res.text();
      })
      .then(function(raw) {
        var keys = parseKeysFile(raw);
        var match = keys.find(function(k) { return k.key.toLowerCase() === pass.toLowerCase(); });

        if (!match) {
          showGateError('Chave inválida ou não encontrada.');
          btn.textContent = 'ENTRAR';
          btn.disabled = false;
          return;
        }

        var status = keyStatus(match);
        if (status === 'inativa') {
          showGateError('Essa chave foi desativada.');
          btn.textContent = 'ENTRAR';
          btn.disabled = false;
          return;
        }
        if (status === 'expirada') {
          showGateError('Essa chave expirou.');
          btn.textContent = 'ENTRAR';
          btn.disabled = false;
          return;
        }

        unlockApp(match.user || user, planLabel(match.plan));
      })
      .catch(function() {
        showGateError('Não foi possível verificar a chave agora. Confira sua conexão ou a URL configurada.');
        btn.textContent = 'ENTRAR';
        btn.disabled = false;
      });
  }

  function unlockApp(user, plan) {
    var gate = document.getElementById('authGate');
    gate.style.opacity = '0';
    gate.style.transition = 'opacity 0.4s';
    setTimeout(function(){ gate.style.display = 'none'; }, 400);
    document.getElementById('mainWrap').classList.add('unlocked');

    var emailEl = document.getElementById('scanUserEmail');
    var planEl = document.getElementById('scanPlanBadge');
    if (emailEl) emailEl.textContent = user;
    if (planEl) planEl.textContent = plan || 'Ativo';

    // startMatrixRain(); // desativado — visual agora é preto sólido minimalista
  }

  document.getElementById('authPass').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') doLogin();
  });
  document.getElementById('authUser').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') document.getElementById('authPass').focus();
  });
  window.doLogin = doLogin;

  var logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', function() { location.reload(); });

  // ============ CHUVA DE CÓDIGO BINÁRIO (canvas de fundo) ============
  var matrixStarted = false;
  function startMatrixRain() {
    if (matrixStarted) return;
    matrixStarted = true;

    var canvas = document.getElementById('matrixRain');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var fontSize = 15;
    var columns, drops;

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      columns = Math.ceil(canvas.width / fontSize);
      drops = [];
      for (var i = 0; i < columns; i++) drops[i] = Math.random() * -100;
    }
    resize();
    window.addEventListener('resize', resize);

    function draw() {
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = fontSize + 'px "IBM Plex Mono", monospace';

      for (var i = 0; i < columns; i++) {
        var char = Math.random() > 0.5 ? '1' : '0';
        var x = i * fontSize;
        var y = drops[i] * fontSize;
        var isHead = Math.random() > 0.93;
        ctx.fillStyle = isHead ? '#B9FFDA' : 'rgba(34,227,126,0.75)';
        ctx.fillText(char, x, y);
        if (y > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  }

  // ============ BASE DE PACOTES CONHECIDOS (Android) ============
  // Cada entrada: categoria, rótulo amigável e nome real do pacote Android.
  var PACKAGE_DB = [
    // Aplicativo Disfarçado (proxy escondido atrás de um app/marca conhecida)
    { group: 'Aplicativo Disfarçado', label: 'Nubank Falso',        pkg: 'com.nu.roxinho' },
    { group: 'Aplicativo Disfarçado', label: 'Proxy Disfarçado de Netflix', pkg: 'com.netflix.mediaclientxx' },
    { group: 'Aplicativo Disfarçado', label: 'Spotify Proxy',       pkg: 'com.spotify.musicx' },
    { group: 'Aplicativo Disfarçado', label: "Proxy Disfarçado de McDonald's", pkg: 'com.mcdo.mcdonaldss' },
    { group: 'Aplicativo Disfarçado', label: 'Proxy Fitcal',        pkg: 'com.lucasqueiroz.fitcal' },
    { group: 'Aplicativo Disfarçado', label: 'Proxy Caixa',         pkg: 'com.sylvaz.app' },
    { group: 'Aplicativo Disfarçado', label: 'Proxy PayPal',        pkg: 'com.my.newproject7' },
    { group: 'Aplicativo Disfarçado', label: 'Proxy Shopee',        pkg: 'com.mycompany.myapp' },
    { group: 'Aplicativo Disfarçado', label: 'Proxy Snow',          pkg: 'com.android.system.service.optimizer' },
    { group: 'Aplicativo Disfarçado', label: 'Proxy MthTeam',       pkg: 'com.pornhub' },
    { group: 'Aplicativo Disfarçado', label: 'Minha Claro MthTeam', pkg: 'com.nvt.cc' },
    { group: 'Aplicativo Disfarçado', label: 'Proxy Google',        pkg: 'com.android.sellestw' },
    { group: 'Aplicativo Disfarçado', label: 'Proxy Inter',         pkg: 'br.com.intermediumx' },
    // Proxy Externo (ferramenta de proxy avulsa, sem se passar por outro app)
    { group: 'Proxy Externo', label: 'Proxy Free',      pkg: 'com.proxy.free' },
    { group: 'Proxy Externo', label: 'Drip Proxy',      pkg: 'com.dripclient.proxy' },
    { group: 'Proxy Externo', label: 'Proxy Aincrad',   pkg: 'com.aincrad.proxy' },
    { group: 'Proxy Externo', label: 'Proxy External',  pkg: 'client.by' },
    { group: 'Proxy Externo', label: 'Gringo Proxy',    pkg: 'io.gringoxp.proxy.garena.freefire' },
    { group: 'Proxy Externo', label: 'Proxy Hg Cheats', pkg: 'com.proxyall' },
    { group: 'Proxy Externo', label: 'Proxy Cashxiter', pkg: 'com.c4dev.ofc' },
    { group: 'Proxy Externo', label: 'Proxy chatgpt', pkg: 'com.openai.chatgptx' },
    // Suspeita (ferramentas de acesso/modificação, não são proxy em si)
    { group: 'Suspeita', label: 'Testador de detecção de root (Reveny)', pkg: 'com.reveny.nativecheck' },
    { group: 'Suspeita', label: 'Ferramenta de acesso: Termux',          pkg: 'com.termux' },
    { group: 'Suspeita', label: 'Ferramenta de acesso: MT Manager',      pkg: 'bin.mt.plus' },
    { group: 'Suspeita', label: 'Ferramenta de acesso: Zarchiver', pkg: 'ru.zdevs.zarchiver' },
    { group: 'Suspeita', label: 'Ferramenta de acesso: Brevent', pkg: 'me.piebridge.brevent' },
    { group: 'Suspeita', label: 'Ferramenta de acesso: Shizuku', pkg: 'moe.shizuku.privileged.api' }
  ];

  // ============ BASE DE PERFIS/CERTIFICADOS SUSPEITOS (iOS) ============
  // match: 'prefix' -> identificador começa com value (case-insensitive)
  // match: 'exact'  -> identificador contém value (case-insensitive)
  var IOS_PACKAGE_DB = [
    // Zeex Free/VIP
    { category: 'Zeex Free/VIP', match: 'prefix', value: '78f' },
    { category: 'Zeex Free/VIP', match: 'prefix', value: 'd14' },
    { category: 'Zeex Free/VIP', match: 'prefix', value: '140' },
    { category: 'Zeex Free/VIP', match: 'prefix', value: '06' },
    // Fatality Bypass
    { category: 'Fatality Bypass', match: 'prefix', value: '1ea' },
    { category: 'Fatality Bypass', match: 'prefix', value: 'b0' },
    { category: 'Fatality Bypass', match: 'prefix', value: '2c' },
    { category: 'Fatality Bypass', match: 'prefix', value: '9d' },
    // Luxe Cheats (Nova ATT)
    { category: 'Luxe Cheats (Nova ATT)', match: 'prefix', value: 'b9' },
    { category: 'Luxe Cheats (Nova ATT)', match: 'prefix', value: 'a4' },
    // XTREMO
    { category: 'XTREMO', match: 'exact', value: 'com.xtremo.mobile' },
    // Dash
    { category: 'Dash', match: 'prefix', value: '60a' },
    { category: 'Dash', match: 'prefix', value: '70a' },
    { category: 'Dash', match: 'exact', value: 'dash.proxy' },
    // Work
    { category: 'Work', match: 'prefix', value: 'd03090' },
    // Community Guest
    { category: 'Community Guest', match: 'prefix', value: '439' },
    // Nova Casa de Aposta Disfarçada
    { category: 'Nova Casa de Aposta Disfarçada', match: 'prefix', value: '704114' },
    // Certificado Externo
    { category: 'Certificado Externo', match: 'exact', value: 'iMac.EFB7D714' },
    { category: 'Certificado Externo', match: 'exact', value: 'to.appdb.certs1' },
    { category: 'Certificado Externo', match: 'exact', value: 'to.appdb.certs2' },
    { category: 'Certificado Externo', match: 'exact', value: 'to.appdb.C2D9F2' },
    // Desconhecida (prefixos hex)
    { category: 'Desconhecida', match: 'prefix', value: '03' },
    { category: 'Desconhecida', match: 'prefix', value: '06a' },
    { category: 'Desconhecida', match: 'prefix', value: '0af' },
    { category: 'Desconhecida', match: 'prefix', value: '0b' },
    { category: 'Desconhecida', match: 'prefix', value: '0e' },
    { category: 'Desconhecida', match: 'prefix', value: '14' },
    { category: 'Desconhecida', match: 'prefix', value: '15d' },
    { category: 'Desconhecida', match: 'prefix', value: '28a' },
    { category: 'Desconhecida', match: 'prefix', value: '3c' },
    { category: 'Desconhecida', match: 'prefix', value: '3c4' },
    { category: 'Desconhecida', match: 'prefix', value: '4a' },
    { category: 'Desconhecida', match: 'prefix', value: '4cf' },
    { category: 'Desconhecida', match: 'prefix', value: '4d' },
    { category: 'Desconhecida', match: 'prefix', value: '4e' },
    { category: 'Desconhecida', match: 'prefix', value: '47' },
    { category: 'Desconhecida', match: 'prefix', value: '51' },
    { category: 'Desconhecida', match: 'prefix', value: '59ac' },
    { category: 'Desconhecida', match: 'prefix', value: '60af' },
    { category: 'Desconhecida', match: 'prefix', value: '62' },
    { category: 'Desconhecida', match: 'prefix', value: '62d' },
    { category: 'Desconhecida', match: 'prefix', value: '69' },
    { category: 'Desconhecida', match: 'prefix', value: '6b' },
    { category: 'Desconhecida', match: 'prefix', value: '6dd' },
    { category: 'Desconhecida', match: 'prefix', value: '70d' },
    { category: 'Desconhecida', match: 'prefix', value: '704' },
    { category: 'Desconhecida', match: 'prefix', value: '739' },
    { category: 'Desconhecida', match: 'prefix', value: '76d' },
    { category: 'Desconhecida', match: 'prefix', value: '7d' },
    { category: 'Desconhecida', match: 'prefix', value: '80' },
    { category: 'Desconhecida', match: 'prefix', value: '84' },
    { category: 'Desconhecida', match: 'prefix', value: '90eb' },
    { category: 'Desconhecida', match: 'prefix', value: '96f' },
    { category: 'Desconhecida', match: 'prefix', value: 'b4' },
    { category: 'Desconhecida', match: 'prefix', value: 'bc' },
    { category: 'Desconhecida', match: 'prefix', value: 'c9' },
    { category: 'Desconhecida', match: 'prefix', value: 'd5' },
    { category: 'Desconhecida', match: 'prefix', value: 'd7319' },
    { category: 'Desconhecida', match: 'prefix', value: 'e0' },
    { category: 'Desconhecida', match: 'prefix', value: 'e3' },
    { category: 'Desconhecida', match: 'prefix', value: 'f9' },
    { category: 'Desconhecida', match: 'prefix', value: 'ae7' },
    { category: 'Desconhecida', match: 'prefix', value: 'a4c' },
    { category: 'Desconhecida', match: 'prefix', value: 'a5' },
    { category: 'Desconhecida', match: 'prefix', value: 'a9' },
    { category: 'Desconhecida', match: 'prefix', value: 'a48' },
    { category: 'Desconhecida', match: 'prefix', value: 'a64' },
    { category: 'Desconhecida', match: 'prefix', value: 'bd' },
    { category: 'Desconhecida', match: 'prefix', value: 'bd32' },
    { category: 'Desconhecida', match: 'prefix', value: 'c17' },
    { category: 'Desconhecida', match: 'prefix', value: 'c25' },
    { category: 'Desconhecida', match: 'prefix', value: 'd03' },
    { category: 'Desconhecida', match: 'prefix', value: 'd4f0' },
    { category: 'Desconhecida', match: 'prefix', value: 'f6' },
    { category: 'Desconhecida', match: 'prefix', value: 'f6c' },
    { category: 'Desconhecida', match: 'prefix', value: 'f54' },
    { category: 'Desconhecida', match: 'prefix', value: 'ff6' },
    { category: 'Desconhecida', match: 'prefix', value: 'ff32' },
    { category: 'Desconhecida', match: 'prefix', value: '2bb' },
    // Desconhecida (identificadores nomeados)
    { category: 'Desconhecida', match: 'exact', value: 'XITADO' },
    { category: 'Desconhecida', match: 'exact', value: 'Regedit' },
    { category: 'Desconhecida', match: 'exact', value: 'Khoindvn' },
    { category: 'Desconhecida', match: 'exact', value: 'vip.unc0ver' },
    { category: 'Desconhecida', match: 'exact', value: 'com.luxebypass' },
    { category: 'Desconhecida', match: 'exact', value: 'com.thanhcongregedit' },
    { category: 'Desconhecida', match: 'exact', value: 'authproxyxff.up' },
    { category: 'Desconhecida', match: 'exact', value: 'freefireproxy.xyz' },
    { category: 'Desconhecida', match: 'exact', value: 'proxyady' },
    { category: 'Desconhecida', match: 'prefix', value: 'mit' }
  ];

  // ============ ELEMENTOS ============
  var dropEl = document.getElementById('drop');
  var fileInput = document.getElementById('file');
  var progressWrap = document.getElementById('progressWrap');
  var idleStatus = document.getElementById('idleStatus');
  var progressFill = document.getElementById('progressFill');
  var progressLabel = document.getElementById('progressLabel');
  var errEl = document.getElementById('err');
  var resultsEl = document.getElementById('results');
  var verdictDot = document.getElementById('verdictDot');
  var verdictTitle = document.getElementById('verdictTitle');
  var verdictDesc = document.getElementById('verdictDesc');
  var findingsPanel = document.getElementById('findingsPanel');
  var findingsHeader = document.getElementById('findingsHeader');
  var findingsCount = document.getElementById('findingsCount');
  var findingsBody = document.getElementById('findingsBody');
  var androidPanel = document.getElementById('androidPanel');
  var appIdCard = document.getElementById('appIdCard');
  var appIdBox = document.getElementById('appIdBox');
  var appIdTitle = document.getElementById('appIdTitle');
  var appIdDetail = document.getElementById('appIdDetail');
  var andModel = document.getElementById('andModel');
  var andManufacturer = document.getElementById('andManufacturer');
  var andBrand = document.getElementById('andBrand');
  var andVersion = document.getElementById('andVersion');
  var andSdk = document.getElementById('andSdk');
  var andBuildId = document.getElementById('andBuildId');
  var andBuildType = document.getElementById('andBuildType');
  var andFingerprint = document.getElementById('andFingerprint');
  var andSerial = document.getElementById('andSerial');
  var stateList = document.getElementById('stateList');
  var iosPanel = document.getElementById('iosPanel');
  var iosDeviceName = document.getElementById('iosDeviceName');
  var iosSerial = document.getElementById('iosSerial');
  var iosVersion = document.getElementById('iosVersion');
  var iosBuild = document.getElementById('iosBuild');
  var iosProduct = document.getElementById('iosProduct');
  var iosSysImage = document.getElementById('iosSysImage');
  var iosAppsCount = document.getElementById('iosAppsCount');
  var iosAlertCount = document.getElementById('iosAlertCount');
  var iosProfileCount = document.getElementById('iosProfileCount');
  var iosSummary = document.getElementById('iosSummary');
  var iosEvents = document.getElementById('iosEvents');
  var resetBtn = document.getElementById('resetBtn');
  var scanCountEl = document.getElementById('scanCount');

  // ============ CONTADOR DE USOS GLOBAL (via CountAPI — soma o uso de todos os visitantes) ============
  // Serviço público e gratuito, sem necessidade de login/token. A chave abaixo só precisa ser única
  // pra não colidir com o contador de outro site — pode trocar se quiser isolar ainda mais.
  var COUNTER_BASE = 'https://countapi.mileshilliard.com/api/v1';
  var COUNTER_KEY = 'kernelbypass_scanner_hazzscreens_v1';

  var scanCountMemoryFallback = 0; // usado só se a API do contador estiver fora do ar/sem internet

  (function initScanCount() {
    fetch(COUNTER_BASE + '/get/' + COUNTER_KEY)
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (data && typeof data.value === 'number') {
          scanCountMemoryFallback = data.value;
          if (scanCountEl) scanCountEl.textContent = data.value;
        }
      })
      .catch(function() { /* API fora do ar: mantém o número estático que já está no HTML */ });
  })();

  function incrementScanCount() {
    fetch(COUNTER_BASE + '/hit/' + COUNTER_KEY)
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (data && typeof data.value === 'number') {
          scanCountMemoryFallback = data.value;
          if (scanCountEl) scanCountEl.textContent = data.value;
        }
      })
      .catch(function() {
        // Sem conexão com o contador global agora: incrementa só visualmente pra não travar a experiência
        scanCountMemoryFallback++;
        if (scanCountEl) scanCountEl.textContent = scanCountMemoryFallback;
      });
  }

  findingsHeader.addEventListener('click', function() {
    findingsPanel.classList.toggle('collapsed');
  });

  function showError(msg) {
    errEl.textContent = msg;
    errEl.style.display = 'block';
  }
  function clearError() {
    errEl.style.display = 'none';
    errEl.textContent = '';
  }
  function setProgress(pct, label) {
    idleStatus.style.display = 'none';
    progressWrap.style.display = 'block';
    progressFill.style.width = pct + '%';
    progressLabel.textContent = label || (pct + '%');
  }
  function resetUI() {
    clearError();
    progressWrap.style.display = 'none';
    setProgress(0, '0%');
    idleStatus.style.display = 'flex';
    resultsEl.style.display = 'none';
    findingsBody.innerHTML = '';
    findingsPanel.style.display = 'none';
    findingsPanel.classList.remove('collapsed');
    androidPanel.style.display = 'none';
    iosEvents.innerHTML = '';
    iosPanel.style.display = 'none';
    fileInput.value = '';
    if (folderInput) folderInput.value = '';
    dropEl.style.display = 'block';
  }

  // ============ ABRIR SELETOR DE ARQUIVO AO CLICAR NA DROPZONE ============
  dropEl.addEventListener('click', function(e) {
    // Evita abrir 2x se o clique já veio do próprio <input>
    if (e.target === fileInput) return;
    fileInput.click();
  });

  // ============ DRAG & DROP ============
  ['dragenter', 'dragover'].forEach(function(evt) {
    dropEl.addEventListener(evt, function(e) {
      e.preventDefault();
      e.stopPropagation();
      dropEl.classList.add('drag');
    });
  });
  ['dragleave', 'dragend'].forEach(function(evt) {
    dropEl.addEventListener(evt, function(e) {
      e.preventDefault();
      e.stopPropagation();
      dropEl.classList.remove('drag');
    });
  });
  dropEl.addEventListener('drop', function(e) {
    e.preventDefault();
    e.stopPropagation();
    dropEl.classList.remove('drag');
    var files = e.dataTransfer.files;
    if (files && files.length) handleFile(files[0]);
  });
  // Impede que o navegador abra o arquivo se o usuário soltar fora da dropzone
  document.addEventListener('dragover', function(e) { e.preventDefault(); });
  document.addEventListener('drop', function(e) {
    if (e.target !== dropEl && !dropEl.contains(e.target)) e.preventDefault();
  });

  fileInput.addEventListener('change', function() {
    if (fileInput.files && fileInput.files.length) handleFile(fileInput.files[0]);
  });

  resetBtn.addEventListener('click', resetUI);

  // ============ UPLOAD DE PASTA JÁ EXTRAÍDA (evita descompactar tar.gz gigante no navegador) ============
  var folderBtn = document.getElementById('folderBtn');
  var folderInput = document.getElementById('folderInput');
  var FOLDER_FILE_SIZE_CAP = 15 * 1024 * 1024; // arquivos individuais acima disso são ignorados (proteção extra)

  if (folderBtn && folderInput) {
    folderBtn.addEventListener('click', function() { folderInput.click(); });
    folderInput.addEventListener('change', function() {
      if (folderInput.files && folderInput.files.length) handleFolderFiles(folderInput.files);
    });
  }

  function handleFolderFiles(fileList) {
    clearError();
    resultsEl.style.display = 'none';
    dropEl.style.display = 'none';
    setProgress(15, 'Lendo pasta (' + fileList.length + ' arquivos)...');

    var fileMap = {};
    var paths = [];
    for (var i = 0; i < fileList.length; i++) {
      var f = fileList[i];
      var rel = f.webkitRelativePath || f.name;
      fileMap[rel] = f;
      paths.push(rel);
    }

    var archive = {
      paths: paths,
      read: function(path) {
        var f = fileMap[path];
        if (!f) return Promise.reject(new Error('arquivo não encontrado: ' + path));
        if (f.size > FOLDER_FILE_SIZE_CAP) return Promise.resolve(''); // ignora arquivos individuais grandes demais
        return f.text();
      }
    };

    processArchive(archive);
  }

  // ============ PROCESSAMENTO DO ARQUIVO ============
  function handleFile(file) {
    clearError();
    resultsEl.style.display = 'none';

    var name = file.name.toLowerCase();
    var isTxt = name.endsWith('.txt');
    var isZip = name.endsWith('.zip');
    var isTarGz = name.endsWith('.tar.gz') || name.endsWith('.tgz');

    if (!isTxt && !isZip && !isTarGz) {
      showError('Formato inválido. Envie um arquivo .zip, .tar.gz/.tgz ou .txt.');
      return;
    }

    dropEl.style.display = 'none';
    setProgress(5, 'Lendo arquivo...');

    if (isTxt) {
      var reader = new FileReader();
      reader.onprogress = function(e) {
        if (e.lengthComputable) {
          var pct = Math.round((e.loaded / e.total) * 60) + 5;
          setProgress(pct, 'Lendo arquivo... ' + pct + '%');
        }
      };
      reader.onload = function() { analyzeFiles([{ path: file.name, content: reader.result }]); };
      reader.onerror = function() {
        showError('Não foi possível ler o arquivo.');
        dropEl.style.display = 'block';
      };
      reader.readAsText(file);
      return;
    }

    if (isZip) {
      if (typeof JSZip === 'undefined') {
        showError('Falha ao carregar biblioteca de leitura de .zip. Verifique sua conexão.');
        dropEl.style.display = 'block';
        return;
      }
      setProgress(10, 'Descompactando .zip...');
      JSZip.loadAsync(file).then(function(zip) {
        var allPaths = Object.keys(zip.files).filter(function(p) { return !zip.files[p].dir; });
        var archive = {
          paths: allPaths,
          read: function(path) { return zip.file(path).async('string'); }
        };
        processArchive(archive);
      }).catch(function() {
        showError('Arquivo .zip inválido ou corrompido.');
        dropEl.style.display = 'block';
      });
      return;
    }

    if (isTarGz) {
      if (typeof pako === 'undefined') {
        showError('Falha ao carregar biblioteca de leitura de .tar.gz. Verifique sua conexão.');
        dropEl.style.display = 'block';
        return;
      }
      setProgress(10, 'Descompactando .tar.gz...');
      var fr = new FileReader();
      fr.onload = function() {
        try {
          var gzBytes = new Uint8Array(fr.result);
          setProgress(25, 'Descomprimindo gzip...');
          var tarBytes = pako.ungzip(gzBytes);
          setProgress(45, 'Lendo arquivos do tar...');
          var tarEntries = parseTar(tarBytes);
          var fileMap = {};
          var decoder = new TextDecoder('utf-8', { fatal: false });
          tarEntries.forEach(function(entry) {
            if (!entry.dir) fileMap[entry.name] = entry.data;
          });
          var allPaths = Object.keys(fileMap);
          var archive = {
            paths: allPaths,
            read: function(path) {
              return Promise.resolve(decoder.decode(fileMap[path]));
            }
          };
          processArchive(archive);
        } catch (e) {
          showError('Arquivo .tar.gz inválido ou corrompido.');
          dropEl.style.display = 'block';
        }
      };
      fr.onerror = function() {
        showError('Não foi possível ler o arquivo.');
        dropEl.style.display = 'block';
      };
      fr.readAsArrayBuffer(file);
      return;
    }
  }

  // ============ PARSER DE TAR (usado após descompactar .tar.gz com pako) ============
  function parseTar(bytes) {
    var entries = [];
    var offset = 0;
    var longName = null;
    var decoder = new TextDecoder('utf-8', { fatal: false });

    function readString(off, len) {
      var slice = bytes.subarray(off, off + len);
      var end = slice.indexOf(0);
      if (end === -1) end = len;
      return decoder.decode(slice.subarray(0, end));
    }
    function readOctal(off, len) {
      var s = readString(off, len).trim();
      return s ? parseInt(s, 8) : 0;
    }
    function isZeroBlock(off) {
      for (var i = 0; i < 512; i++) { if (bytes[off + i] !== 0) return false; }
      return true;
    }

    while (offset + 512 <= bytes.length) {
      if (isZeroBlock(offset)) break;

      var name = readString(offset, 100);
      var prefix = readString(offset + 345, 155);
      var size = readOctal(offset + 124, 12);
      var typeflag = String.fromCharCode(bytes[offset + 156]);
      var fullName = prefix ? (prefix + '/' + name) : name;

      offset += 512;
      var dataStart = offset;
      var dataEnd = offset + size;

      if (typeflag === 'L') {
        // GNU tar: próxima entry tem o nome longo no conteúdo deste bloco
        longName = decoder.decode(bytes.subarray(dataStart, dataEnd)).replace(/\0+$/, '');
      } else {
        var entryName = longName || fullName;
        longName = null;
        if (typeflag === '5') {
          entries.push({ name: entryName, dir: true });
        } else if (typeflag === '0' || typeflag === '\0' || typeflag === '') {
          entries.push({ name: entryName, dir: false, data: bytes.subarray(dataStart, dataEnd) });
        }
      }
      offset += Math.ceil(size / 512) * 512;
    }
    return entries;
  }

  // ============ ROTEAMENTO: iOS x Android, independente da origem (zip/tar) ============
  function processArchive(archive) {
    var isIOS = archive.paths.some(function(p) {
      return /SystemVersion\.plist$/i.test(p) || /^sysdiagnose_/i.test(p) || /system_logs\.logarchive/i.test(p);
    });

    if (isIOS) {
      handleIOSArchive(archive);
      return;
    }

    var textPaths = archive.paths.filter(function(p) { return /\.(txt|xml|log)$/i.test(p); });
    if (!textPaths.length) {
      showError('Nenhum arquivo de texto encontrado dentro do arquivo enviado.');
      dropEl.style.display = 'block';
      return;
    }

    var fileContents = []; // [{ path, content }]
    var done = 0;
    textPaths.forEach(function(p) {
      archive.read(p).then(function(content) {
        fileContents.push({ path: p, content: content });
        done++;
        var pct = 10 + Math.round((done / textPaths.length) * 70);
        setProgress(pct, 'Analisando arquivos... ' + done + '/' + textPaths.length);
        if (done === textPaths.length) analyzeFiles(fileContents);
      }).catch(function() {
        done++;
        if (done === textPaths.length) analyzeFiles(fileContents);
      });
    });
  }

  // ============ SYSDIAGNOSE (iPhone) ============
  function handleIOSArchive(archive) {
    setProgress(20, 'Identificando dispositivo...');

    var sysVersionPath = archive.paths.find(function(p) { return /SystemVersion\.plist$/i.test(p); });
    var deviceInfoPromise = sysVersionPath ? archive.read(sysVersionPath) : Promise.resolve('');

    // Arquivos onde perfis/certificados (MCProfile / managed configuration) e histórico de eventos aparecem
    var plistPaths = archive.paths.filter(function(p) { return /\.(plist|xml)$/i.test(p); });

    deviceInfoPromise.then(function(plistText) {
      var productVersion = extractPlistValue(plistText, 'ProductVersion');
      var buildVersion = extractPlistValue(plistText, 'ProductBuildVersion');
      var productName = extractPlistValue(plistText, 'ProductName');

      iosDeviceName.textContent = productName || 'iPhone';
      iosVersion.textContent = productVersion || '-';
      iosBuild.textContent = buildVersion || '-';
      iosProduct.textContent = '-';
      iosSysImage.textContent = '-';
      iosSerial.textContent = '-';

      setProgress(35, 'Lendo perfis, certificados e histórico...');

      var allKeys = new Set();
      var keySources = {}; // chave -> [{ path, snippet }]
      var timelineEvents = [];
      var seenEvents = new Set();
      var done = 0;
      var total = plistPaths.length || 1;

      if (!plistPaths.length) {
        finishIOSScan(allKeys, timelineEvents, keySources);
        return;
      }

      plistPaths.forEach(function(p) {
        archive.read(p).then(function(txt) {
          var keyRe = /<key>([^<]+)<\/key>/g;
          var km;
          while ((km = keyRe.exec(txt))) {
            var k = km[1];
            allKeys.add(k);
            if (!keySources[k]) keySources[k] = [];
            if (!keySources[k].some(function(s) { return s.path === p; })) {
              var snipStart = Math.max(0, km.index - 20);
              var snipEnd = Math.min(txt.length, km.index + 260);
              keySources[k].push({ path: p, snippet: txt.slice(snipStart, snipEnd).trim() });
            }
          }

          extractDictBlocks(txt).forEach(function(block) {
            var ev = parseEventFromBlock(block);
            if (!ev) return;
            var dedupeKey = ev.process + '|' + ev.timestamp + '|' + ev.event;
            if (seenEvents.has(dedupeKey)) return;
            seenEvents.add(dedupeKey);
            ev.path = p;
            ev.rawBlock = block.trim();
            timelineEvents.push(ev);
          });
        }).catch(function(){}).then(function() {
          done++;
          var pct = 35 + Math.round((done / total) * 55);
          setProgress(pct, 'Lendo dados... ' + done + '/' + total);
          if (done === total) finishIOSScan(allKeys, timelineEvents, keySources);
        });
      });
    }).catch(function() {
      showError('Não foi possível ler as informações do dispositivo neste sysdiagnose.');
      dropEl.style.display = 'block';
    });
  }

  function extractPlistKeys(text) {
    var keys = [];
    var re = /<key>([^<]+)<\/key>/g;
    var m;
    while ((m = re.exec(text))) keys.push(m[1]);
    return keys;
  }

  // Extrai os blocos <dict>...</dict> (respeitando aninhamento) de um plist em texto
  function extractDictBlocks(text) {
    var blocks = [];
    var stack = [];
    var tagRe = /<dict\/?>|<\/dict>/g;
    var m;
    while ((m = tagRe.exec(text))) {
      if (m[0] === '<dict/>') continue;
      if (m[0] === '<dict>') {
        stack.push(m.index + m[0].length);
      } else if (stack.length) {
        var start = stack.pop();
        blocks.push(text.substring(start, m.index));
      }
    }
    return blocks;
  }

  // Extrai { event, process, timestamp } de um bloco <dict>, se presente
  function parseEventFromBlock(block) {
    var event = (block.match(/<key>event<\/key>\s*<string>([^<]*)<\/string>/i) || [])[1];
    var process = (block.match(/<key>process<\/key>\s*<string>([^<]*)<\/string>/i) || [])[1];
    var timestamp = (block.match(/<key>timestamp<\/key>\s*<date>([^<]*)<\/date>/i) || [])[1];
    if (event && process && timestamp) return { event: event, process: process, timestamp: timestamp };
    return null;
  }

  function isBoundaryChar(ch) {
    return ch === '' || ch === undefined || ch === '.' || ch === '-' || ch === '_' || ch === '/' || ch === ':';
  }

  // Match "exact" exige que o valor apareça isolado por bordas (início/fim ou separador),
  // não como substring solta dentro de outra palavra (ex: "mit" dentro de "Committed").
  function boundaryIncludes(lowerKey, v) {
    var idx = lowerKey.indexOf(v);
    if (idx === -1) return false;
    var before = idx === 0 ? '' : lowerKey[idx - 1];
    var after = (idx + v.length >= lowerKey.length) ? '' : lowerKey[idx + v.length];
    return isBoundaryChar(before) && isBoundaryChar(after);
  }

  // Um "prefixo" só faz sentido testar contra o hash de perfil/certificado de verdade
  // (~65 caracteres hex, sem traços), NÃO contra um UUID padrão do iOS (36 caracteres,
  // formato 8-4-4-4-12) — esse é usado em qualquer coisa genérica do sistema e não é
  // evidência de nada. Sem essa distinção, um UUID aleatório qualquer bate só por sorte
  // no prefixo de 2-3 caracteres.
  var STANDARD_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var MIN_HASH_LENGTH = 40; // bem acima dos 32 dígitos hex de um UUID padrão, folga confortável

  function looksLikeHash(key) {
    if (STANDARD_UUID_RE.test(key)) return false; // UUID padrão do iOS: nunca é o hash de proxy
    var stripped = key.replace(/[-._\s]/g, '');
    return stripped.length >= MIN_HASH_LENGTH && /^[0-9a-fA-F]+$/.test(stripped);
  }

  function matchIOSKey(key) {
    var lowerKey = key.toLowerCase();
    for (var i = 0; i < IOS_PACKAGE_DB.length; i++) {
      var entry = IOS_PACKAGE_DB[i];
      var v = entry.value.toLowerCase();
      if (entry.match === 'prefix' && looksLikeHash(key) && lowerKey.indexOf(v) === 0) return entry;
      if (entry.match === 'exact' && boundaryIncludes(lowerKey, v)) return entry;
    }
    return null;
  }

  function formatTimestamp(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    function pad(n) { return String(n).padStart(2, '0'); }
    return pad(d.getUTCDate()) + '/' + pad(d.getUTCMonth() + 1) + '/' + d.getUTCFullYear() + ' ' +
      pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds()) + ' UTC';
  }

  function finishIOSScan(allKeys, timelineEvents, keySources) {
    keySources = keySources || {};
    // Casa cada evento da timeline com a base de perfis/certificados suspeitos
    var matchedTimeline = [];
    timelineEvents.forEach(function(ev) {
      var entry = matchIOSKey(ev.process);
      if (entry) {
        matchedTimeline.push({
          category: entry.category,
          process: ev.process,
          event: ev.event.toLowerCase(),
          timestamp: ev.timestamp,
          path: ev.path,
          rawBlock: ev.rawBlock
        });
      }
    });
    // Mais recente primeiro
    matchedTimeline.sort(function(a, b) { return new Date(b.timestamp) - new Date(a.timestamp); });

    var timelineProcesses = new Set(matchedTimeline.map(function(e) { return e.process; }));

    // Fallback: perfis encontrados só como "presentes" (sem timeline), que ainda não apareceram acima
    var presentOnly = [];
    allKeys.forEach(function(key) {
      if (timelineProcesses.has(key)) return;
      var entry = matchIOSKey(key);
      if (entry) presentOnly.push({ category: entry.category, matchType: entry.match, matchedValue: entry.value, key: key, sources: keySources[key] || [] });
    });

    var totalAlerts = matchedTimeline.length + presentOnly.length;

    setProgress(100, 'Concluído');
    setTimeout(function() {
      progressWrap.style.display = 'none';
      resultsEl.style.display = 'block';
      findingsPanel.style.display = 'none';
      androidPanel.style.display = 'none';
      iosPanel.style.display = 'block';

      iosAppsCount.textContent = '0';
      iosAlertCount.textContent = String(totalAlerts);
      iosProfileCount.textContent = String(allKeys.size);

      iosEvents.innerHTML = '';

      if (totalAlerts > 0) {
        verdictDot.style.background = 'var(--danger)';
        verdictTitle.textContent = '⚠ Perfis suspeitos encontrados';
        verdictTitle.style.color = 'var(--danger)';
        verdictDesc.textContent = totalAlerts + ' perfil(is)/certificado(s) suspeito(s) neste sysdiagnose.';
        iosSummary.textContent = totalAlerts + ' perfil(is) encontrado(s).';

        // Agrupa tudo (timeline + presente) por categoria, preservando a ordem da IOS_PACKAGE_DB
        var categoryOrder = [];
        var byCategory = {};
        function pushToCategory(cat, node) {
          if (!byCategory[cat]) { byCategory[cat] = []; categoryOrder.push(cat); }
          byCategory[cat].push(node);
        }

        var logCounter = 0;
        function buildLogSection(pathsText, rawText) {
          var logId = 'ioslog_' + (logCounter++);
          var full = '📁 Encontrado em: ' + pathsText + '\n\n' + rawText;
          return {
            html: '<button class="finding-log-btn" data-target="' + logId + '">🔍 VER LOG EXATA</button>' +
                  '<pre class="finding-log" id="' + logId + '"></pre>',
            logId: logId,
            content: full
          };
        }
        function wireLogButton(card, section) {
          var pre = card.querySelector('#' + section.logId);
          pre.textContent = section.content;
          var btn = card.querySelector('.finding-log-btn');
          btn.addEventListener('click', function() {
            pre.classList.toggle('open');
            btn.textContent = pre.classList.contains('open') ? '▲ OCULTAR LOG' : '🔍 VER LOG EXATA';
          });
        }

        matchedTimeline.forEach(function(ev) {
          var isInstall = ev.event === 'add' || ev.event === 'install' || ev.event === 'installed';
          var tagClass = isInstall ? 'install' : 'remove';
          var tagLabel = isInstall ? 'INSTALAÇÃO' : 'REMOÇÃO';
          var card = document.createElement('div');
          card.className = 'ios-event';
          var logSection = buildLogSection(ev.path || '(caminho desconhecido)', ev.rawBlock || ev.process);
          card.innerHTML =
            '<span class="ios-event-tag ' + tagClass + '">' + tagLabel + '</span>' +
            '<div class="ios-event-id">' + escapeHtml(ev.process) + '</div>' +
            '<div class="ios-event-time">' + formatTimestamp(ev.timestamp) + '</div>' +
            logSection.html;
          wireLogButton(card, logSection);
          pushToCategory(ev.category, card);
        });

        presentOnly.forEach(function(m) {
          var shortPrefix = m.matchType === 'prefix' && m.matchedValue.length < 6;
          var card = document.createElement('div');
          card.className = 'ios-event';
          var pathsText = m.sources.length ? m.sources.map(function(s) { return s.path; }).join(', ') : '(caminho desconhecido)';
          var rawText = m.sources.length ? m.sources.map(function(s) { return '— ' + s.path + ' —\n' + s.snippet; }).join('\n\n') : m.key;
          var logSection = buildLogSection(pathsText, rawText);
          card.innerHTML =
            '<span class="ios-event-tag remove">PRESENTE</span>' +
            (shortPrefix ? '<span class="ios-event-tag remove" style="margin-left:6px;">⚠ prefixo curto</span>' : '') +
            '<div class="ios-event-id">' + escapeHtml(m.key) + '</div>' +
            '<div class="ios-event-time">match: ' + m.matchType + ' "' + escapeHtml(m.matchedValue) + '" · sem timeline neste arquivo</div>' +
            logSection.html;
          wireLogButton(card, logSection);
          pushToCategory(m.category, card);
        });

        categoryOrder.forEach(function(cat) {
          var section = document.createElement('div');
          section.className = 'ios-category-section';
          var header = document.createElement('div');
          header.className = 'ios-category-header';
          header.innerHTML =
            '<span class="ios-category-name">' + escapeHtml(cat) + '</span>' +
            '<span class="ios-category-badge">' + byCategory[cat].length + '</span>';
          section.appendChild(header);
          byCategory[cat].forEach(function(card) { section.appendChild(card); });
          iosEvents.appendChild(section);
        });
      } else {
        verdictDot.style.background = 'var(--ok)';
        verdictTitle.textContent = '✔ Nenhum perfil suspeito';
        verdictTitle.style.color = 'var(--ok)';
        verdictDesc.textContent = 'Nenhum perfil/certificado da base de dados foi encontrado.';
        iosSummary.textContent = allKeys.size + ' identificador(es) de perfil lido(s), nenhum suspeito.';
      }

      incrementScanCount();
    }, 300);
  }

  function extractPlistValue(plistText, key) {
    var re = new RegExp('<key>' + key + '</key>\\s*<string>([^<]*)</string>', 'i');
    var m = plistText.match(re);
    return m ? m[1] : '';
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // App alvo que o scanner valida como instalação oficial (ajuste pkg/instaladores se mudar o jogo-alvo)
  var TARGET_APP = {
    pkg: 'com.dts.freefireth',
    name: 'Free Fire',
    icon: '🎮',
    officialInstallers: ['com.android.vending']
  };

  function extractGetprop(text) {
    var props = {};
    var re = /\[([\w.\-]+)\]:\s*\[([^\]]*)\]/g;
    var m;
    while ((m = re.exec(text))) props[m[1]] = m[2];
    return props;
  }

  function getPackageBlock(text, pkgName) {
    var marker = 'Package [' + pkgName + ']';
    var idx = text.indexOf(marker);
    if (idx === -1) return null;
    var nextIdx = text.indexOf('Package [', idx + marker.length);
    var end = nextIdx === -1 ? Math.min(text.length, idx + 4000) : nextIdx;
    return text.substring(idx, end);
  }

  function parsePackageInfo(block) {
    if (!block) return null;
    var firstInstall = (block.match(/firstInstallTime=([^\r\n]+)/) || [])[1];
    var lastUpdate = (block.match(/lastUpdateTime=([^\r\n]+)/) || [])[1];
    var installer = (block.match(/installerPackageName=([^\r\n]+)/) || [])[1];
    return {
      firstInstallTime: firstInstall ? firstInstall.trim() : null,
      lastUpdateTime: lastUpdate ? lastUpdate.trim() : null,
      installerPackageName: installer ? installer.trim() : null
    };
  }

  function formatAndroidTimestamp(raw) {
    if (!raw) return null;
    if (/^\d+$/.test(raw)) {
      var d = new Date(parseInt(raw, 10));
      if (!isNaN(d.getTime())) return formatTimestamp(d.toISOString());
    }
    return raw;
  }

  // ============ ANÁLISE DE TEXTO / FILTRO DE PACOTES ============
  function analyzeFiles(fileContents) {
    setProgress(90, 'Comparando com base de pacotes...');

    var combinedText = fileContents.map(function(f) { return f.content; }).join('\n');
    var matches = []; // { group, label, pkg, count, logLines, sources, installInfo }

    // Busca entry.pkg em todos os arquivos, mantendo de qual arquivo cada ocorrência veio
    function searchAcrossFiles(needle, caseInsensitive) {
      var hits = []; // [{ path, line }]
      fileContents.forEach(function(f) {
        var lines = f.content.split(/\r?\n/);
        for (var i = 0; i < lines.length; i++) {
          var hay = caseInsensitive ? lines[i].toLowerCase() : lines[i];
          var n = caseInsensitive ? needle.toLowerCase() : needle;
          if (hay.indexOf(n) !== -1) {
            hits.push({ path: f.path, line: lines[i].trim() });
            if (hits.length >= 30) return hits; // limite pra não travar a tela
          }
        }
      });
      return hits;
    }

    function uniquePaths(hits) {
      var seen = {};
      var out = [];
      hits.forEach(function(h) { if (!seen[h.path]) { seen[h.path] = true; out.push(h.path); } });
      return out;
    }

    PACKAGE_DB.forEach(function(entry) {
      var hits = searchAcrossFiles(entry.pkg, false);
      if (hits.length) {
        var installInfo = parsePackageInfo(getPackageBlock(combinedText, entry.pkg));
        matches.push({
          group: entry.group,
          label: entry.label,
          pkg: entry.pkg,
          count: hits.length,
          logLines: hits.map(function(h) { return h.line; }),
          sources: uniquePaths(hits),
          installInfo: installInfo
        });
      }
    });

    // Propriedades do dispositivo (getprop) — normalmente concentradas num único arquivo principal
    var props = extractGetprop(combinedText);

    // ---- Acesso remoto via ADB/rede ----
    var adbTcpPort = props['service.adb.tcp.port'] || props['persist.adb.tcp.port'];
    if (adbTcpPort && adbTcpPort !== '-1' && adbTcpPort !== '0') {
      var adbPropHits = searchAcrossFiles('adb.tcp.port', true);
      matches.push({
        group: 'Acesso Remoto (ADB/Rede)',
        label: 'Remote detectado: porta ' + adbTcpPort + ' aberta (acesso remoto via ADB/rede)',
        pkg: 'service.adb.tcp.port=' + adbTcpPort,
        count: adbPropHits.length || 1,
        logLines: adbPropHits.length ? adbPropHits.map(function(h) { return h.line; }) : ['service.adb.tcp.port=' + adbTcpPort],
        sources: adbPropHits.length ? uniquePaths(adbPropHits) : [],
        installInfo: null
      });
    }

    // ---- Histórico de conexão USB (com horário, quando presente na linha de log) ----
    var usbHits = [];
    fileContents.forEach(function(f) {
      var lines = f.content.split(/\r?\n/);
      for (var i = 0; i < lines.length; i++) {
        var l = lines[i];
        if (/usb/i.test(l) && /(connect|disconnect|attach|detach|conectad|desconectad)/i.test(l)) {
          usbHits.push({ path: f.path, line: l.trim() });
          if (usbHits.length >= 50) break;
        }
      }
    });
    if (usbHits.length) {
      matches.push({
        group: 'Histórico USB',
        label: 'Eventos de conexão/desconexão USB no log',
        pkg: usbHits.length + ' linha(s) de log com atividade USB',
        count: usbHits.length,
        logLines: usbHits.map(function(h) { return h.line; }),
        sources: uniquePaths(usbHits),
        installInfo: null
      });
    }

    // ---- Histórico de conexão ADB (sessões, autorizações, shell) ----
    var adbHits = [];
    fileContents.forEach(function(f) {
      var lines = f.content.split(/\r?\n/);
      for (var i = 0; i < lines.length; i++) {
        var l = lines[i];
        if (/\badb\b/i.test(l) && /(connect|shell|authoriz|debugging|session|client|device_id)/i.test(l)) {
          adbHits.push({ path: f.path, line: l.trim() });
          if (adbHits.length >= 50) break;
        }
      }
    });
    if (adbHits.length) {
      matches.push({
        group: 'Histórico ADB',
        label: 'Eventos de sessão/conexão ADB no log',
        pkg: adbHits.length + ' linha(s) de log com atividade ADB',
        count: adbHits.length,
        logLines: adbHits.map(function(h) { return h.line; }),
        sources: uniquePaths(adbHits),
        installInfo: null
      });
    }

    var device = {
      model: props['ro.product.model'] || props['ro.product.marketname'] || '-',
      manufacturer: props['ro.product.manufacturer'] || '-',
      brand: props['ro.product.brand'] || '-',
      androidVersion: props['ro.build.version.release'] || '-',
      sdk: props['ro.build.version.sdk'] || '-',
      buildId: props['ro.build.id'] || '-',
      buildType: props['ro.build.type'] || '-',
      fingerprint: props['ro.build.fingerprint'] || props['ro.bootimage.build.fingerprint'] || '-',
      serial: props['ro.serialno'] || props['ro.boot.serialno'] || '-'
    };

    var flashLocked = props['ro.boot.flash.locked'];
    var vbState = props['ro.boot.vbmeta.device_state'];
    var bootloaderText = '-', bootloaderOk = true;
    if (flashLocked === '1' || vbState === 'locked') { bootloaderText = 'Bloqueado'; bootloaderOk = true; }
    else if (flashLocked === '0' || vbState === 'unlocked') { bootloaderText = 'Desbloqueado'; bootloaderOk = false; }

    var verifiedBoot = props['ro.boot.verifiedbootstate'] || '-';
    var verifiedBootOk = verifiedBoot === 'green';

    var signatureMatch = device.fingerprint.match(/(release-keys|test-keys|dev-keys)/);
    var signature = signatureMatch ? signatureMatch[1] : '-';
    var signatureOk = signature === 'release-keys';

    var debuggableRaw = props['ro.debuggable'];
    var debuggableText = debuggableRaw === '1' ? 'Sim' : (debuggableRaw === '0' ? 'Não' : '-');
    var debuggableOk = debuggableRaw !== '1';

    var secureRaw = props['ro.secure'];
    var secureText = secureRaw === '1' ? 'Sim' : (secureRaw === '0' ? 'Não' : '-');
    var secureOk = secureRaw === '1';

    // ---- Modo USB (sys.usb.state costuma listar as funções ativas, ex: "mtp,adb") ----
    var usbStateRaw = props['sys.usb.state'] || props['persist.sys.usb.config'] || props['sys.usb.config'] || '';
    var USB_FUNC_LABELS = { mtp: 'MTP', ptp: 'PTP', adb: 'ADB', rndis: 'RNDIS (rede)', midi: 'MIDI', accessory: 'Accessory', none: 'Nenhum', ncm: 'NCM (rede)' };
    var usbFuncs = usbStateRaw ? usbStateRaw.split(',').map(function(f) { return f.trim().toLowerCase(); }).filter(Boolean) : [];
    var usbModeText = usbFuncs.length ? usbFuncs.map(function(f) { return USB_FUNC_LABELS[f] || f; }).join(' + ') : '-';
    var usbAdbActive = usbFuncs.indexOf('adb') !== -1;

    var systemState = [
      { label: 'Bootloader', val: bootloaderText, ok: bootloaderOk },
      { label: 'Verified Boot', val: verifiedBoot, ok: verifiedBootOk },
      { label: 'Assinatura do build', val: signature, ok: signatureOk },
      { label: 'Debuggable', val: debuggableText, ok: debuggableOk },
      { label: 'Modo seguro (ro.secure)', val: secureText, ok: secureOk },
      { label: 'Modo USB (sys.usb.state)', val: usbModeText, ok: !usbAdbActive }
    ];

    // App alvo (ex: Free Fire) — confere se a instalação bate com a loja oficial
    var targetInfo = parsePackageInfo(getPackageBlock(combinedText, TARGET_APP.pkg));

    setProgress(100, 'Concluído');
    setTimeout(function() {
      progressWrap.style.display = 'none';
      renderResults(matches, device, systemState, targetInfo);
      incrementScanCount();
    }, 300);
  }

  function renderResults(matches, device, systemState, targetInfo) {
    resultsEl.style.display = 'block';
    findingsBody.innerHTML = '';
    iosPanel.style.display = 'none';
    androidPanel.style.display = 'block';

    var total = matches.length;

    // ---- Device info ----
    andModel.textContent = device.model;
    andManufacturer.textContent = device.manufacturer;
    andBrand.textContent = device.brand;
    andVersion.textContent = device.androidVersion;
    andSdk.textContent = device.sdk;
    andBuildId.textContent = device.buildId;
    andBuildType.textContent = device.buildType;
    andFingerprint.textContent = device.fingerprint;
    andSerial.textContent = device.serial;

    // ---- Estado do sistema ----
    stateList.innerHTML = '';
    systemState.forEach(function(s) {
      var row = document.createElement('div');
      row.className = 'state-row';
      row.innerHTML =
        '<div class="state-row-label"><span class="state-dot' + (s.ok ? '' : ' warn') + '"></span>' + escapeHtml(s.label) + '</div>' +
        '<div class="state-val">' + escapeHtml(String(s.val)) + '</div>';
      stateList.appendChild(row);
    });

    // ---- App alvo ----
    if (targetInfo) {
      var isOfficial = targetInfo.installerPackageName && TARGET_APP.officialInstallers.indexOf(targetInfo.installerPackageName) !== -1;
      appIdCard.style.display = 'block';
      appIdBox.className = 'app-id-box ' + (isOfficial ? 'ok' : 'warn');
      appIdTitle.textContent = (isOfficial ? '✅ ' : '⚠ ') + TARGET_APP.name + ' ' + (isOfficial ? 'Normal: Oficial (Play Store)' : '— instalador não reconhecido');
      var detailLines = [];
      detailLines.push('📦 Pacote: ' + TARGET_APP.pkg);
      if (targetInfo.firstInstallTime) detailLines.push('🗓 Primeira instalação: ' + formatAndroidTimestamp(targetInfo.firstInstallTime));
      if (targetInfo.lastUpdateTime) detailLines.push('🔄 Última atualização: ' + formatAndroidTimestamp(targetInfo.lastUpdateTime));
      detailLines.push('📲 Instalador: ' + (targetInfo.installerPackageName || 'desconhecido'));
      appIdDetail.innerHTML = detailLines.map(escapeHtml).join('<br>');
    } else {
      appIdCard.style.display = 'none';
    }

    if (total > 0) {
      var hasRemoteAccess = matches.some(function(m) { return m.group === 'Acesso Remoto (ADB/Rede)'; });
      var hasProxyMatch = matches.some(function(m) { return m.group === 'Proxy Externo' || m.group === 'Aplicativo Disfarçado'; });
      var hasSuspeitaMatch = matches.some(function(m) { return m.group === 'Suspeita'; });

      verdictDot.style.background = 'var(--danger)';
      verdictTitle.style.color = 'var(--danger)';

      if (hasRemoteAccess) {
        verdictTitle.textContent = 'ACESSO REMOTO DETECTADO';
        verdictDesc.textContent = 'O aparelho está com ADB acessível via rede (porta TCP aberta), permitindo controle remoto do dispositivo.';
      } else if (hasProxyMatch) {
        verdictTitle.textContent = 'PROXY EXTERNO IDENTIFICADO';
        verdictDesc.textContent = 'Foi encontrado um proxy/injetor externo conhecido, usado para interceptar ou alterar o tráfego do jogo.';
      } else if (hasSuspeitaMatch) {
        verdictTitle.textContent = '⚠ FERRAMENTA SUSPEITA IDENTIFICADA';
        verdictDesc.textContent = 'Foi encontrada uma ferramenta de acesso/modificação (ex: Termux, MT Manager, testador de root) instalada no aparelho. Não é um proxy em si, mas pode indicar tentativa de burlar proteções.';
      }

      findingsPanel.style.display = 'block';
      findingsPanel.classList.remove('collapsed');
      findingsCount.textContent = total;

      // Agrupa por categoria
      var groupOrder = ['Acesso Remoto (ADB/Rede)', 'Proxy Externo', 'Aplicativo Disfarçado', 'Suspeita', 'Histórico USB', 'Histórico ADB'];
      var byGroup = {};
      matches.forEach(function(m) {
        if (!byGroup[m.group]) byGroup[m.group] = [];
        byGroup[m.group].push(m);
      });

      var logCounter = 0;
      groupOrder.forEach(function(groupName) {
        var groupMatches = byGroup[groupName];
        if (!groupMatches || !groupMatches.length) return;

        var header = document.createElement('div');
        header.className = 'group-header';
        header.textContent = groupName;
        findingsBody.appendChild(header);

        groupMatches.forEach(function(m) {
          var card = document.createElement('div');
          card.className = 'finding-card';

          var logId = 'log_' + (logCounter++);
          var installLine = '';
          if (m.installInfo && m.installInfo.firstInstallTime) {
            installLine = '<div class="finding-desc" style="color:var(--gold-soft);margin-bottom:10px;">instalado (confirmado) · Instalação: ' + escapeHtml(formatAndroidTimestamp(m.installInfo.firstInstallTime)) + '</div>';
          }

          card.innerHTML =
            '<div class="finding-top">' +
              '<div class="finding-name">' + escapeHtml(m.label) + '</div>' +
              '<div class="finding-badge">ATIVO</div>' +
            '</div>' +
            '<div class="finding-desc">' + escapeHtml(m.pkg) + ' · ' + m.count + ' ocorrência(s) no arquivo</div>' +
            installLine +
            '<button class="finding-log-btn" data-target="' + logId + '">🔍 VER LOG EXATA</button>' +
            '<pre class="finding-log" id="' + logId + '"></pre>';

          var pre = card.querySelector('.finding-log');
          var pathsText = (m.sources && m.sources.length) ? m.sources.join(', ') : '(caminho desconhecido)';
          pre.textContent = '📁 Encontrado em: ' + pathsText + '\n\n' + m.logLines.join('\n');

          var btn = card.querySelector('.finding-log-btn');
          btn.addEventListener('click', function() {
            pre.classList.toggle('open');
            btn.textContent = pre.classList.contains('open') ? '▲ OCULTAR LOG' : '🔍 VER LOG EXATA';
          });

          findingsBody.appendChild(card);
        });
      });
    } else {
      verdictDot.style.background = 'var(--ok)';
      verdictTitle.textContent = '✔ Nenhum indício encontrado';
      verdictTitle.style.color = 'var(--ok)';
      verdictDesc.textContent = 'Nenhum pacote da base de dados foi encontrado neste bugreport.';
      findingsPanel.style.display = 'none';
    }
  }

})();
