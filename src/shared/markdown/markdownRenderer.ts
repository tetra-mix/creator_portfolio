export type LinkRect = { x: number; y: number; w: number; h: number; url: string }
export type MarkdownRenderOptions = {
  images?: Map<string, ImageBitmap>
  linkRects?: LinkRect[]
}

export function renderMarkdownToCanvas(
  ctx: CanvasRenderingContext2D,
  markdown: string,
  width: number,
  height: number,
  opts: MarkdownRenderOptions = {}
) {
  // Clear background
  ctx.fillStyle = '#FFF';
  ctx.fillRect(0, 0, width, height);
  
  // Settings
  const margin = 20;
  const contentWidth = width - margin * 2;
  let cursorY = margin + 10;
  
  const lines = markdown.split('\n');
  
  for (let li = 0; li < lines.length; li++) {
    let line = lines[li].trim();
    if (!line) {
      cursorY += 10; // Paragraph spacing
      continue;
    }
    
    // Horizontal Rule
    if (line === '---') {
      ctx.beginPath();
      ctx.moveTo(margin, cursorY + 5);
      ctx.lineTo(width - margin, cursorY + 5);
      ctx.strokeStyle = '#ccc';
      ctx.lineWidth = 1;
      ctx.stroke();
      cursorY += 15;
      continue;
    }
    
    // Headers
    if (line.startsWith('# ')) {
      const baseFont = 'bold 24px Arial'
      ctx.font = baseFont
      ctx.fillStyle = '#000'
      const text = line.substring(2)
      cursorY += 24
      cursorY = drawInlineParagraph(ctx, text, margin, cursorY, contentWidth, 30, baseFont, opts.linkRects)
    } else if (line.startsWith('## ')) {
      const baseFont = 'bold 18px Arial'
      ctx.font = baseFont
      ctx.fillStyle = '#333'
      const text = line.substring(3)
      cursorY += 18
      cursorY = drawInlineParagraph(ctx, text, margin, cursorY, contentWidth, 24, baseFont, opts.linkRects)
      cursorY += 3; // Reduced spacing
    } 
    // Bullet Lists
    else if (line.startsWith('- ')) {
      const baseFont = '10px Arial'
      ctx.font = baseFont
      ctx.fillStyle = '#000'
      const text = line.substring(2);
      
      // Draw bullet
      ctx.beginPath();
      ctx.arc(margin + 5, cursorY - 4, 2, 0, Math.PI * 2);
      ctx.fill();
      
      cursorY = drawInlineParagraph(ctx, text, margin + 15, cursorY, contentWidth - 15, 20, baseFont, opts.linkRects)
    }
    // Image (block): ![alt](url)
    else if (line.startsWith('![')) {
      const match = line.match(/^!\[[^\]]*\]\(([^\)]+)\)/)
      const url = match?.[1]?.trim()
      const marginH = 15
      const ph = Math.max(80, Math.floor(contentWidth * 0.6))
      if (url && opts.images && opts.images.has(url)) {
        const bmp = opts.images.get(url)!
        const targetW = contentWidth
        const aspect = bmp.height / bmp.width
        const targetH = Math.floor(targetW * aspect)
        ctx.imageSmoothingEnabled = true
        ctx.drawImage(bmp, margin, cursorY, targetW, targetH)
        cursorY += targetH + marginH
      } else {
        // Placeholder box until image is loaded
        ctx.strokeStyle = '#bbb'
        ctx.fillStyle = '#f7f7f7'
        ctx.lineWidth = 1
        ctx.fillRect(margin, cursorY, contentWidth, ph)
        ctx.strokeRect(margin, cursorY, contentWidth, ph)
        // Draw a tiny photo icon
        ctx.fillStyle = '#ccc'
        ctx.fillRect(margin + 8, cursorY + 8, 28, 20)
        ctx.beginPath()
        ctx.moveTo(margin + 10, cursorY + 26)
        ctx.lineTo(margin + 18, cursorY + 18)
        ctx.lineTo(margin + 22, cursorY + 22)
        ctx.lineTo(margin + 26, cursorY + 16)
        ctx.lineTo(margin + 34, cursorY + 26)
        ctx.closePath()
        ctx.fill()
        cursorY += ph + marginH
      }
    }
    // Table (borderless): pipe-separated rows
    else if (line.startsWith('|')) {
      // Collect contiguous table lines
      const rowStrs: string[] = []
      while (li < lines.length) {
        const raw = lines[li]
        if (raw.trim().startsWith('|')) { rowStrs.push(raw.trim()); li++; continue }
        break
      }
      li-- // compensate for loop increment

      // Parse rows and optional separator
      const rows: string[][] = rowStrs.map(r => r.split('|').slice(1, -1).map(c => c.trim()))
      let isHeader = false
      if (rows.length >= 2) {
        const sep = rows[1].every(c => /^:?-{3,}:?$/.test(c))
        if (sep) { rows.splice(1, 1); isHeader = true }
      }
      const cols = rows.reduce((m, r) => Math.max(m, r.length), 0)
      const colGap = 12
      const totalGap = Math.max(0, (cols - 1) * colGap)

      // Auto column widths based on content (measure text), scaled down to fit if necessary.
      const minColW = 40
      const natural: number[] = Array.from({ length: cols }, () => minColW)
      // Measure pass
      {
        let headerPending = isHeader
        for (const r of rows) {
          const baseFont = headerPending ? 'bold 14px Arial' : '14px Arial'
          for (let ci = 0; ci < cols; ci++) {
            const cell = (r[ci] ?? '')
            const w = measureInlineWidth(ctx, cell, baseFont)
            if (w + 2 > natural[ci]) natural[ci] = w + 2 // small padding
          }
          if (headerPending) headerPending = false
        }
      }
      let sumNatural = natural.reduce((a, b) => a + b, 0)
      const available = Math.max(20, contentWidth - totalGap)
      let colWidths = natural.slice()
      if (sumNatural > available) {
        const k = available / sumNatural
        colWidths = natural.map(w => Math.max(minColW, Math.floor(w * k)))
        // If rounding caused overflow, adjust the last column
        const diff = (colWidths.reduce((a, b) => a + b, 0)) - available
        if (diff > 0) colWidths[colWidths.length - 1] = Math.max(minColW, colWidths[colWidths.length - 1] - diff)
      }

      for (const r of rows) {
        const rowTop = cursorY
        const baseFont = isHeader ? 'bold 14px Arial' : '14px Arial'
        let endY = rowTop
        for (let ci = 0; ci < cols; ci++) {
          const cell = (r[ci] ?? '')
          // x0 accumulates previous widths + gaps
          let x0 = margin
          for (let k = 0; k < ci; k++) x0 += colWidths[k] + colGap
          const y0 = rowTop
          const y1 = drawInlineParagraph(ctx, cell, x0, y0, colWidths[ci], 20, baseFont, opts.linkRects)
          if (y1 > endY) endY = y1
        }
        cursorY = endY + 6 // small row spacing
        // Header only for first data row
        if (isHeader) isHeader = false
      }
    }
    // Normal Text
    else {
      const baseFont = '12px Arial'
      ctx.font = baseFont
      ctx.fillStyle = '#000'
      cursorY = drawInlineParagraph(ctx, line, margin, cursorY, contentWidth, 20, baseFont, opts.linkRects)
    }
  }
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const words = text.split(' ');
  let line = '';
  let currentY = y;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;
    
    if (testWidth > maxWidth && n > 0) {
      ctx.fillText(line, x, currentY);
      line = words[n] + ' ';
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, currentY);
  // Return the Y position after this block (not used in loop but useful if needed)
  return currentY + lineHeight;
}

type InlineToken = { text: string; bold?: boolean; strike?: boolean; underline?: boolean; linkUrl?: string }

function parseInline(line: string): InlineToken[] {
  const tokens: InlineToken[] = []
  let i = 0
  let buf = ''
  let bold = false
  let strike = false
  let underline = false

  const flush = () => {
    if (buf) {
      tokens.push({ text: buf, bold, strike, underline })
      buf = ''
    }
  }

  while (i < line.length) {
    const two = line.slice(i, i + 2)
    if (two === '**' || two === '__') { flush(); bold = !bold; i += 2; continue }
    if (two === '~~') { flush(); strike = !strike; i += 2; continue }
    if (two === '++') { flush(); underline = !underline; i += 2; continue }
    if (line[i] === '[') {
      // parse [text](url)
      const close = line.indexOf(']', i + 1)
      const openParen = close >= 0 ? line.indexOf('(', close + 1) : -1
      const closeParen = openParen >= 0 ? line.indexOf(')', openParen + 1) : -1
      if (close >= 0 && openParen === close + 1 && closeParen > openParen + 1) {
        const label = line.slice(i + 1, close)
        const url = line.slice(openParen + 1, closeParen).trim().replace(/^</, '').replace(/>$/, '')
        flush()
        tokens.push({ text: label, bold, strike, underline, linkUrl: url })
        i = closeParen + 1
        continue
      }
    }
    buf += line[i]
    i++
  }
  flush()
  return tokens
}

function withWeight(baseFont: string, makeBold: boolean): string {
  if (!makeBold) return baseFont
  return baseFont.startsWith('bold ') ? baseFont : `bold ${baseFont}`
}

function measureInlineWidth(ctx: CanvasRenderingContext2D, text: string, baseFont: string): number {
  const tokens = parseInline(text)
  let sum = 0
  for (const token of tokens) {
    const parts = token.text.split(/(\s+)/)
    for (const part of parts) {
      if (part === '') continue
      ctx.font = withWeight(baseFont, !!token.bold)
      sum += ctx.measureText(part).width
    }
  }
  return Math.ceil(sum)
}

function drawInlineParagraph(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  baseFont: string,
  linkRects?: LinkRect[],
) {
  const tokens = parseInline(text)
  let currentY = y
  let lineSegments: Array<InlineToken & { text: string }> = []
  const normalColor = ctx.fillStyle as string
  const linkColor = '#1a0dab'

  const lineWidth = (segments: typeof lineSegments) => {
    let w = 0
    for (const s of segments) {
      ctx.font = withWeight(baseFont, !!s.bold)
      w += ctx.measureText(s.text).width
    }
    return w
  }

  const flushLine = () => {
    let cursorX = x
    for (const seg of lineSegments) {
      ctx.font = withWeight(baseFont, !!seg.bold)
      // Use link blue for link segments, otherwise keep normal text color
      ctx.fillStyle = seg.linkUrl ? linkColor : normalColor
      ctx.fillText(seg.text, cursorX, currentY)
      const metrics = ctx.measureText(seg.text)
      // Collect link rects if requested
      if (seg.linkUrl && linkRects) {
        const ascent = (metrics as any).actualBoundingBoxAscent ?? lineHeight * 0.8
        const descent = (metrics as any).actualBoundingBoxDescent ?? lineHeight * 0.2
        const rectY = currentY - ascent
        const rectH = ascent + descent
        linkRects.push({ x: cursorX, y: rectY, w: metrics.width, h: rectH, url: seg.linkUrl })
      }
      if (seg.underline || seg.strike) {
        const ascent = (metrics as any).actualBoundingBoxAscent ?? lineHeight * 0.8
        const descent = (metrics as any).actualBoundingBoxDescent ?? lineHeight * 0.2
        ctx.beginPath()
        ctx.strokeStyle = ctx.fillStyle as string
        ctx.lineWidth = 1
        if (seg.underline) {
          const uy = currentY + descent - 1
          ctx.moveTo(cursorX, uy)
          ctx.lineTo(cursorX + metrics.width, uy)
        }
        if (seg.strike) {
          const sy = currentY - ascent * 0.4
          ctx.moveTo(cursorX, sy)
          ctx.lineTo(cursorX + metrics.width, sy)
        }
        ctx.stroke()
      }
      cursorX += metrics.width
    }
    currentY += lineHeight
    lineSegments = []
  }

  for (const token of tokens) {
    const parts = token.text.split(/(\s+)/)
    for (const part of parts) {
      if (part === '') continue
      const seg: InlineToken & { text: string } = { ...token, text: part }
      const nextWidth = (() => {
        const temp = [...lineSegments, seg]
        return lineWidth(temp)
      })()
      if (nextWidth > maxWidth && lineSegments.length > 0 && part.trim() !== '') {
        flushLine()
      }
      lineSegments.push(seg)
    }
  }
  if (lineSegments.length) flushLine()
  return currentY
}

export function extractImageUrls(markdown: string): string[] {
  const urls: string[] = []
  const re = /!\[[^\]]*\]\(([^\)]+)\)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(markdown)) !== null) {
    if (m[1]) urls.push(m[1].trim())
  }
  return Array.from(new Set(urls))
}

export async function preloadMarkdownImages(markdown: string): Promise<Map<string, ImageBitmap>> {
  const urls = extractImageUrls(markdown)
  const out = new Map<string, ImageBitmap>()
  await Promise.all(urls.map(async (u) => {
    try {
      const res = await fetch(u)
      if (!res.ok) return
      const blob = await res.blob()
      const bmp = await createImageBitmap(blob)
      out.set(u, bmp)
    } catch {
      // ignore failed image
    }
  }))
  return out
}
