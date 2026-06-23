'use strict';

const { query }   = require('../config/db');
const PDFDocument = require('pdfkit');
const { Document, Packer, Paragraph, Table, TableRow, TableCell,
        TextRun, HeadingLevel, AlignmentType, WidthType } = require('docx');
const {
  calcularMetricas,
  calcularMetricasPorBodega,
  guardarEstadisticasMensuales,
} = require('../services/reporte.service');

async function reporteDiario(req, res) {
  const { fecha = new Date().toISOString().split('T')[0], bodega_id } = req.query;
  try {
    const global  = await calcularMetricas(fecha, fecha, bodega_id ?? null);
    const bodegas = bodega_id ? null : await calcularMetricasPorBodega(fecha, fecha);
    return res.status(200).json({ tipo: 'diario', fecha, global, bodegas });
  } catch (err) {
    console.error('[reporte.controller] reporteDiario:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function reporteSemanal(req, res) {
  const hoy = new Date();
  const lunes = new Date(hoy); lunes.setDate(hoy.getDate() - hoy.getDay() + 1);
  const domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6);
  const fechaDesde = req.query.fecha_inicio ?? lunes.toISOString().split('T')[0];
  const fechaHasta = req.query.fecha_fin    ?? domingo.toISOString().split('T')[0];
  const { bodega_id } = req.query;
  try {
    const global  = await calcularMetricas(fechaDesde, fechaHasta, bodega_id ?? null);
    const bodegas = bodega_id ? null : await calcularMetricasPorBodega(fechaDesde, fechaHasta);
    return res.status(200).json({ tipo: 'semanal', fecha_desde: fechaDesde, fecha_hasta: fechaHasta, global, bodegas });
  } catch (err) {
    console.error('[reporte.controller] reporteSemanal:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function reporteMensual(req, res) {
  const ahora = new Date();
  const mes   = parseInt(req.query.mes  ?? ahora.getMonth() + 1);
  const anio  = parseInt(req.query.anio ?? ahora.getFullYear());
  const { bodega_id } = req.query;
  const fechaDesde = `${anio}-${String(mes).padStart(2, '0')}-01`;
  const fechaHasta = new Date(anio, mes, 0).toISOString().split('T')[0];
  try {
    const global  = await calcularMetricas(fechaDesde, fechaHasta, bodega_id ?? null);
    const bodegas = bodega_id ? null : await calcularMetricasPorBodega(fechaDesde, fechaHasta);
    await guardarEstadisticasMensuales(mes, anio, global, bodega_id ?? null);
    if (!bodega_id && bodegas)
      for (const b of bodegas) await guardarEstadisticasMensuales(mes, anio, b, b.bodega_id);
    return res.status(200).json({ tipo: 'mensual', mes, anio, fecha_desde: fechaDesde, fecha_hasta: fechaHasta, global, bodegas });
  } catch (err) {
    console.error('[reporte.controller] reporteMensual:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function listarEstadisticasMensuales(req, res) {
  const { bodega_id, anio = new Date().getFullYear() } = req.query;
  try {
    let sql = `SELECT em.*, b.nombre AS bodega_nombre
                  FROM estadisticas_mensuales em
                  LEFT JOIN bodegas b ON b.id = em.bodega_id
                WHERE em.anio = ?`;
    const params = [anio];
    if (bodega_id) { sql += ' AND em.bodega_id = ?'; params.push(bodega_id); }
    sql += ' ORDER BY em.mes DESC, em.bodega_id';
    const estadisticas = await query(sql, params);
    return res.status(200).json({ estadisticas });
  } catch (err) {
    console.error('[reporte.controller] listarEstadisticasMensuales:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function exportarPDF(req, res) {
  const ahora = new Date();
  const mes   = parseInt(req.query.mes  ?? ahora.getMonth() + 1);
  const anio  = parseInt(req.query.anio ?? ahora.getFullYear());
  const { bodega_id } = req.query;
  try {
    const fechaDesde = `${anio}-${String(mes).padStart(2,'0')}-01`;
    const fechaHasta = new Date(anio, mes, 0).toISOString().split('T')[0];
    const global     = await calcularMetricas(fechaDesde, fechaHasta, bodega_id ?? null);
    const bodegas    = bodega_id ? null : await calcularMetricasPorBodega(fechaDesde, fechaHasta);
    const nombreMes  = new Date(anio, mes-1).toLocaleString('es-VE', { month: 'long' });

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="tuparley-${anio}-${String(mes).padStart(2,'0')}.pdf"`);
    doc.pipe(res);

    doc.fontSize(22).fillColor('#10b981').text('TuParley — Reporte Mensual', { align: 'center' });
    doc.fontSize(12).fillColor('#94a3b8').text(`${nombreMes} ${anio}`, { align: 'center' });
    doc.moveDown();
    doc.moveTo(40,doc.y).lineTo(555,doc.y).strokeColor('#1e293b').stroke();
    doc.moveDown();
    doc.fontSize(14).fillColor('#ffffff').text('Resumen Global', { underline: true });
    doc.moveDown(0.5);

    [
      ['Total tickets',       global.total_tickets],
      ['Ganados',             global.tickets_ganados],
      ['Perdidos',            global.tickets_perdidos],
      ['Suspendidos',         global.tickets_suspendidos],
      ['Anulados',            global.tickets_anulados],
      ['Caducados sin cobro', global.tickets_caducados],
      ['Total recaudado',    `$${global.total_recaudado_usd}`],
      ['Premios pagados',    `$${global.premios_pagados_usd}`],
      ['Ganancia bruta',     `$${global.ganancia_bruta_usd}`],
      ['Operador (80%)',     `$${global.ganancia_operador_usd}`],
      ['Bodeguero (20%)',    `$${global.ganancia_bodeguero_usd}`],
      ['Promedio apuesta',   `$${global.promedio_apuesta_usd}`],
      ['Categoría top',       global.categoria_mas_jugada ?? 'N/A'],
    ].forEach(([e,v]) => {
      doc.fontSize(11).fillColor('#94a3b8').text(`${e}:`, 40, doc.y, { continued:true, width:280 });
      doc.fillColor('#ffffff').text(String(v));
    });

    if (bodegas?.length) {
      doc.addPage();
      doc.fontSize(14).fillColor('#ffffff').text('Detalle por Bodega', { underline: true });
      doc.moveDown(0.5);
      for (const b of bodegas) {
        doc.fontSize(12).fillColor('#10b981').text(`${b.bodega_nombre} (${b.bodega_prefijo})`);
        [
          ['Tickets',        b.total_tickets],
          ['Recaudado',     `$${b.total_recaudado_usd}`],
          ['Premios pagados',`$${b.premios_pagados_usd}`],
          ['Ganancia bruta', `$${b.ganancia_bruta_usd}`],
          ['Categoría top',  b.categoria_mas_jugada ?? 'N/A'],
        ].forEach(([e,v]) => {
          doc.fontSize(10).fillColor('#94a3b8').text(`  ${e}:`, 40, doc.y, { continued:true, width:280 });
          doc.fillColor('#ffffff').text(String(v));
        });
        doc.moveDown(0.5);
      }
    }
    doc.end();
  } catch (err) {
    console.error('[reporte.controller] exportarPDF:', err);
    if (!res.headersSent) return res.status(500).json({ error: 'Error generando PDF' });
  }
}

async function exportarWord(req, res) {
  const ahora = new Date();
  const mes   = parseInt(req.query.mes  ?? ahora.getMonth() + 1);
  const anio  = parseInt(req.query.anio ?? ahora.getFullYear());
  const { bodega_id } = req.query;
  try {
    const fechaDesde = `${anio}-${String(mes).padStart(2,'0')}-01`;
    const fechaHasta = new Date(anio, mes, 0).toISOString().split('T')[0];
    const global     = await calcularMetricas(fechaDesde, fechaHasta, bodega_id ?? null);
    const bodegas    = bodega_id ? null : await calcularMetricasPorBodega(fechaDesde, fechaHasta);
    const nombreMes  = new Date(anio, mes-1).toLocaleString('es-VE', { month:'long' });

    const crearFila = ([etiqueta, valor]) => new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: etiqueta, bold: true })] })] }),
        new TableCell({ children: [new Paragraph(String(valor))] }),
      ],
    });

    const filasGlobal = [
      ['Total tickets',      String(global.total_tickets)],
      ['Ganados',            String(global.tickets_ganados)],
      ['Perdidos',           String(global.tickets_perdidos)],
      ['Suspendidos',        String(global.tickets_suspendidos)],
      ['Anulados',           String(global.tickets_anulados)],
      ['Caducados',          String(global.tickets_caducados)],
      ['Total recaudado',   `$${global.total_recaudado_usd}`],
      ['Premios pagados',   `$${global.premios_pagados_usd}`],
      ['Ganancia bruta',    `$${global.ganancia_bruta_usd}`],
      ['Operador (80%)',    `$${global.ganancia_operador_usd}`],
      ['Bodeguero (20%)',   `$${global.ganancia_bodeguero_usd}`],
      ['Promedio apuesta',  `$${global.promedio_apuesta_usd}`],
      ['Categoría top',      global.categoria_mas_jugada ?? 'N/A'],
    ];

    const children = [
      new Paragraph({ text: 'TuParley — Reporte Mensual', heading: HeadingLevel.HEADING_1 }),
      new Paragraph({ text: `${nombreMes} ${anio}`, alignment: AlignmentType.CENTER }),
      new Paragraph({ text: '' }),
      new Paragraph({ text: 'Resumen Global', heading: HeadingLevel.HEADING_2 }),
      new Table({ width: { size:100, type: WidthType.PERCENTAGE }, rows: filasGlobal.map(crearFila) }),
    ];

    if (bodegas?.length) {
      children.push(new Paragraph({ text: '' }));
      children.push(new Paragraph({ text: 'Detalle por Bodega', heading: HeadingLevel.HEADING_2 }));
      for (const b of bodegas) {
        children.push(new Paragraph({ text: `${b.bodega_nombre} (${b.bodega_prefijo})`, heading: HeadingLevel.HEADING_3 }));
        children.push(new Table({
          width: { size:100, type: WidthType.PERCENTAGE },
          rows: [
            ['Tickets',        String(b.total_tickets)],
            ['Recaudado',     `$${b.total_recaudado_usd}`],
            ['Premios pagados',`$${b.premios_pagados_usd}`],
            ['Ganancia bruta', `$${b.ganancia_bruta_usd}`],
            ['Categoría top',  b.categoria_mas_jugada ?? 'N/A'],
          ].map(crearFila),
        }));
        children.push(new Paragraph({ text: '' }));
      }
    }

    const buffer = await Packer.toBuffer(new Document({ sections: [{ children }] }));
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition',`attachment; filename="tuparley-${anio}-${String(mes).padStart(2,'0')}.docx"`);
    return res.send(buffer);
  } catch (err) {
    console.error('[reporte.controller] exportarWord:', err);
    if (!res.headersSent) return res.status(500).json({ error: 'Error generando Word' });
  }
}

module.exports = { reporteDiario, reporteSemanal, reporteMensual, listarEstadisticasMensuales, exportarPDF, exportarWord };