import { Injectable } from '@nestjs/common';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

@Injectable()
export class PdfService {
  async generatePdf(html: string): Promise<Buffer> {
    const isLocal = process.env.NODE_ENV === 'development';

    const browser = await puppeteer.launch({
      args: isLocal
        ? ['--no-sandbox', '--disable-setuid-sandbox']
        : [
            ...chromium.args,
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--single-process', // ← penting untuk Vercel/Lambda
          ],
      executablePath: isLocal
        ? (process.env.PUPPETEER_EXECUTABLE_PATH ?? '')
        : await chromium.executablePath(),
      headless: true,
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '24px', right: '24px', bottom: '24px', left: '24px' },
    });

    await browser.close();

    return Buffer.from(pdf);
  }
}
