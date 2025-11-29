declare module "qrcode-terminal" {
  export function generate(qr: string, options?: { small?: boolean }): void;
  export default {
    generate: (qr: string, options?: { small?: boolean }) => void;
  };
}

