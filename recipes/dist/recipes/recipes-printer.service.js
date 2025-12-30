"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var RecipesPrinterService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecipesPrinterService = void 0;
const common_1 = require("@nestjs/common");
const net = require("net");
let RecipesPrinterService = RecipesPrinterService_1 = class RecipesPrinterService {
    constructor() {
        this.logger = new common_1.Logger(RecipesPrinterService_1.name);
        this.PRINTER_CONFIG = {
            ip: process.env.PRINTER_IP || '192.168.192.100',
            port: parseInt(process.env.PRINTER_PORT || '9100', 10),
            timeout: parseInt(process.env.PRINTER_TIMEOUT || '5000', 10),
            alternativePorts: [9100, 515, 631, 9101, 9102],
        };
        this.ESC = '\x1B';
        this.GS = '\x1D';
        this.LF = '\x0A';
    }
    removeDiacritics(text) {
        if (!text)
            return '';
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
    formatDate(dateString) {
        const date = new Date(dateString);
        const correctedDate = new Date(date.getTime() - 3 * 60 * 60 * 1000);
        return correctedDate.toLocaleString('ro-RO', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    generateLabelCommands(data) {
        const buffers = [];
        buffers.push(Buffer.from(this.ESC + '@'));
        buffers.push(Buffer.from(this.ESC + '!' + '\x00'));
        buffers.push(Buffer.from(this.ESC + 'a' + '\x01'));
        buffers.push(Buffer.from(this.ESC + '!' + '\x10'));
        buffers.push(Buffer.from('Denumire produs:\n'));
        const productName = this.removeDiacritics(data.retetaNume || data.preparatNume || 'Produs necunoscut');
        buffers.push(Buffer.from(this.ESC + '!' + '\x30'));
        buffers.push(Buffer.from(productName + '\n\n'));
        buffers.push(Buffer.from(this.ESC + '!' + '\x00'));
        buffers.push(Buffer.from(this.ESC + 'a' + '\x00'));
        const preparedDate = this.formatDate(data.dataCrearii);
        buffers.push(Buffer.from('Preparat la: ' + preparedDate + '\n'));
        const expiresDate = this.formatDate(data.dataExpirarii);
        buffers.push(Buffer.from('Expira la: ' + expiresDate + '\n'));
        buffers.push(Buffer.from('Lot: ' + data.codEticheta + '\n\n'));
        const generatedBy = this.removeDiacritics(data.generataDe || 'Necunoscut');
        buffers.push(Buffer.from('Generat de: ' + generatedBy + '\n\n'));
        buffers.push(Buffer.from(this.ESC + 'a' + '\x01'));
        buffers.push(Buffer.from(this.ESC + '!' + '\x08'));
        buffers.push(Buffer.from('Gyros & Doner SRL\n'));
        buffers.push(Buffer.from('\n\n\n'));
        buffers.push(Buffer.from(this.GS + 'V' + '\x41' + '\x03'));
        return Buffer.concat(buffers);
    }
    async sendToPrinter(data) {
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
            socket.on('error', (error) => {
                if (!isResolved) {
                    isResolved = true;
                    this.logger.error(`❌ Printer connection error: ${error.message}`);
                    let userMessage = 'Eroare la conectarea la imprimantă';
                    if (error.code === 'ECONNREFUSED') {
                        userMessage = `Nu s-a putut conecta la imprimantă la ${this.PRINTER_CONFIG.ip}:${this.PRINTER_CONFIG.port}. Verifică că:\n` +
                            `1. Imprimanta este pornită și conectată la rețea\n` +
                            `2. IP-ul imprimantei este corect (${this.PRINTER_CONFIG.ip})\n` +
                            `3. Serverul backend este pe aceeași rețea cu imprimanta\n` +
                            `4. Firewall-ul permite conexiuni pe portul ${this.PRINTER_CONFIG.port}`;
                    }
                    else if (error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
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
            socket.connect(this.PRINTER_CONFIG.port, this.PRINTER_CONFIG.ip);
        });
    }
    async printLabel(data, copies = 1) {
        try {
            this.logger.log(`🖨️ Printing label: ${data.codEticheta}, copies: ${copies}`);
            this.logger.log(`🔌 Connecting to printer at ${this.PRINTER_CONFIG.ip}:${this.PRINTER_CONFIG.port}`);
            const commands = this.generateLabelCommands(data);
            for (let i = 0; i < copies; i++) {
                this.logger.log(`📄 Printing copy ${i + 1} of ${copies}`);
                await this.sendToPrinter(commands);
                if (i < copies - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
            this.logger.log(`✅ Successfully printed ${copies} copy/copies`);
        }
        catch (error) {
            this.logger.error(`❌ Print error: ${error instanceof Error ? error.message : 'Eroare necunoscută'}`);
            throw error;
        }
    }
    async testConnection() {
        try {
            this.logger.log(`🔍 Testing connection to printer at ${this.PRINTER_CONFIG.ip}:${this.PRINTER_CONFIG.port}`);
            const testData = Buffer.from([0x1B, 0x40]);
            await this.sendToPrinter(testData);
            this.logger.log('✅ Printer connection test successful');
            return true;
        }
        catch (error) {
            this.logger.error(`❌ Printer connection test failed: ${error instanceof Error ? error.message : 'Eroare necunoscută'}`);
            return false;
        }
    }
    async findPrinterPort() {
        this.logger.log(`🔍 Scanning ports for printer at ${this.PRINTER_CONFIG.ip}...`);
        for (const port of this.PRINTER_CONFIG.alternativePorts) {
            try {
                this.logger.log(`🔍 Testing port ${port}...`);
                const testData = Buffer.from([0x1B, 0x40]);
                const result = await new Promise((resolve) => {
                    const socket = new net.Socket();
                    let isResolved = false;
                    socket.setTimeout(2000);
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
            }
            catch (error) {
                continue;
            }
        }
        this.logger.error(`❌ No working port found for printer at ${this.PRINTER_CONFIG.ip}`);
        return null;
    }
};
exports.RecipesPrinterService = RecipesPrinterService;
exports.RecipesPrinterService = RecipesPrinterService = RecipesPrinterService_1 = __decorate([
    (0, common_1.Injectable)()
], RecipesPrinterService);
//# sourceMappingURL=recipes-printer.service.js.map