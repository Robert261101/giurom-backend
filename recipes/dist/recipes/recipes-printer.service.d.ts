export declare class RecipesPrinterService {
    private readonly logger;
    private readonly PRINTER_CONFIG;
    private readonly ESC;
    private readonly GS;
    private readonly LF;
    private removeDiacritics;
    private formatDate;
    private generateLabelCommands;
    private sendToPrinter;
    printLabel(data: {
        codEticheta: string;
        preparatNume: string;
        retetaNume: string;
        dataCrearii: string;
        dataExpirarii: string;
        generataDe: string;
    }, copies?: number): Promise<void>;
    testConnection(): Promise<boolean>;
    findPrinterPort(): Promise<number | null>;
}
