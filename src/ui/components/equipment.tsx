// Weapon icons, quality chips and the equipment distribution bar. Numbers come from the core.

import { content } from '../../content';
import { averageWeaponPower, equippedCount, QUALITY_IDS, type QualityId, type TroopState } from '../../core';
import { fmtInt, fmtRate } from '../format';
import { QUALITY_COLOR, UNARMED_COLOR, qualityName } from '../labels';

const BLADE = '#d9dce2';

/** A small weapon glyph in a ring of its quality colour. */
export function WeaponIcon({ weaponTypeId, quality, size = 28 }: { weaponTypeId: string; quality: QualityId | null; size?: number }) {
  const ring = quality ? QUALITY_COLOR[quality] : UNARMED_COLOR;
  return (
    <svg className="weapon-icon" width={size} height={size} viewBox="0 0 32 32" role="img" aria-label={`${content.equipment.weaponTypes[weaponTypeId]?.name ?? ''} ${quality ? qualityName(quality) : 'obeväpnad'}`}>
      <circle cx="16" cy="16" r="14.5" fill="#141116" stroke={ring} strokeWidth="2.5" />
      {quality === 'masterpiece' && <circle cx="16" cy="16" r="11.5" fill="none" stroke={ring} strokeWidth="0.8" opacity="0.6" />}
      {!quality ? (
        <path d="M11 23 L20 9" stroke="#8a6a44" strokeWidth="3" strokeLinecap="round" />
      ) : weaponTypeId === 'cleaver' || weaponTypeId === 'axe' ? (
        <g>
          <path d="M11 24 L19 8" stroke="#8a6a44" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M17 9 q8 0 7 8 q-5 0 -8 -3 Z" fill={BLADE} stroke={ring} strokeWidth="0.8" />
        </g>
      ) : weaponTypeId === 'bow' ? (
        <g>
          <path d="M12 6 Q26 16 12 26" stroke="#8a6a44" strokeWidth="2.2" fill="none" />
          <path d="M12 6 L12 26" stroke={BLADE} strokeWidth="0.8" />
        </g>
      ) : (
        <g>
          <path d="M16 6 L16 21" stroke={BLADE} strokeWidth="3" strokeLinecap="round" />
          <path d="M11 21 H21" stroke={ring} strokeWidth="2.2" strokeLinecap="round" />
          <path d="M16 22 V26" stroke="#8a6a44" strokeWidth="2.4" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
}

export function QualityChip({ quality, count, weaponTypeId }: { quality: QualityId | null; count: number; weaponTypeId: string }) {
  return (
    <span className="qchip" style={{ borderColor: quality ? QUALITY_COLOR[quality] : UNARMED_COLOR }}>
      <WeaponIcon weaponTypeId={weaponTypeId} quality={quality} size={20} />
      <span className="qchip__name">{quality ? qualityName(quality) : 'Obeväpnade'}</span>
      <strong className="qchip__count">{fmtInt(count)}</strong>
    </span>
  );
}

/** Stacked bar: how many soldiers carry each quality, plus the unarmed remainder. */
export function EquipmentBar({ troop }: { troop: TroopState }) {
  const armed = equippedCount(troop);
  const unarmed = Math.max(0, troop.size - armed);
  const byQuality = QUALITY_IDS.map((q) => ({ q, n: troop.equipment.filter((b) => b.quality === q).reduce((s, b) => s + b.count, 0) }));
  const power = averageWeaponPower(troop, content);
  const weapon = content.equipment.weaponTypes[troop.weaponTypeId];
  return (
    <div className="equip">
      <div className="equip__head">
        <span className="small">
          <WeaponIcon weaponTypeId={troop.weaponTypeId} quality={byQuality.slice().reverse().find((x) => x.n > 0)?.q ?? null} size={18} /> {weapon?.name ?? ''} T1 · {fmtInt(armed)}/{fmtInt(troop.size)} beväpnade
        </span>
        <span className="small equip__power" title="Genomsnittlig vapenkraft">⚔ ×{fmtRate(power)}</span>
      </div>
      <div className="equip__bar" role="img" aria-label={`${armed} av ${troop.size} beväpnade`}>
        {byQuality.slice().reverse().map(({ q, n }) =>
          n > 0 ? <span key={q} style={{ flexGrow: n, background: QUALITY_COLOR[q] }} title={`${qualityName(q)}: ${n}`} /> : null,
        )}
        {unarmed > 0 && <span style={{ flexGrow: unarmed, background: UNARMED_COLOR }} title={`Obeväpnade: ${unarmed}`} />}
      </div>
      <div className="equip__legend">
        {byQuality.filter((x) => x.n > 0).reverse().map(({ q, n }) => (
          <span key={q} className="legend-dot"><i style={{ background: QUALITY_COLOR[q] }} />{qualityName(q)} {fmtInt(n)}</span>
        ))}
        {unarmed > 0 && <span className="legend-dot"><i style={{ background: UNARMED_COLOR }} />Obeväpnade {fmtInt(unarmed)}</span>}
      </div>
    </div>
  );
}
