declare module "qrcode-terminal" {
  export function generate(qr: string, options?: { small?: boolean }): void;
  const qrcodeTerminal: {
    generate: (qr: string, options?: { small?: boolean }) => void;
  };
  export default qrcodeTerminal;
}

