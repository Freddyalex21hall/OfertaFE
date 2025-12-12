import { panelService } from "../api/panel.service.js";

function imprimirGrafica(data){
    const totals = new Map();
    const nameByCode = new Map();
    const keys = ["MATRICULADOS","num_aprendices_inscritos","INSCRITOS"];
    (Array.isArray(data) ? data : []).forEach(r => {
        const code = String(r.CODIGO_CENTRO || r.cod_centro || '').trim();
        const name = (r.NOMBRE_CENTRO || r.nombre_centro || '').trim();
        const key = code || name || "Sin Centro";
        let val = 0;
        for (const k of keys){
            const n = parseInt(r[k]);
            if (!isNaN(n) && n > 0){ val = n; break; }
        }
        if (val === 0) val = 1;
        totals.set(key, (totals.get(key) || 0) + val);
        if (!nameByCode.has(key)) nameByCode.set(key, name);
    });
    const entries = Array.from(totals.entries()).sort((a,b) => b[1]-a[1]).slice(0,5);
    const labels = entries.map(([key]) => {
        const nm = nameByCode.get(key) || '';
        return nm && key ? `${nm} (${key})` : (nm || key || 'Centro');
    });
    const series = entries.map(([,val]) => val);
    const options = {
        series: series.length ? series : [100, 70, 80, 300, 28],
        chart: { width: 380, type: 'pie' },
        labels: labels.length ? labels : ['Centro A (1111)', 'Centro B (2222)', 'Centro C (3333)', 'Centro D (4444)', 'Centro E (5555)'],
        responsive: [{ breakpoint: 480, options: { chart: { width: 200 }, legend: { position: 'bottom' } } }]
    };
    const el = document.querySelector("#aprendicesPrograma");
    if (!el) return;
    const chart = new ApexCharts(el, options);
    chart.render();
}

async function Init(){
    const historico = await panelService.getHistorico();
    const data = Array.isArray(historico) ? historico : (historico && historico.data ? historico.data : []);
    imprimirGrafica(data);
}

export { Init, imprimirGrafica }
