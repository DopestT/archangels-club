import { deflateRawSync } from 'zlib';

// ── CRC-32 ──────────────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

// ── Minimal ZIP builder ──────────────────────────────────────────────────────

interface ZipEntry {
  name: string;
  data: Buffer;
  compressed: Buffer;
  crc: number;
  offset: number;
  method: number; // 0=store, 8=deflate
}

function dosDateTime(): { time: number; date: number } {
  const now = new Date();
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  return { time, date };
}

function writeUint16LE(v: number): Buffer {
  const b = Buffer.alloc(2); b.writeUInt16LE(v, 0); return b;
}
function writeUint32LE(v: number): Buffer {
  const b = Buffer.alloc(4); b.writeUInt32LE(v, 0); return b;
}

export function buildZip(files: { name: string; data: Buffer; store?: boolean }[]): Buffer {
  const { time, date } = dosDateTime();
  const entries: ZipEntry[] = [];
  let offset = 0;
  const parts: Buffer[] = [];

  for (const f of files) {
    const nameBytes = Buffer.from(f.name, 'utf8');
    const method = f.store ? 0 : 8;
    const compressed = f.store ? f.data : deflateRawSync(f.data, { level: 6 });
    const crc = crc32(f.data);
    const entry: ZipEntry = { name: f.name, data: f.data, compressed, crc, offset, method };
    entries.push(entry);

    // Local file header
    const local = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]), // signature
      writeUint16LE(20),                       // version needed
      writeUint16LE(0),                        // flags
      writeUint16LE(method),
      writeUint16LE(time),
      writeUint16LE(date),
      writeUint32LE(crc),
      writeUint32LE(compressed.length),
      writeUint32LE(f.data.length),
      writeUint16LE(nameBytes.length),
      writeUint16LE(0),                        // extra field length
      nameBytes,
      compressed,
    ]);
    parts.push(local);
    offset += local.length;
  }

  // Central directory
  const cdParts: Buffer[] = [];
  const cdStart = offset;
  for (const e of entries) {
    const nameBytes = Buffer.from(e.name, 'utf8');
    const cd = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x01, 0x02]), // signature
      writeUint16LE(0x031e),                   // version made by (Unix)
      writeUint16LE(20),                       // version needed
      writeUint16LE(0),                        // flags
      writeUint16LE(e.method),
      writeUint16LE(time),
      writeUint16LE(date),
      writeUint32LE(e.crc),
      writeUint32LE(e.compressed.length),
      writeUint32LE(e.data.length),
      writeUint16LE(nameBytes.length),
      writeUint16LE(0),                        // extra
      writeUint16LE(0),                        // comment
      writeUint16LE(0),                        // disk start
      writeUint16LE(0),                        // internal attrs
      writeUint32LE(0),                        // external attrs
      writeUint32LE(e.offset),
      nameBytes,
    ]);
    cdParts.push(cd);
  }
  const cdBuf = Buffer.concat(cdParts);

  // End of central directory
  const eocd = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x05, 0x06]),
    writeUint16LE(0),
    writeUint16LE(0),
    writeUint16LE(entries.length),
    writeUint16LE(entries.length),
    writeUint32LE(cdBuf.length),
    writeUint32LE(cdStart),
    writeUint16LE(0),
  ]);

  return Buffer.concat([...parts, cdBuf, eocd]);
}

// ── EPUB 3.0 builder ─────────────────────────────────────────────────────────

export interface EpubChapter {
  number: number;
  title: string;
  content: string; // plain text, will be wrapped in XHTML
}

export interface EpubMeta {
  id: string;
  title: string;
  subtitle: string;
  author: string;
  description: string;
  genre: string;
  keywords: string[];
  language?: string;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function plainTextToXhtml(title: string, text: string): string {
  const paragraphs = text
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => `<p>${escapeXml(p.replace(/\n/g, ' '))}</p>`)
    .join('\n    ');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>${escapeXml(title)}</title>
  <link rel="stylesheet" type="text/css" href="../styles.css"/>
</head>
<body>
  <section epub:type="chapter">
    <h2>${escapeXml(title)}</h2>
    ${paragraphs}
  </section>
</body>
</html>`;
}

export function buildEpub(meta: EpubMeta, chapters: EpubChapter[]): Buffer {
  const uid = `urn:uuid:${meta.id}`;
  const lang = meta.language ?? 'en';
  const now = new Date().toISOString().split('T')[0];

  const chapterFiles = chapters.map(c => ({
    id: `chapter_${String(c.number).padStart(3, '0')}`,
    href: `chapters/chapter_${String(c.number).padStart(3, '0')}.xhtml`,
    title: c.title,
    xhtml: plainTextToXhtml(c.title, c.content),
  }));

  const manifest = chapterFiles
    .map(c => `    <item id="${c.id}" href="${c.href}" media-type="application/xhtml+xml"/>`)
    .join('\n');
  const spine = chapterFiles
    .map(c => `    <itemref idref="${c.id}"/>`)
    .join('\n');
  const navItems = chapterFiles
    .map(c => `      <li><a href="${c.href}">${escapeXml(c.title)}</a></li>`)
    .join('\n');

  const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid" xml:lang="${lang}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:identifier id="uid">${uid}</dc:identifier>
    <dc:title>${escapeXml(meta.title)}${meta.subtitle ? ': ' + escapeXml(meta.subtitle) : ''}</dc:title>
    <dc:creator>${escapeXml(meta.author)}</dc:creator>
    <dc:language>${lang}</dc:language>
    <dc:subject>${escapeXml(meta.genre)}</dc:subject>
    <dc:description>${escapeXml(meta.description)}</dc:description>
    <meta property="dcterms:modified">${now}T00:00:00Z</meta>
    <meta name="generator" content="Legacy Works Publishing Automation"/>
    <meta name="ai-generated" content="true"/>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="css" href="styles.css" media-type="text/css"/>
${manifest}
  </manifest>
  <spine>
${spine}
  </spine>
</package>`;

  const navXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${lang}">
<head><meta charset="UTF-8"/><title>Table of Contents</title></head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Table of Contents</h1>
    <ol>
${navItems}
    </ol>
  </nav>
</body>
</html>`;

  const css = `body { font-family: Georgia, serif; margin: 5% 8%; line-height: 1.7; color: #1a1a1a; }
h1, h2 { font-family: 'Palatino Linotype', Palatino, serif; color: #111; }
h2 { margin-top: 2em; font-size: 1.4em; }
p { margin: 0.8em 0; text-indent: 1.5em; }
p:first-of-type { text-indent: 0; }`;

  const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

  const zipFiles: { name: string; data: Buffer; store?: boolean }[] = [
    { name: 'mimetype', data: Buffer.from('application/epub+zip', 'utf8'), store: true },
    { name: 'META-INF/container.xml', data: Buffer.from(containerXml, 'utf8') },
    { name: 'OEBPS/content.opf', data: Buffer.from(opf, 'utf8') },
    { name: 'OEBPS/nav.xhtml', data: Buffer.from(navXhtml, 'utf8') },
    { name: 'OEBPS/styles.css', data: Buffer.from(css, 'utf8') },
    ...chapterFiles.map(c => ({
      name: `OEBPS/${c.href}`,
      data: Buffer.from(c.xhtml, 'utf8'),
    })),
  ];

  return buildZip(zipFiles);
}
