/* js/validacion.js (versión sin localStorage)
   - Lee Excel robustamente (detecta fila con "Vigencia")
   - Muestra tabla y filtros
   - Sin guardar datos en localStorage (evita límite 5MB)
*/

(function(){
  const uploadZone = document.getElementById('uploadZoneVal');
  const fileInput = document.getElementById('fileInputVal');
  const tableHead = document.getElementById('valHead');
  const tableBody = document.getElementById('valBody');
  const totalEl = document.getElementById('totalVal');
  const filteredEl = document.getElementById('filteredVal');

  const btnExport = document.getElementById('btnExportVal');
  const btnClear = document.getElementById('btnClearVal');
  const btnVigente = document.getElementById('btnVigente');
  const btnNoVigente = document.getElementById('btnNoVigente');
  const btnNoNecesita = document.getElementById('btnNoNecesita');
  const btnTodos = document.getElementById('btnTodos');

  let data = [];
  let dataTable = null;

  const headers = [
    "COD PROGRAMA","VERSIÓN PROG","CODIGO VERSION","TIPO PROGRAMA","NIVEL DE FORMACIÓN",
    "NOMBRE PROGRAMA","ESTADO PROGRAMA","Fecha Elaboracion","Año","RED CONOCIMIENTO",
    "NOMBRE_NCL","NCL CODIGO","NCL VERSION","Norma corte a NOVIEMBRE","Versión","Norma - Versión",
    "Mesa Sectorial","Tipo de Norma","Observación","Fecha de revisión","Tipo de competencia",
    "Vigencia","Fecha de Elaboración"
  ];

  function renderEmptyTable(){
    tableHead.innerHTML = "";
    tableBody.innerHTML = "";
    const tr = document.createElement("tr");
    headers.forEach(h=>{
      const th = document.createElement("th");
      th.textContent = h;
      tr.appendChild(th);
    });
    tableHead.appendChild(tr);

    const trEmpty = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = headers.length;
    td.className = "text-center text-muted";
    td.textContent = "Sube el archivo Excel para ver los datos";
    trEmpty.appendChild(td);
    tableBody.appendChild(trEmpty);
    totalEl.textContent = 0;
    filteredEl.textContent = 0;
  }

  function bytesToWorkbook(buf){
    const arr = new Uint8Array(buf);
    return XLSX.read(arr, {type:'array'});
  }

  function detectHeaderRow(ws){
    const range = XLSX.utils.decode_range(ws['!ref']);
    for(let R = range.s.r; R <= range.e.r; ++R){
      let rowText = "";
      for(let C = range.s.c; C <= range.e.c; ++C){
        const cell = ws[XLSX.utils.encode_cell({r:R, c:C})];
        if(cell && cell.v) rowText += String(cell.v).toUpperCase() + " ";
      }
      if(rowText.includes("VIGENCIA")) return R;
    }
    return 0;
  }

  function processWorkbook(wb){
    const ws = wb.Sheets[wb.SheetNames[0]];
    const headerRow = detectHeaderRow(ws);
    const json = XLSX.utils.sheet_to_json(ws,{range: headerRow, defval:""});
    data = json;

    // Guardar en localStorage
    localStorage.setItem("valData", JSON.stringify(data));

    renderTable();
  }

  function processFile(f){
    const reader = new FileReader();
    reader.onload = e=>{
      try{
        const wb = bytesToWorkbook(e.target.result);
        processWorkbook(wb);
      }catch(err){ alert("Error leyendo Excel: " + err.message); }
    };
    reader.readAsArrayBuffer(f);
  }

  function renderTable(){
    tableHead.innerHTML = "";
    tableBody.innerHTML = "";

    if(!data || data.length === 0){ renderEmptyTable(); return; }

    const keys = Object.keys(data[0]);
    const tr = document.createElement("tr");
    keys.forEach(k=>{
      const th = document.createElement("th");
      th.textContent = k;
      tr.appendChild(th);
    });
    tableHead.appendChild(tr);

    data.forEach(r=>{
      const trb = document.createElement("tr");
      keys.forEach(k=>{
        const td = document.createElement("td");
        td.textContent = r[k] ?? "";
        trb.appendChild(td);
      });
      tableBody.appendChild(trb);
    });

    if(dataTable){ dataTable.destroy(); }
    dataTable = $("#valTable").DataTable({
      paging:true, searching:true, info:true, pageLength:10, order:[]
    });

    updateStats();
  }

  function updateStats(){
    totalEl.textContent = data.length;
    filteredEl.textContent = dataTable ? dataTable.rows({filter:'applied'}).data().length : data.length;
  }

  function filterByVigencia(tipo){
    if(!dataTable) return;
    if(tipo === "todos"){ dataTable.search("").draw(); }
    else dataTable.search(tipo, true, false).draw();
    updateStats();
  }

  btnVigente.addEventListener("click",()=>filterByVigencia("VIGENTE"));
  btnNoVigente.addEventListener("click",()=>filterByVigencia("NO VIGENTE"));
  btnNoNecesita.addEventListener("click",()=>filterByVigencia("NO NECESITA"));
  btnTodos.addEventListener("click",()=>filterByVigencia("todos"));

  uploadZone.addEventListener("click",()=>fileInput.click());
  uploadZone.addEventListener("dragover",e=>{e.preventDefault();uploadZone.classList.add("dragover");});
  uploadZone.addEventListener("dragleave",e=>{e.preventDefault();uploadZone.classList.remove("dragover");});
  uploadZone.addEventListener("drop",e=>{
    e.preventDefault();uploadZone.classList.remove("dragover");
    const f = e.dataTransfer.files[0];
    if(f) processFile(f);
  });
  fileInput.addEventListener("change",e=>{
    const f = e.target.files[0];
    if(f) processFile(f);
  });

  btnExport.addEventListener("click",()=>{
    if(!data || data.length === 0){
      alert("No hay datos para exportar");
      return;
    }
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,"Validacion");
    XLSX.writeFile(wb,"Validacion_export_"+new Date().toISOString().slice(0,10)+".xlsx");
  });

  btnClear.addEventListener("click",()=>{
    data = [];
    localStorage.removeItem("valData"); // Eliminar del almacenamiento
    renderEmptyTable();
  });

  // Inicializar con datos desde localStorage (si existen)
  (function init(){
    const stored = localStorage.getItem("valData");
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

