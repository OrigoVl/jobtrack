// Дефолтні ваги FSRS-4.5 (w[0..18]) — офіційні дефолти проєкту open-spaced-repetition/fsrs4anki,
// натреновані на великому датасеті реальних повторень Anki. Для персонального інструмента з
// одним користувачем повне перенавчання ваг на власній історії недоцільне (замало даних) —
// дефолти дають добре обґрунтований старт "з коробки", без потреби в датасеті/тренуванні.
// Винесено в окремий файл, щоб colocate з коментарем-джерелом і не захаращувати fsrs.ts.
// Тип-тюпл фіксованої довжини (19 елементів), а не `number[] `— з noUncheckedIndexedAccess
// звичайний масив дав би `number | undefined` на кожному індексі; тюпл із точним числом
// елементів дозволяє TS знати, що всі 19 позицій завжди визначені.
export type FsrsWeights = readonly [
  number, number, number, number, number, number, number, number, number, number,
  number, number, number, number, number, number, number, number, number,
];

export function getFsrsWeights(): FsrsWeights {
  return FSRS_DEFAULT_WEIGHTS;
}

const FSRS_DEFAULT_WEIGHTS: FsrsWeights = [
  0.4072, 1.1829, 3.1262, 15.4722, 7.2102, 0.5316, 1.0651, 0.0234, 1.616, 0.1544, 1.0824, 1.9813, 0.0953, 0.2975, 2.2042, 0.2407,
  2.9466, 0.5034, 0.6567,
];
