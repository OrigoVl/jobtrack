import type { DrillItem } from "./content.js";

export const DRILLS_UK: DrillItem[] = [
  {
    id: "d0",
    cat: "JavaScript",
    lvl: "easy",
    q: "Реалізуйте once(fn)",
    sol: `function once(fn) {
  let called = false, result;
  return function (...args) {
    if (!called) { called = true; result = fn.apply(this, args); }
    return result;
  };
}`,
    exp: "Замикання зберігає прапорець called та result між викликами.",
  },
  {
    id: "d1",
    cat: "JavaScript",
    lvl: "easy",
    q: "groupBy(arr, keyFn)",
    sol: `function groupBy(arr, keyFn) {
  return arr.reduce((acc, item) => {
    const k = keyFn(item);
    (acc[k] ||= []).push(item);
    return acc;
  }, {});
}
// groupBy([1,2,3,4], n => n % 2 ? 'odd' : 'even')
// => { odd: [1,3], even: [2,4] }`,
    exp: "reduce з акумулятором-об'єктом; ||= ініціалізує масив за потреби (лениво).",
  },
  {
    id: "d2",
    cat: "JavaScript",
    lvl: "med",
    q: "Реалізуйте throttle(fn, limit)",
    sol: `function throttle(fn, limit) {
  let last = 0, timer;
  return function (...args) {
    const now = Date.now();
    const remaining = limit - (now - last);
    if (remaining <= 0) {
      clearTimeout(timer); timer = null;
      last = now;
      fn.apply(this, args);
    } else if (!timer) {
      timer = setTimeout(() => {
        last = Date.now(); timer = null;
        fn.apply(this, args);
      }, remaining);
    }
  };
}`,
    exp: "На відміну від debounce (запуск 'після тиші'), throttle обмежує частоту викликів і гарантує виклик наприкінці вікна.",
  },
  {
    id: "d3",
    cat: "JavaScript",
    lvl: "med",
    q: "Реалізуйте Promise.all з нуля",
    sol: `function promiseAll(promises) {
  return new Promise((resolve, reject) => {
    const results = [];
    let done = 0;
    if (promises.length === 0) return resolve(results);
    promises.forEach((p, i) => {
      Promise.resolve(p).then((val) => {
        results[i] = val;               // зберігаємо за індексом
        if (++done === promises.length) resolve(results);
      }, reject);                       // перше ж відхилення провалює все
    });
  });
}`,
    exp: "Ключовий момент: результати зберігаються за індексом (порядок зберігається), а не в порядку завершення.",
  },
  {
    id: "d4",
    cat: "JavaScript",
    lvl: "hard",
    q: "Глибоке клонування з циклічними посиланнями",
    sol: `function deepClone(obj, seen = new WeakMap()) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (seen.has(obj)) return seen.get(obj);          // вже скопійовано — це цикл
  const copy = Array.isArray(obj) ? [] : {};
  seen.set(obj, copy);
  for (const key of Object.keys(obj)) {
    copy[key] = deepClone(obj[key], seen);
  }
  return copy;
}
// Сучасна альтернатива (без кастомних класів): structuredClone(obj)`,
    exp: "WeakMap запам'ятовує вже скопійовані об'єкти → безпечно для циклів і не утримує пам'ять.",
  },
  {
    id: "d5",
    cat: "TypeScript",
    lvl: "easy",
    q: "Дженерик identity",
    sol: `function identity<T>(value: T): T {
  return value;
}
const a = identity(42);    // a: number
const b = identity('hi');  // b: string`,
    exp: "",
  },
  {
    id: "d6",
    cat: "TypeScript",
    lvl: "easy",
    q: "Реалізуйте MyOmit<T, K>",
    sol: `type MyOmit<T, K extends keyof T> = {
  [P in keyof T as P extends K ? never : P]: T[P];
};

type User = { id: number; name: string; pass: string };
type PublicUser = MyOmit<User, 'pass'>; // { id; name }`,
    exp: "Ремапінг ключів через as + умовний тип: never відкидає непотрібний ключ.",
  },
  {
    id: "d7",
    cat: "TypeScript",
    lvl: "med",
    q: "DeepReadonly<T>",
    sol: `type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object
    ? DeepReadonly<T[K]>
    : T[K];
};`,
    exp: "Рекурсивний мапований тип: заглиблюється у вкладені об'єкти.",
  },
  {
    id: "d8",
    cat: "TypeScript",
    lvl: "med",
    q: "Дискримінована об'єднана типізація (discriminated union) + перевірка на вичерпність",
    sol: `type Result =
  | { status: 'loading' }
  | { status: 'success'; data: string }
  | { status: 'error'; message: string };

function render(r: Result): string {
  switch (r.status) {
    case 'loading': return 'Loading…';
    case 'success': return r.data;
    case 'error':   return r.message;
    default:
      const _exhaustive: never = r; // видасть помилку, якщо забули якийсь варіант
      return _exhaustive;
  }
}`,
    exp: "never у default — це страхувальна сітка компілятора для вичерпної обробки варіантів.",
  },
  {
    id: "d9",
    cat: "TypeScript",
    lvl: "med",
    q: "MyReturnType<F> через infer",
    sol: `type MyReturnType<F> =
  F extends (...args: any[]) => infer R ? R : never;

type Fn = () => { id: number };
type R = MyReturnType<Fn>; // { id: number }`,
    exp: "infer R 'захоплює' тип всередині умовного типу.",
  },
  {
    id: "d10",
    cat: "React",
    lvl: "easy",
    q: "Контрольований (controlled) input",
    sol: `function NameField() {
  const [name, setName] = useState('');
  return (
    <input
      value={name}
      onChange={(e) => setName(e.target.value)}
    />
  );
}`,
    exp: "",
  },
  {
    id: "d11",
    cat: "React",
    lvl: "easy",
    q: "Кастомний хук useToggle",
    sol: `function useToggle(initial = false) {
  const [on, setOn] = useState(initial);
  const toggle = useCallback(() => setOn((v) => !v), []);
  return [on, toggle] as const;
}`,
    exp: "as const перетворює це на кортеж (tuple), тож деструктуризація типізується точно.",
  },
  {
    id: "d12",
    cat: "React",
    lvl: "med",
    q: "useFetch з loading/error та скасуванням запиту",
    sol: `function useFetch<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    fetch(url, { signal: ac.signal })
      .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(setData)
      .catch((e) => { if (e.name !== 'AbortError') setError(e.message); })
      .finally(() => setLoading(false));
    return () => ac.abort();   // cleanup: скасовуємо при зміні url / розмонтуванні
  }, [url]);

  return { data, loading, error };
}`,
    exp: "AbortController + cleanup запобігають оновленню стану на вже розмонтованому компоненті.",
  },
  {
    id: "d13",
    cat: "React",
    lvl: "med",
    q: "Позбутися зайвого ре-рендеру (memo + useCallback)",
    sol: `const Child = React.memo(function Child(
  { onClick }: { onClick: () => void }
) {
  console.log('render Child');
  return <button onClick={onClick}>+</button>;
});

function Parent() {
  const [n, setN] = useState(0);
  // без useCallback — щоразу нове посилання, і memo не допоможе
  const inc = useCallback(() => setN((v) => v + 1), []);
  return <>{n}<Child onClick={inc} /></>;
}`,
    exp: "React.memo робить неглибоке (shallow) порівняння пропсів; стабільне посилання від useCallback дозволяє йому дійсно спрацювати.",
  },
  {
    id: "d14",
    cat: "SQL",
    lvl: "easy",
    q: "Користувачі, які взагалі не мають замовлень",
    sol: `SELECT u.id, u.name
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
WHERE o.id IS NULL;`,
    exp: "LEFT JOIN + IS NULL — це 'anti-join': залишаються лише рядки без пари.",
  },
  {
    id: "d15",
    cat: "SQL",
    lvl: "easy",
    q: "Кількість замовлень за статусом",
    sol: `SELECT status, COUNT(*) AS cnt
FROM orders
GROUP BY status
ORDER BY cnt DESC;`,
    exp: "",
  },
  {
    id: "d16",
    cat: "SQL",
    lvl: "med",
    q: "Друга за величиною зарплата",
    sol: `SELECT MAX(salary) AS second_highest
FROM employees
WHERE salary < (SELECT MAX(salary) FROM employees);

-- Через віконну функцію (гнучкіше для N-ї позиції):
-- SELECT DISTINCT salary FROM (
--   SELECT salary, DENSE_RANK() OVER (ORDER BY salary DESC) AS rnk
--   FROM employees
-- ) t WHERE rnk = 2;`,
    exp: "Підзапит виключає максимум; DENSE_RANK — більш загальний варіант для 'N-ї' позиції.",
  },
  {
    id: "d17",
    cat: "SQL",
    lvl: "med",
    q: "Наростаючий підсумок (віконна функція)",
    sol: `SELECT created_at, amount,
       SUM(amount) OVER (ORDER BY created_at) AS running_total
FROM orders
ORDER BY created_at;`,
    exp: "Віконна функція обчислює наростаючий підсумок без GROUP BY.",
  },
  {
    id: "d18",
    cat: "SQL",
    lvl: "med",
    q: "Уникнення N+1 при вибірці зв'язаних даних",
    sol: `-- Погано: ORM у циклі — 1 запит для projects + N для tasks.
-- Добре: один JOIN
SELECT p.id, p.title, t.id AS task_id, t.title AS task_title
FROM projects p
LEFT JOIN tasks t ON t.project_id = p.id
WHERE p.owner_id = $1;

-- Еквівалент у Prisma:
-- prisma.project.findMany({ where: { ownerId }, include: { tasks: true } })`,
    exp: "",
  },
  {
    id: "d19",
    cat: "NestJS",
    lvl: "easy",
    q: "Асинхронна обгортка для Express-роутів",
    sol: `const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

app.get('/users', asyncHandler(async (req, res) => {
  const users = await db.users.findAll();
  res.json(users);
}));`,
    exp: "Будь-яке відхилення (rejection) автоматично передається у next(err).",
  },
  {
    id: "d20",
    cat: "NestJS",
    lvl: "med",
    q: "In-memory rate limiter",
    sol: `function rateLimiter({ windowMs, max }) {
  const hits = new Map(); // ip -> [часові мітки]
  return (req, res, next) => {
    const now = Date.now();
    const arr = (hits.get(req.ip) || []).filter((t) => now - t < windowMs);
    arr.push(now);
    hits.set(req.ip, arr);
    if (arr.length > max)
      return res.status(429).json({ error: 'Too many requests' });
    next();
  };
}`,
    exp: "У продакшені — Redis (лічильники з TTL), щоб працювало на кількох інстансах.",
  },
  {
    id: "d21",
    cat: "NestJS",
    lvl: "med",
    q: "Обробка великого файлу як потоку (stream)",
    sol: `const readline = require('readline');
const fs = require('fs');

async function countLines(path) {
  const rl = readline.createInterface({
    input: fs.createReadStream(path),
  });
  let n = 0;
  for await (const line of rl) n++; // читаємо частинами (chunks)
  return n;
}`,
    exp: "Stream + асинхронна ітерація тримають у пам'яті лише поточний рядок.",
  },
  {
    id: "d22",
    cat: "NestJS",
    lvl: "med",
    q: "Retry з експоненційною затримкою (exponential backoff)",
    sol: `async function retry(fn, retries = 3, delay = 300) {
  try {
    return await fn();
  } catch (e) {
    if (retries === 0) throw e;
    await new Promise((r) => setTimeout(r, delay));
    return retry(fn, retries - 1, delay * 2); // 300 → 600 → 1200
  }
}`,
    exp: "",
  },
  {
    id: "d23",
    cat: "NestJS",
    lvl: "med",
    q: "JWT Guard у NestJS",
    sol: `@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwt: JwtService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) throw new UnauthorizedException();
    try {
      req.user = this.jwt.verify(token);
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}`,
    exp: "Guard вирішує 'пропустити чи ні' ще до контролера; він зберігає user у request.",
  },
  {
    id: "d24",
    cat: "Algorithms",
    lvl: "easy",
    q: "Valid Anagram (перевірка на анаграму)",
    sol: `function isAnagram(s, t) {
  if (s.length !== t.length) return false;
  const count = {};
  for (const c of s) count[c] = (count[c] || 0) + 1;
  for (const c of t) {
    if (!count[c]) return false;
    count[c]--;
  }
  return true;
}
// Час O(n), пам'ять O(1) для обмеженого алфавіту`,
    exp: "",
  },
  {
    id: "d25",
    cat: "Algorithms",
    lvl: "easy",
    q: "Contains Duplicate (наявність дублікатів)",
    sol: `function containsDuplicate(nums) {
  return new Set(nums).size !== nums.length;
}
// Час O(n), пам'ять O(n)`,
    exp: "",
  },
  {
    id: "d26",
    cat: "Algorithms",
    lvl: "med",
    q: "Group Anagrams (групування анаграм)",
    sol: `function groupAnagrams(strs) {
  const map = new Map();
  for (const s of strs) {
    const key = s.split('').sort().join(''); // канонічна форма
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(s);
  }
  return [...map.values()];
}
// Час O(n · k log k), k = довжина слова`,
    exp: "",
  },
  {
    id: "d27",
    cat: "Algorithms",
    lvl: "med",
    q: "Найдовший підрядок без повторів (sliding window)",
    sol: `function lengthOfLongestSubstring(s) {
  const seen = new Map();
  let start = 0, max = 0;
  for (let i = 0; i < s.length; i++) {
    if (seen.has(s[i]) && seen.get(s[i]) >= start) {
      start = seen.get(s[i]) + 1;      // зсуваємо ліву межу вікна
    }
    seen.set(s[i], i);
    max = Math.max(max, i - start + 1);
  }
  return max;
}
// Час O(n) — sliding window`,
    exp: "Класичний патерн sliding window: тримаємо вікно без повторів, зсуваючи ліву межу вперед.",
  },
  {
    id: "d28",
    cat: "Algorithms",
    lvl: "med",
    q: "Бінарний пошук",
    sol: `function binarySearch(arr, target) {
  let lo = 0, hi = arr.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;   // ділимо на 2
    if (arr[mid] === target) return mid;
    if (arr[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}`,
    exp: "Обов'язкова передумова: масив має бути відсортованим. >> 1 — швидке ділення навпіл.",
  },
  {
    id: "d29",
    cat: "Algorithms",
    lvl: "med",
    q: "BFS: обхід дерева по рівнях (level-order)",
    sol: `function levelOrder(root) {
  if (!root) return [];
  const res = [], queue = [root];
  while (queue.length) {
    const level = [], size = queue.length;
    for (let i = 0; i < size; i++) {
      const node = queue.shift();
      level.push(node.val);
      if (node.left) queue.push(node.left);
      if (node.right) queue.push(node.right);
    }
    res.push(level);
  }
  return res;
}
// Час O(n) — черга (BFS)`,
    exp: "На початку кожного рівня фіксуємо розмір черги — саме так рівні відокремлюються один від одного.",
  },
  {
    id: "d30",
    cat: "Algorithms",
    lvl: "easy",
    q: "FizzBuzz",
    sol: `for (let i = 1; i <= n; i++) {
  let out = '';
  if (i % 3 === 0) out += 'Fizz';
  if (i % 5 === 0) out += 'Buzz';
  console.log(out || i);
}`,
    exp: "Хитрість: накопичуємо рядок, а out || i повертає число, якщо жодна умова не спрацювала. Уникайте окремої перевірки i%15 — конкатенація елегантніша.",
  },
  {
    id: "d31",
    cat: "Algorithms",
    lvl: "easy",
    q: "Valid Parentheses (стек)",
    sol: `function isValid(s) {
  const stack = [];
  const pairs = { ')': '(', ']': '[', '}': '{' };
  for (const c of s) {
    if (c === '(' || c === '[' || c === '{') {
      stack.push(c);
    } else if (stack.pop() !== pairs[c]) {
      return false;
    }
  }
  return stack.length === 0;
}
// Час O(n), пам'ять O(n)`,
    exp: "Класичне застосування стека: закриваюча дужка має відповідати верхівці стека. Наприкінці стек має бути порожнім.",
  },
  {
    id: "d32",
    cat: "Algorithms",
    lvl: "easy",
    q: "Two Sum (hash map)",
    sol: `function twoSum(nums, target) {
  const seen = new Map(); // значення -> індекс
  for (let i = 0; i < nums.length; i++) {
    const need = target - nums[i];
    if (seen.has(need)) return [seen.get(need), i];
    seen.set(nums[i], i);
  }
  return [];
}
// Час O(n), пам'ять O(n)`,
    exp: "Наївне рішення — два вкладені цикли, O(n²). Оптимізація: зберігати вже бачені числа в Map за один прохід і шукати доповнення (complement). Класичний компроміс пам'ять-в-обмін-на-час.",
  },
  {
    id: "d33",
    cat: "Algorithms",
    lvl: "easy",
    q: "Best Time to Buy & Sell Stock (найкращий час купити/продати акцію)",
    sol: `function maxProfit(prices) {
  let minPrice = Infinity, best = 0;
  for (const p of prices) {
    minPrice = Math.min(minPrice, p);   // найдешевша ціна станом на зараз
    best = Math.max(best, p - minPrice); // найкращий продаж на сьогодні
  }
  return best;
}
// Час O(n), пам'ять O(1)`,
    exp: "Один прохід: відстежуємо мінімальну ціну на поточний момент і перевіряємо прибуток від продажу в кожній точці.",
  },
  {
    id: "d34",
    cat: "Algorithms",
    lvl: "easy",
    q: "Valid Palindrome (два вказівники)",
    sol: `function isPalindrome(s) {
  s = s.toLowerCase().replace(/[^a-z0-9]/g, '');
  let l = 0, r = s.length - 1;
  while (l < r) {
    if (s[l] !== s[r]) return false;
    l++; r--;
  }
  return true;
}
// Час O(n), додаткова пам'ять O(1) (не рахуючи очищення рядка)`,
    exp: "Два вказівники, що сходяться з країв — базовий патерн two pointers.",
  },
  {
    id: "d35",
    cat: "Algorithms",
    lvl: "med",
    q: "Maximum Subarray (алгоритм Кадане)",
    sol: `function maxSubArray(nums) {
  let cur = nums[0], max = nums[0];
  for (let i = 1; i < nums.length; i++) {
    cur = Math.max(nums[i], cur + nums[i]); // почати заново чи продовжити
    max = Math.max(max, cur);
  }
  return max;
}
// Час O(n), пам'ять O(1)`,
    exp: "Алгоритм Кадане: у кожній точці вирішуємо — продовжити поточну накопичену суму чи почати новий підмасив із поточного елемента.",
  },
  {
    id: "d36",
    cat: "Algorithms",
    lvl: "med",
    q: "Product of Array Except Self (добуток масиву без поточного елемента)",
    sol: `function productExceptSelf(nums) {
  const n = nums.length, res = new Array(n).fill(1);
  let prefix = 1;
  for (let i = 0; i < n; i++) {        // добутки зліва
    res[i] = prefix;
    prefix *= nums[i];
  }
  let suffix = 1;
  for (let i = n - 1; i >= 0; i--) {   // домножуємо на добутки справа
    res[i] *= suffix;
    suffix *= nums[i];
  }
  return res;
}
// Час O(n), додаткова пам'ять O(1) (не рахуючи результату)`,
    exp: "Два проходи: префіксні добутки зліва, потім суфіксні добутки справа. Ділення заборонене, тож не можна 'схитрувати' через total-product/element.",
  },
  {
    id: "d37",
    cat: "Algorithms",
    lvl: "easy",
    q: "Reverse Linked List (розворот зв'язного списку)",
    sol: `function reverseList(head) {
  let prev = null, curr = head;
  while (curr) {
    const next = curr.next; // зберігаємо наступний вузол
    curr.next = prev;       // розвертаємо вказівник
    prev = curr;            // просуваємо prev
    curr = next;            // просуваємо curr
  }
  return prev;
}
// Час O(n), пам'ять O(1)`,
    exp: "Три вказівники: prev/curr/next. Ітеративне рішення тут краще за рекурсію (немає ризику stack overflow).",
  },
  {
    id: "d38",
    cat: "Algorithms",
    lvl: "easy",
    q: "Merge Two Sorted Lists (злиття двох відсортованих списків)",
    sol: `function mergeTwoLists(l1, l2) {
  const dummy = { next: null };
  let tail = dummy;
  while (l1 && l2) {
    if (l1.val <= l2.val) { tail.next = l1; l1 = l1.next; }
    else { tail.next = l2; l2 = l2.next; }
    tail = tail.next;
  }
  tail.next = l1 || l2; // доєднуємо залишок
  return dummy.next;
}
// O(n + m)`,
    exp: "Фіктивний (dummy) вузол усуває потребу окремо обробляти голову списку — поширений трюк.",
  },
  {
    id: "d39",
    cat: "Algorithms",
    lvl: "med",
    q: "Merge Intervals (об'єднання інтервалів)",
    sol: `function merge(intervals) {
  intervals.sort((a, b) => a[0] - b[0]); // за початком
  const res = [intervals[0]];
  for (let i = 1; i < intervals.length; i++) {
    const last = res[res.length - 1];
    if (intervals[i][0] <= last[1]) {
      last[1] = Math.max(last[1], intervals[i][1]); // перетин → розширюємо
    } else {
      res.push(intervals[i]);
    }
  }
  return res;
}
// O(n log n) через сортування`,
    exp: "Ключове — спершу відсортувати за початком, тоді перетини стають сусідніми.",
  },
  {
    id: "d40",
    cat: "Algorithms",
    lvl: "easy",
    q: "Climbing Stairs (динамічне програмування)",
    sol: `function climbStairs(n) {
  let a = 1, b = 1;
  for (let i = 0; i < n; i++) {
    [a, b] = [b, a + b];
  }
  return a;
}
// Час O(n), пам'ять O(1)`,
    exp: "Це числа Фібоначчі: ways(n) = ways(n-1) + ways(n-2). Ітеративно, без масиву і без рекурсії.",
  },
  {
    id: "d41",
    cat: "Algorithms",
    lvl: "med",
    q: "Number of Islands (DFS)",
    sol: `function numIslands(grid) {
  let count = 0;
  const dfs = (r, c) => {
    if (r < 0 || c < 0 || r >= grid.length || c >= grid[0].length || grid[r][c] !== '1') return;
    grid[r][c] = '0'; // 'затоплюємо' відвідану клітинку
    dfs(r + 1, c); dfs(r - 1, c); dfs(r, c + 1); dfs(r, c - 1);
  };
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[0].length; c++) {
      if (grid[r][c] === '1') { count++; dfs(r, c); }
    }
  }
  return count;
}
// O(m·n)`,
    exp: "Кожна нова '1' — новий острів; DFS 'заливає' весь пов'язаний масив суші, щоб він не був порахований двічі.",
  },
  {
    id: "d42",
    cat: "Algorithms",
    lvl: "hard",
    q: "LRU Cache (улюблене питання на Senior)",
    sol: `class LRUCache {
  constructor(capacity) {
    this.cap = capacity;
    this.map = new Map(); // Map зберігає порядок вставки
  }
  get(key) {
    if (!this.map.has(key)) return -1;
    const val = this.map.get(key);
    this.map.delete(key);
    this.map.set(key, val); // переміщуємо в 'найновіші'
    return val;
  }
  put(key, val) {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, val);
    if (this.map.size > this.cap) {
      this.map.delete(this.map.keys().next().value); // витісняємо найстаріший
    }
  }
}
// get/put в O(1)`,
    exp: "Хитрість: JS Map зберігає порядок вставки, тож перший ключ — найстаріший. delete+set оновлює 'свіжість'. Класичне рішення без ручної реалізації двозв'язного списку.",
  },
  {
    id: "d43",
    cat: "JavaScript",
    lvl: "easy",
    q: "Реалізуйте debounce(fn, delay)",
    sol: `function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}`,
    exp: "Кожен новий виклик скидає таймер — fn виконується лише після паузи в delay мс без нових викликів (наприклад, пошук під час введення тексту).",
  },
  {
    id: "d44",
    cat: "JavaScript",
    lvl: "med",
    q: "Реалізуйте curry(fn)",
    sol: `function curry(fn) {
  return function curried(...args) {
    if (args.length >= fn.length) return fn.apply(this, args);
    return (...next) => curried.apply(this, [...args, ...next]);
  };
}
// const add = (a,b,c) => a+b+c; curry(add)(1)(2)(3) === 6`,
    exp: "fn.length — очікувана арність (кількість аргументів). Поки аргументів менше за це число, повертаємо нову функцію, яка збирає решту.",
  },
  {
    id: "d45",
    cat: "JavaScript",
    lvl: "med",
    q: "Реалізуйте memoize(fn)",
    sol: `function memoize(fn) {
  const cache = new Map();
  return function (...args) {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
}`,
    exp: "Кеш із ключем на основі серіалізованих аргументів. Для об'єктних ключів краще підійде WeakMap; для складних випадків — власний резолвер ключа.",
  },
  {
    id: "d46",
    cat: "JavaScript",
    lvl: "easy",
    q: "Розгортання (flatten) вкладеного масиву",
    sol: `function flatten(arr) {
  return arr.reduce(
    (acc, item) => acc.concat(Array.isArray(item) ? flatten(item) : item),
    []
  );
}
// Нативно: arr.flat(Infinity)`,
    exp: "Рекурсія по вкладених масивах через reduce. Сучасна альтернатива — Array.prototype.flat(Infinity).",
  },
  {
    id: "d47",
    cat: "JavaScript",
    lvl: "med",
    q: "Реалізуйте EventEmitter (on/off/emit)",
    sol: `class EventEmitter {
  constructor() { this.listeners = new Map(); }
  on(event, cb) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(cb);
    return () => this.off(event, cb); // функція для відписки
  }
  off(event, cb) { this.listeners.get(event)?.delete(cb); }
  emit(event, ...args) {
    this.listeners.get(event)?.forEach((cb) => cb(...args));
  }
}`,
    exp: "Map<event, Set<cb>>. on повертає функцію відписки — зручний патерн (як cleanup у React useEffect).",
  },
  {
    id: "d48",
    cat: "JavaScript",
    lvl: "med",
    q: "deepEqual(a, b) — глибоке порівняння",
    sol: `function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => deepEqual(a[k], b[k]));
}`,
    exp: "Спершу порівняння за посиланням/примітивом, потім кількість ключів, потім рекурсія по значеннях.",
  },
  {
    id: "d49",
    cat: "JavaScript",
    lvl: "easy",
    q: "chunk(arr, size) — розбиття на групи",
    sol: `function chunk(arr, size) {
  const res = [];
  for (let i = 0; i < arr.length; i += size) {
    res.push(arr.slice(i, i + size));
  }
  return res;
}
// chunk([1,2,3,4,5], 2) => [[1,2],[3,4],[5]]`,
    exp: "Проходимо масив кроками по size + slice. Класика для пагінації/батчингу.",
  },
  {
    id: "d50",
    cat: "JavaScript",
    lvl: "med",
    q: "compose і pipe",
    sol: `const pipe = (...fns) => (x) => fns.reduce((acc, fn) => fn(acc), x);
const compose = (...fns) => (x) => fns.reduceRight((acc, fn) => fn(acc), x);
// pipe(f, g)(x) === g(f(x)); compose(f, g)(x) === f(g(x))`,
    exp: "pipe виконується зліва направо (reduce), compose — справа наліво (reduceRight). Основа функціонального стилю.",
  },
  {
    id: "d51",
    cat: "JavaScript",
    lvl: "hard",
    q: "asyncPool — обмеження паралелізму промісів",
    sol: `async function asyncPool(limit, items, iteratorFn) {
  const results = [];
  const executing = new Set();
  for (const item of items) {
    const p = Promise.resolve().then(() => iteratorFn(item));
    results.push(p);
    executing.add(p);
    p.finally(() => executing.delete(p));
    if (executing.size >= limit) await Promise.race(executing);
  }
  return Promise.all(results);
}`,
    exp: "Тримаємо не більше limit промісів 'у польоті'; Promise.race чекає, поки звільниться слот. Так ми не заваливаємо API тисячею запитів одночасно.",
  },
  {
    id: "d52",
    cat: "TypeScript",
    lvl: "med",
    q: "DeepPartial<T>",
    sol: `type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};`,
    exp: "Рекурсивний мапований тип з ? робить кожне поле опціональним, включно з вкладеними.",
  },
  {
    id: "d53",
    cat: "TypeScript",
    lvl: "med",
    q: "MyAwaited<T> через infer",
    sol: `type MyAwaited<T> = T extends Promise<infer U>
  ? (U extends Promise<any> ? MyAwaited<U> : U)
  : T;
// MyAwaited<Promise<Promise<number>>> // number`,
    exp: "infer витягує тип із Promise; рекурсія 'розгортає' вкладені проміси (як вбудований Awaited).",
  },
  {
    id: "d54",
    cat: "TypeScript",
    lvl: "easy",
    q: "TupleToUnion<T>",
    sol: `type TupleToUnion<T extends readonly any[]> = T[number];
// TupleToUnion<['a','b','c']> // 'a' | 'b' | 'c'`,
    exp: "Індексація кортежу (tuple) через number повертає об'єднання (union) усіх його елементів.",
  },
  {
    id: "d55",
    cat: "TypeScript",
    lvl: "easy",
    q: "MyPick<T, K>",
    sol: `type MyPick<T, K extends keyof T> = { [P in K]: T[P] };`,
    exp: "Мапований тип по підмножині ключів K. K extends keyof T гарантує валідність ключів.",
  },
  {
    id: "d56",
    cat: "React",
    lvl: "easy",
    q: "Хук usePrevious(value)",
    sol: `function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();
  useEffect(() => { ref.current = value; }, [value]);
  return ref.current;
}`,
    exp: "Ефект оновлює ref ПІСЛЯ рендеру, тож під час рендеру він все ще повертає попереднє значення.",
  },
  {
    id: "d57",
    cat: "React",
    lvl: "med",
    q: "Хук useDebouncedValue(value, delay)",
    sol: `function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}`,
    exp: "cleanup скасовує попередній таймер — стан оновлюється лише після паузи. Ідеально для поля пошуку.",
  },
  {
    id: "d58",
    cat: "React",
    lvl: "med",
    q: "Хук useLocalStorage(key, initial)",
    sol: `function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : initial;
  });
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);
  return [value, setValue] as const;
}`,
    exp: "Лінива ініціалізація (функція в useState читає сховище один раз) + синхронізація назад через ефект.",
  },
  {
    id: "d59",
    cat: "React",
    lvl: "med",
    q: "Хук useOnClickOutside(ref, handler)",
    sol: `function useOnClickOutside(ref, handler) {
  useEffect(() => {
    const listener = (e) => {
      if (!ref.current || ref.current.contains(e.target)) return;
      handler(e);
    };
    document.addEventListener('mousedown', listener);
    return () => document.removeEventListener('mousedown', listener);
  }, [ref, handler]);
}`,
    exp: "Слухаємо кліки на document; якщо клік поза ref, викликаємо handler (закрити модалку/дропдаун).",
  },
  {
    id: "d60",
    cat: "React",
    lvl: "med",
    q: "Хук useInterval(callback, delay)",
    sol: `function useInterval(callback, delay) {
  const savedCb = useRef(callback);
  useEffect(() => { savedCb.current = callback; }, [callback]);
  useEffect(() => {
    if (delay === null) return;
    const id = setInterval(() => savedCb.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}`,
    exp: "ref тримає найсвіжіший callback, тож інтервал не перестворюється щоразу (патерн Дена Абрамова).",
  },
  {
    id: "d61",
    cat: "SQL",
    lvl: "med",
    q: "Top-N у кожній групі (віконна функція)",
    sol: `-- Топ-3 найдорожчі товари в кожній категорії
SELECT category, name, price FROM (
  SELECT category, name, price,
         ROW_NUMBER() OVER (PARTITION BY category ORDER BY price DESC) AS rn
  FROM products
) t
WHERE rn <= 3;`,
    exp: "ROW_NUMBER() з PARTITION BY нумерує рядки в межах кожної групи; фільтруємо в зовнішньому запиті.",
  },
  {
    id: "d62",
    cat: "SQL",
    lvl: "med",
    q: "Видалення дублікатів рядків",
    sol: `-- Залишаємо рядок з найменшим id для кожного email
DELETE FROM users a
USING users b
WHERE a.id > b.id AND a.email = b.email;`,
    exp: "Self-join: видаляємо рядки з більшим id, залишаючи один унікальний рядок на кожен email.",
  },
  {
    id: "d63",
    cat: "SQL",
    lvl: "med",
    q: "Дні, в які взагалі не було замовлень",
    sol: `-- Дати за останній тиждень, у які не було замовлень
SELECT d::date
FROM generate_series(CURRENT_DATE - 6, CURRENT_DATE, '1 day') AS d
LEFT JOIN orders o ON o.created_at::date = d::date
WHERE o.id IS NULL;`,
    exp: "generate_series генерує всі дати; LEFT JOIN + IS NULL знаходить прогалини (anti-join).",
  },
  {
    id: "d64",
    cat: "SQL",
    lvl: "hard",
    q: "Ковзне середнє за 7 днів",
    sol: `SELECT day, amount,
       AVG(amount) OVER (
         ORDER BY day ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
       ) AS moving_avg_7d
FROM daily_sales
ORDER BY day;`,
    exp: "Віконний фрейм ROWS BETWEEN ... визначає 'вікно' рядків для агрегатної функції — саме так обчислюються ковзні метрики.",
  },
  {
    id: "d65",
    cat: "Node.js",
    lvl: "med",
    q: "In-memory кеш з TTL",
    sol: `class TTLCache {
  constructor() { this.store = new Map(); }
  set(key, value, ttlMs) {
    this.store.set(key, { value, expires: Date.now() + ttlMs });
  }
  get(key) {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (Date.now() > hit.expires) { this.store.delete(key); return undefined; }
    return hit.value;
  }
}`,
    exp: "Зберігаємо час закінчення терміну дії та перевіряємо його ліниво при читанні (lazy expiration). У продакшені — Redis з TTL.",
  },
  {
    id: "d66",
    cat: "Node.js",
    lvl: "med",
    q: "Transform stream (переведення у верхній регістр)",
    sol: `import { Transform } from 'node:stream';

const upper = new Transform({
  transform(chunk, _enc, cb) {
    cb(null, chunk.toString().toUpperCase());
  },
});
// process.stdin.pipe(upper).pipe(process.stdout);`,
    exp: "Transform обробляє дані частинами (chunks), не тримаючи все в пам'яті — критично для великих файлів.",
  },
  {
    id: "d67",
    cat: "Node.js",
    lvl: "med",
    q: "promisify(fn) для API на колбеках",
    sol: `function promisify(fn) {
  return (...args) =>
    new Promise((resolve, reject) => {
      fn(...args, (err, result) => (err ? reject(err) : resolve(result)));
    });
}`,
    exp: "Обгортає error-first колбек у Promise. Node вже має вбудований util.promisify.",
  },
  {
    id: "d68",
    cat: "Node.js",
    lvl: "med",
    q: "Graceful shutdown сервера",
    sol: `const server = app.listen(3000);
function shutdown() {
  server.close(() => {
    // тут закриваємо БД, черги, з'єднання
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref(); // примусовий вихід через 10с
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);`,
    exp: "Припиняємо приймати нові з'єднання, чекаємо на ті, що вже в процесі, примусово завершуємо роботу за таймаутом. Обов'язково для k8s/деплоїв.",
  },
  {
    id: "d69",
    cat: "NestJS",
    lvl: "med",
    q: "Кастомний ParseIntPipe",
    sol: `@Injectable()
export class ParseIntPipe implements PipeTransform {
  transform(value: string) {
    const num = Number(value);
    if (Number.isNaN(num)) throw new BadRequestException('Not a number');
    return num;
  }
}
// @Get(':id') get(@Param('id', ParseIntPipe) id: number) {}`,
    exp: "Pipe трансформує/валідує аргумент до того, як він потрапить у handler — контролер залишається чистим.",
  },
  {
    id: "d70",
    cat: "NestJS",
    lvl: "med",
    q: "RolesGuard через Reflector",
    sol: `@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.get<string[]>('roles', ctx.getHandler());
    if (!roles) return true;
    const { user } = ctx.switchToHttp().getRequest();
    return roles.some((r) => user?.roles?.includes(r));
  }
}`,
    exp: "Reflector зчитує метадані @Roles() з handler'а; guard вирішує доступ ще до виконання контролера.",
  },
  {
    id: "d71",
    cat: "Algorithms",
    lvl: "easy",
    q: "Move Zeroes (переміщення нулів)",
    sol: `function moveZeroes(nums) {
  let insert = 0;
  for (let i = 0; i < nums.length; i++) {
    if (nums[i] !== 0) {
      [nums[insert], nums[i]] = [nums[i], nums[insert]];
      insert++;
    }
  }
  return nums;
}
// Час O(n), пам'ять O(1)`,
    exp: "Два вказівники: insert — позиція для наступного ненульового елемента. Нулі 'спливають' у кінець.",
  },
  {
    id: "d72",
    cat: "Algorithms",
    lvl: "med",
    q: "3Sum (трійки, що в сумі дають 0)",
    sol: `function threeSum(nums) {
  nums.sort((a, b) => a - b);
  const res = [];
  for (let i = 0; i < nums.length - 2; i++) {
    if (i > 0 && nums[i] === nums[i - 1]) continue; // пропускаємо дублікати
    let l = i + 1, r = nums.length - 1;
    while (l < r) {
      const sum = nums[i] + nums[l] + nums[r];
      if (sum === 0) {
        res.push([nums[i], nums[l], nums[r]]);
        while (l < r && nums[l] === nums[l + 1]) l++;
        while (l < r && nums[r] === nums[r - 1]) r--;
        l++; r--;
      } else if (sum < 0) l++;
      else r--;
    }
  }
  return res;
}
// O(n^2)`,
    exp: "Сортуємо, фіксуємо i, потім два вказівники. Пропуск дублікатів гарантує унікальність трійок.",
  },
  {
    id: "d73",
    cat: "Algorithms",
    lvl: "med",
    q: "Container With Most Water (контейнер з найбільшим об'ємом води)",
    sol: `function maxArea(height) {
  let l = 0, r = height.length - 1, max = 0;
  while (l < r) {
    const area = Math.min(height[l], height[r]) * (r - l);
    max = Math.max(max, area);
    if (height[l] < height[r]) l++;
    else r--;
  }
  return max;
}
// O(n)`,
    exp: "Два вказівники з країв; рухаємо коротшу стінку — лише так площа може зрости.",
  },
  {
    id: "d74",
    cat: "Algorithms",
    lvl: "easy",
    q: "Linked List Cycle (алгоритм Флойда)",
    sol: `function hasCycle(head) {
  let slow = head, fast = head;
  while (fast && fast.next) {
    slow = slow.next;
    fast = fast.next.next;
    if (slow === fast) return true;
  }
  return false;
}
// Час O(n), пам'ять O(1)`,
    exp: "'Черепаха і заєць': якщо цикл є, швидкий вказівник гарантовано наздожене повільний.",
  },
  {
    id: "d75",
    cat: "Algorithms",
    lvl: "easy",
    q: "Середина зв'язного списку",
    sol: `function middleNode(head) {
  let slow = head, fast = head;
  while (fast && fast.next) {
    slow = slow.next;
    fast = fast.next.next;
  }
  return slow;
}`,
    exp: "Коли швидкий вказівник (крок 2) досягає кінця, повільний (крок 1) опиняється точно посередині.",
  },
  {
    id: "d76",
    cat: "Algorithms",
    lvl: "med",
    q: "Min Stack (getMin за O(1))",
    sol: `class MinStack {
  constructor() { this.stack = []; this.mins = []; }
  push(x) {
    this.stack.push(x);
    const min = this.mins.length ? Math.min(x, this.mins[this.mins.length - 1]) : x;
    this.mins.push(min);
  }
  pop() { this.mins.pop(); return this.stack.pop(); }
  top() { return this.stack[this.stack.length - 1]; }
  getMin() { return this.mins[this.mins.length - 1]; }
}
// усі операції O(1)`,
    exp: "Паралельний стек мінімумів: при кожному push зберігаємо поточний мінімум, тож getMin — O(1).",
  },
  {
    id: "d77",
    cat: "Algorithms",
    lvl: "med",
    q: "Coin Change (мінімальна кількість монет)",
    sol: `function coinChange(coins, amount) {
  const dp = new Array(amount + 1).fill(Infinity);
  dp[0] = 0;
  for (let a = 1; a <= amount; a++) {
    for (const c of coins) {
      if (c <= a) dp[a] = Math.min(dp[a], dp[a - c] + 1);
    }
  }
  return dp[amount] === Infinity ? -1 : dp[amount];
}
// O(amount * coins)`,
    exp: "dp[a] — мінімальна кількість монет для суми a. Будуємо знизу вгору, перебираючи кожну монету.",
  },
  {
    id: "d78",
    cat: "Algorithms",
    lvl: "med",
    q: "House Robber (динамічне програмування)",
    sol: `function rob(nums) {
  let prev = 0, curr = 0;
  for (const n of nums) {
    [prev, curr] = [curr, Math.max(curr, prev + n)];
  }
  return curr;
}
// Час O(n), пам'ять O(1)`,
    exp: "Для кожного будинку: пропустити його (curr) чи обікрасти (prev + n). Не можна обкрадати два поспіль.",
  },
  {
    id: "d79",
    cat: "Algorithms",
    lvl: "hard",
    q: "Course Schedule (топологічне сортування)",
    sol: `function canFinish(numCourses, prerequisites) {
  const graph = Array.from({ length: numCourses }, () => []);
  const indegree = new Array(numCourses).fill(0);
  for (const [course, pre] of prerequisites) {
    graph[pre].push(course);
    indegree[course]++;
  }
  const queue = [];
  for (let i = 0; i < numCourses; i++) if (indegree[i] === 0) queue.push(i);
  let done = 0;
  while (queue.length) {
    const node = queue.shift();
    done++;
    for (const next of graph[node]) {
      if (--indegree[next] === 0) queue.push(next);
    }
  }
  return done === numCourses; // всі опрацьовані → циклу немає
}
// Алгоритм Кана, O(V + E)`,
    exp: "Якщо всі вузли можна впорядкувати (немає циклу залежностей), курси реально можна пройти.",
  },
  {
    id: "d80",
    cat: "Algorithms",
    lvl: "med",
    q: "K-й найбільший елемент",
    sol: `function findKthLargest(nums, k) {
  return [...nums].sort((a, b) => b - a)[k - 1]; // O(n log n)
  // Оптимізації: min-heap розміром k → O(n log k); quickselect → в середньому O(n)
}`,
    exp: "Просте рішення — сортування. На співбесіді варто згадати min-heap (O(n log k)) або quickselect (у середньому O(n)).",
  },
  {
    id: "d81",
    cat: "Algorithms",
    lvl: "easy",
    q: "Invert Binary Tree (інвертування бінарного дерева)",
    sol: `function invertTree(root) {
  if (!root) return null;
  [root.left, root.right] = [invertTree(root.right), invertTree(root.left)];
  return root;
}`,
    exp: "Рекурсивно міняємо місцями ліве й праве піддерева. Легендарна задача (про неї навіть є мем про Google).",
  },
  {
    id: "d82",
    cat: "Algorithms",
    lvl: "easy",
    q: "Максимальна глибина бінарного дерева",
    sol: `function maxDepth(root) {
  if (!root) return 0;
  return 1 + Math.max(maxDepth(root.left), maxDepth(root.right));
}`,
    exp: "Глибина = 1 + максимальна глибина піддерев. Базовий DFS по дереву.",
  },
  {
    id: "d83",
    cat: "Algorithms",
    lvl: "med",
    q: "Валідація бінарного дерева пошуку (BST)",
    sol: `function isValidBST(root, min = -Infinity, max = Infinity) {
  if (!root) return true;
  if (root.val <= min || root.val >= max) return false;
  return isValidBST(root.left, min, root.val) &&
         isValidBST(root.right, root.val, max);
}`,
    exp: "Передаємо допустимий діапазон (min, max) вниз по рекурсії. Порівняння лише з батьківським вузлом недостатньо!",
  },
  {
    id: "d84",
    cat: "Algorithms",
    lvl: "med",
    q: "Пошук у 'повернутому' (rotated) відсортованому масиві",
    sol: `function search(nums, target) {
  let lo = 0, hi = nums.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (nums[mid] === target) return mid;
    if (nums[lo] <= nums[mid]) {              // ліва половина відсортована
      if (nums[lo] <= target && target < nums[mid]) hi = mid - 1;
      else lo = mid + 1;
    } else {                                   // права половина відсортована
      if (nums[mid] < target && target <= nums[hi]) lo = mid + 1;
      else hi = mid - 1;
    }
  }
  return -1;
}
// O(log n)`,
    exp: "Модифікований бінарний пошук: одна з двох половин завжди відсортована — визначаємо яка саме і звужуємо діапазон.",
  },
  {
    id: "d85",
    cat: "Algorithms",
    lvl: "med",
    q: "Subsets (усі підмножини)",
    sol: `function subsets(nums) {
  const res = [];
  const backtrack = (start, path) => {
    res.push([...path]);
    for (let i = start; i < nums.length; i++) {
      path.push(nums[i]);
      backtrack(i + 1, path);
      path.pop();
    }
  };
  backtrack(0, []);
  return res;
}
// O(2^n)`,
    exp: "Backtracking: на кожному кроці або включаємо елемент, або ні. Базовий шаблон для комбінаторних задач.",
  },
  {
    id: "d86",
    cat: "System Design",
    lvl: "med",
    q: "Спроєктуйте скорочувач URL (на кшталт bit.ly)",
    sol: `Вимоги: короткий код → довгий URL, редирект, ~100:1 читання/запис.

API:
  POST /shorten { url } -> { shortCode }
  GET /:code -> 301 redirect

Генерація коду:
  - base62(id) від auto-increment (короткий, без колізій), або
  - hash(url) з перевіркою на колізії.

Зберігання:
  code (PK) | long_url | created_at | clicks
  Key-value (Redis) для гарячих читань + БД як джерело істини.

Масштабування:
  - Кешувати редиректи (99% читань) у Redis/CDN.
  - Read-репліки БД.
  - 7 символів base62 = 62^7 ≈ 3.5 трильйона URL.`,
    exp: "Варто обговорити: генерацію коду (лічильник vs hash), кеш для читань, аналітику кліків асинхронно через чергу, TTL для тимчасових посилань.",
  },
  {
    id: "d87",
    cat: "System Design",
    lvl: "med",
    q: "Спроєктуйте rate limiter",
    sol: `Мета: не більше N запитів на користувача в межах вікна T.

Алгоритми:
  - Fixed window: лічильник на ключі user:minute (простий, але сплески (bursts) на межі вікна).
  - Sliding window log/counter: точніший, дорожчий.
  - Token bucket: дозволяє контрольовані сплески (найпоширеніший варіант).

Реалізація (token bucket у Redis):
  - key = user_id; поля: tokens, last_refill.
  - при запиті: поповнюємо токени залежно від часу, що минув; якщо >=1 — списуємо і дозволяємо; інакше 429.
  - атомарність через Lua-скрипт / MULTI.

Розподілена система: спільний Redis, щоб ліміт діяв на всіх інстансах.`,
    exp: "Варто згадати: 429 Too Many Requests + заголовок Retry-After; token bucket — де-факто стандарт; атомарність критична при паралельних запитах.",
  },
  {
    id: "d88",
    cat: "System Design",
    lvl: "hard",
    q: "Спроєктуйте стрічку новин (news feed)",
    sol: `Два підходи до доставки:
  - Fan-out on write (push): коли автор публікує пост, його id проштовхується у стрічку кожного фоловера (список у Redis). Швидкі читання, дорогі записи для 'селебріті'.
  - Fan-out on read (pull): читаємо пости всіх, на кого підписані, і об'єднуємо їх. Дешеві записи, дорожчі читання.
  - Гібридний підхід: push для звичайних акаунтів, pull для акаунтів із мільйонами фоловерів.

Компоненти:
  - Post service, Graph service (підписки), Feed service, Redis-кеш стрічок.
  - Ранжування (за часом/релевантністю) + пагінація (cursor, а не offset).
  - Медіа через CDN.`,
    exp: "Класична дилема push vs pull. Ключове — гібрид для 'гарячих' користувачів, cursor-пагінація та кешування вже побудованих стрічок.",
  },
];
