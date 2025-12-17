// ===== GRÁFICA DE DISTRIBUCIÓN POR RED DE CONOCIMIENTO =====
function imprimirGraficaRedConocimiento(data){
  try {
    console.log('Iniciando gráfica de Red de Conocimiento con', data.length, 'registros');
    
    // Agrupar por Red de Conocimiento
    const redesMap = new Map();
    
    (Array.isArray(data) ? data : []).forEach(r => {
      const red = r['RED CONOCIMIENTO'] || 'Sin Red';
      const count = redesMap.get(red) || 0;
      redesMap.set(red, count + 1);
    });
    
    // Convertir a array y ordenar por cantidad descendente, tomar top 10
    const entries = Array.from(redesMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    console.log('Redes encontradas:', entries.length);
    
    const labels = entries.map(([red]) => red);
    const series = entries.map(([, count]) => count);
    const uniqueRedesCount = redesMap.size || 0;
    
    const el = document.querySelector('#chartRedConocimiento');
    if (!el) {
      console.error('❌ Contenedor #chartRedConocimiento NO encontrado');
      return;
    }
    
    console.log('✓ Contenedor encontrado');
    
    if (typeof ApexCharts === 'undefined') {
      console.error('❌ ApexCharts no está cargado');
      el.innerHTML = '<p class="text-danger">Error: ApexCharts no cargado</p>';
      return;
    }
    
    el.innerHTML = '';
    
    const options = {
      series: series.length ? series : [10, 8, 6, 4, 2],
      chart: { 
        type: 'pie',
        width: '100%',
        height: 400
      },
      labels: labels.length ? labels : ['Red A', 'Red B', 'Red C', 'Red D', 'Red E'],
      title: { 
        text: `Top 10 de ${uniqueRedesCount} Redes de Conocimiento`,
        align: 'center',
        style: {
          fontSize: '14px',
          fontWeight: 'bold'
        }
      },
      plotOptions: {
        pie: {
          dataLabels: {
            enabled: true,
            minAngleToShowLabel: 0,
            formatter: function(val, opts) {
              const count = opts.w.globals.series[opts.seriesIndex];
              return count > 0 ? count : '';
            }
          }
        }
      },
      dataLabels: {
        enabled: true,
        style: {
          fontSize: '11px',
          fontWeight: 'bold'
        }
      },
      legend: {
        position: 'bottom',
        show: true
      },
      tooltip: {
        y: {
          formatter: function (val) {
            return val + ' normas';
          }
        }
      }
    };
    
    const chart = new ApexCharts(el, options);
    chart.render();
    console.log('✓ Gráfica de Red de Conocimiento renderizada exitosamente');
  } catch (error) {
    console.error('❌ Error al renderizar gráfica de red:', error);
  }
}
