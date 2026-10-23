// Weapon icons, quality chips and the equipment distribution bar. Numbers come from the core.

import { content } from '../../content';
import { averageWeaponPower, equippedCount, QUALITY_IDS, type QualityId, type TroopState } from '../../core';
import { Icon } from '../art/icons';
import { fmtInt, fmtRate } from '../format';
import { QUALITY_COLOR, UNARMED_COLOR, qualityName } from '../labels';

const BLADE = '#d9dce2';
/** Steel blue used for T2+ items (badges, borders). */
export const TIER_COLOR = '#8fb4d8';

/** A small weapon glyph in a ring of its quality colour. */
export function WeaponIcon({ weaponTypeId, quality, size = 28, tier = 1 }: { weaponTypeId: string; quality: QualityId | null; size?: number; tier?: number }) {
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
      {tier >= 2 && (
        <g>
          <rect x="15" y="1" width="16" height="11" rx="3.5" fill={TIER_COLOR} stroke="#0e0a10" strokeWidth="1.2" />
          <text x="23" y="9.6" textAnchor="middle" fontSize="8.5" fontWeight="800" fill="#10131a" fontFamily="system-ui, sans-serif">T{tier}</text>
        </g>
      )}
    </svg>
  );
}

export function QualityChip({ quality, count, weaponTypeId, tier = 1 }: { quality: QualityId | null; count: number; weaponTypeId: string; tier?: number }) {
  return (
    <span className={`qchip ${quality && RARE.has(quality) ? 'qchip--rare' : ''}`} style={{ borderColor: quality ? QUALITY_COLOR[quality] : UNARMED_COLOR, ['--q' as string]: quality ? QUALITY_COLOR[quality] : UNARMED_COLOR }}>
      <WeaponIcon weaponTypeId={weaponTypeId} quality={quality} size={20} tier={tier} />
      <span className="qchip__name">{quality ? qualityName(quality) : 'Obeväpnade'}</span>
      <strong className="qchip__count">{fmtInt(count)}</strong>
    </span>
  );
}

/** Qualities rare enough to glow in the UI and on the soldiers. */
export const RARE: ReadonlySet<QualityId> = new Set<QualityId>(['outstanding', 'excellent', 'masterpiece']);

/** Stacked bar: how many soldiers carry each quality, plus the unarmed remainder. */
export function EquipmentBar({ troop }: { troop: TroopState }) {
  const armed = equippedCount(troop);
  const unarmed = Math.max(0, troop.size - armed);
  const byQuality = QUALITY_IDS.map((q) => ({ q, n: troop.equipment.filter((b) => b.quality === q).reduce((s, b) => s + b.count, 0) }))
    .filter((x) => x.n > 0)
    .reverse();
  const power = averageWeaponPower(troop, content);
  const weapon = content.equipment.weaponTypes[troop.weaponTypeId];
  return (
    <div className="equip">
      <div className="equip__head">
        <WeaponIcon weaponTypeId={troop.weaponTypeId} quality={byQuality[0]?.q ?? null} size={22} />
        <span className="equip__count" aria-label={`${armed} av ${troop.size} beväpnade med ${weapon?.name ?? ''} T1`}>
          <strong>{fmtInt(armed)}</strong>/{fmtInt(troop.size)}
        </span>
        <span className="equip__pills">
          {byQuality.map(({ q, n }) => (
            <span key={q} className={`qpill ${RARE.has(q) ? 'qpill--rare' : ''}`} style={{ ['--q' as string]: QUALITY_COLOR[q] }} title={qualityName(q)}>
              {fmtInt(n)}
            </span>
          ))}
        </span>
        <span className="equip__power" title="Genomsnittlig vapenkraft"><Icon name="strength" size={15} /> ×{fmtRate(power)}</span>
      </div>
      <div className="equip__bar" role="img" aria-label={byQuality.map(({ q, n }) => `${qualityName(q)} ${n}`).join(', ') + (unarmed > 0 ? `, obeväpnade ${unarmed}` : '')}>
        {byQuality.map(({ q, n }) => (
          <span key={q} className={RARE.has(q) ? 'seg--rare' : ''} style={{ flexGrow: n, background: QUALITY_COLOR[q], ['--q' as string]: QUALITY_COLOR[q] }} />
        ))}
        {unarmed > 0 && <span style={{ flexGrow: unarmed, background: UNARMED_COLOR }} />}
      </div>
    </div>
  );
}

/** A compact on/off switch. */
export function Switch({ on, label, onChange, title }: { on: boolean; label: string; onChange: (on: boolean) => void; title?: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} className={`switch ${on ? 'switch--on' : ''}`} onClick={() => onChange(!on)} title={title}>
      <span className="switch__track"><span className="switch__thumb" /></span>
      {label}
    </button>
  );
}
