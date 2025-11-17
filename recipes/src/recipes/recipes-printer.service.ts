import { Injectable, Logger } from '@nestjs/common';
import * as net from 'net';

/**
 * Serviciu pentru printare către imprimanta Epson TML 100
 * Conectare prin TCP/IP
 */
@Injectable()
export class RecipesPrinterService {
  private readonly logger = new Logger(RecipesPrinterService.name);
  
  // Configurație imprimantă Epson TML 100
  // IP-ul poate fi configurat prin variabila de mediu PRINTER_IP
  // Porturile comune pentru Epson TML 100: 9100 (Raw TCP/IP), 515 (LPR), 631 (IPP)
  private readonly PRINTER_CONFIG = {
    ip: process.env.PRINTER_IP || '192.168.192.100', // IP corect al imprimantei
    port: parseInt(process.env.PRINTER_PORT || '9100', 10), // Port standard pentru ESC/POS prin TCP/IP
    timeout: parseInt(process.env.PRINTER_TIMEOUT || '5000', 10), // Timeout în milisecunde
    // Porturi alternative de testat dacă 9100 nu funcționează
    alternativePorts: [9100, 515, 631, 9101, 9102],
  };

  // ESC/POS Commands
  private readonly ESC = '\x1B';
  private readonly GS = '\x1D';
  private readonly LF = '\x0A';

  /**
   * Convertește textul pentru a elimina diacriticele (pentru compatibilitate)
   */
  private removeDiacritics(text: string): string {
    if (!text) return '';
    return text
      .replace(/ă/g, 'a')
      .replace(/â/g, 'a')
      .replace(/î/g, 'i')
      .replace(/ș/g, 's')
      .replace(/ț/g, 't')
      .replace(/Ă/g, 'A')
      .replace(/Â/g, 'A')
      .replace(/Î/g, 'I')
      .replace(/Ș/g, 'S')
      .replace(/Ț/g, 'T');
  }

  /**
   * Formatează data pentru afișare
   */
  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    // Corecție timezone (scădem 3 ore pentru timezone România)
    const correctedDate = new Date(date.getTime() - 3 * 60 * 60 * 1000);
    return correctedDate.toLocaleString('ro-RO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Generează comenzi ESC/POS pentru etichetă
   */
  private generateLabelCommands(data: {
    codEticheta: string;
    preparatNume: string;
    retetaNume: string;
    dataCrearii: string;
    dataExpirarii: string;
    generataDe: string;
  }): Buffer {
    const buffers: Buffer[] = [];

    // Initialize printer
    buffers.push(Buffer.from(this.ESC + '@')); // Reset printer

    // Set label size (58mm width - standard pentru TML 100)
    // Set character size
    buffers.push(Buffer.from(this.ESC + '!' + '\x00')); // Normal size

    // Center alignment
    buffers.push(Buffer.from(this.ESC + 'a' + '\x01')); // Center

    // Title: "Denumire produs:"
    buffers.push(Buffer.from(this.ESC + '!' + '\x10')); // Double height
    buffers.push(Buffer.from('Denumire produs:\n'));
    
    // Product name (bold, larger)
    const productName = this.removeDiacritics(data.retetaNume || data.preparatNume || 'Produs necunoscut');
    buffers.push(Buffer.from(this.ESC + '!' + '\x30')); // Double width + height
    buffers.push(Buffer.from(productName + '\n\n'));

    // Reset to normal
    buffers.push(Buffer.from(this.ESC + '!' + '\x00'));
    buffers.push(Buffer.from(this.ESC + 'a' + '\x00')); // Left align

    // Preparat la
    const preparedDate = this.formatDate(data.dataCrearii);
    buffers.push(Buffer.from('Preparat la: ' + preparedDate + '\n'));

    // Expira la
    const expiresDate = this.formatDate(data.dataExpirarii);
    buffers.push(Buffer.from('Expira la: ' + expiresDate + '\n'));

    // Lot
    buffers.push(Buffer.from('Lot: ' + data.codEticheta + '\n\n'));

    // Generat de
    const generatedBy = this.removeDiacritics(data.generataDe || 'Necunoscut');
    buffers.push(Buffer.from('Generat de: ' + generatedBy + '\n\n'));

    // Company name (centered, smaller)
    buffers.push(Buffer.from(this.ESC + 'a' + '\x01')); // Center
    buffers.push(Buffer.from(this.ESC + '!' + '\x08')); // Double width
    buffers.push(Buffer.from('Gyros & Doner SRL\n'));

    // Feed paper and cut
    buffers.push(Buffer.from('\n\n\n')); // Feed
    buffers.push(Buffer.from(this.GS + 'V' + '\x41' + '\x03')); // Partial cut

    return Buffer.concat(buffers);
  }

  /**
   * Trimite date către imprimantă prin TCP/IP
   */
  private async sendToPrinter(data: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      let isResolved = false;

      socket.setTimeout(this.PRINTER_CONFIG.timeout);

      socket.on('connect', () => {
        this.logger.log(`✅ Connected to printer at ${this.PRINTER_CONFIG.ip}:${this.PRINTER_CONFIG.port}`);
        socket.write(data);
        socket.end();
      });

      socket.on('close', () => {
        if (!isResolved) {
          isResolved = true;
          this.logger.log('✅ Print job completed');
          resolve();
        }
      });

      socket.on('error', (error: any) => {
        if (!isResolved) {
          isResolved = true;
          this.logger.error(`❌ Printer connection error: ${error.message}`);
          
          // Mesaje de eroare mai clare pentru utilizator
          let userMessage = 'Eroare la conectarea la imprimantă';
          if (error.code === 'ECONNREFUSED') {
            userMessage = `Nu s-a putut conecta la imprimantă la ${this.PRINTER_CONFIG.ip}:${this.PRINTER_CONFIG.port}. Verifică că:\n` +
              `1. Imprimanta este pornită și conectată la rețea\n` +
              `2. IP-ul imprimantei este corect (${this.PRINTER_CONFIG.ip})\n` +
              `3. Serverul backend este pe aceeași rețea cu imprimanta\n` +
              `4. Firewall-ul permite conexiuni pe portul ${this.PRINTER_CONFIG.port}`;
          } else if (error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
            userMessage = `Imprimanta nu este accesibilă la ${this.PRINTER_CONFIG.ip}:${this.PRINTER_CONFIG.port}. Verifică IP-ul și conectivitatea rețelei.`;
          }
          
          reject(new Error(userMessage));
        }
      });

      socket.on('timeout', () => {
        if (!isResolved) {
          isResolved = true;
          socket.destroy();
          this.logger.error('❌ Printer connection timeout');
          reject(new Error('Timeout la conectarea la imprimantă'));
        }
      });

      // Conectează la imprimantă
      socket.connect(this.PRINTER_CONFIG.port, this.PRINTER_CONFIG.ip);
    });
  }

  /**
   * Printează o etichetă
   */
  async printLabel(
    data: {
      codEticheta: string;
      preparatNume: string;
      retetaNume: string;
      dataCrearii: string;
      dataExpirarii: string;
      generataDe: string;
    },
    copies: number = 1
  ): Promise<void> {
    try {
      this.logger.log(`🖨️ Printing label: ${data.codEticheta}, copies: ${copies}`);
      this.logger.log(`🔌 Connecting to printer at ${this.PRINTER_CONFIG.ip}:${this.PRINTER_CONFIG.port}`);
      
      const commands = this.generateLabelCommands(data);
      
      // Printează numărul de copii solicitate
      for (let i = 0; i < copies; i++) {
        this.logger.log(`📄 Printing copy ${i + 1} of ${copies}`);
        await this.sendToPrinter(commands);
        // Mic delay între copii pentru a permite imprimantei să proceseze
        if (i < copies - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      this.logger.log(`✅ Successfully printed ${copies} copy/copies`);
    } catch (error) {
      this.logger.error(`❌ Print error: ${error instanceof Error ? error.message : 'Eroare necunoscută'}`);
      // Re-throw eroarea pentru ca controller-ul să o poată gestiona
      throw error;
    }
  }

  /**
   * Testează conexiunea cu imprimanta pe portul configurat
   */
  async testConnection(): Promise<boolean> {
    try {
      this.logger.log(`🔍 Testing connection to printer at ${this.PRINTER_CONFIG.ip}:${this.PRINTER_CONFIG.port}`);
      const testData = Buffer.from([0x1B, 0x40]); // ESC @ (reset)
      await this.sendToPrinter(testData);
      this.logger.log('✅ Printer connection test successful');
      return true;
    } catch (error) {
      this.logger.error(`❌ Printer connection test failed: ${error instanceof Error ? error.message : 'Eroare necunoscută'}`);
      return false;
    }
  }

  /**
   * Testează mai multe porturi pentru a găsi portul corect al imprimantei
   */
  async findPrinterPort(): Promise<number | null> {
    this.logger.log(`🔍 Scanning ports for printer at ${this.PRINTER_CONFIG.ip}...`);
    
    for (const port of this.PRINTER_CONFIG.alternativePorts) {
      try {
        this.logger.log(`🔍 Testing port ${port}...`);
        const testData = Buffer.from([0x1B, 0x40]); // ESC @ (reset)
        
        const result = await new Promise<boolean>((resolve) => {
          const socket = new net.Socket();
          let isResolved = false;
          
          socket.setTimeout(2000); // Timeout scurt pentru scanare
          
          socket.on('connect', () => {
            if (!isResolved) {
              isResolved = true;
              this.logger.log(`✅ Port ${port} is open and accepting connections`);
              socket.write(testData);
              socket.end();
              resolve(true);
            }
          });
          
          socket.on('error', () => {
            if (!isResolved) {
              isResolved = true;
              resolve(false);
            }
          });
          
          socket.on('timeout', () => {
            if (!isResolved) {
              isResolved = true;
              socket.destroy();
              resolve(false);
            }
          });
          
          socket.connect(port, this.PRINTER_CONFIG.ip);
        });
        
        if (result) {
          this.logger.log(`✅ Found working port: ${port}`);
          return port;
        }
      } catch (error) {
        // Continuă cu următorul port
        continue;
      }
    }
    
    this.logger.error(`❌ No working port found for printer at ${this.PRINTER_CONFIG.ip}`);
    return null;
  }
}

