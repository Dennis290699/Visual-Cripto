  // ---------- Helpers DOM ----------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  // Controles
  const inputText = $('#inputText');
  const caesarShift = $('#caesarShift');
  const columnKey = $('#columnKey');
  const modeChips = $('#modeChips');
  const speedRange = $('#speed');
  const speedLabel = $('#speedLabel');

  const btnEncrypt = $('#btnEncrypt');
  const btnDecrypt = $('#btnDecrypt');
  const btnClear = $('#btnClear');

  // Visual elements
  const matrixArea = $('#matrixArea');
  const outputArea = $('#outputArea');
  const details = $('#details');
  const stepsBar = $('#stepsBar');

  const playPause = $('#playPause');
  const prevStep = $('#prevStep');
  const nextStep = $('#nextStep');

  // Stage indicators
  const stageInput = $('#stageInput');
  const stageCaesar = $('#stageCaesar');
  const stageMatrix = $('#stageMatrix');
  const stageOutput = $('#stageOutput');

  // Estado del reproductor
  let frames = [];         // lista de pasos visuales
  let currentIndex = -1;
  let playing = false;
  let playTimer = null;

  // Util: sanitizar texto para visual (mantener espacios y mayúsculas)
  function normalizeInput(s){
    // Para esta demo conservamos todo; opcionalmente podrías eliminar acentos o normalizar.
    return s;
  }

  // ---------- Algoritmos puros (sin UI) ----------
  // 1) César: cifrar/desccifrar (solo letras latinas A-Z / a-z; otros caracteres se mantienen)
  function caesarEncryptPure(text, shift){
    // Aseguramos shift entre 0-25
    const s = ((Number(shift) % 26) + 26) % 26;
    let out = '';
    for (let ch of text){
      const code = ch.charCodeAt(0);
      if (code >= 65 && code <= 90){
        // A-Z
        out += String.fromCharCode((code - 65 + s) % 26 + 65);
      } else if (code >= 97 && code <= 122){
        // a-z
        out += String.fromCharCode((code - 97 + s) % 26 + 97);
      } else {
        out += ch; // números, espacios y símbolos se mantienen
      }
    }
    return out;
  }
  function caesarDecryptPure(text, shift){
    // descifrar == cifrar con -shift
    return caesarEncryptPure(text, -shift);
  }

  // 2) Transposición por columnas (columnar)
  // Encriptación simple: escribir texto en filas con 'key' columnas y leer por columnas.
  function columnarEncryptPure(text, key){
    const k = Math.max(1, Math.floor(Number(key) || 1));
    // Rellenamos con X para completar la matriz si hace falta
    let s = text;
    while (s.length % k !== 0) s += 'X';
    let out = '';
    for (let col = 0; col < k; col++){
      for (let i = col; i < s.length; i += k){
        out += s[i];
      }
    }
    return out;
  }
  // Para descifrar, reconstruimos la matriz a partir de la lectura por columnas
  function columnarDecryptPure(cipher, key){
    const k = Math.max(1, Math.floor(Number(key) || 1));
    const rows = Math.ceil(cipher.length / k);
    // Cada columna tiene 'rows' o 'rows-1' caracteres — aquí como el cifrado rellenó, todas tendrán rows
    const cols = k;
    const numPerCol = rows;
    // Cortamos el cipher en columnas
    let parts = [];
    let i = 0;
    for (let c = 0; c < cols; c++){
      parts.push(cipher.slice(i, i + numPerCol));
      i += numPerCol;
    }
    // Reconstruir fila por fila
    let out = '';
    for (let r = 0; r < rows; r++){
      for (let c = 0; c < cols; c++){
        const piece = parts[c];
        if (r < piece.length) out += piece[r];
      }
    }
    // Quitar relleno X al final
    return out.replace(/X+$/g, '');
  }

  // ---------- Construcción de frames (pasos visuales) ----------
  // Cada frame: { id:'frame1', title:'Texto original', type:'input'|'caesar'|'matrix'|'readcol'|'output', data: {...} }
  function buildFrames({ text, useCaesar, shift, useColumnar, columns, mode }) {
    // mode: 'encrypt' o 'decrypt'
    // Normalizamos y limpiamos frames previos
    const framesLocal = [];
    const normalized = normalizeInput(text);

    // Frame 0: input
    framesLocal.push({
      id: 'input',
      title: 'Texto original',
      type: 'input',
      data: { text: normalized }
    });

    // If encrypt mode: Cesar -> Columnar
    // If decrypt mode: inverse order: Columnar -> Cesar

    if (mode === 'encrypt') {
      let afterCaesar = normalized;
      if (useCaesar) {
        // frame: applying caesar, show mapping char->char
        framesLocal.push({
          id: 'caesar-start',
          title: `Aplicando César (shift=${shift})`,
          type: 'caesar-start',
          data: { from: normalized, shift: Number(shift) }
        });
        const encrypted = caesarEncryptPure(normalized, shift);
        framesLocal.push({
          id: 'caesar-end',
          title: 'Resultado César',
          type: 'caesar-end',
          data: { from: normalized, to: encrypted, shift: Number(shift) }
        });
        afterCaesar = encrypted;
      }

      if (useColumnar) {
        // frame: construir matriz (rows, cols) y leer por columnas con highlights
        const k = Math.max(1, Math.floor(Number(columns) || 1));
        // Rellenar con X
        let padded = afterCaesar;
        while (padded.length % k !== 0) padded += 'X';
        const rows = padded.length / k;
        // matrix as array of rows
        const matrix = [];
        for (let r = 0; r < rows; r++){
          const row = [];
          for (let c = 0; c < k; c++){
            row.push(padded[r * k + c]);
          }
          matrix.push(row);
        }
        framesLocal.push({
          id: 'matrix-build',
          title: `Construyendo matriz (${rows}x${k})`,
          type: 'matrix-build',
          data: { matrix, padded, rows, cols: k }
        });

        // frames for reading each column
        let readSoFar = '';
        for (let c = 0; c < k; c++){
          const colVals = [];
          for (let r = 0; r < rows; r++){
            colVals.push(matrix[r][c]);
          }
          readSoFar += colVals.join('');
          framesLocal.push({
            id: `read-col-${c}`,
            title: `Leyendo columna ${c+1} / ${k}`,
            type: 'read-col',
            data: { matrix, colIndex: c, rows, cols: k, readSoFar }
          });
        }
        framesLocal.push({
          id: 'matrix-end',
          title: 'Resultado Transposición',
          type: 'matrix-end',
          data: { cipher: columnarEncryptPure(afterCaesar, columns) }
        });
      } // end useColumnar

      // Final output
      let final = afterCaesar;
      if (useColumnar) final = columnarEncryptPure(afterCaesar, columns);
      framesLocal.push({
        id: 'output',
        title: 'Texto cifrado (salida)',
        type: 'output',
        data: { text: final }
      });

    } else { // decrypt
      // Descifrado: si ambos activos => primero invertir columnar, luego cesar inverso
      let current = normalized;

      if (useColumnar) {
        framesLocal.push({
          id: 'matrix-de-start',
          title: `Invirtiendo Transposición (columnas=${columns})`,
          type: 'matrix-de-start',
          data: { cipher: normalized, columns }
        });
        // For visualization, show matrix reconstruction
        // We will simulate reconstructing columns into rows:
        const k = Math.max(1, Math.floor(Number(columns) || 1));
        const rows = Math.ceil(normalized.length / k);
        // Build columns as parts
        const parts = [];
        let i = 0;
        for (let c = 0; c < k; c++){
          parts.push(normalized.slice(i, i + rows));
          i += rows;
        }
        // Compose matrix rows
        const matrix = [];
        for (let r = 0; r < rows; r++){
          const row = [];
          for (let c = 0; c < k; c++){
            row.push(parts[c][r] || '');
          }
          matrix.push(row);
        }
        framesLocal.push({
          id: 'matrix-reconstructed',
          title: `Matriz reconstruida (${rows}x${k})`,
          type: 'matrix-reconstructed',
          data: { matrix, parts, rows, cols: k }
        });

        // Show reading row by row to reconstruct plaintext-with-padding
        let rebuild = '';
        for (let r = 0; r < rows; r++){
          let rowSlice = '';
          for (let c = 0; c < k; c++){
            rowSlice += matrix[r][c] || '';
          }
          rebuild += rowSlice;
          framesLocal.push({
            id: `rebuild-row-${r}`,
            title: `Leyendo fila ${r+1} / ${rows}`,
            type: 'rebuild-row',
            data: { matrix, rowIndex: r, rows, cols: k, rebuildSoFar: rebuild }
          });
        }
        // final columnar-decrypted (strip padding X)
        const colDec = columnarDecryptPure(normalized, columns);
        framesLocal.push({
          id: 'matrix-de-end',
          title: 'Resultado Transposición (descifrada)',
          type: 'matrix-de-end',
          data: { text: colDec }
        });
        current = colDec;
      }

      if (useCaesar) {
        framesLocal.push({
          id: 'caesar-de-start',
          title: `Aplicando César inverso (shift=${shift})`,
          type: 'caesar-de-start',
          data: { from: current, shift: Number(shift) }
        });
        const dec = caesarDecryptPure(current, shift);
        framesLocal.push({
          id: 'caesar-de-end',
          title: 'Resultado César (descifrado)',
          type: 'caesar-de-end',
          data: { from: current, to: dec, shift: Number(shift) }
        });
        current = dec;
      }

      framesLocal.push({
        id: 'output',
        title: 'Texto final (descifrado)',
        type: 'output',
        data: { text: current }
      });
    }

    return framesLocal;
  }

  // ---------- UI renderers: cada tipo de frame tiene su propia render function ----------
  function clearHighlights(){
    // reset stage styles
    [stageInput, stageCaesar, stageMatrix, stageOutput].forEach(el => el.classList.remove('active'));
  }

  function renderFrame(f){
    // Clear matrix area and details
    matrixArea.innerHTML = '';
    details.innerHTML = '';
    outputArea.textContent = '—';

    // Update steps bar highlight
    $$('.step').forEach(s => s.classList.remove('active'));
    const stepEl = $(`#step-${f.id}`);
    if (stepEl) stepEl.classList.add('active');

    // Update stage badges based on frame types
    clearHighlights();
    if (f.type.startsWith('input') || f.type === 'output') stageInput.classList.add('active');
    if (f.type.includes('caesar')) stageCaesar.classList.add('active');
    if (f.type.includes('matrix') || f.type.includes('read') || f.type.includes('rebuild')) stageMatrix.classList.add('active');
    if (f.type === 'output') stageOutput.classList.add('active');

    // Now render by type
    switch (f.type){
      case 'input':
        renderInputFrame(f); break;
      case 'caesar-start':
        renderCaesarMap(f); break;
      case 'caesar-end':
        renderCaesarResult(f); break;
      case 'matrix-build':
        renderMatrixBuild(f); break;
      case 'read-col':
        renderReadColumn(f); break;
      case 'matrix-end':
        renderMatrixEnd(f); break;
      case 'output':
        renderOutputFrame(f); break;
      case 'matrix-de-start':
        renderMatrixDeStart(f); break;
      case 'matrix-reconstructed':
        renderMatrixReconstructed(f); break;
      case 'rebuild-row':
        renderRebuildRow(f); break;
      case 'matrix-de-end':
        renderMatrixEndDecrypt(f); break;
      case 'caesar-de-start':
        renderCaesarMap(f); break;
      case 'caesar-de-end':
        renderCaesarResult(f); break;
      default:
        details.textContent = JSON.stringify(f, null, 2);
    }
  }

  // Renderers específicos
  function renderInputFrame(f){
    const t = f.data.text || '';
    outputArea.textContent = t || '—';
    details.innerHTML = `<div><strong>Entrada:</strong> "${escapeHtml(t)}"</div>
      <div style="margin-top:6px;color:var(--muted)">Aquí comienza el proceso. Puedes activar/desactivar cifrados y luego pulsar Cifrar o Descifrar.</div>`;
    // render a row of cells
    const row = document.createElement('div');
    row.className = 'matrix';
    row.style.gridAutoFlow = 'column';
    row.style.gridTemplateColumns = `repeat(${Math.max(1, Math.min(t.length || 1, 30))}, 1fr)`;
    for (let ch of t || ' '){
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.textContent = ch === ' ' ? '␣' : ch;
      row.appendChild(cell);
    }
    matrixArea.appendChild(row);
  }

  function renderCaesarMap(f){
    const from = f.data.from || '';
    const shift = Number(f.data.shift || 0);
    details.innerHTML = `<div><strong>Cifrado César</strong> — desplazamiento: ${shift}</div>
      <div style="margin-top:8px;color:var(--muted)">Se mapea cada letra a otra desplazada en el alfabeto; caracteres no alfabéticos permanecen iguales.</div>`;

    // show mapping row by row: original row, arrow, shifted row
    const origRow = document.createElement('div');
    origRow.className = 'matrix';
    origRow.style.gridAutoFlow = 'column';
    origRow.style.gridTemplateColumns = `repeat(${Math.max(1,from.length || 1)}, 1fr)`;
    const mapped = caesarEncryptPure(from, shift);

    for (let i = 0; i < from.length; i++){
      const c = document.createElement('div');
      c.className = 'cell highlight';
      c.textContent = (from[i] === ' ') ? '␣' : from[i];
      origRow.appendChild(c);
    }
    const arrow = document.createElement('div');
    arrow.style.margin = '12px 0';
    arrow.innerHTML = '↓';
    // result row
    const resRow = document.createElement('div');
    resRow.className = 'matrix';
    resRow.style.gridAutoFlow = 'column';
    resRow.style.gridTemplateColumns = `repeat(${Math.max(1,mapped.length || 1)}, 1fr)`;
    for (let i = 0; i < mapped.length; i++){
      const c = document.createElement('div');
      c.className = 'cell';
      c.textContent = (mapped[i] === ' ') ? '␣' : mapped[i];
      resRow.appendChild(c);
    }
    matrixArea.appendChild(origRow);
    matrixArea.appendChild(arrow);
    matrixArea.appendChild(resRow);
    outputArea.textContent = mapped;
  }

  function renderCaesarResult(f){
    const to = f.data.to || '';
    details.innerHTML = `<div><strong>Resultado César:</strong> "${escapeHtml(to)}"</div>
      <div style="margin-top:6px;color:var(--muted)">Este texto será la entrada para el siguiente paso (si aplica).</div>`;
    // show result as row
    const row = document.createElement('div');
    row.className = 'matrix';
    row.style.gridAutoFlow = 'column';
    row.style.gridTemplateColumns = `repeat(${Math.max(1,to.length || 1)}, 1fr)`;
    for (let ch of to || ' '){
      const cell = document.createElement('div');
      cell.className = 'cell highlight';
      cell.textContent = ch === ' ' ? '␣' : ch;
      row.appendChild(cell);
    }
    matrixArea.appendChild(row);
    outputArea.textContent = to;
  }

  function renderMatrixBuild(f){
    const matrix = f.data.matrix || [];
    details.innerHTML = `<div><strong>Matriz construida:</strong> filas=${f.data.rows} cols=${f.data.cols}</div>
      <div style="margin-top:6px;color:var(--muted)">Rellena con 'X' si es necesario. Lee por columnas para producir el texto cifrado.</div>`;
    // render grid
    const grid = document.createElement('div');
    grid.className = 'matrix';
    grid.style.gridTemplateColumns = `repeat(${f.data.cols}, auto)`;
    for (let r = 0; r < matrix.length; r++){
      for (let c = 0; c < matrix[0].length; c++){
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.textContent = matrix[r][c] || '';
        grid.appendChild(cell);
      }
    }
    matrixArea.appendChild(grid);
    outputArea.textContent = f.data.padded;
  }

  function renderReadColumn(f){
    const matrix = f.data.matrix || [];
    const colIndex = f.data.colIndex;
    const rows = f.data.rows;
    const cols = f.data.cols;
    details.innerHTML = `<div><strong>Leyendo columna ${colIndex+1} de ${cols}.</strong></div>
      <div style="margin-top:6px;color:var(--muted)">Concatenando valores: "${escapeHtml(f.data.readSoFar)}"</div>`;

    // render grid with highlighted column
    const grid = document.createElement('div');
    grid.className = 'matrix';
    grid.style.gridTemplateColumns = `repeat(${cols}, auto)`;
    for (let r = 0; r < rows; r++){
      for (let c = 0; c < cols; c++){
        const cell = document.createElement('div');
        cell.className = 'cell' + (c === colIndex ? ' highlight' : '');
        cell.textContent = matrix[r][c] || '';
        grid.appendChild(cell);
      }
    }
    matrixArea.appendChild(grid);
    outputArea.textContent = f.data.readSoFar;
  }

  function renderMatrixEnd(f){
    details.innerHTML = `<div><strong>Transposición completa.</strong></div>
      <div style="margin-top:6px;color:var(--muted)">Texto cifrado: "${escapeHtml(f.data.cipher)}"</div>`;
    const text = f.data.cipher;
    const row = document.createElement('div');
    row.className = 'matrix';
    row.style.gridAutoFlow = 'column';
    row.style.gridTemplateColumns = `repeat(${Math.max(1,text.length || 1)}, 1fr)`;
    for (let ch of text){
      const c = document.createElement('div');
      c.className = 'cell highlight';
      c.textContent = ch === ' ' ? '␣' : ch;
      row.appendChild(c);
    }
    matrixArea.appendChild(row);
    outputArea.textContent = text;
  }

  function renderMatrixDeStart(f){
    details.innerHTML = `<div><strong>Iniciando inversión de transposición.</strong></div>
     <div style="margin-top:6px;color:var(--muted)">Reconstruiremos las columnas y luego leeremos filas.</div>`;
    matrixArea.innerHTML = `<div style="color:var(--muted)">Texto cifrado: "${escapeHtml(f.data.cipher)}"</div>`;
    outputArea.textContent = f.data.cipher;
  }

  function renderMatrixReconstructed(f){
    const matrix = f.data.matrix || [];
    details.innerHTML = `<div><strong>Matriz reconstruida</strong> (columnas reconstruidas a partir del texto cifrado).</div>`;
    const grid = document.createElement('div');
    grid.className = 'matrix';
    grid.style.gridTemplateColumns = `repeat(${f.data.cols}, auto)`;
    for (let r = 0; r < f.data.rows; r++){
      for (let c = 0; c < f.data.cols; c++){
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.textContent = matrix[r][c] || '';
        grid.appendChild(cell);
      }
    }
    matrixArea.appendChild(grid);
    outputArea.textContent = f.data.parts ? f.data.parts.join('|') : '';
  }

  function renderRebuildRow(f){
    details.innerHTML = `<div><strong>Reconstruyendo filas</strong> — texto parcial: "${escapeHtml(f.data.rebuildSoFar)}"</div>`;
    const matrix = f.data.matrix || [];
    const grid = document.createElement('div');
    grid.className = 'matrix';
    grid.style.gridTemplateColumns = `repeat(${f.data.cols}, auto)`;
    for (let r = 0; r < f.data.rows; r++){
      for (let c = 0; c < f.data.cols; c++){
        const cell = document.createElement('div');
        // highlight rows <= current rowIndex
        const should = r <= f.data.rowIndex;
        cell.className = 'cell' + (should ? ' highlight' : '');
        cell.textContent = matrix[r][c] || '';
        grid.appendChild(cell);
      }
    }
    matrixArea.appendChild(grid);
    outputArea.textContent = f.data.rebuildSoFar;
  }

  function renderMatrixEndDecrypt(f){
    details.innerHTML = `<div><strong>Transposición invertida.</strong></div>
      <div style="margin-top:6px;color:var(--muted)">Texto sin relleno: "${escapeHtml(f.data.text)}"</div>`;
    const text = f.data.text;
    const row = document.createElement('div');
    row.className = 'matrix';
    row.style.gridAutoFlow = 'column';
    row.style.gridTemplateColumns = `repeat(${Math.max(1,text.length || 1)}, 1fr)`;
    for (let ch of text){
      const c = document.createElement('div');
      c.className = 'cell highlight';
      c.textContent = ch === ' ' ? '␣' : ch;
      row.appendChild(c);
    }
    matrixArea.appendChild(row);
    outputArea.textContent = text;
  }

  function renderOutputFrame(f){
    const t = f.data.text || '';
    details.innerHTML = `<div><strong>Salida final:</strong> "${escapeHtml(t)}"</div>
      <div style="margin-top:6px;color:var(--muted)">Este es el resultado final del proceso.</div>`;
    // Nice big output
    outputArea.textContent = t;
    // Also show as row with glow
    const row = document.createElement('div');
    row.className = 'matrix';
    row.style.gridAutoFlow = 'column';
    row.style.gridTemplateColumns = `repeat(${Math.max(1,t.length || 1)}, 1fr)`;
    for (let ch of t || ' '){
      const cell = document.createElement('div');
      cell.className = 'cell highlight';
      cell.textContent = ch === ' ' ? '␣' : ch;
      row.appendChild(cell);
    }
    matrixArea.appendChild(row);
  }

  // ---------- Player controls ----------
  function renderStepsBar(){
    stepsBar.innerHTML = '';
    frames.forEach((f, idx) => {
      const el = document.createElement('div');
      el.className = 'step';
      el.id = `step-${f.id}`;
      el.textContent = String(idx+1);
      el.title = f.title;
      el.onclick = () => { goToFrame(idx); };
      stepsBar.appendChild(el);
    });
  }

  function goToFrame(index){
    if (index < 0 || index >= frames.length) return;
    currentIndex = index;
    renderFrame(frames[currentIndex]);
    updatePlayPauseBtn();
  }

  function nextFrame(){
    if (currentIndex < frames.length - 1) goToFrame(currentIndex + 1);
    else {
      // stop at end
      stopPlaying();
    }
  }
  function prevFrameFunc(){
    if (currentIndex > 0) goToFrame(currentIndex - 1);
  }

  function startPlaying(){
    if (frames.length === 0) return;
    playing = true;
    updatePlayPauseBtn();
    const delay = Number(speedRange.value) || 700;
    playTimer = setInterval(() => {
      if (currentIndex >= frames.length - 1) {
        stopPlaying();
      } else {
        nextFrame();
      }
    }, delay);
  }
  function stopPlaying(){
    playing = false;
    updatePlayPauseBtn();
    if (playTimer) clearInterval(playTimer);
    playTimer = null;
  }
  function togglePlay(){
    if (playing) stopPlaying();
    else {
      // if at end, restart at 0
      if (currentIndex >= frames.length - 1) currentIndex = -1;
      startPlaying();
    }
  }
function updatePlayPauseBtn() {
  if (playing) {
    playPause.innerHTML = '<i class="fas fa-pause"></i> Pause';
  } else {
    playPause.innerHTML = '<i class="fas fa-play"></i> Play';
  }
}

  // ---------- Event listeners ----------
  // Mode chips behavior (toggle)
  modeChips.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    chip.classList.toggle('active');
  });

  // Speed label update
  speedRange.addEventListener('input', () => {
    speedLabel.textContent = speedRange.value + 'ms';
    if (playing){
      // restart timer with new speed
      stopPlaying();
      startPlaying();
    }
  });

  btnClear.addEventListener('click', () => {
    inputText.value = '';
    matrixArea.innerHTML = '';
    outputArea.textContent = '—';
    details.textContent = 'Cada paso se explica aquí.';
    frames = [];
    renderStepsBar();
    currentIndex = -1;
    stopPlaying();
  });

  // Build frames & start encrypt
  btnEncrypt.addEventListener('click', () => {
    stopPlaying();
    const text = inputText.value || '';
    const useCaesar = !!document.querySelector('.chip[data-mode="caesar"]').classList.contains('active');
    const useColumnar = !!document.querySelector('.chip[data-mode="columnar"]').classList.contains('active');
    const shift = Number(caesarShift.value || 0);
    const columns = Number(columnKey.value || 1);
    if (!useCaesar && !useColumnar){
      alert('Activa al menos un modo de cifrado (César o Columnar).');
      return;
    }
    frames = buildFrames({ text, useCaesar, shift, useColumnar, columns, mode: 'encrypt' });
    renderStepsBar();
    currentIndex = -1;
    nextFrame(); // show first frame (input)
    startPlaying();
  });

  // Build frames & start decrypt
  btnDecrypt.addEventListener('click', () => {
    stopPlaying();
    const text = inputText.value || '';
    const useCaesar = !!document.querySelector('.chip[data-mode="caesar"]').classList.contains('active');
    const useColumnar = !!document.querySelector('.chip[data-mode="columnar"]').classList.contains('active');
    const shift = Number(caesarShift.value || 0);
    const columns = Number(columnKey.value || 1);
    if (!useCaesar && !useColumnar){
      alert('Activa al menos un modo de cifrado (César o Columnar).');
      return;
    }
    frames = buildFrames({ text, useCaesar, shift, useColumnar, columns, mode: 'decrypt' });
    renderStepsBar();
    currentIndex = -1;
    nextFrame();
    startPlaying();
  });

  // Play controls
  playPause.addEventListener('click', togglePlay);
  prevStep.addEventListener('click', () => { stopPlaying(); prevFrameFunc(); });
  nextStep.addEventListener('click', () => { stopPlaying(); nextFrame(); });

  // Keyboard shortcuts (optional)
  window.addEventListener('keydown', (e) => {
    if (e.key === ' ') { e.preventDefault(); togglePlay(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); stopPlaying(); nextFrame(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); stopPlaying(); prevFrameFunc(); }
  });

  // Helper for HTML-escaping text shown in details
  function escapeHtml(s){
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // Inicialización: pintar pasos vacíos
  (function init(){
    details.textContent = 'Cada paso se explica aquí.';
    outputArea.textContent = '—';
    matrixArea.innerHTML = `<div style="color:var(--muted)">Escribe un texto a la izquierda y pulsa "Cifrar" o "Descifrar".</div>`;
  })();
  