import { panelService } from "../api/panel.service.js";

function imprimirGrafica(data){
    const totals = {};
    const valueKeys = ["MATRICULADOS","num_aprendices_inscritos","INSCRITOS"]; 
    (Array.isArray(data) ? data : []).forEach(r => {
        const prog = r.PROGRAMA_FORMACION || r.programa || r.PROGRAMA || "Sin Programa";
        let val = 0;
        for (const k of valueKeys){
            const n = parseInt(r[k]);
            if (!isNaN(n) && n > 0){ val = n; break; }
        }
        if (val === 0) val = 1;
        totals[prog] = (totals[prog] || 0) + val;
    });
    const entries = Object.entries(totals).sort((a,b) => b[1]-a[1]).slice(0,5);
    const labels = entries.map(e => e[0]);
    const series = entries.map(e => e[1]);
    const options = {
        series: series.length ? series : [100, 70, 80, 300, 28],
        chart: { width: 380, type: 'pie' },
        labels: labels.length ? labels : ['ADSO', 'ALIMENTOS', 'COCINA', 'DEPORTIVO', 'MESA Y BAR'],
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
