async function getUser(id) {
  // Imagine ths being an API that takes time. Just imagine!
  return new Promise((resolve, reject) => {
    if (id === 69) {
      return reject('User Not Found');
    }
    resolve({ name: 'Wes Bos', cool: true });
  }, 1);
}


async function collect(promise) {
  try {
    const data = await promise;
    return [data, undefined];
  } catch (err) {
    return [undefined, err];
  }
}

const [user, userError] = await collect(getUser(3));
console.log(user)

const [user2, userError2] = await collect(getUser(69));
console.log(userError2)


