import { useRef, useState } from 'react';
import { hasHtml, sanitizeHtml } from '../lib/sanitize';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';

type DescMode = 'text' | 'html';

/** Ferramenta de formatação: envolve a seleção com a tag (ou insere no cursor). */
interface Tool {
  key: string;
  label: string;
  open: string;
  close: string;
}

const HTML_TOOLS: Tool[] = [
  { key: 'bold', label: 'Negrito', open: '<strong>', close: '</strong>' },
  { key: 'italic', label: 'Itálico', open: '<em>', close: '</em>' },
  { key: 'underline', label: 'Sublinhado', open: '<u>', close: '</u>' },
  { key: 'h2', label: 'Título', open: '<h2>', close: '</h2>' },
  { key: 'p', label: 'Parágrafo', open: '<p>', close: '</p>' },
  { key: 'ul', label: 'Lista', open: '<ul><li>', close: '</li></ul>' },
  { key: 'link', label: 'Link', open: '<a href="https://">', close: '</a>' },
  { key: 'img', label: 'Imagem', open: '<img src="https://" alt="Descrição da imagem" />', close: '' },
  { key: 'br', label: 'Quebra de linha', open: '<br />', close: '' },
  { key: 'hr', label: 'Linha divisória', open: '\n<hr />\n', close: '' },
];

/** Rótulo curto exibido no botão (abbr) — legível e compacto. */
const TOOL_LABEL: Record<string, string> = {
  bold: 'B',
  italic: 'I',
  underline: 'S',
  h2: 'H2',
  p: 'P',
  ul: '☰ Lista',
  link: '🔗 Link',
  img: '🖼 Img',
  br: '⏎ BR',
  hr: '──',
};

/**
 * Campo de descrição com alternador Texto/HTML, barra de tags HTML e prévia sanitizada.
 * - Botões envolvem a SELEÇÃO com a tag (ou inserem no cursor se nada marcado).
 * - No modo HTML, a prévia renderiza com sanitização automática (DOMPurify).
 * - Detecta HTML existente ao editar um produto e abre no modo certo.
 */
export function DescriptionField({
  id,
  value,
  onChange,
  rows = 3,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  const [mode, setMode] = useState<DescMode>(hasHtml(value) ? 'html' : 'text');
  const [preview, setPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /** Insere a tag (abre+fecha) na posição do cursor, envolvendo a seleção. */
  const insertTag = (tool: Tool) => {
    const el = textareaRef.current;
    let start = value.length;
    let end = value.length;
    let selected = '';
    let next = value + tool.open + tool.close;

    if (el) {
      start = el.selectionStart ?? value.length;
      end = el.selectionEnd ?? value.length;
      selected = value.slice(start, end);
      next = value.slice(0, start) + tool.open + selected + tool.close + value.slice(end);
    }

    onChange(next);

    // Restaura foco + seleção (mantém o trecho envolto selecionado).
    requestAnimationFrame(() => {
      const t = textareaRef.current;
      if (!t) return;
      t.focus();
      const innerStart = start + tool.open.length;
      const innerEnd = innerStart + selected.length;
      t.setSelectionRange(innerStart, tool.close ? innerEnd : innerStart);
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>Descrição</Label>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant={mode === 'text' ? 'default' : 'outline'}
            onClick={() => { setMode('text'); setPreview(false); }}
          >
            Texto
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === 'html' ? 'default' : 'outline'}
            onClick={() => { setMode('html'); setPreview(false); }}
          >
            HTML
          </Button>
        </div>
      </div>

      {mode === 'html' ? (
        <>
          {/* ✅ Barra de tags HTML — clique para inserir (frontend-only) */}
          <div className="flex flex-wrap items-center gap-1 rounded-md border bg-muted/20 p-1">
            {HTML_TOOLS.map((tool) => (
              <Button
                key={tool.key}
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs font-medium"
                title={tool.label}
                aria-label={tool.label}
                onClick={() => insertTag(tool)}
              >
                {TOOL_LABEL[tool.key] ?? tool.label}
              </Button>
            ))}
            <span className="ml-auto hidden text-[10px] text-muted-foreground sm:block">
              Selecione um trecho e clique para envolver com a tag.
            </span>
          </div>

          <Textarea
            id={id}
            ref={textareaRef}
            rows={rows}
            className="font-mono text-xs"
            placeholder={'<p>Insira a descrição em HTML…</p>'}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <button
              type="button"
              className="underline"
              onClick={() => setPreview((p) => !p)}
            >
              {preview ? 'Ocultar prévia' : 'Pré-visualizar'}
            </button>
            <span>Renderizada com sanitização automática (scripts removidos).</span>
          </div>

          {preview && (
            <div
              className="rounded-md border bg-muted/20 p-3 text-sm [&_a]:text-primary [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm [&_strong]:font-semibold [&_img]:max-w-full [&_img]:rounded-md"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(value) }}
            />
          )}
        </>
      ) : (
        <Textarea
          id={id}
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Descrição em texto…"
        />
      )}
    </div>
  );
}