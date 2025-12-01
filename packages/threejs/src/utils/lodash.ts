export const times = (n: number, fn: (i: number) => any) => {
  return Array.from({ length: n }, (_, i) => fn(i));
}
