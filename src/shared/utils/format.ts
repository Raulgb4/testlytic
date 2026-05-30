export function toFixed(value: number, digits = 1) {
  return value.toFixed(digits);
}

export function toPercent(value: number, digits = 1) {
  return `${value.toFixed(digits)}%`;
}
