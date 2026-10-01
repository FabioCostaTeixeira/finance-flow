import { describe, expect, it } from 'vitest';
import { obterIdentidadeBanco } from './bancoIdentidade';

describe('obterIdentidadeBanco', () => {
  it('retorna identidade vermelha e logoUrl do Santander', () => {
    const resultado = obterIdentidadeBanco('Banco Santander');
    expect(resultado).toEqual({
      marca: 'Santander',
      className: 'bg-[#ec0000] text-white',
      logoUrl: '/bancos/santander.png',
    });
  });

  it('retorna identidade verde da Stone para Stone e Dízimos', () => {
    expect(obterIdentidadeBanco('Banco Stone')).toEqual({
      marca: 'Stone',
      className: 'bg-[#00a868] text-white',
    });
    expect(obterIdentidadeBanco('Conta Dízimos')).toEqual({
      marca: 'Stone',
      className: 'bg-[#00a868] text-white',
    });
  });

  it('retorna identidade preta do Uber Conta', () => {
    expect(obterIdentidadeBanco('Uber Conta')).toEqual({
      marca: 'Uber',
      className: 'bg-black text-white border border-white/20',
    });
  });
});
