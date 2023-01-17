// prettier-ignore
export const courses = [ 'RFB', 'GAT', 'BJS', 'ARG', 'ES6', 'NODE', 'STPU', 'JS3', 'MMD', 'WTF', 'RDX', 'GRID', 'STICKERS', 'TTS', 'COURSES'] as const;

type Courses = typeof courses[number];
type Variants = 1 | 2 | 3;
export type ProductCode = `${Courses}${Variants}`;
