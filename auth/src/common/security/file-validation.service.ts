import { Injectable, BadRequestException, Logger } from '@nestjs/common';

/**
 * Serviciu pentru validarea și protecția fișierelor încărcate
 * Previne încărcarea și executarea de fișiere executabile
 */
@Injectable()
export class FileValidationService {
  private readonly logger = new Logger(FileValidationService.name);

  // Extensii executabile BLOCHATE (nu pot fi încărcate)
  private readonly BLOCKED_EXTENSIONS = [
    // Windows executables
    'exe', 'bat', 'cmd', 'com', 'pif', 'scr', 'vbs', 'js', 'jar',
    // Linux/Unix executables
    'sh', 'bash', 'zsh', 'csh', 'ksh', 'bin', 'run', 'deb', 'rpm',
    // Scripts
    'ps1', 'psm1', 'psd1', 'py', 'pyc', 'pyw', 'pl', 'rb', 'php',
    // Archives that can contain executables
    'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz',
    // Other dangerous
    'dll', 'so', 'dylib', 'app', 'apk', 'msi', 'dmg', 'pkg',
    // Office macros (pot conține malware)
    'docm', 'xlsm', 'pptm', 'dotm', 'xltm', 'potm',
  ];

  // Extensii PERMISE (whitelist)
  private readonly ALLOWED_EXTENSIONS = [
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt',
    'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg',
    'mp4', 'avi', 'mov', 'wmv', 'flv', 'webm',
    'mp3', 'wav', 'ogg', 'm4a',
  ];

  // Magic bytes (file signatures) pentru validare
  private readonly FILE_SIGNATURES: { [key: string]: string[] } = {
    // PDF
    'pdf': ['255044462D'], // %PDF-
    // Images
    'jpg': ['FFD8FF'],
    'jpeg': ['FFD8FF'],
    'png': ['89504E47'], // PNG
    'gif': ['47494638'], // GIF8
    // Office documents
    'doc': ['D0CF11E0'], // MS Office (old format)
    'docx': ['504B0304'], // ZIP signature (docx is a zip)
    'xls': ['D0CF11E0'],
    'xlsx': ['504B0304'],
    // Text
    'txt': [], // No signature, accept any
  };

  /**
   * Validează extensia fișierului
   */
  validateExtension(fileName: string): void {
    const extension = this.getFileExtension(fileName);
    
    if (!extension) {
      throw new BadRequestException('Fișierul trebuie să aibă o extensie');
    }

    const lowerExt = extension.toLowerCase();

    // Verifică dacă extensia este blocată
    if (this.BLOCKED_EXTENSIONS.includes(lowerExt)) {
      this.logger.warn(`🚫 Blocked file upload attempt: ${fileName} (blocked extension: ${lowerExt})`);
      throw new BadRequestException(
        `Tipul de fișier "${extension}" nu este permis din motive de securitate. Extensiile executabile sunt blocate.`
      );
    }

    // Verifică dacă extensia este în whitelist
    if (!this.ALLOWED_EXTENSIONS.includes(lowerExt)) {
      this.logger.warn(`⚠️ Unknown file extension: ${fileName} (extension: ${lowerExt})`);
      throw new BadRequestException(
        `Tipul de fișier "${extension}" nu este permis. Tipuri permise: ${this.ALLOWED_EXTENSIONS.join(', ')}`
      );
    }
  }

  /**
   * Validează conținutul fișierului folosind magic bytes
   */
  validateFileContent(fileBuffer: Buffer, fileName: string): void {
    const extension = this.getFileExtension(fileName)?.toLowerCase();
    
    if (!extension) {
      throw new BadRequestException('Nu se poate determina extensia fișierului');
    }

    // Verifică magic bytes
    const expectedSignatures = this.FILE_SIGNATURES[extension];
    
    if (expectedSignatures && expectedSignatures.length > 0) {
      const fileSignature = fileBuffer.slice(0, 10).toString('hex').toUpperCase();
      const isValid = expectedSignatures.some(sig => 
        fileSignature.startsWith(sig.toUpperCase())
      );

      if (!isValid) {
        this.logger.error(
          `🚨 File content validation failed: ${fileName}\n` +
          `Expected signatures: ${expectedSignatures.join(', ')}\n` +
          `Actual signature: ${fileSignature}`
        );
        throw new BadRequestException(
          `Conținutul fișierului nu corespunde tipului declarat. ` +
          `Fișierul pare să fie de alt tip decât "${extension}".`
        );
      }
    }

    // Verifică dacă fișierul este un executabil mascat
    this.checkForExecutableContent(fileBuffer, fileName);
  }

  /**
   * Verifică dacă fișierul conține conținut executabil (PE, ELF, etc.)
   */
  private checkForExecutableContent(fileBuffer: Buffer, fileName: string): void {
    const signature = fileBuffer.slice(0, 4).toString('hex').toUpperCase();

    // PE (Portable Executable) - Windows executables
    if (signature === '4D5A9000' || fileBuffer.slice(0, 2).toString() === 'MZ') {
      this.logger.error(`🚨 Blocked executable file: ${fileName} (PE executable detected)`);
      throw new BadRequestException(
        'Fișierul pare să fie un executabil Windows. Fișierele executabile nu sunt permise.'
      );
    }

    // ELF - Linux executables
    if (signature.startsWith('7F454C46') || fileBuffer.slice(0, 4).toString() === '\x7FELF') {
      this.logger.error(`🚨 Blocked executable file: ${fileName} (ELF executable detected)`);
      throw new BadRequestException(
        'Fișierul pare să fie un executabil Linux. Fișierele executabile nu sunt permise.'
      );
    }

    // Mach-O - macOS executables
    if (signature.startsWith('FEEDFACE') || signature.startsWith('CEFAEDFE') || 
        signature.startsWith('CFAEDFEF') || signature.startsWith('FEEDFACF')) {
      this.logger.error(`🚨 Blocked executable file: ${fileName} (Mach-O executable detected)`);
      throw new BadRequestException(
        'Fișierul pare să fie un executabil macOS. Fișierele executabile nu sunt permise.'
      );
    }

    // Shell script shebang
    const firstBytes = fileBuffer.slice(0, 2).toString();
    if (firstBytes === '#!') {
      this.logger.error(`🚨 Blocked script file: ${fileName} (shebang detected)`);
      throw new BadRequestException(
        'Fișierul pare să fie un script executabil. Scripturile nu sunt permise.'
      );
    }
  }

  /**
   * Validează path-ul pentru a preveni path traversal attacks
   */
  validateFilePath(filePath: string, baseDir: string): string {
    // Normalizează path-ul
    const normalizedPath = require('path').normalize(filePath);
    const normalizedBase = require('path').normalize(baseDir);

    // Verifică dacă path-ul conține caractere periculoase
    if (normalizedPath.includes('..') || normalizedPath.includes('~')) {
      this.logger.error(`🚨 Path traversal attempt detected: ${filePath}`);
      throw new BadRequestException('Path-ul fișierului conține caractere nepermise');
    }

    // Verifică dacă path-ul final este în directorul permis
    const resolvedPath = require('path').resolve(normalizedBase, normalizedPath);
    const resolvedBase = require('path').resolve(normalizedBase);

    if (!resolvedPath.startsWith(resolvedBase)) {
      this.logger.error(
        `🚨 Path traversal attempt: ${filePath}\n` +
        `Resolved path: ${resolvedPath}\n` +
        `Base directory: ${resolvedBase}`
      );
      throw new BadRequestException('Path-ul fișierului depășește directorul permis');
    }

    return resolvedPath;
  }

  /**
   * Extrage extensia din numele fișierului
   */
  private getFileExtension(fileName: string): string | null {
    const parts = fileName.split('.');
    if (parts.length < 2) {
      return null;
    }
    return parts[parts.length - 1];
  }

  /**
   * Validează complet un fișier (extensie + conținut + path)
   */
  validateFile(
    fileName: string,
    fileBuffer: Buffer,
    filePath: string,
    baseDir: string
  ): void {
    // 1. Validează extensia
    this.validateExtension(fileName);

    // 2. Validează conținutul
    this.validateFileContent(fileBuffer, fileName);

    // 3. Validează path-ul
    this.validateFilePath(filePath, baseDir);

    this.logger.log(`✅ File validation passed: ${fileName}`);
  }
}

