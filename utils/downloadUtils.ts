import { marked } from 'marked';
import { jsPDF } from 'jspdf';
import { Message } from '../types';

// Helper to trigger download
const triggerDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// New: Download raw transcript
export const downloadTranscriptAsText = (messages: Message[], title: string) => {
    if (!messages || messages.length === 0) return;

    const textContent = messages.map(m => {
        const time = new Date(m.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'});
        // Use the main speaker name, or fallback to role
        // For file uploads, the speaker is often embedded in the text, so we just dump the text usually.
        // But if we have a structured speaker field, we use it.
        const header = m.speaker ? `${m.speaker} [${time}]` : (m.role === 'model' ? `AI [${time}]` : `User [${time}]`);
        return `${header}:\n${m.text}`;
    }).join('\n\n-------------------\n\n');

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    triggerDownload(blob, `${title}_transcript.txt`);
};

// 1. Markdown Download
export const downloadAsMarkdown = (content: string, filename: string = 'meeting-minutes.md') => {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  triggerDownload(blob, filename);
};

// 2. Word Download (HTML-based .doc)
export const downloadAsWord = (content: string, filename: string = 'meeting-minutes.doc') => {
  const htmlContent = marked.parse(content);
  
  const preHtml = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset='utf-8'><title>Meeting Minutes</title>
    <style>
      body { font-family: 'Microsoft JhengHei', sans-serif; line-height: 1.5; }
      h1, h2, h3 { color: #2E74B5; }
      table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
      th, td { border: 1px solid #999; padding: 8px; text-align: left; }
      th { background-color: #f2f2f2; }
    </style>
    </head><body>
  `;
  const postHtml = "</body></html>";
  const fullHtml = preHtml + htmlContent + postHtml;

  const blob = new Blob([fullHtml], { type: 'application/vnd.ms-word;charset=utf-8' });
  triggerDownload(blob, filename);
};

// 3. PDF Download
export const downloadAsPDF = (content: string, filename: string = 'meeting-minutes.pdf') => {
    // ALTERNATIVE STRATEGY FOR PDF IN BROWSER WITHOUT FONTS:
    // Create a temporary print window. This is the most reliable way to get PDF with Chinese characters support.
    
    const htmlContent = marked.parse(content);
    const printWindow = window.open('', '', 'height=600,width=800');
    
    if (printWindow) {
        printWindow.document.write('<html><head><title>' + filename + '</title>');
        printWindow.document.write(`
            <style>
                body { font-family: 'Microsoft JhengHei', sans-serif; padding: 40px; }
                h1, h2, h3 { color: #333; border-bottom: 1px solid #ccc; padding-bottom: 10px; }
                table { border-collapse: collapse; width: 100%; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                blockquote { border-left: 4px solid #eee; padding-left: 16px; color: #666; }
            </style>
        `);
        printWindow.document.write('</head><body>');
        printWindow.document.write(htmlContent as string);
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        printWindow.focus();
        
        // Wait a moment for styles to load then print
        setTimeout(() => {
            printWindow.print();
            // printWindow.close(); // Optional: close after print
        }, 500);
    } else {
        alert("請允許彈出視窗以產生 PDF (使用列印功能)。");
    }
};