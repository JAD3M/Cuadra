/** «1 nuevo» / «0 nuevos» / «3 nuevos»: solo el 1 va en singular. */
export const plural = (n: number, singular: string, plural: string): string =>
  `${n} ${n === 1 ? singular : plural}`;
