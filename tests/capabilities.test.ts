import {
  obterCapacidades,
  CAPABILITIES_SDCP_FDM,
  CAPABILITIES_MOONRAKER_COSMOS,
  CAPABILITIES_SDCP_RESIN,
} from '../src/protocol/capabilities';
import { Printer } from '../src/types';

describe('Capacidades e Migração de Schema', () => {
  it('atribui capacidades corretas para Centauri Carbon em SDCP', () => {
    const cap = obterCapacidades('fdm', 'sdcp');
    expect(cap.telemetria).toBe(true);
    expect(cap.temperaturas).toBe(true);
    expect(cap.camara).toBe(true);
    expect(cap.movimentoEixos).toBe(true);
    expect(cap.babyStepping).toBe(false);
    expect(cap.consolaGcode).toBe(false);
    expect(cap.timelapseSdcp).toBe(true);
    expect(cap).toEqual(CAPABILITIES_SDCP_FDM);
  });

  it('atribui capacidades corretas para Centauri Carbon em COSMOS / Moonraker', () => {
    const cap = obterCapacidades('fdm', 'moonraker');
    expect(cap.telemetria).toBe(true);
    expect(cap.temperaturas).toBe(true);
    expect(cap.babyStepping).toBe(true);
    expect(cap.consolaGcode).toBe(true);
    expect(cap.macrosFilamento).toBe(true);
    expect(cap.timelapseSdcp).toBe(false);
    expect(cap).toEqual(CAPABILITIES_MOONRAKER_COSMOS);
  });

  it('atribui capacidades corretas para Saturn 3 Ultra (resina em SDCP)', () => {
    const cap = obterCapacidades('resin', 'sdcp');
    expect(cap.telemetria).toBe(true);
    expect(cap.temperaturas).toBe(false);
    expect(cap.camara).toBe(false);
    expect(cap.movimentoEixos).toBe(false);
    expect(cap.babyStepping).toBe(false);
    expect(cap.canvasAfc).toBe(false);
    expect(cap).toEqual(CAPABILITIES_SDCP_RESIN);
  });

  it('migra backup legado de impressoras sem campo firmware para sdcp por omissão', () => {
    // Simula JSON guardado por versões antigas da app (sem firmware)
    const backupLegado: any[] = [
      {
        id: 'centauri-1',
        printerName: 'Centauri Carbon Legada',
        ipAddress: '192.168.1.100',
        kind: 'fdm',
      },
      {
        id: 'saturn-1',
        printerName: 'Saturn 3 Ultra',
        ipAddress: '192.168.1.101',
        kind: 'resin',
      },
    ];

    const migrado: Printer[] = backupLegado.map(p => ({
      ...p,
      firmware: p.firmware ?? 'sdcp',
      connectionStatus: 'disconnected',
    }));

    expect(migrado[0].firmware).toBe('sdcp');
    expect(migrado[1].firmware).toBe('sdcp');

    // As capacidades correspondentes mantêm compatibilidade total
    const capCentauri = obterCapacidades(migrado[0].kind, migrado[0].firmware);
    expect(capCentauri.timelapseSdcp).toBe(true);
    expect(capCentauri.babyStepping).toBe(false);

    const capSaturn = obterCapacidades(migrado[1].kind, migrado[1].firmware);
    expect(capSaturn.temperaturas).toBe(false);
  });
});
