export function renderMarkdownToCanvas(
  ctx: CanvasRenderingContext2D,
  markdown: string,
  width: number,
  height: number
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
      cursorY += 10; // Header spacing
    } else if (line.startsWith('## ')) {
      ctx.font = 'bold 18px Arial';
      ctx.fillStyle = '#333';
      const text = line.substring(3);
      cursorY += 18;
      cursorY = wrapText(ctx, text, margin, cursorY, contentWidth, 24);
      cursorY += 8;
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
