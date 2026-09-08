/**
 * Renderização inteligente de anexo de chat.
 *
 * ✅ Imagem  → exibe inline (clique abre em nova aba).
 * ✅ Vídeo   → player inline.
 * ✅ Demais  → link de download direto para o arquivo (não para o endpoint).
 *
 * SEGURANÇA:
 * - A URL é resolvida via GET /files/{id}/download (o backend autoriza por
 *   tenant/propriedade antes de devolver a URL pública).
 * - Nunca renderiza conteúdo confiável — só <img>/<video>/<a> com a URL
 *   devolvida pelo backend.
 */
import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { resolveAttachmentUrl } from '../../lib/ticketsApi';

type Kind = 'image' | 'video' | 'file';

/** Infere o tipo pelo final da URL pública (padrão R2: .../chat/<uuid>.<ext>). */
function kindFromUrl(url: string): Kind {
  const clean = url.split('?')[0].toLowerCase();
  if (/\.(jpe?g|png|gif|webp|bmp|svg|avif)$/.test(clean)) return 'image';
  if (/\.(mp4|webm|mov|m4v|ogv)$/.test(clean)) return 'video';
  return 'file';
}

export function ChatAttachment({ fileId }: { fileId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    resolveAttachmentUrl(fileId)
      .then((u) => { if (active) setUrl(u); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [fileId]);

  if (error) {
    return <p className="mt-1 text-xs text-muted-foreground">Não foi possível carregar o anexo.</p>;
  }
  if (!url) {
    return <p className="mt-1 text-xs text-muted-foreground">Carregando anexo…</p>;
  }

  const kind = kindFromUrl(url);

  // ✅ Imagem: exibe inline (clique abre em nova aba)
  if (kind === 'image') {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="mt-1 block">
        <img
          src={url}
          alt="Anexo"
          className="max-h-64 rounded-md border object-contain"
          referrerPolicy="no-referrer"
        />
      </a>
    );
  }

  // ✅ Vídeo: player inline
  if (kind === 'video') {
    return (
      <video src={url} controls className="mt-1 max-h-64 w-full rounded-md border" />
    );
  }

  // ✅ Demais arquivos: download direto do arquivo (não do endpoint JSON)
  const filename = url.split('/').pop()?.split('?')[0] || 'anexo';
  return (
    <a
      href={url}
      download={filename}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
    >
      <Download className="h-3 w-3" /> Baixar anexo
    </a>
  );
}