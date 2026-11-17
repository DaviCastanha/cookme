import { NextResponse } from 'next/server';
import { AuthError } from './google';
import { DriveError } from './drive';

/** Maps thrown errors to JSON responses the client sync engine understands. */
export function errorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message, code: 'auth' }, { status: error.status });
  }
  if (error instanceof DriveError) {
    if (error.status === 409) {
      return NextResponse.json({ error: 'conflict', code: 'conflict', remote: error.remote }, { status: 409 });
    }
    const status = error.status === 401 ? 401 : error.status === 404 ? 404 : error.status === 429 ? 429 : 502;
    return NextResponse.json({ error: error.message, code: status === 401 ? 'auth' : 'drive' }, { status });
  }
  console.error(error);
  return NextResponse.json({ error: 'Erro interno', code: 'internal' }, { status: 500 });
}
