/* js/reportes.js (versión sin localStorage)
   - Carga Excel grande sin guardar en almacenamiento local
   - Reemplaza datos si se sube un nuevo archivo
   - Filtros: Código Programa, Nombre Programa, Periodo Oferta
*/

(function(){
  const uploadZone = document.getElementById('uploadZoneReportes');
  const fileInput = document.getElementById('fileInputReportes');
  const tableHead = document.getElementById('reportesHead');
  const tableBody = document.getElementById('reportesBody');
  const totalEl = document.getElementById('totalReportes');
  const filteredEl = document.getElementById('filteredReportes');

  const inputCodigo = document.getElementById('filterCodigo');
  const inputNombre = document.getElementById('filterNombre');
  const selectPeriodo = document.getElementById('filterPeriodo');

  const btnExport = document.getElementById('btnExportReportes');
  const btnClear = document.getElementById('btnClearReportes');

  let data = [];
  let dataTable = null;

  const headers = [
    "ID_INDICATIVA","REGIONAL","CODIGO_DE_CENTRO","NOMBRE_SEDE","VIGENCIA",
    "PERIODO OFERTA","CODIGO_PROGRAMA","VERSION","CODIGO_VERSION","NOMBRE_PROGRAMA",
    "NIVEL_DE_FORMACION","MODALIDAD","MES_INICIO","CUPOS","AÑO_TERMINA",
    "DEPARTAMENTO_FORMACION","CODIGO_DANE_DEPARTAMENTO","MUNICIPIO_FORMACION",
    "CODIGO_DANE_MUNICIPIO","GIRA_TECNICA","PROGRAMA_FIC","TIPO_DE_OFERTA",
    "PERSONA_REGISTRA","FECHA_DE_REGISTRO","TIPO_DE_INSTITUCION","NIVEL_INSTITUCION"
  ];

  function renderEmptyTable(){
    tableHead.innerHTML = "";
    tableBody.innerHTML = "";
    const tr = document.createElement("tr");
    headers.forEach(h=>{
      const th=document.createElement("th");
      th.textContent=h.replace(/_/g," ").replace(/\b([a-z])/g,c=>c.toUpperCase());
      tr.appendChild(th);
    });
    tableHead.appendChild(tr);

    const trEmpty = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = headers.length;
    td.className="text-center text-muted";
    td.textContent="Sube el archivo Excel para ver los datos";
    trEmpty.appendChild(td);
    tableBody.appendChild(trEmpty);
    totalEl.textContent=0;
    filteredEl.textContent=0;
  }

  function bytesToWorkbook(buf){
    const arr=new Uint8Array(buf);
    return XLSX.read(arr,{type:'array'});
  }

  function detectHeaderRow(ws){
    const range = XLSX.utils.decode_range(ws['!ref']);
    for(let R = range.s.r; R <= range.e.r; ++R){
      let rowText = "";
      for(let C = range.s.c; C <= range.e.c; ++C){
        const cell = ws[XLSX.utils.encode_cell({r:R, c:C})];
        if(cell && cell.v) rowText += String(cell.v).toUpperCase() + " ";
      }
      if(rowText.includes("CODIGO_PROGRAMA") || rowText.includes("NOMBRE_PROGRAMA"))
        return R;
    }
    return 0;
  }

  function processWorkbook(wb){
    const ws=wb.Sheets[wb.SheetNames[0]];
    const headerRow=detectHeaderRow(ws);
    const json=XLSX.utils.sheet_to_json(ws,{range:headerRow,defval:""});
    data=json;

    // Guardar en localStorage
    localStorage.setItem("reportesData", JSON.stringify(data));

    renderTable();
  }

  function processFile(f){
    const reader=new FileReader();
    reader.onload=e=>{
      try{
        const wb=bytesToWorkbook(e.target.result);
        processWorkbook(wb);
      }catch(err){ alert("Error leyendo Excel: "+err.message); }
    };
    reader.readAsArrayBuffer(f);
  }

  function renderTable(){
    tableHead.innerHTML="";
    tableBody.innerHTML="";
    if(!data||data.length===0){ renderEmptyTable(); return; }

    const keys=Object.keys(data[0]);
    const tr=document.createElement("tr");
    keys.forEach(k=>{
      const th=document.createElement("th");
      th.textContent=k.replace(/_/g," ").replace(/\b([a-z])/g,c=>c.toUpperCase());
      tr.appendChild(th);
    });
    tableHead.appendChild(tr);

    data.forEach(r=>{
      const trb=document.createElement("tr");
      keys.forEach(k=>{
        const td=document.createElement("td");
        td.textContent=r[k]??"";
        trb.appendChild(td);
      });
      tableBody.appendChild(trb);
    });

    if(dataTable){ dataTable.destroy(); }
    dataTable=$("#reportesTable").DataTable({
      paging:true, searching:true, info:true, pageLength:10, order:[]
    });

    updatePeriodoOptions();
    applyFilters(); // Aplicar filtros si hay valores cargados
    updateStats();
  }

  function updateStats(){
    totalEl.textContent=data.length;
    filteredEl.textContent=dataTable?dataTable.rows({filter:'applied'}).data().length:data.length;
  }

  function updatePeriodoOptions(){
    selectPeriodo.innerHTML='<option value="">Periodo (todos)</option>';
    const vals=[...new Set(data.map(r=>r["PERIODO OFERTA"]).filter(Boolean))].sort();
    vals.forEach(v=>{
      const opt=document.createElement("option");
      opt.value=v; opt.textContent=v;
      selectPeriodo.appendChild(opt);
    });
  }

  function applyFilters(){
    if(!dataTable) return;
    const code=inputCodigo.value.trim();
    const name=inputNombre.value.trim();
    const period=selectPeriodo.value.trim();

    dataTable.columns().every(function(){
      const h=this.header().innerText.toLowerCase();
      if(h.includes("código programa")||h.includes("codigo programa"))
        this.search(code?code:"",false,true,true);
      else if(h.includes("nombre programa"))
        this.search(name?name:"",false,true,true);
      else if(h.includes("periodo oferta"))
        this.search(period?('^'+period+'$'):"",true,false,true);
      else this.search("");
    });

    dataTable.draw();
    updateStats();
  }

  inputCodigo.addEventListener("input",applyFilters);
  inputNombre.addEventListener("input",applyFilters);
  selectPeriodo.addEventListener("change",applyFilters);

  uploadZone.addEventListener("click",()=>fileInput.click());
  uploadZone.addEventListener("dragover",e=>{e.preventDefault();uploadZone.classList.add("dragover");});
  uploadZone.addEventListener("dragleave",e=>{e.preventDefault();uploadZone.classList.remove("dragover");});
  uploadZone.addEventListener("drop",e=>{
    e.preventDefault();uploadZone.classList.remove("dragover");
    const f=e.dataTransfer.files[0];
    if(f) processFile(f);
  });
  fileInput.addEventListener("change",e=>{
    const f=e.target.files[0];
    if(f) processFile(f);
  });

  btnExport.addEventListener("click",()=>{
    if(!data||data.length===0){alert("No hay datos para exportar");return;}
    const ws=XLSX.utils.json_to_sheet(data);
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,"Reportes");
    XLSX.writeFile(wb,"Reportes_export_"+new Date().toISOString().slice(0,10)+".xlsx");
  });

  btnClear.addEventListener("click",()=>{
    data=[];
    localStorage.removeItem("reportesData");
    inputCodigo.value = "";
    inputNombre.value = "";
    selectPeriodo.value = "";
    renderEmptyTable();
  });

  // ====== Inicio ======
  (function init(){
    const stored = localStorage.getItem("reportesData");
    if (stored) {
      try {
        data = JSON.parse(stored);
        renderTable();
      } catch (e) {
        console.error("Error leyendo localStorage:", e);
        renderEmptyTable();
      }
    } else {
      renderEmptyTable();
    }
  })();

})();
