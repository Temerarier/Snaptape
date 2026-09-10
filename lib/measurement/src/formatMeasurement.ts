const MM_PER_INCH = 25.4;
const MM2_PER_SQUARE_FOOT = 92903.04;
const SQUARE_FEET_PER_SQUARE = 100;

const EM_DASH = "\u2014";

function assertFinite(value: number): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError("measurement value must be a finite number");
  }
}

function assertPrecision(precision: number): void {
  if (
    typeof precision !== "number" ||
    !Number.isInteger(precision) ||
    precision < 0 ||
    precision > 6
  ) {
    throw new RangeError("precision must be an integer from 0 through 6");
  }
}

function formatNullable(
  value: number | null,
  precision: number,
  format: (value: number, precision: number) => string,
): string {
  assertPrecision(precision);
  if (value === null) return EM_DASH;
  assertFinite(value);
  return format(value, precision);
}

/**
 * Convert a millimetre length to inches without rounding.
 */
export function mmToInches(value: number): number {
  assertFinite(value);
  return value / MM_PER_INCH;
}

/**
 * Convert a square-millimetre area to square feet without rounding.
 */
export function mm2ToSquareFeet(value: number): number {
  assertFinite(value);
  return value / MM2_PER_SQUARE_FOOT;
}

/**
 * Convert a square-millimetre area to roofing squares without rounding.
 */
export function mm2ToSquares(value: number): number {
  assertFinite(value);
  return value / MM2_PER_SQUARE_FOOT / SQUARE_FEET_PER_SQUARE;
}

function formatFeetAndInches(value: number, precision: number): string {
  const magnitude = Math.abs(value);
  let feet = Math.floor(magnitude / 12);
  const inches = magnitude - feet * 12;
  let inchesText = inches.toFixed(precision);
  const roundedInches = Number(inchesText);

  // Rounding 11.999 inches, for example, must carry into the feet field.
  if (roundedInches >= 12) {
    feet += 1;
    inchesText = (0).toFixed(precision);
  }

  // Apply one sign to the complete measurement. In particular, never render
  // a negative zero after rounding.
  const isZero = feet === 0 && Number(inchesText) === 0;
  const sign = value < 0 && !isZero ? "-" : "";
  return `${sign}${feet}' ${inchesText}"`;
}

function formatSquareFeetValue(value: number, precision: number): string {
  const magnitude = Math.abs(value);
  const text = magnitude.toFixed(precision);
  const sign = value < 0 && Number(text) !== 0 ? "-" : "";
  return `${sign}${text} sq ft`;
}

function formatSquaresValue(value: number, precision: number): string {
  const magnitude = Math.abs(value);
  const text = magnitude.toFixed(precision);
  const sign = value < 0 && Number(text) !== 0 ? "-" : "";
  return `${sign}${text} SQ`;
}

function formatInchesValue(value: number, precision: number): string {
  const magnitude = Math.abs(value);
  const text = magnitude.toFixed(precision);
  const sign = value < 0 && Number(text) !== 0 ? "-" : "";
  return `${sign}${text}"`;
}

/**
 * Format an inch measurement as feet and inches.
 *
 * The default is whole inches. The precision applies to the inch component.
 */
export function formatFeetInches(
  value: number | null,
  precision = 0,
): string {
  return formatNullable(value, precision, formatFeetAndInches);
}

/**
 * Format an area measured in square feet.
 *
 * The default is whole square feet.
 */
export function formatSquareFeet(
  value: number | null,
  precision = 0,
): string {
  return formatNullable(value, precision, formatSquareFeetValue);
}

/**
 * Format an area measured in roofing squares (one square is 100 square feet).
 *
 * The default is one decimal place.
 */
export function formatSquares(value: number | null, precision = 1): string {
  return formatNullable(value, precision, formatSquaresValue);
}

/**
 * Format an inch measurement.
 *
 * The default is one decimal place.
 */
export function formatInches(value: number | null, precision = 1): string {
  return formatNullable(value, precision, formatInchesValue);
}