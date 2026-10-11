import { Fragment, type ReactNode } from "react";
import { Alert } from "@/components/ui/primitives";
import type { SiteSettings } from "@/server/settings";

const PLACEHOLDER_LABELS: Record<string, string> = {
  companyName: "[Şirket unvanı girilmedi]",
  companyAddress: "[Şirket adresi girilmedi]",
  companyTaxInfo: "[Vergi dairesi / MERSİS girilmedi]",
  contactEmail: "[E-posta girilmedi]",
  contactPhone: "[Telefon girilmedi]",
};

/** Sayfa metnindeki {anahtar} ifadelerini site ayarlarıyla doldurur. */
export function fillPlaceholders(content: string, settings: SiteSettings): string {
  return content.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = (settings as Record<string, unknown>)[key];
    if (value === undefined) return match;
    const text = String(value).trim();
    return text || PLACEHOLDER_LABELS[key] || "";
  });
}

/**
 * Basit ve güvenli metin biçimi: "## Başlık", "- madde", "> uyarı", boş satırla paragraf.
 * HTML yorumlanmaz; içerik her zaman düz metin olarak basılır.
 */
export function RichText({ content }: { content: string }) {
  const blocks: ReactNode[] = [];
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      const lines = paragraph;
      blocks.push(
        <p key={`p${blocks.length}`}>
          {lines.map((line, i) => (
            <Fragment key={i}>
              {i > 0 ? <br /> : null}
              {line}
            </Fragment>
          ))}
        </p>,
      );
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list.length) {
      blocks.push(
        <ul key={`u${blocks.length}`}>
          {list.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>,
      );
      list = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.startsWith("## ")) {
      flushParagraph();
      flushList();
      blocks.push(<h2 key={`h${blocks.length}`}>{line.slice(3)}</h2>);
    } else if (line.startsWith("> ")) {
      flushParagraph();
      flushList();
      blocks.push(
        <Alert key={`a${blocks.length}`} tone="warning" className="my-4">
          {line.slice(2)}
        </Alert>,
      );
    } else if (line.startsWith("- ")) {
      flushParagraph();
      list.push(line.slice(2));
    } else if (!line.trim()) {
      flushParagraph();
      flushList();
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushList();
  return <div className="prose-content">{blocks}</div>;
}
