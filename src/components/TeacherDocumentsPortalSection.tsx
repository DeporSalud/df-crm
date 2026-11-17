"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  FileText,
  Download,
  Eye,
  FolderOpen,
  RefreshCw,
  Calendar,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import {
  TeacherDocumentMeta,
  fetchTeacherDocuments,
  openOrDownloadTeacherDocument,
  formatPeriodoMesSpanish,
  formatFileSize,
  getCategoryLabel,
} from "@/lib/teacherDocumentsService";

interface TeacherDocumentsPortalSectionProps {
  teacherUuid?: string | null;
  teacherPin?: string | null;
  teacherName: string;
}

export default function TeacherDocumentsPortalSection({
  teacherUuid,
  teacherPin,
  teacherName,
}: TeacherDocumentsPortalSectionProps) {
  const [docs, setDocs] = useState<TeacherDocumentMeta[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [filterCat, setFilterCat] = useState<"todos" | "nomina" | "otros">("todos");
  const [busyDocId, setBusyDocId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const loadDocs = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg("");
    try {
      const list = await fetchTeacherDocuments({
        uuid: teacherUuid,
        pin: teacherPin,
        name: teacherName,
      });
      setDocs(list);
    } catch {
      setErrorMsg("No se pudieron cargar tus documentos en este momento.");
    } finally {
      setIsLoading(false);
    }
  }, [teacherUuid, teacherPin, teacherName]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  const nominasCount = useMemo(
    () => docs.filter((d) => d.categoria === "nomina").length,
    [docs]
  );
  const otrosCount = useMemo(
    () => docs.filter((d) => d.categoria !== "nomina").length,
    [docs]
  );

  const visibleDocs = useMemo(() => {
    if (filterCat === "nomina") return docs.filter((d) => d.categoria === "nomina");
    if (filterCat === "otros") return docs.filter((d) => d.categoria !== "nomina");
    return docs;
  }, [docs, filterCat]);

  const handleAction = async (docId: string, mode: "view" | "download") => {
    if (busyDocId) return;
    setBusyDocId(`${docId}_${mode}`);
    setErrorMsg("");
    const res = await openOrDownloadTeacherDocument(docId, mode);
    setBusyDocId(null);
    if (!res.success && res.error) {
      setErrorMsg(res.error);
    }
  };

  const getBadgeStyle = (cat: string) => {
    switch (cat) {
      case "nomina":
        return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
      case "contrato":
        return "bg-blue-500/15 text-blue-300 border-blue-500/30";
      case "dni_identidad":
        return "bg-cyan-500/15 text-cyan-300 border-cyan-500/30";
      case "seguro_certificado":
        return "bg-amber-500/15 text-amber-300 border-amber-500/30";
      default:
        return "bg-slate-500/15 text-slate-300 border-slate-500/30";
    }
  };

  return (
    <section
      aria-labelledby="teacher-docs-heading"
      className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-5 sm:p-6 shadow-xl space-y-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <FolderOpen size={20} aria-hidden="true" />
          </div>
          <div>
            <h2
              id="teacher-docs-heading"
              className="text-base sm:text-lg font-bold text-white font-[family-name:var(--font-heading)] tracking-wide"
            >
              Mis Nóminas y Documentos
            </h2>
            <p className="text-xs text-slate-400">
              Consulta y descarga tus recibos salariales y documentación oficial
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadDocs}
          aria-label="Actualizar mis documentos"
          className="p-2 rounded-xl bg-[var(--color-bg)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border)] text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
        >
          <RefreshCw size={15} className={isLoading ? "animate-spin" : ""} aria-hidden="true" />
        </button>
      </div>

      {/* Filter Pills */}
      <div className="flex flex-wrap items-center gap-1.5 bg-[var(--color-bg)] border border-[var(--color-border)] p-1 rounded-xl">
        <button
          type="button"
          onClick={() => setFilterCat("todos")}
          className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
            filterCat === "todos"
              ? "bg-[var(--color-primary)] text-white"
              : "text-slate-400 hover:text-white"
          }`}
        >
          Todos ({docs.length})
        </button>
        <button
          type="button"
          onClick={() => setFilterCat("nomina")}
          className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
            filterCat === "nomina"
              ? "bg-emerald-600 text-white"
              : "text-slate-400 hover:text-white"
          }`}
        >
          Nóminas ({nominasCount})
        </button>
        <button
          type="button"
          onClick={() => setFilterCat("otros")}
          className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
            filterCat === "otros"
              ? "bg-slate-700 text-white"
              : "text-slate-400 hover:text-white"
          }`}
        >
          Otros ({otrosCount})
        </button>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-200"
        >
          {errorMsg}
        </div>
      )}

      {isLoading ? (
        <div className="py-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
          <Loader2 size={20} className="animate-spin text-[var(--color-secondary)]" aria-hidden="true" />
          <span>Cargando tu carpeta documental...</span>
        </div>
      ) : visibleDocs.length === 0 ? (
        <div className="py-8 px-4 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] text-center space-y-1.5">
          <FileText size={24} className="mx-auto text-slate-500" aria-hidden="true" />
          <p className="text-xs font-semibold text-slate-300">
            Aún no hay documentos publicados en este apartado
          </p>
          <p className="text-[11px] text-slate-400">
            Cuando Dirección suba tu nómina mensual o documentación aparecerá aquí lista para descargar.
          </p>
        </div>
      ) : (
        <ul role="list" className="space-y-2.5">
          {visibleDocs.map((doc) => {
            const periodoLabel = formatPeriodoMesSpanish(doc.periodo_mes);
            const fechaSubida = doc.creado_en
              ? new Date(doc.creado_en).toLocaleDateString("es-ES", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })
              : "";
            const isViewing = busyDocId === `${doc.id}_view`;
            const isDownloading = busyDocId === `${doc.id}_download`;

            return (
              <li
                key={doc.id}
                className="p-3.5 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getBadgeStyle(
                        doc.categoria
                      )}`}
                    >
                      {getCategoryLabel(doc.categoria)}
                    </span>
                    {periodoLabel && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-300 bg-white/5 px-2 py-0.5 rounded-md border border-white/10">
                        <Calendar size={11} className="text-[var(--color-secondary)]" aria-hidden="true" />
                        {periodoLabel}
                      </span>
                    )}
                  </div>

                  <p className="text-sm font-bold text-white break-words">{doc.titulo}</p>

                  <p className="text-[11px] text-slate-400 break-words">
                    {doc.nombre_archivo} · {formatFileSize(doc.tamano_bytes)}
                    {fechaSubida ? ` · Subido el ${fechaSubida}` : ""}
                  </p>
                  {doc.notas && (
                    <p className="text-[11px] text-slate-300 italic break-words">{doc.notas}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={Boolean(busyDocId)}
                    onClick={() => handleAction(doc.id, "view")}
                    aria-label={`Ver ${doc.titulo}`}
                    className="flex-1 sm:flex-initial px-3 py-2 rounded-xl bg-[var(--color-bg-card)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border)] text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isViewing ? (
                      <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <Eye size={14} className="text-[var(--color-secondary)]" aria-hidden="true" />
                    )}
                    <span>Ver</span>
                  </button>

                  <button
                    type="button"
                    disabled={Boolean(busyDocId)}
                    onClick={() => handleAction(doc.id, "download")}
                    aria-label={`Descargar ${doc.titulo}`}
                    className="flex-1 sm:flex-initial px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-emerald-600/20 disabled:opacity-50"
                  >
                    {isDownloading ? (
                      <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <Download size={14} aria-hidden="true" />
                    )}
                    <span>Descargar</span>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="pt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
        <ShieldCheck size={14} className="text-emerald-400 shrink-0" aria-hidden="true" />
        <span>Carpeta privada vinculada exclusivamente a tu perfil docente.</span>
      </div>
    </section>
  );
}
