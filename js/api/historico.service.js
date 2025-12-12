import { request } from './apiClient.js';

export const panelService = {
    getHistorico: () => {
        const endpoint = `/historico/obtener-todos`;
        
        let respuesta = request(endpoint);

        return respuesta;
    },
    porGrupo: (id_grupo) => request(`/historico/obtener-por-grupo/${id_grupo}`),
    porFicha: (ficha) => request(`/historico/obtener-por-ficha/${ficha}`),
    porCodPrograma: (cod_programa) => request(`/historico/obtener-por-cod_programa/${cod_programa}`),
    porCodCentro: (cod_centro) => request(`/historico/obtener-por-cod_centro/${cod_centro}`),
    porJornada: (jornada) => request(`/historico/obtener-por-jornada/${jornada}`),
    porEstadoCurso: (estado_curso) => request(`/historico/obtener-por-estado-curso/${estado_curso}`),
    porFechaInicio: (fecha_inicio) => request(`/historico/obtener-por-fecha_inicio/${fecha_inicio}`),
    porFechaFin: (fecha_fin) => request(`/historico/obtener-por-fecha_fin/${fecha_fin}`),
    porCodMunicipio: (cod_municipio) => request(`/historico/obtener-por-cod_municipio/${cod_municipio}`),
    porNumInscritos: (num_aprendices_inscritos) => request(`/historico/obtener-por-num_aprendices_inscritos/${num_aprendices_inscritos}`),
    porNumTransito: (num_aprendices_en_transito) => request(`/historico/obtener-por-num_aprendices_en_transito/${num_aprendices_en_transito}`),
    porNumFormacion: (num_aprendices_formacion) => request(`/historico/obtener-por-num_aprendices_formacion/${num_aprendices_formacion}`),
    porNumInduccion: (num_aprendices_induccion) => request(`/historico/obtener-por-num_aprendices_induccion/${num_aprendices_induccion}`),
    porNumCondicionados: (num_aprendices_condicionados) => request(`/historico/obtener-por-num_aprendices_condicionados/${num_aprendices_condicionados}`),
    porNumAplazados: (num_aprendices_aplazados) => request(`/historico/obtener-por-num_aprendices_aplazados/${num_aprendices_aplazados}`),
    porNumRetiradoVoluntario: (num_aprendices_retirado_voluntario) => request(`/historico/obtener-por-num_aprendices_retirado_voluntario/${num_aprendices_retirado_voluntario}`),
    porNumCancelados: (num_aprendices_cancelados) => request(`/historico/obtener-por-num_aprendices_cancelados/${num_aprendices_cancelados}`),
    porNumReprobados: (num_aprendices_reprobados) => request(`/historico/obtener-por-num_aprendices_reprobados/${num_aprendices_reprobados}`),
    porNumNoAptos: (num_aprendices_no_aptos) => request(`/historico/obtener-por-num_aprendices_no_aptos/${num_aprendices_no_aptos}`),
    porNumReingresados: (num_aprendices_reingresados) => request(`/historico/obtener-por-num_aprendices_reingresados/${num_aprendices_reingresados}`),
    porNumPorCertificar: (num_aprendices_por_certificar) => request(`/historico/obtener-por-num_aprendices_por_certificar/${num_aprendices_por_certificar}`),
    porNumCertificados: (num_aprendices_certificados) => request(`/historico/obtener-por-num_aprendices_certificados/${num_aprendices_certificados}`),
    porNumTrasladados: (num_aprendices_trasladados) => request(`/historico/obtener-por-num_aprendices_trasladados/${num_aprendices_trasladados}`),
};

// Servicio para Registro Calificado (mismo archivo para centralizar llamadas)
export const registroCalificadoService = {
    getAll: () => request('/registro_calificado/registro_calificado/listar'),
};



