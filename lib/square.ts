import { SquareClient, SquareEnvironment } from 'square';

export function getSquareClient() {
  return new SquareClient({
    token: process.env.SQUARE_ACCESS_TOKEN!,
    environment: process.env.SQUARE_ENVIRONMENT?.toLowerCase() === 'production'
      ? SquareEnvironment.Production
      : SquareEnvironment.Sandbox,
  });
}
