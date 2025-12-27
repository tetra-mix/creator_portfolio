export type MarkdownRenderOptions = {
  images?: Map<string, ImageBitmap>
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
  
  for (let line of lines) {
    line = line.trim();
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
      ctx.font = 'bold 24px Arial';
      ctx.fillStyle = '#000';
      const text = line.substring(2);
      cursorY += 24;
      cursorY = wrapText(ctx, text, margin, cursorY, contentWidth, 30);
    } else if (line.startsWith('## ')) {
      ctx.font = 'bold 18px Arial';
      ctx.fillStyle = '#333';
      const text = line.substring(3);
      cursorY += 18;
      cursorY = wrapText(ctx, text, margin, cursorY, contentWidth, 24);
      cursorY += 3; // Reduced spacing
    } 
    // Bullet Lists
    else if (line.startsWith('- ')) {
      ctx.font = '14px Arial';
      ctx.fillStyle = '#000';
      const text = line.substring(2);
      
      // Draw bullet
      ctx.beginPath();
      ctx.arc(margin + 5, cursorY - 4, 2, 0, Math.PI * 2);
      ctx.fill();
      
      cursorY = wrapText(ctx, text, margin + 15, cursorY, contentWidth - 15, 20);
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
    // Normal Text
    else {
      ctx.font = '14px Arial';
      ctx.fillStyle = '#000';
      cursorY = wrapText(ctx, line, margin, cursorY, contentWidth, 20);
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
