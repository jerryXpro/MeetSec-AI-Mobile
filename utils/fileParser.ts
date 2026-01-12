// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import mammoth from 'mammoth';
// @ts-ignore
import * as XLSX from 'xlsx';

// Initialize PDF Worker
// Use cdnjs for the worker as it is generally more stable for worker loading than esm.sh in some contexts
const pdfJs = pdfjsLib.default || pdfjsLib;

if (typeof window !== 'undefined') {
    // Explicitly set the worker source to match the version imported
    // We use version 3.11.174 to match the importmap
    pdfJs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

/**
 * Parses various file formats into plain text string.
 * @param file The file to parse
 * @param onProgress Optional callback to report progress (0-100)
 */
export const parseFileToText = async (
    file: File, 
    onProgress?: (progress: number) => void
): Promise<string> => {
    const fileName = file.name.toLowerCase();
    
    // Initial progress
    if (onProgress) onProgress(5);

    try {
        if (fileName.endsWith('.pdf')) {
            return await parsePDF(file, onProgress);
        } else if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
            if (onProgress) onProgress(50); // Mammoth doesn't support granular progress
            const text = await parseDocx(file);
            if (onProgress) onProgress(100);
            return text;
        } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')) {
            return await parseExcel(file, onProgress);
        } else if (fileName.endsWith('.txt') || fileName.endsWith('.md')) {
            const text = await parseText(file);
            if (onProgress) onProgress(100);
            return text;
        } else {
            throw new Error(`不支援的檔案格式: ${file.name}`);
        }
    } catch (error: any) {
        console.error("File parsing error:", error);
        throw new Error(`檔案解析失敗 (${file.name}): ${error.message}`);
    }
};

const parseText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsText(file);
    });
};

const parsePDF = async (file: File, onProgress?: (p: number) => void): Promise<string> => {
    try {
        const arrayBuffer = await file.arrayBuffer();
        
        // Use a standard font face for empty fonts to prevent errors
        const loadingTask = pdfJs.getDocument({
            data: arrayBuffer,
            cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
            cMapPacked: true,
        });

        const pdf = await loadingTask.promise;
        let text = '';
        
        // Iterate through all pages
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            
            // @ts-ignore
            const strings = content.items.map((item: any) => item.str);
            text += `\n--- Page ${i} ---\n` + strings.join(' ') + '\n';
            
            // Report progress
            if (onProgress) {
                const percent = Math.round((i / pdf.numPages) * 100);
                onProgress(percent);
                // Yield to main thread to allow UI update
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
        return text;
    } catch (e: any) {
        console.error("PDF Parse Error Detail:", e);
        throw new Error("PDF 解析錯誤，可能是加密文件或格式不相容。");
    }
};

const parseDocx = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value; // The raw text
};

const parseExcel = async (file: File, onProgress?: (p: number) => void): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    let text = '';
    const sheetCount = workbook.SheetNames.length;
    
    workbook.SheetNames.forEach((sheetName: string, index: number) => {
        const sheet = workbook.Sheets[sheetName];
        // Convert sheet to CSV format which LLMs understand reasonably well
        const csv = XLSX.utils.sheet_to_csv(sheet);
        if (csv.trim()) {
            text += `\n--- Sheet: ${sheetName} ---\n${csv}\n`;
        }
        
        if (onProgress) {
            const percent = Math.round(((index + 1) / sheetCount) * 100);
            onProgress(percent);
        }
    });
    return text;
};