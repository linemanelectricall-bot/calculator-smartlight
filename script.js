document.addEventListener("DOMContentLoaded", function(){
  // DOM elements
  const modeSelect = document.getElementById("modeSelect");
  const mode1 = document.getElementById("mode1");
  const mode2 = document.getElementById("mode2");
  const kategori = document.getElementById("kategori");
  const ruangan = document.getElementById("ruangan");
  const lampSelect = document.getElementById("lampSelect");
  const calcMode1Btn = document.getElementById("calcMode1");
  const resultMode1 = document.getElementById("resultMode1");
  const downloadPdfMode1 = document.getElementById("downloadPdfMode1");

  const groupsContainer = document.getElementById("groupsContainer");
  const addGroupBtn = document.getElementById("addGroup");
  const calcMode2Btn = document.getElementById("calcMode2");
  const resultMode2 = document.getElementById("resultMode2");

  // populate categories select (if template didn't)
  if(window.CATEGORIES && Array.isArray(window.CATEGORIES)) {
    // no-op because template already rendered categories in HTML, but keep safe
  }

  // On category change -> populate rooms
  kategori.addEventListener("change", function(){
    const k = kategori.value;
    ruangan.innerHTML = "<option value='' disabled selected>-- Pilih Ruangan --</option>";
    const filtered = ROOMS.filter(r => r.kategori === k);
    filtered.forEach(r => {
      const opt = document.createElement("option");
      opt.value = r.key;
      opt.textContent = r.name + " (" + (r.lux || r.lux || "-") + " lux)";
      ruangan.appendChild(opt);
    });
  });

  // Helper: get lamp object by index
  function getLampByIndex(i){
    return LAMPS.find(l => Number(l.index) === Number(i));
  }

  // Mode switch
  modeSelect.addEventListener("change", function(){
    const v = modeSelect.value;
    mode1.classList.add("hidden");
    mode2.classList.add("hidden");
    if(v === "mode1") mode1.classList.remove("hidden");
    if(v === "mode2") mode2.classList.remove("hidden");
  });

  // Mode1 calculation
  calcMode1Btn.addEventListener("click", function(){
    // read inputs
    const roomKey = ruangan.value;
    const lampIdx = lampSelect.value;
    const length = parseFloat(document.getElementById("length").value || 0);
    const width = parseFloat(document.getElementById("width").value || 0);
    const eta = parseFloat(document.getElementById("eta").value || 0.8);

    if(!roomKey || !lampIdx || length <= 0 || width <= 0){
      alert("Lengkapi kategori/ruangan/lampu/panjang/lebar terlebih dahulu.");
      return;
    }

    const room = ROOMS.find(r => r.key === roomKey);
    const lamp = getLampByIndex(lampIdx);

    const E = Number(room.lux || room.lux || 0);
    const area = +(length * width).toFixed(2);
    const total_lumen = (E * area) / Math.max(eta, 0.0001);
    const n_lamps = Math.ceil(total_lumen / Number(lamp.lumen || 1));
    const total_watt = +(n_lamps * Number(lamp.watt)).toFixed(2);
    const amp = +(total_watt/220).toFixed(3);

    // layout suggestion (simple)
    const cols = Math.floor(Math.sqrt(n_lamps)) || 1;
    const rows = Math.ceil(n_lamps/cols);
    let rem = n_lamps;
    const dist = [];
    for(let r=0;r<rows;r++){
      const take = Math.min(cols, rem);
      dist.push(take);
      rem -= take;
    }
    const imbalance = dist.length>1 ? Math.max(...dist)-Math.min(...dist) : 0;

    // render
    resultMode1.innerHTML = `
      <div><strong>Ruangan:</strong> ${room.name} • <strong>Target:</strong> ${E} lux</div>
      <div><strong>Luas:</strong> ${area} m² • <strong>η:</strong> ${eta}</div>
      <hr />
      <div><strong>Lampu:</strong> ${lamp.name} — ${lamp.watt} W • ${lamp.lumen} lm</div>
      <div><strong>Lumen diperlukan:</strong> ${total_lumen.toFixed(1)} lm</div>
      <div><strong>Jumlah titik lampu:</strong> ${n_lamps}</div>
      <div><strong>Total Watt:</strong> ${total_watt} W • <strong>Arus:</strong> ${amp} A</div>
      <div style="margin-top:8px"><strong>Layout saran:</strong> ${cols} kolom × ${rows} baris • Distribusi: [${dist.join(', ')}]</div>
      ${imbalance>0 ? `<div style="margin-top:8px;color:#ffb4ab;font-weight:700">⚠️ Distribusi tidak seimbang (selisih ${imbalance}) — pertimbangkan menyesuaikan jumlah titik atau gunakan lampu dengan lumen berbeda.</div>` : ''}
    `;

    // attach a small data object to Download PDF button
    downloadPdfMode1.onclick = function(){
      const payload = {
        room: room.name,
        area,
        E,
        eta,
        lamp_name: lamp.name,
        lamp_watt: lamp.watt,
        lamp_lumen: lamp.lumen,
        n_lamps,
        total_watt
      };
      fetch("{{ url_for('download_pdf_mode1') }}", {
        method:"POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify(payload)
      }).then(r => {
        if(!r.ok) return r.text().then(t=>{throw new Error(t)});
        return r.blob();
      }).then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `laporan_mode1_${(new Date()).toISOString().slice(0,19).replace(/[:T]/g,'_')}.pdf`;
        document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      }).catch(err => { alert("Gagal generate PDF: "+err.message) });
    };
  });

  // add/remove groups in Mode2
  addGroupBtn.addEventListener("click", function(e){
    e.preventDefault();
    const row = document.createElement("div");
    row.className = "group-row";
    row.innerHTML = `
      <div>
        <label>Jumlah Lampu</label>
        <input type="number" class="group-count input" min="0" placeholder="contoh: 4">
      </div>
      <div>
        <label>Watt per Lampu</label>
        <input type="number" class="group-watt input" min="0" placeholder="contoh: 18">
      </div>
      <div>
        <label>&nbsp;</label>
        <button class="btn small remove-btn">-</button>
      </div>
    `;
    groupsContainer.appendChild(row);
    row.querySelector(".remove-btn").addEventListener("click", function(){
      row.remove();
    });
  });

  // Mode2 calculation
  calcMode2Btn.addEventListener("click", function(){
    const groupCounts = Array.from(document.querySelectorAll(".group-count")).map(i => Number(i.value || 0));
    const groupWatts = Array.from(document.querySelectorAll(".group-watt")).map(i => Number(i.value || 0));

    if(groupCounts.length === 0 || groupCounts.every(v=>v===0)){
      alert("Isi minimal satu grup lampu.");
      return;
    }
    for(let i=0;i<groupCounts.length;i++){
      if(groupCounts[i] <= 0 || groupWatts[i] <= 0){
        alert("Pastikan setiap grup memiliki jumlah lampu dan watt per lampu yang valid.");
        return;
      }
    }

    const kkkCount = Number(document.getElementById("kkkCount").value || 0);
    const kkkVA = Number(document.getElementById("kkkVA").value || 0);
    const phase = document.getElementById("mcbType").value;
    const efficiency = Number(document.getElementById("effMode2").value || 0.8);

    let totalLampWatt = 0;
    const groups = [];
    for(let i=0;i<groupCounts.length;i++){
      const cnt = groupCounts[i];
      const w = groupWatts[i];
      const wattTotal = +(cnt * w).toFixed(2);
      totalLampWatt += wattTotal;
      let amp = phase === "1phase" ? +(wattTotal/220).toFixed(3) : +(wattTotal/(Math.sqrt(3)*400)).toFixed(3);
      groups.push({group:i+1, count:cnt, watt_each:w, watt_total:wattTotal, amp});
    }

    const kkkTotalVA = kkkCount * kkkVA;
    const totalVA = +(totalLampWatt + kkkTotalVA).toFixed(2);
    const I_total = phase === "1phase" ? +(totalLampWatt/220).toFixed(3) : +(totalLampWatt/(Math.sqrt(3)*400)).toFixed(3);
    const requiredAmp = +(I_total * 1.25).toFixed(3);

    // pick MCB simple
    const MCB_1P = [6,10,16,20,25,32,40,50,63,80,100,125];
    const MCB_3P = [10,16,20,25,32,40,50,63,80,100,125,160];
    function pickMCB(amp, phase){
      const arr = phase === "1phase" ? MCB_1P : MCB_3P;
      for(const s of arr){
        if(s >= Math.ceil(amp)) return s;
      }
      return `>${arr[arr.length-1]}`;
    }
    const recommendedMain = pickMCB(requiredAmp, phase);

    // per-group MCB rec
    let html = `<div><strong>Total Watt (lampu):</strong> ${totalLampWatt} W</div>`;
    html += `<div><strong>Total VA (inkl. KKK):</strong> ${totalVA} VA</div>`;
    html += `<div><strong>Perkiraan arus total:</strong> ${I_total} A • <strong>Required Amp (margin):</strong> ${requiredAmp} A</div>`;
    html += `<div><strong>Rekomendasi MCB utama:</strong> ${recommendedMain} A</div>`;
    html += `<hr/><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left">Grup</th><th>Jumlah</th><th>Watt/lamp</th><th>Total Watt</th><th>Amp</th><th>MCB rec</th></tr></thead><tbody>`;
    for(const g of groups){
      const rec = pickMCB(g.amp*1.25, phase);
      html += `<tr><td>${g.group}</td><td>${g.count}</td><td>${g.watt_each} W</td><td>${g.watt_total} W</td><td>${g.amp} A</td><td>${rec} A</td></tr>`;
    }
    html += `</tbody></table>`;
    html += `<div style="margin-top:8px;color:#9aa6b2;font-size:13px">KKK: ${kkkCount} × ${kkkVA} VA = ${kkkTotalVA} VA</div>`;

    resultMode2.innerHTML = html;
    resultMode2.scrollIntoView({behavior:"smooth"});
  });

  // initial state: hide both modes
  mode1.classList.add("hidden");
  mode2.classList.add("hidden");
});
