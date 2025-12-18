// async function collect<Func>(promise: () => Promise<ReturnType<Func>>) {

export function to<T, U = Error>(promise: Promise<T>, errorExt?: object): Promise<[U, undefined] | [null, T]> {
  return promise
    .then<[null, T]>((data: T) => [
      null,
      data,
    ])
    .catch<[U, undefined]>((err: U) => {
      if (errorExt) {
        const parsedError = { ...err, ...errorExt };
        return [
          parsedError,
          undefined,
        ];
      }

      return [
        err,
        undefined,
      ];
    });
}

type PromiseSuccess<DataType> = [data: Awaited<DataType>, error: null];
type PromiseFailure<FailType = string> = [data: undefined, error: FailType];
type PromiseResponse<DataType> = PromiseFailure | PromiseSuccess<DataType>;

async function collect2<DataType>(promise: Promise<DataType>): Promise<[DataType, undefined] | [undefined, Error]> {
  try {
    const data = await promise;
    return [
      data,
      undefined,
    ];
  } catch (err: unknown) {
    // tale care of strings, numbers and booleans
    if (typeof err === 'string' || typeof err === 'number' || typeof err === 'boolean') {
      return [
        undefined,
        new Error(err.toString()),
      ];
    }
    // Otherwise we have an object or an array
    const myError = new Error('Promise Rejected', { cause: err });
    return [
      undefined,
      myError,
    ];
  }
}

const [
  user2,
  error2,
] = await collect2(getUser());
if (error2) {
  error2;
} else {
  user2;
}

const [
  sammy2,
  sammyError2,
] = await collect2(getSandwich());
if (sammyError2) {
  sammyError2;
} else {
  sammy2;
}

const [
  toErr,
  toUser,
] = await to(getUser());
if (toErr) {
  toErr;
} else {
  toUser;
}

if (error2 instanceof string) {
  error2;
} else {
  user2;
}
const [
  r1,
  e1,
] = await collect2(getSandwich());

async function collect<Func extends Promise<Callback>>(promise: Func): Promise<[Awaited<Func>, undefined]> {
  const data = await promise;
  return [
    data,
    undefined,
  ];
  // try {
  // } catch (err: unknown) {
  //   return [undefined, err];
  // }
}

type User = { name: string };
type Sandwich = { bread: string };

async function getUser(): Promise<User> {
  return { name: 'John' };
}

async function getSandwich(): Promise<Sandwich> {
  return { bread: 'rye' };
}

const simpleUser = await getUser();
const [
  user,
  error,
] = await collect(getUser());
const [
  sammy,
  sammyError,
] = await collect(getSandwich());

type ReturnOfFunc = Awaited<ReturnType<typeof getUser>>;

export {};
