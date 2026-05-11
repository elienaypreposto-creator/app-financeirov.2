import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    const body = await request.json();

    const impostoCalculadoSecreto = body.valor * 0.15;

    return NextResponse.json({ sucesso: true, imposto: impostoCalculadoSecreto });
}
