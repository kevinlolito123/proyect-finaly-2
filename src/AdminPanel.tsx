import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

type EstadoConexion = { online: boolean; mode: string };

type Usuario = {
  id?: number;
  codigo: string;
  nombre: string;
  perfil?: string;
  escuela?: string;
  fecha?: string | Date;
  fecha_registro?: string | Date;
};

type Sesion = {
  id?: number;
  codigo: string;
  actividad?: string;
  tiempoestimado?: string;
  numeroequipo?: number;
  fecha?: string | Date;
  horainicio?: string;
  sincronizado?: boolean;
};

function AdminPanel() {
  const navigate = useNavigate();
  const [estado, setEstado] = useState<EstadoConexion>({ online: false, mode: 'local' });
  const [tab, setTab] = useState<'usuarios' | 'sesiones'>('usuarios');
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [sesiones, setSesiones] = useState<Sesion[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [loading, setLoading] = useState<boolean>(false);
  const [filtroCodigo, setFiltroCodigo] = useState<string>('');
  const [fechaDesde, setFechaDesde] = useState<string>('');
  const [fechaHasta, setFechaHasta] = useState<string>('');
  const [confirmVisible, setConfirmVisible] = useState<boolean>(false);
  const [confirmType, setConfirmType] = useState<'usuario' | 'sesion'>('usuario');
  const [confirmPayload, setConfirmPayload] = useState<any>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string | number>>(new Set());
  const [selectMode, setSelectMode] = useState<boolean>(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string | number>>(new Set());

  // Función para formatear fechas - Actualizada para PostgreSQL 17
  const formatearFecha = (fecha: string | Date | undefined): string => {
    if (!fecha) return '-';
    
    try {
      const date = new Date(fecha);
      if (isNaN(date.getTime())) return '-';
      
      // Formato: DD/MM/YYYY - PostgreSQL 17 usa ISO 8601 por defecto (YYYY-MM-DD)
      const dia = date.getDate().toString().padStart(2, '0');
      const mes = (date.getMonth() + 1).toString().padStart(2, '0');
      const anio = date.getFullYear();
      
      return `${dia}/${mes}/${anio}`;
    } catch {
      return '-';
    }
  };

  // Cambia la función de formateo para mostrar fecha_registro sin hora - Actualizada para PostgreSQL 17
  const formatearFechaHora = (fecha: string | Date | undefined): string => {
    if (!fecha) return '-';
    try {
      const d = new Date(fecha);
      if (isNaN(d.getTime())) return '-';
      
      const dia = d.getDate().toString().padStart(2, '0');
      const mes = (d.getMonth() + 1).toString().padStart(2, '0');
      const anio = d.getFullYear();
      // PostgreSQL 17 usa formato ISO 8601 para timestamps, pero mostramos solo la fecha en formato DD/MM/YYYY
      return `${dia}/${mes}/${anio}`;
    } catch {
      return '-';
    }
  };

  useEffect(() => {
    const cargarEstado = async () => {
      try {
        const e = await (window as any).electronAPI?.obtenerEstadoConexion();
        if (e) setEstado(e);
      } catch {}
    };
    cargarEstado();
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      if (tab === 'usuarios') {
        const res = await (window as any).electronAPI?.adminListarUsuarios({ page, pageSize, filtro: { codigo: filtroCodigo || undefined } });
        if (res?.success) {
          setUsuarios(res.data || []);
          setTotal(res.total || 0);
        }
      } else {
        const res = await (window as any).electronAPI?.adminListarSesiones({ page, pageSize, filtro: { codigo: filtroCodigo || undefined, fechaDesde: fechaDesde || undefined, fechaHasta: fechaHasta || undefined } });
        if (res?.success) {
          setSesiones(res.data || []);
          setTotal(res.total || 0);
        }
      }
    } catch {
      // noop
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, page, pageSize]);

  // Limpiar selección al cambiar de pestaña
  useEffect(() => {
    setSelectedKeys(new Set());
    setSelectMode(false);
  }, [tab]);

  const exportarCSV = () => {
    const filas = tab === 'usuarios' ? usuarios : sesiones;
    if (!filas || filas.length === 0) return;
    const headers = Object.keys(filas[0]);
    const csv = [headers.join(',')]
      .concat(
        filas.map((row: any) => headers.map(h => JSON.stringify(row[h] ?? '')).join(','))
      )
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = tab === 'usuarios' ? 'usuarios.csv' : 'sesiones.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const logoutAdmin = async () => {
    try { await (window as any).electronAPI?.adminLogout(); } catch {}
    navigate('/');
  };

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  return (
    <div className="min-h-screen bg-[#001640] text-white p-6">
      <div className="max-w-7xl w-full mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-xl font-semibold">Panel de Super Administrador</h1>
          <div className="flex items-center gap-3">
            <span className={`text-xs px-2 py-1 rounded ${estado.mode === 'online' ? 'bg-green-700' : 'bg-yellow-700'}`}>{estado.mode.toUpperCase()}</span>
            <button onClick={logoutAdmin} className="px-3 py-2 bg-red-600 rounded">Cerrar sesión</button>
          </div>
        </div>

        <div className="bg-[#002862] rounded-lg border border-[#4DA6FF] shadow-[0_0_15px_rgba(77,166,255,0.25)]">
          <div className="p-4 border-b border-[#4DA6FF]/40 flex items-center justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <button className={`px-3 py-2 rounded ${tab==='usuarios'?'bg-[#4DA6FF] text-black':'bg-[#003a7a]'}`} onClick={() => { setTab('usuarios'); setPage(1); }}>
                Usuarios
              </button>
              <button className={`px-3 py-2 rounded ${tab==='sesiones'?'bg-[#4DA6FF] text-black':'bg-[#003a7a]'}`} onClick={() => { setTab('sesiones'); setPage(1); }}>
                Sesiones
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input value={filtroCodigo} onChange={(e)=>setFiltroCodigo(e.target.value)} placeholder="Filtrar por código" className="px-3 py-2 rounded bg-[#003a7a] outline-none" />
              {tab==='sesiones' && (
                <>
                  <input type="date" value={fechaDesde} onChange={(e)=>setFechaDesde(e.target.value)} className="px-3 py-2 rounded bg-[#003a7a] outline-none" />
                  <input type="date" value={fechaHasta} onChange={(e)=>setFechaHasta(e.target.value)} className="px-3 py-2 rounded bg-[#003a7a] outline-none" />
                </>
              )}
              <button onClick={() => { setPage(1); cargarDatos(); }} className="px-3 py-2 bg-[#2366cc] rounded">Buscar</button>
              <button onClick={exportarCSV} className="px-3 py-2 bg-[#FFD700]/30 rounded">Exportar CSV</button>
              {!selectMode ? (
                <button onClick={() => setSelectMode(true)} className="px-3 py-2 bg-[#4DA6FF]/40 rounded shrink-0">Seleccionar</button>
              ) : (
                <>
                  <button
                    onClick={async () => {
                      if (selectedKeys.size === 0) { setSelectMode(false); return; }
                      
                      const keys = Array.from(selectedKeys);
                      setDeletingIds(prev => new Set([...Array.from(prev), ...keys]));
                      
                      try {
                        // Eliminar en el backend primero
                        if (tab === 'usuarios') {
                          // Realizar todas las eliminaciones y esperar a que terminen
                          const resultados = await Promise.allSettled(keys.map((k:any) => 
                            (window as any).electronAPI?.adminEliminarUsuario?.(typeof k === 'number' ? { id: k } : { codigo: k })
                          ));
                          
                          // Verificar cuáles fueron exitosos
                          const exitosos = resultados
                            .map((resultado, index) => resultado.status === 'fulfilled' && resultado.value?.success ? keys[index] : null)
                            .filter(Boolean);
                          
                          if (exitosos.length > 0) {
                            // Actualizar la UI solo para los que se eliminaron exitosamente
                            const exitososSet = new Set(exitosos);
                            setUsuarios(prev => prev.filter(u => !exitososSet.has(u.id ?? u.codigo)));
                            setTotal(t => Math.max(0, t - exitosos.length));
                          }
                        } else {
                          // Mismo proceso para sesiones
                          const resultados = await Promise.allSettled(keys.map((id:any) => 
                            (window as any).electronAPI?.adminEliminarSesion?.({ id })
                          ));
                          
                          const exitosos = resultados
                            .map((resultado, index) => resultado.status === 'fulfilled' && resultado.value?.success ? keys[index] : null)
                            .filter(Boolean);
                          
                          if (exitosos.length > 0) {
                            const exitososSet = new Set(exitosos);
                            setSesiones(prev => prev.filter(s => !exitososSet.has(s.id ?? '')));
                            setTotal(t => Math.max(0, t - exitosos.length));
                          }
                        }
                      } catch (error) {
                        console.error('Error en la eliminación masiva:', error);
                      } finally {
                        // Recargar datos para asegurar consistencia
                        cargarDatos();
                        setDeletingIds(new Set());
                        setSelectedKeys(new Set());
                        setSelectMode(false);
                      }
                    }}
                    className="px-3 py-2 bg-gradient-to-r from-[#FF4D4D] to-[#B30000] text-white rounded shrink-0"
                  >
                    Eliminar seleccionados
                  </button>
                  <button onClick={() => { setSelectedKeys(new Set()); setSelectMode(false); }} className="px-3 py-2 bg-gray-500/60 rounded shrink-0">Cancelar</button>
                </>
              )}
            </div>
          </div>

          <div className="p-4 overflow-auto">
            {loading ? (
              <div className="py-10 text-center text-sm text-gray-300">Cargando...</div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="text-[#B0C4DE]">
                  <tr>
                    {tab==='usuarios' ? (
                      <>
                        {selectMode && <th className="py-2 pr-2 w-8"></th>}
                        <th className="py-2 pr-4">N°</th>
                        <th className="py-2 pr-4">Código</th>
                        <th className="py-2 pr-4">Nombre</th>
                        <th className="py-2 pr-4">Perfil</th>
                        <th className="py-2 pr-4">Escuela</th>
                        <th className="py-2 pr-4">Fecha</th>
                        <th className="py-2 pr-4">Acciones</th>
                      </>
                    ) : (
                      <>
                        {selectMode && <th className="py-2 pr-2 w-8"></th>}
                        <th className="py-2 pr-4">N°</th>
                        <th className="py-2 pr-4">Código</th>
                        <th className="py-2 pr-4">Actividad</th>
                        <th className="py-2 pr-4">Tiempo</th>
                        <th className="py-2 pr-4">Equipo</th>
                        <th className="py-2 pr-4">Fecha</th>
                        <th className="py-2 pr-4">Hora Inicio</th>
                        <th className="py-2 pr-4">Sincronizado</th>
                        <th className="py-2 pr-4">Acciones</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {tab==='usuarios' ? (
                    [...usuarios].sort((a, b) => (a.id ?? 0) - (b.id ?? 0)).map((u, index) => {
                      const k = u.id ?? u.codigo;
                      const selected = selectedKeys.has(k);
                      return (
                      <tr key={`${k}`} className={`border-t border-[#4DA6FF]/20 ${selected ? 'bg-red-900/30' : ''}`} onClick={() => {
                        if (!selectMode) return;
                        setSelectedKeys(prev => {
                          const n = new Set(prev);
                          if (n.has(k)) n.delete(k); else n.add(k);
                          return n;
                        });
                      }}>
                        {selectMode && (
                          <td className="py-2 pr-2">
                            <input type="checkbox" className="h-4 w-4 accent-red-600" checked={selected} onChange={() => { /* manejado en onClick fila */ }} />
                          </td>
                        )}
                        <td className="py-2 pr-4">{index + 1}</td>
                        <td className="py-2 pr-4">{u.codigo}</td>
                        <td className="py-2 pr-4">{u.nombre}</td>
                        <td className="py-2 pr-4">{u.perfil ?? '-'}</td>
                        <td className="py-2 pr-4">{u.escuela ?? '-'}</td>
                        <td className="py-2 pr-4">{formatearFechaHora(u.fecha_registro)}</td>
                        <td className="py-2 pr-4">
                          <button
                            onClick={(e) => { 
                              e.stopPropagation(); // Evitar que el clic se propague a la fila
                              setConfirmType('usuario'); 
                              setConfirmPayload({ id: u.id, codigo: u.codigo }); 
                              setConfirmVisible(true); 
                            }}
                            className="px-2 py-1 bg-red-600 rounded text-white text-xs"
                            disabled={deletingIds.has(u.id ?? u.codigo)}
                          >
                            {deletingIds.has(u.id ?? u.codigo) ? 'Eliminando…' : 'Eliminar'}
                          </button>
                        </td>
                      </tr>
                    )})
                  ) : (
                    [...sesiones].sort((a, b) => (a.id ?? 0) - (b.id ?? 0)).map((s, index) => {
                      const k = s.id ?? '';
                      const selected = selectedKeys.has(k);
                      return (
                      <tr key={`${s.id ?? s.codigo}-${s.horainicio ?? ''}`} className={`border-t border-[#4DA6FF]/20 ${selected ? 'bg-red-900/30' : ''}`} onClick={() => {
                        if (!selectMode || !s.id) return;
                        setSelectedKeys(prev => {
                          const n = new Set(prev);
                          if (n.has(k)) n.delete(k); else n.add(k);
                          return n;
                        });
                      }}>
                        {selectMode && (
                          <td className="py-2 pr-2">
                            <input type="checkbox" className="h-4 w-4 accent-red-600" checked={selected} onChange={() => { /* manejado con onClick fila */ }} />
                          </td>
                        )}
                        <td className="py-2 pr-4">{index + 1}</td>
                        <td className="py-2 pr-4">{s.codigo}</td>
                        <td className="py-2 pr-4">{s.actividad ?? '-'}</td>
                        <td className="py-2 pr-4">{s.tiempoestimado ?? '-'}</td>
                        <td className="py-2 pr-4">{s.numeroequipo ?? '-'}</td>
                        <td className="py-2 pr-4">{formatearFecha(s.fecha)}</td>
                        <td className="py-2 pr-4">{s.horainicio ?? '-'}</td>
                        <td className="py-2 pr-4">{typeof s.sincronizado === 'boolean' ? (s.sincronizado ? 'Sí' : 'No') : '-'}</td>
                        <td className="py-2 pr-4">
                          <button
                            onClick={(e) => { 
                              e.stopPropagation(); // Evitar que el clic se propague a la fila
                              if (!s.id) return; 
                              setConfirmType('sesion'); 
                              setConfirmPayload({ id: s.id }); 
                              setConfirmVisible(true); 
                            }}
                            className="px-2 py-1 bg-red-600 rounded text-white text-xs"
                            disabled={deletingIds.has(s.id ?? '')}
                          >
                            {deletingIds.has(s.id ?? '') ? 'Eliminando…' : 'Eliminar'}
                          </button>
                        </td>
                      </tr>
                    )})
                  )}
                </tbody>
              </table>
            )}
          </div>

          <div className="p-4 border-t border-[#4DA6FF]/40 flex items-center justify-between">
            <div className="text-sm text-[#B0C4DE]">Total: {total}</div>
            <div className="flex items-center gap-2">
              <button disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="px-3 py-2 bg-[#003a7a] rounded disabled:opacity-50">Anterior</button>
              <span className="text-sm">{page} / {totalPages}</span>
              <button disabled={page>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))} className="px-3 py-2 bg-[#003a7a] rounded disabled:opacity-50">Siguiente</button>
              <select value={pageSize} onChange={(e)=>{ setPageSize(parseInt(e.target.value,10)); setPage(1); }} className="px-2 py-2 bg-[#003a7a] rounded">
                {[10,20,50,100].map(n=> (<option key={n} value={n}>{n}/página</option>))}
              </select>
            </div>
          </div>
        </div>
      </div>
      {/* Modal confirmación eliminar */}
      {confirmVisible && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="absolute inset-0 bg-black/70" onClick={() => setConfirmVisible(false)}></div>
          <div className="relative z-10 bg-white rounded-lg shadow-xl overflow-hidden w-full max-w-sm mx-4">
            <div className="bg-gradient-to-r from-[#FF4D4D] to-[#B30000] p-4 text-center">
              <h3 className="text-white text-lg font-bold">Confirmar eliminación</h3>
            </div>
            <div className="p-6 text-center text-black">
              <p className="mb-6">¿Desea eliminar este {confirmType === 'usuario' ? 'usuario' : 'registro de sesión'}?</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmVisible(false)} className="flex-1 py-3 rounded-lg bg-gray-300 text-black font-medium">Cancelar</button>
                <button
                  onClick={async () => {
                    setConfirmVisible(false);
                    const key = confirmPayload?.id ?? confirmPayload?.codigo;
                    setDeletingIds(prev => new Set(prev).add(key));
                    try {
                      // Eliminar en el backend primero
                      if (confirmType === 'usuario') {
                        const res = await (window as any).electronAPI?.adminEliminarUsuario?.(confirmPayload);
                        if (res?.success) {
                          // Solo actualizar la UI si la operación fue exitosa
                          setUsuarios(prev => prev.filter(x => (confirmPayload.id ? x.id !== confirmPayload.id : x.codigo !== confirmPayload.codigo)));
                          setTotal(t => Math.max(0, t-1));
                        } else {
                          console.error('Error al eliminar usuario:', res?.message);
                        }
                      } else {
                        const res = await (window as any).electronAPI?.adminEliminarSesion?.(confirmPayload);
                        if (res?.success) {
                          // Solo actualizar la UI si la operación fue exitosa
                          setSesiones(prev => prev.filter(x => x.id !== confirmPayload.id));
                          setTotal(t => Math.max(0, t-1));
                        } else {
                          console.error('Error al eliminar sesión:', res?.message);
                        }
                      }
                    } catch (error) {
                      console.error('Error en la operación de eliminación:', error);
                    } finally {
                      // Siempre recargar los datos para asegurar consistencia
                      cargarDatos();
                      setDeletingIds(prev => { const n = new Set(prev); n.delete(key); return n; });
                    }
                  }}
                  className="flex-1 py-3 rounded-lg bg-gradient-to-r from-[#4DA6FF] to-[#0056b3] text-white font-medium hover:from-[#3d8bde] hover:to-[#00489a] transition-all duration-300"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPanel;




